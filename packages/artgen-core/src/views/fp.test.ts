// P6d: the raycaster corridor preview, sky panoramas, first-person roles and shots, the brick recipe, view-model edges.
import { describe, expect, test } from 'vitest';
import { dirContext, kindPalette, parseDirection, type Direction } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { conformance } from '../qa/conformance.ts';
import { seamMetric } from '../qa/tiles.ts';
import { material } from '../tex/materials.ts';
import { fpRole, fpShots, raycast, sky } from './fp.ts';

const RAMPS = { stone: ['#c8ccd0', '#8e959c', '#5a6068', '#30343a'], dirt: ['#a08060', '#6e5440', '#40302a'], cloth: ['#80a0d0', '#4060a0', '#203060'], metal: ['#e0e4e8', '#a0a8b0', '#606870'], accent: ['#ffc060', '#e07020', '#802010'] };
const dir: Direction = parseDirection({ id: 'fp', version: 1, status: 'locked', camera: { view: 'fp' }, scale: { tile: 32, large: [48, 48] }, palette: { ramps: RAMPS, outline: '#101014' }, background: '#101014' });
const dc = dirContext(dir);
const red = (c: string | null) => !!c && parseInt(c.slice(1, 3), 16) > 100 && c.slice(3) === '0000'; // walls facing along y are dimmed
const flat = (w: number, h: number, c: string) => { const g = new Grid(w, h); g.fill(0, 0, w, h, c); return g; };

describe('raycaster', () => {
  const scene = { wall: flat(8, 8, '#ff0000'), floor: flat(8, 8, '#00ff00'), ceiling: flat(8, 8, '#0000ff') };
  test('walls in the middle band, floor below, ceiling above; deterministic', () => {
    const g = raycast(scene, { w: 64, h: 40, fogDist: 1e9 });
    expect(red(g.get(32, 20))).toBe(true);
    expect(g.get(32, 39)).toBe('#00ff00');
    expect(g.get(32, 0)).toBe('#0000ff');
    expect(g.hash()).toBe(raycast(scene, { w: 64, h: 40, fogDist: 1e9 }).hash());
  });
  test('billboards stand on the floor in front of the far wall and are hidden behind nearer walls', () => {
    const sprite = flat(8, 16, '#ffffff'), g = raycast({ ...scene, sprites: [{ grid: sprite, x: 4.5, y: 3.5, height: 0.8 }] }, { w: 64, h: 40, fogDist: 1e9 });
    expect(g.get(32, 21)).toBe('#ffffff');
    const hidden = raycast({ ...scene, sprites: [{ grid: sprite, x: 0.5, y: 0.5 }] }, { w: 64, h: 40, fogDist: 1e9 });
    expect(hidden.hash()).toBe(raycast(scene, { w: 64, h: 40, fogDist: 1e9 }).hash());
  });
  test('the view-model sits on the bottom edge, centred', () => {
    const g = raycast({ ...scene, viewmodel: flat(16, 8, '#ffff00') }, { w: 64, h: 40, fogDist: 1e9 });
    expect(g.get(32, 39)).toBe('#ffff00');
    expect(red(g.get(32, 20))).toBe(true);
  });
});

describe('sky', () => {
  test('palette-exact, seamless across x, lighter toward the horizon', () => {
    const s = sky(dc, { w: 64, h: 32, clouds: 0, stars: 0.02, ridge: 'stone' }), pal = new Set(kindPalette(dir));
    for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) expect(pal.has(s.get(x, y)!)).toBe(true);
    let step = 0, inner = 0;
    for (let y = 0; y < 32; y++) { step += s.get(63, y) !== s.get(0, y) ? 1 : 0; inner += s.get(31, y) !== s.get(32, y) ? 1 : 0; }
    expect(step).toBeLessThanOrEqual(inner + 3);
    expect(RAMPS.cloth.indexOf(s.get(10, 2)!)).toBeGreaterThan(RAMPS.cloth.indexOf(s.get(10, 20)!));
  });
});

describe('first-person roles and shots', () => {
  test('roles: textures by surface, layers are skies, view-models, the rest billboards', () => {
    expect(fpRole('texture')).toBe('wall');
    expect(fpRole('texture', 'floor')).toBe('floor');
    expect(fpRole('layer')).toBe('sky');
    expect(fpRole('viewmodel')).toBe('viewmodel');
    expect(fpRole('creature')).toBe('billboard');
  });
  test('a wall texture shows up in its corridor shot', () => {
    const wall = flat(32, 32, '#ff00ff'), [shot] = fpShots(dir, 'texture', [wall], { w: 64, h: 40 });
    let n = 0;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 64; x++) if (shot.get(x, y) !== null && shot.d[(y * 64 + x) * 4] > 100 && shot.d[(y * 64 + x) * 4 + 1] < 60) n++;
    expect(n).toBeGreaterThan(200);
  });
});

describe('brick and view-model edges', () => {
  test('brick: running bond, seamless, on the direction ramps, with a normal map', () => {
    const t = material('brick', dc, { w: 64, h: 64 });
    expect(seamMetric(t.grid).ratio).toBeLessThan(2.6);
    expect(t.ramps.base).toBe('accent');
    expect(t.normal.w).toBe(64);
  });
  test('view-models continue below the frame: the bottom border is not a silhouette edge', () => {
    const g = new Grid(16, 16);
    g.fill(4, 4, 8, 12, '#101014'); g.fill(5, 5, 6, 11, RAMPS.metal[1]);
    expect(conformance({ frames: [g], dir, kind: 'viewmodel' }).checks.find(c => c.id === 'line')!.status).toBe('pass');
    expect(conformance({ frames: [g], dir, kind: 'prop' }).checks.find(c => c.id === 'line')!.status).toBe('fail');
  });
});
