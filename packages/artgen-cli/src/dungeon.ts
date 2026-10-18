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
 *   artgen dungeon fit <id> [--margin 2] | render <id> [--format svg|png|both] [--ppu 40] [--layers grid=off,labels=off] [--out dir]
 *   artgen dungeon show <id> | list
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dungeon, encodePNG, rasterizeSvg } from 'artgen-core';
import { initNodeMapSvg } from './node.ts';
import { readJson, writeJson, type Project } from './project.ts';

type DungeonSpec = dungeon.DungeonSpec;

export const dungeonsDir = (p: Project): string => join(p.art, 'dungeons');

/** `art/dungeons/<id>/dungeon.json`; ids are names, never paths, so nothing outside `art/dungeons` is touched. */
export function dungeonFile(p: Project, id: string): string {
  if (!/^[\w-]+$/.test(id ?? '')) throw new Error(`dungeon id ${JSON.stringify(id)}: letters, digits, - and _ only`);
  return join(dungeonsDir(p), id, 'dungeon.json');
}

export function listDungeons(p: Project): { id: string; size: string; title?: string; rooms: number; corridors: number; labels: number; symbols: number }[] {
  if (!existsSync(dungeonsDir(p))) return [];
  return readdirSync(dungeonsDir(p), { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(dungeonsDir(p), d.name, 'dungeon.json'))).map(d => {
    const m = readDungeon(p, d.name);
    return { id: m.id, size: `${m.cols}x${m.rows}`, ...(m.title && { title: m.title }), rooms: m.rooms.length, corridors: m.corridors.length, labels: m.overlay.labels.length, symbols: m.overlay.symbols.length };
  });
}

export function readDungeon(p: Project, id: string): DungeonSpec {
  const f = dungeonFile(p, id);
  if (!existsSync(f)) throw new Error(`no dungeon ${id} (${relative(p.root, f)}) — artgen dungeon new ${id}`);
  return dungeon.parseDungeon(readJson(f));
}

export function writeDungeon(p: Project, m: DungeonSpec): string {
  const spec = dungeon.parseDungeon(m), f = dungeonFile(p, spec.id);
  writeJson(f, spec);
  return relative(p.root, f);
}

export function createDungeon(p: Project, m: DungeonSpec, force = false): { file: string; dungeon: DungeonSpec } {
  if (existsSync(dungeonFile(p, m.id)) && !force) throw new Error(`dungeon ${m.id} already exists (edit it, or pick another id)`);
  return { file: writeDungeon(p, m), dungeon: m };
}

/** Read, change, validate and write a dungeon in one step; `change` may return a replacement spec. */
export function updateDungeon(p: Project, id: string, change: (m: DungeonSpec) => DungeonSpec | void): DungeonSpec {
  const m = readDungeon(p, id), next = change(m) ?? m;
  writeDungeon(p, next);
  return next;
}

export interface DungeonRender { files: string[]; rooms: number; corridors: number; doors: number; size: [number, number] }

/** Render a dungeon to SVG and/or PNG (black and white). */
export async function renderDungeonFiles(p: Project, id: string, o: { formats?: ('svg' | 'png')[]; ppu?: number; layers?: Partial<Record<dungeon.DungeonLayer, boolean>>; out?: string } = {}): Promise<DungeonRender> {
  const m = readDungeon(p, id), layout = dungeon.layoutDungeon(m), ppu = o.ppu ?? 40, out = o.out ?? join(dungeonsDir(p), id, 'out');
  const formats = o.formats ?? ['svg', 'png'], files: string[] = [];
  if (formats.includes('png')) await initNodeMapSvg();
  mkdirSync(out, { recursive: true });
  const svg = dungeon.renderDungeonSvg(m, { ppu, layers: o.layers, layout }), base = join(out, id);
  if (formats.includes('svg')) { writeFileSync(`${base}.svg`, svg); files.push(`${base}.svg`); }
  if (formats.includes('png')) { writeFileSync(`${base}.png`, encodePNG(rasterizeSvg(svg, m.cols * ppu, m.rows * ppu))); files.push(`${base}.png`); }
  return { files: files.map(f => relative(process.cwd(), f)), rooms: m.rooms.length, corridors: m.corridors.length, doors: layout.doors.length, size: [m.cols * ppu, m.rows * ppu] };
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
