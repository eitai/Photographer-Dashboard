/**
 * Slice 5C — folder upload hook.
 *
 * Photographer drags a folder (or picks one via webkitdirectory) and the browser
 * walks the tree, gathering every file (subdirectories included) with its
 * relative path. Files are then uploaded via `uploadFileWithJxlSidecar`, which
 * routes by mime/IHDR internally:
 *   - 8-bit PNG ≤ 512 MiB  → original + lossless JXL sidecar
 *   - JPEG / 16-bit PNG / >512 MiB / video / anything else → plain `uploadFile`
 *
 * No fallback paths between strategies. If a file's upload throws, it is marked
 * `failed` and the user can manually re-upload. The hook does not retry with
 * a degraded path.
 *
 * Concurrency is bounded (default 4 in-flight files) — a 1 TB folder would
 * otherwise saturate browser sockets / RAM.
 */
import { useCallback, useRef, useState } from 'react';
import { uploadFileWithJxlSidecar, type UploadProgress } from '@/lib/uploader';

// OS / editor cruft that gets picked up alongside real photos when a user
// drops or picks a folder. We never want these in a gallery and the backend
// has no use for them either — filter at collection time, not at upload time,
// so they never count toward the queue total or the progress denominator.
const HIDDEN_FILE_DENYLIST = new Set<string>([
  '.DS_Store', 'Thumbs.db', 'desktop.ini', '.directory',
]);

function shouldSkipFile(filename: string): boolean {
  if (filename.startsWith('.')) return true;
  if (HIDDEN_FILE_DENYLIST.has(filename)) return true;
  return false;
}

export type FileItemStatus =
  | 'queued'
  | 'hashing'
  | 'encoding'
  | 'uploading'
  | 'completing'
  | 'done'
  | 'failed';

export interface FolderUploadFile {
  /** Stable id for React keys + map updates. */
  id: string;
  /** The browser File. */
  file: File;
  /** Relative path inside the picked/dropped folder (e.g. "raw/2024/img.png"). */
  relativePath: string;
  /** UI status. */
  status: FileItemStatus;
  /** 0..100 — fraction of this file uploaded. */
  progress: number;
  /** Bytes successfully uploaded so far. */
  bytesUploaded: number;
  /** Final bytes recorded from the server (may differ from file.size if backend re-encoded — Slice 5C is honest about this). */
  finalBytes?: number;
  /** Last error message — only set when status === 'failed'. */
  error?: string;
}

export interface FolderUploadSummary {
  doneCount: number;
  failedCount: number;
  totalCount: number;
  bytesUploaded: number;
  totalBytes: number;
  /** Sum of finalBytes over `done` files (i.e. what's actually stored). */
  storedBytes: number;
}

interface UseFolderUploadReturn {
  /** Current queue, ordered as collected. */
  queue: FolderUploadFile[];
  /** Whether a batch is in flight. */
  isUploading: boolean;
  /** Aggregate counters derived from the queue. */
  summary: FolderUploadSummary;
  /** True when the user is dragging over the drop zone. */
  dragging: boolean;
  setDragging: (b: boolean) => void;
  /** Handle a list of File objects (used by the file-input fallback / direct callers). */
  handleFiles: (files: File[]) => Promise<void>;
  /** Drag-and-drop handler — walks DataTransferItem trees via webkitGetAsEntry. */
  onDrop: (e: React.DragEvent) => Promise<void>;
  /** Reset the queue (e.g. dismiss the summary). */
  reset: () => void;
  /** Cancel any in-flight uploads. */
  cancel: () => void;
}

const DEFAULT_CONCURRENCY = 4;

// ──────────────────────────────────────────────────────────────────────────────
// File-tree walk — DataTransferItem → File[] with relative paths
// ──────────────────────────────────────────────────────────────────────────────

interface CollectedFile {
  file: File;
  relativePath: string;
}

/**
 * Recursively read a FileSystemEntry into a flat list of files. Paths are
 * built from the entry's own `fullPath` (e.g. "/folder/sub/img.png"); we strip
 * the leading slash so the relativePath is "folder/sub/img.png".
 *
 * createReader().readEntries() returns a BATCH at a time and may need to be
 * called repeatedly until it returns an empty array. Without the loop, large
 * directories silently drop everything past the first ~100 entries.
 */
