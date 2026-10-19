#!/usr/bin/env node
/** `artgen-maps.js`: the map and dungeon engines alone (`map`, `dungeon`, `formats`), with no pixel-art pipeline. */
import { mapsMain } from './maps-cli.ts';

mapsMain(process.argv.slice(2)).then(code => process.exit(code), e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
