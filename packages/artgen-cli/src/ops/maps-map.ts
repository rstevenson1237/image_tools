/** The terrain map operations (`artgen map …`, the MCP `map_*` tools). Implementations moved here from `maps-cli.ts` and the MCP server. */
import { join } from 'node:path';
import { map, type SyncReport } from 'artgen-core/maps';
import { checkMapFile, createMap, describeMap, describeMapFacts, listMaps, mapSummary, numbers, parseLayers, readMap, renderMapFiles, shapeFrom, updateMap } from '../map.ts';
import { fileId, readJson } from '../projectfs.ts';
import { idParam, layersOf, needPoints, numFlag, originOf, overlayEdit, overlayLines, overlayParams, pageScaleOf, pathParam, projectOf, pngFile, refOf, syncText, text, viewOf, withVersion, type Inp } from './maps-shared.ts';
import { defineOp, p, type Content, type Ctx, type OpDef } from './registry.ts';

const V = (data: unknown) => withVersion(data, map.MAP_FORMAT);
const next = (i: Inp, id?: string) => (i.path ? `next: artgen map render --file ${i.path}` : `next: artgen map render ${id ?? i.id}`);
const LAYER_DOC = 'layers to turn off/on, e.g. grid=off,labels=off';

const list = defineOp({
  name: 'map.list', module: 'maps', effect: 'read', summary: 'List the terrain maps in the project (or the one named by --file).',
  description: 'Terrain maps (TTRPG) in art/maps, plus the terrains, symbol kinds and label kinds the map tools accept.',
  params: { path: pathParam('map') },
  run: (i: Inp, ctx) => (i.path ? [mapSummary(readMap(null, { file: i.path }))] : listMaps(ctx.project())),
  cli: {
    usage: '       artgen map list | show <id> | symbols',
    text: ms => (ms.length ? ms.map((m: ReturnType<typeof mapSummary>) => `${m.id.padEnd(16)} ${m.preset.padEnd(9)} ${m.size.padEnd(7)} ${m.edits} edits, ${m.labels} labels, ${m.symbols} symbols${m.title ? `  "${m.title}"` : ''}`).join('\n') : 'no maps yet: artgen map new <id>'),
    json: ms => V(ms),
  },
  mcp: { content: ms => [text({ maps: ms, terrains: map.TERRAINS, symbols: map.SYMBOL_KINDS, labelKinds: map.LABEL_KINDS, presets: map.PRESETS })] },
  python: {},
});

const symbols = defineOp({
  name: 'map.symbols', module: 'maps', effect: 'read', summary: 'List the symbol kinds a map can carry.',
  params: {}, run: () => map.SYMBOL_KINDS,
  cli: { usage: [], text: () => Object.entries(map.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join('\n'), json: kinds => V(kinds) },
  mcp: { exclude: 'map_list returns the symbol kinds' }, python: {},
});

const show = defineOp({
  name: 'map.show', module: 'maps', effect: 'read', summary: 'Show a terrain map: its settings, edits, labels and symbols with their indices.',
  description: 'A terrain map\'s file (art/maps/<id>/map.json) and a readable summary: generator settings, edits, labels and symbols with their indices.',
  params: { id: idParam('the map id', 'map show: <id>'), path: pathParam('map') },
  run: (i: Inp, ctx) => readMap(projectOf(i, ctx), refOf(i)),
  cli: { usage: [], text: m => describeMap(m), json: m => V(m) },
  mcp: { name: 'map_get', content: m => [text(describeMap(m)), text(m)] }, python: {},
});

const create = defineOp({
  name: 'map.new', module: 'maps', effect: 'write', summary: 'Create a terrain map from a preset.',
  description: 'Create a terrain map from a preset: regional (hex crawl, 6 mi hexes) or local (battle map, 5 ft squares). The terrain is generated from the seed; render it with map_render, then adjust.',
  params: {
    id: idParam('the new map\'s id (a name, never a path)', 'map new: <id> is required'), path: pathParam('map'),
    preset: p.oneOf(map.PRESETS, 'regional (hex crawl, 6 mi hexes) or local (battle map, 5 ft squares); default regional', { error: map.PRESETS.join(' or ') }),
    size: p.str('COLSxROWS, e.g. 30x22', { mcp: false }), cols: p.num('columns', { cli: false }), rows: p.num('rows', { cli: false }),
    seed: p.num('the generator seed (default: random)'), title: p.str('the title'),
    grid: p.oneOf(map.GRID_TYPES, 'the grid: hex, square or none'), force: p.bool('overwrite an existing file (with --file)', { mcp: false }),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx), preset = (i.preset ?? 'regional') as map.Preset;
    const sz = typeof i.size === 'string' ? i.size.match(/^(\d+)x(\d+)$/) : null;
    if (i.size && !sz) throw new Error('--size: COLSxROWS, e.g. 30x22');
    const cols = sz ? +sz[1] : typeof i.cols === 'number' ? i.cols : undefined, rows = sz ? +sz[2] : typeof i.rows === 'number' ? i.rows : undefined;
    return createMap(P, i.path ? i.id ?? fileId(i.path) : i.id, preset, {
      seed: typeof i.seed === 'number' ? i.seed : Math.floor(Math.random() * 1e6), ...(cols !== undefined && { cols }), ...(rows !== undefined && { rows }), ...(i.title && { title: i.title }),
      ...(typeof i.grid === 'string' && { grid: { ...map.PRESET_DEFAULTS[preset].grid, type: i.grid as map.GridType } }),
    }, i.force === true, i.path ? { file: i.path } : undefined);
  },
  cli: { usage: '       artgen map new <id> [--preset regional|local] [--size 30x22] [--grid hex|square|none] [--seed n] [--title "..."]', text: (r, i) => `${r.file}\n${describeMap(r.map)}\n${next(i, r.map.id)}`, json: r => V({ file: r.file, map: r.map }) },
  mcp: { content: r => [text({ file: r.file, summary: describeMap(r.map) })] }, python: {},
});

