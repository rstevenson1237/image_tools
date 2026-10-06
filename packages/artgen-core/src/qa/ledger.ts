/**
 * Ledger records (`art/ledger.jsonl`, append-only, SPEC §11): one JSON object per line. Core only formats and
 * parses lines; the Node adapter (artgen-cli) and the UI's project store do the appending.
 */
import { hashString } from '../lib/rng.ts';
import type { ConformanceReport } from './conformance.ts';
import type { Metrics } from './metrics.ts';

export type LedgerType = 'render' | 'review' | 'score' | 'conformance' | 'approve' | 'feedback' | 'note' | 'status' | 'export' | 'contract' | 'restyle' | 'import-edit';

export interface LedgerEntry {
  /** ISO timestamp. */
  ts: string;
  type: LedgerType;
  asset: string;
  /** Source version, e.g. `base.v3` or `hero.v2`. */
  version?: string;
  /** Pipeline pass (`r1`..`r3`, `f`, `u1`..) — filled from P1b on. */
  pass?: string;
  sourceHash?: string;
  /** Output hash (sheet grid). */
  outputHash?: string;
  direction?: { id: string; version: number };
  metrics?: Metrics;
  conformance?: Pick<ConformanceReport, 'pass' | 'checks'>;
  sheet?: string;
  /** Review-image token estimate. */
  imageTokens?: number;
  score?: number;
  note?: string;
  by?: 'agent' | 'user';
  [extra: string]: unknown;
}

/** Hash of an asset's source text, recorded so scored versions can't silently change (R10). */
export const sourceHash = (src: string): string => hashString(src.replace(/\r\n/g, '\n'));

/** Claude vision cost estimate (artlab): ~(w·h)/750 tokens after resizing the long edge to ≤ 1568. */
export function imageTokens(w: number, h: number): number {
  const s = Math.min(1, 1568 / Math.max(w, h));
  return Math.ceil((w * s * (h * s)) / 750);
}

/** One ledger line (no trailing newline). Throws on entries missing ts/type/asset. */
export function formatLedgerLine(e: LedgerEntry): string {
  if (!e.ts || !e.type || !e.asset) throw new Error('ledger entry needs ts, type and asset');
  return JSON.stringify(e);
}

/** Parse `ledger.jsonl`; blank lines are skipped, a malformed line throws with its line number. */
export function parseLedger(text: string): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  text.split('\n').forEach((l, i) => {
    if (!l.trim()) return;
    try { out.push(JSON.parse(l)); } catch { throw new Error(`ledger line ${i + 1}: invalid JSON`); }
  });
  return out;
}
