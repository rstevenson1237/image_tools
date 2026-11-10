// What setting_builder's report on designing levels asked of the drawing (R9, R10, R15, R17).
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';
import * as S from '../settlement/index.ts';
import * as M from '../map/index.ts';

const room = (over: Partial<D.Room> & { id: string }): D.Room => ({ shape: 'rect', x: 2, y: 2, w: 6, h: 4, ...over });
const make = (over: Partial<D.DungeonSpec> = {}) => D.newDungeon('t', { cols: 30, rows: 20, rooms: [room({ id: 'a' })], ...over });

describe('R9 colours: the hatch takes the rock\'s colour, and presets keep the walls between rooms', () => {
  test('a palette rock colours the hatching; without one the hatching stays in the ink', () => {
    const sand = D.renderDungeonSvg(make({ style: { hatch: 'band', band: 0.9, wall: 1, palette: { rock: '#c2a46b' } } }));
    expect(sand).toMatch(/<pattern id="hatch"[^>]*><path[^>]*stroke="#c2a46b"/);
    expect(D.renderDungeonSvg(make())).toMatch(/<pattern id="hatch"[^>]*><path[^>]*stroke="#000000"/);
  });
  test('dark and blueprint draw the walls between touching rooms at a full weight, and in the ink where the walls take the rock\'s colour', () => {
    const rooms = [room({ id: 'a' }), room({ id: 'b', x: 8 })];
    for (const preset of ['dark', 'blueprint'] as const) {
      const s = make({ rooms, style: { preset } as D.DungeonSpec['style'] });
      expect(s.style.partition).toBe(1);
      const p = D.paletteOf(s), out = D.renderDungeonSvg(s);
      expect(p.partition).toBe(preset === 'blueprint' ? '#17366b' : '#000000');
      expect(out).toMatch(new RegExp(`<path id="partitions" d="[^"]+" stroke="${p.partition}" stroke-width="6.2"`));
    }
    // a palette may still name the partition colour itself
    expect(D.paletteOf(make({ style: { hatch: 'none', band: 0.9, wall: 1, palette: { partition: '#ff0000' } } })).partition).toBe('#ff0000');
  });
});

describe('R15 the band beside the map: readable in light ink, and a long legend in columns', () => {
  test('light ink puts the title, scale bar and legend on the rock\'s colour (or a paper the palette names)', () => {
    const light = { hatch: 'none', band: 0.9, wall: 1, rock: 'solid', palette: { rock: '#1e1e1e', ink: '#e8dcc0', floor: '#5a4a3a' } } as const;
    expect(D.paletteOf(make({ style: light })).paper).toBe('#1e1e1e');
    expect(D.paletteOf(make({ style: { ...light, palette: { ...light.palette, paper: '#202830' } } })).paper).toBe('#202830');
    expect(D.paletteOf(make()).paper).toBe('#ffffff');
    const out = D.renderDungeonSvg(make({ title: 'Deep', style: light, furniture: { place: 'outside' } }));
    expect(out).toMatch(/<g id="title"><rect[^>]*fill="#1e1e1e"[^>]*\/><text[^>]*fill="#e8dcc0"/);
  });
  test('thirty symbols make a legend in columns no taller than about a third of the map', () => {
    const kinds = Object.keys(D.SYMBOLS).slice(0, 30);
    const s = make({ cols: 40, rows: 40, legend: true, overlay: { labels: [], symbols: kinds.map((kind, i) => ({ kind, x: 2 + (i % 10) * 3, y: 2 + Math.floor(i / 10) * 3 })) } });
    const legend = D.dungeonFurniture(s).placed.find(p => p.item.id === 'legend')!.item;
    expect(legend.h).toBeLessThan(40 * 40 * 0.4);
    expect(legend.w).toBeGreaterThan(190);
  });
});

describe('R10 a settlement drawn in black and white draws its ground in black and white', () => {
  test('the terrain underlay follows the theme', () => {
    const map = M.newMap('m', 'regional', { cols: 40, rows: 40 });
    const s = S.parseSettlement({ ...S.newSettlement('s', 'village', { cols: 20, rows: 20 }), underlay: { map: 'm', origin: [4, 4], scale: 1 } });
    const bw = S.renderSettlementSvg(s, { theme: 'bw', underlay: { map } }), colour = S.renderSettlementSvg(s, { underlay: { map } });
    const fills = (svg: string) => new Set([...(svg.match(/<g id="underlay">.*?<\/g><\/svg><\/g>/s)?.[0] ?? svg).matchAll(/fill="(#[0-9a-f]{6})"/gi)].map(m => m[1].toLowerCase()));
    const grey = (c: string) => c.slice(1, 3) === c.slice(3, 5) && c.slice(3, 5) === c.slice(5, 7);
    expect([...fills(bw)].every(grey)).toBe(true);
    expect([...fills(colour)].some(c => !grey(c))).toBe(true);
  });
});

