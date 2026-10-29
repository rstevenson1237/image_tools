/** The settlement operations (`artgen settlement …`, the MCP `settlement_*` tools). Implementations moved here from `maps-cli.ts` and the MCP server; the edits themselves are `editSettlement` in `artgen-mapgen`. */
import { join } from 'node:path';
import { dungeon, map, settlement } from 'artgen-core/maps';
import { onOff, parseLayers } from '../map.ts';
import { fileId, readJson } from '../projectfs.ts';
import {
  checkSettlementFile, createSettlement, describeSettlement, describeSettlementFacts, listSettlements, mapForSettlement, readSettlement, readSettlementUnderlay, renderSettlementFiles, settlementSummary, settlementWarningLines, updateSettlement,
} from '../settlement.ts';
import { idParam, layersOf, needPoints, pageScaleOf, pathParam, pngFile, projectOf, refOf, roomNumber, text, viewOf, withVersion, type Inp } from './maps-shared.ts';
import { defineOp, p, type Content, type Ctx, type OpDef, type Param } from './registry.ts';

const V = (data: unknown) => withVersion(data, settlement.SETTLEMENT_FORMAT);
const next = (i: Inp, id?: string) => (i.path ? `next: artgen settlement render --file ${i.path}` : `next: artgen settlement render ${id ?? i.id}`);
const CELLS = 'WIDTHxHEIGHT in cells, e.g. 8x6';
const numberOf = (v: unknown) => roomNumber(v, s => onOff(s));
/** `x,y` (cells) as a point. */
const pointOf = (v: unknown, name: string, required = true): [number, number] | undefined => {
  if (v === undefined) { if (required) throw new Error(`${name} x,y is required`); return undefined; }
  return dungeon.parsePoint(v as string);
};
const OBJ = { type: 'object' };

// ---- generator settings, as flags (MCP sends them as `gen`)
const GEN_PARAMS: Record<string, Param> = {
  size: p.size('the sheet in cells, e.g. 80x60', { mcp: false, error: CELLS }),
  buildings: p.num('buildings to lay out', { mcp: false }), density: p.num('how tightly they pack, 0..1', { mcp: false }), trees: p.num('tree cover, 0..1', { mcp: false }), fields: p.num('field cover, 0..1', { mcp: false }),
  streets: p.str('organic | grid | radial', { mcp: false }), wall: p.str('none | palisade | stone', { mcp: false }), water: p.str('none | river | lake | coast | moat', { mcp: false }),
  market: p.bool('a market square', { style: 'onoff', mcp: false }), castle: p.bool('a castle', { style: 'onoff', mcp: false }), interiors: p.bool('lay out every building\'s floors too', { style: 'onoff', mcp: false }),
};
function applyGenFlags(m: settlement.SettlementSpec, i: Inp): void {
  if (typeof i.seed === 'number') m.seed = i.seed;
  if (i.size) [m.cols, m.rows] = i.size;
  if (typeof i.kind === 'string') m.kind = i.kind as settlement.SettlementKind;
  for (const k of ['buildings', 'density', 'trees', 'fields'] as const) if (i[k] !== undefined) m.gen[k] = i[k];
  for (const k of ['streets', 'wall', 'water'] as const) if (i[k] !== undefined) (m.gen as Record<string, unknown>)[k] = i[k];
  for (const k of ['market', 'castle', 'interiors'] as const) if (i[k] !== undefined) m.gen[k] = i[k];
}

const list = defineOp({
  name: 'settlement.list', module: 'maps', effect: 'read', summary: 'List the settlements in the project (or the one named by --file).',
  description: 'Settlement maps (TTRPG villages, towns and castles, in colour or black and white) in art/settlements, plus the kinds every settlement tool accepts: settlement kinds, building kinds, shapes and roofs, road, water, wall, gate, area and tree kinds, fixture (furniture) kinds and edit ops.',
  params: { path: pathParam('settlement') },
  run: (i: Inp, ctx) => (i.path ? [settlementSummary(readSettlement(null, { file: i.path }))] : listSettlements(ctx.project())),
  cli: {
    usage: '       artgen settlement list | show <id> | symbols | fixtures',
    text: ss => (ss.length ? ss.map((s: ReturnType<typeof settlementSummary>) => `${s.id.padEnd(16)} ${s.kind.padEnd(8)} ${s.size.padEnd(8)} ${s.buildings} buildings (${s.interiors} with floors), ${s.roads} roads, ${s.walls} walls${s.title ? `  "${s.title}"` : ''}`).join('\n') : 'no settlements yet: artgen settlement new <id>'),
    json: ss => V(ss),
  },
  mcp: {
    content: ss => [text({
      settlements: ss, kinds: settlement.SETTLEMENT_KINDS, buildings: settlement.BUILDING_KINDS, shapes: settlement.BUILDING_SHAPES, roofs: settlement.ROOFS,
      roads: settlement.ROAD_KINDS, water: settlement.WATER_KINDS, walls: settlement.WALL_KINDS, gates: settlement.GATE_KINDS, areas: settlement.AREA_KINDS, trees: settlement.TREE_KINDS,
      fixtures: settlement.FIXTURE_KINDS, symbols: settlement.SYMBOL_KINDS, labelKinds: settlement.LABEL_KINDS, ops: settlement.SETTLEMENT_OPS,
    })],
  },
  python: {},
});

const symbols = defineOp({
  name: 'settlement.symbols', module: 'maps', effect: 'read', summary: 'List the symbol kinds a settlement can carry.',
  params: {}, run: () => settlement.SYMBOL_KINDS,
  cli: { usage: [], text: () => Object.entries(settlement.SYMBOLS).map(([k, v]) => `${k.padEnd(12)} ${v.name}`).join('\n'), json: kinds => V(kinds) },
  mcp: { exclude: 'settlement_list returns the symbol kinds' }, python: {},
});

const fixtures = defineOp({
  name: 'settlement.fixtures', module: 'maps', effect: 'read', summary: 'List the furniture and fixture kinds, with their true sizes.',
  params: {}, run: () => Object.entries(settlement.FIXTURES).map(([kind, v]) => ({ kind, name: v.name, group: v.group, ft: v.ft })),
  cli: { usage: [], text: r => r.map((f: { kind: string; name: string; group: string; ft: number[] }) => `${f.kind.padEnd(14)} ${f.group.padEnd(10)} ${String(f.ft[0]).padStart(3)}×${String(f.ft[1]).padEnd(4)} ft  ${f.name}`).join('\n'), json: r => V(r) },
  mcp: { exclude: 'settlement_list returns the fixture kinds' }, python: {},
});

