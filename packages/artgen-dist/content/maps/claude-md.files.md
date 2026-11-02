## Tabletop maps (artgen)
- This repo writes its own map files and names each with `--file <path>`: `{{ARTGEN}} <map|dungeon|settlement> <command> --file <path> --json`.
  There is no `art/` project, so the steps that need one (`new <id>`, `brief`, `version`, `review`, `approve`, `ui`) do not apply.
- The **terrain-map**, **dungeon-map** and **settlement-map** skills say what each file can hold; `artgen schema <kind> --keys` lists every key.
  `check --json` lists the file's errors and warnings (each with an `id`), `facts --json` reads it back as numbers.
