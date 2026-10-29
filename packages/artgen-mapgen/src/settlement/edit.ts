/**
 * Edits to a settlement as plain objects (`{op: 'building.add', kind: 'inn', x: 10, y: 4, w: 8, h: 6}`), the one
 * vocabulary the CLI's flags, the MCP server's `settlement_edit` ops and the web tool all turn into. Each edit changes
 * the spec in place and returns a line saying what it did; a bad edit throws, and the caller validates the result.
 */
import { rng } from 'artgen-primitives/lib/rng.ts';
import { inPolygon } from '../dungeon/layout.ts';
import { polyBox, type Connection, type DoorKind, type Room } from '../dungeon/spec.ts';
import { generateInterior } from './interior.ts';
import {
  AREA_KINDS, BUILDING_KINDS, BUILDING_SHAPES, GATE_KINDS, ROAD_KINDS, ROOFS, TREE_KINDS, WALL_KINDS, WATER_KINDS, nextId,
  type Area, type Building, type Fixture, type Floor, type Gate, type Road, type SettlementLabel, type SettlementSpec, type SWall, type Tree, type Water,
} from './spec.ts';

/** One edit (see the module comment); `op` names it, the rest are its fields. */
export type SettlementOp = { op: string } & Record<string, unknown>;

export const SETTLEMENT_OPS = [
  'building.add', 'building.set', 'building.move', 'building.rm', 'interior', 'interior.clear', 'floor.add', 'floor.rm',
  'room.add', 'room.set', 'room.rm', 'connect', 'disconnect', 'door', 'window', 'fixture.add', 'fixture.rm',
  'road.add', 'road.rm', 'water.add', 'water.rm', 'wall.add', 'wall.gate', 'wall.rm', 'area.add', 'area.rm',
  'tree.add', 'tree.scatter', 'tree.rm', 'prop.add', 'prop.rm', 'label', 'symbol', 'label.rm', 'symbol.rm',
] as const;

