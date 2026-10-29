/** The dungeon operations (`artgen dungeon …`, the MCP `dungeon_*` tools). Implementations moved here from `maps-cli.ts` and the MCP server; the edits themselves are `editDungeon` in `artgen-mapgen`. */
import { join } from 'node:path';
import { dungeon, type SyncReport } from 'artgen-core/maps';
import { checkDungeonFile, createDungeon, describeDungeon, describeDungeonFacts, dungeonSummary, listDungeons, readDungeon, renderDungeonFiles, updateDungeon, warningLines } from '../dungeon.ts';
import { onOff, parseLayers } from '../map.ts';
import { fileId, readJson } from '../projectfs.ts';
import { idParam, layersOf, needPoints, originOf, overlayEdit, overlayLines, overlayParams, pageScaleOf, pathParam, pngFile, projectOf, refOf, roomNumber, syncText, text, viewOf, withVersion, type Inp } from './maps-shared.ts';
import { defineOp, p, type Content, type Ctx, type OpDef, type Param } from './registry.ts';

const V = (data: unknown) => withVersion(data, dungeon.DUNGEON_FORMAT);
const next = (i: Inp, id?: string) => (i.path ? `next: artgen dungeon render --file ${i.path}` : `next: artgen dungeon render ${id ?? i.id}`);
const CELLS = 'WIDTHxHEIGHT in cells, e.g. 8x6';
const numberOf = (v: unknown) => roomNumber(v, s => onOff(s));
const findRoom = (m: dungeon.DungeonSpec, rid: unknown) => {
  const r = m.rooms.find(x => x.id === rid);
  if (!r) throw new Error(`no room ${String(rid)} (have: ${m.rooms.map(x => x.id).join(', ') || 'none'})`);
  return r;
};

// ---- generator settings, as flags (MCP sends them as `gen`)
const GEN_PARAMS: Record<string, Param> = {
  size: p.size('the sheet in cells, e.g. 40x30', { mcp: false, error: CELLS }),
  rooms: p.num('rooms to generate', { mcp: false }), min_size: p.num('smallest room side, cells', { mcp: false }), max_size: p.num('largest room side, cells', { mcp: false }),
  caves: p.num('share of cave rooms, 0..1', { mcp: false }), round: p.num('share of round rooms, 0..1', { mcp: false }), loops: p.num('extra corridors that make loops, 0..1', { mcp: false }), doors: p.num('share of corridor ends with a door, 0..1', { mcp: false }),
  corridor_width: p.num('corridor width, cells', { mcp: false }), spacing: p.num('gap between rooms, cells', { mcp: false }), entrance: p.bool('an entrance corridor to the map edge', { style: 'onoff', mcp: false }),
  layout: p.oneOf(dungeon.GEN_LAYOUTS, 'scatter | dense | blocks', { mcp: false }), density: p.num('dense: share of the sheet filled, 0..1', { mcp: false }),
};
const GEN_KEYS = [['rooms', 'rooms'], ['min_size', 'minSize'], ['max_size', 'maxSize'], ['caves', 'caves'], ['round', 'round'], ['loops', 'loops'], ['doors', 'doors'], ['corridor_width', 'corridorWidth'], ['spacing', 'spacing']] as const;
function applyGenFlags(m: dungeon.DungeonSpec, i: Inp): void {
  if (typeof i.seed === 'number') m.seed = i.seed;
  if (i.size) [m.cols, m.rows] = i.size;
  for (const [f, k] of GEN_KEYS) if (i[f] !== undefined) m.gen[k] = i[f];
  if (i.entrance !== undefined) m.gen.entrance = i.entrance;
  if (i.layout !== undefined) { if (i.layout === 'scatter') delete m.gen.layout; else m.gen.layout = i.layout; }
  if (i.density !== undefined) m.gen.density = i.density;
}

const list = defineOp({
  name: 'dungeon.list', module: 'maps', effect: 'read', summary: 'List the dungeons in the project (or the one named by --file).',
  description: 'Dungeon maps (TTRPG, black and white) in art/dungeons, plus the room shapes, door kinds, symbol kinds and label kinds the dungeon tools accept.',
  params: { path: pathParam('dungeon') },
  run: (i: Inp, ctx) => (i.path ? [dungeonSummary(readDungeon(null, { file: i.path }))] : listDungeons(ctx.project())),
  cli: {
    usage: '       artgen dungeon list | show <id> | symbols',
    text: ds => (ds.length ? ds.map((d: ReturnType<typeof dungeonSummary>) => `${d.id.padEnd(16)} ${d.size.padEnd(7)} ${d.rooms} rooms, ${d.corridors} corridors, ${d.labels} labels, ${d.symbols} symbols${d.title ? `  "${d.title}"` : ''}`).join('\n') : 'no dungeons yet: artgen dungeon new <id>'),
    json: ds => V(ds),
  },
  mcp: { content: ds => [text({ dungeons: ds, shapes: dungeon.ROOM_SHAPES, doors: dungeon.DOOR_KINDS, symbols: dungeon.SYMBOL_KINDS, labelKinds: dungeon.LABEL_KINDS, routes: dungeon.ROUTES })] }, python: {},
});

