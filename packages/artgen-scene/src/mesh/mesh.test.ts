// R7a (docs/MESHES.md): the distance field follows the voxel rules, dual contouring is closed and fits its budget,
// UVs don't overlap at an even density, textures are palette-exact, the .glb reads back, voxelising fills a closed
// mesh, and the orbit camera and turntable draw.
import { describe, expect, test } from 'vitest';
import { parseColor } from 'artgen-primitives/lib/color.ts';
import { dirContext, parseDirection, type Direction } from '../direction.ts';
import { Scene3D, type Spec3 } from '../t2/scene3d.ts';
import { buildMesh } from './build.ts';
import { meshChecks } from './checks.ts';
import { contourField } from './contour.ts';
import { sceneField } from './field.ts';
import { glbTriangles, meshGlb, readGlb } from './gltf.ts';
import { texelsIn } from './uv.ts';
import { orbitCamera, projectPoint, rasterMesh, turntable, viewOfMesh, voxelViewMesh } from './view.ts';
import { triBoxOverlap, voxelizeTriangles } from './voxelize.ts';

const RAMPS = {
  stone: ['#c8ccd0', '#8e959c', '#5a6068', '#30343a'], wood: ['#c89860', '#8a6038', '#4a321e'], metal: ['#e0e4e8', '#a0a8b0', '#606870'],
  accent: ['#ffc060', '#e07020', '#802010'], cloth: ['#80a0d0', '#4060a0', '#203060'], skin: ['#f0c8a0', '#d09870', '#905838'],
};
const dir: Direction = parseDirection({ id: 'mesh', version: 1, status: 'locked', camera: { view: 'iso' }, scale: { prop: 32, character: 32 }, palette: { ramps: RAMPS, outline: '#101014' }, shading: { bands: 3 } });
const dc = dirContext(dir);
const PALETTE = new Set(Object.values(RAMPS).flat());

/** A chest-like prop with every spec kind the field reads: box, slab, ellipsoid, capsule, a subtract, a rotated and mirrored group. */
function prop(k = 1): Scene3D {
  const s = new Scene3D(dc, { k });
  s.add({ type: 'box', name: 'body', x: 0, y: 0, z: 0, w: 8, d: 5, h: 4, mat: 'wood' });
  s.add({ type: 'slab', name: 'strap', x: 2, y: -1, z: 0, w: 1, d: 7, h: 5, mat: 'metal' });
  s.add({ type: 'subtract', name: 'lid', mat: 'wood', shapes: [{ type: 'box', x: 0, y: 0, z: 4, w: 8, d: 5, h: 2 }, { type: 'box', x: 3, y: 1, z: 5, w: 2, d: 3, h: 2 }] });
  s.add({ type: 'ellipsoid', name: 'knob', cx: 4, cy: 5.5, cz: 2, rx: 1, mat: 'accent', shade: 'toon' });
  s.add({ type: 'group', name: 'handles', rotate: 90, origin: [4, 2.5, 0], mirror: 'x', children: [{ type: 'capsule', a: [-1, 2.5, 3], b: [-1, 2.5, 1], r: 0.6, mat: 'metal' }] });
  return s;
}

describe('the distance field follows the voxel rules', () => {
  test('inside the field ⇔ a voxel, at every voxel centre (transforms, booleans and add-less slabs included)', () => {
    for (const k of [1, 2]) {
      const s = prop(k), f = sceneField(s), cells = new Set(s.voxelSet().cells.map(c => c.v.join(',')));
      const [x0, y0, z0, x1, y1, z1] = f.bounds!.map(v => Math.round(v * k));
      let wrong = 0;
      for (let z = z0 - 1; z <= z1; z++) for (let y = y0 - 1; y <= y1; y++) for (let x = x0 - 1; x <= x1; x++)
        if ((f.sdf((x + 0.5) / k, (y + 0.5) / k, (z + 0.5) / k) <= 0) !== cells.has(`${x},${y},${z}`)) wrong++;
      expect({ k, wrong }).toEqual({ k, wrong: 0 });
    }
  });

  test('later solids paint over earlier ones; a slab recolours what it overlaps', () => {
    const f = sceneField(prop());
    expect(f.paint([2.5, 5, 2], [0, 1, 0]).name).toBe('strap');
    expect(f.paint([6, 5, 2], [0, 1, 0]).name).toBe('body');
    expect(f.paint([4, 6.5, 2], [0, 1, 0]).name).toBe('knob');
    expect(f.solids.find(s => s.name === 'strap')!.geometry).toBe(false);
  });
});

