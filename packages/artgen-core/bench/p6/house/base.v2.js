// house base.v2 (r2) — from v1 (4, a box with a flat lid): the gable now faces the viewer (ridge along y), so the
// roof shows a lit left slope and a shaded right one and the front wall is a pentagon; shingle rows are a sawtooth in
// the roof sdf (toon, small radius: each row gets its own light edge); a ridge cap, timber frame on the gable,
// framed window, door with a stone step, smaller footprint so the roof clears the frame.
export const meta = { brief: 'house', pass: 'r2', notes: 'front-facing gable, shingle rows, timber frame, framed window, door step', mirror: false };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 2 }), W = 11, D = 9, H = 5, cx = W / 2, rise = 5, over = 1;
  m.add({ type: 'box', name: 'footing', x: -0.5, y: -0.5, z: 0, w: W + 1, d: D + 1, h: 1, mat: 'stone' });
  m.add({ type: 'box', name: 'walls', x: 0, y: 0, z: 1, w: W, d: D, h: H - 1, mat: 'wood' });
  // gable end on the front wall: a triangle of wall under the roof
  m.add({ type: 'sdf', name: 'gable', mat: 'wood', bbox: [0, 0, H, W, D, H + rise], fn: (x, y, z) => (z - H) - rise * (1 - Math.abs(x - cx) / cx) });
  // roof: two slopes falling left/right with shingle rows (sawtooth across the slope), overhanging the walls
  m.add({ type: 'sdf', name: 'roof', mat: 'stone', shade: 'toon', bbox: [-over, -over, H - 0.5, W + over, D + over, H + rise + 1.2], fn: (x, y, z) => {
    const d = Math.abs(x - cx), top = H + rise + 0.8 - (rise / cx) * d, saw = 0.35 * ((d * 1.4) % 1);
    return z - (top - saw) + (z < top - 1.2 - saw ? 9 : 0); // a 1.2-thick shell
  } });
  m.add({ type: 'box', name: 'ridge', x: cx - 0.5, y: -over, z: H + rise + 0.6, w: 1, d: D + 2 * over, h: 0.6, mat: 'leather' });
  // front: timber frame, framed window in the gable, door with a step
  const fy = D - 0.5;
  for (const x of [0, W - 1]) m.add({ type: 'slab', name: 'post', x, y: fy, z: 1, w: 1, d: 0.5, h: H - 1, mat: 'leather' });
  m.add({ type: 'slab', name: 'beam', x: 0, y: fy, z: H - 0.5, w: W, d: 0.5, h: 0.5, mat: 'leather' });
  m.add({ type: 'slab', name: 'frame', x: cx - 1.5, y: fy, z: H + 0.6, w: 3, d: 0.5, h: 2.2, mat: 'leather' });
  m.add({ type: 'slab', name: 'window', x: cx - 1, y: fy, z: H + 1, w: 2, d: 0.5, h: 1.4, mat: 'accent' });
  m.add({ type: 'slab', name: 'door', x: cx - 1.25, y: fy, z: 1, w: 2.5, d: 0.5, h: 3.2, mat: 'leather' });
  m.add({ type: 'slab', name: 'knob', x: cx + 0.6, y: fy, z: 2.4, w: 0.5, d: 0.5, h: 0.5, mat: 'metal' });
  m.add({ type: 'box', name: 'step', x: cx - 1.5, y: D + 0.5, z: 0, w: 3, d: 1, h: 0.5, mat: 'stone' });
  m.add({ type: 'box', name: 'chimney', x: W - 3, y: 1.5, z: H, w: 1.5, d: 1.5, h: rise + 1, mat: 'stone' });
  return m.render(48, 48, { renderer: 'raster', view: 'oblique', scale: 1, at: [24, 41], shadowShape: 'footprint' });
}
