---
description: Run the art pipeline autonomously over the briefs (v1–v3 + finish per asset) until every asset is final
argument-hint: [brief ids | all]
---
Use the asset-production skill and run the autonomous loop with `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" make $ARGUMENTS`: do each step it names
(adapt templates, review + score through the art-reviewer subagent, revisions, finishing pass) and call it again, without
asking the user, until nothing is left. With three or more assets in the pipeline, run parallel rounds instead
(`node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" make $ARGUMENTS --parallel 4`: one art-maker subagent per maker packet, reviews stay with you — see the
skill). Then the roster review, then show the gallery (`node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" gallery`).
