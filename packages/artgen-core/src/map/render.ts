/**
 * Terrain map → SVG. Layers in a fixed order, each its own `<g id="…">`: terrain, rivers, roads, contours, grid,
 * symbols, labels, then the legend, scale bar, compass and title. Any layer can be turned off, so the same file
 * gives a bare terrain image, or the full map once labels and symbols are added as a follow-up.
 */
import { generateMap, terrainsUsed, type MapField } from './generate.ts';
import { gridGeometry } from './gridlines.ts';
import { TERRAIN_NAMES, TERRAINS, type MapSpec, type Terrain } from './spec.ts';
import { SYMBOLS } from './symbols.ts';
import { PATTERNS, THEME, type MapTheme, type ThemeName } from './theme.ts';
import { chaikin, isolines, lineLength, pathData, simplifyLine, type Line } from './trace.ts';

export const MAP_LAYERS = ['terrain', 'rivers', 'roads', 'contours', 'grid', 'symbols', 'labels', 'legend', 'scale', 'compass', 'title'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

export const FONT_FAMILY = 'Alegreya Sans';
const FONT = `'${FONT_FAMILY}', 'Segoe UI', Helvetica, Arial, sans-serif`;

export interface RenderMapOptions {
  theme?: ThemeName;
  /** Pixels per map unit (default 40). */
  ppu?: number;
  /** Layers to turn on or off; unset layers follow the map (legend, scaleBar, compass, title). */
  layers?: Partial<Record<MapLayer, boolean>>;
  /** A field already generated from this spec (the web tool reuses it while only the overlay changes). */
  field?: MapField;
}

/** The part of a map that decides its terrain: when this key is unchanged, the generated field can be reused. */
export const fieldKey = (s: MapSpec): string => JSON.stringify([s.preset, s.cols, s.rows, s.seed, s.gen, s.edits]);

export const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const n1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** Which layers render: everything on, decorations as the map says, then the caller's overrides. */
export function layersFor(spec: MapSpec, over: Partial<Record<MapLayer, boolean>> = {}): Record<MapLayer, boolean> {
  const on = Object.fromEntries(MAP_LAYERS.map(l => [l, true])) as Record<MapLayer, boolean>;
  on.grid = spec.grid.type !== 'none'; on.legend = spec.legend; on.scale = spec.scaleBar; on.compass = spec.compass; on.title = !!spec.title;
  return { ...on, ...over };
}

/** Sample-space lines → map units (sample i sits at (i + 0.5 - pad) / res), smoothed and thinned. */
function toUnits(lines: Line[], res: number, pad: number, passes: number): Line[] {
  return lines.map(l => simplifyLine(chaikin({ pts: l.pts.map(v => (v + 0.5 - pad) / res), closed: l.closed }, passes), 0.04));
}

/** Each terrain's outline as closed rings in map units (holes are rings too: fill with evenodd). */
export function terrainRegions(f: MapField): Map<Terrain, Line[]> {
  const pw = f.w + 4, ph = f.h + 4, out = new Map<Terrain, Line[]>();
  for (const t of terrainsUsed(f)) {
    const k = TERRAINS.indexOf(t), m = new Float32Array(pw * ph);
    // two rings of padding: the first repeats the edge (shapes run off the map), the second closes every outline
    for (let j = 1; j < ph - 1; j++) for (let i = 1; i < pw - 1; i++) {
      const sx = Math.min(f.w - 1, Math.max(0, i - 2)), sy = Math.min(f.h - 1, Math.max(0, j - 2));
      m[j * pw + i] = f.terrain[sy * f.w + sx] === k ? 1 : 0;
    }
    const sm = new Float32Array(m.length);
    for (let j = 1; j < ph - 1; j++) for (let i = 1; i < pw - 1; i++) {
      let s = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += m[(j + dj) * pw + i + di] * (di && dj ? 1 : di || dj ? 2 : 4);
      sm[j * pw + i] = s / 16;
    }
    out.set(t, toUnits(isolines(sm, pw, ph, 0.5), f.res, 2, 1).filter(l => l.closed && l.pts.length >= 6));
  }
  return out;
}

/** Contour lines per level (level 1 = one interval above the waterline); tiny loops are dropped. */
export function contourLines(spec: MapSpec, f: MapField): { level: number; lines: Line[] }[] {
  const step = spec.topo.interval / spec.topo.maxElevation, e = Float32Array.from(f.elevation), w = f.w, h = f.h;
  const passes = 1 + Math.round(spec.gen.simplify / 2);
  for (let p = 0; p < passes; p++) {
    const src = Float32Array.from(e);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < w && y < h) { s += src[y * w + x]; n++; } }
      e[j * w + i] = s / n;
    }
  }
  const out: { level: number; lines: Line[] }[] = [], minLen = spec.preset === 'local' ? 2 : 1.5;
  for (let k = 1; k * step < 1 - 1e-9; k++) {
    const lines = toUnits(isolines(e, w, h, k * step), f.res, 0, 2).filter(l => lineLength(l.closed ? [...l.pts, l.pts[0], l.pts[1]] : l.pts) >= minLen);
    if (lines.length) out.push({ level: k, lines });
  }
  return out;
}

