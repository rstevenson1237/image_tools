// Dungeon additions: links on labels and rooms, furniture beside the map, corridor ends and shapes, exits off the map,
// rooms joined directly, blocks split into rooms and the dense generator.
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';

const base = (over: Partial<D.DungeonSpec> = {}) => D.newDungeon('t', { cols: 30, rows: 20, ...over });

describe('links', () => {
  test('http(s), relative paths and anchors only', () => {
    for (const ok of ['https://example.com/a?b=1#c', 'http://x.org', 'level-2.svg#M.14', '../keep/index.html', '#M.3', 'notes/room 1'.replace(' ', '%20')]) expect(D.hrefError(ok), ok).toBeNull();
    for (const bad of ['javascript:alert(1)', 'JavaScript:x', 'data:text/html,x', 'file:///etc/passwd', 'java\tscript:x', '//evil.com', 'a b', 'x"onload="y', '']) expect(D.hrefError(bad), bad).not.toBeNull();
    const s = { ...base(), rooms: [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 4, h: 4, href: 'javascript:x' }], overlay: { labels: [{ text: 'L', x: 1, y: 1, kind: 'note', href: 'data:x' }], symbols: [] } };
    expect(D.validateDungeon(s)).toEqual(['rooms[0].href: http(s) links only, not javascript:', 'overlay.labels[0].href: http(s) links only, not data:']);
  });

  test('a linked room wraps its number and name, a linked label its text; the link is escaped', () => {
    const s = base({
      rooms: [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 6, h: 4, label: 'Hall', href: 'level-2.svg#M.1&x=1' }, { id: 'b', shape: 'rect', x: 12, y: 2, w: 4, h: 4 }],
      overlay: { labels: [{ text: 'To the river', x: 20, y: 12, kind: 'note', href: 'https://example.com/river' }, { text: 'Plain', x: 20, y: 16, kind: 'note' }], symbols: [] },
    });
    const svg = D.renderDungeonSvg(s);
    expect(svg.match(/<a href="level-2\.svg#M\.1&amp;x=1">/g)).toHaveLength(2);
    expect(svg).toMatch(/<a href="https:\/\/example\.com\/river">[^]*?To the river[^]*?<\/a>/);
    expect(svg.match(/<a /g)).toHaveLength(3);
  });
});

describe('furniture beside the map', () => {
  const room = (over: Partial<D.DungeonSpec> = {}) => base({ title: 'Crypt', compass: true, rooms: [{ id: 'a', shape: 'rect', x: 0, y: 0, w: 10, h: 6 }], ...over });
  const viewBox = (svg: string) => svg.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);

  test('over (the default) keeps the sheet size; outside adds a band below or right and frames the map', () => {
    const over = D.renderDungeonSvg(room());
    expect(viewBox(over)).toEqual([0, 0, 1200, 800]);
    const below = D.renderDungeonSvg(room({ furniture: { place: 'outside' } })), [, , w, h] = viewBox(below);
    expect(w).toBe(1200);
    expect(h).toBeGreaterThan(800);
    expect(D.dungeonRenderSize(room({ furniture: { place: 'outside' } }))).toMatchObject({ width: 1200, height: h, band: { right: 0 } });
    // every item is in the band: below the sheet's bottom edge
    for (const id of ['title', 'scale']) expect(Number(below.match(new RegExp(`<g id="${id}"><rect x="[^"]+" y="([^"]+)"`))![1]), id).toBeGreaterThan(800);
    const right = D.renderDungeonSvg(room({ furniture: { place: 'outside', side: 'right' } }));
    expect(viewBox(right)[2]).toBeGreaterThan(1200);
    expect(viewBox(right)[3]).toBe(800);
    expect(below).toContain('fill="none" stroke="#000000" stroke-width="1.5"/>');   // the map's frame
  });

  test('auto moves only what would cover a room: the title over the room goes, the scale bar in empty rock stays', () => {
    const f = D.dungeonFurniture(room({ furniture: { place: 'auto' } }));
    const where = Object.fromEntries(f.placed.map(p => [p.item.id, p.outside]));
    expect(where).toEqual({ title: true, scale: false, compass: false });
    expect(f.band.bottom).toBeGreaterThan(0);
    const clear = D.dungeonFurniture(room({ furniture: { place: 'auto' }, rooms: [{ id: 'a', shape: 'rect', x: 10, y: 6, w: 8, h: 6 }] }));
    expect(clear.placed.every(p => !p.outside)).toBe(true);
    expect(clear.band).toEqual({ right: 0, bottom: 0 });
  });

  test('a cropped render puts the band beside the window', () => {
    const s = room({ furniture: { place: 'outside' } }), size = D.dungeonRenderSize(s, { crop: [0, 0, 12, 8] });
    expect(size.width).toBe(480);
    expect(size.height).toBeGreaterThan(320);
    expect(D.validateDungeon({ ...s, furniture: { place: 'beside' } })).toEqual([expect.stringContaining('furniture:')]);
  });
});

