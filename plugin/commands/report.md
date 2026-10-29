---
description: Write a feedback bundle for artgen (a wrong render, a missing feature) from an asset, map, dungeon or settlement
argument-hint: <id> <what is wrong>
---
Write the feedback bundle: `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" report <id> --note "<what is wrong, in the user's words>"`. In a repo that has only the maps module the
program is `artgen-maps.js` and the command is the same. For a map file outside a project, give `--file <path>` in place of the id.

Then read `art/feedback/<date>-<id>/case.md` and `ISSUE.md` and tell the user in two lines what is in the bundle (the input file, the command,
the versions, the render) and that nothing has left this machine. Ask whether to send it. Only when they say yes run `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" report <id>
--issue` (it opens the issue on the artgen repo when `GH_TOKEN` or `GITHUB_TOKEN` is set; otherwise it prints a link for the user to open, or
they can paste `ISSUE.md` into a new issue themselves). Don't edit the bundle to make the report look better.

Report: $ARGUMENTS
