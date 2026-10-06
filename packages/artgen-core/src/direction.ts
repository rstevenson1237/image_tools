/**
 * `direction.json` — the style bible as data (SPEC §4.1): types, validator with defaults, and token resolution.
 * Assets never hard-code direction values (R11); they read them from `ctx.dir`, built here by `dirContext`.
 */
import { normHex, parseColor } from './lib/color.ts';
import type { Dither } from './lib/post.ts';

export const VIEWS = ['topdown', 'oblique', 'iso', 'stack', 'side', 'fp'] as const;
export type View = (typeof VIEWS)[number];
export type Size = [number, number];

export interface Direction {
  id: string;
  version: number;
  status: 'draft' | 'candidate' | 'locked';
  theme: { pitch?: string; mood?: string[]; era?: string; notes?: string };
  camera: {
    view: View;
    oblique?: { frontRatio: number };
    iso?: { tile: Size };
    /** Light vector (x right, y down, z toward viewer); [-1,-1,1] = upper-left. */
    light: [number, number, number];
    directions: 1 | 4 | 8 | 16;
    pixelScale: number;
  };
  /** Size per asset kind (`character: [24,24]`, `tile: 16`) plus `proportions`. */
  scale: Record<string, number | Size | Record<string, number>>;
  palette: {
    source?: string;
    maxColors?: number;
    /** Named ramps, lightest first. */
    ramps: Record<string, string[]>;
    outline: string;
    shadow: { color: string; alpha: number };
    /** Material → ramp name. */
    materials: Record<string, string>;
    /** Max distinct colours per asset kind. */
    perKindMax: Record<string, number>;
    /** Ramps allowed per asset kind (absent kind = all ramps). */
    perKind: Record<string, string[]>;
  };
  line: { outer: 'dark' | 'selout' | 'none'; inner: 'none' | 'selective' | 'all'; weight: number };
  shading: { bands: number; hueShift: number; dither: Dither; highlight: 'none' | 'sparing' | 'rich'; aa: boolean };
  detail: { density: 'low' | 'medium' | 'high'; minFeaturePx: number };
  pipeline: {
    revisionPasses: number;
    finishPass: boolean;
    raster: { directMaxPx: number; ss: number };
    procedural: string[];
    finish: { allow: string[] };
  };
  effects: { fps: number; maxFrames: number; palette: string[] };
  /** The game's background colour: style tiles and review context panels show assets on it. */
  background?: string;
  anchors: string[];
  rules: { do: string[]; dont: string[] };
}

