/**
 * Shared body rigs (R6b, docs/STAGES.md §6): one skeleton per body plan, retargeted across characters and creatures, on
 * top of `anim.rig` (forward kinematics, two-bone IK). A template asks for `bodyRig('biped', { size, facing, height })`,
 * draws its primitives along the bones of `rig.pose(state, t)` and exports `rig.anchors(pose)`; limbs, gaits and facings
 * come from here, so a template is mostly costume.
 *
 *   plans        biped, quadruped (and `large`: the same bones, heavier proportions), flyer, serpent, turret
 *   bone lengths fractions of the body height (`PROPORTIONS`), in rig space: the same for every facing, state and frame
 *   projection   bones live in the body's side plane (forward, up) with a lateral offset per limb (wings spread in the
 *                front plane, a serpent's wave lies in the ground plane); the facing's yaw projects them to the frame
 *   clips        idle, walk, attack, hurt (flyer: hover, fly), as angle tracks over t, with foot IK on the ground
 *
 * Conventions follow `anim.ts`: angles in degrees in the plane, 0 = down, 90 = forward, 180 = up. In the frame, x runs
 * right and y down; the body's right is the viewer's left when it faces the viewer.
 */
import { pingpong, rig, track, type Bone, type BoneDef, type P2, type Pose, type Rig } from './anim.ts';

export const RIG_PLANS = ['biped', 'quadruped', 'flyer', 'serpent', 'turret'] as const;
export type RigPlan = (typeof RIG_PLANS)[number];

/** brief.body → plan: humanoid → biped, large → quadruped (with the `large` proportions), the rest by name. */
export const BODY_PLAN: Record<string, RigPlan> = { humanoid: 'biped', biped: 'biped', quadruped: 'quadruped', large: 'quadruped', flyer: 'flyer', serpent: 'serpent', turret: 'turret' };

/**
 * Bone lengths as fractions of the body height; `large` and other presets are named sets. Pairs share a key (`arm_up`,
 * `leg_lo`; `armL_up` overrides one side). The keys that are not bones set how the body hangs together: `legSep` and
 * `armSep` (lateral offset of a limb from the centre line), `barrel` (the thickness of a quadruped's body), `hover` (a
 * flyer's height above its shadow), `rear` (how high a serpent's head rears), `hullH` (a turret's hull height).
 * `height` means: biped, head top above the ground; quadruped, top of the back; flyer, the body's length; serpent, how
 * high the head rears; turret, hull and turret together.
 */
export interface Proportions { [bone: string]: number }
export const PROPORTIONS: Record<RigPlan | 'large', Proportions> = {
  biped: { hip: 0.02, spine: 0.36, neck: 0.04, head: 0.38, arm_up: 0.16, arm_lo: 0.17, leg_up: 0.1, leg_lo: 0.1, shoulder: 0.9, legSep: 0.075, armSep: 0.205 },
  quadruped: { spine: 1.25, neck: 0.4, head: 0.5, tail: 0.5, leg_up: 0.19, leg_lo: 0.19, barrel: 0.66, legSep: 0.2, hindAt: 0.08, foreAt: 0.92 },
  large: { spine: 1.0, neck: 0.55, head: 0.34, tail: 0.55, leg_up: 0.17, leg_lo: 0.17, barrel: 0.64, legSep: 0.24, hindAt: 0.1, foreAt: 0.9 },
  flyer: { body: 0.8, head: 0.5, tail: 0.5, wing: 0.75, wing_tip: 0.75, hover: 1.5, wingUp: 0.2, wingSep: 0.15 },
  serpent: { seg: 0.39, rear: 1 },
  turret: { hull: 1.6, turret: 0.45, barrel: 1, hullH: 0.25, turretAt: 0.5 },
};

export interface BodyRigOptions {
  size: [number, number];
  /** s, se, e, ne, n, sw, w, nw; the 16-way names round to the nearest of these. */
  facing: string;
  /** y of the feet (default round(h × 0.95)). */
  ground?: number;
  /** Body height in px (default from the plan and the frame). */
  height?: number;
  proportions?: Partial<Proportions>;
  /** Depth shown as a vertical shift: px up the frame per px away from the viewer (default 0.3, the 3/4 cameras). */
  tilt?: number;
}

