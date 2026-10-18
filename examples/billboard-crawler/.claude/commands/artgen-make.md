---
description: Run the art pipeline autonomously over the briefs (v1–v3 + finish per asset) until every asset is final
argument-hint: [brief ids | all]
---
Use the asset-production skill and run the autonomous loop with `node tools/artgen/artgen.js make $ARGUMENTS`: do each step it names
(adapt templates, review + score through the art-reviewer subagent, revisions, finishing pass) and call it again, without
asking the user, until nothing is left. With three or more assets in the pipeline, run parallel rounds instead
(`node tools/artgen/artgen.js make $ARGUMENTS --parallel 4`, with `--wave 10` for big batches: one art-maker subagent per maker packet,
reviews stay with you — see the skill). When `make` holds assets for the v1 roster, run it (`node tools/artgen/artgen.js roster --stage
v1`, a fresh art-reviewer, `roster record`) and go on. After a pause, just call `make` again: it resumes from the
ledger. Then the final roster review, then show the gallery (`node tools/artgen/artgen.js gallery`).