describe('R17 passages meet rooms square on, and ends on one wall are spread', () => {
  const spec = () => D.newDungeon('m', {
    cols: 40, rows: 30, rooms: [room({ id: 'A', shape: 'circle', x: 4, y: 4, w: 10, h: 10 }), room({ id: 'B', x: 24, y: 4, w: 6, h: 6 }), room({ id: 'C', x: 24, y: 16, w: 6, h: 6 }), room({ id: 'R', x: 4, y: 20, w: 10, h: 6 }), room({ id: 'S', x: 22, y: 26, w: 2, h: 2 })],
    corridors: [
      { from: { room: 'A' }, to: { room: 'B' }, width: 2, via: [19, 7], doors: ['door', 'door'] },
      { from: { room: 'A' }, to: { room: 'C' }, width: 2, via: [19, 11, 19, 19], doors: ['door', 'door'] },
      { from: { room: 'R', side: 'e' }, to: { room: 'C' }, width: 2, doors: ['door', null] },
      { from: { room: 'R', side: 'e' }, to: { room: 'S' }, width: 2, doors: ['door', null] },
    ],
  });
  test('a passage with bends leaves a round room level with its first bend, not on a slant from the centre', () => {
    const l = D.layoutDungeon(spec());
    expect(l.corridors[0].pts.slice(0, 4)).toEqual([9, 7, 19, 7]);
    expect(l.corridors[1].pts.slice(0, 4)).toEqual([9, 11, 19, 11]);
    const [a, b] = [l.corridors[0].ends[0]!, l.corridors[1].ends[0]!];
    expect(Math.abs(a.y - b.y)).toBeCloseTo(4);
  });
  test('two ends on one wall with no offset are spread along it, nearer end first; check finds no stacked doors', () => {
    const s = spec(), l = D.layoutDungeon(s), ys = [l.corridors[2].ends[0]!.y, l.corridors[3].ends[0]!.y];
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(2);
    expect(D.lintDungeon(s).map(f => f.id)).not.toContain('doors-stacked');
    // an end with an offset keeps it
    const fixed = { ...s, corridors: s.corridors.map((c, i) => (i === 2 ? { ...c, from: { room: 'R', side: 'e' as const, offset: 1 } } : c)) };
    expect(D.layoutDungeon(fixed).corridors[2].ends[0]!.y).toBe(21);
  });
});

