/**
 * Tile grids (R7c, docs/TILEMAPS.md §3): a map file read as cells for a tile editor or a game. Each cell holds one
 * class (floor, wall, grass, road…; 0 is empty) sampled at the cell's centre, and the map's named things (rooms, doors,
 * labels, buildings, rivers…) become objects in cell coordinates. The Tiled and LDtk writers (`tiled.ts`, `ldtk.ts`)
 * and the tileset binding (`tileset.ts`) read only this, so every map engine exports through one path.
 */
import { DUNGEON_FORMAT, type DungeonSpec } from '../dungeon/spec.ts';
import { layoutDungeon, inPolygon } from '../dungeon/layout.ts';
import { layoutWalls } from '../dungeon/walls.ts';
import { layoutExits } from '../dungeon/exits.ts';
import { nearestOnLine } from '../dungeon/geom.ts';
import { TERRAINS, TERRAIN_NAMES, MAP_FORMAT, type MapSpec } from '../map/spec.ts';
import { generateMap, type MapField } from '../map/generate.ts';
import { THEME } from '../map/theme.ts';
import { SETTLEMENT_FORMAT, type SettlementSpec } from '../settlement/spec.ts';
import { layoutSettlement, inWater } from '../settlement/layout.ts';
import { PALETTES, roofTone } from '../settlement/theme.ts';

/** One kind of cell. Its index in `classes` + 1 is the value in `cells` (0 = empty). */
export interface TileClass {
  id: string;
  name: string;
  /** Hex colour of the class: the placeholder tile, the LDtk IntGrid value, the legend. */
  color: string;
  /** Blocks movement (walls, deep water, buildings): Tiled tile property and LDtk tag `solid`. */
  solid?: boolean;
}

export type PropValue = string | number | boolean;

/**
 * A named thing on the map, in cells (x right, y down, from the map's top-left corner). A shape is a point (`x, y`),
 * a box (`w, h` from `x, y`), a closed `polygon` or an open `polyline` (points relative to `x, y`), or a `text`.
 */
export interface TileObject {
  /** The object layer it goes in (`rooms`, `doors`, `labels`…). */
  layer: string;
  /** What it is (`room`, `door`, `label`, `building`, `river`…): Tiled's object class, LDtk's entity. */
  type: string;
  name?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  /** Degrees clockwise. */
  angle?: number;
  polygon?: number[];
  polyline?: number[];
  text?: string;
  props: Record<string, PropValue>;
}

export type TileSource = 'dungeon' | 'map' | 'settlement' | 'tileset';

export interface TileGrid {
  source: TileSource;
  id: string;
  title?: string;
  /** The map file's format version, so a reader knows which file the grid came from. */
  format: number;
  cols: number;
  rows: number;
  /** What one cell is in the map's own unit (5 ft, 1 mile…). */
  cell: { size: number; unit: string };
  /** `hex`: flat-top hexagons, odd columns half a cell down (a terrain map's hex grid). */
  grid: 'square' | 'hex';
  classes: TileClass[];
  /** cols × rows, row by row: class index + 1, 0 = empty. */
  cells: Uint8Array;
  objects: TileObject[];
}

/** The class at (x, y), or undefined off the grid or on an empty cell. */
export function classAt(g: TileGrid, x: number, y: number): TileClass | undefined {
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return undefined;
  const v = g.cells[y * g.cols + x];
  return v ? g.classes[v - 1] : undefined;
}

/** How many cells of each class (by id), for summaries and tests. */
export function classCounts(g: TileGrid): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(g.classes.map(c => [c.id, 0]));
  for (const v of g.cells) if (v) out[g.classes[v - 1].id]++;
  return out;
}

