/**
 * Settlement → SVG, in colour or black and white, in two views of one file:
 *
 * - `site`: the whole sheet. Layers in a fixed order, each its own `<g id="…">`: ground, underlay, areas, water,
 *   roads, bridges, walls, buildings, trees, props, grid, symbols, numbers, labels, then the legend, title, scale bar
 *   and compass. Buildings show as roofs (blocked out), as outlines, or cut away to their ground floor (`interior`).
 * - `plan`: one building's floor at plan scale with a margin round it: floor, grid, inner and outer walls, doors,
 *   windows, furniture, room numbers and names, a title naming the building and floor, a scale bar and a compass turned
 *   with the building.
 *
 * Everything is drawn from plain shapes: polygons, stroked lines, circles and the fixture drawings in `fixtures.ts`.
 */
import { rng } from '../lib/rng.ts';
import { compassSvg, esc, FONT, haloText, n1 } from '../lib/svgdraw.ts';
import { pathData } from '../lib/trace.ts';
import { frameOf, sizeAttrs, type Crop, type Frame, type SizeUnit } from '../lib/view.ts';
import { PAGE_PT, pageUnit, pointsToPx, overlaps, type Box } from '../lib/page.ts';
import type { MapField } from '../map/generate.ts';
import type { MapSpec } from '../map/spec.ts';
import { idSeed } from '../dungeon/layout.ts';
import { offsetRing } from '../dungeon/walls.ts';
import { area2 } from '../dungeon/geom.ts';
import { placeFurniture, type FurnitureItem, type FurnitureLayout } from '../dungeon/furniture.ts';
import { underlaySvg } from '../dungeon/underlay.ts';
import { SYMBOLS as DUNGEON_SYMBOLS } from '../dungeon/symbols.ts';
import { SYMBOLS as MAP_SYMBOLS } from '../map/symbols.ts';
import { FIXTURES, fixtureSize } from './fixtures.ts';
import { layoutFloor, layoutSettlement, TREE_FT, type BuildingGeom, type FloorLayout, type OpeningGeom, type SettlementLayout, type WallGeom } from './layout.ts';
import { floorAt, floorName, groundFloor, planFactor, roofOf, type Building, type Floor, type SettlementLabel, type SettlementSpec, type Tree } from './spec.ts';
import { AREA_PATTERNS, PALETTES, patternInk, roofTone, type Palette, type SettlementTheme } from './theme.ts';

export const SITE_LAYERS = ['ground', 'underlay', 'areas', 'water', 'roads', 'bridges', 'walls', 'buildings', 'trees', 'props', 'grid', 'symbols', 'numbers', 'labels', 'legend', 'title', 'scale', 'compass'] as const;
export const PLAN_LAYERS = ['ground', 'floor', 'grid', 'walls', 'doors', 'windows', 'fixtures', 'numbers', 'labels', 'legend', 'title', 'scale', 'compass'] as const;
export type SettlementLayer = (typeof SITE_LAYERS)[number] | (typeof PLAN_LAYERS)[number];
export const VIEWS = ['site', 'plan'] as const;
export type SettlementView = (typeof VIEWS)[number];
/** How buildings show on the site: `roofs` (blocked out), `outline` (walls and floor, no roof), `interior` (the ground floor cut away; outline where there is none). */
export const BUILDING_MODES = ['roofs', 'outline', 'interior'] as const;
export type BuildingMode = (typeof BUILDING_MODES)[number];

/** Symbols for the overlay: the dungeon set and the terrain map set. */
export const SYMBOLS: Record<string, { name: string; svg: string }> = { ...MAP_SYMBOLS, ...DUNGEON_SYMBOLS };
export const SYMBOL_KINDS = Object.keys(SYMBOLS);

/** The margin round a plan, in plan cells. */
export const PLAN_MARGIN = 2;

export interface RenderSettlementOptions {
  view?: SettlementView;
  /** For a plan: the building's id. */
  building?: string;
  /** For a plan: the floor's level (default: the ground floor). */
  floor?: number;
  theme?: SettlementTheme;
  buildings?: BuildingMode;
  /** Pixels per cell (site cell, or plan cell for a plan; default 24 on the site, 40 on a plan). */
  ppu?: number;
  layers?: Partial<Record<SettlementLayer, boolean>>;
  layout?: SettlementLayout;
  crop?: Crop;
  unit?: SizeUnit;
  /** The map named by `underlay` (read by the caller). */
  underlay?: { map: MapSpec; field?: MapField };
  /** Output pixels per millimetre on the page: text is then set in points. */
  pageScale?: number;
}

const tok = (svg: string, p: Palette) => svg.replaceAll('{ink}', p.ink).replaceAll('{fill}', p.fixture.fill).replaceAll('{accent}', p.fixture.accent).replaceAll('{stone}', p.fixture.stone).replaceAll('{water}', p.fixture.water).replaceAll('{paper}', p.fixture.paper);
const ring = (pts: number[], k: number) => pathData([{ pts, closed: true }], k);
const line = (pts: number[], k: number, closed = false) => pathData([{ pts, closed }], k);
const toP = (pts: number[]): [number, number][] => Array.from({ length: pts.length / 2 }, (_, i) => [pts[2 * i], pts[2 * i + 1]]);

/** A pattern fill tile, `cells` across. */
function patternDef(id: string, name: string, k: number, ink: string, cells = 1): string {
  const T = Math.max(4, k * cells);
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n1(T)}" height="${n1(T)}"><g transform="scale(${(T / 10).toFixed(4)})">${AREA_PATTERNS[name].replaceAll('{ink}', ink)}</g></pattern>`;
}

/** Which layers render: everything on, the optional ones as the file says, then the caller's overrides. */
export function settlementLayersFor(spec: SettlementSpec, view: SettlementView, over: Partial<Record<SettlementLayer, boolean>> = {}): Record<SettlementLayer, boolean> {
  const all = [...SITE_LAYERS, ...PLAN_LAYERS], on = Object.fromEntries(all.map(l => [l, true])) as Record<SettlementLayer, boolean>;
  on.underlay = !!spec.underlay; on.grid = spec.grid.show; on.numbers = spec.numbers; on.scale = spec.scaleBar; on.compass = spec.compass;
  on.legend = !!spec.legend; on.title = view === 'plan' || !!spec.title;
  return { ...on, ...over };
}

// ---- shapes ---------------------------------------------------------------------------------------------------------

/** A tree crown: a ring of bumps. */
function crown(cx: number, cy: number, r: number, bumps: number, fill: string, edge: string, sw: number, seed: number): string {
  const rand = rng(seed), a0 = rand() * Math.PI * 2, pts: [number, number][] = [];
  for (let i = 0; i < bumps; i++) { const a = a0 + (i / bumps) * Math.PI * 2, rr = r * (0.86 + rand() * 0.1); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const br = r * Math.sin(Math.PI / bumps) * 1.15;
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 1; i <= bumps; i++) { const p = pts[i % bumps]; d += `A${n1(br)} ${n1(br)} 0 0 1 ${n1(p[0])} ${n1(p[1])}`; }
  return `<path d="${d}Z" fill="${fill}" stroke="${edge}" stroke-width="${n1(sw)}" stroke-linejoin="round"/>`;
}

