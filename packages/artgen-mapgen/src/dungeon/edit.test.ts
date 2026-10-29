// Dungeon edits as plain objects (`editDungeon`): the one vocabulary the CLI's one-edit commands, `dungeon edit` and the MCP
// `dungeon_edit` tool share, and the helpers that read their arguments.
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';

const blank = (over: Partial<D.DungeonSpec> = {}) => D.newDungeon('t', { cols: 30, rows: 24, seed: 1, ...over });
const hand = () => {
  const m = blank();
  D.editDungeon(m, { op: 'add_room', shape: 'rect', at: '3,3', w: 6, h: 4, label: 'Hall' });
  D.editDungeon(m, { op: 'add_room', shape: 'cave', at: [16, 4], w: 8, h: 6 });
  return m;
};

describe('the helpers', () => {
  test('cornerPoint: x,y as given, a cell name to that cell\'s corner', () => {
    expect(D.cornerPoint('3,4')).toEqual([3, 4]);
    expect(D.cornerPoint('C4')).toEqual([2, 3]);
    expect(() => D.cornerPoint('nope')).toThrow(/expected x,y/);
  });
  test('doorPair: one kind at both ends, none or open for no door, a bad kind is told', () => {
    expect(D.doorPair(undefined)).toBeUndefined();
    expect(D.doorPair('secret')).toEqual(['secret', 'secret']);
    expect(D.doorPair('door,none')).toEqual(['door', null]);
    expect(D.doorPair('open,arch')).toEqual([null, 'arch']);
    expect(() => D.doorPair('gate')).toThrow('--doors: none or one of door, secret, locked, portcullis, arch');
  });
  test('gridMode: feet to cells, a sub-grid with +, none hides it', () => {
    const m = blank();
    expect(D.gridMode(m, '10')).toMatchObject({ show: true, size: 2, sub: false });
    expect(D.gridMode(m, '10+5')).toMatchObject({ size: 2, sub: true });
    expect(D.gridMode(m, 'none')).toMatchObject({ show: false });
    expect(() => D.gridMode(m, 'banana')).toThrow(/grid: 10, 5, 10\+5 or none/);
  });
  test('corridorEnd: a room (with side and offset), a corridor, or a point', () => {
    const m = hand();
    D.editDungeon(m, { op: 'link', from: 'r1', to: [29, 15], id: 'main' });
    expect(D.corridorEnd(m, 'r1', 'e', 2)).toEqual({ room: 'r1', side: 'e', offset: 2 });
    expect(D.corridorEnd(m, 'corridor:main')).toEqual({ corridor: 'main' });
    expect(D.corridorEnd(m, 'main')).toEqual({ corridor: 'main' });
    expect(D.corridorEnd(m, '5,6')).toEqual({ at: [5, 6] });
    expect(() => D.corridorEnd(m, 'r1', 'x')).toThrow('n, e, s, w');
    expect(() => D.corridorEnd(m, '5,6', 'e')).toThrow('not a room');
    expect(() => D.corridorEnd(m, 'corridor:zz')).toThrow('no corridor with id zz');
  });
});

