// chest base.v3 (r3) — v2 at a size that keeps a margin (v2 ran off the frame), gold as a surface slab (R5).
// v2: v1 with a bigger body and a 2x2 lock plate with a glint. v1: starts from the W1 probe (art/probes/prop base.v2), written for this chest: an iron-banded crypt
// iron straps over the lid edge, a gold lock plate, gold heaped inside when open. The plinth is its own solid under
// the chest (no interpenetration, R5); straps and lock are slabs.
export const meta = { brief: 'chest', pass: 'r3', notes: 'iron-banded chest on a stone plinth, three straps, gold inside', mirror: false };

export const params = {
  body: { type: 'swap', options: ['wood', 'leather'], default: 'wood' },
  plinth: { type: 'toggle', default: true },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params, open = ctx.state === 'open', m = ctx.lib.t2.scene3d();
  const W = Math.max(4, Math.round(w / 4.6)), D = Math.max(3, Math.round(W * 0.6)), H = Math.max(2, Math.round(W * 0.5)), z0 = P.plinth ? 1 : 0;
  if (P.plinth) m.add({ type: 'box', name: 'plinth', x: -1, y: -1, z: 0, w: W + 2, d: D + 2, h: 1, mat: 'stone' });
  m.add({ type: 'box', name: 'body', x: 0, y: 0, z: z0, w: W, d: D, h: H, mat: P.body });
  if (open) {
    m.add({ type: 'slab', name: 'gold', x: 1, y: 1, z: z0 + H - 1, w: W - 2, d: D - 2, h: 1, mat: 'accent', hi: 'accent.0' });
    m.add({ type: 'box', name: 'lid', x: 0, y: -1, z: z0 + H, w: W, d: 1, h: D, mat: P.body });
  } else m.add({ type: 'box', name: 'lid', x: 0, y: 0, z: z0 + H, w: W, d: D, h: 1, mat: P.body });
  for (const x of [0, W >> 1, W - 1]) m.add({ type: 'slab', name: 'strap', x, y: open ? -1 : 0, z: z0, w: 1, d: open ? D + 1 : D, h: open ? H + D : H + 1, mat: 'metal' });
  m.add({ type: 'slab', name: 'lock', x: (W >> 1) - 1, y: D - 1, z: z0 + H - 2, w: 2, d: 1, h: 2, mat: 'accent', hi: 'accent.0' });
  return m.render(w, h, { ox: Math.round(w / 2 - (W - D)), oy: Math.round(h - 4 - (W + D)) });
}
