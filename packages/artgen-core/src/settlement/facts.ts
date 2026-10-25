/**
 * Settlement facts (`artgen settlement facts`): the layout read back as numbers, for a referee's key or a consumer's
 * checks. Counts of buildings by kind; each building's box, kind, storeys and floors (rooms, doors, windows and
 * furniture by kind); each wall's kind, length, towers and gates; each road and stretch of water by kind and length;
 * each area by kind and size. Positions are rounded to 0.1 cell, lengths to 0.1 of the sheet's unit.
 */
import { roundTo } from '../lib/round.ts';
import { lineLength, polygonArea } from '../dungeon/geom.ts';
import { layoutSettlement, type SettlementLayout } from './layout.ts';
import { floorName, SETTLEMENT_FORMAT, type SettlementSpec } from './spec.ts';

const r1 = (v: number) => roundTo(v, 0.1);

export interface SettlementFacts {
  version: number;
  id: string;
  kind: SettlementSpec['kind'];
  size: { cols: number; rows: number; scale: string };
  counts: { buildings: Record<string, number>; roads: Record<string, number>; walls: Record<string, number>; water: Record<string, number>; areas: Record<string, number>; trees: number; props: Record<string, number> };
  buildings: { id: string; number?: number; kind: string; label?: string; box: { x: number; y: number; w: number; h: number; angle: number }; size: string; stories: number; floors: { level: number; name: string; rooms: number; doors: number; windows: number; fixtures: Record<string, number> }[] }[];
  walls: { index: number; kind: string; length: number; closed: boolean; towers: number; gates: { kind: string; at: [number, number] }[] }[];
  roads: { index: number; kind: string; length: number; label?: string }[];
  water: { index: number; kind: string; length?: number; area?: number }[];
  areas: { index: number; kind: string; area: number; label?: string }[];
  bridges: number;
}

const tally = (xs: string[]) => xs.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});

export function settlementFacts(spec: SettlementSpec, l: SettlementLayout = layoutSettlement(spec)): SettlementFacts {
  const per = spec.scale.perCell, unit = spec.scale.unit, len = (cells: number) => r1(cells * per), sq = (cells: number) => Math.round(cells * per * per);
  return {
    version: SETTLEMENT_FORMAT, id: spec.id, kind: spec.kind,
    size: { cols: spec.cols, rows: spec.rows, scale: `1 cell = ${per} ${unit}` },
    counts: {
      buildings: tally(spec.buildings.map(b => b.kind)), roads: tally(spec.roads.map(r => r.kind)), walls: tally(spec.walls.map(w => w.kind)),
      water: tally(spec.water.map(w => w.kind)), areas: tally(spec.areas.map(a => a.kind)), trees: spec.trees.length + l.areaTrees.length, props: tally(spec.props.map(p => p.kind)),
    },
    buildings: l.buildings.map(g => {
      const b = g.building;
      return {
        id: b.id, ...(g.number !== undefined && { number: g.number }), kind: b.kind, ...(b.label && { label: b.label }),
        box: { x: r1(b.x), y: r1(b.y), w: r1(b.w), h: r1(b.h), angle: r1(b.angle ?? 0) }, size: `${len(b.w)} × ${len(b.h)} ${unit}`,
        stories: b.stories ?? Math.max(1, (b.floors ?? []).filter(f => f.level >= 0).length),
        floors: [...(b.floors ?? [])].sort((p, q) => p.level - q.level).map(f => ({ level: f.level, name: floorName(f), rooms: f.rooms.length, doors: (f.doors?.length ?? 0) + (f.connections?.filter(c => c.kind !== 'open').length ?? 0), windows: f.windows?.length ?? 0, fixtures: tally((f.fixtures ?? []).map(x => x.kind)) })),
      };
    }),
    walls: l.walls.map(w => ({ index: w.index, kind: w.kind, length: len(lineLength(w.closed ? [...w.pts, w.pts[0], w.pts[1]] : w.pts)), closed: w.closed, towers: w.towers.length, gates: w.gates.map(g => ({ kind: g.kind, at: [r1(g.x), r1(g.y)] as [number, number] })) })),
    roads: l.roads.map(r => ({ index: r.index, kind: r.kind, length: len(lineLength(r.pts)), ...(spec.roads[r.index].label && { label: spec.roads[r.index].label }) })),
    water: l.water.map(w => (w.area ? { index: w.index, kind: w.kind, area: sq(polygonArea(w.pts)) } : { index: w.index, kind: w.kind, length: len(lineLength(w.pts)) })),
    areas: spec.areas.map((a, index) => ({ index, kind: a.kind, area: sq(polygonArea(a.points)), ...(a.label && { label: a.label }) })),
    bridges: l.bridges.length,
  };
}
