// Style and drawing features from the issues filed after R9 (#46, #47, #48, #50, #51, #53, #54, #55).
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';

const room = (over: Partial<D.Room> & { id: string }): D.Room => ({ shape: 'rect', x: 2, y: 2, w: 6, h: 4, ...over });
const make = (over: Partial<D.DungeonSpec> = {}) => D.newDungeon('t', { cols: 30, rows: 20, rooms: [room({ id: 'a' })], ...over });
const svg = (s: D.DungeonSpec, o: D.RenderDungeonOptions = {}) => D.renderDungeonSvg(s, o);

describe('#50 style presets', () => {
  test('a preset fills what the file leaves out, and the file wins', () => {
    const s = make({ style: { preset: 'dark' } as D.DungeonSpec['style'] });
    expect(s.style).toMatchObject({ hatch: 'none', rock: 'solid', wall: 0.3, numbers: 'plain', preset: 'dark' });
    expect(s.grid).toMatchObject({ size: 1, sub: false });
    const own = make({ style: { preset: 'dark', wall: 1.5, palette: { floor: '#eeeeee' } } as D.DungeonSpec['style'] });
    expect(own.style.wall).toBe(1.5);
    expect(own.style.palette).toEqual({ rock: '#3a3a40', floor: '#eeeeee' });
    expect(own.style.hatch).toBe('none');
  });
  test('a preset is a name from the list', () => {
    expect(() => make({ style: { preset: 'neon' } as unknown as D.DungeonSpec['style'] })).toThrow(/style.preset: dark, blueprint/);
    expect(D.PRESET_NAMES).toEqual(['dark', 'blueprint']);
  });
  test('a file that sets nothing draws as before', () => {
    const s = make();
    expect(s.style).toEqual({ hatch: 'band', band: 0.9, wall: 1 });
    expect(svg(s)).not.toContain('#3a3a40');
  });
});

