## Art pipeline (artgen)
- Game art lives in `art/`: `direction.json` (the locked style bible), `briefs.yaml`, `assets/` (asset sources as
  code), `anchors/`, `ledger.jsonl`. Renders under `out/` are rebuilt from sources.
- Use the **art-direction** skill ({{CMD_DIRECTION}}) to set or change the art direction, the **asset-production**
  skill (`{{CMD}}brief`, `{{CMD}}make`, `{{CMD}}review`, `{{CMD}}feedback`, `{{CMD}}approve`, `{{CMD}}export`,
  `{{CMD}}restyle`) to produce, show, approve and export assets, the **artgen** skill for authoring sprite, prop, tile
  or effect sources; the **art-reviewer** subagent scores versions.
- The pipeline runs autonomously: don't ask the user between passes; they see finished assets and approve or give
  feedback. Only the user approves (`artgen approve`).
- Never hard-code palette colours, the outline colour, light or sizes in asset code: read them from `ctx.dir` (R11).
- Never edit a version that has a score; write the next `base.vN.js` / `finish.vM.js` (R10).
- CLI: `{{ARTGEN}} <command>` (no npm install needed); the `artgen` MCP server exposes the same tools.
