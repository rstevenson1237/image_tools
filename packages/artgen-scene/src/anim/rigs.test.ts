// R6b: the shared body rigs: bone names and lengths, the facing's projection, gaits that plant the feet, the standard anchors.
import { describe, expect, test } from 'vitest';
import { BODY_PLAN, bodyRig, facingYaw, PROPORTIONS, RIG_PLANS, type RigPlan } from './rigs.ts';

const BONES: Record<RigPlan, string[]> = {
  biped: ['hip', 'spine', 'neck', 'head', 'armL_up', 'armL_lo', 'armR_up', 'armR_lo', 'legL_up', 'legL_lo', 'legR_up', 'legR_lo'],
  quadruped: ['spine', 'neck', 'head', 'tail', 'legFL_up', 'legFL_lo', 'legFR_up', 'legFR_lo', 'legBL_up', 'legBL_lo', 'legBR_up', 'legBR_lo'],
  flyer: ['body', 'head', 'wingL', 'wingL_tip', 'wingR', 'wingR_tip', 'tail'],
  serpent: Array.from({ length: 8 }, (_, i) => `seg${i}`),
  turret: ['hull', 'turret', 'barrel'],
};
const FACINGS = ['s', 'se', 'e', 'ne', 'n', 'sw', 'w', 'nw'], STATES = ['idle', 'walk', 'attack', 'hurt', 'hover'];
const opts = (facing: string, o: object = {}) => ({ size: [32, 32] as [number, number], facing, ...o });

describe('plans and proportions', () => {
  test('body names map to plans, every plan has the documented bones and a proportion set', () => {
    expect(BODY_PLAN).toMatchObject({ humanoid: 'biped', quadruped: 'quadruped', large: 'quadruped', serpent: 'serpent', flyer: 'flyer' });
    expect(Object.keys(PROPORTIONS).sort()).toEqual([...RIG_PLANS, 'large'].sort());
    for (const p of RIG_PLANS) expect(Object.keys(bodyRig(p, opts('s')).lengths).sort(), p).toEqual([...BONES[p]].sort());
    expect(bodyRig('large', opts('s', { size: [64, 64] }))).toMatchObject({ plan: 'quadruped', set: 'large' });
    expect(bodyRig('large', opts('s', { height: 28 })).lengths.neck).toBeGreaterThan(bodyRig('quadruped', opts('s', { height: 28 })).lengths.neck);
  });

  test('the 16-way facing names round to the eight', () => {
    expect([facingYaw('s'), facingYaw('e'), facingYaw('w'), facingYaw('n'), facingYaw('nw')]).toEqual([0, 90, -90, 180, -135]);
    expect([facingYaw('sse'), facingYaw('ese'), facingYaw('ssw'), facingYaw('nne'), facingYaw('x')]).toEqual([45, 90, -45, 180, 0]);
  });

  test('a bigger head takes the length from the torso: the biped stays as tall as asked', () => {
    const a = bodyRig('biped', opts('s', { height: 28 })), b = bodyRig('biped', opts('s', { height: 28, proportions: { head: 0.5 } }));
    expect(b.lengths.head).toBeGreaterThan(a.lengths.head);
    expect(b.lengths.spine).toBeLessThan(a.lengths.spine);
    const sum = (r: typeof a) => r.lengths.hip + r.lengths.spine + r.lengths.neck + r.lengths.head + r.lengths.legL_up + r.lengths.legL_lo;
    expect(sum(b)).toBeCloseTo(28, 6);
    expect(sum(a)).toBeCloseTo(28, 6);
  });
});

describe('lengths are rig-space: the same for every facing, state and frame', () => {
  test.each(RIG_PLANS)('%s', plan => {
    const ref = bodyRig(plan, opts('s')).lengths;
    for (const f of FACINGS) {
      const r = bodyRig(plan, opts(f));
      expect(r.lengths).toEqual(ref);
      for (const st of STATES) for (const t of [0, 0.25, 0.5, 0.75]) {
        const p = r.pose(st, t);
        expect(Object.keys(p.bones).sort(), `${plan} ${f} ${st}`).toEqual([...BONES[plan]].sort());
        for (const b of Object.values(p.bones)) expect(Number.isFinite(b.a[0] + b.a[1] + b.b[0] + b.b[1])).toBe(true);
      }
    }
  });
});

