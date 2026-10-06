# artgen-dist

Built by CI from [`packages/artgen-dist`](https://github.com/rstevenson1237/image_tools/tree/main/packages/artgen-dist)
on `main`. Do not edit this branch by hand.

## Committed install (works in local and claude.ai/code cloud sessions)

From the root of a game repo (local shell, or any Claude Code session with network access):

```
npx -y github:rstevenson1237/image_tools#artgen-dist init      # first time: .claude/, tools/artgen/, .mcp.json, CLAUDE.md, art/
npx -y github:rstevenson1237/image_tools#artgen-dist update    # later: shows the version change, keeps local edits
npx -y github:rstevenson1237/image_tools#artgen-dist status
```

Then commit `.claude/`, `tools/artgen/`, `.mcp.json`, `CLAUDE.md` and `art/`. Sessions need no network or npm after
that. Start with `/artgen-direction` (or ask Claude to set the art direction).

- Skills: `artgen` (authoring and the pass pipeline), `art-direction` (W1), `asset-production` (W2: briefs, the
  autonomous run, gallery, approve/feedback, export, restyle). Agent: `art-reviewer`. Commands: `/artgen-init`,
  `/artgen-direction`, `/artgen-brief`, `/artgen-make`, `/artgen-review`, `/artgen-feedback`, `/artgen-approve`,
  `/artgen-export`, `/artgen-restyle`.
- CLI: `node tools/artgen/artgen.js --help` (Node 20+). MCP server: `artgen` (`node tools/artgen/artgen-mcp.js`).
- `tools/artgen/MANIFEST.json` records installed file hashes; `update` replaces untouched files and keeps edited ones
  unless `--force`. `--dry-run` shows the plan.

## Plugin layout (local sessions only)

`plugin/` holds the same skills, agent and tools as a Claude Code plugin (commands `/artgen:init`,
`/artgen:direction`, `/artgen:make`, …); `.claude-plugin/marketplace.json` lists it. Clone this branch and run
`/plugin marketplace add <path-to-clone>` then `/plugin install artgen@artgen`. Plugins don't load in cloud sessions,
so use the committed install for anything you run on claude.ai/code.
