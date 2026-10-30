import { describe, expect, it } from 'vitest';
import { Grid } from './grid.ts';
import { getNormal, putNormal } from './normals.ts';
import { rotateMask, rotateNormals, rotatePoint, rotsprite, scale2x } from './rotsprite.ts';

const RED = '#ff0000', BLUE = '#0000ff', GREEN = '#00ff00';
/** A grid from rows of characters: `.` transparent, r/b/g colours. */
const rows = (...r: string[]): Grid => {
  const g = new Grid(r[0].length, r.length), c: Record<string, string> = { r: RED, b: BLUE, g: GREEN };
  r.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g.set(x, y, c[ch]); }));
  return g;
};
const show = (g: Grid): string[] => Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => ({ '#ff0000': 'r', '#0000ff': 'b', '#00ff00': 'g' } as Record<string, string>)[g.get(x, y) ?? ''] ?? '.').join(''));
const opaque = (g: Grid) => { let n = 0; for (let i = 3; i < g.d.length; i += 4) if (g.d[i]) n++; return n; };
const colours = (g: Grid) => { const s = new Set<string>(); for (let i = 0; i < g.d.length; i += 4) s.add(g.d.slice(i, i + 4).join(',')); return s; };
const pieces = (g: Grid): number => {
  const seen = new Uint8Array(g.w * g.h); let n = 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (seen[y * g.w + x] || !g.alpha(x, y)) continue;
    n++; const st = [[x, y]]; seen[y * g.w + x] = 1;
    while (st.length) { const [cx, cy] = st.pop()!; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (g.inb(nx, ny) && g.alpha(nx, ny) && !seen[ny * g.w + nx]) { seen[ny * g.w + nx] = 1; st.push([nx, ny]); } } }
  }
  return n;
};

describe('scale2x (EPX)', () => {
  it('doubles a flat image and keeps single pixels as 2x2 blocks', () => {
    expect(show(scale2x(rows('r')))).toEqual(['rr', 'rr']);
    expect(show(scale2x(rows('rb')))).toEqual(['rrbb', 'rrbb']);
  });
  it('rounds the inside corner of an L: the three-neighbour rule', () => {
    // P=. at the corner of an r L-shape: A and C are r (equal), D and B are not -> output 1 takes r
    const out = show(scale2x(rows('r.', 'rr')));
    // pixel (1,0) is empty with A out-of-image (=P), C=(0,0)=r, B=P, D=(1,1)=r: C==A? A=P(empty) != r -> rule 1 no; D==C (r==r), D!=B, C!=A -> output 3 = C
    expect(out[0]).toBe('rr..');
    expect(out[1]).toBe('rrr.');
    expect(out[2]).toBe('rrrr');
    expect(out[3]).toBe('rrrr');
  });
  it('a diagonal of two pixels stays a diagonal and gains no colour', () => {
    const g = rows('r.', '.r'), o = scale2x(g);
    expect(o.w).toBe(4);
    expect([...colours(o)].filter(c => !colours(g).has(c))).toEqual([]);
  });
  it('compares alpha: a translucent pixel is not equal to an opaque one of the same colour', () => {
    // centre b, above and left r, right and below g: the top-left quarter takes r
    const g = rows('.r.', 'rbg', '.g.');
    expect(show(scale2x(g))[2][2]).toBe('r');
    g.d[(0 * 3 + 1) * 4 + 3] = 100; // the pixel above is now translucent red: no longer equal to the one on the left
    expect(show(scale2x(g))[2][2]).toBe('b');
  });
});

