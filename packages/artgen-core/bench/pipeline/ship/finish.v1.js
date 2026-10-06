// ship finish.v1 (f) on base.v3 (7): lit rims on the turret roofs, sighting hoods on the turrets, bridge windows,
// deck fittings (bollards and capstans near bow and stern), a bow jack staff, orphan clean-up.
export const base = 'base.v3';
export const meta = { notes: 'turret roof rims + hoods, bridge windows, bollards/capstans, jack staff, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  for (const [x0, w] of [[37, 13], [98, 13], [115, 13]]) px.light.rim(g, { region: [x0, 14, w, 13], ramps: ['navy'] });
  for (const [x, d] of [[43, -1], [103, 1], [120, 1]]) { px.set(g, [x + d * -2, 16], 'navy.3'); px.set(g, [x + d * -2, 24], 'navy.3'); }
  px.line(g, [86, 18], [86, 22], 'navy.3');
  for (const x of [12, 20, 132, 140]) { px.set(g, [x, 14], 'navy.3'); px.set(g, [x, 26], 'navy.3'); }
  px.set(g, [137, 20], 'navy.2'); px.set(g, [138, 20], 'navy.3');
  px.line(g, [150, 20], [154, 20], 'navy.1');
  return g;
}
