/**
 * Breadth commands (PLAN P6).
 *
 *   artgen texture <material> [--size 32|WxH] [--seed n] [--ramps base=stone,mortar=dirt] [--scale k] [--out dir]
 *       a material recipe under the project's direction → <material>.png, <material>.n.png (normal map) and a 3×3
 *       preview; prints the seam and repetition metrics (P6b)
 *   artgen texture --list
 *   artgen anim <asset> [--version v] [--state s] [--facing f] [--scale n] [--out dir]
 *       animation previews (P6c): a GIF and an APNG per state, timed like the export (durations, sub-frames)
 *   artgen fx <preset> [--size 32|WxH] [--frames 8] [--seed n] [--scale n] [--out dir] | fx --list
 *       a particle preset under the project's direction: strip, onion skin, GIF, APNG and the solid-fill numbers
 *   artgen voxel <asset> [--version v] [--cell state/facing/frame] [--out dir] [--scale m]
 *       the 3D-mode model behind a render → <id>.vox (MagicaVoxel, one palette entry per material) and <id>.glb
 *       (greedy-meshed glTF, `scale` metres per voxel, default 0.1)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  dirContext, displayDurations, encodeAPNG, encodeGIF, encodeVox, fillQA, Grid, material, MATERIALS, onionSkin, particles, post, preset, repetitionIssues, repetitionMetric,
  Scene3D, seamMetric, stateDefs, voxelGlb, voxFromSet, type Direction, type RepetitionMetric, type SeamMetric,
} from 'artgen-core';
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

export interface AnimOut { files: string[]; states: { state: string; facing: string; frames: number; ms: number }[] }

/**
 * Animation previews of a version (P6c): one GIF and one APNG per state × facing (unique facings; default the first),
 * scaled by `scale`, timed by the exported playback (fps or per-frame durations; sub-frames split their frame).
 */
export async function animPreview(a: AssetDir, o: { version?: string; state?: string; facing?: string; scale?: number; out?: string } = {}): Promise<AnimOut> {
  const version = o.version ?? versionsIn(a).pop();
  if (!version) throw new Error(`${a.brief.id}: no versions yet`);
  const { render: r } = await renderVersion(a, version), out = o.out ?? join(a.path, 'out'), sc = o.scale ?? a.brief.review?.scale ?? 4;
  const defs = stateDefs(a.brief, a.dir, Object.fromEntries(r.states.map(s => [s, r.frames[s] / Math.max(1, Math.floor(a.brief.anims?.[s]?.sub ?? 1))])));
  const states = o.state ? [o.state] : r.states, facings = o.facing ? [o.facing] : [r.facings[0]];
  for (const s of states) if (!r.states.includes(s)) throw new Error(`${a.brief.id}: no state ${s} (has ${r.states.join(', ')})`);
  for (const f of facings) if (!r.facings.includes(f)) throw new Error(`${a.brief.id}: no facing ${f} (has ${r.facings.join(', ')})`);
  mkdirSync(out, { recursive: true });
  const res: AnimOut = { files: [], states: [] };
  for (const s of states) for (const f of facings) {
    const frames = r.cells.filter(c => c.state === s && c.facing === f).sort((x, y) => x.frame - y.frame).map(c => c.grid.scale(sc)), d = displayDurations(defs[s]);
    const base = join(out, `${a.brief.id}-${version}-${s}-${f}`);
    writeFileSync(`${base}.gif`, encodeGIF(frames, d));
    writeFileSync(`${base}.apng`, encodeAPNG(frames, d));
    res.files.push(relative(process.cwd(), `${base}.gif`), relative(process.cwd(), `${base}.apng`));
    res.states.push({ state: s, facing: f, frames: frames.length, ms: d.reduce((x, y) => x + y, 0) });
  }
  return res;
}

export interface FxOut { files: string[]; fill: ReturnType<typeof fillQA>; frames: number }

/** Quick look at a particle preset under a direction (assets use `ctx.lib.fx`): strip, onion skin, GIF and APNG. */
export function fxRun(dir: Direction, name: string, o: { size: [number, number]; frames: number; seed?: number; scale?: number; out: string; fps?: number }): FxOut {
  const dc = dirContext(dir), [w, h] = o.size, fps = o.fps ?? dir.effects.fps, duration = (o.frames * 1000) / fps, sc = o.scale ?? 4;
  const line = dir.line.outer === 'none' ? false : (g: Grid) => (dir.line.outer === 'selout' ? post.selout(g, Object.values(dc.pal), dc.outline) : post.outline(g, dc.outline));
  const layers = preset(name, { w, h, duration });
  const frames = Array.from({ length: o.frames }, (_, i) => particles(dc, { w, h, t: i / o.frames, duration, layers, seed: o.seed ?? 1, line }));
  mkdirSync(o.out, { recursive: true });
  const strip = new Grid(o.frames * (w + 1) - 1, h);
  frames.forEach((f, i) => strip.blit(f, i * (w + 1), 0));
  const files = [join(o.out, `${name}.png`), join(o.out, `${name}-onion@${sc}x.png`), join(o.out, `${name}.gif`), join(o.out, `${name}.apng`)];
  writeGrid(files[0], strip); writeGrid(files[1], onionSkin(frames).scale(sc));
  const big = frames.map(f => f.scale(sc)), d = frames.map(() => Math.round(1000 / fps));
  writeFileSync(files[2], encodeGIF(big, d)); writeFileSync(files[3], encodeAPNG(big, d));
  return { files: files.map(f => relative(process.cwd(), f)), fill: fillQA(frames, dir), frames: o.frames };
}
