/**
 * Streaming SHA-256 Web Worker.
 *
 * Computes a SHA-256 digest over a file by accepting chunks from the main
 * thread and feeding them into hash-wasm's incremental hasher. This keeps
 * memory pressure low (we never hold the full file at once) and moves the
 * CPU-bound hashing off the main thread so the UI stays responsive.
 *
 * Message protocol (main thread -> worker):
 *   { type: 'init' }              -> initialize / reset hasher
 *   { type: 'chunk', data: ArrayBuffer }   -> feed a chunk into the hasher
 *   { type: 'finalize' }          -> emit final hex digest and reset
 *
 * Replies (worker -> main thread):
 *   { type: 'ready' }             -> hasher initialized, ready for chunks
 *   { type: 'ack' }               -> chunk was consumed
 *   { type: 'digest', hex: string } -> final hex digest
 *   { type: 'error', message: string } -> any failure
 */
import { createSHA256, type IHasher } from 'hash-wasm';

export type HashWorkerInbound =
  | { type: 'init' }
  | { type: 'chunk'; data: ArrayBuffer }
  | { type: 'finalize' };

export type HashWorkerOutbound =
  | { type: 'ready' }
  | { type: 'ack' }
  | { type: 'digest'; hex: string }
  | { type: 'error'; message: string };

let hasher: IHasher | null = null;

// We're inside a module Web Worker. The default DOM lib in tsconfig doesn't
// include WebWorker types, so we cast `self` through a minimal local
// interface rather than pulling in the WebWorker lib (which would conflict
// with the DOM lib used elsewhere in the app).
interface WorkerGlobal {
  postMessage(msg: unknown): void;
  onmessage: ((ev: MessageEvent) => void) | null;
}
const ctx = self as unknown as WorkerGlobal;

const post = (msg: HashWorkerOutbound): void => {
  ctx.postMessage(msg);
};

ctx.onmessage = async (ev: MessageEvent<HashWorkerInbound>): Promise<void> => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      hasher = await createSHA256();
      hasher.init();
      post({ type: 'ready' });
      return;
    }

    if (msg.type === 'chunk') {
      if (!hasher) {
        post({ type: 'error', message: 'Hasher not initialized' });
        return;
      }
      // hash-wasm accepts Uint8Array; wrap the transferred ArrayBuffer.
      hasher.update(new Uint8Array(msg.data));
      post({ type: 'ack' });
      return;
    }

    if (msg.type === 'finalize') {
      if (!hasher) {
        post({ type: 'error', message: 'Hasher not initialized' });
        return;
      }
      const hex = hasher.digest('hex');
      hasher = null;
      post({ type: 'digest', hex });
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message });
  }
};

// Required so Vite/TS treat this file as a module and `?worker` works.
export {};
