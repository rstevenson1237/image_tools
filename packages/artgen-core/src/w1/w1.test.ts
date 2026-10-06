// W1 art direction (PLAN P2): candidate generation, mixing, locking, style tile and style sheet.
import { describe, expect, test } from 'vitest';
import { kindPalette, validateDirection, type Direction } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { conformance } from '../qa/conformance.ts';
import { generateCandidates, lockDirection, mixDirections, moodProfile, PER_KIND, ROLES, slug, type Interview } from './candidates.ts';
import { paletteLuma, styleSheet, styleTile, wrap } from './sheets.ts';

const IV: Interview = { pitch: 'A grim swamp roguelike: a lantern-bearer wades through rot and fog.', mood: ['damp', 'eerie'], view: 'topdown' };

describe('candidates', () => {
  const [a, b, c] = generateCandidates(IV);

  test('three valid drafts with every role ramp and per-kind limits that fit their ramps', () => {
    for (const d of [a, b, c]) {
      expect(validateDirection(d).ok).toBe(true);
      expect(d.status).toBe('candidate');
      expect(Object.keys(d.palette.ramps).sort()).toEqual([...ROLES].sort());
      for (const kind of Object.keys(PER_KIND)) expect(kindPalette(d, kind).length).toBeLessThanOrEqual(d.palette.perKindMax[kind]);
    }
    expect([a.id, b.id, c.id]).toEqual(['grim-swamp-roguelike-a', 'grim-swamp-roguelike-b', 'grim-swamp-roguelike-c']);
  });

  test('they differ in palette family, outline style, shading and proportions (§4.2)', () => {
    expect(new Set([a, b, c].map(d => d.line.outer + d.line.inner)).size).toBe(3);
    expect(new Set([a, b, c].map(d => `${d.shading.bands}/${d.shading.dither}`)).size).toBe(3);
    expect(new Set([a, b, c].map(d => (d.scale.proportions as Record<string, number>).headRatio)).size).toBe(3);
    const l = [a, b, c].map(paletteLuma);
    expect(Math.min(Math.abs(l[0] - l[1]), Math.abs(l[0] - l[2]), Math.abs(l[1] - l[2]))).toBeGreaterThan(8);
    expect(new Set([a, b, c].map(d => d.palette.ramps.cloth[1])).size).toBe(3);
  });

  test('deterministic, and supplied colours shape candidate A only', () => {
    expect(generateCandidates(IV)).toEqual(generateCandidates(IV));
    const [a2, b2] = generateCandidates({ ...IV, colors: ['#c03030', '#3050c0', '#30a040', '#e0c060', '#606060'] });
    expect(a2.palette.ramps).not.toEqual(a.palette.ramps);
    expect(a2.palette.source).toBe('imported');
    expect(b2.palette.ramps).toEqual(b.palette.ramps);
  });

  test('setting words pick ground and growth colours; scale presets follow the view', () => {
    const snow = moodProfile({ pitch: 'arctic survival in the snow' });
    expect(snow.ground!.l).toBeGreaterThan(0.7);
    const [iso] = generateCandidates({ pitch: 'iso dungeon crawler', view: 'iso', scale: 'small' });
    expect(iso.scale.tile).toEqual([32, 16]);
    expect(iso.camera.iso).toEqual({ tile: [32, 16] });
    expect(() => generateCandidates({ pitch: ' ' })).toThrow(/pitch/);
  });

  test('slug keeps the first three meaningful words', () => {
    expect(slug('The swamp of the lost: a game')).toBe('swamp-lost');
    expect(slug('!!!')).toBe('game');
  });

  test("mix takes named parts (A's palette, B's outlines) and stays valid", () => {
    const m = mixDirections(b, { palette: a, line: c });
    expect(m.palette).toEqual(a.palette);
    expect(m.line).toEqual(c.line);
    expect(m.shading.bands).toBe(3); // B's 4 bands clamped to A's 3-step ramps
    expect(m.id).toBe('grim-swamp-roguelike-mix');
    expect(m.theme.notes).toMatch(/palette from grim-swamp-roguelike-a, line from grim-swamp-roguelike-c/);
    expect(() => mixDirections(a, { nope: b } as never)).toThrow(/unknown part/);
  });

  test('lock: status locked, version 1, then previous + 1; id without the candidate suffix', () => {
    const v1 = lockDirection(a);
    expect(v1).toMatchObject({ id: 'grim-swamp-roguelike', version: 1, status: 'locked' });
    expect(lockDirection(b, v1)).toMatchObject({ id: 'grim-swamp-roguelike', version: 2, status: 'locked' });
  });
});

describe('sheets', () => {
  const dirs = generateCandidates(IV);
  const sprite = (d: Direction, w: number, h: number) => { const g = new Grid(w, h); g.fill(2, 2, w - 4, h - 4, d.palette.ramps.cloth[1]); return g; };
  const probes = (d: Direction) => ({ character: sprite(d, 24, 24), prop: sprite(d, 24, 24), tile: sprite(d, 16, 16), effect: [sprite(d, 24, 24), sprite(d, 24, 24)] });

  test('style tile: one column per candidate, ≤ 1568 px, deterministic', () => {
    const cols = dirs.map(d => ({ label: d.id, notes: ['x'], dir: d, probes: probes(d), gates: { character: true } }));
    const g = styleTile('t', cols);
    expect(Math.max(g.w, g.h)).toBeLessThanOrEqual(1568);
    expect(g.w).toBeGreaterThan(g.h * 0.8);
    expect(styleTile('t', cols).hash()).toBe(g.hash());
    expect(styleTile('t', cols.slice(0, 1)).w).toBeLessThan(g.w);
  });

  test('style sheet: fits, carries anchors, changes with the direction', () => {
    const d = lockDirection(dirs[0]), anchors = [{ label: 'character', grid: sprite(d, 24, 24) }];
    const g = styleSheet({ ...d, rules: { do: ['readable at 1x'], dont: ['pure white'] } }, anchors);
    expect(Math.max(g.w, g.h)).toBeLessThanOrEqual(1568);
    expect(styleSheet(d, []).h).toBeLessThan(g.h);
    expect(styleSheet(lockDirection(dirs[1]), anchors).hash()).not.toBe(styleSheet(d, anchors).hash());
  });

  test('wrap', () => {
    expect(wrap('one two three four', 9)).toEqual(['one two', 'three', 'four']);
  });
});

describe('conformance for W1 probes', () => {
  const [d] = generateCandidates(IV);
  test('tiles wrap: a full-bleed tile has no silhouette edge and no light check', () => {
    const g = new Grid(16, 16).fill(0, 0, 16, 16, d.palette.ramps.dirt[1]);
    const r = conformance({ frames: [g], dir: d, kind: 'tile', size: [16, 16] });
    expect(r.checks.find(c => c.id === 'line')!.status).toBe('skip');
    expect(r.checks.find(c => c.id === 'light')!.status).toBe('skip');
    // the same pixels as a prop have an unlined silhouette
    expect(conformance({ frames: [g], dir: d, kind: 'prop' }).checks.find(c => c.id === 'line')!.status).toBe('fail');
  });

  test('effects are emissive: no light-direction check', () => {
    const g = new Grid(8, 8).fill(1, 1, 6, 6, d.palette.ramps.glow[0]);
    expect(conformance({ frames: [g], dir: d, kind: 'effect' }).checks.find(c => c.id === 'light')).toMatchObject({ status: 'skip' });
  });
});
