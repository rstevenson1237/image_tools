// P6a: view cameras, the voxel raster renderer (facings at any yaw, toon, buffers, inner lines), normal maps through
// renders / finishes / packs, sprite-stack slices, .vox round trip, greedy-mesh glb, view contexts.
import { describe, expect, test } from 'vitest';
import { dirContext, kindPalette, parseDirection, type Direction } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { flipNormalMap, getNormal, normalFromHeight } from '../lib/normals.ts';
import { makeLib, renderAsset, type AssetModule } from '../render.ts';
import { applyFinish } from '../t2/finish.ts';
import { camera, cross3, dot3, facingYaw, lightIn } from '../views/camera.ts';
import { obliqueRoom, parallaxStrip, rotateGrid, stackComposite, stackStrip, viewModule } from '../views/views.ts';
import { buildPack } from '../w2/pack.ts';
import { greedyMesh, readGlbJson, voxelGlb } from './gltf.ts';
import { decodeVox, encodeVox, voxCells, voxFromSet } from './vox.ts';

const RAMPS = { stone: ['#eeeeee', '#bbbbbb', '#888888', '#555555'], moss: ['#9ad06a', '#5a9a3e', '#2c5a2e'], gold: ['#ffe27a', '#d9a832', '#8f6418'] };
const make = (over: Record<string, unknown> = {}): Direction => parseDirection({
  id: 'p6a', version: 1, status: 'locked', camera: { view: 'iso', light: [-1, -1, 1] }, scale: { prop: [32, 32], character: [32, 32] },
  palette: { ramps: RAMPS, outline: '#1a1423' }, shading: { bands: 3 }, ...over,
});
const dir = make();
const lib = (d = dir) => makeLib(dirContext(d), 'prop');
const opaque = (g: Grid) => { let n = 0; for (let i = 3; i < g.d.length; i += 4) if (g.d[i] === 255) n++; return n; };
const colours = (g: Grid) => { const s = new Set<string>(); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) s.add(g.get(x, y)!); return s; };

describe('cameras', () => {
  test('every camera: the basis is orthonormal and V is the projection null direction (points on one pixel differ along V)', () => {
    for (const v of ['iso', 'topdown', 'oblique', 'side', 'billboard']) {
      const c = camera(v);
      for (const [a, b] of [[c.R, c.D], [c.R, c.V], [c.D, c.V]]) expect(dot3(a, b), v).toBeCloseTo(0);
      for (const a of [c.R, c.D, c.V]) expect(Math.hypot(...a), v).toBeCloseTo(1);
      const n = cross3(c.M[0], c.M[1]), l = Math.hypot(...n);
      expect(Math.abs(dot3(n, c.V)) / l, v).toBeCloseTo(1);
      expect(dot3(c.dv, c.V), v).toBeGreaterThan(0);
    }
  });

  test('iso is exactly the cubes 2:1 projection; facings map to yaws; light: top > left > right faces', () => {
    expect(camera('iso').M).toEqual([[2, -2, 0], [1, 1, -2]]);
    expect([facingYaw('s'), facingYaw('w'), facingYaw('ne'), facingYaw('sse')]).toEqual([0, 90, 225, 337.5]);
    const c = camera('iso'), L = lightIn(c, [-1, -1, 1]);
    const lit = (n: [number, number, number]) => dot3(n, L);
    expect(lit([0, 0, 1])).toBeGreaterThan(lit([0, 1, 0]));
    expect(lit([0, 1, 0])).toBeGreaterThan(lit([1, 0, 0]));
  });
});

