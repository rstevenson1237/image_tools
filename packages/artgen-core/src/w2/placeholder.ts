/**
 * The placeholder (docs/STAGES.md §5.1): a flat-coloured stand-in at the right size, footprint, pivot and collision box,
 * so the game runs with it from day one. `placeholder.json` beside the asset's sources is data; `placeholderModule` turns
 * it into an asset module, so it renders, packs, exports and satisfies the animation contract through the same code as any
 * asset.
 */
import { pxPerMetre, resolveSize, type Direction, type Size } from 'artgen-scene/direction.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { FACINGS, type Anchors, type AssetModule, type RenderContext } from '../render.ts';
import type { StageCheck } from '../qa/stages.ts';
import type { BriefEntry } from './briefs.ts';
import { defaultAnchor } from './pack.ts';

export interface Box { x: number; y: number; w: number; h: number }
export interface Ellipse { cx: number; cy: number; rx: number; ry: number }

export interface Placeholder {
  format: 1;
  size: Size;
  pivot: [number, number];
  body: Box;
  footprint?: Ellipse;
  collision?: Box;
  ramp: string;
  anchors: Anchors;
}

/** Kinds that stand on the ground at a pivot: shape checks measure their height and feet. */
const STANDING = new Set(['character', 'creature', 'prop', 'vehicle']);
export const isStanding = (b: Pick<BriefEntry, 'kind'>): boolean => STANDING.has(b.kind);

/**
 * The row the feet stand on: the pivot's row, or, where the export anchor is the frame centre (top-down), the templates'
 * ground line near the bottom of the frame.
 */
export const groundY = (pivot: [number, number], size: Size): number => (pivot[1] >= size[1] * 0.6 ? pivot[1] : Math.round(size[1] * 0.95));

const RAMP_FOR: Record<string, string> = { character: 'cloth', creature: 'skin', prop: 'wood', vehicle: 'wood', tile: 'stone', tileset: 'stone', texture: 'stone', effect: 'glow' };

/** The default ramp of a kind: its usual material, as a ramp of the direction (a material name resolves through `palette.materials`). */
function defaultRamp(kind: string, dir: Direction): string {
  const R = dir.palette.ramps, want = RAMP_FOR[kind];
  if (want) { if (R[want]) return want; const m = dir.palette.materials[want]; if (m && R[m]) return m; }
  return (dir.palette.perKind[kind] ?? Object.keys(R)).find(n => R[n]) ?? Object.keys(R)[0];
}

/** Bodies seen along their length or in flight: their drawn height is not their standing height (as the conformance height check). */
const LOW = new Set(['quadruped', 'serpent', 'flyer']);

const FILLS_FRAME = new Set(['tile', 'tileset', 'texture', 'layer']);