const symbols = defineOp({
  name: 'dungeon.symbols', module: 'maps', effect: 'read', summary: 'List the symbol kinds a dungeon can carry.',
  params: {}, run: () => dungeon.SYMBOL_KINDS,
  cli: { usage: [], text: () => Object.entries(dungeon.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join('\n'), json: kinds => V(kinds) },
  mcp: { exclude: 'dungeon_list returns the symbol kinds' }, python: {},
});

const show = defineOp({
  name: 'dungeon.show', module: 'maps', effect: 'read', summary: 'Show a dungeon: rooms with ids, corridors, labels and symbols with their indices.',
  description: 'A dungeon\'s file (art/dungeons/<id>/dungeon.json) and a readable summary: rooms with ids, corridors, labels and symbols with their indices.',
  params: { id: idParam('the dungeon id', 'dungeon show: <id>'), path: pathParam('dungeon') },
  run: (i: Inp, ctx) => readDungeon(projectOf(i, ctx), refOf(i)),
  cli: { usage: [], text: m => describeDungeon(m), json: m => V(m) },
  mcp: { name: 'dungeon_get', content: m => [text(describeDungeon(m)), text(m)] }, python: {},
});

const create = defineOp({
  name: 'dungeon.new', module: 'maps', effect: 'write', summary: 'Create a dungeon: generated from the seed, one room, or empty.',
  description: 'Create a dungeon map. mode "generate" (default): rooms and corridors from the seed and gen settings ({rooms, minSize, maxSize, caves, round, loops, doors, corridorWidth, spacing, entrance, layout: scatter|dense|blocks (dense: rooms side by side joined through shared walls; blocks: blocks split into rooms joined by corridors), density (dense: share of the sheet filled, 0..1)}); "room": one room of shape rect|circle|octagon|cave, w × h cells, with exits [{side: n|e|s|w, door?: kind|null, at?: offset along the wall, text?: a note at the edge saying where it leads}] running off the map, a label and a number; "empty": nothing yet (add rooms with dungeon_edit). One cell is 5 ft. Render with dungeon_render.',
  params: {
    id: idParam('the new dungeon\'s id (a name, never a path)', 'dungeon new: <id> is required'), path: pathParam('dungeon'),
    mode: p.oneOf(['generate', 'room', 'empty'], 'generate (default), room (one room) or empty', { cli: false }),
    cols: p.num('columns', { cli: false }), rows: p.num('rows', { cli: false }), seed: p.num('the generator seed (default: random)'), title: p.str('the title'),
    gen: p.json({ type: 'object' }, 'generator settings: rooms, minSize, maxSize, caves, round, loops, doors, corridorWidth, spacing, entrance, layout, density', { cli: false }),
    shape: p.oneOf(['rect', 'circle', 'octagon', 'cave'], 'one room of this shape (rect, circle, octagon or cave)', { flag: '--room', error: 'rect, circle, octagon or cave' }),
    w: p.num('the room\'s width in cells', { cli: false }), h: p.num('the room\'s height in cells', { cli: false }),
    exits: { kind: 'list', item: 'string', doc: 'exits running off the map: n,e:secret,s:none:To the caves,w (a side, then :door kind, then :a note)', schema: { type: 'array', items: { type: 'object' } } } as Param,
    label: p.str('the room\'s name'), number: p.str('the room\'s number (n, or off)', { schema: { type: 'number' } }),
    empty: p.bool('no rooms yet', { mcp: false }), room_size: p.size('the room\'s size in cells, e.g. 8x6', { mcp: false, error: CELLS }), force: p.bool('overwrite an existing file (with --file)', { mcp: false }),
    ...GEN_PARAMS,
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    const base = dungeon.newDungeon(i.path ? i.id ?? fileId(i.path) : i.id, {
      seed: typeof i.seed === 'number' ? i.seed : Math.floor(Math.random() * 1e6), ...(typeof i.cols === 'number' && { cols: i.cols }), ...(typeof i.rows === 'number' && { rows: i.rows }),
      ...(i.title && { title: i.title }), ...(i.gen && typeof i.gen === 'object' ? { gen: { ...dungeon.DEFAULTS.gen, ...i.gen } as dungeon.DungeonSpec['gen'] } : {}),
    });
    applyGenFlags(base, i);
    let m = dungeon.parseDungeon(base);
    const room = i.mode === 'room' || (i.mode === undefined && i.shape !== undefined);
    if (room) {
      const [w, h] = (i.room_size ?? [Number(i.w ?? 8), Number(i.h ?? 8)]) as [number, number];
      const exits = ((i.exits as unknown[] | undefined) ?? []).map(e => {
        if (typeof e !== 'string') return e;
        const [side, kind, ...note] = e.split(':');
        if (!['n', 'e', 's', 'w'].includes(side)) throw new Error('--exits: sides n, e, s, w, each optionally :door kind and :a note (n,e:secret,s:none:To the caves)');
        return { side: side as 'n' | 'e' | 's' | 'w', door: kind === undefined || kind === '' ? undefined : dungeon.doorPair(kind)![0], ...(note.length && { text: note.join(':') }) };
      });
      m = dungeon.singleRoom(m, { shape: (i.shape ?? 'rect') as dungeon.RoomShape, w, h, exits: exits as never, label: typeof i.label === 'string' ? i.label : undefined, number: numberOf(i.number) });
    } else if (i.mode !== 'empty' && i.empty !== true) m = dungeon.generateDungeon(m);
    return createDungeon(P, m, i.force === true, i.path ? { file: i.path } : undefined);
  },
  cli: {
    usage: [
      '       artgen dungeon new <id> [--size 40x30] [--seed n] [--title "..."] [--empty] [the gen flags of dungeon gen] | new <id> --room rect|circle|octagon|cave --room-size 8x6 [--exits n,e:secret,s:none:To the caves,w] [--label "..."] [--number n|off]',
    ],
    text: (r, i) => `${r.file}\n${describeDungeon(r.dungeon)}\n${next(i, r.dungeon.id)}`, json: r => V(r),
  },
  mcp: { content: r => [text({ file: r.file, summary: describeDungeon(r.dungeon) })] }, python: {},
});

const update = defineOp({
  name: 'dungeon.update', module: 'maps', effect: 'write', summary: 'Change a dungeon\'s settings (not its rooms): grid, style, scale, title, furniture, size.',
  description: 'Change a dungeon\'s settings (not its rooms). grid_size: the grid size in the map unit (10 = a line every 10 ft; a whole number of squares), grid_unit: the unit (ft, m, …; it is also the scale unit), sub_grid: true for a fainter line at every square, show_grid; grid_mode: "10" | "5" | "10+5" | "none" (a shorthand); grid: {show, size (cells), sub, clip: floor|all}; style: {hatch: band|full|none, band (cells of hatching along the walls), wall (weight)}; scale: {perCell, unit}; gen: generator settings (used by dungeon_generate); title, numbers, scale_bar, compass, cols, rows; furniture: {place: over|outside|auto, side?: bottom|right} (where the title, scale bar, compass and legend go: over the map, in a band beside it, or in the band only when they would cover something).',
  params: {
    id: idParam('the dungeon id', 'dungeon update: <id>'), path: pathParam('dungeon'),
    grid_size: p.num('the grid size in the map unit (10 = a line every 10 ft)'), grid_unit: p.str('the unit: ft, m, …'), sub_grid: p.bool('a fainter line at every square', { style: 'onoff' }), show_grid: p.bool('show the grid', { style: 'onoff' }),
    grid_mode: p.str('10 | 5 | 10+5 | none'), grid: p.json({ type: 'object' }, 'grid settings, as JSON'), style: p.json({ type: 'object' }, 'style settings, as JSON'), scale: p.json({ type: 'object' }, 'scale settings, as JSON'), gen: p.json({ type: 'object' }, 'generator settings, as JSON'),
    title: p.str('the title ("" removes it)'), numbers: p.bool('show room numbers', { style: 'onoff' }), scale_bar: p.bool('show the scale bar', { style: 'onoff' }), compass: p.bool('show the compass', { style: 'onoff' }),
    cols: p.num('columns'), rows: p.num('rows'), furniture: p.json({ type: 'object' }, 'where the title, scale bar, compass and legend go, as JSON: {place, side}'),
  },
  run(i: Inp, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), m => {
      if (i.furniture && typeof i.furniture === 'object') m.furniture = i.furniture as dungeon.DungeonSpec['furniture'];
      for (const k of ['grid', 'style', 'scale', 'gen'] as const) if (i[k] && typeof i[k] === 'object') Object.assign(m[k], i[k]);
      if (typeof i.grid_unit === 'string' && i.grid_unit) m.scale.unit = i.grid_unit;
      if (typeof i.grid_mode === 'string') m.grid = dungeon.gridMode(m, i.grid_mode);
      m.grid = dungeon.gridFromUnits(m, { size: typeof i.grid_size === 'number' ? i.grid_size : undefined, sub: typeof i.sub_grid === 'boolean' ? i.sub_grid : undefined, show: typeof i.show_grid === 'boolean' ? i.show_grid : undefined });
      if (typeof i.title === 'string') { if (i.title) m.title = i.title; else delete m.title; }
      if (typeof i.numbers === 'boolean') m.numbers = i.numbers;
      if (typeof i.scale_bar === 'boolean') m.scaleBar = i.scale_bar;
      if (typeof i.compass === 'boolean') m.compass = i.compass;
      if (typeof i.cols === 'number') m.cols = i.cols;
      if (typeof i.rows === 'number') m.rows = i.rows;
    });
  },
  cli: {
    usage: `       artgen dungeon update <id> [--grid-size 10] [--grid-unit ft] [--sub-grid on|off] [--show-grid on|off] [--grid-mode 10|5|10+5|none] [--grid|--style|--scale|--gen|--furniture '<json>'] [--title "..."] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--cols n] [--rows n]`,
    text: (m, i) => `${describeDungeon(m)}\n${next(i, m.id)}`, json: m => V(m),
  },
  mcp: { content: m => [text(describeDungeon(m))] }, python: {},
});