/** Screen angles of the eight facings, degrees: 0 faces the viewer, 90 is east (right), 180 is the back. */
const YAW8: Record<string, number> = { s: 0, se: 45, e: 90, ne: 135, n: 180, nw: -135, w: -90, sw: -45 };
const YAW16: Record<string, number> = { ssw: -22.5, wsw: -67.5, wnw: -112.5, nnw: -157.5, nne: 157.5, ene: 112.5, ese: 67.5, sse: 22.5 };
/** Yaw of a facing name in degrees; the 16-way names round (half away from the front) to the nearest of the eight; unknown names face the viewer. */
export function facingYaw(facing: string): number {
  if (facing in YAW8) return YAW8[facing];
  const d = YAW16[facing];
  return d === undefined ? 0 : Math.sign(d) * Math.round(Math.abs(d) / 45) * 45;
}

/** A pose in frame pixels (`anim.Pose`) with the depth of the projection and facing-aware points. */
export interface BodyPose extends Pose {
  /** How near the viewer a bone is (its middle, rig px along the facing's depth axis): paint the smaller ones first. */
  depth(name: string): number;
  /** The names sorted far to near. */
  far(names: string[]): string[];
  /** The point `u` along a bone moved `fwd` px along the body's forward axis, `side` px to its right and `up` px up (rig px, then projected): eyes, horns, a held item. */
  at(name: string, u?: number, fwd?: number, side?: number, up?: number): P2;
}

export interface BodyRig {
  plan: RigPlan;
  /** The proportion set the lengths came from (`large` is a quadruped plan with its own set). */
  set: RigPlan | 'large';
  /** Rig-space bone lengths in px: the same for every facing, state and frame of one asset. */
  lengths: Record<string, number>;
  /** The facing as the templates use it: yaw (radians), sin, cos and |sin|. */
  yaw: number; sx: number; front: number; side: number;
  /** Body height in px and the y of the feet. */
  height: number; ground: number;
  /** A pose for a state at t ∈ [0, 1): the plan's clip for the state (unknown states use idle), plus overrides (relative angles, IK targets in the body's plane). */
  pose(state: string, t: number, o?: { angles?: Record<string, number>; ik?: Record<string, { target: P2; bend?: 1 | -1 }> }): BodyPose;
  /** Standard anchors of a pose in whole frame pixels: ground, head, hand (biped), tail (quadruped, serpent), muzzle (turret). */
  anchors(pose: Pose): Record<string, P2>;
}

type P3 = [number, number, number]; // forward, up, right
type Plane = 'side' | 'front' | 'ground';

/** A set of bones solved in one plane. `origin` is where the plane's (0, 0) sits in the body (a point on a host bone for wings). */
interface Group {
  plane: Plane;
  /** front plane: which way the plane's x axis points sideways (−1 left, +1 right). */
  sign: 1 | -1;
  bones: Record<string, BoneDef>;
  /** Lateral offset of each bone (side plane), px. */
  z: Record<string, number>;
  origin: P3 | { host: string; u: number; delta: P3 };
}

interface Clip {
  angles?: Record<string, number>;
  ik?: Record<string, { target: P2; bend?: 1 | -1 }>;
  /** Moves the first group's root (a bob, a lunge), plane px. */
  root?: P2;
  /** Height above the plane per bone end (a serpent's head rearing), px. */
  lift?: Record<string, [number, number]>;
}

interface Spec { groups: Group[]; clip(state: string, t: number): Clip; anchorBones: Record<string, [string, number]> }

const RAD = Math.PI / 180, TAU = Math.PI * 2;
const angOf = (dx: number, dy: number) => Math.atan2(dx, dy) / RAD;
const sin = (t: number, off = 0) => Math.sin((t + off) * TAU);
const cos = (t: number, off = 0) => Math.cos((t + off) * TAU);
const hold = (keys: [number, number][], t: number) => track(keys, t, { ease: 'inOut' });

