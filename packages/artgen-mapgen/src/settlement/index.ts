/** Settlement maps for tabletop games: villages, towns and castles from plain shapes, with each building's floor plans (`artgen settlement`). */
export * from './spec.ts';
export { FIXTURES, FIXTURE_KINDS, fixtureSize, type FixtureKind } from './fixtures.ts';
export { THEMES, PALETTES, type SettlementTheme, type Palette } from './theme.ts';
export {
  layoutSettlement, layoutFloor, floorAsDungeon, footprint, buildingWings, buildingAt, planToSite, siteToPlan, planOutline, rotatePts, snapToLine, inWater,
  roadWidth, waterWidth, wallThickness, TREE_FT, GATE_FT, TOWER_FT,
  type SettlementLayout, type BuildingGeom, type LineGeom, type WaterGeom, type WallGeom, type TowerGeom, type GateGeom, type BridgeGeom, type FloorLayout, type OpeningGeom, type FixtureGeom,
} from './layout.ts';
export {
  renderSettlementSvg, settlementRenderSize, settlementLayersFor, planSheet, planTarget, SITE_LAYERS, PLAN_LAYERS, VIEWS, BUILDING_MODES, SYMBOLS, SYMBOL_KINDS, PLAN_MARGIN,
  type SettlementLayer, type SettlementView, type BuildingMode, type RenderSettlementOptions,
} from './render.ts';
export { generateSettlement, settlementFromMap, groundFromMap, feetIn, type GroundSampler } from './generate.ts';
export { generateInterior, withInterior, frontSide, storiesOf } from './interior.ts';
export { lintSettlement, type Finding, type Severity } from './lint.ts';
export { settlementFacts, type SettlementFacts } from './facts.ts';
export { editSettlement, SETTLEMENT_OPS, type SettlementOp } from './edit.ts';