const str = (o: SettlementOp, k: string): string => { const v = o[k]; if (typeof v !== 'string' || !v) throw new Error(`${o.op}: ${k} (text) is required`); return v; };
const num = (o: SettlementOp, k: string): number => { const v = o[k]; if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${o.op}: ${k} (a number) is required`); return v; };
const opt = <T>(o: SettlementOp, k: string): T | undefined => o[k] as T | undefined;
const pt = (o: SettlementOp, k: string): [number, number] => { const v = o[k]; if (!Array.isArray(v) || v.length !== 2 || !v.every(n => typeof n === 'number')) throw new Error(`${o.op}: ${k} ([x, y]) is required`); return v as [number, number]; };
const pts = (o: SettlementOp, k: string, min: number): number[] => { const v = o[k]; if (!Array.isArray(v) || v.length < min * 2 || v.length % 2 || !v.every(n => typeof n === 'number')) throw new Error(`${o.op}: ${k} (at least ${min} x,y pairs) is required`); return v as number[]; };
function oneOf<T extends string>(o: SettlementOp, k: string, list: readonly T[], fallback?: T): T {
  const v = o[k] ?? fallback;
  if (!list.includes(v as T)) throw new Error(`${o.op}: ${k}: one of ${list.join(', ')}`);
  return v as T;
}
/** Copy the given fields of `o` onto `t` (null or "none" removes a field). */
function fields(t: Record<string, unknown>, o: SettlementOp, keys: string[]): string[] {
  const done: string[] = [];
  for (const k of keys) if (k in o) { const v = o[k]; if (v === null || v === 'none') delete t[k]; else t[k] = v; done.push(k); }
  return done;
}
const at = <T>(xs: T[], i: unknown, what: string): number => { if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= xs.length) throw new Error(`no ${what} ${String(i)} (there are ${xs.length})`); return i; };

function building(m: SettlementSpec, id: unknown): Building {
  const b = m.buildings.find(x => x.id === id);
  if (!b) throw new Error(`no building ${String(id)}${m.buildings.length ? ` (there are ${m.buildings.slice(0, 8).map(x => x.id).join(', ')}${m.buildings.length > 8 ? ', …' : ''})` : ''}`);
  return b;
}
function floor(m: SettlementSpec, o: SettlementOp, make = false): { b: Building; f: Floor } {
  const b = building(m, o.building), level = typeof o.level === 'number' ? o.level : 0;
  let f = b.floors?.find(x => x.level === level);
  if (!f) {
    if (!make) throw new Error(`building ${b.id} has no floor at level ${level} (floor.add, or interior to lay them all out)`);
    f = { level, rooms: [] };
    b.floors = [...(b.floors ?? []), f].sort((p, q) => p.level - q.level);
  }
  return { b, f };
}

const BUILDING_FIELDS = ['shape', 'angle', 'roof', 'stories', 'label', 'number', 'href', 'wing', 'points', 'kind', 'origin'];

/** Apply one edit; returns what it did. */
export function editSettlement(m: SettlementSpec, o: SettlementOp): string {
  switch (o.op) {
    case 'building.add': {
      const kind = oneOf(o, 'kind', BUILDING_KINDS), shape = oneOf(o, 'shape', BUILDING_SHAPES, 'rect');
      const id = (opt<string>(o, 'id')) ?? nextId(m.buildings, 'b');
      if (m.buildings.some(b => b.id === id)) throw new Error(`building ${id} already exists`);
      const box = shape === 'poly' ? polyBox(pts(o, 'points', 3)) : { x: num(o, 'x'), y: num(o, 'y'), w: num(o, 'w'), h: num(o, 'h') };
      const b: Building = { id, kind, shape, ...box };
      fields(b as unknown as Record<string, unknown>, o, BUILDING_FIELDS.filter(k => k !== 'kind' && k !== 'shape'));
      m.buildings.push(b);
      return `added ${kind} ${id} at ${box.x},${box.y} (${box.w}×${box.h})`;
    }
    case 'building.set': {
      const b = building(m, o.id), done = fields(b as unknown as Record<string, unknown>, o, [...BUILDING_FIELDS, 'x', 'y', 'w', 'h']);
      if ('kind' in o) oneOf(o, 'kind', BUILDING_KINDS);
      if ('shape' in o) oneOf(o, 'shape', BUILDING_SHAPES);
      if ('roof' in o && o.roof !== null && o.roof !== 'none') oneOf(o, 'roof', ROOFS);
      if (b.shape === 'poly' && b.points) Object.assign(b, polyBox(b.points));
      return `set ${done.join(', ') || 'nothing'} of ${b.id}`;
    }
    case 'building.move': {
      const b = building(m, o.id), x = num(o, 'x'), y = num(o, 'y');
      if (b.points) b.points = b.points.map((v, i) => v + (i % 2 ? y - b.y : x - b.x));
      b.x = x; b.y = y;
      return `moved ${b.id} to ${x},${y}`;
    }
    case 'building.rm': { const b = building(m, o.id); m.buildings = m.buildings.filter(x => x !== b); return `removed ${b.id}`; }
    case 'interior': {
      const b = building(m, o.id ?? o.building), stories = opt<number>(o, 'stories');
      b.floors = generateInterior(m, b, { ...(typeof o.seed === 'number' && { seed: o.seed }), ...(stories !== undefined && { stories }) });
      if (stories !== undefined) b.stories = stories;
      return `laid out ${b.id}: ${b.floors.map(f => `level ${f.level} ${f.rooms.length} rooms, ${f.fixtures?.length ?? 0} fixtures`).join('; ')}`;
    }
    case 'interior.clear': { const b = building(m, o.id ?? o.building); delete b.floors; return `cleared the floors of ${b.id}`; }
    case 'floor.add': { const { b, f } = floor(m, o, true); if (typeof o.name === 'string') f.name = o.name; return `${b.id} has a floor at level ${f.level}`; }
    case 'floor.rm': { const { b, f } = floor(m, o); b.floors = b.floors!.filter(x => x !== f); if (!b.floors.length) delete b.floors; return `removed level ${f.level} of ${b.id}`; }
    case 'room.add': {
      const { b, f } = floor(m, o, true), shape = oneOf(o, 'shape', ['rect', 'circle', 'octagon', 'cave', 'poly'] as const, 'rect');
      const id = opt<string>(o, 'id') ?? nextId(f.rooms, `${f.level < 0 ? 'c' : 'f'}${Math.abs(f.level)}r`);
      if (f.rooms.some(r => r.id === id)) throw new Error(`room ${id} already exists on that floor`);
      const box = shape === 'poly' ? polyBox(pts(o, 'points', 3)) : { x: num(o, 'x'), y: num(o, 'y'), w: num(o, 'w'), h: num(o, 'h') };
      const r: Room = { id, shape, ...box, ...(shape === 'poly' && { points: o.points as number[] }) };
      fields(r as unknown as Record<string, unknown>, o, ['label', 'number']);
      f.rooms.push(r);
      return `added room ${id} to ${b.id} level ${f.level}`;
    }
    case 'room.set': {
      const { f } = floor(m, o), r = f.rooms.find(x => x.id === o.id);
      if (!r) throw new Error(`no room ${String(o.id)} on that floor`);
      return `set ${fields(r as unknown as Record<string, unknown>, o, ['x', 'y', 'w', 'h', 'shape', 'label', 'number', 'points']).join(', ') || 'nothing'} of room ${r.id}`;
    }
    case 'room.rm': {
      const { f } = floor(m, o), id = str(o, 'id');
      if (!f.rooms.some(r => r.id === id)) throw new Error(`no room ${id} on that floor`);
      f.rooms = f.rooms.filter(r => r.id !== id);
      if (f.connections) f.connections = f.connections.filter(c => c.a !== id && c.b !== id);
      return `removed room ${id}`;
    }
    case 'connect': {
      const { f } = floor(m, o), c: Connection = { a: str(o, 'a'), b: str(o, 'b') };
      fields(c as unknown as Record<string, unknown>, o, ['kind', 'at', 'width']);
      f.connections = [...(f.connections ?? []), c];
      return `connected ${c.a} and ${c.b}${c.kind ? ` (${c.kind})` : ''}`;
    }
    case 'disconnect': { const { f } = floor(m, o), i = at(f.connections ?? [], o.index, 'connection'); f.connections!.splice(i, 1); return `removed connection ${i}`; }
    case 'door': {
      const { b, f } = floor(m, o, true), d = { at: pt(o, 'at'), ...(o.kind !== undefined && { kind: o.kind as DoorKind | 'open' }), ...(typeof o.width === 'number' && { width: o.width }) };
      f.doors = [...(f.doors ?? []), d];
      return `door at ${d.at.join(',')} of ${b.id}`;
    }
    case 'window': {
      const { b, f } = floor(m, o, true), w = { at: pt(o, 'at'), ...(typeof o.width === 'number' && { width: o.width }) };
      f.windows = [...(f.windows ?? []), w];
      return `window at ${w.at.join(',')} of ${b.id}`;
    }
    case 'fixture.add': case 'prop.add': {
      const x: Fixture = { kind: str(o, 'kind'), x: num(o, 'x'), y: num(o, 'y') };
      fields(x as unknown as Record<string, unknown>, o, ['w', 'h', 'angle', 'label', 'origin']);
      if (o.op === 'prop.add' || o.building === undefined) { m.props.push(x); return `added ${x.kind} on the site at ${x.x},${x.y}`; }
      const { b, f } = floor(m, o, true);
      f.fixtures = [...(f.fixtures ?? []), x];
      return `added ${x.kind} to ${b.id} level ${f.level} at ${x.x},${x.y}`;
    }
    case 'fixture.rm': { const { f } = floor(m, o), i = at(f.fixtures ?? [], o.index, 'fixture'); const [x] = f.fixtures!.splice(i, 1); return `removed ${x.kind}`; }
    case 'prop.rm': { const i = at(m.props, o.index, 'prop'); const [x] = m.props.splice(i, 1); return `removed ${x.kind}`; }
    case 'road.add': {
      const r: Road = { kind: oneOf(o, 'kind', ROAD_KINDS), points: pts(o, 'points', 2) };
      fields(r as unknown as Record<string, unknown>, o, ['id', 'width', 'curve', 'label', 'origin']);
      m.roads.push(r);
      return `added a ${r.kind} (road ${m.roads.length - 1})`;
    }
    case 'water.add': {
      const w: Water = { kind: oneOf(o, 'kind', WATER_KINDS), points: pts(o, 'points', 2) };
      fields(w as unknown as Record<string, unknown>, o, ['id', 'width', 'origin']);
      m.water.push(w);
      return `added a ${w.kind} (water ${m.water.length - 1})`;
    }
    case 'wall.add': {
      const w: SWall = { kind: oneOf(o, 'kind', WALL_KINDS), points: pts(o, 'points', 2) };
      fields(w as unknown as Record<string, unknown>, o, ['id', 'closed', 'thickness', 'towers', 'gates', 'origin']);
      m.walls.push(w);
      return `added a ${w.kind} wall (wall ${m.walls.length - 1})`;
    }
    case 'wall.gate': {
      const w = m.walls[at(m.walls, o.index, 'wall')], g: Gate = { at: pt(o, 'at'), kind: oneOf(o, 'kind', GATE_KINDS, 'gate') };
      fields(g as unknown as Record<string, unknown>, o, ['width', 'drawbridge', 'label']);
      w.gates = [...(w.gates ?? []), g];
      return `added a ${g.kind} to wall ${o.index}`;
    }
    case 'area.add': {
      const a: Area = { kind: oneOf(o, 'kind', AREA_KINDS), points: pts(o, 'points', 3) };
      fields(a as unknown as Record<string, unknown>, o, ['id', 'label', 'origin']);
      m.areas.push(a);
      return `added a ${a.kind} (area ${m.areas.length - 1})`;
    }
    case 'tree.add': {
      const t: Tree = { kind: oneOf(o, 'kind', TREE_KINDS, 'tree'), x: num(o, 'x'), y: num(o, 'y') };
      fields(t as unknown as Record<string, unknown>, o, ['size', 'origin']);
      m.trees.push(t);
      return `added a ${t.kind} at ${t.x},${t.y}`;
    }
    case 'tree.scatter': {
      const kind = oneOf(o, 'kind', TREE_KINDS, 'tree'), area = pts(o, 'area', 3), count = num(o, 'count'), rand = rng(typeof o.seed === 'number' ? o.seed : m.trees.length + 1);
      const box = polyBox(area);
      let added = 0;
      for (let i = 0; i < count * 20 && added < count; i++) {
        const x = box.x + rand() * box.w, y = box.y + rand() * box.h;
        if (!inPolygon(area, x, y)) continue;
        m.trees.push({ kind, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
        added++;
      }
      return `scattered ${added} ${kind}${added === 1 ? '' : 's'}`;
    }
    case 'label': {
      const l: SettlementLabel = { text: str(o, 'text'), x: num(o, 'x'), y: num(o, 'y'), kind: (o.kind as SettlementLabel['kind']) ?? 'name' };
      fields(l as unknown as Record<string, unknown>, o, ['size', 'angle', 'href', 'origin']);
      m.overlay.labels.push(l);
      return `label "${l.text}" at ${l.x},${l.y}`;
    }
    case 'symbol': {
      const s = { kind: str(o, 'kind'), x: num(o, 'x'), y: num(o, 'y') };
      fields(s as Record<string, unknown>, o, ['scale', 'angle', 'origin']);
      m.overlay.symbols.push(s);
      return `symbol ${s.kind} at ${s.x},${s.y}`;
    }
    case 'road.rm': case 'water.rm': case 'wall.rm': case 'area.rm': case 'tree.rm': case 'label.rm': case 'symbol.rm': {
      const key = o.op.split('.')[0], list = (key === 'label' ? m.overlay.labels : key === 'symbol' ? m.overlay.symbols : key === 'road' ? m.roads : key === 'water' ? m.water : key === 'wall' ? m.walls : key === 'area' ? m.areas : m.trees) as unknown[];
      list.splice(at(list, o.index, key), 1);
      return `removed ${key} ${o.index}`;
    }
  }
  throw new Error(`no edit ${JSON.stringify(o.op)}: ${SETTLEMENT_OPS.join(', ')}`);
}
