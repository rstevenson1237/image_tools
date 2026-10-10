---
description: Give feedback on a finished asset (starts a user iteration that runs autonomously)
argument-hint: <brief id> <what to change>
---
Use the asset-production skill §4: pick the route (`base` for form/proportion/colour, `finish` for pixel-level), record
it with `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" feedback <id> --route <route> --note "<the user's words>"`, then run `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" make <id>` until the
asset is final again and show it. Feedback: $ARGUMENTS
