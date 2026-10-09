// grass-autotile base.v1 (r1) — template: autotile set (P6b) — one terrain lying on another, cut from two seamless material
// recipes. Frame i of the first state is canonical tile i of the brief's `autotile` layout (blob47: 47 tiles, wang16:
// 16); the runtime's `pack.tiles(id).resolve(mask)` picks them. Brief: `autotile: blob47` and `anims: { idle: { frames:
// 47 } }`. The boundary wobbles by noise along each edge, the upper terrain gets a rim and casts a shadow.
export const meta = { brief: 'grass-autotile', pass: 'r1', notes: 'template autotile: grass over dirt' };

export const params = {
  over: { type: 'choice', options: ['grass', 'water', 'stone', 'snow'], default: 'grass' },
  base: { type: 'choice', options: ['dirt', 'sand', 'cobble'], default: 'dirt' },
};

export function render(ctx) {
  const P = ctx.params, { tex } = ctx.lib, size = ctx.size;
  const over = tex.material(P.over, { size, seed: ctx.seed }), base = tex.material(P.base, { size, seed: ctx.seed + 1 });
  if (!ctx.brief.autotile) return over; // no layout in the brief: the plain upper terrain
  return tex.autotile(ctx.brief.autotile, ctx.frame, { over, base, seed: ctx.seed });
}
