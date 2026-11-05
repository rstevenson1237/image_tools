// Fixes from the issues filed after R9 (#44, #45, #49, #52, #56): exit notes on the floor, exits sharing a wall, hints in checks, thin shapes.
import { describe, expect, test } from 'vitest';
import { textBox } from 'artgen-primitives/lib/page.ts';
import * as D from './index.ts';

const base = (over: Partial<D.DungeonSpec> = {}) => D.newDungeon('t', { cols: 30, rows: 24, numbers: false, ...over });
const room = (over: Partial<D.Room> & { id: string }): D.Room => ({ shape: 'rect', x: 4, y: 4, w: 2, h: 4, ...over });
const noteBox = (m: { text: string; x: number; y: number }) => textBox(m.text, m.x, m.y + (12 / 40) * 0.35, 12 / 40, { bold: false });

describe('#44 a room exit\'s note stays on the room\'s floor', () => {
  test.each([['n'], ['e'], ['s'], ['w']] as const)('a note by the %s wall of a room 2 cells wide lies inside the room', side => {
    const s = base({ rooms: [room({ id: 'a', exits: [{ kind: 'stairs-up', side, text: 'Up to the old library' }] })] });
    const l = D.layoutDungeon(s), marks = D.fileMarks(s, l).labels;
    expect(marks.length).toBeGreaterThan(1); // too wide for the room: broken into lines
    for (const { mark } of marks) {
      const b = noteBox(mark);
      for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y + b.h]]) expect(D.inPolygon(l.rooms[0].outline, x, y)).toBe(true);
    }
    expect(D.lintDungeon(s).filter(f => f.id === 'note-off-floor')).toEqual([]);
  });

  test('a note that fits is one line, centred on its mark but moved off the wall', () => {
    const s = base({ rooms: [room({ id: 'a', w: 6, h: 4, exits: [{ kind: 'arrow', side: 'e', text: 'To the vault' }] })] });
    const [{ mark }] = D.fileMarks(s, D.layoutDungeon(s)).labels;
    expect(D.fileMarks(s, D.layoutDungeon(s)).labels).toHaveLength(1);
    expect(noteBox(mark).x + noteBox(mark).w).toBeLessThan(10);
  });

  test('a note a room is too narrow for is reported', () => {
    const s = base({ rooms: [room({ id: 'a', w: 1, h: 4, exits: [{ kind: 'arrow', side: 'e', text: 'Extraordinarily' }] })] });
    expect(D.lintDungeon(s).find(f => f.id === 'note-off-floor')).toMatchObject({ severity: 'warning', path: 'rooms[0].exits[0]' });
  });
});

describe('#45 exits on one wall are spread along it', () => {
  test('two exits on the east wall of a room 2 × 4 get different marks, and notes inside the room', () => {
    const s = base({ rooms: [room({ id: 'h', exits: [{ kind: 'stairs-up', side: 'e', text: 'Up to G.19' }, { kind: 'stairs-up', side: 'e', text: 'Up to B.10' }] })] });
    const l = D.layoutDungeon(s), m = D.fileMarks(s, l);
    expect(m.symbols[0].mark.y).not.toBeCloseTo(m.symbols[1].mark.y, 1);
    expect(Math.hypot(m.symbols[0].mark.x - m.symbols[1].mark.x, m.symbols[0].mark.y - m.symbols[1].mark.y)).toBeGreaterThan(1.5);
    for (const { mark } of m.labels) { const b = noteBox(mark); expect(D.inPolygon(l.rooms[0].outline, b.x, b.y)).toBe(true); expect(D.inPolygon(l.rooms[0].outline, b.x + b.w, b.y + b.h)).toBe(true); }
    expect(D.lintDungeon(s).filter(f => ['marks-overlap', 'note-off-floor', 'label-overlap'].includes(f.id))).toEqual([]);
  });

  test('three exits on a north wall share its width', () => {
    const s = base({ rooms: [room({ id: 'h', w: 9, h: 5, exits: ['a', 'b', 'c'].map(t => ({ kind: 'arrow' as const, side: 'n' as const, text: `To ${t}` })) })] });
    const xs = D.fileMarks(s, D.layoutDungeon(s)).symbols.map(m => m.mark.x);
    expect(xs).toEqual([5.5, 8.5, 11.5]);
  });

  test('exits that share a point are reported', () => {
    const s = base({ rooms: [room({ id: 'h', w: 6, exits: [{ kind: 'arrow', at: [6, 6] }, { kind: 'stairs-up', at: [6.2, 6] }] })] });
    expect(D.lintDungeon(s).find(f => f.id === 'marks-overlap')).toMatchObject({ path: 'rooms[0].exits[1]' });
  });
});

