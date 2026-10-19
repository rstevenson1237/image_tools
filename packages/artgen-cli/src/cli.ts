/**
 * artgen CLI (entry point: `bin.ts`). Every command takes --json for machine-readable output.
 *
 * Project (W1, PLAN P2) — run inside a game repo:
 *   artgen init                                     scaffold art/ (direction, briefs, ledger, config)
 *   artgen direction candidates --pitch "…" [--view topdown|iso] [--mood a,b] [--scale small|medium|large]
 *                               [--directions 8] [--colors <file.hex|.gpl|image.png|#hex,…>] [--from art/interview.json]
 *   artgen direction tile [a b c …]                 style tile: the probe set under each candidate, one sheet
 *   artgen direction mix <base> --palette a --line b [--shading c] [--scale c] [--name m]
 *   artgen direction lock <candidate> [--note "…"] [--id name]   lock + anchors + art/direction.png
 *   artgen direction anchors                        re-save anchors from the probes (after their full pipeline)
 *   artgen direction new [--from <candidate>]       start a draft from the locked direction (version change)
 *   artgen direction show | validate <file>
 *   artgen palette import <file.hex|.gpl> | extract <image.png> [--n 16] | ramp <#hex> [--steps 4] [--hue-shift 12]
 *                  (import/extract add --interview to feed the colours into candidate A)
 *   artgen new <id> --kind character|prop|tile|effect|… [--view v] [--size key|WxH] [--states a,b] [--dir path]
 *   artgen finish <assetDir> [--base base.vN]       write the next finish.vM.js from the template
 *
 * Pipeline (asset directories):
 *   artgen pass status|next <assetDir>             pipeline state (v1 → v2 → v3 → finish → ready)
 *   artgen render <assetDir> [--version v] [--variant n] [--stages]
 *   artgen review <assetDir> [--version v] [--blind] [--detail low|full] [--scene]
 *                                                   review sheet: reference, best, v(n−1), v(n); --blind: the version alone;
 *                                                   --detail low: first facing at 3×; --scene: on a floor, beside a wall
 *   artgen score <assetDir> <version> <0-10> [--note "…"] [--reviewer name] [--blind] [--agent-tokens-in n]
 *   artgen variants <assetDir> [--version v] [--n 8]
 *   artgen report <dir> [--out REPORT.md] [--title "…"]
 * Asset commands take --direction <file|bench name> and --ledger <file> overrides.
 *
 * Production (W2, PLAN P3) — briefs in art/briefs.yaml; asset args take a brief id or a directory:
 *   artgen brief add <id> --kind k [--view v] [--size key|WxH] [--states a,b] [--directions 8] [--anims walk:4,attack:3]
 *                    [--variants n] [--swaps red:cloth=accent] [--importance hero|standard|filler] [--priority n] [--notes "…"]
 *                    [--height m] [--body quadruped|serpent|flyer|large]   (warns about materials its kind can't colour)
 *   artgen brief list | rm <id> | lint [ids]
 *   artgen make [ids|all] [--parallel n] [--wave n] one tick of the autonomous run: scaffold, mark finals, hold v2 for the v1
 *                                                   roster, name the next step; --parallel: a round of up to n maker packets (one
 *                                                   subagent per asset) + main steps; --wave: n assets in flight at once
 *   artgen status [ids]                             brief → in-pipeline → final → approved → exported (+ revision, stale)
 *   artgen gallery [ids]                            sheet of finished assets for the user (score, open issues, BELOW BAR)
 *   artgen feedback <id> --route base|finish --note "…" [--region x,y,w,h] [--cell state/facing/frame] [--by roster]
 *   artgen approve <id> [--note "…"]                user approval (R6: passing gate + review sheet)
 *   artgen roster [ids] [--seed n] [--stage v1] | roster record <review.json> [--reviewer name]   (pages past 26 assets)
       artgen export [--pack name] [--include-drafts] [--runtime [--force]] [--break-contract id,…|*]
 *                                                   atlases + pack.json + Aseprite JSON + assets.ts; --runtime vendors the W3
 *                                                   runtime + adapters (artgen.config.json `runtime.adapters`) into runtimeDir
 *   artgen restyle [--from N]                       re-render finished assets under the new direction + diff sheet
 *   artgen import-edit <id> <edited.png> [--cell state/facing/frame]   hand edit → next finish.vM.js
 *   artgen analytics [--out file.md]                per-pass gains, cost per asset, budget suggestions
 *   artgen analytics --across <root>,<root>… [--apply] [--min-assets 3] [--out file.md]
 *                                                   v2 (P7): budget + model/effort recommendations pooled across projects;
 *                                                   --apply merges the config patch into this project's artgen.config.json
 *
 * Breadth (PLAN P6):
 *   artgen voxel <asset> [--version v] [--cell s/f/n] [--out dir] [--scale m]   3D-mode model → .vox + greedy-meshed .glb
 *   artgen texture <material> [--size 32] [--seed n] [--ramps base=stone] | --list   material recipe → png + normal map + 3×3
 *   artgen anim <asset> [--version v] [--state s] [--facing f] [--scale n]          GIF + APNG previews per state (P6c)
 *   artgen fx <preset> [--size 32] [--frames 8] [--seed n] | --list                particle preset quick look (P6c)
 *
 * Terrain maps (TTRPG; art/maps/<id>/map.json, see map.ts):
 *   artgen map new|gen|edit|grid|label|symbol|overlay|set|render|show|list|symbols
 *
 * Dungeon maps (TTRPG; art/dungeons/<id>/dungeon.json, see dungeon.ts):
 *   artgen dungeon new|gen|room|link|unlink|door|grid|style|label|symbol|overlay|fit|render|show|list|symbols
 *
 * File formats: artgen formats [--json]   the map and dungeon file format versions this artgen reads and writes
 *
 * Benchmark (this repo): artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--update-golden]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dungeon, extractPalette, generateRamp, Grid, map, MATERIALS, PRESET_NAMES, MIX_PARTS, parseDirection, parseGpl, parseHexPalette, rampsFromColors, validateDirection, type Interview, type MixPart, type Size } from 'artgen-core';
import { openAsset, passState, renderVersion, reviewVersion, scoreVersion, variantsSheet, versionsIn, writeRender } from './asset.ts';
import { resolveDirection, updateGolden, writeBench } from './bench.ts';
import { readGrid, writeGrid } from './node.ts';
import { findProject, initProject, readJson, requireProject, writeJson } from './project.ts';
import { animPreview, fxRun, textureRun, voxelExport } from './p6.ts';
import { report } from './report.ts';
import { cornerPoint, corridorEnd, createDungeon, describeDungeon, doorPair, gridMode, listDungeons, readDungeon, renderDungeonFiles, updateDungeon } from './dungeon.ts';
import { createMap, describeMap, listMaps, numbers, onOff, parseLayers, readMap, renderMapFiles, shapeFrom, updateMap } from './map.ts';
import { newAsset } from './templates.ts';
import { addBrief, approve, briefWarnings, exportPacks, feedback, gallery, importEdit, make, pooledAnalytics, projectAnalytics, projectStatus, readBriefs, removeBriefFile, resolveAssetArg, restyle, rosterRecord, rosterRun, writeNextFinish, type WorkPacket } from './w2.ts';
import { IMPORTANCE, type BriefEntry, type Importance } from 'artgen-core';
import { lockedDirection, lock, readInterview, show, writeAnchors, writeCandidates, writeDraft, writeMix, writeTile } from './w1.ts';

declare const __ARTGEN_VERSION__: string | undefined;
/** Set by the artgen-dist build; `dev` when run from this repo. */
export const VERSION = typeof __ARTGEN_VERSION__ === 'string' ? __ARTGEN_VERSION__ : 'dev';

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Comma-separated values of a flag (`--states idle,walk`). */
function list(args: string[], name: string): string[] | undefined {
  const v = flag(args, name);
  return v === undefined ? undefined : v.split(',').map(s => s.trim()).filter(Boolean);
}

