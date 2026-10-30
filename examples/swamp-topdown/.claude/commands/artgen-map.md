---
description: Make or change a tabletop terrain map (regional hex crawl or local battle map), in colour and B/W
argument-hint: [what the map should show, or a map id and the change]
---
Use the terrain-map skill. If this names an existing map (`node tools/artgen/artgen-maps.js map list`), re-read it with `node tools/artgen/artgen-maps.js map show
<id>` and make the change; otherwise ask the few questions the skill lists, create the map, and iterate: render, look at
the PNG, adjust. Finish with `node tools/artgen/artgen-maps.js map render <id> --theme both` and show the user both images and the file paths.
Before you generate, write the brief (`node tools/artgen/artgen-maps.js map brief <id> --text "…"`); when a round is done record it (`node tools/artgen/artgen-maps.js map version <id>`), review it (`node tools/artgen/artgen-maps.js map review <id>`) and show the user the sheet. Only the user approves or asks for changes (the skill's step 5).
Request: $ARGUMENTS
