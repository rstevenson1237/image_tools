/**
 * Breadth commands (PLAN P6): voxel exports. (`texture` and `fx` join this file with P6b / P6c.)
 *
 *   artgen voxel <asset> [--version v] [--cell state/facing/frame] [--out dir] [--scale m]
 *       the 3D-mode model behind a render → <id>.vox (MagicaVoxel, one palette entry per material) and <id>.glb
 *       (greedy-meshed glTF, `scale` metres per voxel, default 0.1)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { encodeVox, Scene3D, voxelGlb, voxFromSet } from 'artgen-core';
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
