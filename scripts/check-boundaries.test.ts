import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script, no declarations
import { findViolations, layerOf, summarize } from './check-boundaries.mjs';

const CORE = 'packages/artgen-core/src/';
const PRIM = 'packages/artgen-primitives/src/';
const SCENE = 'packages/artgen-scene/src/';
const MAP = 'packages/artgen-mapgen/src/';
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
  it('sorts paths into the layers, one package per layer', () => {
    expect(layerOf(PRIM + 'lib/rng.ts')).toBe('primitives');
    expect(layerOf(SCENE + 't2/scene.ts')).toBe('scene');
    expect(layerOf(SCENE + 'direction.ts')).toBe('scene');
    expect(layerOf(MAP + 'dungeon/gen.ts')).toBe('mapgen');
    expect(layerOf(CORE + 'qa/conformance.ts')).toBe('artgen');
    expect(layerOf(CORE + 'finish.ts')).toBe('artgen');
    expect(layerOf('packages/artgen-runtime/src/runtime.ts')).toBe('runtime');
    expect(layerOf('src/tools/TokenCutter/x.ts')).toBe('interface');
  });
  it('leaves the facade and the bench out', () => {
    expect(layerOf(CORE + 'index.ts')).toBeUndefined();
    expect(layerOf(CORE + 'maps.ts')).toBeUndefined();
    expect(layerOf('packages/artgen-core/bench/index.ts')).toBeUndefined();
  });
});

describe('findViolations', () => {
  it('reports an import that points up a layer, with its line', () => {
    const dir = repo({
      [PRIM + 'lib/rng.ts']: 'export const r = 1;\n',
      [CORE + 'render.ts']: 'export type R = 1;\n',
      [SCENE + 't2/scene.ts']: "import { r } from 'artgen-primitives/lib/rng.ts';\n\nimport type { R } from '../../../artgen-core/src/render.ts';\n",
    });
    const v = findViolations(dir);
    expect(v).toEqual([{ file: SCENE + 't2/scene.ts', line: 3, from: 'scene', to: 'artgen', spec: '../../../artgen-core/src/render.ts' }]);
    expect(summarize(v)).toEqual({ total: 1, byArrow: { 'scene -> artgen': 1 } });
  });
  it('allows imports down the stack, by package name or by path, and from interfaces', () => {
    const dir = repo({
      [PRIM + 'lib/rng.ts']: 'export const r = 1;\n',
      [SCENE + 't2/scene.ts']: "import { r } from 'artgen-primitives/lib/rng.ts';\nexport const s = r;\n",
      [CORE + 'w2/pack.ts']: "import { s } from 'artgen-scene/t2/scene.ts';\nexport const p = s;\n",
      'packages/artgen-cli/src/cli.ts': "import { p } from 'artgen-core';\nimport { s } from 'artgen-scene/t2/scene.ts';\nexport default [p, s];\n",
    });
    expect(findViolations(dir)).toEqual([]);
  });
  it('flags a layer that imports the facade or a sibling it may not use', () => {
    const dir = repo({
      [CORE + 'index.ts']: 'export {};\n',
      [MAP + 'map/a.ts']: "export * from 'artgen-core';\n",
      [MAP + 'dungeon/b.ts']: "import 'artgen-scene/t2/scene.ts';\n",
      [SCENE + 't2/scene.ts']: 'export {};\n',
    });
    expect(summarize(findViolations(dir)).byArrow).toEqual({ 'mapgen -> facade': 1, 'mapgen -> scene': 1 });
  });
});
