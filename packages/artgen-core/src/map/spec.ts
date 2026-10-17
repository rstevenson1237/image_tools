/**
 * Terrain map file (`art/maps/<id>/map.json`): a TTRPG map as generator settings plus an ordered list of edits and an
 * overlay. The CLI, the MCP server and the web tool all read and write this one shape, and every render comes from it,
 * so the same file gives the same picture everywhere.
 *
 * Coordinates are map units: one unit is one grid cell (a square, or a hex across its flats). `cols × rows` units.
 */

export const TERRAINS = ['deep', 'water', 'marsh', 'sand', 'desert', 'grass', 'scrub', 'forest', 'rock', 'snow'] as const;
export type Terrain = (typeof TERRAINS)[number];

export const TERRAIN_NAMES: Record<Terrain, string> = {
  deep: 'Deep water', water: 'Shallow water', marsh: 'Marsh', sand: 'Sand / beach', desert: 'Desert', grass: 'Grassland',
  scrub: 'Scrub', forest: 'Forest', rock: 'Rock / mountain', snow: 'Snow',
};

export const PRESETS = ['regional', 'local'] as const;
export type Preset = (typeof PRESETS)[number];

export const LAND_MODES = ['mixed', 'island', 'inland'] as const;
export type LandMode = (typeof LAND_MODES)[number];

export const GRID_TYPES = ['none', 'square', 'hex'] as const;
export type GridType = (typeof GRID_TYPES)[number];

export const LABEL_KINDS = ['region', 'place', 'water', 'note'] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

/** Where an edit applies: a disc, a polygon (x,y pairs) or a brush stroke (a polyline with a width). */
export type Shape = { circle: [number, number, number] } | { poly: number[] } | { stroke: number[]; width: number };

export type MapEdit =
  | { op: 'paint'; terrain: Terrain; shape: Shape }
  /** Raise (amount > 0) or lower the ground, in fractions of the full height range (-1..1), with a soft edge. */
  | { op: 'elevate'; amount: number; shape: Shape }
  | { op: 'river'; points: number[]; width?: number }
  | { op: 'road'; points: number[] };

export interface MapLabel { text: string; x: number; y: number; kind: LabelKind; size?: number; angle?: number }
export interface MapSymbol { kind: string; x: number; y: number; scale?: number }

export interface MapSpec {
  id: string;
  version: 1;
  preset: Preset;
  cols: number;
  rows: number;
  seed: number;
  title?: string;
  gen: {
    land: LandMode;
    /** Fraction of the map under water before edits (0..0.9). */
    sea: number;
    /** Dry (0) to wet (1). */
    moisture: number;
    /** Smooth (0) to rugged (1) ground. */
    roughness: number;
    /** Flat (0) to steep, peaked (1) relief. */
    relief: number;
    /** Generated rivers (user rivers are edits). */
    rivers: number;
    /** Readability: 0 keeps every small patch; higher merges small patches and smooths the edges. */
    simplify: number;
    /** Typical size of a hill or valley, in map units. */
    feature: number;
  };
  topo: { maxElevation: number; interval: number; majorEvery: number; unit: string; labels: boolean };
  grid: { type: GridType; size: number; coords: boolean };
  scale: { perCell: number; unit: string };
  legend: boolean;
  scaleBar: boolean;
  compass: boolean;
  edits: MapEdit[];
  overlay: { labels: MapLabel[]; symbols: MapSymbol[] };
}

/** Height-field samples per map unit (the generator's resolution). */
export const RESOLUTION: Record<Preset, number> = { regional: 8, local: 6 };

type Defaults = Omit<MapSpec, 'id' | 'seed' | 'edits' | 'overlay' | 'version' | 'preset'>;

