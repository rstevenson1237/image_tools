# Fixture game repos

Acceptance environments for artgen (PLAN §1). Each starts from a one-paragraph pitch (its README) and is built only
through the committed install, as a real game repo would be: `.claude/`, `tools/artgen/`, `.mcp.json`, `CLAUDE.md`
and `art/` are what `install.mjs init`, the W1 workflow and the W2 production run wrote; `public/assets/main/` and
`src/art/assets.ts` are the exported pack, `src/art/runtime/` the vendored W3 runtime (`export --runtime`), and
`src/main.ts` the game that plays it (`index.html`, `package.json`: Vite + the engine).

| Fixture | Engine (P4) | View | State |
|---|---|---|---|
| `swamp-topdown` | Pixi.js | top-down | W1 + W2 + W3: 10 assets approved and exported, direction v2 restyle; game: 8-dir walker, tile map, looping effects, palette swap |
| `iso-dungeon` | Pixi.js | iso | W1 + W2 + W3: 10 assets approved and exported, direction v2 restyle; game: iso floor, depth-sorted props, torch flames, states and swaps |
| `billboard-crawler` | three.js | first-person billboards | W1 + W2 + W3: 10 assets approved and exported; game: 8-direction ghoul billboard walking round a moving camera on textured floor and walls; topdown templates until P6d |

The generated bundles and wasm in `tools/artgen/` are gitignored here to keep this repo small; restore them with
`npm run fixtures:install` (builds `packages/artgen-dist` and runs `install.mjs update` in each fixture). Then, inside a
fixture: `node tools/artgen/artgen.js direction show`, `… status`, `… analytics`. The games run with
`node ../../node_modules/vite/bin/vite.js` from a fixture (they resolve `pixi.js` / `three` from this checkout's
`node_modules`), or `npm install && npm run dev` in a standalone copy.

The W1 and W2 user choices recorded in these fixtures (locks, approvals, feedback) were simulated by the agent, and the W2
reviews were scored by the authoring agent itself (see the notes in each `art/ledger.jsonl`).
