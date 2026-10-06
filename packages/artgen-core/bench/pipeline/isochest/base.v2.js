// isochest base.v2 (r2) — from v1 (6.5): the open lid shows its dark inside (a dark slab on the lid's inner
// face), coins heap higher in the middle, straps run over the lid edge; params for variants (body material,
// trim, strap count, width, heap).
export const meta = { brief: 'isochest', pass: 'r2', notes: 'hollow open lid, heaped coins, straps over the lid; params', mirror: false };

export const params = {
  body: { type: 'swap', options: ['wood', 'leather', 'purple', 'red'], default: 'wood' },
  trim: { type: 'swap', options: ['gold', 'steel'], default: 'gold' },
  straps: { type: 'choice', options: [2, 3], default: 2 },
  width: { type: 'range', min: 6, max: 8, step: 1, default: 7 },
  heap: { type: 'toggle', default: true },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, open = ctx.state === 'open', m = ctx.lib.t2.scene3d(), W = P.width;
  const body = pal[P.body], trim = P.trim, xs = P.straps === 3 ? [1, W >> 1, W - 2] : [1, W - 2];
  m.add({ type: 'box', name: 'body', x: 0, y: 0, z: 0, w: W, d: 4, h: 3, mat: body });
  if (open) {
    m.add({ type: 'box', name: 'gold', x: 1, y: 1, z: 2, w: W - 2, d: 2, h: 1, mat: 'gold', hi: 'white.0' });
    if (P.heap) m.add({ type: 'slab', name: 'heap', add: true, x: 2, y: 1, z: 3, w: W - 4, d: 1, h: 1, mat: 'gold', hi: 'white.0' });
    m.add({ type: 'box', name: 'lid', x: 0, y: -1, z: 3, w: W, d: 1, h: 4, mat: body });
    m.add({ type: 'slab', name: 'lid-inside', x: 1, y: -1, z: 4, w: W - 2, d: 1, h: 2, mat: [body[2], pal.ink[0], pal.ink[0]] });
  } else m.add({ type: 'box', name: 'lid', x: 0, y: 0, z: 3, w: W, d: 4, h: 1, mat: body });
  for (const x of xs) m.add({ type: 'slab', name: 'strap', x, y: open ? -1 : 0, z: 0, w: 1, d: open ? 5 : 4, h: open ? 7 : 4, mat: trim, hi: 'white.0' });
  m.add({ type: 'slab', name: 'lock', x: W >> 1, y: 3, z: open ? 1 : 2, w: 1, d: 1, h: 1, mat: trim === 'gold' ? 'steel' : 'gold' });
  return m.render(32, 32, { ox: 13 - (W - 7), oy: 17 });
}
