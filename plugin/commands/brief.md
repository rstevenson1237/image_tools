---
description: Add asset briefs (art/briefs.yaml) for the art pipeline
argument-hint: [what the game needs]
---
Use the asset-production skill: turn this into briefs with `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" brief add …` (one per asset, kinds and
animation states from the description), then show `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" brief list`. Request: $ARGUMENTS
