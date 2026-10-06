/**
 * Export (SPEC §5.4, §12.1, D16): MaxRects atlas packer, `pack.json` (artgen's own manifest), Aseprite-compatible
 * JSON (array form, one per atlas) and the generated `assets.ts` with typed ids. Pure: the CLI renders the frames
 * and writes the files.
 */
import type { Cell, RenderResult } from '../render.ts';
import { Grid } from '../lib/grid.ts';
import type { Direction, Size, View } from '../direction.ts';
import type { BriefEntry } from './briefs.ts';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Placed extends Rect { id: number; bin: number }

/** MaxRects bin packer (best short side fit, free-rect split + prune). Returns placements over one or more bins. */
export function packRects(sizes: { w: number; h: number }[], opts: { maxSize?: number; padding?: number } = {}): { placed: Placed[]; bins: Size[] } {
  const max = opts.maxSize ?? 2048, pad = opts.padding ?? 1;
  const order = sizes.map((s, id) => ({ ...s, id })).sort((a, b) => b.h - a.h || b.w - a.w || a.id - b.id);
  for (const s of order) if (s.w > max || s.h > max) throw new Error(`frame ${s.w}x${s.h} is larger than the max atlas size ${max}`);
  const tryPack = (items: typeof order, W: number, H: number) => {
    let free: Rect[] = [{ x: 0, y: 0, w: W + pad, h: H + pad }];
    const out: Placed[] = [], rest: typeof order = [];
    for (const it of items) {
      const w = it.w + pad, h = it.h + pad;
      let best: Rect | null = null, bs = Infinity, bl = Infinity;
      for (const f of free) if (f.w >= w && f.h >= h) {
        const s = Math.min(f.w - w, f.h - h), l = Math.max(f.w - w, f.h - h);
        if (s < bs || (s === bs && l < bl)) { best = f; bs = s; bl = l; }
      }
      if (!best) { rest.push(it); continue; }
      const r = { x: best.x, y: best.y, w, h };
      out.push({ id: it.id, bin: 0, x: r.x, y: r.y, w: it.w, h: it.h });
      const next: Rect[] = [];
      for (const f of free) {
        if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) { next.push(f); continue; }
        if (r.x > f.x) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
        if (r.x + r.w < f.x + f.w) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
        if (r.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
        if (r.y + r.h < f.y + f.h) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
      }
      free = next.filter((a, i) => !next.some((b, j) => j !== i && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (j < i || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)));
    }
    return { out, rest };
  };
  const placed: Placed[] = [], bins: Size[] = [];
  let todo = order;
  while (todo.length) {
    const area = todo.reduce((n, s) => n + (s.w + pad) * (s.h + pad), 0);
    let done = false;
    // smallest power-of-two atlas (square, or twice as wide) that takes everything left; else fill a max-size bin
    for (let side = 16; side <= max && !done; side *= 2) for (const [W, H] of [[side, side / 2], [side, side]] as Size[]) {
      if (W * H < area || H < 1) continue;
      const r = tryPack(todo, W, H);
      if (!r.rest.length) { const b = bins.length; placed.push(...r.out.map(p => ({ ...p, bin: b }))); bins.push(fitBin(r.out, W, H)); todo = []; done = true; break; }
    }
    if (done) break;
    const r = tryPack(todo, max, max), b = bins.length;
    if (!r.out.length) throw new Error('packRects: nothing fits');
    placed.push(...r.out.map(p => ({ ...p, bin: b }))); bins.push([max, max]); todo = r.rest;
  }
  return { placed: placed.sort((a, b) => a.id - b.id), bins };
}

/** Keep power-of-two sides but drop empty halves. */
function fitBin(out: Placed[], W: number, H: number): Size {
  const uw = Math.max(1, ...out.map(p => p.x + p.w)), uh = Math.max(1, ...out.map(p => p.y + p.h));
  let w = W, h = H;
  while (w / 2 >= uw && w > 16) w /= 2;
  while (h / 2 >= uh && h > 16) h /= 2;
  return [w, h];
}

/** One asset ready to pack: its render(s) per variant and brief. */
export interface PackInput {
  brief: BriefEntry;
  view: View;
  /** Render per param variant (index 0 = defaults). */
  renders: RenderResult[];
  /** Version exported (`finish.v2`) and its source hash, recorded in the manifest. */
  version: string;
  sourceHash: string;
  draft?: boolean;
}

