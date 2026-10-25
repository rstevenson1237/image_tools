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