function patternDefs(th: MapTheme, tile: number): string {
  return TERRAINS.map(t => {
    const st = th.terrain[t];
    if (!st.pattern) return '';
    return `<pattern id="pat-${t}" patternUnits="userSpaceOnUse" width="${n1(tile)}" height="${n1(tile)}"><g transform="scale(${n1(tile / 10)})">${PATTERNS[st.pattern].replaceAll('{ink}', st.ink ?? th.ink)}</g></pattern>`;
  }).join('');
}

function symbolSvg(kind: string, x: number, y: number, size: number, th: MapTheme): string {
  const s = SYMBOLS[kind] ?? SYMBOLS.poi;
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${(size / 20).toFixed(3)})">${s.svg.replaceAll('{ink}', th.ink).replaceAll('{fill}', th.symbolFill)}</g>`;
}

/** Text with a paper-coloured halo so it stays legible over any terrain. */
export function haloText(text: string, x: number, y: number, size: number, color: string, th: Pick<MapTheme, 'halo'>, attrs = ''): string {
  const a = `x="${n1(x)}" y="${n1(y)}" font-size="${n1(size)}" text-anchor="middle" ${attrs}`;
  return `<text ${a} fill="none" stroke="${th.halo}" stroke-width="${n1(size * 0.22)}" stroke-linejoin="round" stroke-opacity="0.9">${esc(text)}</text><text ${a} fill="${color}">${esc(text)}</text>`;
}

/** A round number of cells for the scale bar, about a fifth of the map wide. */
function scaleCells(spec: MapSpec): number {
  const target = spec.cols / 5;
  for (const n of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50]) if (n >= target * 0.75) return n;
  return Math.max(1, Math.round(target));
}

/** A north arrow in a disc, `r` across, centred on cx, cy. */
export function compassSvg(cx: number, cy: number, r: number, u: number, th: Pick<MapTheme, 'ink' | 'paper'>): string {
  return `<g id="compass" stroke="${th.ink}" stroke-width="${n1(u)}" stroke-linejoin="round"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${th.paper}" fill-opacity="0.85"/><path d="M${n1(cx)} ${n1(cy - r * 0.9)}L${n1(cx + r * 0.3)} ${n1(cy)}L${n1(cx)} ${n1(cy + r * 0.9)}L${n1(cx - r * 0.3)} ${n1(cy)}Z" fill="${th.paper}"/><path d="M${n1(cx)} ${n1(cy - r * 0.9)}L${n1(cx + r * 0.3)} ${n1(cy)}L${n1(cx - r * 0.3)} ${n1(cy)}Z" fill="${th.ink}"/><text x="${n1(cx)}" y="${n1(cy - r - 4 * u)}" font-size="${n1(13 * u)}" font-weight="700" text-anchor="middle" fill="${th.ink}" stroke="none">N</text></g>`;
}

