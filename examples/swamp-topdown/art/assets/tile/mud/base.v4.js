// mud base.v4 (u1) — redo for P6b (blind review 5.0: motifs on a grid, no puddles). An even field instead of a few
// marks: the mid dirt step everywhere, olive wet flecks from fine periodic noise (many 1–3 px ones per tile, close in
// value), lighter clods and wet glints scattered pixel by pixel from a seeded hash (2–4 % each, never in clumps), so
// nothing lands as one recognisable blob per 16 px. The near-black last step stays out (it is the line colour's
// neighbour). Variants add a small puddle in a different spot each, for floors laid with `tiles.pick`.
export const meta = { brief: 'mud', pass: 'u1', notes: 'even field: mid dirt, fine olive wet patches, scattered clods and glints; variant puddles' };

export const params = { wet: { type: 'range', min: 0.6, max: 0.75, step: 0.05, default: 0.65 } };

export function render(ctx) {
  const { tex, Grid } = ctx.lib, [w, h] = ctx.size, d = ctx.dir.pal.dirt, olive = ctx.dir.pal.grass, stone = ctx.dir.pal.stone;
  const g = new Grid(w, h), hash = (x, y, k) => { let v = Math.imul(x * 73856093 ^ y * 19349663 ^ (ctx.seed + k) * 83492791, 2654435761); v ^= v >>> 15; return ((v >>> 0) % 1000) / 1000; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wet = tex.noise.gradient(x + 0.5, y + 0.5, { w, h, cells: 8, octaves: 1, seed: ctx.seed + 3 + ctx.variant });
    let c = wet > ctx.params.wet ? olive[1] : d[1];
    const r = hash(x, y, ctx.variant);
    if (r < 0.035) c = d[0]; else if (r < 0.05 && wet > 0.5 && hash(x - 1, y, ctx.variant) >= 0.035) c = stone[1];
    g.set(x, y, c);
  }
  if (ctx.variant > 0) {
    const px = Math.floor(hash(ctx.variant, 7, 11) * w), py = 3 + Math.floor(hash(ctx.variant, 9, 13) * (h - 6));
    for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) if ((x / 3) ** 2 + (y / 2) ** 2 <= 1) g.set((px + x + w) % w, (py + y + h) % h, y === -2 || (y === -1 && Math.abs(x) === 2) ? stone[1] : olive[2]);
  }
  return g;
}
