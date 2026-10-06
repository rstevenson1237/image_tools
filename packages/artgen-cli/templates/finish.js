// finish.v{{N}} (f) on {{BASE}} — the one direct-pixel pass (R2): fix, fx, light, outline, patch.
// Colours are direction tokens (ramp.index), never hex (R11). Global ops run on every frame and facing; patches
// follow anchors (ctx.at('head')) through frames. Delete what you don't need; add what the review sheet asks for.
export const base = '{{BASE}}';
export const meta = { notes: 'template finish: orphan clean-up, jaggies, light-side rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.fix.jaggies(g);
  // px.light.rim(g, { ramps: ['cloth'] });
  // px.fx.glint(g, ctx.at('tip'), 'glow.0');
  // if (ctx.key('idle', 0)) px.patch(g, ctx.at('head'), ['.b.b.'], { b: 'outline' });
  return g;
}
