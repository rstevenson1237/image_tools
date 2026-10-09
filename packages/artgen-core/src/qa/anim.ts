/**
 * Animation QA (P6c, SPEC §10 frame QA): checks over the frames of each state rather than one image.
 *
 *  - `frames`: bbox jitter (the feet or the centre jumping between neighbouring frames of a figure), colour drift
 *    (the colour mix changing frame to frame), loop seam (a looping state's last → first step much larger than its
 *    other steps). Flags.
 *  - `attack`: attack-like states need ≥ 4 logical frames (anticipation, swing, contact, recovery) and one held
 *    contact frame — a `durations` entry clearly longer than the rest. Flag.
 *  - `fill` (effects): share of interior pixels and of the brightest colour step per frame. A fireball drawn as a
 *    solid disc of its lightest colour reads as a sticker, not light; calibrated on the P6c effects. Flag.
 * Plus the onion-skin strip used by review sheets.
 */
import type { Direction } from '../direction.ts';
import { normHex } from '../lib/color.ts';
import { Grid } from '../lib/grid.ts';
import type { RenderResult } from '../render.ts';
import type { Check } from './conformance.ts';

export interface AnimState {
  name: string;
  loop: boolean;
  /** Logical frames and per-logical-frame durations (ms), when the brief gives them. */
  logical: number;
  durations?: number[];
  /** Displayed frames of the first facing, in order. */
  frames: Grid[];
}

export interface AnimInput { states: AnimState[] }

const LOOPING = /^(idle|walk|run|fly|swim|loop|burn|glow|flicker)/;
export const ATTACK_STATE = /^(attack|strike|slash|swing|stab|thrust|punch|kick|shoot|fire|cast|bite|claw|smash)/;

/** States of a render as frame QA sees them (first facing; loop per the brief, idle-like names loop by default). */
export function animInput(r: RenderResult): AnimInput {
  const f = r.facings[0];
  return {
    states: r.states.map(s => {
      const a = r.brief.anims?.[s], sub = Math.max(1, Math.floor(a?.sub ?? 1)), n = r.frames[s];
      const frames = r.cells.filter(c => c.state === s && c.facing === f).sort((x, y) => x.frame - y.frame).map(c => c.grid);
      return { name: s, loop: a?.loop ?? (r.brief.kind !== 'effect' && (n === 1 || LOOPING.test(s))), logical: n / sub, ...(a?.durations && { durations: a.durations }), frames };
    }),
  };
}

const opaqueAt = (g: Grid, i: number) => g.d[i * 4 + 3] === 255;

function bbox(g: Grid): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = g.w, y0 = g.h, x1 = -1, y1 = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (opaqueAt(g, y * g.w + x)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Share of pixels that differ between two frames, over the pixels opaque in either. */
export function frameDiff(a: Grid, b: Grid): number {
  let u = 0, d = 0;
  for (let i = 0; i < a.w * a.h; i++) {
    const oa = opaqueAt(a, i), ob = opaqueAt(b, i);
    if (!oa && !ob) continue;
    u++;
    if (oa !== ob || a.d[i * 4] !== b.d[i * 4] || a.d[i * 4 + 1] !== b.d[i * 4 + 1] || a.d[i * 4 + 2] !== b.d[i * 4 + 2]) d++;
  }
  return u ? d / u : 0;
}

function histogram(g: Grid): Map<string, number> {
  const m = new Map<string, number>();
  let n = 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) { const c = g.get(x, y)!; m.set(c, (m.get(c) ?? 0) + 1); n++; }
  for (const [k, v] of m) m.set(k, v / (n || 1));
  return m;
}
const histDist = (a: Map<string, number>, b: Map<string, number>) => {
  let d = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) d += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
  return d / 2;
};

export interface FrameQA {
  state: string;
  /** Largest step of the bbox bottom (feet) and horizontal centre between neighbouring frames, px. */
  feetJump: number;
  centreJump: number;
  /** Largest colour-histogram distance between neighbouring frames (0–1). */
  drift: number;
  /** Looping states: last → first frame difference ÷ the median neighbouring difference. */
  seam?: number;
}

