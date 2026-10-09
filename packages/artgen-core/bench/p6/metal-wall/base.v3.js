// metal-wall base.v3 (r3) — from v2 (6): flat grey plates, no seam shading, rust down to a speck. Now each plate
// darkens toward its lower edge (grime runs down), the row below a seam is shaded and the one above lit (bevelled
// plates), and rust streaks run down from the rivets of the lower plates.
// v2, from v1 (5.5): a busy grid of 16 px squares with orange specks. Now the plates are 32 px
// (two per row), stronger relief so the rivets and seams stand out, and rust kept to the seams (the recipe's creep
// with the speckle removed: isolated rust pixels go back to the plate colour).
export const meta = { brief: 'metal-wall', pass: 'r3', notes: 'grime gradient, bevelled seams, rust streaks from rivets' };

export function render(ctx) {
  const [w, h] = ctx.size, g = ctx.lib.tex.materialResult('metal', { w, h, scale: 2, relief: 1.3 }).grid;
  const rust = new Set(ctx.dir.pal.accent), N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const fixes = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g.get(x, y);
    if (!rust.has(c)) continue;
    const near = N.filter(([dx, dy]) => rust.has(g.get((x + dx + w) % w, (y + dy + h) % h))).length;
    if (near < 2) fixes.push([x, y, g.get((x + 1) % w, y)]);
  }
  for (const [x, y, c] of fixes) if (c && !rust.has(c)) g.set(x, y, c);
  const m = ctx.dir.pal.metal, idx = c => m.indexOf(c), st = (c, k) => (idx(c) < 0 ? c : m[Math.max(0, Math.min(m.length - 1, idx(c) + k))]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g.get(x, y), v = y % 32;
    if (idx(c) < 0) continue;
    if (v > 22 && ctx.lib.tex.noise.value(x, y, { w, h, cells: 8, seed: 5 }) > 0.5 - (v - 22) * 0.04) g.set(x, y, st(c, 1));
  }
  // rust streaks under the lower rivets
  const r = ctx.dir.pal.accent;
  for (const x of [3, 28, 35, 60]) for (let k = 0; k < 6; k++) if (k % 3 !== 2) g.set(x, 36 + k, r[k < 2 ? 1 : 2]);
  return g;
}
