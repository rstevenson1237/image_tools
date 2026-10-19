/**
 * Facts read back from a map (`artgen map facts`): the ground a generated map holds (terrain, height, slope, rivers,
 * roads) stated as numbers, so a consumer that never sees the render can still write about it.
 *
 * Everything is in map units (one grid cell) and in the map's own scale unit (`scale.unit`), and heights in `topo.unit`.
 * The same file gives the same facts, to the rounding in {@link RULES}; changing a rule changes what a consumer reads,
 * so it is a format change (see `format.ts`). Positions are coordinates, never bearings: the consumer turns them into
 * compass and distance.
 */
import { percentShares, roundTo } from '../lib/round.ts';
import { simplifyLine } from '../lib/trace.ts';
import { eachCovered } from './geometry.ts';
import { coverage, generateMap, type MapField, type River } from './generate.ts';
import { TERRAINS, type MapSpec, type Shape, type Terrain } from './spec.ts';

/** The rounding and the thresholds the facts are stated with. They are part of the format. */
export const RULES = {
  /** Heights (and heights above a reference) are whole multiples of `topo.interval`. */
  height: 'topo.interval',
  /** Positions, lengths and distances in map units; a scale-unit value is the rounded map value times `scale.perCell`, to this step. */
  position: 0.1,
  /** Terrain shares are whole percent, summing to 100 (largest remainder). */
  share: 1,
  /** Slope is the height change across a window this wide (map units), centred on the point. */
  slopeWindow: 1,
  /** A slope is `flat` below the first threshold, `gentle` below the second, `steep` below the third and `cliff` from there (rise over run, both in one unit). */
  slopeBands: { flat: 0.05, gentle: 0.2, steep: 0.6 },
  /** A polyline is thinned to within this distance (map units) of the line it came from before it is listed. */
  lineTolerance: 0.25,
  /** A hilltop or hollow must stand this many `topo.interval`s clear of the saddle that joins it to higher (or lower) ground. */
  prominence: 2,
  /** `--above lowest` looks this far (map units) when `--radius` is not given. */
  radius: 5,
} as const;

export type SlopeBand = 'flat' | 'gentle' | 'steep' | 'cliff';
export type Point = [number, number];

/** A length in map units and in the map's scale unit. */
export interface Length { map: number; scale: number }
export interface Share { terrain: Terrain; share: number }
export interface HeightAt { height: number; at: Point }
/** A hilltop or hollow: its height, where, and how far it stands above (or below) the saddle to higher (or lower) ground. */
export interface Summit extends HeightAt { prominence: number }

export interface Nearest {
  /** `river-1`, `road-2`…: the order the map holds them in (generated rivers first, then the edits'). */
  name: string;
  /** Rivers only: traced by the generator, or drawn by an edit. */
  source?: River['source'];
  distance: Length;
  /** The nearest point on its centre line. */
  at: Point;
  /** Rivers only: the point lies inside the ribbon. */
  within?: boolean;
}

export interface PointFacts {
  at: Point;
  terrain: Terrain;
  height: number;
  slope: { gradient: number; band: SlopeBand | null };
  river: Nearest | null;
  road: Nearest | null;
  above?: { of: 'river' | 'lowest'; value: number | null; reference: HeightAt | null };
}

export interface Crossing {
  name: string;
  source?: River['source'];
  /** Where it comes into the area; null when it starts inside. */
  enters: Point | null;
  /** Where it leaves the area; null when it ends inside. */
  leaves: Point | null;
  length: Length;
}

export interface AreaFacts {
  area: Point[];
  terrain: Share[];
  lowest: HeightAt;
  highest: HeightAt;
  rivers: Crossing[];
  roads: Crossing[];
}

export interface Line { name: string; source?: River['source']; points: Point[]; length: Length; mouth?: boolean }

export interface Features {
  /** Rivers drawn by `river` edits, and streams a `require` entry asked for. */
  rivers: Line[];
  /** Rivers the generator traced (`gen.rivers`). */
  generatedRivers: Line[];
  roads: Line[];
  hilltops: Summit[];
  hollows: Summit[];
  terrain: Share[];
  lowest: HeightAt;
  highest: HeightAt;
}

export interface MapFacts {
  version: number;
  id: string;
  size: { cols: number; rows: number };
  unit: { map: 'cell'; scale: string; height: string };
  rules: typeof RULES;
  points?: PointFacts[];
  areas?: AreaFacts[];
  features?: Features;
}

export interface MapFactsQuery {
  at?: Point[];
  /** Each an outline of x,y pairs (3 or more points). */
  areas?: number[][];
  above?: 'river' | 'lowest';
  /** Map units; with `above: 'lowest'`. */
  radius?: number;
}