const DEFAULTS = {
  theme: {},
  camera: { light: [-1, -1, 1], directions: 8, pixelScale: 3 },
  scale: {},
  palette: { shadow: { color: '#000000', alpha: 0.35 }, materials: {}, perKindMax: {}, perKind: {} },
  line: { outer: 'dark', inner: 'selective', weight: 1 },
  shading: { bands: 3, hueShift: 12, dither: 'none', highlight: 'sparing', aa: false },
  detail: { density: 'medium', minFeaturePx: 2 },
  pipeline: { revisionPasses: 3, finishPass: true, raster: { directMaxPx: 32, ss: 8 }, procedural: [], finish: { allow: ['patch', 'fix', 'fx', 'light', 'outline'] } },
  effects: { fps: 12, maxFrames: 8, palette: [] },
  anchors: [],
  rules: { do: [], dont: [] },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX = /^#[0-9a-fA-F]{6}$/;
const RAMP_NAME = /^[a-z][a-zA-Z0-9_-]*$/;
const RESERVED = new Set(['outline', 'shadow']);

/** Deep merge of plain objects; arrays and scalars in `over` replace those in `base`. */
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
function merge(base: unknown, over: unknown): unknown {
  if (!isObj(base) || !isObj(over)) return over === undefined ? clone(base) : over;
  const out: Record<string, unknown> = clone(base);
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
}

export interface ValidationResult { ok: boolean; errors: string[]; direction?: Direction }

/** Validate a parsed `direction.json`, filling defaults for optional sections. Errors carry JSON paths. */
export function validateDirection(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['direction: must be an object'] };
  const d = merge(DEFAULTS, input) as Record<string, any>;
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);
  const oneOf = (path: string, v: unknown, opts: readonly unknown[]) => { if (!opts.includes(v)) err(path, `must be one of ${opts.join(' | ')} (got ${JSON.stringify(v)})`); };
  const num = (path: string, v: unknown, min = -Infinity, max = Infinity, int = false) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) err(path, `must be ${int ? 'an integer' : 'a number'} in [${min}, ${max}]`);
  };
  const strs = (path: string, v: unknown) => { if (!Array.isArray(v) || v.some(s => typeof s !== 'string')) err(path, 'must be an array of strings'); };
  const size = (path: string, v: unknown) => {
    if (typeof v === 'number') num(path, v, 1, 4096, true);
    else if (Array.isArray(v) && v.length === 2) v.forEach((n, i) => num(`${path}[${i}]`, n, 1, 4096, true));
    else err(path, 'must be a positive integer or [w, h]');
  };

  if (typeof d.id !== 'string' || !d.id) err('id', 'required string');
  num('version', d.version, 1, Infinity, true);
  oneOf('status', d.status, ['draft', 'candidate', 'locked']);

  const cam = d.camera; // checked through a copy so the narrowing doesn't retype d.camera below
  if (!isObj(cam)) err('camera', 'required object');
  else {
    oneOf('camera.view', d.camera.view, VIEWS);
    if (!Array.isArray(d.camera.light) || d.camera.light.length !== 3) err('camera.light', 'must be [x, y, z]');
    else d.camera.light.forEach((n: unknown, i: number) => num(`camera.light[${i}]`, n));
    oneOf('camera.directions', d.camera.directions, [1, 4, 8, 16]);
    num('camera.pixelScale', d.camera.pixelScale, 1, 16, true);
    if (d.camera.iso !== undefined) size('camera.iso.tile', d.camera.iso.tile);
    if (d.camera.oblique !== undefined) num('camera.oblique.frontRatio', d.camera.oblique.frontRatio, 0, 1);
  }

  if (!isObj(d.scale)) err('scale', 'must be an object');
  else for (const [k, v] of Object.entries(d.scale)) if (k !== 'proportions') size(`scale.${k}`, v);

  const p = d.palette;
  if (!isObj(d.palette)) err('palette', 'required object');
  else {
    if (!isObj(p.ramps) || !Object.keys(p.ramps).length) err('palette.ramps', 'required, at least one ramp');
    else for (const [k, r] of Object.entries(p.ramps)) {
      if (!RAMP_NAME.test(k) || RESERVED.has(k)) err(`palette.ramps.${k}`, 'ramp names are identifiers and not "outline"/"shadow"');
      if (!Array.isArray(r) || !r.length) err(`palette.ramps.${k}`, 'must be a non-empty array of #rrggbb');
      else r.forEach((c, i) => { if (typeof c !== 'string' || !HEX.test(c)) err(`palette.ramps.${k}[${i}]`, `must be #rrggbb (got ${JSON.stringify(c)})`); });
    }
    if (typeof p.outline !== 'string' || !HEX.test(p.outline)) err('palette.outline', 'required #rrggbb');
    if (!isObj(p.shadow) || typeof p.shadow.color !== 'string' || !HEX.test(p.shadow.color)) err('palette.shadow.color', 'must be #rrggbb');
    else num('palette.shadow.alpha', p.shadow.alpha, 0, 1);
    const ramps = isObj(p.ramps) ? p.ramps : {};
    const known = (path: string, name: unknown) => { if (typeof name !== 'string' || !(name in ramps)) err(path, `unknown ramp ${JSON.stringify(name)}`); };
    if (isObj(p.materials)) for (const [k, v] of Object.entries(p.materials)) known(`palette.materials.${k}`, v);
    else err('palette.materials', 'must be an object');
    if (isObj(p.perKind)) for (const [k, v] of Object.entries(p.perKind)) {
      if (!Array.isArray(v)) err(`palette.perKind.${k}`, 'must be an array of ramp names');
      else v.forEach((n, i) => known(`palette.perKind.${k}[${i}]`, n));
    } else err('palette.perKind', 'must be an object');
    if (isObj(p.perKindMax)) for (const [k, v] of Object.entries(p.perKindMax)) num(`palette.perKindMax.${k}`, v, 1, 256, true);
    else err('palette.perKindMax', 'must be an object');
    if (p.maxColors !== undefined) {
      num('palette.maxColors', p.maxColors, 1, 256, true);
      if (isObj(p.ramps) && !errors.some(e => e.startsWith('palette.ramps'))) {
        const n = new Set(Object.values(p.ramps).flat().map(c => (c as string).toLowerCase())).size;
        if (n > p.maxColors) err('palette.maxColors', `ramps hold ${n} colours, more than ${p.maxColors}`);
      }
    }
    if (isObj(d.effects)) {
      strs('effects.palette', d.effects.palette);
      if (Array.isArray(d.effects.palette)) d.effects.palette.forEach((n: unknown, i: number) => known(`effects.palette[${i}]`, n));
    }
  }

  oneOf('line.outer', d.line?.outer, ['dark', 'selout', 'none']);
  oneOf('line.inner', d.line?.inner, ['none', 'selective', 'all']);
  num('line.weight', d.line?.weight, 1, 4, true);
  num('shading.bands', d.shading?.bands, 1, 16, true);
  num('shading.hueShift', d.shading?.hueShift, 0, 180);
  oneOf('shading.dither', d.shading?.dither, ['none', 'bayer2', 'bayer4', 'noise']);
  oneOf('shading.highlight', d.shading?.highlight, ['none', 'sparing', 'rich']);
  if (typeof d.shading?.aa !== 'boolean') err('shading.aa', 'must be a boolean');
  oneOf('detail.density', d.detail?.density, ['low', 'medium', 'high']);
  num('detail.minFeaturePx', d.detail?.minFeaturePx, 1, 64, true);
  num('pipeline.revisionPasses', d.pipeline?.revisionPasses, 1, 10, true);
  if (typeof d.pipeline?.finishPass !== 'boolean') err('pipeline.finishPass', 'must be a boolean');
  num('pipeline.raster.directMaxPx', d.pipeline?.raster?.directMaxPx, 1, 4096, true);
  num('pipeline.raster.ss', d.pipeline?.raster?.ss, 1, 16, true);
  strs('pipeline.procedural', d.pipeline?.procedural);
  strs('pipeline.finish.allow', d.pipeline?.finish?.allow);
  num('effects.fps', d.effects?.fps, 1, 120, true);
  num('effects.maxFrames', d.effects?.maxFrames, 1, 256, true);
  if (d.background !== undefined && (typeof d.background !== 'string' || !HEX.test(d.background))) err('background', 'must be #rrggbb');
  strs('anchors', d.anchors);
  strs('rules.do', d.rules?.do);
  strs('rules.dont', d.rules?.dont);

  return errors.length ? { ok: false, errors } : { ok: true, errors, direction: d as Direction };
}