const rel = (pts: number[], x: number, y: number) => pts.map((v, i) => +(v - (i % 2 ? y : x)).toFixed(4));
const r4 = (v: number) => +v.toFixed(4);
const bboxOf = (pts: number[]) => {
  const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
/** A polyline or polygon object anchored at its first point. */
function shaped(layer: string, type: string, pts: number[], closed: boolean, props: Record<string, PropValue>, name?: string): TileObject {
  const x = r4(pts[0]), y = r4(pts[1]);
  return { layer, type, ...(name && { name }), x, y, [closed ? 'polygon' : 'polyline']: rel(pts, x, y), props };
}
const clean = (o: Record<string, PropValue | undefined | null>): Record<string, PropValue> =>
  Object.fromEntries(Object.entries(o).filter((e): e is [string, PropValue] => e[1] !== undefined && e[1] !== null && e[1] !== ''));

// ---- dungeons -------------------------------------------------------------------------------------------------------

export const DUNGEON_CLASSES: TileClass[] = [
  { id: 'floor', name: 'Floor', color: '#d8d2c4' },
  { id: 'wall', name: 'Wall', color: '#3a3632', solid: true },
  { id: 'door', name: 'Door', color: '#9a6a3a' },
  { id: 'yard', name: 'Open ground', color: '#b9c79a' },
];

/**
 * A dungeon as cells: `floor` where a room or corridor covers the cell's centre (a building's room too), `yard` for open
 * ground, `door` the corridor cell a door opens on, and `wall` every empty cell next to a floor (eight ways) or under a
 * curtain wall. Cellars are drawn above the ground, so they are objects only. The walls rooms share run along cell
 * edges, so they go in the `walls` object layer as segments.
 */
export function dungeonTiles(spec: DungeonSpec): TileGrid {
  const l = layoutDungeon(spec), W = spec.cols, H = spec.rows, cells = new Uint8Array(W * H);
  const FLOOR = 1, WALL = 2, DOOR = 3, YARD = 4;
  const rooms = l.rooms.filter(g => g.room.fill !== 'cellar');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + 0.5, py = y + 0.5;
    let v = 0;
    for (const g of rooms) if (inPolygon(g.outline, px, py)) { v = g.room.fill === 'yard' ? YARD : FLOOR; if (v === FLOOR) break; }
    if (!v) for (const c of l.corridors) {
      if (c.outline ? inPolygon(c.outline, px, py) : c.pts.length >= 4 && nearestOnLine(c.pts, px, py).d < c.width / 2) { v = FLOOR; break; }
    }
    cells[y * W + x] = v;
  }
  for (const d of l.doors) {
    const a = (d.angle * Math.PI) / 180, x = Math.floor(d.x + Math.cos(a) * 0.5), y = Math.floor(d.y + Math.sin(a) * 0.5);
    if (x >= 0 && y >= 0 && x < W && y < H && cells[y * W + x] === FLOOR) cells[y * W + x] = DOOR;
  }
  const walls = layoutWalls(spec, l);
  const wallCell = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (cells[i]) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && (cells[ny * W + nx] === FLOOR || cells[ny * W + nx] === DOOR)) near = true;
    }
    if (!near) for (const w of walls) if (nearestOnLine([...w.ring, w.ring[0], w.ring[1]], x + 0.5, y + 0.5).d < w.thickness / 2) { near = true; break; }
    if (near) wallCell[i] = 1;
  }
  for (let i = 0; i < cells.length; i++) if (wallCell[i]) cells[i] = WALL;

  const objects: TileObject[] = [];
  for (const g of l.rooms) {
    const r = g.room;
    objects.push({ ...shaped('rooms', 'room', g.outline, true, clean({ id: r.id, number: g.number, label: r.label, fill: r.fill ?? 'floor', shape: r.shape, href: r.href }), r.label ?? r.id) });
  }
  l.corridors.forEach((c, i) => {
    if (c.pts.length >= 4) objects.push(shaped('corridors', 'corridor', c.pts, false, clean({ id: spec.corridors[i].id, width: c.width, style: spec.corridors[i].style ?? 'built' }), spec.corridors[i].id));
  });
  for (const d of l.doors) objects.push({ layer: 'doors', type: 'door', name: d.kind, x: r4(d.x), y: r4(d.y), angle: r4(d.angle), props: clean({ kind: d.kind, width: d.width, corridor: d.corridor >= 0 ? d.corridor : undefined, connection: d.connection }) });
  for (const c of l.connections) if (c.kind === 'open') objects.push({ layer: 'doors', type: 'opening', name: 'open', x: r4(c.x), y: r4(c.y), angle: r4(c.angle), props: clean({ kind: 'open', width: c.width, a: c.a, b: c.b }) });
  for (const p of l.partitions) objects.push(shaped('walls', 'wall', p, false, { kind: 'shared' }));
  for (const w of walls) {
    objects.push(shaped('walls', 'curtain', w.ring, true, clean({ id: w.id, thickness: w.thickness })));
    for (const t of w.towers) objects.push({ layer: 'walls', type: 'tower', x: r4(t.x), y: r4(t.y), props: { shape: t.shape, size: t.size } });
    for (const gt of w.gates) objects.push({ layer: 'walls', type: 'gate', x: r4(gt.x), y: r4(gt.y), props: clean({ kind: gt.kind }) });
  }
  for (const e of layoutExits(spec, l)) objects.push({ layer: 'exits', type: 'exit', name: e.exit.text, x: r4(e.edge[0]), y: r4(e.edge[1]), props: clean({ text: e.exit.text, href: e.exit.href, offMap: e.off }) });
  for (const lb of spec.overlay.labels) objects.push({ layer: 'labels', type: 'label', name: lb.text, x: lb.x, y: lb.y, text: lb.text, ...(lb.angle && { angle: lb.angle }), props: clean({ kind: lb.kind, size: lb.size, href: lb.href }) });
  for (const s of spec.overlay.symbols) objects.push({ layer: 'symbols', type: 'symbol', name: s.kind, x: s.x, y: s.y, ...(s.angle && { angle: s.angle }), props: clean({ kind: s.kind, scale: s.scale }) });
  return {
    source: 'dungeon', id: spec.id, ...(spec.title && { title: spec.title }), format: DUNGEON_FORMAT, cols: W, rows: H,
    cell: { size: spec.scale.perCell, unit: spec.scale.unit }, grid: 'square', classes: DUNGEON_CLASSES, cells, objects,
  };
}