/** Colours from a `.hex`/`.gpl` file, a PNG (median cut) or a comma list of hexes. */
function readColors(src: string, n = 16): string[] {
  if (/^#?[0-9a-f]{6}(,#?[0-9a-f]{6})*$/i.test(src)) return src.split(',').map(c => '#' + c.replace('#', '').toLowerCase());
  if (!existsSync(src)) throw new Error(`${src}: not found`);
  if (src.endsWith('.png')) return extractPalette(readGrid(src), n).colors;
  const text = readFileSync(src, 'utf8');
  return src.endsWith('.gpl') ? parseGpl(text) : parseHexPalette(text);
}

const parseSize = (s?: string): string | Size | undefined => {
  const m = s?.match(/^(\d+)x(\d+)$/);
  return m ? [+m[1], +m[2]] : s;
};

const USAGE = `artgen — code-generated pixel art for games, driven by a locked art direction (art/direction.json).
Lock a direction, write briefs, let the pipeline make and review each asset, approve, then export packs and the
runtime your game loads them with. In Claude Code, start with /artgen-direction; the skills drive these commands.

usage: artgen init
       artgen direction candidates --pitch "..." [--view topdown|iso] [--mood a,b] [--scale small|medium|large] [--colors src] [--from interview.json]
       artgen direction tile [names...] | mix <base> --palette a --line b ... | lock <name> [--note "..."] | anchors | new [--from c] | show | validate <file>
       artgen palette import <file> | extract <image.png> [--n 16] | ramp <#hex> [--steps 4] [--hue-shift 12] [--contrast 0.45]   (--interview: feed candidate A)
       artgen new <id> --kind <kind> [--view v] [--size key|WxH] [--states a,b] [--dir path]
       artgen finish <assetDir> [--base base.vN]
       artgen pass status|next <assetDir>
       artgen render <assetDir> [--version base.vN|finish.vM] [--variant n] [--stages]
       artgen review <assetDir> [--version v] [--blind] [--detail low|full] [--scene]
       artgen score <assetDir> <version> <score> [--note "..."] [--reviewer name] [--blind] [--agent-tokens-in n]
       artgen variants <assetDir> [--version v] [--n 8]
       artgen report <dir> [--out REPORT.md] [--title "..."]
       artgen brief add <id> --kind k [--view v] [--size key|WxH] [--states a,b] [--directions n] [--anims walk:4] [--durations attack=80/80/200/80] [--variants n] [--swaps red:cloth=accent] [--importance t] [--priority n] [--height metres] [--body quadruped|serpent|flyer|large] [--object "ice lance"] [--notes "..."] [--break-contract]
       artgen brief list | rm <id> | lint [ids]
       artgen make [ids|all] [--parallel n] [--wave n] | status [ids] | gallery [ids]
       artgen roster [ids] [--seed n] [--stage v1] | roster record <review.json> [--reviewer name]
       artgen feedback <id> --route base|finish --note "..." [--region x,y,w,h] [--cell s/f/n] [--by roster] | approve <id> [--note "..."]
       artgen export [--pack name] [--include-drafts] [--runtime [--force]] [--break-contract id,…|*] | restyle [--from N] | import-edit <id> <png> [--cell s/f/n]
       artgen analytics [--out file.md] | analytics --across <root>,<root>… [--apply] [--min-assets n] [--out file.md]
       artgen voxel <asset> [--version v] [--cell s/f/n] [--out dir] [--scale m]
       artgen texture <material> [--size 32|WxH] [--seed n] [--ramps base=stone,…] [--scale k] [--out dir] | texture --list
       artgen anim <asset> [--version v] [--state s] [--facing f] [--scale n] [--out dir]
       artgen fx <preset> [--size 32|WxH] [--frames 8] [--seed n] [--scale n] [--out dir] | fx --list
       artgen map new <id> [--preset regional|local] [--size 30x22] [--grid hex|square|none] [--seed n] [--title "..."]
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
       artgen dungeon render <id> [--format svg|png|both] [--ppu 40] [--layers grid=off,labels=off] [--out dir] | show <id> | list
       artgen formats   (the map and dungeon file format versions this artgen reads; a newer file is refused)
       artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--ledger <file>] [--update-golden]
       artgen --version | --help

Commands take --json (machine-readable output) and --root <game repo>; asset commands also take
--direction <file|benchmark|alt> and --ledger <file>.`;

/** The project's direction for the standalone generators (texture, fx): a clear error until one is locked. */
function toolDirection(cmd: string, root: string | undefined, override: string | undefined) {
  const p = findProject(root), file = override ?? (p ? join(p.art, 'direction.json') : undefined);
  const fix = 'lock one first (artgen direction candidates → tile → lock, or /artgen-direction in Claude Code), or pass --direction <file|benchmark>';
  if (override && !existsSync(override) && ['benchmark', 'alt'].includes(override)) return { p, dir: resolveDirection(override) };
  if (override && !existsSync(override)) throw new Error(`${cmd}: --direction ${override}: no such file (or bench direction: benchmark, alt)`);
  if (!file || !existsSync(file)) throw new Error(`${cmd}: no art direction found — ${fix}`);
  const raw = JSON.parse(readFileSync(file, 'utf8')), v = validateDirection(raw);
  if (!v.ok) throw new Error(raw?.status === 'draft' && !override ? `${cmd}: the art direction is still a draft — ${fix}` : `${cmd}: ${file} is not a valid direction:\n  ${v.errors.join('\n  ')}`);
  return { p, dir: parseDirection(raw) };
}

const num = (args: string[], name: string): number | undefined => { const v = flag(args, name); if (v === undefined) return undefined; if (!Number.isFinite(+v)) throw new Error(`${name}: a number`); return +v; };

/** A `--json` result of a map or dungeon command with the `version` of the format it reports on (a list becomes `{ version, items }`). */
const withVersion = (data: unknown, version: number): unknown =>
  data && typeof data === 'object' && !Array.isArray(data) ? { version, ...data } : { version, items: data };

/** `artgen map …` (terrain maps, map.ts). */
async function mapCommand(sub: string | undefined, args: string[], emit: (human: string, data: unknown) => void): Promise<number> {
  const print = (human: string, data: unknown) => emit(human, withVersion(data, map.MAP_FORMAT));
  const p = requireProject(flag(args, '--root'));
  const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--json')).slice(1), id = pos[0];
  const need = (what: string) => { if (!id) throw new Error(`map ${sub}: ${what}`); return id; };
  const next = (i: string) => `next: artgen map render ${i}`;
  if (sub === 'list') { const ms = listMaps(p); print(ms.length ? ms.map(m => `${m.id.padEnd(16)} ${m.preset.padEnd(9)} ${m.size.padEnd(7)} ${m.edits} edits, ${m.labels} labels, ${m.symbols} symbols${m.title ? `  "${m.title}"` : ''}`).join('\n') : 'no maps yet: artgen map new <id>', ms); return 0; }
  if (sub === 'symbols') { print(Object.entries(map.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join('\n'), map.SYMBOL_KINDS); return 0; }
  if (sub === 'show') { const m = readMap(p, need('<id>')); print(describeMap(m), m); return 0; }
  if (sub === 'new') {
    const preset = (flag(args, '--preset') ?? 'regional') as map.Preset;
    if (!map.PRESETS.includes(preset)) throw new Error(`--preset: ${map.PRESETS.join(' or ')}`);
    const sz = flag(args, '--size')?.match(/^(\d+)x(\d+)$/), grid = flag(args, '--grid') as map.GridType | undefined;
    if (flag(args, '--size') && !sz) throw new Error('--size: COLSxROWS, e.g. 30x22');
    const r = createMap(p, need('<id> is required'), preset, {
      seed: num(args, '--seed') ?? Math.floor(Math.random() * 1e6), ...(sz && { cols: +sz[1], rows: +sz[2] }), ...(flag(args, '--title') && { title: flag(args, '--title') }),
      ...(grid && { grid: { ...map.PRESET_DEFAULTS[preset].grid, type: grid } }),
    }, args.includes('--force'));
    print(`${r.file}\n${describeMap(r.map)}\n${next(id)}`, { file: r.file, map: r.map });
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
    print([`${id} ${r.size.join('×')} px: ${r.terrains.join(', ')}${r.rivers ? `, ${r.rivers} rivers` : ''}`, ...r.files.map(f => `  ${f}`)].join('\n'), r);
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
async function dungeonCommand(sub: string | undefined, args: string[], emit: (human: string, data: unknown) => void): Promise<number> {
  const print = (human: string, data: unknown) => emit(human, withVersion(data, dungeon.DUNGEON_FORMAT));
  const p = requireProject(flag(args, '--root'));
  const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--json')).slice(1), id = pos[0];
  const need = (what: string) => { if (!id) throw new Error(`dungeon ${sub}: ${what}`); return id; };
  const next = (i: string) => `next: artgen dungeon render ${i}`;
  if (sub === 'list') { const ds = listDungeons(p); print(ds.length ? ds.map(d => `${d.id.padEnd(16)} ${d.size.padEnd(7)} ${d.rooms} rooms, ${d.corridors} corridors, ${d.labels} labels, ${d.symbols} symbols${d.title ? `  "${d.title}"` : ''}`).join('\n') : 'no dungeons yet: artgen dungeon new <id>', ds); return 0; }
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
    const base = dungeon.newDungeon(need('<id> is required'), { seed: Math.floor(Math.random() * 1e6), ...(flag(args, '--title') && { title: flag(args, '--title') }) });
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
    const r = createDungeon(p, m, args.includes('--force'));
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
    print([`${id} ${r.size.join('×')} px: ${r.rooms} rooms, ${r.corridors} corridors, ${r.doors} doors`, ...r.files.map(f => `  ${f}`)].join('\n'), r);
    return 0;
  }
  throw new Error('dungeon: new | gen | room | link | unlink | door | grid | style | label | symbol | symbols | overlay | fit | render | show | list (artgen --help)');
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a): a is string => a !== undefined);
  const json = args.includes('--json'), print = (human: string, data: unknown) => console.log(json ? JSON.stringify(data, null, 2) : human);
  const asset = (p: string) => openAsset(resolveAssetArg(findProject(flag(args, '--root')), p), { direction: flag(args, '--direction'), ledger: flag(args, '--ledger') });
  const latest = (p: string) => { const vs = versionsIn(asset(p)); if (!vs.length) throw new Error(`${p}: no base.vN.js yet`); return vs[vs.length - 1]; };

  if (cmd === 'bench') {
    if (args.includes('--update-golden')) { console.log(JSON.stringify(await updateGolden(), null, 2)); return 0; }
    const dir = resolveDirection(flag(args, '--direction') ?? 'benchmark');
    const results = await writeBench(dir, flag(args, '--out') ?? 'artgen-out', { stages: args.includes('--stages'), ledger: flag(args, '--ledger') });
    return results.every(r => r.report.pass) ? 0 : 1;
  }
  if (cmd === '--version' || cmd === 'version') { console.log(VERSION); return 0; }
  if (cmd === 'init') {
    const root = flag(args, '--root') ?? process.cwd(), r = initProject(root);
    print(r.created.length ? `artgen project in ${root}/art\n  ${r.created.map(f => f.slice(root.length + 1)).join('\n  ')}` : `artgen project in ${root}/art (already initialised)`, { root, created: r.created });
    return 0;
  }
  if (cmd === 'direction' && sub === 'validate' && rest[0]) {
    const r = validateDirection(JSON.parse(readFileSync(rest[0], 'utf8')));
    console.log(r.ok ? `ok: ${r.direction!.id} v${r.direction!.version}` : r.errors.join('\n'));
    return r.ok ? 0 : 1;
  }
  if (cmd === 'direction') {
    const p = requireProject(flag(args, '--root')), pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && rest[i - 1] !== '--json'));
    if (sub === 'candidates') {
      const from = flag(args, '--from'), base: Partial<Interview> = from ? readInterview(from) : existsSync(join(p.art, 'interview.json')) ? readJson<Interview>(join(p.art, 'interview.json')) : {};
      const iv: Interview = {
        ...base, pitch: flag(args, '--pitch') ?? base.pitch ?? '', ...(flag(args, '--view') && { view: flag(args, '--view') as Interview['view'] }),
        ...(list(args, '--mood') && { mood: list(args, '--mood') }), ...(flag(args, '--scale') && { scale: flag(args, '--scale') as Interview['scale'] }),
        ...(flag(args, '--directions') && { directions: +flag(args, '--directions')! as Interview['directions'] }), ...(flag(args, '--id') && { id: flag(args, '--id') }),
        ...(flag(args, '--colors') && { colors: readColors(flag(args, '--colors')!) }), ...(flag(args, '--background') && { background: flag(args, '--background') }),
      };
      if (!iv.pitch) throw new Error('direction candidates: --pitch "<one-paragraph game pitch>" (or --from interview.json) is required');
      const r = writeCandidates(p, iv);
      print([`interview ${r.interview}`, ...r.candidates.map(c => `${c.name.toUpperCase()} ${c.file}\n    ${c.summary.join('\n    ')}`), ...(r.probes.length ? [`probes:\n  ${r.probes.join('\n  ')}`] : []), ...r.fallbacks.map(f => `note: ${f}`), 'next: artgen direction tile'].join('\n'), r);
      return 0;
    }
    if (sub === 'tile') {
      const r = await writeTile(p, pos);
      print([`style tile ${r.path} (round ${r.round}, ~${r.tokens} image tokens)`, ...r.columns.map(c => `  ${c.name} ${c.id}: ${Object.entries(c.gates).map(([k, v]) => `${k} ${v ? 'ok' : 'FAIL'}`).join(', ')}${c.failing.length ? `\n    ${c.failing.join('\n    ')}` : ''}`), `  distinct designs: ${r.distinct.pairs}/${r.columns.length}, min palette luma gap ${r.distinct.minLumaGap}`].join('\n'), r);
      return r.columns.every(c => Object.values(c.gates).every(Boolean)) ? 0 : 1;
    }
    if (sub === 'mix' && pos[0]) {
      const take: Partial<Record<MixPart, string>> = {};
      for (const part of MIX_PARTS) { const v = flag(args, `--${part}`); if (v) take[part] = v; }
      const r = writeMix(p, pos[0], take, flag(args, '--name'));
      print(`${r.name} ${r.file}: ${r.dir.theme.notes}\nnext: artgen direction tile ${r.name}`, { name: r.name, file: r.file });
      return 0;
    }
    if (sub === 'lock' && pos[0]) {
      const r = await lock(p, pos[0], { id: flag(args, '--id'), note: flag(args, '--note') });
      print([`locked ${r.direction.id} v${r.direction.version} -> ${r.file}`, `anchors: ${r.anchors.join(', ')}`, `style sheet: ${r.sheet}`, ...Object.entries(r.gates).filter(([, ok]) => !ok).map(([k]) => `  gate FAIL on probe ${k}`)].join('\n'), { direction: { id: r.direction.id, version: r.direction.version }, file: r.file, anchors: r.anchors, sheet: r.sheet, versions: r.versions, gates: r.gates });
      return 0;
    }
    if (sub === 'anchors') {
      const r = await writeAnchors(p);
      print(`anchors: ${r.anchors.join(', ')} (${Object.entries(r.versions).map(([k, v]) => `${k} ${v}`).join(', ')})\nstyle sheet: ${r.sheet}`, r);
      return 0;
    }
    if (sub === 'new') {
      const r = writeDraft(p, flag(args, '--from'), flag(args, '--name'));
      print(`draft ${r.file} — edit it, then: artgen direction tile ${r.name} && artgen direction lock ${r.name}`, r);
      return 0;
    }
    if (sub === 'show') {
      const r = show(p);
      print([
        r.locked ? `locked: ${r.locked.id} v${r.locked.version} (${r.locked.camera.view}, ${r.locked.anchors.length} anchors)` : 'locked: none yet',
        ...r.candidates.map(c => `candidate ${c.name}: ${c.id} [${c.status}]\n    ${c.summary.join('\n    ')}`),
        ...(r.tiles.length ? [`style tiles: ${r.tiles.join(', ')}`] : []),
        ...Object.entries(r.probes).map(([k, v]) => `probe ${k}: ${v || '(empty)'}`),
      ].join('\n'), { locked: r.locked && { id: r.locked.id, version: r.locked.version, anchors: r.locked.anchors }, candidates: r.candidates, tiles: r.tiles, probes: r.probes });
      return 0;
    }
  }
  if (cmd === 'palette' && sub && rest[0]) {
    if (sub === 'ramp') {
      const ramp = generateRamp(rest[0], { steps: +(flag(args, '--steps') ?? 4), hueShift: +(flag(args, '--hue-shift') ?? 12), contrast: +(flag(args, '--contrast') ?? 0.45) });
      print(ramp.join(' '), { ramp });
      return 0;
    }
    if (sub === 'import' || sub === 'extract') {
      const colors = readColors(rest[0], +(flag(args, '--n') ?? 16)), ramps = rampsFromColors(colors);
      if (args.includes('--interview')) {
        const p = requireProject(flag(args, '--root')), f = join(p.art, 'interview.json');
        const iv = existsSync(f) ? readJson<Interview>(f) : ({ pitch: '' } as Interview);
        writeJson(f, { ...iv, colors });
      }
      if (flag(args, '--swatch')) {
        const g = new Grid(colors.length * 8, 8);
        colors.forEach((c, i) => g.fill(i * 8, 0, 8, 8, c));
        writeGrid(flag(args, '--swatch')!, g);
      }
      print(`${colors.length} colours: ${colors.join(' ')}\n${Object.entries(ramps).map(([k, r]) => `  ${k}: ${r.join(' ')}`).join('\n')}${args.includes('--interview') ? '\nadded to art/interview.json (candidate A builds its ramps from them)' : ''}`, { colors, ramps });
      return 0;
    }
  }
  if (cmd === 'new' && sub) {
    const kind = flag(args, '--kind');
    if (!kind) throw new Error('new: --kind is required (character, creature, prop, tile, effect, …)');
    const p = findProject(flag(args, '--root')), view = flag(args, '--view') ?? (p && (() => { try { return readJson<{ camera?: { view?: string } }>(join(p.art, 'direction.json')).camera?.view; } catch { return undefined; } })()) ?? 'topdown';
    const path = flag(args, '--dir') ?? (p ? join(p.art, 'assets', kind, sub) : sub);
    const r = newAsset(path, { id: sub, kind, view, size: parseSize(flag(args, '--size')), states: list(args, '--states'), directions: flag(args, '--directions') ? +flag(args, '--directions')! : undefined, notes: flag(args, '--notes') });
    print(`${sub}: ${r.files.join(', ')} (template ${r.template.view}/${r.template.kind}${r.template.fallback ? ', fallback' : ''})\nnext: edit base.v1.js for the brief, then artgen review ${path}`, { files: r.files, template: r.template });
    return 0;
  }
  if (cmd === 'finish' && sub) {
    const r = await writeNextFinish(resolveAssetArg(findProject(flag(args, '--root')), sub), { base: flag(args, '--base'), direction: flag(args, '--direction'), ledger: flag(args, '--ledger') });
    print(`${r.file} (bound to ${r.base})`, r);
    return 0;
  }
  if (cmd === 'pass' && (sub === 'status' || sub === 'next') && rest[0]) {
    const st = await passState(asset(rest[0]));
    if (sub === 'next') { print(`${st.next.action} ${'version' in st.next ? st.next.version : ''} — ${st.next.why}`, st.next); return 0; }
    const lines = st.rows.map(r => `  ${r.pass.padEnd(4)} ${r.version.padEnd(10)} ${r.score === undefined ? 'unscored' : `score ${r.score}`}${r.gate === undefined ? '' : r.gate ? ' gate pass' : ' gate FAIL'}${r.base ? ` (on ${r.base})` : ''}`);
    print([`${st.asset}${st.best ? ` — best base ${st.best.version} (${st.best.score})` : ''}`, ...lines, ...(st.stale?.length ? ['  FINISH-STALE:', ...st.stale.map(s => `    ${s}`)] : []), `next: ${st.next.action} ${'version' in st.next ? st.next.version : ''} — ${st.next.why}`].join('\n'), st);
    return 0;
  }
  if (cmd === 'render' && sub) {
    const a = asset(sub), version = flag(args, '--version') ?? latest(sub), stages = args.includes('--stages') ? new Map<string, Grid>() : undefined;
    const variant = +(flag(args, '--variant') ?? 0);
    const r = await renderVersion(a, version, { variant, stages });
    const files = writeRender(a, r, variant ? join(a.path, 'out', `variant-${variant}`) : undefined);
    if (stages) for (const [k, g] of stages) writeGrid(join(a.path, 'out', 'stages', version, `${k.replace(/\//g, '_')}.png`), g);
    print(`${a.brief.id} ${version}: ${r.report.pass ? 'gate pass' : 'gate FAIL'}  ${r.report.checks.map(c => `${c.id}:${c.status}`).join(' ')}\n  ${files.join('\n  ')}${r.stale?.length ? `\n  FINISH-STALE: ${r.stale.join('; ')}` : ''}`,
      { version, pass: r.report.pass, checks: r.report.checks, metrics: r.report.metrics, files, stale: r.stale });
    return r.report.pass ? 0 : 1;
  }
  if (cmd === 'review' && sub) {
    const detail = flag(args, '--detail');
    if (detail !== undefined && detail !== 'low' && detail !== 'full') throw new Error('review --detail low (first facing at 3×, previous version only) | full (every facing, the best so far)');
    const a = asset(sub), version = flag(args, '--version') ?? latest(sub), r = await reviewVersion(a, version, { blind: args.includes('--blind'), detail, scene: args.includes('--scene') });
    print(`review sheet ${r.path} (~${r.tokens} image tokens); gate ${r.render.report.pass ? 'pass' : 'FAIL'}`, { sheet: r.path, tokens: r.tokens, pass: r.render.report.pass, checks: r.render.report.checks });
    return 0;
  }
  if (cmd === 'score' && sub && rest[0] && rest[1]) {
    const score = +rest[1];
    if (!(score >= 0 && score <= 10)) throw new Error('score must be 0–10');
    // measured analytics override the config mapping and the estimates (D19): --model --effort --tokens-in --tokens-out --ms
    const ex: Record<string, unknown> = {};
    if (flag(args, '--model')) ex.model = flag(args, '--model');
    if (flag(args, '--effort')) ex.effort = flag(args, '--effort');
    if (flag(args, '--ms')) ex.wallMs = +flag(args, '--ms')!;
    // who scored (rev 9): the reviewer subagent passes its name; anything else is the authoring agent scoring itself
    ex.reviewer = flag(args, '--reviewer') ?? 'self';
    if (args.includes('--blind')) {
      if (ex.reviewer === 'self') throw new Error('score --blind needs --reviewer <name>: a blind re-score comes from a fresh reviewer that saw only the blind sheet, never from the agent that made the asset');
      ex.blind = true;
    }
    const a0 = asset(sub);
    if (flag(args, '--tokens-in') || flag(args, '--tokens-out')) ex.measured = { in: +(flag(args, '--tokens-in') ?? 0), out: +(flag(args, '--tokens-out') ?? 0) };
    // the context the maker or reviewer agent read for this pass (skills, direction, rigs): what the orchestration costs
    if (flag(args, '--agent-tokens-in')) {
      const n = +flag(args, '--agent-tokens-in')!;
      if (!(n >= 0)) throw new Error('score --agent-tokens-in <n>: the total input tokens the agent read for this pass');
      ex.measured = { ...(ex.measured as object | undefined), agentIn: n };
    }
    const e = await scoreVersion(a0, rest[0], score, flag(args, '--note') ?? '', ex);
    print(`scored ${e.asset} ${e.version} (${e.pass}${e.blind ? ', blind' : ''}, by ${e.reviewer}) ${score}; gate ${e.conformance?.pass ? 'pass' : 'FAIL'}${typeof e.gap === 'number' ? `; ${e.gap} under its own score` : ''}`, e);
    return 0;
  }
  if (cmd === 'variants' && sub) {
    const r = await variantsSheet(asset(sub), flag(args, '--version') ?? latest(sub), +(flag(args, '--n') ?? 8));
    print(`${r.path}: ${r.distinct} distinct of ${r.hashes.length}`, r);
    return 0;
  }
  if (cmd === 'report' && sub) {
    const r = await report(sub, { out: flag(args, '--out'), title: flag(args, '--title') });
    if (!flag(args, '--out')) console.log(r.markdown);
    return r.summaries.every(s => s.met) ? 0 : 1;
  }
  // ---- P6 breadth ----
  if (cmd === 'voxel' && sub) {
    const r = await voxelExport(asset(sub), { version: flag(args, '--version'), cell: flag(args, '--cell'), out: flag(args, '--out'), scale: flag(args, '--scale') ? +flag(args, '--scale')! : undefined });
    print(`${r.cell}: ${r.voxels} voxels, ${r.materials} materials, ${r.size.join('x')}\n  ${r.vox}\n  ${r.glb}`, r);
    return 0;
  }
  if (cmd === 'formats') {
    const formats = { map: map.MAP_FORMAT, dungeon: dungeon.DUNGEON_FORMAT };
    print(Object.entries(formats).map(([k, v]) => `${k} ${v}`).join('\n'), formats);
    return 0;
  }
  if (cmd === 'map') return mapCommand(sub, args, print);
  if (cmd === 'dungeon') return dungeonCommand(sub, args, print);
  if (cmd === 'texture') {
    if (sub === '--list' || args.includes('--list')) { print(MATERIALS.join('\n'), MATERIALS); return 0; }
    if (!sub) throw new Error('texture: name a material (artgen texture --list)');
    const { p, dir } = toolDirection('texture', flag(args, '--root'), flag(args, '--direction'));
    const sz = parseSize(flag(args, '--size') ?? '32'), size: Size = Array.isArray(sz) ? sz : [+sz!, +sz!];
    const ramps = list(args, '--ramps')?.reduce((m, x) => { const [k, v] = x.split('='); m[k] = v; return m; }, {} as Record<string, string>);
    const r = textureRun(dir, sub, { size, seed: flag(args, '--seed') ? +flag(args, '--seed')! : undefined, ramps, scale: flag(args, '--scale') ? +flag(args, '--scale')! : undefined, out: flag(args, '--out') ?? (p ? join(p.art, 'sheets', 'textures') : 'artgen-out') });
    print([`${sub} ${size.join('x')} (ramps ${Object.entries(r.ramps).map(([k, v]) => `${k}=${v}`).join(', ')})`, ...r.files.map(f => `  ${f}`),
      `seam ${r.seam.ratio}× the interior · repetition: ${r.issues.length ? r.issues.join('; ') : `clear (lowStd ${r.repetition.lowStd}, ${r.repetition.markBlobs} marks)`}`].join('\n'), r);
    return 0;
  }
  if (cmd === 'anim' && sub) {
    const r = await animPreview(asset(sub), { version: flag(args, '--version'), state: flag(args, '--state'), facing: flag(args, '--facing'), scale: flag(args, '--scale') ? +flag(args, '--scale')! : undefined, out: flag(args, '--out') });
    print([...r.states.map(s => `${s.state}/${s.facing}: ${s.frames} frames, ${s.ms} ms`), ...r.files.map(f => `  ${f}`)].join('\n'), r);
    return 0;
  }
  if (cmd === 'fx') {
    if (sub === '--list' || args.includes('--list')) { print(PRESET_NAMES.join('\n'), PRESET_NAMES); return 0; }
    if (!sub) throw new Error('fx: name a preset (artgen fx --list)');
    const { p, dir } = toolDirection('fx', flag(args, '--root'), flag(args, '--direction'));
    const sz = parseSize(flag(args, '--size') ?? '32'), size: Size = Array.isArray(sz) ? sz : [+sz!, +sz!];
    const r = fxRun(dir, sub, { size, frames: +(flag(args, '--frames') ?? 8), seed: flag(args, '--seed') ? +flag(args, '--seed')! : undefined, scale: flag(args, '--scale') ? +flag(args, '--scale')! : undefined, out: flag(args, '--out') ?? (p ? join(p.art, 'sheets', 'fx') : 'artgen-out') });
    print([`${sub} ${size.join('x')} × ${r.frames} frames`, ...r.files.map(f => `  ${f}`), `interior ${r.fill.interior.join(' ')} · brightest ${r.fill.brightest.join(' ')}`].join('\n'), r);
    return 0;
  }
  // ---- W2 production (PLAN P3) ----
  const pos2 = (from: string[]) => from.filter((a, i) => !a.startsWith('--') && !(i > 0 && from[i - 1].startsWith('--') && from[i - 1] !== '--json' && from[i - 1] !== '--include-drafts' && from[i - 1] !== '--force'));
  if (cmd === 'brief') {
    const p = requireProject(flag(args, '--root'));
    if (sub === 'add' && rest[0]) {
      const kind = flag(args, '--kind');
      if (!kind) throw new Error('brief add: --kind is required');
      const anims = list(args, '--anims'), swaps = list(args, '--swaps');
      const b: BriefEntry = {
        id: rest[0], kind,
        ...(flag(args, '--view') && { view: flag(args, '--view') as BriefEntry['view'] }), ...(flag(args, '--size') && { size: parseSize(flag(args, '--size')) }),
        ...(list(args, '--states') && { states: list(args, '--states') }), ...(flag(args, '--directions') && { directions: +flag(args, '--directions')! as BriefEntry['directions'] }),
        ...(anims && { anims: Object.fromEntries(anims.map(x => { const [s, f, fps] = x.split(':'); return [s, { frames: +f, ...(fps && { fps: +fps }) }]; })) }),
        ...(flag(args, '--variants') && { variants: +flag(args, '--variants')! }),
        ...(swaps && { swaps: swaps.reduce((m, x) => { const [n, pair] = x.split(':'), [from, to] = pair.split('='); (m[n] ??= {})[from] = to; return m; }, {} as Record<string, Record<string, string>>) }),
        ...(flag(args, '--importance') && { importance: flag(args, '--importance') as Importance }), ...(flag(args, '--priority') && { priority: +flag(args, '--priority')! }),
        ...(flag(args, '--notes') && { notes: flag(args, '--notes') }), ...(flag(args, '--height') && { height: +flag(args, '--height')! }),
        ...(flag(args, '--object') && { object: flag(args, '--object') }), ...(flag(args, '--body') && { body: flag(args, '--body') as BriefEntry['body'] }),
      };
      if (b.importance && !IMPORTANCE.includes(b.importance)) throw new Error(`--importance: ${IMPORTANCE.join(' | ')}`);
      for (const d of list(args, '--durations') ?? []) {
        const [s, ms] = d.split('='), a = b.anims?.[s];
        if (!a || !ms) throw new Error(`--durations ${d}: give state=ms/ms/… for a state in --anims`);
        a.durations = ms.split('/').map(Number);
      }
      // new effect briefs name the drawable thing up front (rev 9); older briefs without one show it as an open issue
      if (b.kind === 'effect' && !b.object) throw new Error(`brief add ${b.id}: an effect needs --object "<the drawable thing>" (e.g. "ice lance", "ring of fire") — without the word effect or colour words`);
      if (b.anims && !b.states) b.states = ['idle', ...Object.keys(b.anims).filter(s => s !== 'idle')];
      const all = addBrief(p, b, { breakContract: args.includes('--break-contract') }), dir = lockedDirection(p), warnings = dir ? briefWarnings(b, dir) : [];
      print(`brief ${b.id} (${b.kind}) in art/briefs.yaml — ${all.length} briefs${warnings.map(w => `\n  warning: ${w}`).join('')}\nnext: artgen make ${b.id}`, { brief: b, count: all.length, warnings });
      return 0;
    }
    if (sub === 'lint') {
      const dir = lockedDirection(p);
      if (!dir) throw new Error('brief lint: lock a direction first (it checks briefs against its ramps and templates)');
      const ids = pos2(rest), rows = readBriefs(p).filter(b => !ids.length || ids.includes(b.id)).map(b => ({ id: b.id, warnings: briefWarnings(b, dir) })).filter(r => r.warnings.length);
      print(rows.length ? rows.map(r => `${r.id}:\n${r.warnings.map(w => `  ${w}`).join('\n')}`).join('\n') : 'no brief warnings', rows);
      return 0;
    }
    if (sub === 'rm' && rest[0]) { const ok = removeBriefFile(p, rest[0]); print(ok ? `removed ${rest[0]} (asset sources are kept)` : `no brief ${rest[0]}`, { removed: ok }); return ok ? 0 : 1; }
    if (sub === 'list') {
      const bs = readBriefs(p);
      print(bs.map(b => `${b.id.padEnd(16)} ${b.kind.padEnd(10)} ${(b.states ?? ['idle']).join(',')}${b.directions ? ` ×${b.directions}` : ''}${b.anims ? ` ${Object.entries(b.anims).map(([k, v]) => `${k}:${v.frames}`).join(' ')}` : ''}${b.importance ? ` [${b.importance}]` : ''}${b.notes ? ` — ${b.notes}` : ''}`).join('\n') || 'no briefs yet (artgen brief add <id> --kind …)', bs);
      return 0;
    }
  }
  if (cmd === 'make' || cmd === 'status') {
    const p = requireProject(flag(args, '--root')), ids = pos2(args);
    const table = (rows: Awaited<ReturnType<typeof projectStatus>>) => rows.map(r => `  ${r.id.padEnd(16)} ${r.status.padEnd(11)} ${r.final ? `${r.final} ${r.score ?? '-'}${r.blind !== undefined ? ` b${r.blind}` : ''}${r.gate === false ? ' GATE FAIL' : ''}${r.belowBar ? ' BELOW BAR' : ''}${r.top ? ` final≠best (${r.top.version} ${r.top.score})` : ''}` : (r.next ? `${r.next.action} ${'version' in r.next ? r.next.version : ''}` : '')}${r.issues.length ? `\n${r.issues.map(i => `      issue: ${i}`).join('\n')}` : ''}`).join('\n');
    if (cmd === 'status') { const rows = await projectStatus(p, ids); print(table(rows) || 'no briefs yet', rows); return 0; }
    const par = flag(args, '--parallel');
    if (par !== undefined && !(+par >= 1)) throw new Error('make --parallel <n>: how many maker subagents to run at once (e.g. 4)');
    const wave = flag(args, '--wave');
    if (wave !== undefined && !(+wave >= 1)) throw new Error('make --wave <n>: how many assets to finish before starting more (e.g. 10)');
    const r = await make(p, ids, { parallel: par ? +par : undefined, wave: wave ? +wave : undefined });
    const pk = (x: WorkPacket) => `  ${x.id.padEnd(16)} ${x.step.action} ${'version' in x.step ? x.step.version : ''}${x.writes.length ? ` → writes ${x.writes.join(', ')}` : ''}${x.resume ? ' (resume: written, never reviewed — check it, complete it, review it)' : ''}`;
    const counts = Object.entries(r.rows.reduce((m, x) => ({ ...m, [x.status]: (m[x.status] ?? 0) + 1 }), {} as Record<string, number>)).map(([k, v]) => `${v} ${k}`).join(', ');
    print([
      ...(r.scaffolded.length ? [`scaffolded from templates:\n  ${r.scaffolded.join('\n  ')}`] : []), ...(r.finals.length ? [`marked final: ${r.finals.join(', ')}`] : []),
      ...(r.overBudget.length ? [`over budget, finished as is: ${r.overBudget.join(', ')}`] : []), table(r.rows), `(${counts})`,
      ...(r.work ? [
        `parallel round: ${r.work.makers.length} maker subagent(s), one per asset; each writes only its own file(s), then runs artgen render + artgen review on its asset`,
        ...r.work.makers.map(pk), ...(r.work.queued.length ? [`queued for the next round (${r.work.queued.length}):`, ...r.work.queued.map(pk)] : []),
        ...(r.work.main.length ? ['main agent (reviews, blind re-scores — fresh art-reviewer per sheet):', ...r.work.main.map(pk)] : []),
      ] : []),
      ...(r.roster ? [`v1 roster: ${r.roster.ids.join(', ')} wait for it — ${r.roster.why}`] : []),
      r.next ? `next: ${r.next.id} — ${r.next.step.action} ${'version' in r.next.step ? r.next.step.version : ''} (${r.next.path}) — ${r.next.step.why}`
        : r.roster ? 'next: artgen roster --stage v1, a fresh art-reviewer in roster mode, then artgen roster record <its json> --reviewer art-reviewer'
        : r.finalRoster?.length ? `next: the final roster (${r.finalRoster.length} finals have no roster review): artgen roster, a fresh art-reviewer, artgen roster record — then the gallery`
        : 'next: nothing left in the pipeline — show the gallery to the user (artgen gallery)',
    ].join('\n'), r);
    return 0;
  }
  if (cmd === 'gallery') {
    const p = requireProject(flag(args, '--root')), r = await gallery(p, { ids: pos2(args) });
    print(r.sheets.length ? `gallery ${r.sheets.join(', ')} (~${r.tokens} image tokens)\n${r.assets.map(a => `  ${a.id} ${a.final} ${a.score ?? '-'}${a.blind !== undefined ? ` b${a.blind}` : ''}${a.belowBar ? ' BELOW BAR' : ''}${a.top ? ` final≠best (${a.top.version} ${a.top.score})` : ''}${a.issues.length ? `\n${a.issues.map(i => `    issue: ${i}`).join('\n')}` : ''}`).join('\n')}` : 'no finished assets waiting for review', r);
    return 0;
  }
  if (cmd === 'feedback' && sub) {
    const route = flag(args, '--route'), note = flag(args, '--note');
    if (route !== 'base' && route !== 'finish') throw new Error('feedback: --route base (form, proportion, colour → new base) | finish (pixels → finish revision)');
    if (!note) throw new Error('feedback: --note "<what the user asked for>" is required');
    const region = list(args, '--region')?.map(Number), by = flag(args, '--by');
    // --by roster | agent: the agent acting on a roster note — recorded as the agent's, never as the user's
    if (by !== undefined && !['user', 'roster', 'agent'].includes(by)) throw new Error('feedback --by user (default) | roster | agent');
    const agent = by === 'roster' || by === 'agent';
    const r = await feedback(requireProject(flag(args, '--root')), sub, { route, note, region, cell: flag(args, '--cell'), force: args.includes('--force'), ...(agent && { by: 'agent' as const, source: by }) });
    print(`feedback recorded (${agent ? `${by} revision` : 'user iteration'} ${r.iterations}): opens ${r.opens}\nnext: ${r.next.action} ${'version' in r.next ? r.next.version : ''} — ${r.next.why}`, r);
    return 0;
  }
  if (cmd === 'approve' && sub) {
    const e = await approve(requireProject(flag(args, '--root')), sub, flag(args, '--note') ?? '');
    const warn = (e.warnings as string[] | undefined) ?? [];
    print(`approved ${e.asset} ${e.version} (direction v${e.direction?.version})${warn.length ? `\nnote for the user: ${warn.join('; ')}` : ''}`, e);
    return 0;
  }
  if (cmd === 'export') {
    const r = await exportPacks(requireProject(flag(args, '--root')), { packs: list(args, '--pack'), includeDrafts: args.includes('--include-drafts'), generator: `artgen ${VERSION}`, runtime: args.includes('--runtime'), force: args.includes('--force'), breakContract: list(args, '--break-contract') });
    const rt = r.runtime;
    print([
      ...r.packs.map(x => `pack ${x.pack}: ${x.assets.length} assets → ${x.atlases.join(', ')} + ${x.dir}/pack.json${x.drafts.length ? ` (drafts: ${x.drafts.join(', ')})` : ''}`),
      r.assetsTs ? `typed ids: ${r.assetsTs}` : 'nothing approved to export yet',
      ...(r.skipped.length ? [`not exported: ${r.skipped.map(s => `${s.id} (${s.status})`).join(', ')}`] : []),
      ...r.contracts.map(c => `contract ${c.id}: ${c.change}${c.notes.length ? ` (${c.notes.join('; ')})` : ''} → art/contracts/${c.id}.json`),
      ...(rt ? [
        `runtime ${rt.from && rt.from !== rt.version ? `${rt.from} → ` : ''}${rt.version} (${rt.adapters.join(', ')}) in ${rt.dir}: ${rt.written.length} written, ${rt.unchanged.length} unchanged${rt.removed.length ? `, ${rt.removed.length} removed` : ''}`,
        ...(rt.kept.length ? [`kept locally edited runtime files (re-run with --force to overwrite): ${rt.kept.join(', ')}`] : []),
      ] : []),
    ].join('\n'), r);
    return 0;
  }
  if (cmd === 'restyle') {
    const r = await restyle(requireProject(flag(args, '--root')), { from: flag(args, '--from') ? +flag(args, '--from')! : undefined });
    print([`restyle v${r.from} → v${r.to}: ${r.sheet} (~${r.tokens} image tokens)`, ...r.assets.map(a => `  ${a.id.padEnd(16)} ${a.changedPct}% px changed, tokens kept ${Math.round(a.tokenSame * 100)}%${a.consistent ? '' : ' (inconsistent colour mapping)'}${a.gate ? '' : ' GATE FAIL'}${a.stale.length ? ` FINISH-STALE ${a.stale.join('; ')}` : ''}`), 'changed assets are back to final: show the gallery and re-approve'].join('\n'), r);
    return r.assets.every(a => a.gate) ? 0 : 1;
  }
  if (cmd === 'import-edit' && sub && rest[0]) {
    const r = await importEdit(requireProject(flag(args, '--root')), sub, rest[0], { cell: flag(args, '--cell') });
    print(`${r.file}: ${r.pixels} pixels in ${r.cells} cells${r.snapped ? `, ${r.snapped} snapped to the nearest palette colour` : ''}${r.conflicts ? `, ${r.conflicts} mirrored-cell edits dropped (edit the east facing)` : ''}\nnext: artgen review ${sub}`, r);
    return 0;
  }
  if (cmd === 'roster') {
    const p = requireProject(flag(args, '--root'));
    if (sub === 'record' && rest[0]) {
      const r = rosterRecord(p, rest[0], flag(args, '--reviewer') ?? 'self');
      const lines = Object.entries(r.issues).map(([id, xs]) => `  ${id}: ${xs.join('; ')}`);
      print([`roster review recorded: ${lines.length} assets with open issues`, ...lines, ...r.notes.map(n => `  note: ${n}`), 'they show in status and the gallery until the asset gets a new final'].join('\n'), r);
      return 0;
    }
    const stage = flag(args, '--stage') ?? 'final';
    if (stage !== 'v1' && stage !== 'final') throw new Error('roster --stage v1 (every scored base.v1, before v2) | final (default)');
    const r = await rosterRun(p, { ids: pos2(args), seed: flag(args, '--seed') ? +flag(args, '--seed')! : undefined, stage });
    print([
      `roster (${r.stage}) sheets: ${r.sheets.join(', ')} (~${r.tokens} image tokens); asset list for the reviewer: ${r.assets}${r.skipped.length ? `; tiles left out: ${r.skipped.join(', ')}` : ''}`,
      'sizes (drawn body height vs brief height × px per metre):',
      ...r.sizes.map(x => `  ${x.id.padEnd(16)} ${String(x.drawn).padStart(3)} px${x.expected !== undefined ? `, expected ${x.expected} px for ${x.height} m (${x.dev! >= 0 ? '+' : ''}${Math.round(x.dev! * 100)} %)${x.flag ? ' FLAG' : ''}` : ' (no height in the brief)'}`),
      `most similar silhouettes: ${r.pairs.map(x => `${x.a} ~ ${x.b} ${x.overlap}`).join(', ')}`,
      `next: give the ${r.sheets.length} sheets and the asset list (not the ledger) to a fresh art-reviewer in roster mode, then artgen roster record <its json> --reviewer art-reviewer${r.stage === 'v1' ? ' (its notes go into each asset\'s v2 brief)' : ''}`,
    ].join('\n'), r);
    return 0;
  }
  if (cmd === 'analytics') {
    const across = list(args, '--across');
    if (across) {
      if (!across.length) throw new Error('analytics --across <project root>[,<root>…]: the projects (or bench folders with a ledger.jsonl) to pool');
      const r = pooledAnalytics(across, { apply: args.includes('--apply') ? requireProject(flag(args, '--root')) : undefined, minAssets: flag(args, '--min-assets') ? +flag(args, '--min-assets')! : undefined });
      if (flag(args, '--out')) writeFileSync(flag(args, '--out')!, r.markdown);
      print(r.markdown + (r.applied ? `\napplied to ${r.applied}` : ''), { ...r.report, ...(r.applied && { applied: r.applied }) });
      return 0;
    }
    const r = projectAnalytics(requireProject(flag(args, '--root')));
    if (flag(args, '--out')) { writeFileSync(flag(args, '--out')!, r.markdown); }
    print(r.markdown, r.report);
    return 0;
  }
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') { console.log(USAGE); return 0; }
  console.error(`artgen: unknown command '${[cmd, sub].filter(Boolean).join(' ')}' — run artgen --help for the list`);
  return 1;
}
