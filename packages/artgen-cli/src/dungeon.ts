/**
 * Dungeon maps for tabletop games (`artgen dungeon …`): `art/dungeons/<id>/dungeon.json` is the map; renders go to
 * `art/dungeons/<id>/out/` (rebuilt from the file, gitignored). The CLI, the MCP server and the web tool's Dungeon Map
 * all read and write the same file.
 *
 *   artgen dungeon new <id> [--size 40x30] [--seed n] [--title "…"] [--empty]          a generated dungeon (or none)
 *   artgen dungeon new <id> --room rect|circle|octagon|cave --room-size 8x6 [--exits n,e:secret,s:none,w] [--label "…"] [--number n|off]
 *   artgen dungeon gen <id> [--seed n] [--rooms n] [--min-size n] [--max-size n] [--caves f] [--round f] [--loops f]
 *                           [--doors f] [--corridor-width n] [--spacing n] [--entrance on|off] [--size 40x30]
 *   artgen dungeon room <id> add <shape> --at x,y|C4 --size WxH [--points x,y,…] [--label "…"] [--number n|off] [--room-id r9]
 *                     | move <rid> --at x,y|C4 | set <rid> [--shape s] [--size WxH] [--label "…"] [--number n|off] | rm <rid>
 *   artgen dungeon link <id> <room> <room|x,y|C4> [--width 1] [--route auto|hv|vh|straight] [--via x,y,…] [--doors door,none]
 *   artgen dungeon unlink <id> <index> | door <id> <index> from|to <kind|none>
 *   artgen dungeon grid <id> 10|5|10+5|none [--clip floor|all]
 *   artgen dungeon style <id> [--hatch band|full|none] [--band n] [--wall f] [--numbers on|off] [--scale-bar on|off]
 *                            [--compass on|off] [--title "…"] [--per-cell n --unit ft]
 *   artgen dungeon label <id> "Text" --at x,y|C4 [--kind name|note|area] [--size f] [--angle deg]
 *   artgen dungeon symbol <id> <kind> --at x,y|C4 [--scale f] [--angle deg] | artgen dungeon symbols
 *   artgen dungeon overlay <id> rm label|symbol <index> | clear [labels|symbols]
 *   artgen dungeon fit <id> [--margin 2] | render <id> [--format svg|png|both] [--ppu 40 | --fit 180x260mm] [--crop x,y,w,h] [--room id [--margin 2]]… [--layers grid=off,labels=off] [--out dir]
 *   artgen dungeon show <id> | list
 *   artgen dungeon facts <id>   rooms, corridors, exits, overlaps and unreached rooms, as numbers (--json)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { clampCrop, dungeon, encodePNG, fitPpu, rasterizeSvg, type Crop, type Fit, type SizeUnit } from 'artgen-core/maps';
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

/** What `dungeon check` finds in a file as a consumer wrote it: the format version and every problem with its JSON path. */
export interface DungeonCheck { file: string; ok: boolean; errors: dungeon.Issue[] }

export function checkDungeonFile(p: Project | null, ref: DungeonRef): DungeonCheck {
  const f = dungeonFile(p, ref);
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(f, 'utf8')); } catch (e) {
    const missing = (e as NodeJS.ErrnoException).code === 'ENOENT';
    return { file: shown(p, f), ok: false, errors: [{ path: '', message: missing ? `no such file: ${shown(p, f)}` : `not JSON: ${(e as Error).message}` }] };
  }
  const r = dungeon.checkDungeon(raw);
  return { file: shown(p, f), ok: !r.errors.length, errors: r.errors };
}

export interface DungeonRender {
  files: string[]; rooms: number; corridors: number; doors: number;
  /** The render in pixels. */
  size: [number, number];
  /** The window drawn, in cells (the whole sheet when there is no crop), and the pixels per cell it was drawn at. */
  crop: Crop; ppu: number;
  /** The SVG's own width and height, in its unit (`--fit` in mm gives millimetres). */
  svg: { width: number; height: number; unit: SizeUnit };
}