// ---- terrain maps ---------------------------------------------------------------------------------------------------

/** The flat-top hex layout of a terrain map's hex grid: hexes `size` across the flats, odd columns half a hex down. */
export function hexLayout(spec: Pick<MapSpec, 'cols' | 'rows' | 'grid'>): { cols: number; rows: number; R: number; s: number; centre(c: number, r: number): [number, number] } {
  const s = spec.grid.size, R = s / Math.sqrt(3);
  const cols = Math.max(1, Math.ceil((spec.cols - R) / (1.5 * R) + 1e-9)), rows = Math.max(1, Math.ceil(spec.rows / s - 1e-9));
  return { cols, rows, R, s, centre: (c, r) => [R + c * 1.5 * R, s / 2 + r * s + (c % 2 ? s / 2 : 0)] };
}

/**
 * A terrain map as cells: the terrain most of the cell's height-field samples have (on a hex grid, the samples within
 * the hex's inner circle). A square grid's cell is the grid's size; with no grid one map unit. Rivers and roads are
 * polylines (with their width), labels and symbols points.
 */
export function mapTiles(spec: MapSpec, field: MapField = generateMap(spec), o: { cell?: number } = {}): TileGrid {
  const theme = THEME.color, classes: TileClass[] = TERRAINS.map(t => ({ id: t, name: TERRAIN_NAMES[t], color: theme.terrain[t].fill, ...((t === 'deep' || t === 'rock') && { solid: true }) }));
  const hex = spec.grid.type === 'hex' && !o.cell;
  const unit = o.cell ?? (spec.grid.type === 'square' ? spec.grid.size : 1);
  const count = new Uint32Array(TERRAINS.length);
  /** The commonest terrain among the samples a test accepts in a box (ties go to the lower index). */
  const majority = (x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean) => {
    count.fill(0);
    const i0 = Math.max(0, Math.floor(x0 * field.res)), i1 = Math.min(field.w - 1, Math.ceil(x1 * field.res)), j0 = Math.max(0, Math.floor(y0 * field.res)), j1 = Math.min(field.h - 1, Math.ceil(y1 * field.res));
    let any = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const sx = (i + 0.5) / field.res, sy = (j + 0.5) / field.res;
      if (sx < x0 || sx >= x1 || sy < y0 || sy >= y1 || !inside(sx, sy)) continue;
      count[field.terrain[j * field.w + i]]++; any = true;
    }
    if (!any) {
      const i = Math.min(field.w - 1, Math.max(0, Math.floor(((x0 + x1) / 2) * field.res))), j = Math.min(field.h - 1, Math.max(0, Math.floor(((y0 + y1) / 2) * field.res)));
      return field.terrain[j * field.w + i] + 1;
    }
    let best = 0;
    for (let k = 1; k < count.length; k++) if (count[k] > count[best]) best = k;
    return best + 1;
  };
  let cols: number, rows: number, cells: Uint8Array;
  if (hex) {
    const h = hexLayout(spec), r2 = (h.s / 2) ** 2;
    cols = h.cols; rows = h.rows; cells = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const [cx, cy] = h.centre(c, r);
      cells[r * cols + c] = majority(cx - h.R, cy - h.s / 2, cx + h.R, cy + h.s / 2, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r2);
    }
  } else {
    cols = Math.max(1, Math.ceil(spec.cols / unit - 1e-9)); rows = Math.max(1, Math.ceil(spec.rows / unit - 1e-9)); cells = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells[y * cols + x] = majority(x * unit, y * unit, (x + 1) * unit, (y + 1) * unit, () => true);
  }
  // objects are placed in cells: map units over the cell's size (hex: over its column and row pitch)
  const h = hex ? hexLayout(spec) : undefined;
  const toCell = (pts: number[]) => pts.map((v, i) => (h ? (i % 2 ? v / h.s : (v - h.R) / (1.5 * h.R) + 0.5) : v / unit));
  const per = h ? h.s : unit;   // map units across one cell, for widths
  const objects: TileObject[] = [];
  field.rivers.forEach((rv, i) => objects.push(shaped('water', 'river', toCell(rv.pts), false, clean({ width: r4(Math.max(...rv.widths) / per), mouth: rv.mouth }), `river ${i + 1}`)));
  field.roads.forEach((rd, i) => objects.push(shaped('roads', 'road', toCell(rd.pts), false, clean({ width: r4(rd.width / per), for: rd.for }), `road ${i + 1}`)));
  for (const lb of spec.overlay.labels) { const [x, y] = toCell([lb.x, lb.y]); objects.push({ layer: 'labels', type: 'label', name: lb.text, x: r4(x), y: r4(y), text: lb.text, ...(lb.angle && { angle: lb.angle }), props: clean({ kind: lb.kind, size: lb.size }) }); }
  for (const s of spec.overlay.symbols) { const [x, y] = toCell([s.x, s.y]); objects.push({ layer: 'symbols', type: 'symbol', name: s.kind, x: r4(x), y: r4(y), ...(s.angle && { angle: s.angle }), props: clean({ kind: s.kind, scale: s.scale }) }); }
  return {
    source: 'map', id: spec.id, ...(spec.title && { title: spec.title }), format: MAP_FORMAT, cols, rows,
    cell: { size: r4((hex ? spec.grid.size : unit) * spec.scale.perCell), unit: spec.scale.unit }, grid: hex ? 'hex' : 'square', classes, cells, objects,
  };
}