export const PRESET_DEFAULTS: Record<Preset, Defaults> = {
  regional: {
    cols: 30, rows: 22,
    gen: { land: 'mixed', sea: 0.3, moisture: 0.5, roughness: 0.5, relief: 0.5, rivers: 3, simplify: 3, feature: 10 },
    topo: { maxElevation: 5000, interval: 500, majorEvery: 5, unit: 'ft', labels: false },
    grid: { type: 'hex', size: 1, coords: true },
    scale: { perCell: 6, unit: 'mi' },
    legend: true, scaleBar: true, compass: true,
  },
  local: {
    cols: 30, rows: 20,
    gen: { land: 'inland', sea: 0.08, moisture: 0.55, roughness: 0.4, relief: 0.3, rivers: 1, simplify: 2, feature: 14 },
    topo: { maxElevation: 40, interval: 5, majorEvery: 4, unit: 'ft', labels: false },
    grid: { type: 'square', size: 1, coords: false },
    scale: { perCell: 5, unit: 'ft' },
    legend: true, scaleBar: true, compass: false,
  },
};

export const MAX_SIDE = 120;

/** A new map with the preset's defaults; `over` replaces any top-level field or merges into gen/topo/grid/scale. */
export function newMap(id: string, preset: Preset = 'regional', over: Partial<MapSpec> = {}): MapSpec {
  const d = structuredClone(PRESET_DEFAULTS[preset]);
  return parseMap({ ...d, ...over, id, version: 1, preset, seed: over.seed ?? 1, gen: { ...d.gen, ...over.gen }, topo: { ...d.topo, ...over.topo }, grid: { ...d.grid, ...over.grid }, scale: { ...d.scale, ...over.scale }, edits: over.edits ?? [], overlay: over.overlay ?? { labels: [], symbols: [] } });
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nums = (v: unknown): v is number[] => Array.isArray(v) && v.every(isNum);

function shapeErrors(s: unknown, at: string): string[] {
  if (!s || typeof s !== 'object') return [`${at}: shape required ({circle:[x,y,r]}, {poly:[x,y,…]} or {stroke:[x,y,…], width})`];
  const o = s as Record<string, unknown>;
  if ('circle' in o) return nums(o.circle) && o.circle.length === 3 && o.circle[2] > 0 ? [] : [`${at}.circle: [x, y, r] with r > 0`];
  if ('poly' in o) return nums(o.poly) && o.poly.length >= 6 && o.poly.length % 2 === 0 ? [] : [`${at}.poly: at least 3 x,y pairs`];
  if ('stroke' in o) return nums(o.stroke) && o.stroke.length >= 2 && o.stroke.length % 2 === 0 && isNum(o.width) && o.width > 0 ? [] : [`${at}.stroke: x,y pairs and width > 0`];
  return [`${at}: unknown shape (circle, poly or stroke)`];
}

/** Every problem with a map file, as readable messages (empty when it is valid). */
export function validateMap(raw: unknown): string[] {
  const e: string[] = [];
  if (!raw || typeof raw !== 'object') return ['map: expected an object'];
  const m = raw as Partial<MapSpec>;
  if (typeof m.id !== 'string' || !/^[\w-]+$/.test(m.id)) e.push('id: letters, digits, - and _ only');
  if (!PRESETS.includes(m.preset as Preset)) e.push(`preset: one of ${PRESETS.join(', ')}`);
  for (const k of ['cols', 'rows'] as const) if (!isNum(m[k]) || m[k]! < 4 || m[k]! > MAX_SIDE || !Number.isInteger(m[k])) e.push(`${k}: an integer from 4 to ${MAX_SIDE}`);
  if (!isNum(m.seed)) e.push('seed: a number');
  const g = m.gen;
  if (!g) e.push('gen: required');
  else {
    if (!LAND_MODES.includes(g.land)) e.push(`gen.land: one of ${LAND_MODES.join(', ')}`);
    for (const [k, lo, hi] of [['sea', 0, 0.9], ['moisture', 0, 1], ['roughness', 0, 1], ['relief', 0, 1], ['rivers', 0, 20], ['simplify', 0, 6], ['feature', 2, 60]] as const)
      if (!isNum(g[k]) || g[k] < lo || g[k] > hi) e.push(`gen.${k}: ${lo}..${hi}`);
  }
  const t = m.topo;
  if (!t || !isNum(t.maxElevation) || t.maxElevation <= 0 || !isNum(t.interval) || t.interval <= 0 || t.interval > t.maxElevation || !isNum(t.majorEvery) || t.majorEvery < 1)
    e.push('topo: maxElevation > 0, 0 < interval ≤ maxElevation, majorEvery ≥ 1');
  else if (t.maxElevation / t.interval > 60) e.push('topo.interval: at most 60 contour levels (raise the interval)');
  if (!m.grid || !GRID_TYPES.includes(m.grid.type) || !isNum(m.grid.size) || m.grid.size < 0.25) e.push(`grid: type ${GRID_TYPES.join('|')}, size ≥ 0.25`);
  if (!m.scale || !isNum(m.scale.perCell) || typeof m.scale.unit !== 'string') e.push('scale: perCell (number) and unit');
  (Array.isArray(m.edits) ? m.edits : (e.push('edits: an array'), [])).forEach((ed, i) => {
    const at = `edits[${i}]`;
    if (ed?.op === 'paint') { if (!TERRAINS.includes(ed.terrain)) e.push(`${at}.terrain: one of ${TERRAINS.join(', ')}`); e.push(...shapeErrors(ed.shape, `${at}.shape`)); }
    else if (ed?.op === 'elevate') { if (!isNum(ed.amount) || Math.abs(ed.amount) > 1) e.push(`${at}.amount: -1..1`); e.push(...shapeErrors(ed.shape, `${at}.shape`)); }
    else if (ed?.op === 'river' || ed?.op === 'road') { if (!nums(ed.points) || ed.points.length < 4 || ed.points.length % 2) e.push(`${at}.points: at least 2 x,y pairs`); }
    else e.push(`${at}.op: paint, elevate, river or road`);
  });
  const o = m.overlay;
  if (!o || !Array.isArray(o.labels) || !Array.isArray(o.symbols)) e.push('overlay: { labels: [], symbols: [] }');
  else {
    o.labels.forEach((l, i) => { if (typeof l?.text !== 'string' || !isNum(l.x) || !isNum(l.y) || !LABEL_KINDS.includes(l.kind)) e.push(`overlay.labels[${i}]: text, x, y, kind (${LABEL_KINDS.join('|')})`); });
    o.symbols.forEach((s, i) => { if (typeof s?.kind !== 'string' || !isNum(s.x) || !isNum(s.y)) e.push(`overlay.symbols[${i}]: kind, x, y`); });
  }
  return e;
}

/** Fill missing fields from the preset defaults (older or hand-written files), then validate; throws on errors. */
export function parseMap(raw: unknown): MapSpec {
  const r = (raw ?? {}) as Partial<MapSpec>, d = PRESET_DEFAULTS[PRESETS.includes(r.preset as Preset) ? r.preset! : 'regional'];
  const m = {
    ...structuredClone(d), ...r, version: 1,
    gen: { ...d.gen, ...r.gen }, topo: { ...d.topo, ...r.topo }, grid: { ...d.grid, ...r.grid }, scale: { ...d.scale, ...r.scale },
    edits: r.edits ?? [], overlay: { labels: r.overlay?.labels ?? [], symbols: r.overlay?.symbols ?? [] },
  } as MapSpec;
  const errors = validateMap(m);
  if (errors.length) throw new Error(`invalid map${typeof r.id === 'string' ? ` ${r.id}` : ''}:\n  ${errors.join('\n  ')}`);
  return m;
}

/** Hex coordinates (`0304`: column 3, row 4, both from 1) or a cell name (`C4`) to the centre of that cell. */
export function cellCenter(spec: Pick<MapSpec, 'grid'>, ref: string): [number, number] {
  const s = spec.grid.size;
  const hex = ref.match(/^(\d{2})(\d{2})$/);
  if (hex) {
    const c = +hex[1] - 1, r = +hex[2] - 1, R = s / Math.sqrt(3);
    return [R + c * 1.5 * R, s / 2 + r * s + (c % 2 ? s / 2 : 0)];
  }
  const sq = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (sq) {
    const c = [...sq[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, r = +sq[2] - 1;
    return [(c + 0.5) * s, (r + 0.5) * s];
  }
  throw new Error(`${ref}: expected hex coordinates (0304) or a square cell (C4)`);
}

/** `x,y` in map units, or `hex:0304` / `cell:C4` (also bare `0304` / `C4`). */
export function parsePoint(spec: Pick<MapSpec, 'grid'>, at: string): [number, number] {
  const xy = at.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
  if (xy) return [+xy[1], +xy[2]];
  return cellCenter(spec, at.replace(/^(hex|cell):/i, ''));
}