const gen = defineOp({
  name: 'map.gen', module: 'maps', effect: 'write', summary: 'Regenerate a terrain map\'s ground with new generator settings.',
  params: {
    id: idParam('the map id', 'map gen: <id>'), path: pathParam('map'), seed: p.num('the generator seed'), land: p.oneOf(map.LAND_MODES, 'mixed, island or inland'),
    sea: p.num('water fraction, 0..0.9'), moisture: p.num('0..1'), roughness: p.num('0..1'), relief: p.num('0..1'), rivers: p.num('0..20'), simplify: p.num('0..6; higher = fewer, larger, smoother patches'), feature: p.num('hill size in cells'),
    interval: p.num('contour interval'), max_elevation: p.num('the highest contour'), major_every: p.num('a heavier contour every n lines'), topo_labels: p.bool('label the contours', { style: 'onoff' }),
  },
  run(i: Inp, ctx) {
    return updateMap(projectOf(i, ctx), refOf(i), m => {
      if (i.seed !== undefined) m.seed = i.seed;
      if (i.land) m.gen.land = i.land;
      for (const k of ['sea', 'moisture', 'roughness', 'relief', 'rivers', 'simplify', 'feature'] as const) if (i[k] !== undefined) m.gen[k] = i[k];
      if (i.interval !== undefined) m.topo.interval = i.interval;
      if (i.max_elevation !== undefined) m.topo.maxElevation = i.max_elevation;
      if (i.major_every !== undefined) m.topo.majorEvery = i.major_every;
      if (i.topo_labels !== undefined) m.topo.labels = i.topo_labels;
    });
  },
  cli: {
    usage: '       artgen map gen <id> [--seed n] [--land mixed|island|inland] [--sea f] [--moisture f] [--roughness f] [--relief f] [--rivers n] [--simplify n] [--feature n] [--interval n] [--max-elevation n] [--topo-labels on|off]',
    text: (m, i) => `${describeMap(m)}\n${next(i)}`, json: m => V(m),
  },
  mcp: { exclude: 'map_update covers it' }, python: {},
});