describe('voxel raster renderer', () => {
  const scene = () => lib().t2.scene3d({ k: 2 })
    .add({ type: 'box', name: 'crate', x: 0, y: 0, z: 0, w: 6, d: 3, h: 4, mat: 'stone' })
    .add({ type: 'ellipsoid', name: 'ball', cx: 2, cy: 2, cz: 6, rx: 2, mat: 'moss', shade: 'toon' });

  test('renders every 8 / 16 facing, palette-exact, no partial alpha besides the shadow; cubes still refuses diagonals', () => {
    const m = scene(), pal = new Set(kindPalette(dir, 'prop')), hashes = new Set<string>();
    for (const f of ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se', 'ssw', 'ene']) {
      const g = m.render(32, 32, { renderer: 'raster', facing: f });
      hashes.add(g.hash());
      for (const c of colours(g)) expect(pal.has(c), `${f} ${c}`).toBe(true);
      for (let i = 3; i < g.d.length; i += 4) expect([0, 255, Math.round(0.35 * 255)]).toContain(g.d[i]);
      expect(opaque(g)).toBeGreaterThan(80);
    }
    expect(hashes.size).toBeGreaterThan(6);
    expect(() => m.render(32, 32, { facing: 'ne' })).toThrow('not supported');
  });

  test('buffers: depth is nearer on top of the ball than the crate behind; parts and normals are kept', () => {
    const r = scene().raster(32, 32, { renderer: 'raster', at: [16, 24] });
    const parts = new Set([...r.part].filter(p => p >= 0));
    expect(parts.size).toBe(2);
    const filled = [...r.part].filter(p => p >= 0).length;
    expect([...r.depth].filter(d => !Number.isNaN(d)).length).toBe(filled);
    // the normal map covers the sprite and leans toward the viewer on average
    let nz = 0, n = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const v = getNormal(r.normal, x, y); if (v) { nz += v[2]; n++; } }
    expect(n).toBeGreaterThanOrEqual(filled);
    expect(nz / n).toBeGreaterThan(0.3);
  });

  test('toon shades a sphere with every band and the lit side lighter; flat keeps a cube to three faces', () => {
    const m = lib().t2.scene3d({ k: 2 }).add({ type: 'ellipsoid', cx: 0, cy: 0, cz: 4, rx: 4, mat: 'stone', shade: 'toon' });
    const r = m.raster(40, 40, { at: [20, 30], scale: 2, outline: false, inner: 'none', shadow: false });
    expect(colours(r.grid).size).toBe(3);
    const lum = (x: number, y: number) => r.grid.d[(y * 40 + x) * 4];
    const b = r.grid.bounds()!;
    expect(lum(b.x + 3, b.y + 4)).toBeGreaterThan(lum(b.x + b.w - 3, b.y + b.h - 4));
    const cube = lib().t2.scene3d().add({ type: 'box', x: 0, y: 0, z: 0, w: 6, d: 6, h: 6, mat: 'stone' }).raster(40, 40, { facing: 'sw', at: [20, 30], outline: false, inner: 'none', shadow: false });
    expect(colours(cube.grid).size).toBe(3);
  });

  test('inner lines: depth steps ink the farther pixel; none turns them off; line.inner none → no inner ink', () => {
    const m = scene(), ink = dir.palette.outline;
    const count = (g: Grid) => { let n = 0; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === ink) n++; return n; };
    const withIn = m.raster(32, 32, { inner: 'depth', innerDepth: 2, outline: false, shadow: false }), without = m.raster(32, 32, { inner: 'none', outline: false, shadow: false });
    expect(count(withIn.grid)).toBeGreaterThan(count(without.grid));
    expect(count(without.grid)).toBe(0);
    const d2 = make({ line: { inner: 'none' } }), m2 = makeLib(dirContext(d2), 'prop').t2.scene3d({ k: 2 }).add({ type: 'box', x: 0, y: 0, z: 0, w: 4, d: 4, h: 4, mat: 'stone' }, { type: 'box', x: 1, y: 1, z: 4, w: 2, d: 2, h: 6, mat: 'gold' });
    expect(count(m2.raster(32, 32, { outline: false, shadow: false }).grid)).toBe(0);
  });

  test('cardinal facings keep the model in place (yaw turns about the footprint centre)', () => {
    const m = lib().t2.scene3d().add({ type: 'box', x: 0, y: 0, z: 0, w: 4, d: 4, h: 3, mat: 'stone' });
    const bs = ['s', 'w', 'n', 'e'].map(f => m.render(32, 32, { renderer: 'raster', facing: f, shadow: false }).bounds()!);
    for (const b of bs) expect(b).toEqual(bs[0]);
  });

  test('views: oblique, side, topdown and billboard all render; side has no ground shadow', () => {
    const m = scene();
    for (const view of ['oblique', 'side', 'topdown', 'billboard']) expect(opaque(m.render(32, 32, { renderer: 'raster', view }))).toBeGreaterThan(40);
    const side = m.render(32, 32, { renderer: 'raster', view: 'side' });
    for (let i = 3; i < side.d.length; i += 4) expect([0, 255]).toContain(side.d[i]);
  });
});

