/**
 * `artgen map …`, `artgen dungeon …` and `artgen settlement …`: the commands of the map, dungeon and settlement engines. They are a module of their own,
 * with `formats`, so the maps-only bundle (`artgen-maps.js`, see `maps-bin.ts`) holds them without the pixel-art pipeline.
 *
 * Each command names its map by id (in a project: `art/maps/<id>/map.json`) or by `--file <path>`, which needs no
 * project and renders beside the file unless `--out` says otherwise.
 */
import { dungeon, map, parseCrop, parseFit, settlement, type Crop, type Fit, type SyncReport } from 'artgen-core/maps';
import { checkDungeonFile, warningLines, cornerPoint, describeDungeonFacts, corridorEnd, createDungeon, describeDungeon, doorPair, dungeonSummary, gridMode, listDungeons, readDungeon, renderDungeonFiles, updateDungeon } from './dungeon.ts';
import { checkMapFile, createMap, describeMap, describeMapFacts, factsQuery, listMaps, mapSummary, numbers, onOff, parseLayers, readMap, renderMapFiles, shapeFrom, updateMap } from './map.ts';
import { fileId, readJson, requireProject } from './projectfs.ts';
import { checkSettlementFile, createSettlement, describeSettlement, describeSettlementFacts, listSettlements, mapForSettlement, readSettlement, readSettlementUnderlay, renderSettlementFiles, settlementSummary, settlementWarningLines, updateSettlement } from './settlement.ts';

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

/** `--crop` and `--fit` from the command line; `cell` is the units in one grid cell (for a crop given in cells). */
export function viewFlags(args: string[], cell: number): { crop?: Crop; fit?: Fit } {
  const crop = flag(args, '--crop'), fit = flag(args, '--fit');
  return { ...(crop !== undefined && { crop: parseCrop(crop, cell) }), ...(fit !== undefined && { fit: parseFit(fit) }) };
}

/** `--origin tables`: who wrote an entry (none: a hand entry). */
export const originFlag = (args: string[]): { origin: string } | undefined => { const v = flag(args, '--origin'); if (v === undefined) return undefined; if (!v) throw new Error('--origin: a non-empty name'); return { origin: v }; };

/** `--page-scale n`: output pixels per millimetre on the page (`--fit` sets it from the box). */
export const pageScaleFlag = (args: string[]): number | undefined => { const v = flag(args, '--page-scale'); if (v === undefined) return undefined; if (!(+v > 0)) throw new Error('--page-scale: output pixels per millimetre, above 0'); return +v; };

/** Print a sync's result: what was replaced and every conflict. */
function syncText(file: string, r: SyncReport): string {
  const lists = Object.entries(r.lists).filter(([, c]) => c.removed || c.added).map(([n, c]) => `${n}: ${c.removed} of ${r.origin} replaced by ${c.added}`);
  return [`${file}: synced origin ${r.origin}${lists.length ? ` (${lists.join('; ')})` : ' (nothing of that origin on either side)'}`, `${r.conflicts.length} conflict${r.conflicts.length === 1 ? '' : 's'}${r.conflicts.length ? ':' : ''}`, ...r.conflicts.map(c => `  ${c.kind}: ${c.message}`)].join('\n');
}

export const num = (args: string[], name: string): number | undefined => { const v = flag(args, name); if (v === undefined) return undefined; if (!Number.isFinite(+v)) throw new Error(`${name}: a number`); return +v; };

