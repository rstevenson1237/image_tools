/**
 * Skinning (R7b, docs/RIGS3D.md §4): a baked mesh bound to the bones of a body-rig pose, and the joint transforms of
 * any other pose.
 *
 *   owner     each vertex belongs to the bone of the solid it lies on (the geometry solid with the least distance there,
 *             its spec's `bone`); a solid without a bone follows the bone nearest the vertex
 *   blending  near a joint the vertex shares its weight with the bone across it (the parent, a child, or a sibling
 *             through a short parent such as the hip): equal at the joint, nothing a blend radius away (half the shorter
 *             bone), smoothstep between. At most four bones a vertex; the weights sum to 1.
 *   joints    a pose moves each bone rigidly: the bind start goes to the posed start and the least rotation turns the bind
 *             direction onto the posed one (bones keep their lengths, so nothing stretches along a bone)
 */
import type { Pose3D } from '../anim/rig3d.ts';
import type { V3 } from '../t2/scene3d.ts';
import type { SceneField } from './field.ts';
import type { TriMesh } from './uv.ts';

export interface Skeleton {
  bones: string[];
  /** Index of each bone's parent, −1 for a root. */
  parent: number[];
  /** Bind-pose start and end of each bone, model units. */
  bind: { a: V3; b: V3 }[];
}

/** The skeleton of a pose: its rig's bones (parents first) at the pose's places. */
export function skeletonOf(pose: Pose3D): Skeleton {
  const bones = pose.rig.bones, index = new Map(bones.map((b, i) => [b, i]));
  return { bones, parent: bones.map(b => { const p = pose.rig.parents[b]; return p === undefined ? -1 : index.get(p)!; }), bind: bones.map(b => ({ a: [...pose.bones[b].a] as V3, b: [...pose.bones[b].b] as V3 })) };
}

export interface Skin {
  /** 4 joint indexes per vertex (into `Skeleton.bones`) and their weights; unused slots have weight 0. */
  joints: Uint8Array;
  weights: Float32Array;
  /** The bone each vertex belongs to. */
  owner: Uint16Array;
  /** Parts whose solids name no bone (their vertices follow the nearest bone), and how many vertices that is. */
  unbound: { parts: string[]; vertices: number };
  /** Spec bones that are not in the skeleton (their parts follow the nearest bone too). */
  unknown: string[];
}

export interface SkinOptions {
  /** Blend radius as a share of the shorter bone at a joint (default 0.5; 0 binds every vertex to one bone). */
  blend?: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; };

/** Distance from `p` to the segment a–b. */
function segDist(p: V3, a: V3, b: V3): number {
  const ab = sub(b, a), l2 = dot(ab, ab), t = l2 > 1e-12 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return len([p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t]);
}

/** The bones a bone blends with, each with the joint point and the blend radius there. */
function neighbours(sk: Skeleton, blend: number): { j: number; at: V3; r: number }[][] {
  const L = sk.bind.map(b => len(sub(b.b, b.a))), kids = sk.bones.map((_, i) => sk.parent.map((p, c) => (p === i ? c : -1)).filter(c => c >= 0));
  return sk.bones.map((_, i) => {
    const out: { j: number; at: V3; r: number }[] = [], p = sk.parent[i];
    if (p >= 0) {
      out.push({ j: p, at: sk.bind[i].a, r: blend * Math.min(L[i], L[p]) });
      // a short parent (the hip between the spine and the legs) passes the joint on to its other children
      for (const s of kids[p]) if (s !== i && L[p] < 0.25 * Math.min(L[i], L[s])) out.push({ j: s, at: sk.bind[s].a, r: blend * Math.min(L[i], L[s]) });
    }
    for (const c of kids[i]) out.push({ j: c, at: sk.bind[c].a, r: blend * Math.min(L[i], L[c]) });
    return out.filter(n => n.r > 1e-9);
  });
}

const smooth = (x: number) => (x <= 0 ? 1 : x >= 1 ? 0 : 1 - x * x * (3 - 2 * x));