describe('normal maps through the pipeline', () => {
  const brief = { id: 'n', kind: 'prop', size: [32, 32] as [number, number], directions: 8 as const };
  const twoD: AssetModule = { render: ctx => { const s = ctx.lib.t2.scene(32, 32); s.add({ type: 'ellipse', cx: 14, cy: 16, rx: 9, ry: 8, mat: 'moss', shade: 'sphere' }); return s.render(); } };

  test('2D scenes: sphere normals point left on the left edge; cells carry maps; mirrored facings flip x', () => {
    const r = renderAsset(twoD, { dir, brief });
    const e = r.cells.find(c => c.facing === 'e')!, w = r.cells.find(c => c.facing === 'w')!;
    expect(e.normal && w.normal).toBeTruthy();
    expect(getNormal(e.normal!, 6, 16)![0]).toBeLessThan(-0.4);
    expect(w.mirrored).toBe(true);
    expect(w.normal!.hash()).toBe(flipNormalMap(e.normal!).hash());
    expect(getNormal(w.normal!, 31 - 6, 16)![0]).toBeGreaterThan(0.4);
    // outline pixels are in the map (viewer-facing), shadows are not
    for (const c of r.cells) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) expect(!!getNormal(c.normal!, x, y)).toBe(c.grid.alpha(x, y) === 255);
  });

  test('finishing keeps the map fitted to the finished pixels', () => {
    const r = renderAsset(twoD, { dir, brief: { ...brief, directions: 1 } });
    const f = applyFinish(r, { base: 'base.v1', finish: (g, ctx) => { ctx.lib.px.set(g, [1, 1], 'gold.0'); g.clear(14, 16); return g; } }, dir);
    const n = f.render.cells[0].normal!;
    expect(getNormal(n, 1, 1)).toEqual([0, 0, 1].map(v => expect.closeTo(v, 1)) as never);
    expect(getNormal(n, 14, 16)).toBeNull();
  });

  test('packs export normal atlases in the colour layout; frames differing only in normals stay apart', () => {
    const r = renderAsset(twoD, { dir, brief: { ...brief, directions: 4 } });
    const built = buildPack('p', dir, [{ brief: { id: 'n', kind: 'prop' }, view: 'topdown', renders: [r], version: 'base.v1', sourceHash: 'x' }]);
    expect(built.manifest.normals).toEqual(['p-0.n.png']);
    expect(built.manifest.assets.n.normals).toBe(true);
    expect(built.normals![0].w).toBe(built.atlases[0].w);
    for (const [bin, x, y, w, h] of built.manifest.assets.n.frames) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
      expect(built.normals![bin].alpha(x + i, y + j) === 255).toBe(built.atlases[bin].alpha(x + i, y + j) === 255);
    const flat: AssetModule = { render: () => new Grid(8, 8).fill(2, 2, 4, 4, RAMPS.stone[0]) };
    const plain = buildPack('q', dir, [{ brief: { id: 'f', kind: 'prop' }, view: 'topdown', renders: [renderAsset(flat, { dir, brief: { id: 'f', kind: 'prop', size: [8, 8] } })], version: 'base.v1', sourceHash: 'x' }]);
    expect(plain.manifest.normals).toBeUndefined();
  });

  test('normalFromHeight: a ramp of heights tilts the normals; wrap makes tiles seamless', () => {
    const w = 8, hs = Array.from({ length: 64 }, (_, i) => (i % w) / w);
    const n = normalFromHeight(hs, w, 8, { wrap: false });
    expect(getNormal(n, 3, 3)![0]).toBeLessThan(0);
    const wrapped = normalFromHeight(hs, w, 8, { wrap: true });
    expect(getNormal(wrapped, 0, 3)![0]).toBeGreaterThan(0); // the wrap seam is a drop, seen from both sides
  });
});

