// Dungeon maps: the file format, layout (routes, doors, fit), the generator and the black-and-white renderer.
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';
import * as M from '../index.ts';

const rooms = (): D.Room[] => [
  { id: 'a', shape: 'rect', x: 2, y: 2, w: 6, h: 4 },
  { id: 'b', shape: 'rect', x: 14, y: 2, w: 4, h: 8 },
  { id: 'c', shape: 'circle', x: 2, y: 12, w: 5, h: 5 },
];
const two = (over: Partial<D.DungeonSpec> = {}) => D.newDungeon('t', { cols: 22, rows: 20, rooms: rooms(), corridors: [{ from: { room: 'a' }, to: { room: 'b' }, doors: ['door', 'secret'] }], ...over });

describe('dungeon maps', () => {
  test('defaults fill every field; validation names the problems', () => {
    const d = D.newDungeon('lair');
    expect(d).toMatchObject({ cols: 40, rows: 30, grid: { show: true, size: 2, sub: true, clip: 'floor' }, style: { hatch: 'band' }, scale: { perCell: 5, unit: 'ft' } });
    expect(D.validateDungeon(d)).toEqual([]);
    expect(D.validateDungeon({ ...d, id: '../x', rooms: [{ id: 'a', shape: 'hex', x: 1, y: 1, w: 0, h: 2 }], corridors: [{ from: { room: 'zz' }, to: { at: [1] }, doors: ['gate', null] }] })).toEqual(expect.arrayContaining([
      expect.stringContaining('id'), expect.stringContaining('rooms[0].shape'), expect.stringContaining('rooms[0]: x, y and w, h'),
      expect.stringContaining('corridors[0].from.room'), expect.stringContaining('corridors[0].to.at'), expect.stringContaining('corridors[0].doors'),
    ]));
    expect(D.validateDungeon({ ...d, rooms: [...rooms(), rooms()[0]] })).toEqual([expect.stringContaining('used twice')]);
    expect(D.parseDungeon({ id: 'old', seed: 3 })).toMatchObject({ cols: 40, gen: { rooms: 8 }, overlay: { labels: [] } });
    expect(D.parseDungeon({ id: 'p', seed: 1, rooms: [{ id: 'l', shape: 'poly', points: [1, 1, 5, 1, 5, 6, 3, 6, 3, 3, 1, 3] }] }).rooms[0]).toMatchObject({ x: 1, y: 1, w: 4, h: 5 });
    expect(M.dungeon.newDungeon).toBe(D.newDungeon);
  });

  test('points: x,y in cells or a cell name', () => {
    expect(D.parsePoint('3.5, 2')).toEqual([3.5, 2]);
    expect(D.parsePoint('C4')).toEqual([2.5, 3.5]);
    expect(D.parsePoint('cell:a1')).toEqual([0.5, 0.5]);
    expect(() => D.parsePoint('nowhere')).toThrow(/cell name/);
  });

  test('rooms that line up get a straight corridor; others an elbow; doors sit on the wall', () => {
    const l = D.layoutDungeon(two());
    const c = l.corridors[0].pts;
    expect(c).toHaveLength(4);
    expect(c[1]).toBe(c[3]); // horizontal, through the rows both rooms share
    expect(c[1] % 1).toBe(0.5); // a 1-wide corridor runs down the middle of a row of cells
    const [d0, d1] = l.doors;
    expect(d0).toMatchObject({ kind: 'door', angle: 0 });
    expect(d0.x).toBeCloseTo(8); // room a's right wall
    expect(d1).toMatchObject({ kind: 'secret' });
    expect(d1.x).toBeCloseTo(14); // room b's left wall, entered from the far side
    const elbow = D.layoutDungeon(two({ corridors: [{ from: { room: 'b' }, to: { room: 'c' } }] })).corridors[0].pts;
    expect(elbow).toHaveLength(6);
    expect(elbow[1]).toBe(elbow[3]); // across first, then down
    expect(elbow[2]).toBe(elbow[4]);
  });

  test('poly rooms anchor inside themselves; caves keep their outline when others change', () => {
    const L: D.Room = { id: 'l', shape: 'poly', points: [20, 13, 24, 13, 24, 20, 22, 20, 22, 16, 20, 16], x: 20, y: 13, w: 4, h: 7 };
    const g = D.layoutDungeon(D.newDungeon('p', { rooms: [L] })).rooms[0];
    expect(D.inPolygon(g.outline, g.cx, g.cy)).toBe(true);
    expect(Math.hypot(g.cx - 22, g.cy - 16)).toBeGreaterThan(1); // well inside, away from the L's inner corner
    expect([g.cx, g.cy]).not.toEqual([22, 16.5]); // its bounding-box centre, on the wall
    const cave: D.Room = { id: 'k', shape: 'cave', x: 5, y: 5, w: 8, h: 6 };
    expect(D.roomOutline(cave)).toEqual(D.roomOutline({ ...cave }));
    expect(D.roomOutline(cave)).not.toEqual(D.roomOutline({ ...cave, id: 'k2' }));
  });

  test('a single room: centred, with exits running off the map', () => {
    const d = D.singleRoom(D.newDungeon('one'), { shape: 'rect', w: 8, h: 6, number: 20, exits: [{ side: 'n' }, { side: 'e', door: 'locked' }] });
    expect(d).toMatchObject({ cols: 14, rows: 12, rooms: [{ x: 3, y: 3, w: 8, h: 6, number: 20 }] });
    const l = D.layoutDungeon(d);
    expect(l.doors.map(x => [x.kind, Math.round(x.x * 2) / 2, Math.round(x.y * 2) / 2])).toEqual([['door', 7.5, 3], ['locked', 11, 6.5]]);
    for (const c of l.corridors) {
      const [x, y] = c.pts.slice(-2);
      expect(x < 0 || y < 0 || x > d.cols || y > d.rows).toBe(true);
    }
    expect(D.renderDungeonSvg(d)).toContain('>20</text>');
  });

  test('generation: deterministic, no overlaps, every room reachable', () => {
    const base = D.newDungeon('g', { seed: 4 });
    expect(D.generateDungeon(base)).toEqual(D.generateDungeon(base));
    expect(D.generateDungeon({ ...base, seed: 5 }).rooms).not.toEqual(D.generateDungeon(base).rooms);
    for (const seed of [1, 2, 3, 9]) {
      const d = D.generateDungeon({ ...base, seed, overlay: { labels: [{ text: 'kept', x: 1, y: 1, kind: 'note' }], symbols: [] } });
      expect(d.rooms.length).toBeGreaterThanOrEqual(6);
      expect(d.overlay.labels).toHaveLength(1);
      for (const [i, a] of d.rooms.entries()) for (const b of d.rooms.slice(i + 1))
        expect(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h, `${a.id} overlaps ${b.id}`).toBe(true);
      const seen = new Set([d.rooms[0].id]);
      for (let grew = true; grew;) {
        grew = false;
        for (const c of d.corridors) {
          if (!('room' in c.from) || !('room' in c.to)) continue;
          const [f, t] = [c.from.room, c.to.room];
          if (seen.has(f) !== seen.has(t)) { seen.add(f); seen.add(t); grew = true; }
        }
      }
      expect(seen.size).toBe(d.rooms.length);
      expect(d.corridors.some(c => 'at' in c.to)).toBe(true); // the entrance
      expect(D.validateDungeon(d)).toEqual([]);
    }
  });

  test('fit moves the content next to the edges and shrinks the map', () => {
    const d = D.newDungeon('f', { cols: 60, rows: 50, rooms: [{ id: 'a', shape: 'rect', x: 20, y: 30, w: 4, h: 3 }], overlay: { labels: [{ text: 'x', x: 22, y: 31, kind: 'note' }], symbols: [] } });
    const f = D.fitDungeon(d, 2);
    expect(f.rooms[0]).toMatchObject({ x: 2, y: 2 });
    expect(f.overlay.labels[0]).toMatchObject({ x: 4, y: 3 });
    expect([f.cols, f.rows]).toEqual([8, 7]);
  });

  test('render: layers, the floor-clipped grid, hatching styles, black and white only', () => {
    const d = two({ title: 'Crypt', overlay: { labels: [{ text: 'Hall', x: 5, y: 4, kind: 'area' }], symbols: [{ kind: 'stairs', x: 3, y: 3, angle: 90 }] } });
    const svg = D.renderDungeonSvg(d);
    for (const id of ['rock', 'floors', 'grid', 'doors', 'symbols', 'numbers', 'labels', 'title', 'scale']) expect(svg, id).toContain(`<g id="${id}"`);
    expect(svg).not.toContain('<g id="compass"');
    expect(svg).toContain('mask="url(#floor-mask)"');
    expect(svg).toContain('url(#hatch)');
    expect(svg).toContain('>HALL</text>');
    const colours = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/gi)].map(m => m[1].toLowerCase()));
    expect([...colours].every(c => c === '#000000' || c === '#ffffff')).toBe(true);
    const bare = D.renderDungeonSvg(d, { layers: { grid: false, labels: false, numbers: false, title: false } });
    for (const id of ['grid', 'labels', 'numbers', 'title']) expect(bare, id).not.toContain(`<g id="${id}"`);
    expect(D.renderDungeonSvg({ ...d, grid: { ...d.grid, clip: 'all' } })).not.toContain('floor-mask');
    expect(D.renderDungeonSvg({ ...d, style: { ...d.style, hatch: 'none' } })).not.toContain('<g id="rock"');
    expect(D.renderDungeonSvg({ ...d, style: { ...d.style, hatch: 'full' } })).toMatch(/<g id="rock"><rect [^>]*url\(#hatch\)/);
    expect(D.renderDungeonSvg(d)).toBe(svg);
  });
});
