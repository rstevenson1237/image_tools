/**
 * True 3D output and the converters (docs/MESHES.md §10, plan R7a): `mesh` (a 3D-mode asset as a textured `.glb` under a
 * triangle budget, with its turntable and the mesh checks), `turntable` (the voxel or mesh model from fixed angles; an MCP
 * tool, so a reviewer can see it), `convert` (an outside `.glb` or a `.vox` in, voxelised at the direction's scale) and
 * `extrude` (a picture or a 2D asset as a slab with depth). The work is in `../mesh.ts`.
 */
import { join } from 'node:path';
import type { Direction } from 'artgen-core';
import { convertFile, extrudeRun, meshExport, turntableOf } from '../mesh.ts';
import { writeGrid } from '../node.ts';
import { assetOf, assetParam, directionParam, image, ledgerParam, toolDirection, type Inp } from './art-shared.ts';
import { defineOp, p, type Ctx } from './registry.ts';

const MODES = ['auto', 'smooth', 'faceted'] as const, LOOKS = ['pbr', 'baked'] as const;
const meshParams = () => ({
  budget: p.int('triangles at most (default: the brief\'s mesh.budget, else by kind: character 4000, prop 1500, tile 500, …)'),
  mode: p.oneOf(MODES, 'auto: smooth normals for toon parts, faceted for flat ones (default); smooth or faceted for every part'),
  texels: p.num('texels per model unit (default 4)'), look: p.oneOf(LOOKS, 'pbr: colour, normal and roughness textures (default); baked: the direction\'s banded light in the colour, unlit'),
});
const settings = (i: Inp) => ({ budget: i.budget, mode: i.mode, texels: i.texels, look: i.look });
const checkLines = (cs: { id: string; status: string; detail: string }[]) => cs.map(c => `  ${c.status === 'fail' ? 'FAIL' : c.status.padEnd(4)} ${c.id.padEnd(14)} ${c.detail}`);

export const mesh = defineOp({
  name: 'mesh', module: 'art', effect: 'render', summary: 'Export a 3D-mode asset as a true 3D mesh: a textured .glb under a triangle budget, its turntable and the mesh checks.',
  params: {
    asset: assetParam(), version: p.str('the base version; default the latest'), cell: p.str('the cell, state/facing/frame (default the first)'), ...meshParams(),
    scale: p.num('metres per model unit (default: as the sprite is drawn, at the direction\'s pixels per metre)'), out: p.str('the output folder (default the asset\'s out/)'), direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    const { result: _, ...r } = await meshExport(assetOf(ctx, i), { ...settings(i), version: i.version, cell: i.cell, out: i.out, scale: i.scale });
    return r;
  },
  cli: {
    usage: '       artgen mesh <asset> [--version v] [--cell s/f/n] [--budget n] [--mode auto|smooth|faceted] [--texels n] [--look pbr|baked] [--scale m] [--out dir]',
    text: r => [
      `${r.asset} ${r.version} ${r.cell}: ${r.triangles} triangles (budget ${r.budget}), ${r.vertices} vertices, ${r.mode} ${r.look}, ${r.atlas.join('x')} atlas at ${r.texels} texels a unit, ${r.height} m tall`,
      ...checkLines(r.checks), `  ${r.glb}`, `  ${r.turntable}`,
    ].join('\n'),
    exit: r => (r.checks.some((c: any) => c.status === 'fail') ? 1 : 0),
  },
  mcp: { exclude: 'writes model files for the game; run from the CLI' }, python: {},
});

export const turntable = defineOp({
  name: 'turntable', module: 'art', effect: 'render', summary: 'The voxel or mesh model of a 3D-mode asset from fixed angles round it, side by side.',
  description: 'The voxel or mesh model of a 3D-mode asset seen from fixed angles round it (8 by default, every 45° from the front) with the perspective camera, side by side: how the asset reads as true 3D. source: mesh (default) or voxel.',
  params: {
    asset: assetParam(), version: p.str('the base version; default the latest'), cell: p.str('the cell, state/facing/frame (default the first)'),
    source: p.oneOf(['mesh', 'voxel'], 'the mesh (default) or the voxels'), angles: p.int('views round the model (default 8)'), pitch: p.num('degrees above the horizon (default 20)'),
    size: p.int('pixels a view (default 96)'), ...meshParams(), out: p.str('the PNG to write (default the asset\'s out/<id>-turntable-<source>.png)', { mcp: false }), direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx: Ctx) {
    const a = assetOf(ctx, i), r = await turntableOf(a, { ...settings(i), version: i.version, cell: i.cell, source: i.source, angles: i.angles, pitch: i.pitch, size: i.size });
    let file: string | undefined;
    if (ctx.surface === 'cli') { const f: string = i.out ?? join(a.path, 'out', `${a.brief.id}-turntable-${r.source}.png`); writeGrid(f, r.grid); file = f; }
    return { asset: a.brief.id, version: r.version, cell: r.cell, source: r.source, size: [r.grid.w, r.grid.h], file, grid: r.grid };
  },
  cli: {
    usage: '       artgen turntable <asset> [--source mesh|voxel] [--angles n] [--pitch deg] [--size px] [--version v] [--cell s/f/n] [--out file.png]',
    text: r => `${r.asset} ${r.version} ${r.cell}: ${r.source} turntable ${r.size.join('x')} → ${r.file}`,
    json: r => ({ asset: r.asset, version: r.version, cell: r.cell, source: r.source, size: r.size, file: r.file }),
  },
  mcp: { content: r => [image(r.grid)] }, python: {},
});

