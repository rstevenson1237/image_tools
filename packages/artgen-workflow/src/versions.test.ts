import { describe, expect, test } from 'vitest';
import { diffJson, diffLines, nextVersion, sortVersions, versionFile, versionOfFile } from './versions.ts';

describe('versions', () => {
  test('nextVersion: v1 for none, else one above the highest', () => {
    expect(nextVersion([])).toBe('v1');
    expect(nextVersion(['v1'])).toBe('v2');
    expect(nextVersion(['v2', 'v10', 'v3'])).toBe('v11');
    expect(nextVersion(['v1', 'draft', 'v0', 'v2b'])).toBe('v2');
  });

  test('file names and their versions', () => {
    expect(versionFile('map', 'v3')).toBe('map.v3.json');
    expect(versionOfFile('map', 'map.v3.json')).toBe('v3');
    expect(versionOfFile('map', 'map.json')).toBeNull();
    expect(versionOfFile('map', 'map.brief.md')).toBeNull();
    expect(versionOfFile('dungeon', 'map.v1.json')).toBeNull();
    expect(sortVersions(['v10', 'v2', 'x', 'v1'])).toEqual(['v1', 'v2', 'v10']);
  });
});

describe('diffJson', () => {
  test('objects key by key, sorted by path', () => {
    const a = { title: 'Keep', scale: { perCell: 6, unit: 'mi' }, legend: true, old: 1 };
    const b = { title: 'The Keep', scale: { perCell: 6, unit: 'km' }, legend: true, extra: [1] };
    expect(diffJson(a, b)).toEqual([
      { path: 'extra', op: 'added', to: [1] },
      { path: 'old', op: 'removed', from: 1 },
      { path: 'scale.unit', op: 'changed', from: 'mi', to: 'km' },
      { path: 'title', op: 'changed', from: 'Keep', to: 'The Keep' },
    ]);
  });

  test('an array whose items all have an id is compared by id, any other by index', () => {
    const a = { rooms: [{ id: 'hall', w: 6 }, { id: 'vault', w: 3 }], edits: [{ op: 'road' }, { op: 'paint' }] };
    const b = { rooms: [{ id: 'vault', w: 3 }, { id: 'hall', w: 8 }, { id: 'cell', w: 2 }], edits: [{ op: 'road' }] };
    expect(diffJson(a, b)).toEqual([
      { path: 'edits[1]', op: 'removed', from: { op: 'paint' } },
      { path: 'rooms[id=cell]', op: 'added', to: { id: 'cell', w: 2 } },
      { path: 'rooms[id=hall].w', op: 'changed', from: 6, to: 8 },
    ]);
  });

  test('duplicate ids fall back to the index; equal files give nothing; the same call twice gives the same list', () => {
    expect(diffJson([{ id: 'a', x: 1 }, { id: 'a', x: 2 }], [{ id: 'a', x: 1 }, { id: 'a', x: 3 }])).toEqual([{ path: '[1].x', op: 'changed', from: 2, to: 3 }]);
    const x = { a: [1, { b: 2 }], c: 'd' };
    expect(diffJson(x, structuredClone(x))).toEqual([]);
    expect(diffJson(x, { ...x, c: 'e' })).toEqual(diffJson(x, { ...x, c: 'e' }));
    expect(diffJson({ a: 1 }, [1])).toEqual([{ path: '', op: 'changed', from: { a: 1 }, to: [1] }]);
  });

  test('lines: one per change, long values cut to 60 characters', () => {
    const long = 'x'.repeat(100);
    const lines = diffLines(diffJson({ a: 1, b: long }, { a: 2, c: 3 }));
    expect(lines).toEqual(['~ a: 1 -> 2', `- b: ${JSON.stringify(long).slice(0, 57)}...`, '+ c: 3']);
    expect(lines[1].length).toBe(5 + 60);
  });
});