const grid = defineOp({
  name: 'dungeon.grid', module: 'maps', effect: 'write', summary: 'Set a dungeon\'s grid.',
  params: {
    id: idParam('the dungeon id', 'dungeon grid: <id>'), path: pathParam('dungeon'), mode: p.str('10 | 5 | 10+5 | none (in feet, at 5 ft a cell)', { positional: true }),
    size: p.num('the grid size in the map unit'), unit: p.str('the unit: ft, m, …'), sub: p.bool('a fainter line at every square', { style: 'onoff' }), show: p.bool('show the grid', { style: 'onoff' }), clip: p.str('floor | all'),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    if (!i.mode && i.size === undefined && i.sub === undefined && i.show === undefined && !i.unit && !i.clip)
      throw new Error('dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all]');
    return updateDungeon(P, refOf(i), m => {
      if (i.unit) m.scale.unit = i.unit;
      if (i.mode) m.grid = dungeon.gridMode(m, i.mode);
      m.grid = dungeon.gridFromUnits(m, { size: i.size, sub: i.sub, show: i.show });
      if (i.clip) { if (i.clip !== 'floor' && i.clip !== 'all') throw new Error('--clip: floor or all'); m.grid.clip = i.clip; }
    });
  },
  cli: {
    usage: '       artgen dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all]',
    text: (m, i) => `${describeDungeon(m).split('\n')[2].trim()}\n${next(i, m.id)}`, json: m => V(m.grid),
  },
  mcp: { exclude: 'dungeon_update covers it' }, python: {},
});

const style = defineOp({
  name: 'dungeon.style', module: 'maps', effect: 'write', summary: 'Set a dungeon\'s drawing style, title, scale and furniture.',
  params: {
    id: idParam('the dungeon id', 'dungeon style: <id>'), path: pathParam('dungeon'), hatch: p.oneOf(dungeon.HATCH_STYLES, 'band | full | none'), band: p.num('cells of hatching along the walls'), wall: p.num('wall weight'),
    numbers: p.bool('show room numbers', { style: 'onoff' }), scale_bar: p.bool('show the scale bar', { style: 'onoff' }), compass: p.bool('show the compass', { style: 'onoff' }), legend: p.bool('show the legend', { style: 'onoff' }),
    title: p.str('the title ("" removes it)'), per_cell: p.num('map units in one cell'), unit: p.str('the scale unit, e.g. ft'),
    furniture: p.oneOf(dungeon.FURNITURE_PLACES, 'over | outside | auto'), furniture_side: p.oneOf(dungeon.FURNITURE_SIDES, 'bottom | right'), shared_walls: p.str('on | off | auto'),
  },
  run(i: Inp, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), m => {
      if (i.hatch) m.style.hatch = i.hatch;
      if (i.band !== undefined) m.style.band = i.band;
      if (i.wall !== undefined) m.style.wall = i.wall;
      if (i.shared_walls === 'auto') delete m.style.sharedWalls; else if (i.shared_walls !== undefined) m.style.sharedWalls = onOff(i.shared_walls)!;
      if (i.title !== undefined) { if (i.title) m.title = i.title; else delete m.title; }
      for (const k of ['numbers', 'scale_bar', 'compass', 'legend'] as const) if (i[k] !== undefined) m[k === 'scale_bar' ? 'scaleBar' : k] = i[k];
      if (i.per_cell !== undefined) m.scale.perCell = i.per_cell;
      if (i.unit) m.scale.unit = i.unit;
      const place = i.furniture, side = i.furniture_side;
      if (place !== undefined || side !== undefined) {
        const f = { place: (place ?? m.furniture?.place ?? 'outside') as dungeon.FurniturePlace, ...((side ?? m.furniture?.side) && { side: (side ?? m.furniture?.side) as dungeon.FurnitureSide }) };
        if (f.place === 'over' && !f.side) delete m.furniture; else m.furniture = f;
      }
    });
  },
  cli: {
    usage: '       artgen dungeon style <id> [--hatch band|full|none] [--band n] [--wall f] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--title "..."] [--per-cell n] [--unit ft] [--furniture over|outside|auto] [--furniture-side bottom|right] [--shared-walls on|off|auto]',
    text: (m, i) => `${describeDungeon(m)}\n${next(i, m.id)}`, json: m => V(m),
  },
  mcp: { exclude: 'dungeon_update covers it' }, python: {},
});

const gen = defineOp({
  name: 'dungeon.gen', module: 'maps', effect: 'write', summary: 'Regenerate a dungeon\'s rooms and corridors from its seed and generator settings.',
  description: 'Regenerate a dungeon\'s rooms and corridors from its seed and gen settings (replaces every room and corridor; labels and symbols stay). Pass seed / gen / cols / rows to change them first.',
  params: {
    id: idParam('the dungeon id', 'dungeon gen: <id>'), path: pathParam('dungeon'), seed: p.num('the generator seed'), gen: p.json({ type: 'object' }, 'generator settings to change first', { cli: false }),
    cols: p.num('columns', { cli: false }), rows: p.num('rows', { cli: false }), ...GEN_PARAMS,
  },
  run(i: Inp, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), m => {
      applyGenFlags(m, i);
      if (i.gen && typeof i.gen === 'object') Object.assign(m.gen, i.gen);
      if (typeof i.cols === 'number') m.cols = i.cols;
      if (typeof i.rows === 'number') m.rows = i.rows;
      return dungeon.generateDungeon(dungeon.parseDungeon(m));
    });
  },
  cli: {
    usage: [
      '       artgen dungeon gen <id> [--seed n] [--rooms n] [--min-size n] [--max-size n] [--caves f] [--round f] [--loops f] [--doors f] [--corridor-width n] [--spacing n] [--entrance on|off] [--size 40x30]',
      '                  [--layout scatter|dense|blocks] [--density f]   dense: rooms side by side, joined through shared walls; blocks: blocks split into rooms, joined by corridors',
    ],
    text: (m, i) => `${describeDungeon(m)}\n${next(i, m.id)}`, json: m => V(m),
  },
  mcp: { name: 'dungeon_generate', content: m => [text(describeDungeon(m))] }, python: {},
});

