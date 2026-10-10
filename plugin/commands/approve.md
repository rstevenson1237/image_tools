---
description: Approve finished assets (the user's decision)
argument-hint: <brief ids>
---
For each id the user named, run `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" approve <id>`. If it refuses (gate failing, not final), explain why and
offer feedback instead. Ids: $ARGUMENTS
