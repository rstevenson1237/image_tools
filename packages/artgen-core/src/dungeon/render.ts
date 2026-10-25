/**
 * Dungeon → SVG, in black and white. Layers in a fixed order, each its own `<g id="…">`: rock (hatching along the
 * walls), floors (walls and white floor), grid, doors, symbols, numbers, labels, then the title, scale bar and compass.
 * Any layer can be turned off, so the same file gives the bare plan or the keyed map once labels are added.
 *
 * Walls come from stroking: every floor shape is stroked thick in black, then every floor shape is filled white on
 * top, so where a corridor runs into a room (or two rooms overlap) the walls between them disappear on their own.
 */
import { rng } from '../lib/rng.ts';
import { compassSvg, esc, FONT, haloText, n1 } from '../lib/svgdraw.ts';
import { pathData } from '../lib/trace.ts';
import { frameOf, sizeAttrs, type Crop, type SizeUnit } from '../lib/view.ts';
import type { MapField } from '../map/generate.ts';
import type { MapSpec } from '../map/spec.ts';
import { PAGE_PT, PAGE_SYMBOL_MM, pageUnit, placeLabels, pointsToPx, textBox, type Box, type PlaceLabel } from '../lib/page.ts';
import { layoutDungeon, type DoorGeom, type DungeonLayout } from './layout.ts';
import type { DungeonLabel, DungeonSpec, Room } from './spec.ts';
import { SYMBOLS } from './symbols.ts';
import { area2 } from './geom.ts';
import { coversContent, placeFurniture, type FurnitureItem, type FurnitureLayout } from './furniture.ts';
import { underlaySvg } from './underlay.ts';
import { layoutWalls } from './walls.ts';

export const DUNGEON_LAYERS = ['underlay', 'rock', 'floors', 'buildings', 'enclosure', 'grid', 'doors', 'symbols', 'cellars', 'numbers', 'labels', 'legend', 'title', 'scale', 'compass'] as const;
export type DungeonLayer = (typeof DUNGEON_LAYERS)[number];

const INK = '#000000', PAPER = '#ffffff', TH = { ink: INK, paper: PAPER, halo: PAPER };

export interface RenderDungeonOptions {
  /** Pixels per cell (default 40). */
  ppu?: number;
  /** Layers to turn on or off; unset layers follow the file (grid, numbers, scale bar, compass, title, hatching). */
  layers?: Partial<Record<DungeonLayer, boolean>>;
  /** A layout already made from this spec. */
  layout?: DungeonLayout;
  /** A window on the sheet, in cells: the render is the full sheet's, cut to it, with the furniture inside the window. */
  crop?: Crop;
  /** The unit of the SVG's width and height (default px). */
  unit?: SizeUnit;
  /** The map named by the file's `underlay` (read by the caller: the engine reads no files). Without it the underlay is not drawn. */
  underlay?: { map: MapSpec; field?: MapField };
  /**
   * Output pixels per millimetre on the page (`--fit` sets it, `--page-scale` gives it). Label sizes, symbol sizes and
   * stroke widths are then set in points and millimetres on the page, and labels are kept off one another. Unset: sizes
   * follow `ppu`.
   */
  pageScale?: number;
}

/** A tone for the roof of a `building`, and the line along its ridge. */
const ROOF = '#dcdcdc', RIDGE = '#8c8c8c';

/** What a room is, whatever the file leaves out. */
const fillOf = (r: Room) => r.fill ?? 'floor';

/** A label that found no free spot on the page, with its index in `overlay.labels`. */
export interface UnplacedLabel { index: number; text: string }

const BASE_PX = { area: 24, name: 15, note: 12 } as const;

/** A label's font size in pixels: its kind's default (points on the page with a page scale, else relative to `u`) times `size`. */
function labelSize(l: DungeonLabel, u: number, pageScale?: number): number {
  return (pageScale ? pointsToPx(PAGE_PT.dungeon[l.kind], pageScale) : BASE_PX[l.kind] * u) * (l.size ?? 1);
}