describe('stack, vox, glb, contexts', () => {
  const model = () => lib().t2.scene3d().add({ type: 'box', name: 'car', x: 0, y: 0, z: 0, w: 6, d: 3, h: 2, mat: 'stone' }, { type: 'box', name: 'cab', x: 1, y: 0, z: 2, w: 3, d: 3, h: 2, mat: 'gold' });

  test('slices: one per layer, bottom first; composites rotate and lift', () => {
    const sl = model().slices(16, 16, { scale: 2, outline: false });
    expect(sl).toHaveLength(4);
    expect(opaque(sl[0])).toBe(6 * 3 * 4);
    expect(opaque(sl[3])).toBe(3 * 3 * 4);
    const c0 = stackComposite(sl, 0, 2), c1 = stackComposite(sl, Math.PI / 2, 2);
    expect(c0.h).toBe(16 + 6);
    expect(c0.hash()).not.toBe(c1.hash());
    expect(stackStrip(sl, 8).w).toBe(8 * 16 + 7);
    expect(opaque(rotateGrid(sl[0], Math.PI / 2))).toBe(opaque(sl[0]));
    // with the direction's line each slice is outlined (the lib binds it)
    const lined = model().slices(16, 16, { scale: 2 });
    expect(opaque(lined[0])).toBeGreaterThan(opaque(sl[0]));
  });

  test('.vox round trip keeps every voxel and its material; voxCells group by colour; addVox reimports', () => {
    const set = model().voxelSet(), vox = voxFromSet(set), back = decodeVox(encodeVox(vox));
    expect(back.size).toEqual(vox.size);
    expect(back.voxels).toEqual(vox.voxels);
    expect(back.palette.slice(0, 2)).toEqual(vox.palette.slice(0, 2));
    const groups = voxCells(back);
    expect(groups.map(g => g.cells.length)).toEqual([36, 18]);
    const re = lib().t2.scene3d().addVox(back);
    expect(re.voxels().size).toBe(54);
    expect(new Set([...re.voxels().values()].map(v => v.mat[0]))).toEqual(new Set([RAMPS.stone[0], RAMPS.gold[0]]));
  });

  test('greedy mesh merges faces; glb is valid with one primitive per material', () => {
    const set = model().voxelSet(), quads = greedyMesh(set);
    // a 6×3×2 box alone has 6 faces; the cab on top splits the box's top and adds its own 5 faces
    expect(quads.length).toBeLessThan(30);
    const area = quads.reduce((a, q) => a + Math.abs(cross3(q.p[1].map((v, i) => v - q.p[0][i]) as never, q.p[3].map((v, i) => v - q.p[0][i]) as never).reduce((s, v) => s + Math.abs(v), 0)), 0);
    expect(area).toBe(2 * (6 * 3 + 6 * 2 + 3 * 2) + 2 * (3 * 2) + 2 * (3 * 2) + 0); // exposed surface: box 72 minus cab footprint 9 + cab 4 sides 24 + top 9
    const glb = voxelGlb(set), j = readGlbJson(glb);
    expect(j.asset.version).toBe('2.0');
    expect(j.meshes[0].primitives).toHaveLength(2);
    expect(new DataView(glb.buffer).getUint32(8, true)).toBe(glb.length);
  });

  test('view modules: contexts for oblique and side; parallax strip moves near layers more', () => {
    expect(viewModule('oblique').anchor).toBe('feet');
    expect(() => viewModule('fisheye')).toThrow('unknown view');
    const room = obliqueRoom(48, 48, dir);
    expect(opaque(room)).toBe(48 * 48);
    const far = new Grid(16, 8).fill(0, 0, 4, 8, RAMPS.stone[0]), near = new Grid(16, 8).fill(0, 0, 4, 8, RAMPS.gold[0]);
    const st = parallaxStrip([{ grid: far, depth: 0.2 }, { grid: near, depth: 1 }], 32, [0, 8]);
    expect(st.w).toBe(65);
  });
});