const LENGTH_IN_FEET: Record<string, number> = {
  in: 1 / 12, inch: 1 / 12, ft: 1, foot: 1, feet: 1, yd: 3, yard: 3, mi: 5280, mile: 5280, m: 3.280839895, metre: 3.280839895, meter: 3.280839895, km: 3280.839895, kilometre: 3280.839895, kilometer: 3280.839895,
};

/** Feet in one `unit` (`ft`, `yd`, `mi`, `m`, `km`, …), or null for a unit this does not know. */
export function feetIn(unit: string): number | null {
  const u = unit.trim().toLowerCase().replace(/\.$/, '').replace(/s$/, '');
  return LENGTH_IN_FEET[u] ?? LENGTH_IN_FEET[`${u}s`] ?? null;
}

/** Cell-by-cell and line-by-line access to a generated map, with the rounding applied once, here. */
function ground(spec: MapSpec, f: MapField) {
  const { res, w, h } = f, top = spec.topo.maxElevation, step = spec.topo.interval, per = spec.scale.perCell;
  const rnd = (v: number) => roundTo(v, RULES.position);
  const length = (map: number): Length => { const m = rnd(map); return { map: m, scale: rnd(m * per) }; };
  const pt = (x: number, y: number): Point => [rnd(x), rnd(y)];
  const shown = (height: number) => roundTo(height, step);
  const sample = (i: number, j: number) => f.elevation[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))];
  /** Height in `topo.unit` (unrounded): bilinear between sample centres. */
  const height = (x: number, y: number): number => {
    const u = x * res - 0.5, v = y * res - 0.5, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    return top * ((sample(i, j) * (1 - fx) + sample(i + 1, j) * fx) * (1 - fy) + (sample(i, j + 1) * (1 - fx) + sample(i + 1, j + 1) * fx) * fy);
  };
  const terrainAt = (x: number, y: number): Terrain => TERRAINS[f.terrain[Math.min(h - 1, Math.floor(y * res)) * w + Math.min(w - 1, Math.floor(x * res))]];
  const centre = (n: number): Point => { const i = n % w; return [(i + 0.5) / res, ((n - i) / w + 0.5) / res]; };

  /** Height gained per `scale.unit` run, in `topo.unit`; and rise over run when both units are lengths this knows. */
  const slope = (x: number, y: number) => {
    const d = RULES.slopeWindow / 2, x0 = Math.max(0, x - d), x1 = Math.min(spec.cols, x + d), y0 = Math.max(0, y - d), y1 = Math.min(spec.rows, y + d);
    const gx = (height(x1, y) - height(x0, y)) / (x1 - x0), gy = (height(x, y1) - height(x, y0)) / (y1 - y0);
    const perUnit = Math.hypot(gx, gy), gradient = roundTo(perUnit / per, 0.001);
    const rise = feetIn(spec.topo.unit), run = feetIn(spec.scale.unit);
    if (rise === null || run === null) return { gradient, band: null };
    const ratio = (perUnit * rise) / (per * run), b = RULES.slopeBands;
    return { gradient, band: (ratio < b.flat ? 'flat' : ratio < b.gentle ? 'gentle' : ratio < b.steep ? 'steep' : 'cliff') as SlopeBand };
  };

  const lines = [
    ...f.rivers.map((r, i) => ({ kind: 'river' as const, name: `river-${i + 1}`, pts: r.pts, widths: r.widths, source: r.source, mouth: r.mouth })),
    ...f.roads.map((r, i) => ({ kind: 'road' as const, name: `road-${i + 1}`, pts: r.pts, widths: undefined, source: undefined, mouth: undefined })),
  ];
  type L = (typeof lines)[number];
  const nearest = (kind: L['kind'], x: number, y: number): { line: L; d: number; at: Point; width: number } | null => {
    let best: { line: L; d: number; at: Point; width: number } | null = null;
    for (const line of lines) {
      if (line.kind !== kind) continue;
      const p = line.pts;
      for (let i = 2; i < p.length; i += 2) {
        const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
        const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { line, d, at: [px, py], width: line.widths ? line.widths[i / 2 - 1] * (1 - t) + line.widths[i / 2] * t : 0 };
      }
    }
    return best;
  };
  const near = (kind: L['kind'], x: number, y: number): (Nearest & { rawAt: Point }) | null => {
    const n = nearest(kind, x, y);
    if (!n) return null;
    return { name: n.line.name, ...(n.line.source && { source: n.line.source }), distance: length(n.d), at: pt(...n.at), ...(kind === 'river' && { within: n.d <= n.width / 2 }), rawAt: n.at };
  };

  return { res, w, h, rnd, length, pt, shown, height, terrainAt, centre, slope, lines, near };
}
type Ground = ReturnType<typeof ground>;

