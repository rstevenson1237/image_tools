/**
 * Material recipes (SPEC §9, PLAN P6b): seamless textures banded to the direction's ramps. Each recipe computes, per
 * pixel, which ramp it uses, a tone (0 = the ramp's lightest step, 1 = its darkest) and a height; the composer lights
 * the height field with the direction's light (bumps catch light on the lit side), quantises the tone to
 * `shading.bands` (with the direction's ordered dither between bands when it allows one), and derives the normal map
 * from the same heights. Everything is periodic, so the texture tiles with no seam.
 *
 *   stone · cobble · wood (planks) · metal (plates) · grass · dirt · sand · snow · water · lava · tech · carpet
 *   brick (P6d: running-bond courses for first-person walls)
 *
 * Ramps are roles (`stone`, `dirt`, `wood`…) resolved through `palette.materials` and fallbacks, so a recipe works
 * under any generated direction; `ramps: { base: 'moss' }` overrides a role.
 */
import type { DirContext } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { normalFromHeight } from '../lib/normals.ts';
import { bandIndices } from '../t2/raster.ts';
import { blurWrap, pGradient, pValue, pWorley } from './noise.ts';

export interface MaterialOptions {
  w: number;
  h: number;
  seed?: number;
  /** Role → ramp overrides (`{ base: 'moss', mortar: 'dirt' }`). */
  ramps?: Record<string, string>;
  /** Feature size multiplier (1 = the recipe's default: stones, planks, plates scale with it). */
  scale?: number;
  /** Bump strength for lighting and the normal map (default 1). */
  relief?: number;
  /** Ordered dither between bands (default: the direction's `shading.dither`). */
  dither?: boolean;
  /** Ramp steps the texture may use, [lightest, darkest] indices (default the whole ramp): keep a near-black last step
   * for lines and shadows, out of a floor. */
  range?: [number, number];
  /** Recipe-specific knobs (defaults keep the recipe as it is): wood `planks` per row per tile and `grain` contrast; grass `soil` (bare-patch threshold, 1 = none); stone `variety` (slab-to-slab tone spread, default 0.38). */
  params?: Record<string, number>;
}

export interface TexResult {
  grid: Grid;
  height: Float32Array;
  normal: Grid;
  /** Ramp name per role actually used. */
  ramps: Record<string, string>;
}

interface Sample { role: string; tone: number; height: number }
type Recipe = (x: number, y: number, c: RecipeCtx) => Sample;
interface RecipeCtx { w: number; h: number; seed: number; s: number; rnd: (i: number, j?: number) => number; p: Record<string, number> }

/** Role → candidate ramp names, first that the direction has (or maps through `materials`) wins. */
const ROLES: Record<string, string[]> = {
  stone: ['stone', 'metal', 'dirt'], mortar: ['dirt', 'stone'], wood: ['wood', 'leather', 'dirt'], metal: ['metal', 'steel', 'stone'],
  rust: ['accent', 'leather', 'dirt'], grass: ['grass', 'foliage', 'moss', 'green'], dirt: ['dirt', 'leather', 'stone'], sand: ['sand', 'dirt', 'skin'],
  snow: ['snow', 'stone', 'metal', 'cloth'], water: ['water', 'cloth', 'blue', 'stone'], foam: ['metal', 'stone', 'cloth'], lava: ['lava', 'glow', 'accent', 'orange'],
  brick: ['brick', 'accent', 'leather', 'stone'], crust: ['stone', 'dirt'], tech: ['metal', 'steel', 'stone'], light: ['glow', 'accent'], carpet: ['cloth', 'accent', 'leather'], trim: ['accent', 'leather', 'wood'],
};

const RECIPE_ROLES: Record<string, Record<string, string>> = {
  stone: { base: 'stone' }, cobble: { base: 'stone', mortar: 'mortar' }, wood: { base: 'wood' }, metal: { base: 'metal', rust: 'rust' },
  grass: { base: 'grass', soil: 'dirt' }, dirt: { base: 'dirt', pebble: 'stone' }, sand: { base: 'sand' }, snow: { base: 'snow' },
  water: { base: 'water', foam: 'foam' }, lava: { base: 'lava', crust: 'crust' }, tech: { base: 'tech', light: 'light' }, carpet: { base: 'carpet', trim: 'trim' },
  brick: { base: 'brick', mortar: 'mortar' },
};