const show = defineOp({
  name: 'settlement.show', module: 'maps', effect: 'read', summary: 'Show a settlement: buildings with ids, kinds and floors, roads, water, walls, areas, trees and props.',
  description: 'A settlement\'s file (art/settlements/<id>/settlement.json) and a readable summary: buildings with ids, kinds and floors, roads, water, walls with their indices, areas, trees and props.',
  params: { id: idParam('the settlement id', 'settlement show: <id>'), path: pathParam('settlement'), file: p.bool('false: the summary only, without the file', { cli: false }) },
  run: (i: Inp, ctx) => readSettlement(projectOf(i, ctx), refOf(i)),
  cli: { usage: [], text: m => describeSettlement(m), json: m => V(m) },
  mcp: { name: 'settlement_get', content: (m, i) => [text(describeSettlement(m)), ...(i.file === false ? [] : [text(m)])] }, python: {},
});

const create = defineOp({
  name: 'settlement.new', module: 'maps', effect: 'write', summary: 'Create a settlement: a hamlet, village, town, city or castle laid out from a seed, or an empty sheet.',
  description: 'Create a settlement map. kind: hamlet|village|town|city|castle (sets the sheet size, cell size and generator defaults: a town or city has 10 ft cells and a stone wall, a castle a curtain wall, keep and moat). mode "generate" (default): roads, water, walls, buildings, fields, trees and props from the seed and gen settings ({buildings, density 0..1, streets: organic|grid|radial, wall: none|palisade|stone, water: none|river|lake|coast|moat, trees 0..1, fields 0..1, market, castle, interiors (lay out every building\'s floors too)}); "empty": a blank sheet (add things with settlement_edit). map + at: a terrain map (its id in art/maps, or a path) under the sheet, its top-left at map units at=[x,y]; its rivers, lakes, sea, woods and slopes shape the layout. Render with settlement_render.',
  params: {
    id: idParam('the new settlement\'s id (a name, never a path)', 'settlement new: <id> is required'), path: pathParam('settlement'),
    kind: p.oneOf(settlement.SETTLEMENT_KINDS, 'hamlet | village | town | city | castle (default village)'),
    mode: p.oneOf(['generate', 'empty'], 'generate (default) or empty', { cli: false }), cols: p.num('columns', { cli: false }), rows: p.num('rows', { cli: false }),
    seed: p.num('the generator seed (default: random)'), title: p.str('the title'), gen: p.json(OBJ, 'generator settings: buildings, density, streets, wall, water, trees, fields, market, castle, interiors', { cli: false }),
    map: p.str('a terrain map (its id in art/maps, or a path) under the sheet'),
    at: p.str('with map: the sheet\'s top-left in map units, x,y', { schema: { type: 'array', items: { type: 'number' } } }),
    empty: p.bool('a blank sheet to draw on', { mcp: false }), force: p.bool('overwrite an existing file (with --file)', { mcp: false }), ...GEN_PARAMS,
    interiors: p.bool('lay out every building\'s floors too', { style: 'either', mcp: false }),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx), sid = i.path ? i.id ?? fileId(i.path) : i.id, kind = (i.kind ?? 'village') as settlement.SettlementKind;
    const base = settlement.newSettlement(sid, kind, {
      seed: typeof i.seed === 'number' ? i.seed : Math.floor(Math.random() * 1e6), ...(typeof i.cols === 'number' && { cols: i.cols }), ...(typeof i.rows === 'number' && { rows: i.rows }), ...(i.title && { title: i.title }),
    });
    applyGenFlags(base, i);
    if (i.gen && typeof i.gen === 'object') Object.assign(base.gen, i.gen);
    if (i.interiors === true) base.gen.interiors = true;
    const at = i.path ? { file: i.path } : sid;
    if (typeof i.map === 'string' && i.map) {
      const mp = mapForSettlement(P, at, i.map), mspec = map.parseMap(readJson(mp.path)), origin = Array.isArray(i.at) ? [Number(i.at[0]), Number(i.at[1])] as [number, number] : pointOf(i.at, '--at', false) ?? [0, 0];
      const scale = Math.round(((base.scale.perCell * settlement.feetIn(base.scale.unit)) / (mspec.scale.perCell * settlement.feetIn(mspec.scale.unit))) * 1e4) / 1e4;
      base.underlay = { map: mp.rel, origin, scale };
    }
    const spec = settlement.parseSettlement(base);
    const m = i.mode === 'empty' || i.empty === true ? spec : (() => { const u = readSettlementUnderlay(P, at, spec); return settlement.generateSettlement(spec, u ?? {}); })();
    return createSettlement(P, m, i.force === true, i.path ? { file: i.path } : undefined);
  },
  cli: {
    usage: [
      '       artgen settlement new <id> [--kind hamlet|village|town|city|castle] [--size 80x60] [--seed n] [--title "..."] [--empty] [--interiors] [--map <map id|path> --at x,y]',
      '                  a village, town or castle laid out from a seed (--empty: a blank sheet to draw on); --map sets a terrain map under it, its water, woods and slopes shaping the layout',
    ],
    text: (r, i) => `${r.file}\n${describeSettlement(r.settlement)}\n${next(i, r.settlement.id)}`, json: r => V({ file: r.file, settlement: r.settlement }),
  },
  mcp: { content: r => [text({ file: r.file, summary: describeSettlement(r.settlement) })] }, python: {},
});

