---
description: Write a feedback bundle for artgen (a wrong render, a missing feature) from an asset, map, dungeon or settlement
argument-hint: <id or file> <what is wrong>
---
Write the feedback bundle: `node tools/artgen/artgen.js report <id> --note "<what is wrong, in the user's words>"`. For a map file outside a project, give
`--file <path>` in place of the id, and `--made-by "<the command that wrote the file>"` when the repo's own tool wrote it.

The command prints the bundle's folder (`art/feedback/<date>-<id>/` in a project, else `artgen-feedback/<date>-<id>/` at the repo root,
which git ignores). Read its `case.md` and `ISSUE.md` and tell the user in two lines what is in it (the input file, the command, the
versions, the render) and that nothing has left this machine. Ask whether to send it. Only when they say yes run the same command again
with `--issue` (it opens the issue on the artgen repo when `GH_TOKEN` or `GITHUB_TOKEN` is set; otherwise it prints a link for the user to
open, or they can paste `ISSUE.md` into a new issue themselves). Don't edit the bundle to make the report look better.

Report: $ARGUMENTS
