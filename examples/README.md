# Fixture game repos

Acceptance environments for artgen (PLAN §1). Each starts from a one-paragraph pitch (its README) and is built only
through the committed install, as a real game repo would be: `.claude/`, `tools/artgen/`, `.mcp.json`, `CLAUDE.md`
and `art/` are what `install.mjs init`, the W1 workflow and the W2 production run wrote; `public/assets/main/` and
`src/art/assets.ts` are the exported pack.

| Fixture | Engine (P4) | View | State |
|---|---|---|---|
| `swamp-topdown` | Pixi.js | top-down | W1 + W2 done: 10 assets approved and exported, direction v2 restyle |
| `iso-dungeon` | Pixi.js | iso | W1 + W2 done: 10 assets approved and exported, direction v2 restyle |
| `billboard-crawler` | three.js | first-person billboards | W1 + W2 done: 10 assets (8-direction ghoul billboard) approved and exported; topdown templates until P6d |

The generated bundles and wasm in `tools/artgen/` are gitignored here to keep this repo small; restore them with
`npm run fixtures:install` (builds `packages/artgen-dist` and runs `install.mjs update` in each fixture). Then, inside a
fixture: `node tools/artgen/artgen.js direction show`, `… status`, `… analytics`.

The W1 and W2 user choices recorded in these fixtures (locks, approvals, feedback) were simulated by the agent, and the W2
reviews were scored by the authoring agent itself (see the notes in each `art/ledger.jsonl`).