const gen = defineOp({
  name: 'settlement.gen', module: 'maps', effect: 'write', summary: 'Lay a settlement out again from its seed, kind and generator settings; entries drawn by hand are kept.',
  description: 'Lay the settlement out again from its seed, kind and gen settings (pass seed / kind / gen / cols / rows to change them first). Everything the generator wrote before (origin "gen") is replaced; entries made by hand are kept and kept clear of. With gen.interiors every building gets floors.',
  params: {
    id: idParam('the settlement id', 'settlement gen: <id>'), path: pathParam('settlement'), seed: p.num('the generator seed'),
    kind: p.oneOf(settlement.SETTLEMENT_KINDS, 'hamlet | village | town | city | castle', { schema: { type: 'string' } }), gen: p.json(OBJ, 'generator settings to change first', { cli: false }),
    cols: p.num('columns', { cli: false }), rows: p.num('rows', { cli: false }), ...GEN_PARAMS,
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx), ref = refOf(i);
    return updateSettlement(P, ref, m => {
      applyGenFlags(m, i);
      if (i.gen && typeof i.gen === 'object') Object.assign(m.gen, i.gen);
      if (typeof i.cols === 'number') m.cols = i.cols;
      if (typeof i.rows === 'number') m.rows = i.rows;
      const s = settlement.parseSettlement(m);
      return settlement.generateSettlement(s, readSettlementUnderlay(P, ref, s) ?? {});
    });
  },
  cli: {
    usage: [
      '       artgen settlement gen <id> [--seed n] [--kind k] [--size WxH] [--buildings n] [--density f] [--streets organic|grid|radial] [--wall none|palisade|stone] [--water none|river|lake|coast|moat]',
      '                  [--trees f] [--fields f] [--market on|off] [--castle on|off] [--interiors on|off]   lays it out again; entries drawn by hand (no origin) are kept',
    ],
    text: (m, i) => `${describeSettlement(m)}\n${next(i, m.id)}`, json: m => V(m),
  },
  mcp: { name: 'settlement_generate', content: m => [text(describeSettlement(m))] }, python: {},
});

const update = defineOp({
  name: 'settlement.update', module: 'maps', effect: 'write', summary: 'Change a settlement\'s settings (not its contents).',
  description: 'Change a settlement\'s settings (not its contents): title, kind, ground (grass|dirt|sand|snow|stone), cols, rows, seed, gen (generator settings, used by settlement_generate), grid: {show, size (cells), sub}, grid_size (in the sheet\'s unit, e.g. 10 ft), scale: {perCell, unit}, plan_cell (feet in a floor-plan cell, default 5), numbers, scale_bar, compass, legend, furniture: {place: over|outside|auto, side?: bottom|right}, underlay: {map, origin, scale, theme?} or null.',
  params: {
    id: idParam('the settlement id', 'settlement update: <id>'), path: pathParam('settlement'), title: p.str('the title ("" removes it)'), kind: p.str('hamlet | village | town | city | castle'), ground: p.str('grass | dirt | sand | snow | stone'),
    cols: p.num('columns'), rows: p.num('rows'), seed: p.num('the generator seed'), gen: p.json(OBJ, 'generator settings, as JSON'), grid: p.json(OBJ, 'grid settings, as JSON: {show, size (cells), sub}'),
    grid_size: p.num('the grid size in the sheet\'s unit, e.g. 10 ft'), scale: p.json(OBJ, 'scale settings, as JSON: {perCell, unit}'), plan_cell: p.num('feet in a floor-plan cell (default 5)'),
    numbers: p.bool('show building numbers', { style: 'onoff' }), scale_bar: p.bool('show the scale bar', { style: 'onoff' }), compass: p.bool('show the compass', { style: 'onoff' }), legend: p.bool('show the legend', { style: 'onoff' }),
    furniture: p.json(OBJ, 'where the title, scale bar, compass and legend go, as JSON: {place, side}'), underlay: p.json({ type: ['object', 'null'] }, 'a terrain map under the sheet, as JSON: {map, origin, scale, theme?}, or null to remove it'),
  },
  run(i: Inp, ctx) {
    return updateSettlement(projectOf(i, ctx), refOf(i), m => {
      for (const k of ['gen', 'grid', 'scale'] as const) if (i[k] && typeof i[k] === 'object') Object.assign(m[k], i[k]);
      if (typeof i.grid_size === 'number') m.grid = { ...m.grid, show: true, size: i.grid_size / m.scale.perCell };
      if (typeof i.plan_cell === 'number') m.interior.perCell = i.plan_cell;
      if (typeof i.title === 'string') { if (i.title) m.title = i.title; else delete m.title; }
      for (const k of ['kind', 'ground'] as const) if (typeof i[k] === 'string') (m as unknown as Inp)[k] = i[k];
      for (const k of ['cols', 'rows', 'seed'] as const) if (typeof i[k] === 'number') m[k] = i[k] as number;
      if (typeof i.numbers === 'boolean') m.numbers = i.numbers;
      if (typeof i.scale_bar === 'boolean') m.scaleBar = i.scale_bar;
      if (typeof i.compass === 'boolean') m.compass = i.compass;
      if (typeof i.legend === 'boolean') m.legend = i.legend;
      if (i.furniture && typeof i.furniture === 'object') m.furniture = i.furniture as settlement.SettlementSpec['furniture'];
      if (i.underlay === null) delete m.underlay; else if (i.underlay && typeof i.underlay === 'object') m.underlay = i.underlay as settlement.SettlementSpec['underlay'];
    });
  },
  cli: {
    usage: `       artgen settlement update <id> [--title "..."] [--kind k] [--ground g] [--cols n] [--rows n] [--seed n] [--gen|--grid|--scale|--furniture|--underlay '<json>'] [--grid-size 10] [--plan-cell 5] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off]`,
    text: (m, i) => `${describeSettlement(m).split('\n').slice(0, 3).join('\n')}\n${next(i, m.id)}`, json: m => V(m),
  },
  mcp: { content: m => [text(describeSettlement(m).split('\n').slice(0, 3).join('\n'))] }, python: {},
});

