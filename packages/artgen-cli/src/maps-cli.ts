/**
 * `artgen map …` and `artgen dungeon …`: the commands of the map and dungeon engines. They are a module of their own,
 * with `formats`, so the maps-only bundle (`artgen-maps.js`, see `maps-bin.ts`) holds them without the pixel-art pipeline.
 *
 * Each command names its map by id (in a project: `art/maps/<id>/map.json`) or by `--file <path>`, which needs no
 * project and renders beside the file unless `--out` says otherwise.
 */
import { dungeon, map } from 'artgen-core/maps';
import { checkDungeonFile, cornerPoint, corridorEnd, createDungeon, describeDungeon, doorPair, dungeonSummary, gridMode, listDungeons, readDungeon, renderDungeonFiles, updateDungeon } from './dungeon.ts';
import { createMap, describeMap, listMaps, mapSummary, numbers, onOff, parseLayers, readMap, renderMapFiles, shapeFrom, updateMap } from './map.ts';
import { fileId, requireProject } from './projectfs.ts';

declare const __ARTGEN_VERSION__: string | undefined;
declare const __ARTGEN_SHA__: string | undefined;

export function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Comma-separated values of a flag (`--states idle,walk`). */
export function list(args: string[], name: string): string[] | undefined {
  const v = flag(args, name);
  return v === undefined ? undefined : v.split(',').map(s => s.trim()).filter(Boolean);
}

export const num = (args: string[], name: string): number | undefined => { const v = flag(args, name); if (v === undefined) return undefined; if (!Number.isFinite(+v)) throw new Error(`${name}: a number`); return +v; };

export const MAP_USAGE = `       artgen map new <id> [--preset regional|local] [--size 30x22] [--grid hex|square|none] [--seed n] [--title "..."]
       artgen map gen <id> [--seed n] [--land mixed|island|inland] [--sea f] [--moisture f] [--roughness f] [--relief f] [--rivers n] [--simplify n] [--feature n] [--interval n] [--max-elevation n] [--topo-labels on|off]
       artgen map edit <id> paint --terrain t <shape> | elevate --amount ±f <shape> | river --points x,y,… [--width w] [--delta off] | road --points x,y,… | undo
                  <shape>: --circle x,y,r | --poly x,y,x,y,… | --stroke x,y,… --width w   (terrains: ${map.TERRAINS.join(', ')})
       artgen map grid <id> hex|square|none [--size n] [--coords on|off]
       artgen map label <id> "Text" --at x,y|0304|C4 [--kind region|place|water|note] [--size f] [--angle deg]
       artgen map symbol <id> <kind> --at x,y|0304|C4 [--scale f] | map symbols | map overlay <id> rm label|symbol <i> | clear [labels|symbols]
       artgen map set <id> [--title "..."] [--legend on|off] [--scale-bar on|off] [--compass on|off] [--per-cell n] [--unit mi]
       artgen map render <id> [--theme color|bw|both] [--format svg|png|both] [--ppu 40] [--layers grid=off,labels=off] [--out dir]
       artgen map show <id> | list
       artgen dungeon new <id> [--size 40x30] [--seed n] [--title "..."] [--empty] | new <id> --room rect|circle|octagon|cave --room-size 8x6 [--exits n,e:secret,s:none,w] [--label "..."] [--number n|off]
       artgen dungeon gen <id> [--seed n] [--rooms n] [--min-size n] [--max-size n] [--caves f] [--round f] [--loops f] [--doors f] [--corridor-width n] [--spacing n] [--entrance on|off] [--size 40x30]
       artgen dungeon room <id> add <shape> --at x,y|C4 --size WxH [--points x,y,…] [--label "..."] [--number n|off] [--room-id r9] | move <rid> --at x,y | set <rid> [--shape s] [--size WxH] [--label "..."] [--number n|off] | rm <rid>
       artgen dungeon link <id> <room> <room|x,y|C4> [--width 1] [--route auto|hv|vh|straight] [--via x,y,…] [--doors door,none] | unlink <id> <i> | door <id> <i> from|to <kind|none>
                  (shapes: ${dungeon.ROOM_SHAPES.join(', ')}; doors: ${dungeon.DOOR_KINDS.join(', ')})
       artgen dungeon grid <id> 10|5|10+5|none [--clip floor|all] | style <id> [--hatch band|full|none] [--band n] [--wall f] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--title "..."] [--per-cell n] [--unit ft]
       artgen dungeon label <id> "Text" --at x,y|C4 [--kind name|note|area] [--size f] [--angle deg] | symbol <id> <kind> --at x,y|C4 [--scale f] [--angle deg] | symbols
       artgen dungeon overlay <id> rm label|symbol <i> | clear [labels|symbols] | fit <id> [--margin 2]
       artgen dungeon check <id> [--json]   every error in the file with its JSON path; exits 1 when there are any
       artgen dungeon render <id> [--format svg|png|both] [--ppu 40] [--layers grid=off,labels=off] [--out dir] | show <id> | list
       artgen formats   (the map and dungeon file format versions this artgen reads; a newer file is refused)
       (map and dungeon commands take --file <path> in place of <id>: no project needed; renders go beside the file or to --out)`;