describe('rooms', () => {
  test('add_room: shape, corner (a point, x/y or a cell name), size, label, number, href, fill, origin', () => {
    const m = blank();
    expect(D.editDungeon(m, { op: 'add_room', shape: 'rect', at: 'C4', w: 5, h: 5, label: 'Chapel', number: 7, href: 'http://x.y', fill: 'yard', origin: 'tables', id: 'r9' })).toBe('added rect room r9');
    expect(D.editDungeon(m, { op: 'add_room', shape: 'circle', x: 10, y: 10, w: 4, h: 4, number: false })).toBe('added circle room r2');
    expect(D.editDungeon(m, { op: 'add_room', shape: 'poly', points: [3, 12, 9, 12, 6, 17] })).toBe('added poly room r3');
    expect(m.rooms).toEqual([
      { id: 'r9', shape: 'rect', x: 2, y: 3, w: 5, h: 5, label: 'Chapel', number: 7, fill: 'yard', href: 'http://x.y', origin: 'tables' },
      { id: 'r2', shape: 'circle', x: 10, y: 10, w: 4, h: 4, number: false },
      { id: 'r3', shape: 'poly', points: [3, 12, 9, 12, 6, 17], x: 3, y: 12, w: 6, h: 5 },
    ]);
  });
  test('move_room shifts a poly\'s points; set_room changes, removes and hides', () => {
    const m = blank();
    D.editDungeon(m, { op: 'add_room', shape: 'poly', points: [3, 12, 9, 12, 6, 17], id: 'tri' });
    D.editDungeon(m, { op: 'add_room', shape: 'rect', at: '1,1', w: 3, h: 3, label: 'A', href: 'http://x.y', fill: 'cellar', id: 'a' });
    expect(D.editDungeon(m, { op: 'move_room', room: 'tri', at: '4,13' })).toBe('moved tri to 4,13');
    expect(m.rooms[0]).toMatchObject({ x: 4, y: 13, points: [4, 13, 10, 13, 7, 18] });
    expect(D.editDungeon(m, { op: 'set_room', room: 'a', label: '', href: '', number: false, w: 5, fill: 'floor' })).toBe('changed a');
    expect(m.rooms[1]).toEqual({ id: 'a', shape: 'rect', x: 1, y: 1, w: 5, h: 3, number: false });
    D.editDungeon(m, { op: 'set_room', room: 'tri', shape: 'octagon' });
    expect(m.rooms[0].points).toBeUndefined();
    D.editDungeon(m, { op: 'set_room', room: 'a', shape: 'poly', h: 4 });
    expect(m.rooms[1]).toMatchObject({ shape: 'poly', h: 4 });
  });
  test('an edit to an entry of some origin records the hand change, once', () => {
    const m = blank();
    D.editDungeon(m, { op: 'add_room', shape: 'rect', at: '1,1', w: 3, h: 3, id: 'g', origin: 'tables' });
    D.editDungeon(m, { op: 'move_room', room: 'g', at: '2,2' });
    D.editDungeon(m, { op: 'set_room', room: 'g', w: 4, h: 4, shape: 'circle', label: 'G', fill: 'yard' });
    D.editDungeon(m, { op: 'move_room', room: 'g', at: '3,3' });
    expect(m.rooms[0].hand).toEqual(['x', 'y', 'w', 'h', 'shape', 'label', 'fill']);
    D.editDungeon(m, { op: 'add_room', shape: 'rect', at: '9,9', w: 3, h: 3, id: 'h' });
    D.editDungeon(m, { op: 'move_room', room: 'h', at: '8,8' });
    expect(m.rooms[1].hand).toBeUndefined();
  });
  test('remove_room takes its corridors and connections; an unknown room is told with the ones there are', () => {
    const m = hand();
    D.editDungeon(m, { op: 'link', from: 'r1', to: 'r2' });
    expect(D.editDungeon(m, { op: 'remove_room', room: 'r1' })).toBe('removed r1 and 1 corridors');
    expect(m.corridors).toEqual([]);
    expect(() => D.editDungeon(m, { op: 'move_room', room: 'nope', at: '1,1' })).toThrow('no room nope (have: r2)');
  });
});

describe('corridors and connections', () => {
  test('link: rooms, points, junctions, sides, doors, exit notes and the rest of the fields', () => {
    const m = hand();
    expect(D.editDungeon(m, { op: 'link', from: 'r1', to: 'r2', doors: ['door', null], route: 'hv', width: 2, origin: 'tables' })).toBe('corridor 0: r1 → r2');
    D.editDungeon(m, { op: 'link', from: 'r2', to: [29, 15], id: 'out', exit: { text: 'To the caves', fade: 3 }, curve: 'smooth', style: 'natural', seed: 3, via: [20, 12] });
    D.editDungeon(m, { op: 'link', from: 'r1', to: 'corridor:out', from_side: 'e', from_offset: 1 });
    expect(m.corridors[0]).toEqual({ from: { room: 'r1' }, to: { room: 'r2' }, width: 2, route: 'hv', doors: ['door', null], origin: 'tables' });
    expect(m.corridors[1]).toEqual({ id: 'out', from: { room: 'r2' }, to: { at: [29, 15], exit: { text: 'To the caves', fade: 3 } }, via: [20, 12], curve: 'smooth', style: 'natural', seed: 3 });
    expect(m.corridors[2]).toMatchObject({ from: { room: 'r1', side: 'e', offset: 1 }, to: { corridor: 'out' } });
    expect(D.parseDungeon(m).corridors).toHaveLength(3);
  });
  test('an exit note goes only on a point end, and a raw end object is kept as given', () => {
    const m = hand();
    D.editDungeon(m, { op: 'link', from: 'r1', to: 'r2', exit: { text: 'ignored' } });
    expect(m.corridors[0].to).toEqual({ room: 'r2' });
    D.editDungeon(m, { op: 'link', from: { at: [1, 1] }, to: { room: 'r1' } });
    expect(m.corridors[1].from).toEqual({ at: [1, 1] });
  });
  test('a block id in a link stands for its room nearest the other end', () => {
    const m = hand();
    D.editDungeon(m, { op: 'add_block', shape: 'rect', at: '3,12', w: 12, h: 8, split: 'grid', min: 4, id: 'bk', seed: 2 });
    const near = D.linkEnds(m, 'bk', 'r1')[0] as string;
    expect(m.rooms.find(r => r.id === near)?.origin).toBe('block:bk');
    D.editDungeon(m, { op: 'link', from: 'bk', to: 'r2' });
    expect(m.corridors[0].from).toMatchObject({ room: expect.stringMatching(/^bk-/) });
    expect(D.linkEnds(m, 'r1', 'r2')).toEqual(['r1', 'r2']);
  });
  test('unlink and door', () => {
    const m = hand();
    D.editDungeon(m, { op: 'link', from: 'r1', to: 'r2' });
    D.editDungeon(m, { op: 'door', index: 0, end: 'from', kind: 'portcullis' });
    D.editDungeon(m, { op: 'door', index: 0, end: 'to', kind: 'secret' });
    expect(m.corridors[0].doors).toEqual(['portcullis', 'secret']);
    D.editDungeon(m, { op: 'door', index: 0, end: 'from' });
    expect(m.corridors[0].doors).toEqual([null, 'secret']);
    expect(() => D.editDungeon(m, { op: 'door', index: 5, end: 'from' })).toThrow('no corridor 5 (0..0)');
    D.editDungeon(m, { op: 'unlink', index: 0 });
    expect(m.corridors).toEqual([]);
    expect(() => D.editDungeon(m, { op: 'unlink', index: 0 })).toThrow('no corridor 0');
  });
  test('connect and disconnect (the list goes when it is empty)', () => {
    const m = hand();
    expect(D.editDungeon(m, { op: 'connect', a: 'r1', b: 'r2', kind: 'secret', at: '5,5', width: 2, origin: 'tables' })).toBe('connection 0: r1 ↔ r2');
    D.editDungeon(m, { op: 'connect', a: 'r2', b: 'r1', kind: 'door' });
    expect(m.connections).toEqual([{ a: 'r1', b: 'r2', at: [5, 5], kind: 'secret', width: 2, origin: 'tables' }, { a: 'r2', b: 'r1' }]);
    expect(D.editDungeon(m, { op: 'disconnect', index: 0 })).toBe('1 connections');
    D.editDungeon(m, { op: 'disconnect', index: 0 });
    expect(m.connections).toBeUndefined();
    expect(() => D.editDungeon(m, { op: 'disconnect', index: 0 })).toThrow('no connection 0 (0..-1)');
  });
});