describe('#54 palette', () => {
  const s = make({
    style: { hatch: 'none', band: 0.9, wall: 1, rock: 'solid', palette: { rock: '#3d6bb3', wall: '#3d6bb3', ink: '#17366b', grid: '#8fb2e6', floor: '#fafcff' } },
    rooms: [room({ id: 'a', number: 1, label: 'Hall' }), room({ id: 'b', x: 12 })],
    corridors: [{ from: { room: 'a' }, to: { room: 'b' }, doors: ['door', 'secret'] }],
    overlay: { labels: [{ text: 'x', x: 5, y: 10, kind: 'note' }], symbols: [{ kind: 'altar', x: 5, y: 4 }] },
  });
  const out = svg(s);
  test('rock, walls, floor, grid and ink each take their colour', () => {
    expect(out).toContain('<rect width="1200" height="800" fill="#3d6bb3"/>');
    expect(out).toMatch(/<g id="walls"><path[^>]*fill="#3d6bb3"/);
    expect(out).toMatch(/<g id="floor"><path[^>]*fill="#fafcff"/);
    expect(out).toMatch(/<g id="grid"[^>]*>.*stroke="#8fb2e6" stroke-opacity="1"/);
    expect(out).toMatch(/<g id="symbols">.*#17366b/);
    expect(out).toMatch(/<g id="doors">.*#17366b/);
  });
  test('the default is still black and white, and rockColor still sets the rock', () => {
    const plain = svg(make({ style: { hatch: 'none', band: 0.9, wall: 1, rock: 'solid', rockColor: '#a0a0a0' } }));
    expect(plain).toContain('fill="#a0a0a0"');
    expect(plain).not.toContain('#17366b');
    expect(D.paletteOf(make())).toMatchObject({ ink: '#000000', wall: '#000000', floor: '#ffffff', paper: '#ffffff', rock: '#bdbdbd' });
  });
  test('a colour is #rrggbb, and a key is one of the seven', () => {
    expect(() => make({ style: { hatch: 'none', band: 1, wall: 1, palette: { ink: 'blue' } } })).toThrow(/style.palette.ink: a colour #rrggbb/);
    expect(() => make({ style: { hatch: 'none', band: 1, wall: 1, palette: { roof: '#ffffff' } as D.Palette } })).toThrow(/style.palette.roof: one of rock, floor, ink, grid, wall, paper, partition/);
  });
});

describe('#48 plain and keyed room numbers', () => {
  test('a key such as 15a is kept as written and takes no number from the rooms after it', () => {
    const s = make({ rooms: [room({ id: 'a' }), room({ id: 'b', x: 10, number: '15a' }), room({ id: 'c', x: 18 })] });
    expect(D.layoutDungeon(s).rooms.map(g => g.number)).toEqual([1, '15a', 2]);
    expect(svg(s)).toContain('>15a</text>');
    expect(D.dungeonFacts(s).rooms.map(r => r.number)).toEqual([1, '15a', 2]);
  });
  test('a key has no spaces and is short; false still hides', () => {
    expect(() => make({ rooms: [room({ id: 'a', number: 'a b' })] })).toThrow(/rooms\[0\].number: a number, a key/);
    expect(D.layoutDungeon(make({ rooms: [room({ id: 'a', number: false })] })).rooms[0].number).toBeUndefined();
  });
  test('plain numbers are bold numerals with no badge', () => {
    const badge = svg(make({ rooms: [room({ id: 'a', number: 7 })] })), plain = svg(make({ style: { numbers: 'plain' } as D.DungeonSpec['style'], rooms: [room({ id: 'a', number: 7 })] }));
    expect(badge).toMatch(/<g id="numbers"><rect/);
    expect(plain).not.toMatch(/<g id="numbers"><rect/);
    expect(plain).toMatch(/<g id="numbers">.*>7<\/text>/);
  });
});

describe('#51 wall weight and #53 dashed walls', () => {
  const two = (c: Partial<D.Connection> = {}, a: Partial<D.Room> = {}, b: Partial<D.Room> = {}) =>
    make({ rooms: [room({ id: 'a', ...a }), room({ id: 'b', x: 8, ...b })], connections: [{ a: 'a', b: 'b', ...c }] });
  const wall = (s: D.DungeonSpec) => D.layoutDungeon(s).partitionStyle;
  test('a connection\'s weight and line set the wall its rooms share', () => {
    expect(wall(two())).toEqual([expect.anything(), expect.anything()].map(() => null));
    expect(wall(two({ weight: 0.4 })).every(p => p?.weight === 0.4)).toBe(true);
    expect(wall(two({ line: 'dashed' })).every(p => p?.dashed === true)).toBe(true);
    expect(D.layoutDungeon(two({ line: 'none' })).partitions).toEqual([]);
  });
  test('the opening stays cut out of a dashed wall, and the render draws it dashed and at its weight', () => {
    const s = two({ line: 'dashed', weight: 0.5, kind: 'open' }), out = svg(s);
    expect(out).toMatch(/<path id="partitions[^"]*" d="[^"]*" stroke="#000000" stroke-width="3\.1" stroke-linecap="butt" stroke-dasharray=/);
  });
  test('a room\'s partition sets the walls it shares; the thinner of two wins; a connection wins over both', () => {
    expect(wall(two({}, { partition: 2 }))[0]?.weight).toBe(2);
    expect(wall(two({}, { partition: 2 }, { partition: 0.5 }))[0]?.weight).toBe(0.5);
    expect(wall(two({ weight: 3 }, { partition: 2 }))[0]?.weight).toBe(3);
  });
  test('weights are bounded', () => {
    expect(() => two({ weight: 9 })).toThrow(/connections\[0\].weight: 0.2..4/);
    expect(() => two({ line: 'wavy' as D.WallLine })).toThrow(/connections\[0\].line: solid, dashed, none/);
  });
});

describe('#46 double doors, doors in a run, a square glyph', () => {
  const run = (midDoors: D.Corridor['midDoors'], doors: D.Corridor['doors'] = [null, null]) => make({
    rooms: [room({ id: 'a' }), room({ id: 'b', x: 20 })],
    corridors: [{ from: { room: 'a' }, to: { room: 'b' }, width: 2, doors, midDoors }],
  });
  test('a double door is two leaves across the corridor', () => {
    const out = svg(run(undefined, ['double', null]));
    expect(out.match(/<g id="doors">.*?<\/g><\/g>/s)![0].match(/<rect/g)).toHaveLength(2);
    expect(svg(run(undefined, ['door', null])).match(/<g id="doors">.*?<\/g><\/g>/s)![0].match(/<rect/g)).toHaveLength(1);
  });
  test('a door stands in the run at a distance, or at the point on it nearest a given one', () => {
    const s = run([{ at: 4, kind: 'door' }, { at: [13.1, 9], kind: 'double' }]);
    const l = D.layoutDungeon(s), mids = l.doors.filter(d => d.mid);
    expect(mids.map(d => [d.kind, d.x, d.y, d.angle, d.width])).toEqual([['door', 9, 4, 0, 2], ['double', 13.1, 4, 0, 2]]);
    expect(D.lintDungeon(s).filter(f => f.id === 'door-off-wall')).toEqual([]);
    const f = D.dungeonFacts(s).doors.filter(d => d.on === 'open');
    expect(f).toHaveLength(2);
  });
  test('a door in a run needs a kind and a place', () => {
    expect(() => run([{ at: -1, kind: 'door' }])).toThrow(/midDoors\[0\].at/);
    expect(() => run([{ at: 2, kind: 'trapdoor' as D.DoorKind }])).toThrow(/midDoors\[0\].kind/);
  });
  test('the square glyph draws squares with a jamb each side', () => {
    const out = svg(make({ style: { doors: 'square' } as D.DungeonSpec['style'], rooms: [room({ id: 'a' }), room({ id: 'b', x: 20 })], corridors: [{ from: { room: 'a' }, to: { room: 'b' }, doors: ['door', null] }] }));
    expect(out.match(/<g id="doors">.*?<\/g><\/g>/s)![0].match(/<rect/g)).toHaveLength(3);
  });
});

describe('#47 and #55 symbols', () => {
  const sym = (s: Partial<D.DungeonSymbol> & { kind: string }) => make({ overlay: { labels: [], symbols: [{ x: 4, y: 4, ...s }] } });
  test('the new kinds are listed and draw', () => {
    for (const kind of ['spiral-stair', 'pit-filled', 'pool-filled', 'arch-stair', 'curved-arrow']) {
      expect(D.SYMBOL_KINDS).toContain(kind);
      expect(svg(sym({ kind }))).toMatch(/<g id="symbols"><g transform="translate\(160 160\)[^"]*"><(circle|path|g)/);
    }
  });
  test('stairs take a width and a length', () => {
    expect(svg(sym({ kind: 'stairs', scaleX: 0.8, scaleY: 4 }))).toContain('scale(1.600 8.000)');
    expect(svg(sym({ kind: 'stairs', scale: 2 }))).toContain('scale(4.000)');
    expect(D.symbolScale({ scale: 2, scaleX: 0.5 })).toEqual([1, 2]);
  });
  test('a curved arrow turns by its sweep, either way round', () => {
    const cw = svg(sym({ kind: 'curved-arrow' })), ccw = svg(sym({ kind: 'curved-arrow', sweep: -200 }));
    expect(cw).toMatch(/A7 7 0 0 1 /);
    expect(ccw).toMatch(/A7 7 0 1 0 /);
    expect(D.symbolSvg({ kind: 'curved-arrow', sweep: 90 }, '#000', '#fff')).not.toBe(D.symbolSvg({ kind: 'curved-arrow' }, '#000', '#fff'));
  });
  test('scale and sweep are checked', () => {
    expect(() => sym({ kind: 'stairs', scaleX: 0 })).toThrow(/symbols\[0\].scaleX: above 0/);
    expect(() => sym({ kind: 'curved-arrow', sweep: 0 })).toThrow(/sweep/);
  });
});

describe('#53 rings', () => {
  const ring = (r: Partial<D.Ring>) => make({ rings: [{ shape: 'circle', at: [10, 10], r: 5, ...r }] });
  test('a ring is a dashed line with no floor', () => {
    const s = ring({}), out = svg(s);
    expect(out).toMatch(/<g id="rings"><path d="M[^"]*Z?" fill="none" stroke="#000000" stroke-width="4.8" stroke-dasharray="20 12"/);
    expect(D.lintDungeon(s).filter(f => f.id === 'no-floor')).toEqual([]);
    expect(D.floorGrid(s, D.layoutDungeon(s)).cells.filter(v => v >= 0).length).toBe(D.floorGrid(make(), D.layoutDungeon(make())).cells.filter(v => v >= 0).length);
  });
  test('solid, a poly, a width and a dash', () => {
    expect(svg(ring({ line: 'solid' }))).not.toMatch(/<g id="rings">.*stroke-dasharray/);
    expect(svg(make({ rings: [{ shape: 'poly', points: [1, 1, 5, 1, 5, 5], width: 0.2, dash: [1, 1] }] }))).toMatch(/<g id="rings">.*stroke-width="8".*stroke-dasharray="40 40"/);
  });
  test('a ring is checked, and the layer can be turned off', () => {
    expect(() => ring({ r: 0 })).toThrow(/rings\[0\].r/);
    expect(() => make({ rings: [{ shape: 'poly', points: [1, 1] }] })).toThrow(/rings\[0\].points/);
    expect(svg(ring({}), { layers: { rings: false } })).not.toContain('id="rings"');
  });
  test('fit moves rings with the rooms, and they count as content', () => {
    const s = ring({ at: [20, 15] });
    expect(D.contentBox(s)![2]).toBeGreaterThanOrEqual(25);
    const fitted = D.fitDungeon(s, 2);
    expect(fitted.rings![0].at![0] - 2).toBeLessThan(20);
  });
});

describe('#55 wavy edging', () => {
  test('a room\'s walls get a wavy line, all sides or the ones listed', () => {
    const one = (r: Partial<D.Room>) => make({ rooms: [room({ id: 'a', ...r })] });
    const all = D.wavyEdges({ edge: 'wavy' }, D.roomOutline(one({}).rooms[0])), top = D.wavyEdges({ edge: 'wavy', edgeSides: ['n'] }, D.roomOutline(one({}).rooms[0]));
    expect(all).toHaveLength(4);
    expect(top).toHaveLength(1);
    // inside the room, along the north wall
    expect(Math.min(...top[0].filter((_, i) => i % 2 === 1))).toBeGreaterThan(2);
    expect(Math.max(...top[0].filter((_, i) => i % 2 === 1))).toBeLessThan(2.5);
    expect(svg(one({ edge: 'wavy', edgeSides: ['n', 's'] }))).toMatch(/<g id="edging"[^>]*><path d="M/);
    expect(svg(one({}))).not.toContain('id="edging"');
  });
  test('a round room is edged all the way round', () => {
    const r = room({ id: 'c', shape: 'circle', w: 6, h: 6, edge: 'wavy' });
    const runs = D.wavyEdges(r, D.roomOutline(r));
    // one run for each quarter, the whole way round
    expect(runs).toHaveLength(4);
    expect(runs.reduce((n, l) => n + l.length / 2, 0)).toBeGreaterThan(60);
  });
  test('edging is checked', () => {
    expect(() => make({ rooms: [room({ id: 'a', edge: 'frilly' as 'wavy' })] })).toThrow(/rooms\[0\].edge: wavy/);
    expect(() => make({ rooms: [room({ id: 'a', edgeSides: ['n'] })] })).toThrow(/edgeSides: goes with edge/);
  });
});