/** A foot's place over a stride: `x` swings by `stride` about `x0`, the foot lifts while it moves forward. */
const foot = (t: number, off: number, x0: number, ground: number, stride: number, lift: number): P2 => [x0 + stride * sin(t, off), ground - lift * Math.max(0, cos(t, off))];
/** How far the body must drop for a leg of length `L` to reach a foot `s` px away sideways. */
const sag = (L: number, s: number) => L - Math.sqrt(Math.max(0, L * L - s * s));

const STATE_ALIAS: Record<string, string> = { run: 'walk', move: 'walk', fly: 'walk', hover: 'idle', stand: 'idle', strike: 'attack', hit: 'hurt' };

export function bodyRig(plan: RigPlan | 'large', o: BodyRigOptions): BodyRig {
  const set = plan, pl: RigPlan = plan === 'large' ? 'quadruped' : plan;
  const [w, h] = o.size, cx = w / 2, ground = o.ground ?? Math.round(h * 0.95), tilt = o.tilt ?? 0.3;
  const H = o.height ?? Math.round(h * ({ biped: 0.89, quadruped: 0.375, flyer: 0.25, serpent: 0.22, turret: 0.4 }[pl] * (plan === 'large' ? 1.15 : 1)));
  const base = PROPORTIONS[set], user = o.proportions ?? {};
  const prop = (name: string, generic = name.replace(/^(leg|arm)[FB]?[LR]_/, '$1_')): number => user[name] ?? user[generic] ?? base[name] ?? base[generic] ?? 0;
  const len = (name: string, generic?: string) => H * prop(name, generic);
  const yaw = facingYaw(o.facing) * RAD, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx);

  const spec = SPECS[pl]({ H, len, prop, given: n => n in user });
  const rigs: Rig[] = spec.groups.map(g => rig({ root: [0, 0], bones: g.bones }));
  const lengths: Record<string, number> = {};
  for (const g of spec.groups) for (const [n, b] of Object.entries(g.bones)) lengths[n] = b.len;

  /** Every bone's end points in the body (forward, up, right), before the facing projects them. */
  const solve = (state: string, t: number, ov?: { angles?: Record<string, number>; ik?: Record<string, { target: P2; bend?: 1 | -1 }> }) => {
    const clip = spec.clip(STATE_ALIAS[state] ?? state, t);
    const angles = { ...clip.angles, ...ov?.angles }, ik = { ...clip.ik, ...ov?.ik };
    const p3: Record<string, [P3, P3]> = {}, rel: Record<string, number> = {};
    spec.groups.forEach((g, gi) => {
      const names = Object.keys(g.bones), gik = Object.fromEntries(Object.entries(ik).filter(([n]) => names.includes(n)));
      const pose = rigs[gi].pose(angles, { ...(gi === 0 && clip.root && { root: clip.root }), ik: gik });
      let origin: P3;
      if ('host' in g.origin) {
        const [a, b] = p3[g.origin.host], u = g.origin.u, d = g.origin.delta;
        origin = [a[0] + (b[0] - a[0]) * u + d[0], a[1] + (b[1] - a[1]) * u + d[1], a[2] + (b[2] - a[2]) * u + d[2]];
      } else origin = g.origin;
      const map = (p: P2, name: string, end: 0 | 1): P3 => {
        const lift = clip.lift?.[name]?.[end] ?? 0, z = g.z[name] ?? 0;
        return g.plane === 'side' ? [origin[0] + p[0], origin[1] - p[1] + lift, origin[2] + z]
          : g.plane === 'front' ? [origin[0], origin[1] - p[1] + lift, origin[2] + g.sign * p[0] + z]
          : [origin[0] + p[0], origin[1] + lift, origin[2] + p[1] + z];
      };
      for (const n of names) { const b = pose.bone(n); p3[n] = [map(b.a, n, 0), map(b.b, n, 1)]; rel[n] = pose.angles[n]; }
    });
    return { p3, rel };
  };

  // the plan's rest pose sets the forward centre, so a long body (quadruped, serpent) sits in the middle of the frame
  let fc = 0;
  if (pl !== 'biped') {
    const { p3 } = solve('idle', 0), fs = Object.values(p3).flatMap(([a, b]) => [a[0], b[0]]);
    fc = (Math.min(...fs) + Math.max(...fs)) / 2;
  }
  const proj = (p: P3): P2 => { const f = p[0] - fc; return [cx + f * sx - p[2] * front, ground - p[1] + tilt * (f * front + p[2] * sx)]; };
  const depthOf = (p: P3) => (p[0] - fc) * front + p[2] * sx;

  const posed = (state: string, t: number, ov?: Parameters<BodyRig['pose']>[2]): BodyPose => {
    const { p3, rel } = solve(state, t, ov), bones: Record<string, Bone> = {}, dep: Record<string, number> = {};
    for (const [n, [a3, b3]] of Object.entries(p3)) {
      const a = proj(a3), b = proj(b3);
      bones[n] = { name: n, a, b, angle: angOf(b[0] - a[0], b[1] - a[1]), len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
      dep[n] = (depthOf(a3) + depthOf(b3)) / 2;
    }
    const get = (n: string) => { const b = bones[n]; if (!b) throw new Error(`rig: no bone ${n}`); return b; };
    return {
      bones, angles: rel, bone: get, end: n => get(n).b, start: n => get(n).a,
      along(n, u, s = 0) { const b = get(n), dx = b.b[0] - b.a[0], dy = b.b[1] - b.a[1], l = Math.hypot(dx, dy) || 1; return [b.a[0] + dx * u + (-dy / l) * s, b.a[1] + dy * u + (dx / l) * s]; },
      depth: n => { get(n); return dep[n]; },
      far: names => [...names].sort((a, b) => dep[a] - dep[b]),
      at(n, u = 0.5, fwd = 0, s = 0, up = 0) {
        get(n);
        const [a, b] = p3[n];
        return proj([a[0] + (b[0] - a[0]) * u + fwd, a[1] + (b[1] - a[1]) * u + up, a[2] + (b[2] - a[2]) * u + s]);
      },
    };
  };

  const anchors = (pose: Pose): Record<string, P2> => {
    const out: Record<string, P2> = { ground: [Math.round(cx), ground] };
    for (const [name, [bone, u]] of Object.entries(spec.anchorBones)) { const b = pose.bones[bone], p: P2 = [b.a[0] + (b.b[0] - b.a[0]) * u, b.a[1] + (b.b[1] - b.a[1]) * u]; out[name] = [Math.round(p[0]), Math.round(p[1])]; }
    return out;
  };

  return { plan: pl, set, lengths, yaw, sx, front, side, height: H, ground, pose: posed, anchors };
}

