/** Primitives layer (docs/TOOLING-PLAN.md §6): grid, colour, palette, rng, noise, raster, geometry, SVG, fonts, page layout, format versions. Imports nothing else in the suite. */

export * from './lib/color.ts';
export { Grid } from './lib/grid.ts';
export { rng, hashString } from './lib/rng.ts';
export { encodePNG, decodePNG, encodeAPNG } from './lib/png.ts';
export { encodeGIF } from './lib/gif.ts';
export * from './lib/palette.ts';
export { drawText, textWidth } from './lib/font.ts';
export * as post from './lib/post.ts';
export * as prim from './lib/prim.ts';
export * as blit from './lib/blit.ts';
export * as iso from './lib/iso.ts';
export * as voxel from './lib/voxel.ts';
export { initSvg, svgReady, rasterizeSvg, setSvgFonts, svgToGrid, doc } from './lib/svg.ts';
export * from './lib/normals.ts';
export * from './lib/noise.ts';
export * as geom from './geom.ts';
export { Raster, bandIndices, decalCoverage, flipMaskX, DECAL_SHAPES, type RasterItem, type RasterDecal, type DecalShape } from './raster.ts';
export { readFormat, type Migration } from './format.ts';
