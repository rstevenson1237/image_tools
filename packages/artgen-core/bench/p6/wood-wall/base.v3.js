// wood-wall base.v3 (r3) — from v2 (6): butt joints broke boards and the grain speckled. Now the boards are rendered
// from a tile twice as long and cropped (so most boards run the full height), orphan grain pixels are merged, and a
// second strap near the bottom frames the wall.
// v2, from v1 (5.5): speckled grain, boards chopped short. Now one board per row across the tile
// (no butt joints), calmer grain, wider boards, and an iron strap across at a third of the height with two rivets per
// board — it reads as a wall of a building, not a floor.
export const meta = { brief: 'wood-wall', pass: 'r3', notes: 'longer boards, merged grain, two straps' };

export function render(ctx) {
  const [w, h] = ctx.size, src = ctx.lib.tex.material('wood', { size: [h, w], scale: 1.3, params: { planks: 1, grain: 0.12 } }), g = new ctx.lib.Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = src.get(y, x); if (c) g.set(x, y, c); }
  // merge lone grain pixels into their neighbours (calmer boards)
  const fix = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g.get(x, y), up = g.get(x, (y + h - 1) % h), dn = g.get(x, (y + 1) % h);
    if (up && up === dn && c !== up) fix.push([x, y, up]);
  }
  for (const [x, y, c] of fix) g.set(x, y, c);
  const m = ctx.dir.pal.metal;
  for (const y0 of [Math.round(h / 3), h - 10]) {
    for (let x = 0; x < w; x++) { g.set(x, y0, m[0]); g.set(x, y0 + 1, m[1]); g.set(x, y0 + 2, m[1]); g.set(x, y0 + 3, m[2]); }
    for (let x = 5; x < w; x += 10) { g.set(x, y0 + 1, m[0]); g.set(x, y0 + 2, m[2]); }
  }
  return g;
}