/** Defaults for a brief (§5.1), all whole pixels. */
export function defaultPlaceholder(brief: BriefEntry, dir: Direction): Placeholder {
  const size = resolveSize(dir, brief.size, brief.kind), [w, h] = size, view = brief.view ?? dir.camera.view;
  const pivot = defaultAnchor(brief, view, size), ramp = defaultRamp(brief.kind, dir);
  const out: Placeholder = { format: 1, size, pivot, body: { x: 0, y: 0, w, h }, ramp, anchors: {} };
  if (FILLS_FRAME.has(brief.kind)) {
    if (brief.kind === 'tile' || brief.kind === 'tileset') out.collision = { x: 0, y: 0, w, h };
    return out;
  }
  if (!isStanding(brief)) {
    const bw = Math.max(1, Math.round(w * 0.6)), bh = Math.max(1, Math.round(h * 0.6));
    out.body = { x: (w - bw) >> 1, y: (h - bh) >> 1, w: bw, h: bh };
    return out;
  }
  const ground = groundY(pivot, size), body = brief.body ?? 'humanoid', flyer = body === 'flyer';
  const bottom = flyer ? ground - Math.round(h * 0.15) : ground;
  let bh = brief.height ? Math.round(brief.height * pxPerMetre(dir)) : Math.round(h * 0.88), bw: number;
  if (brief.kind === 'prop') bw = Math.round(w * 0.6);
  else if (body === 'quadruped' || body === 'serpent') { bw = Math.round(w * 0.8); bh = Math.min(bh, Math.round(h * 0.5)); }
  else if (flyer) bw = Math.round(w * 0.6);
  else if (body === 'large') bw = Math.round(w * 0.9);
  else bw = Math.round(bh * 0.45);
  bh = Math.max(1, Math.min(bh, bottom + 1)); bw = Math.max(2, Math.min(bw, w));
  out.body = { x: Math.max(0, Math.min(w - bw, pivot[0] - (bw >> 1))), y: bottom - bh + 1, w: bw, h: bh };
  if (view !== 'side') {
    // one pixel wider than the body each side, or the shadow would hide entirely behind it
    const cx0 = Math.max(1, Math.min(w - 1, pivot[0])), rx = Math.max(1, Math.min(Math.round(bw / 2) + 1, cx0, w - cx0)), ry = Math.max(1, Math.round(rx / 2)), cx = cx0, cy = Math.min(ground, h - ry);
    out.footprint = { cx, cy, rx, ry };
    out.collision = { x: cx - rx, y: cy - ry, w: 2 * rx, h: 2 * ry };
  } else out.collision = { ...out.body };
  const b = out.body;
  if (brief.kind === 'character' || (brief.kind === 'creature' && (!brief.body || brief.body === 'humanoid')))
    out.anchors = { head: [b.x + (b.w >> 1), b.y + Math.round(b.h * 0.15)], hand: [b.x, b.y + Math.round(b.h * 0.6)] };
  else if (brief.kind === 'creature') out.anchors = { ground: [pivot[0], pivot[1]], head: [b.x + (b.w >> 1), b.y + Math.round(b.h * 0.15)] };
  return out;
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const pair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(isInt);

/** A `placeholder.json` as data; fields it leaves out (size, pivot, body, ramp, anchors) come from the defaults. Throws on a bad file. */
export function parsePlaceholder(raw: unknown, brief: BriefEntry, dir: Direction): Placeholder {
  if (!isObj(raw)) throw new Error('placeholder.json: must be an object');
  if (raw.format !== 1) throw new Error('placeholder.json: format must be 1');
  const d = defaultPlaceholder(brief, dir), bad = (m: string): never => { throw new Error(`placeholder.json: ${m}`); };
  const box = (v: unknown, name: string): Box => {
    if (!isObj(v) || !['x', 'y', 'w', 'h'].every(k => isInt(v[k])) || (v.w as number) < 1 || (v.h as number) < 1) bad(`${name} must be { x, y, w, h } in whole pixels (w, h > 0)`);
    const b = v as Record<string, number>;
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  };
  if (raw.size !== undefined && !(pair(raw.size) && raw.size[0] > 0 && raw.size[1] > 0)) bad('size must be [w, h] in whole pixels');
  if (raw.pivot !== undefined && !pair(raw.pivot)) bad('pivot must be [x, y] in whole pixels');
  if (raw.ramp !== undefined && typeof raw.ramp !== 'string') bad('ramp must be a ramp name');
  let footprint: Ellipse | undefined;
  if (raw.footprint !== undefined) {
    const f = raw.footprint;
    if (!isObj(f) || !['cx', 'cy', 'rx', 'ry'].every(k => isInt(f[k])) || (f.rx as number) < 1 || (f.ry as number) < 1) bad('footprint must be { cx, cy, rx, ry } in whole pixels (rx, ry > 0)');
    const e = f as Record<string, number>;
    footprint = { cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry };
  }
  const anchors: Anchors = {};
  if (raw.anchors !== undefined) {
    if (!isObj(raw.anchors)) bad('anchors must map a name to [x, y]');
    for (const [k, v] of Object.entries(raw.anchors as Record<string, unknown>)) { if (!pair(v)) bad(`anchor ${k} must be [x, y] in whole pixels`); anchors[k] = v as [number, number]; }
  }
  return {
    format: 1, size: (raw.size as Size | undefined) ?? d.size, pivot: (raw.pivot as [number, number] | undefined) ?? d.pivot,
    body: raw.body !== undefined ? box(raw.body, 'body') : d.body, ...(footprint && { footprint }), ...(raw.collision !== undefined && { collision: box(raw.collision, 'collision') }),
    ramp: (raw.ramp as string | undefined) ?? d.ramp, anchors: raw.anchors !== undefined ? anchors : d.anchors,
  };
}

const inside = (b: Box, [w, h]: Size) => b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h;

/** Checks of the placeholder stage (§5.1): size, pivot, boxes inside the frame, the ramp. */
export function placeholderChecks(ph: Placeholder, brief: BriefEntry, dir: Direction): StageCheck[] {
  const c = (id: string, status: StageCheck['status'], detail: string): StageCheck => ({ id, status, detail, stage: 'placeholder' });
  const want = resolveSize(dir, brief.size, brief.kind), [w, h] = ph.size, out: StageCheck[] = [];
  out.push(ph.size[0] === want[0] && ph.size[1] === want[1] ? c('ph-size', 'pass', `${w}x${h}`) : c('ph-size', 'fail', `${w}x${h}, the brief's size is ${want.join('x')}`));
  out.push(ph.pivot[0] >= 0 && ph.pivot[1] >= 0 && ph.pivot[0] < w && ph.pivot[1] < h ? c('ph-pivot', 'pass', `pivot ${ph.pivot.join(',')}`) : c('ph-pivot', 'fail', `pivot ${ph.pivot.join(',')} is outside the ${w}x${h} frame`));
  const out2: string[] = [];
  if (!inside(ph.body, ph.size)) out2.push('body');
  if (ph.footprint && !inside({ x: ph.footprint.cx - ph.footprint.rx, y: ph.footprint.cy - ph.footprint.ry, w: 2 * ph.footprint.rx, h: 2 * ph.footprint.ry }, ph.size)) out2.push('footprint');
  if (ph.collision && !inside(ph.collision, ph.size)) out2.push('collision');
  if (out2.length) out.push(c('ph-box', 'fail', `${out2.join(', ')} outside the ${w}x${h} frame`));
  else if (brief.height && isStanding(brief) && !LOW.has(brief.body ?? '')) {
    const want = brief.height * pxPerMetre(dir), dev = Math.abs(ph.body.h - want) / want;
    out.push(dev > 0.2 ? c('ph-box', 'flag', `body ${ph.body.h} px tall, ${Math.round(want)} px for ${brief.height} m (${Math.round(dev * 100)}% off)`) : c('ph-box', 'pass', `body ${ph.body.h} px tall`));
  } else out.push(c('ph-box', 'pass', 'body, footprint and collision inside the frame'));
  out.push(dir.palette.ramps[ph.ramp] ? c('ph-ramp', 'pass', ph.ramp) : c('ph-ramp', 'fail', `${ph.ramp} is not a ramp of the direction (${Object.keys(dir.palette.ramps).join(', ')})`));
  return out;
}

/** A facing name as one of the 8 compass names (16-way names round to the nearest). */
function facing8(f: string): string {
  const F8 = FACINGS[8];
  if (F8.includes(f)) return f;
  const i = FACINGS[16].indexOf(f);
  return i < 0 ? 's' : F8[Math.round(i / 2) % 8];
}

/** Where the facing tick sits on the body edge: [-1|0|1 across, -1|0|1 down]. */
const TICK: Record<string, [number, number]> = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0], se: [1, 1], sw: [-1, 1], ne: [1, -1], nw: [-1, -1] };