const OPS_DOC = 'a list of edits as JSON (or @file.json): add_room, move_room, set_room, remove_room, add_block, split_block, remove_block, link, unlink, connect, disconnect, door, fit (see the MCP tool dungeon_edit for the fields)';
const edit = defineOp({
  name: 'dungeon.edit', module: 'maps', effect: 'write', summary: 'Change a dungeon\'s rooms and corridors with a list of edits, in order.',
  description: 'Change a dungeon\'s rooms and corridors, in order. Coordinates are cells (x right, y down; 1 cell = 5 ft); a point is [x,y], "x,y" or a cell name "C4". ops: {op:"add_room", shape: rect|circle|octagon|cave|poly, at: top-left, w, h, points? (poly: [x,y,…]), label?, number? (false hides it), href? (a link from its number and name: http(s), a relative path or #anchor), id?} | {op:"move_room", room, at} | {op:"set_room", room, shape?, w?, h?, label?, number?, href? ("" removes it)} | {op:"remove_room", room} (and its corridors) | {op:"add_block", shape: rect|octagon|circle|hex|poly, at, w, h, points?, split?: bsp|rows|cols|grid|cuts, min? (cells, about the size of each room), cuts?: {x?: [], y?: []}, seed?, doors? (0..1, extra doors), id?} (one shape split into rooms that share walls, with doors and openings between them; its rooms are ordinary rooms, ids <block>-1, <block>-2, …) | {op:"split_block", id, split?, min?, seed?} (split again: a new seed unless given) | {op:"remove_block", id} | {op:"link", from: room id, point or "corridor:<id>", to: the same (a point is an exit or dead end; past the map edge it runs off the map; a corridor is a junction on its centre line), from_side?/to_side?: n|e|s|w (leave the room by that wall), from_offset?/to_offset? (cells along that wall), width?, route?: auto|hv|vh|straight|around (around: along the grid, round the rooms in the way), via?: [x,y,…], curve?: "smooth", style?: "natural" (rough cave-like walls), seed?, id? (a name other corridors can join), exit?: {text, href?, fade?} (to a point past the edge: the corridor fades out and a boxed note says where it leads), doors?: [kind|null, kind|null]} | {op:"unlink", index} | {op:"connect", a: room, b: room, kind?: door|secret|locked|portcullis|arch|open, at?: a point on their shared wall, width?} (a door or opening in the wall two touching rooms share; touching rooms without one keep the wall) | {op:"disconnect", index} | {op:"door", index, end: from|to, kind: door|secret|locked|portcullis|arch|null} | {op:"fit", margin?}.',
  params: {
    id: idParam('the dungeon id', 'dungeon edit: <id>'), path: pathParam('dungeon'),
    ops: p.json({ type: 'array', items: { type: 'object' } }, OPS_DOC, { required: 'dungeon edit: --ops \'<json list>\' (or @file.json) is required' }),
  },
  run(i: Inp, ctx) {
    const lines: string[] = [];
    const m = updateDungeon(projectOf(i, ctx), refOf(i), m => {
      const ops = i.ops ?? [];
      if (!Array.isArray(ops)) throw new Error('ops: a list of edits');
      for (const o of ops as dungeon.DungeonOp[]) lines.push(dungeon.editDungeon(m, o));
    });
    return { m, lines };
  },
  cli: {
    usage: `       artgen dungeon edit <id> --ops '<json list>'   a batch of edits in order: add_room, move_room, set_room, remove_room, add_block, split_block, remove_block, link, unlink, connect, disconnect, door, fit (@file.json reads them from a file)`,
    text: (r, i) => [`${r.m.id}: ${r.lines.length} edit${r.lines.length === 1 ? '' : 's'}`, ...r.lines.map((l: string) => `  ${l}`), ...warningLines(r.m), next(i, r.m.id)].join('\n'), json: r => V({ done: r.lines, dungeon: r.m }),
  },
  mcp: { content: r => [text([describeDungeon(r.m), ...warningLines(r.m)].join('\n'))] }, python: {},
});

// ---- the one-edit commands: each builds an edit and applies it through the same function as `dungeon edit`
const roomCmd = defineOp({
  name: 'dungeon.room', module: 'maps', effect: 'write', summary: 'Add, move, change or remove a room.',
  params: {
    id: idParam('the dungeon id', 'dungeon room: <id> add|move|set|rm'), path: pathParam('dungeon'), action: p.str('add | move | set | rm', { positional: true }), target: p.str('add: the shape (rect, circle, octagon, cave, poly); move, set, rm: the room id', { positional: true }),
    at: p.str('the top-left corner: x,y or a cell like C4'), size: p.size('width x height in cells, e.g. 6x4', { error: CELLS }), points: p.points('poly: x,y,… of the outline'), label: p.str('the room\'s name'), number: p.str('the room\'s number (n, or off)'),
    room_id: p.str('add: the new room\'s id (default r<n>)'), fill: p.oneOf(dungeon.ROOM_FILLS, 'floor | building | yard | cellar'), href: p.str('a link from the number and name (set: "none" removes it)'), origin: p.str('add: who wrote it (a sync replaces its own)'),
    shape: p.oneOf(['rect', 'circle', 'octagon', 'cave'], 'set: the new shape', { error: 'rect, circle, octagon or cave' }),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    let summary = '';
    const m = updateDungeon(P, refOf(i), m => {
      const rid = i.target;
      if (i.action === 'add') {
        const shape = rid as dungeon.RoomShape;
        if (!dungeon.ROOM_SHAPES.includes(shape)) throw new Error(`dungeon room <id> add <shape>: one of ${dungeon.ROOM_SHAPES.join(', ')}`);
        const n = numberOf(i.number);
        let o: dungeon.DungeonOp;
        if (shape === 'poly') o = { op: 'add_room', shape, points: needPoints(i.points, '--points') };
        else {
          if (!i.at || !i.size) throw new Error('dungeon room <id> add <shape> --at x,y|C4 --size WxH');
          o = { op: 'add_room', shape, at: i.at, w: i.size[0], h: i.size[1] };
        }
        if (i.room_id !== undefined) o.id = i.room_id;
        if (i.label) o.label = i.label;
        if (n !== undefined) o.number = n;
        if (i.fill) o.fill = i.fill;
        if (i.href) o.href = i.href;
        Object.assign(o, originOf(i.origin));
        summary = dungeon.editDungeon(m, o);
      } else if (i.action === 'move') {
        findRoom(m, rid);
        if (!i.at) throw new Error('dungeon room <id> move <rid> --at x,y|C4');
        summary = dungeon.editDungeon(m, { op: 'move_room', room: rid, at: i.at });
      } else if (i.action === 'set') {
        findRoom(m, rid);
        const n = numberOf(i.number);
        summary = dungeon.editDungeon(m, {
          op: 'set_room', room: rid, ...(i.shape && { shape: i.shape }), ...(i.size && { w: i.size[0], h: i.size[1] }), ...(i.label !== undefined && { label: i.label }),
          ...(n !== undefined && { number: n }), ...(i.fill && { fill: i.fill }), ...(i.href !== undefined && { href: i.href === 'none' ? '' : i.href }),
        });
      } else if (i.action === 'rm') {
        findRoom(m, rid);
        summary = dungeon.editDungeon(m, { op: 'remove_room', room: rid });
      } else throw new Error('dungeon room <id> add|move|set|rm');
    });
    return { m, summary };
  },
  cli: {
    usage: '       artgen dungeon room <id> add <shape> --at x,y|C4 --size WxH [--points x,y,…] [--label "..."] [--number n|off] [--room-id r9] [--fill floor|building|yard|cellar] [--href url] [--origin name] | move <rid> --at x,y | set <rid> [--shape s] [--size WxH] [--label "..."] [--number n|off] [--fill f] [--href url|none] | rm <rid>',
    text: (r, i) => [`${r.m.id}: ${r.summary} (${r.m.rooms.length} rooms)`, ...warningLines(r.m), next(i, r.m.id)].join('\n'), json: r => V(r.m.rooms),
  },
  mcp: { exclude: 'dungeon_edit add_room / move_room / set_room / remove_room covers it' }, python: {},
});

