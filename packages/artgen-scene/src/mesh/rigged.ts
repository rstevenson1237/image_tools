/**
 * Rigged, animated meshes (R7b, docs/RIGS3D.md): a 3D-mode scene built along a body-rig pose becomes a skinned mesh with
 * one animation clip per state and levels of detail, written as one `.glb` for three.js (`GLTFLoader` + `AnimationMixer`).
 *
 *   bind     the scene is meshed in the rig's bind pose (idle at t = 0) and skinned to its bones (`skin.ts`)
 *   clips    each state's clip from the rig, sampled at `keys` points over the state's length (the sprite's frame timing),
 *            as joint rotations and translations, interpolated linearly
 *   LODs     the same scene meshed again under a quarter of the budget each step (half the texel density), skinned to the
 *            same skeleton; the game picks one by distance (`extras.artgen.lods`)
 *   frame    glTF's: metres, y up, the model facing +z, the rig's origin (between the feet) at the origin
 */
import { encodePNG } from 'artgen-primitives/lib/png.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import type { BodyRig3D, Pose3D } from '../anim/rig3d.ts';
import type { Scene3D, V3 } from '../t2/scene3d.ts';
import { glbBytes } from '../voxel/gltf.ts';
import { buildMesh, type MeshOptions, type MeshResult } from './build.ts';
import { meshChecks, type MeshCheck } from './checks.ts';
import { sceneField } from './field.ts';
import { ARRAY_BUFFER, binWriter, CLAMP, ELEMENT_ARRAY_BUFFER, glMeshArrays, materialOf, NEAREST, typedBytes } from './gltf.ts';
import { jointPoses, skeletonOf, skinPose, skinWeights, type JointPose, type Skeleton, type Skin, type SkinOptions } from './skin.ts';
import { orbitCamera, rasterMesh, viewBounds, viewOfMesh, type ViewMesh } from './view.ts';

export interface ClipSpec {
  /** The state (the clip's name in the `.glb`). */
  state: string;
  /** Seconds. */
  duration: number;
  loop: boolean;
}

export interface RiggedOptions extends MeshOptions, SkinOptions {
  /** Levels of detail (default 3): each a quarter of the previous budget at half the texel density. */
  lods?: number;
  /** Samples per clip (default 16; the last repeats the first for a looping clip). */
  keys?: number;
  clips: ClipSpec[];
}

export interface RiggedLod { result: MeshResult; skin: Skin; budget: number }

export interface RiggedClip extends ClipSpec {
  /** Sample times, seconds, and the pose at each. */
  times: number[];
  poses: Record<string, { a: V3; b: V3 }>[];
}

export interface RiggedModel {
  rig: BodyRig3D;
  skeleton: Skeleton;
  lods: RiggedLod[];
  clips: RiggedClip[];
}

/** The smallest budget a level of detail gets. */
const MIN_LOD = 60;

/** Mesh a rigged scene (built in its rig's bind pose) at each level of detail, skin it, and sample the clips. */
export function buildRigged(scene: Scene3D, o: RiggedOptions): RiggedModel {
  const pose = scene.pose;
  if (!pose) throw new Error('rig: the scene has no pose (build it with ctx.lib.t2.scene3d({ k, pose }) from ctx.lib.rigs.body3d)');
  if (!pose.bind) throw new Error(`rig: the scene was built in ${pose.state} at t = ${pose.t}, not the bind pose (idle at t = 0)`);
  const skeleton = skeletonOf(pose), field = sceneField(scene), budget = o.budget ?? 2000, texels = o.texels ?? 4, lods: RiggedLod[] = [];
  for (let i = 0; i < Math.max(1, Math.min(4, o.lods ?? 3)); i++) {
    const b = Math.max(MIN_LOD, Math.floor(budget / 4 ** i));
    if (i && b >= lods[i - 1].budget) break;
    const result = buildMesh(scene, { ...o, budget: b, texels: Math.max(0.5, texels / 2 ** i) });
    lods.push({ result, skin: skinWeights(result.mesh, field, skeleton, o), budget: b });
  }
  const keys = Math.max(2, o.keys ?? 16);
  const clips = o.clips.map(c => {
    const times: number[] = [], poses: RiggedClip['poses'] = [];
    for (let j = 0; j < keys; j++) {
      const u = j / (keys - 1);
      times.push(Math.round(u * c.duration * 1e6) / 1e6);
      poses.push(pose.rig.pose(c.state, c.loop && j === keys - 1 ? 0 : u).bones);
    }
    return { ...c, times, poses };
  });
  return { rig: pose.rig, skeleton, lods, clips };
}

// ---- checks

export interface RiggedCheckOptions {
  /** Budget of the first level. */
  budget: number;
  metresPerUnit: number;
  height?: number;
  /** Largest stretch of a mesh edge in any clip pose before `skin-stretch` flags (default 2.5). */
  stretch?: number;
}

