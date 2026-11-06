// setting_builder's layouts from its report on designing levels (its `layouts/*.md`, written by hand), in this repo's format:
// feet become cells (5 ft). Test fixtures, not bundled: setting_builder keeps its library and offers the ones that prove out.
import type { Layout } from '../design.ts';

const src = { kind: 'written' as const, origin: 'setting_builder layouts/' };
export const SB_LAYOUTS: Layout[] = [
  {
    id: 'three-routes', source: src, parts: [
      { role: 'start', shape: 'octagon', w: 4, h: 4 },
      { role: 'lane', shape: 'hall', w: 4, h: 16, at: { part: 'start', side: 's' } },
      { role: 'hall', w: 16, h: 8, at: { part: 'lane', side: 's' }, focal: true },
    ],
    ties: [{ a: 'start', b: 'lane', kind: 'passage' }, { a: 'lane', b: 'hall', kind: 'passage' }],
    sockets: [{ name: 'sw', part: 'start', bearing: 'sw' }, { name: 'se', part: 'start', bearing: 'se' }, { name: 'nw', part: 'hall', bearing: 'nw' }, { name: 'ne', part: 'hall', bearing: 'ne' }, { name: 's', part: 'hall', bearing: 's' }],
  },
  {
    id: 'twin-loop', source: src, parts: [
      { role: 'gate', shape: 'round', w: 6, h: 6 },
      { role: 'left', shape: 'octagon', w: 4, h: 4, count: 3, at: { part: 'gate', side: 'sw' } },
      { role: 'right', shape: 'hexagon', w: 4, h: 4, count: 3, at: { part: 'gate', side: 'se' } },
    ],
    ties: [
      { a: 'gate', b: 'left', kind: 'passage', ofB: 'first' }, { a: 'left', b: 'left', kind: 'passage' },
      { a: 'gate', b: 'right', kind: 'passage', ofB: 'first' }, { a: 'right', b: 'right', kind: 'passage' },
      { a: 'left', b: 'right', kind: 'passage', ofA: 'last', ofB: 'last' },
    ],
    sockets: [{ name: 'in', part: 'gate', bearing: 'n' }, { name: 'core', part: 'gate', bearing: 's' }],
  },
  {
    id: 'dense-block', source: src, parts: [
      { role: 'hall', w: 12, h: 2 },
      { role: 'north-cell', w: 4, h: 4, count: 3, at: { part: 'hall', side: 'n' } },
      { role: 'south-cell', w: 4, h: 4, count: 3, at: { part: 'hall', side: 's' } },
    ],
    ties: [{ a: 'hall', b: 'north-cell', kind: 'door' }, { a: 'hall', b: 'south-cell', kind: 'door' }],
    sockets: [{ name: 'north', part: 'hall', bearing: 'n' }, { name: 'south', part: 'hall', bearing: 's' }],
  },
  { id: 'stair-end', source: src, parts: [{ role: 'vestibule', w: [2, 4], h: [2, 4] }], sockets: [{ name: 'in', part: 'vestibule', bearing: 'w' }] },
  {
    id: 'figure-eight', source: src, parts: [
      { role: 'm', w: 4, h: 4, focal: true },
      { role: 'a', w: 4, h: 4, count: 5, at: { part: 'm', side: 'w' } },
      { role: 'b', w: 4, h: 4, count: 5, at: { part: 'm', side: 'e' } },
    ],
    ties: [
      { a: 'm', b: 'a', kind: 'passage', ofB: 'first' }, { a: 'm', b: 'a', kind: 'passage', ofB: 'last' }, { a: 'a', b: 'a', kind: 'passage' },
      { a: 'm', b: 'b', kind: 'passage', ofB: 'first' }, { a: 'm', b: 'b', kind: 'passage', ofB: 'last' }, { a: 'b', b: 'b', kind: 'passage' },
    ],
    sockets: [{ name: 'left-end', part: 'a', of: 3, bearing: 'w' }, { name: 'right-end', part: 'b', of: 3, bearing: 'e' }],
  },
  {
    // the spiral, with each step's side as a chain bearing held as a rule (R2: a path-shaped layout)
    id: 'spiral-14', source: src, hold: true,
    parts: [
      { role: 'p', shape: 'cave', w: 4, h: 4, count: 13 },
      { role: 'centre', shape: 'cave', w: 8, h: 8, at: { part: 'p', side: 'n' } },
    ],
    ties: [{ a: 'p', b: 'p', kind: 'passage', sides: ['e', 'e', 'e', 'n', 'n', 'n', 'w', 'w', 'w', 's', 's', 'e'] }, { a: 'p', b: 'centre', kind: 'passage', ofA: 'last' }],
    sockets: [{ name: 'in', part: 'p', of: 'first', bearing: 's' }],
  },
];
