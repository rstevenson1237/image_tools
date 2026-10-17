/**
 * Map themes. `color` uses muted, well-separated fills with a few light patterns; `bw` is white paper and black ink,
 * where every terrain is told apart by its pattern (never by grey level alone), so it prints and photocopies cleanly.
 * Patterns are drawn in a 10 × 10 tile and scaled to the render.
 */
import type { Terrain } from './spec.ts';

export const THEMES = ['color', 'bw'] as const;
export type ThemeName = (typeof THEMES)[number];

export interface TerrainStyle { fill: string; pattern?: string; ink?: string }

export interface MapTheme {
  name: ThemeName;
  paper: string;
  ink: string;
  terrain: Record<Terrain, TerrainStyle>;
  /** Region edges: `own` strokes each region in its fill colour (hides seams); otherwise the edge colour. */
  edge: string | 'own';
  edgeWidth: number;
  coast: string;
  coastWidth: number;
  contour: string;
  contourOpacity: number;
  /** River banks (the river is filled with the shallow-water fill, so it runs into lakes and the sea seamlessly). */
  riverBank: string;
  riverBankWidth: number;
  road: string;
  grid: string;
  gridOpacity: number;
  label: Record<'region' | 'place' | 'water' | 'note', string>;
  halo: string;
  symbolFill: string;
}

/** Pattern tiles (10 × 10, stroke = ink unless noted). `{ink}` is replaced with the terrain's ink colour. */
export const PATTERNS: Record<string, string> = {
  lines: '<path d="M0 2.5H10M0 7.5H10" stroke="{ink}" stroke-width="0.7"/>',
  waves: '<path d="M0.5 3.5q1.25 -1.4 2.5 0t2.5 0M5.5 8.5q1.25 -1.4 2.5 0t2.5 0" fill="none" stroke="{ink}" stroke-width="0.6"/>',
  marsh: '<path d="M1 4H5M2 4V2.6M3.5 4V2.3M6 9H9.5M7 9V7.6M8.5 9V7.3" fill="none" stroke="{ink}" stroke-width="0.6"/>',
  sparse: '<circle cx="2.5" cy="3" r="0.55" fill="{ink}"/><circle cx="7.5" cy="8" r="0.55" fill="{ink}"/>',
  dots: '<circle cx="2" cy="2" r="0.6" fill="{ink}"/><circle cx="7" cy="2.5" r="0.6" fill="{ink}"/><circle cx="4.5" cy="7" r="0.6" fill="{ink}"/><circle cx="9.3" cy="7.8" r="0.6" fill="{ink}"/><circle cx="0.5" cy="8.8" r="0.6" fill="{ink}"/>',
  tufts: '<path d="M1.5 5.5l1 -2 1 2M6.5 10l1 -2 1 2" fill="none" stroke="{ink}" stroke-width="0.6" stroke-linejoin="round"/>',
  trees: '<circle cx="3" cy="3" r="1.7" fill="none" stroke="{ink}" stroke-width="0.6"/><circle cx="8" cy="8" r="1.7" fill="none" stroke="{ink}" stroke-width="0.6"/>',
  hatch: '<path d="M0 10L10 0M-2.5 2.5L2.5 -2.5M7.5 12.5L12.5 7.5" stroke="{ink}" stroke-width="0.6"/>',
  snow: '<path d="M3 2V4.4M1.8 3.2H4.2M8 7V9.4M6.8 8.2H9.2" stroke="{ink}" stroke-width="0.5"/>',
};

export const THEME: Record<ThemeName, MapTheme> = {
  color: {
    name: 'color', paper: '#f6f0e1', ink: '#2a241c',
    terrain: {
      deep: { fill: '#5d8db5' }, water: { fill: '#9cc5df' }, marsh: { fill: '#a9bb93', pattern: 'marsh', ink: '#4f6a45' },
      sand: { fill: '#f0e2b6' }, desert: { fill: '#e6cc8f', pattern: 'sparse', ink: '#a8854a' }, grass: { fill: '#cddca3' },
      scrub: { fill: '#c2bf82', pattern: 'tufts', ink: '#77733c' }, forest: { fill: '#86ad6f', pattern: 'trees', ink: '#3f6534' },
      rock: { fill: '#b3a998', pattern: 'hatch', ink: '#7d7263' }, snow: { fill: '#f8f8f4' },
    },
    edge: 'own', edgeWidth: 1, coast: '#3d6a8f', coastWidth: 1.3,
    contour: '#7f5f3f', contourOpacity: 0.65, riverBank: '#3d6a8f', riverBankWidth: 0.9, road: '#7a4f2a', grid: '#2b2b2b', gridOpacity: 0.3,
    label: { region: '#3b2a1a', place: '#1e1e1e', water: '#1f4f7a', note: '#3a3a3a' }, halo: '#ffffff', symbolFill: '#fbf7ee',
  },
  bw: {
    name: 'bw', paper: '#ffffff', ink: '#000000',
    terrain: {
      deep: { fill: '#ffffff', pattern: 'lines', ink: '#000000' }, water: { fill: '#ffffff', pattern: 'waves', ink: '#000000' },
      marsh: { fill: '#ffffff', pattern: 'marsh', ink: '#000000' }, sand: { fill: '#ffffff', pattern: 'sparse', ink: '#000000' },
      desert: { fill: '#ffffff', pattern: 'dots', ink: '#000000' }, grass: { fill: '#ffffff' },
      scrub: { fill: '#ffffff', pattern: 'tufts', ink: '#000000' }, forest: { fill: '#ffffff', pattern: 'trees', ink: '#000000' },
      rock: { fill: '#ffffff', pattern: 'hatch', ink: '#000000' }, snow: { fill: '#ffffff', pattern: 'snow', ink: '#000000' },
    },
    edge: '#000000', edgeWidth: 0.7, coast: '#000000', coastWidth: 1.6,
    contour: '#555555', contourOpacity: 0.8, riverBank: '#000000', riverBankWidth: 1.1, road: '#000000', grid: '#000000', gridOpacity: 0.3,
    label: { region: '#000000', place: '#000000', water: '#000000', note: '#000000' }, halo: '#ffffff', symbolFill: '#ffffff',
  },
};