function treeSvg(t: Tree, k: number, p: Palette, u: number, per: number, seed: number): string {
  const r = ((t.size ?? TREE_FT[t.kind] / per) * k) / 2, x = t.x * k, y = t.y * k, sw = Math.max(0.6, 0.9 * u);
  if (t.kind === 'tree') return crown(x, y, r, 9, p.tree, p.treeDark, sw, seed) + (p.ripples ? '' : `<circle cx="${n1(x - r * 0.25)}" cy="${n1(y - r * 0.25)}" r="${n1(r * 0.35)}" fill="#ffffff" fill-opacity="0.18"/>`);
  if (t.kind === 'conifer') {
    let d = '';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.55 : r; d += `${i ? 'L' : 'M'}${n1(x + Math.cos(a) * rr)} ${n1(y + Math.sin(a) * rr)}`; }
    return `<path d="${d}Z" fill="${p.ripples ? p.paper : p.treeDark}" fill-opacity="${p.ripples ? 1 : 0.85}" stroke="${p.treeDark}" stroke-width="${n1(sw)}" stroke-linejoin="round"/><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(Math.max(0.6, r * 0.12))}" fill="${p.ink}"/>`;
  }
  if (t.kind === 'bush') return crown(x, y, r, 6, p.tree, p.treeDark, sw * 0.8, seed);
  if (t.kind === 'rock' || t.kind === 'boulder') {
    const rand = rng(seed), n = 7;
    let d = '';
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rand() * 0.4, rr = r * (0.7 + rand() * 0.3); d += `${i ? 'L' : 'M'}${n1(x + Math.cos(a) * rr)} ${n1(y + Math.sin(a) * rr)}`; }
    return `<path d="${d}Z" fill="${p.rock}" stroke="${p.ink}" stroke-width="${n1(sw)}" stroke-linejoin="round"/>`;
  }
  if (t.kind === 'stump') return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${p.fixture.fill}" stroke="${p.ink}" stroke-width="${n1(sw)}"/><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * 0.45)}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.6)}"/>`;
  // reeds: a few short strokes
  let d = '';
  for (let i = -2; i <= 2; i++) d += `M${n1(x + i * r * 0.35)} ${n1(y + r * 0.5)}l${n1(i * r * 0.08)} ${n1(-r)}`;
  return `<path d="${d}" stroke="${p.treeDark}" stroke-width="${n1(sw)}" stroke-linecap="round" fill="none"/>`;
}

/** A fixture drawn at its centre (cells × k), turned. */
function fixtureSvg(f: { kind: string; x: number; y: number; w: number; h: number; angle: number }, k: number, p: Palette, sw: number): string {
  const kind = FIXTURES[f.kind];
  if (!kind) return '';
  return `<g transform="translate(${n1(f.x * k)} ${n1(f.y * k)})${f.angle ? ` rotate(${n1(f.angle)})` : ''}">${tok(kind.draw(f.w * k, f.h * k, sw), p)}</g>`;
}

/** A door, opening or window in a wall `t` thick, centred on the wall line; `angle` runs along the wall. */
function openingSvg(o: OpeningGeom, k: number, t: number, p: Palette, sw: number): string {
  const W = o.width * k, gap = `<rect x="${n1(-W / 2)}" y="${n1(-t * 0.62)}" width="${n1(W)}" height="${n1(t * 1.24)}" fill="${p.floor}"/>`;
  const leaf = (x: number, w: number) => `<rect x="${n1(x)}" y="${n1(-t * 0.22)}" width="${n1(w)}" height="${n1(t * 0.44)}" fill="${p.fixture.fill}" stroke="${p.ink}" stroke-width="${n1(sw)}"/>`;
  let g = '';
  if (o.kind === 'window') g = `<rect x="${n1(-W / 2)}" y="${n1(-t / 2)}" width="${n1(W)}" height="${n1(t)}" fill="${p.fixture.paper}" stroke="${p.ink}" stroke-width="${n1(sw)}"/><path d="M${n1(-W / 2)} 0H${n1(W / 2)}" stroke="${p.ink}" stroke-width="${n1(sw * 0.7)}"/>`;
  else if (o.kind === 'secret') g = `<path d="M${n1(-W / 2)} 0H${n1(W / 2)}" stroke="${p.paper}" stroke-width="${n1(t * 0.25)}" stroke-dasharray="${n1(t * 0.5)} ${n1(t * 0.4)}"/>`;
  else if (o.kind === 'open') g = gap;
  else if (o.kind === 'portcullis') { g = gap; const n = Math.max(3, Math.round(o.width * 4)); for (let i = 0; i < n; i++) g += `<circle cx="${n1(-W / 2 + (W * (i + 0.5)) / n)}" r="${n1(Math.max(0.8, t * 0.2))}" fill="${p.ink}"/>`; }
  else if (o.kind === 'arch') g = gap + `<rect x="${n1(-W / 2 - t * 0.3)}" y="${n1(-t * 0.62)}" width="${n1(t * 0.6)}" height="${n1(t * 1.24)}" fill="${p.ink}"/><rect x="${n1(W / 2 - t * 0.3)}" y="${n1(-t * 0.62)}" width="${n1(t * 0.6)}" height="${n1(t * 1.24)}" fill="${p.ink}"/>`;
  else {
    g = gap + leaf(-W / 2, W);
    if (o.kind === 'locked') g += `<path d="M0 ${n1(-t * 0.5)}V${n1(t * 0.5)}" stroke="${p.ink}" stroke-width="${n1(Math.max(sw * 1.5, t * 0.3))}"/>`;
  }
  return `<g transform="translate(${n1(o.x * k)} ${n1(o.y * k)}) rotate(${n1(o.angle)})">${g}</g>`;
}

function badge(text: string, x: number, y: number, fs: number, p: Palette): string {
  const bh = fs * 1.45, bw = Math.max(bh, text.length * fs * 0.62 + fs * 0.7);
  return `<rect x="${n1(x - bw / 2)}" y="${n1(y - bh / 2)}" width="${n1(bw)}" height="${n1(bh)}" rx="${n1(bh * 0.32)}" fill="${p.badge}"/><text x="${n1(x)}" y="${n1(y + fs * 0.36)}" font-size="${n1(fs)}" font-weight="700" text-anchor="middle" fill="${p.badgeText}">${esc(text)}</text>`;
}

// ---- floors ---------------------------------------------------------------------------------------------------------

/** A floor drawn in its own plan pixels (origin at the footprint's top-left corner, `k` pixels a plan cell). */
function floorSvg(fl: FloorLayout, k: number, p: Palette, u: number, on: { grid: boolean; numbers: boolean; labels: boolean; fixtures: boolean; doors: boolean; windows: boolean; walls: boolean; floor: boolean }, clipId: string, gridSize: number, text: { number: number; name: number }): Record<string, string> {
  const out: Record<string, string> = {}, tOut = Math.max(1.5 * u, 0.3 * k), tIn = Math.max(1 * u, 0.15 * k), sw = Math.max(0.6, 0.9 * u);
  const d = ring(fl.outline, k);
  if (on.floor) out.floor = `<path d="${d}" fill="${p.floor}"/>`;
  if (on.grid) {
    let gd = '';
    for (let x = 0; x <= fl.w + 1e-9; x += gridSize) gd += `M${n1(x * k)} 0V${n1(fl.h * k)}`;
    for (let y = 0; y <= fl.h + 1e-9; y += gridSize) gd += `M0 ${n1(y * k)}H${n1(fl.w * k)}`;
    out.grid = `<clipPath id="${clipId}"><path d="${d}"/></clipPath><path d="${gd}" clip-path="url(#${clipId})" stroke="${p.grid}" stroke-opacity="${p.gridOpacity}" stroke-width="${n1(0.8 * u)}" fill="none"/>`;
  }
  if (on.fixtures && fl.fixtures.length) out.fixtures = fl.fixtures.map(f => fixtureSvg(f, k, p, sw)).join('');
  if (on.walls) {
    const parts = fl.partitions.map(s => `M${n1(s[0] * k)} ${n1(s[1] * k)}L${n1(s[2] * k)} ${n1(s[3] * k)}`).join('');
    out.walls = (parts ? `<path d="${parts}" stroke="${p.outerWall}" stroke-width="${n1(tIn)}" stroke-linecap="square" fill="none"/>` : '') + `<path d="${d}" fill="none" stroke="${p.outerWall}" stroke-width="${n1(tOut)}" stroke-linejoin="miter"/>`;
  }
  if (on.doors) out.doors = fl.inner.map(o => openingSvg(o, k, tIn, p, sw)).join('') + fl.doors.map(o => openingSvg(o, k, tOut, p, sw)).join('');
  if (on.windows) out.windows = fl.windows.map(o => openingSvg(o, k, tOut, p, sw)).join('');
  let nums = '', names = '';
  for (const g of fl.rooms) {
    const x = g.cx * k, y = g.cy * k, has = on.numbers && g.number !== undefined;
    if (has) nums += badge(String(g.number), x, y, text.number, p);
    if (on.labels && g.room.label) names += haloText(g.room.label, x, y + (has ? text.number * 1.6 : text.name * 0.3), text.name, p.ink, { halo: p.halo }, 'font-weight="700"');
  }
  if (on.labels) for (const f of fl.fixtures) if (f.label) names += haloText(f.label, f.x * k, (f.y + f.h / 2) * k + text.name, text.name * 0.85, p.ink, { halo: p.halo }, 'font-style="italic"');
  if (nums) out.numbers = nums;
  if (names) out.labels = names;
  return out;
}

// ---- roofs ----------------------------------------------------------------------------------------------------------

/** A turned rectangle's ridge: along its long axis, `inset` (0..1 of its short side) short of each end; and its corners. */
function ridgeOf(w: number[]): { a: [number, number]; b: [number, number]; corners: [number, number][]; short: number } {
  const c = toP(w), side = (i: number, j: number) => Math.hypot(c[j][0] - c[i][0], c[j][1] - c[i][1]);
  const mid = (i: number, j: number): [number, number] => [(c[i][0] + c[j][0]) / 2, (c[i][1] + c[j][1]) / 2];
  const long01 = side(0, 1) >= side(1, 2);
  return long01 ? { a: mid(0, 3), b: mid(1, 2), corners: c, short: side(1, 2) } : { a: mid(0, 1), b: mid(3, 2), corners: c, short: side(0, 1) };
}

function roofSvg(g: BuildingGeom, k: number, p: Palette, u: number): string {
  const b = g.building, roof = roofOf(b), d = ring(g.outline, k), sw = Math.max(0.8, 1.1 * u), tone = p.roof[roofTone(b.kind)];
  const round = b.shape === 'circle' || b.shape === 'octagon' || b.shape === 'poly';
  const shadow = p.ripples ? '' : `<path d="${d}" transform="translate(${n1(0.22 * k)} ${n1(0.22 * k)})" fill="#000000" fill-opacity="0.16"/>`;
  if (roof === 'none') {
    return `<path d="${d}" fill="${p.floor}" fill-opacity="0.55" stroke="${p.outerWall}" stroke-width="${n1(Math.max(1.5 * u, 0.25 * k))}" stroke-dasharray="${n1(k * 0.9)} ${n1(k * 0.35)} ${n1(k * 0.4)} ${n1(k * 0.5)}" stroke-linejoin="miter"/>`;
  }
  let g2 = `${shadow}<path d="${d}" fill="${tone}" stroke="${p.ink}" stroke-width="${n1(sw)}" stroke-linejoin="${roof === 'thatch' ? 'round' : 'miter'}"/>`;
  const ln = (dd: string, w = sw * 0.9, color = p.ridge) => `<path d="${dd}" fill="none" stroke="${color}" stroke-width="${n1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const M = (q: [number, number]) => `${n1(q[0] * k)} ${n1(q[1] * k)}`;
  if (roof === 'cone' || (round && (roof === 'gable' || roof === 'hip' || roof === 'thatch'))) {
    const pts = toP(g.outline), step = Math.max(1, Math.floor(pts.length / 8));
    let dd = '';
    for (let i = 0; i < pts.length; i += step) dd += `M${M([g.cx, g.cy])}L${M(pts[i])}`;
    g2 += ln(dd, sw * 0.6) + `<circle cx="${n1(g.cx * k)}" cy="${n1(g.cy * k)}" r="${n1(Math.max(1.5, 0.12 * k))}" fill="${p.ridge}"/>`;
    return g2;
  }
  if (roof === 'flat' || roof === 'battlement') {
    const inset = Math.min(0.35, Math.min(b.w, b.h) * 0.12), r = offsetRing(toP(g.outline), area2(g.outline) > 0 ? -inset : inset).flat();
    if (roof === 'battlement') g2 += `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="${n1(Math.max(2 * u, 0.3 * k))}" stroke-dasharray="${n1(0.4 * k)} ${n1(0.32 * k)}" stroke-linejoin="miter"/>`;
    g2 += `<path d="${ring(r, k)}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.7)}"/>`;
    return g2;
  }
  // gable, hip and thatch: a ridge along each wing (a hip roof also runs lines from each corner to the ridge)
  let dd = '';
  for (const w of g.wings) {
    const r = ridgeOf(w), len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) || 1, ux = (r.b[0] - r.a[0]) / len, uy = (r.b[1] - r.a[1]) / len;
    const cut = roof === 'hip' ? Math.min(len / 2 - 0.05, r.short / 2) : 0, a: [number, number] = [r.a[0] + ux * cut, r.a[1] + uy * cut], bb: [number, number] = [r.b[0] - ux * cut, r.b[1] - uy * cut];
    dd += `M${M(a)}L${M(bb)}`;
    if (roof === 'hip') {
      // each corner runs to the nearer ridge end
      for (const c of r.corners) { const e = Math.hypot(c[0] - a[0], c[1] - a[1]) < Math.hypot(c[0] - bb[0], c[1] - bb[1]) ? a : bb; dd += `M${M(c)}L${M(e)}`; }
    }
  }
  g2 += ln(dd, roof === 'hip' ? sw * 0.7 : sw);
  if (roof === 'thatch') {
    const r = offsetRing(toP(g.outline), area2(g.outline) > 0 ? -0.25 : 0.25).flat();
    g2 += `<path d="${ring(r, k)}" fill="none" stroke="${p.ridge}" stroke-opacity="0.5" stroke-width="${n1(sw * 0.6)}" stroke-dasharray="${n1(0.15 * k)} ${n1(0.2 * k)}"/>`;
  }
  return g2;
}

