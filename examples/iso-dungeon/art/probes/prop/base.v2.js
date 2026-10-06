// probe-prop base.v2 (r2) — from v1 (template iso chest): an iron-banded crypt chest on a low stone plinth. Three
// iron straps over the lid edge, a gold lock plate, gold heaped inside when open. The plinth is its own solid under
// the chest (no interpenetration, R5); straps and lock are slabs.
export const meta = { brief: 'probe-prop', pass: 'r2', notes: 'iron-banded chest on a stone plinth, three straps, gold inside', mirror: false };

export const params = {
  body: { type: 'swap', options: ['wood', 'leather'], default: 'wood' },
  plinth: { type: 'toggle', default: true },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params, open = ctx.state === 'open', m = ctx.lib.t2.scene3d();
  const W = Math.max(4, Math.round(w / 5)), D = Math.max(3, Math.round(W * 0.6)), H = Math.max(2, Math.round(W * 0.45)), z0 = P.plinth ? 1 : 0;
  if (P.plinth) m.add({ type: 'box', name: 'plinth', x: -1, y: -1, z: 0, w: W + 2, d: D + 2, h: 1, mat: 'stone' });
  m.add({ type: 'box', name: 'body', x: 0, y: 0, z: z0, w: W, d: D, h: H, mat: P.body });
  if (open) {
    m.add({ type: 'box', name: 'gold', x: 1, y: 1, z: z0 + H - 1, w: W - 2, d: D - 2, h: 1, mat: 'accent', hi: 'glow.0' });
    m.add({ type: 'box', name: 'lid', x: 0, y: -1, z: z0 + H, w: W, d: 1, h: D, mat: P.body });
  } else m.add({ type: 'box', name: 'lid', x: 0, y: 0, z: z0 + H, w: W, d: D, h: 1, mat: P.body });
  for (const x of [0, W >> 1, W - 1]) m.add({ type: 'slab', name: 'strap', x, y: open ? -1 : 0, z: z0, w: 1, d: open ? D + 1 : D, h: open ? H + D : H + 1, mat: 'metal' });
  m.add({ type: 'slab', name: 'lock', x: (W >> 1) - 1, y: D - 1, z: z0 + H - 1, w: 1, d: 1, h: 1, mat: 'accent' });
  return m.render(w, h, { ox: Math.round(w / 2 - (W - D)), oy: Math.round(h - 4 - (W + D)) });
}
