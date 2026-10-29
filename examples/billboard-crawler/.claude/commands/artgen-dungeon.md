---
description: Make or change a tabletop dungeon or lair map (one room or a whole complex), black and white
argument-hint: [what the dungeon should be, or a dungeon id and the change]
---
Use the dungeon-map skill. If this names an existing dungeon (`node tools/artgen/artgen-maps.js dungeon list`), re-read it with
`node tools/artgen/artgen-maps.js dungeon show <id>` and make the change; otherwise ask the few questions the skill lists, create the dungeon
(or the single room), and iterate: render, look at the PNG, adjust. Finish with `node tools/artgen/artgen-maps.js dungeon render <id>` and
show the user the image and the file paths.
Before you generate, write the brief (`node tools/artgen/artgen-maps.js dungeon brief <id> --text "…"`); when a round is done record it (`node tools/artgen/artgen-maps.js dungeon version <id>`), review it (`node tools/artgen/artgen-maps.js dungeon review <id>`) and show the user the sheet. Only the user approves or asks for changes (the skill's step 5).
Request: $ARGUMENTS
