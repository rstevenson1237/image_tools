/** Traced rings out: SVG paths and path text. Colours are checked, nothing a person typed reaches the file. */
import type { TraceResult, TracedRing } from './trace.ts';

const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (v: number, precision: number): string => String(Number(v.toFixed(precision)));

/** Ring points are pixel indexes; the pixel `i` covers `i` to `i + 1`, so the path is drawn through the pixel centres. */
const PIXEL_CENTRES = { sx: 1, sy: 1, ox: 0.5, oy: 0.5 };

/** A ring as a closed path in SVG's `d` syntax: `M x y L x y … Z`. `sx`, `sy`, `ox` and `oy` map the picture's pixel indexes into the path's units (default: the centres of the pixels, in pixels). */
export function ringToD(r: TracedRing, precision = 2, map: { sx: number; sy: number; ox: number; oy: number } = PIXEL_CENTRES): string {
  const p = r.points, parts: string[] = [];
  for (let i = 0; i < p.length; i += 2) parts.push(`${i === 0 ? 'M' : 'L'}${num(p[i] * map.sx + map.ox, precision)} ${num(p[i + 1] * map.sy + map.oy, precision)}`);
  return parts.join(' ') + ' Z';
}

/** One path text per shape: the outline and its holes, to be filled even-odd. */
export function shapeDs(t: TraceResult, precision = 2, map?: { sx: number; sy: number; ox: number; oy: number }): string[] {
  return t.shapes.map(s => [s.outer, ...s.holes].map(r => ringToD(r, precision, map)).join(' '));
}

/** A whole trace as an SVG file: one even-odd path per shape, in the picture's pixels. */
export function traceToSvg(t: TraceResult, o: { fill?: string; background?: string | null; precision?: number } = {}): string {
  const fill = o.fill && HEX.test(o.fill) ? o.fill.toLowerCase() : '#000000', precision = o.precision ?? 2;
  const lines = [`<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="0 0 ${t.width} ${t.height}">`];
  if (o.background && HEX.test(o.background)) lines.push(`  <rect width="${t.width}" height="${t.height}" fill="${o.background.toLowerCase()}"/>`);
  for (const d of shapeDs(t, precision)) lines.push(`  <path fill="${fill}" fill-rule="evenodd" d="${d}"/>`);
  lines.push('</svg>', '');
  return lines.join('\n');
}