export const MATERIALS = Object.keys(RECIPE_ROLES);

const hash = (i: number, j: number, seed: number) => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const sstep = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mod = (a: number, b: number) => ((a % b) + b) % b;
/** Integer count of features across `size` for a feature `px` big (≥ 1, so the period is exact). */
const across = (size: number, px: number) => Math.max(1, Math.round(size / px));

const RECIPES: Record<string, Recipe> = {
  stone(x, y, c) {
    const o = { w: c.w, h: c.h, seed: c.seed }, n = pGradient(x, y, { ...o, cells: across(c.w, 7 * c.s), octaves: 3 });
    // slabs: big Worley cells, each its own tone; cracks are the cell borders on warped coordinates, 1 px wide
    const wx = x + 3 * (pGradient(x, y, { ...o, cells: across(c.w, 8), seed: c.seed + 21 }) - 0.5), wy = y + 3 * (pGradient(x, y, { ...o, cells: across(c.w, 8), seed: c.seed + 22 }) - 0.5);
    const cells = across(c.w, 16 * c.s), wv = pWorley(wx, wy, { ...o, cells }), px = (wv.f2 - wv.f1) * (c.w / cells);
    const crack = px < 0.75 ? 1 : 0, lip = px >= 0.75 && px < 1.75 ? 1 : 0, slab = c.rnd(wv.id, 1);
    const fine = pValue(x, y, { ...o, cells: across(c.w, 2), seed: c.seed + 5 });
    const vary = c.p.variety ?? 0.38; // `variety`: how much slabs differ in tone
    return { role: 'base', tone: crack ? 0.95 : 0.12 + vary * slab + 0.22 * (1 - n) + 0.1 * (fine - 0.5) - lip * 0.08, height: crack ? 0 : 0.5 + 0.3 * n + 0.1 * slab + fine * 0.1 };
  },
  cobble(x, y, c) {
    const wv = pWorley(x, y, { w: c.w, h: c.h, seed: c.seed, cells: across(c.w, 9 * c.s), jitter: 0.75 }), edge = wv.f2 - wv.f1;
    if (edge < 0.13) return { role: 'mortar', tone: 0.55 + 0.3 * pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 3), seed: c.seed + 9 }), height: 0 };
    const dome = sstep(0.13, 0.5, edge), own = c.rnd(wv.id);
    return { role: 'base', tone: 0.15 + 0.35 * own + 0.25 * (1 - dome) + 0.1 * pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 3), seed: c.seed + 3 }), height: 0.3 + 0.7 * dome };
  },
  wood(x, y, c) {
    const rows = across(c.h, 8 * c.s), ph = c.h / rows, row = Math.floor(y / ph), v = (y - row * ph) / ph;
    // `planks` joints per row per tile (default 1), staggered by row; each plank gets its own tone when there are several
    const np = Math.max(1, Math.round(c.p.planks ?? 1)), joint = c.rnd(row, 1) * c.w, len = c.w / np;
    const u = mod(x - joint, len), plank = row * 31 + Math.floor(mod(x - joint, c.w) / len);
    const seam = v < 1 / ph || u < 1 ? 1 : 0, own = np > 1 ? c.rnd(plank, 3) : c.rnd(row, 3), ga = c.p.grain ?? 0.3;
    const warp = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), cellsY: rows * 2, seed: c.seed + row });
    const grain = 0.5 + 0.5 * Math.sin((v * 6 + warp * 5 + c.rnd(row, 2) * 6) * Math.PI);
    const kw = pWorley(x, y, { w: c.w, h: c.h, cells: across(c.w, 12 * c.s), cellsY: rows, seed: c.seed + 77 }), knot = c.rnd(kw.id, 9) > 0.7 && kw.f1 < 0.09 ? 0.3 : 0;
    return { role: 'base', tone: seam ? 1 : 0.22 + ga * grain + 0.1 * own + knot, height: seam ? 0 : 0.6 + 0.1 * grain - (v < 0.2 ? 0 : 0.05 * v) };
  },
  metal(x, y, c) {
    const P = across(c.w, 16 * c.s), pw = c.w / P, ph = c.h / across(c.h, 16 * c.s), u = mod(x, pw), v = mod(y, ph);
    const seam = u < 1 || v < 1, rivet = [[3, 3], [pw - 3, 3], [3, ph - 3], [pw - 3, ph - 3]].some(([a, b]) => Math.hypot(u - a, v - b) < 1.1);
    const brushed = pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), cellsY: across(c.h, 1), seed: c.seed });
    const rust = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 5), octaves: 2, seed: c.seed + 4 });
    if (rust > 0.78 && !seam && (u < 4 || v < 4 || u > pw - 4 || v > ph - 4)) return { role: 'rust', tone: 0.3 + (rust - 0.78) * 2, height: 0.45 }; // rust creeps in from the seams
    if (seam) return { role: 'base', tone: 1, height: 0 };
    if (rivet) return { role: 'base', tone: 0.05, height: 1 };
    return { role: 'base', tone: 0.3 + 0.3 * brushed + 0.12 * (u / pw + v / ph), height: 0.5 };
  },
  grass(x, y, c) {
    const o = { w: c.w, h: c.h, seed: c.seed }, patch = pGradient(x, y, { ...o, cells: across(c.w, 10 * c.s), octaves: 2 });
    // blades: one short stroke per 4 px cell at a seeded spot — a lit tip over a dark root, leaning by cell
    const cx = across(c.w, 4), cy = across(c.h, 4), px = Math.floor(x), py = Math.floor(y);
    let blade = 0;
    for (let dj = 0; dj <= 1; dj++) for (let di = -1; di <= 0; di++) {
      const i = mod(Math.floor((px / c.w) * cx) + di, cx), j = mod(Math.floor((py / c.h) * cy) + dj, cy);
      const bx = Math.floor((i + c.rnd(i, j * 3 + 1)) * (c.w / cx)), by = Math.floor((j + c.rnd(i, j * 3 + 2)) * (c.h / cy)), lean = c.rnd(i, j * 3 + 3) > 0.5 ? 1 : 0;
      const dx = mod(px - bx + c.w, c.w), dy = mod(by - py + c.h, c.h);
      if (dx === 0 && dy === 0) blade = 2;                          // root: dark
      else if (dx === lean && dy === 1) blade = 1;                  // tip: light
    }
    const soil = pValue(x, y, { ...o, cells: across(c.w, 6), seed: c.seed + 11 }) > (c.p.soil ?? 0.86) && !blade; // `soil`: threshold for bare patches (1 = none)
    if (soil) return { role: 'soil', tone: 0.5, height: 0.1 };
    return { role: 'base', tone: blade === 1 ? 0.05 : blade === 2 ? 0.85 : 0.35 + 0.3 * (1 - patch), height: 0.4 + (blade === 1 ? 0.4 : 0) + patch * 0.2 };
  },
  dirt(x, y, c) {
    const o = { w: c.w, h: c.h, seed: c.seed }, n = pGradient(x, y, { ...o, cells: across(c.w, 10 * c.s), octaves: 3 });
    const pb = pWorley(x, y, { ...o, cells: across(c.w, 7 * c.s), seed: c.seed + 2 });
    if (c.rnd(pb.id, 5) > 0.7 && pb.f1 < 0.22) return { role: 'pebble', tone: 0.2 + pb.f1 * 2, height: 0.9 - pb.f1 };
    const speck = pValue(x, y, { ...o, cells: across(c.w, 1.5), seed: c.seed + 8 });
    return { role: 'base', tone: 0.25 + 0.45 * (1 - n) + (speck > 0.85 ? 0.3 : speck < 0.12 ? -0.15 : 0), height: n * 0.6 };
  },
  sand(x, y, c) {
    const warp = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), octaves: 2, seed: c.seed });
    const k = across(c.h, 6 * c.s), r = 0.5 + 0.5 * Math.sin(((y / c.h) * k + warp * 1.6) * Math.PI * 2);
    const grain = pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 1.5), seed: c.seed + 3 });
    return { role: 'base', tone: 0.2 + 0.35 * r + (grain > 0.88 ? 0.25 : 0), height: r * 0.6 };
  },
  snow(x, y, c) {
    const n = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 8 * c.s), octaves: 3, seed: c.seed });
    const spark = hash(Math.floor(x), Math.floor(y), c.seed + 6) > 0.985;
    return { role: 'base', tone: spark ? 0 : 0.1 + 0.3 * (1 - n), height: n * 0.35 };
  },
  water(x, y, c) {
    const o = { w: c.w, h: c.h, seed: c.seed }, k = across(c.h, 5 * c.s);
    const warp = pGradient(x, y, { ...o, cells: across(c.w, 12), octaves: 2 });
    const wave = 0.5 + 0.5 * Math.sin(((y / c.h) * k + warp * 2 + (x / c.w) * 2) * Math.PI * 2);
    const glint = wave > 0.94 && pValue(x, y, { ...o, cells: across(c.w, 4), seed: c.seed + 2 }) > 0.55;
    if (glint) return { role: 'foam', tone: 0, height: 0.6 };
    return { role: 'base', tone: 0.25 + 0.5 * (1 - wave) * 0.8 + 0.2 * warp, height: wave * 0.3 };
  },
  lava(x, y, c) {
    const wv = pWorley(x, y, { w: c.w, h: c.h, seed: c.seed, cells: across(c.w, 10 * c.s), jitter: 0.85 }), edge = wv.f2 - wv.f1;
    const heat = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), octaves: 2, seed: c.seed + 1 });
    if (edge < 0.1 + 0.08 * heat) return { role: 'base', tone: edge * 4, height: 0 };
    return { role: 'crust', tone: 0.35 + 0.5 * (1 - sstep(0.1, 0.4, edge)) * 0.6 + 0.25 * c.rnd(wv.id), height: 0.4 + 0.6 * sstep(0.1, 0.45, edge) };
  },
  tech(x, y, c) {
    const P = across(c.w, 16 * c.s), pw = c.w / P, ph = c.h / across(c.h, 16 * c.s), u = mod(x, pw), v = mod(y, ph);
    const edge = u < 1 || v < 1 ? 'seam' : u < 2 || v < 2 ? 'lit' : u > pw - 2 || v > ph - 2 ? 'dark' : '';
    const cell = Math.floor(x / pw) + Math.floor(y / ph) * 31, strip = c.rnd(cell, 3) > 0.6 && Math.abs(v - ph / 2) < 0.6 && u > 3 && u < pw - 3;
    if (strip) return { role: 'light', tone: 0.1, height: 0.6 };
    const vent = c.rnd(cell, 4) > 0.65 && u > 4 && u < pw - 4 && v > 4 && v < ph - 4 && Math.floor(v) % 2 === 0;
    const scuff = pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 4), seed: c.seed }) > 0.8 ? 0.15 : 0;
    return { role: 'base', tone: edge === 'seam' ? 1 : edge === 'lit' ? 0.05 : edge === 'dark' ? 0.75 : vent ? 0.85 : 0.35 + scuff, height: edge === 'seam' ? 0 : vent ? 0.2 : 0.5 };
  },
  carpet(x, y, c) {
    // a woven diamond motif on a period that divides the tile, worn by low-frequency noise
    const P = c.w / across(c.w, 16 * c.s), u = mod(x, P) / P - 0.5, v = mod(y, P) / P - 0.5, d = Math.abs(u) + Math.abs(v);
    const weave = (Math.floor(x) + Math.floor(y)) % 2 === 0 ? 0.08 : 0;
    const wear = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), octaves: 2, seed: c.seed });
    if (Math.abs(d - 0.32) < 0.06) return { role: 'trim', tone: 0.2 + weave + (wear > 0.7 ? 0.3 : 0), height: 0.6 };
    return { role: 'base', tone: (d < 0.2 ? 0.2 : 0.5) + weave + (wear > 0.65 ? 0.25 : 0), height: 0.5 };
  },
  brick(x, y, c) {
    // running bond: `courses` rows per tile (default 8 per 64 px), bricks twice as long as tall, every other row offset
    // half a brick; each brick its own tone, bevelled lit top edge, 1 px mortar joints
    const rows = across(c.h, (c.p.course ?? 8) * c.s), ph = c.h / rows, row = Math.floor(y / ph), v = y - row * ph;
    const per = across(c.w, ph * 2.2), pw = c.w / per, u = mod(x - (row % 2 ? pw / 2 : 0), pw), id = row * 97 + Math.floor(mod(x - (row % 2 ? pw / 2 : 0), c.w) / pw);
    if (v < 1 || u < 1) return { role: 'mortar', tone: 0.55 + 0.25 * pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 3), seed: c.seed + 9 }), height: 0 };
    const own = c.rnd(id, 5), pit = pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 2), seed: c.seed + 4 });
    const chip = c.rnd(id, 6) > 0.8 && pWorley(x, y, { w: c.w, h: c.h, cells: across(c.w, 6), seed: c.seed + id }).f1 < 0.12;
    return { role: 'base', tone: 0.2 + 0.4 * own + 0.15 * (pit - 0.5) + (v < 2 ? -0.12 : 0) + (chip ? 0.35 : 0), height: chip ? 0.3 : 0.7 + 0.1 * own - (v > ph - 2 ? 0.2 : 0) };
  },
};

