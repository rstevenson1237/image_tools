## Art pipeline (artgen)
- Game art lives in `art/`: `direction.json` (the locked style bible), `briefs.yaml`, `assets/` (asset sources as
  code), `anchors/`, `ledger.jsonl`. Renders under `out/` are rebuilt from sources.
- Use the **art-direction** skill ({{CMD_DIRECTION}}) to set or change the art direction, the **asset-production**
  skill (`{{CMD}}brief`, `{{CMD}}make`, `{{CMD}}review`, `{{CMD}}feedback`, `{{CMD}}approve`, `{{CMD}}export`,
  `{{CMD}}restyle`) to produce, show, approve and export assets, the **artgen** skill for authoring sprite, prop, tile
  or effect sources; the **art-reviewer** subagent scores versions, **art-maker** subagents write one asset each in a
  parallel `make` round.
- Game code reads art through the vendored runtime in `src/art/runtime/` (`export --runtime`; never edit it by hand
  unless you mean to keep a local fork) and the typed ids in `src/art/assets.ts` (generated — don't edit).
- The pipeline runs autonomously: don't ask the user between passes; they see finished assets and approve or give
  feedback. Only the user approves (`artgen approve`).
- The user may also work in the **image tools** web app (Art Direction, Asset Review, Asset Lab), which opens this
  repo's `art/` and writes the same files: ledger lines with `"via": "image-tools"` are the user's own approvals and
  feedback (feedback may pin a `region` / `cell`), drafts land in `art/candidates/`, and a direction locked there bumps
  the version — run `{{CMD}}restyle`. Re-read files every run; `{{ARTGEN}} status` shows where things stand.
- Never hard-code palette colours, the outline colour, light or sizes in asset code: read them from `ctx.dir` (R11).
- Never edit a version that has a score; write the next `base.vN.js` / `finish.vM.js` (R10).
- CLI: `{{ARTGEN}} <command>` (no npm install needed); the `artgen` MCP server exposes the same tools (images come back
  inline). Python scripts can use the `artgen` client (`python/artgen` in the artgen repo), which calls this CLI.