const update = defineOp({
  name: 'map.update', module: 'maps', effect: 'write', summary: 'Change a terrain map\'s settings.',
  description: 'Change a terrain map\'s settings. gen: {land: mixed|island|inland, sea 0..0.9 (water fraction), moisture 0..1, roughness 0..1, relief 0..1, rivers 0..20, simplify 0..6 (higher = fewer, larger, smoother patches), feature (hill size in cells)}; topo: {interval, maxElevation, majorEvery, unit, labels}; grid: {type none|square|hex, size, coords}; scale: {perCell, unit}; title, legend, scale_bar, compass.',
  params: {
    id: idParam('the map id', 'map update: <id>'), path: pathParam('map'), seed: p.num('the generator seed'),
    gen: p.json({ type: 'object' }, 'generator settings, as JSON'), topo: p.json({ type: 'object' }, 'contour settings, as JSON'), grid: p.json({ type: 'object' }, 'grid settings, as JSON'), scale: p.json({ type: 'object' }, 'scale settings, as JSON'),
    title: p.str('the title ("" removes it)'), legend: p.bool('show the legend', { style: 'onoff' }), scale_bar: p.bool('show the scale bar', { style: 'onoff' }), compass: p.bool('show the compass', { style: 'onoff' }),
  },
  run(i: Inp, ctx) {
    return updateMap(projectOf(i, ctx), refOf(i), m => {
      if (typeof i.seed === 'number') m.seed = i.seed;
      for (const k of ['gen', 'topo', 'grid', 'scale'] as const) if (i[k] && typeof i[k] === 'object') Object.assign(m[k], i[k]);
      if (typeof i.title === 'string') { if (i.title) m.title = i.title; else delete m.title; }
      if (typeof i.legend === 'boolean') m.legend = i.legend;
      if (typeof i.scale_bar === 'boolean') m.scaleBar = i.scale_bar;
      if (typeof i.compass === 'boolean') m.compass = i.compass;
    });
  },
  cli: {
    usage: `       artgen map update <id> [--seed n] [--gen '<json>'] [--topo '<json>'] [--grid '<json>'] [--scale '<json>'] [--title "..."] [--legend on|off] [--scale-bar on|off] [--compass on|off]   (the settings as JSON, or @file.json)`,
    text: (m, i) => `${describeMap(m)}\n${next(i, m.id)}`, json: m => V(m),
  },
  mcp: { content: m => [text(describeMap(m))] }, python: {},
});

