# artgen-dist

Built by CI from [`packages/artgen-dist`](https://github.com/rstevenson1237/image_tools/tree/main/packages/artgen-dist)
on `main`. Do not edit this branch by hand.

artgen is a pixel-art pipeline for game repos, driven by Claude Code: lock an art direction (`art/direction.json`), then
every sprite, tile and effect is a small JS module drawn from it, made and reviewed autonomously, approved by you, and
exported as atlas packs plus a typed runtime (Pixi.js, three.js, Canvas 2D). Overview and quickstart:
[the main README](https://github.com/rstevenson1237/image_tools#artgen-quickstart).

## Committed install (works in local and claude.ai/code cloud sessions)

From the root of a game repo (local shell, or any Claude Code session with network access):

```
npx -y github:rstevenson1237/image_tools#artgen-dist init      # first time: .claude/, tools/artgen/, .mcp.json, CLAUDE.md, art/
npx -y github:rstevenson1237/image_tools#artgen-dist update    # later: shows the version change, keeps local edits
npx -y github:rstevenson1237/image_tools#artgen-dist status
```

**Releases.** `#artgen-dist` follows `main`. To pin a release, use its tag instead (see the
[changelog](https://github.com/rstevenson1237/image_tools/blob/main/packages/artgen-dist/CHANGELOG.md)):
`npx -y github:rstevenson1237/image_tools#artgen-dist-v0.10.0 update`. Release tags never move.

Then commit `.claude/`, `tools/artgen/`, `.mcp.json`, `CLAUDE.md` and `art/`. Sessions need no network or npm after
that. Start with `/artgen-direction` (or ask Claude to set the art direction).

- Skills: `artgen` (authoring and the pass pipeline), `art-direction` (setting the look), `asset-production` (briefs, the
  autonomous run, parallel rounds, gallery, approve/feedback, export, restyle), `terrain-map` (tabletop RPG maps: contours,
  terrain, hex/square grid, labels and symbols, colour and B/W), `dungeon-map` (dungeon and lair maps: rooms, corridors,
  doors, hatched rock, 10/5 ft grid, numbers, labels and symbols, black and white). Agents: `art-reviewer`, `art-maker`. Commands:
  `/artgen-init`, `/artgen-direction`, `/artgen-brief`, `/artgen-make`, `/artgen-review`, `/artgen-feedback`,
  `/artgen-approve`, `/artgen-export`, `/artgen-restyle`, `/artgen-map`, `/artgen-dungeon`.
- CLI: `node tools/artgen/artgen.js --help` (Node 20+). MCP server: `artgen` (`node tools/artgen/artgen-mcp.js`), the
  full tool set with image results. Python: the `artgen` client in the repo's `python/artgen` calls the same CLI.
- `tools/artgen/MANIFEST.json` records installed file hashes; `update` replaces untouched files and keeps edited ones
  unless `--force`. `--dry-run` shows the plan.

## Maps only (`maps/`)

A repo that builds tabletop maps and nothing else needs none of the above. `maps/` holds `artgen-maps.js` (the `map`,
`dungeon` and `formats` commands, no pixel-art pipeline), `resvg.wasm` (PNG output only), `fonts/` (optional) and
`VERSION`. Copy the folder at a commit of this branch into the repo's own `tools/artgen/` and commit it; nothing runs at
install (steps in the CHANGELOG). Every command takes `--file <path>` in place of an id and needs no project:
`node tools/artgen/artgen-maps.js dungeon check --file F.a.json --json`, then `dungeon fit` and `dungeon render --format svg`.

## Plugin layout (local sessions only)

`plugin/` holds the same skills, agent and tools as a Claude Code plugin (commands `/artgen:init`,
`/artgen:direction`, `/artgen:make`, `/artgen:map`, `/artgen:dungeon`, …); `.claude-plugin/marketplace.json` lists it. Clone this branch and run
`/plugin marketplace add <path-to-clone>` then `/plugin install artgen@artgen`. Plugins don't load in cloud sessions,
so use the committed install for anything you run on claude.ai/code.
