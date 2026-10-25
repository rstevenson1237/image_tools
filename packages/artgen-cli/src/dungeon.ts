/**
 * Dungeon maps for tabletop games (`artgen dungeon …`): `art/dungeons/<id>/dungeon.json` is the map; renders go to
 * `art/dungeons/<id>/out/` (rebuilt from the file, gitignored). The CLI, the MCP server and the web tool's Dungeon Map
 * all read and write the same file.
 *
 *   artgen dungeon new <id> [--size 40x30] [--seed n] [--title "…"] [--empty]          a generated dungeon (or none)
 *   artgen dungeon new <id> --room rect|circle|octagon|cave --room-size 8x6 [--exits n,e:secret,s:none,w] [--label "…"] [--number n|off]
 *   artgen dungeon gen <id> [--seed n] [--rooms n] [--min-size n] [--max-size n] [--caves f] [--round f] [--loops f]
 *                           [--doors f] [--corridor-width n] [--spacing n] [--entrance on|off] [--size 40x30] [--layout scatter|dense|blocks] [--density f]
 *   artgen dungeon room <id> add <shape> --at x,y|C4 --size WxH [--points x,y,…] [--label "…"] [--number n|off] [--room-id r9]
 *                     | move <rid> --at x,y|C4 | set <rid> [--shape s] [--size WxH] [--label "…"] [--number n|off] | rm <rid>
 *   artgen dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id> [--width 1] [--route auto|hv|vh|straight|around] [--via x,y,…] [--doors door,none]
 *                      [--from-side n|e|s|w [--from-offset n]] [--to-side …] [--curve smooth] [--style natural [--seed n]] [--id name]
 *                      [--exit "To the caves" [--exit-href url] [--fade 3]]   (a point end past the edge: fades out, with a note)
 *   artgen dungeon unlink <id> <index> | door <id> <index> from|to <kind|none>
 *   artgen dungeon block <id> add rect|octagon|circle|hex|poly --at x,y --size WxH [--split bsp|rows|cols|grid|cuts] [--min 3] [--seed n] | split <bid> [--seed n] | rm <bid>
 *   artgen dungeon connect <id> <room> <room> [--kind door|…|open] [--at x,y] [--width 1] | disconnect <id> <index>
 *   artgen dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all]
 *   artgen dungeon style <id> [--hatch band|full|none] [--band n] [--wall f] [--numbers on|off] [--scale-bar on|off]
 *                            [--compass on|off] [--title "…"] [--per-cell n --unit ft] [--furniture over|outside|auto [--furniture-side bottom|right]]
 *   artgen dungeon label <id> "Text" --at x,y|C4 [--kind name|note|area] [--size f] [--angle deg] [--href url]
 *   artgen dungeon symbol <id> <kind> --at x,y|C4 [--scale f] [--angle deg] | artgen dungeon symbols
 *   artgen dungeon overlay <id> rm label|symbol <index> | clear [labels|symbols]
 *   artgen dungeon fit <id> [--margin 2] | render <id> [--format svg|png|both] [--ppu 40 | --fit 180x260mm] [--crop x,y,w,h] [--room id [--margin 2]]… [--layers grid=off,labels=off] [--out dir]
 *   artgen dungeon show <id> | list
 *   artgen dungeon facts <id>   rooms, corridors, exits, overlaps and unreached rooms, as numbers (--json)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { clampCrop, dungeon, encodePNG, fitPpu, map, PX_PER_MM, rasterizeSvg, type Crop, type Fit, type SizeUnit } from 'artgen-core/maps';
import { svgSize } from './map.ts';
import { initNodeMapSvg } from './node-svg.ts';
import { fileStem, readJson, writeJson, type FileRef, type Project } from './projectfs.ts';

type DungeonSpec = dungeon.DungeonSpec;

/** A dungeon in a project (its id) or a file by path (`--file`, no project). */
export type DungeonRef = string | FileRef;

export const dungeonsDir = (p: Project): string => join(p.art, 'dungeons');