describe('corridors: walls, junctions, routes, curves and natural passages', () => {
  const rooms: D.Room[] = [
    { id: 'a', shape: 'rect', x: 3, y: 3, w: 7, h: 5 }, { id: 'b', shape: 'rect', x: 28, y: 3, w: 8, h: 6 },
    { id: 'm', shape: 'rect', x: 15, y: 3, w: 6, h: 6 }, { id: 'd', shape: 'rect', x: 3, y: 17, w: 7, h: 6 },
  ];
  const s = (corridors: D.Corridor[]) => D.newDungeon('c', { cols: 40, rows: 28, rooms, corridors });

  test('a side end leaves through that wall, square to it; several corridors leave one room by different walls', () => {
    const l = D.layoutDungeon(s([
      { from: { room: 'a', side: 'e' }, to: { room: 'm', side: 'w' } },
      { from: { room: 'a', side: 's', offset: 2.5 }, to: { room: 'd', side: 'n' } },
      { from: { room: 'a', side: 'n' }, to: { at: [6.5, -1] } },
    ]));
    const at = (e: D.EndGeom | null) => [e!.x, e!.y, e!.angle].map(v => Math.round(v * 1000) / 1000);
    expect(at(l.corridors[0].ends[0])).toEqual([10, 5.5, 0]);
    expect(at(l.corridors[0].ends[1])).toEqual([15, 6.5, 180]);   // m's middle row: a Z between the two walls
    expect(at(l.corridors[1].ends[0])).toEqual([5.5, 8, 90]);
    expect(at(l.corridors[1].ends[1])[1]).toBe(17);
    expect(at(l.corridors[2].ends[0])).toEqual([6.5, 3, -90]);
    expect(D.validateDungeon({ ...s([]), corridors: [{ from: { room: 'a', side: 'x' as D.Side }, to: { room: 'b', offset: 2 } }] })).toEqual(['corridors[0].from.side: n, e, s, w', 'corridors[0].to.offset: goes with side']);
  });

  test('a corridor end joins another corridor on its centre line; facts say where; no crossing is reported', () => {
    const sp = s([
      { id: 'main', from: { room: 'a', side: 's' }, to: { room: 'd', side: 'n' } },
      { from: { corridor: 'main' }, to: { room: 'm', side: 's' } },
    ]);
    const l = D.layoutDungeon(sp), j = l.corridors[1].pts;
    expect([j[0], j[1]]).toEqual([6.5, 10]);   // on main (x 6.5), level with m's south door stub
    expect(D.dungeonFacts(sp).corridors[1].joins).toEqual([{ corridor: 0, at: [6.5, 10] }]);
    expect(D.lintDungeon(sp)).toEqual([]);
    expect(D.validateDungeon({ ...sp, corridors: [{ from: { corridor: 'nope' }, to: { room: 'a' } }] })).toEqual(['corridors[0].from.corridor: no corridor with id "nope"']);
    expect(D.validateDungeon({ ...sp, corridors: [{ id: 'x', from: { corridor: 'y' }, to: { room: 'a' } }, { id: 'y', from: { corridor: 'x' }, to: { room: 'b' } }] })).toEqual([expect.stringContaining('in a ring')]);
    expect(D.validateDungeon({ ...sp, corridors: [{ id: 'x', from: { corridor: 'x' }, to: { room: 'a' } }] })).toEqual(expect.arrayContaining([expect.stringContaining('cannot join itself')]));
    expect(D.validateDungeon({ ...sp, corridors: [{ id: 'x', from: { room: 'a' }, to: { room: 'b' } }, { id: 'x', from: { room: 'a' }, to: { room: 'b' } }] })).toEqual(['corridors[1].id: x is used twice']);
  });

  test('around goes round the rooms in the way, on the grid; the straight elbow would not', () => {
    const plain = s([{ from: { room: 'a' }, to: { room: 'b' } }]), round = s([{ from: { room: 'a' }, to: { room: 'b' }, route: 'around' }]);
    expect(D.lintDungeon(plain).map(f => f.message)).toEqual([expect.stringContaining('runs through m')]);
    expect(D.lintDungeon(round)).toEqual([]);
    const pts = D.layoutDungeon(round).corridors[0].pts;
    for (let i = 2; i < pts.length; i += 2) expect(pts[i] === pts[i - 2] || pts[i + 1] === pts[i - 1]).toBe(true);   // along the grid
  });

  test('smooth curves pass through the ends and bends; natural passages are a seeded outline drawn as floor', () => {
    const via = [20, 14, 26, 20];
    const sp = s([{ from: { room: 'd' }, to: { room: 'b' }, via, curve: 'smooth' }, { id: 'cave', from: { room: 'd', side: 'e' }, to: { room: 'b', side: 's' }, style: 'natural', width: 2 }]);
    const l = D.layoutDungeon(sp), c = l.corridors[0].pts;
    expect(c.length).toBeGreaterThan(20);
    expect([c[0], c[1], c[c.length - 2], c[c.length - 1]]).toEqual([6.5, 20, 32, 6]);
    for (let i = 0; i < via.length; i += 2) expect(D.geom.nearestOnLine(c, via[i], via[i + 1]).d).toBeLessThan(1e-6);
    const n = l.corridors[1];
    expect(n.outline!.length).toBeGreaterThan(40);
    expect(D.layoutDungeon(sp).corridors[1].outline).toEqual(n.outline);
    expect(D.layoutDungeon({ ...sp, corridors: [sp.corridors[0], { ...sp.corridors[1], seed: 9 }] }).corridors[1].outline).not.toEqual(n.outline);
    // only built corridors are stroked (walls, floor and the grid's mask): the natural one adds no stroke
    const strokes = (x: D.DungeonSpec) => D.renderDungeonSvg(x).match(/stroke-linecap="square"/g)?.length;
    expect(strokes(sp)).toBe(strokes({ ...sp, corridors: [sp.corridors[0]] }));
  });

  test('fit moves a junction hint with everything else', () => {
    const sp = D.newDungeon('f', { cols: 60, rows: 50, rooms: [{ id: 'a', shape: 'rect', x: 20, y: 20, w: 4, h: 4 }], corridors: [
      { id: 'x', from: { room: 'a' }, to: { at: [30, 22] } }, { from: { corridor: 'x', near: [27, 22] }, to: { at: [27, 28] } },
    ] });
    expect(D.fitDungeon(sp, 2).corridors[1].from).toEqual({ corridor: 'x', near: [9, 4] });
  });
});

