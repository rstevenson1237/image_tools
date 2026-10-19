/**
 * Format versions of the files artgen writes for other programs (`map.json`, `dungeon.json`). Additions (an optional
 * field, an enum value) extend a format and keep its version; removing or renaming a field, changing a field's
 * meaning, unit or default, or making a field required is a break: bump the version in the same change, add a
 * migration from the previous version here, migrate the consumer fixtures (`packages/artgen-cli/fixtures/`) with it
 * and add a CHANGELOG line (`map format 1 -> 2: …`).
 *
 * The facts `map facts` and `dungeon facts` read back (`map/facts.ts`, `dungeon/facts.ts`) are part of the format too: the
 * rounding they state (heights to `topo.interval`, shares to whole percent, positions to 0.1) and their slope and summit
 * thresholds are what a consumer reads, so changing one is a break and follows the steps above.
 */

/** Rewrites a file of version N into version N + 1 (the `version` field is set by the reader). */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * The file's version: absent reads as 1. Older versions are migrated step by step to `current` (`migrations[n]`
 * takes a version n file to n + 1); newer ones, and anything that is not a whole number from 1, are refused.
 */
export function readFormat(raw: unknown, kind: string, current: number, migrations: Record<number, Migration> = {}): Record<string, unknown> {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const v = r.version === undefined ? 1 : r.version;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new Error(`${kind}: version must be a whole number from 1 (got ${JSON.stringify(v)})`);
  if (v > current) throw new Error(`${kind} is format version ${v}; this artgen reads ${kind} format ${current} and older (update artgen)`);
  let out = r;
  for (let n = v; n < current; n++) {
    const step = migrations[n];
    if (!step) throw new Error(`${kind} format ${n} -> ${n + 1}: no migration`);
    out = { ...step(out), version: n + 1 };
  }
  return out;
}