const edit = defineOp({
  name: 'map.edit', module: 'maps', effect: 'write', summary: 'Edit a terrain map\'s ground: paint, elevate, river, road, undo; or a batch of edits as JSON.',
  description: 'Append terrain edits to a map (applied in order on top of the generated terrain), or undo the last ones. Coordinates are map cells (x right, y down). ops: {op:"paint", terrain, shape} | {op:"elevate", amount -1..1, shape} | {op:"river", points:[x,y,…] from source to mouth, width? (at the mouth), delta? (default true: flares into the water it ends in, banks merging into the shore)} | {op:"road", points:[x,y,…]}; shape: {circle:[x,y,r]} | {poly:[x,y,…]} | {stroke:[x,y,…], width}.',
  params: {
    id: idParam('the map id', 'map edit: <id> <op>'), path: pathParam('map'),
    op: p.str('paint | elevate | river | road | undo', { positional: true, mcp: false }),
    ops: p.json({ type: 'array', items: { type: 'object' } }, 'a batch of edits, as JSON (or @file.json); see the MCP tool for the fields'),
    undo: p.num('remove this many of the latest edits first', { schema: { type: 'number', description: 'remove this many of the latest edits first' } }),
    terrain: p.oneOf(map.TERRAINS, 'the terrain to paint', { mcp: false, error: `one of ${map.TERRAINS.join(', ')}` }),
    circle: p.str('x,y,r', { mcp: false }), poly: p.str('x,y,x,y,…', { mcp: false }), stroke: p.str('x,y,… (with --width)', { mcp: false }), width: p.str('stroke or river width', { mcp: false }),
    amount: p.num('elevate by this much (negative: a valley); default 0.2', { mcp: false }), points: p.points('x,y,… (river: source first; road)', { mcp: false }),
    delta: p.bool('a river flares into the water it ends in (off: not)', { style: 'onoff', mcp: false }), origin: p.str('who wrote the edit (a sync replaces its own)', { mcp: false }),
  },
  run(i: Inp, ctx) {
    let summary = '';
    const m = updateMap(projectOf(i, ctx), refOf(i), m => {
      if (i.op !== undefined) {
        if (i.ops !== undefined || i.undo !== undefined) throw new Error('map edit: give an <op>, or --ops / --undo, not both');
        const shape = () => shapeFrom({ circle: i.circle, poly: i.poly, stroke: i.stroke, width: i.width });
        if (i.op === 'undo') { const e = m.edits.pop(); if (!e) throw new Error(`${m.id}: no edits to undo`); summary = `removed ${e.op}`; return; }
        if (i.op === 'paint') {
          if (!map.TERRAINS.includes(i.terrain)) throw new Error(`--terrain: one of ${map.TERRAINS.join(', ')}`);
          m.edits.push({ op: i.op, terrain: i.terrain, shape: shape() });
        } else if (i.op === 'elevate') m.edits.push({ op: i.op, amount: i.amount ?? 0.2, shape: shape() });
        else if (i.op === 'river') m.edits.push({ op: i.op, points: needPoints(i.points, '--points'), ...(numFlag(i.width, '--width') !== undefined && { width: numFlag(i.width, '--width') }), ...(i.delta === false && { delta: false }) });
        else if (i.op === 'road') m.edits.push({ op: i.op, points: needPoints(i.points, '--points') });
        else throw new Error('map edit <id> paint|elevate|river|road|undo');
        if (originOf(i.origin)) m.edits[m.edits.length - 1].origin = originOf(i.origin)!.origin;
        summary = `edit ${m.edits.length - 1}: ${i.op}`;
        return;
      }
      if (i.ops === undefined && i.undo === undefined && ctx.surface === 'cli') throw new Error('map edit <id> paint|elevate|river|road|undo');
      const n = typeof i.undo === 'number' ? i.undo : 0;
      if (n > m.edits.length) throw new Error(`${m.id}: only ${m.edits.length} edits to undo`);
      m.edits.splice(m.edits.length - n, n);
      if (Array.isArray(i.ops)) m.edits.push(...(i.ops as map.MapEdit[]));
      summary = `${n ? `removed ${n}${Array.isArray(i.ops) ? ', ' : ''}` : ''}${Array.isArray(i.ops) ? `added ${i.ops.length}` : ''}` || 'no change';
    });
    return { m, summary };
  },
  cli: {
    usage: [
      '       artgen map edit <id> paint --terrain t <shape> | elevate --amount ±f <shape> | river --points x,y,… [--width w] [--delta off] | road --points x,y,… | undo   [--origin name]',
      `                  <shape>: --circle x,y,r | --poly x,y,x,y,… | --stroke x,y,… --width w   (terrains: ${map.TERRAINS.join(', ')})`,
      `       artgen map edit <id> [--undo n] [--ops '<json list>']   (a batch: see the MCP tool map_edit for the edits; @file.json reads them from a file)`,
    ],
    text: (r, i) => `${r.m.id}: ${r.summary} (${r.m.edits.length} edits)\n${next(i, r.m.id)}`, json: r => V(r.m),
  },
  mcp: { content: r => [text({ edits: r.m.edits.length, last: r.m.edits.slice(-3) })] }, python: {},
});

const grid = defineOp({
  name: 'map.grid', module: 'maps', effect: 'write', summary: 'Set a terrain map\'s grid.',
  params: {
    id: idParam('the map id', 'map grid: <id>'), path: pathParam('map'), type: p.str('hex | square | none', { positional: true }),
    size: p.num('grid size in map units'), coords: p.bool('show coordinates', { style: 'onoff' }),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx), type = i.type as map.GridType;
    if (!map.GRID_TYPES.includes(type)) throw new Error(`map grid <id> ${map.GRID_TYPES.join('|')}`);
    return updateMap(P, refOf(i), m => { m.grid.type = type; if (i.size !== undefined) m.grid.size = i.size; if (i.coords !== undefined) m.grid.coords = i.coords; });
  },
  cli: {
    usage: '       artgen map grid <id> hex|square|none [--size n] [--coords on|off]',
    text: (m, i) => `${m.id}: grid ${m.grid.type}${m.grid.type !== 'none' ? ` size ${m.grid.size}${m.grid.coords ? ', coordinates' : ''}` : ''}\n${next(i, m.id)}`, json: m => V(m.grid),
  },
  mcp: { exclude: 'map_update covers it' }, python: {},
});