describe('exits off the map', () => {
  const sp = (exit: D.Exit, at: [number, number] = [34, 5.5]) => D.newDungeon('x', { cols: 30, rows: 12, rooms: [{ id: 'a', shape: 'rect', x: 3, y: 3, w: 6, h: 5 }], corridors: [{ from: { room: 'a', side: 'e' }, to: { at, exit } }] });

  test('the corridor fades over its last cells before the edge, and a boxed note (a link when set) says where it leads', () => {
    const s = sp({ text: 'To the river caves', href: 'caves.svg#1' }), x = D.layoutExits(s, D.layoutDungeon(s));
    expect(x).toEqual([expect.objectContaining({ corridor: 0, end: 1, edge: [30, 5.5], from: [27, 5.5], dir: [1, 0], off: true })]);
    const svg = D.renderDungeonSvg(s);
    expect(svg).toContain('<g id="exits">');
    expect(svg).toMatch(/<linearGradient id="exit-fade-0"[^]*stop-opacity="0"[^]*stop-opacity="1"/);
    expect(svg).toMatch(/<a href="caves\.svg#1"><rect [^>]*fill="#ffffff" stroke="#000000"[^>]*\/><text [^>]*>To the river<\/text><text [^>]*>caves<\/text><\/a>/);
    expect(D.renderDungeonSvg(s, { layers: { exits: false } })).not.toContain('<g id="exits">');
    expect(D.dungeonFacts(s).exits[0]).toMatchObject({ text: 'To the river caves', href: 'caves.svg#1', edge: 'e' });
  });

  test('a point on the sheet fades toward the point itself; the note stays inside the map; fade 0 draws only the note', () => {
    const s = sp({ text: 'Sealed', fade: 2 }, [20, 5.5]), [x] = D.layoutExits(s, D.layoutDungeon(s));
    expect(x).toMatchObject({ edge: [20, 5.5], from: [18, 5.5], off: false });
    expect(D.renderDungeonSvg(sp({ text: 'Up', fade: 0 }))).not.toContain('exit-fade');
    expect(D.wrapText('To the river caves (L2, area 14)', 16)).toEqual(['To the river', 'caves (L2, area', '14)']);
    expect(D.validateDungeon({ ...s, corridors: [{ from: { room: 'a' }, to: { at: [40, 5], exit: { text: 'x', href: 'javascript:1', fade: 50 } } }] }))
      .toEqual(['corridors[0].to.exit.href: http(s) links only, not javascript:', 'corridors[0].to.exit.fade: cells, 0..20']);
  });
});