/** Terrain shares of the samples at `ids` (all of them when omitted), largest first. */
export function shares(f: MapField, ids?: number[]): Share[] {
  const count = new Array<number>(TERRAINS.length).fill(0);
  if (ids) for (const n of ids) count[f.terrain[n]]++; else for (const t of f.terrain) count[t]++;
  const out = percentShares(TERRAINS.map((t, i) => [t, count[i]] as [Terrain, number]).filter(([, c]) => c > 0));
  return out.map(([terrain, share]) => ({ terrain, share })).sort((a, b) => b.share - a.share || TERRAINS.indexOf(a.terrain) - TERRAINS.indexOf(b.terrain));
}

/** The samples of `f` whose centres lie inside the outline `poly`, in reading order. */
function samplesIn(f: MapField, poly: number[]): number[] {
  const out: number[] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < poly.length; i += 2) { x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]); y0 = Math.min(y0, poly[i + 1]); y1 = Math.max(y1, poly[i + 1]); }
  for (let j = Math.max(0, Math.floor(y0 * f.res)); j <= Math.min(f.h - 1, Math.ceil(y1 * f.res)); j++)
    for (let i = Math.max(0, Math.floor(x0 * f.res)); i <= Math.min(f.w - 1, Math.ceil(x1 * f.res)); i++)
      if (coverage({ poly }, (i + 0.5) / f.res, (j + 0.5) / f.res)) out.push(j * f.w + i);
  return out;
}

/** The samples of `f` a shape covers (a disc, an outline or a brush stroke), in reading order. */
export function samplesOf(f: MapField, s: Shape): number[] {
  const out: number[] = [];
  eachCovered(f, s, false, i => out.push(i));
  return out.sort((a, b) => a - b);
}

/** The lowest and highest ground among samples `ids` (water counts as 0); the first such sample in reading order wins a tie. */
function extremes(g: Ground, f: MapField, spec: MapSpec, ids?: number[]): { lowest: HeightAt; highest: HeightAt } {
  let lo = -1, hi = -1;
  const n = ids ? ids.length : f.elevation.length;
  for (let k = 0; k < n; k++) {
    const s = ids ? ids[k] : k;
    if (lo < 0 || f.elevation[s] < f.elevation[lo]) lo = s;
    if (hi < 0 || f.elevation[s] > f.elevation[hi]) hi = s;
  }
  const at = (s: number): HeightAt => ({ height: g.shown(f.elevation[s] * spec.topo.maxElevation), at: g.pt(...g.centre(s)) });
  return { lowest: at(lo), highest: at(hi) };
}

/** Where a polyline runs inside an outline: each run's entry and exit (null when the line starts or ends inside) and its length. */
function crossings(pts: number[], poly: number[]): { enters: Point | null; leaves: Point | null; length: number }[] {
  const inside = (x: number, y: number) => coverage({ poly }, x, y) > 0;
  const runs: { enters: Point | null; leaves: Point | null; length: number }[] = [];
  let cur: { enters: Point | null; leaves: Point | null; length: number } | null = null;
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2], ay = pts[i - 1], dx = pts[i] - ax, dy = pts[i + 1] - ay, len = Math.hypot(dx, dy);
    if (!len) continue;
    const ts = [0, 1];
    for (let a = poly.length - 2, b = 0; b < poly.length; a = b, b += 2) {
      const ex = poly[b] - poly[a], ey = poly[b + 1] - poly[a + 1], den = dx * ey - dy * ex;
      if (!den) continue;
      const t = ((poly[a] - ax) * ey - (poly[a + 1] - ay) * ex) / den, u = ((poly[a] - ax) * dy - (poly[a + 1] - ay) * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort((p, q) => p - q);
    for (let k = 1; k < ts.length; k++) {
      const t0 = ts[k - 1], t1 = ts[k];
      if (t1 - t0 < 1e-9) continue;
      const mid = (t0 + t1) / 2, here = inside(ax + dx * mid, ay + dy * mid);
      if (here && !cur) { cur = { enters: i === 2 && t0 === 0 ? null : [ax + dx * t0, ay + dy * t0], leaves: null, length: 0 }; runs.push(cur); }
      if (here && cur) cur.length += len * (t1 - t0);
      if (!here && cur) { cur.leaves = [ax + dx * t0, ay + dy * t0]; cur = null; }
    }
  }
  return runs;
}

