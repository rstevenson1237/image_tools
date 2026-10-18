---
description: Make or change a tabletop dungeon or lair map (one room or a whole complex), black and white
argument-hint: [what the dungeon should be, or a dungeon id and the change]
---
Use the dungeon-map skill. If this names an existing dungeon (`node tools/artgen/artgen.js dungeon list`), re-read it with
`node tools/artgen/artgen.js dungeon show <id>` and make the change; otherwise ask the few questions the skill lists, create the dungeon
(or the single room), and iterate: render, look at the PNG, adjust. Finish with `node tools/artgen/artgen.js dungeon render <id>` and
show the user the image and the file paths.
Request: $ARGUMENTS
