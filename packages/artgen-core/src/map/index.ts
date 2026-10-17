/** Terrain maps for tabletop games: generator, themes, symbols, grids and the SVG renderer (`artgen map`). */
export * from './spec.ts';
export { generateMap, terrainsUsed, coverage, riverWidth, type MapField, type MapLine, type River } from './generate.ts';
export { gridGeometry, type GridCell } from './gridlines.ts';
export { SYMBOLS, SYMBOL_KINDS } from './symbols.ts';
export { THEME, THEMES, PATTERNS, type MapTheme, type ThemeName, type TerrainStyle } from './theme.ts';
export { renderMapSvg, layersFor, fieldKey, terrainRegions, contourLines, MAP_LAYERS, FONT_FAMILY, type MapLayer, type RenderMapOptions } from './render.ts';
export { isolines, chaikin, simplifyLine, pathData, type Line } from './trace.ts';