describe('dual contouring', () => {
  test('a box keeps its flat faces and sharp corners, and is closed', () => {
    const s = new Scene3D(dc).add({ type: 'box', x: 0, y: 0, z: 0, w: 4, d: 3, h: 2, mat: 'stone' }), f = sceneField(s);
    const c = contourField(f.sdf, (x, y, z) => f.normal(x, y, z), [-1, -1, -1, 5, 4, 3], 12);
    let worst = 0;
    for (let i = 0; i < c.positions.length; i += 3) worst = Math.max(worst, Math.abs(f.sdf(c.positions[i], c.positions[i + 1], c.positions[i + 2])));
    expect(worst).toBeLessThan(0.02);
    for (const corner of [[0, 0, 0], [4, 3, 2], [4, 0, 2]]) {
      let near = Infinity;
      for (let i = 0; i < c.positions.length; i += 3) near = Math.min(near, Math.hypot(c.positions[i] - corner[0], c.positions[i + 1] - corner[1], c.positions[i + 2] - corner[2]));
      expect(near, `corner ${corner}`).toBeLessThan(0.05);
    }
  });

  test('every mesh fits its budget, is closed, and finer budgets give more triangles', () => {
    let last = 0;
    for (const budget of [200, 800, 3000]) {
      const r = buildMesh(prop(2), { budget }), tris = r.mesh.indices.length / 3;
      const checks = meshChecks(r.mesh, { budget, atlas: r.atlas, texels: r.texels });
      expect(checks.filter(c => c.status === 'fail'), `budget ${budget}`).toEqual([]);
      expect(tris).toBeLessThanOrEqual(budget);
      expect(tris).toBeGreaterThan(last);
      last = tris;
    }
  });

  test('smooth parts get the field normal, faceted ones the face normal', () => {
    const ball = new Scene3D(dc, { k: 2 }).add({ type: 'ellipsoid', cx: 0, cy: 0, cz: 3, rx: 3, mat: 'skin', shade: 'toon' });
    const r = buildMesh(ball, { budget: 1500 }), P = r.mesh.positions, N = r.mesh.normals;
    let worst = 1;
    for (let i = 0; i < P.length; i += 3) {
      const d = [P[i], P[i + 1], P[i + 2] - 3], l = Math.hypot(...d);
      worst = Math.min(worst, (d[0] * N[i] + d[1] * N[i + 1] + d[2] * N[i + 2]) / l);
    }
    expect(worst).toBeGreaterThan(0.97);
    const flat = buildMesh(ball, { budget: 1500, mode: 'faceted' });
    expect(flat.mesh.smooth.every(v => v === 0)).toBe(true);
    // faceted: each triangle's corners share its face normal
    const I = flat.mesh.indices, FN = flat.mesh.normals;
    for (let t = 0; t < 20; t++) expect([FN[I[t * 3] * 3], FN[I[t * 3] * 3 + 2]]).toEqual([FN[I[t * 3 + 1] * 3], FN[I[t * 3 + 1] * 3 + 2]]);
  });
});

