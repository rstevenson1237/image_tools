/**
 * Terrain maps for tabletop games (`artgen map …`): `art/maps/<id>/map.json` is the map; renders go to
 * `art/maps/<id>/out/` (rebuilt from the file, gitignored). The CLI, the MCP server and the web tool's Terrain Map
 * all read and write the same file.
 *
 *   artgen map new <id> [--preset regional|local] [--size 30x22] [--grid hex|square|none] [--seed n] [--title "…"]
 *   artgen map gen <id> [--seed n] [--land mixed|island|inland] [--sea f] [--moisture f] [--roughness f] [--relief f]
 *                       [--rivers n] [--simplify n] [--feature n] [--interval n] [--max-elevation n] [--topo-labels on|off]
 *   artgen map edit <id> paint --terrain t <shape> | elevate --amount ±f <shape> | river --points x,y,… [--width w] [--delta off]
 *                       | road --points x,y,… | undo   (rivers widen gently from source to mouth and flare into the water they end in)
 *       <shape>: --circle x,y,r | --poly x,y,x,y,… | --stroke x,y,… --width w
 *   artgen map grid <id> hex|square|none [--size n] [--coords on|off]
 *   artgen map label <id> "Text" --at x,y|0304|C4 [--kind region|place|water|note] [--size f] [--angle deg]
 *   artgen map symbol <id> <kind> --at x,y|0304|C4 [--scale f] | artgen map symbols
 *   artgen map overlay <id> rm label|symbol <index> | clear [labels|symbols]
 *   artgen map set <id> [--title "…"] [--legend on|off] [--scale-bar on|off] [--compass on|off] [--per-cell n --unit mi]
 *   artgen map render <id> [--theme color|bw|both] [--format svg|png|both] [--ppu 40 | --fit 180x260mm] [--crop x,y,w,h[cells]] [--layers grid=off,labels=off] [--out dir]
 *   artgen map show <id> | list
 *   artgen map facts <id> [--at x,y …] [--area x,y,x,y,…] [--above river|lowest] [--radius n]   the ground, as numbers (--json)
 *   artgen map check <id>   the file's format errors, then each `require` entry measured and met or unmet (--json); exits 1 on any error or unmet
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { clampCrop, encodePNG, fitPpu, map, rasterizeSvg, type Crop, type Fit, type SizeUnit } from 'artgen-core/maps';
import { initNodeMapSvg } from './node-svg.ts';
import { fileStem, readJson, writeJson, type FileRef, type Project } from './projectfs.ts';

type MapSpec = map.MapSpec;

/** A map in a project (its id) or a file by path (`--file`, no project). */
export type MapRef = string | FileRef;

export const mapsDir = (p: Project): string => join(p.art, 'maps');