/**
 * Every summit of `v` (a grid `cols` wide, 8-neighbour) with its prominence: how far you must go down from it before you
 * can climb to higher ground (for the highest summit, down to the lowest cell). Cells are taken from the highest down and
 * joined to the ground already taken; where two joined areas meet, the lower area's summit has its prominence settled.
 * Equal cells are taken in reading order, so a plateau is one summit and the cells beside it are not.
 */
function prominences(v: Float64Array, cols: number): { n: number; prominence: number }[] {
  const N = v.length, order = Array.from({ length: N }, (_, i) => i).sort((a, b) => v[b] - v[a] || a - b);
  const parent = new Int32Array(N).fill(-1), peak = new Int32Array(N), out: { n: number; prominence: number }[] = [];
  const find = (n: number): number => { while (parent[n] !== n) { parent[n] = parent[parent[n]]; n = parent[n]; } return n; };
  for (const n of order) {
    parent[n] = n; peak[n] = n;
    const i = n % cols, j = (n - i) / cols;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj, m = y * cols + x;
      if ((!di && !dj) || x < 0 || x >= cols || y < 0 || m < 0 || m >= N || parent[m] < 0) continue;
      const a = find(n), b = find(m);
      if (a === b) continue;
      // the area with the higher summit absorbs the other (the earlier one in `order` on a tie); the other's summit is settled here
      const keep = v[peak[a]] > v[peak[b]] || (v[peak[a]] === v[peak[b]] && peak[a] < peak[b]) ? a : b, lose = keep === a ? b : a;
      out.push({ n: peak[lose], prominence: v[peak[lose]] - v[n] });
      parent[lose] = keep;
    }
  }
  let lowest = 0;
  for (let n = 1; n < N; n++) if (v[n] < v[lowest]) lowest = n;
  out.push({ n: peak[find(order[0])], prominence: v[order[0]] - v[lowest] });
  return out;
}

/**
 * The hilltops and hollows. The map's cells are taken at their mean height; a hilltop is a summit that stands at least
 * {@link RULES}.prominence `topo.interval`s above the saddle that joins it to higher ground, and a hollow the same
 * turned upside down, on dry ground (above the waterline). A ridge or plateau is one summit. Hilltops go highest first,
 * hollows lowest first; each carries its height, the cell's centre and its prominence, rounded as heights are.
 */
function summits(g: Ground, f: MapField, spec: MapSpec): { hilltops: Summit[]; hollows: Summit[] } {
  const { cols, rows } = spec, N = cols * rows, r = g.res, step = spec.topo.interval, need = RULES.prominence * step;
  const cell = new Float64Array(N), flip = new Float64Array(N);
  for (let cj = 0; cj < rows; cj++) for (let ci = 0; ci < cols; ci++) {
    let s = 0;
    for (let j = cj * r; j < (cj + 1) * r; j++) for (let i = ci * r; i < (ci + 1) * r; i++) s += f.elevation[j * f.w + i];
    cell[cj * cols + ci] = (s / (r * r)) * spec.topo.maxElevation;
    flip[cj * cols + ci] = -cell[cj * cols + ci];
  }
  const out = (list: { n: number; prominence: number }[], dry: boolean, order: (a: number, b: number) => number): Summit[] => list
    .filter(c => c.prominence >= need - 1e-9 && (!dry || g.shown(cell[c.n]) > 0))
    .sort((a, b) => order(cell[a.n], cell[b.n]) || b.prominence - a.prominence || a.n - b.n)
    .map(c => ({ height: g.shown(cell[c.n]), at: g.pt((c.n % cols) + 0.5, Math.floor(c.n / cols) + 0.5), prominence: roundTo(c.prominence, step) }));
  return { hilltops: out(prominences(cell, cols), false, (a, b) => b - a), hollows: out(prominences(flip, cols), true, (a, b) => a - b) };
}

/** A polyline for listing: thinned to {@link RULES.lineTolerance}, then rounded. */
const listed = (g: Ground, pts: number[]): Point[] => {
  const t = simplifyLine({ pts, closed: false }, RULES.lineTolerance).pts, out: Point[] = [];
  for (let i = 0; i < t.length; i += 2) out.push(g.pt(t[i], t[i + 1]));
  return out;
};
const pathLength = (p: number[]) => { let s = 0; for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return s; };

/** `--area`: `x0,y0,x1,y1` is a rectangle; three or more x,y pairs are an outline. */
export function areaOutline(v: number[]): number[] {
  if (v.length === 4) return [v[0], v[1], v[2], v[1], v[2], v[3], v[0], v[3]];
  if (v.length >= 6 && v.length % 2 === 0) return v;
  throw new Error('--area: x0,y0,x1,y1 (a rectangle) or three or more x,y pairs');
}