// ---- walls ----------------------------------------------------------------------------------------------------------

function wallSvg(w: WallGeom, k: number, p: Palette, u: number, W: number, H: number, defs: string[]): string {
  const d = line(w.pts, k, w.closed), th = w.thickness * k, sw = Math.max(0.8, 1.1 * u), tone = p.wall[w.kind];
  const mid = `wall-gates-${w.index}`, cut = w.gates.map(g => `<rect x="${n1(-g.width * k / 2)}" y="${n1(-th * 2)}" width="${n1(g.width * k)}" height="${n1(th * 4)}" transform="translate(${n1(g.x * k)} ${n1(g.y * k)}) rotate(${n1(g.angle)})" fill="#000"/>`).join('');
  if (cut) defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${n1(W)}" height="${n1(H)}"><rect width="${n1(W)}" height="${n1(H)}" fill="#fff"/>${cut}</mask>`);
  const S = (width: number, color: string, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n1(width)}"${extra.includes('linecap') ? '' : ' stroke-linejoin="miter" stroke-linecap="butt"'}${extra}/>`;
  let body = '';
  const dots = (step: number, r: number, fill: string, edge: string) => {
    const pts = w.closed ? [...w.pts, w.pts[0], w.pts[1]] : w.pts;
    let s = '', carry = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const dx = pts[i + 2] - pts[i], dy = pts[i + 3] - pts[i + 1], len = Math.hypot(dx, dy);
      let t = carry;
      for (; t <= len; t += step) s += `<circle cx="${n1((pts[i] + (dx * t) / len) * k)}" cy="${n1((pts[i + 1] + (dy * t) / len) * k)}" r="${n1(r)}" fill="${fill}" stroke="${edge}" stroke-width="${n1(sw * 0.7)}"/>`;
      carry = t - len;
    }
    return s;
  };
  if (w.kind === 'curtain') body = S(th + 2 * sw, p.ink) + S(th, tone) + S(th * 0.28, p.ink, ` stroke-dasharray="${n1(th * 0.45)} ${n1(th * 0.35)}"`);
  else if (w.kind === 'stone') body = S(th + 2 * sw, p.ink) + S(th, tone);
  else if (w.kind === 'ruined') body = S(th + 2 * sw, p.ink, ` stroke-dasharray="${n1(k * 3)} ${n1(k * 1.2)} ${n1(k * 1.5)} ${n1(k * 0.9)}"`) + S(th, tone, ` stroke-dasharray="${n1(k * 3)} ${n1(k * 1.2)} ${n1(k * 1.5)} ${n1(k * 0.9)}"`);
  else if (w.kind === 'drystone') body = S(th + 2 * sw, p.ink) + S(th, p.ripples ? p.paper : tone) + S(th * 0.45, p.ink, ` stroke-dasharray="${n1(th * 0.3)} ${n1(th * 0.5)}" stroke-opacity="0.7"`);
  else if (w.kind === 'palisade') body = S(th * 0.5, p.wall.palisade) + dots(th * 0.95, th / 2, p.ripples ? p.paper : '#a07a50', p.ink);
  else if (w.kind === 'hedge') body = S(th, p.ripples ? p.paper : tone, ' stroke-linecap="round" stroke-linejoin="round"') + dots(th * 0.7, th * 0.52, p.ripples ? p.paper : tone, p.treeDark);
  else body = S(Math.max(sw, th * 0.6), tone) + dots(Math.max(1, 6 / Math.max(1, th / k)) * k * 0.25 + k, Math.max(sw, th * 0.7), tone, p.ink);
  let g = `<g${cut ? ` mask="url(#${mid})"` : ''}>${body}</g>`;
  // drawbridges, then towers, then the gates over the openings
  for (const gt of w.gates) if (gt.drawbridge > 0) {
    const a = (Math.atan2(gt.outward[1], gt.outward[0]) * 180) / Math.PI, len = gt.drawbridge * k, bw = gt.width * k;
    let planks = '';
    for (let x = len / 6; x < len; x += len / 6) planks += `M${n1(x)} ${n1(-bw / 2)}V${n1(bw / 2)}`;
    g = `<g transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(a)})"><rect x="0" y="${n1(-bw / 2)}" width="${n1(len)}" height="${n1(bw)}" fill="${p.fixture.fill}" stroke="${p.ink}" stroke-width="${n1(sw)}"/><path d="${planks}" stroke="${p.ink}" stroke-width="${n1(sw * 0.5)}"/></g>` + g;
  }
  for (const t of w.towers) {
    const r = (t.size * k) / 2;
    g += t.shape === 'square'
      ? `<g transform="translate(${n1(t.x * k)} ${n1(t.y * k)}) rotate(${n1(t.angle)})"><rect x="${n1(-r)}" y="${n1(-r)}" width="${n1(2 * r)}" height="${n1(2 * r)}" fill="${p.tower}" stroke="${p.ink}" stroke-width="${n1(sw * 1.3)}"/><rect x="${n1(-r * 0.7)}" y="${n1(-r * 0.7)}" width="${n1(1.4 * r)}" height="${n1(1.4 * r)}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.6)}"/></g>`
      : `<circle cx="${n1(t.x * k)}" cy="${n1(t.y * k)}" r="${n1(r)}" fill="${p.tower}" stroke="${p.ink}" stroke-width="${n1(sw * 1.3)}"/><circle cx="${n1(t.x * k)}" cy="${n1(t.y * k)}" r="${n1(r * 0.68)}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.6)}"/>`;
  }
  for (const gt of w.gates) {
    const gw = gt.width * k, depth = Math.max(th * 2.2, k * 1.2);
    let s = '';
    if (gt.kind === 'gatehouse') {
      s += `<rect x="${n1(-gw / 2 - th)}" y="${n1(-depth / 2)}" width="${n1(gw + 2 * th)}" height="${n1(depth)}" fill="${p.tower}" stroke="${p.ink}" stroke-width="${n1(sw * 1.2)}"/>`;
      s += `<rect x="${n1(-gw / 2)}" y="${n1(-depth / 2 - sw)}" width="${n1(gw)}" height="${n1(depth + 2 * sw)}" fill="${p.road.street.fill}"/>`;
      s += `<path d="M${n1(-gw / 2)} ${n1(-depth / 2)}V${n1(depth / 2)}M${n1(gw / 2)} ${n1(-depth / 2)}V${n1(depth / 2)}" stroke="${p.ink}" stroke-width="${n1(sw)}"/>`;
      const n = Math.max(3, Math.round(gt.width * 3));
      for (const y of [-depth * 0.25, depth * 0.25]) for (let i = 0; i < n; i++) s += `<circle cx="${n1(-gw / 2 + (gw * (i + 0.5)) / n)}" cy="${n1(y)}" r="${n1(Math.max(0.8, 0.07 * k))}" fill="${p.ink}"/>`;
    } else if (gt.kind === 'gate' || gt.kind === 'postern') {
      const leaf = (x: number, lw: number) => `<rect x="${n1(x)}" y="${n1(-th * 0.2)}" width="${n1(lw)}" height="${n1(th * 0.4)}" fill="${p.fixture.fill}" stroke="${p.ink}" stroke-width="${n1(sw)}"/>`;
      s += gt.kind === 'gate' ? leaf(-gw / 2, gw / 2) + leaf(0, gw / 2) : leaf(-gw / 2, gw);
      s += `<path d="M${n1(-gw / 2)} ${n1(-th * 0.6)}V${n1(th * 0.6)}M${n1(gw / 2)} ${n1(-th * 0.6)}V${n1(th * 0.6)}" stroke="${p.ink}" stroke-width="${n1(sw * 1.6)}"/>`;
    }
    if (s) g += `<g transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(gt.angle)})">${s}</g>`;
  }
  return `<g id="wall-${w.index}">${g}</g>`;
}

