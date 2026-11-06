/**
 * The files the map engines read, declared once each as JSON Schema (draft 2020-12) with a line per key (R9 D5): what
 * `artgen schema <kind>` prints, what `--keys` lists, and what docs/DUNGEON.md is written from. A test holds each declaration to
 * its validator: every key the validator reads is declared here (`schema.test.ts`), so a key cannot be added to a file unseen.
 *
 * Positions and sizes are in cells (a map's are map units) unless a key says otherwise. Every entry of a list may carry
 * `origin` (who wrote it; none is a hand entry, see `sync`).
 */
import { DOOR_KINDS, HATCH_STYLES, LABEL_KINDS, ROOM_FILLS, ROOM_SHAPES, ROUTES, SIDES, CORRIDOR_STYLES, CURVES, GEN_LAYOUTS, BLOCK_SHAPES, SPLIT_MODES, ROCK_STYLES, AREA_KINDS, ROOM_EXIT_KINDS, DUNGEON_FORMAT, MAX_SIDE as DUNGEON_MAX, NUMBER_STYLES, DOOR_GLYPHS, PRESET_NAMES, PALETTE_KEYS, WALL_LINES, MIN_WIDTH } from './dungeon/spec.ts';
import { GRAPH_SHAPES, ROOM_DRAW_KEYS, WAY_DRAW_KEYS } from './dungeon/graph.ts';
import { CHECK_IDS } from './dungeon/lint.ts';
import * as M from './map/spec.ts';
import * as St from './settlement/spec.ts';

type Schema = Record<string, unknown>;
const num = (description: string, o: Schema = {}): Schema => ({ type: 'number', description, ...o });
const int = (description: string, o: Schema = {}): Schema => ({ type: 'integer', description, ...o });
const str = (description: string, o: Schema = {}): Schema => ({ type: 'string', description, ...o });
const bool = (description: string): Schema => ({ type: 'boolean', description });
const oneOf = (description: string, values: readonly (string | number | boolean | null)[]): Schema => ({ enum: [...values], description });
const arr = (description: string, items: Schema, o: Schema = {}): Schema => ({ type: 'array', description, items, ...o });
const obj = (description: string, properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'object', description, properties, ...(required.length && { required }), additionalProperties: false });
const anyOf = (description: string, ...options: Schema[]): Schema => ({ description, anyOf: options });
const point = (description: string): Schema => arr(description, { type: 'number' }, { minItems: 2, maxItems: 2 });
const points = (description: string): Schema => arr(`${description} (x,y pairs)`, { type: 'number' }, { minItems: 6 });
const line = (description: string): Schema => arr(`${description} (x,y pairs)`, { type: 'number' }, { minItems: 4 });
const origin = str('who wrote the entry; a sync replaces its own origin\'s entries and keeps the rest (none: a hand entry)');
const href = str('a link from it in the SVG: http(s)://…, a relative path or #anchor');
const furniture = obj('where the title, scale bar, compass and legend go: over the map, in a band outside it, or in the band only when they would cover something', {
  place: oneOf('over (default), outside or auto', ['over', 'outside', 'auto']), side: oneOf('the band\'s side', ['bottom', 'right']),
}, ['place']);

// ---- dungeon ---------------------------------------------------------------------------------------------------------

const side = oneOf('a wall: n (top), e, s or w', SIDES);
const doorPair = arr('the door at each end, from then to: a kind, or null for an open passage', anyOf('', oneOf('', DOOR_KINDS), { type: 'null' }), { minItems: 2, maxItems: 2 });
const corridorEnd = anyOf('a corridor end: a room, a point, or another corridor',
  obj('a room: from its anchor; through its `side` wall, `offset` cells along it from its top or left edge; or from `port`, a point on its wall', {
    room: str('the room\'s id'), side, offset: num('cells along the side wall from the room\'s top or left edge (goes with side)', { minimum: 0 }),
    port: point('a point on the room\'s wall the corridor leaves from, its door set along the wall (moved onto the outline when off it)'),
  }, ['room']),
  obj('a point: a dead end, or the way off the map', {
    at: point('the point (cells)'),
    exit: obj('where it leads: the corridor fades out over `fade` cells and a boxed note says so', { text: str('the note'), href, fade: num('cells it fades over (default 3)', { minimum: 0, maximum: 20 }) }, ['text']),
  }, ['at']),
  obj('a junction on another corridor\'s centre line, nearest the other end (or `near`)', { corridor: str('the joined corridor\'s id'), near: point('the point on it to meet nearest') }, ['corridor']),
);