const BY_PATH_MODEL = 'reads a model or picture by path outside the art/ sandbox';

/** Where converted voxels go: an asset (its next base), else a file, under the direction given, found, or of the asset extruded. */
function intoOf(i: Inp, ctx: Ctx, cmd: string, dir?: Direction) {
  if (i.asset) { const a = ctx.asset!(i.asset, { direction: i.direction, ledger: i.ledger }); return { asset: a, dir: a.dir, ledger: i.ledger }; }
  return { dir: dir && !i.direction ? dir : toolDirection(cmd, ctx.findProject(), i.direction).dir, to: i.to as 'vox' | 'mesh' | undefined, out: i.out };
}

const convertText = (r: any) => [
  `${r.from} → ${r.asset ? `${r.asset} ${r.version}` : r.file}: ${r.size.join('x')} voxels (${r.voxels}), k = ${r.k}, ${Object.values(r.mats).join(', ')}${r.triangles ? `, ${r.triangles} triangles` : ''}`,
  ...(r.asset ? [`  ${r.file}`, `next: artgen render ${r.asset} --version ${r.version}, then review it`] : []), ...r.warnings.map((w: string) => `  warning: ${w}`),
].join('\n');

export const convert = defineOp({
  name: 'convert', module: 'art', effect: 'write', summary: 'Bring an outside .glb or .vox in: voxelised at the direction\'s scale, colours snapped to its ramps, as an asset\'s next base, a .vox or a mesh .glb.',
  params: {
    file: p.str('the model: a .glb (binary glTF 2.0) or a MagicaVoxel .vox', { positional: true, required: 'convert: <file.glb|file.vox>' }),
    asset: p.str('write this asset\'s next base.vN.js (a brief id or an asset directory), recorded in the ledger'),
    to: p.oneOf(['vox', 'mesh'], 'without --asset: write a .vox (default) or a mesh .glb'),
    height: p.num('metres tall (default: a .glb\'s own size; a .vox fits the asset\'s height or frame)'), k: p.num('voxels per model unit (default 1; a .vox: what fits the height)'),
    out: p.str('without --asset: the file to write (default beside the input)'), direction: directionParam(), ledger: ledgerParam(),
  },
  run: (i: Inp, ctx) => convertFile(i.file, intoOf(i, ctx, 'convert'), { height: i.height, k: i.k }),
  cli: { usage: '       artgen convert <file.glb|file.vox> [--asset id] [--to vox|mesh] [--height m] [--k n] [--out file]', text: convertText },
  mcp: { exclude: BY_PATH_MODEL }, python: {},
});

export const extrude = defineOp({
  name: 'extrude', module: 'art', effect: 'write', summary: 'A picture (or a 2D asset\'s render) as a slab with depth: its opaque pixels as columns, standing up, as an asset\'s next base, a .vox or a mesh .glb.',
  params: {
    target: p.str('a picture (PNG) or an asset whose latest version to extrude', { positional: true, required: 'extrude: <image.png|asset>' }),
    depth: p.int('pixels deep (default 4)'), version: p.str('an asset target: the version (default the latest)'),
    asset: p.str('write this asset\'s next base.vN.js (a brief id or an asset directory), recorded in the ledger'),
    to: p.oneOf(['vox', 'mesh'], 'without --asset: write a .vox (default) or a mesh .glb'), out: p.str('without --asset: the file to write (default beside the input)'),
    direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    const picture = /\.png$/i.test(i.target), source = picture ? undefined : ctx.asset!(i.target, { direction: i.direction, ledger: i.ledger });
    const into = intoOf({ ...i, out: i.out ?? (source ? join(source.path, 'out', `${source.brief.id}-extruded.${i.to === 'mesh' ? 'mesh.glb' : 'vox'}`) : undefined) }, ctx, 'extrude', source?.dir);
    return extrudeRun(i.target, { ...into, source }, { depth: i.depth, version: i.version });
  },
  cli: { usage: '       artgen extrude <image.png|asset> [--depth px] [--version v] [--asset id] [--to vox|mesh] [--out file]', text: convertText },
  mcp: { exclude: BY_PATH_MODEL }, python: {},
});

export const MESH_OPS = [mesh, turntable, convert, extrude];