const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16));

/** Resolve a role to a direction ramp name. */
export function roleRamp(dir: DirContext, role: string, override?: string): string {
  if (override) { const r = dir.pal[override] ? override : dir.palette.materials[override]; if (r && dir.pal[r]) return r; throw new Error(`texture: unknown ramp ${override}`); }
  for (const c of ROLES[role] ?? [role]) { if (dir.pal[c]) return c; const m = dir.palette.materials[c]; if (m && dir.pal[m]) return m; }
  return Object.keys(dir.pal)[0];
}

/** Render a material recipe. */
export function material(name: string, dir: DirContext, o: MaterialOptions): TexResult {
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`unknown material ${JSON.stringify(name)} (have: ${MATERIALS.join(', ')})`);
  const { w, h } = o, seed = o.seed ?? 1, ctx: RecipeCtx = { w, h, seed, s: o.scale ?? 1, rnd: (i, j = 0) => hash(i, j, seed + 101), p: o.params ?? {} };
  const roles = RECIPE_ROLES[name], ramps: Record<string, string> = {};
  for (const [r, def] of Object.entries(roles)) ramps[r] = roleRamp(dir, def, o.ramps?.[r]);
  const samples: Sample[] = [];
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = recipe(x + 0.5, y + 0.5, ctx); samples.push(s); height[y * w + x] = s.height; }
  // light the heights: slope toward the light → lighter, away → darker (periodic gradients, like the normal map)
  const relief = o.relief ?? 1, [lx, ly] = dir.camera.light, ll = Math.hypot(lx, ly) || 1, hb = blurWrap(height, w, h, 1);
  const dither = o.dither ?? dir.shading.dither !== 'none', grid = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, s = samples[i], ramp = dir.pal[ramps[s.role] ?? ramps.base];
    const gx = (hb[y * w + mod(x + 1, w)] - hb[y * w + mod(x - 1, w)]) / 2, gy = (hb[mod(y + 1, h) * w + x] - hb[mod(y - 1, h) * w + x]) / 2;
    const lit = -(gx * lx + gy * ly) / ll; // > 0 where the surface rises toward the light
    const tone = clamp01(s.tone - lit * 1.6 * relief);
    const L0 = bandIndices(ramp.length, dir.shading.bands), [r0, r1] = o.range ?? [0, ramp.length - 1];
    const Lr = L0.filter(i => i >= r0 && i <= r1), L = Lr.length ? Lr : L0, f = tone * L.length;
    let k = Math.min(L.length - 1, Math.floor(f));
    if (dither && k < L.length - 1 && f - k > BAYER4[y % 4][x % 4]) k++;
    grid.set(x, y, ramp[L[k]]);
  }
  const normal = normalFromHeight(height, w, h, { wrap: true, strength: 3 * relief });
  grid.normal = normal;
  return { grid, height, normal, ramps };
}