/** The room number and name sizes in pixels. */
const numberSize = (u: number, pageScale?: number) => (pageScale ? pointsToPx(PAGE_PT.dungeon.number, pageScale) : 19 * u);
const nameSize = (u: number, pageScale?: number) => (pageScale ? pointsToPx(PAGE_PT.dungeon.room, pageScale) : 15 * u);

/**
 * Where each overlay label is drawn, and the labels that could not be kept clear of the others or of a symbol or a room's
 * badge and name (only with a page scale, when the labels are moved).
 */
export function dungeonLabelLayout(spec: DungeonSpec, k: number, pageScale?: number, l: DungeonLayout = layoutDungeon(spec), numbers = spec.numbers): { at: { x: number; y: number }[]; unplaced: UnplacedLabel[] } {
  const raw = spec.overlay.labels.map(lb => ({ x: lb.x * k, y: lb.y * k }));
  if (!pageScale) return { at: raw, unplaced: [] };
  const u = pageUnit(pageScale), obstacles: Box[] = spec.overlay.symbols.map(s => { const z = PAGE_SYMBOL_MM * pageScale * (s.scale ?? 1); return { x: s.x * k - z / 2, y: s.y * k - z / 2, w: z, h: z }; });
  for (const g of l.rooms) {
    const x = g.cx * k, y = g.cy * k, fs = numberSize(u, pageScale), badge = numbers && g.number !== undefined;
    if (badge) { const txt = String(g.number), bh = fs * 1.45, bw = Math.max(bh, txt.length * fs * 0.62 + fs * 0.7); obstacles.push({ x: x - bw / 2, y: y - bh / 2, w: bw, h: bh }); }
    if (g.room.label) obstacles.push(textBox(g.room.label, x, y + (badge ? fs * 1.6 : fs * 0.3), nameSize(u, pageScale), { bold: true }));
  }
  const items: PlaceLabel[] = spec.overlay.labels.map(lb => {
    const size = labelSize(lb, u, pageScale), text = lb.kind === 'area' ? lb.text.toUpperCase() : lb.text;
    return { x: lb.x * k, y: lb.y * k, box: textBox(text, lb.x * k, lb.y * k + size * 0.35, size, { bold: lb.kind !== 'note', spacing: lb.kind === 'area' ? size * 0.16 : 0 }), clear: 0 };
  });
  const placed = placeLabels(items, obstacles, { x: 0, y: 0, w: spec.cols * k, h: spec.rows * k }, pageScale * 0.3);
  return { at: placed.map(p => ({ x: p.x, y: p.y })), unplaced: placed.flatMap((p, index) => (p.placed ? [] : [{ index, text: spec.overlay.labels[index].text }])) };
}

/** The legend's name for a symbol: its name up to the first bracket. */
export const LEGEND_NAMES = (kind: string): string => (SYMBOLS[kind] ?? SYMBOLS.trap).name.split(' (')[0];

/** Which layers render: everything on, the optional ones as the file says, then the caller's overrides. */
export function dungeonLayersFor(spec: DungeonSpec, over: Partial<Record<DungeonLayer, boolean>> = {}): Record<DungeonLayer, boolean> {
  const on = Object.fromEntries(DUNGEON_LAYERS.map(l => [l, true])) as Record<DungeonLayer, boolean>;
  on.rock = spec.style.hatch !== 'none'; on.underlay = !!spec.underlay; on.enclosure = !!spec.walls?.length; on.legend = !!spec.legend; on.grid = spec.grid.show; on.numbers = spec.numbers;
  on.scale = spec.scaleBar; on.compass = spec.compass; on.title = !!spec.title;
  return { ...on, ...over };
}

/**
 * Rock hatching: clusters of three short parallel strokes at random angles (the classic hand-hatched look), in a
 * seamless tile `cells` wide. Fixed seed, so every render of every map hatches the same way.
 */
