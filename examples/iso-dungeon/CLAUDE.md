<!-- artgen:begin — managed by the artgen installer; `update` rewrites this section -->
## Sending feedback back to artgen
- A render that is wrong, or something artgen can't do yet: `node tools/artgen/artgen.js report <asset|map|dungeon|settlement id> --note "what is wrong"`
  (`artgen-maps.js report …` where only the maps module is installed) writes `art/feedback/<date>-<id>/`: the input file,
  the command, the versions, the render, the ledger lines and a `case.md`, plus `ISSUE.md`, the text of the issue. Nothing
  is sent: show the user the folder, and only when they agree run it again with `--issue` (or give them the link it prints).
- A fix you made to an installed skill, command or template (`/artgen-upstream`): `node tools/artgen/artgen.js upstream` writes your local edits as a
  patch against their sources in the artgen repo, so the edit is not lost at the next `update`.
- Counts and ratios from the ledger (`node tools/artgen/artgen.js metrics export`, art module) go to `art/metrics/`; nothing else leaves the repo.

## Image tools
- Pictures to shapes, tokens, cells and palettes need no project: `node tools/artgen/artgen.js trace|slice <image.png>`, `node tools/artgen/artgen.js quantize <image.png>`, `node tools/artgen/artgen.js rotate <image.png> --deg n`
  (`/artgen-image` says when to use which). A traced sketch becomes an asset's base with `trace-base <asset> <image.png>` (art module) or paint edits on a map
  with `map trace <id> <image.png>`; `cut <asset|image.png>` makes a token from an approved asset (art module).

## Art pipeline (artgen)
- Game art lives in `art/`: `direction.json` (the locked style bible), `briefs.yaml`, `assets/` (asset sources as
  code), `anchors/`, `ledger.jsonl`. Renders under `out/` are rebuilt from sources.
- Use the **art-direction** skill (`/artgen-direction`) to set or change the art direction, the **asset-production**
  skill (`/artgen-brief`, `/artgen-make`, `/artgen-review`, `/artgen-feedback`, `/artgen-approve`, `/artgen-export`,
  `/artgen-restyle`) to produce, show, approve and export assets, the **artgen** skill for authoring sprite, prop, tile
  or effect sources; the **art-reviewer** subagent scores versions, **art-maker** subagents write one asset each in a
  parallel `make` round.
- Game code reads art through the vendored runtime in `src/art/runtime/` (`export --runtime`; never edit it by hand
  unless you mean to keep a local fork) and the typed ids in `src/art/assets.ts` (generated — don't edit).
- The pipeline runs autonomously: don't ask the user between passes; they see finished assets and approve or give
  feedback. Only the user approves (`artgen approve`).
- The user may also work in the **image tools** web app (Art Direction, Asset Review, Asset Lab), which opens this
  repo's `art/` and writes the same files: ledger lines with `"via": "image-tools"` are the user's own approvals and
  feedback (feedback may pin a `region` / `cell`), drafts land in `art/candidates/`, and a direction locked there bumps
  the version — run `/artgen-restyle`. Re-read files every run; `node tools/artgen/artgen.js status` shows where things stand.
- Gates: `artgen init` gates the **shape** of characters and creatures (`review.gates`; a brief's `gates` replace them). v1 is then a
  silhouette draft and the pipeline waits for the user's `artgen stage approve|reject <id> shape` before decorating; `artgen placeholder <id>` and
  `artgen export --placeholders` put a stand-in in the game from day one. `artgen stages <id>` shows what the user has approved.
- Never hard-code palette colours, the outline colour, light or sizes in asset code: read them from `ctx.dir` (R11).
- Never edit a version that has a score; write the next `base.vN.js` / `finish.vM.js` (R10).
- CLI: `node tools/artgen/artgen.js <command>` (no npm install needed); the `artgen` MCP server exposes the same tools (images come back
  inline). Python scripts can use the `artgen` client (`python/artgen` in the artgen repo), which calls this CLI.

## Tabletop maps (artgen)
- Tabletop terrain maps live in `art/maps/<id>/map.json` (renders in `out/`): use the **terrain-map** skill
  (`/artgen-map`). The web app's **Terrain Map** tool edits the same file; re-read it before changing a map.
- Tabletop dungeon maps live in `art/dungeons/<id>/dungeon.json` (renders in `out/`): use the **dungeon-map** skill
  (`/artgen-dungeon`). The web app's **Dungeon Map** tool edits the same file; re-read it before changing a dungeon.
- Tabletop settlement maps (villages, towns, castles and their buildings' floor plans) live in
  `art/settlements/<id>/settlement.json` (renders in `out/`): use the **settlement-map** skill (`/artgen-settlement`).
  The web app's **Settlement Map** tool edits the same file; re-read it before changing a settlement.
- CLI: `node tools/artgen/artgen.js <command>` with `map`, `dungeon` or `settlement` (no npm install needed); every command takes `--json`, and `--file <path>` in place of an id.
- Workflow: write the brief (`node tools/artgen/artgen.js <kind> brief <id> --text "…"`), generate and edit, record a version (`<kind> version <id>`), review it (`<kind> review <id>`), show the user, then `approve` or `feedback`. **Only the user approves** (over MCP `user_approved`). Versions sit beside the file (`map.v1.json`); `<kind> status` says where each one is. Asset Review in `node tools/artgen/artgen.js ui` lists maps with the assets. These commands need the project (`art/`), not `--file`.
<!-- artgen:end -->