describe('blocks and fit', () => {
  test('add_block makes rooms that share walls; split_block takes a new seed unless told to keep it; remove_block takes its rooms', () => {
    const m = hand();
    const note = D.editDungeon(m, { op: 'add_block', shape: 'hex', at: [3, 12], w: 12, h: 8, split: 'grid', min: 4, doors: 0.25 });
    expect(note).toMatch(/^block b1: \d+ rooms, \d+ connections/);
    expect(m.blocks).toEqual([expect.objectContaining({ id: 'b1', shape: 'poly', split: { mode: 'grid', min: 4 } })]);
    const rooms = m.rooms.filter(r => r.origin === 'block:b1').length;
    expect(rooms).toBeGreaterThan(1);
    D.editDungeon(m, { op: 'split_block', id: 'b1', seed: 4 });
    expect(m.blocks![0].split).toEqual({ mode: 'grid', min: 4, seed: 4 });
    D.editDungeon(m, { op: 'split_block', id: 'b1', min: 3, reseed: false });
    expect(m.blocks![0].split).toEqual({ mode: 'grid', min: 3, seed: 4 });
    D.editDungeon(m, { op: 'split_block', id: 'b1', split: 'rows', doors: 0.5 });
    expect(m.blocks![0]).toMatchObject({ doors: 0.5, split: { mode: 'rows', min: 3 } });
    expect(typeof m.blocks![0].split.seed).toBe('number');
    expect(m.rooms.filter(r => r.origin === 'block:b1').length).toBeGreaterThan(0);
    expect(D.editDungeon(m, { op: 'remove_block', id: 'b1' })).toBe('removed block b1 and its rooms');
    expect(m.blocks).toBeUndefined();
    expect(m.rooms.map(r => r.id)).toEqual(['r1', 'r2']);
    expect(() => D.editDungeon(m, { op: 'remove_block', id: 'b1' })).toThrow('no block b1');
    expect(() => D.editDungeon(m, { op: 'split_block', id: 'b1' })).toThrow('no block b1');
  });
  test('a block edit puts the new spec in the same object, and edits after it are kept', () => {
    const m = hand();
    D.editDungeon(m, { op: 'add_block', shape: 'rect', at: '3,12', w: 8, h: 6, split: 'rows', min: 3, id: 'bk', seed: 1 });
    D.editDungeon(m, { op: 'remove_room', room: 'r1' });
    D.editDungeon(m, { op: 'add_room', shape: 'rect', at: '20,16', w: 3, h: 3, id: 'late' });
    expect(m.rooms.some(r => r.id === 'r1')).toBe(false);
    expect(m.rooms.some(r => r.id === 'late')).toBe(true);
  });
  test('fit crops the sheet to the rooms', () => {
    const m = hand();
    expect(D.editDungeon(m, { op: 'fit', margin: 1 })).toMatch(/^fitted to \d+×\d+ cells$/);
    expect(m.cols).toBeLessThan(30);
    expect(m.rows).toBeLessThan(24);
  });
  test('an unknown op is told with the ones there are', () => {
    expect(() => D.editDungeon(blank(), { op: 'sing' })).toThrow(`unknown op sing (${D.DUNGEON_OPS.join(', ')})`);
    expect(D.DUNGEON_OPS).toContain('split_block');
  });
});
