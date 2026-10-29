---
description: Turn your local edits to the installed artgen skills, commands and templates into a patch for the artgen repo
argument-hint: [--base <folder>]
---
Run `node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js" upstream $ARGUMENTS` (`artgen-maps.js upstream` where only the maps module is installed). It compares every installed file with
`tools/artgen/MANIFEST.json` and writes the edited ones as a patch against their source paths in the artgen repo
(`art/feedback/upstream-<date>.patch`). It fetches the files as installed from the release tag on GitHub; pass `--base <folder>` (the
content of the `artgen-dist` branch at the installed version) where there is no network. Files marked `built` come from the sources
and have nothing to patch; say so to the user.

Show the user what the patch changes in a few lines and what to do with it: open a pull request on the artgen repo with it (`git apply` in a
checkout), or attach it to an issue. Don't revert the edits in this repo: `update` keeps them until the fix is released.
