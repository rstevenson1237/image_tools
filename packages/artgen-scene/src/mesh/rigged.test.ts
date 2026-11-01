// R7b (docs/RIGS3D.md): the body rigs in 3D, skin weights, joint transforms, rigged meshes with clips and levels of
// detail, and the .glb: its skin and animations, evaluated as a glTF viewer would, put the vertices where the engine does.
import { describe, expect, test } from 'vitest';
import { dirContext, parseDirection, type Direction } from '../direction.ts';
import { bodyRig } from '../anim/rigs.ts';
import { bodyRig3d, type Pose3D } from '../anim/rig3d.ts';
import { Scene3D, type V3 } from '../t2/scene3d.ts';
import { sceneField } from './field.ts';
import { accessor, readGlb } from './gltf.ts';
import { buildRigged, clipStrip, posedView, riggedChecks, riggedGlb } from './rigged.ts';
import { jointPoses, rotationBetween, skeletonOf, skinPose, skinWeights } from './skin.ts';

const RAMPS = { cloth: ['#80a0d0', '#4060a0', '#203060'], skin: ['#f0c8a0', '#d09870', '#905838'], leather: ['#a07050', '#704830', '#402818'] };
const dir: Direction = parseDirection({ id: 'rig', version: 1, status: 'locked', camera: { view: 'iso' }, scale: { character: 48 }, palette: { ramps: RAMPS, outline: '#101014' }, shading: { bands: 3 } });
const dc = dirContext(dir);
const H = 12;

/** A small biped built along a pose, every part on its bone (as the rigged template does). */
function biped(P: Pose3D, o: { skipBone?: string; badBone?: boolean } = {}): Scene3D {
  const m = new Scene3D(dc, { k: 2, pose: P });
  const limb = (bone: string, r: number, mat: string) => m.add({ type: 'capsule', name: bone, a: P.start(bone), b: P.end(bone), r, mat, ...(bone !== o.skipBone && { bone }) });
  for (const s of ['L', 'R']) { limb(`leg${s}_up`, 0.6, 'cloth'); limb(`leg${s}_lo`, 0.5, 'leather'); limb(`arm${s}_up`, 0.45, 'cloth'); limb(`arm${s}_lo`, 0.4, 'skin'); }
  m.add({ type: 'capsule', name: 'torso', a: P.along('spine', 0.2), b: P.along('spine', 0.85), r: 1.3, mat: 'cloth', bone: o.badBone ? 'tail' : 'spine' });
  const [x, y, z] = P.along('head', 0.5);
  m.add({ type: 'ellipsoid', name: 'head', cx: x, cy: y, cz: z, rx: 1, ry: 1, rz: 1.1, mat: 'skin', bone: 'head' });
  return m;
}
const PROPS = { head: 0.17, leg_up: 0.23, leg_lo: 0.22, arm_up: 0.16, arm_lo: 0.15, armSep: 0.2 };
const rig = () => bodyRig3d('biped', { height: H, proportions: PROPS });
const CLIPS = [{ state: 'idle', duration: 1, loop: true }, { state: 'walk', duration: 0.5, loop: true }, { state: 'attack', duration: 0.5, loop: false }];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('body rigs in 3D', () => {
  test('model units and frame: feet on z = 0, facing +y, the body\'s right at −x; lengths fixed through every clip', () => {
    const r = rig(), b = r.bind();
    expect(b.bind).toBe(true);
    expect(r.pose('walk', 0.25).bind).toBe(false);
    expect(Math.min(b.end('legL_lo')[2], b.end('legR_lo')[2])).toBeCloseTo(0, 6);
    expect(b.end('head')[2]).toBeCloseTo(H, 6);
    expect(b.start('armR_up')[0]).toBeLessThan(0);
    expect(b.start('armL_up')[0]).toBeGreaterThan(0);
    // a step: the swinging foot moves along y (forward), not x
    const f0 = r.pose('walk', 0).end('legL_lo'), f1 = r.pose('walk', 0.25).end('legL_lo');
    expect(Math.abs(f1[1] - f0[1])).toBeGreaterThan(Math.abs(f1[0] - f0[0]) * 3);
    expect(r.lengths.head).toBeCloseTo(H * 0.17, 9);
    for (const s of ['idle', 'walk', 'attack', 'hurt']) for (const t of [0, 0.3, 0.7]) {
      const p = r.pose(s, t);
      for (const n of r.bones) expect(dist(p.start(n), p.end(n)), `${s} ${t} ${n}`).toBeCloseTo(r.lengths[n], 6);
    }
    // parents come first; the wings of a flyer hang from its body
    for (const n of r.bones) { const p = r.parents[n]; if (p) expect(r.bones.indexOf(p)).toBeLessThan(r.bones.indexOf(n)); }
    expect(bodyRig3d('flyer', { height: 4 }).parents.wingL).toBe('body');
  });

  test('`at` moves along the body\'s own axes; the 3D clips move smoothly where the sprites step by whole pixels', () => {
    const p = rig().bind(), h = p.along('head', 0.5), e = p.at('head', 0.5, 1, 0.5, 0.25);
    expect(e[0]).toBeCloseTo(h[0] - 0.5, 9); expect(e[1]).toBeCloseTo(h[1] + 1, 9); expect(e[2]).toBeCloseTo(h[2] + 0.25, 9);
    const sprite = bodyRig('biped', { size: [64, 64], facing: 's', height: 40 }), smooth = bodyRig('biped', { size: [64, 64], facing: 's', height: 40, continuous: true });
    const hip = (r: typeof sprite, t: number) => r.skeleton('walk', t).hip[0][1];
    expect(new Set([0.05, 0.1, 0.15, 0.2].map(t => hip(smooth, t))).size).toBeGreaterThan(new Set([0.05, 0.1, 0.15, 0.2].map(t => hip(sprite, t))).size);
    // the sprite rig's poses are what they were: skeleton() is the projection's input
    const sp = sprite.pose('walk', 0.3), sk = sprite.skeleton('walk', 0.3);
    expect(Object.keys(sk)).toEqual(sprite.bones);
    expect(sp.bones.hip).toBeDefined();
  });
});

