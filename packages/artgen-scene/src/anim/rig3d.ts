/**
 * Body rigs in 3D (R7b, docs/RIGS3D.md §3): the shared skeletons of `rigs.ts` (R6b) in a 3D-mode model's own units and
 * frame, so a 3D template builds its parts along the bones of a pose and the mesh is skinned to the same bones.
 *
 *   frame       artgen model units: x to the viewer's right, y toward the viewer (the body's forward), z up; the feet (or
 *               a flyer's shadow) at z = 0, the body centred on x = y = 0. The body's right is −x (it faces the viewer).
 *   lengths     `height` model units tall; the bone lengths are the plan's proportions of it, the same in every pose
 *   clips       the plan's clips (idle, walk, attack, hurt; flyers: hover, fly), with the root moves unrounded
 *   bind pose   idle at t = 0: the pose a skinned mesh is built in (`bind()`)
 */
import type { P2 } from './anim.ts';
import { bodyRig, type BodyRig, type Proportions, type RigPlan, type Skel3 } from './rigs.ts';

export type V3 = [number, number, number];

export interface BodyRig3DOptions {
  /** Body height in model units (as `bodyRig`'s `height`: a biped's head top, a quadruped's back, …). */
  height: number;
  proportions?: Partial<Proportions>;
}

export interface Pose3D {
  /** The rig this pose came from, and the state and t it was asked for. */
  rig: BodyRig3D;
  state: string;
  t: number;
  /** Each bone's start and end in model units. */
  bones: Record<string, { a: V3; b: V3 }>;
  start(name: string): V3;
  end(name: string): V3;
  /** The point `u` along a bone (0 its start, 1 its end). */
  along(name: string, u?: number): V3;
  /** The point `u` along a bone moved `fwd` units along the body's forward axis, `side` to its right and `up` up. */
  at(name: string, u?: number, fwd?: number, side?: number, up?: number): V3;
  /** True for the bind pose (idle at t = 0), the pose a skinned mesh is built in. */
  bind: boolean;
}

export interface BodyRig3D {
  plan: RigPlan;
  set: RigPlan | 'large';
  height: number;
  /** Bone lengths in model units. */
  lengths: Record<string, number>;
  /** Bone names, each after its parent. */
  bones: string[];
  parents: Record<string, string | undefined>;
  /** The options it was made with (an exporter rebuilds the clips from them). */
  options: BodyRig3DOptions;
  pose(state: string, t: number, o?: { angles?: Record<string, number>; ik?: Record<string, { target: P2; bend?: 1 | -1 }> }): Pose3D;
  /** idle at t = 0. */
  bind(): Pose3D;
}

/** Body frame (forward, up, right) → model frame (x right on screen, y toward the viewer, z up). */
export const bodyToModel = (p: Skel3): V3 => [-p[2], p[0], p[1]];

const BIND_STATES = new Set(['idle', 'stand', 'hover']);

export function bodyRig3d(plan: RigPlan | 'large', o: BodyRig3DOptions): BodyRig3D {
  if (!(o.height > 0)) throw new Error('rigs.body3d: height (model units) must be positive');
  const r: BodyRig = bodyRig(plan, { size: [64, 64], facing: 's', height: o.height, proportions: o.proportions, continuous: true });
  const self: BodyRig3D = {
    plan: r.plan, set: r.set, height: r.height, lengths: { ...r.lengths }, bones: r.bones, parents: r.parents, options: { ...o },
    pose(state, t, ov) {
      const sk = r.skeleton(state, t, ov), bones: Record<string, { a: V3; b: V3 }> = {};
      for (const [n, [a, b]] of Object.entries(sk)) bones[n] = { a: bodyToModel(a), b: bodyToModel(b) };
      const get = (n: string) => { const b = bones[n]; if (!b) throw new Error(`rig: no bone ${n}`); return b; };
      const along = (n: string, u = 0.5): V3 => { const { a, b } = get(n); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; };
      return {
        rig: self, state, t, bones, bind: BIND_STATES.has(state) && t === 0 && !ov,
        start: n => get(n).a, end: n => get(n).b, along,
        // forward is +y, the body's right −x, up +z
        at: (n, u = 0.5, fwd = 0, side = 0, up = 0) => { const p = along(n, u); return [p[0] - side, p[1] + fwd, p[2] + up]; },
      };
    },
    bind: () => self.pose('idle', 0),
  };
  return self;
}
