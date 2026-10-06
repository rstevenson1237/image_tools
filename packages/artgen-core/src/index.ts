/** artgen engine: TS, ESM, no Node or DOM imports. */
export const name = 'artgen-core';

export * from './lib/color.ts';
export { Grid } from './lib/grid.ts';
export { rng, hashString } from './lib/rng.ts';
export { encodePNG, decodePNG } from './lib/png.ts';
export * from './lib/palette.ts';
export { drawText, textWidth } from './lib/font.ts';
export * as post from './lib/post.ts';
export * as prim from './lib/prim.ts';
export * as blit from './lib/blit.ts';
export * as iso from './lib/iso.ts';
export * as voxel from './lib/voxel.ts';
export { initSvg, svgReady, rasterizeSvg, svgToGrid, doc } from './lib/svg.ts';
export * from './direction.ts';
export * from './render.ts';
export * from './qa/metrics.ts';
export * from './qa/conformance.ts';
export * from './qa/sheet.ts';
export * from './qa/ledger.ts';