const edit = defineOp({
  name: 'settlement.edit', module: 'maps', effect: 'write', summary: 'Change a settlement\'s contents with a list of edits, in order.',
  description: 'Change a settlement\'s contents, in order. Site coordinates are cells (x right, y down; settlement_get says the cell size); a building\'s floor coordinates are plan cells (5 ft) from the footprint\'s top-left corner before it is turned. ops (each {op, …fields}): building.add {kind, x, y, w, h, shape?: rect|L|T|circle|octagon|poly, points?, wing?: [w,h] (L/T), angle? (degrees), roof?: gable|hip|flat|battlement|cone|thatch|none, stories?, label?, number? (false hides it), href?, id?} | building.set {id, …the same} | building.move {id, x, y} | building.rm {id} | interior {id, seed?, stories?} (lay its floors out: rooms, doors, windows, stairs, furniture by kind) | interior.clear {id} | floor.add {building, level (0 ground, 1 up, -1 cellar), name?} | floor.rm {building, level} | room.add {building, level, shape?: rect|circle|octagon|cave|poly, x, y, w, h, points?, label?, id?} | room.set {building, level, id, …} | room.rm {building, level, id} | connect {building, level, a, b, kind?: door|secret|locked|portcullis|arch|open, at?, width?} (a door in the wall two rooms share) | disconnect {building, level, index} | door {building, level, at: [x,y], kind?, width?} (in the outer wall) | window {building, level, at, width?} | fixture.add {building, level, kind, x, y (its centre), w?, h? (default: the kind\'s true size), angle?, label?} | fixture.rm {building, level, index} | prop.add {kind, x, y, w?, h?, angle?} (a fixture on the site: well, cart, stall, …) | prop.rm {index} | road.add {kind: highway|street|lane|alley|path|track, points: [x,y,…], width?, curve?: smooth, label?} | water.add {kind: river|stream|canal|moat (lines, width?) | pond|lake|sea (areas), points} | wall.add {kind: curtain|stone|palisade|fence|hedge|drystone|ruined, points, closed?, thickness?, towers?: {shape: round|square, size?, at?: "corners"|[vertex indices], every? (cells)}} | wall.gate {index, at, kind?: gatehouse|gate|postern|opening, width?, drawbridge?} | area.add {kind: field|garden|orchard|wood|scrub|marsh|graveyard|market|square|yard|paddock|rubble, points, label?} | tree.add {kind: tree|conifer|bush|rock|boulder|stump|reeds, x, y, size?} | tree.scatter {kind, area: [x,y,…], count, seed?} | label {text, x, y, kind?: name|note|area|street, size?, angle?, href?} | symbol {kind, x, y, scale?, angle?} | road.rm, water.rm, wall.rm, area.rm, tree.rm, label.rm, symbol.rm {index}.',
  params: {
    id: idParam('the settlement id', 'settlement edit: <id>'), path: pathParam('settlement'),
    ops: p.json({ type: 'array', items: { type: 'object' } }, `a list of edits as JSON (or @file.json): ${settlement.SETTLEMENT_OPS.join(', ')} (see the MCP tool settlement_edit for the fields)`, { required: 'settlement edit: --ops \'<json list>\' (or @file.json) is required' }),
  },
  run(i: Inp, ctx) {
    const done: string[] = [];
    const m = updateSettlement(projectOf(i, ctx), refOf(i), m => {
      const ops = i.ops ?? [];
      if (!Array.isArray(ops)) throw new Error('ops: a list of edits');
      for (const o of ops as settlement.SettlementOp[]) done.push(settlement.editSettlement(m, o));
    });
    return { m, lines: done };
  },
  cli: {
    usage: `       artgen settlement edit <id> --ops '<json list>'   a batch of edits in order (${settlement.SETTLEMENT_OPS.join(', ')}); @file.json reads them from a file`,
    text: (r, i) => [...r.lines, ...settlementWarningLines(r.m), next(i, r.m.id)].join('\n'), json: r => V({ done: r.lines, settlement: settlementSummary(r.m) }),
  },
  mcp: { content: r => [text([...r.lines, ...settlementWarningLines(r.m)].join('\n'))] }, python: {},
});

// ---- the one-edit commands: each builds edits and applies them through the same function as `settlement edit`
type Edited = { m: settlement.SettlementSpec; lines: string[] };
const editText = (r: Edited, i: Inp) => [...r.lines, ...settlementWarningLines(r.m), next(i, r.m.id)].join('\n');
const editJson = (r: Edited) => V({ done: r.lines, settlement: settlementSummary(r.m) });
function sugar(name: string, summary: string, usage: string | string[], params: Record<string, Param>, build: (i: Inp) => settlement.SettlementOp[]): OpDef {
  return defineOp({
    name: `settlement.${name}`, module: 'maps', effect: 'write', summary, params: { path: pathParam('settlement'), ...params },
    run(i: Inp, ctx): Edited {
      const P = projectOf(i, ctx), ops = build(i), lines: string[] = [];
      const m = updateSettlement(P, refOf(i), m => { for (const o of ops) lines.push(settlement.editSettlement(m, o)); });
      return { m, lines };
    },
    cli: { usage, text: editText, json: editJson }, mcp: { exclude: 'settlement_edit covers it' }, python: {},
  });
}
const id = (req: string) => idParam('the settlement id', `settlement ${req}`);
const level = (i: Inp): number => i.level ?? 0;
const LEVEL = p.num('the floor: 0 ground (default), 1 up, -1 cellar');
const AT = p.str('x,y');
const SIZE = p.size('width x height, e.g. 6x4', { error: CELLS });

/** The building flags (`--shape`, `--angle`, …) as edit fields. */
function buildingFields(i: Inp): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of ['shape', 'roof', 'label', 'href', 'kind'] as const) if (i[k] !== undefined) o[k] = i[k];
  for (const k of ['angle', 'stories'] as const) if (i[k] !== undefined) o[k] = i[k];
  const nb = numberOf(i.number);
  if (nb !== undefined) o.number = nb;
  const at = pointOf(i.at, '--at', false);
  if (i.points !== undefined) o.points = i.points;
  if (i.wing !== undefined) o.wing = i.wing;
  if (at) [o.x, o.y] = at;
  if (i.size) [o.w, o.h] = i.size;
  return o;
}
const BUILDING_PARAMS: Record<string, Param> = {
  shape: p.str('rect | L | T | circle | octagon | poly'), roof: p.str('gable | hip | flat | battlement | cone | thatch | none'), label: p.str('the name'), href: p.str('a link'), kind: p.str('the building kind'),
  angle: p.num('degrees'), stories: p.num('storeys'), number: p.str('the number on the plan (n, or off)'), points: p.points('poly: x,y,… of the outline'), wing: p.points('L and T: the wing, w,h'), at: AT, size: SIZE,
};

const building = sugar('building', 'Add, change, move or remove a building.',
  [
    '       artgen settlement building <id> add <kind> --at x,y --size WxH [--shape rect|L|T|circle|octagon|poly] [--points x,y,…] [--wing w,h] [--angle deg] [--roof r] [--stories n] [--label "..."] [--number n|off] [--building-id b9] [--href url]',
    `                  | set <bid> [the same flags] | move <bid> --at x,y | rm <bid>      (kinds: ${settlement.BUILDING_KINDS.join(', ')}; roofs: ${settlement.ROOFS.join(', ')})`,
  ],
  { id: id('building: <id>'), action: p.str('add | set | move | rm', { positional: true }), target: p.str('add: the building kind; set, move, rm: the building id', { positional: true }), ...BUILDING_PARAMS, building_id: p.str('add: the new building\'s id (default b<n>)') },
  i => {
    const act = i.action, bid = i.target;
    if (act === 'add') { const kind = bid; if (!kind) throw new Error('settlement building <id> add <kind> --at x,y --size WxH'); const o = buildingFields(i); return [{ op: 'building.add', ...o, kind, ...(i.building_id && { id: i.building_id }) }]; }
    if (act === 'set') return [{ op: 'building.set', id: bid, ...buildingFields(i) }];
    if (act === 'move') { const at = pointOf(i.at, '--at')!; return [{ op: 'building.move', id: bid, x: at[0], y: at[1] }]; }
    if (act === 'rm') return [{ op: 'building.rm', id: bid }];
    throw new Error('settlement building <id> add|set|move|rm …');
  });