/** The mesh checks on the first level, then the skin's: weights, binding, bone lengths through the clips, stretch, and the levels' budgets. */
export function riggedChecks(m: RiggedModel, o: RiggedCheckOptions): MeshCheck[] {
  const lod0 = m.lods[0], out = meshChecks(lod0.result.mesh, { budget: o.budget, atlas: lod0.result.atlas, texels: lod0.result.texels, metresPerUnit: o.metresPerUnit, height: o.height });
  // weights: ≤ 4 a vertex (by construction), each set sums to 1, every joint exists
  let bad = 0;
  for (const { skin } of m.lods) for (let v = 0; v < skin.owner.length; v++) {
    let s = 0;
    for (let k = 0; k < 4; k++) { s += skin.weights[v * 4 + k]; if (skin.weights[v * 4 + k] > 0 && skin.joints[v * 4 + k] >= m.skeleton.bones.length) bad++; }
    if (Math.abs(s - 1) > 1e-3) bad++;
  }
  out.push({ id: 'skin-weights', status: bad ? 'fail' : 'pass', detail: bad ? `${bad} vertices with weights that do not sum to 1 or name no bone` : `${m.lods.reduce((s, l) => s + l.skin.owner.length, 0)} vertices, at most 4 bones each, weights sum to 1` });
  const u = lod0.skin.unbound, unk = lod0.skin.unknown;
  out.push({
    id: 'skin-bound', status: unk.length ? 'fail' : u.vertices ? 'flag' : 'pass',
    detail: unk.length ? `parts name bones the rig has not: ${unk.join(', ')} (bones: ${m.skeleton.bones.join(', ')})`
      : u.vertices ? `${u.vertices} vertices follow the nearest bone (parts without a bone: ${u.parts.join(', ')})` : 'every part names its bone',
  });
  // bone lengths through every clip key (the rig's own guarantee, checked)
  let worst = 0, where = '';
  for (const c of m.clips) c.poses.forEach((p, j) => m.skeleton.bones.forEach((b, i) => {
    const L0 = dist(m.skeleton.bind[i].a, m.skeleton.bind[i].b), L1 = dist(p[b].a, p[b].b), d = Math.abs(L1 - L0) / Math.max(1e-9, L0);
    if (d > worst) { worst = d; where = `${c.state} key ${j} ${b}`; }
  }));
  out.push({ id: 'clip-lengths', status: worst > 0.01 ? 'flag' : 'pass', detail: worst > 0.01 ? `${where}: ${(worst * 100).toFixed(1)} % off its bind length` : `${m.skeleton.bones.length} bones keep their lengths through ${m.clips.length} clips` });
  // how far a mesh edge stretches in the worst clip pose
  const limit = o.stretch ?? 2.5, I = lod0.result.mesh.indices, P = lod0.result.mesh.positions;
  const edge = (a: number, b: number, X: Float32Array) => Math.hypot(X[a * 3] - X[b * 3], X[a * 3 + 1] - X[b * 3 + 1], X[a * 3 + 2] - X[b * 3 + 2]);
  // edges much shorter than the usual one (slivers of the contour) would read as huge ratios for a tiny move: they are left out
  const lens: number[] = [];
  for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) lens.push(edge(I[t + e], I[t + ((e + 1) % 3)], P));
  const floor = 0.5 * (lens.sort((x, y) => x - y)[lens.length >> 1] ?? 0);
  let most = 1, at = '';
  for (const c of m.clips) for (let j = 0; j < c.poses.length; j++) {
    const q = skinPose(lod0.result.mesh, lod0.skin, jointPoses(m.skeleton, c.poses[j])).positions;
    for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = I[t + e], b = I[t + ((e + 1) % 3)], l0 = edge(a, b, P);
      if (l0 < Math.max(1e-6, floor)) continue;
      const r = edge(a, b, q) / l0;
      if (r > most) { most = r; at = `${c.state} key ${j}, ${lod0.result.mesh.parts[lod0.result.mesh.part[t / 3]]}`; }
    }
  }
  out.push({ id: 'skin-stretch', status: most > limit ? 'flag' : 'pass', detail: `an edge stretches at most ${most.toFixed(2)}×${at ? ` (${at})` : ''}${most > limit ? `, over ${limit}×: blend the joint wider or split the part at it` : ''}` });
  const over = m.lods.filter(l => l.result.mesh.indices.length / 3 > l.budget);
  out.push({ id: 'lod-budget', status: over.length ? 'fail' : 'pass', detail: m.lods.map((l, i) => `LOD${i} ${l.result.mesh.indices.length / 3}/${l.budget}`).join(', ') });
  return out;
}

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---- glTF

