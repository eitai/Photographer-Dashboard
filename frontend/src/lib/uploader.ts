/**
 * Multipart S3 / Wasabi uploader.
 *
 * High-level flow:
 *   1. HASHING       — slice the file, stream each slice into a Web Worker
 *                       running hash-wasm to compute the whole-file SHA-256.
 *   2. INITIALIZING  — POST /api/uploads/init to obtain an assetId, uploadId,
 *                       and a list of presigned PUT URLs (one per part).
 *   3. UPLOADING     — concurrently PUT each file slice directly to its
 *                       presigned URL (no auth headers!), capturing the ETag
 *                       from each response. Per-part retry with exponential
 *                       backoff up to 3 attempts.
 *   4. COMPLETING    — POST /api/uploads/complete with the collected
 *                       (partNumber, etag) tuples. Returns the asset record.
 *
 * Cancellation:
 *   - If `opts.signal` aborts at any phase we abort all in-flight fetches,
 *     terminate the hashing worker, fire-and-forget /api/uploads/abort, and
 *     throw an AbortError.
 *
 * Errors:
 *   - On any non-abort failure (network, 5xx, signature mismatch) we attempt
 *     /api/uploads/abort and re-throw with a user-actionable message.
 *
 * Memory:
 *   - We never read the whole file into memory; only one chunk per worker
 *     iteration plus up to `concurrency` chunks held by in-flight PUTs.
 *
 * Public API: see `uploadFile`. Internals are exported for testing where
 * marked. New code only — does NOT touch the existing upload flow in
 * `useGalleryUpload.ts`.
 */
import api from '@/lib/api';
import HashWorker from '@/lib/hash-worker?worker';
import type { HashWorkerInbound, HashWorkerOutbound } from '@/lib/hash-worker';
import JxlWorker from '@/lib/jxl-worker?worker';
import type {
  JxlEncodeOptions,
  JxlWorkerInbound,
  JxlWorkerOutbound,
} from '@/lib/jxl-worker';

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  /**
   * Upload phase.
   *  - hashing/initializing/uploading/completing: original file pipeline.
   *  - encoding-jxl/uploading-jxl/completing-jxl: optional JXL sidecar
   *    pipeline used by `uploadFileWithJxlSidecar` after the original
   *    finishes successfully.
   *
   *  For the sidecar path, the overall progress weighting is roughly:
   *    original 60% → JXL encode+upload 35% → finalisation 5%.
   */
  phase:
    | 'hashing'
    | 'initializing'
    | 'uploading'
    | 'completing'
    | 'encoding-jxl'
    | 'uploading-jxl'
    | 'completing-jxl';
  currentPart?: number;
  totalParts?: number;
}

export interface UploadResult {
  assetId: string;
  key: string;
  bytes: number;
  sha256: string;
}

export interface UploadOptions {
  galleryId: string;
  /** Bytes per part. Default: 95 MiB (Wasabi multipart minimum is 5 MiB). */
  chunkSize?: number;
  /** Max parts uploading in parallel. Default: 4. */
  concurrency?: number;
  onProgress?: (p: UploadProgress) => void;
  signal?: AbortSignal;
}

// ──────────────────────────────────────────────────────────────────────────────
// API contract types (must match backend agent's /api/uploads/* endpoints)
// ──────────────────────────────────────────────────────────────────────────────

interface InitRequest {
  filename: string;
  size: number;
  mimeType: string;
  sha256: string;
  galleryId: string;
}

interface PresignedPart {
  partNumber: number;
  presignedUrl: string;
}

interface InitResponse {
  assetId: string;
  uploadId: string;
  key: string;
  partSize: number;
  parts: PresignedPart[];
}

interface CompleteRequest {
  assetId: string;
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
}