export function frameQA(st: AnimState): FrameQA {
  const fs = st.frames, boxes = fs.map(bbox), hist = fs.map(histogram);
  let feetJump = 0, centreJump = 0, drift = 0;
  const diffs: number[] = [];
  for (let i = 1; i < fs.length; i++) {
    const a = boxes[i - 1], b = boxes[i];
    if (a && b) { feetJump = Math.max(feetJump, Math.abs(a.y1 - b.y1)); centreJump = Math.max(centreJump, Math.abs((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2)); }
    drift = Math.max(drift, histDist(hist[i - 1], hist[i]));
    diffs.push(frameDiff(fs[i - 1], fs[i]));
  }
  let seam: number | undefined;
  if (st.loop && fs.length > 2) {
    const s = [...diffs].sort((x, y) => x - y), med = s[s.length >> 1] || 1e-6;
    seam = Math.round((frameDiff(fs[fs.length - 1], fs[0]) / med) * 100) / 100;
  }
  return { state: st.name, feetJump, centreJump: Math.round(centreJump * 10) / 10, drift: Math.round(drift * 100) / 100, ...(seam !== undefined && { seam }) };
}

export interface FillQA {
  /** Per frame: opaque pixels whose 4 neighbours are opaque, ÷ opaque pixels. */
  interior: number[];
  /** Per frame: pixels in the lightest step of their ramp (outline excluded), ÷ opaque pixels. */
  brightest: number[];
}

/** Solid-fill metric for effects (per frame). */
export function fillQA(frames: Grid[], dir: Direction): FillQA {
  const lightest = new Set(Object.values(dir.palette.ramps).map(r => normHex(r[0])));
  const interior: number[] = [], brightest: number[] = [];
  for (const g of frames) {
    let n = 0, inner = 0, hot = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.alpha(x, y) !== 255) continue;
      n++;
      if (g.alpha(x + 1, y) === 255 && g.alpha(x - 1, y) === 255 && g.alpha(x, y + 1) === 255 && g.alpha(x, y - 1) === 255) inner++;
      if (lightest.has(g.get(x, y)!)) hot++;
    }
    interior.push(n ? Math.round((inner / n) * 100) / 100 : 0);
    brightest.push(n ? Math.round((hot / n) * 100) / 100 : 0);
  }
  return { interior, brightest };
}

export interface AnimThresholds {
  /** Max feet step between neighbouring frames of a figure, px. */
  feetMax: number;
  /** Max centre step, as a share of the frame width. */
  centreMax: number;
  /** Max colour-histogram distance between neighbouring frames of a figure. */
  driftMax: number;
  /** Max loop seam ratio (and the seam must also change ≥ `seamMinDiff` of the pixels to count). */
  seamMax: number;
  seamMinDiff: number;
  /** Attack states: min logical frames, and the contact frame must be held ≥ this × the median duration. */
  attackFrames: number;
  holdRatio: number;
  /** Effects: a frame is a solid blob when interior > `fillInterior` and brightest > `fillBright`; flag when more than `fillFrames` of the frames are. */
  fillInterior: number;
  fillBright: number;
  fillFrames: number;
}

export const ANIM_THRESHOLDS: AnimThresholds = {
  feetMax: 2, centreMax: 0.2, driftMax: 0.45, seamMax: 2.5, seamMinDiff: 0.2, attackFrames: 4, holdRatio: 1.5,
  fillInterior: 0.62, fillBright: 0.3, fillFrames: 0.34,
};