const link = defineOp({
  name: 'dungeon.link', module: 'maps', effect: 'write', summary: 'Join two rooms (or a room and a point, or a corridor) with a corridor.',
  params: {
    id: idParam('the dungeon id', 'dungeon link: <id>'), path: pathParam('dungeon'),
    from: p.str('a room id, a block id, or corridor:<id>', { positional: true, required: 'dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id>' }),
    to: p.str('a room id, a block id, corridor:<id>, or a point x,y | C4', { positional: true, required: 'dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id>' }),
    width: p.num('corridor width in cells'), route: p.oneOf(dungeon.ROUTES, 'auto | hv | vh | straight | around'), via: p.points('bend points x,y,…'), doors: p.str('door,none: the doors at the two ends'),
    from_side: p.str('n | e | s | w: leave the first room by that wall'), from_offset: p.num('cells along that wall'), to_side: p.str('n | e | s | w: enter the second room by that wall'), to_offset: p.num('cells along that wall'),
    curve: p.oneOf(dungeon.CURVES, 'none | smooth'), style: p.oneOf(dungeon.CORRIDOR_STYLES, 'built | natural'), seed: p.num('the seed of a natural corridor\'s walls'),
    corridor_id: p.str('a name other corridors can join', { flag: '--id' }), exit: p.str('a note at the map edge saying where it leads'), exit_href: p.str('a link from the note'), fade: p.num('cells the corridor fades over (default 3)'), origin: p.str('who wrote it (a sync replaces its own)'),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    let line = '';
    const m = updateDungeon(P, refOf(i), m => {
      const [, eb] = dungeon.linkEnds(m, i.from, i.to), doors = dungeon.doorPair(i.doors);
      const exit = i.exit !== undefined ? { text: i.exit, ...(i.exit_href && { href: i.exit_href }), ...(i.fade !== undefined && { fade: i.fade }) } : undefined;
      if (exit && !('at' in dungeon.corridorEnd(m, eb as string))) throw new Error('--exit: the second end must be a point (x,y or a cell name), where the corridor leaves the map');
      line = dungeon.editDungeon(m, {
        op: 'link', from: i.from, to: i.to, ...(i.corridor_id && { id: i.corridor_id }), from_side: i.from_side, from_offset: i.from_offset, to_side: i.to_side, to_offset: i.to_offset, ...(exit && { exit }),
        width: i.width, route: i.route, via: i.via, doors, ...(i.curve === 'smooth' && { curve: 'smooth' }), ...(i.style === 'natural' && { style: 'natural' }), seed: i.seed, ...originOf(i.origin),
      });
    });
    return { m, line };
  },
  cli: {
    usage: '       artgen dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id> [--width 1] [--route auto|hv|vh|straight|around] [--via x,y,…] [--doors door,none] [--from-side n|e|s|w] [--from-offset n] [--to-side …] [--to-offset n] [--curve smooth] [--style natural] [--seed n] [--id name] [--exit "To the caves" [--exit-href url] [--fade 3]] [--origin name]',
    text: (r, i) => [`${r.m.id}: ${r.line}`, ...warningLines(r.m), next(i, r.m.id)].join('\n'), json: r => V(r.m.corridors),
  },
  mcp: { exclude: 'dungeon_edit link covers it' }, python: {},
});

const corridorOf = (m: dungeon.DungeonSpec, i: Inp, name: string): number => {
  const k = Number(i.index);
  if (!Number.isInteger(k) || k < 0 || k >= m.corridors.length) throw new Error(`dungeon ${name} <id> <index> (corridors 0..${m.corridors.length - 1}; artgen dungeon show)`);
  return k;
};
const unlink = defineOp({
  name: 'dungeon.unlink', module: 'maps', effect: 'write', summary: 'Remove a corridor (and the corridors that join it).',
  params: { id: idParam('the dungeon id', 'dungeon unlink: <id> <index>'), path: pathParam('dungeon'), index: p.str('the corridor\'s index (dungeon show)', { positional: true }) },
  run(i: Inp, ctx) { return updateDungeon(projectOf(i, ctx), refOf(i), m => { corridorOf(m, i, 'unlink'); dungeon.editDungeon(m, { op: 'unlink', index: Number(i.index) }); }); },
  cli: { usage: '       artgen dungeon unlink <id> <i>', text: (m, i) => [`${m.id}: ${m.corridors.length} corridors`, ...warningLines(m), next(i, m.id)].join('\n'), json: m => V(m.corridors) },
  mcp: { exclude: 'dungeon_edit unlink covers it' }, python: {},
});

const door = defineOp({
  name: 'dungeon.door', module: 'maps', effect: 'write', summary: 'Set the door at one end of a corridor.',
  params: {
    id: idParam('the dungeon id', 'dungeon door: <id> <index>'), path: pathParam('dungeon'), index: p.str('the corridor\'s index (dungeon show)', { positional: true }),
    end: p.str('from | to', { positional: true }), kind: p.str('door | secret | locked | portcullis | arch | none', { positional: true }),
  },
  run(i: Inp, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), m => {
      corridorOf(m, i, 'door');
      const kind = dungeon.doorPair(i.kind ?? 'none')![0];
      if (i.end !== 'from' && i.end !== 'to') throw new Error('dungeon door <id> <index> from|to <kind|none>');
      dungeon.editDungeon(m, { op: 'door', index: Number(i.index), end: i.end, kind });
    });
  },
  cli: { usage: '       artgen dungeon door <id> <i> from|to <kind|none>', text: (m, i) => [`${m.id}: ${m.corridors.length} corridors`, ...warningLines(m), next(i, m.id)].join('\n'), json: m => V(m.corridors) },
  mcp: { exclude: 'dungeon_edit door covers it' }, python: {},
});