// ---- furniture (title, scale bar, compass, legend) -------------------------------------------------------------------

function scaleCells(width: number): number {
  const target = width / 5;
  for (const n of [1, 2, 4, 5, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100]) if (n >= target * 0.75) return n;
  return Math.max(1, Math.round(target));
}

interface FurnitureArgs { fr: Frame; k: number; u: number; p: Palette; on: Record<SettlementLayer, boolean>; title?: string; perCell: number; unit: string; legend: { name: string; swatch: (x: number, y: number, s: number) => string }[]; north: number; place: 'over' | 'outside' | 'auto'; side: 'bottom' | 'right'; covers: (b: Box) => boolean }

function furniture(a: FurnitureArgs): FurnitureLayout {
  const { fr, k, u, p } = a, pad = 12 * u, items: FurnitureItem[] = [];
  const box = (x: number, y: number, w: number, h: number) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${p.paper}" fill-opacity="0.94" stroke="${p.ink}" stroke-width="${n1(u)}"/>`;
  if (a.on.legend && a.legend.length) {
    const rh = 20 * u, fs = 11.5 * u, w = 170 * u, h = a.legend.length * rh + 12 * u;
    items.push({ id: 'legend', rank: 2, w, h, over: { x: fr.r - w - pad, y: fr.b - h - pad }, draw: (x, y) => {
      let g = box(x, y, w, h);
      a.legend.forEach((e, i) => { const sy = y + 6 * u + i * rh + rh / 2; g += a.legend[i].swatch(x + 18 * u, sy, 16 * u); g += `<text x="${n1(x + 34 * u)}" y="${n1(sy + fs * 0.35)}" font-size="${n1(fs)}" fill="${p.ink}">${esc(e.name)}</text>`; });
      return `<g id="legend">${g}</g>`;
    } });
  }
  if (a.on.scale) {
    const n = scaleCells(fr.w / k), len = n * k, fs = 11 * u, seg = Math.min(4, n), w = len + 34 * u, h = 40 * u;
    items.push({ id: 'scale', rank: 1, w, h, over: { x: fr.x + pad, y: fr.b - pad - h }, draw: (bx, by) => {
      const x = bx + 17 * u, y = by + 18 * u;
      let g = box(bx, by, w, h);
      for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + (len / seg) * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? p.paper : p.ink}" stroke="${p.ink}" stroke-width="${n1(0.8 * u)}"/>`;
      g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${p.ink}" text-anchor="middle">0</text>`;
      g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${p.ink}" text-anchor="middle">${n * a.perCell} ${esc(a.unit)}</text>`;
      g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${p.ink}" text-anchor="middle">1 square = ${a.perCell} ${esc(a.unit)}</text>`;
      return `<g id="scale">${g}</g>`;
    } });
  }
  if (a.on.compass) items.push({ id: 'compass', rank: 3, w: 44 * u, h: 56 * u, over: { x: fr.r - pad - 46 * u, y: fr.y + pad }, draw: (x, y) => {
    const c = compassSvg(x + 22 * u, y + 34 * u, 18 * u, u, { ink: p.ink, paper: p.paper });
    return a.north ? `<g transform="rotate(${n1(a.north)} ${n1(x + 22 * u)} ${n1(y + 34 * u)})">${c}</g>` : c;
  } });
  if (a.on.title && a.title) {
    // the title keeps clear of the compass: a long one is set smaller
    const room = fr.w - 2 * pad - (a.on.compass ? 54 * u : 0), fs = Math.min(22 * u, Math.max(9 * u, (room - 30 * u) / (a.title.length * 0.6))), w = Math.min(room, Math.max(120 * u, a.title.length * fs * 0.6 + 30 * u)), h = fs * 1.7, title = a.title;
    items.push({ id: 'title', rank: 0, w, h, over: { x: fr.x + pad, y: fr.y + pad }, draw: (x, y) => `<g id="title">${box(x, y, w, h)}<text x="${n1(x + w / 2)}" y="${n1(y + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.05)}" text-anchor="middle" fill="${p.ink}">${esc(title)}</text></g>` });
  }
  return placeFurniture(items, fr, a.place, a.side, pad, a.covers);
}

