// brick-wall base.v3 (r3) — from v2 (6.5): the soot barely showed. Now soot is two steps darker in a few smudges
// that thin out downward, and two bricks have a chipped corner (mortar showing), so the wall has incident.
// v2, from v1 (6): bright uniform orange, every brick the same wear, no grime. Now the lowest
// courses are damp (one ramp step darker, rising unevenly in a seeded noise line), a few bricks are blackened by soot
// near the top, and the relief is stronger so each brick catches light on its top edge.
export const meta = { brief: 'brick-wall', pass: 'r3', notes: 'stronger soot smudges, chipped corners' };

export function render(ctx) {
  const [w, h] = ctx.size, t = ctx.lib.tex.materialResult('brick', { w, h, relief: 1.4 }), g = t.grid;
  const ramp = ctx.dir.pal.accent, step = c => ramp[Math.min(ramp.length - 1, ramp.indexOf(c) + 1)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g.get(x, y);
    if (!c || ramp.indexOf(c) < 0) continue;
    const damp = y > h * 0.7 + 6 * (ctx.lib.tex.noise.value(x, 0, { w, h: 1, cells: 4, cellsY: 1, seed: 3 }) - 0.5);
    const sn = ctx.lib.tex.noise.value(x, y, { w, h, cells: 4, seed: 7 }) - y / h * 0.6;
    if (sn > 0.55) g.set(x, y, step(step(c))); else if (damp || sn > 0.45) g.set(x, y, step(c));
  }
  // chipped corners: mortar colour into the top-left corner of two bricks
  const mortar = ctx.dir.pal.dirt;
  for (const [bx, by] of [[20, 9], [45, 41]]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) g.set(bx + dx, by + dy, mortar[1]);
  return g;
}
