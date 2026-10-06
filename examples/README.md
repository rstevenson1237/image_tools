# Fixture game repos

Acceptance environments for artgen (PLAN §1). Each starts from a one-paragraph pitch (its README) and is built only
through the committed install, as a real game repo would be: `.claude/`, `tools/artgen/`, `.mcp.json`, `CLAUDE.md`
and `art/` are what `install.mjs init` and the W1 workflow wrote.

| Fixture | Engine (P4) | View | State |
|---|---|---|---|
| `swamp-topdown` | Pixi.js | top-down | W1 done: direction locked (mix of A + B), anchors, style sheet |
| `iso-dungeon` | Pixi.js | iso | W1 done: direction locked (mix of C + A), anchors, style sheet |
| `billboard-crawler` | three.js | first-person billboards | W1 done (topdown probes until the fp view lands in P6d) |

The generated bundles and wasm in `tools/artgen/` are gitignored here to keep this repo small; restore them with
`npm run fixtures:install` (builds `packages/artgen-dist` and runs `install.mjs update` in each fixture). Then, inside a
fixture: `node tools/artgen/artgen.js direction show`.

The W1 user choices recorded in these fixtures were simulated by the agent (see each `art/ledger.jsonl` lock note).