function finish(fr: Frame, furn: FurnitureLayout, defs: string[], parts: string[], p: Palette, u: number, unit?: SizeUnit): string {
  const drawn = furn.placed.map(q => q.item.draw(q.x, q.y)).join('');
  const out = { ...fr, w: fr.w + furn.band.right, h: fr.h + furn.band.bottom, r: fr.r + furn.band.right, b: fr.b + furn.band.bottom };
  const band = furn.band.right || furn.band.bottom ? `<rect x="${n1(out.x)}" y="${n1(out.y)}" width="${n1(out.w)}" height="${n1(out.h)}" fill="${p.paper}"/>` : '';
  const frame = band ? `<rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}" fill="none" stroke="${p.ink}" stroke-width="${n1(1.5 * u)}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(out, unit)} font-family="${FONT}"><defs>${defs.join('')}<clipPath id="map-clip"><rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}"/></clipPath></defs>${band}<g clip-path="url(#map-clip)">${parts.join('')}${band ? '' : drawn}</g>${frame}${band ? drawn : ''}</svg>`;
}

const LABEL_PX = { area: 22, name: 15, note: 12, street: 12 } as const;
function labelSize(l: SettlementLabel, u: number, pageScale?: number): number {
  const pt = { area: PAGE_PT.dungeon.area, name: PAGE_PT.dungeon.name, note: PAGE_PT.dungeon.note, street: PAGE_PT.dungeon.note }[l.kind];
  return (pageScale ? pointsToPx(pt, pageScale) : LABEL_PX[l.kind] * u) * (l.size ?? 1);
}
const textSizes = (u: number, pageScale?: number) => ({ number: pageScale ? pointsToPx(PAGE_PT.dungeon.number, pageScale) : 15 * u, name: pageScale ? pointsToPx(PAGE_PT.dungeon.room, pageScale) : 12.5 * u });

