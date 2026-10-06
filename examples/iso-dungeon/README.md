# iso-dungeon (fixture game)

artgen acceptance fixture (PLAN §1): an isometric Pixi.js dungeon crawler, built only through the committed install.

**Pitch.** *Torchdeep* — an isometric, turn-based dungeon crawler. A small party pushes down through torch-lit
crypts, fighting skeleton knights in tight tactical rooms and looting iron-banded chests. Cold blue-grey stone, warm
torchlight, glints of gold.

## Game (W3, PLAN P4)

`src/main.ts` plays the exported pack (`public/assets/main/`) through the runtime vendored by
`node tools/artgen/artgen.js export --runtime` (`src/art/runtime/`, adapter set in `art/artgen.config.json`) and the
typed ids in `src/art/assets.ts`. The lines between the `// art` markers are all of its art code.

The knight (8-facing walk cycle) patrols a 9 × 9 crypt room: iso floor tiles with per-cell variants, depth-sorted
pillars, barrels and rubble (variants), braziers with looping torch flames, an open and a closed chest (states), a
`bloody` palette-swapped skeleton knight and a pulsing slime.

```bash
npm install && npm run dev     # or, inside the image_tools checkout: node ../../node_modules/vite/bin/vite.js
```

Screenshot: [`docs/artgen/findings/p4/iso-dungeon.png`](../../docs/artgen/findings/p4/iso-dungeon.png).