export const MAP_USAGE = `       artgen map new <id> [--preset regional|local] [--size 30x22] [--grid hex|square|none] [--seed n] [--title "..."]
       artgen map gen <id> [--seed n] [--land mixed|island|inland] [--sea f] [--moisture f] [--roughness f] [--relief f] [--rivers n] [--simplify n] [--feature n] [--interval n] [--max-elevation n] [--topo-labels on|off]
       artgen map edit <id> paint --terrain t <shape> | elevate --amount ±f <shape> | river --points x,y,… [--width w] [--delta off] | road --points x,y,… | undo
                  <shape>: --circle x,y,r | --poly x,y,x,y,… | --stroke x,y,… --width w   (terrains: ${map.TERRAINS.join(', ')})
       artgen map grid <id> hex|square|none [--size n] [--coords on|off]
       artgen map label <id> "Text" --at x,y|0304|C4 [--kind region|place|water|note] [--size f] [--angle deg]
       artgen map symbol <id> <kind> --at x,y|0304|C4 [--scale f] [--angle deg] [--origin name] | map symbols | map overlay <id> rm label|symbol <i> | clear [labels|symbols]
       artgen map set <id> [--title "..."] [--legend on|off] [--scale-bar on|off] [--compass on|off] [--per-cell n] [--unit mi]
       artgen map render <id> [--theme color|bw|both] [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h[cells]] [--layers grid=off,labels=off] [--out dir]
         (--fit and --page-scale set label, symbol and stroke sizes in points and millimetres on the page, 9 pt place labels, 7 pt notes, 5 mm symbols, and keep labels off one another; --json lists any that found no room.
          --crop is a window on the full render, in map units or, with "cells" after it, grid cells; --fit picks the ppu that fits the crop or the whole map in the box)
       artgen map show <id> | list
       artgen map facts <id> [--at x,y … | C4 | 0304] [--area x,y,x,y,…] [--above river|lowest] [--radius n] [--json]
                  the ground as numbers: --at gives each point's terrain, height, slope and nearest river and road; --area the terrain shares, lowest and highest
                  ground and the rivers and roads that cross it; neither gives the whole map's rivers, roads, hilltops, hollows and terrain shares.
                  Positions in map units, lengths also in the scale unit, heights in topo.unit and whole multiples of topo.interval
       artgen map check <id> [--json]   the file's format errors with their JSON paths, then each \`require\` entry measured: \`C-forest terrain forest 0.71 < 0.80 unmet\`; exits 1 on any error or unmet requirement
       artgen dungeon new <id> [--size 40x30] [--seed n] [--title "..."] [--empty] | new <id> --room rect|circle|octagon|cave --room-size 8x6 [--exits n,e:secret,s:none:To the caves,w] [--label "..."] [--number n|off]
       artgen dungeon gen <id> [--seed n] [--rooms n] [--min-size n] [--max-size n] [--caves f] [--round f] [--loops f] [--doors f] [--corridor-width n] [--spacing n] [--entrance on|off] [--size 40x30]
                  [--layout scatter|dense|blocks] [--density f]   dense: rooms side by side, joined through shared walls; blocks: blocks split into rooms, joined by corridors
       artgen dungeon room <id> add <shape> --at x,y|C4 --size WxH [--points x,y,…] [--label "..."] [--number n|off] [--room-id r9] [--fill floor|building|yard|cellar] [--href url] [--origin name] | move <rid> --at x,y | set <rid> [--shape s] [--size WxH] [--label "..."] [--number n|off] [--fill f] [--href url|none] | rm <rid>
       artgen dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id> [--width 1] [--route auto|hv|vh|straight|around] [--via x,y,…] [--doors door,none] [--from-side n|e|s|w] [--from-offset n] [--to-side …] [--to-offset n] [--curve smooth] [--style natural] [--seed n] [--id name] [--exit "To the caves" [--exit-href url] [--fade 3]] [--origin name] | unlink <id> <i> | door <id> <i> from|to <kind|none>
       artgen dungeon block <id> add rect|octagon|circle|hex|poly --at x,y --size WxH [--points x,y,…] [--split bsp|rows|cols|grid|cuts] [--min 3] [--cuts-x 4,8] [--cuts-y 6] [--seed n] [--doors 0.25] [--block-id b1]
                  | split <bid> [--seed n] [--split mode] [--min n] | rm <bid>   one shape split into rooms that share walls, with doors between (a block id in link means its nearest room)
       artgen dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1] | disconnect <id> <i>   a door or opening in the wall two touching rooms share
                  (shapes: ${dungeon.ROOM_SHAPES.join(', ')}; doors: ${dungeon.DOOR_KINDS.join(', ')})
       artgen dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all] | style <id> [--hatch band|full|none] [--band n] [--wall f] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--title "..."] [--per-cell n] [--unit ft] [--furniture over|outside|auto] [--furniture-side bottom|right] [--shared-walls on|off|auto]
       artgen dungeon label <id> "Text" --at x,y|C4 [--kind name|note|area] [--size f] [--angle deg] [--href url] [--origin name] | symbol <id> <kind> --at x,y|C4 [--scale f] [--angle deg] [--origin name] | symbols
       artgen dungeon overlay <id> rm label|symbol <i> | clear [labels|symbols] | fit <id> [--margin 2]
       artgen dungeon check <id> [--json]   every error in the file with its JSON path, then drawing errors and warnings (a room outline that crosses itself, rooms laid over each other, a corridor through a room it does not join or across another, a door never drawn, a mark off the sheet or on a badge); exits 1 when there are errors
       artgen map sync <id>|--file target.json --from new.json --origin tables [--json]   replace the entries of one origin, keep every other (hand entries last); lists what that disturbs
       artgen dungeon sync <id>|--file target.json --from new.json --origin tables [--json]   the same for rooms, corridors, walls, labels and symbols; a hand-edited field of a generated room is reported and the table's value kept
       artgen dungeon facts <id> [--json]   each room's box and doors, each corridor's ends and length, the exits, the overlapping rooms and the rooms no corridor reaches
       artgen dungeon render <id> [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h] [--room id|F.3 … [--margin 2]] [--layers grid=off,labels=off] [--out dir] | show <id> | list
         (--room, repeated, crops round those rooms, their doors and the first --margin cells of each corridor)
       artgen settlement new <id> [--kind hamlet|village|town|city|castle] [--size 80x60] [--seed n] [--title "..."] [--empty] [--interiors] [--map <map id|path> --at x,y]
                  a village, town or castle laid out from a seed (--empty: a blank sheet to draw on); --map sets a terrain map under it, its water, woods and slopes shaping the layout
       artgen settlement gen <id> [--seed n] [--kind k] [--size WxH] [--buildings n] [--density f] [--streets organic|grid|radial] [--wall none|palisade|stone] [--water none|river|lake|coast|moat]
                  [--trees f] [--fields f] [--market on|off] [--castle on|off] [--interiors on|off]   lays it out again; entries drawn by hand (no origin) are kept
       artgen settlement building <id> add <kind> --at x,y --size WxH [--shape rect|L|T|circle|octagon|poly] [--points x,y,…] [--wing w,h] [--angle deg] [--roof r] [--stories n] [--label "..."] [--number n|off] [--building-id b9] [--href url]
                  | set <bid> [the same flags] | move <bid> --at x,y | rm <bid>      (kinds: ${settlement.BUILDING_KINDS.join(', ')}; roofs: ${settlement.ROOFS.join(', ')})
       artgen settlement interior <id> <bid> [--seed n] [--stories n] | interior <id> <bid> clear     lay a building's floors out (rooms, doors, windows, stairs, furniture), or clear them
       artgen settlement floor <id> <bid> add|rm --level n [--name "..."] | room <id> <bid> add <shape> --at x,y --size WxH [--level n] [--label "..."] [--room-id r] | room <id> <bid> set|rm <rid> [--level n] …
       artgen settlement connect <id> <bid> <room> <room> [--level n] [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width n] | disconnect <id> <bid> <i> [--level n]
       artgen settlement door|window <id> <bid> --at x,y [--level n] [--kind k] [--width n]      a door or window in the outer wall (plan cells from the footprint's top-left corner)
       artgen settlement fixture <id> <bid> add <kind> --at x,y [--level n] [--size WxH] [--angle deg] [--label "..."] | rm <i> [--level n] | prop <id> add <kind> --at x,y [--size WxH] [--angle deg] | prop <id> rm <i> | fixtures
       artgen settlement road <id> add highway|street|lane|alley|path|track --points x,y,… [--width n] [--curve smooth] [--label "..."] | water <id> add river|stream|canal|moat|pond|lake|sea --points x,y,… [--width n]
       artgen settlement wall <id> add curtain|stone|palisade|fence|hedge|drystone|ruined --points x,y,… [--closed] [--thickness n] [--towers round|square [--tower-size n] [--tower-every n]]
                  | wall <id> gate <i> --at x,y [--kind gatehouse|gate|postern|opening] [--width n] [--drawbridge] | area <id> add <kind> --points x,y,… [--label "..."] | tree <id> add <kind> --at x,y [--size n] | tree <id> scatter <kind> --area x,y,… --count n
                  | road|water|wall|area|tree <id> rm <i>      (areas: ${settlement.AREA_KINDS.join(', ')}; trees: ${settlement.TREE_KINDS.join(', ')})
       artgen settlement grid <id> [10|5|none] [--sub on|off] | style <id> [--title "..."] [--ground grass|dirt|sand|snow|stone] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--per-cell n] [--unit ft] [--plan-cell n] [--furniture over|outside|auto]
       artgen settlement label <id> "Text" --at x,y [--kind name|note|area|street] [--size f] [--angle deg] | symbol <id> <kind> --at x,y [--scale f] [--angle deg] | overlay <id> rm label|symbol <i> | symbols
       artgen settlement check <id> [--json] | facts <id> [--json] | show <id> | list
       artgen settlement render <id> [--view site|plan] [--building bid [--floor n]] [--plans] [--buildings roofs|outline|interior] [--theme color|bw|both] [--format svg|png|both] [--ppu n | --fit 180x260mm] [--crop x,y,w,h] [--layers grid=off] [--out dir]
                  the site (roofs, outlines, or cut away to the ground floor), one building's floor plan, or with --plans the site and every floor of every building
       artgen formats   (the map, dungeon and settlement file format versions this artgen reads; a newer file is refused)
       (map, dungeon and settlement commands take --file <path> in place of <id>: no project needed; renders go beside the file or to --out)`;

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
      if (originFlag(args)) m.edits[m.edits.length - 1].origin = originFlag(args)!.origin;
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
        m.overlay.labels.push({ text: what, x, y, kind, ...(num(args, '--size') !== undefined && { size: num(args, '--size') }), ...(num(args, '--angle') !== undefined && { angle: num(args, '--angle') }), ...originFlag(args) });
      } else {
        if (!map.SYMBOLS[what]) throw new Error(`unknown symbol ${what} (have: ${map.SYMBOL_KINDS.join(', ')})`);
        m.overlay.symbols.push({ kind: what, x, y, ...(num(args, '--scale') !== undefined && { scale: num(args, '--scale') }), ...(num(args, '--angle') !== undefined && { angle: num(args, '--angle') }), ...originFlag(args) });
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
  if (sub === 'facts') {
    const m = readMap(p, need('<id>')), r = map.mapFacts(m, factsQuery(m, args, flag));
    print(describeMapFacts(r), r);
    return 0;
  }
  if (sub === 'check') {
    const r = checkMapFile(p, need('<id>'));
    print(r.errors.length
      ? [`${r.file}: ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`, ...r.errors.map(e => `  ${e.path || '(file)'}: ${e.message}`)].join('\n')
      : [`${r.file}: ${r.requirements.length ? (r.ok ? `all ${r.requirements.length} requirements met` : `${r.unmet.length} of ${r.requirements.length} requirements unmet`) : 'ok, no requirements'}`, ...r.requirements.map(q => `  ${q.text}`)].join('\n'), r);
    return r.ok ? 0 : 1;
  }
  if (sub === 'render') {
    const theme = flag(args, '--theme') ?? 'both', format = flag(args, '--format') ?? 'both';
    if (!['color', 'bw', 'both'].includes(theme)) throw new Error('--theme: color, bw or both');
    if (!['svg', 'png', 'both'].includes(format)) throw new Error('--format: svg, png or both');
    const r = await renderMapFiles(p, need('<id>'), {
      themes: theme === 'both' ? ['color', 'bw'] : [theme as map.ThemeName], formats: format === 'both' ? ['svg', 'png'] : [format as 'svg' | 'png'],
      ppu: num(args, '--ppu'), pageScale: pageScaleFlag(args), ...viewFlags(args, readMap(p, need('<id>')).grid.size), layers: parseLayers(flag(args, '--layers')), out: flag(args, '--out'),
    });
    print([`${file ?? id} ${r.size.join('×')} px, ${r.ppu} px a unit, window ${r.crop.join(',')}: ${r.terrains.join(', ')}${r.rivers ? `, ${r.rivers} rivers` : ''}`, ...r.unplaced.map(u => `  no free spot for label ${u.index} "${u.text}"`), ...r.files.map(f => `  ${f}`)].join('\n'), r);
    return 0;
  }
  if (sub === 'sync') {
    const origin = flag(args, '--origin'), from = flag(args, '--from');
    if (!origin || !from) throw new Error('map sync <id>|--file target.json --from new.json --origin tables');
    let report!: SyncReport;
    updateMap(p, need('<id>'), (m) => { const r = map.syncMap(m, map.parseMap(readJson(from)), origin); report = r.report; Object.assign(m, r.spec); if (!r.spec.require) delete m.require; });
    print(syncText(String(file ?? id), report), report);
    return 0;
  }
  throw new Error('map: new | gen | edit | grid | label | symbol | symbols | overlay | set | render | show | facts | check | sync | list (artgen --help)');
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

/** `--fill floor|building|yard|cellar`. */
function fillFlag(args: string[]): dungeon.RoomFill | undefined {
  const v = flag(args, '--fill');
  if (v === undefined) return undefined;
  if (!dungeon.ROOM_FILLS.includes(v as dungeon.RoomFill)) throw new Error(`--fill: ${dungeon.ROOM_FILLS.join(', ')}`);
  return v as dungeon.RoomFill;
}

/** A hand change to an entry of some origin is recorded, so a sync can report the hand value it replaces. */
function handEdit(r: dungeon.Room, fields: string[]): void {
  if (r.origin) r.hand = [...new Set([...(r.hand ?? []), ...fields])];
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
    const layout = flag(args, '--layout');
    if (layout !== undefined) { if (!dungeon.GEN_LAYOUTS.includes(layout as dungeon.GenLayout)) throw new Error(`--layout: ${dungeon.GEN_LAYOUTS.join(', ')}`); if (layout === 'scatter') delete m.gen.layout; else m.gen.layout = layout as dungeon.GenLayout; }
    if (num(args, '--density') !== undefined) m.gen.density = num(args, '--density');
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
        const [side, kind, ...note] = e.split(':');
        if (!['n', 'e', 's', 'w'].includes(side)) throw new Error('--exits: sides n, e, s, w, each optionally :door kind and :a note (n,e:secret,s:none:To the caves)');
        return { side: side as 'n' | 'e' | 's' | 'w', door: kind === undefined || kind === '' ? undefined : doorPair(kind)![0], ...(note.length && { text: note.join(':') }) };
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
        const fill = fillFlag(args);
        if (fill) room.fill = fill;
        if (flag(args, '--href')) room.href = flag(args, '--href');
        Object.assign(room, originFlag(args));
        m.rooms.push(room);
        summary = `added ${shape} room ${roomId}`;
      } else if (op === 'move') {
        const r = find(), at = flag(args, '--at');
        if (!at) throw new Error('dungeon room <id> move <rid> --at x,y|C4');
        const [x, y] = cornerPoint(at), dx = x - r.x, dy = y - r.y;
        r.x = x; r.y = y;
        handEdit(r, ['x', 'y']);
        if (r.points) r.points = r.points.map((v, i) => v + (i % 2 ? dy : dx));
        summary = `moved ${r.id} to ${x},${y}`;
      } else if (op === 'set') {
        const r = find(), shape = flag(args, '--shape') as dungeon.RoomShape | undefined, sz = sizeFlag(args, '--size'), label = flag(args, '--label'), n = roomNumber(args);
        if (shape) { if (!dungeon.ROOM_SHAPES.includes(shape) || shape === 'poly') throw new Error('--shape: rect, circle, octagon or cave'); r.shape = shape; delete r.points; }
        if (sz) { [r.w, r.h] = sz; handEdit(r, ['w', 'h']); }
        if (shape) handEdit(r, ['shape']);
        if (label !== undefined) { if (label) r.label = label; else delete r.label; handEdit(r, ['label']); }
        if (n !== undefined) r.number = n;
        const fill = fillFlag(args);
        if (fill) { if (fill === 'floor') delete r.fill; else r.fill = fill; handEdit(r, ['fill']); }
        const href = flag(args, '--href');
        if (href !== undefined) { if (href && href !== 'none') r.href = href; else delete r.href; }
        summary = `changed ${r.id}`;
      } else if (op === 'rm') {
        const r = find(), n = dungeon.removeRoom(m, r.id);
        summary = `removed ${r.id} and ${n} corridors`;
      } else throw new Error('dungeon room <id> add|move|set|rm');
    });
    print([`${m.id}: ${summary} (${m.rooms.length} rooms)`, ...warningLines(m), next(m.id)].join('\n'), m.rooms);
    return 0;
  }
  if (sub === 'link') {
    const [, a, b] = pos;
    if (!a || !b) throw new Error('dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id>');
    let [ea, eb] = [a, b];
    const m = updateDungeon(p, need('<id>'), m => {
      // a block id stands for its room nearest the other end
      const isBlock = (v: string) => !!m.blocks?.some(x => x.id === v) && !m.rooms.some(r => r.id === v);
      const centre = (v: string): [number, number] => { const r = m.rooms.find(x => x.id === v); return r ? [r.x + r.w / 2, r.y + r.h / 2] : (() => { try { return dungeon.parsePoint(v); } catch { return [m.cols / 2, m.rows / 2]; } })(); };
      if (isBlock(ea)) ea = dungeon.blockRoomNear(m, ea, ...(isBlock(eb) ? [m.cols / 2, m.rows / 2] as [number, number] : centre(eb))) ?? ea;
      if (isBlock(eb)) eb = dungeon.blockRoomNear(m, eb, ...centre(ea)) ?? eb;
      const route = flag(args, '--route') as dungeon.Route | undefined, doors = doorPair(flag(args, '--doors'));
      if (route && !dungeon.ROUTES.includes(route)) throw new Error(`--route: ${dungeon.ROUTES.join(', ')}`);
      const curve = flag(args, '--curve') as dungeon.Curve | undefined, style = flag(args, '--style') as dungeon.CorridorStyle | undefined, cid = flag(args, '--id');
      const note = flag(args, '--exit'), exit = note !== undefined ? { text: note, ...(flag(args, '--exit-href') && { href: flag(args, '--exit-href') }), ...(num(args, '--fade') !== undefined && { fade: num(args, '--fade') }) } : undefined;
      const withExit = (e: dungeon.CorridorEnd): dungeon.CorridorEnd => (exit && 'at' in e ? { ...e, exit } : e);
      if (curve && !dungeon.CURVES.includes(curve)) throw new Error(`--curve: ${dungeon.CURVES.join(', ')}`);
      if (style && !dungeon.CORRIDOR_STYLES.includes(style)) throw new Error(`--style: ${dungeon.CORRIDOR_STYLES.join(', ')}`);
      if (exit && !('at' in corridorEnd(m, eb))) throw new Error('--exit: the second end must be a point (x,y or a cell name), where the corridor leaves the map');
      m.corridors.push({
        ...(cid && { id: cid }),
        from: corridorEnd(m, ea, flag(args, '--from-side'), num(args, '--from-offset')), to: withExit(corridorEnd(m, eb, flag(args, '--to-side'), num(args, '--to-offset'))),
        ...(num(args, '--width') !== undefined && { width: num(args, '--width') }),
        ...(route && { route }), ...(flag(args, '--via') && { via: numbers(flag(args, '--via'), '--via') }), ...(doors && { doors }),
        ...(curve && curve !== 'none' && { curve }), ...(style && style !== 'built' && { style }), ...(num(args, '--seed') !== undefined && { seed: num(args, '--seed') }), ...originFlag(args),
      });
    });
    print([`${m.id}: corridor ${m.corridors.length - 1}: ${ea} → ${eb}`, ...warningLines(m), next(m.id)].join('\n'), m.corridors);
    return 0;
  }
  if (sub === 'block') {
    const op = pos[1], bid = pos[2];
    let note = '';
    const m = updateDungeon(p, need('<id> add|split|rm'), m => {
      const splitFlags = (base?: dungeon.Block['split']): dungeon.Block['split'] => {
        const mode = (flag(args, '--split') ?? base?.mode ?? 'bsp') as dungeon.SplitMode;
        if (!dungeon.SPLIT_MODES.includes(mode)) throw new Error(`--split: ${dungeon.SPLIT_MODES.join(', ')}`);
        const cx = flag(args, '--cuts-x'), cy = flag(args, '--cuts-y'), cuts = cx || cy ? { ...(cx && { x: numbers(cx, '--cuts-x', false) }), ...(cy && { y: numbers(cy, '--cuts-y', false) }) } : base?.cuts;
        const min = num(args, '--min') ?? base?.min, seed = num(args, '--seed') ?? (op === 'split' && !flag(args, '--split') && num(args, '--min') === undefined ? Math.floor(Math.random() * 1e6) : base?.seed);
        return { mode, ...(min !== undefined && { min }), ...(cuts && { cuts }), ...(seed !== undefined && { seed }) };
      };
      let id: string;
      if (op === 'add') {
        const shape = bid, at = flag(args, '--at'), sz = sizeFlag(args, '--size');
        if (!['rect', 'octagon', 'circle', 'hex', 'poly'].includes(shape)) throw new Error('dungeon block <id> add rect|octagon|circle|hex|poly');
        id = flag(args, '--block-id') ?? (() => { const used = new Set((m.blocks ?? []).map(b => b.id)); for (let n = 1; ; n++) if (!used.has(`b${n}`)) return `b${n}`; })();
        let b: dungeon.Block;
        if (shape === 'poly') { const points = numbers(flag(args, '--points'), '--points'); b = { id, shape: 'poly', points, ...dungeon.polyBox(points), split: splitFlags() }; }
        else {
          if (!at || !sz) throw new Error('dungeon block <id> add <shape> --at x,y|C4 --size WxH');
          const [x, y] = cornerPoint(at);
          b = shape === 'hex' ? { id, shape: 'poly', points: dungeon.hexPoints(x, y, sz[0], sz[1]), x, y, w: sz[0], h: sz[1], split: splitFlags() } : { id, shape: shape as dungeon.Block['shape'], x, y, w: sz[0], h: sz[1], split: splitFlags() };
        }
        if (num(args, '--doors') !== undefined) b.doors = num(args, '--doors');
        (m.blocks ??= []).push(b);
      } else if (op === 'split') {
        const b = m.blocks?.find(x => x.id === bid);
        if (!b) throw new Error(`no block ${bid} (have: ${(m.blocks ?? []).map(x => x.id).join(', ') || 'none'})`);
        b.split = splitFlags(b.split);
        if (num(args, '--doors') !== undefined) b.doors = num(args, '--doors');
        id = b.id;
      } else if (op === 'rm') {
        if (!m.blocks?.some(x => x.id === bid)) throw new Error(`no block ${bid}`);
        dungeon.removeBlock(m, bid); note = `removed block ${bid} and its rooms`;
        return;
      } else throw new Error('dungeon block <id> add|split|rm');
      const r = dungeon.applyBlock(dungeon.parseDungeon(m), id);
      const made = r.spec.rooms.filter(x => x.origin === `block:${id}`).length;
      note = [`block ${id}: ${made} rooms, ${(r.spec.connections ?? []).filter(c => c.origin === `block:${id}`).length} connections`, ...r.dropped.map(d => `  dropped ${d}`)].join('\n');
      return r.spec;
    });
    print([`${m.id}: ${note}`, ...warningLines(m), next(m.id)].join('\n'), m.blocks ?? []);
    return 0;
  }
  if (sub === 'connect') {
    const [, a, b] = pos;
    if (!a || !b) throw new Error('dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1]');
    const m = updateDungeon(p, need('<id>'), m => {
      const kind = flag(args, '--kind') ?? 'door', at = flag(args, '--at'), width = num(args, '--width');
      if (kind !== 'open' && !dungeon.DOOR_KINDS.includes(kind as dungeon.DoorKind)) throw new Error(`--kind: open or one of ${dungeon.DOOR_KINDS.join(', ')}`);
      (m.connections ??= []).push({ a, b, ...(at && { at: dungeon.parsePoint(at) }), ...(kind !== 'door' && { kind: kind as dungeon.DoorKind | 'open' }), ...(width !== undefined && { width }), ...originFlag(args) });
    });
    print([`${m.id}: connection ${m.connections!.length - 1}: ${a} ↔ ${b}`, ...warningLines(m), next(m.id)].join('\n'), m.connections);
    return 0;
  }
  if (sub === 'disconnect') {
    const i = Number(pos[1]);
    const m = updateDungeon(p, need('<id> <index>'), m => {
      if (!Number.isInteger(i) || i < 0 || i >= (m.connections?.length ?? 0)) throw new Error(`dungeon disconnect <id> <index> (connections 0..${(m.connections?.length ?? 0) - 1}; artgen dungeon show)`);
      m.connections!.splice(i, 1);
      if (!m.connections!.length) delete m.connections;
    });
    print(`${m.id}: ${m.connections?.length ?? 0} connections\n${next(m.id)}`, m.connections ?? []);
    return 0;
  }
  if (sub === 'unlink' || sub === 'door') {
    const i = Number(pos[1]);
    const m = updateDungeon(p, need(`<id> <index>`), m => {
      if (!Number.isInteger(i) || i < 0 || i >= m.corridors.length) throw new Error(`dungeon ${sub} <id> <index> (corridors 0..${m.corridors.length - 1}; artgen dungeon show)`);
      if (sub === 'unlink') { dungeon.removeCorridor(m, i); return; }
      const end = pos[2], kind = doorPair(pos[3] ?? 'none')![0];
      if (end !== 'from' && end !== 'to') throw new Error('dungeon door <id> <index> from|to <kind|none>');
      const c = m.corridors[i], d = c.doors ?? [null, null];
      c.doors = end === 'from' ? [kind, d[1]] : [d[0], kind];
    });
    print([`${m.id}: ${m.corridors.length} corridors`, ...warningLines(m), next(m.id)].join('\n'), m.corridors);
    return 0;
  }
  if (sub === 'grid') {
    const mode = pos[1], size = num(args, '--size'), sub = onOff(flag(args, '--sub')), show = onOff(flag(args, '--show')), unit = flag(args, '--unit');
    if (!mode && size === undefined && sub === undefined && show === undefined && !unit && !flag(args, '--clip'))
      throw new Error('dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all]');
    const m = updateDungeon(p, need('<id>'), m => {
      if (unit) m.scale.unit = unit;
      if (mode) m.grid = gridMode(m, mode);
      m.grid = dungeon.gridFromUnits(m, { size, sub, show });
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
      const shared = flag(args, '--shared-walls');
      if (shared === 'auto') delete m.style.sharedWalls; else if (onOff(shared) !== undefined) m.style.sharedWalls = onOff(shared)!;
      const t = flag(args, '--title');
      if (t !== undefined) { if (t) m.title = t; else delete m.title; }
      for (const [f, k] of [['--numbers', 'numbers'], ['--scale-bar', 'scaleBar'], ['--compass', 'compass'], ['--legend', 'legend']] as const) { const v = onOff(flag(args, f)); if (v !== undefined) m[k] = v; }
      if (num(args, '--per-cell') !== undefined) m.scale.perCell = num(args, '--per-cell')!;
      if (flag(args, '--unit')) m.scale.unit = flag(args, '--unit')!;
      const place = flag(args, '--furniture'), side = flag(args, '--furniture-side');
      if (place !== undefined || side !== undefined) {
        if (place !== undefined && !dungeon.FURNITURE_PLACES.includes(place as dungeon.FurniturePlace)) throw new Error(`--furniture: ${dungeon.FURNITURE_PLACES.join(', ')}`);
        if (side !== undefined && !dungeon.FURNITURE_SIDES.includes(side as dungeon.FurnitureSide)) throw new Error(`--furniture-side: ${dungeon.FURNITURE_SIDES.join(', ')}`);
        const f = { place: (place ?? m.furniture?.place ?? 'outside') as dungeon.FurniturePlace, ...((side ?? m.furniture?.side) && { side: (side ?? m.furniture?.side) as dungeon.FurnitureSide }) };
        if (f.place === 'over' && !f.side) delete m.furniture; else m.furniture = f;
      }
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
        m.overlay.labels.push({ text: what, x, y, kind, ...(num(args, '--size') !== undefined && { size: num(args, '--size') }), ...(angle !== undefined && { angle }), ...(flag(args, '--href') && { href: flag(args, '--href') }), ...originFlag(args) });
      } else {
        if (!dungeon.SYMBOLS[what]) throw new Error(`unknown symbol ${what} (have: ${dungeon.SYMBOL_KINDS.join(', ')})`);
        m.overlay.symbols.push({ kind: what, x, y, ...(num(args, '--scale') !== undefined && { scale: num(args, '--scale') }), ...(angle !== undefined && { angle }), ...originFlag(args) });
      }
    });
    const n = sub === 'label' ? m.overlay.labels.length : m.overlay.symbols.length;
    print([`${m.id}: ${sub} ${n - 1} "${what}"`, ...warningLines(m), next(m.id)].join('\n'), sub === 'label' ? m.overlay.labels : m.overlay.symbols);
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
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
    print([r.ok ? `${r.file}: ok${r.warnings.length ? `, ${n(r.warnings.length, 'warning')}` : ''}` : `${r.file}: ${n(r.errors.length, 'error')}${r.warnings.length ? `, ${n(r.warnings.length, 'warning')}` : ''}`,
      ...r.errors.map(e => `  error: ${e.path || '(file)'}: ${e.message}`), ...r.warnings.map(e => `  warning: ${e.path || '(file)'}: ${e.message}`)].join('\n'), r);
    return r.ok ? 0 : 1;
  }
  if (sub === 'fit') {
    const m = updateDungeon(p, need('<id>'), m => dungeon.fitDungeon(m, num(args, '--margin') ?? 2));
    print(`${m.id}: ${m.cols}×${m.rows} cells\n${next(m.id)}`, { cols: m.cols, rows: m.rows });
    return 0;
  }
  if (sub === 'facts') {
    const r = dungeon.dungeonFacts(readDungeon(p, need('<id>')));
    print(describeDungeonFacts(r), r);
    return 0;
  }
  if (sub === 'render') {
    const format = flag(args, '--format') ?? 'both';
    if (!['svg', 'png', 'both'].includes(format)) throw new Error('--format: svg, png or both');
    const r = await renderDungeonFiles(p, need('<id>'), {
      formats: format === 'both' ? ['svg', 'png'] : [format as 'svg' | 'png'], ppu: num(args, '--ppu'), pageScale: pageScaleFlag(args), ...viewFlags(args, 1),
      rooms: args.flatMap((a, i) => (a === '--room' ? [args[i + 1] ?? (() => { throw new Error('--room: a room id'); })()] : [])), margin: num(args, '--margin'),
      layers: parseLayers(flag(args, '--layers'), dungeon.DUNGEON_LAYERS), out: flag(args, '--out'),
    });
    print([`${file ?? id} ${r.size.join('×')} px, ${r.ppu} px a cell, window ${r.crop.join(',')}: ${r.rooms} rooms, ${r.corridors} corridors, ${r.doors} doors`, ...r.unplaced.map(u => `  no free spot for label ${u.index} "${u.text}"`), ...r.files.map(f => `  ${f}`)].join('\n'), r);
    return 0;
  }
  if (sub === 'sync') {
    const origin = flag(args, '--origin'), from = flag(args, '--from');
    if (!origin || !from) throw new Error('dungeon sync <id>|--file target.json --from new.json --origin tables');
    let report!: SyncReport;
    updateDungeon(p, need('<id>'), m => { const r = dungeon.syncDungeon(m, dungeon.parseDungeon(readJson(from)), origin); report = r.report; return r.spec; });
    print(syncText(String(file ?? id), report), report);
    return 0;
  }
  throw new Error('dungeon: new | gen | room | block | link | unlink | door | connect | disconnect | grid | style | label | symbol | symbols | overlay | check | fit | render | show | facts | sync | list (artgen --help)');
}