/** A label's text and look by kind. */
function labelSvg(l: SettlementLabel, k: number, u: number, p: Palette, pageScale?: number): string {
  const fs = labelSize(l, u, pageScale), text = l.kind === 'area' ? l.text.toUpperCase() : l.text;
  const attrs = l.kind === 'area' ? `font-weight="700" letter-spacing="${n1(fs * 0.16)}"` : l.kind === 'name' ? 'font-weight="700"' : 'font-style="italic"';
  const t = haloText(text, l.x * k, l.y * k + fs * 0.35, fs, p.ink, { halo: p.halo }, attrs);
  const out = l.angle ? `<g transform="rotate(${n1(l.angle)} ${n1(l.x * k)} ${n1(l.y * k)})">${t}</g>` : t;
  return l.href ? `<a href="${esc(l.href)}">${out}</a>` : out;
}

// ---- views ----------------------------------------------------------------------------------------------------------

/** The plan sheet for a building: its size in plan cells, with the margin. */
export function planSheet(spec: SettlementSpec, b: Building): { cols: number; rows: number; margin: number } {
  const f = planFactor(spec);
  return { cols: Math.ceil(b.w * f - 1e-9) + 2 * PLAN_MARGIN, rows: Math.ceil(b.h * f - 1e-9) + 2 * PLAN_MARGIN, margin: PLAN_MARGIN };
}

/** The floor a plan shows: the one at `level`, else the ground floor; and the building. Throws when there is no such building. */
export function planTarget(spec: SettlementSpec, id: string | undefined, level?: number): { building: Building; floor: Floor | undefined } {
  const building = id ? spec.buildings.find(b => b.id === id) : spec.buildings.find(b => b.floors?.length);
  if (!building) throw new Error(id ? `no building ${id}` : 'no building with floors (give --building)');
  const floor = level !== undefined ? floorAt(building, level) : groundFloor(building);
  if (level !== undefined && !floor) throw new Error(`building ${building.id} has no floor at level ${level} (it has ${(building.floors ?? []).map(f => f.level).join(', ') || 'none'})`);
  return { building, floor };
}

function legendFor(spec: SettlementSpec, p: Palette, view: SettlementView, floor?: Floor): FurnitureArgs['legend'] {
  const out: FurnitureArgs['legend'] = [];
  if (view === 'plan') {
    for (const kind of [...new Set((floor?.fixtures ?? []).map(f => f.kind))]) {
      const fx = FIXTURES[kind];
      if (!fx) continue;
      out.push({ name: fx.name.split(' (')[0], swatch: (x, y, s) => { const r = Math.max(fx.ft[0], fx.ft[1]); return `<g transform="translate(${n1(x)} ${n1(y)})">${tok(fx.draw((fx.ft[0] / r) * s, (fx.ft[1] / r) * s, Math.max(0.6, s / 16)), p)}</g>`; } });
    }
    return out;
  }
  const sw = (x: number, y: number, s: number, fill: string, edge: string, extra = '') => `<rect x="${n1(x - s / 2)}" y="${n1(y - s * 0.35)}" width="${n1(s)}" height="${n1(s * 0.7)}" fill="${fill}" stroke="${edge}" stroke-width="1"${extra}/>`;
  const name = (s: string) => s[0].toUpperCase() + s.slice(1);
  for (const kind of [...new Set(spec.roads.map(r => r.kind))]) { const st = p.road[kind]; out.push({ name: `${name(kind)}`, swatch: (x, y, s) => (kind === 'path' ? `<path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${st.edge}" stroke-width="1.5" stroke-dasharray="3 2"/>` : sw(x, y, s, st.fill === 'none' ? p.paper : st.fill, st.edge)) }); }
  for (const kind of [...new Set(spec.walls.map(w => w.kind))]) out.push({ name: `${name(kind)} wall`, swatch: (x, y, s) => `<path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${p.ink}" stroke-width="${n1(s * 0.4)}"/><path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${p.wall[kind]}" stroke-width="${n1(s * 0.3)}"/>` });
  for (const kind of [...new Set(spec.water.map(w => w.kind))]) out.push({ name: name(kind), swatch: (x, y, s) => sw(x, y, s, p.water, p.waterEdge) });
  for (const kind of [...new Set(spec.areas.map(a => a.kind))]) out.push({ name: name(kind), swatch: (x, y, s) => sw(x, y, s, p.area[kind].fill, p.ink, ' stroke-opacity="0.4"') });
  return out;
}