describe('UVs and textures', () => {
  test('texelsIn gives a texel on a shared edge to exactly one triangle', () => {
    const hits = new Map<string, number>(), quad: [number, number][] = [[0.5, 0.5], [7.5, 1.5], [6.5, 6.5], [1.5, 5.5]];
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) texelsIn(quad[a], quad[b], quad[c], (x, y) => hits.set(`${x},${y}`, (hits.get(`${x},${y}`) ?? 0) + 1));
    expect([...hits.values()].every(n => n === 1)).toBe(true);
    expect(hits.size).toBeGreaterThan(20);
  });

  test('the checks pass: no UV overlap, UVs inside 0–1, an even texel density', () => {
    for (const texels of [2, 4, 8]) {
      const r = buildMesh(prop(2), { budget: 1500, texels });
      expect(meshChecks(r.mesh, { budget: 1500, atlas: r.atlas, texels: r.texels }).map(c => [c.id, c.status])).toEqual([
        ['mesh-closed', 'pass'], ['mesh-budget', 'pass'], ['mesh-scale', 'skip'], ['uv-bounds', 'pass'], ['uv-overlap', 'pass'], ['texel-density', 'pass'],
      ]);
    }
  });

  test('colour texels are palette-exact and show every material; normals are unit vectors; roughness follows the material', () => {
    const r = buildMesh(prop(2), { budget: 1500 }), { color, normal, orm } = r.textures, seen = new Set<string>();
    for (let i = 0; i < color.d.length; i += 4) {
      if (!color.d[i + 3]) continue;
      const hex = `#${[0, 1, 2].map(c => color.d[i + c].toString(16).padStart(2, '0')).join('')}`;
      expect(PALETTE.has(hex), hex).toBe(true);
      seen.add(hex);
      const n = [0, 1, 2].map(c => normal.d[i + c] / 127.5 - 1);
      expect(Math.abs(Math.hypot(...n) - 1)).toBeLessThan(0.03);
    }
    for (const ramp of ['wood', 'metal', 'accent']) expect(seen.has(RAMPS[ramp as keyof typeof RAMPS][1]), ramp).toBe(true);
    const metal = [...Array(orm.w * orm.h).keys()].find(p => orm.d[p * 4 + 2] === 255);
    expect(metal).toBeDefined();
    expect(orm.d[metal! * 4 + 1]).toBe(Math.round(0.35 * 255));
  });

  test('grain moves texels one ramp step; the baked look bands the direction light', () => {
    const grainy = new Scene3D(dc, { k: 2 }).add({ type: 'box', x: 0, y: 0, z: 0, w: 6, d: 6, h: 6, mat: 'stone', grain: 0.6 } as Spec3);
    const steps = (look: 'pbr' | 'baked') => {
      const { color } = buildMesh(grainy, { budget: 600, look }).textures, out = new Set<string>();
      for (let i = 0; i < color.d.length; i += 4) if (color.d[i + 3]) out.add(`#${[0, 1, 2].map(c => color.d[i + c].toString(16).padStart(2, '0')).join('')}`);
      return [...out].sort();
    };
    expect(steps('pbr')).toEqual([RAMPS.stone[1], RAMPS.stone[2], RAMPS.stone[3]].sort()); // the middle step (2 of 4) and its neighbours
    expect(steps('baked').length).toBeGreaterThan(1);
    expect(steps('baked').every(c => RAMPS.stone.includes(c))).toBe(true);
  });

  test('deterministic', () => {
    const a = buildMesh(prop(2), { budget: 900 }), b = buildMesh(prop(2), { budget: 900 });
    expect(a.textures.color.hash()).toBe(b.textures.color.hash());
    expect(Buffer.from(a.mesh.positions.buffer).equals(Buffer.from(b.mesh.positions.buffer))).toBe(true);
  });
});