const interior = sugar('interior', 'Lay a building\'s floors out (rooms, doors, windows, stairs, furniture), or clear them.',
  '       artgen settlement interior <id> <bid> [--seed n] [--stories n] | interior <id> <bid> clear     lay a building\'s floors out (rooms, doors, windows, stairs, furniture), or clear them',
  { id: id('interior: <id>'), building: p.str('the building id', { positional: true }), action: p.str('clear', { positional: true }), seed: p.num('the layout seed'), stories: p.num('storeys') },
  i => [i.action === 'clear' ? { op: 'interior.clear', id: i.building } : { op: 'interior', id: i.building, ...(i.seed !== undefined && { seed: i.seed }), ...(i.stories !== undefined && { stories: i.stories }) }]);

const floor = sugar('floor', 'Add or remove a floor of a building.',
  '       artgen settlement floor <id> <bid> add|rm --level n [--name "..."]',
  { id: id('floor: <id>'), building: p.str('the building id', { positional: true }), action: p.str('add | rm', { positional: true }), level: LEVEL, name: p.str('the floor\'s name') },
  i => {
    if (i.action !== 'add' && i.action !== 'rm') throw new Error('settlement floor <id> <bid> add|rm --level n [--name "..."]');
    return [{ op: `floor.${i.action}`, building: i.building, level: level(i), ...(i.name && { name: i.name }) }];
  });

const room = sugar('room', 'Add, change or remove a room on a building\'s floor.',
  '       artgen settlement room <id> <bid> add <shape> --at x,y --size WxH [--level n] [--label "..."] [--room-id r] | room <id> <bid> set|rm <rid> [--level n] …',
  {
    id: id('room: <id>'), building: p.str('the building id', { positional: true }), action: p.str('add | set | rm', { positional: true }), target: p.str('add: the shape (rect, circle, octagon, cave, poly); set, rm: the room id', { positional: true }),
    level: LEVEL, at: AT, size: SIZE, points: p.points('poly: x,y,… of the outline'), label: p.str('the room\'s name'), room_id: p.str('add: the new room\'s id'),
  },
  i => {
    const bid = i.building, act = i.action, x = i.target, size = i.size as [number, number] | undefined, at = pointOf(i.at, '--at', false);
    if (act === 'add') return [{ op: 'room.add', building: bid, level: level(i), shape: x ?? 'rect', ...(at && { x: at[0], y: at[1] }), ...(size && { w: size[0], h: size[1] }), ...(i.points && { points: i.points }), ...(i.label && { label: i.label }), ...(i.room_id && { id: i.room_id }) }];
    if (act === 'set') return [{ op: 'room.set', building: bid, level: level(i), id: x, ...(at && { x: at[0], y: at[1] }), ...(size && { w: size[0], h: size[1] }), ...(i.label !== undefined && { label: i.label }) }];
    if (act === 'rm') return [{ op: 'room.rm', building: bid, level: level(i), id: x }];
    throw new Error('settlement room <id> <bid> add|set|rm …');
  });

const KINDS_DOOR = 'door | secret | locked | portcullis | arch | open';
const connect = sugar('connect', 'Put a door or opening in the wall two rooms of a floor share.',
  '       artgen settlement connect <id> <bid> <room> <room> [--level n] [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width n] | disconnect <id> <bid> <i> [--level n]',
  { id: id('connect: <id>'), building: p.str('the building id', { positional: true }), a: p.str('the first room', { positional: true }), b: p.str('the second room', { positional: true }), level: LEVEL, kind: p.str(KINDS_DOOR), at: AT, width: p.num('the opening in cells') },
  i => [{ op: 'connect', building: i.building, level: level(i), a: i.a, b: i.b, ...(i.kind && { kind: i.kind }), ...(i.at !== undefined && { at: pointOf(i.at, '--at') }), ...(i.width !== undefined && { width: i.width }) }]);

const disconnect = sugar('disconnect', 'Remove a connection between two rooms of a floor.', [],
  { id: id('disconnect: <id>'), building: p.str('the building id', { positional: true }), index: p.str('the connection\'s index', { positional: true }), level: LEVEL },
  i => [{ op: 'disconnect', building: i.building, level: level(i), index: Number(i.index) }]);

const openingParams = (): Record<string, Param> => ({ building: p.str('the building id', { positional: true }), at: p.str('x,y in plan cells from the footprint\'s top-left corner'), level: LEVEL, kind: p.str('the kind'), width: p.num('width in cells') });
const door = sugar('door', 'Put a door in a building\'s outer wall.',
  '       artgen settlement door|window <id> <bid> --at x,y [--level n] [--kind k] [--width n]      a door or window in the outer wall (plan cells from the footprint\'s top-left corner)',
  { id: id('door: <id>'), ...openingParams() },
  i => [{ op: 'door', building: i.building, level: level(i), at: pointOf(i.at, '--at'), ...(i.kind && { kind: i.kind }), ...(i.width !== undefined && { width: i.width }) }]);
const windowOp = sugar('window', 'Put a window in a building\'s outer wall.', [],
  { id: id('window: <id>'), ...openingParams() },
  i => [{ op: 'window', building: i.building, level: level(i), at: pointOf(i.at, '--at'), ...(i.kind && { kind: i.kind }), ...(i.width !== undefined && { width: i.width }) }]);

const fixture = sugar('fixture', 'Add or remove a piece of furniture on a building\'s floor.',
  '       artgen settlement fixture <id> <bid> add <kind> --at x,y [--level n] [--size WxH] [--angle deg] [--label "..."] | rm <i> [--level n]',
  { id: id('fixture: <id>'), building: p.str('the building id', { positional: true }), action: p.str('add | rm', { positional: true }), what: p.str('add: the kind (settlement fixtures); rm: the index', { positional: true }), at: AT, level: LEVEL, size: SIZE, angle: p.num('degrees'), label: p.str('a label') },
  i => {
    if (i.action === 'add') { const at = pointOf(i.at, '--at')!, size = i.size as [number, number] | undefined; return [{ op: 'fixture.add', building: i.building, level: level(i), kind: i.what, x: at[0], y: at[1], ...(size && { w: size[0], h: size[1] }), ...(i.angle !== undefined && { angle: i.angle }), ...(i.label && { label: i.label }) }]; }
    if (i.action === 'rm') return [{ op: 'fixture.rm', building: i.building, level: level(i), index: Number(i.what) }];
    throw new Error('settlement fixture <id> <bid> add <kind> --at x,y [--level n] | rm <i>');
  });

