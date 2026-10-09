#!/usr/bin/env node
/** `artgen` executable (`npx artgen …` in this repo; `node tools/artgen/artgen.js …` in the committed install). */
import { register } from 'node:module';

// In this repo the CLI runs TypeScript sources directly; the runtime package imports its siblings as `./x.js` (it is
// vendored into games that way), so fall back to `./x.ts` when the `.js` file doesn't exist. The bundle doesn't need it.
const hook = `export async function resolve(s, c, next) {
  try { return await next(s, c); } catch (e) { if (s.startsWith('.') && s.endsWith('.js')) return next(s.slice(0, -3) + '.ts', c); throw e; }
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`);

const { main } = await import('./cli.ts');
main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