export interface PackAsset {
  kind: string;
  view: View;
  size: Size;
  anchor: [number, number];
  directions: number;
  facings: string[];
  states: Record<string, { frames: number; fps: number; loop: boolean }>;
  /** [atlas, x, y, w, h, facing index, state, frame, variant] */
  frames: [number, number, number, number, number, number, string, number, number][];
  variants: string[];
  swaps?: Record<string, Record<string, string>>;
  version: string;
  sourceHash: string;
  tile?: number;
  draft?: true;
}

export interface PackManifest {
  format: 1;
  pack: string;
  generator: string;
  direction: { id: string; version: number };
  /** Runtime version the pack is exported for (`artgen-runtime`'s RUNTIME_VERSION); a runtime with another major refuses it. */
  runtime: string | null;
  atlases: string[];
  assets: Record<string, PackAsset>;
  /** Assets exported before approval (`--include-drafts`, D10): show them watermarked in game builds. */
  drafts?: string[];
}

const TILE_KINDS = new Set(['tile', 'tileset', 'texture']);
const LOOPING = /^(idle|walk|run|fly|swim|loop|burn|glow|flicker)/;

/** Default export anchor: the frame centre for top-down and tiles, bottom centre (feet) otherwise. */
export function defaultAnchor(b: BriefEntry, view: View, size: Size): [number, number] {
  if (b.anchor) return b.anchor;
  return view === 'topdown' || TILE_KINDS.has(b.kind) || b.kind === 'effect' ? [size[0] >> 1, size[1] >> 1] : [size[0] >> 1, size[1] - 1];
}

/** Ramp-to-ramp swaps → hex maps over the direction palette. */
export function swapMaps(dir: Direction, swaps: Record<string, Record<string, string>> = {}): Record<string, Record<string, string>> {
  const R = dir.palette.ramps, M = dir.palette.materials, ramp = (n: string) => R[n] ?? R[M[n]];
  const out: Record<string, Record<string, string>> = {};
  for (const [name, m] of Object.entries(swaps)) {
    const map: Record<string, string> = {};
    for (const [from, to] of Object.entries(m)) {
      const a = ramp(from), b = ramp(to);
      if (!a || !b) throw new Error(`swap ${name}: unknown ramp ${!a ? from : to}`);
      a.forEach((c, i) => { map[c] = b[Math.min(i, b.length - 1)]; });
    }
    out[name] = map;
  }
  return out;
}

export interface BuiltPack { manifest: PackManifest; atlases: Grid[]; aseprite: unknown[] }

/** Pack assets into atlases + manifest. Identical frames (same pixels) are stored once. */
export function buildPack(pack: string, dir: Direction, inputs: PackInput[], opts: { generator?: string; runtime?: string; maxSize?: number; padding?: number } = {}): BuiltPack {
  const uniq: Grid[] = [], byHash = new Map<string, number>();
  const refs: { asset: string; cell: Cell; variant: number; img: number; fi: number; si: string }[] = [];
  for (const inp of inputs) inp.renders.forEach((r, variant) => {
    for (const cell of r.cells) {
      const h = cell.grid.hash();
      let img = byHash.get(h);
      if (img === undefined) { img = uniq.length; uniq.push(cell.grid); byHash.set(h, img); }
      refs.push({ asset: inp.brief.id, cell, variant, img, fi: r.facings.indexOf(cell.facing), si: cell.state });
    }
  });
  const { placed, bins } = packRects(uniq.map(g => ({ w: g.w, h: g.h })), opts);
  const atlases = bins.map(([w, h]) => new Grid(w, h));
  placed.forEach(p => atlases[p.bin].blit(uniq[p.id], p.x, p.y));
  const names = atlases.map((_, i) => `${pack}-${i}.png`);
  const assets: Record<string, PackAsset> = {};
  const fps = dir.effects.fps;
  for (const inp of inputs) {
    const b = inp.brief, r = inp.renders[0];
    const states: PackAsset['states'] = {};
    for (const s of r.states) {
      const a = b.anims?.[s];
      states[s] = { frames: r.frames[s], fps: a?.fps ?? (b.kind === 'effect' ? fps : 8), loop: a?.loop ?? (b.kind !== 'effect' && (r.frames[s] === 1 || LOOPING.test(s))) };
    }
    const swaps = b.swaps && Object.keys(b.swaps).length ? swapMaps(dir, b.swaps) : undefined;
    assets[b.id] = {
      kind: b.kind, view: inp.view, size: r.size, anchor: defaultAnchor(b, inp.view, r.size), directions: r.facings.length, facings: r.facings, states,
      frames: refs.filter(x => x.asset === b.id).map(x => { const p = placed[x.img]; return [p.bin, p.x, p.y, p.w, p.h, x.fi, x.si, x.cell.frame, x.variant]; }),
      variants: ['base', ...inp.renders.slice(1).map((_, i) => `v${i + 1}`), ...Object.keys(swaps ?? {})],
      ...(swaps && { swaps }), version: inp.version, sourceHash: inp.sourceHash,
      ...(TILE_KINDS.has(b.kind) && { tile: r.size[0] }), ...(inp.draft && { draft: true as const }),
    };
  }
  const drafts = inputs.filter(i => i.draft).map(i => i.brief.id);
  const manifest: PackManifest = {
    format: 1, pack, generator: opts.generator ?? 'artgen', direction: { id: dir.id, version: dir.version }, runtime: opts.runtime ?? null, atlases: names, assets,
    ...(drafts.length && { drafts }),
  };
  const aseprite = atlases.map((g, bin) => asepriteJson(manifest, bin, g, names[bin]));
  return { manifest, atlases, aseprite };
}