const prop = sugar('prop', 'Add or remove a piece of furniture on the site (a well, a cart, a stall).',
  '       artgen settlement prop <id> add <kind> --at x,y [--size WxH] [--angle deg] | prop <id> rm <i>',
  { id: id('prop: <id>'), action: p.str('add | rm', { positional: true }), what: p.str('add: the kind (settlement fixtures); rm: the index', { positional: true }), at: AT, size: SIZE, angle: p.num('degrees'), label: p.str('a label') },
  i => {
    if (i.action === 'add') { const at = pointOf(i.at, '--at')!, size = i.size as [number, number] | undefined; return [{ op: 'prop.add', kind: i.what, x: at[0], y: at[1], ...(size && { w: size[0], h: size[1] }), ...(i.angle !== undefined && { angle: i.angle }), ...(i.label && { label: i.label }) }]; }
    if (i.action === 'rm') return [{ op: 'prop.rm', index: Number(i.what) }];
    throw new Error('settlement prop <id> add <kind> --at x,y | rm <i>');
  });

const LINE_PARAMS = (): Record<string, Param> => ({ points: p.points('x,y,… of the line or outline'), width: p.num('width'), curve: p.str('smooth'), label: p.str('a label') });
/** `settlement road|water|wall|area <id> add <kind> --points … | rm <i>`. */
function lineOp(sub: 'road' | 'water' | 'wall' | 'area', summary: string, usage: string | string[], extra: Record<string, Param> = {}): OpDef {
  return sugar(sub, summary, usage,
    { id: id(`${sub}: <id>`), action: p.str('add | rm' + (sub === 'wall' ? ' | gate' : ''), { positional: true }), what: p.str('add: the kind; rm' + (sub === 'wall' ? ', gate' : '') + ': the index', { positional: true }), ...LINE_PARAMS(), ...extra },
    i => {
      const act = i.action, what = i.what;
      if (act === 'rm') return [{ op: `${sub}.rm`, index: Number(what) }];
      if (sub === 'wall' && act === 'gate') return [{ op: 'wall.gate', index: Number(what), at: pointOf(i.at, '--at'), kind: i.kind ?? 'gate', ...(i.width !== undefined && { width: i.width }), ...(i.drawbridge === true && { drawbridge: true }) }];
      if (act !== 'add') throw new Error(`settlement ${sub} <id> add <kind> … | rm <i>`);
      const o: settlement.SettlementOp = { op: `${sub}.add`, kind: what, points: needPoints(i.points, '--points') };
      if (i.width !== undefined) o.width = i.width;
      if (i.curve) o.curve = i.curve;
      if (i.label) o.label = i.label;
      if (sub === 'wall') {
        if (i.closed === true) o.closed = true;
        if (i.thickness !== undefined) o.thickness = i.thickness;
        if (i.towers) o.towers = { shape: i.towers, ...(i.tower_size !== undefined && { size: i.tower_size }), ...(i.tower_every !== undefined && { every: i.tower_every }) };
      }
      return [o];
    });
}
const road = lineOp('road', 'Add or remove a road.', `       artgen settlement road <id> add highway|street|lane|alley|path|track --points x,y,… [--width n] [--curve smooth] [--label "..."] | road <id> rm <i>`);
const water = lineOp('water', 'Add or remove water.', '       artgen settlement water <id> add river|stream|canal|moat|pond|lake|sea --points x,y,… [--width n] | water <id> rm <i>');
const wall = lineOp('wall', 'Add a wall, put a gate in one, or remove one.',
  [
    '       artgen settlement wall <id> add curtain|stone|palisade|fence|hedge|drystone|ruined --points x,y,… [--closed] [--thickness n] [--towers round|square [--tower-size n] [--tower-every n]]',
    '                  | wall <id> gate <i> --at x,y [--kind gatehouse|gate|postern|opening] [--width n] [--drawbridge] | wall <id> rm <i>',
  ],
  { closed: p.bool('a closed ring'), thickness: p.num('thickness'), towers: p.str('round | square'), tower_size: p.num('tower size'), tower_every: p.num('a tower every n cells'), at: AT, kind: p.str('gate: gatehouse | gate | postern | opening'), drawbridge: p.bool('gate: with a drawbridge') });
const area = lineOp('area', 'Add or remove an area (field, wood, square, …).',
  `       artgen settlement area <id> add <kind> --points x,y,… [--label "..."] | area <id> rm <i>      (areas: ${settlement.AREA_KINDS.join(', ')}; trees: ${settlement.TREE_KINDS.join(', ')})`);

const tree = sugar('tree', 'Add, scatter or remove trees.',
  '       artgen settlement tree <id> add <kind> --at x,y [--size n] | tree <id> scatter <kind> --area x,y,… --count n | tree <id> rm <i>',
  { id: id('tree: <id>'), action: p.str('add | scatter | rm', { positional: true }), what: p.str('add, scatter: the kind; rm: the index', { positional: true }), at: AT, size: p.num('size'), area: p.points('scatter: the area, x,y,…'), count: p.num('scatter: how many (default 10)'), seed: p.num('scatter: the seed') },
  i => {
    const act = i.action, what = i.what;
    if (act === 'rm') return [{ op: 'tree.rm', index: Number(what) }];
    if (act === 'scatter') return [{ op: 'tree.scatter', kind: what ?? 'tree', area: needPoints(i.area, '--area'), count: i.count ?? 10, ...(i.seed !== undefined && { seed: i.seed }) }];
    if (act !== 'add') throw new Error('settlement tree <id> add <kind> … | rm <i>');
    const at = pointOf(i.at, '--at')!;
    return [{ op: 'tree.add', kind: what ?? 'tree', x: at[0], y: at[1], ...(i.size !== undefined && { size: i.size }) }];
  });

