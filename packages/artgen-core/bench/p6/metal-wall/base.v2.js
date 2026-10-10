// metal-wall base.v2 (r2) — from v1 (5.5): a busy grid of 16 px squares with orange specks. Now the plates are 32 px
// (two per row), stronger relief so the rivets and seams stand out, and rust kept to the seams (the recipe's creep
// with the speckle removed: isolated rust pixels go back to the plate colour).
export const meta = { brief: 'metal-wall', pass: 'r2', notes: '32 px plates, stronger relief, rust on the seams only' };

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
  return g;
}