describe('the layout from a graph, as setting_builder asked (R2, R3, R5, R11, R12, R13, R14, R16)', () => {
  const ids = (s: D.DungeonSpec) => D.lintDungeon(s).map(f => f.id);
  const five = (over: Partial<D.Graph> = {}): D.Graph => ({
    id: 'g', width: 2, seed: 2, tries: 3,
    rooms: [{ id: 'A', w: 6, h: 4 }, { id: 'B', w: 4, h: 4 }, { id: 'C', w: 6, h: 6 }, { id: 'D', w: 4, h: 6 }, { id: 'E', w: 4, h: 4 }],
    ways: [{ a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'E' }, { a: 'E', b: 'A' }],
    ...over,
  });

  test('R5 pad: rooms keep apart, so every way is a passage long enough for its doors', () => {
    const { spec, report } = D.layoutGraph(five({ pad: 2 }));
    expect(report.left).toEqual([]);
    expect(report.walls).toBe(0);
    expect(report.passages).toBe(5);
    expect(report.gaps.least).toBeGreaterThanOrEqual(4);
    expect(ids(spec).filter(i => ['doors-stacked', 'door-off-wall', 'way-no-passage'].includes(i))).toEqual([]);
    // the rooms are drawn at their own size, not grown by the pad
    expect(spec.rooms.map(r => [r.w, r.h])).toEqual([[6, 4], [4, 4], [6, 6], [4, 6], [4, 4]]);
    // a room's own pad of 0 lets it touch
    const touch = D.layoutGraph(five({ pad: 2, rooms: five().rooms.map(r => (r.id === 'A' || r.id === 'B' ? { ...r, pad: 0 } : r)), passages: 0 })).report;
    expect(touch.left).toEqual([]);
  }, 60_000);

  test('R14 caves: doors stand on the drawn outline, so check finds every way drawn', () => {
    const g = five({ rooms: five().rooms.map(r => ({ ...r, shape: 'cave' as const, w: r.w + 2, h: r.h + 2 })), passages: 0 });
    const { spec, report } = D.layoutGraph(g);
    expect(report.left).toEqual([]);
    expect(spec.connections).toEqual([]);
    expect(ids(spec)).not.toContain('way-no-passage');
    expect(ids(spec)).not.toContain('port-outside-room');
    const l = D.layoutDungeon(spec);
    for (const c of l.corridors) for (const e of c.ends) {
      const room = l.rooms.find(r => D.inPolygon(r.outline, e!.x + Math.cos((e!.angle * Math.PI) / 180) * -0.2, e!.y + Math.sin((e!.angle * Math.PI) / 180) * -0.2));
      expect(room).toBeDefined();
    }
  }, 60_000);

  test('R11 rooms that stand at a place stay there, and a way with bends is drawn as given', () => {
    const g: D.Graph = {
      id: 'fixed', width: 2, footprint: 40, tries: 2,
      rooms: [{ id: 'A', w: 6, h: 6, at: { x: 2, y: 2 } }, { id: 'B', w: 6, h: 6, at: { x: 30, y: 2 } }, { id: 'C', w: 6, h: 6, at: { x: 30, y: 30 } }, { id: 'F', w: 4, h: 4 }],
      ways: [{ a: 'A', b: 'B', via: [19, 5, 19, 5] }, { a: 'B', b: 'C' }, { a: 'C', b: 'F' }],
    };
    const { spec, report } = D.layoutGraph(g);
    expect(report.left).toEqual([]);
    const at = (id: string) => spec.rooms.find(r => r.id === id)!;
    expect([at('A').x, at('A').y, at('B').x, at('C').y]).toEqual([4, 4, 32, 32]);
    const given = spec.corridors.find(c => 'room' in c.from && c.from.room === 'A')!;
    expect(given.via).toEqual([21, 7, 21, 7]);
    expect(report.places.find(p => p.id === 'A')).toEqual({ id: 'A', x: 2, y: 2, w: 6, h: 6, cx: 5, cy: 5 });
    expect(D.validateGraph({ ...g, ways: [{ a: 'A', b: 'F', via: [1, 1] }] })).toEqual(['ways[0].via: a way drawn as given joins two rooms that stand at a place (at)']);
    expect(D.validateGraph({ ...g, rooms: [{ id: 'A', w: 6, h: 6, at: { x: 3, y: 2 } }], ways: [] })).toEqual(['rooms[0].at: on the lattice (x and y multiples of the width, 2)']);
  }, 60_000);

  test('R3 with no footprint, a pinned room is solved in the frame it was given in, and the report says where the square fell', () => {
    const g = five({ rooms: five().rooms.map(r => (r.id === 'C' ? { ...r, over: { x: 102, y: 202, w: 2, h: 2 } } : r)) });
    const { report } = D.layoutGraph(g);
    expect(report.left).toEqual([]);
    const c = report.places.find(p => p.id === 'C')!;
    expect(Math.abs(c.cx - 103)).toBeLessThan(4);
    expect(Math.abs(c.cy - 203)).toBeLessThan(4);
    expect(report.origin[0]).toBeGreaterThan(60);
    // a given origin moves the frame the same way, for a sized footprint
    const fixed = D.layoutGraph({ ...g, footprint: 30, origin: [90, 190] }).report;
    expect(fixed.origin).toEqual([90, 190]);
    expect(Math.abs(fixed.places.find(p => p.id === 'C')!.cx - 103)).toBeLessThan(4);
  }, 60_000);

  test('R12 places: a room an odd number of cells wide has a whole-cell corner to hold', () => {
    const { report } = D.layoutGraph(five({ rooms: five().rooms.map(r => (r.id === 'A' ? { ...r, w: 5 } : r)), width: 1 }));
    const a = report.places.find(p => p.id === 'A')!;
    expect(Number.isInteger(a.x)).toBe(true);
    expect(a.cx - a.x).toBe(2.5);
  }, 60_000);

  test('R2 a held bearing and a line of rooms', () => {
    const held = five({ ways: five().ways.map(w => (w.a === 'A' ? { ...w, bearing: 0, hold: true } : w)) });
    const r = D.layoutGraph(held).report, a = r.places.find(p => p.id === 'A')!, b = r.places.find(p => p.id === 'B')!;
    expect(r.held).toEqual([]);
    expect(b.cy).toBeLessThan(a.cy);
    const lined = D.layoutGraph(five({ lines: [{ rooms: ['A', 'C', 'E'], along: 'ew' }], tries: 4 })).report;
    const ys = ['A', 'C', 'E'].map(id => lined.places.find(p => p.id === id)!.cy);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(2);
    expect(D.validateGraph(five({ ways: [{ a: 'A', b: 'B', hold: true }], lines: [{ rooms: ['A'], along: 'up' as 'ew' }] }))).toEqual(['ways[0].hold: holds a bearing; give one', 'lines[0].rooms: two rooms or more', 'lines[0].along: ew or ns']);
  }, 60_000);

  test('R13 partial: with no packing that routes every way, the one that routes most is written and the rest listed', () => {
    // six ways out of one small room cannot all leave it
    const g: D.Graph = { id: 'p', width: 2, footprint: 24, tries: 2, passages: 1, partial: true, rooms: [{ id: 'H', w: 2, h: 2 }, ...['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, w: 4, h: 4 }))], ways: ['a', 'b', 'c', 'd', 'e', 'f'].map(b => ({ a: 'H', b })) };
    expect(() => D.layoutGraph({ ...g, partial: false })).toThrow(/partial/);
    const { spec, report } = D.layoutGraph(g);
    expect(report.partial).toBe(true);
    expect(report.left.length).toBeGreaterThan(0);
    expect(spec.corridors.length + spec.connections!.length + report.left.length).toBe(6);
  }, 60_000);

  test('R16 what a table cannot say is carried into the map: room fields, symbols, a ring, a passage\'s curve, a wall\'s line', () => {
    const g = five({
      pad: 2, legend: true, style: { numbers: 'plain' },
      rooms: five().rooms.map(r => (r.id === 'C' ? { ...r, draw: { edge: 'wavy' as const, number: 'C1' }, symbols: [{ kind: 'altar', dy: -1 }, { kind: 'pillar', dx: 2, dy: 2 }], ring: { pad: 2, line: 'solid' as const } } : r)),
      ways: five().ways.map(w => (w.a === 'B' ? { ...w, draw: { curve: 'smooth' as const, id: 'bc' } } : w)),
    });
    const { spec } = D.layoutGraph(g), c = spec.rooms.find(r => r.id === 'C')!;
    expect(c).toMatchObject({ edge: 'wavy', number: 'C1' });
    expect(spec.overlay.symbols.map(s => [s.kind, s.x - (c.x + c.w / 2), s.y - (c.y + c.h / 2)])).toEqual([['altar', 0, -1], ['pillar', 2, 2]]);
    expect(spec.rings).toEqual([{ shape: 'circle', at: [c.x + 3, c.y + 3], r: 5, line: 'solid' }]);
    expect(spec.corridors.find(k => k.id === 'bc')).toMatchObject({ curve: 'smooth' });
    expect(spec.legend).toBe(true);
    expect(spec.style.numbers).toBe('plain');
    expect(D.validateGraph(five({ rooms: [{ id: 'A', w: 2, h: 2, draw: { x: 3 } as D.RoomDraw }], ways: [] }))[0]).toMatch(/rooms\[0\]\.draw\.x: one of number, fill/);
  }, 60_000);
});

describe('R5 check: passages from one room that cross or run together', () => {
  const rooms = [room({ id: 'A', x: 2, y: 8, w: 4, h: 4 }), room({ id: 'B', x: 24, y: 2, w: 4, h: 4 }), room({ id: 'C', x: 24, y: 16, w: 4, h: 4 })];
  const base = (corridors: D.Corridor[]) => D.newDungeon('t', { cols: 32, rows: 24, rooms, corridors });
  test('a crossing and a shared run are found; spokes apart are not', () => {
    const crossing = base([{ from: { room: 'A', side: 'e', offset: 1 }, to: { room: 'C' }, via: [14, 9, 14, 18] }, { from: { room: 'A', side: 'e', offset: 3 }, to: { room: 'B' }, via: [10, 11, 10, 4] }]);
    expect(D.lintDungeon(crossing).filter(f => f.id === 'passages-tangle').map(f => f.message)).toEqual([expect.stringMatching(/^crosses corridor 0/)]);
    const trunk = base([{ from: { room: 'A', side: 'e' }, to: { room: 'B' }, via: [16, 10, 16, 4] }, { from: { room: 'A', side: 'e' }, to: { room: 'C' }, via: [16, 10, 16, 18] }]);
    expect(D.lintDungeon({ ...trunk, corridors: trunk.corridors.map(c => ({ ...c, from: { room: 'A', side: 'e' as const, offset: 2 } })) }).filter(f => f.id === 'passages-tangle').map(f => f.message)).toEqual([expect.stringMatching(/^runs together with corridor 0, .* for \d+\.\d cells/)]);
    const spokes = base([{ from: { room: 'A', side: 'n' }, to: { room: 'B' } }, { from: { room: 'A', side: 's' }, to: { room: 'C' } }]);
    expect(D.lintDungeon(spokes).map(f => f.id)).not.toContain('passages-tangle');
  });
});

describe('R5 candidates: seeds laid out, scored and shown side by side', () => {
  test('the best score first, each with its findings, and a contact sheet of them', () => {
    const g: D.Graph = { id: 'c', width: 2, tries: 2, pad: 2, rooms: [{ id: 'A', w: 6, h: 4 }, { id: 'B', w: 4, h: 4 }, { id: 'C', w: 6, h: 6 }, { id: 'D', w: 4, h: 6 }], ways: [{ a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'A' }] };
    const { ranked, failed } = D.layoutCandidates(g, 3);
    expect(ranked.length + failed.length).toBe(3);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    expect(ranked[0].score).toBe(D.scoreLayout(ranked[0].spec, ranked[0].report).score);
    const sheet = D.contactSheetSvg(ranked);
    expect(sheet).toContain(`seed ${ranked[0].seed} · ${ranked[0].score}`);
    expect(sheet).toContain('id="c0-map-clip"');
    expect(sheet).not.toMatch(/url\(#map-clip\)/);
  }, 60_000);
});

describe('spokes: passages from one room keep apart where they can', () => {
  test('two passages from A to rooms on the far side share a run by default, and keep apart with a cost on sharing', async () => {
    const R = await import('./router.ts');
    const box = (x: number, y: number, w: number, h: number) => new R.Footprint(x, y, w, h, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
    const rooms = new Map([['A', box(0, 30, 20, 40)], ['B', box(400, 0, 20, 20)], ['C', box(400, 60, 20, 20)]]);
    const shared = (share?: number) => {
      const { routes, left } = R.plan(rooms, [['A', 'B'], ['A', 'C']], { seed: 1, clearance: 0, share });
      expect(left).toEqual([]);
      const cells = routes.map(r => new Set(r.cells.map(c => c.join(','))));
      return [...cells[0]].filter(c => cells[1].has(c)).length;
    };
    expect(shared()).toBeGreaterThan(2);
    expect(shared(3)).toBe(0);
  });
});

describe('R5 the rest: the most a gap should be, and the hull as an unbounded level\'s outline', () => {
  const g = (over: Partial<D.Graph> = {}): D.Graph => ({
    id: 'h', width: 2, seed: 4, tries: 2, pad: 2,
    rooms: [{ id: 'A', w: 6, h: 4 }, { id: 'B', w: 4, h: 4 }, { id: 'C', w: 6, h: 6 }, { id: 'D', w: 4, h: 6 }, { id: 'E', w: 4, h: 4 }],
    ways: [{ a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'E' }, { a: 'E', b: 'A' }], ...over,
  });
  test('bounds: hull draws the level\'s outline round what it holds, and check finds nothing outside it', () => {
    const { spec, report } = D.layoutGraph(g({ bounds: 'hull' }));
    expect(report.hull.length).toBeGreaterThanOrEqual(8);
    expect(spec.bounds!.length).toBe(report.hull.length);
    expect(D.lintDungeon(spec).map(f => f.id)).not.toContain('outside-bounds');
    const square = D.layoutGraph(g()).spec.bounds!;
    expect(square.length).toBe(8);
  }, 60_000);
  test('reach: joined rooms kept within it where they can be', () => {
    const near = D.layoutGraph(g({ reach: 6, footprint: 60 })).report.gaps, far = D.layoutGraph(g({ reach: 60, footprint: 60 })).report.gaps;
    expect(near.median).toBeLessThanOrEqual(8);
    expect(near.median).toBeLessThanOrEqual(far.median);
    expect(D.validateGraph(g({ reach: 0, bounds: 'round' as 'hull' }))).toEqual(['reach: cells, above 0', 'bounds: square or hull']);
  }, 60_000);
});
