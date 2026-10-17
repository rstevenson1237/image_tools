/** Square and hex (flat-top, odd columns shifted down) grid geometry over a `cols × rows` map, in map units. */
import type { MapSpec } from './spec.ts';

export interface GridCell { x: number; y: number; name: string }

const letters = (n: number): string => { let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const two = (n: number) => String(n).padStart(2, '0');

/** Grid line path data (map units × k) and the named cells whose centre lies on the map. */
export function gridGeometry(spec: Pick<MapSpec, 'cols' | 'rows' | 'grid'>, k = 1): { d: string; cells: GridCell[] } {
  const { cols: W, rows: H } = spec, s = spec.grid.size, f = (v: number) => (Math.round(v * k * 10) / 10).toString();
  const cells: GridCell[] = [];
  let d = '';
  if (spec.grid.type === 'square') {
    for (let x = 0; x <= W + 1e-9; x += s) d += `M${f(x)} 0V${f(H)}`;
    for (let y = 0; y <= H + 1e-9; y += s) d += `M0 ${f(y)}H${f(W)}`;
    for (let c = 0; (c + 0.5) * s < W; c++) for (let r = 0; (r + 0.5) * s < H; r++) cells.push({ x: (c + 0.5) * s, y: (r + 0.5) * s, name: `${letters(c)}${r + 1}` });
  } else if (spec.grid.type === 'hex') {
    const R = s / Math.sqrt(3);
    for (let c = 0; c * 1.5 * R - R < W; c++) for (let r = -1; r * s - s < H; r++) {
      const cx = R + c * 1.5 * R, cy = s / 2 + r * s + (c % 2 ? s / 2 : 0);
      // whole hexagons in one path: shared edges overlap but one stroked path never darkens where it overlaps itself
      const P = (a: number) => `${f(cx + R * Math.cos((a * Math.PI) / 3))} ${f(cy + R * Math.sin((a * Math.PI) / 3))}`;
      d += `M${P(0)}L${P(1)}L${P(2)}L${P(3)}L${P(4)}L${P(5)}Z`;
      if (r >= 0 && cx < W && cy < H && cx > 0 && cy > 0) cells.push({ x: cx, y: cy, name: `${two(c + 1)}${two(r + 1)}` });
    }
  }
  return { d, cells };
}