/** Render a dungeon to SVG and/or PNG (black and white). */
export async function renderDungeonFiles(p: Project | null, ref: DungeonRef, o: { formats?: ('svg' | 'png')[]; ppu?: number; crop?: Crop; fit?: Fit; rooms?: string[]; margin?: number; layers?: Partial<Record<dungeon.DungeonLayer, boolean>>; out?: string } = {}): Promise<DungeonRender> {
  // a project dungeon renders to its out/ folder as <id>.…; a file renders beside itself as <file name>.…
  const m = readDungeon(p, ref), layout = dungeon.layoutDungeon(m), id = typeof ref === 'string' ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === 'string' ? join(dungeonsDir(p!), id, 'out') : dirname(dungeonFile(p, ref)));
  const formats = o.formats ?? ['svg', 'png'], files: string[] = [];
  if (o.fit && o.ppu !== undefined) throw new Error('--fit and --ppu both set the scale: use one');
  if (o.crop && o.rooms?.length) throw new Error('--crop and --room both set the window: use one');
  if (o.margin !== undefined && !o.rooms?.length) throw new Error('--margin goes with --room');
  const window = o.rooms?.length ? dungeon.roomCrop(m, o.rooms, o.margin, layout) : o.crop;
  const crop = clampCrop(window ?? [0, 0, m.cols, m.rows], m.cols, m.rows), ppu = o.fit ? fitPpu(crop[2], crop[3], o.fit) : o.ppu ?? 40;
  const size: [number, number] = [Math.round(crop[2] * ppu), Math.round(crop[3] * ppu)], unit = o.fit?.unit ?? 'px';
  if (formats.includes('png')) await initNodeMapSvg();
  mkdirSync(out, { recursive: true });
  const svg = dungeon.renderDungeonSvg(m, { ppu, layers: o.layers, layout, ...(window && { crop }), unit }), base = join(out, id);
  if (formats.includes('svg')) { writeFileSync(`${base}.svg`, svg); files.push(`${base}.svg`); }
  if (formats.includes('png')) { writeFileSync(`${base}.png`, encodePNG(rasterizeSvg(svg, size[0], size[1]))); files.push(`${base}.png`); }
  return { files: files.map(f => relative(process.cwd(), f)), rooms: m.rooms.length, corridors: m.corridors.length, doors: layout.doors.length, size, crop, ppu, svg: svgSize(crop, ppu, unit) };
}

/** A room's top-left corner: `x,y` as given, or a cell name (`C4`) meaning that cell's corner. */
export function cornerPoint(at: string): [number, number] {
  const [x, y] = dungeon.parsePoint(at);
  return /^\s*-?[\d.]+\s*,/.test(at) ? [x, y] : [Math.floor(x), Math.floor(y)];
}

/** A corridor end: a room id in the dungeon, else a point. */
export function corridorEnd(m: DungeonSpec, ref: string): dungeon.CorridorEnd {
  return m.rooms.some(r => r.id === ref) ? { room: ref } : { at: dungeon.parsePoint(ref) };
}

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