export interface RiggedGlbOptions {
  name?: string;
  metresPerUnit: number;
  /** Switch distances of the levels, metres (default: the model's height × 0, 4, 12, 30). */
  distances?: number[];
}

/** Row-major 3×3 rotation → glTF quaternion [x, y, z, w]. */
export function quatOf(R: number[]): [number, number, number, number] {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = R, tr = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
  const l = Math.hypot(...q);
  return q.map(v => v / l) as [number, number, number, number];
}

const transpose = (R: number[]) => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const mul3 = (A: number[], B: number[]) => { const r = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return r; };
const apply = (R: number[], p: V3): V3 => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]];

/** Each joint's local rotation and translation (glTF node TRS) for a set of world joint poses. */
function localTrs(sk: Skeleton, J: JointPose[]): { r: [number, number, number, number]; t: V3 }[] {
  return J.map((j, i) => {
    const p = sk.parent[i];
    if (p < 0) return { r: quatOf(j.R), t: j.t };
    const Rp = transpose(J[p].R);
    return { r: quatOf(mul3(Rp, j.R)), t: apply(Rp, [j.t[0] - J[p].t[0], j.t[1] - J[p].t[1], j.t[2] - J[p].t[2]]) };
  });
}

/** `.glb` bytes for a rigged model: one skin, a node per bone, the levels as skinned meshes, a clip per state. */
export function riggedGlb(m: RiggedModel, o: RiggedGlbOptions): Uint8Array {
  const s = o.metresPerUnit, name = o.name ?? 'rigged', sk = m.skeleton, nb = sk.bones.length;
  // glTF frame about the rig's origin: artgen x / y / z → x / z / y, metres
  const G = (p: V3): V3 => [p[0] * s, p[2] * s, p[1] * s];
  const w = binWriter(), accessors: any[] = [], acc = (a: any) => { accessors.push(a); return accessors.length - 1; };
  const nodes: any[] = [{ name, children: [] as number[] }], jointNode = sk.bones.map((_, i) => i + 1);
  sk.bones.forEach((b, i) => {
    const p = sk.parent[i], a = G(sk.bind[i].a), pa = p < 0 ? [0, 0, 0] : G(sk.bind[p].a);
    nodes.push({ name: b, translation: [a[0] - pa[0], a[1] - pa[1], a[2] - pa[2]], children: [] as number[] });
  });
  sk.bones.forEach((_, i) => { const p = sk.parent[i]; (p < 0 ? nodes[0] : nodes[jointNode[p]]).children.push(jointNode[i]); });
  for (const n of nodes) if (!n.children.length) delete n.children;
  const ibm = new Float32Array(nb * 16);
  sk.bones.forEach((_, i) => { const a = G(sk.bind[i].a); ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -a[0], -a[1], -a[2], 1], i * 16); });
  const skins = [{ name, joints: jointNode, skeleton: 0, inverseBindMatrices: acc({ bufferView: w.view(typedBytes(ibm)), componentType: 5126, count: nb, type: 'MAT4' }) }];

  const meshes: any[] = [], materials: any[] = [], images: any[] = [], textures: any[] = [];
  const height = (m.lods[0].result.bounds[5] - m.lods[0].result.bounds[2]) * s, dists = o.distances ?? [0, 4, 12, 30].map(k => Math.round(k * height * 100) / 100);
  const lodInfo = m.lods.map((l, i) => {
    const r = l.result, g = glMeshArrays(r, s, [0, 0]), n = g.n, joints = new Uint8Array(n * 4), weights = new Float32Array(n * 4);
    joints.set(l.skin.joints); weights.set(l.skin.weights);
    const attributes = {
      POSITION: acc({ bufferView: w.view(typedBytes(g.pos), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC3', min: g.min, max: g.max }),
      NORMAL: acc({ bufferView: w.view(typedBytes(g.nor), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC3' }),
      TANGENT: acc({ bufferView: w.view(typedBytes(g.tan), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC4' }),
      TEXCOORD_0: acc({ bufferView: w.view(typedBytes(g.uv), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC2' }),
      JOINTS_0: acc({ bufferView: w.view(typedBytes(joints), ARRAY_BUFFER), componentType: 5121, count: n, type: 'VEC4' }),
      WEIGHTS_0: acc({ bufferView: w.view(typedBytes(weights), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC4' }),
    };
    const indices = acc({ bufferView: w.view(typedBytes(g.idx), ELEMENT_ARRAY_BUFFER), componentType: 5125, count: g.idx.length, type: 'SCALAR' });
    const first = textures.length;
    for (const img of [r.textures.color, r.textures.normal, r.textures.orm]) { images.push({ bufferView: w.view(encodePNG(img)), mimeType: 'image/png' }); textures.push({ sampler: 0, source: images.length - 1 }); }
    materials.push(materialOf(`${name}_LOD${i}`, r.look, first));
    meshes.push({ name: `${name}_LOD${i}`, primitives: [{ attributes, indices, material: i }] });
    nodes.push({ name: `${name}_LOD${i}`, mesh: i, skin: 0 });
    nodes[0].children.push(nodes.length - 1);
    return { node: nodes.length - 1, name: `${name}_LOD${i}`, triangles: g.idx.length / 3, budget: l.budget, texelsPerUnit: r.texels, distance: dists[i] ?? dists[dists.length - 1] };
  });

  const animations = m.clips.map(c => {
    const input = acc({ bufferView: w.view(typedBytes(new Float32Array(c.times))), componentType: 5126, count: c.times.length, type: 'SCALAR', min: [c.times[0]], max: [c.times[c.times.length - 1]] });
    const trs = c.poses.map(p => localTrs(sk, jointPoses(sk, p, G)));
    const samplers: any[] = [], channels: any[] = [];
    sk.bones.forEach((_, i) => {
      const rot = new Float32Array(c.times.length * 4), tr = new Float32Array(c.times.length * 3);
      let prev: number[] | undefined;
      trs.forEach((k, j) => {
        let q = k[i].r;
        // keep each key on the same side as the last, so the interpolation takes the short way
        if (prev && q[0] * prev[0] + q[1] * prev[1] + q[2] * prev[2] + q[3] * prev[3] < 0) q = q.map(v => -v) as typeof q;
        rot.set(q, j * 4); tr.set(k[i].t, j * 3); prev = q;
      });
      for (const [path, data, type] of [['rotation', rot, 'VEC4'], ['translation', tr, 'VEC3']] as const) {
        samplers.push({ input, interpolation: 'LINEAR', output: acc({ bufferView: w.view(typedBytes(data)), componentType: 5126, count: c.times.length, type }) });
        channels.push({ sampler: samplers.length - 1, target: { node: jointNode[i], path } });
      }
    });
    return { name: c.state, samplers, channels };
  });

  const unlit = m.lods[0].result.look === 'baked';
  const json = {
    asset: { version: '2.0', generator: 'artgen' }, ...(unlit && { extensionsUsed: ['KHR_materials_unlit'] }),
    scene: 0, scenes: [{ nodes: [0] }], nodes, skins, meshes, materials, animations,
    samplers: [{ magFilter: NEAREST, minFilter: NEAREST, wrapS: CLAMP, wrapT: CLAMP }], textures, images, accessors, bufferViews: w.views,
    buffers: [{ byteLength: w.length }],
    extras: {
      artgen: {
        rig: { plan: m.rig.plan, set: m.rig.set, height: m.rig.height, bones: sk.bones }, metresPerUnit: s, look: m.lods[0].result.look, mode: m.lods[0].result.mode,
        lods: lodInfo, clips: Object.fromEntries(m.clips.map(c => [c.state, { duration: c.duration, loop: c.loop, keys: c.times.length }])),
      },
    },
  };
  return glbBytes(json, w.bin());
}

// ---- preview

/** The first level posed: what the rasteriser draws. */
export function posedView(m: RiggedModel, pose: Pose3D | Record<string, { a: V3; b: V3 }>, lod = 0): ViewMesh {
  const l = m.lods[Math.min(lod, m.lods.length - 1)], bones = 'rig' in pose ? (pose as Pose3D).bones : pose as Record<string, { a: V3; b: V3 }>;
  const q = skinPose(l.result.mesh, l.skin, jointPoses(m.skeleton, bones));
  return { ...viewOfMesh(l.result), positions: q.positions, normals: q.normals, tangents: q.tangents };
}

export interface ClipStripOptions { frames?: number; yaw?: number; pitch?: number; w?: number; h?: number; light?: V3; background?: string; ss?: number }

/** A row per clip: `frames` poses through it from one fixed camera (default 3/4 front), framed on the bind pose so motion shows. */
export function clipStrip(m: RiggedModel, o: ClipStripOptions = {}): Grid {
  const n = o.frames ?? 6, w = o.w ?? 72, h = o.h ?? 96, rows = m.clips.length || 1, out = new Grid(n * (w + 1) - 1, rows * (h + 1) - 1);
  const bind = viewOfMesh(m.lods[0].result), { center, radius } = viewBounds(bind);
  const cam = orbitCamera({ target: center, yaw: o.yaw ?? 30, pitch: o.pitch ?? 15, w, h }, radius * 1.15);
  m.clips.forEach((c, row) => {
    for (let i = 0; i < n; i++) {
      const u = c.loop ? i / n : i / Math.max(1, n - 1);
      out.blit(rasterMesh(posedView(m, m.rig.pose(c.state, u)), cam, { light: o.light, background: o.background, ss: o.ss }), i * (w + 1), row * (h + 1));
    }
  });
  return out;
}
