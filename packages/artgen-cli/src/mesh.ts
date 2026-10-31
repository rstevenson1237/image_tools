/**
 * True 3D output and the converters (docs/MESHES.md, plan R7a):
 *
 *   artgen mesh <asset> [--version v] [--cell s/f/n] [--budget n] [--mode auto|smooth|faceted] [--texels n] [--look pbr|baked] [--scale m] [--out dir]
 *       the 3D-mode scene behind a render → <id>.mesh.glb (textured, under the budget) and <id>-turntable.png, with the mesh checks
 *   artgen turntable <asset> [--source mesh|voxel] [--angles n] [--pitch deg] [--size px] [--out file]
 *       the voxel or mesh model from fixed angles round it, side by side
 *   artgen convert <file.glb|file.vox> [--asset id] [--to vox|mesh] [--height m] [--k n] [--out file]
 *       voxelise an outside mesh (or take a .vox) at the direction's scale, colours snapped to its ramps
 *   artgen extrude <image.png|asset> [--depth px] [--asset id] [--to vox|mesh] [--out file]
 *       the opaque pixels as columns, standing up: a sign, a weapon, a flat prop with depth
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import {
  buildMesh, camera, decodePNG, decodeVox, encodeVox, glbTriangles, meshBudget, meshChecks, meshGlb, parseColor, parseVersion, pxPerMetre, readGlb, resolveSize, Scene3D, turntable, viewOfMesh,
  voxelizeTriangles, voxelViewMesh, worldLight, dirContext, type Direction, type Grid, type MeshCheck, type MeshMode, type MeshLook, type MeshResult, type V3, type VoxModel,
} from 'artgen-core';
import { passOf, renderVersion, versionsIn, type AssetDir } from './asset.ts';
import { writeGrid } from './node.ts';
import { appendLedger } from './workflow.ts';

/** The 3D-mode scene a version renders for one cell (default its first cell). */
export async function scene3dOf(a: AssetDir, o: { version?: string; cell?: string } = {}): Promise<{ scene: Scene3D; cell: string; version: string }> {
  const version = o.version ?? versionsIn(a).filter(v => v.startsWith('base.')).pop();
  if (!version) throw new Error(`${a.brief.id}: no base version`);
  const scenes = new Map<string, Scene3D>();
  const r = await renderVersion(a, version, { onScene: (cell, sc) => { if (sc instanceof Scene3D && !scenes.has(cell)) scenes.set(cell, sc); } });
  const first = r.render.cells[0], cell = o.cell ?? `${first.state}/${first.facing}/${first.frame}`, scene = scenes.get(cell);
  if (!scene) throw new Error(`${a.brief.id} ${version}: ${scenes.size ? `no 3D scene for cell ${cell} (have ${[...scenes.keys()].join(', ')})` : 'renders no 3D-mode scene (ctx.lib.t2.scene3d)'}`);
  return { scene, cell, version };
}

/**
 * Metres per model unit (decision 9): pixels per unit as the scene was drawn (raster `2 × scale`, cubes `2k`, stack slices
 * `scale × k`; 2 when it was not drawn), over the direction's pixels per metre.
 */
export function metresPerUnit(scene: Scene3D, dir: Direction): number {
  const r = scene.rendered, px = !r ? 2 : r.renderer === 'raster' ? 2 * r.scale : r.renderer === 'cubes' ? 2 * scene.k : r.scale * scene.k;
  return px / pxPerMetre(dir);
}

export interface MeshSettings { budget?: number; mode?: MeshMode; texels?: number; look?: MeshLook }

/** The brief's `mesh` settings under the ones given, with the kind's budget. */
const settingsOf = (a: AssetDir, o: MeshSettings): Required<MeshSettings> => ({
  budget: o.budget ?? a.brief.mesh?.budget ?? meshBudget(a.brief.kind), mode: o.mode ?? a.brief.mesh?.mode ?? 'auto',
  texels: o.texels ?? a.brief.mesh?.texels ?? 4, look: o.look ?? a.brief.mesh?.look ?? 'pbr',
});

const background = (a: AssetDir) => a.brief.review?.bg ?? a.dir.background ?? '#202028';

export interface MeshExport {
  asset: string; version: string; cell: string; glb: string; turntable: string;
  triangles: number; vertices: number; budget: number; mode: MeshMode; look: MeshLook; atlas: [number, number]; texels: number; charts: number;
  metresPerUnit: number; height: number; checks: MeshCheck[];
}

