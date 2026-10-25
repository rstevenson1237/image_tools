/**
 * The ground under a dungeon (`underlay` in `dungeon.json`): a map's terrain, contours, rivers and roads, cropped to
 * the dungeon's extent and set under the rooms. The map is rendered by the map renderer with its own legend, title,
 * compass, scale bar, grid, labels and symbols off, and placed as a nested SVG; its ids are prefixed so they cannot
 * meet the dungeon's.
 */
import { generateMap, type MapField } from '../map/generate.ts';
import { renderMapSvg } from '../map/render.ts';
import type { MapSpec } from '../map/spec.ts';
import { n1 } from '../lib/svgdraw.ts';
import type { Crop } from '../lib/view.ts';
import type { DungeonSpec } from './spec.ts';

/** What the underlay needs of the sheet it lies under (a dungeon's or a settlement's). */
export type UnderlaySheet = Pick<DungeonSpec, 'cols' | 'rows' | 'underlay'>;

/** The part of the map under the dungeon, in map units, cut to the map; null when the dungeon lies wholly off it. */
export function underlayWindow(spec: UnderlaySheet, map: Pick<MapSpec, 'cols' | 'rows'>): Crop | null {
  const u = spec.underlay;
  if (!u) return null;
  const x0 = Math.max(0, u.origin[0]), y0 = Math.max(0, u.origin[1]);
  const x1 = Math.min(map.cols, u.origin[0] + spec.cols * u.scale), y1 = Math.min(map.rows, u.origin[1] + spec.rows * u.scale);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
}

/** The underlay as SVG at `k` pixels per dungeon cell (empty when there is none, or it lies off the map). */
export function underlaySvg(spec: UnderlaySheet, map: MapSpec, k: number, field?: MapField): string {
  const u = spec.underlay, win = underlayWindow(spec, map);
  if (!u || !win) return '';
  const ppu = k / u.scale;
  const svg = renderMapSvg(map, {
    theme: u.theme ?? 'color', ppu, crop: win, field: field ?? generateMap(map),
    layers: { legend: false, scale: false, compass: false, title: false, grid: false, labels: false, symbols: false },
  });
  const x = ((win[0] - u.origin[0]) / u.scale) * k, y = ((win[1] - u.origin[1]) / u.scale) * k;
  const placed = svg.replace(/^<svg ([^>]*?)width="[^"]*" height="[^"]*"/, (_m, pre: string) => `<svg ${pre}x="${n1(x)}" y="${n1(y)}" width="${n1(win[2] * ppu)}" height="${n1(win[3] * ppu)}"`)
    .replace(/ id="([^"]+)"/g, ' id="u-$1"').replace(/url\(#([^)]+)\)/g, 'url(#u-$1)');
  return `<g id="underlay">${placed}</g>`;
}
