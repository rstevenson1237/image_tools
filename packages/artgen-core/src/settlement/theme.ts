/**
 * Settlement themes. `color` is flat and muted, close to the terrain map's colour theme, so a settlement over its
 * underlay matches the map; `bw` is ink on white paper, where water, woods, fields and roofs are told apart by pattern
 * and tone rather than by colour, so it prints and photocopies cleanly.
 */
import { THEME as MAP_THEME } from '../map/theme.ts';
import type { AreaKind, BuildingKind, Ground, RoadKind, WallKind } from './spec.ts';

export const THEMES = ['color', 'bw'] as const;
export type SettlementTheme = (typeof THEMES)[number];

export interface AreaStyle { fill: string; pattern?: string; edge?: string; dash?: boolean }
export interface RoadStyle { fill: string; edge: string; dash?: boolean; ruts?: boolean }

export interface Palette {
  paper: string;
  ink: string;
  halo: string;
  ground: Record<Ground, string>;
  water: string;
  waterEdge: string;
  /** B/W: ripple lines over the water. */
  ripples: boolean;
  road: Record<RoadKind, RoadStyle>;
  area: Record<AreaKind, AreaStyle>;
  roof: Record<'tile' | 'thatch' | 'slate' | 'stone' | 'wood', string>;
  ridge: string;
  wall: Record<WallKind, string>;
  tower: string;
  floor: string;
  outerWall: string;
  tree: string;
  treeDark: string;
  rock: string;
  fixture: { fill: string; accent: string; stone: string; water: string; paper: string };
  grid: string;
  gridOpacity: number;
  badge: string;
  badgeText: string;
}

const C = MAP_THEME.color;

export const PALETTES: Record<SettlementTheme, Palette> = {
  color: {
    paper: C.paper, ink: '#2a241c', halo: '#ffffff',
    ground: { grass: '#d4e0ad', dirt: '#e2d3b0', sand: C.terrain.sand.fill, snow: '#f4f4ef', stone: '#d6d1c6' },
    water: C.terrain.water.fill, waterEdge: C.riverBank, ripples: false,
    road: {
      highway: { fill: '#cbbfa8', edge: '#6e6252' }, street: { fill: '#d9cdb5', edge: '#8a7b63' }, lane: { fill: '#e2cfa5', edge: '#a88f62' },
      alley: { fill: '#d9cdb5', edge: '#8a7b63' }, path: { fill: '#dcc79a', edge: '#a88f62', dash: true }, track: { fill: 'none', edge: '#a88f62', ruts: true },
    },
    area: {
      field: { fill: '#e7dca0', pattern: 'furrows' }, garden: { fill: '#bcd48f', pattern: 'rows' }, orchard: { fill: '#c6d79a' }, wood: { fill: '#9fbf85' },
      scrub: { fill: '#c9c88f', pattern: 'tufts' }, marsh: { fill: '#b2c29d', pattern: 'marsh' }, graveyard: { fill: '#c3cfa4', pattern: 'graves' },
      market: { fill: '#e3d6bc', pattern: 'cobbles' }, square: { fill: '#ddd2bb', pattern: 'cobbles' }, yard: { fill: '#e4d9c1' },
      paddock: { fill: '#cfdc9e', edge: '#8a7b63', dash: true }, rubble: { fill: '#d4cdbd', pattern: 'rubble' },
    },
    roof: { tile: '#b9785b', thatch: '#d2b56e', slate: '#7f8796', stone: '#a8a194', wood: '#9a7a55' },
    ridge: '#5b3b2a',
    wall: { curtain: '#9b9284', stone: '#a69e90', palisade: '#7b5a39', fence: '#7b5a39', hedge: '#6f9a5a', drystone: '#9b9284', ruined: '#a69e90' },
    tower: '#b8b0a2', floor: '#f3ead6', outerWall: '#3b342b',
    tree: '#7fa764', treeDark: '#4f7a3d', rock: '#a8a194',
    fixture: { fill: '#d8c09a', accent: '#c0603a', stone: '#c9c3b6', water: C.terrain.water.fill, paper: '#fbf7ee' },
    grid: '#2b2b2b', gridOpacity: 0.22, badge: '#2a241c', badgeText: '#ffffff',
  },
  bw: {
    paper: '#ffffff', ink: '#000000', halo: '#ffffff',
    ground: { grass: '#ffffff', dirt: '#ffffff', sand: '#ffffff', snow: '#ffffff', stone: '#ffffff' },
    water: '#ffffff', waterEdge: '#000000', ripples: true,
    road: {
      highway: { fill: '#ffffff', edge: '#000000' }, street: { fill: '#ffffff', edge: '#000000' }, lane: { fill: '#ffffff', edge: '#000000' },
      alley: { fill: '#ffffff', edge: '#000000' }, path: { fill: 'none', edge: '#000000', dash: true }, track: { fill: 'none', edge: '#000000', ruts: true },
    },
    area: {
      field: { fill: '#ffffff', pattern: 'furrows' }, garden: { fill: '#ffffff', pattern: 'rows' }, orchard: { fill: '#ffffff' }, wood: { fill: '#ffffff' },
      scrub: { fill: '#ffffff', pattern: 'tufts' }, marsh: { fill: '#ffffff', pattern: 'marsh' }, graveyard: { fill: '#ffffff', pattern: 'graves' },
      market: { fill: '#ffffff', pattern: 'cobbles' }, square: { fill: '#ffffff', pattern: 'cobbles' }, yard: { fill: '#ffffff' },
      paddock: { fill: '#ffffff', edge: '#000000', dash: true }, rubble: { fill: '#ffffff', pattern: 'rubble' },
    },
    roof: { tile: '#d0d0d0', thatch: '#e6e6e6', slate: '#a8a8a8', stone: '#bdbdbd', wood: '#c4c4c4' },
    ridge: '#000000',
    wall: { curtain: '#6e6e6e', stone: '#8a8a8a', palisade: '#000000', fence: '#000000', hedge: '#ffffff', drystone: '#ffffff', ruined: '#9a9a9a' },
    tower: '#bdbdbd', floor: '#ffffff', outerWall: '#000000',
    tree: '#ffffff', treeDark: '#000000', rock: '#ffffff',
    fixture: { fill: '#ffffff', accent: '#9a9a9a', stone: '#d6d6d6', water: '#ffffff', paper: '#ffffff' },
    grid: '#000000', gridOpacity: 0.22, badge: '#000000', badgeText: '#ffffff',
  },
};

