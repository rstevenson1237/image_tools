/** Terrain maps for tabletop games: generator, themes, symbols, grids and the SVG renderer (`artgen map`). */
export * from './spec.ts';
export { generateMap, terrainsUsed, coverage, riverWidth, type MapField, type MapLine, type River } from './generate.ts';
export { gridGeometry, type GridCell } from './gridlines.ts';
export { SYMBOLS, SYMBOL_KINDS, DIRECTED } from './symbols.ts';
export { THEME, THEMES, PATTERNS, type MapTheme, type ThemeName, type TerrainStyle } from './theme.ts';
export { renderMapSvg, mapLabelLayout, LEGEND_SYMBOLS, layersFor, fieldKey, terrainRegions, contourLines, MAP_LAYERS, FONT_FAMILY, type MapLayer, type RenderMapOptions, type UnplacedLabel } from './render.ts';
export { isolines, chaikin, simplifyLine, pathData, type Line } from 'artgen-primitives/lib/trace.ts';
export { mapFacts, areaOutline, feetIn, RULES as FACTS_RULES, type MapFacts, type MapFactsQuery, type PointFacts, type AreaFacts, type Features, type Summit, type SlopeBand } from './facts.ts';
export { checkRequirements, type RequirementResult } from './require.ts';
export { syncMap, MARK_DISTANCE } from './sync.ts';