const label = defineOp({
  name: 'map.label', module: 'maps', effect: 'write', summary: 'Add a label to a terrain map.',
  params: {
    id: idParam('the map id', 'map label: <id>'), path: pathParam('map'), text: p.str('the label text', { positional: true }), at: p.str('x,y, a hex like 0304 or a cell like C4'),
    kind: p.oneOf(map.LABEL_KINDS, 'region (big spaced capitals), place (bold, beside its symbol), water (italic) or note; default place'), size: p.num('size factor'), angle: p.num('degrees'), origin: p.str('who wrote it (a sync replaces its own)'),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    if (!i.text || !i.at) throw new Error('map label <id> "Text" --at x,y|0304|C4');
    const m = updateMap(P, refOf(i), m => {
      const [x, y] = map.parsePoint(m, i.at), kind = (i.kind ?? 'place') as map.LabelKind;
      m.overlay.labels.push({ text: i.text, x, y, kind, ...(i.size !== undefined && { size: i.size }), ...(i.angle !== undefined && { angle: i.angle }), ...originOf(i.origin) });
    });
    return { m, n: m.overlay.labels.length };
  },
  cli: { usage: '       artgen map label <id> "Text" --at x,y|0304|C4 [--kind region|place|water|note] [--size f] [--angle deg] [--origin name]', text: (r, i) => `${r.m.id}: label ${r.n - 1} "${i.text}"\n${next(i, r.m.id)}`, json: r => V(r.m.overlay.labels) },
  mcp: { exclude: 'map_overlay add_labels covers it' }, python: {},
});

const symbol = defineOp({
  name: 'map.symbol', module: 'maps', effect: 'write', summary: 'Add a symbol to a terrain map.',
  params: {
    id: idParam('the map id', 'map symbol: <id>'), path: pathParam('map'), kind: p.str('the symbol kind (artgen map symbols)', { positional: true }), at: p.str('x,y, a hex like 0304 or a cell like C4'),
    scale: p.num('size factor'), angle: p.num('degrees'), origin: p.str('who wrote it (a sync replaces its own)'),
  },
  run(i: Inp, ctx) {
    const P = projectOf(i, ctx);
    if (!i.kind || !i.at) throw new Error('map symbol <id> <kind> --at x,y|0304|C4 (kinds: artgen map symbols)');
    const m = updateMap(P, refOf(i), m => {
      const [x, y] = map.parsePoint(m, i.at);
      if (!map.SYMBOLS[i.kind]) throw new Error(`unknown symbol ${i.kind} (have: ${map.SYMBOL_KINDS.join(', ')})`);
      m.overlay.symbols.push({ kind: i.kind, x, y, ...(i.scale !== undefined && { scale: i.scale }), ...(i.angle !== undefined && { angle: i.angle }), ...originOf(i.origin) });
    });
    return { m, n: m.overlay.symbols.length };
  },
  cli: { usage: '       artgen map symbol <id> <kind> --at x,y|0304|C4 [--scale f] [--angle deg] [--origin name]', text: (r, i) => `${r.m.id}: symbol ${r.n - 1} "${i.kind}"\n${next(i, r.m.id)}`, json: r => V(r.m.overlay.symbols) },
  mcp: { exclude: 'map_overlay add_symbols covers it' }, python: {},
});