/** The facts the query asks for: each point, each area, or (with neither) the map's own features. */
export function mapFacts(spec: MapSpec, q: MapFactsQuery = {}, field: MapField = generateMap(spec)): MapFacts {
  const g = ground(spec, field), out: MapFacts = {
    version: spec.version, id: spec.id, size: { cols: spec.cols, rows: spec.rows },
    unit: { map: 'cell', scale: spec.scale.unit, height: spec.topo.unit }, rules: RULES,
  };
  if (q.above && q.above !== 'river' && q.above !== 'lowest') throw new Error('--above: river or lowest');
  const radius = q.radius ?? RULES.radius;
  if (!(radius > 0)) throw new Error('--radius: a number above 0 (map units)');
  if (q.at?.length) {
    out.points = q.at.map(([x, y]): PointFacts => {
      if (!(x >= 0 && x <= spec.cols && y >= 0 && y <= spec.rows)) throw new Error(`at ${x},${y}: outside the map (0..${spec.cols} by 0..${spec.rows})`);
      const height = g.shown(g.height(x, y)), river = g.near('river', x, y), road = g.near('road', x, y);
      const strip = (n: ReturnType<typeof g.near>): Nearest | null => { if (!n) return null; const { rawAt: _, ...rest } = n; return rest; };
      const p: PointFacts = { at: g.pt(x, y), terrain: g.terrainAt(x, y), height, slope: g.slope(x, y), river: strip(river), road: strip(road) };
      if (q.above === 'river') {
        const ref = river && g.shown(g.height(...river.rawAt));
        p.above = { of: 'river', value: ref === null ? null : roundTo(height - ref, spec.topo.interval), reference: river && ref !== null ? { height: ref, at: river.at } : null };
      } else if (q.above === 'lowest') {
        let low: number | null = null, lowAt: Point = [x, y];
        for (let j = Math.max(0, Math.floor((y - radius) * field.res)); j <= Math.min(field.h - 1, Math.ceil((y + radius) * field.res)); j++)
          for (let i = Math.max(0, Math.floor((x - radius) * field.res)); i <= Math.min(field.w - 1, Math.ceil((x + radius) * field.res)); i++) {
            const [cx, cy] = [(i + 0.5) / field.res, (j + 0.5) / field.res];
            if (Math.hypot(cx - x, cy - y) <= radius && (low === null || field.elevation[j * field.w + i] < low)) { low = field.elevation[j * field.w + i]; lowAt = [cx, cy]; }
          }
        const ref = g.shown((low ?? 0) * spec.topo.maxElevation);
        p.above = { of: 'lowest', value: roundTo(height - ref, spec.topo.interval), reference: { height: ref, at: g.pt(...lowAt) } };
      }
      return p;
    });
  }
  if (q.areas?.length) {
    out.areas = q.areas.map((poly): AreaFacts => {
      const ids = samplesIn(field, poly);
      if (!ids.length) throw new Error(`area ${poly.join(',')}: holds no ground (inside the map and larger than a sample, ${(1 / field.res).toFixed(2)} cells)`);
      const cross = (kind: 'river' | 'road'): Crossing[] => g.lines.filter(l => l.kind === kind).flatMap(l => crossings(l.pts, poly).map(c => ({
        name: l.name, ...(l.source && { source: l.source }), enters: c.enters && g.pt(...c.enters), leaves: c.leaves && g.pt(...c.leaves), length: g.length(c.length),
      })));
      const pairs: Point[] = [];
      for (let i = 0; i < poly.length; i += 2) pairs.push(g.pt(poly[i], poly[i + 1]));
      return { area: pairs, terrain: shares(field, ids), ...extremes(g, field, spec, ids), rivers: cross('river'), roads: cross('road') };
    });
  }
  if (!out.points && !out.areas) {
    const line = (l: (typeof g.lines)[number]): Line => ({ name: l.name, ...(l.source && { source: l.source }), points: listed(g, l.pts), length: g.length(pathLength(l.pts)), ...(l.mouth !== undefined && { mouth: l.mouth }) });
    out.features = {
      rivers: g.lines.filter(l => l.kind === 'river' && l.source !== 'generated').map(line), generatedRivers: g.lines.filter(l => l.kind === 'river' && l.source === 'generated').map(line),
      roads: g.lines.filter(l => l.kind === 'road').map(line), ...summits(g, field, spec), terrain: shares(field), ...extremes(g, field, spec),
    };
  }
  return out;
}