/** Frame QA, attack QA and (effects) solid-fill checks for conformance. */
export function animChecks(input: AnimInput, dir: Direction, kind: string | undefined, th: AnimThresholds = ANIM_THRESHOLDS): Check[] {
  const checks: Check[] = [], moving = input.states.filter(s => s.frames.length > 1), effect = kind === 'effect';
  // frames
  if (!moving.length) checks.push({ id: 'frames', status: 'skip', detail: 'no animated states' });
  else {
    const why: string[] = [], seen: string[] = [];
    for (const st of moving) {
      const q = frameQA(st), w = st.frames[0].w;
      if (!effect && q.feetJump > th.feetMax) why.push(`${st.name}: feet jump ${q.feetJump} px between frames`);
      if (!effect && q.centreJump > Math.max(2, w * th.centreMax)) why.push(`${st.name}: body shifts ${q.centreJump} px sideways between frames`);
      if (!effect && q.drift > th.driftMax) why.push(`${st.name}: colour mix drifts ${q.drift} between frames`);
      if (q.seam !== undefined && q.seam > th.seamMax && frameDiff(st.frames[st.frames.length - 1], st.frames[0]) >= th.seamMinDiff) why.push(`${st.name}: loop seam ${q.seam}× the other steps (last → first frame)`);
      seen.push(`${st.name} ${st.frames.length}f${q.seam !== undefined ? ` seam ${q.seam}` : ''}`);
    }
    checks.push({ id: 'frames', status: why.length ? 'flag' : 'pass', detail: why.length ? why.join('; ') : seen.join(', ') });
  }
  // attack
  const attacks = input.states.filter(s => ATTACK_STATE.test(s.name));
  if (!attacks.length) checks.push({ id: 'attack', status: 'skip', detail: 'no attack states' });
  else {
    const why: string[] = [], ok: string[] = [];
    for (const st of attacks) {
      if (st.logical < th.attackFrames) { why.push(`${st.name}: ${st.logical} frames (an attack needs ≥ ${th.attackFrames}: anticipation, swing, contact, recovery)`); continue; }
      const d = st.durations;
      if (!d) { why.push(`${st.name}: no held contact frame (give anims.${st.name}.durations with one frame held longer)`); continue; }
      const med = [...d].sort((a, b) => a - b)[d.length >> 1], max = Math.max(...d), at = d.indexOf(max);
      if (max < med * th.holdRatio || d.filter(x => x === max).length > 1) why.push(`${st.name}: no single held contact frame (durations ${d.join('/')} ms)`);
      else ok.push(`${st.name}: ${st.logical} frames, contact frame ${at} held ${max} ms`);
    }
    checks.push({ id: 'attack', status: why.length ? 'flag' : 'pass', detail: why.length ? why.join('; ') : ok.join('; ') });
  }
  // solid fill (effects)
  if (!effect) checks.push({ id: 'fill', status: 'skip', detail: `${kind ?? 'asset'}: not an effect` });
  else {
    const all = input.states.flatMap(s => s.frames), q = fillQA(all, dir);
    const solid = q.interior.filter((v, i) => v > th.fillInterior && q.brightest[i] > th.fillBright).length;
    const mean = (a: number[]) => Math.round((a.reduce((x, y) => x + y, 0) / (a.length || 1)) * 100) / 100;
    const detail = `interior ${mean(q.interior)} (max ${Math.max(...q.interior)}), brightest ${mean(q.brightest)} (max ${Math.max(...q.brightest)}); ${solid}/${all.length} solid frames`;
    checks.push({ id: 'fill', status: solid > all.length * th.fillFrames ? 'flag' : 'pass', detail: solid > all.length * th.fillFrames ? `solid blobs: ${detail} — break the shape up (particles, gaps, a darker body under a small hot core)` : detail });
  }
  return checks;
}

/**
 * Onion-skin strip: each frame over faded copies of the two before it (the previous at 35 %, the one before at 15 %,
 * in the outline-free silhouette tint `ghost`), so spacing and arcs read on one sheet.
 */
export function onionSkin(frames: Grid[], ghost = '#7fa7d9'): Grid {
  if (!frames.length) return new Grid(1, 1);
  const w = frames[0].w, h = frames[0].h, out = new Grid(frames.length * (w + 1) - 1, h);
  const [gr, gg, gb] = [1, 3, 5].map(i => parseInt(ghost.slice(i, i + 2), 16));
  frames.forEach((f, i) => {
    const ox = i * (w + 1);
    for (const [k, a] of [[2, 0.15], [1, 0.35]] as [number, number][]) {
      const p = frames[(i - k + frames.length) % frames.length];
      if (frames.length <= k) continue;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (p.alpha(x, y) !== 255) continue;
        const j = (y * out.w + ox + x) * 4, o = out.d[j + 3] / 255, na = a + o * (1 - a);
        out.d[j] = Math.round((gr * a + out.d[j] * o * (1 - a)) / na); out.d[j + 1] = Math.round((gg * a + out.d[j + 1] * o * (1 - a)) / na);
        out.d[j + 2] = Math.round((gb * a + out.d[j + 2] * o * (1 - a)) / na); out.d[j + 3] = Math.round(na * 255);
      }
    }
    out.over(f, ox, 0);
  });
  return out;
}
