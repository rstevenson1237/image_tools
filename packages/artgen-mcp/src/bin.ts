#!/usr/bin/env node
/** artgen MCP server entry: `node tools/artgen/artgen-mcp.js` (the committed `.mcp.json` entry) or `artgen-mcp`. */
import { register } from 'node:module';

// From this repo's sources (as artgen-cli's bin.ts does): the runtime package imports its siblings as `./x.js`, so
// fall back to `./x.ts` when the `.js` file doesn't exist. The bundle doesn't need it.
const hook = `export async function resolve(s, c, next) {
  try { return await next(s, c); } catch (e) { if (s.startsWith('.') && s.endsWith('.js')) return next(s.slice(0, -3) + '.ts', c); throw e; }
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`);

const { serve } = await import('./server.ts');
void serve().then(() => process.exit(0));