/** A `--json` result of a map or dungeon command with the `version` of the format it reports on (a list becomes `{ version, items }`). */
const withVersion = (data: unknown, version: number): unknown =>
  data && typeof data === 'object' && !Array.isArray(data) ? { version, ...data } : { version, items: data };

/** `artgen map …` (terrain maps, map.ts). */
export async function mapCommand(sub: string | undefined, args: string[], emit: (human: string, data: unknown) => void): Promise<number> {
  const print = (human: string, data: unknown) => emit(human, withVersion(data, map.MAP_FORMAT));
  const file = flag(args, '--file'), p = file || sub === 'symbols' ? null : requireProject(flag(args, '--root'));
  const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--json')).slice(1);
  if (file && sub !== 'new') pos.unshift('');   // path mode: the file stands where the id would be
  const id = pos[0];
  const need = (what: string) => { if (file) return { file }; if (!id) throw new Error(`map ${sub}: ${what}`); return id; };
  const next = (i?: string) => file ? `next: artgen map render --file ${file}` : `next: artgen map render ${i ?? id}`;
  if (sub === 'list') { const ms = file ? [mapSummary(readMap(null, { file }))] : listMaps(p!); print(ms.length ? ms.map(m => `${m.id.padEnd(16)} ${m.preset.padEnd(9)} ${m.size.padEnd(7)} ${m.edits} edits, ${m.labels} labels, ${m.symbols} symbols${m.title ? `  "${m.title}"` : ''}`).join('\n') : 'no maps yet: artgen map new <id>', ms); return 0; }
  if (sub === 'symbols') { print(Object.entries(map.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join('\n'), map.SYMBOL_KINDS); return 0; }
  if (sub === 'show') { const m = readMap(p, need('<id>')); print(describeMap(m), m); return 0; }
  if (sub === 'new') {
    const preset = (flag(args, '--preset') ?? 'regional') as map.Preset;
    if (!map.PRESETS.includes(preset)) throw new Error(`--preset: ${map.PRESETS.join(' or ')}`);
    const sz = flag(args, '--size')?.match(/^(\d+)x(\d+)$/), grid = flag(args, '--grid') as map.GridType | undefined;
    if (flag(args, '--size') && !sz) throw new Error('--size: COLSxROWS, e.g. 30x22');
    const r = createMap(p, file ? id ?? fileId(file) : need('<id> is required') as string, preset, {
      seed: num(args, '--seed') ?? Math.floor(Math.random() * 1e6), ...(sz && { cols: +sz[1], rows: +sz[2] }), ...(flag(args, '--title') && { title: flag(args, '--title') }),
      ...(grid && { grid: { ...map.PRESET_DEFAULTS[preset].grid, type: grid } }),
    }, args.includes('--force'), file ? { file } : undefined);
    print(`${r.file}\n${describeMap(r.map)}\n${next(r.map.id)}`, { file: r.file, map: r.map });
    return 0;
  }
  if (sub === 'gen') {
    const m = updateMap(p, need('<id>'), m => {
      if (num(args, '--seed') !== undefined) m.seed = num(args, '--seed')!;
      const land = flag(args, '--land') as map.LandMode | undefined;
      if (land) m.gen.land = land;
      for (const k of ['sea', 'moisture', 'roughness', 'relief', 'rivers', 'simplify', 'feature'] as const) { const v = num(args, `--${k}`); if (v !== undefined) m.gen[k] = v; }
      if (num(args, '--interval') !== undefined) m.topo.interval = num(args, '--interval')!;
      if (num(args, '--max-elevation') !== undefined) m.topo.maxElevation = num(args, '--max-elevation')!;
      if (num(args, '--major-every') !== undefined) m.topo.majorEvery = num(args, '--major-every')!;
      if (onOff(flag(args, '--topo-labels')) !== undefined) m.topo.labels = onOff(flag(args, '--topo-labels'))!;
    });
    print(`${describeMap(m)}\n${next(id)}`, m);
    return 0;
  }
  if (sub === 'edit') {
    const op = pos[1];
    let summary = '';
    const m = updateMap(p, need('<id> <op>'), m => {
      const shape = () => shapeFrom({ circle: flag(args, '--circle'), poly: flag(args, '--poly'), stroke: flag(args, '--stroke'), width: flag(args, '--width') });
      if (op === 'undo') { const e = m.edits.pop(); if (!e) throw new Error(`${m.id}: no edits to undo`); summary = `removed ${e.op}`; return; }
      if (op === 'paint') {
        const t = flag(args, '--terrain') as map.Terrain;
        if (!map.TERRAINS.includes(t)) throw new Error(`--terrain: one of ${map.TERRAINS.join(', ')}`);
        m.edits.push({ op, terrain: t, shape: shape() });
      } else if (op === 'elevate') m.edits.push({ op, amount: num(args, '--amount') ?? 0.2, shape: shape() });
      else if (op === 'river') m.edits.push({ op, points: numbers(flag(args, '--points'), '--points'), ...(num(args, '--width') !== undefined && { width: num(args, '--width') }), ...(onOff(flag(args, '--delta')) === false && { delta: false }) });
      else if (op === 'road') m.edits.push({ op, points: numbers(flag(args, '--points'), '--points') });
      else throw new Error('map edit <id> paint|elevate|river|road|undo');
      summary = `edit ${m.edits.length - 1}: ${op}`;
    });
    print(`${m.id}: ${summary} (${m.edits.length} edits)\n${next(m.id)}`, m);
    return 0;
  }
  if (sub === 'grid') {
    const type = pos[1] as map.GridType;
    if (!map.GRID_TYPES.includes(type)) throw new Error(`map grid <id> ${map.GRID_TYPES.join('|')}`);
    const m = updateMap(p, need('<id>'), m => { m.grid.type = type; if (num(args, '--size') !== undefined) m.grid.size = num(args, '--size')!; if (onOff(flag(args, '--coords')) !== undefined) m.grid.coords = onOff(flag(args, '--coords'))!; });
    print(`${m.id}: grid ${m.grid.type}${m.grid.type !== 'none' ? ` size ${m.grid.size}${m.grid.coords ? ', coordinates' : ''}` : ''}\n${next(m.id)}`, m.grid);
    return 0;
  }
  if (sub === 'label' || sub === 'symbol') {
    const what = pos[1], at = flag(args, '--at');
    if (!what || !at) throw new Error(sub === 'label' ? 'map label <id> "Text" --at x,y|0304|C4' : 'map symbol <id> <kind> --at x,y|0304|C4 (kinds: artgen map symbols)');
    const m = updateMap(p, need('<id>'), m => {
      const [x, y] = map.parsePoint(m, at);
      if (sub === 'label') {
        const kind = (flag(args, '--kind') ?? 'place') as map.LabelKind;
        if (!map.LABEL_KINDS.includes(kind)) throw new Error(`--kind: ${map.LABEL_KINDS.join(', ')}`);
        m.overlay.labels.push({ text: what, x, y, kind, ...(num(args, '--size') !== undefined && { size: num(args, '--size') }), ...(num(args, '--angle') !== undefined && { angle: num(args, '--angle') }) });
      } else {
        if (!map.SYMBOLS[what]) throw new Error(`unknown symbol ${what} (have: ${map.SYMBOL_KINDS.join(', ')})`);
        m.overlay.symbols.push({ kind: what, x, y, ...(num(args, '--scale') !== undefined && { scale: num(args, '--scale') }) });
      }
    });
    const n = sub === 'label' ? m.overlay.labels.length : m.overlay.symbols.length;
    print(`${m.id}: ${sub} ${n - 1} "${what}"\n${next(m.id)}`, sub === 'label' ? m.overlay.labels : m.overlay.symbols);
    return 0;
  }
  if (sub === 'overlay') {
    const [, action, which, index] = pos;
    const m = updateMap(p, need('<id> rm|clear'), m => {
      if (action === 'rm') {
        const list = which === 'label' ? m.overlay.labels : which === 'symbol' ? m.overlay.symbols : null, i = Number(index);
        if (!list || !Number.isInteger(i) || i < 0 || i >= list.length) throw new Error(`map overlay <id> rm label|symbol <index> (labels 0..${m.overlay.labels.length - 1}, symbols 0..${m.overlay.symbols.length - 1})`);
        list.splice(i, 1);
      } else if (action === 'clear') {
        if (!which || which === 'labels') m.overlay.labels = [];
        if (!which || which === 'symbols') m.overlay.symbols = [];
      } else throw new Error('map overlay <id> rm label|symbol <index> | clear [labels|symbols]');
    });
    print(`${m.id}: ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols`, m.overlay);
    return 0;
  }
  if (sub === 'set') {
    const m = updateMap(p, need('<id>'), m => {
      const t = flag(args, '--title');
      if (t !== undefined) { if (t) m.title = t; else delete m.title; }
      for (const [f, k] of [['--legend', 'legend'], ['--scale-bar', 'scaleBar'], ['--compass', 'compass']] as const) { const v = onOff(flag(args, f)); if (v !== undefined) m[k] = v; }
      if (num(args, '--per-cell') !== undefined) m.scale.perCell = num(args, '--per-cell')!;
      if (flag(args, '--unit')) m.scale.unit = flag(args, '--unit')!;
    });
    print(`${describeMap(m)}\n${next(m.id)}`, m);
    return 0;
  }
  if (sub === 'render') {
    const theme = flag(args, '--theme') ?? 'both', format = flag(args, '--format') ?? 'both';
    if (!['color', 'bw', 'both'].includes(theme)) throw new Error('--theme: color, bw or both');
    if (!['svg', 'png', 'both'].includes(format)) throw new Error('--format: svg, png or both');
    const r = await renderMapFiles(p, need('<id>'), {
      themes: theme === 'both' ? ['color', 'bw'] : [theme as map.ThemeName], formats: format === 'both' ? ['svg', 'png'] : [format as 'svg' | 'png'],
      ppu: num(args, '--ppu'), layers: parseLayers(flag(args, '--layers')), out: flag(args, '--out'),
    });
    print([`${file ?? id} ${r.size.join('×')} px: ${r.terrains.join(', ')}${r.rivers ? `, ${r.rivers} rivers` : ''}`, ...r.files.map(f => `  ${f}`)].join('\n'), r);
    return 0;
  }
  throw new Error('map: new | gen | edit | grid | label | symbol | symbols | overlay | set | render | show | list (artgen --help)');
}

/** `WxH` → [w, h] (cells). */
function sizeFlag(args: string[], name: string): [number, number] | undefined {
  const v = flag(args, name);
  if (v === undefined) return undefined;
  const m = v.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (!m) throw new Error(`${name}: WIDTHxHEIGHT in cells, e.g. 8x6`);
  return [+m[1], +m[2]];
}

/** `--number 7` / `--number off` → a room number, false to hide it, or undefined when unset. */
function roomNumber(args: string[]): number | false | undefined {
  const v = flag(args, '--number');
  if (v === undefined) return undefined;
  if (onOff(v) === false && !/^\d/.test(v)) return false;
  if (!Number.isFinite(+v)) throw new Error('--number: a number or off');
  return +v;
}

/** `artgen dungeon …` (dungeon maps, dungeon.ts). */
export async function dungeonCommand(sub: string | undefined, args: string[], emit: (human: string, data: unknown) => void): Promise<number> {
  const print = (human: string, data: unknown) => emit(human, withVersion(data, dungeon.DUNGEON_FORMAT));
  const file = flag(args, '--file'), p = file || sub === 'symbols' ? null : requireProject(flag(args, '--root'));
  const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--json')).slice(1);
  if (file && sub !== 'new') pos.unshift('');   // path mode: the file stands where the id would be
  const id = pos[0];
  const need = (what: string) => { if (file) return { file }; if (!id) throw new Error(`dungeon ${sub}: ${what}`); return id; };
  const next = (i?: string) => file ? `next: artgen dungeon render --file ${file}` : `next: artgen dungeon render ${i ?? id}`;
  if (sub === 'list') { const ds = file ? [dungeonSummary(readDungeon(null, { file }))] : listDungeons(p!); print(ds.length ? ds.map(d => `${d.id.padEnd(16)} ${d.size.padEnd(7)} ${d.rooms} rooms, ${d.corridors} corridors, ${d.labels} labels, ${d.symbols} symbols${d.title ? `  "${d.title}"` : ''}`).join('\n') : 'no dungeons yet: artgen dungeon new <id>', ds); return 0; }
  if (sub === 'symbols') { print(Object.entries(dungeon.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join('\n'), dungeon.SYMBOL_KINDS); return 0; }
  if (sub === 'show') { const m = readDungeon(p, need('<id>')); print(describeDungeon(m), m); return 0; }
  const genFlags = (m: dungeon.DungeonSpec) => {
    if (num(args, '--seed') !== undefined) m.seed = num(args, '--seed')!;
    const sz = sizeFlag(args, '--size');
    if (sz) [m.cols, m.rows] = sz;
    for (const [f, k] of [['--rooms', 'rooms'], ['--min-size', 'minSize'], ['--max-size', 'maxSize'], ['--caves', 'caves'], ['--round', 'round'], ['--loops', 'loops'], ['--doors', 'doors'], ['--corridor-width', 'corridorWidth'], ['--spacing', 'spacing']] as const) {
      const v = num(args, f); if (v !== undefined) m.gen[k] = v;
    }
    if (onOff(flag(args, '--entrance')) !== undefined) m.gen.entrance = onOff(flag(args, '--entrance'))!;
  };
  if (sub === 'new') {
    const base = dungeon.newDungeon(file ? id ?? fileId(file) : need('<id> is required') as string, { seed: Math.floor(Math.random() * 1e6), ...(flag(args, '--title') && { title: flag(args, '--title') }) });
    genFlags(base);
    let m = dungeon.parseDungeon(base);
    const shape = flag(args, '--room') as dungeon.RoomShape | undefined;
    if (shape) {
      if (!dungeon.ROOM_SHAPES.includes(shape) || shape === 'poly') throw new Error('--room: rect, circle, octagon or cave');
      const [w, h] = sizeFlag(args, '--room-size') ?? [8, 8];
      const exits = (list(args, '--exits') ?? []).map(e => {
        const [side, kind] = e.split(':');
        if (!['n', 'e', 's', 'w'].includes(side)) throw new Error('--exits: sides n, e, s, w, each optionally :door kind (n,e:secret,s:none)');
        return { side: side as 'n' | 'e' | 's' | 'w', door: kind === undefined ? undefined : doorPair(kind)![0] };
      });
      m = dungeon.singleRoom(m, { shape, w, h, exits, label: flag(args, '--label'), number: roomNumber(args) });
    } else if (!args.includes('--empty')) m = dungeon.generateDungeon(m);
    const r = createDungeon(p, m, args.includes('--force'), file ? { file } : undefined);
    print(`${r.file}\n${describeDungeon(r.dungeon)}\n${next(r.dungeon.id)}`, r);
    return 0;
  }
  if (sub === 'gen') {
    const m = updateDungeon(p, need('<id>'), m => { genFlags(m); return dungeon.generateDungeon(dungeon.parseDungeon(m)); });
    print(`${describeDungeon(m)}\n${next(m.id)}`, m);
    return 0;
  }
  if (sub === 'room') {
    const op = pos[1], rid = pos[2];
    let summary = '';
    const m = updateDungeon(p, need('<id> add|move|set|rm'), m => {
      const find = () => { const r = m.rooms.find(r => r.id === rid); if (!r) throw new Error(`no room ${rid} (have: ${m.rooms.map(r => r.id).join(', ') || 'none'})`); return r; };
      if (op === 'add') {
        const shape = rid as dungeon.RoomShape;
        if (!dungeon.ROOM_SHAPES.includes(shape)) throw new Error(`dungeon room <id> add <shape>: one of ${dungeon.ROOM_SHAPES.join(', ')}`);
        const roomId = flag(args, '--room-id') ?? dungeon.nextRoomId(m), n = roomNumber(args), label = flag(args, '--label');
        let room: dungeon.Room;
        if (shape === 'poly') {
          const points = numbers(flag(args, '--points'), '--points');
          room = { id: roomId, shape, points, ...dungeon.polyBox(points) };
        } else {
          const at = flag(args, '--at'), sz = sizeFlag(args, '--size');
          if (!at || !sz) throw new Error('dungeon room <id> add <shape> --at x,y|C4 --size WxH');
          const [x, y] = cornerPoint(at);
          room = { id: roomId, shape, x, y, w: sz[0], h: sz[1] };
        }
        if (label) room.label = label;
        if (n !== undefined) room.number = n;
        m.rooms.push(room);
        summary = `added ${shape} room ${roomId}`;
      } else if (op === 'move') {
        const r = find(), at = flag(args, '--at');
        if (!at) throw new Error('dungeon room <id> move <rid> --at x,y|C4');
        const [x, y] = cornerPoint(at), dx = x - r.x, dy = y - r.y;
        r.x = x; r.y = y;
        if (r.points) r.points = r.points.map((v, i) => v + (i % 2 ? dy : dx));
        summary = `moved ${r.id} to ${x},${y}`;
      } else if (op === 'set') {
        const r = find(), shape = flag(args, '--shape') as dungeon.RoomShape | undefined, sz = sizeFlag(args, '--size'), label = flag(args, '--label'), n = roomNumber(args);
        if (shape) { if (!dungeon.ROOM_SHAPES.includes(shape) || shape === 'poly') throw new Error('--shape: rect, circle, octagon or cave'); r.shape = shape; delete r.points; }
        if (sz) [r.w, r.h] = sz;
        if (label !== undefined) { if (label) r.label = label; else delete r.label; }
        if (n !== undefined) r.number = n;
        summary = `changed ${r.id}`;
      } else if (op === 'rm') {
        const r = find(), before = m.corridors.length;
        m.rooms = m.rooms.filter(x => x !== r);
        m.corridors = m.corridors.filter(c => !(('room' in c.from && c.from.room === r.id) || ('room' in c.to && c.to.room === r.id)));
        summary = `removed ${r.id} and ${before - m.corridors.length} corridors`;
      } else throw new Error('dungeon room <id> add|move|set|rm');
    });
    print(`${m.id}: ${summary} (${m.rooms.length} rooms)\n${next(m.id)}`, m.rooms);
    return 0;
  }
  if (sub === 'link') {
    const [, a, b] = pos;
    if (!a || !b) throw new Error('dungeon link <id> <room> <room|x,y|C4>');
    const m = updateDungeon(p, need('<id>'), m => {
      const route = flag(args, '--route') as dungeon.Route | undefined, doors = doorPair(flag(args, '--doors'));
      if (route && !dungeon.ROUTES.includes(route)) throw new Error(`--route: ${dungeon.ROUTES.join(', ')}`);
      m.corridors.push({
        from: corridorEnd(m, a), to: corridorEnd(m, b), ...(num(args, '--width') !== undefined && { width: num(args, '--width') }),
        ...(route && { route }), ...(flag(args, '--via') && { via: numbers(flag(args, '--via'), '--via') }), ...(doors && { doors }),
      });
    });
    print(`${m.id}: corridor ${m.corridors.length - 1}: ${a} → ${b}\n${next(m.id)}`, m.corridors);
    return 0;
  }
  if (sub === 'unlink' || sub === 'door') {
    const i = Number(pos[1]);
    const m = updateDungeon(p, need(`<id> <index>`), m => {
      if (!Number.isInteger(i) || i < 0 || i >= m.corridors.length) throw new Error(`dungeon ${sub} <id> <index> (corridors 0..${m.corridors.length - 1}; artgen dungeon show)`);
      if (sub === 'unlink') { m.corridors.splice(i, 1); return; }
      const end = pos[2], kind = doorPair(pos[3] ?? 'none')![0];
      if (end !== 'from' && end !== 'to') throw new Error('dungeon door <id> <index> from|to <kind|none>');
      const c = m.corridors[i], d = c.doors ?? [null, null];
      c.doors = end === 'from' ? [kind, d[1]] : [d[0], kind];
    });
    print(`${m.id}: ${m.corridors.length} corridors\n${next(m.id)}`, m.corridors);
    return 0;
  }
  if (sub === 'grid') {
    const mode = pos[1];
    if (!mode) throw new Error('dungeon grid <id> 10|5|10+5|none [--clip floor|all]');
    const m = updateDungeon(p, need('<id>'), m => {
      m.grid = gridMode(m, mode);
      const clip = flag(args, '--clip');
      if (clip) { if (clip !== 'floor' && clip !== 'all') throw new Error('--clip: floor or all'); m.grid.clip = clip; }
    });
    print(`${describeDungeon(m).split('\n')[2].trim()}\n${next(m.id)}`, m.grid);
    return 0;
  }
  if (sub === 'style') {
    const m = updateDungeon(p, need('<id>'), m => {
      const hatch = flag(args, '--hatch') as dungeon.HatchStyle | undefined;
      if (hatch) { if (!dungeon.HATCH_STYLES.includes(hatch)) throw new Error(`--hatch: ${dungeon.HATCH_STYLES.join(', ')}`); m.style.hatch = hatch; }
      if (num(args, '--band') !== undefined) m.style.band = num(args, '--band')!;
      if (num(args, '--wall') !== undefined) m.style.wall = num(args, '--wall')!;
      const t = flag(args, '--title');
      if (t !== undefined) { if (t) m.title = t; else delete m.title; }
      for (const [f, k] of [['--numbers', 'numbers'], ['--scale-bar', 'scaleBar'], ['--compass', 'compass']] as const) { const v = onOff(flag(args, f)); if (v !== undefined) m[k] = v; }
      if (num(args, '--per-cell') !== undefined) m.scale.perCell = num(args, '--per-cell')!;
      if (flag(args, '--unit')) m.scale.unit = flag(args, '--unit')!;
    });
    print(`${describeDungeon(m)}\n${next(m.id)}`, m);
    return 0;
  }
  if (sub === 'label' || sub === 'symbol') {
    const what = pos[1], at = flag(args, '--at');
    if (!what || !at) throw new Error(sub === 'label' ? 'dungeon label <id> "Text" --at x,y|C4' : 'dungeon symbol <id> <kind> --at x,y|C4 (kinds: artgen dungeon symbols)');
    const m = updateDungeon(p, need('<id>'), m => {
      const [x, y] = dungeon.parsePoint(at), angle = num(args, '--angle');
      if (sub === 'label') {
        const kind = (flag(args, '--kind') ?? 'name') as dungeon.LabelKind;
        if (!dungeon.LABEL_KINDS.includes(kind)) throw new Error(`--kind: ${dungeon.LABEL_KINDS.join(', ')}`);
        m.overlay.labels.push({ text: what, x, y, kind, ...(num(args, '--size') !== undefined && { size: num(args, '--size') }), ...(angle !== undefined && { angle }) });
      } else {
        if (!dungeon.SYMBOLS[what]) throw new Error(`unknown symbol ${what} (have: ${dungeon.SYMBOL_KINDS.join(', ')})`);
        m.overlay.symbols.push({ kind: what, x, y, ...(num(args, '--scale') !== undefined && { scale: num(args, '--scale') }), ...(angle !== undefined && { angle }) });
      }
    });
    const n = sub === 'label' ? m.overlay.labels.length : m.overlay.symbols.length;
    print(`${m.id}: ${sub} ${n - 1} "${what}"\n${next(m.id)}`, sub === 'label' ? m.overlay.labels : m.overlay.symbols);
    return 0;
  }
  if (sub === 'overlay') {
    const [, action, which, index] = pos;
    const m = updateDungeon(p, need('<id> rm|clear'), m => {
      if (action === 'rm') {
        const items = which === 'label' ? m.overlay.labels : which === 'symbol' ? m.overlay.symbols : null, i = Number(index);
        if (!items || !Number.isInteger(i) || i < 0 || i >= items.length) throw new Error(`dungeon overlay <id> rm label|symbol <index> (labels 0..${m.overlay.labels.length - 1}, symbols 0..${m.overlay.symbols.length - 1})`);
        items.splice(i, 1);
      } else if (action === 'clear') {
        if (!which || which === 'labels') m.overlay.labels = [];
        if (!which || which === 'symbols') m.overlay.symbols = [];
      } else throw new Error('dungeon overlay <id> rm label|symbol <index> | clear [labels|symbols]');
    });
    print(`${m.id}: ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols`, m.overlay);
    return 0;
  }
  if (sub === 'check') {
    const r = checkDungeonFile(p, need('<id>'));
    print(r.ok ? `${r.file}: ok` : [`${r.file}: ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`, ...r.errors.map(e => `  ${e.path || '(file)'}: ${e.message}`)].join('\n'), r);
    return r.ok ? 0 : 1;
  }
  if (sub === 'fit') {
    const m = updateDungeon(p, need('<id>'), m => dungeon.fitDungeon(m, num(args, '--margin') ?? 2));
    print(`${m.id}: ${m.cols}×${m.rows} cells\n${next(m.id)}`, { cols: m.cols, rows: m.rows });
    return 0;
  }
  if (sub === 'render') {
    const format = flag(args, '--format') ?? 'both';
    if (!['svg', 'png', 'both'].includes(format)) throw new Error('--format: svg, png or both');
    const r = await renderDungeonFiles(p, need('<id>'), {
      formats: format === 'both' ? ['svg', 'png'] : [format as 'svg' | 'png'], ppu: num(args, '--ppu'),
      layers: parseLayers(flag(args, '--layers'), dungeon.DUNGEON_LAYERS), out: flag(args, '--out'),
    });
    print([`${file ?? id} ${r.size.join('×')} px: ${r.rooms} rooms, ${r.corridors} corridors, ${r.doors} doors`, ...r.files.map(f => `  ${f}`)].join('\n'), r);
    return 0;
  }
  throw new Error('dungeon: new | gen | room | link | unlink | door | grid | style | label | symbol | symbols | overlay | check | fit | render | show | list (artgen --help)');
}

/** `artgen formats [--json]`: the map and dungeon file format versions this artgen reads and writes. */
export function formatsCommand(emit: (human: string, data: unknown) => void): number {
  const formats = { map: map.MAP_FORMAT, dungeon: dungeon.DUNGEON_FORMAT };
  emit(Object.entries(formats).map(([k, v]) => `${k} ${v}`).join('\n'), formats);
  return 0;
}

/** Entry point of the maps-only bundle (`artgen-maps.js`): `map`, `dungeon` and `formats`, nothing else. */
export async function mapsMain(argv: string[]): Promise<number> {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a): a is string => a !== undefined);
  const json = args.includes('--json'), print = (human: string, data: unknown) => console.log(json ? JSON.stringify(data, null, 2) : human);
  if (cmd === '--version' || cmd === 'version') { console.log(MAPS_VERSION); return 0; }
  if (!cmd || cmd === '--help' || cmd === 'help') { console.log(`artgen-maps ${MAPS_VERSION} — the artgen map and dungeon engines, usable alone.\n\nusage:\n${MAP_USAGE}\n       artgen-maps.js --version | --help`); return 0; }
  if (cmd === 'formats') return formatsCommand(print);
  if (cmd === 'map') return mapCommand(sub, args, print);
  if (cmd === 'dungeon') return dungeonCommand(sub, args, print);
  throw new Error(`artgen-maps: ${cmd}: not a command here; this bundle has map, dungeon and formats (--help)`);
}

/** `artgen-maps.js --version`: the release and the commit it was built from. */
export const MAPS_VERSION = `${typeof __ARTGEN_VERSION__ === 'string' ? __ARTGEN_VERSION__ : 'dev'} (${typeof __ARTGEN_SHA__ === 'string' ? __ARTGEN_SHA__ : 'unknown'})`;