describe('rooms joined directly', () => {
  const rooms: D.Room[] = [
    { id: 'hall', shape: 'rect', x: 2, y: 2, w: 10, h: 6 }, { id: 'a', shape: 'rect', x: 12, y: 2, w: 5, h: 6 },
    { id: 'b', shape: 'rect', x: 17, y: 2, w: 6, h: 3 }, { id: 'c', shape: 'rect', x: 17, y: 5, w: 6, h: 3 }, { id: 'far', shape: 'rect', x: 2, y: 12, w: 4, h: 4 },
  ];
  const sp = (connections: D.Connection[]) => D.newDungeon('k', { cols: 26, rows: 18, rooms, connections });

  test('touching rooms keep the wall between them (with sharedWalls, or once there are connections); a connection puts a door or an opening in it, on the grid', () => {
    // an older file (no connections, no blocks): rooms that touch run together, as they always did
    expect(D.layoutDungeon(sp([])).partitions).toEqual([]);
    expect(D.renderDungeonSvg(sp([]))).not.toContain('id="partitions"');
    const walled = { ...sp([]), style: { ...sp([]).style, sharedWalls: true } }, l = D.layoutDungeon(walled);
    // hall|a at x 12, a|b and a|c at x 17, b|c at y 5
    expect(l.partitions.map(p => p.map(v => Math.round(v * 100) / 100))).toEqual([[12, 2, 12, 8], [17, 2, 17, 5], [17, 5, 17, 8], [23, 5, 17, 5]].map(p => expect.arrayContaining(p)));
    const c = D.layoutDungeon(sp([{ a: 'hall', b: 'a' }, { a: 'b', b: 'c', kind: 'open', width: 2 }, { a: 'a', b: 'b', kind: 'secret', at: [17, 3] }]));
    expect(c.connections.map(x => [x.kind, x.x, x.y, Math.round(x.angle) + 0])).toEqual([['door', 12, 5.5, 0], ['open', 20, 5, 90], ['secret', 17, 3, 0]]);
    expect(c.doors.filter(d => d.inner).map(d => d.kind)).toEqual(['door', 'secret']);
    // the openings are cut out of the shared walls: hall|a now runs 2..5 and 6..8
    expect(c.partitions.filter(p => p[0] === 12 && p[2] === 12).map(p => [Math.min(p[1], p[3]), Math.max(p[1], p[3])]).sort()).toEqual([[2, 5], [6, 8]]);
    expect(D.renderDungeonSvg(walled)).toContain('<path id="partitions"');
    const off = sp([{ a: 'hall', b: 'a' }]);
    expect(D.layoutDungeon({ ...off, style: { ...off.style, sharedWalls: false } }).partitions).toEqual([]);   // turned off by hand
  });

  test('facts list the connections and count them as reaching a room; a connection without a shared wall is a warning', () => {
    const s = sp([{ a: 'hall', b: 'a' }, { a: 'a', b: 'far' }]), f = D.dungeonFacts(s);
    expect(f.rooms.find(r => r.id === 'hall')!.connections).toEqual([{ to: 'a', kind: 'door', at: [12, 5.5], connection: 0 }]);
    expect(f.unreached).toEqual(['b', 'c']);
    expect(D.lintDungeon(s).map(x => `${x.path} ${x.message}`)).toEqual([expect.stringMatching(/^connections\[1\] a and far share no wall/)]);
    expect(D.validateDungeon({ ...s, connections: [{ a: 'hall', b: 'hall' }, { a: 'x', b: 'a', kind: 'gate' as D.DoorKind }] })).toEqual([
      'connections[0]: a room cannot connect to itself', 'connections[1].a: no room "x"', 'connections[1].kind: open or one of door, secret, locked, portcullis, arch',
    ]);
  });

  test('removing a room removes its connections; fit moves a connection point', () => {
    const s = sp([{ a: 'hall', b: 'a', at: [12, 4] }, { a: 'b', b: 'c' }]);
    D.removeRoom(s, 'b');
    expect(s.connections).toEqual([{ a: 'hall', b: 'a', at: [12, 4] }]);
    expect(D.fitDungeon(s, 1).connections![0].at).toEqual([11, 3]);
  });
});

