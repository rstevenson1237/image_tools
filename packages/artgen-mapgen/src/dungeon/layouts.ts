/**
 * The bundled layouts: the structures named in docs/DUNGEON-DESIGN.md §2, read off the two recreated maps, plus a rigid
 * gatehouse. They hold topology and proportions, not the drawings. Sizes are cells on a 5 ft grid with 10 ft passages
 * (a graph's default `width` of 2). A project adds its own in `art/dungeons/layouts/<id>.json`; a design, in `layouts`.
 */
import type { Layout } from './design.ts';

const fromMap = (origin: string, note: string) => ({ kind: 'drawn' as const, origin, note });

export const LAYOUTS: Layout[] = [
  {
    id: 'cell-row', name: 'A row of cells off each long side of a hall', tags: ['cells', 'rows', 'hall', 'barracks', 'prison'],
    source: fromMap('map 1, rooms 7 to 12', 'six small rooms in two rows, each with one door onto a shared hall'),
    params: { 'per-row': { default: 3, min: 1, max: 6 }, cell: { default: 4, min: 2, max: 8 } },
    parts: [
      { role: 'hall', shape: 'hall', w: '$per-row*4', h: 2 },
      { role: 'north-cell', w: '$cell', h: '$cell', count: '$per-row', at: { part: 'hall', side: 'n', hold: true } },
      { role: 'south-cell', w: '$cell', h: '$cell', count: '$per-row', at: { part: 'hall', side: 's', hold: true } },
    ],
    ties: [{ a: 'hall', b: 'north-cell', kind: 'door' }, { a: 'hall', b: 'south-cell', kind: 'door' }],
    sockets: [{ name: 'w', part: 'hall', bearing: 'w' }, { name: 'e', part: 'hall', bearing: 'e' }],
    constraints: [{ mirror: ['north-cell', 'south-cell'], about: 'hall', along: 'ew' }],
  },
  {
    id: 'spine-ring-hub', name: 'A spine corridor through a ring chamber', tags: ['hub', 'spine', 'axial', 'ring'],
    source: fromMap('map 2', 'one corridor the full height, crossing a ring chamber with doors round it'),
    params: { ring: { default: 8, min: 6, max: 16 }, spine: { default: 8, min: 4, max: 20 } },
    parts: [
      { role: 'spine-n', shape: 'hall', w: 2, h: '$spine' },
      { role: 'hub', shape: 'round', w: '$ring', h: '$ring', at: { part: 'spine-n', side: 's', hold: true }, ring: { pad: 1 } },
      { role: 'spine-s', shape: 'hall', w: 2, h: '$spine', at: { part: 'hub', side: 's', hold: true } },
    ],
    ties: [{ a: 'spine-n', b: 'hub', kind: 'passage' }, { a: 'hub', b: 'spine-s', kind: 'passage' }],
    sockets: [
      { name: 'n', part: 'spine-n', bearing: 'n' }, { name: 's', part: 'spine-s', bearing: 's' },
      { name: 'hub-e', part: 'hub', bearing: 'e' }, { name: 'hub-w', part: 'hub', bearing: 'w' },
      { name: 'hub-ne', part: 'hub', bearing: 'ne' }, { name: 'hub-se', part: 'hub', bearing: 'se' }, { name: 'hub-sw', part: 'hub', bearing: 'sw' }, { name: 'hub-nw', part: 'hub', bearing: 'nw' },
    ],
    constraints: [{ line: ['spine-n', 'hub', 'spine-s'], along: 'ns' }],
  },
  {
    id: 'axis-of-halls', name: 'Large halls in a row, joined by wide passages', tags: ['axial', 'halls', 'procession'],
    source: fromMap('map 1', 'three large halls in a row joined by 2-wide passages with double doors'),
    params: { halls: { default: 3, min: 2, max: 6 }, size: { default: 8, min: 4, max: 16 } },
    parts: [{ role: 'hall', w: '$size', h: '$size', count: '$halls' }],
    ties: [{ a: 'hall', b: 'hall', kind: 'passage', side: 'e', hold: true, doors: ['double', null] }],
    sockets: [{ name: 'w', part: 'hall', of: 'first', bearing: 'w' }, { name: 'e', part: 'hall', of: 'last', bearing: 'e' }],
    constraints: [{ line: ['hall'], along: 'ew' }],
  },
  {
    id: 'suite', name: 'A room with a sub-room against one wall', tags: ['suite', 'alcove', 'sub-room'],
    source: fromMap('maps 1 and 2', 'a room with an "a" sub-room: 14 and 14a, 15a and its alcove, 20 and 20a'),
    params: { main: { default: 8, min: 4, max: 16 }, sub: { default: 4, min: 2, max: 8 } },
    parts: [
      { role: 'main', w: '$main', h: '$main*0.75' },
      { role: 'sub', w: '$sub', h: '$sub', at: { part: 'main', side: 'e', touch: true } },
    ],
    ties: [{ a: 'main', b: 'sub', kind: 'door' }],
    sockets: [{ name: 'in', part: 'main', bearing: 'w' }, { name: 'n', part: 'main', bearing: 'n' }, { name: 's', part: 'main', bearing: 's' }],
  },
  {
    id: 'secret-bypass', name: 'A hidden passage between two rooms the main route also reaches', tags: ['secret', 'bypass', 'shortcut'],
    source: fromMap('maps 1 and 2', 'a hidden corridor linking two rooms the main route also reaches'),
    parts: [
      { role: 'near', w: 4, h: 4 },
      { role: 'bypass', shape: 'hall', w: 6, h: 2, at: { part: 'near', side: 'e' } },
      { role: 'far', w: 4, h: 4, at: { part: 'bypass', side: 'e' } },
    ],
    ties: [{ a: 'near', b: 'bypass', kind: 'passage', doors: ['secret', null] }, { a: 'bypass', b: 'far', kind: 'passage', doors: [null, 'secret'] }],
    sockets: [{ name: 'near', part: 'near', bearing: 'w' }, { name: 'far', part: 'far', bearing: 'e' }, { name: 'near-s', part: 'near', bearing: 's' }, { name: 'far-s', part: 'far', bearing: 's' }],
  },
  {
    id: 'stair-vestibule', name: 'A small room that holds a stair', tags: ['stair', 'vestibule', 'exit'],
    source: fromMap('maps 1 and 2', 'a small room or alcove whose job is to hold a stair'),
    parts: [{ role: 'vestibule', w: [2, 4], h: [2, 4], symbols: [{ kind: 'stairs' }] }],
    sockets: [{ name: 'in', part: 'vestibule', bearing: 'w' }, { name: 'n', part: 'vestibule', bearing: 'n' }, { name: 'e', part: 'vestibule', bearing: 'e' }, { name: 's', part: 'vestibule', bearing: 's' }],
  },
  {
    id: 'gatehouse', name: 'A gate passage between two towers, placed exactly', tags: ['gate', 'towers', 'rigid', 'entrance'], rigid: true,
    source: { kind: 'written', note: 'a rigid layout: its parts keep these places, as one block' },
    parts: [
      { role: 'gate', shape: 'hall', w: 2, h: 6, place: { x: 4, y: 0 } },
      { role: 'west-tower', w: 4, h: 4, place: { x: 0, y: 1 } },
      { role: 'east-tower', w: 4, h: 4, place: { x: 6, y: 1 } },
    ],
    ties: [{ a: 'gate', b: 'west-tower', kind: 'door' }, { a: 'gate', b: 'east-tower', kind: 'door' }],
    sockets: [{ name: 'out', part: 'gate', bearing: 'n' }, { name: 'in', part: 'gate', bearing: 's' }],
  },
];