export const DUNGEON_SCHEMA: Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'artgen dungeon file', ...obj(`a dungeon map, format ${DUNGEON_FORMAT}: rooms, the corridors that join them, doors in shared walls, an overlay of labels and symbols. Cells: x right, y down.`, {
    id: str('letters, digits, - and _'), version: int(`the format version (${DUNGEON_FORMAT}; older files are migrated on read)`, { minimum: 1 }),
    cols: int(`columns, 4..${DUNGEON_MAX}`, { minimum: 4, maximum: DUNGEON_MAX }), rows: int(`rows, 4..${DUNGEON_MAX}`, { minimum: 4, maximum: DUNGEON_MAX }), seed: num('the generator seed'), title: str('the title'),
    gen: obj('generator settings (`dungeon gen`)', {
      rooms: num('rooms to generate, 1..80'), minSize: num('the smallest room side, cells'), maxSize: num('the largest room side, cells'), caves: num('the share of cave rooms, 0..1'),
      round: num('the share of round and octagonal rooms, 0..1'), loops: num('extra corridors beyond a tree, 0..1'), doors: num('the share of corridor ends with a door, 0..1'),
      corridorWidth: num('corridor width, cells'), spacing: num('empty cells between rooms'), entrance: bool('a corridor from the first room off the nearest edge'),
      layout: oneOf('scatter (default), dense (rooms side by side) or blocks', GEN_LAYOUTS), density: num('dense: the share of the sheet filled'),
    }),
    grid: obj('the grid: a line every `size` cells, a fainter one at every cell with `sub`, on the floor or everywhere', { show: bool('draw it'), size: num('cells between lines (2 = 10 ft at 5 ft a cell)'), sub: bool('a line at every cell too'), clip: oneOf('floor (default) or all', ['floor', 'all']) }),
    style: obj('how it is drawn', {
      hatch: oneOf('rock hatching: a band along the walls, everywhere, or none', HATCH_STYLES), band: num('cells of the hatched band, 0..6'), wall: num('wall weight, 0.2..4'),
      sharedWalls: anyOf('walls where two floors meet: true (default) between any two units, "rooms" between rooms only (format 1\'s true), false none', { type: 'boolean' }, { const: 'rooms' }),
      rock: oneOf('the rock: hatch (as hatch says; default), solid (rockColor) or none', ROCK_STYLES), rockColor: str('solid rock\'s colour, #rrggbb (default #bdbdbd)'),
      partition: num('the weight of the walls between floors, like wall (default: wall), 0.2..4'),
      palette: obj(`colours, each #rrggbb: ${PALETTE_KEYS.join(', ')}`, {
        rock: str('the solid rock (in place of rockColor)'), floor: str('the floor, and what fills doors and symbols (default #ffffff)'), ink: str('the ink: doors, symbols, labels, and the walls unless wall is set (default #000000)'),
        grid: str('the grid lines (default: the ink, faint)'), wall: str('the walls and partitions (default: the ink)'),
      }),
      numbers: oneOf('room numbers: a black badge (default) or plain bold numerals on the floor', NUMBER_STYLES),
      doors: oneOf('the door mark: a thin bar across the opening (default) or a square with a jamb each side', DOOR_GLYPHS),
      preset: oneOf('a named look that fills the style and grid settings the file leaves unset (`dungeon style --preset` writes its values)', PRESET_NAMES),
    }),
    scale: obj('the scale', { perCell: num('map units in one cell (5)'), unit: str('the unit (ft)') }),
    numbers: bool('room number badges'), scaleBar: bool('the scale bar'), compass: bool('the compass'), legend: bool('a key of the symbols used'), furniture,
    rooms: arr('the rooms', obj('a room', {
      id: str('letters, digits, - and _'), shape: oneOf('the shape', ROOM_SHAPES), x: num('the box\'s left (cells)'), y: num('the box\'s top'), w: num('the box\'s width, at least 1 (a poly\'s is its points\' own, any size above 0)'), h: num('the box\'s height, at least 1 (a poly\'s: as for width)'),
      points: points('a poly\'s outline, cells; x, y, w, h are then its box'), seed: num('a cave\'s outline seed (default: from its id)'), label: str('its name'),
      number: anyOf('its number: a number, a key such as 15a (shown as written, not counted in the numbering), or false to hide it (default: file order)', { type: 'number' }, { type: 'string' }, { const: false }), fill: oneOf('what it is: floor (default), building, yard or cellar', ROOM_FILLS),
      href, origin, hand: arr('fields a hand edit changed on an entry of some origin; a sync reports them', { type: 'string' }),
      anchor: point('where its {room} corridors start and its badge sits (default: the centre, or a poly\'s deepest point)'),
      labelAt: anyOf('where its number and name stand: by a wall, at the anchor (c), or [dx, dy] from it; unset, they move off what they would lie on', oneOf('', ['c', 'n', 's', 'w', 'e']), point('')),
      cut: num('an octagon\'s corner cut, a share of its shorter side, exactly (default: 0.3 of it to the half cell)', { exclusiveMinimum: 0, exclusiveMaximum: 0.5 }),
      orient: oneOf('a hexagon: flat (points east and west; default) or pointy', ['flat', 'pointy']),
      edge: oneOf('wavy: a wavy line along its walls (a curtain, drapery, a rubble margin)', ['wavy']),
      edgeSides: arr('the walls edge runs along, by the side each faces (default: all)', side),
      partition: num('the weight of the walls it shares with other rooms, like style.partition (a connection\'s weight wins; the thinner of two rooms), 0.2..4'),
      exits: arr('ways out of the map inside the room', obj('a stair or an arrow by a wall or at a point, and its note', { kind: oneOf('the mark', ROOM_EXIT_KINDS), side, at: point('the mark\'s point'), angle: num('degrees, 0 east, clockwise (default: toward its wall)'), text: str('the note under it') }, ['kind'])),
    }, ['id', 'shape', 'x', 'y', 'w', 'h'])),
    corridors: arr('the corridors', obj('a corridor', {
      id: str('a name other corridors can join'), from: corridorEnd, to: corridorEnd, width: num(`width in cells, ${MIN_WIDTH}..6 (default 1; a maze corridor needs 0.5)`), span: num('width in the scale unit, in place of width (10 for a 10 ft passage)'),
      route: oneOf('auto (straight when the rooms line up, else an elbow), hv, vh, straight, around (round the rooms on the grid) or maze (on the lattice of its width, off other corridors)', ROUTES),
      maze: obj('route maze: cells kept off rooms\' walls (0 or 1; default 0 where walls are drawn along corridors), a bend\'s cost, the noise\'s seed', { clearance: oneOf('', [0, 1]), bend: num('', { minimum: 0 }), seed: num('') }),
      via: line('its bends, in order'), curve: oneOf('a smooth curve through the bends', CURVES), style: oneOf('built (default) or natural (rough walls)', CORRIDOR_STYLES), seed: num('a natural passage\'s seed'),
      doors: doorPair,
      midDoors: arr('doors standing in the run itself', obj('a door in the run', { at: anyOf('the distance from the corridor\'s start along its centre line (cells), or a point (the nearest point on the line)', { type: 'number' }, point('')), kind: oneOf('the door kind', DOOR_KINDS) }, ['at', 'kind'])),
      origin,
    }, ['from', 'to'])),
    connections: arr('doors and openings in the walls rooms share', obj('a connection', {
      a: str('a room'), b: str('the room it touches'), at: point('a point on their shared wall (default: the middle of its longest stretch)'), kind: oneOf('a door kind or open', [...DOOR_KINDS, 'open']), width: num('the opening, cells (default 1)'),
      weight: num('the stroke of the wall these rooms share, like style.partition, 0.2..4 (a thin gap or a heavy wall)'), line: oneOf('how that wall is drawn: solid (default), dashed (an illusory wall) or none (the floors run together)', WALL_LINES), origin,
    }, ['a', 'b'])),
    rings: arr('lines over the rock with no floor: a ring of dashes, an illusory wall', obj('a ring', {
      id: str('its id'), shape: oneOf('a circle (at, r) or a poly (points, closed)', ['circle', 'poly']), at: point('a circle\'s centre'), r: num('a circle\'s radius, cells'), points: points('a poly\'s outline'),
      line: oneOf('dashed (default) or solid', ['dashed', 'solid']), width: num('the line\'s width, cells, 0.02..2 (default 0.12)'), dash: arr('[dash, gap] in cells (default [0.5, 0.3])', { type: 'number' }, { minItems: 2, maxItems: 2 }), origin,
    }, ['shape'])),
    blocks: arr('shapes split into rooms that share walls', obj('a block', {
      id: str('its id'), shape: oneOf('the shape', BLOCK_SHAPES), x: num('left'), y: num('top'), w: num('width'), h: num('height'), points: points('a poly\'s outline'),
      split: obj('how it splits', { mode: oneOf('bsp, rows, cols, grid or cuts', SPLIT_MODES), min: num('about the size of each room, cells'), cuts: obj('where to cut', { x: arr('x lines', { type: 'number' }), y: arr('y lines', { type: 'number' }) }), seed: num('the seed') }, ['mode']),
      doors: num('the share of extra connections, 0..1'), origin,
    }, ['id', 'shape', 'x', 'y', 'w', 'h', 'split'])),
    overlay: obj('labels and symbols', {
      labels: arr('labels', obj('a label', { text: str('the text'), x: num('x'), y: num('y'), kind: oneOf('name (bold), note (italic) or area (spaced capitals)', LABEL_KINDS), size: num('a factor on its size'), angle: num('degrees'), href, origin }, ['text', 'x', 'y', 'kind'])),
      symbols: arr('symbols', obj('a symbol', { kind: str('a symbol kind (`artgen dungeon symbols`)'), x: num('x'), y: num('y'), scale: num('a factor on its size'), scaleX: num('a factor on its width, on top of scale (a stair run 0.8 wide: scaleX 0.8, scaleY 4)'), scaleY: num('a factor on its length, on top of scale'), sweep: num('curved-arrow: how far it turns, degrees (default 120; negative: anticlockwise)'), angle: num('degrees, 0 east, clockwise on the page'), origin }, ['kind', 'x', 'y'])),
    }, ['labels', 'symbols']),
    underlay: obj('a terrain map under the rooms', { map: str('the map file\'s path, from this file\'s folder'), origin: point('the map unit at the dungeon\'s top-left'), scale: num('map units in one cell'), theme: oneOf('color or bw', ['color', 'bw']) }, ['map', 'origin', 'scale']),
    walls: arr('enclosing walls with towers and gates', obj('a wall', {
      id: str('its id'), rooms: arr('the rooms it goes round (their hull plus inset)', { type: 'string' }), poly: points('its own line'), thickness: num('cells, at most 4'), inset: num('cells round the rooms (default 1)'),
      towers: obj('towers', { shape: oneOf('round or square', ['round', 'square']), size: num('cells across (default 3)'), at: anyOf('at the corners or at these vertices', { const: 'corners' }, arr('', { type: 'integer' })) }, ['shape']),
      gates: arr('gates', obj('a gate', { at: point('near the wall'), kind: oneOf('gate or postern', ['gate', 'postern']), room: str('the room it opens into'), width: num('cells') }, ['at', 'kind'])), origin,
    })),
    bounds: points('the ground the level occupies: the rock and grid are drawn inside it and its edge is drawn'),
    areas: arr('rock and voids within the level, which no floor may take', obj('an area', { points: points('its outline'), kind: oneOf('rock or void', AREA_KINDS), label: str('a note at its middle'), origin }, ['points', 'kind'])),
  }, ['id', 'cols', 'rows', 'seed', 'rooms', 'corridors']),
};

