/**
 * Drawing checks (`artgen settlement check`): what a valid file can still get wrong once it is drawn. Buildings laid
 * over each other, standing in water or across a road; a gate far from its wall; a building off the sheet; on a floor,
 * a room outside the footprint, a fixture outside the floor or on top of another, and stairs with nothing to meet them
 * on the next floor. Each finding has the JSON path of the entry it is about and a severity: an `error` draws wrongly,
 * a `warning` is most likely a mistake.
 */
import { inPolygon, roomOutline } from '../dungeon/layout.ts';
import { nearestOnLine, polygonArea } from '../dungeon/geom.ts';
import type { Finding, Severity } from '../dungeon/lint.ts';
import { fixtureSize } from './fixtures.ts';
import { inWater, layoutSettlement, planOutline, snapToLine, type SettlementLayout } from './layout.ts';
import type { SettlementSpec } from './spec.ts';

export type { Finding, Severity };

/** The share of a polygon's sample points (every half cell) inside another test. */
function share(poly: number[], test: (x: number, y: number) => boolean): number {
  const xs = poly.filter((_, i) => i % 2 === 0), ys = poly.filter((_, i) => i % 2 === 1);
  let n = 0, hit = 0;
  for (let y = Math.min(...ys) + 0.25; y < Math.max(...ys); y += 0.5) for (let x = Math.min(...xs) + 0.25; x < Math.max(...xs); x += 0.5) {
    if (!inPolygon(poly, x, y)) continue;
    n++;
    if (test(x, y)) hit++;
  }
  return n ? hit / n : 0;
}

/** Any of these near the same spot on the next floor meets a flight of stairs (one stairwell can be drawn either way). */
const STAIRS = ['stairs', 'stairs-up', 'stairs-down', 'spiral-stairs', 'ladder', 'trapdoor'];

export function lintSettlement(spec: SettlementSpec, l: SettlementLayout = layoutSettlement(spec)): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Severity, path: string, message: string) => out.push({ severity, path, message });
  const off = (x: number, y: number) => x < 0 || y < 0 || x > spec.cols || y > spec.rows;

  l.buildings.forEach((g, i) => {
    const at = `buildings[${i}]`, b = g.building;
    if (polygonArea(g.outline) < 0.25) add('error', at, 'the footprint has (almost) no area');
    if (g.outline.some((v, j) => (j % 2 ? v < 0 || v > spec.rows : v < 0 || v > spec.cols))) add('warning', at, `${b.id} runs off the sheet`);
    const wet = share(g.outline, (x, y) => inWater(l.water, x, y));
    if (wet > 0.2) add('warning', at, `${b.id} stands in water (${Math.round(wet * 100)}% of it)`);
    const onRoad = l.roads.findIndex(r => r.kind !== 'path' && share(g.outline, (x, y) => nearestOnLine(r.pts, x, y).d < r.width / 2) > 0.2);
    if (onRoad >= 0) add('warning', at, `${b.id} stands across roads[${onRoad}] (a ${l.roads[onRoad].kind})`);
    for (let j = 0; j < i; j++) {
      const o = l.buildings[j], ob = o.building;
      if (Math.abs(o.cx - g.cx) > (b.w + b.h + ob.w + ob.h) / 2 || Math.abs(o.cy - g.cy) > (b.w + b.h + ob.w + ob.h) / 2) continue;
      if (share(g.outline, (x, y) => inPolygon(o.outline, x, y)) > 0.05) add('warning', at, `${b.id} overlaps ${ob.id} (buildings[${j}])`);
    }
    // the floors
    const outline = planOutline(spec, b), levels = new Map((b.floors ?? []).map(f => [f.level, f]));
    (b.floors ?? []).forEach((fl, fi) => {
      const fa = `${at}.floors[${fi}]`;
      fl.rooms.forEach((r, ri) => {
        const ro = roomOutline(r);
        if (share(ro, (x, y) => !inPolygon(outline, x, y)) > 0.1) add('warning', `${fa}.rooms[${ri}]`, `room ${r.id} reaches outside the footprint`);
      });
      const boxes = (fl.fixtures ?? []).map(f => { const [w, h] = fixtureSize(f, spec.interior.perCell), turned = Math.abs(Math.round((f.angle ?? 0) / 90)) % 2 === 1; return { x: f.x, y: f.y, w: turned ? h : w, h: turned ? w : h }; });
      (fl.fixtures ?? []).forEach((f, xi) => {
        const bx = boxes[xi], corners = [[bx.x - bx.w / 2, bx.y - bx.h / 2], [bx.x + bx.w / 2, bx.y - bx.h / 2], [bx.x - bx.w / 2, bx.y + bx.h / 2], [bx.x + bx.w / 2, bx.y + bx.h / 2]];
        if (corners.filter(([x, y]) => !inPolygon(outline, x, y)).length > 1) add('warning', `${fa}.fixtures[${xi}]`, `${f.kind} stands outside the building`);
        for (let yi = 0; yi < xi; yi++) {
          const o = boxes[yi];
          if (f.kind === 'rug' || fl.fixtures![yi].kind === 'rug') continue;
          const ox = Math.min(bx.x + bx.w / 2, o.x + o.w / 2) - Math.max(bx.x - bx.w / 2, o.x - o.w / 2), oy = Math.min(bx.y + bx.h / 2, o.y + o.h / 2) - Math.max(bx.y - bx.h / 2, o.y - o.h / 2);
          if (ox > 0.15 && oy > 0.15) add('warning', `${fa}.fixtures[${xi}]`, `${f.kind} sits on ${fl.fixtures![yi].kind} (fixtures[${yi}])`);
        }
        // stairs lead somewhere: a floor above (up) or below (down) with stairs near the same spot
        const up = f.kind === 'stairs-up' || f.kind === 'ladder' || f.kind === 'spiral-stairs', down = f.kind === 'stairs-down' || f.kind === 'trapdoor';
        for (const [want, dir] of [[up, 1], [down, -1]] as const) {
          if (!want) continue;
          const next = levels.get(fl.level + dir);
          if (!next) { if (f.kind !== 'ladder' && f.kind !== 'spiral-stairs') add('warning', `${fa}.fixtures[${xi}]`, `${f.kind} on ${fl.level} leads to level ${fl.level + dir}, which ${b.id} does not have`); continue; }
          if (!(next.fixtures ?? []).some(n => STAIRS.includes(n.kind) && Math.hypot(n.x - f.x, n.y - f.y) < 2.5)) add('warning', `${fa}.fixtures[${xi}]`, `${f.kind} meets no stairs on level ${fl.level + dir}`);
        }
      });
    });
  });
  l.walls.forEach((w, i) => {
    spec.walls[i].gates?.forEach((gt, j) => {
      const s = snapToLine(w.pts, w.closed, gt.at);
      if (Math.hypot(s.x - gt.at[0], s.y - gt.at[1]) > 3) add('warning', `walls[${i}].gates[${j}]`, `the gate is ${Math.round(Math.hypot(s.x - gt.at[0], s.y - gt.at[1]))} cells from its wall (drawn on the wall)`);
    });
  });
  spec.overlay.labels.forEach((lb, i) => { if (off(lb.x, lb.y)) add('warning', `overlay.labels[${i}]`, `"${lb.text}" is off the sheet`); });
  spec.overlay.symbols.forEach((s, i) => { if (off(s.x, s.y)) add('warning', `overlay.symbols[${i}]`, `${s.kind} is off the sheet`); });
  spec.props.forEach((p, i) => { if (off(p.x, p.y)) add('warning', `props[${i}]`, `${p.kind} is off the sheet`); });
  return out;
}