describe('skinning', () => {
  test('owners and joint blends: a vertex follows its part\'s bone, shares at the joint, weights sum to 1', () => {
    const P = rig().bind(), sc = biped(P), f = sceneField(sc), sk = skeletonOf(P), lo = P.end('armR_lo'), el = P.start('armR_lo');
    // probes: the hand tip, the elbow, the middle of the chest
    const pts = new Float32Array([...lo, ...el, ...P.along('spine', 0.5)]);
    const s = skinWeights({ positions: pts }, f, sk), b = (i: number) => sk.bones[i];
    expect(b(s.owner[0])).toBe('armR_lo');
    expect(s.weights[0]).toBeCloseTo(1, 3);
    // the elbow: half and half between the forearm and the upper arm
    const elbow = new Map([0, 1, 2, 3].map(k => [b(s.joints[4 + k]), s.weights[4 + k]]));
    expect(elbow.get('armR_lo')! + elbow.get('armR_up')!).toBeCloseTo(1, 2);
    expect(Math.abs(elbow.get('armR_lo')! - elbow.get('armR_up')!)).toBeLessThan(0.2);
    expect(b(s.owner[2])).toBe('spine');
    for (let v = 0; v < 3; v++) expect(s.weights.slice(v * 4, v * 4 + 4).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 5);
    expect(s.unbound).toEqual({ parts: [], vertices: 0 });
    // parts without a bone follow the nearest one, and say so; a bone the rig hasn't is named
    const loose = skinWeights({ positions: pts }, sceneField(biped(P, { skipBone: 'armR_lo' })), sk);
    expect(loose.unbound.parts).toEqual(['armR_lo']);
    expect(b(loose.owner[0])).toBe('armR_lo');
    expect(skinWeights({ positions: pts }, sceneField(biped(P, { badBone: true })), sk).unknown).toEqual(['tail']);
  });

  test('joint transforms: the bind pose is the identity; a turned bone carries its vertices rigidly', () => {
    const R = rotationBetween([1, 0, 0], [0, 1, 0]);
    expect(R.map(v => Math.round(v * 1e9) / 1e9)).toEqual([0, -1, 0, 1, 0, 0, 0, 0, 1]);
    const flip = rotationBetween([0, 0, 1], [0, 0, -1]);
    expect([flip[2], flip[5], flip[8]].map(v => Math.round(v * 1e9) / 1e9)).toEqual([0, 0, -1]);
    const r = rig(), P = r.bind(), sc = biped(P), m = buildRigged(sc, { budget: 1500, lods: 1, clips: CLIPS }), l = m.lods[0];
    const id = skinPose(l.result.mesh, l.skin, jointPoses(m.skeleton, P.bones));
    for (let i = 0; i < id.positions.length; i++) expect(Math.abs(id.positions[i] - l.result.mesh.positions[i])).toBeLessThan(1e-4);
    // in the attack pose, vertices owned by the forearm alone keep their distance to the forearm's bones
    const A = r.pose('attack', 0.55), moved = skinPose(l.result.mesh, l.skin, jointPoses(m.skeleton, A.bones)).positions, sk = m.skeleton, k = sk.bones.indexOf('armR_lo');
    let checked = 0;
    for (let v = 0; v < l.skin.owner.length; v++) if (l.skin.joints[v * 4] === k && l.skin.weights[v * 4] > 0.999) {
      const p0: V3 = [l.result.mesh.positions[v * 3], l.result.mesh.positions[v * 3 + 1], l.result.mesh.positions[v * 3 + 2]], p1: V3 = [moved[v * 3], moved[v * 3 + 1], moved[v * 3 + 2]];
      expect(dist(p1, A.start('armR_lo'))).toBeCloseTo(dist(p0, P.start('armR_lo')), 4);
      expect(dist(p1, A.end('armR_lo'))).toBeCloseTo(dist(p0, P.end('armR_lo')), 4);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe('rigged meshes', () => {
  const model = () => buildRigged(biped(rig().bind()), { budget: 2000, clips: CLIPS });

  test('levels of detail under shrinking budgets; the checks pass', () => {
    const m = model();
    expect(m.lods.map(l => l.budget)).toEqual([2000, 500, 125]);
    m.lods.forEach(l => expect(l.result.mesh.indices.length / 3).toBeLessThanOrEqual(l.budget));
    expect(m.lods[1].result.texels).toBeLessThan(m.lods[0].result.texels);
    expect(m.clips.map(c => [c.state, c.times.length])).toEqual([['idle', 16], ['walk', 16], ['attack', 16]]);
    expect(m.clips[1].times.at(-1)).toBeCloseTo(0.5, 9);
    const checks = riggedChecks(m, { budget: 2000, metresPerUnit: 0.1 }), by = Object.fromEntries(checks.map(c => [c.id, c.status]));
    expect(by).toMatchObject({ 'mesh-closed': 'pass', 'mesh-budget': 'pass', 'skin-weights': 'pass', 'skin-bound': 'pass', 'clip-lengths': 'pass', 'skin-stretch': 'pass', 'lod-budget': 'pass' });
    // a part with an unknown bone fails the binding
    const bad = buildRigged(biped(rig().bind(), { badBone: true }), { budget: 800, lods: 1, clips: CLIPS.slice(0, 1) });
    expect(riggedChecks(bad, { budget: 800, metresPerUnit: 0.1 }).find(c => c.id === 'skin-bound')).toMatchObject({ status: 'fail', detail: expect.stringContaining('tail') });
  });

  test('only a scene built in its rig\'s bind pose rigs', () => {
    expect(() => buildRigged(new Scene3D(dc, { k: 2 }).add({ type: 'box', x: 0, y: 0, z: 0, w: 1, d: 1, h: 1, mat: 'cloth' }), { clips: [] })).toThrow(/no pose/);
    expect(() => buildRigged(biped(rig().pose('walk', 0.25)), { clips: [] })).toThrow(/not the bind pose/);
  });

  test('the .glb: one skin over every bone, a clip per state, the levels as skinned meshes; evaluated like a viewer, it poses as the engine does', () => {
    const m = model(), s = 0.1, g = readGlb(riggedGlb(m, { name: 'hero', metresPerUnit: s })), j = g.json, sk = m.skeleton;
    expect(j.skins).toHaveLength(1);
    expect(j.skins[0].joints.map((n: number) => j.nodes[n].name)).toEqual(sk.bones);
    expect(j.animations.map((a: any) => a.name)).toEqual(['idle', 'walk', 'attack']);
    expect(j.animations[1].channels).toHaveLength(sk.bones.length * 2);
    expect(j.meshes.map((x: any) => x.name)).toEqual(['hero_LOD0', 'hero_LOD1', 'hero_LOD2']);
    expect(j.extras.artgen.lods.map((l: any) => l.distance)).toEqual([...j.extras.artgen.lods.map((l: any) => l.distance)].sort((a, b) => a - b));
    expect(j.extras.artgen.clips.walk).toEqual({ duration: 0.5, loop: true, keys: 16 });
    expect(j.samplers[0]).toMatchObject({ magFilter: 9728, minFilter: 9728 });
    const prim = j.meshes[0].primitives[0], POS = accessor(g, prim.attributes.POSITION), JT = accessor(g, prim.attributes.JOINTS_0), WT = accessor(g, prim.attributes.WEIGHTS_0);
    expect(j.accessors[prim.attributes.JOINTS_0].componentType).toBe(5121);
    const IBM = accessor(g, j.skins[0].inverseBindMatrices);
    // evaluate the walk at key 5: node TRS → world matrices → skin, as a glTF viewer does
    const anim = j.animations[1], key = 5, local = new Map<number, { t: number[]; r: number[] }>();
    for (const ch of anim.channels) {
      const out = accessor(g, anim.samplers[ch.sampler].output), w = out.width, v = Array.from(out.data.slice(key * w, key * w + w));
      const e = local.get(ch.target.node) ?? { t: j.nodes[ch.target.node].translation ?? [0, 0, 0], r: [0, 0, 0, 1] };
      if (ch.target.path === 'rotation') { e.r = v; expect(Math.hypot(...v)).toBeCloseTo(1, 5); } else e.t = v;
      local.set(ch.target.node, e);
    }
    const mat = (t: number[], q: number[]) => { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, t[0], t[1], t[2], 1]; };
    const mul = (a: number[], b: number[]) => { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k]; return r; };
    const world = new Map<number, number[]>(), parentOf = new Map<number, number>();
    j.nodes.forEach((n: any, i: number) => (n.children ?? []).forEach((c: number) => parentOf.set(c, i)));
    const W = (n: number): number[] => {
      if (world.has(n)) return world.get(n)!;
      const l = local.get(n), m4 = l ? mat(l.t, l.r) : mat(j.nodes[n].translation ?? [0, 0, 0], j.nodes[n].rotation ?? [0, 0, 0, 1]), p = parentOf.get(n), r = p === undefined ? m4 : mul(W(p), m4);
      world.set(n, r);
      return r;
    };
    const joints = j.skins[0].joints.map((n: number, i: number) => mul(W(n), Array.from(IBM.data.slice(i * 16, i * 16 + 16))));
    const engine = skinPose(m.lods[0].result.mesh, m.lods[0].skin, jointPoses(sk, m.clips[1].poses[key])).positions;
    let worst = 0;
    for (let v = 0; v < POS.count; v++) {
      const p = [POS.data[v * 3], POS.data[v * 3 + 1], POS.data[v * 3 + 2], 1], out = [0, 0, 0];
      for (let k = 0; k < 4; k++) { const M = joints[JT.data[v * 4 + k]], w = WT.data[v * 4 + k]; for (let a = 0; a < 3; a++) out[a] += w * (M[a] * p[0] + M[4 + a] * p[1] + M[8 + a] * p[2] + M[12 + a]); }
      // the engine's position in glTF's frame: x, z, y in metres
      const e = [engine[v * 3] * s, engine[v * 3 + 2] * s, engine[v * 3 + 1] * s];
      worst = Math.max(worst, Math.hypot(out[0] - e[0], out[1] - e[1], out[2] - e[2]));
    }
    expect(worst).toBeLessThan(1e-4);
    // the rest pose is the bind: every joint matrix is the identity
    expect(j.nodes[j.skins[0].joints[0]].translation[1]).toBeGreaterThan(0);
  });

  test('the clip strip shows the motion', () => {
    const m = model(), g = clipStrip(m, { frames: 4, w: 40, h: 56 });
    expect([g.w, g.h]).toEqual([4 * 41 - 1, 3 * 57 - 1]);
    const cell = (row: number, i: number) => { const out: number[] = []; for (let y = row * 57; y < row * 57 + 56; y++) for (let x = i * 41; x < i * 41 + 40; x++) out.push(g.d[(y * g.w + x) * 4 + 3]); return out.join(','); };
    expect(cell(1, 0)).not.toBe(cell(1, 1)); // walk moves
    expect(posedView(m, m.rig.bind()).positions.length).toBe(m.lods[0].result.mesh.positions.length);
  });
});