const overlay = defineOp({
  name: 'map.overlay', module: 'maps', effect: 'write', summary: 'Remove or clear labels and symbols on a terrain map, or add them as JSON lists.',
  description: 'Labels and symbols over a map (the follow-up layer). add_labels: [{text, at:"x,y"|"0304"|"C4" or x,y, kind: region|place|water|note, size?, angle?}]; add_symbols: [{kind, at or x,y, scale?}] (kinds from map_list); remove_labels / remove_symbols: indices (from map_get); clear: "labels"|"symbols"|"all".',
  params: { id: idParam('the map id', 'map overlay: <id> rm|clear'), path: pathParam('map'), ...overlayParams('labels | symbols') },
  run(i: Inp, ctx) {
    return updateMap(projectOf(i, ctx), refOf(i), m => {
      const pt = (o: Inp): [number, number] => (typeof o.at === 'string' ? map.parsePoint(m, o.at) : [Number(o.x), Number(o.y)]);
      overlayEdit(m, i, {
        name: 'map', strict: ctx.surface === 'cli',
        addLabel(l) { const [x, y] = pt(l); m.overlay.labels.push({ text: String(l.text), x, y, kind: (l.kind ?? 'place') as map.LabelKind, ...(typeof l.size === 'number' && { size: l.size }), ...(typeof l.angle === 'number' && { angle: l.angle }), ...(typeof l.href === 'string' && l.href && { href: l.href }), ...(typeof l.origin === 'string' && l.origin && { origin: l.origin }) }); },
        addSymbol(s) {
          if (!map.SYMBOLS[String(s.kind)]) throw new Error(`unknown symbol ${String(s.kind)} (have: ${map.SYMBOL_KINDS.join(', ')})`);
          const [x, y] = pt(s); m.overlay.symbols.push({ kind: String(s.kind), x, y, ...(typeof s.scale === 'number' && { scale: s.scale }), ...(typeof s.angle === 'number' && { angle: s.angle }), ...(typeof s.origin === 'string' && s.origin && { origin: s.origin }) });
        },
      });
    });
  },
  cli: {
    usage: '       artgen map overlay <id> rm label|symbol <i> | clear [labels|symbols]   or  [--add-labels \'<json>\'] [--add-symbols \'<json>\'] [--remove-labels i,j] [--remove-symbols i,j] [--clear labels|symbols|all]',
    text: m => `${m.id}: ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols`, json: m => V(m.overlay),
  },
  mcp: { content: m => [text(overlayLines(m))] }, python: {},
});

const set = defineOp({
  name: 'map.set', module: 'maps', effect: 'write', summary: 'Set a terrain map\'s title, legend, scale bar, compass and scale.',
  params: {
    id: idParam('the map id', 'map set: <id>'), path: pathParam('map'), title: p.str('the title ("" removes it)'), legend: p.bool('show the legend', { style: 'onoff' }),
    scale_bar: p.bool('show the scale bar', { style: 'onoff' }), compass: p.bool('show the compass', { style: 'onoff' }), per_cell: p.num('map units in one cell'), unit: p.str('the scale unit, e.g. mi'),
  },
  run(i: Inp, ctx) {
    return updateMap(projectOf(i, ctx), refOf(i), m => {
      if (i.title !== undefined) { if (i.title) m.title = i.title; else delete m.title; }
      for (const [f, k] of [['legend', 'legend'], ['scale_bar', 'scaleBar'], ['compass', 'compass']] as const) if (i[f] !== undefined) m[k] = i[f];
      if (i.per_cell !== undefined) m.scale.perCell = i.per_cell;
      if (i.unit) m.scale.unit = i.unit;
    });
  },
  cli: { usage: '       artgen map set <id> [--title "..."] [--legend on|off] [--scale-bar on|off] [--compass on|off] [--per-cell n] [--unit mi]', text: (m, i) => `${describeMap(m)}\n${next(i, m.id)}`, json: m => V(m) },
  mcp: { exclude: 'map_update covers it' }, python: {},
});

/** map_render also returns the PNG(s), drawn small (at most 24 px a cell) unless ppu is given. */
async function renderPreview(r: Inp, i: Inp, ctx: Ctx): Promise<Content[]> {
  const P = ctx.project(), theme = i.theme ?? 'color', themes: map.ThemeName[] = theme === 'both' ? ['color', 'bw'] : [theme === 'bw' ? 'bw' : 'color'], layers = layersOf(i.layers, v => parseLayers(v));
  const files = r.files.map((f: string) => ctx.rel(f));
  const look = typeof i.ppu === 'number' ? files.filter((f: string) => f.endsWith('.png')) : (await renderMapFiles(P, i.id, { themes, ppu: 24, layers, formats: ['png'], out: join(P.art, 'maps', i.id, 'out', 'preview') })).files.map((f: string) => ctx.rel(f));
  return [text({ ...r, files }), ...look.map((f: string) => pngFile(join(P.root, f)))];
}

