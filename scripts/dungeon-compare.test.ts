import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { decodePNG, encodePNG, Grid } from 'artgen-core';

const script = join(import.meta.dirname, 'dungeon-compare.mjs');
const dirs: string[] = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

/** A 60×50 sheet of `rock` with white boxes [x, y, w, h] on it, written as a PNG in a scratch folder. */
function sheet(name: string, boxes: number[][], rock = '#202020'): string {
  const dir = dirs[0] ?? (dirs.push(mkdtempSync(join(tmpdir(), 'dungeon-compare-'))), dirs[0]);
  const g = new Grid(60, 50);
  for (let y = 0; y < 50; y++) for (let x = 0; x < 60; x++) g.set(x, y, rock);
  for (const [bx, by, bw, bh] of boxes) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) g.set(x, y, '#ffffff');
  const file = join(dir, name);
  writeFileSync(file, encodePNG(g));
  return file;
}
const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const json = (...args: string[]) => JSON.parse(execFileSync(process.execPath, [script, ...args, '--json'], { encoding: 'utf8' }));

describe('dungeon-compare', () => {
  it('scores identical floors as 1', () => {
    const a = sheet('a.png', [[10, 10, 20, 15]]);
    const r = json('--source', a, '--mine', a, '--close', '0');
    expect(r.iou).toBe(1);
    expect(r.missing).toBe(0);
    expect(r.extra).toBe(0);
  });

  it('lines the render up with --origin before it compares', () => {
    const ref = sheet('ref.png', [[13, 14, 20, 15]]);
    const mine = sheet('mine.png', [[10, 10, 20, 15]]); // the same box, drawn from a sheet corner 3 and 4 px off
    expect(json('--source', ref, '--mine', mine, '--close', '0').iou).toBeLessThan(0.5);
    expect(json('--source', ref, '--mine', mine, '--origin', '3,4', '--close', '0').iou).toBe(1);
  });

  it('counts floor missing from the render and floor the render has extra', () => {
    const ref = sheet('ref.png', [[10, 10, 20, 10], [10, 30, 10, 10]]);
    const mine = sheet('mine.png', [[10, 10, 20, 10], [40, 30, 10, 10]]);
    const r = json('--source', ref, '--mine', mine, '--close', '0');
    expect(r.missing).toBe(100);
    expect(r.extra).toBe(100);
    expect(r.shared).toBe(200);
    expect(r.iou).toBeCloseTo(200 / 400, 5);
  });

  it('reads a coloured rock through one channel', () => {
    const blue = '#3a9cf0'; // lum 140 is under the default 170 floor, and so is white's red channel only through --floor
    const a = sheet('a.png', [[10, 10, 20, 15]], blue);
    expect(json('--source', a, '--mine', a, '--channel', 'r', '--floor', '120', '--close', '0').shared).toBe(300);
  });

  it('ignores a --margin of the reference', () => {
    const ref = sheet('ref.png', [[10, 10, 20, 15], [0, 0, 60, 2]]); // a white strip along the top edge
    const mine = sheet('mine.png', [[10, 10, 20, 15]]);
    expect(json('--source', ref, '--mine', mine, '--close', '0').missing).toBe(120);
    expect(json('--source', ref, '--mine', mine, '--close', '0', '--margin', '3').missing).toBe(0);
  });

  it('closes grid lines in the floor before it compares', () => {
    const dir = dirs[0] ?? (dirs.push(mkdtempSync(join(tmpdir(), 'dungeon-compare-'))), dirs[0]);
    const g = new Grid(60, 50);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 60; x++) g.set(x, y, '#202020');
    for (let y = 10; y < 25; y++) for (let x = 10; x < 30; x++) g.set(x, y, x === 20 ? '#808080' : '#ffffff'); // a grid line
    const gridded = join(dir, 'gridded.png');
    writeFileSync(gridded, encodePNG(g));
    const plain = sheet('plain.png', [[10, 10, 20, 15]]);
    const open = json('--source', gridded, '--mine', plain, '--close', '0').iou;
    const closed = json('--source', gridded, '--mine', plain, '--close', '2').iou;
    expect(open).toBeCloseTo(0.95, 5); // the line's 15 pixels count as missing floor
    expect(closed).toBeGreaterThan(0.99); // closing fills it; the two pixels on the box's edge stay open
    expect(closed).toBeGreaterThan(open);
  });

  it('writes the reference, the aligned render and the diff side by side', () => {
    const a = sheet('a.png', [[10, 10, 20, 15]]);
    const out = join(dirs[0], 'panel.png');
    expect(run('--source', a, '--mine', a, '--out', out).status).toBe(0);
    const panel = decodePNG(new Uint8Array(readFileSync(out)));
    expect(panel.w).toBe(60 * 3 + 20);
    expect(panel.h).toBe(50);
  });

  it('exits 1 under --min-iou, and 2 for bad arguments', () => {
    const ref = sheet('ref.png', [[10, 10, 20, 15]]);
    const mine = sheet('mine.png', [[40, 30, 10, 10]]);
    expect(run('--source', ref, '--mine', mine, '--min-iou', '0.9').status).toBe(1);
    expect(run('--source', ref, '--mine', ref, '--min-iou', '0.9').status).toBe(0);
    expect(run('--mine', ref).status).toBe(2);
    expect(run('--source', ref, '--mine', ref, '--channel', 'x').status).toBe(2);
    expect(run('--source', ref, '--mine', ref, '--origin', 'a,b').status).toBe(2);
  });
});