function hatchPattern(k: number, cells = 4): string {
  const T = cells * k, r = rng(7), step = 0.5 * k, L = 0.42 * k, gap = 0.11 * k, sw = Math.max(0.8, 0.045 * k);
  let d = '';
  for (let gy = 0; gy < T / step; gy++) for (let gx = 0; gx < T / step; gx++) {
    const cx = (gx + 0.5 + (r() - 0.5) * 0.5) * step, cy = (gy + 0.5 + (r() - 0.5) * 0.5) * step, a = r() * Math.PI;
    const dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2, px = -Math.sin(a) * gap, py = Math.cos(a) * gap;
    for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {
      const x = cx + ox, y = cy + oy;
      if (x < -L || y < -L || x > T + L || y > T + L) continue;
      for (const s of [-1, 0, 1]) d += `M${n1(x - dx + px * s)} ${n1(y - dy + py * s)}L${n1(x + dx + px * s)} ${n1(y + dy + py * s)}`;
    }
  }
  return `<pattern id="hatch" patternUnits="userSpaceOnUse" width="${n1(T)}" height="${n1(T)}"><path d="${d}" stroke="${INK}" stroke-width="${n1(sw)}" stroke-linecap="round"/></pattern>`;
}

function doorSvg(dr: DoorGeom, k: number, t: number, u: number): string {
  const W = dr.width * k, d = Math.max(t * 1.5, 0.28 * k), hw = W / 2, sw = n1(Math.max(1, 1.4 * u));
  const rect = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="${fill}"${fill === PAPER ? ` stroke="${INK}" stroke-width="${sw}"` : ''}/>`;
  let g = '';
  if (dr.kind === 'door') g = rect(-d / 2, -hw, d, W, PAPER);
  else if (dr.kind === 'locked') g = rect(-d / 2, -hw, d, W, PAPER) + `<path d="M${n1(-d / 2)} 0H${n1(d / 2)}" stroke="${INK}" stroke-width="${n1(Math.max(2, d * 0.35))}"/>`;
  else if (dr.kind === 'secret') g = rect(-t / 2 - 0.5, -hw - 0.5, t + 1, W + 1, INK);
  else if (dr.kind === 'portcullis') {
    const n = Math.max(3, Math.round(dr.width * 4));
    for (let i = 0; i < n; i++) g += `<circle cy="${n1(-hw + (W * (i + 0.5)) / n)}" r="${n1(Math.max(1.2, 0.06 * k))}" fill="${INK}"/>`;
  } else if (dr.kind === 'arch') g = rect(-d / 2, -hw - d * 0.25, d, d * 0.6, INK) + rect(-d / 2, hw - d * 0.35, d, d * 0.6, INK);
  // stand on the wall: the outline is the floor's edge and the wall is t thick outside it
  const ox = dr.x * k + Math.cos((dr.angle * Math.PI) / 180) * t / 2, oy = dr.y * k + Math.sin((dr.angle * Math.PI) / 180) * t / 2;
  let out = `<g transform="translate(${n1(ox)} ${n1(oy)}) rotate(${n1(dr.angle)})">${g}</g>`;
  if (dr.kind === 'secret') {
    const fs = Math.max(10, 0.5 * k);
    out += haloText('S', ox, oy + fs * 0.35, fs, INK, TH, 'font-weight="700"');
  }
  return out;
}

/** A ring turned clockwise on screen (the way `roomOutline` draws a rectangle). */
function clockwise(p: number[]): number[] {
  if (area2(p) >= 0) return p;
  const out: number[] = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
}

/** Drawing wrapped in a link when there is one (the PNG ignores it; an SVG viewer follows it). */
export const linked = (href: string | undefined, svg: string): string => (href ? `<a href="${esc(href)}">${svg}</a>` : svg);

/** A round number of cells for the scale bar, about a fifth of the map wide. */
function scaleCells(width: number): number {
  const target = width / 5;
  for (const n of [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40]) if (n >= target * 0.75) return n;
  return Math.max(1, Math.round(target));
}

/** The title, scale bar, compass and legend as furniture items, and where each goes (see `furniture.ts`). */
export function dungeonFurniture(spec: DungeonSpec, o: RenderDungeonOptions = {}, l: DungeonLayout = o.layout ?? layoutDungeon(spec), on = dungeonLayersFor(spec, o.layers)): FurnitureLayout {
  const k = o.ppu ?? 40, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, fr = frameOf(o.crop, spec.cols, spec.rows, k), pad = 12 * u;
  const box = (x: number, y: number, w: number, h: number) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(u)}"/>`;
  const items: FurnitureItem[] = [];

  if (on.title && spec.title) {
    const fs = 24 * u, w = Math.max(120 * u, spec.title.length * fs * 0.62 + 30 * u), h = fs * 1.7, title = spec.title;
    items.push({ id: 'title', w, h, over: { x: fr.x + pad, y: fr.y + pad }, draw: (x, y) => `<g id="title">${box(x, y, w, h)}<text x="${n1(x + w / 2)}" y="${n1(y + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.06)}" text-anchor="middle" fill="${INK}">${esc(title)}</text></g>` });
  }

  if (on.scale) {
    const n = scaleCells(fr.w / k), len = n * k, fs = 11 * u, seg = Math.min(4, n), w = len + 34 * u, h = 40 * u;
    items.push({
      id: 'scale', w, h, over: { x: fr.x + pad, y: fr.b - pad - 38 * u },
      draw: (bx, by) => {
        const x = bx + 8 * u, y = by + 18 * u;
        let g = box(bx, by, w, h);
        for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + (len / seg) * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? PAPER : INK}" stroke="${INK}" stroke-width="${n1(0.8 * u)}"/>`;
        g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${INK}" text-anchor="middle">0</text>`;
        g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${INK}" text-anchor="middle">${n * spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
        g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${INK}" text-anchor="middle">1 square = ${spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
        return `<g id="scale">${g}</g>`;
      },
    });
  }

  if (on.legend) {
    const kinds = [...new Set(spec.overlay.symbols.map(s => s.kind))];
    if (kinds.length) {
      const rh = 22 * u, fs = 12 * u, w = 190 * u, h = kinds.length * rh + 12 * u;
      items.push({
        id: 'legend', w, h, over: { x: fr.r - w - pad, y: fr.b - h - pad },
        draw: (x, y) => {
          let g = box(x, y, w, h);
          kinds.forEach((kind, i) => {
            const sy = y + 6 * u + i * rh + rh / 2, sym = SYMBOLS[kind] ?? SYMBOLS.trap;
            g += `<g transform="translate(${n1(x + 18 * u)} ${n1(sy)}) scale(${((18 * u) / 20).toFixed(3)})">${sym.svg.replaceAll('{ink}', INK).replaceAll('{fill}', PAPER)}</g>`;
            g += `<text x="${n1(x + 36 * u)}" y="${n1(sy + fs * 0.35)}" font-size="${n1(fs)}" fill="${INK}">${esc(LEGEND_NAMES(kind))}</text>`;
          });
          return `<g id="legend">${g}</g>`;
        },
      });
    }
  }

  // the compass: a disc 18u across with N above it, in a 40u × 52u box
  if (on.compass) items.push({ id: 'compass', w: 40 * u, h: 52 * u, over: { x: fr.r - pad - 42 * u, y: fr.y + pad }, draw: (x, y) => compassSvg(x + 20 * u, y + 32 * u, 18 * u, u, TH) });

  const f = spec.furniture ?? { place: 'over' as const };
  return placeFurniture(items, fr, f.place, f.side ?? 'bottom', pad, b => coversContent(spec, l, k, b));
}