const render = defineOp({
  name: 'map.render', module: 'maps', effect: 'render', summary: 'Render a terrain map to SVG and/or PNG, in colour and/or black and white.',
  description: 'Render a terrain map to art/maps/<id>/out/ (SVG + PNG; theme color, bw or both) and return the PNG to look at. layers turns layers off/on: terrain, rivers, roads, contours, grid, symbols, labels, legend, scale, compass, title. ppu: pixels per cell (default 40; the returned image uses at most 24 unless set).',
  params: {
    id: idParam('the map id', 'map render: <id>'), path: pathParam('map'),
    theme: p.oneOf(['color', 'bw', 'both'], 'color, bw or both (command line default: both; MCP: color)', { error: 'color, bw or both' }),
    ppu: p.num('pixels per cell (default 40)'), layers: p.str(LAYER_DOC, { schema: { type: 'object', description: 'layers to turn off/on, e.g. { grid: false }' } }),
    format: p.oneOf(['svg', 'png', 'both'], 'svg, png or both (default both)', { mcp: false, error: 'svg, png or both' }),
    fit: p.str('180x260mm or 800x600px: pick the scale that fits the window in the box', { mcp: false }), page_scale: p.str('output pixels per millimetre on the page', { mcp: false }),
    crop: p.str('x,y,w,h in map units (or cells, with "cells" after it): a window on the render', { mcp: false }), out: p.str('the folder to render into', { mcp: false }),
  },
  async run(i: Inp, ctx) {
    const P = projectOf(i, ctx), theme = i.theme ?? (ctx.surface === 'cli' ? 'both' : 'color'), format = i.format ?? 'both';
    return renderMapFiles(P, refOf(i), {
      themes: theme === 'both' ? ['color', 'bw'] : [theme === 'bw' ? 'bw' : 'color'], formats: format === 'both' ? ['svg', 'png'] : [format as 'svg' | 'png'],
      ppu: i.ppu, pageScale: pageScaleOf(i.page_scale), ...viewOf(i, () => readMap(P, refOf(i)).grid.size), layers: layersOf(i.layers, v => parseLayers(v)), out: i.out,
    });
  },
  cli: {
    usage: [
      '       artgen map render <id> [--theme color|bw|both] [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h[cells]] [--layers grid=off,labels=off] [--out dir]',
      '         (--fit and --page-scale set label, symbol and stroke sizes in points and millimetres on the page, 9 pt place labels, 7 pt notes, 5 mm symbols, and keep labels off one another; --json lists any that found no room.',
      '          --crop is a window on the full render, in map units or, with "cells" after it, grid cells; --fit picks the ppu that fits the crop or the whole map in the box)',
    ],
    text: (r, i) => [`${i.path ?? i.id} ${r.size.join('×')} px, ${r.ppu} px a unit, window ${r.crop.join(',')}: ${r.terrains.join(', ')}${r.rivers ? `, ${r.rivers} rivers` : ''}`, ...r.unplaced.map((u: { index: number; text: string }) => `  no free spot for label ${u.index} "${u.text}"`), ...r.files.map((f: string) => `  ${f}`)].join('\n'),
    json: r => V(r),
  },
  mcp: { content: renderPreview },
  python: {},
});

const facts = defineOp({
  name: 'map.facts', module: 'maps', effect: 'read', summary: 'The ground of a terrain map as numbers: points, areas, or the whole map\'s rivers, roads, hilltops and hollows.',
  description: 'A terrain map\'s ground read back as numbers. at: points to measure ("x,y", "0304", "C4" or [x,y]): each one\'s terrain, height, slope and nearest river and road; area: polygons ([x,y,…]): the terrain shares, lowest and highest ground and the rivers and roads that cross each; above: river | lowest (with at: how far above that); radius: the search radius in map units. With neither at nor area: the whole map\'s rivers, roads, hilltops, hollows and terrain shares. Positions in map units, lengths also in the scale unit, heights in topo.unit and whole multiples of topo.interval.',
  params: {
    id: idParam('the map id', 'map facts: <id>'), path: pathParam('map'),
    at: { kind: 'string', doc: 'a point to measure: x,y | C4 | 0304 (several: --at x,y x,y)', multi: true, schema: { type: 'array', items: {}, description: 'points to measure: "x,y", "0304", "C4" or [x, y]' } },
    area: { kind: 'string', doc: 'an area to measure: x,y,x,y,… (a polygon; repeat the flag for more)', repeat: true, schema: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'polygons to measure: [x,y,x,y,…]' } },
    above: p.oneOf(['river', 'lowest'], 'with --at: how far above the river or the lowest ground', { error: 'river or lowest' }), radius: p.num('the search radius in map units', { error: 'a number above 0 (map units)' }),
  },
  run(i: Inp, ctx) {
    const m = readMap(projectOf(i, ctx), refOf(i));
    if (i.radius !== undefined && !(i.radius > 0)) throw new Error('--radius: a number above 0 (map units)');
    const areas = ((i.area as unknown[] | undefined) ?? []).map(a => map.areaOutline(typeof a === 'string' ? numbers(a, '--area', false) : (a as unknown[]).map(Number)));
    const at = ((i.at as unknown[] | undefined) ?? []).map(v => map.parsePoint(m, Array.isArray(v) ? `${v[0]},${v[1]}` : String(v)));
    return map.mapFacts(m, { at, areas, ...(i.above && { above: i.above }), ...(i.radius !== undefined && { radius: i.radius }) });
  },
  cli: {
    usage: [
      '       artgen map facts <id> [--at x,y … | C4 | 0304] [--area x,y,x,y,…] [--above river|lowest] [--radius n] [--json]',
      '                  the ground as numbers: --at gives each point\'s terrain, height, slope and nearest river and road; --area the terrain shares, lowest and highest',
      '                  ground and the rivers and roads that cross it; neither gives the whole map\'s rivers, roads, hilltops, hollows and terrain shares.',
      '                  Positions in map units, lengths also in the scale unit, heights in topo.unit and whole multiples of topo.interval',
    ],
    text: r => describeMapFacts(r), json: r => V(r),
  },
  mcp: {}, python: {},
});

