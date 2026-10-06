# swamp-topdown (fixture game)

artgen acceptance fixture (PLAN §1): a top-down Pixi.js roguelike, built only through the committed install.

**Pitch.** *Bogwatch* — a top-down swamp roguelike. You are a lantern-bearer wading through a drowned marsh at dusk,
fighting bog goblins, leeches and will-o'-wisps. The lantern is the only warm light: everything else is rot greens,
bone whites and fog.

## Game (W3, PLAN P4)

`src/main.ts` plays the exported pack (`public/assets/main/`) through the runtime vendored by
`node tools/artgen/artgen.js export --runtime` (`src/art/runtime/`, adapter set in `art/artgen.config.json`) and the
typed ids in `src/art/assets.ts`. The lines between the `// art` markers are all of its art code.

The lantern-bearer (8-facing walk cycle) wades a figure-eight round a pond on a mud / bog-water tile map, past scenery
(crate variants, reeds, a lantern post, bones, a wriggling leech, a `pale` palette-swapped bog goblin) while three
will-o'-wisps loop.

```bash
npm install && npm run dev     # or, inside the image_tools checkout: node ../../node_modules/vite/bin/vite.js
```

Screenshot: [`docs/artgen/findings/p4/swamp-topdown.png`](../../docs/artgen/findings/p4/swamp-topdown.png).