/** Aseprite-compatible sprite sheet JSON (array form) for one atlas: frames named `asset/state/facing/frame[#variant]`, tags per strip. */
export function asepriteJson(m: PackManifest, bin: number, g: Grid, image: string) {
  const frames: unknown[] = [], tags: { name: string; from: number; to: number; direction: 'forward' }[] = [];
  for (const [id, a] of Object.entries(m.assets)) {
    let tag: { name: string; from: number; to: number; direction: 'forward' } | undefined;
    for (const [at, x, y, w, h, fi, state, frame, variant] of a.frames) {
      if (at !== bin) continue;
      const strip = `${id}/${state}/${a.facings[fi]}${variant ? `#${a.variants[variant]}` : ''}`;
      if (!tag || tag.name !== strip) { tag = { name: strip, from: frames.length, to: frames.length, direction: 'forward' }; tags.push(tag); } else tag.to = frames.length;
      frames.push({
        filename: `${id}/${state}/${a.facings[fi]}/${frame}${variant ? `#${a.variants[variant]}` : ''}`, frame: { x, y, w, h }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h }, duration: Math.round(1000 / a.states[state].fps),
      });
    }
  }
  return { frames, meta: { app: 'artgen', version: m.generator, image, format: 'RGBA8888', size: { w: g.w, h: g.h }, scale: '1', frameTags: tags } };
}

const ident = (s: string) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : JSON.stringify(s));

/** `assets.ts`: typed asset ids, states and facings per asset, and the pack manifest paths (W3 reads these). */
export function assetsTs(packs: { manifest: PackManifest; url: string }[]): string {
  let out = '// Generated by `artgen export` — do not edit. Typed ids for the exported art packs.\n\n';
  out += `export const Packs = {\n${packs.map(p => `  ${ident(p.manifest.pack)}: ${JSON.stringify(p.url)},`).join('\n')}\n} as const;\n\n`;
  out += 'export const Assets = {\n';
  for (const { manifest: m } of packs) for (const [id, a] of Object.entries(m.assets))
    out += `  ${ident(id)}: { id: ${JSON.stringify(id)}, pack: ${JSON.stringify(m.pack)}, kind: ${JSON.stringify(a.kind)}, states: ${JSON.stringify(Object.keys(a.states))}, facings: ${JSON.stringify(a.facings)}, variants: ${JSON.stringify(a.variants)} },\n`;
  out += '} as const;\n\nexport type AssetId = keyof typeof Assets;\nexport type StateOf<K extends AssetId> = (typeof Assets)[K][\'states\'][number];\nexport type VariantOf<K extends AssetId> = (typeof Assets)[K][\'variants\'][number];\n';
  return out;
}


