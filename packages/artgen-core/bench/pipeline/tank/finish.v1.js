// tank finish.v1 (f) on base.v2 (7.5): inked glacis seams, a specular glint on the dome and the sensor, a lit
// rim on the dome's light side, orphan clean-up.
export const base = 'base.v2';
export const meta = { notes: 'glacis seams, dome/sensor glints, dome rim, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.line(g, [20, 17], [24, 13], 'armor.3');
  px.line(g, [43, 17], [39, 13], 'armor.3');
  px.light.rim(g, { region: [21, 23, 10, 10], ramps: ['armor'] });
  px.set(g, [26, 27], 'white.0'); px.set(g, [27, 26], 'white.0'); px.set(g, [26, 26], 'armor.0');
  px.fx.glint(g, [31, 30], 'cyan.0');
  return g;
}
