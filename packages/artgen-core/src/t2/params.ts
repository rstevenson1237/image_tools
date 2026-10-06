/**
 * Declared param schema (SPEC §6.3): ranges, part toggles, choices (accessory slots) and palette swaps, so seeded
 * variants give real variety. Variant 0 is the defaults; variant n > 0 samples every param from its own seed.
 * Plain values in `export const params` stay fixed params (overridable, never sampled).
 */
import { hashString, rng } from '../lib/rng.ts';

export type ParamSpec =
  | { type: 'range'; min: number; max: number; step?: number; default?: number }
  | { type: 'toggle'; default?: boolean; /** chance of `true` when sampled (default 0.5) */ p?: number }
  | { type: 'choice'; options: unknown[]; default?: unknown }
  /** Ramp-name swap: the value is a ramp name from `options`. */
  | { type: 'swap'; options: string[]; default?: string };

const isSpec = (v: unknown): v is ParamSpec =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && ['range', 'toggle', 'choice', 'swap'].includes((v as { type?: string }).type ?? '');

export function paramDefault(s: ParamSpec): unknown {
  if (s.type === 'range') return s.default ?? (s.step ? s.min + Math.round((s.max - s.min) / 2 / s.step) * s.step : (s.min + s.max) / 2);
  if (s.type === 'toggle') return s.default ?? false;
  return s.default ?? s.options[0];
}

function sample(s: ParamSpec, r: () => number): unknown {
  if (s.type === 'range') {
    const v = s.min + r() * (s.max - s.min);
    return s.step ? Math.min(s.max, s.min + Math.round((v - s.min) / s.step) * s.step) : v;
  }
  if (s.type === 'toggle') return r() < (s.p ?? 0.5);
  return s.options[Math.floor(r() * s.options.length)];
}

/** Resolve a module's params for a variant; `overrides` win. */
export function resolveParams(schema: Record<string, unknown> = {}, variant = 0, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (!isSpec(v)) { out[k] = v; continue; }
    out[k] = variant > 0 ? sample(v, rng(parseInt(hashString(`${k}:${variant}`).slice(0, 8), 16))) : paramDefault(v);
  }
  return { ...out, ...overrides };
}

/** The schema part of a params export (for docs and UI sliders). */
export const paramSchema = (params: Record<string, unknown> = {}): Record<string, ParamSpec> =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => isSpec(v))) as Record<string, ParamSpec>;
