import { describe, expect, test } from 'vitest';
import { layoutSettlementGraph, validateSettlementGraph, type SettlementGraph } from './graph.ts';
import { lintSettlement } from './lint.ts';
import { layoutSettlement } from './layout.ts';
import { DRIFTED_STREETS, TOWN } from './__fixtures__/graphs.ts';

const quick = (g: SettlementGraph, over: Partial<SettlementGraph> = {}) => layoutSettlementGraph({ ...structuredClone(g), tries: 2, ...over });

/** The distance from a point to a polyline (x,y pairs). */
function toLine(pts: number[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const [ax, ay, bx, by] = pts.slice(i, i + 4), dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

describe('settlement layout from a graph (R8)', () => {
  test('a graph is checked before it is laid out', () => {
    expect(validateSettlementGraph({ buildings: [] })).toContain('buildings: at least one');
    const bad: SettlementGraph = {
      buildings: [{ id: 'a', w: 4, h: 4 }, { id: 'b', w: 4, h: 4 }],
      gates: [{ id: 'n', bearing: 0 }],
      streets: [{ id: 'x', past: ['a', 'zz'], from: { gate: 'n' }, to: { street: 'y' } }, { id: 'y', past: ['b'], from: { gate: 'n' }, to: { street: 'x' } }],
      ties: [{ a: 'a', b: 'b' }],
    };
    const e = validateSettlementGraph(bad);
    expect(e).toContain('streets[0].past[1]: no building "zz"');
    expect(e).toContain('streets[1].from.gate: n already ends streets[0]');
    expect(e.some(x => x.includes('lead round to itself'))).toBe(true);
    expect(e).toContain('ties[0]: a distance, a bearing or both');
    expect(() => layoutSettlementGraph(bad)).toThrow(/invalid settlement graph/);
  });

  test('a walled village: streets run past their buildings, at the spacing asked, inside a wall with its gates', () => {
    const { spec, report } = quick(TOWN);
    expect(report.faults).toEqual([]);
    // every building that lines a street stands beside it: its centre a setback and half its depth from the line
    for (const st of TOWN.streets!) {
      const road = spec.roads.find(r => r.id === st.id)!;
      const width = road.width ?? (st.kind === 'lane' ? 2 : st.kind === 'alley' ? 1 : 3);
      for (const stop of st.past) {
        const id = typeof stop === 'string' ? stop : stop.id, place = report.places.find(p => p.id === id)!;
        if (place.street !== st.id) continue;
        const b = TOWN.buildings.find(x => x.id === id)!, d = toLine(road.points, place.cx + report.origin[0], place.cy + report.origin[1]);
        expect(d).toBeGreaterThan(width / 2 + 1 + Math.min(b.w, b.h) / 2 - 1.5);
        expect(d).toBeLessThan(width / 2 + 1 + Math.max(b.w, b.h) / 2 + 1.5);
      }
    }
    // spacing is the target, not what packing leaves
    expect(report.spacing.median).toBeGreaterThanOrEqual(1.5);
    expect(report.spacing.median).toBeLessThanOrEqual(3);
    expect(report.spacing.least).toBeGreaterThanOrEqual(0.9);
    // the tie
    expect(report.ties[0].off).toBeLessThan(0.25);
    // a closed palisade with a gate for each, on it; a road out of each gate; the alley's free end inside the wall
    expect(spec.walls).toHaveLength(1);
    expect(spec.walls[0].kind).toBe('palisade');
    expect(spec.walls[0].gates).toHaveLength(3);
    expect(spec.roads.filter(r => r.id?.endsWith('-road'))).toHaveLength(3);
    const findings = lintSettlement(spec, layoutSettlement(spec));
    expect(findings.filter(f => /overlaps|across|off the sheet|from its wall/.test(f.message))).toEqual([]);
    // the market is an open area, the rest buildings
    expect(spec.areas.map(a => a.id)).toEqual(['market']);
    expect(spec.buildings).toHaveLength(13);
    expect(spec.buildings.every(b => b.origin === 'graph')).toBe(true);
  }, 60000);

  test('setting_builder\'s A.a: places held at their tables\' bearings and distances, 360 to 990 ft out', () => {
    const { spec, report } = quick(DRIFTED_STREETS);
    for (const t of report.ties) {
      if (t.want !== undefined) expect(Math.abs(t.distance! - t.want) / t.want).toBeLessThan(0.15);
      if (t.wantBearing !== undefined) { const d = Math.abs(((t.bearing! - t.wantBearing) % 360 + 540) % 360 - 180); expect(d).toBeLessThan(20); }
    }
    expect(report.faults).toEqual([]);
    // the statues stand where the table puts them: A.1 fixed at the frame's origin
    const a1 = report.places.find(p => p.id === 'A.1')!;
    expect([a1.cx, a1.cy]).toEqual([0, 0]);
    expect(spec.walls).toEqual([]);
    expect(spec.scale.perCell).toBe(10);
    // the canal is a street from A.3 to the statues, a cell or two off A.1's box
    const canal = spec.roads.find(r => r.id === 'A-8')!, n = canal.points.length;
    expect(Math.hypot(canal.points[n - 2] - report.origin[0], canal.points[n - 1] - report.origin[1])).toBeLessThan(6);
  }, 60000);

  test('the same graph and seed lay out the same; another seed differs', () => {
    const a = quick(TOWN, { tries: 1, steps: 3000 }), b = quick(TOWN, { tries: 1, steps: 3000 }), c = quick(TOWN, { tries: 1, steps: 3000, seed: 2 });
    expect(a.spec).toEqual(b.spec);
    expect(c.spec.buildings).not.toEqual(a.spec.buildings);
  }, 60000);

  test('a building given a place stays there; one outside stands beyond the wall', () => {
    const g: SettlementGraph = {
      buildings: [{ id: 'keep', kind: 'keep', w: 8, h: 8, at: { x: 0, y: 0 } }, { id: 'h1', w: 4, h: 4 }, { id: 'h2', w: 4, h: 4 }, { id: 'h3', w: 4, h: 4 }, { id: 'mill', kind: 'mill', w: 5, h: 5, outside: true }],
      gates: [{ id: 'g', bearing: 90 }],
      streets: [{ id: 'main', from: { gate: 'g' }, to: { building: 'keep' }, past: ['h1', 'h2', 'h3'] }],
      ties: [{ a: 'keep', b: 'mill', distance: 25, bearing: 270 }],
    };
    const { spec, report } = layoutSettlementGraph({ ...g, tries: 2 });
    const keep = report.places.find(p => p.id === 'keep')!, mill = spec.buildings.find(b => b.id === 'mill')!;
    expect([keep.x, keep.y, keep.angle]).toEqual([0, 0, 0]);
    expect(spec.walls[0].kind).toBe('stone');
    // the mill is not inside the wall
    const w = spec.walls[0].points, cx = mill.x + mill.w / 2, cy = mill.y + mill.h / 2;
    let inside = false;
    for (let i = 0, j = w.length - 2; i < w.length; j = i, i += 2) if ((w[i + 1] > cy) !== (w[j + 1] > cy) && cx < ((w[j] - w[i]) * (cy - w[i + 1])) / (w[j + 1] - w[i + 1]) + w[i]) inside = !inside;
    expect(inside).toBe(false);
    expect(report.faults).toEqual([]);
  }, 60000);
});
