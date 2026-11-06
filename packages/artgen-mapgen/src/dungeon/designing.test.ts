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
