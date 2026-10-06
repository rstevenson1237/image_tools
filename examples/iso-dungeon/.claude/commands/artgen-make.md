---
description: Run the art pipeline autonomously over the briefs (v1–v3 + finish per asset) until every asset is final
argument-hint: [brief ids | all]
---
Use the asset-production skill and run the autonomous loop with `node tools/artgen/artgen.js make $ARGUMENTS`: do each step it names
(adapt templates, review + score through the art-reviewer subagent, revisions, finishing pass) and call it again, without
asking the user, until nothing is left. Then show the gallery (`node tools/artgen/artgen.js gallery`).
