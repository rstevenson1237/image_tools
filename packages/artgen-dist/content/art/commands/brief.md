---
description: Add asset briefs (art/briefs.yaml) for the art pipeline
argument-hint: [what the game needs]
---
Use the asset-production skill: turn this into briefs with `{{ARTGEN}} brief add …` (one per asset, kinds and
animation states, `--height` and `--body` from the description), then show `{{ARTGEN}} brief list` and settle every
warning `{{ARTGEN}} brief lint` prints (materials the kind can't colour) with the user before `make`. Request: $ARGUMENTS