describe('blocks split into rooms', () => {
  const blockSpec = (b: Partial<D.Block> = {}, over: Partial<D.DungeonSpec> = {}) => D.parseDungeon({ ...D.newDungeon('b', { cols: 30, rows: 24 }), blocks: [{ id: 'w', shape: 'rect', x: 2, y: 2, w: 16, h: 12, split: { mode: 'bsp', min: 3, seed: 5 }, ...b }], ...over });

  test('bsp: rooms tile the block on whole cells, every room joined; the same seed gives the same rooms', () => {
    const s = D.applyBlock(blockSpec(), 'w').spec, rooms = s.rooms;
    expect(rooms.length).toBeGreaterThan(4);
    expect(rooms.every(r => r.origin === 'block:w' && r.shape === 'rect' && Number.isInteger(r.x) && Number.isInteger(r.w) && r.w >= 3 && r.h >= 3)).toBe(true);
    expect(rooms.reduce((n, r) => n + r.w * r.h, 0)).toBe(16 * 12);
    expect(D.dungeonFacts(s).unreached).toEqual([]);
    expect(D.lintDungeon(s)).toEqual([]);
    expect(D.applyBlock(blockSpec(), 'w').spec).toEqual(s);
    expect(D.applyBlock(blockSpec({ split: { mode: 'bsp', min: 3, seed: 6 } }), 'w').spec.rooms).not.toEqual(rooms);
  });

  test('grid, rows and cuts; a hexagon is cut to its outline, its small corners joined to their neighbours', () => {
    const grid = D.splitBlock({ id: 'g', shape: 'rect', x: 0, y: 0, w: 12, h: 8, split: { mode: 'grid', min: 4 } });
    expect(grid.rooms.map(r => [r.x, r.y, r.w, r.h])).toEqual([[0, 0, 4, 4], [4, 0, 4, 4], [8, 0, 4, 4], [0, 4, 4, 4], [4, 4, 4, 4], [8, 4, 4, 4]]);
    expect(D.splitBlock({ id: 'r', shape: 'rect', x: 0, y: 0, w: 12, h: 9, split: { mode: 'rows', min: 3 } }).rooms.map(r => [r.y, r.h])).toEqual([[0, 3], [3, 3], [6, 3]]);
    expect(D.splitBlock({ id: 'c', shape: 'rect', x: 0, y: 0, w: 10, h: 6, split: { mode: 'cuts', cuts: { x: [4] } } }).rooms.map(r => r.w)).toEqual([4, 6]);
    const hex = D.splitBlock({ id: 'h', shape: 'poly', points: D.hexPoints(0, 0, 16, 12), ...D.polyBox(D.hexPoints(0, 0, 16, 12)), split: { mode: 'grid', min: 4 } });
    expect(hex.rooms.some(r => r.shape === 'poly')).toBe(true);
    const area = hex.rooms.reduce((n, r) => n + D.geom.polygonArea(D.roomOutline(r)), 0);
    expect(area).toBeCloseTo(D.geom.polygonArea(D.hexPoints(0, 0, 16, 12)), 3);   // the corners joined their neighbours: the whole hexagon is floor
    expect(D.geom.polygonArea(D.clipToRect([0, 0, 4, 0, 4, 4, 0, 4], [2, 2, 6, 6]))).toBe(4);
    expect(D.clipToRect([0, 0, 4, 0, 4, 4, 0, 4], [5, 5, 6, 6])).toEqual([]);
  });

  test('splitting again replaces the rooms in place; hand rooms keep their order and number; corridors to lost rooms are dropped', () => {
    let s = blockSpec({}, { rooms: [{ id: 'hand', shape: 'rect', x: 22, y: 2, w: 4, h: 4 }] });
    s = D.applyBlock(s, 'w').spec;
    expect(s.rooms[0].id).toBe('hand');
    s.corridors.push({ from: { room: 'hand' }, to: { room: s.rooms[s.rooms.length - 1].id } });
    s.blocks![0].split = { mode: 'grid', min: 8 };
    const r = D.applyBlock(D.parseDungeon(s), 'w');
    expect(r.spec.rooms[0].id).toBe('hand');
    expect(r.spec.rooms.length).toBe(1 + 2);
    expect(r.spec.corridors).toEqual([]);
    expect(r.dropped).toEqual([expect.stringMatching(/^corridor hand → w-\d+: w-\d+ is gone/)]);
    D.removeBlock(r.spec, 'w');
    expect(r.spec).toMatchObject({ rooms: [{ id: 'hand' }], corridors: [] });
    expect(r.spec.blocks).toBeUndefined();
    expect(D.validateDungeon({ ...s, blocks: [{ id: 'x', shape: 'cave' as 'rect', x: 0, y: 0, w: 4, h: 4, split: { mode: 'cuts' } }] })).toEqual(['blocks[0].shape: one of rect, octagon, circle, poly', 'blocks[0].split.cuts: the x and/or y lines to cut at']);
  });
});

