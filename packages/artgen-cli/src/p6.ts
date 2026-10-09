/**
 * Breadth commands (PLAN P6).
 *
 *   artgen texture <material> [--size 32|WxH] [--seed n] [--ramps base=stone,mortar=dirt] [--scale k] [--out dir]
 *       a material recipe under the project's direction → <material>.png, <material>.n.png (normal map) and a 3×3
 *       preview; prints the seam and repetition metrics (P6b)
 *   artgen texture --list
 *   artgen voxel <asset> [--version v] [--cell state/facing/frame] [--out dir] [--scale m]
 *       the 3D-mode model behind a render → <id>.vox (MagicaVoxel, one palette entry per material) and <id>.glb
 *       (greedy-meshed glTF, `scale` metres per voxel, default 0.1)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dirContext, encodeVox, Grid, material, MATERIALS, repetitionIssues, repetitionMetric, Scene3D, seamMetric, voxelGlb, voxFromSet, type Direction, type RepetitionMetric, type SeamMetric } from 'artgen-core';
import { writeGrid } from './node.ts';
import { renderVersion, versionsIn, type AssetDir } from './asset.ts';

export interface VoxelExport { vox: string; glb: string; voxels: number; materials: number; size: [number, number, number]; cell: string }

/** Export the 3D-mode model a version renders for one cell (default: its first cell). */
export async function voxelExport(a: AssetDir, o: { version?: string; cell?: string; out?: string; scale?: number } = {}): Promise<VoxelExport> {
  const version = o.version ?? versionsIn(a).filter(v => v.startsWith('base.')).pop();
  if (!version) throw new Error(`${a.brief.id}: no base version`);
  const scenes = new Map<string, Scene3D>();
  const r = await renderVersion(a, version, { onScene: (cell, sc) => { if (sc instanceof Scene3D && !scenes.has(cell)) scenes.set(cell, sc); } });
  const first = r.render.cells[0], cell = o.cell ?? `${first.state}/${first.facing}/${first.frame}`, scene = scenes.get(cell);
  if (!scene) throw new Error(`${a.brief.id} ${version}: ${scenes.size ? `no 3D scene for cell ${cell} (have ${[...scenes.keys()].join(', ')})` : 'renders no 3D-mode scene (ctx.lib.t2.scene3d)'}`);
  const set = scene.voxelSet(), vox = voxFromSet(set), out = o.out ?? join(a.path, 'out');
  mkdirSync(out, { recursive: true });
  const id = a.brief.id, voxFile = join(out, `${id}.vox`), glbFile = join(out, `${id}.glb`);
  writeFileSync(voxFile, encodeVox(vox));
  writeFileSync(glbFile, voxelGlb(set, { scale: o.scale ?? 0.1, name: id }));
  return { vox: relative(process.cwd(), voxFile), glb: relative(process.cwd(), glbFile), voxels: set.cells.length, materials: set.mats.length, size: vox.size, cell };
}

export interface TextureOut { files: string[]; seam: SeamMetric; repetition: RepetitionMetric; issues: string[]; ramps: Record<string, string> }

/** Render a material recipe under a direction (quick look; assets use `ctx.lib.tex.material`). */
export function textureRun(dir: Direction, name: string, o: { size: [number, number]; seed?: number; ramps?: Record<string, string>; scale?: number; out: string }): TextureOut {
  if (!MATERIALS.includes(name)) throw new Error(`unknown material ${name} (have: ${MATERIALS.join(', ')})`);
  const [w, h] = o.size, t = material(name, dirContext(dir), { w, h, seed: o.seed, ramps: o.ramps, scale: o.scale });
  const pre = new Grid(w * 3, h * 3);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) pre.blit(t.grid, i * w, j * h);
  const files = [join(o.out, `${name}.png`), join(o.out, `${name}.n.png`), join(o.out, `${name}-3x3@4x.png`)];
  writeGrid(files[0], t.grid); writeGrid(files[1], t.normal); writeGrid(files[2], pre.scale(4));
  const repetition = repetitionMetric(t.grid);
  return { files: files.map(f => relative(process.cwd(), f)), seam: seamMetric(t.grid), repetition, issues: repetitionIssues(repetition), ramps: t.ramps };
}
