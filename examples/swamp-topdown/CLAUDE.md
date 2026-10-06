<!-- artgen:begin — managed by the artgen installer; `update` rewrites this section -->
## Art pipeline (artgen)
- Game art lives in `art/`: `direction.json` (the locked style bible), `briefs.yaml`, `assets/` (asset sources as
  code), `anchors/`, `ledger.jsonl`. Renders under `out/` are rebuilt from sources.
- Use the **art-direction** skill (`/artgen-direction`) to set or change the art direction, the **artgen** skill for any
  sprite, prop, tile or effect work; the **art-reviewer** subagent scores versions.
- Never hard-code palette colours, the outline colour, light or sizes in asset code: read them from `ctx.dir` (R11).
- Never edit a version that has a score; write the next `base.vN.js` / `finish.vM.js` (R10).
- CLI: `node tools/artgen/artgen.js <command>` (no npm install needed); the `artgen` MCP server exposes the same tools.
<!-- artgen:end -->