/** One-paragraph description of a dungeon for `dungeon show` and the MCP `dungeon_get`. */
export function describeDungeon(m: DungeonSpec): string {
  const g = m.gen, end = (e: dungeon.CorridorEnd) => ('room' in e ? e.room : `(${e.at.join(',')})`);
  const gridFt = (n: number) => `${n * m.scale.perCell} ${m.scale.unit}`;
  return [
    `${m.id}${m.title ? ` "${m.title}"` : ''}: ${m.cols}×${m.rows} cells of ${m.scale.perCell} ${m.scale.unit}, seed ${m.seed}`,
    `  gen: rooms ${g.rooms}, size ${g.minSize}..${g.maxSize}, caves ${g.caves}, round ${g.round}, loops ${g.loops}, doors ${g.doors}, corridor width ${g.corridorWidth}, spacing ${g.spacing}, entrance ${g.entrance ? 'on' : 'off'}`,
    `  grid: ${m.grid.show ? `${gridFt(m.grid.size)}${m.grid.sub && m.grid.size > 1 ? ` + ${gridFt(1)}` : ''}, ${m.grid.clip === 'floor' ? 'on the floor' : 'everywhere'}` : 'off'}; hatch ${m.style.hatch}${m.style.hatch === 'band' ? ` (${m.style.band} cells)` : ''}; numbers ${m.numbers ? 'on' : 'off'}, scale bar ${m.scaleBar ? 'on' : 'off'}, compass ${m.compass ? 'on' : 'off'}`,
    `  rooms (${m.rooms.length}):${m.rooms.map(r => `\n    ${r.id}: ${r.shape} ${r.w}×${r.h} at ${r.x},${r.y}${r.number === false ? ', no number' : r.number !== undefined ? `, #${r.number}` : ''}${r.label ? ` "${r.label}"` : ''}`).join('')}`,
    `  corridors (${m.corridors.length}):${m.corridors.map((c, i) => `\n    ${i}. ${end(c.from)} → ${end(c.to)}${c.width && c.width !== 1 ? `, width ${c.width}` : ''}${c.via ? `, via ${c.via.join(',')}` : c.route && c.route !== 'auto' ? `, ${c.route}` : ''}${c.doors?.some(Boolean) ? `, doors ${c.doors.map(d => d ?? 'none').join('/')}` : ''}`).join('')}`,
    `  labels (${m.overlay.labels.length}):${m.overlay.labels.map((l, i) => `\n    ${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}`).join('')}`,
    `  symbols (${m.overlay.symbols.length}):${m.overlay.symbols.map((s, i) => `\n    ${i}. ${s.kind} at ${s.x},${s.y}${s.angle ? ` turned ${s.angle}°` : ''}`).join('')}`,
  ].join('\n');
}

/** The text of `dungeon facts` (the JSON is `dungeon.dungeonFacts`' result as it is). */
export function describeDungeonFacts(r: dungeon.DungeonFacts): string {
  const unit = r.unit.scale, box = (b: dungeon.Boxed) => `${b.cells.w}×${b.cells.h} cells (${b.scale.w}×${b.scale.h} ${unit}) at ${b.cells.x},${b.cells.y}`;
  const end = (e: dungeon.CorridorEnd) => ('room' in e ? e.room : `(${e.at.join(',')})`);
  return [
    `${r.id}: ${r.size.cols}×${r.size.rows} cells; positions in cells, lengths also in ${unit}`,
    `rooms (${r.rooms.length}):${r.rooms.map(m => `\n  ${m.id}${m.number !== null ? ` #${m.number}` : ''}: ${m.shape} ${box(m.box)}${m.label ? ` "${m.label}"` : ''}${m.doors.length ? `; doors ${m.doors.map(d => `${d.kind}${d.at ? ` at ${d.at.join(',')}` : ''}`).join(', ')}` : ''}`).join('')}`,
    `corridors (${r.corridors.length}):${r.corridors.map(c => `\n  ${c.index}. ${end(c.from)} → ${end(c.to)}: ${c.length.map} cells (${c.length.scale} ${unit}), width ${c.width}${c.doors.some(Boolean) ? `, doors ${c.doors.map(d => d ?? 'none').join('/')}` : ''}`).join('')}`,
    `exits (${r.exits.length}):${r.exits.map(x => `\n  corridor ${x.corridor} ${x.end} at ${x.at.join(',')}${x.room ? ` from ${x.room}` : ''}: nearest edge ${x.edge}, ${x.distance.map} cells (${x.distance.scale} ${unit})`).join('')}`,
    `overlaps (${r.overlaps.length}):${r.overlaps.map(o => `\n  ${o.rooms.join(' / ')}: ${o.count} cells, ${box(o.box)}`).join('')}`,
    `unreached rooms: ${r.unreached.join(', ') || 'none'}`,
  ].join('\n');
}