/** The placeholder as an asset module: footprint, rounded body with an outer line, a facing tick, a state shade and a frame bob. */
export function placeholderModule(ph: Placeholder): AssetModule {
  return {
    meta: { notes: 'placeholder', mirror: false },
    render(ctx: RenderContext): Grid {
      const [w, h] = ctx.size, g = new Grid(w, h), ramp = ctx.dir.pal[ph.ramp] ?? Object.values(ctx.dir.pal)[0], top = ramp.length - 1;
      // the first state takes the middle step; the next ones step one band lighter, then darker, alternating
      const k = Math.max(0, ctx.brief.states?.indexOf(ctx.state) ?? 0), off = k === 0 ? 0 : Math.ceil(k / 2) * (k % 2 ? -1 : 1);
      const step = (i: number) => ramp[Math.max(0, Math.min(top, i))], mid = ramp.length >> 1;
      const bob = ctx.frame % 2 && ph.body.y > 0 ? -1 : 0;
      if (ph.footprint) {
        const f = ph.footprint;
        for (let y = f.cy - f.ry; y < f.cy + f.ry; y++) for (let x = f.cx - f.rx; x < f.cx + f.rx; x++) {
          const dx = (x + 0.5 - f.cx) / f.rx, dy = (y + 0.5 - f.cy) / f.ry;
          if (dx * dx + dy * dy <= 1) g.set(x, y, ctx.dir.shadow);
        }
      }
      const b = ph.body, by = b.y + bob, layer = new Grid(w, h), round = b.w > 6 && b.h > 6;
      for (let y = by; y < by + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        if (round && (x === b.x || x === b.x + b.w - 1) && (y === by || y === by + b.h - 1)) continue;
        layer.set(x, y, step(mid + off));
      }
      const tk = TICK[facing8(ctx.facing)] ?? TICK.s;
      const tx = b.x + (tk[0] < 0 ? 0 : tk[0] > 0 ? b.w - 2 : (b.w - 2) >> 1), ty = by + (tk[1] < 0 ? 0 : tk[1] > 0 ? b.h - 2 : (b.h - 2) >> 1);
      layer.fill(tx, ty, 2, 2, ramp[0]);
      g.blit(ctx.lib.line(layer), 0, 0);
      return g;
    },
    anchors(ctx: RenderContext): Anchors {
      const bob = ctx.frame % 2 && ph.body.y > 0 ? -1 : 0;
      return Object.fromEntries(Object.entries(ph.anchors).map(([k, [x, y]]) => [k, [x, y + bob] as [number, number]]));
    },
  };
}
