import * as Comlink from 'comlink';
import type { WorkerKind } from '../core/tools/registry';

/**
 * Ref-counted pool of Comlink-wrapped workers, keyed by kind.
 *
 * Tools `acquire` in onMount and `release` in onDestroy. The underlying Worker
 * is created on the first acquire and terminated once the last lease is
 * released, so switching away from a CV-backed tool actually reclaims the WASM
 * heap instead of leaving a multi-megabyte worker parked in the background.
 */

type WorkerFactory = () => Worker;

const factories: Partial<Record<WorkerKind, WorkerFactory>> = {
  opencv: () =>
    new Worker(new URL('./opencv.worker.ts', import.meta.url), { type: 'module' }),
};

interface PoolEntry {
  worker: Worker;
  api: unknown;
  refs: number;
  /** Bumped each time a worker is created, so stale leases can't kill a new one. */
  generation: number;
}

const pool = new Map<WorkerKind, PoolEntry>();
let generationCounter = 0;

export interface WorkerLease<T> {
  readonly api: Comlink.Remote<T>;
  /** Idempotent. Terminates the worker when the last lease is released. */
  release: () => void;
}

export function acquire<T>(kind: WorkerKind): WorkerLease<T> {
  const factory = factories[kind];
  if (!factory) throw new Error(`No worker registered for kind "${kind}"`);

  let entry = pool.get(kind);
  if (!entry) {
    const worker = factory();
    entry = {
      worker,
      api: Comlink.wrap<T>(worker),
      refs: 0,
      generation: ++generationCounter,
    };
    pool.set(kind, entry);
  }
  entry.refs++;

  const leasedGeneration = entry.generation;
  let released = false;

  return {
    api: entry.api as Comlink.Remote<T>,
    release() {
      if (released) return;
      released = true;
      const current = pool.get(kind);
      if (!current || current.generation !== leasedGeneration) return;
      current.refs--;
      if (current.refs <= 0) {
        current.worker.terminate();
        pool.delete(kind);
      }
    },
  };
}

/** Test/diagnostic helper: how many workers are currently alive. */
export function liveWorkerCount(): number {
  return pool.size;
}
