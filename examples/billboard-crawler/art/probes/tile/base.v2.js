// probe-tile base.v2 (r2) — from v1 (template ground): worn asylum linoleum. A checker of two close stone steps on
// a period that divides the tile (seamless), scuffs and a crack that wrap across the edges.
export const meta = { brief: 'probe-tile', pass: 'r2', notes: 'linoleum checker, scuffs, wrapped crack' };

export const params = {
  scuffs: { type: 'range', min: 2, max: 5, step: 1, default: 3 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { outline: false }), r = ctx.rng, X = v => (v * w) / 16;
  s.add({ type: 'rect', name: 'floor', x: 0, y: 0, w, h, mat: pal.stone, shade: 'flat', band: 1 });
  const wrapped = (spec, x, y) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) s.add({ ...spec, translate: [x + dx, y + dy] }); };
  for (let i = 0; i < P.scuffs; i++) wrapped({ type: 'rect', name: 'scuff', x: 0, y: 0, w: X(2), h: 1, mat: pal.stone, shade: 'flat', band: 2 }, Math.floor(r() * w), Math.floor(r() * h));
  wrapped({ type: 'path', name: 'crack', d: `M0 0 L${X(2)} ${X(1)} L${X(3)} ${X(3)} L${X(3.5)} ${X(3)} L${X(2.5)} ${X(0.8)} L${X(0.5)} ${-X(0.2)} Z`, color: 'outline' }, Math.floor(r() * w), Math.floor(r() * h));
  const period = Math.max(2, Math.round(w / 4));
  return ctx.lib.proc(s).noDefaults().add('pattern', { part: 'floor', type: 'checker', period, step: -1 }).render();
}
