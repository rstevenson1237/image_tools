import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script, no declarations
import { findViolations, layerOf, summarize } from './check-boundaries.mjs';

const CORE = 'packages/artgen-core/src/';
const dirs: string[] = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

function repo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'boundaries-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

describe('layerOf', () => {
  it('sorts artgen-core paths into the planned layers', () => {
    expect(layerOf(CORE + 'lib/rng.ts')).toBe('primitives');
    expect(layerOf(CORE + 't2/geom.ts')).toBe('primitives');
    expect(layerOf(CORE + 't2/scene.ts')).toBe('scene');
    expect(layerOf(CORE + 'voxel/voxel.ts')).toBe('scene');
    expect(layerOf(CORE + 'qa/ledger.ts')).toBe('workflow');
    expect(layerOf(CORE + 'qa/conformance.ts')).toBe('artgen');
    expect(layerOf(CORE + 'dungeon/gen.ts')).toBe('mapgen');
    expect(layerOf(CORE + 'maps.ts')).toBe('mapgen');
    expect(layerOf('packages/artgen-runtime/src/runtime.ts')).toBe('runtime');
    expect(layerOf('src/tools/TokenCutter/x.ts')).toBe('interface');
  });
  it('leaves the facade, the bench and tests out', () => {
    expect(layerOf(CORE + 'index.ts')).toBeUndefined();
    expect(layerOf('packages/artgen-core/bench/index.ts')).toBeUndefined();
    expect(layerOf(CORE + 'lib/grid.test.ts')).toBeUndefined();
  });
});

describe('findViolations', () => {
  it('reports an import that points up a layer, with its line', () => {
    const dir = repo({
      [CORE + 'lib/rng.ts']: 'export const r = 1;\n',
      [CORE + 'direction.ts']: 'export type D = 1;\n',
      [CORE + 't2/scene.ts']: "import { r } from '../lib/rng.ts';\n\nimport type { D } from '../direction.ts';\n",
    });
    const v = findViolations(dir);
    expect(v).toEqual([{ file: CORE + 't2/scene.ts', line: 3, from: 'scene', to: 'artgen', spec: '../direction.ts' }]);
    expect(summarize(v)).toEqual({ total: 1, byArrow: { 'scene -> artgen': 1 } });
  });
  it('allows imports down the stack and from interfaces', () => {
    const dir = repo({
      [CORE + 'lib/rng.ts']: 'export const r = 1;\n',
      [CORE + 't2/scene.ts']: "import { r } from '../lib/rng.ts';\nexport const s = r;\n",
      [CORE + 'w2/pack.ts']: "import { s } from '../t2/scene.ts';\nexport const p = s;\n",
      'packages/artgen-cli/src/cli.ts': "import { p } from 'artgen-core';\nimport { s } from '../../artgen-core/src/t2/scene.ts';\nexport default [p, s];\n",
    });
    expect(findViolations(dir)).toEqual([]);
  });
  it('flags a layer that imports the facade or a sibling it may not use', () => {
    const dir = repo({
      [CORE + 'index.ts']: 'export {};\n',
      [CORE + 'map/a.ts']: "export * from '../index.ts';\n",
      [CORE + 'dungeon/b.ts']: "import '../w2/pack.ts';\n",
      [CORE + 'w2/pack.ts']: 'export {};\n',
    });
    expect(summarize(findViolations(dir)).byArrow).toEqual({ 'mapgen -> artgen': 1, 'mapgen -> facade': 1 });
  });
});