/** `x,y` (cells) as a point. */
function pointFlag(args: string[], name: string, required = true): [number, number] | undefined {
  const v = flag(args, name);
  if (v === undefined) { if (required) throw new Error(`${name} x,y is required`); return undefined; }
  return dungeon.parsePoint(v);
}

/** The settlement building flags (`--shape`, `--angle`, …) as edit fields. */
function buildingFields(args: string[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of ['shape', 'roof', 'label', 'href', 'kind'] as const) { const v = flag(args, `--${k}`); if (v !== undefined) o[k] = v; }
  for (const k of ['angle', 'stories'] as const) { const v = num(args, `--${k}`); if (v !== undefined) o[k] = v; }
  const nb = roomNumber(args);
  if (nb !== undefined) o.number = nb;
  const pts = flag(args, '--points'), wing = flag(args, '--wing'), at = pointFlag(args, '--at', false), size = sizeFlag(args, '--size');
  if (pts !== undefined) o.points = numbers(pts, '--points');
  if (wing !== undefined) o.wing = numbers(wing, '--wing');
  if (at) [o.x, o.y] = at;
  if (size) [o.w, o.h] = size;
  return o;
}

/** `artgen settlement …` (villages, towns and castles, settlement.ts). */
export async function settlementCommand(sub: string | undefined, args: string[], emit: (human: string, data: unknown) => void): Promise<number> {
  const print = (human: string, data: unknown) => emit(human, withVersion(data, settlement.SETTLEMENT_FORMAT));
  const file = flag(args, '--file'), p = file || sub === 'symbols' || sub === 'fixtures' ? null : requireProject(flag(args, '--root'));
  const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--json', '--closed', '--drawbridge', '--empty', '--interiors', '--plans', '--force'].includes(args[i - 1]))).slice(1);
  if (file && sub !== 'new') pos.unshift('');   // path mode: the file stands where the id would be
  const id = pos[0];
  const ref = (what: string) => { if (file) return { file }; if (!id) throw new Error(`settlement ${sub}: ${what}`); return id; };
  const next = (i?: string) => file ? `next: artgen settlement render --file ${file}` : `next: artgen settlement render ${i ?? id}`;
  const level = num(args, '--level') ?? 0;
  /** Apply edit ops to the file, print what each did and any drawing warnings. */
  const edit = (...ops: settlement.SettlementOp[]) => {
    const lines: string[] = [];
    const m = updateSettlement(p, ref('<id>'), m => { for (const o of ops) lines.push(settlement.editSettlement(m, o)); });
    print([...lines, ...settlementWarningLines(m), next(m.id)].join('\n'), { done: lines, settlement: settlementSummary(m) });
    return 0;
  };
  if (sub === 'list') { const ss = file ? [settlementSummary(readSettlement(null, { file }))] : listSettlements(p!); print(ss.length ? ss.map(s => `${s.id.padEnd(16)} ${s.kind.padEnd(8)} ${s.size.padEnd(8)} ${s.buildings} buildings (${s.interiors} with floors), ${s.roads} roads, ${s.walls} walls${s.title ? `  "${s.title}"` : ''}`).join('\n') : 'no settlements yet: artgen settlement new <id>', ss); return 0; }
  if (sub === 'symbols') { print(Object.entries(settlement.SYMBOLS).map(([k, v]) => `${k.padEnd(12)} ${v.name}`).join('\n'), settlement.SYMBOL_KINDS); return 0; }
  if (sub === 'fixtures') { print(Object.entries(settlement.FIXTURES).map(([k, v]) => `${k.padEnd(14)} ${v.group.padEnd(10)} ${String(v.ft[0]).padStart(3)}×${String(v.ft[1]).padEnd(4)} ft  ${v.name}`).join('\n'), Object.entries(settlement.FIXTURES).map(([kind, v]) => ({ kind, name: v.name, group: v.group, ft: v.ft }))); return 0; }
  if (sub === 'show') { const m = readSettlement(p, ref('<id>')); print(describeSettlement(m), m); return 0; }
  const genFlags = (m: settlement.SettlementSpec) => {
    if (num(args, '--seed') !== undefined) m.seed = num(args, '--seed')!;
    const sz = sizeFlag(args, '--size');
    if (sz) [m.cols, m.rows] = sz;
    const kind = flag(args, '--kind');
    if (kind !== undefined) { if (!settlement.SETTLEMENT_KINDS.includes(kind as settlement.SettlementKind)) throw new Error(`--kind: ${settlement.SETTLEMENT_KINDS.join(', ')}`); m.kind = kind as settlement.SettlementKind; }
    for (const k of ['buildings', 'density', 'trees', 'fields'] as const) { const v = num(args, `--${k}`); if (v !== undefined) m.gen[k] = v; }
    for (const k of ['streets', 'wall', 'water'] as const) { const v = flag(args, `--${k}`); if (v !== undefined) (m.gen as Record<string, unknown>)[k] = v; }
    for (const k of ['market', 'castle', 'interiors'] as const) { const v = onOff(flag(args, `--${k}`)); if (v !== undefined) m.gen[k] = v; }
  };
  const generate = (m: settlement.SettlementSpec, at: string | { file: string }) => {
    const u = readSettlementUnderlay(p, at, m);
    return settlement.generateSettlement(m, u ?? {});
  };
  if (sub === 'new') {
    const sid = file ? id ?? fileId(file) : ref('<id> is required') as string, kind = (flag(args, '--kind') ?? 'village') as settlement.SettlementKind;
    if (!settlement.SETTLEMENT_KINDS.includes(kind)) throw new Error(`--kind: ${settlement.SETTLEMENT_KINDS.join(', ')}`);
    const base = settlement.newSettlement(sid, kind, { seed: Math.floor(Math.random() * 1e6), ...(flag(args, '--title') && { title: flag(args, '--title') }) });
    genFlags(base);
    if (args.includes('--interiors')) base.gen.interiors = true;
    const at = file ? { file } : sid, mapRef = flag(args, '--map');
    if (mapRef) {
      const mp = mapForSettlement(p, at, mapRef), mspec = map.parseMap(readJson(mp.path)), origin = pointFlag(args, '--at') ?? [0, 0];
      const scale = Math.round(((base.scale.perCell * settlement.feetIn(base.scale.unit)) / (mspec.scale.perCell * settlement.feetIn(mspec.scale.unit))) * 1e4) / 1e4;
      base.underlay = { map: mp.rel, origin, scale };
    }
    const m = args.includes('--empty') ? settlement.parseSettlement(base) : generate(settlement.parseSettlement(base), at);
    const r = createSettlement(p, m, args.includes('--force'), file ? { file } : undefined);
    print(`${r.file}\n${describeSettlement(r.settlement)}\n${next(r.settlement.id)}`, { file: r.file, settlement: r.settlement });
    return 0;
  }
  if (sub === 'gen') {
    const m = updateSettlement(p, ref('<id>'), m => { genFlags(m); return generate(settlement.parseSettlement(m), file ? { file } : id); });
    print(`${describeSettlement(m)}\n${next(m.id)}`, m);
    return 0;
  }
  if (sub === 'building') {
    const act = pos[1], bid = pos[2];
    if (act === 'add') { const kind = pos[2]; if (!kind) throw new Error('settlement building <id> add <kind> --at x,y --size WxH'); const o = buildingFields(args); return edit({ op: 'building.add', ...o, kind, ...(flag(args, '--building-id') && { id: flag(args, '--building-id') }) }); }
    if (act === 'set') return edit({ op: 'building.set', id: bid, ...buildingFields(args) });
    if (act === 'move') { const at = pointFlag(args, '--at')!; return edit({ op: 'building.move', id: bid, x: at[0], y: at[1] }); }
    if (act === 'rm') return edit({ op: 'building.rm', id: bid });
    throw new Error('settlement building <id> add|set|move|rm …');
  }
  if (sub === 'interior') return pos[2] === 'clear' ? edit({ op: 'interior.clear', id: pos[1] }) : edit({ op: 'interior', id: pos[1], ...(num(args, '--seed') !== undefined && { seed: num(args, '--seed') }), ...(num(args, '--stories') !== undefined && { stories: num(args, '--stories') }) });
  if (sub === 'floor') {
    const act = pos[2];
    if (act !== 'add' && act !== 'rm') throw new Error('settlement floor <id> <bid> add|rm --level n [--name "..."]');
    return edit({ op: `floor.${act}`, building: pos[1], level, ...(flag(args, '--name') && { name: flag(args, '--name') }) });
  }
  if (sub === 'room') {
    const [, bid, act, x] = pos, size = sizeFlag(args, '--size'), at = pointFlag(args, '--at', false);
    if (act === 'add') return edit({ op: 'room.add', building: bid, level, shape: x ?? 'rect', ...(at && { x: at[0], y: at[1] }), ...(size && { w: size[0], h: size[1] }), ...(flag(args, '--points') && { points: numbers(flag(args, '--points'), '--points') }), ...(flag(args, '--label') && { label: flag(args, '--label') }), ...(flag(args, '--room-id') && { id: flag(args, '--room-id') }) });
    if (act === 'set') return edit({ op: 'room.set', building: bid, level, id: x, ...(at && { x: at[0], y: at[1] }), ...(size && { w: size[0], h: size[1] }), ...(flag(args, '--label') !== undefined && { label: flag(args, '--label') }) });
    if (act === 'rm') return edit({ op: 'room.rm', building: bid, level, id: x });
    throw new Error('settlement room <id> <bid> add|set|rm …');
  }
  if (sub === 'connect') return edit({ op: 'connect', building: pos[1], level, a: pos[2], b: pos[3], ...(flag(args, '--kind') && { kind: flag(args, '--kind') }), ...(pointFlag(args, '--at', false) && { at: pointFlag(args, '--at') }), ...(num(args, '--width') !== undefined && { width: num(args, '--width') }) });
  if (sub === 'disconnect') return edit({ op: 'disconnect', building: pos[1], level, index: Number(pos[2]) });
  if (sub === 'door' || sub === 'window') return edit({ op: sub, building: pos[1], level, at: pointFlag(args, '--at'), ...(flag(args, '--kind') && { kind: flag(args, '--kind') }), ...(num(args, '--width') !== undefined && { width: num(args, '--width') }) });
  if (sub === 'fixture' || sub === 'prop') {
    const prop = sub === 'prop', act = prop ? pos[1] : pos[2], what = prop ? pos[2] : pos[3], size = sizeFlag(args, '--size');
    if (act === 'add') { const at = pointFlag(args, '--at')!; return edit({ op: prop ? 'prop.add' : 'fixture.add', ...(!prop && { building: pos[1], level }), kind: what, x: at[0], y: at[1], ...(size && { w: size[0], h: size[1] }), ...(num(args, '--angle') !== undefined && { angle: num(args, '--angle') }), ...(flag(args, '--label') && { label: flag(args, '--label') }) }); }
    if (act === 'rm') return edit({ op: prop ? 'prop.rm' : 'fixture.rm', ...(!prop && { building: pos[1], level }), index: Number(what) });
    throw new Error(prop ? 'settlement prop <id> add <kind> --at x,y | rm <i>' : 'settlement fixture <id> <bid> add <kind> --at x,y [--level n] | rm <i>');
  }
  if (sub === 'road' || sub === 'water' || sub === 'wall' || sub === 'area' || sub === 'tree') {
    const act = pos[1], what = pos[2];
    if (act === 'rm') return edit({ op: `${sub}.rm`, index: Number(what) });
    if (sub === 'wall' && act === 'gate') return edit({ op: 'wall.gate', index: Number(what), at: pointFlag(args, '--at'), kind: flag(args, '--kind') ?? 'gate', ...(num(args, '--width') !== undefined && { width: num(args, '--width') }), ...(args.includes('--drawbridge') && { drawbridge: true }) });
    if (sub === 'tree' && act === 'scatter') return edit({ op: 'tree.scatter', kind: what ?? 'tree', area: numbers(flag(args, '--area'), '--area'), count: num(args, '--count') ?? 10, ...(num(args, '--seed') !== undefined && { seed: num(args, '--seed') }) });
    if (act !== 'add') throw new Error(`settlement ${sub} <id> add <kind> … | rm <i>`);
    if (sub === 'tree') { const at = pointFlag(args, '--at')!; return edit({ op: 'tree.add', kind: what ?? 'tree', x: at[0], y: at[1], ...(num(args, '--size') !== undefined && { size: num(args, '--size') }) }); }
    const o: settlement.SettlementOp = { op: `${sub}.add`, kind: what, points: numbers(flag(args, '--points'), '--points') };
    if (num(args, '--width') !== undefined) o.width = num(args, '--width');
    if (flag(args, '--curve')) o.curve = flag(args, '--curve');
    if (flag(args, '--label')) o.label = flag(args, '--label');
    if (sub === 'wall') {
      if (args.includes('--closed')) o.closed = true;
      if (num(args, '--thickness') !== undefined) o.thickness = num(args, '--thickness');
      const tw = flag(args, '--towers');
      if (tw) o.towers = { shape: tw, ...(num(args, '--tower-size') !== undefined && { size: num(args, '--tower-size') }), ...(num(args, '--tower-every') !== undefined && { every: num(args, '--tower-every') }) };
    }
    return edit(o);
  }
  if (sub === 'label') { const at = pointFlag(args, '--at')!; return edit({ op: 'label', text: pos[1], x: at[0], y: at[1], kind: flag(args, '--kind') ?? 'name', ...(num(args, '--size') !== undefined && { size: num(args, '--size') }), ...(num(args, '--angle') !== undefined && { angle: num(args, '--angle') }), ...(flag(args, '--href') && { href: flag(args, '--href') }) }); }
  if (sub === 'symbol') { const at = pointFlag(args, '--at')!; return edit({ op: 'symbol', kind: pos[1], x: at[0], y: at[1], ...(num(args, '--scale') !== undefined && { scale: num(args, '--scale') }), ...(num(args, '--angle') !== undefined && { angle: num(args, '--angle') }) }); }
  if (sub === 'overlay') { if (pos[1] !== 'rm' || !['label', 'symbol'].includes(pos[2])) throw new Error('settlement overlay <id> rm label|symbol <i>'); return edit({ op: `${pos[2]}.rm`, index: Number(pos[3]) }); }
  if (sub === 'grid') {
    const m = updateSettlement(p, ref('<id>'), m => {
      const mode = pos[1];
      if (mode === 'none' || mode === 'off') m.grid.show = false;
      else if (mode !== undefined) { const v = Number(mode); if (!(v > 0)) throw new Error('grid: a size in the sheet\'s unit (10), or none'); m.grid = { ...m.grid, show: true, size: v / m.scale.perCell }; }
      const sub2 = onOff(flag(args, '--sub')); if (sub2 !== undefined) m.grid.sub = sub2;
    });
    print(`grid ${m.grid.show ? `every ${m.grid.size * m.scale.perCell} ${m.scale.unit}${m.grid.sub ? ', sub-grid' : ''}` : 'off'}\n${next(m.id)}`, m.grid);
    return 0;
  }
  if (sub === 'style') {
    const m = updateSettlement(p, ref('<id>'), m => {
      const t = flag(args, '--title'); if (t !== undefined) { if (t) m.title = t; else delete m.title; }
      const ground = flag(args, '--ground'); if (ground !== undefined) m.ground = ground as settlement.Ground;
      for (const [f, k] of [['--numbers', 'numbers'], ['--scale-bar', 'scaleBar'], ['--compass', 'compass'], ['--legend', 'legend']] as const) { const v = onOff(flag(args, f)); if (v !== undefined) m[k] = v; }
      if (num(args, '--per-cell') !== undefined) m.scale.perCell = num(args, '--per-cell')!;
      if (flag(args, '--unit')) m.scale.unit = flag(args, '--unit')!;
      if (num(args, '--plan-cell') !== undefined) m.interior.perCell = num(args, '--plan-cell')!;
      const place = flag(args, '--furniture'); if (place) m.furniture = { place: place as 'over', ...(flag(args, '--furniture-side') && { side: flag(args, '--furniture-side') as 'bottom' }) };
    });
    print(`${describeSettlement(m).split('\n').slice(0, 3).join('\n')}\n${next(m.id)}`, m);
    return 0;
  }
  if (sub === 'check') {
    const r = checkSettlementFile(p, ref('<id>'));
    print([`${r.file}: ${r.ok ? 'ok' : `${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`}${r.warnings.length ? `, ${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'}` : ''}`, ...r.errors.map(e => `  error: ${e.path || '(file)'}: ${e.message}`), ...r.warnings.map(w => `  warning: ${w.path}: ${w.message}`)].join('\n'), r);
    return r.ok ? 0 : 1;
  }
  if (sub === 'facts') { const f = settlement.settlementFacts(readSettlement(p, ref('<id>'))); print(describeSettlementFacts(f), f); return 0; }
  if (sub === 'render') {
    const format = flag(args, '--format') ?? 'both', theme = flag(args, '--theme') ?? 'color', view = flag(args, '--view'), modeB = flag(args, '--buildings');
    if (!['svg', 'png', 'both'].includes(format)) throw new Error('--format: svg, png or both');
    if (!['color', 'bw', 'both'].includes(theme)) throw new Error('--theme: color, bw or both');
    if (view !== undefined && !settlement.VIEWS.includes(view as settlement.SettlementView)) throw new Error('--view: site or plan');
    if (modeB !== undefined && !settlement.BUILDING_MODES.includes(modeB as settlement.BuildingMode)) throw new Error(`--buildings: ${settlement.BUILDING_MODES.join(', ')}`);
    const rs = await renderSettlementFiles(p, ref('<id>'), {
      formats: format === 'both' ? ['svg', 'png'] : [format as 'svg' | 'png'], themes: theme === 'both' ? ['color', 'bw'] : [theme as 'color' | 'bw'],
      ...(view && { view: view as settlement.SettlementView }), ...(flag(args, '--building') && { building: flag(args, '--building') }), ...(num(args, '--floor') !== undefined && { floor: num(args, '--floor') }),
      ...(modeB && { buildings: modeB as settlement.BuildingMode }), plans: args.includes('--plans'),
      ppu: num(args, '--ppu'), pageScale: pageScaleFlag(args), ...viewFlags(args, 1), layers: parseLayers(flag(args, '--layers'), [...new Set([...settlement.SITE_LAYERS, ...settlement.PLAN_LAYERS])]), out: flag(args, '--out'),
    });
    print(rs.map(r => [`${file ?? id} ${r.view === 'plan' ? `${r.building} level ${r.floor ?? 0}` : 'site'}: ${r.size.join('×')} px, ${Math.round(r.ppu * 100) / 100} px a cell`, ...r.files.map(f => `  ${f}`)].join('\n')).join('\n'), rs.length === 1 ? rs[0] : { renders: rs });
    return 0;
  }
  throw new Error('settlement: new | gen | building | interior | floor | room | connect | disconnect | door | window | fixture | prop | road | water | wall | area | tree | grid | style | label | symbol | overlay | check | facts | render | show | list | fixtures | symbols (artgen --help)');
}

/** `artgen formats [--json]`: the map, dungeon and settlement file format versions this artgen reads and writes. */
export function formatsCommand(emit: (human: string, data: unknown) => void): number {
  const formats = { map: map.MAP_FORMAT, dungeon: dungeon.DUNGEON_FORMAT, settlement: settlement.SETTLEMENT_FORMAT };
  emit(Object.entries(formats).map(([k, v]) => `${k} ${v}`).join('\n'), formats);
  return 0;
}

/** Entry point of the maps-only bundle (`artgen-maps.js`): `map`, `dungeon`, `settlement` and `formats`, nothing else. */
export async function mapsMain(argv: string[]): Promise<number> {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a): a is string => a !== undefined);
  const json = args.includes('--json'), print = (human: string, data: unknown) => console.log(json ? JSON.stringify(data, null, 2) : human);
  if (cmd === '--version' || cmd === 'version') { console.log(MAPS_VERSION); return 0; }
  if (!cmd || cmd === '--help' || cmd === 'help') { console.log(`artgen-maps ${MAPS_VERSION} — the artgen map, dungeon and settlement engines, usable alone.\n\nusage:\n${MAP_USAGE}\n       artgen-maps.js --version | --help`); return 0; }
  if (cmd === 'formats') return formatsCommand(print);
  if (cmd === 'map') return mapCommand(sub, args, print);
  if (cmd === 'dungeon') return dungeonCommand(sub, args, print);
  if (cmd === 'settlement') return settlementCommand(sub, args, print);
  throw new Error(`artgen-maps: ${cmd}: not a command here; this bundle has map, dungeon, settlement and formats (--help)`);
}

/** `artgen-maps.js --version`: the release and the commit it was built from. */
export const MAPS_VERSION = `${typeof __ARTGEN_VERSION__ === 'string' ? __ARTGEN_VERSION__ : 'dev'} (${typeof __ARTGEN_SHA__ === 'string' ? __ARTGEN_SHA__ : 'unknown'})`;
