// pillar base.v2 (r2) — v1 smaller with a margin, the chip moved to the front corner, a zigzag crack down the front-left
// face and mortar courses every two units (darker surface slabs). v1: from the iso prop template (3D mode): a broken crypt pillar segment. Square plinth, a shaft
// one unit narrower, a chipped capital block (a corner subtracted), a crack as a darker surface slab (R5).
export const meta = { brief: 'pillar', pass: 'r2', notes: 'plinth, shaft, chipped capital, crack', mirror: false };

export const params = {
  height: { type: 'range', min: 5, max: 8, step: 1, default: 7 },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params, m = ctx.lib.t2.scene3d();
  const S = Math.max(3, Math.round(w / 10)), H = P.height;
  m.add({ type: 'box', name: 'plinth', x: 0, y: 0, z: 0, w: S + 2, d: S + 2, h: 1, mat: 'stone' });
  m.add({ type: 'box', name: 'shaft', x: 1, y: 1, z: 1, w: S, d: S, h: H, mat: 'stone' });
  m.add({ type: 'subtract', name: 'capital', mat: 'stone', hi: 'stone.0', shapes: [
    { type: 'box', x: 0, y: 0, z: H + 1, w: S + 2, d: S + 2, h: 1 },
    { type: 'box', x: S, y: S, z: H + 1, w: 2, d: 2, h: 1 },
  ] });
  for (let z = 2; z < H; z += 2) m.add({ type: 'slab', name: 'course', x: 1, y: 1, z, w: S, d: S, h: 1, mat: 'leather' });
  for (let k = 0; k < 3; k++) m.add({ type: 'slab', name: 'crack', x: 1 + (k % 2), y: S, z: H - 1 - 2 * k, w: 1, d: 1, h: 2, mat: 'metal' });
  return m.render(w, h, { ox: Math.round(w / 2), oy: Math.round(h - 4 - 2 * (S + 2)) });
}