/** Mesh one cell's scene: the `.glb`, its turntable and the mesh checks. */
export async function meshExport(a: AssetDir, o: MeshSettings & { version?: string; cell?: string; out?: string; scale?: number } = {}): Promise<MeshExport & { result: MeshResult }> {
  const { scene, cell, version } = await scene3dOf(a, o), set = settingsOf(a, o), r = buildMesh(scene, set), mpu = o.scale ?? metresPerUnit(scene, a.dir);
  const out = o.out ?? join(a.path, 'out'), id = a.brief.id, glb = join(out, `${id}.mesh.glb`), tt = join(out, `${id}-turntable.png`);
  mkdirSync(out, { recursive: true });
  writeFileSync(glb, meshGlb(r, { name: id, metresPerUnit: mpu }));
  writeGrid(tt, turntable(viewOfMesh(r), { light: worldLight(a.dir).light, background: background(a) }));
  const checks = meshChecks(r.mesh, { budget: set.budget, atlas: r.atlas, texels: r.texels, metresPerUnit: mpu, height: a.brief.height });
  return {
    asset: id, version, cell, glb: relative(process.cwd(), glb), turntable: relative(process.cwd(), tt), triangles: r.mesh.indices.length / 3, vertices: r.mesh.positions.length / 3,
    budget: set.budget, mode: set.mode, look: set.look, atlas: r.atlas, texels: r.texels, charts: r.charts, metresPerUnit: mpu,
    height: Math.round((r.bounds[5] - r.bounds[2]) * mpu * 1000) / 1000, checks, result: r,
  };
}

/** The voxel or mesh model of one cell from `angles` yaws round it. */
export async function turntableOf(a: AssetDir, o: MeshSettings & { version?: string; cell?: string; source?: 'mesh' | 'voxel'; angles?: number; pitch?: number; size?: number } = {}): Promise<{ grid: Grid; version: string; cell: string; source: 'mesh' | 'voxel' }> {
  const { scene, cell, version } = await scene3dOf(a, o), source = o.source ?? 'mesh';
  const view = source === 'voxel' ? voxelViewMesh(scene.voxelSet(), scene.k) : viewOfMesh(buildMesh(scene, settingsOf(a, o)));
  const grid = turntable(view, { angles: o.angles, pitch: o.pitch, w: o.size, h: o.size, light: worldLight(a.dir).light, background: background(a) });
  return { grid, version, cell, source };
}

// ---- convert and extrude

/** Coloured voxels on their way into the pipeline (from an outside mesh, a `.vox` or a picture). */
interface Cells { size: V3; cells: { v: V3; rgb: [number, number, number] }[] }

/** The ramps an asset's kind may use (all of them without an asset). */
const rolesOf = (dir: Direction, kind?: string): string[] => ((kind && dir.palette.perKind[kind]) || Object.keys(dir.palette.ramps)).filter(r => dir.palette.ramps[r]);

/** Of `roles`, the one with the step nearest the colour. */
function nearestRole(dir: Direction, roles: string[], rgb: [number, number, number]): string {
  let best = roles[0], bd = Infinity;
  for (const role of roles) for (const c of dir.palette.ramps[role]) {
    const [r, g, b] = parseColor(c), d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bd) { bd = d; best = role; }
  }
  return best;
}

/** Snap each voxel to a role and pack them as a `.vox`: one palette entry per role (its middle step), roles in name order. */
function snapToVox(c: Cells, dir: Direction, roles: string[]): { model: VoxModel; mats: Record<number, string> } {
  const memo = new Map<string, string>(), roleOf = (rgb: [number, number, number]) => { const k = rgb.join(','); let r = memo.get(k); if (!r) memo.set(k, (r = nearestRole(dir, roles, rgb))); return r; };
  const used = [...new Set(c.cells.map(x => roleOf(x.rgb)))].sort(), index = new Map(used.map((r, i) => [r, i + 1]));
  if (used.length > 255) throw new Error('convert: more than 255 materials');
  const palette = Array.from({ length: 256 }, (_, i) => { const ramp = dir.palette.ramps[used[i]]; return ramp ? ramp[ramp.length >> 1] : '#000000'; });
  return { model: { size: c.size, palette, voxels: c.cells.map(x => [x.v[0], x.v[1], x.v[2], index.get(roleOf(x.rgb))!]) }, mats: Object.fromEntries(used.map((r, i) => [i + 1, r])) };
}

/** A `.vox`'s own voxels and colours. */
const voxToCells = (m: VoxModel): Cells => ({ size: m.size, cells: m.voxels.map(([x, y, z, c]) => ({ v: [x, y, z] as V3, rgb: parseColor(m.palette[c - 1]).slice(0, 3) as [number, number, number] })) });

export interface ConvertResult {
  from: string; size: V3; voxels: number; k: number; mats: Record<number, string>;
  /** What was written: the asset's next base, or a file. */
  asset?: string; version?: string; file: string; triangles?: number; warnings: string[];
}

