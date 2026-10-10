// brick-wall base.v2 (r2) — from v1 (6): bright uniform orange, every brick the same wear, no grime. Now the lowest
// courses are damp (one ramp step darker, rising unevenly in a seeded noise line), a few bricks are blackened by soot
// near the top, and the relief is stronger so each brick catches light on its top edge.
export const meta = { brief: 'brick-wall', pass: 'r2', notes: 'damp low courses, soot, stronger relief' };

export function render(ctx) {
  const [w, h] = ctx.size, t = ctx.lib.tex.materialResult('brick', { w, h, relief: 1.4 }), g = t.grid;
  const ramp = ctx.dir.pal.accent, step = c => ramp[Math.min(ramp.length - 1, ramp.indexOf(c) + 1)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g.get(x, y);
    if (!c || ramp.indexOf(c) < 0) continue;
    const damp = y > h * 0.7 + 6 * (ctx.lib.tex.noise.value(x, 0, { w, h: 1, cells: 4, cellsY: 1, seed: 3 }) - 0.5);
    const soot = y < h * 0.3 && ctx.lib.tex.noise.value(x, y, { w, h, cells: 3, seed: 7 }) > 0.68;
    if (damp || soot) g.set(x, y, step(c));
  }
  return g;
}
