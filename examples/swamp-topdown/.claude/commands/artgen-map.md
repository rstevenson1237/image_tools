---
description: Make or change a tabletop terrain map (regional hex crawl or local battle map), in colour and B/W
argument-hint: [what the map should show, or a map id and the change]
---
Use the terrain-map skill. If this names an existing map (`node tools/artgen/artgen.js map list`), re-read it with `node tools/artgen/artgen.js map show
<id>` and make the change; otherwise ask the few questions the skill lists, create the map, and iterate: render, look at
the PNG, adjust. Finish with `node tools/artgen/artgen.js map render <id> --theme both` and show the user both images and the file paths.
Request: $ARGUMENTS