/** The roof material each building kind gets. */
export function roofTone(kind: BuildingKind): keyof Palette['roof'] {
  if (kind === 'cottage' || kind === 'barn' || kind === 'stable') return 'thatch';
  if (kind === 'keep' || kind === 'tower' || kind === 'gatehouse' || kind === 'barracks' || kind === 'ruin') return 'stone';
  if (kind === 'temple' || kind === 'chapel' || kind === 'hall' || kind === 'manor') return 'slate';
  if (kind === 'mill' || kind === 'warehouse') return 'wood';
  return 'tile';
}

/** Pattern tiles (10 × 10 units, scaled to the render), `{ink}` the pattern's colour. */
export const AREA_PATTERNS: Record<string, string> = {
  furrows: '<path d="M0 2.5H10M0 7.5H10" stroke="{ink}" stroke-width="0.5" stroke-opacity="0.55"/>',
  rows: '<path d="M1 2.5H4M6 2.5H9M1 7.5H4M6 7.5H9" stroke="{ink}" stroke-width="0.9" stroke-linecap="round" stroke-opacity="0.6"/>',
  tufts: '<path d="M1.5 5.5l1 -2 1 2M6.5 10l1 -2 1 2" fill="none" stroke="{ink}" stroke-width="0.6" stroke-linejoin="round"/>',
  marsh: '<path d="M1 4H5M2 4V2.6M3.5 4V2.3M6 9H9.5M7 9V7.6M8.5 9V7.3" fill="none" stroke="{ink}" stroke-width="0.6"/>',
  graves: '<path d="M2.5 1.5V5M1.3 2.6H3.7M7.5 6V9.5M6.3 7.1H8.7" stroke="{ink}" stroke-width="0.6" stroke-linecap="round"/>',
  cobbles: '<path d="M0 3.3H10M0 6.6H10M2 0V3.3M7 0V3.3M4.5 3.3V6.6M9.5 3.3V6.6M2 6.6V10M7 6.6V10" stroke="{ink}" stroke-width="0.35" stroke-opacity="0.45"/>',
  rubble: '<path d="M1 3L3 2L3.6 4L1.6 4.6ZM6 6L8.2 5.5L8.8 7.8L6.4 8.4ZM6.5 1L7.8 1.4L7.4 2.6Z" fill="{ink}" fill-opacity="0.5"/>',
  ripples: '<path d="M0.5 3.5q1.25 -1.2 2.5 0t2.5 0M5.5 8.5q1.25 -1.2 2.5 0t2.5 0" fill="none" stroke="{ink}" stroke-width="0.55"/>',
};

/** The pattern ink per theme. */
export const patternInk = (theme: SettlementTheme): string => (theme === 'bw' ? '#000000' : '#5e5340');
