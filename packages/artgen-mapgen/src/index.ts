/** Mapgen layer (docs/TOOLING-PLAN.md §6): the map, dungeon and settlement engines, with the few primitives the maps-only bundle needs. Never imports the pixel-art pipeline. */
export * as map from './map/index.ts';
export * as dungeon from './dungeon/index.ts';
export * as settlement from './settlement/index.ts';
export { readFormat, type Migration } from 'artgen-primitives/format.ts';
export { encodePNG } from 'artgen-primitives/lib/png.ts';
export { initSvg, rasterizeSvg, setSvgFonts } from 'artgen-primitives/lib/svg.ts';
export { parseCrop, parseFit, fitPpu, clampCrop, type Crop, type Fit, type SizeUnit } from 'artgen-primitives/lib/view.ts';
export { type SyncReport, type SyncConflict } from 'artgen-primitives/lib/sync.ts';
export { PX_PER_MM } from 'artgen-primitives/lib/view.ts';