// Asset shape is owned by the backend; we surface only the fields the slice
// promises and pass-through whatever else lands. Slice 3 will refine.
interface CompleteResponse {
  asset: {
    id: string;
    key: string;
    bytes: number;
    sha256: string;
    [k: string]: unknown;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_CHUNK_SIZE = 95 * 1024 * 1024; // 95 MiB
const DEFAULT_CONCURRENCY = 4;
const RETRY_DELAYS_MS = [250, 500, 1000] as const; // attempts 2, 3, 4
const MAX_PART_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

// ──────────────────────────────────────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────────────────────────────────────

const makeAbortError = (message = 'Upload aborted'): DOMException => {
  // DOMException with name 'AbortError' is the standard the fetch API throws.
  return new DOMException(message, 'AbortError');
};

const isAbortError = (err: unknown): boolean => {
  return err instanceof DOMException && err.name === 'AbortError';
};

// ──────────────────────────────────────────────────────────────────────────────
// Hashing — Web Worker with backpressure
// ──────────────────────────────────────────────────────────────────────────────

/** Promise-based wrapper around the streaming hash worker. */
class StreamingHasher {
  private worker: Worker;
  // FIFO queue of pending request awaiters. Worker replies in send-order,
  // so we resolve from the head. A single-pending pattern would drop
  // promises on overlapping sends and route replies to the wrong caller.
  private queue: Array<{
    resolve: (msg: HashWorkerOutbound) => void;
    reject: (err: Error) => void;
  }> = [];
  // Once the worker has fatally errored, all current and future sends are
  // rejected with this error rather than hanging.
  private fatalError: Error | null = null;

  constructor() {
    this.worker = new HashWorker();
    this.worker.onmessage = (ev: MessageEvent<HashWorkerOutbound>) => {
      const msg = ev.data;
      if (msg.type === 'error') {
        this.fatalError = new Error(`Hash worker error: ${msg.message}`);
        const rejecters = this.queue.splice(0);
        rejecters.forEach((r) => r.reject(this.fatalError as Error));
        return;
      }
      const next = this.queue.shift();
      if (next) next.resolve(msg);
      // If nothing was pending, the message is dropped — callers must always
      // await `send()` so that won't happen in practice.
    };
    this.worker.onerror = (ev: ErrorEvent) => {
      this.fatalError = new Error(`Hash worker error: ${ev.message || 'unknown'}`);
      const rejecters = this.queue.splice(0);
      rejecters.forEach((r) => r.reject(this.fatalError as Error));
    };
  }

  private send(msg: HashWorkerInbound, transfer?: Transferable[]): Promise<HashWorkerOutbound> {
    if (this.fatalError) return Promise.reject(this.fatalError);
    return new Promise<HashWorkerOutbound>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      if (transfer && transfer.length > 0) {
        this.worker.postMessage(msg, transfer);
      } else {
        this.worker.postMessage(msg);
      }
    });
  }

  async init(): Promise<void> {
    const reply = await this.send({ type: 'init' });
    if (reply.type !== 'ready') throw new Error('Hash worker did not become ready');
  }

  async update(chunk: ArrayBuffer): Promise<void> {
    // Transfer ownership of the buffer to the worker — avoids a copy on
    // multi-GB files where allocator pressure matters.
    const reply = await this.send({ type: 'chunk', data: chunk }, [chunk]);
    if (reply.type !== 'ack') throw new Error('Hash worker did not ack chunk');
  }

  async finalize(): Promise<string> {
    const reply = await this.send({ type: 'finalize' });
    if (reply.type !== 'digest') throw new Error('Hash worker did not return digest');
    return reply.hex;
  }

  terminate(): void {
    this.worker.terminate();
  }
}

/**
 * Stream-hash a file via the Web Worker.
 * Reads one chunk at a time so we never hold > chunkSize bytes in memory.
 */