const readEntry = async (
  entry: FileSystemEntry,
  depth = 0,
): Promise<CollectedFile[]> => {
  // Defence against pathological symlink loops or absurdly deep trees. 16 is
  // already deeper than any realistic photo folder hierarchy.
  if (depth > 16) {
    console.warn(`[folder-upload] depth limit reached at ${entry.fullPath}`);
    return [];
  }
  if (entry.isFile) {
    if (shouldSkipFile(entry.name)) return [];
    return new Promise<CollectedFile[]>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(
        (file) => {
          const relativePath = entry.fullPath.replace(/^\//, '') || file.name;
          resolve([{ file, relativePath }]);
        },
        (err) => reject(err),
      );
    });
  }
  if (entry.isDirectory) {
    // Skip hidden directories entirely (e.g. ".git", ".cache") so we don't
    // recurse into them at all.
    if (entry.name.startsWith('.')) return [];
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const allEntries: FileSystemEntry[] = [];
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        dirReader.readEntries(resolve, reject),
      );
      if (batch.length === 0) break;
      allEntries.push(...batch);
    }
    const nested = await Promise.all(allEntries.map((e) => readEntry(e, depth + 1)));
    return nested.flat();
  }
  return [];
};

/** Pull files out of a DataTransferItemList — folder-aware via webkitGetAsEntry. */
const collectFromDataTransfer = async (
  items: DataTransferItemList,
): Promise<CollectedFile[]> => {
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    // Non-standard but universally supported in Chromium/WebKit/Firefox.
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) return [];
  const nested = await Promise.all(entries.map(readEntry));
  return nested.flat();
};

/**
 * Pull files out of an `<input type="file" webkitdirectory>` FileList. Each
 * File on a webkitdirectory input has a non-standard `webkitRelativePath`
 * carrying its path inside the picked root.
 */
const collectFromInputFileList = (files: FileList | File[]): CollectedFile[] => {
  // Filter OS / editor cruft up front so it never enters the queue. With
  // <input webkitdirectory>, hidden directories aren't directly observable
  // (we only see files), so we also strip files whose webkitRelativePath
  // contains a hidden segment.
  const filtered = Array.from(files).filter((f) => {
    if (shouldSkipFile(f.name)) return false;
    const rel =
      (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
    if (rel) {
      const segments = rel.split('/');
      // Drop the trailing filename segment (already validated above) and
      // check every directory segment for a leading dot.
      for (let i = 0; i < segments.length - 1; i++) {
        if (segments[i].startsWith('.')) return false;
      }
    }
    return true;
  });
  const out: CollectedFile[] = [];
  for (const file of filtered) {
    // `webkitRelativePath` is the canonical place for directory-input paths.
    // For plain multi-file input, it's empty — fall back to file.name.
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
    out.push({ file, relativePath: rel || file.name });
  }
  return out;
};

// ──────────────────────────────────────────────────────────────────────────────
// Concurrency primitive — fixed-size worker pool.
// Matches the spec's processWithConcurrency() semantics exactly.
// ──────────────────────────────────────────────────────────────────────────────

const processWithConcurrency = async <T,>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<void>,
): Promise<void> => {
  if (items.length === 0) return;
  let next = 0;
  const lanes = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        await handler(items[i], i);
      }
    },
  );
  await Promise.all(lanes);
};

// ──────────────────────────────────────────────────────────────────────────────
// Phase mapping — UploadProgress.phase → FileItemStatus
// ──────────────────────────────────────────────────────────────────────────────