function siteSvg(spec: SettlementSpec, o: RenderSettlementOptions): string {
  const k = o.ppu ?? 24, W = spec.cols * k, H = spec.rows * k, u = o.pageScale ? pageUnit(o.pageScale) : k / 24, p = PALETTES[o.theme ?? 'color'];
  const l = o.layout ?? layoutSettlement(spec), on = settlementLayersFor(spec, 'site', o.layers), mode = o.buildings ?? 'roofs', fr = frameOf(o.crop, spec.cols, spec.rows, k);
  const parts: string[] = [], defs: string[] = [], per = spec.scale.perCell, sw = Math.max(0.6, 0.9 * u), ink = patternInk(o.theme ?? 'color');
  const pat = new Set<string>(), usePat = (name: string, cells = 1) => { const id = `p-${name}`; if (!pat.has(id)) { pat.add(id); defs.push(patternDef(id, name, k, ink, cells)); } return `url(#${id})`; };

  if (on.ground) parts.push(`<rect id="ground" width="${n1(W)}" height="${n1(H)}" fill="${p.ground[spec.ground]}"/>`);
  if (on.underlay && spec.underlay && o.underlay) parts.push(underlaySvg(spec, o.underlay.map, k, o.underlay.field));

  if (on.areas && spec.areas.length) {
    let g = '';
    for (const a of spec.areas) {
      const st = p.area[a.kind], d = ring(a.points, k);
      g += `<path d="${d}" fill="${st.fill}"${st.edge ? ` stroke="${st.edge}" stroke-width="${n1(sw * 1.4)}"${st.dash ? ` stroke-dasharray="${n1(k * 0.5)} ${n1(k * 0.25)}"` : ''}` : ''}/>`;
      if (st.pattern) g += `<path d="${d}" fill="${usePat(st.pattern, a.kind === 'field' ? 1.5 : 1)}"/>`;
      if (p.ripples && !st.edge) g += `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.7)}" stroke-opacity="0.6"/>`;
    }
    parts.push(`<g id="areas">${g}</g>`);
  }

  if (on.water && l.water.length) {
    const edge = l.water.map(w => (w.area ? `<path d="${ring(w.pts, k)}" fill="${p.waterEdge}" stroke="${p.waterEdge}" stroke-width="${n1(sw * 2.4)}" stroke-linejoin="round"/>` : `<path d="${line(w.pts, k, w.closed)}" fill="none" stroke="${p.waterEdge}" stroke-width="${n1(w.width * k + sw * 2.4)}" stroke-linecap="${w.kind === 'canal' || w.kind === 'moat' ? 'butt' : 'round'}" stroke-linejoin="round"/>`)).join('');
    const fill = (paint: string) => l.water.map(w => (w.area ? `<path d="${ring(w.pts, k)}" fill="${paint}"/>` : `<path d="${line(w.pts, k, w.closed)}" fill="none" stroke="${paint}" stroke-width="${n1(w.width * k)}" stroke-linecap="${w.kind === 'canal' || w.kind === 'moat' ? 'butt' : 'round'}" stroke-linejoin="round"/>`)).join('');
    parts.push(`<g id="water">${edge}${fill(p.water)}${p.ripples ? fill(usePat('ripples', 1.5)) : ''}</g>`);
  }

  if (on.roads && l.roads.length) {
    const sorted = [...l.roads].sort((a, b) => b.width - a.width);
    let edges = '', fills = '';
    for (const r of sorted) {
      const st = p.road[r.kind as keyof Palette['road']], d = line(r.pts, k), w = r.width * k;
      if (r.kind === 'path') { fills += `<path d="${d}" fill="none" stroke="${st.edge}" stroke-width="${n1(Math.max(sw, w * 0.5))}" stroke-dasharray="${n1(w * 1.2)} ${n1(w * 0.8)}" stroke-linecap="round" stroke-linejoin="round"/>`; continue; }
      const cap = st.ruts ? 'butt' : 'round';
      edges += `<path d="${d}" fill="none" stroke="${st.edge}" stroke-width="${n1(w + (st.ruts ? 0 : sw * 2.2))}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
      fills += `<path d="${d}" fill="none" stroke="${st.ruts ? p.ground[spec.ground] : st.fill}" stroke-width="${n1(st.ruts ? w * 0.62 : w)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
    }
    parts.push(`<g id="roads">${edges}${fills}</g>`);
  }

  if (on.bridges && l.bridges.length) {
    let g = '';
    for (const b of l.bridges) {
      const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) * k, a = (Math.atan2(b.y1 - b.y0, b.x1 - b.x0) * 180) / Math.PI, bw = b.width * k;
      g += `<g transform="translate(${n1(b.x0 * k)} ${n1(b.y0 * k)}) rotate(${n1(a)})"><rect x="0" y="${n1(-bw / 2)}" width="${n1(len)}" height="${n1(bw)}" fill="${p.fixture.stone}" stroke="${p.ink}" stroke-width="${n1(sw)}"/><path d="M0 ${n1(-bw / 2 + sw * 1.5)}H${n1(len)}M0 ${n1(bw / 2 - sw * 1.5)}H${n1(len)}" stroke="${p.ink}" stroke-width="${n1(sw * 1.6)}"/></g>`;
    }
    parts.push(`<g id="bridges">${g}</g>`);
  }

  if (on.walls && l.walls.length) parts.push(`<g id="walls">${l.walls.map(w => wallSvg(w, k, p, u, W, H, defs)).join('')}</g>`);

  const txt = textSizes(u, o.pageScale);
  if (on.buildings && l.buildings.length) {
    let g = '';
    for (const bg of l.buildings) {
      const b = bg.building, fl = mode === 'interior' ? groundFloor(b) : undefined;
      if (fl) {
        const f = planFactor(spec), kp = k / f, lay = layoutFloor(spec, b, fl), [cx, cy] = [bg.cx * k, bg.cy * k];
        const drawn = floorSvg(lay, kp, p, u * 0.8, { grid: false, numbers: false, labels: false, fixtures: true, doors: true, windows: true, walls: true, floor: true }, `clip-b-${bg.index}`, 1, txt);
        g += `<g transform="translate(${n1(cx)} ${n1(cy)}) rotate(${n1(b.angle ?? 0)}) translate(${n1((-b.w / 2) * k)} ${n1((-b.h / 2) * k)})">${['floor', 'fixtures', 'walls', 'doors', 'windows'].map(x => drawn[x] ?? '').join('')}</g>`;
      } else if (mode === 'roofs') g += roofSvg(bg, k, p, u);
      else g += `<path d="${ring(bg.outline, k)}" fill="${p.floor}" stroke="${p.outerWall}" stroke-width="${n1(Math.max(1.5 * u, 0.25 * k))}" stroke-linejoin="miter"/>`;
    }
    parts.push(`<g id="buildings">${g}</g>`);
  }

  if (on.trees && (spec.trees.length || l.areaTrees.length)) {
    const all = [...l.areaTrees, ...spec.trees];
    parts.push(`<g id="trees">${all.map((t, i) => treeSvg(t, k, p, u, per, idSeed(`${t.x.toFixed(2)},${t.y.toFixed(2)}`) ^ i)).join('')}</g>`);
  }

  if (on.props && spec.props.length) parts.push(`<g id="props">${spec.props.map(f => { const [w, h] = fixtureSize(f, per); return fixtureSvg({ kind: f.kind, x: f.x, y: f.y, w, h, angle: f.angle ?? 0 }, k, p, sw); }).join('')}</g>`);

  if (on.grid && spec.grid.show) {
    const s = spec.grid.size, ln = (step: number) => { let d = ''; for (let x = 0; x <= spec.cols + 1e-9; x += step) d += `M${n1(x * k)} 0V${n1(H)}`; for (let y = 0; y <= spec.rows + 1e-9; y += step) d += `M0 ${n1(y * k)}H${n1(W)}`; return d; };
    let g = '';
    if (spec.grid.sub && s > 1) g += `<path d="${ln(1)}" stroke="${p.grid}" stroke-opacity="${p.gridOpacity * 0.5}" stroke-width="${n1(0.6 * u)}"/>`;
    g += `<path d="${ln(s)}" stroke="${p.grid}" stroke-opacity="${p.gridOpacity}" stroke-width="${n1(0.9 * u)}"/>`;
    parts.push(`<g id="grid" fill="none">${g}</g>`);
  }

  if (on.symbols && spec.overlay.symbols.length)
    parts.push(`<g id="symbols">${spec.overlay.symbols.map(s => { const sym = SYMBOLS[s.kind] ?? DUNGEON_SYMBOLS.trap; return `<g transform="translate(${n1(s.x * k)} ${n1(s.y * k)})${s.angle ? ` rotate(${n1(s.angle)})` : ''} scale(${((k / 20) * (s.scale ?? 1) * 1.5).toFixed(3)})">${sym.svg.replaceAll('{ink}', p.ink).replaceAll('{fill}', p.fixture.paper)}</g>`; }).join('')}</g>`);

  if (on.numbers || on.labels) {
    let nums = '', names = '';
    for (const bg of l.buildings) {
      const x = bg.cx * k, y = bg.cy * k, has = on.numbers && bg.number !== undefined, b = bg.building;
      if (has) nums += b.href ? `<a href="${esc(b.href)}">${badge(String(bg.number), x, y, txt.number, p)}</a>` : badge(String(bg.number), x, y, txt.number, p);
      if (on.labels && b.label) names += haloText(b.label, x, y + (has ? txt.number * 1.6 : txt.name * 0.3), txt.name, p.ink, { halo: p.halo }, 'font-weight="700"');
    }
    if (on.labels) {
      for (const a of spec.areas) if (a.label) { const xs = a.points.filter((_, i) => i % 2 === 0), ys = a.points.filter((_, i) => i % 2 === 1); names += haloText(a.label, ((Math.min(...xs) + Math.max(...xs)) / 2) * k, ((Math.min(...ys) + Math.max(...ys)) / 2) * k, txt.name, p.ink, { halo: p.halo }, 'font-style="italic"'); }
      for (const r of l.roads) {
        const label = spec.roads[r.index].label;
        if (!label || r.pts.length < 4) continue;
        const i = Math.floor((r.pts.length / 2 - 1) / 2) * 2, x0 = r.pts[i], y0 = r.pts[i + 1], x1 = r.pts[i + 2], y1 = r.pts[i + 3];
        let a = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
        if (a > 90) a -= 180; else if (a < -90) a += 180;
        const mx = ((x0 + x1) / 2) * k, my = ((y0 + y1) / 2) * k;
        names += `<g transform="rotate(${n1(a)} ${n1(mx)} ${n1(my)})">${haloText(label, mx, my + txt.name * 0.35, txt.name * 0.9, p.ink, { halo: p.halo }, 'font-style="italic"')}</g>`;
      }
    }
    if (nums) parts.push(`<g id="numbers">${nums}</g>`);
    if (names) parts.push(`<g id="names">${names}</g>`);
  }
  if (on.labels && spec.overlay.labels.length) parts.push(`<g id="labels">${spec.overlay.labels.map(lb => labelSvg(lb, k, u, p, o.pageScale)).join('')}</g>`);

  const boxes = l.buildings.map(bg => { const xs = bg.outline.filter((_, i) => i % 2 === 0), ys = bg.outline.filter((_, i) => i % 2 === 1); return { x: Math.min(...xs) * k, y: Math.min(...ys) * k, w: (Math.max(...xs) - Math.min(...xs)) * k, h: (Math.max(...ys) - Math.min(...ys)) * k }; });
  const f = spec.furniture ?? { place: 'over' as const };
  const furn = furniture({ fr, k, u, p, on, title: spec.title, perCell: per, unit: spec.scale.unit, legend: legendFor(spec, p, 'site'), north: 0, place: f.place, side: f.side ?? 'bottom', covers: b => boxes.some(x => overlaps(x, b)) });
  return finish(fr, furn, defs, parts, p, u, o.unit);
}

