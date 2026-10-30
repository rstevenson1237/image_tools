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
