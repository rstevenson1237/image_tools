/**
 * `artgen map check`: each `require` entry of a map measured against the ground the generator made, and whether it is
 * met. Terrain shares are read as `map facts` reads them (whole percent over the samples of the area), so what a
 * consumer is told here is what it would read there. Nothing is reseeded and nothing is repaired: an unmet requirement
 * is named, and the remedy is the consumer's.
 */
import { coverage } from './geometry.ts';
import { samplesOf, shares } from './facts.ts';
import { generateMap, type MapField } from './generate.ts';
import type { MapSpec, Requirement, RequirementKind } from './spec.ts';

export interface RequirementResult {
  id: string;
  kind: RequirementKind;
  /** What was measured: a terrain, `low-high unit`, `stream` or `road`, or `rivers`. */
  what: string;
  /** The share of the area that meets it, the farthest a required point lies from the path (map units), or the generated rivers inside a clear area. Null when there is nothing to measure (no such path). */
  measured: number | null;
  needed: number;
  /** How `measured` is held to `needed`. */
  op: '>=' | '<=';
  met: boolean;
  /** `C-forest terrain forest 0.71 < 0.80 unmet`. */
  text: string;
}

const two = (v: number) => v.toFixed(2);

/** Distance from (x, y) to the nearest point of any of the polylines. */
function distanceToLines(lines: number[][], x: number, y: number): number {
  let best = Infinity;
  for (const p of lines) for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

function measure(spec: MapSpec, f: MapField, r: Requirement): Omit<RequirementResult, 'id' | 'kind' | 'text'> {
  if (r.kind === 'terrain') {
    const ids = samplesOf(f, r.area), measured = (shares(f, ids).find(s => s.terrain === r.terrain)?.share ?? 0) / 100;
    return { what: r.terrain, measured, needed: r.share, op: '>=', met: measured >= r.share - 1e-9 };
  }
  if (r.kind === 'height') {
    const ids = samplesOf(f, r.area), top = spec.topo.maxElevation, eps = top * 1e-6, need = r.share ?? 0.9;
    const inside = ids.filter(n => { const h = f.elevation[n] * top; return h >= r.low - eps && h <= r.high + eps; }).length;
    const measured = ids.length ? Math.round((inside / ids.length) * 100) / 100 : 0;
    return { what: `${r.low}-${r.high} ${spec.topo.unit}`, measured, needed: need, op: '>=', met: measured >= need - 1e-9 };
  }
  if (r.kind === 'path') {
    const lines = r.path === 'stream' ? f.rivers.filter(v => v.for === r.id).map(v => v.pts) : f.roads.filter(v => v.for === r.id).map(v => v.pts), tol = r.tolerance ?? 1;
    let far = 0;
    for (let i = 0; i < r.points.length; i += 2) far = Math.max(far, distanceToLines(lines, r.points[i], r.points[i + 1]));
    const measured = Number.isFinite(far) ? Math.round(far * 100) / 100 : null;
    return { what: r.path, measured, needed: tol, op: '<=', met: measured !== null && measured <= tol + 1e-9 };
  }
  // clear: the generated rivers whose centre line or banks come into the area
  const crossing = f.rivers.filter(v => v.source === 'generated' && [v.pts, v.outline].some(p => { for (let i = 0; i < p.length; i += 2) if (coverage(r.area, p[i], p[i + 1]) > 0) return true; return false; }));
  return { what: 'rivers', measured: crossing.length, needed: 0, op: '<=', met: crossing.length === 0 };
}

/** Every requirement of the map, measured, in the file's order. A map without any gives an empty list. */
export function checkRequirements(spec: MapSpec, field: MapField = generateMap(spec)): RequirementResult[] {
  return (spec.require ?? []).map(r => {
    const m = measure(spec, field, r), cmp = m.met ? m.op : m.op === '>=' ? '<' : '>';
    return { id: r.id, kind: r.kind, ...m, text: `${r.id} ${r.kind} ${m.what} ${m.measured === null ? 'no path' : two(m.measured)} ${cmp} ${two(m.needed)} ${m.met ? 'met' : 'unmet'}` };
  });
}
