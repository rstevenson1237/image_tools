/// <reference types="node" />
// PLAN P4 accept: the runtime core is < 8 KB min+gz without adapters, and it imports nothing (no engine, Node or DOM
// modules) — adapters are the only files that import an engine.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { expect, test } from 'vitest';

const SRC = new URL('./', import.meta.url);

test('core bundle (index.ts, no adapters) is under 8 KB min+gz', async () => {
  const r = await build({ entryPoints: [new URL('index.ts', SRC).pathname], bundle: true, minify: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
  const gz = gzipSync(r.outputFiles[0].contents).length;
  expect(gz).toBeLessThan(8 * 1024);
});

test('core files only import each other; each adapter imports only its engine', () => {
  const imports = (f: string) => [...readFileSync(new URL(f, SRC), 'utf8').matchAll(/^(?:import|export)\b[^;]*?from\s+'([^']+)'/gms)].map(m => m[1]);
  const core = readdirSync(SRC).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'testkit.ts');
  for (const f of core) for (const i of imports(f)) expect(i, f).toMatch(/^\.\/[\w-]+\.js$/);
  const engine: Record<string, string | null> = { 'canvas2d.ts': null, 'pixi.ts': 'pixi.js', 'three.ts': 'three' };
  for (const [f, dep] of Object.entries(engine)) for (const i of imports(`adapters/${f}`)) expect(i.startsWith('../') || i === dep, `${f}: ${i}`).toBe(true);
});