/** The ids of `dungeon check`'s findings, with what each means. */
export const DUNGEON_CHECKS: Record<string, string> = { ...CHECK_IDS };

// ---- graph (dungeon layout) ------------------------------------------------------------------------------------------

export const GRAPH_SCHEMA: Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'artgen dungeon layout graph', ...obj('rooms and the ways between them, laid out by `artgen dungeon layout` in a footprint (cells)', {
    id: str('the dungeon\'s id'), title: str('its title'),
    rooms: arr('the rooms', obj('a room', {
      id: str('its id (letters, digits, ., - and _)'), w: num('width, cells'), h: num('height, cells'), shape: oneOf('the shape (round is drawn as a circle)', GRAPH_SHAPES),
      points: arr('a poly\'s outline, cells from its box\'s centre (x,y pairs)', { type: 'number' }), label: str('its name (default: its id)'), turns: bool('may lie in any quarter turn or mirror of itself'),
      hall: bool('shows its name alone: its label is shorter'), against: obj('set against another room: its centre dx, dy cells from that room\'s', { room: str(''), dx: num(''), dy: num('') }, ['room', 'dx', 'dy']),
      over: obj('must stand over this box (cells, the graph\'s frame: see origin)', { x: num(''), y: num(''), w: num(''), h: num('') }, ['x', 'y', 'w', 'h']),
      at: obj('stands exactly here: its box\'s top-left (cells, the graph\'s frame, on the lattice); not moved by the packing', { x: num(''), y: num('') }, ['x', 'y']),
      pad: num('cells kept clear round it in the packing, in place of the graph\'s pad'),
      draw: obj('room fields written into the file as given (see the dungeon file\'s rooms)', Object.fromEntries(ROOM_DRAW_KEYS.map(k => [k, { description: `the room's ${k}` }]))),
      symbols: arr('symbols in the room', obj('a symbol, from the room\'s centre', { kind: str('a symbol kind'), dx: num('cells east of the centre'), dy: num('cells south of the centre'), scale: num(''), scaleX: num(''), scaleY: num(''), angle: num('degrees'), sweep: num('curved-arrow: degrees') }, ['kind'])),
      ring: obj('a ring round the room, centred on it', { pad: num('cells out from its box\'s longer half-side (default 1)'), line: oneOf('dashed (default) or solid', ['solid', 'dashed']), width: num('cells'), dash: arr('[on, off] cells', { type: 'number' }, { minItems: 2, maxItems: 2 }) }),
    }, ['id', 'w', 'h'])),
    ways: arr('the ways', obj('a way', {
      a: str('a room'), b: str('another room'), bearing: num('degrees clockwise from north: b lies this way from a'), wall: num('degrees clockwise from north: the wall a\'s door stands on'),
      doors: doorPair, style: oneOf('built (default) or natural', CORRIDOR_STYLES), label: str('a note'),
      hold: bool('keep the bearing as a rule: weighed ten times as hard, and a packing that strays past 45° ranks below one that keeps it'),
      via: arr('the passage\'s bends (x,y cells, the graph\'s frame), drawn as given: both rooms stand at a place', { type: 'number' }),
      draw: obj('corridor or connection fields written into the file as given', Object.fromEntries(WAY_DRAW_KEYS.map(k => [k, { description: `the passage's or the opening's ${k}` }]))),
    }, ['a', 'b'])),
    width: num('the passage width in cells, the lattice (default 2)'), scale: obj('the scale', { perCell: num(''), unit: str('') }),
    footprint: anyOf('a square\'s side in cells, or a polygon (x,y cells); unset, the least square `fill` allows', { type: 'number' }, arr('', { type: 'number' })),
    keepOut: arr('polygons no room or passage may take', arr('', { type: 'number' })), fill: arr('[least, most] share of the ground the rooms cover (default [0.35, 0.55])', { type: 'number' }, { minItems: 2, maxItems: 2 }),
    passages: num('the share of ways run as passages (default 0.35)'), detour: num('cells a way may walk past the straight line between its rooms'),
    seed: num('the seed (default 1)'), tries: int('packings tried at each side (default 12)'), margin: num('cells round the footprint in the file (default 2)'), clearance: oneOf('0 (default) or 1: cells a passage keeps off walls', [0, 1]),
    pad: num('cells kept clear round every room in the packing, to the lattice: joined rooms stand twice that apart'),
    origin: arr('[x, y]: where the footprint\'s top-left lies in the frame over, at, via and keepOut are given in (default [0, 0]; with no footprint, round the pinned rooms)', { type: 'number' }, { minItems: 2, maxItems: 2 }),
    lines: arr('rooms whose centres stand on one line', obj('a line', { rooms: arr('the rooms', { type: 'string' }), along: oneOf('ew: one y; ns: one x', ['ew', 'ns']) }, ['rooms', 'along'])),
    partial: bool('with no packing that routes every way, write the one that routes most and list the rest in the report'),
    style: { type: 'object', description: 'style settings for the file, over the layout\'s own (see the dungeon file\'s style)' },
    legend: bool('draw a legend of the symbols'),
  }, ['rooms', 'ways']),
};