const grid = defineOp({
  name: 'settlement.grid', module: 'maps', effect: 'write', summary: 'Set a settlement\'s grid.',
  params: { id: id('grid: <id>'), path: pathParam('settlement'), mode: p.str('a size in the sheet\'s unit (10), or none', { positional: true }), sub: p.bool('a fainter sub-grid', { style: 'onoff' }) },
  run(i: Inp, ctx) {
    return updateSettlement(projectOf(i, ctx), refOf(i), m => {
      const mode = i.mode;
      if (mode === 'none' || mode === 'off') m.grid.show = false;
      else if (mode !== undefined) { const v = Number(mode); if (!(v > 0)) throw new Error('grid: a size in the sheet\'s unit (10), or none'); m.grid = { ...m.grid, show: true, size: v / m.scale.perCell }; }
      if (i.sub !== undefined) m.grid.sub = i.sub;
    });
  },
  cli: { usage: '       artgen settlement grid <id> [10|5|none] [--sub on|off]', text: (m, i) => `grid ${m.grid.show ? `every ${m.grid.size * m.scale.perCell} ${m.scale.unit}${m.grid.sub ? ', sub-grid' : ''}` : 'off'}\n${next(i, m.id)}`, json: m => V(m.grid) },
  mcp: { exclude: 'settlement_update covers it' }, python: {},
});

const style = defineOp({
  name: 'settlement.style', module: 'maps', effect: 'write', summary: 'Set a settlement\'s title, ground, scale and furniture.',
  params: {
    id: id('style: <id>'), path: pathParam('settlement'), title: p.str('the title ("" removes it)'), ground: p.str('grass | dirt | sand | snow | stone'),
    numbers: p.bool('show building numbers', { style: 'onoff' }), scale_bar: p.bool('show the scale bar', { style: 'onoff' }), compass: p.bool('show the compass', { style: 'onoff' }), legend: p.bool('show the legend', { style: 'onoff' }),
    per_cell: p.num('map units in one cell'), unit: p.str('the scale unit, e.g. ft'), plan_cell: p.num('feet in a floor-plan cell'), furniture: p.str('over | outside | auto'), furniture_side: p.str('bottom | right'),
  },
  run(i: Inp, ctx) {
    return updateSettlement(projectOf(i, ctx), refOf(i), m => {
      if (i.title !== undefined) { if (i.title) m.title = i.title; else delete m.title; }
      if (i.ground !== undefined) m.ground = i.ground as settlement.Ground;
      for (const k of ['numbers', 'scale_bar', 'compass', 'legend'] as const) if (i[k] !== undefined) m[k === 'scale_bar' ? 'scaleBar' : k] = i[k];
      if (i.per_cell !== undefined) m.scale.perCell = i.per_cell;
      if (i.unit) m.scale.unit = i.unit;
      if (i.plan_cell !== undefined) m.interior.perCell = i.plan_cell;
      if (i.furniture) m.furniture = { place: i.furniture as 'over', ...(i.furniture_side && { side: i.furniture_side as 'bottom' }) };
    });
  },
  cli: {
    usage: '       artgen settlement style <id> [--title "..."] [--ground grass|dirt|sand|snow|stone] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--per-cell n] [--unit ft] [--plan-cell n] [--furniture over|outside|auto]',
    text: (m, i) => `${describeSettlement(m).split('\n').slice(0, 3).join('\n')}\n${next(i, m.id)}`, json: m => V(m),
  },
  mcp: { exclude: 'settlement_update covers it' }, python: {},
});

const label = sugar('label', 'Add a label to a settlement.',
  '       artgen settlement label <id> "Text" --at x,y [--kind name|note|area|street] [--size f] [--angle deg] [--href url]',
  { id: id('label: <id>'), text: p.str('the label text', { positional: true }), at: AT, kind: p.str('name | note | area | street (default name)'), size: p.num('size factor'), angle: p.num('degrees'), href: p.str('a link') },
  i => { const at = pointOf(i.at, '--at')!; return [{ op: 'label', text: i.text, x: at[0], y: at[1], kind: i.kind ?? 'name', ...(i.size !== undefined && { size: i.size }), ...(i.angle !== undefined && { angle: i.angle }), ...(i.href && { href: i.href }) }]; });

const symbol = sugar('symbol', 'Add a symbol to a settlement.',
  '       artgen settlement symbol <id> <kind> --at x,y [--scale f] [--angle deg]',
  { id: id('symbol: <id>'), kind: p.str('the symbol kind (artgen settlement symbols)', { positional: true }), at: AT, scale: p.num('size factor'), angle: p.num('degrees') },
  i => { const at = pointOf(i.at, '--at')!; return [{ op: 'symbol', kind: i.kind, x: at[0], y: at[1], ...(i.scale !== undefined && { scale: i.scale }), ...(i.angle !== undefined && { angle: i.angle }) }]; });

const overlay = sugar('overlay', 'Remove a label or symbol from a settlement.',
  '       artgen settlement overlay <id> rm label|symbol <i>',
  { id: id('overlay: <id>'), action: p.str('rm', { positional: true }), which: p.str('label | symbol', { positional: true }), index: p.str('the item to remove', { positional: true }) },
  i => {
    if (i.action !== 'rm' || !['label', 'symbol'].includes(i.which)) throw new Error('settlement overlay <id> rm label|symbol <i>');
    return [{ op: `${i.which}.rm`, index: Number(i.index) }];
  });

