/**
 * Lossless JXL encoding Web Worker.
 *
 * Streams a single PNG or JPEG file's bytes from the main thread, decodes
 * to ImageData via @jsquash/{png,jpeg}, then re-encodes to JPEG XL via
 * @jsquash/jxl in *lossless* mode so that `djxl(jxl) == originalSha256`.
 *
 * The WASM blobs (~500 KiB gz for jxl, plus smaller decoders) are lazy-
 * loaded inside the worker on first `init` so the main bundle stays slim
 * and the codec download only happens when a user actually opts in to
 * the JXL sidecar path.
 *
 * Message protocol (main -> worker):
 *   { type: 'init' }
 *   { type: 'encode', sourceBytes: ArrayBuffer,
 *     mimeType: 'image/png' | 'image/jpeg',
 *     options: { effort: number; distance: 0 } }
 *
 * Replies (worker -> main):
 *   { type: 'ready' }
 *   { type: 'encoded', jxlBytes: ArrayBuffer }
 *   { type: 'error', message: string }
 *
 * Notes:
 *  - `distance: 0` is the libjxl convention for "lossless"; @jsquash/jxl
 *    exposes this via `lossless: true` (see meta.js defaults). We translate
 *    distance==0 -> lossless=true and preserve `effort` verbatim.
 *  - Slice 5 may bump effort to 7 for archival mode; default here is 4.
 *  - The encoded ArrayBuffer is transferred (not copied) back to the main
 *    thread to keep memory pressure flat for large photos.
 *  - Some @jsquash builds detect WebAssembly threads and try to spawn a
 *    nested Worker. Modern Chromium/Firefox allow nested Workers from a
 *    module Worker; if a host browser doesn't, @jsquash falls back to the
 *    single-threaded build automatically (see encode.js).
 */
import jxlEncode from '@jsquash/jxl/encode';
import pngDecode from '@jsquash/png/decode';
import jpegDecode from '@jsquash/jpeg/decode';

// ──────────────────────────────────────────────────────────────────────────────
// Message types
// ──────────────────────────────────────────────────────────────────────────────

export interface JxlEncodeOptions {
  /** libjxl effort 1..9. Higher = smaller files, slower. Default 4. */
  effort: number;
  /** libjxl distance. 0 = mathematically lossless. We only support 0 today. */
  distance: 0;
}

export type JxlWorkerInbound =
  | { type: 'init' }
  | {
      type: 'encode';
      sourceBytes: ArrayBuffer;
      mimeType: 'image/png' | 'image/jpeg';
      options: JxlEncodeOptions;
    };

export type JxlWorkerOutbound =
  | { type: 'ready' }
  | { type: 'encoded'; jxlBytes: ArrayBuffer }
  | { type: 'error'; message: string };

// ──────────────────────────────────────────────────────────────────────────────
// Worker context shim
// ──────────────────────────────────────────────────────────────────────────────

interface WorkerGlobal {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent) => void) | null;
}
const ctx = self as unknown as WorkerGlobal;

const post = (msg: JxlWorkerOutbound, transfer?: Transferable[]): void => {
  if (transfer && transfer.length > 0) {
    ctx.postMessage(msg, transfer);
  } else {
    ctx.postMessage(msg);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Decode + encode
// ──────────────────────────────────────────────────────────────────────────────

const decodeToImageData = async (
  bytes: ArrayBuffer,
  mimeType: 'image/png' | 'image/jpeg',
): Promise<ImageData> => {
  if (mimeType === 'image/png') {
    // 8-bit RGBA — JXL encoder expects standard ImageData, not RGBA16.
    return pngDecode(bytes, { bitDepth: 8 });
  }
  return jpegDecode(bytes);
};

const encodeImageDataToJxl = async (
  image: ImageData,
  options: JxlEncodeOptions,
): Promise<ArrayBuffer> => {
  // Translate the slice's distance contract to @jsquash/jxl's flag.
  // distance==0 is the only value we accept; any other should have been
  // rejected upstream. Defensively, treat non-zero as a coding error.
  if (options.distance !== 0) {
    throw new Error(
      `JXL worker only supports distance=0 (lossless); got distance=${options.distance}`,
    );
  }
  return jxlEncode(image, {
    lossless: true,
    effort: options.effort,
    // Defaults from @jsquash/jxl/meta.js — explicit so the lossless contract
    // is not perturbed by future default changes upstream.
    decodingSpeedTier: 0,
    progressive: false,
    epf: -1,
    photonNoiseIso: 0,
    lossyModular: false,
    lossyPalette: false,
    quality: 100,
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// Message loop
// ──────────────────────────────────────────────────────────────────────────────

ctx.onmessage = async (ev: MessageEvent<JxlWorkerInbound>): Promise<void> => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      // Nothing eager to do — @jsquash modules lazy-init on first call. We
      // emit `ready` so the main thread's startup sequence has a clean
      // synchronisation point matching the hash-worker protocol.
      post({ type: 'ready' });
      return;
    }

    if (msg.type === 'encode') {
      if (msg.mimeType !== 'image/png' && msg.mimeType !== 'image/jpeg') {
        post({
          type: 'error',
          message: `Unsupported mimeType for JXL encode: ${msg.mimeType}`,
        });
        return;
      }
      const image = await decodeToImageData(msg.sourceBytes, msg.mimeType);
      const jxlBytes = await encodeImageDataToJxl(image, msg.options);
      // Transfer the encoded buffer back — avoids a copy on multi-MB images.
      post({ type: 'encoded', jxlBytes }, [jxlBytes]);
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message });
  }
};

// Required so Vite/TS treat this file as a module and `?worker` works.
export {};
