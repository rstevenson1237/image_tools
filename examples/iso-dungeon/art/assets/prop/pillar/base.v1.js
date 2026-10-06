// pillar base.v1 (r1) — from the iso prop template (3D mode): a broken crypt pillar segment. Square plinth, a shaft
// one unit narrower, a chipped capital block (a corner subtracted), a crack as a darker surface slab (R5).
export const meta = { brief: 'pillar', pass: 'r1', notes: 'plinth, shaft, chipped capital, crack', mirror: false };

export const params = {
  height: { type: 'range', min: 5, max: 8, step: 1, default: 7 },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params, m = ctx.lib.t2.scene3d();
  const S = Math.max(3, Math.round(w / 8)), H = P.height;
  m.add({ type: 'box', name: 'plinth', x: 0, y: 0, z: 0, w: S + 2, d: S + 2, h: 1, mat: 'stone' });
  m.add({ type: 'box', name: 'shaft', x: 1, y: 1, z: 1, w: S, d: S, h: H, mat: 'stone' });
  m.add({ type: 'subtract', name: 'capital', mat: 'stone', hi: 'stone.0', shapes: [
    { type: 'box', x: 0, y: 0, z: H + 1, w: S + 2, d: S + 2, h: 1 },
    { type: 'box', x: S, y: 0, z: H + 1, w: 2, d: 2, h: 1 },
  ] });
  m.add({ type: 'slab', name: 'crack', x: 1, y: S, z: 2, w: 1, d: 1, h: Math.round(H * 0.6), mat: 'metal' });
  return m.render(w, h, { ox: Math.round(w / 2), oy: Math.round(h - 4 - 2 * (S + 2)) });
}