/** The render's size in pixels: the window (the whole sheet, or the crop) and the furniture band beside it. */
export function dungeonRenderSize(spec: DungeonSpec, o: RenderDungeonOptions = {}): { width: number; height: number; band: { right: number; bottom: number } } {
  const k = o.ppu ?? 40, fr = frameOf(o.crop, spec.cols, spec.rows, k), band = dungeonFurniture(spec, o).band;
  return { width: fr.w + band.right, height: fr.h + band.bottom, band };
}

export function renderDungeonSvg(spec: DungeonSpec, o: RenderDungeonOptions = {}): string {
  const k = o.ppu ?? 40, W = spec.cols * k, H = spec.rows * k, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, t = 0.14 * k * spec.style.wall, fr = frameOf(o.crop, spec.cols, spec.rows, k);
  const l = o.layout ?? layoutDungeon(spec), on = dungeonLayersFor(spec, o.layers);
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${PAPER}"/>`], defs: string[] = [];
  // floor shapes: the floor rooms and natural passages (filled), and built corridors (stroked to their width)
  // every ring turns the same way, so where floors overlap the non-zero fill adds them up instead of cutting a hole
  const roomD = pathData([...l.rooms.filter(g => fillOf(g.room) === 'floor').map(g => ({ pts: clockwise(g.outline), closed: true })), ...l.corridors.flatMap(c => (c.outline ? [{ pts: clockwise(c.outline), closed: true }] : []))], k);
  const corr = l.corridors.filter(c => !c.outline).map(c => ({ d: pathData([{ pts: c.pts, closed: false }], k), w: c.width * k }));

  if (on.underlay && spec.underlay && o.underlay) parts.push(underlaySvg(spec, o.underlay.map, k, o.underlay.field));

  if (on.rock && spec.style.hatch !== 'none') {
    defs.push(hatchPattern(k));
    const band = spec.style.band * k;
    const g = spec.style.hatch === 'full'
      ? `<rect width="${W}" height="${H}" fill="url(#hatch)"/>`
      : `<g fill="url(#hatch)" stroke="url(#hatch)" stroke-linejoin="round" stroke-linecap="round">${roomD ? `<path d="${roomD}" stroke-width="${n1(2 * (t + band))}"/>` : ''}${corr.map(c => `<path d="${c.d}" fill="none" stroke-width="${n1(c.w + 2 * (t + band))}"/>`).join('')}</g>`;
    parts.push(`<g id="rock">${g}</g>`);
  }

  // the floor's shape: rooms filled, corridors stroked to their width (square ends, so dead ends close with a wall)
  const floor = (fill: string, extra: number) =>
    (roomD ? `<path d="${roomD}" fill="${fill}"${extra ? ` stroke="${fill}" stroke-width="${n1(extra * 2)}" stroke-linejoin="miter"` : ''}/>` : '') +
    corr.map(c => `<path d="${c.d}" fill="none" stroke="${fill}" stroke-width="${n1(c.w + extra * 2)}" stroke-linecap="square" stroke-linejoin="miter"/>`).join('');
  if (on.floors) parts.push(`<g id="floors"><g id="walls">${floor(INK, t)}</g><g id="floor">${floor(PAPER, 0)}</g></g>`);

  const ofFill = (f: string) => l.rooms.filter(g => fillOf(g.room) === f);
  if (on.buildings && ofFill('building').length) {
    const sw = n1(Math.max(1, t * 0.55));
    parts.push(`<g id="buildings">${ofFill('building').map(g => {
      const d = pathData([{ pts: g.outline, closed: true }], k), r = g.room;
      // the roof's ridge runs along the long side, a cell short of each end
      const long = r.w >= r.h, inset = Math.min(0.5, (long ? r.h : r.w) / 2), ridge = r.shape === 'rect' || r.shape === 'octagon' ? (long
        ? `M${n1((r.x + inset) * k)} ${n1((r.y + r.h / 2) * k)}H${n1((r.x + r.w - inset) * k)}` : `M${n1((r.x + r.w / 2) * k)} ${n1((r.y + inset) * k)}V${n1((r.y + r.h - inset) * k)}`) : '';
      return `<path d="${d}" fill="${ROOF}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="miter"/>${ridge ? `<path d="${ridge}" stroke="${RIDGE}" stroke-width="${n1(Math.max(1, t * 0.5))}" stroke-linecap="round"/>` : ''}`;
    }).join('')}</g>`);
  }

  if (on.enclosure && spec.walls?.length) {
    const defs2: string[] = [];
    let g = '';
    for (const w of layoutWalls(spec, l)) {
      const ring = pathData([{ pts: w.ring, closed: true }], k), th = w.thickness * k, cut = w.gates.map(gt => `<rect x="${n1(-gt.width * k / 2)}" y="${n1(-th)}" width="${n1(gt.width * k)}" height="${n1(2 * th)}" transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(gt.angle)})" fill="#000"/>`).join('');
      const mid = `gates-${w.index}`;
      if (cut) defs2.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${cut}</mask>`);
      g += `<g id="wall-${w.index}"><g${cut ? ` mask="url(#${mid})"` : ''}><path d="${ring}" fill="none" stroke="${INK}" stroke-width="${n1(th)}" stroke-linejoin="miter"/></g>`;
      const tower = (tw: { x: number; y: number; shape: string; size: number }) => {
        const r = (tw.size * k) / 2, ring2 = Math.max(1, th * 0.4);
        return tw.shape === 'square'
          ? `<rect x="${n1(tw.x * k - r)}" y="${n1(tw.y * k - r)}" width="${n1(2 * r)}" height="${n1(2 * r)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(ring2)}"/>`
          : `<circle cx="${n1(tw.x * k)}" cy="${n1(tw.y * k)}" r="${n1(r)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(ring2)}"/>`;
      };
      g += w.towers.map(tower).join('');
      g += w.gates.map(gt => `<g transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(gt.angle)}) scale(${((gt.width * k) / 10).toFixed(3)})">${SYMBOLS.gate.svg.replaceAll('{ink}', INK).replaceAll('{fill}', PAPER)}</g>`).join('');
      g += '</g>';
    }
    defs.push(...defs2);
    parts.push(`<g id="enclosure">${g}</g>`);
  }

  if (on.grid && spec.grid.show) {
    const s = spec.grid.size, line = (step: number) => {
      let d = '';
      for (let x = 0; x <= spec.cols + 1e-9; x += step) d += `M${n1(x * k)} 0V${H}`;
      for (let y = 0; y <= spec.rows + 1e-9; y += step) d += `M0 ${n1(y * k)}H${W}`;
      return d;
    };
    let g = '';
    if (spec.grid.sub && s > 1) g += `<path d="${line(1)}" stroke="${INK}" stroke-opacity="0.16" stroke-width="${n1(0.8 * u)}"/>`;
    g += `<path d="${line(s)}" stroke="${INK}" stroke-opacity="0.38" stroke-width="${n1(1.1 * u)}"/>`;
    const clip = spec.grid.clip === 'floor';
    if (clip) defs.push(`<mask id="floor-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${floor('#ffffff', 0)}</mask>`);
    parts.push(`<g id="grid" fill="none"${clip ? ' mask="url(#floor-mask)"' : ''}>${g}</g>`);
  }

  if (on.doors && l.doors.length) parts.push(`<g id="doors">${l.doors.map(d => doorSvg(d, k, t, u)).join('')}</g>`);

  if (on.symbols && spec.overlay.symbols.length)
    parts.push(`<g id="symbols">${spec.overlay.symbols.map(s => {
      const sym = SYMBOLS[s.kind] ?? SYMBOLS.trap;
      return `<g transform="translate(${n1(s.x * k)} ${n1(s.y * k)})${s.angle ? ` rotate(${n1(s.angle)})` : ''} scale(${(((o.pageScale ? PAGE_SYMBOL_MM * o.pageScale : k) / 20) * (s.scale ?? 1)).toFixed(3)})">${sym.svg.replaceAll('{ink}', INK).replaceAll('{fill}', PAPER)}</g>`;
    }).join('')}</g>`);

  if (on.cellars && ofFill('cellar').length)
    parts.push(`<g id="cellars" fill="none" stroke="${INK}" stroke-width="${n1(Math.max(1.4 * u, t * 0.7))}" stroke-dasharray="${n1(6 * u)} ${n1(4 * u)}" stroke-linejoin="round">${ofFill('cellar').map(g => `<path d="${pathData([{ pts: g.outline, closed: true }], k)}"/>`).join('')}</g>`);

  if (on.numbers || on.labels) {
    let nums = '', names = '';
    for (const g of l.rooms) {
      const x = g.cx * k, y = g.cy * k, badge = on.numbers && g.number !== undefined;
      if (badge) {
        const txt = String(g.number), fs = numberSize(u, o.pageScale), bh = fs * 1.45, bw = Math.max(bh, txt.length * fs * 0.62 + fs * 0.7);
        nums += linked(g.room.href, `<rect x="${n1(x - bw / 2)}" y="${n1(y - bh / 2)}" width="${n1(bw)}" height="${n1(bh)}" rx="${n1(bh * 0.32)}" fill="${INK}"/><text x="${n1(x)}" y="${n1(y + fs * 0.36)}" font-size="${n1(fs)}" font-weight="700" text-anchor="middle" fill="${PAPER}">${esc(txt)}</text>`);
      }
      if (on.labels && g.room.label) names += linked(g.room.href, haloText(g.room.label, x, y + (badge ? numberSize(u, o.pageScale) * (31 / 19) : 5 * u), nameSize(u, o.pageScale), INK, TH, 'font-weight="700"'));
    }
    if (nums) parts.push(`<g id="numbers">${nums}</g>`);
    if (names) parts.push(`<g id="room-labels">${names}</g>`);
  }

  if (on.labels && spec.overlay.labels.length) {
    const at = dungeonLabelLayout(spec, k, o.pageScale, l, on.numbers).at;
    const g = spec.overlay.labels.map((lb, i) => {
      const base = labelSize(lb, u, o.pageScale), lx = at[i].x / k, ly = at[i].y / k;
      const attrs = lb.kind === 'area' ? `font-weight="700" letter-spacing="${n1(base * 0.16)}"` : lb.kind === 'name' ? 'font-weight="700"' : 'font-style="italic"';
      const tx = haloText(lb.kind === 'area' ? lb.text.toUpperCase() : lb.text, lx * k, ly * k + base * 0.35, base, INK, TH, attrs);
      return linked(lb.href, lb.angle ? `<g transform="rotate(${n1(lb.angle)} ${n1(lx * k)} ${n1(ly * k)})">${tx}</g>` : tx);
    }).join('');
    parts.push(`<g id="labels">${g}</g>`);
  }

  const furn = dungeonFurniture(spec, o, l, on);
  const drawn = furn.placed.map(p => p.item.draw(p.x, p.y)).join('');
  const out = { ...fr, w: fr.w + furn.band.right, h: fr.h + furn.band.bottom, r: fr.r + furn.band.right, b: fr.b + furn.band.bottom };
  // with a band, the map gets a frame and the band plain paper (no grid or hatching runs into it)
  const band = furn.band.right || furn.band.bottom ? `<rect x="${n1(out.x)}" y="${n1(out.y)}" width="${n1(out.w)}" height="${n1(out.h)}" fill="${PAPER}"/>` : '';
  const frame = band ? `<rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}" fill="none" stroke="${INK}" stroke-width="${n1(1.5 * u)}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(out, o.unit)} font-family="${FONT}"><defs>${defs.join('')}<clipPath id="map-clip"><rect x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}"/></clipPath></defs>${band}<g clip-path="url(#map-clip)">${parts.join('')}</g>${frame}${drawn}</svg>`;
}