describe('projection', () => {
  test('facing the viewer the right limbs are on the viewer\'s left; in profile the stride is a swing along x', () => {
    const f = bodyRig('biped', opts('s', { height: 28 })).pose('idle', 0);
    expect(f.end('armR_lo')[0]).toBeLessThan(f.end('armL_lo')[0]);
    expect(f.end('legR_lo')[0]).toBeLessThan(f.end('legL_lo')[0]);
    const xs = [0, 0.25, 0.5, 0.75].map(t => bodyRig('biped', opts('e', { height: 28 })).pose('walk', t).end('legL_lo')[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(3);
    const front = [0, 0.25, 0.5, 0.75].map(t => bodyRig('biped', opts('s', { height: 28 })).pose('walk', t).end('legL_lo')[0]);
    expect(Math.max(...front) - Math.min(...front)).toBeLessThan(0.01);
  });

  test('forward points to the facing side; the head leads a quadruped in profile and the tail trails it', () => {
    for (const [f, sign] of [['e', 1], ['w', -1]] as const) {
      const p = bodyRig('quadruped', opts(f, { height: 12 })).pose('idle', 0);
      expect(Math.sign(p.end('head')[0] - p.start('spine')[0])).toBe(sign);
      expect(Math.sign(p.end('tail')[0] - p.start('spine')[0])).toBe(-sign);
    }
  });

  test('depth: facing the viewer the head end is nearest; far limbs sort first in profile', () => {
    const q = bodyRig('quadruped', opts('s', { height: 12 })).pose('idle', 0);
    expect(q.depth('head')).toBeGreaterThan(q.depth('tail'));
    const b = bodyRig('biped', opts('e', { height: 28 })).pose('idle', 0);
    expect(b.far(['legL_up', 'legR_up'])).toEqual(['legL_up', 'legR_up']);
    expect(bodyRig('biped', opts('w', { height: 28 })).pose('idle', 0).far(['legL_up', 'legR_up'])).toEqual(['legR_up', 'legL_up']);
  });

  test('`at` moves a point forward and to the right of a bone in the body\'s frame', () => {
    const p = bodyRig('biped', opts('e', { height: 28 })).pose('idle', 0), c = p.at('head', 0.5), f = p.at('head', 0.5, 2);
    expect(f[0] - c[0]).toBeCloseTo(2, 6);
    expect(bodyRig('biped', opts('w', { height: 28 })).pose('idle', 0).at('head', 0.5, 2)[0] - c[0]).toBeCloseTo(-2, 6);
    expect(bodyRig('biped', opts('s', { height: 28 })).pose('idle', 0).at('head', 0.5, 0, 2)[0] - c[0]).toBeCloseTo(-2, 6);
  });
});

describe('clips', () => {
  test('walk plants the feet: no foot below the ground line, the stance foot on it', () => {
    for (const [plan, H, legs] of [['biped', 28, ['legL_lo', 'legR_lo']], ['quadruped', 12, ['legFL_lo', 'legBR_lo']]] as const) {
      const r = bodyRig(plan, opts('e', { height: H, tilt: 0 }));
      const lows = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map(t => { const p = r.pose('walk', t); return Math.max(...legs.map(l => p.end(l)[1])); });
      for (const y of lows) expect(y).toBeLessThanOrEqual(r.ground + 0.01);
      expect(Math.max(...lows)).toBeGreaterThan(r.ground - 0.6);
      const lift = [0, 0.25].map(t => r.pose('walk', t).end(legs[0])[1]);
      expect(Math.abs(lift[0] - lift[1])).toBeGreaterThan(0.5);
    }
  });

  test('loops over t; unknown states use idle; frame 0 of idle is the rest pose; overrides win', () => {
    for (const plan of RIG_PLANS) {
      const r = bodyRig(plan, opts('se', { height: 20 }));
      for (const st of STATES) { const last = BONES[plan][BONES[plan].length - 1], a = r.pose(st, 0).end(last), b = r.pose(st, 1).end(last); expect(a[0]).toBeCloseTo(b[0], 6); expect(a[1]).toBeCloseTo(b[1], 6); }
      expect(r.pose('dance', 0.3).end(BONES[plan][1])).toEqual(r.pose('idle', 0.3).end(BONES[plan][1]));
    }
    const r = bodyRig('biped', opts('e', { height: 28 })), rest = r.pose('idle', 0), over = r.pose('idle', 0, { angles: { armR_up: -90 } });
    expect(over.end('armR_lo')[0]).toBeGreaterThan(rest.end('armR_lo')[0] + 3);
  });

  test('the flyer beats its wings in every state; the serpent\'s wave travels when it moves', () => {
    const f = bodyRig('flyer', opts('s', { height: 8 }));
    for (const st of ['idle', 'walk', 'attack']) expect(f.pose(st, 0).end('wingL_tip')[1]).not.toBeCloseTo(f.pose(st, 0.25).end('wingL_tip')[1], 1);
    const s = bodyRig('serpent', opts('e', { height: 7 }));
    expect(s.pose('walk', 0).end('seg7')[1]).not.toBeCloseTo(s.pose('walk', 0.5).end('seg7')[1], 1);
  });
});

describe('anchors', () => {
  test('whole pixels, by plan', () => {
    const a = (plan: RigPlan, h: number) => { const r = bodyRig(plan, opts('e', { height: h })); return r.anchors(r.pose('idle', 0)); };
    expect(Object.keys(a('biped', 28)).sort()).toEqual(['ground', 'hand', 'head']);
    expect(Object.keys(a('quadruped', 12)).sort()).toEqual(['ground', 'head', 'tail']);
    expect(Object.keys(a('serpent', 7)).sort()).toEqual(['ground', 'head', 'tail']);
    expect(Object.keys(a('turret', 12)).sort()).toEqual(['ground', 'muzzle']);
    expect(Object.keys(a('flyer', 8)).sort()).toEqual(['ground', 'head']);
    for (const p of Object.values(a('biped', 28))) expect(p.every(Number.isInteger)).toBe(true);
    expect(a('biped', 28).ground).toEqual([16, 30]);
  });

  test('the turret aims forward and a shot kicks the barrel', () => {
    const r = bodyRig('turret', opts('e', { height: 12 })), rest = r.pose('idle', 0), shot = r.pose('attack', 0.15);
    expect(rest.end('barrel')[0]).toBeGreaterThan(rest.start('barrel')[0] + 5);
    expect(shot.end('barrel')[1]).toBeLessThan(rest.end('barrel')[1]);
  });
});
