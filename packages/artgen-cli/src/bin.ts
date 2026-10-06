#!/usr/bin/env node
/** `artgen` executable (`npx artgen …` in this repo; `node tools/artgen/artgen.js …` in the committed install). */
import { main } from './cli.ts';

main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