describe('glTF', () => {
  test('a mesh .glb reads back: counts, metres, textures, nearest sampling, the frame', () => {
    const r = buildMesh(prop(2), { budget: 900 }), bytes = meshGlb(r, { name: 'chest', metresPerUnit: 0.1 }), g = readGlb(bytes);
    expect(g.json.meshes[0].primitives[0].attributes).toEqual({ POSITION: 0, NORMAL: 1, TANGENT: 2, TEXCOORD_0: 3 });
    expect(g.json.samplers[0]).toMatchObject({ magFilter: 9728, minFilter: 9728 });
    expect(g.json.images).toHaveLength(3);
    expect(g.json.extras.artgen).toMatchObject({ budget: 900, mode: 'auto', look: 'pbr' });
    const t = glbTriangles(g);
    expect(t.positions.length / 9).toBe(r.mesh.indices.length / 3);
    let zlo = Infinity, zhi = -Infinity;
    for (let i = 2; i < t.positions.length; i += 3) { zlo = Math.min(zlo, t.positions[i]); zhi = Math.max(zhi, t.positions[i]); }
    // back in artgen's frame: z up, the same height in metres
    expect(zhi - zlo).toBeCloseTo((r.bounds[5] - r.bounds[2]) * 0.1, 4);
    expect(t.textured.every(x => x?.image.w === r.atlas[0])).toBe(true);
    // winding survives the axis swap: the summed signed volume is positive
    let vol = 0;
    for (let i = 0; i < t.positions.length; i += 9) {
      const a = [t.positions[i], t.positions[i + 1], t.positions[i + 2]], b = [t.positions[i + 3], t.positions[i + 4], t.positions[i + 5]], c = [t.positions[i + 6], t.positions[i + 7], t.positions[i + 8]];
      vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    expect(vol).toBeGreaterThan(0);
    expect(readGlb(meshGlb(buildMesh(prop(), { budget: 300, look: 'baked' }), { metresPerUnit: 0.1 })).json.extensionsUsed).toEqual(['KHR_materials_unlit']);
  });

  test('voxelising a closed .glb fills it, at the scale asked, in its texture colours', () => {
    const s = new Scene3D(dc).add({ type: 'box', x: 0, y: 0, z: 0, w: 4, d: 4, h: 4, mat: 'accent' }), r = buildMesh(s, { budget: 300 });
    const t = glbTriangles(readGlb(meshGlb(r, { metresPerUnit: 0.25 })));
    const v = voxelizeTriangles(t, { perMetre: 4 });
    expect(v.size).toEqual([4, 4, 4]);
    expect(v.cells).toHaveLength(64);
    const mid = parseColor(RAMPS.accent[1]).slice(0, 3);
    for (const c of v.cells) expect(c.rgb.map((x, i) => Math.abs(x - mid[i])).every(d => d <= 2), JSON.stringify(c)).toBe(true);
    expect(() => voxelizeTriangles(t, { perMetre: 400 })).toThrow('at most 256');
  });

  test('the triangle–box test', () => {
    expect(triBoxOverlap([0.5, 0.5, 0.5], 0.5, [-1, -1, 0.5], [3, -1, 0.5], [-1, 3, 0.5])).toBe(true);
    expect(triBoxOverlap([0.5, 0.5, 0.5], 0.5, [-1, -1, 1.6], [3, -1, 1.6], [-1, 3, 1.6])).toBe(false);
    expect(triBoxOverlap([0.5, 0.5, 0.5], 0.5, [2, 2, 0], [3, 2, 0], [2, 3, 1])).toBe(false);
  });
});

describe('the free camera', () => {
  test('the orbit camera looks at its target; yaw 0 sees the front with x to the right', () => {
    const cam = orbitCamera({ target: [1, 2, 3], yaw: 0, pitch: 0, distance: 10, w: 64, h: 48 });
    const [x, y] = projectPoint(cam, [1, 2, 3])!;
    expect([x, y]).toEqual([32, 24]);
    expect(projectPoint(cam, [2, 2, 3])![0]).toBeGreaterThan(32);
    expect(projectPoint(cam, [1, 2, 4])![1]).toBeLessThan(24);
    expect(projectPoint(cam, [1, 30, 3])).toBeUndefined();
  });

  test('meshes and voxels draw, the same way twice, with the near side in front', () => {
    const s = prop(2), r = buildMesh(s, { budget: 900 }), cam = orbitCamera({ target: [4, 2.5, 3], yaw: 30, pitch: 25, w: 64, h: 64 }, 6);
    const a = rasterMesh(viewOfMesh(r), cam), b = rasterMesh(viewOfMesh(r), cam), v = rasterMesh(voxelViewMesh(s.voxelSet(), s.k), cam);
    const filled = (g: typeof a) => { let n = 0; for (let i = 3; i < g.d.length; i += 4) if (g.d[i]) n++; return n; };
    expect(a.hash()).toBe(b.hash());
    expect(filled(a)).toBeGreaterThan(64 * 64 * 0.15);
    expect(Math.abs(filled(a) - filled(v)) / filled(v)).toBeLessThan(0.15);
    const tt = turntable(viewOfMesh(r), { angles: 4, w: 32, h: 40 });
    expect([tt.w, tt.h]).toEqual([4 * 33 - 1, 40]);
  });
});