export function renderMapSvg(spec: MapSpec, o: RenderMapOptions = {}): string {
  const th = THEME[o.theme ?? 'color'], k = o.ppu ?? 40, W = spec.cols * k, H = spec.rows * k, u = k / 40;
  const f = o.field ?? generateMap(spec), on = layersFor(spec, o.layers), tile = Math.max(9, Math.min(24, k * 0.4)) * (th.name === 'bw' ? 1.4 : 1);
  const parts: string[] = [];
  const used = terrainsUsed(f);

  const regions = on.terrain || (on.rivers && f.rivers.length) ? terrainRegions(f) : new Map<Terrain, Line[]>();
  if (on.terrain) {
    const base = used.find(t => t !== 'deep' && t !== 'water') ?? used[0];
    const order = [...used.filter(t => t !== 'deep' && t !== 'water'), ...used.filter(t => t === 'water' || t === 'deep').reverse()];
    let g = `<rect width="${W}" height="${H}" fill="${th.terrain[base].fill}"/>`;
    for (const t of order) {
      const d = pathData(regions.get(t) ?? [], k), st = th.terrain[t], water = t === 'water' || t === 'deep';
      if (!d) continue;
      const edge = water ? th.coast : th.edge === 'own' ? st.fill : th.edge, ew = water ? th.coastWidth : th.edgeWidth;
      g += `<path d="${d}" fill="${st.fill}" fill-rule="evenodd" stroke="${edge}" stroke-width="${n1(ew * u)}" stroke-linejoin="round"/>`;
      if (st.pattern) g += `<path d="${d}" fill="url(#pat-${t})" fill-rule="evenodd"/>`;
    }
    parts.push(`<g id="terrain">${g}</g>`);
  } else parts.push(`<rect width="${W}" height="${H}" fill="${th.paper}"/>`);

  const lineGroup = (id: string, lines: { pts: number[]; width: number }[], draw: (d: string, w: number) => string) =>
    lines.length ? `<g id="${id}" fill="none" stroke-linecap="round" stroke-linejoin="round">${lines.map(l => draw(pathData([{ pts: l.pts, closed: false }], k), Math.max(1.2 * u, l.width * k))).join('')}</g>` : '';
  const defs: string[] = [];
  const riverD = on.rivers && f.rivers.length ? pathData(f.rivers.map(r => ({ pts: r.outline, closed: true })), k) : '';
  if (riverD) {
    // each river is a filled ribbon. Banks first: every outline in the bank colour with a wide stroke, masked out
    // over open water so the banks stop at the coastline and run into it; then every outline filled with the
    // shallow-water fill, which covers the coast where a river crosses it, matches the lake or sea it opens into,
    // and merges rivers where a tributary joins
    const d = riverD, water = pathData([...(regions.get('water') ?? []), ...(regions.get('deep') ?? [])], k);
    defs.push(`<mask id="river-land" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${water ? `<path d="${water}" fill="#000" fill-rule="evenodd"/>` : ''}</mask>`);
    parts.push(`<g id="rivers" stroke-linejoin="round"><g mask="url(#river-land)"><path d="${d}" fill="${th.riverBank}" stroke="${th.riverBank}" stroke-width="${n1(th.riverBankWidth * 2 * u)}"/></g><path d="${d}" fill="${th.terrain.water.fill}"/></g>`);
  }
  if (on.roads) parts.push(lineGroup('roads', f.roads, (d, w) => `<path d="${d}" stroke="${th.road}" stroke-width="${n1(w)}" stroke-dasharray="${n1(w * 3)} ${n1(w * 2)}"/>`));

  if (on.contours) {
    const major = spec.topo.majorEvery;
    let g = '';
    for (const { level, lines } of contourLines(spec, f)) {
      const isMajor = level % major === 0, d = pathData(lines, k);
      g += `<path d="${d}" stroke-width="${n1((isMajor ? 1.5 : 0.75) * u)}"/>`;
      if (isMajor && spec.topo.labels) {
        const best = lines.reduce((a, b) => (b.pts.length > a.pts.length ? b : a));
        const mid = (best.pts.length >> 2) << 1, x = best.pts[mid] * k, y = best.pts[mid + 1] * k;
        g += `<g stroke="none">${haloText(`${level * spec.topo.interval} ${spec.topo.unit}`, x, y + 4 * u, 10 * u, th.contour, th)}</g>`;
      }
    }
    // contour lines stop at the river banks rather than crossing the water
    if (riverD) defs.push(`<mask id="no-river" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${riverD}" fill="#000" stroke="#000" stroke-width="${n1(th.riverBankWidth * 2 * u)}" stroke-linejoin="round"/></mask>`);
    parts.push(`<g id="contours"${riverD ? ' mask="url(#no-river)"' : ''} fill="none" stroke="${th.contour}" stroke-opacity="${th.contourOpacity}" stroke-linejoin="round" stroke-linecap="round">${g}</g>`);
  }

  if (on.grid && spec.grid.type !== 'none') {
    const gg = gridGeometry(spec, k);
    let g = `<path d="${gg.d}" fill="none" stroke="${th.grid}" stroke-opacity="${th.gridOpacity}" stroke-width="${n1(u)}"/>`;
    if (spec.grid.coords) {
      const fs = Math.max(6, 7 * u * spec.grid.size), dy = (spec.grid.type === 'hex' ? -0.33 : -0.34) * spec.grid.size * k;
      g += `<g fill="${th.grid}" fill-opacity="${Math.min(1, th.gridOpacity + 0.2)}" font-size="${n1(fs)}" text-anchor="middle">${gg.cells.map(c => `<text x="${n1(c.x * k)}" y="${n1(c.y * k + dy + fs * 0.35)}">${c.name}</text>`).join('')}</g>`;
    }
    parts.push(`<g id="grid">${g}</g>`);
  }

  if (on.symbols && spec.overlay.symbols.length)
    parts.push(`<g id="symbols">${spec.overlay.symbols.map(s => symbolSvg(s.kind, s.x * k, s.y * k, 22 * u * (s.scale ?? 1), th)).join('')}</g>`);

  if (on.labels && spec.overlay.labels.length) {
    const g = spec.overlay.labels.map(l => {
      const base = { region: 30, place: 16, water: 20, note: 13 }[l.kind] * u * (l.size ?? 1);
      const attrs = l.kind === 'region' ? `font-weight="700" letter-spacing="${n1(base * 0.18)}"` : l.kind === 'water' ? 'font-style="italic"' : l.kind === 'place' ? 'font-weight="700"' : '';
      const text = l.kind === 'region' ? l.text.toUpperCase() : l.text;
      const t = haloText(text, l.x * k, l.y * k + base * 0.35, base, th.label[l.kind], th, attrs);
      return l.angle ? `<g transform="rotate(${n1(l.angle)} ${n1(l.x * k)} ${n1(l.y * k)})">${t}</g>` : t;
    }).join('');
    parts.push(`<g id="labels">${g}</g>`);
  }

  const box = (x: number, y: number, w: number, h: number) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${th.paper}" fill-opacity="0.92" stroke="${th.ink}" stroke-width="${n1(u)}"/>`;
  const pad = 12 * u;

  if (on.legend) {
    const rows: [string, string][] = used.map(t => [t, TERRAIN_NAMES[t]]);
    if (f.rivers.length) rows.push(['river', 'River']);
    if (f.roads.length) rows.push(['road', 'Road']);
    const rh = 18 * u, fs = 12 * u, bw = 150 * u, bh = rows.length * rh + 12 * u, x = W - bw - pad, y = H - bh - pad;
    let g = box(x, y, bw, bh);
    rows.forEach(([t, name], i) => {
      const sx = x + 8 * u, sy = y + 6 * u + i * rh + 2 * u, sw = 24 * u, sh = rh - 5 * u;
      if (t === 'river') g += `<path d="M${n1(sx)} ${n1(sy + sh / 2)}h${n1(sw)}" stroke="${th.riverBank}" stroke-width="${n1(5 * u)}"/><path d="M${n1(sx + th.riverBankWidth * u)} ${n1(sy + sh / 2)}h${n1(sw - 2 * th.riverBankWidth * u)}" stroke="${th.terrain.water.fill}" stroke-width="${n1(5 * u - 2 * th.riverBankWidth * u)}"/>`;
      else if (t === 'road') g += `<path d="M${n1(sx)} ${n1(sy + sh / 2)}h${n1(sw)}" stroke="${th.road}" stroke-width="${n1(2 * u)}" stroke-dasharray="${n1(5 * u)} ${n1(3 * u)}"/>`;
      else {
        const st = th.terrain[t as Terrain];
        g += `<rect x="${n1(sx)}" y="${n1(sy)}" width="${n1(sw)}" height="${n1(sh)}" fill="${st.fill}" stroke="${th.ink}" stroke-width="${n1(0.6 * u)}"/>`;
        if (st.pattern) g += `<rect x="${n1(sx)}" y="${n1(sy)}" width="${n1(sw)}" height="${n1(sh)}" fill="url(#pat-${t})"/>`;
      }
      g += `<text x="${n1(sx + sw + 7 * u)}" y="${n1(sy + sh / 2 + fs * 0.35)}" font-size="${n1(fs)}" fill="${th.ink}">${esc(name)}</text>`;
    });
    parts.push(`<g id="legend">${g}</g>`);
  }

  if (on.scale) {
    const n = scaleCells(spec), len = n * k, fs = 11 * u, x = pad + 8 * u, y = H - pad - 20 * u, seg = 4;
    let g = box(pad, y - 18 * u, len + 34 * u, 40 * u);
    for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + (len / seg) * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? th.paper : th.ink}" stroke="${th.ink}" stroke-width="${n1(0.8 * u)}"/>`;
    g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${th.ink}" text-anchor="middle">0</text>`;
    g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${th.ink}" text-anchor="middle">${n * spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${th.ink}" text-anchor="middle">1 ${spec.grid.type === 'hex' ? 'hex' : 'square'} = ${spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    parts.push(`<g id="scale">${g}</g>`);
  }

  if (on.compass) parts.push(compassSvg(W - pad - 18 * u - 4 * u, pad + 18 * u + 14 * u, 18 * u, u, th));

  if (on.title && spec.title) {
    const fs = 26 * u, w = Math.max(120 * u, spec.title.length * fs * 0.62 + 30 * u);
    parts.push(`<g id="title">${box(pad, pad, w, fs * 1.7)}<text x="${n1(pad + w / 2)}" y="${n1(pad + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.06)}" text-anchor="middle" fill="${th.ink}">${esc(spec.title)}</text></g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}"><defs>${patternDefs(th, tile)}${defs.join('')}<clipPath id="map-clip"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#map-clip)">${parts.join('')}</g></svg>`;
}
