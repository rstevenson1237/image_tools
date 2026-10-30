// RotSprite on the command line (docs/STAGES.md §8): `artgen rotate`, `brief add --rotate`, and a rotated asset rendered, staged and exported end to end.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { decodePNG, encodePNG, FACINGS, Grid, rotsprite } from 'artgen-core';
import { main } from './cli.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
afterEach(() => vi.restoreAllMocks());
const read = (file: string): Grid => decodePNG(new Uint8Array(readFileSync(file)));

describe('artgen rotate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'artgen-rotate-')), file = join(dir, 'arrow.png');
  beforeAll(() => {
    const g = new Grid(16, 16);
    for (let x = 3; x <= 12; x++) g.set(x, 8, '#d03030');       // a shaft pointing east
    g.set(11, 7, '#ffffff'); g.set(11, 9, '#ffffff'); g.set(12, 7, '#ffffff'); g.set(12, 9, '#ffffff');
    writeFileSync(file, encodePNG(g));
  });

  test('one rotation: --deg 90 is the exact quarter turn, written beside the picture', async () => {
    const r = await json('rotate', file, '--deg', '90');
    expect(r.out).toBe(join(dir, 'arrow.rotated.png'));
    expect(r).toMatchObject({ frames: 1, width: 16, height: 16, degrees: [90] });
    expect(read(r.out).d).toEqual(rotsprite(read(file), 90).d);
    expect(read(r.out).get(7, 12)).not.toBeNull();
  });

  test('--steps writes a strip of evenly spaced rotations; --pivot and --out are honoured', async () => {
    const out = join(dir, 'strip.png');
    const r = await json('rotate', file, '--steps', '4', '--out', out);
    expect(r).toMatchObject({ frames: 4, width: 64, height: 16, degrees: [0, 90, 180, 270] });
    const strip = read(out), src = read(file);
    for (let k = 0; k < 4; k++) { const f = new Grid(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = strip.get(k * 16 + x, y); if (c) f.set(x, y, c); } expect(f.d).toEqual(rotsprite(src, k * 90).d); }
    const p = await json('rotate', file, '--deg', '45', '--pivot', '3,8', '--out', join(dir, 'p.png'));
    expect(read(p.out).d).toEqual(rotsprite(src, 45, { pivot: [3, 8] }).d);
    const t = await run('rotate', file, '--deg', '30');
    expect(t.out).toMatch(/arrow\.rotated\.png: rotated 30°/);
  });

  test('asks for what it needs', async () => {
    await expect(run('rotate', file)).rejects.toThrow(/--deg .* or --steps/);
    await expect(run('rotate', file, '--deg', '10', '--pivot', '3')).rejects.toThrow(/--pivot is x,y/);
    await expect(run('rotate', file, '--steps', '0')).rejects.toThrow(/--steps/);
    await expect(run('rotate', join(dir, 'missing.png'), '--deg', '10')).rejects.toThrow(/not found/);
  });
});

describe('a rotated asset in a scratch game repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-rotated-')), R = ['--root', root];
  beforeAll(async () => {
    await run('init', ...R);
    await run('direction', 'candidates', '--pitch', 'Grim swamp roguelike: bog goblins and leeches in the fog.', '--view', 'topdown', ...R);
    await run('direction', 'lock', 'a', ...R);
  }, 60_000);

  test('brief add --rotate rotsprite --rotate-from: validated', async () => {
    await expect(run('brief', 'add', 'bad', '--kind', 'prop', '--rotate', 'rotsprite', ...R)).rejects.toThrow(/rotate needs directions/);
    await expect(run('brief', 'add', 'bad', '--kind', 'prop', '--directions', '4', '--rotate', 'rotsprite', '--rotate-from', 'ne', ...R)).rejects.toThrow(/rotateFrom/);
    await expect(run('brief', 'add', 'bad', '--kind', 'prop', '--directions', '4', '--rotate', 'spin', ...R)).rejects.toThrow();
    const r = await json('brief', 'add', 'cart', '--kind', 'prop', '--directions', '8', '--rotate', 'rotsprite', '--rotate-from', 'e', ...R);
    expect(r.brief).toMatchObject({ id: 'cart', directions: 8, rotate: 'rotsprite', rotateFrom: 'e' });
  });

  test('make, render, stages and export: every facing is present, rotated and not mirrored', async () => {
    const m = await json('make', 'cart', ...R), dir = join(root, m.next.path);
    expect(existsSync(join(dir, 'base.v1.js'))).toBe(true);
    await run('render', 'cart', ...R);
    // the render strip holds the 8 facings side by side, in FACINGS order: each is the drawn east one turned, none a mirror
    const strip = read(join(dir, 'out', 'base.v1.png')), n = strip.h, cell = (k: number) => { const g = new Grid(n, n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = strip.get(k * n + x, y); if (c) g.set(x, y, c); } return g; };
    expect(strip.w).toBe(8 * n);
    const east = cell(FACINGS[8].indexOf('e'));
    for (const [f, deg] of [['s', 90], ['w', 180], ['n', 270], ['se', 45], ['sw', 135]] as const) expect(cell(FACINGS[8].indexOf(f)).d).toEqual(rotsprite(east, deg).d);
    expect(cell(FACINGS[8].indexOf('w')).d).not.toEqual(east.flip('x').d);
    const st = await json('stages', 'cart', ...R);
    expect(st.keys.rotation).toMatch(/^[0-9a-f]{8}$/);
    expect(st.checks.filter((c: { stage: string }) => c.stage === 'rotation').map((c: { id: string }) => c.id)).toEqual(['rotation-clip', 'rotation-area', 'rotation-pieces']);
    expect(st.states.rotation).toBeDefined();
  });

  test('an asset without rotate has no rotation stage', async () => {
    await run('brief', 'add', 'crate', '--kind', 'prop', '--directions', '4', ...R);
    await run('make', 'crate', ...R);
    const st = await json('stages', 'crate', ...R);
    expect(st.keys.rotation).toBeUndefined();
    expect(st.checks.some((c: { stage: string }) => c.stage === 'rotation')).toBe(false);
  });
});