/** `art/maps/<id>/map.json`; ids are names, never paths, so nothing outside `art/maps` is touched. A `{ file }` is that path. */
export function mapFile(p: Project | null, ref: MapRef): string {
  if (typeof ref !== 'string') return resolve(ref.file);
  if (!/^[\w-]+$/.test(ref ?? '')) throw new Error(`map id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p) throw new Error('no artgen project here: name the map file with --file <path>');
  return join(mapsDir(p), ref, 'map.json');
}

/** A file path as shown to the user: from the project root, else from the working directory. */
const shown = (p: Project | null, f: string): string => relative(p?.root ?? process.cwd(), f);

export const mapSummary = (m: MapSpec) =>
  ({ id: m.id, preset: m.preset, size: `${m.cols}x${m.rows}`, ...(m.title && { title: m.title }), edits: m.edits.length, labels: m.overlay.labels.length, symbols: m.overlay.symbols.length });

export function listMaps(p: Project): ReturnType<typeof mapSummary>[] {
  if (!existsSync(mapsDir(p))) return [];
  return readdirSync(mapsDir(p), { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(mapsDir(p), d.name, 'map.json'))).map(d => mapSummary(readMap(p, d.name)));
}

export function readMap(p: Project | null, ref: MapRef): MapSpec {
  const f = mapFile(p, ref);
  if (!existsSync(f)) throw new Error(typeof ref === 'string' ? `no map ${ref} (${shown(p, f)}) — artgen map new ${ref}` : `no map file ${shown(p, f)} — artgen map new --file ${ref.file}`);
  return map.parseMap(readJson(f));
}

/** Validate and write a map; `ref` is where (default: the project's file for the map's own id). */
export function writeMap(p: Project | null, m: MapSpec, ref: MapRef = m.id): string {
  const spec = map.parseMap(m), f = mapFile(p, ref);
  writeJson(f, spec);
  return shown(p, f);
}

export function createMap(p: Project | null, id: string, preset: map.Preset, over: Partial<MapSpec> = {}, force = false, at: MapRef = id): { file: string; map: MapSpec } {
  if (existsSync(mapFile(p, at)) && !force) throw new Error(typeof at === 'string' ? `map ${id} already exists (edit it, or pick another id)` : `${shown(p, mapFile(p, at))} already exists (edit it, or --force)`);
  const m = map.newMap(id, preset, over);
  return { file: writeMap(p, m, at), map: m };
}

/** Read, change, validate and write a map in one step. */
export function updateMap(p: Project | null, ref: MapRef, change: (m: MapSpec) => void): MapSpec {
  const m = readMap(p, ref);
  change(m);
  writeMap(p, m, ref);
  return m;
}

export interface MapCheck {
  file: string;
  /** No format errors and every requirement met. */
  ok: boolean;
  errors: map.MapIssue[];
  /** Each `require` entry, measured, in the file's order (empty when the file has errors: nothing is generated from a file that does not parse). */
  requirements: map.RequirementResult[];
  /** The ids of the unmet requirements. */
  unmet: string[];
}

/** Every format error in a map file, then (when it parses) each requirement measured against the ground generated from it. */
export function checkMapFile(p: Project | null, ref: MapRef): MapCheck {
  const f = mapFile(p, ref);
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(f, 'utf8')); } catch (e) {
    const missing = (e as NodeJS.ErrnoException).code === 'ENOENT';
    return { file: shown(p, f), ok: false, errors: [{ path: '', message: missing ? `no such file: ${shown(p, f)}` : `not JSON: ${(e as Error).message}` }], requirements: [], unmet: [] };
  }
  const { errors } = map.checkMap(raw);
  if (errors.length) return { file: shown(p, f), ok: false, errors, requirements: [], unmet: [] };
  const requirements = map.checkRequirements(map.parseMap(raw)), unmet = requirements.filter(r => !r.met).map(r => r.id);
  return { file: shown(p, f), ok: !unmet.length, errors, requirements, unmet };
}

export interface MapRender {
  files: string[]; terrains: string[]; rivers: number;
  /** The render in pixels. */
  size: [number, number];
  /** The window drawn, in map units (the whole sheet when there is no crop), and the pixels per unit it was drawn at. */
  crop: Crop; ppu: number;
  /** The SVG's own width and height, in its unit (`--fit` in mm gives millimetres). */
  svg: { width: number; height: number; unit: SizeUnit };
}

/** Render a map to SVG and/or PNG in one or both themes. */
export async function renderMapFiles(p: Project | null, ref: MapRef, o: { themes?: map.ThemeName[]; formats?: ('svg' | 'png')[]; ppu?: number; crop?: Crop; fit?: Fit; layers?: Partial<Record<map.MapLayer, boolean>>; out?: string } = {}): Promise<MapRender> {
  // a project map renders to its out/ folder as <id>.…; a file renders beside itself as <file name>.…
  const m = readMap(p, ref), field = map.generateMap(m), id = typeof ref === 'string' ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === 'string' ? join(mapsDir(p!), id, 'out') : dirname(mapFile(p, ref)));
  const formats = o.formats ?? ['svg', 'png'], files: string[] = [];
  if (o.fit && o.ppu !== undefined) throw new Error('--fit and --ppu both set the scale: use one');
  const crop = clampCrop(o.crop ?? [0, 0, m.cols, m.rows], m.cols, m.rows), ppu = o.fit ? fitPpu(crop[2], crop[3], o.fit) : o.ppu ?? 40;
  const size: [number, number] = [Math.round(crop[2] * ppu), Math.round(crop[3] * ppu)], unit = o.fit?.unit ?? 'px';
  if (formats.includes('png')) await initNodeMapSvg();
  mkdirSync(out, { recursive: true });
  for (const theme of o.themes ?? ['color']) {
    const svg = map.renderMapSvg(m, { theme, ppu, layers: o.layers, field, ...(o.crop && { crop }), unit }), base = join(out, `${id}.${theme}`);
    if (formats.includes('svg')) { writeFileSync(`${base}.svg`, svg); files.push(`${base}.svg`); }
    if (formats.includes('png')) { writeFileSync(`${base}.png`, encodePNG(rasterizeSvg(svg, size[0], size[1]))); files.push(`${base}.png`); }
  }
  return { files: files.map(f => relative(process.cwd(), f)), terrains: map.terrainsUsed(field), rivers: field.rivers.length, size, crop, ppu, svg: svgSize(crop, ppu, unit) };
}

/** The SVG's width and height in its unit, as the renderer writes them. */
export function svgSize(crop: Crop, ppu: number, unit: SizeUnit): { width: number; height: number; unit: SizeUnit } {
  const f = unit === 'mm' ? 96 / 25.4 : 1, r = (v: number) => Math.round((v * ppu) / f * 100) / 100;
  return { width: r(crop[2]), height: r(crop[3]), unit };
}

/** Comma list of numbers (`--points 1,2,3,4`). */
export function numbers(v: string | undefined, what: string, pairs = true): number[] {
  const xs = (v ?? '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
  if (!xs.length || xs.some(x => !Number.isFinite(x)) || (pairs && xs.length % 2)) throw new Error(`${what}: comma-separated numbers${pairs ? ' in x,y pairs' : ''}`);
  return xs;
}

/** A shape from flags or MCP arguments (`circle`, `poly`, `stroke` + `width`). */
export function shapeFrom(o: { circle?: string | number[]; poly?: string | number[]; stroke?: string | number[]; width?: string | number }): map.Shape {
  const arr = (v: string | number[], what: string, pairs = true) => (Array.isArray(v) ? v.map(Number) : numbers(v, what, pairs));
  if (o.circle !== undefined) { const c = arr(o.circle, '--circle x,y,r', false); if (c.length !== 3) throw new Error('--circle: x,y,r'); return { circle: [c[0], c[1], c[2]] }; }
  if (o.poly !== undefined) return { poly: arr(o.poly, '--poly') };
  if (o.stroke !== undefined) return { stroke: arr(o.stroke, '--stroke'), width: Number(o.width ?? 1) };
  throw new Error('a shape is required: --circle x,y,r | --poly x,y,x,y,… | --stroke x,y,… --width w');
}

/** `on`/`off`/`true`/`false`/`yes`/`no` → boolean; undefined when unset. */
export const onOff = (v: string | undefined): boolean | undefined => (v === undefined ? undefined : /^(on|true|yes|1)$/i.test(v));

/** `grid=off,labels=off` (or bare names, meaning off) → layer switches; `names` are the layers there are. */
export function parseLayers<L extends string = map.MapLayer>(v: string | undefined, names: readonly L[] = map.MAP_LAYERS as unknown as readonly L[]): Partial<Record<L, boolean>> | undefined {
  if (!v) return undefined;
  const out: Partial<Record<L, boolean>> = {};
  for (const part of v.split(',').map(s => s.trim()).filter(Boolean)) {
    const [name, val] = part.split('=');
    if (!names.includes(name as L)) throw new Error(`--layers: unknown layer ${name} (${names.join(', ')})`);
    out[name as L] = val === undefined ? false : onOff(val)!;
  }
  return out;
}

/** One-paragraph description of a map for `map show` and the MCP `map_get`. */
export function describeMap(m: MapSpec): string {
  const g = m.gen;
  return [
    `${m.id}${m.title ? ` "${m.title}"` : ''}: ${m.preset}, ${m.cols}×${m.rows} ${m.grid.type === 'hex' ? 'hexes' : 'cells'} of ${m.scale.perCell} ${m.scale.unit}, seed ${m.seed}`,
    `  gen: land ${g.land}, sea ${g.sea}, moisture ${g.moisture}, roughness ${g.roughness}, relief ${g.relief}, rivers ${g.rivers}, simplify ${g.simplify}, feature ${g.feature}`,
    `  topo: every ${m.topo.interval} ${m.topo.unit} up to ${m.topo.maxElevation}, major every ${m.topo.majorEvery}${m.topo.labels ? ', labelled' : ''}`,
    `  grid: ${m.grid.type}${m.grid.type !== 'none' ? ` size ${m.grid.size}${m.grid.coords ? ', coordinates' : ''}` : ''}; legend ${m.legend ? 'on' : 'off'}, scale bar ${m.scaleBar ? 'on' : 'off'}, compass ${m.compass ? 'on' : 'off'}`,
    ...(m.require?.length ? [`  require (${m.require.length}):${m.require.map(r => `\n    ${r.id} ${r.kind}${r.kind === 'terrain' ? ` ${r.terrain} ${r.share}` : r.kind === 'height' ? ` ${r.low}-${r.high} ${m.topo.unit}` : r.kind === 'path' ? ` ${r.path}` : ''}`).join('')}`] : []),
    `  edits (${m.edits.length}):${m.edits.map((e, i) => `\n    ${i}. ${e.op}${e.op === 'paint' ? ` ${e.terrain}` : e.op === 'elevate' ? ` ${e.amount}` : ''} ${'shape' in e ? JSON.stringify(e.shape) : JSON.stringify(e.points)}`).join('')}`,
    `  labels (${m.overlay.labels.length}):${m.overlay.labels.map((l, i) => `\n    ${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}`).join('')}`,
    `  symbols (${m.overlay.symbols.length}):${m.overlay.symbols.map((s, i) => `\n    ${i}. ${s.kind} at ${s.x},${s.y}`).join('')}`,
  ].join('\n');
}


const km = (l: { map: number; scale: number }, unit: string) => `${l.map} (${l.scale} ${unit})`;
const at = (p: [number, number]) => `${p[0]},${p[1]}`;

/** The text of `map facts` (the JSON is `map.mapFacts`' result as it is). */
export function describeMapFacts(r: map.MapFacts): string {
  const { scale, height } = r.unit, out = [`${r.id}: ${r.size.cols}×${r.size.rows} cells; heights in ${height}, distances in cells (${scale})`];
  const share = (s: { terrain: string; share: number }[]) => s.map(x => `${x.terrain} ${x.share}%`).join(', ');
  const hi = (h: { height: number; at: [number, number]; prominence?: number }) => `${h.height} ${height} at ${at(h.at)}${h.prominence ? ` (stands ${h.prominence} ${height} clear)` : ''}`;
  for (const p of r.points ?? []) {
    out.push(`at ${at(p.at)}: ${p.terrain}, ${p.height} ${height}, slope ${p.slope.band ?? '?'} (${p.slope.gradient} ${height}/${scale})`);
    for (const k of ['river', 'road'] as const) if (p[k]) out.push(`  ${k}: ${p[k]!.name}${p[k]!.source ? ` (${p[k]!.source})` : ''} ${km(p[k]!.distance, scale)} away at ${at(p[k]!.at)}${p[k]!.within ? ', in it' : ''}`);
    if (p.above) out.push(`  ${p.above.value === null ? `no ${p.above.of} to measure from` : `${p.above.value} ${height} above the ${p.above.of === 'river' ? 'river' : 'lowest ground'}`}${p.above.reference ? ` (${hi(p.above.reference)})` : ''}`);
  }
  for (const a of r.areas ?? []) {
    out.push(`area ${a.area.map(at).join(' ')}: ${share(a.terrain)}; lowest ${hi(a.lowest)}, highest ${hi(a.highest)}`);
    for (const c of [...a.rivers, ...a.roads]) out.push(`  ${c.name}${c.source ? ` (${c.source})` : ''}: ${c.enters ? `in at ${at(c.enters)}` : 'starts inside'}, ${c.leaves ? `out at ${at(c.leaves)}` : 'ends inside'}, ${km(c.length, scale)}`);
  }
  const f = r.features;
  if (f) {
    out.push(`terrain: ${share(f.terrain)}; lowest ${hi(f.lowest)}, highest ${hi(f.highest)}`);
    for (const [what, lines] of [['river', f.rivers], ['generated river', f.generatedRivers], ['road', f.roads]] as const)
      for (const l of lines) out.push(`${what} ${l.name}: ${km(l.length, scale)}, ${l.points.length} points from ${at(l.points[0])} to ${at(l.points[l.points.length - 1])}`);
    out.push(`hilltops: ${f.hilltops.map(hi).join('; ') || 'none'}`, `hollows: ${f.hollows.map(hi).join('; ') || 'none'}`);
  }
  return out.join('\n');
}

/** `--at 4,60 12,80 C4`: every value after the flag up to the next flag, and the flag again where it repeats. */
export function flagValues(args: string[], name: string): string[] {
  const out: string[] = [];
  args.forEach((a, i) => { if (a !== name) return; for (let k = i + 1; k < args.length && !args[k].startsWith('--'); k++) out.push(args[k]); });
  return out;
}

/** `map facts` from the command line's flags. */
export function factsQuery(m: MapSpec, args: string[], flag: (a: string[], n: string) => string | undefined): map.MapFactsQuery {
  const above = flag(args, '--above'), radius = flag(args, '--radius');
  if (above !== undefined && above !== 'river' && above !== 'lowest') throw new Error('--above: river or lowest');
  if (radius !== undefined && !(Number.isFinite(+radius) && +radius > 0)) throw new Error('--radius: a number above 0 (map units)');
  const areas = args.flatMap((a, i) => (a === '--area' ? [map.areaOutline(numbers(args[i + 1], '--area', false))] : []));
  return { at: flagValues(args, '--at').map(v => map.parsePoint(m, v)), areas, ...(above && { above }), ...(radius !== undefined && { radius: +radius }) };
}
