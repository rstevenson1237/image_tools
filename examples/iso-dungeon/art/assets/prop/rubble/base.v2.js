// rubble base.v2 (r2) — v1 fixed: origin raised so the heap stays in frame, a flat small dust pad, blocks stacked on
// the blocks they overlap (v1 put every block at z 1, sunk in the dust), some blocks two units tall.
export const meta = { brief: 'rubble', pass: 'r2', notes: 'stacked blocks on a flat dust pad', mirror: false };

export const params = {
  blocks: { type: 'range', min: 4, max: 7, step: 1, default: 6 },
  seed: { type: 'range', min: 1, max: 99, step: 1, default: 7 },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params, m = ctx.lib.t2.scene3d(), r = ctx.lib.rng(P.seed);
  const S = Math.max(5, Math.round(w / 5));
  m.add({ type: 'box', name: 'dust', x: 0, y: 0, z: 0, w: S, d: S, h: 1, mat: 'leather' });
  const placed = [];
  for (let i = 0; i < P.blocks; i++) {
    const bw = 1 + Math.floor(r() * 3), bd = 1 + Math.floor(r() * 2), bh = r() < 0.35 ? 2 : 1;
    const x = Math.floor(r() * (S - bw + 1)), y = Math.floor(r() * (S - bd + 1));
    const z = placed.filter(p => x < p.x + p.w && p.x < x + bw && y < p.y + p.d && p.y < y + bd).reduce((n, p) => Math.max(n, p.z + p.h), 1);
    placed.push({ x, y, z, w: bw, d: bd, h: bh });
    m.add({ type: 'box', name: `block${i}`, x, y, z, w: bw, d: bd, h: bh, mat: 'stone', hi: 'stone.0' });
  }
  return m.render(w, h, { ox: Math.round(w / 2), oy: Math.round(h - 4 - 2 * S) });
}