describe('rotsprite', () => {
  const sprite = rows('rr.....', 'rb.....', 'rg.gg..', '.......', '.......', '.......', '.......');
  it('0, 90, 180 and 270 degrees are exact grid rotations', () => {
    const rot90 = (g: Grid) => { const o = new Grid(g.w, g.h); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) o.d.set(g.d.subarray((y * g.w + x) * 4, (y * g.w + x) * 4 + 4), ((x) * g.w + (g.w - 1 - y)) * 4); return o; };
    let want = sprite;
    for (const deg of [0, 90, 180, 270]) {
      expect(rotsprite(sprite, deg).d).toEqual(want.d);
      want = rot90(want);
    }
    expect(rotsprite(sprite, 360).d).toEqual(sprite.d);
    expect(rotsprite(sprite, -90).d).toEqual(rotsprite(sprite, 270).d);
  });
  it('clockwise: an east-pointing bar turned 90 degrees points south', () => {
    const bar = new Grid(9, 9); for (let x = 4; x <= 8; x++) bar.set(x, 4, RED);
    const o = rotsprite(bar, 90);
    for (let y = 4; y <= 8; y++) expect(o.get(4, y)).toBe(RED);
    expect(opaque(o)).toBe(5);
  });
  it('only uses colours the input has, at any angle', () => {
    const g = rows('rrbb', 'rrbb', 'ggbb', 'gg..');
    for (const deg of [17, 45, 100, 222, 333]) {
      const have = colours(g);
      for (const c of colours(rotsprite(g, deg))) expect(have.has(c)).toBe(true);
    }
  });
  it('a one pixel diagonal line turned 45 degrees stays one piece', () => {
    const g = new Grid(15, 15); for (let i = 3; i < 12; i++) g.set(i, i, RED);
    expect(pieces(g)).toBe(1);
    for (const deg of [45, -45, 30, 135]) expect(pieces(rotsprite(g, deg))).toBe(1);
  });
  it('keeps the area of a solid shape within a few percent', () => {
    const g = new Grid(21, 21); for (let y = 5; y < 16; y++) for (let x = 5; x < 16; x++) g.set(x, y, BLUE);
    const a = opaque(g);
    for (const deg of [20, 45, 77]) expect(Math.abs(opaque(rotsprite(g, deg)) - a) / a).toBeLessThan(0.1);
  });
  it('rotates about the pivot: a pixel at the pivot stays, one beside it orbits', () => {
    const g = new Grid(9, 9); g.set(2, 2, RED); g.set(4, 2, BLUE);
    const o = rotsprite(g, 90, { pivot: [2, 2] });
    expect(o.get(2, 2)).toBe(RED);
    expect(o.get(2, 4)).toBe(BLUE);
    expect(o.get(4, 2)).toBeNull();
  });
  it('size makes a larger frame with the image centred', () => {
    const g = new Grid(4, 4); g.set(0, 0, RED);
    const o = rotsprite(g, 0, { size: [8, 8] });
    expect([o.w, o.h]).toEqual([8, 8]);
    expect(o.get(2, 2)).toBe(RED);
    expect(opaque(o)).toBe(1);
  });
  it('rotatePoint is the forward mapping and agrees with the pixels', () => {
    const g = new Grid(9, 9); g.set(7, 4, RED);
    for (const deg of [90, 180, 270]) { const [x, y] = rotatePoint([7, 4], deg, 9, 9); expect(rotsprite(g, deg).get(x, y)).toBe(RED); }
  });
});

describe('rotateNormals and rotateMask', () => {
  it('moves the pixels like rotsprite and turns the normal with them', () => {
    const n = new Grid(5, 5); putNormal(n, 3, 2, [1, 0, 1]); // right of centre, leaning east
    const o = rotateNormals(n, 90), v = getNormal(o, 2, 3)!; // south of centre
    expect(v).not.toBeNull();
    expect(v[0]).toBeCloseTo(0, 1); expect(v[1]).toBeGreaterThan(0.6); // now leaning south (y down)
    expect(getNormal(o, 3, 2)).toBeNull();
  });
  it('keeps z and a flat normal flat', () => {
    const n = new Grid(5, 5); putNormal(n, 1, 1, [0, 0, 1]);
    const o = rotateNormals(n, 37);
    let v: [number, number, number] | null = null;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) v = v ?? getNormal(o, x, y);
    expect(v).not.toBeNull();
    v = v!;
    expect(v[2]).toBeCloseTo(1, 1);
  });
  it('a mask rotates with the pixels', () => {
    const m = new Uint8Array(25); m[2 * 5 + 4] = 1;
    const o = rotateMask(m, 5, 5, 90);
    expect(o[4 * 5 + 2]).toBe(1);
    expect(o.reduce((a, b) => a + b, 0)).toBe(1);
  });
});
