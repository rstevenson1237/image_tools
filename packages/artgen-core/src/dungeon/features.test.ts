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
