/** Dungeon maps for tabletop games: rooms, corridors and doors, hatched rock, grid and the B/W renderer (`artgen dungeon`). */
export * from './spec.ts';
export { layoutDungeon, roomOutline, inPolygon, contentBox, fitDungeon, roomCrop, type DungeonLayout, type RoomGeom, type CorridorGeom, type DoorGeom, type EndGeom } from './layout.ts';
export { generateDungeon, singleRoom } from './generate.ts';
export { SYMBOLS, SYMBOL_KINDS } from './symbols.ts';
export { renderDungeonSvg, dungeonLayersFor, dungeonLabelLayout, LEGEND_NAMES, DUNGEON_LAYERS, type DungeonLayer, type RenderDungeonOptions, type UnplacedLabel } from './render.ts';
export { dungeonFacts, RULES as FACTS_RULES, type DungeonFacts, type Boxed, type RoomFacts, type CorridorFacts, type ExitFacts, type OverlapFacts } from './facts.ts';
export { layoutWalls, wallFacts, convexHull, offsetRing, WALL_DEFAULTS, type WallGeom, type WallFacts, type TowerGeom, type GateGeom } from './walls.ts';
export { underlaySvg, underlayWindow } from './underlay.ts';
export { syncDungeon, MARK_DISTANCE } from './sync.ts';