const block = defineOp({
  name: 'dungeon.block', module: 'maps', effect: 'write', summary: 'Add, split again or remove a block: one shape split into rooms that share walls, with doors between them.',
  params: {
    id: idParam('the dungeon id', 'dungeon block: <id> add|split|rm'), path: pathParam('dungeon'), action: p.str('add | split | rm', { positional: true }), target: p.str('add: the shape (rect, octagon, circle, hex, poly); split, rm: the block id', { positional: true }),
    at: p.str('the top-left corner: x,y or a cell like C4'), size: p.size('width x height in cells, e.g. 12x8', { error: CELLS }), points: p.points('poly: x,y,… of the outline'),
    split: p.oneOf(dungeon.SPLIT_MODES, 'bsp | rows | cols | grid | cuts'), min: p.num('about the size of each room, cells'), cuts_x: p.list('number', 'cuts mode: the x lines'), cuts_y: p.list('number', 'cuts mode: the y lines'),
    seed: p.num('the layout seed'), doors: p.num('extra doors, 0..1'), block_id: p.str('add: the new block\'s id (default b<n>)'),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    let note = '';
    const m = updateDungeon(P, refOf(i), m => {
      const bid = i.target, cuts = i.cuts_x || i.cuts_y ? { ...(i.cuts_x && { x: i.cuts_x }), ...(i.cuts_y && { y: i.cuts_y }) } : undefined;
      if (i.action === 'add') {
        if (!['rect', 'octagon', 'circle', 'hex', 'poly'].includes(bid)) throw new Error('dungeon block <id> add rect|octagon|circle|hex|poly');
        const o: dungeon.DungeonOp = { op: 'add_block', shape: bid, split: i.split ?? 'bsp', ...(i.min !== undefined && { min: i.min }), ...(cuts && { cuts }), ...(i.seed !== undefined && { seed: i.seed }), ...(i.doors !== undefined && { doors: i.doors }), ...(i.block_id && { id: i.block_id }) };
        if (bid === 'poly') o.points = needPoints(i.points, '--points');
        else {
          if (!i.at || !i.size) throw new Error('dungeon block <id> add <shape> --at x,y|C4 --size WxH');
          Object.assign(o, { at: i.at, w: i.size[0], h: i.size[1] });
        }
        note = dungeon.editDungeon(m, o);
      } else if (i.action === 'split') {
        if (!m.blocks?.some(x => x.id === bid)) throw new Error(`no block ${bid} (have: ${(m.blocks ?? []).map(x => x.id).join(', ') || 'none'})`);
        note = dungeon.editDungeon(m, {
          op: 'split_block', id: bid, ...(i.split && { split: i.split }), ...(i.min !== undefined && { min: i.min }), ...(cuts && { cuts }), ...(i.seed !== undefined && { seed: i.seed }),
          reseed: !i.split && i.min === undefined, ...(i.doors !== undefined && { doors: i.doors }),
        });
      } else if (i.action === 'rm') note = dungeon.editDungeon(m, { op: 'remove_block', id: bid });
      else throw new Error('dungeon block <id> add|split|rm');
    });
    return { m, note };
  },
  cli: {
    usage: [
      '       artgen dungeon block <id> add rect|octagon|circle|hex|poly --at x,y --size WxH [--points x,y,…] [--split bsp|rows|cols|grid|cuts] [--min 3] [--cuts-x 4,8] [--cuts-y 6] [--seed n] [--doors 0.25] [--block-id b1]',
      '                  | split <bid> [--seed n] [--split mode] [--min n] | rm <bid>   one shape split into rooms that share walls, with doors between (a block id in link means its nearest room)',
    ],
    text: (r, i) => [`${r.m.id}: ${r.note}`, ...warningLines(r.m), next(i, r.m.id)].join('\n'), json: r => V(r.m.blocks ?? []),
  },
  mcp: { exclude: 'dungeon_edit add_block / split_block / remove_block covers it' }, python: {},
});

const connect = defineOp({
  name: 'dungeon.connect', module: 'maps', effect: 'write', summary: 'Put a door or an opening in the wall two touching rooms share.',
  params: {
    id: idParam('the dungeon id', 'dungeon connect: <id>'), path: pathParam('dungeon'),
    a: p.str('the first room', { positional: true, required: 'dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1]' }),
    b: p.str('the second room', { positional: true, required: 'dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1]' }),
    kind: p.oneOf([...dungeon.DOOR_KINDS, 'open'], 'door | secret | locked | portcullis | arch | open', { error: `open or one of ${dungeon.DOOR_KINDS.join(', ')}` }),
    at: p.str('a point on their shared wall: x,y'), width: p.num('the opening in cells (default 1)'), origin: p.str('who wrote it (a sync replaces its own)'),
  },
  run(i: Inp, ctx) {
    let line = '';
    const m = updateDungeon(projectOf(i, ctx), refOf(i), m => { line = dungeon.editDungeon(m, { op: 'connect', a: i.a, b: i.b, ...(i.at && { at: i.at }), ...(i.kind && { kind: i.kind }), ...(i.width !== undefined && { width: i.width }), ...originOf(i.origin) }); });
    return { m, line };
  },
  cli: {
    usage: '       artgen dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1] | disconnect <id> <i>   a door or opening in the wall two touching rooms share',
    text: (r, i) => [`${r.m.id}: ${r.line}`, ...warningLines(r.m), next(i, r.m.id)].join('\n'), json: r => V(r.m.connections),
  },
  mcp: { exclude: 'dungeon_edit connect covers it' }, python: {},
});

const disconnect = defineOp({
  name: 'dungeon.disconnect', module: 'maps', effect: 'write', summary: 'Remove a connection between touching rooms.',
  params: { id: idParam('the dungeon id', 'dungeon disconnect: <id> <index>'), path: pathParam('dungeon'), index: p.str('the connection\'s index (dungeon show)', { positional: true }) },
  run(i: Inp, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), m => {
      const k = Number(i.index);
      if (!Number.isInteger(k) || k < 0 || k >= (m.connections?.length ?? 0)) throw new Error(`dungeon disconnect <id> <index> (connections 0..${(m.connections?.length ?? 0) - 1}; artgen dungeon show)`);
      dungeon.editDungeon(m, { op: 'disconnect', index: k });
    });
  },
  cli: { usage: [], text: (m, i) => `${m.id}: ${m.connections?.length ?? 0} connections\n${next(i, m.id)}`, json: m => V(m.connections ?? []) },
  mcp: { exclude: 'dungeon_edit disconnect covers it' }, python: {},
});

const fit = defineOp({
  name: 'dungeon.fit', module: 'maps', effect: 'write', summary: 'Crop the sheet to the rooms, with a margin.',
  params: { id: idParam('the dungeon id', 'dungeon fit: <id>'), path: pathParam('dungeon'), margin: p.num('cells of margin (default 2)') },
  run(i: Inp, ctx) { return updateDungeon(projectOf(i, ctx), refOf(i), m => { dungeon.editDungeon(m, { op: 'fit', margin: i.margin ?? 2 }); }); },
  cli: { usage: '       artgen dungeon fit <id> [--margin 2]', text: (m, i) => `${m.id}: ${m.cols}×${m.rows} cells\n${next(i, m.id)}`, json: m => V({ cols: m.cols, rows: m.rows }) },
  mcp: { exclude: 'dungeon_edit fit covers it' }, python: {},
});

