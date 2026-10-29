/** `v` to the nearest multiple of `step` (a whole-number multiple of a decimal step prints without float noise; -0 becomes 0). */
export function roundTo(v: number, step: number): number {
  const out = Math.round(v / step) * step;
  return +(out === 0 ? 0 : out).toFixed(6);
}

/**
 * Whole-percent shares of `counts` that add up to exactly 100: each is rounded down, then the leftover points go to the
 * largest remainders (ties to the earlier entry). Entries that end at 0 are dropped.
 */
export function percentShares<K>(counts: [K, number][]): [K, number][] {
  const total = counts.reduce((s, [, c]) => s + c, 0);
  if (!total) return [];
  const raw = counts.map(([k, c]) => ({ k, share: Math.floor((c / total) * 100), rem: ((c / total) * 100) % 1 }));
  let left = 100 - raw.reduce((s, r) => s + r.share, 0);
  for (const r of [...raw].sort((a, b) => b.rem - a.rem || raw.indexOf(a) - raw.indexOf(b))) { if (left <= 0) break; r.share++; left--; }
  return raw.filter(r => r.share > 0).map(r => [r.k, r.share]);
}