/** Validate or throw with every error listed. */
export function parseDirection(input: unknown): Direction {
  const r = validateDirection(input);
  if (!r.ok) throw new Error(`invalid direction:\n  ${r.errors.join('\n  ')}`);
  return r.direction!;
}

/** What assets see as `ctx.dir`: the direction plus resolved tokens. */
export interface DirContext extends Direction {
  /** Ramps by name, lower-case `#rrggbb`, lightest first. */
  pal: Record<string, string[]>;
  /** Outline colour. */
  outline: string;
  /** Shadow as an `rgba()` colour (alpha-blended when drawn). */
  shadow: string;
}

export function dirContext(dir: Direction): DirContext {
  const pal: Record<string, string[]> = {};
  for (const [k, r] of Object.entries(dir.palette.ramps)) pal[k] = r.map(normHex);
  const [r, g, b] = parseColor(dir.palette.shadow.color);
  return { ...dir, pal, outline: normHex(dir.palette.outline), shadow: `rgba(${r},${g},${b},${dir.palette.shadow.alpha})` };
}

/** Resolve a colour token: `outline`, `shadow`, `<ramp>` (middle), `<ramp>.<i>` or a material name. */
export function resolveToken(dir: Direction, token: string): string {
  const c = dirContext(dir);
  if (token === 'outline') return c.outline;
  if (token === 'shadow') return c.shadow;
  const [name, idx] = token.split('.');
  const ramp = c.pal[name] ?? c.pal[dir.palette.materials[name]];
  if (!ramp) throw new Error(`unknown colour token: ${token}`);
  const i = idx === undefined ? ramp.length >> 1 : +idx;
  if (!(i >= 0 && i < ramp.length)) throw new Error(`colour token out of range: ${token}`);
  return ramp[i];
}

/** Opaque colours an asset of `kind` may use: its allowed ramps (all when unrestricted) plus the outline. */
export function kindPalette(dir: Direction, kind?: string): string[] {
  const names = (kind && dir.palette.perKind[kind]) || Object.keys(dir.palette.ramps);
  const out = names.flatMap(n => dir.palette.ramps[n].map(normHex));
  out.push(normHex(dir.palette.outline));
  return [...new Set(out)];
}

/** Frame size for a brief `size`: `[w,h]`, or a key of `direction.scale` (`'character'`). */
export function resolveSize(dir: Direction, size: string | Size | undefined, kind?: string): Size {
  if (Array.isArray(size)) return size;
  const key = size ?? kind;
  // kinds without their own scale key borrow a related one (P3 brief kinds)
  const ALIAS: Record<string, string> = { creature: 'character', tileset: 'tile', texture: 'tile', viewmodel: 'large', 'ui-icon': 'prop' };
  const v = key ? dir.scale[key] ?? (dir.scale[ALIAS[key]] as number | Size | undefined) : undefined;
  if (typeof v === 'number') return [v, v];
  if (Array.isArray(v)) return v;
  throw new Error(`no size for ${JSON.stringify(size ?? kind)} in direction.scale`);
}
