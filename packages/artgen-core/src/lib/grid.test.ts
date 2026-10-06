import { describe, expect, test } from 'vitest';
import { Grid } from './grid.ts';
import { decodePNG, encodePNG } from './png.ts';
import { rng } from './rng.ts';
import { drawText, textWidth } from './font.ts';

describe('Grid', () => {
  test('set/get, alpha blend over opaque keeps alpha, transparent stays null', () => {
    const g = new Grid(3, 1);
    g.set(0, 0, '#FF0000');
    expect(g.get(0, 0)).toBe('#ff0000');
    g.set(0, 0, 'rgba(0,0,0,0.5)');
    expect(g.alpha(0, 0)).toBe(255);
    expect(g.get(0, 0)).toBe('#7f0000'); // alpha 0.5 → 128/255
    g.set(1, 0, 'rgba(0,0,0,0.35)');
    expect(g.alpha(1, 0)).toBe(89);
    expect(g.get(2, 0)).toBeNull();
    g.set(-1, 0, '#ffffff'); g.set(1.7, 0, null);
    expect(g.get(1, 0)).toBe('#000000');
  });

  test('crop, pad, trim, bounds, flip, scale', () => {
    const g = new Grid(4, 3);
    g.set(1, 1, '#112233'); g.set(2, 1, '#445566');
    expect(g.bounds()).toEqual({ x: 1, y: 1, w: 2, h: 1 });
    const t = g.trim();
    expect([t.w, t.h, t.get(0, 0), t.get(1, 0)]).toEqual([2, 1, '#112233', '#445566']);
    const p = t.pad(1);
    expect([p.w, p.h, p.get(1, 1)]).toEqual([4, 3, '#112233']);
    expect(g.flip('x').get(2, 1)).toBe('#112233');
    expect(g.flip('y').get(1, 1)).toBe('#112233');
    const s = t.scale(3);
    expect([s.w, s.h, s.get(2, 2), s.get(3, 0)]).toEqual([6, 3, '#112233', '#445566']);
    expect(g.crop(-1, 0, 2, 2).get(2, 1)).toBeNull();
  });

  test('hash is stable and content-sensitive', () => {
    const a = new Grid(8, 8), b = new Grid(8, 8);
    expect(a.hash()).toBe(b.hash());
    expect(a.hash()).not.toBe(new Grid(4, 16).hash());
    b.set(3, 3, '#010101');
    expect(a.hash()).not.toBe(b.hash());
    expect(a.diffCount(b)).toBe(1);
    expect(a.hash()).toMatch(/^[0-9a-f]{14}$/);
  });

  test('toIndexed lists distinct colours with alpha', () => {
    const g = new Grid(3, 1);
    g.set(0, 0, '#ff0000'); g.set(1, 0, 'rgba(0,0,0,0.35)'); g.set(2, 0, '#ff0000');
    const ix = g.toIndexed();
    expect(ix.palette).toEqual(['#ff0000', '#000000']);
    expect(ix.alphas).toEqual([255, 89]);
    expect([...ix.index]).toEqual([1, 2, 1]);
  });

  test('over composites partial alpha; stamp/blit copy', () => {
    const bg = new Grid(1, 1).fill(0, 0, 1, 1, '#ffffff'), sh = new Grid(1, 1);
    sh.set(0, 0, 'rgba(0,0,0,0.5)');
    bg.over(sh);
    expect(bg.get(0, 0)).toBe('#7f7f7f');
    const t = new Grid(1, 1).blit(sh);
    expect(t.alpha(0, 0)).toBe(128);
  });
});

describe('PNG codec', () => {
  test('round-trips RGBA including partial alpha', () => {
    const g = new Grid(17, 5), r = rng(7);
    for (let i = 0; i < 40; i++) g.set(Math.floor(r() * 17), Math.floor(r() * 5), `rgba(${Math.floor(r() * 255)},${Math.floor(r() * 255)},9,${(r() * 0.9 + 0.1).toFixed(2)})`);
    const back = decodePNG(encodePNG(g));
    expect([back.w, back.h]).toEqual([17, 5]);
    expect(back.diffCount(g)).toBe(0);
  });

  test('encoding is deterministic', () => {
    const g = new Grid(4, 4).fill(1, 1, 2, 2, '#336699');
    expect(encodePNG(g)).toEqual(encodePNG(g.clone()));
  });

  test('rejects non-PNG input', () => {
    expect(() => decodePNG(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow('not a PNG');
  });
});

describe('rng + font', () => {
  test('mulberry32 is seeded and reproducible', () => {
    const a = rng(42), b = rng(42), c = rng(43);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(c()).not.toBe(xs[0]);
    expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  });

  test('pixel font draws known glyphs at scale', () => {
    const g = new Grid(textWidth('I1', 2), 10);
    drawText(g, 0, 0, 'i1', '#ffffff', 2);
    expect(g.w).toBe(14);
    expect(g.get(0, 0)).toBe('#ffffff'); // I top bar
    expect(g.get(0, 2)).toBeNull();
    expect(g.get(2, 2)).toBe('#ffffff'); // I stem
  });
});
