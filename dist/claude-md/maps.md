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
