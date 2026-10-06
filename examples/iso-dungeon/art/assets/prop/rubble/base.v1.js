// rubble base.v1 (r1) — from the iso prop template (3D mode): fallen masonry — a few dressed blocks of different
// sizes heaped on a low dust pile (stone and dirt-grey), seeded so each variant falls differently.
export const meta = { brief: 'rubble', pass: 'r1', notes: 'seeded heap of blocks on a dust pile', mirror: false };

export const params = {
  blocks: { type: 'range', min: 4, max: 7, step: 1, default: 5 },
  seed: { type: 'range', min: 1, max: 99, step: 1, default: 7 },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params, m = ctx.lib.t2.scene3d(), r = ctx.lib.rng(P.seed);
  const S = Math.max(5, Math.round(w / 4.5));
  m.add({ type: 'ellipsoid', name: 'dust', cx: S / 2, cy: S / 2, cz: 0, rx: S / 2 + 1, ry: S / 2 + 1, rz: 1.5, mat: 'leather' });
  const placed = [];
  for (let i = 0; i < P.blocks; i++) {
    const bw = 1 + Math.floor(r() * 3), bd = 1 + Math.floor(r() * 2), x = Math.floor(r() * (S - bw)), y = Math.floor(r() * (S - bd));
    const z = 1 + placed.filter(p => x < p.x + p.w && p.x < x + bw && y < p.y + p.d && p.y < y + bd).reduce((n, p) => Math.max(n, p.z + 1 - 1), 0);
    placed.push({ x, y, z, w: bw, d: bd });
    m.add({ type: 'box', name: `block${i}`, x, y, z, w: bw, d: bd, h: 1, mat: 'stone', hi: 'stone.0' });
  }
  return m.render(w, h, { ox: Math.round(w / 2), oy: Math.round(h - 6 - S) });
}