const label = defineOp({
  name: 'dungeon.label', module: 'maps', effect: 'write', summary: 'Add a label to a dungeon.',
  params: {
    id: idParam('the dungeon id', 'dungeon label: <id>'), path: pathParam('dungeon'), text: p.str('the label text', { positional: true }), at: p.str('x,y or a cell like C4'),
    kind: p.oneOf(dungeon.LABEL_KINDS, 'name (bold) | note (italic) | area (big spaced capitals); default name'), size: p.num('size factor'), angle: p.num('degrees'), href: p.str('a link: http(s), a relative path or #anchor'), origin: p.str('who wrote it (a sync replaces its own)'),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    if (!i.text || !i.at) throw new Error('dungeon label <id> "Text" --at x,y|C4');
    const m = updateDungeon(P, refOf(i), m => {
      const [x, y] = dungeon.parsePoint(i.at);
      m.overlay.labels.push({ text: i.text, x, y, kind: (i.kind ?? 'name') as dungeon.LabelKind, ...(i.size !== undefined && { size: i.size }), ...(i.angle !== undefined && { angle: i.angle }), ...(i.href && { href: i.href }), ...originOf(i.origin) });
    });
    return { m, n: m.overlay.labels.length };
  },
  cli: { usage: '       artgen dungeon label <id> "Text" --at x,y|C4 [--kind name|note|area] [--size f] [--angle deg] [--href url] [--origin name]', text: (r, i) => [`${r.m.id}: label ${r.n - 1} "${i.text}"`, ...warningLines(r.m), next(i, r.m.id)].join('\n'), json: r => V(r.m.overlay.labels) },
  mcp: { exclude: 'dungeon_overlay add_labels covers it' }, python: {},
});

const symbol = defineOp({
  name: 'dungeon.symbol', module: 'maps', effect: 'write', summary: 'Add a symbol to a dungeon.',
  params: {
    id: idParam('the dungeon id', 'dungeon symbol: <id>'), path: pathParam('dungeon'), kind: p.str('the symbol kind (artgen dungeon symbols)', { positional: true }), at: p.str('x,y or a cell like C4'),
    scale: p.num('size factor'), angle: p.num('degrees'), origin: p.str('who wrote it (a sync replaces its own)'),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    if (!i.kind || !i.at) throw new Error('dungeon symbol <id> <kind> --at x,y|C4 (kinds: artgen dungeon symbols)');
    const m = updateDungeon(P, refOf(i), m => {
      const [x, y] = dungeon.parsePoint(i.at);
      if (!dungeon.SYMBOLS[i.kind]) throw new Error(`unknown symbol ${i.kind} (have: ${dungeon.SYMBOL_KINDS.join(', ')})`);
      m.overlay.symbols.push({ kind: i.kind, x, y, ...(i.scale !== undefined && { scale: i.scale }), ...(i.angle !== undefined && { angle: i.angle }), ...originOf(i.origin) });
    });
    return { m, n: m.overlay.symbols.length };
  },
  cli: { usage: '       artgen dungeon symbol <id> <kind> --at x,y|C4 [--scale f] [--angle deg] [--origin name]', text: (r, i) => [`${r.m.id}: symbol ${r.n - 1} "${i.kind}"`, ...warningLines(r.m), next(i, r.m.id)].join('\n'), json: r => V(r.m.overlay.symbols) },
  mcp: { exclude: 'dungeon_overlay add_symbols covers it' }, python: {},
});

const check = defineOp({
  name: 'dungeon.check', module: 'maps', effect: 'read', summary: 'Check a dungeon file: every error with its JSON path, then drawing errors and warnings.',
  description: 'Check a dungeon: every error in its file with the JSON path (a field out of range, a room id that is not there), then drawing errors and warnings (a room outline that crosses itself, rooms laid over each other, a corridor through a room it does not join or across another, a door never drawn, a mark off the sheet or on a room number). Fix errors before rendering; look at each warning.',
  params: { id: idParam('the dungeon id', 'dungeon check: <id>'), path: pathParam('dungeon') },
  run: (i: Inp, ctx) => checkDungeonFile(projectOf(i, ctx), refOf(i)),
  cli: {
    usage: '       artgen dungeon check <id> [--json]   every error in the file with its JSON path, then drawing errors and warnings (a room outline that crosses itself, rooms laid over each other, a corridor through a room it does not join or across another, a door never drawn, a mark off the sheet or on a badge); exits 1 when there are errors',
    text(r) {
      const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
      return [r.ok ? `${r.file}: ok${r.warnings.length ? `, ${n(r.warnings.length, 'warning')}` : ''}` : `${r.file}: ${n(r.errors.length, 'error')}${r.warnings.length ? `, ${n(r.warnings.length, 'warning')}` : ''}`,
        ...r.errors.map((e: { path: string; message: string }) => `  error: ${e.path || '(file)'}: ${e.message}`), ...r.warnings.map((e: { path: string; message: string }) => `  warning: ${e.path || '(file)'}: ${e.message}`)].join('\n');
    },
    json: r => V(r), exit: r => (r.ok ? 0 : 1),
  },
  mcp: {}, python: {},
});

const overlay = defineOp({
  name: 'dungeon.overlay', module: 'maps', effect: 'write', summary: 'Remove or clear labels and symbols on a dungeon, or add them as JSON lists.',
  description: 'Labels and symbols over a dungeon (the follow-up layer). add_labels: [{text, at:"x,y"|"C4" or x,y, kind: name|note|area, size?, angle?, href? (a link: http(s), a relative path or #anchor)}]; add_symbols: [{kind, at or x,y, scale?, angle?}] (kinds from dungeon_list: stairs, pillar, statue, altar, chest, trap, pit, pool, …); remove_labels / remove_symbols: indices (from dungeon_get); clear: "labels"|"symbols"|"all". Room names and numbers are room settings (dungeon_edit set_room).',
  params: { id: idParam('the dungeon id', 'dungeon overlay: <id> rm|clear'), path: pathParam('dungeon'), ...overlayParams('labels | symbols') },
  run(i: Inp, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), m => {
      const pt = (o: Inp): [number, number] => (typeof o.at === 'string' ? dungeon.parsePoint(o.at) : Array.isArray(o.at) ? [Number(o.at[0]), Number(o.at[1])] : [Number(o.x), Number(o.y)]);
      overlayEdit(m, i, {
        name: 'dungeon', strict: ctx.surface === 'cli',
        addLabel(l) { const [x, y] = pt(l); m.overlay.labels.push({ text: String(l.text), x, y, kind: (l.kind ?? 'name') as dungeon.LabelKind, ...(typeof l.size === 'number' && { size: l.size }), ...(typeof l.angle === 'number' && { angle: l.angle }), ...(typeof l.href === 'string' && l.href && { href: l.href }), ...(typeof l.origin === 'string' && l.origin && { origin: l.origin }) }); },
        addSymbol(s) {
          if (!dungeon.SYMBOLS[String(s.kind)]) throw new Error(`unknown symbol ${String(s.kind)} (have: ${dungeon.SYMBOL_KINDS.join(', ')})`);
          const [x, y] = pt(s); m.overlay.symbols.push({ kind: String(s.kind), x, y, ...(typeof s.scale === 'number' && { scale: s.scale }), ...(typeof s.angle === 'number' && { angle: s.angle }), ...(typeof s.origin === 'string' && s.origin && { origin: s.origin }) });
        },
      });
    });
  },
  cli: {
    usage: '       artgen dungeon overlay <id> rm label|symbol <i> | clear [labels|symbols]   or  [--add-labels \'<json>\'] [--add-symbols \'<json>\'] [--remove-labels i,j] [--remove-symbols i,j] [--clear labels|symbols|all]',
    text: m => `${m.id}: ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols`, json: m => V(m.overlay),
  },
  mcp: { content: m => [text(overlayLines(m))] }, python: {},
});