interface Into { asset?: AssetDir; dir: Direction; to?: 'vox' | 'mesh'; out?: string; ledger?: string }

/** Write converted voxels: the asset's next `base.vN.js` (with a ledger note), or a `.vox`, or a mesh `.glb`. */
function writeCells(c: Cells, k: number, into: Into, src: { from: string; tool: 'convert' | 'extrude'; file?: string; options: Record<string, unknown> }, warnings: string[]): ConvertResult {
  const a = into.asset, roles = rolesOf(into.dir, a?.brief.kind), { model, mats } = snapToVox(c, into.dir, roles), bytes = encodeVox(model);
  const base = { from: src.from, size: c.size, voxels: c.cells.length, k, mats, warnings };
  if (a) {
    const n = Math.max(0, ...versionsIn(a).map(v => parseVersion(v)).filter(v => v?.kind === 'base').map(v => v!.n)) + 1, version = `base.v${n}`, file = join(a.path, `${version}.js`);
    const view = a.brief.view ?? a.dir.camera.view, pass = passOf(a, version), list = Object.values(mats).join(', '), name = basename(src.from).replace(/[^\w.\- ]/g, '_');
    const draw = view === 'stack'
      ? '  return model(ctx).slices(w, h)[ctx.frame] ?? new ctx.lib.Grid(w, h);'
      : `  return model(ctx).render(w, h, { renderer: 'raster', view: ${JSON.stringify(view === 'fp' ? 'billboard' : view)}, facing: ctx.facing${view === 'topdown' ? ', at: [w / 2, h / 2]' : ''} });`;
    const source = [
      `// ${a.brief.id} ${version} (${pass}) — ${src.tool === 'convert' ? 'converted' : 'extruded'} from ${name} by \`artgen ${src.tool}\`: ${c.size.join('x')} voxels in ${Object.keys(mats).length} material${Object.keys(mats).length === 1 ? '' : 's'} (${list}), k = ${k}.`,
      '// The model is the voxels as they came in. Shape and decorate it in the next pass: change a colour\'s material in MATS, add slabs and parts.',
      `export const meta = { brief: ${JSON.stringify(a.brief.id)}, pass: ${JSON.stringify(pass)}, notes: ${JSON.stringify(`${src.tool === 'convert' ? 'converted' : 'extruded'} from ${name}`)} };`,
      '',
      '// a MagicaVoxel .vox, base64; its palette index → the direction\'s material',
      `const VOX = '${Buffer.from(bytes).toString('base64')}';`,
      `const MATS = ${JSON.stringify(mats)};`,
      '',
      'export function model(ctx) {',
      `  return ctx.lib.t2.scene3d({ k: ${k} }).addVox(ctx.lib.t2.vox(VOX), { mats: MATS });`,
      '}',
      '',
      'export function render(ctx) {',
      '  const [w, h] = ctx.size;',
      draw,
      '}',
      '',
    ].join('\n');
    writeFileSync(file, source);
    const hash = src.file ? createHash('sha256').update(readFileSync(src.file)).digest('hex').slice(0, 16) : undefined;
    appendLedger(into.ledger ?? a.ledgerPath, { type: 'note', asset: a.brief.id, version, by: 'agent', note: `${version} ${src.tool === 'convert' ? 'converted' : 'extruded'} from ${name}`, source: { tool: src.tool, from: name, ...(hash && { sha256: hash }), ...src.options, k } });
    return { ...base, asset: a.brief.id, version, file: relative(process.cwd(), file) };
  }
  if (into.to === 'mesh') {
    const s = new Scene3D(dirContext(into.dir), { k }).addVox(model, { mats }), r = buildMesh(s, { budget: meshBudget() }), file = resolve(into.out ?? `${src.from.replace(/\.[^.]+$/, '')}.mesh.glb`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, meshGlb(r, { name: basename(file).replace(/\.mesh\.glb$|\.glb$/, ''), metresPerUnit: 2 / pxPerMetre(into.dir) }));
    return { ...base, file: relative(process.cwd(), file), triangles: r.mesh.indices.length / 3 };
  }
  const file = resolve(into.out ?? `${src.from.replace(/\.[^.]+$/, '')}.vox`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  return { ...base, file: relative(process.cwd(), file) };
}

/**
 * Voxels a model unit for a `.vox` going into an asset: as tall as the brief's height says (2 px a unit, decision 9), else
 * the fewest that keep it inside the frame, 2 px clear, in the asset's view at any facing (its footprint read as a circle).
 */
function voxK(a: AssetDir, size: V3): number {
  if (a.brief.height) return size[2] / ((a.brief.height * pxPerMetre(a.dir)) / 2);
  const view = a.brief.view ?? a.dir.camera.view, [w, h] = resolveSize(a.dir, a.brief.size, a.brief.kind);
  if (view === 'stack') return 1;
  const cam = camera(view === 'fp' ? 'billboard' : view, { frontRatio: a.dir.camera.oblique?.frontRatio }), at = view === 'topdown' ? [w / 2, h / 2] : [w / 2, Math.round(h * 0.8)];
  const r = Math.hypot(size[0], size[1]) / 2, room = [w - 2 - at[0], at[0] - 2, h - 2 - at[1], at[1] - 2];
  let k = 0.01;
  for (const z of [0, size[2]]) for (const x of [-r, r]) for (const y of [-r, r]) {
    const sx = cam.M[0][0] * x + cam.M[0][1] * y + cam.M[0][2] * z, sy = cam.M[1][0] * x + cam.M[1][1] * y + cam.M[1][2] * z;
    k = Math.max(k, sx / room[0], -sx / room[1], sy / room[2], -sy / room[3]);
  }
  return Math.ceil(k * 100) / 100;
}

export function convertFile(file: string, into: Into, o: { height?: number; k?: number } = {}): ConvertResult {
  if (!existsSync(file)) throw new Error(`${file}: not found`);
  const path = resolve(file), bytes = new Uint8Array(readFileSync(path)), unitsPerMetre = pxPerMetre(into.dir) / 2, warnings: string[] = [];
  if (/\.vox$/i.test(file)) {
    const m = decodeVox(bytes);
    if (!m.voxels.length) throw new Error(`${file}: no voxels`);
    // as many voxels a unit as make it as tall as asked: --height, else the asset's world height or frame, else one a unit
    const k = o.k ?? (o.height ? Math.round((m.size[2] / (o.height * unitsPerMetre)) * 100) / 100 : into.asset ? voxK(into.asset, m.size) : 1);
    return writeCells(voxToCells(m), k, into, { from: file, tool: 'convert', file: path, options: { ...(o.height && { height: o.height }) } }, warnings);
  }
  if (!/\.glb$/i.test(file)) throw new Error(`${file}: convert reads .glb and .vox files`);
  const t = glbTriangles(readGlb(bytes));
  warnings.push(...t.warnings);
  let zlo = Infinity, zhi = -Infinity;
  for (let i = 2; i < t.positions.length; i += 3) { zlo = Math.min(zlo, t.positions[i]); zhi = Math.max(zhi, t.positions[i]); }
  const own = Math.max(1e-6, zhi - zlo), k = o.k ?? 1, metres = o.height ?? own, perMetre = (unitsPerMetre * k * metres) / own;
  const v = voxelizeTriangles(t, { perMetre });
  if (!v.cells.length) throw new Error(`${file}: nothing to voxelise at ${perMetre.toFixed(2)} voxels a metre`);
  return writeCells(v, k, into, { from: file, tool: 'convert', file: path, options: { ...(o.height && { height: o.height }) } }, warnings);
}

/** The opaque pixels of a picture (alpha ≥ 128) as columns `depth` voxels deep, standing up (the picture's plane is x–z). */
export function extrudeGrid(g: Grid, depth: number): Cells {
  const cells: Cells['cells'] = [];
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.d[(y * g.w + x) * 4 + 3] >= 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) throw new Error('extrude: the picture has no opaque pixels');
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * g.w + x) * 4;
    if (g.d[i + 3] < 128) continue;
    for (let d = 0; d < depth; d++) cells.push({ v: [x - x0, d, y1 - y], rgb: [g.d[i], g.d[i + 1], g.d[i + 2]] });
  }
  return { size: [x1 - x0 + 1, depth, y1 - y0 + 1], cells };
}

export async function extrudeRun(target: string, into: Into & { source?: AssetDir }, o: { depth?: number; version?: string } = {}): Promise<ConvertResult> {
  const depth = o.depth ?? 4;
  if (!(Number.isInteger(depth) && depth >= 1 && depth <= 64)) throw new Error('--depth: a whole number of pixels from 1 to 64');
  let g: Grid, from = target, file: string | undefined;
  if (into.source) {
    const a = into.source, version = o.version ?? versionsIn(a).at(-1);
    if (!version) throw new Error(`${a.brief.id}: no versions yet`);
    g = (await renderVersion(a, version)).render.cells[0].grid; from = `${a.brief.id} ${version}`;
  } else {
    if (!existsSync(target)) throw new Error(`${target}: not found`);
    file = resolve(target); g = decodePNG(new Uint8Array(readFileSync(file)));
  }
  // a pixel is half a model unit (the sprites' 2 px a unit), so the extruded model is as large as the picture
  return writeCells(extrudeGrid(g, depth), 2, into, { from, tool: 'extrude', file, options: { depth } }, []);
}