const phaseToStatus = (phase: UploadProgress['phase']): FileItemStatus => {
  switch (phase) {
    case 'hashing':
      return 'hashing';
    case 'encoding-jxl':
      return 'encoding';
    case 'initializing':
    case 'uploading':
    case 'uploading-jxl':
      return 'uploading';
    case 'completing':
    case 'completing-jxl':
      return 'completing';
    default:
      return 'uploading';
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export const useGalleryFolderUpload = (
  galleryId: string | undefined,
  onUploadComplete: () => void,
  concurrency: number = DEFAULT_CONCURRENCY,
): UseFolderUploadReturn => {
  const [queue, setQueue] = useState<FolderUploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Single AbortController per batch. Replaced when a new batch starts so an
  // earlier cancel can't kill a later batch.
  const controllerRef = useRef<AbortController | null>(null);

  const updateItem = useCallback(
    (id: string, patch: Partial<FolderUploadFile>): void => {
      setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [],
  );

  const runBatch = useCallback(
    async (collected: CollectedFile[]): Promise<void> => {
      if (!galleryId) {
        // Fail fast — there's no useful work without a gallery target.
        throw new Error('useGalleryFolderUpload: galleryId is required');
      }
      if (collected.length === 0) return;

      const items: FolderUploadFile[] = collected.map((c) => ({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: c.file,
        relativePath: c.relativePath,
        status: 'queued',
        progress: 0,
        bytesUploaded: 0,
      }));

      // Append to the queue so a second drop doesn't wipe earlier entries.
      setQueue((q) => [...q, ...items]);
      setIsUploading(true);

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        await processWithConcurrency(items, concurrency, async (item) => {
          // Each file gets its own progress stream. We snapshot the latest
          // bytesUploaded so the parent summary can sum across files without
          // re-walking the whole queue on every emit.
          try {
            const result = await uploadFileWithJxlSidecar(item.file, {
              galleryId,
              signal: controller.signal,
              onProgress: (p) => {
                const status = phaseToStatus(p.phase);
                const pct =
                  p.totalBytes > 0
                    ? Math.min(
                        100,
                        Math.round((p.bytesUploaded / p.totalBytes) * 100),
                      )
                    : 0;
                updateItem(item.id, {
                  status,
                  progress: pct,
                  bytesUploaded: p.bytesUploaded,
                });
              },
            });
            updateItem(item.id, {
              status: 'done',
              progress: 100,
              bytesUploaded: item.file.size,
              finalBytes: result.bytes,
            });
          } catch (err) {
            // No fallback — surface the failure and move on. The user re-uploads
            // failed entries manually if they want to retry.
            const message =
              err instanceof Error ? err.message : String(err);
            updateItem(item.id, {
              status: 'failed',
              error: message,
            });
          }
        });
      } finally {
        setIsUploading(false);
        if (controllerRef.current === controller) controllerRef.current = null;
        // Refresh the gallery image grid once the batch settles.
        onUploadComplete();
      }
    },
    [concurrency, galleryId, onUploadComplete, updateItem],
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      const collected = collectFromInputFileList(files);
      await runBatch(collected);
    },
    [runBatch],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
      e.preventDefault();
      setDragging(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      let collected: CollectedFile[] = [];
      if (dt.items && dt.items.length > 0) {
        collected = await collectFromDataTransfer(dt.items);
      } else if (dt.files && dt.files.length > 0) {
        // Fallback for older browsers that lack DataTransferItemList — flat list,
        // no folders. (This is a different kind of code path, not a quality
        // fallback: the browser literally cannot give us folder structure.)
        collected = collectFromInputFileList(dt.files);
      }
      await runBatch(collected);
    },
    [runBatch],
  );

  const reset = useCallback((): void => {
    setQueue([]);
  }, []);

  const cancel = useCallback((): void => {
    controllerRef.current?.abort();
  }, []);

  // Aggregate summary derived per render. Cheap — queue is at most a few
  // thousand entries and each calc is O(n).
  const summary: FolderUploadSummary = (() => {
    let doneCount = 0;
    let failedCount = 0;
    let bytesUploaded = 0;
    let totalBytes = 0;
    let storedBytes = 0;
    for (const it of queue) {
      totalBytes += it.file.size;
      bytesUploaded += it.bytesUploaded;
      if (it.status === 'done') {
        doneCount += 1;
        storedBytes += it.finalBytes ?? it.file.size;
      } else if (it.status === 'failed') {
        failedCount += 1;
      }
    }
    return {
      doneCount,
      failedCount,
      totalCount: queue.length,
      bytesUploaded,
      totalBytes,
      storedBytes,
    };
  })();

  return {
    queue,
    isUploading,
    summary,
    dragging,
    setDragging,
    handleFiles,
    onDrop,
    reset,
    cancel,
  };
};
