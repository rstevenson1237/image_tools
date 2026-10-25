---
description: Make or change a tabletop settlement map (village, town, city or castle) and its buildings' floor plans
argument-hint: [what the settlement should be, or a settlement id and the change]
---
Use the settlement-map skill. If this names an existing settlement (`node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" settlement list`), re-read it with
`node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" settlement show <id>` and make the change; otherwise ask the few questions the skill lists, create the
settlement, and iterate: render, look at the PNG, adjust. Finish with `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" settlement render <id>` (and the
floor plans the user asked for) and show the user the image and the file paths.
Request: $ARGUMENTS