/** Bind a mesh built from `field` (in the skeleton's bind pose) to its bones. */
export function skinWeights(mesh: Pick<TriMesh, 'positions'>, field: SceneField, sk: Skeleton, o: SkinOptions = {}): Skin {
  const n = mesh.positions.length / 3, P = mesh.positions, index = new Map(sk.bones.map((b, i) => [b, i])), geo = field.solids.filter(s => s.geometry);
  const joints = new Uint8Array(n * 4), weights = new Float32Array(n * 4), owner = new Uint16Array(n), near = neighbours(sk, o.blend ?? 0.5);
  if (sk.bones.length > 255) throw new Error('skin: more than 255 bones');
  const unboundParts = new Set<string>(), unknown = new Set<string>();
  let unboundVerts = 0;
  for (let v = 0; v < n; v++) {
    const p: V3 = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    let solid = geo[0], best = Infinity;
    for (const s of geo) { const d = s.sdf(p[0], p[1], p[2]); if (d < best) { best = d; solid = s; } }
    let own = solid?.bone !== undefined ? index.get(solid.bone) : undefined;
    if (solid?.bone !== undefined && own === undefined) unknown.add(solid.bone);
    if (own === undefined) {
      unboundParts.add(solid?.part ?? '?'); unboundVerts++;
      let bd = Infinity;
      sk.bind.forEach((b, i) => { const d = segDist(p, b.a, b.b); if (d < bd) { bd = d; own = i; } });
    }
    owner[v] = own!;
    const ws: [number, number][] = [[own!, 1]];
    for (const nb of near[own!]) { const w = smooth(len(sub(p, nb.at)) / nb.r); if (w > 1e-4) ws.push([nb.j, w]); }
    ws.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const top = ws.slice(0, 4), total = top.reduce((s, [, w]) => s + w, 0);
    top.forEach(([j, w], k) => { joints[v * 4 + k] = j; weights[v * 4 + k] = w / total; });
  }
  return { joints, weights, owner, unbound: { parts: [...unboundParts].sort(), vertices: unboundVerts }, unknown: [...unknown].sort() };
}

/** A bone's move from the bind pose: p ↦ t + R (p − origin), R row-major 3×3. */
export interface JointPose { R: number[]; t: V3; origin: V3 }

/** The least rotation taking unit `a` onto unit `b` (row-major); antiparallel vectors turn half way round an axis across `a`. */
export function rotationBetween(a: V3, b: V3): number[] {
  const v = cross(a, b), c = dot(a, b);
  if (c < -1 + 1e-9) {
    const ax = unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
    return [2 * ax[0] * ax[0] - 1, 2 * ax[0] * ax[1], 2 * ax[0] * ax[2], 2 * ax[1] * ax[0], 2 * ax[1] * ax[1] - 1, 2 * ax[1] * ax[2], 2 * ax[2] * ax[0], 2 * ax[2] * ax[1], 2 * ax[2] * ax[2] - 1];
  }
  const k = 1 / (1 + c), [x, y, z] = v;
  return [
    1 - k * (y * y + z * z), -z + k * x * y, y + k * x * z,
    z + k * x * y, 1 - k * (x * x + z * z), -x + k * y * z,
    -y + k * x * z, x + k * y * z, 1 - k * (x * x + y * y),
  ];
}

export const applyR = (R: number[], p: V3): V3 => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]];

/** Joint transforms that take the skeleton's bind pose to `pose` (bones by name; the same rig). `map` puts points in another frame first (glTF's). */
export function jointPoses(sk: Skeleton, pose: Record<string, { a: V3; b: V3 }>, map: (p: V3) => V3 = p => p): JointPose[] {
  return sk.bones.map((name, i) => {
    const b0 = sk.bind[i], b1 = pose[name];
    if (!b1) throw new Error(`skin: the pose has no bone ${name}`);
    const a0 = map(b0.a), a1 = map(b1.a);
    return { R: rotationBetween(unit(sub(map(b0.b), a0)), unit(sub(map(b1.b), a1))), t: a1, origin: a0 };
  });
}

/** Positions, normals and tangents of a skinned mesh in a pose (linear blend skinning). */
export function skinPose(mesh: Pick<TriMesh, 'positions' | 'normals' | 'tangents'>, skin: Skin, joints: JointPose[]): { positions: Float32Array; normals: Float32Array; tangents: Float32Array } {
  const n = mesh.positions.length / 3, P = mesh.positions, N = mesh.normals, T = mesh.tangents;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), tan = new Float32Array(T.length);
  for (let v = 0; v < n; v++) {
    const p: V3 = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], nn: V3 = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]], tt: V3 = [T[v * 4], T[v * 4 + 1], T[v * 4 + 2]];
    const op: V3 = [0, 0, 0], on: V3 = [0, 0, 0], ot: V3 = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = skin.weights[v * 4 + k];
      if (!w) continue;
      const J = joints[skin.joints[v * 4 + k]], q = applyR(J.R, sub(p, J.origin)), rn = applyR(J.R, nn), rt = applyR(J.R, tt);
      for (let a = 0; a < 3; a++) { op[a] += w * (J.t[a] + q[a]); on[a] += w * rn[a]; ot[a] += w * rt[a]; }
    }
    pos.set(op, v * 3); nor.set(unit(on), v * 3); tan.set([...unit(ot), T[v * 4 + 3]], v * 4);
  }
  return { positions: pos, normals: nor, tangents: tan };
}
