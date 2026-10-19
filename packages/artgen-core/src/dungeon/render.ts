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
import { layoutDungeon, type DoorGeom, type DungeonLayout } from './layout.ts';
import type { DungeonSpec } from './spec.ts';
import { SYMBOLS } from './symbols.ts';

export const DUNGEON_LAYERS = ['rock', 'floors', 'grid', 'doors', 'symbols', 'numbers', 'labels', 'title', 'scale', 'compass'] as const;
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
}

/** Which layers render: everything on, the optional ones as the file says, then the caller's overrides. */
export function dungeonLayersFor(spec: DungeonSpec, over: Partial<Record<DungeonLayer, boolean>> = {}): Record<DungeonLayer, boolean> {
  const on = Object.fromEntries(DUNGEON_LAYERS.map(l => [l, true])) as Record<DungeonLayer, boolean>;
  on.rock = spec.style.hatch !== 'none'; on.grid = spec.grid.show; on.numbers = spec.numbers;
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

/** A round number of cells for the scale bar, about a fifth of the map wide. */
function scaleCells(width: number): number {
  const target = width / 5;
  for (const n of [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40]) if (n >= target * 0.75) return n;
  return Math.max(1, Math.round(target));
}

export function renderDungeonSvg(spec: DungeonSpec, o: RenderDungeonOptions = {}): string {
  const k = o.ppu ?? 40, W = spec.cols * k, H = spec.rows * k, u = k / 40, t = 0.14 * k * spec.style.wall, fr = frameOf(o.crop, spec.cols, spec.rows, k);
  const l = o.layout ?? layoutDungeon(spec), on = dungeonLayersFor(spec, o.layers);
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${PAPER}"/>`], defs: string[] = [];
  const roomD = pathData(l.rooms.map(g => ({ pts: g.outline, closed: true })), k);
  const corr = l.corridors.map(c => ({ d: pathData([{ pts: c.pts, closed: false }], k), w: c.width * k }));

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
      return `<g transform="translate(${n1(s.x * k)} ${n1(s.y * k)})${s.angle ? ` rotate(${n1(s.angle)})` : ''} scale(${((k / 20) * (s.scale ?? 1)).toFixed(3)})">${sym.svg.replaceAll('{ink}', INK).replaceAll('{fill}', PAPER)}</g>`;
    }).join('')}</g>`);

  if (on.numbers || on.labels) {
    let nums = '', names = '';
    for (const g of l.rooms) {
      const x = g.cx * k, y = g.cy * k, badge = on.numbers && g.number !== undefined;
      if (badge) {
        const txt = String(g.number), fs = 19 * u, bh = fs * 1.45, bw = Math.max(bh, txt.length * fs * 0.62 + fs * 0.7);
        nums += `<rect x="${n1(x - bw / 2)}" y="${n1(y - bh / 2)}" width="${n1(bw)}" height="${n1(bh)}" rx="${n1(bh * 0.32)}" fill="${INK}"/><text x="${n1(x)}" y="${n1(y + fs * 0.36)}" font-size="${n1(fs)}" font-weight="700" text-anchor="middle" fill="${PAPER}">${esc(txt)}</text>`;
      }
      if (on.labels && g.room.label) names += haloText(g.room.label, x, y + (badge ? 31 * u : 5 * u), 15 * u, INK, TH, 'font-weight="700"');
    }
    if (nums) parts.push(`<g id="numbers">${nums}</g>`);
    if (names) parts.push(`<g id="room-labels">${names}</g>`);
  }

  if (on.labels && spec.overlay.labels.length) {
    const g = spec.overlay.labels.map(lb => {
      const base = { area: 24, name: 15, note: 12 }[lb.kind] * u * (lb.size ?? 1);
      const attrs = lb.kind === 'area' ? `font-weight="700" letter-spacing="${n1(base * 0.16)}"` : lb.kind === 'name' ? 'font-weight="700"' : 'font-style="italic"';
      const tx = haloText(lb.kind === 'area' ? lb.text.toUpperCase() : lb.text, lb.x * k, lb.y * k + base * 0.35, base, INK, TH, attrs);
      return lb.angle ? `<g transform="rotate(${n1(lb.angle)} ${n1(lb.x * k)} ${n1(lb.y * k)})">${tx}</g>` : tx;
    }).join('');
    parts.push(`<g id="labels">${g}</g>`);
  }

  const box = (x: number, y: number, w: number, h: number) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(u)}"/>`;
  const pad = 12 * u;

  if (on.scale) {
    const n = scaleCells(fr.w / k), len = n * k, fs = 11 * u, x = fr.x + pad + 8 * u, y = fr.b - pad - 20 * u, seg = Math.min(4, n);
    let g = box(fr.x + pad, y - 18 * u, len + 34 * u, 40 * u);
    for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + (len / seg) * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? PAPER : INK}" stroke="${INK}" stroke-width="${n1(0.8 * u)}"/>`;
    g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${INK}" text-anchor="middle">0</text>`;
    g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${INK}" text-anchor="middle">${n * spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${INK}" text-anchor="middle">1 square = ${spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    parts.push(`<g id="scale">${g}</g>`);
  }

  if (on.compass) parts.push(compassSvg(fr.r - pad - 22 * u, fr.y + pad + 32 * u, 18 * u, u, TH));

  if (on.title && spec.title) {
    const fs = 24 * u, w = Math.max(120 * u, spec.title.length * fs * 0.62 + 30 * u);
    parts.push(`<g id="title">${box(fr.x + pad, fr.y + pad, w, fs * 1.7)}<text x="${n1(fr.x + pad + w / 2)}" y="${n1(fr.y + pad + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.06)}" text-anchor="middle" fill="${INK}">${esc(spec.title)}</text></g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(fr, o.unit)} font-family="${FONT}"><defs>${defs.join('')}<clipPath id="map-clip"><rect x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}"/></clipPath></defs><g clip-path="url(#map-clip)">${parts.join('')}</g></svg>`;
}