// ---- terrain map -----------------------------------------------------------------------------------------------------

const shape = anyOf('where it applies', obj('a disc', { circle: arr('[x, y, r]', { type: 'number' }, { minItems: 3, maxItems: 3 }) }, ['circle']), obj('a polygon', { poly: points('') }, ['poly']), obj('a brush stroke', { stroke: line(''), width: num('') }, ['stroke', 'width']));
export const MAP_SCHEMA: Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'artgen terrain map file', ...obj(`a terrain map, format ${M.MAP_FORMAT}: generator settings, edits and an overlay. Map units: one grid cell.`, {
    id: str('its id'), version: int('the format version', { minimum: 1 }), preset: oneOf('regional (a hex crawl) or local (a battle map)', M.PRESETS), cols: int(`columns, 4..${M.MAX_SIDE}`), rows: int(`rows, 4..${M.MAX_SIDE}`), seed: num('the seed'), title: str('the title'),
    gen: obj('generator settings', {
      land: oneOf('mixed, island or inland', M.LAND_MODES), sea: num('the share under water, 0..0.9'), moisture: num('dry (0) to wet (1)'), roughness: num('smooth (0) to rugged (1)'), relief: num('flat (0) to peaked (1)'),
      rivers: num('generated rivers'), simplify: num('merges small patches (0 keeps all)'), feature: num('a hill\'s or valley\'s size, map units'),
    }),
    topo: obj('contours', { maxElevation: num('the highest ground, topo units'), interval: num('between contours'), majorEvery: num('every nth contour is major'), unit: str('the height unit'), labels: bool('label the major contours') }),
    grid: obj('the grid', { type: oneOf('hex, square or none', M.GRID_TYPES), size: num('map units a cell'), coords: bool('cell names') }),
    scale: obj('the scale', { perCell: num('scale units a map unit'), unit: str('mi, ft, …') }), legend: bool('a key'), scaleBar: bool('a scale bar'), compass: bool('a compass'),
    edits: arr('edits, in order', anyOf('an edit',
      obj('paint terrain', { op: { const: 'paint' }, terrain: oneOf('', M.TERRAINS), shape, origin }, ['op', 'terrain', 'shape']),
      obj('raise or lower the ground', { op: { const: 'elevate' }, amount: num('-1..1 of the height range'), shape, origin }, ['op', 'amount', 'shape']),
      obj('a river', { op: { const: 'river' }, points: line(''), width: num('at its last point, map units'), delta: bool('a delta where it ends in water (default true)'), origin }, ['op', 'points']),
      obj('a road', { op: { const: 'road' }, points: line(''), origin }, ['op', 'points']))),
    require: arr('what the ground must be (`map check` measures each)', anyOf('a requirement',
      obj('a share of terrain', { id: str(''), kind: { const: 'terrain' }, area: shape, terrain: oneOf('', M.TERRAINS), share: num('0..1'), blend: num(''), origin }, ['id', 'kind', 'area', 'terrain', 'share']),
      obj('heights', { id: str(''), kind: { const: 'height' }, area: shape, low: num(''), high: num(''), share: num(''), blend: num(''), origin }, ['id', 'kind', 'area', 'low', 'high']),
      obj('a stream or a road', { id: str(''), kind: { const: 'path' }, path: oneOf('', ['stream', 'road']), points: line(''), tolerance: num(''), width: num(''), delta: bool(''), blend: num(''), origin }, ['id', 'kind', 'path', 'points']),
      obj('no generated river', { id: str(''), kind: { const: 'clear' }, area: shape, blend: num(''), origin }, ['id', 'kind', 'area']))),
    overlay: obj('labels and symbols', {
      labels: arr('labels', obj('a label', { text: str(''), x: num(''), y: num(''), kind: oneOf('', M.LABEL_KINDS), size: num(''), angle: num(''), origin }, ['text', 'x', 'y', 'kind'])),
      symbols: arr('symbols', obj('a symbol', { kind: str('`artgen map symbols`'), x: num(''), y: num(''), scale: num(''), angle: num(''), origin }, ['kind', 'x', 'y'])),
    }, ['labels', 'symbols']),
  }, ['id', 'cols', 'rows', 'seed']),
};

