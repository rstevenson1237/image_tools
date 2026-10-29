## Tabletop maps (artgen)
- Tabletop terrain maps live in `art/maps/<id>/map.json` (renders in `out/`): use the **terrain-map** skill
  (`{{CMD}}map`). The web app's **Terrain Map** tool edits the same file; re-read it before changing a map.
- Tabletop dungeon maps live in `art/dungeons/<id>/dungeon.json` (renders in `out/`): use the **dungeon-map** skill
  (`{{CMD}}dungeon`). The web app's **Dungeon Map** tool edits the same file; re-read it before changing a dungeon.
- Tabletop settlement maps (villages, towns, castles and their buildings' floor plans) live in
  `art/settlements/<id>/settlement.json` (renders in `out/`): use the **settlement-map** skill (`{{CMD}}settlement`).
  The web app's **Settlement Map** tool edits the same file; re-read it before changing a settlement.
- CLI: `{{ARTGEN}} <command>` with `map`, `dungeon` or `settlement` (no npm install needed); every command takes `--json`, and `--file <path>` in place of an id.