/** dungeon_render also returns the PNG, drawn at 24 px a cell unless ppu is given. */
async function renderPreview(r: Inp, i: Inp, ctx: Ctx): Promise<Content[]> {
  const P = ctx.project(), layers = layersOf(i.layers, v => parseLayers(v, dungeon.DUNGEON_LAYERS));
  const files = r.files.map((f: string) => ctx.rel(f));
  const look = typeof i.ppu === 'number' ? files.filter((f: string) => f.endsWith('.png')) : (await renderDungeonFiles(P, i.id, { ppu: 24, layers, formats: ['png'], out: join(P.art, 'dungeons', i.id, 'out', 'preview') })).files.map((f: string) => ctx.rel(f));
  return [text({ ...r, files }), ...look.map((f: string) => pngFile(join(P.root, f)))];
}

const render = defineOp({
  name: 'dungeon.render', module: 'maps', effect: 'render', summary: 'Render a dungeon to black-and-white SVG and/or PNG.',
  description: 'Render a dungeon to art/dungeons/<id>/out/ (black-and-white SVG + PNG) and return the PNG to look at. layers turns layers off/on: rock, floors, grid, doors, symbols, numbers, labels, title, scale, compass. ppu: pixels per cell (default 40; the returned image uses 24 unless set).',
  params: {
    id: idParam('the dungeon id', 'dungeon render: <id>'), path: pathParam('dungeon'), ppu: p.num('pixels per cell (default 40)'),
    layers: p.str('layers to turn off/on, e.g. grid=off,labels=off', { schema: { type: 'object', description: 'layers to turn off/on, e.g. { grid: false }' } }),
    format: p.oneOf(['svg', 'png', 'both'], 'svg, png or both (default both)', { mcp: false, error: 'svg, png or both' }), fit: p.str('180x260mm or 800x600px: pick the scale that fits the window in the box', { mcp: false }),
    page_scale: p.str('output pixels per millimetre on the page', { mcp: false }), crop: p.str('x,y,w,h in cells: a window on the render', { mcp: false }),
    room: { kind: 'string', doc: 'crop round this room (a room id or a number like F.3), its doors and the first --margin cells of each corridor; repeat for more', repeat: true, mcp: false } as Param,
    margin: p.num('with --room: cells of margin (default 2)', { mcp: false }), out: p.str('the folder to render into', { mcp: false }),
  },
  async run(i: Inp, ctx) {
    const P = projectOf(i, ctx), format = i.format ?? 'both';
    return renderDungeonFiles(P, refOf(i), {
      formats: format === 'both' ? ['svg', 'png'] : [format as 'svg' | 'png'], ppu: i.ppu, pageScale: pageScaleOf(i.page_scale), ...viewOf(i, () => 1),
      rooms: i.room ?? [], margin: i.margin, layers: layersOf(i.layers, v => parseLayers(v, dungeon.DUNGEON_LAYERS)), out: i.out,
    });
  },
  cli: {
    usage: [
      '       artgen dungeon render <id> [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h] [--room id|F.3 … [--margin 2]] [--layers grid=off,labels=off] [--out dir]',
      '         (--room, repeated, crops round those rooms, their doors and the first --margin cells of each corridor)',
    ],
    text: (r, i) => [`${i.path ?? i.id} ${r.size.join('×')} px, ${r.ppu} px a cell, window ${r.crop.join(',')}: ${r.rooms} rooms, ${r.corridors} corridors, ${r.doors} doors`, ...r.unplaced.map((u: { index: number; text: string }) => `  no free spot for label ${u.index} "${u.text}"`), ...r.files.map((f: string) => `  ${f}`)].join('\n'),
    json: r => V(r),
  },
  mcp: { content: renderPreview }, python: {},
});

const facts = defineOp({
  name: 'dungeon.facts', module: 'maps', effect: 'read', summary: 'A dungeon read back as numbers: each room\'s box and doors, corridors, exits, overlaps and unreached rooms.',
  description: 'A dungeon read back as numbers: each room\'s box and doors, each corridor\'s ends and length, the exits, the overlapping rooms and the rooms no corridor reaches. Positions in cells, lengths also in the scale unit.',
  params: { id: idParam('the dungeon id', 'dungeon facts: <id>'), path: pathParam('dungeon') },
  run: (i: Inp, ctx) => dungeon.dungeonFacts(readDungeon(projectOf(i, ctx), refOf(i))),
  cli: { usage: '       artgen dungeon facts <id> [--json]   each room\'s box and doors, each corridor\'s ends and length, the exits, the overlapping rooms and the rooms no corridor reaches', text: r => describeDungeonFacts(r), json: r => V(r) },
  mcp: {}, python: {},
});

const sync = defineOp({
  name: 'dungeon.sync', module: 'maps', effect: 'write', summary: 'Replace the entries of one origin from a regenerated file, keeping every other.',
  params: {
    origin: p.str('the origin to replace (e.g. tables)', { required: 'dungeon sync <id>|--file target.json --from new.json --origin tables' }),
    from: p.str('the new file: every entry in it carries the origin', { required: 'dungeon sync <id>|--file target.json --from new.json --origin tables' }),
    id: idParam('the dungeon id', 'dungeon sync: <id>'), path: pathParam('dungeon'),
  },
  run(i: Inp, ctx) {
    let report!: SyncReport;
    updateDungeon(projectOf(i, ctx), refOf(i), m => { const r = dungeon.syncDungeon(m, dungeon.parseDungeon(readJson(i.from)), i.origin); report = r.report; return r.spec; });
    return report;
  },
  cli: { usage: '       artgen dungeon sync <id>|--file target.json --from new.json --origin tables [--json]   the same for rooms, corridors, walls, labels and symbols; a hand-edited field of a generated room is reported and the table\'s value kept', text: (r, i) => syncText(String(i.path ?? i.id), r), json: r => V(r) },
  mcp: { exclude: 'reads --from by path (consumer tooling)' }, python: {},
});

export const DUNGEON_OPS_LIST: OpDef[] = [list, symbols, show, create, update, grid, style, gen, edit, roomCmd, block, link, unlink, door, connect, disconnect, fit, label, symbol, check, overlay, render, facts, sync];