function planSvg(spec: SettlementSpec, o: RenderSettlementOptions): string {
  const { building: b, floor } = planTarget(spec, o.building, o.floor), sheet = planSheet(spec, b);
  const k = o.ppu ?? 40, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, p = PALETTES[o.theme ?? 'color'], on = settlementLayersFor(spec, 'plan', o.layers);
  const fr = frameOf(o.crop, sheet.cols, sheet.rows, k), W = sheet.cols * k, H = sheet.rows * k, M = sheet.margin * k;
  const parts: string[] = [], defs: string[] = [], txt = textSizes(u, o.pageScale);
  if (on.ground) parts.push(`<rect id="ground" width="${n1(W)}" height="${n1(H)}" fill="${p.ground[spec.ground]}"/>`);
  const empty: Floor = { level: 0, rooms: [] }, lay = layoutFloor(spec, b, floor ?? empty);
  const drawn = floorSvg(lay, k, p, u, { grid: on.grid, numbers: on.numbers, labels: on.labels, fixtures: on.fixtures, doors: on.doors, windows: on.windows, walls: on.walls, floor: on.floor }, 'plan-clip', 1, txt);
  for (const layer of ['floor', 'grid', 'fixtures', 'walls', 'doors', 'windows', 'numbers', 'labels'] as const) if (drawn[layer]) parts.push(`<g id="${layer}" transform="translate(${n1(M)} ${n1(M)})">${drawn[layer]}</g>`);
  const title = `${b.label ?? b.kind[0].toUpperCase() + b.kind.slice(1)} — ${floor ? floorName(floor) : 'no floors yet'}`;
  const f = spec.furniture ?? { place: 'auto' as const };
  const fb = { x: M, y: M, w: lay.w * k, h: lay.h * k };
  const furn = furniture({ fr, k, u, p, on, title, perCell: spec.interior.perCell, unit: spec.scale.unit, legend: legendFor(spec, p, 'plan', floor), north: -(b.angle ?? 0), place: f.place, side: f.side ?? 'bottom', covers: x => overlaps(x, fb) });
  return finish(fr, furn, defs, parts, p, u, o.unit);
}

/** The settlement as SVG: the site, or one building's floor (`view: 'plan'`). */
export function renderSettlementSvg(spec: SettlementSpec, o: RenderSettlementOptions = {}): string {
  return (o.view ?? 'site') === 'plan' ? planSvg(spec, o) : siteSvg(spec, o);
}

/** The render's size in pixels (the sheet, or the crop, and any furniture band). */
export function settlementRenderSize(spec: SettlementSpec, o: RenderSettlementOptions = {}): { width: number; height: number } {
  const svg = renderSettlementSvg(spec, { ...o, unit: 'px', layers: { ...o.layers, underlay: false } }), m = svg.match(/width="([\d.]+)[a-z]*" height="([\d.]+)/);
  return { width: m ? +m[1] : 0, height: m ? +m[2] : 0 };
}