// ---- settlement ------------------------------------------------------------------------------------------------------

const fixture = obj('furniture or a site prop', { kind: str('`artgen settlement fixtures`'), x: num('centre x'), y: num('centre y'), w: num('width (default: the kind\'s)'), h: num('height'), angle: num('degrees'), label: str(''), origin }, ['kind', 'x', 'y']);
const floor = obj('one storey', {
  level: int('0 ground, 1 up, -1 cellar'), name: str(''), rooms: (DUNGEON_SCHEMA.properties as Record<string, Schema>).rooms, connections: (DUNGEON_SCHEMA.properties as Record<string, Schema>).connections,
  doors: arr('doors in the outer wall', obj('a door', { at: point(''), kind: oneOf('', [...DOOR_KINDS, 'open']), width: num('') }, ['at'])),
  windows: arr('windows', obj('a window', { at: point(''), width: num('') }, ['at'])), fixtures: arr('furniture', fixture), origin,
}, ['level', 'rooms']);
export const SETTLEMENT_SCHEMA: Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'artgen settlement file', ...obj(`a settlement, format ${St.SETTLEMENT_FORMAT}: roads, water, walls, buildings with their floors, areas, trees and props. Cells: x right, y down.`, {
    id: str('its id'), version: int('the format version', { minimum: 1 }), kind: oneOf('', St.SETTLEMENT_KINDS), cols: int(`columns, 4..${St.MAX_SIDE}`), rows: int(`rows, 4..${St.MAX_SIDE}`), seed: num(''), title: str(''), ground: oneOf('', St.GROUNDS),
    gen: obj('generator settings', { buildings: num(''), density: num('0..1'), streets: oneOf('', St.STREET_PLANS), wall: oneOf('', St.GEN_WALLS), water: oneOf('', St.GEN_WATERS), trees: num('0..1'), fields: num('0..1'), market: bool(''), castle: bool(''), interiors: bool('') }),
    grid: obj('the grid', { show: bool(''), size: num('cells between lines'), sub: bool('') }), scale: obj('the scale', { perCell: num(''), unit: str('') }), interior: obj('the plans\' cell', { perCell: num('') }),
    numbers: bool(''), scaleBar: bool(''), compass: bool(''), legend: bool(''), furniture,
    roads: arr('roads', obj('a road', { id: str(''), kind: oneOf('', St.ROAD_KINDS), points: line(''), width: num('cells'), curve: oneOf('', St.CURVES), label: str(''), origin }, ['kind', 'points'])),
    water: arr('water', obj('a water line or area', { id: str(''), kind: oneOf('', St.WATER_KINDS), points: line(''), width: num(''), origin }, ['kind', 'points'])),
    walls: arr('walls', obj('a wall', {
      id: str(''), kind: oneOf('', St.WALL_KINDS), points: line(''), closed: bool(''), thickness: num(''),
      towers: obj('towers', { shape: oneOf('', St.TOWER_SHAPES), size: num(''), at: anyOf('', { const: 'corners' }, arr('', { type: 'integer' })), every: num('') }, ['shape']),
      gates: arr('gates', obj('a gate', { at: point(''), kind: oneOf('', St.GATE_KINDS), width: num(''), drawbridge: bool(''), label: str('') }, ['at', 'kind'])), origin,
    }, ['kind', 'points'])),
    buildings: arr('buildings', obj('a building', {
      id: str(''), kind: oneOf('', St.BUILDING_KINDS), shape: oneOf('', St.BUILDING_SHAPES), x: num(''), y: num(''), w: num(''), h: num(''), points: points(''), wing: point('an L\'s or T\'s wing, cells'),
      angle: num('degrees about the box\'s centre'), roof: oneOf('', St.ROOFS), stories: num(''), label: str(''), number: anyOf('', { type: 'number' }, { const: false }), href, floors: arr('its floors', floor), origin,
    }, ['id', 'kind', 'shape', 'x', 'y', 'w', 'h'])),
    areas: arr('areas', obj('an area', { id: str(''), kind: oneOf('', St.AREA_KINDS), points: points(''), label: str(''), origin }, ['kind', 'points'])),
    trees: arr('trees and rocks', obj('a tree', { kind: oneOf('', St.TREE_KINDS), x: num(''), y: num(''), size: num(''), origin }, ['kind', 'x', 'y'])),
    props: arr('site props', fixture),
    underlay: obj('a terrain map under it', { map: str(''), origin: point(''), scale: num(''), theme: oneOf('', ['color', 'bw']) }, ['map', 'origin', 'scale']),
    overlay: obj('labels and symbols', {
      labels: arr('labels', obj('a label', { text: str(''), x: num(''), y: num(''), kind: oneOf('', St.LABEL_KINDS), size: num(''), angle: num(''), href, origin }, ['text', 'x', 'y', 'kind'])),
      symbols: arr('symbols', obj('a symbol', { kind: str(''), x: num(''), y: num(''), scale: num(''), angle: num(''), origin }, ['kind', 'x', 'y'])),
    }, ['labels', 'symbols']),
  }, ['id', 'cols', 'rows', 'seed']),
};

