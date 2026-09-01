import { describe, expect, it } from 'vitest';
import type { TraceResult } from '../../workers/opencv.worker';
import {
  canRemoveNode,
  createPathId,
  defaultPathStyle,
  documentFromTrace,
  getNode,
  hitTestNode,
  hitTestPath,
  hitTestSegment,
  insertNode,
  insertPath,
  nodeCount,
  removeNode,
  removePath,
  setNode,
  type VecDocument,
  type VecPath,
} from './model';

function square(x: number, y: number, size: number): { x: number; y: number }[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

function path(id: string, rings: { x: number; y: number }[][]): VecPath {
  return {
    id,
    name: id,
    subpaths: rings.map((nodes) => ({ nodes, closed: true })),
    style: { ...defaultPathStyle },
    visible: true,
  };
}

function doc(...paths: VecPath[]): VecDocument {
  return { width: 100, height: 100, paths };
}

describe('documentFromTrace', () => {
  const result: TraceResult = {
    width: 64,
    height: 32,
    droppedCount: 2,
    thresholdUsed: 137,
    shapes: [
      {
        outer: { points: Float32Array.from([0, 0, 10, 0, 10, 10]), area: 50 },
        holes: [{ points: Float32Array.from([2, 2, 4, 2, 4, 4]), area: 2 }],
      },
    ],
  };

  it('maps flat rings to nodes and keeps holes as later subpaths', () => {
    const document = documentFromTrace(result);
    expect(document.width).toBe(64);
    expect(document.height).toBe(32);
    expect(document.paths).toHaveLength(1);

    const [only] = document.paths;
    expect(only.subpaths).toHaveLength(2);
    expect(only.subpaths[0].nodes).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(only.subpaths[1].nodes).toHaveLength(3);
    expect(only.subpaths.every((s) => s.closed)).toBe(true);
  });

  it('gives every path its own style object', () => {
    const document = documentFromTrace(result, { fill: '#ff0000' });
    document.paths[0].style.fill = '#00ff00';
    expect(defaultPathStyle.fill).toBe('#e6e9f0');
    expect(documentFromTrace(result, { fill: '#ff0000' }).paths[0].style.fill).toBe('#ff0000');
  });

  it('issues unique path ids', () => {
    expect(createPathId()).not.toBe(createPathId());
  });
});

describe('node mutations', () => {
  it('setNode moves a node in place', () => {
    const d = doc(path('a', [square(0, 0, 10)]));
    const ref = { pathId: 'a', subpathIndex: 0, nodeIndex: 1 };
    setNode(d, ref, { x: 42, y: 7 });
    expect(getNode(d, ref)).toEqual({ x: 42, y: 7 });
  });

  it('ignores refs that do not resolve', () => {
    const d = doc(path('a', [square(0, 0, 10)]));
    setNode(d, { pathId: 'missing', subpathIndex: 0, nodeIndex: 0 }, { x: 1, y: 1 });
    setNode(d, { pathId: 'a', subpathIndex: 9, nodeIndex: 0 }, { x: 1, y: 1 });
    setNode(d, { pathId: 'a', subpathIndex: 0, nodeIndex: 9 }, { x: 1, y: 1 });
    expect(d.paths[0].subpaths[0].nodes[0]).toEqual({ x: 0, y: 0 });
    expect(removeNode(d, { pathId: 'missing', subpathIndex: 0, nodeIndex: 0 })).toBeUndefined();
  });

  it('insertNode and removeNode are inverses', () => {
    const d = doc(path('a', [square(0, 0, 10)]));
    const before = structuredClone(d);
    const ref = { pathId: 'a', subpathIndex: 0, nodeIndex: 2 };

    insertNode(d, ref, { x: 5, y: 5 });
    expect(nodeCount(d.paths[0])).toBe(5);
    expect(getNode(d, ref)).toEqual({ x: 5, y: 5 });

    expect(removeNode(d, ref)).toEqual({ x: 5, y: 5 });
    expect(d).toEqual(before);
  });

  it('removeNode and insertNode are inverses in the other direction', () => {
    const d = doc(path('a', [square(0, 0, 10)]));
    const before = structuredClone(d);
    const ref = { pathId: 'a', subpathIndex: 0, nodeIndex: 1 };

    const removed = removeNode(d, ref)!;
    expect(nodeCount(d.paths[0])).toBe(3);
    insertNode(d, ref, removed);
    expect(d).toEqual(before);
  });

  it('insertNode copies the point rather than aliasing it', () => {
    const d = doc(path('a', [square(0, 0, 10)]));
    const source = { x: 5, y: 5 };
    insertNode(d, { pathId: 'a', subpathIndex: 0, nodeIndex: 0 }, source);
    source.x = 99;
    expect(d.paths[0].subpaths[0].nodes[0]).toEqual({ x: 5, y: 5 });
  });

  it('canRemoveNode protects degenerate subpaths', () => {
    const d = doc(path('a', [square(0, 0, 10)]));
    const ref = { pathId: 'a', subpathIndex: 0, nodeIndex: 0 };
    expect(canRemoveNode(d, ref)).toBe(true);
    removeNode(d, ref);
    expect(canRemoveNode(d, ref)).toBe(false);

    d.paths[0].subpaths[0].closed = false;
    expect(canRemoveNode(d, ref)).toBe(true);
  });
});

describe('path mutations', () => {
  it('removePath and insertPath restore z-order', () => {
    const d = doc(path('a', [square(0, 0, 10)]), path('b', [square(20, 20, 10)]), path('c', [square(40, 40, 10)]));
    const before = structuredClone(d);

    const removed = removePath(d, 'b')!;
    expect(removed.index).toBe(1);
    expect(d.paths.map((p) => p.id)).toEqual(['a', 'c']);

    insertPath(d, removed.index, removed.path);
    expect(d).toEqual(before);
  });

  it('removePath reports a miss', () => {
    expect(removePath(doc(path('a', [square(0, 0, 10)])), 'nope')).toBeNull();
  });
});

describe('hit testing', () => {
  const d = doc(path('a', [square(0, 0, 10)]), path('b', [square(100, 100, 10)]));

  it('finds a node within the radius and nothing outside it', () => {
    expect(hitTestNode(d, { x: 10.5, y: 0.4 }, 2)).toEqual({
      pathId: 'a',
      subpathIndex: 0,
      nodeIndex: 1,
    });
    expect(hitTestNode(d, { x: 50, y: 50 }, 2)).toBeNull();
  });

  it('prefers a node on the selected path over a closer one elsewhere', () => {
    const overlapping = doc(path('a', [square(0, 0, 10)]), path('b', [square(0.5, 0, 10)]));
    // Without a preference the nearer 'b' node wins.
    expect(hitTestNode(overlapping, { x: 0.4, y: 0 }, 3)?.pathId).toBe('b');
    expect(hitTestNode(overlapping, { x: 0.4, y: 0 }, 3, 'a')?.pathId).toBe('a');
  });

  it('skips hidden paths', () => {
    const hidden = doc({ ...path('a', [square(0, 0, 10)]), visible: false });
    expect(hitTestNode(hidden, { x: 0, y: 0 }, 2)).toBeNull();
    expect(hitTestPath(hidden, { x: 5, y: 5 })).toBeNull();
  });

  it('projects onto a segment and reports the splice index that splits it', () => {
    const hit = hitTestSegment(d, { x: 5, y: 0.5 }, 2)!;
    expect(hit.projected).toEqual({ x: 5, y: 0 });
    // Segment 0 runs node 0 -> node 1, so the new node belongs at index 1.
    expect(hit.ref.nodeIndex).toBe(1);

    insertNode(d, hit.ref, hit.projected);
    expect(d.paths[0].subpaths[0].nodes[1]).toEqual({ x: 5, y: 0 });
    removeNode(d, hit.ref);
  });

  it('includes the closing segment of a closed subpath', () => {
    // The 3 -> 0 edge only exists because the ring is closed.
    const hit = hitTestSegment(d, { x: 0.2, y: 5 }, 2)!;
    expect(hit.projected).toEqual({ x: 0, y: 5 });
    expect(hit.ref.nodeIndex).toBe(4);
  });

  it('can restrict segment hits to one path', () => {
    expect(hitTestSegment(d, { x: 5, y: 0.5 }, 2, 'b')).toBeNull();
  });

  it('selects the topmost path containing the point', () => {
    const stacked = doc(path('under', [square(0, 0, 50)]), path('over', [square(10, 10, 20)]));
    expect(hitTestPath(stacked, { x: 15, y: 15 })).toBe('over');
    expect(hitTestPath(stacked, { x: 45, y: 45 })).toBe('under');
    expect(hitTestPath(stacked, { x: 90, y: 90 })).toBeNull();
  });

  it('treats a hole as outside the path', () => {
    const donut = doc(path('d', [square(0, 0, 50), square(10, 10, 20)]));
    expect(hitTestPath(donut, { x: 5, y: 5 })).toBe('d');
    expect(hitTestPath(donut, { x: 20, y: 20 })).toBeNull();
  });
});