async function hashFile(
  file: File,
  chunkSize: number,
  onBytesHashed: (bytes: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const hasher = new StreamingHasher();
  try {
    await hasher.init();

    let offset = 0;
    while (offset < file.size) {
      if (signal.aborted) throw makeAbortError();
      const end = Math.min(offset + chunkSize, file.size);
      const slice = file.slice(offset, end);
      const buf = await slice.arrayBuffer();
      // After the worker takes ownership, `buf` is detached on the main side.
      const byteLength = buf.byteLength;
      await hasher.update(buf);
      offset = end;
      onBytesHashed(byteLength);
    }

    return await hasher.finalize();
  } finally {
    hasher.terminate();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Network — init / part upload / complete / abort
// ──────────────────────────────────────────────────────────────────────────────

async function initUpload(req: InitRequest, signal: AbortSignal): Promise<InitResponse> {
  // axios v1 supports AbortSignal directly; JWT cookies + auth headers come
  // from the shared instance's interceptor in `lib/api.ts`.
  const { data } = await api.post<InitResponse>('/uploads/init', req, { signal });
  return data;
}

async function completeUpload(req: CompleteRequest, signal: AbortSignal): Promise<CompleteResponse> {
  const { data } = await api.post<CompleteResponse>('/uploads/complete', req, { signal });
  return data;
}

/**
 * Fire-and-forget abort. Never throws — best-effort cleanup so we don't mask
 * the original failure with a secondary one.
 */
async function abortUpload(assetId: string, uploadId: string): Promise<void> {
  try {
    await api.post('/uploads/abort', { assetId, uploadId });
  } catch {
    // Swallow — the original error is what the caller needs to see.
  }
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(makeAbortError());
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      signal.removeEventListener('abort', onAbort);
      reject(makeAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
};

/**
 * PUT a single part to its presigned URL. Returns the ETag header value
 * with surrounding quotes stripped — S3-compatible storage returns
 * `ETag: "abc123…"` literally with quotes, but boto3-style
 * CompleteMultipartUpload rejects quoted ETags. The contract with the
 * backend is unquoted hex.
 *
 * Retries up to MAX_PART_ATTEMPTS with exponential backoff. Honours the
 * abort signal between retries and during the request itself.
 */
async function putPartWithRetry(
  url: string,
  body: Blob,
  signal: AbortSignal,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_PART_ATTEMPTS; attempt++) {
    if (signal.aborted) throw makeAbortError();
    try {
      const res = await fetch(url, {
        method: 'PUT',
        body,
        signal,
        // No auth headers — presigned URLs must not be signed twice.
      });
      if (!res.ok) {
        // 4xx (except 408) won't recover by retrying; bail fast on 4xx other
        // than 408/429. Otherwise let the retry loop handle it.
        const status = res.status;
        const text = await res.text().catch(() => '');
        const err = new Error(
          `Part upload failed: ${status} ${res.statusText}${text ? ` — ${text}` : ''}`,
        );
        const retryable = status >= 500 || status === 408 || status === 429;
        if (!retryable) throw err;
        lastErr = err;
      } else {
        // Strip surrounding double-quotes — S3 returns `"hex"` literally.
        const etag = (res.headers.get('ETag') ?? res.headers.get('etag') ?? '').replace(
          /^"|"$/g,
          '',
        );
        if (!etag) {
          throw new Error(
            'No ETag in response — verify Wasabi CORS exposes the ETag header (Access-Control-Expose-Headers: ETag)',
          );
        }
        return etag;
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      lastErr = err;
    }

    // Backoff before next attempt (if any remain).
    const nextDelay = RETRY_DELAYS_MS[attempt];
    if (nextDelay !== undefined) {
      await sleep(nextDelay, signal);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('Part upload failed after retries');
}

// ──────────────────────────────────────────────────────────────────────────────
// Concurrent part queue
// ──────────────────────────────────────────────────────────────────────────────

interface PartPlan {
  partNumber: number;
  start: number;
  end: number; // exclusive
  url: string;
}

/**
 * Run an async worker over the parts list with bounded concurrency.
 * Aborts the whole batch on first error (per S3 multipart semantics — partial
 * uploads must be aborted, not retried piecemeal at this layer).
 *
 * Takes the AbortController (not just its signal) so that when one lane
 * fails terminally we can abort all the other in-flight PUTs immediately
 * rather than letting them finish their current chunk and waste bandwidth.
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  controller: AbortController,
): Promise<void> {
  if (items.length === 0) return;
  const signal = controller.signal;
  let cursor = 0;
  let firstErr: unknown = null;

  const next = async (): Promise<void> => {
    while (firstErr === null) {
      if (signal.aborted) {
        firstErr = makeAbortError();
        return;
      }
      const idx = cursor++;
      if (idx >= items.length) return;
      try {
        await worker(items[idx]);
      } catch (err) {
        if (firstErr === null) {
          firstErr = err;
          // Cancel the other lanes' in-flight PUTs ASAP — saves up to
          // (concurrency - 1) * chunkSize of bandwidth and memory.
          controller.abort();
        }
        return;
      }
    }
  };

  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(lanes);
  if (firstErr !== null) throw firstErr;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  opts: UploadOptions,
): Promise<UploadResult> {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const externalSignal = opts.signal;

  // Internal controller lets us coalesce multiple cancellation sources
  // (external signal + internal failures) into one signal handed to fetches.
  const controller = new AbortController();
  const onExternalAbort = (): void => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const signal = controller.signal;

  const totalBytes = file.size;
  let bytesUploaded = 0;

  const emit = (p: UploadProgress): void => {
    opts.onProgress?.(p);
  };

  // We need ids to call /uploads/abort if anything past INIT fails.
  let assetId: string | null = null;
  let uploadId: string | null = null;

  try {
    // ── 1. HASHING ────────────────────────────────────────────────────────
    emit({ phase: 'hashing', bytesUploaded: 0, totalBytes });
    let hashedBytes = 0;
    const sha256 = await hashFile(
      file,
      chunkSize,
      (n) => {
        hashedBytes += n;
        // Hashing progress reuses bytesUploaded as a generic "bytes processed"
        // counter so a single progress bar can show end-to-end progress.
        emit({ phase: 'hashing', bytesUploaded: hashedBytes, totalBytes });
      },
      signal,
    );

    // ── 2. INITIALIZING ───────────────────────────────────────────────────
    if (signal.aborted) throw makeAbortError();
    emit({ phase: 'initializing', bytesUploaded: 0, totalBytes });
    const init = await initUpload(
      {
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        sha256,
        galleryId: opts.galleryId,
      },
      signal,
    );
    assetId = init.assetId;
    uploadId = init.uploadId;

    // Build a part plan from the presigned URLs the server returned.
    // The server controls partitioning; we only need to slice locally to match.
    const totalParts = init.parts.length;
    if (totalParts === 0) {
      throw new Error('Server returned no upload parts');
    }
    // The server is the source of truth for chunk size — use the value it
    // returned so our slices exactly match what was presigned. Inferring it
    // locally (e.g. ceil(size/parts)) can desync from the server's signature.
    if (!Number.isFinite(init.partSize) || init.partSize <= 0) {
      throw new Error('Server returned invalid partSize');
    }
    const partPlan: PartPlan[] = init.parts.map((p) => {
      const start = (p.partNumber - 1) * init.partSize;
      const end = Math.min(start + init.partSize, file.size);
      return { partNumber: p.partNumber, start, end, url: p.presignedUrl };
    });

    // ── 3. UPLOADING ──────────────────────────────────────────────────────
    bytesUploaded = 0;
    emit({
      phase: 'uploading',
      bytesUploaded: 0,
      totalBytes,
      currentPart: 0,
      totalParts,
    });

    const etagsByPart = new Map<number, string>();

    await runWithConcurrency(
      partPlan,
      concurrency,
      async (part) => {
        const slice = file.slice(part.start, part.end);
        const etag = await putPartWithRetry(part.url, slice, signal);
        etagsByPart.set(part.partNumber, etag);
        bytesUploaded += slice.size;
        emit({
          phase: 'uploading',
          bytesUploaded,
          totalBytes,
          currentPart: part.partNumber,
          totalParts,
        });
      },
      controller,
    );

    // ── 4. COMPLETING ─────────────────────────────────────────────────────
    if (signal.aborted) throw makeAbortError();
    emit({
      phase: 'completing',
      bytesUploaded: totalBytes,
      totalBytes,
      currentPart: totalParts,
      totalParts,
    });

    const orderedParts = partPlan
      .map((p) => {
        const etag = etagsByPart.get(p.partNumber);
        if (!etag) throw new Error(`Missing ETag for part ${p.partNumber}`);
        return { partNumber: p.partNumber, etag };
      })
      .sort((a, b) => a.partNumber - b.partNumber);

    const { asset } = await completeUpload(
      { assetId: init.assetId, uploadId: init.uploadId, parts: orderedParts },
      signal,
    );

    return {
      assetId: asset.id,
      key: asset.key,
      bytes: asset.bytes,
      sha256: asset.sha256,
    };
  } catch (err) {
    // Distinguish a user-initiated cancel (external signal aborted) from any
    // other failure. On user cancel we don't want to block returning — the
    // server-side abort can be fire-and-forget. On real failures we MUST
    // await the abort so it leaves the wire before the page can unload;
    // otherwise multipart parts leak and Wasabi keeps billing them.
    const isUserCancel =
      err instanceof DOMException &&
      err.name === 'AbortError' &&
      externalSignal?.aborted === true;
    // Make sure any other in-flight requests on the internal controller stop.
    if (!controller.signal.aborted) controller.abort();
    if (assetId && uploadId) {
      if (isUserCancel) {
        void abortUpload(assetId, uploadId);
      } else {
        try {
          await abortUpload(assetId, uploadId);
        } catch {
          // Swallow — the original error is what the caller needs to see.
        }
      }
    }
    if (isAbortError(err)) {
      throw makeAbortError('Upload cancelled');
    }
    if (err instanceof Error) {
      // Add a friendlier prefix while preserving the underlying message.
      throw new Error(`Upload failed: ${err.message}`);
    }
    throw new Error('Upload failed: unknown error');
  } finally {
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// JXL sidecar (Slice 3A)
//
// After the original file has uploaded successfully, transparently encode the
// source bytes to lossless JXL in a Web Worker and upload the JXL bytes to a
// parallel multipart-upload pipeline (NEW backend endpoints under
// /api/uploads/:assetId/jxl/*). Only PNG and JPEG inputs are eligible —
// everything else delegates straight to `uploadFile`.
//
// Failure semantics:
//   - The original asset must already exist before we touch JXL, so a JXL
//     failure is non-fatal at the user level: we log a console warning, fire
//     /jxl/abort if we got past /jxl/init, and still return the original
//     UploadResult to the caller.
//   - Cancellation propagates through the same AbortController as the
//     original upload (so a single user "cancel" stops everything).
// ──────────────────────────────────────────────────────────────────────────────

// Memory strategy for source bytes:
//   We DO NOT keep the whole file in memory across phases. The original upload
//   only ever holds one chunkSize-sized slice in memory at a time (existing
//   behaviour). For the JXL phase we re-read the source via `file.arrayBuffer()`
//   exactly once, immediately before encoding. The File reference is stable
//   across phases (the user's selection lives until the page unloads), so the
//   browser can re-stream from disk on its own without us double-holding.
//
//   Rationale: the original upload's hash-worker takes ownership of each chunk
//   and detaches it from main-thread memory. Stashing the full ArrayBuffer
//   from those chunks would require a parallel buffered copy and roughly
//   double peak RAM during the upload phase — unacceptable for multi-hundred-MB
//   photos. Re-reading the file post-upload trades a few hundred ms of disk
//   I/O for flat memory.

// ──────────────────────────────────────────────────────────────────────────────
// JXL API contract types
// ──────────────────────────────────────────────────────────────────────────────

interface JxlInitRequest {
  jxlSize: number;
  jxlSha256: string;
}

interface JxlInitResponse {
  uploadId: string;
  key: string;
  partSize: number;
  parts: PresignedPart[];
}

interface JxlCompleteRequest {
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
}

interface JxlCompleteResponse {
  ok: true;
  status: 'verifying' | string;
}

// ──────────────────────────────────────────────────────────────────────────────
// JXL encoder constants (default — Slice 5 may override)
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_JXL_EFFORT = 4;
const DEFAULT_JXL_DISTANCE = 0 as const;

// ──────────────────────────────────────────────────────────────────────────────
// JXL eligibility gate (C1 + C2 + M2)
//
// The server-side verify contract is:
//   `djxl(jxlBytes).sha256 === originalAsset.sha256`
//
// That contract REQUIRES the JXL we upload to be a bit-exact lossless transcode
// of the original. With the @jsquash toolchain we have today, two input classes
// CANNOT satisfy this contract and must be excluded:
//
//   (C1) JPEG: `@jsquash/jxl` has no bit-exact JPEG-to-JXL transcode in its
//        public API. Decoding JPEG → ImageData → re-encoding to JXL produces a
//        JXL whose `djxl()` output is a PNG, not the original JPEG bytes.
//        Server verify will ALWAYS fail for JPEGs.
//
//   (C2) 16-bit PNG: `pngDecode(bytes, { bitDepth: 8 })` silently quantises
//        16-bit pixels to 8-bit. The re-encoded JXL roundtrips to an 8-bit
//        PNG, not the original 16-bit PNG. Server verify ALWAYS fails for
//        16-bit PNGs.
//
//   (M2) Huge files: `await file.arrayBuffer()` on a multi-hundred-MB file can
//        OOM the tab.
//
// So the gate is: 8-bit PNG only, and only below JXL_MAX_SOURCE_BYTES.
// ──────────────────────────────────────────────────────────────────────────────
const JXL_MIME_TYPES: ReadonlySet<string> = new Set(['image/png']);
const JXL_MAX_SOURCE_BYTES = 512 * 1024 * 1024; // 512 MiB

/**
 * Sniff the PNG IHDR chunk to determine bit depth.
 *
 * PNG layout:
 *   [0..7]   8-byte signature: 89 50 4E 47 0D 0A 1A 0A
 *   [8..11]  IHDR chunk length (always 13)
 *   [12..15] Chunk type 'IHDR'
 *   [16..19] width  (big-endian u32)
 *   [20..23] height (big-endian u32)
 *   [24]     bit_depth   <-- this is what we read
 *   [25]     color_type
 *
 * Returns true ONLY if the file has a valid PNG signature AND bit_depth === 8.
 * Anything else (16-bit PNG, malformed, non-PNG-by-content) returns false and
 * the caller skips JXL for that file.
 */
async function isEightBitPng(file: File): Promise<boolean> {
  const head = await file.slice(0, 26).arrayBuffer();
  const bytes = new Uint8Array(head);
  if (bytes.byteLength < 26) return false;
  // PNG signature check.
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return false;
  }
  return bytes[24] === 8;
}

// Progress weighting for the sidecar path. The original upload reports its
// own 0..100% progress against its own totalBytes; once it finishes we
// remap subsequent phases onto the user-visible bar:
//   0..60%   = original upload (handled inside uploadFile)
//   60..70%  = JXL encode
//   70..95%  = JXL multipart upload
//   95..100% = JXL complete
const JXL_ENCODE_WEIGHT = 0.1; // 60-70
const JXL_UPLOAD_WEIGHT = 0.25; // 70-95
const JXL_COMPLETE_WEIGHT = 0.05; // 95-100
// (sum: 0.4 — matches the 40% remaining after original)

// ──────────────────────────────────────────────────────────────────────────────
// JXL worker wrapper
// ──────────────────────────────────────────────────────────────────────────────

class JxlEncoderClient {
  private worker: Worker;
  private pending: Array<{
    resolve: (msg: JxlWorkerOutbound) => void;
    reject: (err: Error) => void;
  }> = [];
  private fatalError: Error | null = null;

  constructor() {
    this.worker = new JxlWorker();
    this.worker.onmessage = (ev: MessageEvent<JxlWorkerOutbound>): void => {
      const msg = ev.data;
      if (msg.type === 'error') {
        this.fatalError = new Error(`JXL worker error: ${msg.message}`);
        const rejecters = this.pending.splice(0);
        rejecters.forEach((r) => r.reject(this.fatalError as Error));
        return;
      }
      const next = this.pending.shift();
      if (next) next.resolve(msg);
    };
    this.worker.onerror = (ev: ErrorEvent): void => {
      this.fatalError = new Error(`JXL worker error: ${ev.message || 'unknown'}`);
      const rejecters = this.pending.splice(0);
      rejecters.forEach((r) => r.reject(this.fatalError as Error));
    };
  }

  private send(
    msg: JxlWorkerInbound,
    transfer?: Transferable[],
  ): Promise<JxlWorkerOutbound> {
    if (this.fatalError) return Promise.reject(this.fatalError);
    return new Promise<JxlWorkerOutbound>((resolve, reject) => {
      this.pending.push({ resolve, reject });
      if (transfer && transfer.length > 0) {
        this.worker.postMessage(msg, transfer);
      } else {
        this.worker.postMessage(msg);
      }
    });
  }

  async init(): Promise<void> {
    const reply = await this.send({ type: 'init' });
    if (reply.type !== 'ready') {
      throw new Error('JXL worker did not become ready');
    }
  }

  async encode(
    sourceBytes: ArrayBuffer,
    mimeType: 'image/png' | 'image/jpeg',
    options: JxlEncodeOptions,
  ): Promise<ArrayBuffer> {
    const reply = await this.send(
      { type: 'encode', sourceBytes, mimeType, options },
      [sourceBytes],
    );
    if (reply.type !== 'encoded') {
      throw new Error('JXL worker did not return encoded bytes');
    }
    return reply.jxlBytes;
  }

  terminate(): void {
    this.worker.terminate();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// JXL hashing — SubtleCrypto for the typical sub-100MB JXL payload.
//   For larger encoded outputs we'd switch to the streaming hash worker, but
//   JXL outputs in lossless mode are typically 30-60% of the original PNG and
//   often smaller than the JPEG; reusing the existing single-shot SubtleCrypto
//   path keeps this slice small.
// ──────────────────────────────────────────────────────────────────────────────

const SUBTLE_HASH_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MiB

const sha256OfBytes = async (bytes: Uint8Array): Promise<string> => {
  if (bytes.byteLength <= SUBTLE_HASH_LIMIT_BYTES) {
    // Pass a fresh ArrayBuffer view so we don't ship a SharedArrayBuffer.
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const digest = await crypto.subtle.digest('SHA-256', ab);
    return arrayBufferToHex(digest);
  }
  // Fallback: use the existing hash-wasm worker for huge buffers. We slice
  // the bytes into 16 MiB transfers to avoid postMessage stalls.
  const hasher = new StreamingHasher();
  try {
    await hasher.init();
    const CHUNK = 16 * 1024 * 1024;
    let offset = 0;
    while (offset < bytes.byteLength) {
      const end = Math.min(offset + CHUNK, bytes.byteLength);
      // Copy out of the source so we can transfer the slice (the underlying
      // buffer is shared and we still need it for the upload).
      const slice = bytes.slice(offset, end);
      await hasher.update(
        slice.buffer.slice(0, slice.byteLength) as ArrayBuffer,
      );
      offset = end;
    }
    return await hasher.finalize();
  } finally {
    hasher.terminate();
  }
};

const arrayBufferToHex = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
};

// ──────────────────────────────────────────────────────────────────────────────
// JXL network — init / complete / abort
// ──────────────────────────────────────────────────────────────────────────────

const initJxlUpload = async (
  assetId: string,
  req: JxlInitRequest,
  signal: AbortSignal,
): Promise<JxlInitResponse> => {
  const { data } = await api.post<JxlInitResponse>(
    `/uploads/${encodeURIComponent(assetId)}/jxl/init`,
    req,
    { signal },
  );
  return data;
};

const completeJxlUpload = async (
  assetId: string,
  req: JxlCompleteRequest,
  signal: AbortSignal,
): Promise<JxlCompleteResponse> => {
  const { data } = await api.post<JxlCompleteResponse>(
    `/uploads/${encodeURIComponent(assetId)}/jxl/complete`,
    req,
    { signal },
  );
  return data;
};

const abortJxlUpload = async (assetId: string, uploadId: string): Promise<void> => {
  // Best-effort — never throws. JXL failures are non-fatal at the user level.
  try {
    await api.post(`/uploads/${encodeURIComponent(assetId)}/jxl/abort`, { uploadId });
  } catch {
    // Swallow.
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// JXL encoding pipeline
// ──────────────────────────────────────────────────────────────────────────────

const encodeFileToJxl = async (
  file: File,
  options: JxlEncodeOptions,
  signal: AbortSignal,
): Promise<{ jxlBytes: Uint8Array; jxlSha256: string }> => {
  const mimeType = file.type;
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
    throw new Error(`Unsupported mimeType for JXL: ${mimeType}`);
  }
  // Defensive lossless-contract check (matches comment in jxl-worker.ts).
  if (options.distance !== 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[jxl] Non-lossless distance requested (${options.distance}); the slice contract is distance=0. Forcing lossless.`,
    );
  }

  const sourceBytes = await file.arrayBuffer();
  const encoder = new JxlEncoderClient();
  // H6: The encode runs inside a Web Worker that does NOT see the AbortSignal
  // on its own. Without an explicit terminate, an aborted upload leaves the
  // worker churning lossless JXL on a dead pipeline (potentially 30s+ of
  // wasted WASM heap). Terminate mid-flight when the signal fires; the
  // pending `encode` promise will reject naturally because the worker's
  // onmessage/onerror channels are gone.
  const onAbort = (): void => {
    encoder.terminate();
  };
  signal.addEventListener('abort', onAbort, { once: true });
  let encoded: ArrayBuffer;
  try {
    await encoder.init();
    encoded = await encoder.encode(sourceBytes, mimeType, options);
  } finally {
    signal.removeEventListener('abort', onAbort);
    encoder.terminate();
  }
  const jxlBytes = new Uint8Array(encoded);
  const jxlSha256 = await sha256OfBytes(jxlBytes);
  return { jxlBytes, jxlSha256 };
};

// ──────────────────────────────────────────────────────────────────────────────
// uploadFileWithJxlSidecar
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Upload a file via the original multipart pipeline, then — for PNG/JPEG only
 * — encode a lossless JXL sidecar in a Web Worker and upload it to the new
 * /api/uploads/:assetId/jxl/* endpoints.
 *
 * For non-eligible mime types this is a thin pass-through to `uploadFile`.
 *
 * Returns the original UploadResult; the JXL sidecar is fire-and-forget at
 * the caller level (failures log but don't reject the promise).
 */
export async function uploadFileWithJxlSidecar(
  file: File,
  opts: UploadOptions,
): Promise<UploadResult> {
  // ── Eligibility gate (C1 + C2 + M2) ─────────────────────────────────────
  // See the JXL_MIME_TYPES doc block above for the full rationale. In short:
  // only 8-bit PNG below JXL_MAX_SOURCE_BYTES can satisfy the server verify
  // contract `djxl(jxl).sha256 === original.sha256`.
  if (!JXL_MIME_TYPES.has(file.type)) {
    return uploadFile(file, opts);
  }
  if (file.size > JXL_MAX_SOURCE_BYTES) {
    // eslint-disable-next-line no-console
    console.info(
      `[jxl] Skipping sidecar: file too large (${file.size} > ${JXL_MAX_SOURCE_BYTES})`,
    );
    return uploadFile(file, opts);
  }
  // PNG-only path: must also be 8-bit per IHDR. 16-bit PNGs would silently
  // quantise during decode and break verify (C2).
  if (!(await isEightBitPng(file))) {
    // eslint-disable-next-line no-console
    console.info('[jxl] Skipping sidecar: not 8-bit PNG');
    return uploadFile(file, opts);
  }

  // Wrap the caller's onProgress to remap original-upload progress into the
  // first 60% of the user-visible bar, leaving 40% for the JXL phases.
  // Tracks `monotonicMax` (H5) so transient phase changes that report
  // `bytesUploaded: 0` (e.g. 'initializing' resetting the counter) don't
  // make the bar regress.
  const totalBytes = file.size;
  let originalDone = false;
  let monotonicMax = 0;
  const wrappedProgress: UploadOptions['onProgress'] = (p) => {
    if (originalDone) return; // sidecar phases drive their own emits below
    if (!opts.onProgress) return;
    // Scale the original phase's bytesUploaded into 0..60% by remapping.
    const scaledBytes = Math.min(
      Math.round(p.bytesUploaded * 0.6),
      Math.round(totalBytes * 0.6),
    );
    if (scaledBytes < monotonicMax) {
      // Suppress regression but still surface the phase change so consumers
      // can update the displayed phase label without the bar going backwards.
      opts.onProgress({
        ...p,
        bytesUploaded: monotonicMax,
        totalBytes,
      });
      return;
    }
    monotonicMax = scaledBytes;
    opts.onProgress({
      ...p,
      bytesUploaded: scaledBytes,
      totalBytes,
    });
  };

  // Phase 1: original upload via the existing, unmodified pipeline.
  const result = await uploadFile(file, { ...opts, onProgress: wrappedProgress });
  originalDone = true;

  // Phase 2+: JXL encode & upload. Failures here are non-fatal — we log
  // and return the original result.
  try {
    await runJxlSidecar(file, result.assetId, totalBytes, opts);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[jxl] Sidecar failed for asset ${result.assetId}: ${
        err instanceof Error ? err.message : String(err)
      }. Original asset remains intact.`,
    );
    // H3: When JXL fails after the original succeeded, the last progress
    // emit was somewhere in the 60..95% band (mid-encode/upload). Without
    // a final emit, the consumer's bar parks at e.g. 60% while
    // isUploading flips to false, looking broken. Emit a synthetic
    // 'completing-jxl' at full bytes so the bar lands on 100%, signalling
    // the JXL phase has ended (in failure). The caller can interpret this
    // as a 'degraded success' state if desired.
    if (opts.onProgress) {
      opts.onProgress({
        phase: 'completing-jxl',
        bytesUploaded: result.bytes,
        totalBytes: result.bytes,
      });
    }
  }

  return result;
}

const runJxlSidecar = async (
  file: File,
  assetId: string,
  totalBytes: number,
  opts: UploadOptions,
): Promise<void> => {
  const externalSignal = opts.signal;
  const controller = new AbortController();
  const onExternalAbort = (): void => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const signal = controller.signal;

  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const emit = (
    phase: Extract<
      UploadProgress['phase'],
      'encoding-jxl' | 'uploading-jxl' | 'completing-jxl'
    >,
    fraction: number, // 0..1 within the entire sidecar (mapped onto 60..100%)
    extra?: Pick<UploadProgress, 'currentPart' | 'totalParts'>,
  ): void => {
    if (!opts.onProgress) return;
    // Map sidecar 0..1 → bytesUploaded 60%..100% of totalBytes.
    const bytesUploaded = Math.round(totalBytes * (0.6 + 0.4 * fraction));
    opts.onProgress({
      phase,
      bytesUploaded,
      totalBytes,
      ...extra,
    });
  };

  let jxlUploadId: string | null = null;

  try {
    // ── Encode ──────────────────────────────────────────────────────────────
    if (signal.aborted) throw makeAbortError();
    emit('encoding-jxl', 0);
    const encodeOptions: JxlEncodeOptions = {
      effort: DEFAULT_JXL_EFFORT,
      distance: DEFAULT_JXL_DISTANCE,
    };
    const { jxlBytes, jxlSha256 } = await encodeFileToJxl(file, encodeOptions, signal);
    // Encode finished — that maps to JXL_ENCODE_WEIGHT of the 0..1 sidecar
    // fraction.
    emit('encoding-jxl', JXL_ENCODE_WEIGHT / 0.4);

    // ── Init ────────────────────────────────────────────────────────────────
    if (signal.aborted) throw makeAbortError();
    const init = await initJxlUpload(
      assetId,
      { jxlSize: jxlBytes.byteLength, jxlSha256 },
      signal,
    );
    jxlUploadId = init.uploadId;

    if (init.parts.length === 0) {
      throw new Error('Server returned no JXL upload parts');
    }
    if (!Number.isFinite(init.partSize) || init.partSize <= 0) {
      throw new Error('Server returned invalid JXL partSize');
    }

    // ── Upload ──────────────────────────────────────────────────────────────
    const partPlan: PartPlan[] = init.parts.map((p) => {
      const start = (p.partNumber - 1) * init.partSize;
      const end = Math.min(start + init.partSize, jxlBytes.byteLength);
      return { partNumber: p.partNumber, start, end, url: p.presignedUrl };
    });
    const totalParts = partPlan.length;
    emit('uploading-jxl', JXL_ENCODE_WEIGHT / 0.4, { currentPart: 0, totalParts });

    const etagsByPart = new Map<number, string>();
    let jxlBytesUploaded = 0;

    await runWithConcurrency(
      partPlan,
      concurrency,
      async (part) => {
        // Wrap the slice in a Blob — fetch's PUT body wants a Blob/BufferSource;
        // a Uint8Array slice avoids copying the whole encoded buffer.
        const partBytes = jxlBytes.subarray(part.start, part.end);
        const blob = new Blob([partBytes]);
        const etag = await putPartWithRetry(part.url, blob, signal);
        etagsByPart.set(part.partNumber, etag);
        jxlBytesUploaded += partBytes.byteLength;
        const uploadFraction =
          jxlBytes.byteLength > 0 ? jxlBytesUploaded / jxlBytes.byteLength : 1;
        const sidecarFraction =
          (JXL_ENCODE_WEIGHT + JXL_UPLOAD_WEIGHT * uploadFraction) / 0.4;
        emit('uploading-jxl', sidecarFraction, {
          currentPart: part.partNumber,
          totalParts,
        });
      },
      controller,
    );

    // ── Complete ────────────────────────────────────────────────────────────
    if (signal.aborted) throw makeAbortError();
    emit(
      'completing-jxl',
      (JXL_ENCODE_WEIGHT + JXL_UPLOAD_WEIGHT) / 0.4,
      { currentPart: totalParts, totalParts },
    );
    const orderedParts = partPlan
      .map((p) => {
        const etag = etagsByPart.get(p.partNumber);
        if (!etag) throw new Error(`Missing ETag for JXL part ${p.partNumber}`);
        return { partNumber: p.partNumber, etag };
      })
      .sort((a, b) => a.partNumber - b.partNumber);

    await completeJxlUpload(
      assetId,
      { uploadId: init.uploadId, parts: orderedParts },
      signal,
    );

    emit(
      'completing-jxl',
      (JXL_ENCODE_WEIGHT + JXL_UPLOAD_WEIGHT + JXL_COMPLETE_WEIGHT) / 0.4,
      { currentPart: totalParts, totalParts },
    );
  } catch (err) {
    if (!controller.signal.aborted) controller.abort();
    if (jxlUploadId) {
      // Best-effort — abortJxlUpload already swallows. We don't await on
      // user-cancel to avoid blocking unload, matching uploadFile's policy.
      const isUserCancel =
        err instanceof DOMException &&
        err.name === 'AbortError' &&
        externalSignal?.aborted === true;
      if (isUserCancel) {
        void abortJxlUpload(assetId, jxlUploadId);
      } else {
        await abortJxlUpload(assetId, jxlUploadId);
      }
    }
    throw err;
  } finally {
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
};