const check = defineOp({
  name: 'map.check', module: 'maps', effect: 'read', summary: 'Check a terrain map file: format errors with their JSON paths, then each `require` entry measured.',
  description: 'Check a terrain map: every format error in its file with the JSON path, then each `require` entry measured against the generated ground (`C-forest terrain forest 0.71 < 0.80 unmet`). Fix errors before rendering.',
  params: { id: idParam('the map id', 'map check: <id>'), path: pathParam('map') },
  run: (i: Inp, ctx) => checkMapFile(projectOf(i, ctx), refOf(i)),
  cli: {
    usage: '       artgen map check <id> [--json]   the file\'s format errors with their JSON paths, then each `require` entry measured: `C-forest terrain forest 0.71 < 0.80 unmet`; exits 1 on any error or unmet requirement',
    text: r => (r.errors.length
      ? [`${r.file}: ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`, ...r.errors.map((e: { path: string; message: string }) => `  ${e.path || '(file)'}: ${e.message}`)].join('\n')
      : [`${r.file}: ${r.requirements.length ? (r.ok ? `all ${r.requirements.length} requirements met` : `${r.unmet.length} of ${r.requirements.length} requirements unmet`) : 'ok, no requirements'}`, ...r.requirements.map((q: { text: string }) => `  ${q.text}`)].join('\n')),
    json: r => V(r), exit: r => (r.ok ? 0 : 1),
  },
  mcp: {}, python: {},
});

const sync = defineOp({
  name: 'map.sync', module: 'maps', effect: 'write', summary: 'Replace the entries of one origin from a regenerated file, keeping every other.',
  params: {
    origin: p.str('the origin to replace (e.g. tables)', { required: 'map sync <id>|--file target.json --from new.json --origin tables' }),
    from: p.str('the new file: every entry in it carries the origin', { required: 'map sync <id>|--file target.json --from new.json --origin tables' }),
    id: idParam('the map id', 'map sync: <id>'), path: pathParam('map'),
  },
  run(i: Inp, ctx) {
    let report!: SyncReport;
    updateMap(projectOf(i, ctx), refOf(i), m => { const r = map.syncMap(m, map.parseMap(readJson(i.from)), i.origin); report = r.report; Object.assign(m, r.spec); if (!r.spec.require) delete m.require; });
    return report;
  },
  cli: { usage: '       artgen map sync <id>|--file target.json --from new.json --origin tables [--json]   replace the entries of one origin, keep every other (hand entries last); lists what that disturbs', text: (r, i) => syncText(String(i.path ?? i.id), r), json: r => V(r) },
  mcp: { exclude: 'reads --from by path (consumer tooling)' }, python: {},
});

export const MAP_MAP_OPS: OpDef[] = [list, symbols, show, create, gen, update, edit, grid, label, symbol, overlay, set, render, facts, check, sync];