/** `art/dungeons/<id>/dungeon.json`; ids are names, never paths, so nothing outside `art/dungeons` is touched. */
export function dungeonFile(p: Project | null, ref: DungeonRef): string {
  if (typeof ref !== 'string') return resolve(ref.file);
  if (!/^[\w-]+$/.test(ref ?? '')) throw new Error(`dungeon id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p) throw new Error('no artgen project here: name the dungeon file with --file <path>');
  return join(dungeonsDir(p), ref, 'dungeon.json');
}

/** A file path as shown to the user: from the project root, else from the working directory. */
const shown = (p: Project | null, f: string): string => relative(p?.root ?? process.cwd(), f);

export const dungeonSummary = (m: DungeonSpec) =>
  ({ id: m.id, size: `${m.cols}x${m.rows}`, ...(m.title && { title: m.title }), rooms: m.rooms.length, corridors: m.corridors.length, labels: m.overlay.labels.length, symbols: m.overlay.symbols.length });

export function listDungeons(p: Project): ReturnType<typeof dungeonSummary>[] {
  if (!existsSync(dungeonsDir(p))) return [];
  return readdirSync(dungeonsDir(p), { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(dungeonsDir(p), d.name, 'dungeon.json'))).map(d => dungeonSummary(readDungeon(p, d.name)));
}

export function readDungeon(p: Project | null, ref: DungeonRef): DungeonSpec {
  const f = dungeonFile(p, ref);
  if (!existsSync(f)) throw new Error(typeof ref === 'string' ? `no dungeon ${ref} (${shown(p, f)}) — artgen dungeon new ${ref}` : `no dungeon file ${shown(p, f)} — artgen dungeon new --file ${ref.file}`);
  return dungeon.parseDungeon(readJson(f));
}

/** Validate and write a dungeon; `ref` is where (default: the project's file for the dungeon's own id). */
export function writeDungeon(p: Project | null, m: DungeonSpec, ref: DungeonRef = m.id): string {
  const spec = dungeon.parseDungeon(m), f = dungeonFile(p, ref);
  writeJson(f, spec);
  return shown(p, f);
}

export function createDungeon(p: Project | null, m: DungeonSpec, force = false, at: DungeonRef = m.id): { file: string; dungeon: DungeonSpec } {
  if (existsSync(dungeonFile(p, at)) && !force) throw new Error(typeof at === 'string' ? `dungeon ${m.id} already exists (edit it, or pick another id)` : `${shown(p, dungeonFile(p, at))} already exists (edit it, or --force)`);
  return { file: writeDungeon(p, m, at), dungeon: m };
}

/** Read, change, validate and write a dungeon in one step; `change` may return a replacement spec. */
export function updateDungeon(p: Project | null, ref: DungeonRef, change: (m: DungeonSpec) => DungeonSpec | void): DungeonSpec {
  const m = readDungeon(p, ref), next = change(m) ?? m;
  writeDungeon(p, next, ref);
  return next;
}

/**
 * What `dungeon check` finds in a file as a consumer wrote it: every problem with its JSON path. `errors` are the file's
 * own (a field out of range, a room id that is not there) and drawing errors (a room whose outline crosses itself);
 * `warnings` are what most likely draws other than meant (a corridor through a room it does not join, rooms laid over
 * each other). Only errors make it not `ok`.
 */
export interface DungeonCheck { file: string; ok: boolean; errors: dungeon.Issue[]; warnings: dungeon.Issue[] }

export function checkDungeonFile(p: Project | null, ref: DungeonRef): DungeonCheck {
  const f = dungeonFile(p, ref);
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(f, 'utf8')); } catch (e) {
    const missing = (e as NodeJS.ErrnoException).code === 'ENOENT';
    return { file: shown(p, f), ok: false, errors: [{ path: '', message: missing ? `no such file: ${shown(p, f)}` : `not JSON: ${(e as Error).message}` }], warnings: [] };
  }
  const r = dungeon.checkDungeon(raw), errors = [...r.errors], warnings: dungeon.Issue[] = [];
  if (!errors.length) for (const x of dungeon.lintDungeon(dungeon.parseDungeon(raw))) (x.severity === 'error' ? errors : warnings).push({ path: x.path, message: x.message });
  const u = (raw as { underlay?: { map?: unknown } } | null)?.underlay;
  if (!errors.some(e => e.path.startsWith('underlay')) && u && typeof u.map === 'string' && !existsSync(resolve(dirname(f), u.map)))
    errors.push({ path: 'underlay.map', message: `no such map file ${u.map}` });
  return { file: shown(p, f), ok: !errors.length, errors, warnings };
}

export interface DungeonRender {
  files: string[]; rooms: number; corridors: number; doors: number;
  /** The render in pixels (the window and any furniture band beside it). */
  size: [number, number];
  /** The window drawn, in cells (the whole sheet when there is no crop), and the pixels per cell it was drawn at. */
  crop: Crop; ppu: number;
  /** The SVG's own width and height, in its unit (`--fit` in mm gives millimetres). */
  svg: { width: number; height: number; unit: SizeUnit };
  /** Output pixels per millimetre when sizes were set against the page (`--fit` or `--page-scale`), else null. */
  pageScale: number | null;
  /** Labels that found no free spot on the page (only with a page scale). */
  unplaced: dungeon.UnplacedLabel[];
}

/** The map an `underlay` names: its path is from the dungeon file's folder. Null when the file has no underlay. */
export function readUnderlay(p: Project | null, ref: DungeonRef, m: DungeonSpec): { map: map.MapSpec; field: map.MapField } | null {
  if (!m.underlay) return null;
  const f = resolve(dirname(dungeonFile(p, ref)), m.underlay.map);
  if (!existsSync(f)) throw new Error(`underlay.map: no such map file ${m.underlay.map} (looked for ${shown(p, f)})`);
  const spec = map.parseMap(readJson(f));
  return { map: spec, field: map.generateMap(spec) };
}

/** Render a dungeon to SVG and/or PNG (black and white). */
export async function renderDungeonFiles(p: Project | null, ref: DungeonRef, o: { formats?: ('svg' | 'png')[]; ppu?: number; crop?: Crop; fit?: Fit; pageScale?: number; rooms?: string[]; margin?: number; layers?: Partial<Record<dungeon.DungeonLayer, boolean>>; out?: string } = {}): Promise<DungeonRender> {
  // a project dungeon renders to its out/ folder as <id>.…; a file renders beside itself as <file name>.…
  const m = readDungeon(p, ref), layout = dungeon.layoutDungeon(m), id = typeof ref === 'string' ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === 'string' ? join(dungeonsDir(p!), id, 'out') : dirname(dungeonFile(p, ref)));
  const formats = o.formats ?? ['svg', 'png'], files: string[] = [];
  if (o.fit && o.ppu !== undefined) throw new Error('--fit and --ppu both set the scale: use one');
  if (o.crop && o.rooms?.length) throw new Error('--crop and --room both set the window: use one');
  if (o.margin !== undefined && !o.rooms?.length) throw new Error('--margin goes with --room');
  const window = o.rooms?.length ? dungeon.roomCrop(m, o.rooms, o.margin, layout) : o.crop;
  const crop = clampCrop(window ?? [0, 0, m.cols, m.rows], m.cols, m.rows), unit = o.fit?.unit ?? 'px';
  const pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : undefined), underlay = readUnderlay(p, ref, m);
  const view = { layers: o.layers, layout, ...(window && { crop }), pageScale };
  // a furniture band takes room from the page a render is fitted to: the largest scale whose render (map and band)
  // still fits, found by halving (the render grows with the scale)
  let ppu = o.fit ? fitPpu(crop[2], crop[3], o.fit) : o.ppu ?? 40;
  const fits = (k: number) => { const r = dungeon.dungeonRenderSize(m, { ...view, ppu: k }), f = o.fit!.unit === 'mm' ? PX_PER_MM : 1; return r.width <= o.fit!.w * f + 1e-6 && r.height <= o.fit!.h * f + 1e-6; };
  if (o.fit && !fits(ppu)) {
    let lo = 0, hi = ppu;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    ppu = lo;
  }
  const px = dungeon.dungeonRenderSize(m, { ...view, ppu }), size: [number, number] = [Math.round(px.width), Math.round(px.height)];
  if (formats.includes('png')) await initNodeMapSvg();
  mkdirSync(out, { recursive: true });
  const svg = dungeon.renderDungeonSvg(m, { ...view, ppu, unit, ...(underlay && { underlay }) }), base = join(out, id);
  if (formats.includes('svg')) { writeFileSync(`${base}.svg`, svg); files.push(`${base}.svg`); }
  if (formats.includes('png')) { writeFileSync(`${base}.png`, encodePNG(rasterizeSvg(svg, size[0], size[1]))); files.push(`${base}.png`); }
  return { files: files.map(f => relative(process.cwd(), f)), rooms: m.rooms.length, corridors: m.corridors.length, doors: layout.doors.length, size, crop, ppu, svg: svgSize([0, 0, px.width, px.height], 1, unit), pageScale: pageScale ?? null, unplaced: dungeon.dungeonLabelLayout(m, ppu, pageScale, layout).unplaced };
}

/** A room's top-left corner: `x,y` as given, or a cell name (`C4`) meaning that cell's corner. */
export function cornerPoint(at: string): [number, number] {
  const [x, y] = dungeon.parsePoint(at);
  return /^\s*-?[\d.]+\s*,/.test(at) ? [x, y] : [Math.floor(x), Math.floor(y)];
}

/**
 * A corridor end: a room id in the dungeon (leaving by its `side` wall, `offset` cells along, when given), a corridor
 * (`corridor:<id>`, or an id no room has) for a junction, else a point.
 */
export function corridorEnd(m: DungeonSpec, ref: string, side?: string, offset?: number): dungeon.CorridorEnd {
  if (side !== undefined && !dungeon.SIDES.includes(side as dungeon.Side)) throw new Error(`--from-side / --to-side: ${dungeon.SIDES.join(', ')}`);
  if (m.rooms.some(r => r.id === ref)) return { room: ref, ...(side && { side: side as dungeon.Side }), ...(side && offset !== undefined && { offset }) };
  if (side) throw new Error(`a side goes with a room end, and ${ref} is not a room`);
  const c = ref.replace(/^corridor:/, '');
  if (ref.startsWith('corridor:') || m.corridors.some(x => x.id === c)) {
    if (!m.corridors.some(x => x.id === c)) throw new Error(`no corridor with id ${c} (give one an id: link … --id ${c})`);
    return { corridor: c };
  }
  return { at: dungeon.parsePoint(ref) };
}

/** A corridor end as text: a room (and the wall it leaves by), a point, or the corridor it joins. */
export const endText = (e: dungeon.CorridorEnd): string =>
  'room' in e ? `${e.room}${e.side ? `.${e.side}${e.offset !== undefined ? `+${e.offset}` : ''}` : ''}` : 'at' in e ? `(${e.at.join(',')})${e.exit ? ` "${e.exit.text}"` : ''}` : `corridor ${e.corridor}`;

/** `door,none` / `secret` → the door pair (a single kind is used at both ends). */
export function doorPair(v: string | undefined): [dungeon.DoorKind | null, dungeon.DoorKind | null] | undefined {
  if (v === undefined) return undefined;
  const parts = v.split(',').map(s => s.trim()), kind = (s: string | undefined) => {
    if (!s || s === 'none' || s === 'open') return null;
    if (!dungeon.DOOR_KINDS.includes(s as dungeon.DoorKind)) throw new Error(`--doors: none or one of ${dungeon.DOOR_KINDS.join(', ')}`);
    return s as dungeon.DoorKind;
  };
  return [kind(parts[0]), kind(parts.length > 1 ? parts[1] : parts[0])];
}

/** `10` / `5` / `10+5` / `none` (in feet, at 5 ft a cell) → grid settings. */
export function gridMode(m: DungeonSpec, mode: string): DungeonSpec['grid'] {
  const per = m.scale.perCell, g = { ...m.grid };
  if (mode === 'none' || mode === 'off') return { ...g, show: false };
  const parts = mode.split('+').map(Number);
  if (!parts.length || parts.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('grid: 10, 5, 10+5 or none (feet; or the map\'s unit)');
  return { ...g, show: true, size: parts[0] / per, sub: parts.length > 1 };
}

/** The drawing warnings for a dungeon after a change, as lines for a command's output (at most `max`, then a count). */
export function warningLines(m: DungeonSpec, max = 5): string[] {
  const found = dungeon.lintDungeon(m);
  if (!found.length) return [];
  const lines = found.slice(0, max).map(x => `  ${x.severity}: ${x.path}: ${x.message}`);
  if (found.length > max) lines.push(`  … ${found.length - max} more (artgen dungeon check ${m.id})`);
  return lines;
}

/** One-paragraph description of a dungeon for `dungeon show` and the MCP `dungeon_get`. */
export function describeDungeon(m: DungeonSpec): string {
  const g = m.gen, end = endText;
  const gridFt = (n: number) => `${n * m.scale.perCell} ${m.scale.unit}`;
  return [
    `${m.id}${m.title ? ` "${m.title}"` : ''}: ${m.cols}×${m.rows} cells of ${m.scale.perCell} ${m.scale.unit}, seed ${m.seed}`,
    `  gen: rooms ${g.rooms}, size ${g.minSize}..${g.maxSize}, caves ${g.caves}, round ${g.round}, loops ${g.loops}, doors ${g.doors}, corridor width ${g.corridorWidth}, spacing ${g.spacing}, entrance ${g.entrance ? 'on' : 'off'}${g.layout && g.layout !== 'scatter' ? `, layout ${g.layout}${g.layout === 'dense' ? ` (density ${g.density ?? 0.5})` : ''}` : ''}`,
    ...(m.furniture && m.furniture.place !== 'over' ? [`  furniture: ${m.furniture.place}, band ${m.furniture.side ?? 'bottom'}`] : []),
    `  grid: ${m.grid.show ? `size ${gridFt(m.grid.size)}, sub-grid ${m.grid.sub && m.grid.size > 1 ? `${gridFt(1)}` : 'off'}, ${m.grid.clip === 'floor' ? 'on the floor' : 'everywhere'}` : 'off'}; hatch ${m.style.hatch}${m.style.hatch === 'band' ? ` (${m.style.band} cells)` : ''}; numbers ${m.numbers ? 'on' : 'off'}, scale bar ${m.scaleBar ? 'on' : 'off'}, compass ${m.compass ? 'on' : 'off'}`,
    `  rooms (${m.rooms.length}):${m.rooms.map(r => `\n    ${r.id}: ${r.shape} ${r.w}×${r.h} at ${r.x},${r.y}${r.fill && r.fill !== 'floor' ? `, ${r.fill}` : ''}${r.number === false ? ', no number' : r.number !== undefined ? `, #${r.number}` : ''}${r.label ? ` "${r.label}"` : ''}${r.href ? ` → ${r.href}` : ''}`).join('')}`,
    `  corridors (${m.corridors.length}):${m.corridors.map((c, i) => `\n    ${i}.${c.id ? ` [${c.id}]` : ''} ${end(c.from)} → ${end(c.to)}${c.width && c.width !== 1 ? `, width ${c.width}` : ''}${c.via ? `, via ${c.via.join(',')}` : c.route && c.route !== 'auto' ? `, ${c.route}` : ''}${c.curve === 'smooth' ? ', curved' : ''}${c.style === 'natural' ? ', natural' : ''}${c.doors?.some(Boolean) ? `, doors ${c.doors.map(d => d ?? 'none').join('/')}` : ''}`).join('')}`,
    ...(m.blocks?.length ? [`  blocks (${m.blocks.length}):${m.blocks.map(b => `\n    ${b.id}: ${b.shape} ${b.w}×${b.h} at ${b.x},${b.y}, split ${b.split.mode}${b.split.min ? ` (min ${b.split.min})` : ''}${b.split.seed !== undefined ? `, seed ${b.split.seed}` : ''}: ${m.rooms.filter(r => r.origin === `block:${b.id}`).length} rooms`).join('')}`] : []),
    ...(m.connections?.length ? [`  connections (${m.connections.length}):${m.connections.map((c, i) => `\n    ${i}. ${c.a} ↔ ${c.b}: ${c.kind ?? 'door'}${c.width && c.width !== 1 ? `, width ${c.width}` : ''}${c.at ? ` at ${c.at.join(',')}` : ''}`).join('')}`] : []),
    `  labels (${m.overlay.labels.length}):${m.overlay.labels.map((l, i) => `\n    ${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}${l.href ? ` → ${l.href}` : ''}`).join('')}`,
    `  symbols (${m.overlay.symbols.length}):${m.overlay.symbols.map((s, i) => `\n    ${i}. ${s.kind} at ${s.x},${s.y}${s.angle ? ` turned ${s.angle}°` : ''}`).join('')}`,
  ].join('\n');
}

/** The text of `dungeon facts` (the JSON is `dungeon.dungeonFacts`' result as it is). */
export function describeDungeonFacts(r: dungeon.DungeonFacts): string {
  const unit = r.unit.scale, box = (b: dungeon.Boxed) => `${b.cells.w}×${b.cells.h} cells (${b.scale.w}×${b.scale.h} ${unit}) at ${b.cells.x},${b.cells.y}`;
  const end = endText;
  return [
    `${r.id}: ${r.size.cols}×${r.size.rows} cells; positions in cells, lengths also in ${unit}`,
    `rooms (${r.rooms.length}):${r.rooms.map(m => `\n  ${m.id}${m.number !== null ? ` #${m.number}` : ''}: ${m.shape} ${box(m.box)}${m.label ? ` "${m.label}"` : ''}${m.doors.length ? `; doors ${m.doors.map(d => `${d.kind}${d.at ? ` at ${d.at.join(',')}` : ''}`).join(', ')}` : ''}${m.connections?.length ? `; joins ${m.connections.map(c => `${c.to} (${c.kind})`).join(', ')}` : ''}`).join('')}`,
    `corridors (${r.corridors.length}):${r.corridors.map(c => `\n  ${c.index}. ${end(c.from)} → ${end(c.to)}: ${c.length.map} cells (${c.length.scale} ${unit}), width ${c.width}${c.doors.some(Boolean) ? `, doors ${c.doors.map(d => d ?? 'none').join('/')}` : ''}`).join('')}`,
    `exits (${r.exits.length}):${r.exits.map(x => `\n  corridor ${x.corridor} ${x.end} at ${x.at.join(',')}${x.room ? ` from ${x.room}` : ''}: nearest edge ${x.edge}, ${x.distance.map} cells (${x.distance.scale} ${unit})`).join('')}`,
    `overlaps (${r.overlaps.length}):${r.overlaps.map(o => `\n  ${o.rooms.join(' / ')}: ${o.count} cells, ${box(o.box)}`).join('')}`,
    `unreached rooms: ${r.unreached.join(', ') || 'none'}`,
    ...(r.walls ?? []).map(w => `wall ${w.id ?? w.index}: ${w.corners.length} corners, ${w.towers.length} towers (${w.towers.filter(t => t.source === 'corner').length} at corners), thickness ${w.thickness}; ${w.enclosed.every(e => e.inside) ? 'encloses every room' : `does not enclose ${w.enclosed.filter(e => !e.inside).map(e => e.room).join(', ')}`}${w.gates.map(g => `\n  ${g.kind} at ${g.at.join(',')} (wall at ${g.angle}°, ${g.width} wide, ${g.towers} towers${g.room ? `, opens into ${g.room}` : ''})`).join('')}`),
  ].join('\n');
}
