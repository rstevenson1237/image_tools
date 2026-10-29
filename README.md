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

**Modules.** `init` installs `core`, `art` and `maps`. `init --with maps` is the maps only (no art skills, agents, commands,
CLI or MCP server); `add ui` / `add update-pr` / `add art` and `remove maps` change an install later (`modules` lists them):
`core` (always), `art` (the pixel-art pipeline), `maps` (terrain, dungeon and settlement maps, `artgen-maps.js`), `ui` (the
review UI, below) and `update-pr` (a weekly workflow that opens a pull request with the new release).

**Releases.** `#artgen-dist` follows `main`. To pin a release, use its tag instead (see the
[changelog](https://github.com/rstevenson1237/image_tools/blob/main/packages/artgen-dist/CHANGELOG.md)):
`npx -y github:rstevenson1237/image_tools#artgen-dist-v0.11.0 update`. Release tags never move.

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
- `tools/artgen/MANIFEST.json` records the modules and installed file hashes; `update` replaces untouched files and keeps
  edited ones unless `--force`. `--dry-run` shows the plan. `update --notes <file>` writes the changelog and the kept files
  for a pull request description.
- **Review UI** (`ui` module): `node tools/artgen/artgen.js ui` (`artgen-maps.js ui` with the maps module alone) serves
  Asset Review, Art Direction, Asset Lab and the map editors on a local address and prints the link; `--port N`, `--open`.
  The page opens this repo's `art/` through that server, so it works in any browser and always runs this install's engine.
  Only this machine can reach it and the file API needs the token in the link. A cloud session's container can't be reached
  from your browser: review on the pull request there.
- **Library packages** (code that imports the engine): the release attaches `artgen-runtime`, `artgen-primitives`,
  `artgen-scene` and `artgen-mapgen` as `.tgz` files, installed by URL
  (`npm install https://github.com/rstevenson1237/image_tools/releases/download/artgen-v0.12.0/artgen-mapgen-0.11.0.tgz`).
  `update` moves such URLs in the repo's `package.json` to the new release.

## Maps only (`maps/`)

A repo that builds tabletop maps and nothing else needs none of the above: `init --with maps` installs just that (the `maps` module,
with its skills and commands). For a repo that wants a folder it controls, the same engines are here as a folder to copy. `maps/` holds `artgen-maps.js` (the `map`,
`dungeon` and `formats` commands, no pixel-art pipeline), `resvg.wasm` (PNG output only), `fonts/` (optional) and
`VERSION`. Copy the folder at a commit of this branch into the repo's own `tools/artgen/` and commit it; nothing runs at
install (steps in the CHANGELOG). Every command takes `--file <path>` in place of an id and needs no project:
`node tools/artgen/artgen-maps.js dungeon check --file F.a.json --json`, then `dungeon fit` and `dungeon render --format svg`.
`map facts` and `dungeon facts` read the ground and the layout back as numbers (terrain, height, slope, rivers and roads; rooms,
corridors, exits, overlaps and unreached rooms) for a writer that never sees a render. A map may also state what its ground
must be (`require` in `map.json`: terrain, height bands, streams, roads, areas kept clear of rivers); the generator shapes the ground
to it and `map check --file … --json` names each requirement it did not meet (exit 1), so the remedy goes to the brief, not to a reseed.
Entries carry an optional `origin`, and `map sync` and `dungeon sync --file target.json --from new.json --origin tables` replace one origin's entries and keep the hand ones, reporting every conflict.
A dungeon may state an `underlay` (a map under the rooms), `walls` (with towers and gates) and a room `fill` (`building`, `yard`, `cellar`); `--fit` and `--page-scale` set labels, symbols and strokes in points and millimetres on the page and keep labels off one another.

## Plugin layout (local sessions only)

`plugin/` holds the same skills, agent and tools as a Claude Code plugin (commands `/artgen:init`,
`/artgen:direction`, `/artgen:make`, `/artgen:map`, `/artgen:dungeon`, …); `.claude-plugin/marketplace.json` lists it. Clone this branch and run
`/plugin marketplace add <path-to-clone>` then `/plugin install artgen@artgen`. Plugins don't load in cloud sessions,
so use the committed install for anything you run on claude.ai/code.