export const SCHEMAS = { dungeon: DUNGEON_SCHEMA, map: MAP_SCHEMA, settlement: SETTLEMENT_SCHEMA, graph: GRAPH_SCHEMA } as const;
export type SchemaKind = keyof typeof SCHEMAS;

/** Every key path a schema declares (`rooms[].exits[].kind`), with its line, in the order declared. */
export function schemaKeys(s: Schema, at = ''): [string, string][] {
  const out: [string, string][] = [];
  const walk = (node: Schema, path: string) => {
    if (path && typeof node.description === 'string' && node.description) out.push([path, node.description]);
    const props = node.properties as Record<string, Schema> | undefined;
    if (props) for (const [k, v] of Object.entries(props)) walk(v, path ? `${path}.${k}` : k);
    if (node.items && typeof node.items === 'object') walk({ ...(node.items as Schema), description: '' }, `${path}[]`);
    for (const alt of [...((node.anyOf as Schema[]) ?? []), ...((node.oneOf as Schema[]) ?? [])]) walk({ ...alt, description: '' }, path);
  };
  walk(s, at);
  const seen = new Set<string>();
  return out.filter(([p]) => (seen.has(p) ? false : (seen.add(p), true)));
}

/** Whether a key path (`rooms[].shape`, array indexes as `[]`) is declared by a schema. */
export function declares(s: Schema, path: string): boolean {
  const parts = path.split('.').flatMap(p => p.split(/(?=\[\])/));
  const step = (nodes: Schema[], part: string): Schema[] => nodes.flatMap(n => {
    const alts = [n, ...((n.anyOf as Schema[]) ?? []), ...((n.oneOf as Schema[]) ?? [])];
    return alts.flatMap(a => (part === '[]' ? (a.items ? [a.items as Schema] : []) : a.properties && (a.properties as Record<string, Schema>)[part] ? [(a.properties as Record<string, Schema>)[part]] : []));
  });
  let nodes = [s];
  for (const p of parts) { nodes = step(nodes, p); if (!nodes.length) return false; }
  return true;
}
