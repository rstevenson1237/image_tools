# Example games

Three small games built entirely with artgen; its tests also use them as acceptance fixtures. Each starts from a one-paragraph pitch (its README) and is built only
through the committed install, as a real game repo would be: `.claude/`, `tools/artgen/`, `.mcp.json`, `CLAUDE.md`
and `art/` are what `install.mjs init`, the art-direction workflow and the production run wrote; `public/assets/main/` and
`src/art/assets.ts` are the exported pack, `src/art/runtime/` the vendored runtime (`export --runtime`), and
`src/main.ts` the game that plays it (`index.html`, `package.json`: Vite + the engine).

| Game | Engine | View | State |
|---|---|---|---|
| `swamp-topdown` | Pixi.js | top-down | direction locked, 10 assets approved and exported, direction v2 restyle; game: 8-dir walker, tile map, looping effects, palette swap |
| `iso-dungeon` | Pixi.js | iso | direction locked, 10 assets approved and exported, direction v2 restyle; game: iso floor, depth-sorted props, torch flames, states and swaps |
| `billboard-crawler` | three.js | first-person billboards | direction locked, 10 assets approved and exported; game: 8-direction ghoul billboard, lit by the player's lamp, walking round a moving camera on textured floor and walls |

The generated bundles and wasm in `tools/artgen/` are gitignored here to keep this repo small; restore them with
`npm run fixtures:install` (builds `packages/artgen-dist` and runs `install.mjs update` in each fixture). Then, inside a
fixture: `node tools/artgen/artgen.js direction show`, `… status`, `… analytics`. The games run with
`node ../../node_modules/vite/bin/vite.js` from a fixture (they resolve `pixi.js` / `three` from this checkout's
`node_modules`), or `npm install && npm run dev` in a standalone copy.

The user choices recorded in these fixtures (locks, approvals, feedback) were simulated by the agent, and most
reviews were scored by the authoring agent itself (see the notes in each `art/ledger.jsonl`).
