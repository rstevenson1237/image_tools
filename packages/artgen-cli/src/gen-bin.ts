#!/usr/bin/env node
/** `npm run gen:ops`: write the Python client's generated methods and the operations reference from the registry. */
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';

// the runtime package imports its siblings as `./x.js`: fall back to `./x.ts` here, as `bin.ts` does
const hook = `export async function resolve(s, c, next) {
  try { return await next(s, c); } catch (e) { if (s.startsWith('.') && s.endsWith('.js')) return next(s.slice(0, -3) + '.ts', c); throw e; }
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`);

const { operationsDoc, pythonOps } = await import('./ops/gen.ts');
const { OPS } = await import('./ops/index.ts');
const repo = new URL('../../../', import.meta.url);
writeFileSync(new URL('python/artgen/src/artgen/_ops.py', repo), pythonOps(OPS));
writeFileSync(new URL('docs/OPERATIONS.md', repo), operationsDoc(OPS));
console.log(`${OPS.length} operations -> python/artgen/src/artgen/_ops.py, docs/OPERATIONS.md`);
