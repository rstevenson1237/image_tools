import { describe, expect, it } from 'vitest';
import { defaultPathStyle, type VecDocument, type VecPath } from './model';
import { documentToSvg, pathToSvgD, suggestSvgFilename } from './svg';

function path(overrides: Partial<VecPath> = {}): VecPath {
  return {
    id: 'a',
    name: 'Shape 1',
    subpaths: [
      {
        nodes: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        closed: true,
      },
    ],
    style: { ...defaultPathStyle },
    visible: true,
    ...overrides,
  };
}

function doc(...paths: VecPath[]): VecDocument {
  return { width: 64, height: 32, paths };
}

describe('pathToSvgD', () => {
  it('emits M/L commands and closes a closed subpath', () => {
    expect(pathToSvgD(path(), 2)).toBe('M 0 0 L 10 0 L 10 10 Z');
  });

  it('leaves an open subpath unclosed', () => {
    const open = path({ subpaths: [{ nodes: [{ x: 0, y: 0 }, { x: 5, y: 5 }], closed: false }] });
    expect(pathToSvgD(open, 2)).toBe('M 0 0 L 5 5');
  });

  it('rounds to the requested precision without trailing zeros', () => {
    const fractional = path({
      subpaths: [
        {
          nodes: [
            { x: 1.23456, y: 2.5 },
            { x: 3.99999, y: 0 },
            { x: 5, y: 5 },
          ],
          closed: true,
        },
      ],
    });
    expect(pathToSvgD(fractional, 2)).toBe('M 1.23 2.5 L 4 0 L 5 5 Z');
    expect(pathToSvgD(fractional, 0)).toBe('M 1 3 L 4 0 L 5 5 Z');
  });

  it('applies the coordinate transform when given one', () => {
    const scaled = pathToSvgD(path(), 2, (p) => ({ x: p.x * 2 + 1, y: p.y * 2 + 1 }));
    expect(scaled).toBe('M 1 1 L 21 1 L 21 21 Z');
  });

  it('joins every subpath into one d, so holes stay holes', () => {
    const donut = path({
      subpaths: [
        { nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true },
        { nodes: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }], closed: true },
      ],
    });
    expect(pathToSvgD(donut, 2)).toBe('M 0 0 L 10 0 L 10 10 Z M 2 2 L 4 2 L 4 4 Z');
  });

  it('skips a subpath that cannot form a line', () => {
    expect(pathToSvgD(path({ subpaths: [{ nodes: [{ x: 1, y: 1 }], closed: true }] }), 2)).toBe('');
  });
});

describe('documentToSvg', () => {
  it('sets width, height and a matching viewBox', () => {
    expect(documentToSvg(doc(path()))).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32">',
    );
  });

  it('emits no transform anywhere, so coordinates are source pixels', () => {
    expect(documentToSvg(doc(path()))).not.toContain('transform');
  });

  it('states fill-rule only for evenodd fills', () => {
    expect(documentToSvg(doc(path()))).toContain('fill-rule="evenodd"');

    const nonzero = path({ style: { ...defaultPathStyle, fillRule: 'nonzero' } });
    expect(documentToSvg(doc(nonzero))).not.toContain('fill-rule');

    const unfilled = path({ style: { ...defaultPathStyle, fill: null, fillRule: 'evenodd' } });
    const svg = documentToSvg(doc(unfilled));
    expect(svg).toContain('fill="none"');
    expect(svg).not.toContain('fill-rule');
  });

  it('omits style attributes that are already at their SVG default', () => {
    const svg = documentToSvg(doc(path()));
    expect(svg).not.toContain('fill-opacity');
    expect(svg).not.toContain('stroke');
  });

  it('emits stroke attributes when a stroke is set', () => {
    const stroked = path({
      style: { ...defaultPathStyle, stroke: '#123456', strokeWidth: 2, strokeOpacity: 0.5 },
    });
    const svg = documentToSvg(doc(stroked));
    expect(svg).toContain('stroke="#123456"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('stroke-opacity="0.5"');
  });

  it('replaces any colour that is not a plain 6-digit hex with black', () => {
    const injected = path({
      style: {
        ...defaultPathStyle,
        fill: '#fff" onload="alert(1)',
        stroke: 'url(#evil)',
      },
    });
    const svg = documentToSvg(doc(injected));
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).not.toContain('onload');
    expect(svg).not.toContain('url(');
  });

  it('accepts uppercase hex and normalises it', () => {
    const upper = path({ style: { ...defaultPathStyle, fill: '#AABBCC' } });
    expect(documentToSvg(doc(upper))).toContain('fill="#aabbcc"');
  });

  it('never writes a path name into the output', () => {
    expect(documentToSvg(doc(path({ name: 'unique-marker-text' })))).not.toContain(
      'unique-marker-text',
    );
  });

  it('skips hidden paths and paths with no drawable geometry', () => {
    expect(documentToSvg(doc(path({ visible: false })))).not.toContain('<path');
    expect(
      documentToSvg(doc(path({ subpaths: [{ nodes: [{ x: 0, y: 0 }], closed: true }] }))),
    ).not.toContain('<path');
  });

  it('emits an optional background rect, validated the same way', () => {
    expect(documentToSvg(doc(path()), { background: '#101010' })).toContain(
      '<rect width="64" height="32" fill="#101010"/>',
    );
    expect(documentToSvg(doc(path()), { background: 'javascript:x' })).toContain('fill="#000000"');
    expect(documentToSvg(doc(path()))).not.toContain('<rect');
  });

  it('preserves document order, which is paint order', () => {
    const svg = documentToSvg(doc(path({ id: 'under' }), path({ id: 'over' })));
    expect(svg.match(/<path/g)).toHaveLength(2);
  });
});

describe('suggestSvgFilename', () => {
  it('swaps the extension', () => {
    expect(suggestSvgFilename('goblin.png')).toBe('goblin.svg');
    expect(suggestSvgFilename('a.b.jpeg')).toBe('a.b.svg');
  });

  it('handles a name with no extension and an empty name', () => {
    expect(suggestSvgFilename('goblin')).toBe('goblin.svg');
    expect(suggestSvgFilename('.png')).toBe('traced.svg');
  });
});