// ---- settlements ----------------------------------------------------------------------------------------------------

/**
 * A settlement's site as cells, the topmost thing at the cell's centre: a building, then a wall, a bridge, a road,
 * water, an area (fields, woods, squares…) and the ground. Buildings are polygons with their kind, number and name;
 * roads, rivers and walls polylines; trees, props, towers and gates points.
 */
export function settlementTiles(spec: SettlementSpec): TileGrid {
  const pal = PALETTES.color, l = layoutSettlement(spec), W = spec.cols, H = spec.rows;
  const areaKinds = [...new Set(spec.areas.map(a => a.kind))].sort();
  const classes: TileClass[] = [
    { id: 'ground', name: `Ground (${spec.ground})`, color: pal.ground[spec.ground] },
    { id: 'road', name: 'Road', color: pal.road.street.fill },
    { id: 'water', name: 'Water', color: pal.water, solid: true },
    { id: 'bridge', name: 'Bridge', color: pal.road.highway.fill },
    { id: 'wall', name: 'Wall', color: '#6f675a', solid: true },
    { id: 'building', name: 'Building', color: pal.roof.tile, solid: true },
    ...areaKinds.map(k => ({ id: `area-${k}`, name: k[0].toUpperCase() + k.slice(1), color: pal.area[k].fill === 'none' ? pal.ground[spec.ground] : pal.area[k].fill })),
  ];
  const at = Object.fromEntries(classes.map((c, i) => [c.id, i + 1]));
  const cells = new Uint8Array(W * H);
  const onLine = (pts: number[], closed: boolean, x: number, y: number, half: number) => pts.length >= 4 && nearestOnLine(closed ? [...pts, pts[0], pts[1]] : pts, x, y).d < half;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + 0.5, py = y + 0.5;
    let v = at.ground;
    for (const a of spec.areas) if (inPolygon(a.points, px, py)) v = at[`area-${a.kind}`];
    if (inWater(l.water, px, py)) v = at.water;
    for (const r of l.roads) if (onLine(r.pts, false, px, py, Math.max(0.5, r.width / 2))) { v = at.road; break; }
    for (const b of l.bridges) if (nearestOnLine([b.x0, b.y0, b.x1, b.y1], px, py).d < Math.max(0.5, b.width / 2)) { v = at.bridge; break; }
    for (const w of l.walls) if (onLine(w.pts, w.closed, px, py, Math.max(0.5, w.thickness / 2))) {
      const gate = w.gates.some(g => Math.hypot(g.x - px, g.y - py) < g.width / 2 + 0.5);
      v = gate ? at.road : at.wall;
      break;
    }
    for (const b of l.buildings) if (inPolygon(b.outline, px, py)) { v = at.building; break; }
    cells[y * W + x] = v;
  }
  const objects: TileObject[] = [];
  for (const b of l.buildings) objects.push(shaped('buildings', 'building', b.outline, true, clean({ id: b.building.id, kind: b.building.kind, number: b.number, label: b.building.label, roof: roofTone(b.building.kind), stories: b.building.stories, floors: b.building.floors?.length, href: b.building.href }), b.building.label ?? b.building.id));
  l.roads.forEach((r, i) => objects.push(shaped('roads', 'road', r.pts, false, clean({ id: spec.roads[i].id, kind: r.kind, width: r4(r.width), label: spec.roads[i].label }), spec.roads[i].label ?? spec.roads[i].id)));
  l.water.forEach((w, i) => objects.push(shaped('water', w.kind, w.pts, w.area || w.closed, clean({ id: spec.water[i].id, kind: w.kind, width: w.area ? undefined : r4(w.width) }), spec.water[i].id)));
  for (const w of l.walls) {
    objects.push(shaped('walls', 'wall', w.pts, w.closed, clean({ id: spec.walls[w.index].id, kind: w.kind, thickness: r4(w.thickness) }), spec.walls[w.index].id));
    for (const t of w.towers) objects.push({ layer: 'walls', type: 'tower', x: r4(t.x), y: r4(t.y), props: { shape: t.shape, size: r4(t.size) } });
    for (const g of w.gates) objects.push({ layer: 'walls', type: 'gate', name: g.kind, x: r4(g.x), y: r4(g.y), angle: r4(g.angle), props: clean({ kind: g.kind, width: r4(g.width), drawbridge: g.drawbridge > 0 || undefined }) });
  }
  spec.areas.forEach(a => { const b = bboxOf(a.points); if (b.w > 0) objects.push(shaped('areas', 'area', a.points, true, clean({ id: a.id, kind: a.kind, label: a.label }), a.label ?? a.id)); });
  for (const t of [...spec.trees, ...l.areaTrees]) objects.push({ layer: 'trees', type: t.kind, x: r4(t.x), y: r4(t.y), props: clean({ kind: t.kind, size: t.size && r4(t.size) }) });
  for (const p of spec.props) objects.push({ layer: 'props', type: 'prop', name: p.kind, x: r4(p.x), y: r4(p.y), ...(p.angle && { angle: p.angle }), props: clean({ kind: p.kind, label: p.label }) });
  for (const lb of spec.overlay.labels) objects.push({ layer: 'labels', type: 'label', name: lb.text, x: lb.x, y: lb.y, text: lb.text, ...(lb.angle && { angle: lb.angle }), props: clean({ kind: lb.kind, size: lb.size, href: lb.href }) });
  for (const s of spec.overlay.symbols) objects.push({ layer: 'symbols', type: 'symbol', name: s.kind, x: s.x, y: s.y, ...(s.angle && { angle: s.angle }), props: clean({ kind: s.kind, scale: s.scale }) });
  return {
    source: 'settlement', id: spec.id, ...(spec.title && { title: spec.title }), format: SETTLEMENT_FORMAT, cols: W, rows: H,
    cell: { size: spec.scale.perCell, unit: spec.scale.unit }, grid: 'square', classes, cells, objects,
  };
}

// ---- a tileset on its own -------------------------------------------------------------------------------------------

/**
 * The grid a tileset exports with (`artgen tileset`): an island of the class in a `size × size` map (the same island the
 * autotile review draws), so the Tiled and LDtk files open on the tiles in use. A plain tile fills the map.
 */
export function tilesetTiles(id: string, cls: TileClass, o: { size?: number; island?: boolean; seed?: number } = {}): TileGrid {
  const n = o.size ?? 10, seed = o.seed ?? 3, cells = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x - (n - 1) / 2, dy = y - (n - 1) / 2;
    cells[y * n + x] = !o.island || Math.hypot(dx * 1.1, dy) < n * 0.36 + Math.sin(x * 1.7 + y * 2.3 + seed) * 0.9 ? 1 : 0;
  }
  return { source: 'tileset', id, format: 1, cols: n, rows: n, cell: { size: 1, unit: 'cell' }, grid: 'square', classes: [cls], cells, objects: [] };
}
