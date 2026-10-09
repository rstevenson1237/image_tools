// bog-water base.v4 (u1) — redo for P6b (blind review 5.0: heavy tiling grid; pads and scum read as noise). Still,
// dark water (the stone ramp's darkest step) as an even field: dark olive scum from fine periodic noise (close in value,
// many small patches), sparse lighter strands in it, single glints scattered by a seeded hash — no dashes or lines that
// land on the same spot every tile.
// Lily pads only on variants 1–3, one each in a different spot, for water laid with `tiles.pick`.
export const meta = { brief: 'bog-water', pass: 'u1', notes: 'still dark water, even dark scum, single glints; pads on variants' };

export const params = { scum: { type: 'range', min: 0.6, max: 0.75, step: 0.05, default: 0.68 } };

export function render(ctx) {
  const { tex } = ctx.lib, [w, h] = ctx.size, stone = ctx.dir.pal.stone, olive = ctx.dir.pal.grass;
  const g = new ctx.lib.Grid(w, h).fill(0, 0, w, h, stone[2]);
  const hash = (x, y, k) => { let v = Math.imul(x * 73856093 ^ y * 19349663 ^ (ctx.seed + k) * 83492791, 2654435761); v ^= v >>> 15; return ((v >>> 0) % 1000) / 1000; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sc = tex.noise.gradient(x + 0.5, y + 0.5, { w, h, cells: 8, octaves: 1, seed: ctx.seed + 5 + ctx.variant }), r = hash(x, y, ctx.variant);
    if (sc > ctx.params.scum) g.set(x, y, olive[2]);                       // dark scum: close in value to the water
    if (sc > ctx.params.scum + 0.1 && r < 0.15) g.set(x, y, olive[1]);     // its lighter strands, sparse
    else if (r > 0.975 && hash(x - 1, y, ctx.variant) <= 0.975) g.set(x, y, stone[1]); // single glints, never in pairs
  }
  if (ctx.variant > 0) { // a lily pad with a notch and a lit edge
    const cx = Math.floor(hash(ctx.variant, 3, 7) * w), cy = 3 + Math.floor(hash(ctx.variant, 5, 9) * (h - 6));
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      if (x * x + y * y > 5 || (x > 0 && Math.abs(y) <= x - 1)) continue;
      g.set((cx + x + w) % w, (cy + y + h) % h, y === -2 || x === -2 ? olive[0] : olive[1]);
    }
  }
  return g;
}
