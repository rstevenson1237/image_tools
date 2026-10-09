// house base.v3 (r3) — from v1 (4; v2 regressed to 3, R12): ridge along x again (the oblique camera looks down the
// front slope), now with shingle rows — a sawtooth across the slope, toon with a 1-voxel radius so every row gets a lit
// lip and a shaded underside — a ridge cap, front eave overhang, smaller footprint so roof and chimney clear the frame;
// front wall in a timber frame with a door, stone step and two warm windows. The roof is four flat-shaded terraces.
export const meta = { brief: 'house', pass: 'r3', notes: 'shingle rows on the front slope, ridge cap, eave, timber frame front', mirror: false };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 2 }), W = 13, D = 6, H = 7, cy = D / 2, rise = 3.5, over = 0.5;
  m.add({ type: 'box', name: 'footing', x: -0.5, y: -0.5, z: 0, w: W + 1, d: D + 1, h: 1, mat: 'stone' });
  m.add({ type: 'box', name: 'walls', x: 0, y: 0, z: 1, w: W, d: D, h: H - 1, mat: 'wood' });
  // shingle rows: terraces stepping up to the ridge, flat-shaded so each row shows a lit top lip over a mid riser
  const rows = 4, step = (cy + over) / rows;
  for (let i = 0; i < rows; i++) {
    const z0 = H - 0.5 + i * (rise / rows), d0 = i * step;
    m.add({ type: 'box', name: 'roof', x: -over, y: -over + d0, z: z0, w: W + 2 * over, d: D + 2 * over - 2 * d0, h: rise / rows + 0.01, mat: 'stone' });
  }
  m.add({ type: 'box', name: 'ridge', x: -over, y: cy - 0.5, z: H + rise - 0.3, w: W + 2 * over, d: 1, h: 0.7, mat: 'leather' });
  const fy = D - 0.5;
  for (const x of [0, 4, W - 5, W - 1]) m.add({ type: 'slab', name: 'post', x, y: fy, z: 1, w: 1, d: 0.5, h: H - 1, mat: 'leather' });
  m.add({ type: 'slab', name: 'beam', x: 0, y: fy, z: H - 0.5, w: W, d: 0.5, h: 0.5, mat: 'leather' });
  m.add({ type: 'slab', name: 'door', x: W / 2 - 1.25, y: fy, z: 1, w: 2.5, d: 0.5, h: 4, mat: 'leather' });
  m.add({ type: 'slab', name: 'knob', x: W / 2 + 0.6, y: fy, z: 2.8, w: 0.5, d: 0.5, h: 0.5, mat: 'metal' });
  for (const x of [1.5, W - 3.5]) {
    m.add({ type: 'slab', name: 'sill', x: x - 0.25, y: fy, z: 3, w: 2.5, d: 0.5, h: 0.5, mat: 'leather' });
    m.add({ type: 'slab', name: 'window', x, y: fy, z: 3.5, w: 2, d: 0.5, h: 2, mat: 'accent' });
  }
  m.add({ type: 'box', name: 'step', x: W / 2 - 1.5, y: D + 0.5, z: 0, w: 3, d: 1, h: 0.5, mat: 'stone' });
  m.add({ type: 'box', name: 'chimney', x: W - 3.5, y: 1, z: H + 1, w: 1.5, d: 1.5, h: rise + 1, mat: 'stone' });
  return m.render(48, 48, VIEW);
}

const VIEW = { renderer: 'raster', view: 'oblique', scale: 1, at: [24, 39], pivot: [6.5, 3, 0], shadowShape: 'footprint' };

// window centres and the door for the finish (front-wall points projected through the same camera)
export const anchors = ctx => {
  const m = ctx.lib.t2.scene3d({ k: 2 }), W = 13, D = 6, out = {};
  for (const [n, p] of [['window', [2.5, D, 4.5]], ['window2', [W - 2.5, D, 4.5]], ['door', [W / 2, D, 3]]]) { const a = m.screen(48, 48, VIEW, p); if (a) out[n] = a; }
  return out;
};