const check = defineOp({
  name: 'settlement.check', module: 'maps', effect: 'read', summary: 'Check a settlement file: every error with its JSON path, then drawing warnings.',
  description: 'Check a settlement: every error in its file with the JSON path, then drawing warnings (buildings laid over each other, standing in water or across a road, a gate far from its wall, a room outside its footprint, furniture outside the building or on other furniture, stairs that meet nothing on the next floor, marks off the sheet).',
  params: { id: id('check: <id>'), path: pathParam('settlement') },
  run: (i: Inp, ctx) => checkSettlementFile(projectOf(i, ctx), refOf(i)),
  cli: {
    usage: '       artgen settlement check <id> [--json] | facts <id> [--json] | show <id> | list',
    text: r => [`${r.file}: ${r.ok ? 'ok' : `${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`}${r.warnings.length ? `, ${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'}` : ''}`, ...r.errors.map((e: { path: string; message: string }) => `  error: ${e.path || '(file)'}: ${e.message}`), ...r.warnings.map((w: { path: string; message: string }) => `  warning: ${w.path}: ${w.message}`)].join('\n'),
    json: r => V(r), exit: r => (r.ok ? 0 : 1),
  },
  mcp: {}, python: {},
});

const facts = defineOp({
  name: 'settlement.facts', module: 'maps', effect: 'read', summary: 'A settlement read back as numbers: counts by kind, each building, wall and road.',
  description: 'A settlement read back as numbers: counts by kind, each building\'s box, size, storeys and floors (rooms, doors, windows, furniture by kind), each wall\'s length, towers and gates, each road\'s length, water and areas.',
  params: { id: id('facts: <id>'), path: pathParam('settlement') },
  run: (i: Inp, ctx) => settlement.settlementFacts(readSettlement(projectOf(i, ctx), refOf(i))),
  cli: { usage: [], text: r => describeSettlementFacts(r), json: r => V(r) },
  mcp: {}, python: {},
});

/** settlement_render also returns the PNG, drawn small unless ppu is given; `plans` returns the file list only. */
const renderOptions = (i: Inp, ctx: Ctx) => ({
  themes: (i.theme === 'both' ? ['color', 'bw'] : [i.theme === 'bw' ? 'bw' : 'color']) as settlement.SettlementTheme[],
  ...((ctx.surface === 'mcp' ? i.view === 'plan' || typeof i.building === 'string' : i.view !== undefined) && { view: (ctx.surface === 'mcp' ? 'plan' : i.view) as settlement.SettlementView }),
  ...(typeof i.building === 'string' && i.building && { building: i.building }), ...(typeof i.floor === 'number' && { floor: i.floor }), ...(typeof i.buildings === 'string' && { buildings: i.buildings as settlement.BuildingMode }),
  layers: layersOf(i.layers, v => parseLayers(v, [...new Set([...settlement.SITE_LAYERS, ...settlement.PLAN_LAYERS])])),
});
async function renderPreview(rs: Inp[], i: Inp, ctx: Ctx): Promise<Content[]> {
  const P = ctx.project(), o = renderOptions(i, ctx), files = rs.flatMap(r => r.files.map((f: string) => ctx.rel(f)));
  if (i.plans === true) return [text({ renders: rs.length, files })];
  const spec = readSettlement(P, i.id);
  const look = typeof i.ppu === 'number' ? files.filter((f: string) => f.endsWith('.png')) : (await renderSettlementFiles(P, i.id, { ...o, ppu: o.view === 'plan' ? 28 : Math.max(4, Math.min(16, Math.round(1100 / Math.max(spec.cols, spec.rows)))), formats: ['png'], out: join(P.art, 'settlements', i.id, 'out', 'preview') })).flatMap(r => r.files.map(f => ctx.rel(f)));
  return [text({ ...rs[0], files }), ...look.map((f: string) => pngFile(join(P.root, f)))];
}

const render = defineOp({
  name: 'settlement.render', module: 'maps', effect: 'render', summary: 'Render a settlement\'s site or one building\'s floor plan to SVG and/or PNG.',
  description: 'Render a settlement to art/settlements/<id>/out/ (SVG + PNG) and return the PNG to look at. view: site (default) or plan (one building\'s floor: building id, floor level, default the ground floor). buildings (site): roofs (blocked out, default), outline, or interior (each building cut away to its ground floor). theme: color (default), bw or both. plans: true renders the site and every floor of every building (images not returned). layers turns layers off/on (site: ground, underlay, areas, water, roads, bridges, walls, buildings, trees, props, grid, symbols, numbers, labels, legend, title, scale, compass; plan: floor, grid, walls, doors, windows, fixtures, numbers, labels, …). ppu: pixels per cell (default 24 on the site, 40 on a plan; the returned image is smaller unless set).',
  params: {
    id: id('render: <id>'), path: pathParam('settlement'), view: p.oneOf(settlement.VIEWS, 'site (default) or plan (one building\'s floor)', { error: 'site or plan' }),
    building: p.str('plan: the building id'), floor: p.num('plan: the floor level (default the ground floor)'), buildings: p.oneOf(settlement.BUILDING_MODES, 'site: roofs (default), outline, or interior (cut away to the ground floor)'),
    theme: p.oneOf(['color', 'bw', 'both'], 'color (default), bw or both', { error: 'color, bw or both' }), plans: p.bool('the site and every floor of every building'), ppu: p.num('pixels per cell (default 24 on the site, 40 on a plan)'),
    layers: p.str('layers to turn off/on, e.g. grid=off,labels=off', { schema: { type: 'object', description: 'layers to turn off/on, e.g. { grid: false }' } }),
    format: p.oneOf(['svg', 'png', 'both'], 'svg, png or both (default both)', { mcp: false, error: 'svg, png or both' }), fit: p.str('180x260mm or 800x600px: pick the scale that fits the window in the box', { mcp: false }),
    page_scale: p.str('output pixels per millimetre on the page', { mcp: false }), crop: p.str('x,y,w,h in cells: a window on the render', { mcp: false }), out: p.str('the folder to render into', { mcp: false }),
  },
  async run(i: Inp, ctx) {
    const P = projectOf(i, ctx), format = i.format ?? 'both';
    return renderSettlementFiles(P, refOf(i), {
      ...renderOptions(i, ctx), formats: format === 'both' ? ['svg', 'png'] : [format as 'svg' | 'png'], plans: i.plans === true, ppu: typeof i.ppu === 'number' ? i.ppu : undefined, pageScale: pageScaleOf(i.page_scale), ...viewOf(i, () => 1), out: i.out,
    });
  },
  cli: {
    usage: [
      '       artgen settlement render <id> [--view site|plan] [--building bid [--floor n]] [--plans] [--buildings roofs|outline|interior] [--theme color|bw|both] [--format svg|png|both] [--ppu n | --fit 180x260mm] [--crop x,y,w,h] [--layers grid=off] [--out dir]',
      '                  the site (roofs, outlines, or cut away to the ground floor), one building\'s floor plan, or with --plans the site and every floor of every building',
    ],
    text: (rs, i) => rs.map((r: Inp) => [`${i.path ?? i.id} ${r.view === 'plan' ? `${r.building} level ${r.floor ?? 0}` : 'site'}: ${r.size.join('×')} px, ${Math.round(r.ppu * 100) / 100} px a cell`, ...r.files.map((f: string) => `  ${f}`)].join('\n')).join('\n'),
    json: rs => V(rs.length === 1 ? rs[0] : { renders: rs }),
  },
  mcp: { content: renderPreview }, python: {},
});

export const SETTLEMENT_OPS_LIST: OpDef[] = [
  list, symbols, fixtures, show, create, update, style, grid, gen, edit, building, interior, floor, room, connect, disconnect, door, windowOp, fixture, prop, road, water, wall, area, tree, label, symbol, overlay, check, facts, render,
];