describe('dense and blocks generators', () => {
  const gen = (layout: D.GenLayout, seed: number, over: Partial<D.DungeonSpec['gen']> = {}) => D.generateDungeon(D.newDungeon('g', { cols: 44, rows: 30, seed, gen: { ...D.DEFAULTS.gen, rooms: 16, minSize: 3, maxSize: 7, layout, ...over } }));

  test('dense: rooms side by side, never over each other, every room reached through shared walls; the same seed, the same map', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = gen('dense', seed), f = D.dungeonFacts(s);
      expect(s.rooms.length, `seed ${seed}`).toBeGreaterThan(6);
      expect(f.overlaps).toEqual([]);
      expect(f.unreached).toEqual([]);
      expect(s.connections!.length).toBeGreaterThanOrEqual(s.rooms.length - 1);
      expect(D.lintDungeon(s).filter(x => x.severity === 'error')).toEqual([]);
      expect(D.layoutDungeon(s).partitions.length).toBeGreaterThan(0);
    }
    expect(gen('dense', 3)).toEqual(gen('dense', 3));
    const sparse = gen('dense', 3, { density: 0.15, rooms: 40 }), full = gen('dense', 3, { density: 0.6, rooms: 40 });
    expect(sparse.rooms.length).toBeLessThan(full.rooms.length);
  });

  test('blocks: a few blocks split into rooms, linked wall to wall; nothing runs through a room', () => {
    for (const seed of [1, 2, 3, 4, 5, 11]) {
      const s = gen('blocks', seed, { round: 0.4 }), f = D.dungeonFacts(s);
      expect(s.blocks!.length, `seed ${seed}`).toBeGreaterThan(1);
      expect(s.rooms.every(r => s.blocks!.some(b => r.origin === `block:${b.id}`))).toBe(true);
      expect(f.unreached).toEqual([]);
      expect(D.lintDungeon(s).filter(x => /runs through|crosses itself/.test(x.message))).toEqual([]);
    }
  });

  test('scatter clears connections and blocks; the layout and density are checked', () => {
    const s = D.generateDungeon({ ...gen('blocks', 2), gen: { ...D.DEFAULTS.gen } });
    expect(s.blocks).toBeUndefined();
    expect(s.connections).toBeUndefined();
    expect(D.validateDungeon({ ...s, gen: { ...s.gen, layout: 'maze' as D.GenLayout, density: 2 } })).toEqual(['gen.layout: scatter, dense, blocks', 'gen.density: above 0, at most 1']);
  });
});
