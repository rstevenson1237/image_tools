/**
 * Settlement maps for tabletop games (`artgen settlement …`): `art/settlements/<id>/settlement.json` is the map; renders
 * go to `art/settlements/<id>/out/` (rebuilt from the file, gitignored). The CLI, the MCP server and the web tool's
 * Settlement Map all read and write the same file. A render is the site (`<id>.<theme>.svg`) or one building's floor
 * plan (`<id>.<building>.f<level>.<theme>.svg`, a cellar `c1`).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { clampCrop, encodePNG, fitPpu, map, PX_PER_MM, rasterizeSvg, settlement, type Crop, type Fit, type SizeUnit } from 'artgen-core/maps';
import { svgSize } from './map.ts';
import { initNodeMapSvg } from './node-svg.ts';
import { fileStem, readJson, writeJson, type FileRef, type Project } from './projectfs.ts';

type SettlementSpec = settlement.SettlementSpec;

/** A settlement in a project (its id) or a file by path (`--file`, no project). */
export type SettlementRef = string | FileRef;

export const settlementsDir = (p: Project): string => join(p.art, 'settlements');

/** `art/settlements/<id>/settlement.json`; ids are names, never paths, so nothing outside `art/settlements` is touched. */
export function settlementFile(p: Project | null, ref: SettlementRef): string {
  if (typeof ref !== 'string') return resolve(ref.file);
  if (!/^[\w-]+$/.test(ref ?? '')) throw new Error(`settlement id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p) throw new Error('no artgen project here: name the settlement file with --file <path>');
  return join(settlementsDir(p), ref, 'settlement.json');
}

const shown = (p: Project | null, f: string): string => relative(p?.root ?? process.cwd(), f);

export const settlementSummary = (m: SettlementSpec) => ({
  id: m.id, kind: m.kind, size: `${m.cols}x${m.rows}`, ...(m.title && { title: m.title }), buildings: m.buildings.length,
  interiors: m.buildings.filter(b => b.floors?.length).length, roads: m.roads.length, walls: m.walls.length, water: m.water.length,
});

export function listSettlements(p: Project): ReturnType<typeof settlementSummary>[] {
  if (!existsSync(settlementsDir(p))) return [];
  return readdirSync(settlementsDir(p), { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(settlementsDir(p), d.name, 'settlement.json'))).map(d => settlementSummary(readSettlement(p, d.name)));
}

export function readSettlement(p: Project | null, ref: SettlementRef): SettlementSpec {
  const f = settlementFile(p, ref);
  if (!existsSync(f)) throw new Error(typeof ref === 'string' ? `no settlement ${ref} (${shown(p, f)}) — artgen settlement new ${ref}` : `no settlement file ${shown(p, f)} — artgen settlement new --file ${ref.file}`);
  return settlement.parseSettlement(readJson(f));
}

export function writeSettlement(p: Project | null, m: SettlementSpec, ref: SettlementRef = m.id): string {
  const spec = settlement.parseSettlement(m), f = settlementFile(p, ref);
  writeJson(f, spec);
  return shown(p, f);
}

export function createSettlement(p: Project | null, m: SettlementSpec, force = false, at: SettlementRef = m.id): { file: string; settlement: SettlementSpec } {
  if (existsSync(settlementFile(p, at)) && !force) throw new Error(typeof at === 'string' ? `settlement ${m.id} already exists (edit it, or pick another id)` : `${shown(p, settlementFile(p, at))} already exists (edit it, or --force)`);
  return { file: writeSettlement(p, m, at), settlement: m };
}

/** Read, change, validate and write a settlement in one step; `change` may return a replacement spec. */
export function updateSettlement(p: Project | null, ref: SettlementRef, change: (m: SettlementSpec) => SettlementSpec | void): SettlementSpec {
  const m = readSettlement(p, ref), next = change(m) ?? m;
  writeSettlement(p, next, ref);
  return next;
}

/** The map an `underlay` names (its path is from the settlement file's folder), generated; null when there is none. */
export function readSettlementUnderlay(p: Project | null, ref: SettlementRef, m: SettlementSpec): { map: map.MapSpec; field: map.MapField } | null {
  if (!m.underlay) return null;
  const f = resolve(dirname(settlementFile(p, ref)), m.underlay.map);
  if (!existsSync(f)) throw new Error(`underlay.map: no such map file ${m.underlay.map} (looked for ${shown(p, f)})`);
  const spec = map.parseMap(readJson(f));
  return { map: spec, field: map.generateMap(spec) };
}

/** The map file for `--map`: a map id in the project, or a path; and its path from the settlement's folder. */
export function mapForSettlement(p: Project | null, ref: SettlementRef, mapRef: string): { path: string; rel: string } {
  const path = /[\\/.]/.test(mapRef) ? resolve(mapRef) : (() => { if (!p) throw new Error('--map: a map file path (no project here)'); return join(p.art, 'maps', mapRef, 'map.json'); })();
  if (!existsSync(path)) throw new Error(`--map: no map ${mapRef} (${shown(p, path)})`);
  return { path, rel: relative(dirname(settlementFile(p, ref)), path).split('\\').join('/') };
}

export interface SettlementCheck { file: string; ok: boolean; errors: settlement.Finding[] | { path: string; message: string }[]; warnings: { path: string; message: string }[] }

/** What `settlement check` finds: every file error with its JSON path, then the drawing warnings. Only errors make it not `ok`. */
export function checkSettlementFile(p: Project | null, ref: SettlementRef): SettlementCheck {
  const f = settlementFile(p, ref);
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(f, 'utf8')); } catch (e) {
    const missing = (e as NodeJS.ErrnoException).code === 'ENOENT';
    return { file: shown(p, f), ok: false, errors: [{ path: '', message: missing ? `no such file: ${shown(p, f)}` : `not JSON: ${(e as Error).message}` }], warnings: [] };
  }
  const r = settlement.checkSettlement(raw), errors: { path: string; message: string }[] = [...r.errors], warnings: { path: string; message: string }[] = [];
  if (!errors.length) for (const x of settlement.lintSettlement(settlement.parseSettlement(raw))) (x.severity === 'error' ? errors : warnings).push({ path: x.path, message: x.message });
  const u = (raw as { underlay?: { map?: unknown } } | null)?.underlay;
  if (!errors.some(e => e.path.startsWith('underlay')) && u && typeof u.map === 'string' && !existsSync(resolve(dirname(f), u.map))) errors.push({ path: 'underlay.map', message: `no such map file ${u.map}` });
  return { file: shown(p, f), ok: !errors.length, errors, warnings };
}

/** The drawing warnings after a change, as output lines (at most `max`, then a count). */
export function settlementWarningLines(m: SettlementSpec, max = 5): string[] {
  const found = settlement.lintSettlement(m);
  const lines = found.slice(0, max).map(x => `  ${x.severity}: ${x.path}: ${x.message}`);
  if (found.length > max) lines.push(`  … ${found.length - max} more (artgen settlement check ${m.id})`);
  return lines;
}

export interface SettlementRender {
  files: string[];
  view: settlement.SettlementView;
  building?: string;
  floor?: number;
  size: [number, number];
  crop: Crop;
  ppu: number;
  svg: { width: number; height: number; unit: SizeUnit };
}

export interface SettlementRenderOptions {
  formats?: ('svg' | 'png')[];
  themes?: settlement.SettlementTheme[];
  view?: settlement.SettlementView;
  building?: string;
  floor?: number;
  buildings?: settlement.BuildingMode;
  ppu?: number;
  crop?: Crop;
  fit?: Fit;
  pageScale?: number;
  layers?: Partial<Record<settlement.SettlementLayer, boolean>>;
  out?: string;
  /** Every building's every floor too (the site, then a plan per floor). */
  plans?: boolean;
}

/** Render the site or a plan (or, with `plans`, the site and every floor of every building) in each theme. */
export async function renderSettlementFiles(p: Project | null, ref: SettlementRef, o: SettlementRenderOptions = {}): Promise<SettlementRender[]> {
  const m = readSettlement(p, ref), id = typeof ref === 'string' ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === 'string' ? join(settlementsDir(p!), id, 'out') : dirname(settlementFile(p, ref)));
  const formats = o.formats ?? ['svg', 'png'], themes = o.themes ?? ['color'];
  if (o.fit && o.ppu !== undefined) throw new Error('--fit and --ppu both set the scale: use one');
  const underlay = readSettlementUnderlay(p, ref, m), layout = settlement.layoutSettlement(m);
  const jobs: { view: settlement.SettlementView; building?: string; floor?: number }[] = [];
  if (o.plans) {
    jobs.push({ view: 'site' });
    for (const b of m.buildings) for (const f of b.floors ?? []) jobs.push({ view: 'plan', building: b.id, floor: f.level });
  } else if ((o.view ?? (o.building ? 'plan' : 'site')) === 'plan') {
    const t = settlement.planTarget(m, o.building, o.floor);
    jobs.push({ view: 'plan', building: t.building.id, ...(t.floor && { floor: t.floor.level }) });
  } else jobs.push({ view: 'site' });
  if (formats.includes('png')) await initNodeMapSvg();
  mkdirSync(out, { recursive: true });
  const results: SettlementRender[] = [];
  for (const job of jobs) {
    const sheet = job.view === 'plan' ? settlement.planSheet(m, m.buildings.find(b => b.id === job.building)!) : { cols: m.cols, rows: m.rows };
    const crop = clampCrop(o.crop ?? [0, 0, sheet.cols, sheet.rows], sheet.cols, sheet.rows), unit = o.fit?.unit ?? 'px', pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : undefined);
    const view: settlement.RenderSettlementOptions = { view: job.view, ...(job.building && { building: job.building }), ...(job.floor !== undefined && { floor: job.floor }), buildings: o.buildings, layers: o.layers, ...(job.view === 'site' && { layout }), ...(o.crop && { crop }), pageScale };
    let ppu = o.fit ? fitPpu(crop[2], crop[3], o.fit) : o.ppu ?? (job.view === 'plan' ? 40 : 24);
    if (o.fit) {
      const f = o.fit.unit === 'mm' ? PX_PER_MM : 1, fits = (k: number) => { const r = settlement.settlementRenderSize(m, { ...view, ppu: k }); return r.width <= o.fit!.w * f + 1e-6 && r.height <= o.fit!.h * f + 1e-6; };
      if (!fits(ppu)) { let lo = 0, hi = ppu; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } ppu = lo; }
    }
    const px = settlement.settlementRenderSize(m, { ...view, ppu }), size: [number, number] = [Math.round(px.width), Math.round(px.height)], files: string[] = [];
    const stem = job.view === 'plan' ? `${id}.${job.building}.${(job.floor ?? 0) < 0 ? `c${-(job.floor ?? 0)}` : `f${job.floor ?? 0}`}` : id;
    for (const theme of themes) {
      const svg = settlement.renderSettlementSvg(m, { ...view, ppu, unit, theme, ...(underlay && job.view === 'site' && { underlay }) }), base = join(out, `${stem}.${theme}`);
      if (formats.includes('svg')) { writeFileSync(`${base}.svg`, svg); files.push(`${base}.svg`); }
      if (formats.includes('png')) { writeFileSync(`${base}.png`, encodePNG(rasterizeSvg(svg, size[0], size[1]))); files.push(`${base}.png`); }
    }
    results.push({ files: files.map(f => relative(process.cwd(), f)), view: job.view, ...(job.building && { building: job.building }), ...(job.floor !== undefined && { floor: job.floor }), size, crop, ppu, svg: svgSize([0, 0, px.width, px.height], 1, unit) });
  }
  return results;
}

/** One-paragraph description of a settlement for `settlement show` and the MCP `settlement_get`. */
export function describeSettlement(m: SettlementSpec): string {
  const g = m.gen, l = settlement.layoutSettlement(m), unit = m.scale.unit;
  const counts = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {})).map(([k, n]) => `${n} ${k}`).join(', ') || 'none';
  return [
    `${m.id}${m.title ? ` "${m.title}"` : ''}: a ${m.kind}, ${m.cols}×${m.rows} cells of ${m.scale.perCell} ${unit} (plans in ${m.interior.perCell} ${unit} cells), seed ${m.seed}, ${m.ground} ground`,
    `  gen: buildings ${g.buildings}, density ${g.density}, streets ${g.streets}, wall ${g.wall}, water ${g.water}, trees ${g.trees}, fields ${g.fields}, market ${g.market ? 'on' : 'off'}, castle ${g.castle ? 'on' : 'off'}, interiors ${g.interiors ? 'on' : 'off'}`,
    `  grid: ${m.grid.show ? `every ${m.grid.size * m.scale.perCell} ${unit}${m.grid.sub ? ', sub-grid' : ''}` : 'off'}; numbers ${m.numbers ? 'on' : 'off'}, scale bar ${m.scaleBar ? 'on' : 'off'}, compass ${m.compass ? 'on' : 'off'}, legend ${m.legend ? 'on' : 'off'}${m.underlay ? `; underlay ${m.underlay.map} at ${m.underlay.origin.join(',')}, ${m.underlay.scale} map units a cell` : ''}`,
    `  buildings (${m.buildings.length}):${l.buildings.map(bg => { const b = bg.building; return `\n    ${b.id}${bg.number !== undefined ? ` #${bg.number}` : ''}: ${b.kind}, ${b.shape} ${b.w}×${b.h} at ${b.x},${b.y}${b.angle ? ` turned ${b.angle}°` : ''}${b.label ? ` "${b.label}"` : ''}${b.floors?.length ? `; floors ${b.floors.map(f => `${f.level} (${f.rooms.length} rooms, ${f.fixtures?.length ?? 0} fixtures)`).join(', ')}` : ''}`; }).join('')}`,
    `  roads (${m.roads.length}): ${counts(m.roads.map(r => r.kind))}`,
    `  water (${m.water.length}): ${counts(m.water.map(w => w.kind))}${l.bridges.length ? `; ${l.bridges.length} bridge${l.bridges.length === 1 ? '' : 's'}` : ''}`,
    `  walls (${m.walls.length}):${m.walls.map((w, i) => `\n    ${i}. ${w.kind}${w.closed ? ', closed' : ''}, ${w.points.length / 2} points, ${l.walls[i].towers.length} towers, gates ${w.gates?.map(gt => gt.kind).join(', ') || 'none'}`).join('')}`,
    `  areas (${m.areas.length}): ${counts(m.areas.map(a => a.kind))}; trees ${m.trees.length} (+${l.areaTrees.length} in woods and orchards); props: ${counts(m.props.map(x => x.kind))}`,
    `  labels ${m.overlay.labels.length}, symbols ${m.overlay.symbols.length}`,
  ].join('\n');
}

/** The text of `settlement facts`. */
export function describeSettlementFacts(f: settlement.SettlementFacts): string {
  const t = (r: Record<string, number>) => Object.entries(r).map(([k, n]) => `${n} ${k}`).join(', ') || 'none';
  return [
    `${f.id}: a ${f.kind}, ${f.size.cols}×${f.size.rows} cells, ${f.size.scale}`,
    `buildings: ${t(f.counts.buildings)}; roads: ${t(f.counts.roads)}; walls: ${t(f.counts.walls)}; water: ${t(f.counts.water)}; areas: ${t(f.counts.areas)}; trees ${f.counts.trees}; ${f.bridges} bridges`,
    ...f.buildings.map(b => `  ${b.id}${b.number !== undefined ? ` #${b.number}` : ''} ${b.kind}${b.label ? ` "${b.label}"` : ''}: ${b.size}, ${b.stories} storey${b.stories === 1 ? '' : 's'}${b.floors.map(fl => `\n    ${fl.name}: ${fl.rooms} rooms, ${fl.doors} doors, ${fl.windows} windows; ${t(fl.fixtures)}`).join('')}`),
    ...f.walls.map(w => `  wall ${w.index}: ${w.kind}, ${w.length} long, ${w.towers} towers, gates ${w.gates.map(g => `${g.kind} at ${g.at.join(',')}`).join('; ') || 'none'}`),
    ...f.roads.map(r => `  road ${r.index}: ${r.kind}, ${r.length}${r.label ? ` "${r.label}"` : ''}`),
  ].join('\n');
}