describe('#49 a point end and an offset', () => {
  const rooms = [room({ id: 'r', x: 4, y: 4, w: 10, h: 8 }), room({ id: 'c', shape: 'circle', x: 20, y: 4, w: 6, h: 6 })];
  test('the end-in-room message says the end reaches half the width past the point', () => {
    const s = base({ rooms, corridors: [{ from: { room: 'r' }, to: { at: [10, 8] }, width: 2 }] });
    expect(D.lintDungeon(s).find(f => f.id === 'end-in-room')?.message).toMatch(/reaches half its width, 1 cell, past the point/);
  });
  test('a point on a room\'s wall that counts as inside is reported with the 0.1 cell hint', () => {
    // the left wall's own edge counts as inside the outline (the right wall's does not): both are common, and only the first was ever reported
    const left = base({ rooms, corridors: [{ from: { room: 'c' }, to: { at: [4, 8] } }] });
    expect(D.lintDungeon(left).find(f => f.id === 'end-in-room')?.message).toMatch(/on r's wall, which counts as inside it.*0\.1 cell outside/);
    const right = base({ rooms, corridors: [{ from: { room: 'c' }, to: { at: [14, 8] } }] });
    expect(D.lintDungeon(right).filter(f => f.id === 'end-in-room')).toEqual([]);
  });
  test('an offset that is kept raises nothing, one that moves does', () => {
    const ok = base({ rooms, corridors: [{ from: { room: 'r', side: 'n', offset: 5 }, to: { at: [9, 1] }, width: 2 }] });
    expect(D.lintDungeon(ok).filter(f => f.id === 'offset-moved')).toEqual([]);
    // the same file with the path laid out a cell off (as a lattice or a clash can): the centre line is not where the offset says
    const l = D.layoutDungeon(ok);
    l.corridors[0].pts = l.corridors[0].pts.map((v, i) => (i % 2 === 0 ? v - 1 : v));
    expect(D.lintDungeon(ok, l).find(x => x.id === 'offset-moved')?.message).toMatch(/offset 5 on r's north wall is x=9, but the corridor's centre line starts at x=8/);
  });
});

describe('#56 a junction chosen by distance', () => {
  // `top` is a U: its two ends run down to y=4, so the point nearest a room far below is an end of the U, not its middle
  const u = (near?: [number, number]) => base({
    rooms: [room({ id: 'ra', x: 2, y: 8, w: 4, h: 4 }), room({ id: 'rc', x: 22, y: 8, w: 4, h: 4 }), room({ id: 'rb', x: 11, y: 16, w: 4, h: 4 })],
    corridors: [
      { id: 'top', from: { room: 'ra' }, to: { room: 'rc' }, via: [4, 2, 24, 2] },
      { id: 'cen', from: { corridor: 'top', ...(near && { near }) }, to: { room: 'rb' }, route: 'straight' },
    ],
  });
  test('with no near, a junction at a corner of the other corridor is reported with the way to fix it', () => {
    const f = D.lintDungeon(u()).find(x => x.id === 'junction-at-bend');
    expect(f).toMatchObject({ severity: 'warning', path: 'corridors[1].from' });
    expect(f?.message).toMatch(/set `near`/);
  });
  test('near keeps the junction on a run, and the check is quiet', () => {
    expect(D.lintDungeon(u([13, 2])).filter(f => f.id === 'junction-at-bend')).toEqual([]);
  });
  test('through-room names the junction when the corridor starts at one', () => {
    const s = u();
    s.rooms.push(room({ id: 'mid', x: 11, y: 9, w: 4, h: 4 }));
    const f = D.lintDungeon(s).find(x => x.id === 'through-room');
    expect(f?.message).toMatch(/starts at a junction on top.*`near`/);
  });
});

describe('#52 thin shapes', () => {
  const thin = [5, 5, 8, 5, 8, 5.2, 5, 5.2];
  test('a poly takes its box from its points, however thin', () => {
    const s = base({ rooms: [{ id: 'arc', shape: 'poly', points: thin, x: 5, y: 5, w: 3, h: 0.2 }] });
    expect(s.rooms[0]).toMatchObject({ w: 3, h: 0.2 });
    expect(D.polyBox(thin)).toMatchObject({ w: 3, h: expect.closeTo(0.2, 5) });
    const noBox = D.parseDungeon({ ...s, rooms: [{ id: 'arc', shape: 'poly', points: thin }] });
    expect(noBox.rooms[0].h).toBeCloseTo(0.2, 5);
  });
  test('a rect still needs a cell', () => {
    expect(() => base({ rooms: [room({ id: 'x', w: 0.5 })] })).toThrow(/at least 1 cell/);
  });
  test('almost no floor is a warning, no floor at all an error', () => {
    const s = base({ rooms: [{ id: 'arc', shape: 'poly', points: [5, 5, 8, 5, 8, 5.04, 5, 5.04], x: 5, y: 5, w: 3, h: 0.04 }, { id: 'flat', shape: 'poly', points: [10, 10, 12, 10, 12, 10.002, 10, 10.002], x: 10, y: 10, w: 2, h: 0.002 }] });
    const f = D.lintDungeon(s).filter(x => x.id === 'no-floor');
    expect(f.map(x => `${x.severity} ${x.path}`)).toEqual(['warning rooms[0]', 'error rooms[1]']);
    expect(f[0].message).toMatch(/rings\[\]/);
  });
  test('a corridor may be 0.2 wide, and a maze corridor still needs 0.5', () => {
    const rooms = [room({ id: 'a' }), room({ id: 'b', x: 14 })];
    expect(base({ rooms, corridors: [{ from: { room: 'a' }, to: { room: 'b' }, width: 0.2 }] }).corridors[0].width).toBe(0.2);
    expect(() => base({ rooms, corridors: [{ from: { room: 'a' }, to: { room: 'b' }, width: 0.2, route: 'maze' }] })).toThrow(/maze needs a width of 0.5/);
    expect(() => base({ rooms, corridors: [{ from: { room: 'a' }, to: { room: 'b' }, width: 0.1 }] })).toThrow(/0.2\.\.6/);
  });
});