// ---------------------------------------------------------------------------------------------------------------
// plans

interface Ctx { H: number; len(name: string, generic?: string): number; prop(name: string, generic?: string): number; /** The caller overrode this proportion. */ given(name: string): boolean }

const SPECS: Record<RigPlan, (c: Ctx) => Spec> = {
  biped({ H, len, prop, given }) {
    const g = (n: string) => len(n), legUp = g('leg_up'), legLo = g('leg_lo'), leg = legUp + legLo;
    const hip = g('hip'), neck = g('neck'), head = g('head');
    // the spine takes what the others leave of the height, so a bigger head (direction.scale.proportions.headRatio) shortens the torso
    const spine = given('spine') ? len('spine') : H * (1 - prop('hip') - prop('neck') - prop('head') - prop('leg_up') - prop('leg_lo'));
    const legSep = H * prop('legSep'), armSep = H * prop('armSep'), shoulder = prop('shoulder');
    const bones: Record<string, BoneDef> = { hip: { len: hip, angle: 180 }, spine: { parent: 'hip', len: Math.max(0.1, spine), angle: 0 }, neck: { parent: 'spine', len: neck, angle: 0 }, head: { parent: 'neck', len: head, angle: 0 } };
    const z: Record<string, number> = {};
    for (const [s, k] of [['L', -1], ['R', 1]] as const) {
      bones[`arm${s}_up`] = { parent: 'spine', at: shoulder, len: len(`arm${s}_up`), angle: 180 };
      bones[`arm${s}_lo`] = { parent: `arm${s}_up`, len: len(`arm${s}_lo`), angle: 0 };
      bones[`leg${s}_up`] = { parent: 'hip', at: 0, len: len(`leg${s}_up`), angle: 180 };
      bones[`leg${s}_lo`] = { parent: `leg${s}_up`, len: len(`leg${s}_lo`), angle: 0 };
      for (const n of ['arm', 'leg']) for (const p of ['up', 'lo']) z[`${n}${s}_${p}`] = k * (n === 'arm' ? armSep : legSep);
    }
    const stride = H * 0.11, lift = H * 0.03, armSwing = 12;
    const clip = (state: string, t: number): Clip => {
      const rel: Record<string, number> = {}, ik: Clip['ik'] = {};
      let root: P2 = [0, 0];
      const arms = (swing: (s: 'L' | 'R') => number, elbow = (_: 'L' | 'R') => 4) => { for (const s of ['L', 'R'] as const) { rel[`arm${s}_up`] = 180 + swing(s); rel[`arm${s}_lo`] = elbow(s); } };
      if (state === 'walk') {
        const off = { L: 0, R: 0.5 }, feet = (['L', 'R'] as const).map(s => foot(t, off[s], 0, leg, stride, lift));
        for (const [i, s] of (['L', 'R'] as const).entries()) ik[`leg${s}_lo`] = { target: feet[i], bend: 1 };
        root = [0, Math.round(Math.max(...feet.map(f => sag(leg, f[0]))) * 1.6)];
        // each arm swings against the leg on its side
        arms(s => -armSwing * sin(t, off[s]), s => 8 + 14 * Math.max(0, -sin(t, off[s])));
      } else if (state === 'attack') {
        // the right arm raises, strikes and recovers; the left balances
        const a = hold([[0, 150], [0.3, 160], [0.55, 45], [0.8, 20], [1, 150]], t), lo = hold([[0, 30], [0.3, 40], [0.55, 6], [0.8, 10], [1, 30]], t);
        arms(s => (s === 'R' ? a : -12), s => (s === 'R' ? lo : 10));
        rel.spine = hold([[0, -4], [0.3, 6], [0.55, -10], [0.8, -3], [1, -4]], t);
        root = [0, 0];
      } else if (state === 'hurt') {
        const k = Math.sin(Math.PI * Math.min(1, t * 1.6));
        rel.spine = 12 * k; rel.head = -8 * k; rel.neck = 4 * k;
        arms(s => (s === 'R' ? -48 : 44) * k, () => 14 * k);
        root = [-0.06 * H * k, 0];
      } else {
        const b = pingpong(t); // a breath: chest and head rise a little, the arms follow
        rel.spine = -2.5 * b; rel.neck = 2.5 * b;
        arms(s => (s === 'L' ? 1 : -1) * 2 * b);
      }
      return { angles: rel, ik, root };
    };
    return {
      groups: [{ plane: 'side', sign: 1, bones, z, origin: [0, leg, 0] }], clip,
      anchorBones: { head: ['head', 0.5], hand: ['armR_lo', 1] },
    };
  },

  quadruped({ H, len, prop }) {
    const spine = len('spine'), legUp = len('leg_up'), legLo = len('leg_lo'), leg = legUp + legLo, barrel = H * prop('barrel'), legSep = H * prop('legSep');
    const bones: Record<string, BoneDef> = {
      spine: { len: spine, angle: 90 },
      neck: { parent: 'spine', len: len('neck'), angle: 50 },
      head: { parent: 'neck', len: len('head'), angle: -42 },
      tail: { parent: 'spine', at: 0, len: len('tail'), angle: 155 },
    };
    const z: Record<string, number> = {}, legs: [string, number, number][] = []; // name, hip x on the spine, gait offset
    for (const [e, at, off] of [['B', prop('hindAt'), 0.5], ['F', prop('foreAt'), 0]] as const) for (const [s, k] of [['L', -1], ['R', 1]] as const) {
      const n = `leg${e}${s}`;
      bones[`${n}_up`] = { parent: 'spine', at, offset: [0, barrel / 2], len: len(`${n}_up`, 'leg_up'), angle: -90 };
      bones[`${n}_lo`] = { parent: `${n}_up`, len: len(`${n}_lo`, 'leg_lo'), angle: 0 };
      z[`${n}_up`] = z[`${n}_lo`] = k * legSep;
      legs.push([n, at * spine, (off + (s === 'R' ? 0.5 : 0)) % 1]);
    }
    const down = leg + barrel / 2, stride = H * 0.15, lift = H * 0.09;
    const clip = (state: string, t: number): Clip => {
      const rel: Record<string, number> = {}, ik: Clip['ik'] = {};
      let root: P2 = [0, 0];
      if (state === 'walk') {
        const fs = legs.map(([n, x0, off]) => ({ n, f: foot(t, off, x0, down, stride, lift), bend: (n[3] === 'F' ? -1 : 1) as 1 | -1 }));
        for (const { n, f, bend } of fs) ik[`${n}_lo`] = { target: f, bend };
        root = [0, Math.max(...fs.map(x => sag(leg, x.f[0] - legs.find(l => l[0] === x.n)![1]))) * 1.6];
        rel.neck = 50 + 4 * sin(t, 0.25); rel.head = -42 - 5 * sin(t, 0.25); rel.tail = 155 + 14 * sin(t, 0.1);
      } else if (state === 'attack') {
        // a lunge: draw back, bite forward, return
        const k = hold([[0, 0], [0.3, -0.5], [0.55, 1], [0.85, 0.2], [1, 0]], t);
        root = [H * 0.22 * k, 0];
        rel.neck = 50 - 28 * Math.max(0, k); rel.head = -42 + 14 * Math.max(0, k) + 10 * Math.min(0, k);
      } else if (state === 'hurt') {
        const k = Math.sin(Math.PI * Math.min(1, t * 1.6));
        root = [-H * 0.14 * k, 0]; rel.neck = 50 + 22 * k; rel.head = -42 + 18 * k; rel.tail = 155 + 25 * k;
      } else {
        const b = pingpong(t); // a breath: the head dips and rises, the tail drifts
        rel.neck = 50 - 4 * b; rel.head = -42 + 3 * b; rel.tail = 155 + 8 * b;
      }
      return { angles: rel, ik, root };
    };
    return { groups: [{ plane: 'side', sign: 1, bones, z, origin: [0, down, 0] }], clip, anchorBones: { head: ['head', 0.4], tail: ['tail', 1] } };
  },

  flyer({ H, len, prop }) {
    const bodyLen = len('body'), hover = H * prop('hover');
    const side: Group = {
      plane: 'side', sign: 1, z: {}, origin: [0, hover, 0],
      bones: { body: { len: bodyLen, angle: 90 }, head: { parent: 'body', len: len('head'), angle: -15 }, tail: { parent: 'body', at: 0, len: len('tail'), angle: 200 } },
    };
    const wing = (s: 'L' | 'R'): Group => ({
      plane: 'front', sign: s === 'L' ? -1 : 1, z: {},
      bones: { [`wing${s}`]: { len: len('wing'), angle: 90 }, [`wing${s}_tip`]: { parent: `wing${s}`, len: len('wing_tip'), angle: 0 } },
      origin: { host: 'body', u: 0.45, delta: [0, H * prop('wingUp'), (s === 'L' ? -1 : 1) * H * prop('wingSep')] },
    });
    const clip = (state: string, t: number): Clip => {
      // wings beat in every state: flyers never stand still. Hovering beats shallower than flying.
      const hovering = !['walk', 'attack', 'hurt'].includes(state), amp = hovering ? 38 : 58, beat = sin(t), lag = sin(t, -0.18);
      const rel: Record<string, number> = {}, bob = Math.round(-beat * (hovering ? 0.6 : 0.9));
      for (const s of ['L', 'R']) { rel[`wing${s}`] = 90 + amp * beat; rel[`wing${s}_tip`] = -0.55 * amp * lag - 10; }
      let root: P2 = [0, bob * (H / 8)];
      if (state === 'attack') { const k = hold([[0, 0], [0.3, -0.5], [0.55, 1], [0.85, 0.2], [1, 0]], t); root = [H * 0.35 * k, root[1]]; rel.head = -15 - 25 * Math.max(0, k); }
      else if (state === 'hurt') { const k = Math.sin(Math.PI * Math.min(1, t * 1.6)); root = [-H * 0.25 * k, root[1] + H * 0.12 * k]; rel.head = -15 + 25 * k; }
      return { angles: rel, root };
    };
    return { groups: [side, wing('L'), wing('R')], clip, anchorBones: { head: ['head', 0.4] } };
  },

  serpent({ H, len, prop }) {
    const n = 8, seg = len('seg'), bones: Record<string, BoneDef> = {};
    for (let i = 0; i < n; i++) bones[`seg${i}`] = i ? { parent: `seg${i - 1}`, len: seg, angle: 0 } : { len: seg, angle: -90 };
    const rear = H * prop('rear'), A = 34;
    const clip = (state: string, t: number): Clip => {
      const moving = state === 'walk', amp = moving ? A : state === 'attack' || state === 'hurt' ? A * 0.5 : A * 0.35;
      // heading of each segment: a wave travelling headward while it moves, a slow sway when it rests
      const heading = (i: number) => -90 + amp * (moving ? sin(t, -i / 7 * 1.15) : sin(t, -i / 7 * 0.5) * (i / 7));
      const rel: Record<string, number> = {};
      for (let i = 0; i < n; i++) rel[`seg${i}`] = heading(i) - (i ? heading(i - 1) : 0);
      // the head end rears: joint j of the chain is lifted by a falling curve
      let k = 1, root: P2 = [0, 0];
      if (state === 'attack') { const s = hold([[0, 0], [0.3, -0.4], [0.55, 1], [0.85, 0.3], [1, 0]], t); k = 1 + 0.5 * Math.max(0, s); root = [H * 0.5 * s, 0]; }
      else if (state === 'hurt') { const s = Math.sin(Math.PI * Math.min(1, t * 1.6)); k = 1 - 0.5 * s; root = [-H * 0.3 * s, 0]; }
      else if (moving) k = 1 + 0.08 * sin(t);
      const up = (j: number) => rear * k * Math.max(0, 1 - j / 2.4) ** 1.5;
      const lift: Record<string, [number, number]> = {};
      for (let i = 0; i < n; i++) lift[`seg${i}`] = [up(i), up(i + 1)];
      return { angles: rel, root, lift };
    };
    return { groups: [{ plane: 'ground', sign: 1, bones, z: {}, origin: [0, 0, 0] }], clip, anchorBones: { head: ['seg0', 0], tail: [`seg${n - 1}`, 1] } };
  },

  turret({ H, len, prop }) {
    const hullH = H * prop('hullH'), at = prop('turretAt');
    const bones: Record<string, BoneDef> = { hull: { len: len('hull'), angle: 90 }, turret: { parent: 'hull', at, len: len('turret'), angle: 90 }, barrel: { parent: 'turret', len: len('barrel'), angle: -90 } };
    const clip = (state: string, t: number): Clip => {
      // a shot kicks the barrel up and back; everything else holds still
      if (state !== 'attack') return {};
      const k = hold([[0, 0], [0.15, 1], [1, 0]], t);
      return { angles: { barrel: -90 + 6 * k } };
    };
    return { groups: [{ plane: 'side', sign: 1, bones, z: {}, origin: [0, hullH, 0] }], clip, anchorBones: { muzzle: ['barrel', 1] } };
  },
};
