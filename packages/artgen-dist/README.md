# artgen-dist

Builds the artgen **committed install** and installs it into game repos. The distribution is committed into each game
repo (not installed as a Claude Code plugin) because plugins don't load in claude.ai/code cloud sessions; committed
`.claude/` files and `.mcp.json` do.

```
npm run build -w artgen-dist      # → packages/artgen-dist/out (the artgen-dist branch content)
npm test -w artgen-dist           # install smoke test + fixture repo checks
node packages/artgen-dist/out/install.mjs init|add|remove|update|status|modules [--with a,b] [--target <game repo>] [--force] [--dry-run]
node packages/artgen-dist/pack-libs.mjs <dir>   # the library package files a release attaches
```

**Modules** (docs/TOOLING-PLAN.md R3). Every file of the distribution belongs to exactly one module (`dist/modules.json`, made
by the build; the build fails if one belongs to none or two):

| Module | Holds | Default |
|---|---|---|
| `core` | `tools/artgen/` basics: `VERSION`, the PNG rasteriser `resvg.wasm`, the map label `fonts/`; `/artgen-report` and `/artgen-upstream` (the feedback loop: `artgen report`, `artgen upstream`, in both CLI bundles) and its `CLAUDE.md` section | always |
| `art` | the `artgen` and `artgen-mcp` bundles, asset templates, the runtime sources, the `artgen`, `art-direction` and `asset-production` skills, the `art-reviewer` and `art-maker` agents, `/artgen-direction`, `-brief`, `-make`, `-review`, `-feedback`, `-approve`, `-export`, `-restyle`, `-init`, the `.mcp.json` entry | yes |
| `maps` | `artgen-maps.js` (the maps-only bundle, which the map skills call), the `terrain-map`, `dungeon-map` and `settlement-map` skills, `/artgen-map`, `-dungeon`, `-settlement`. Its version is the map engines' own line (`packages/artgen-mapgen/package.json`) | yes |
| `ui` | `tools/artgen/ui/` (the web app in bundle mode: `vite.ui.config.ts`, built by `ui-build.mjs`), `/artgen-ui`; needs `art` or `maps` | no |
| `update-pr` | `.github/workflows/artgen-update.yml` | no |

`MANIFEST.json` records the modules (with versions), the hash of every file and, for the files copied from the artgen repo (skills, agents, commands, templates, runtime, the workflow), the source path each one has there (`sources`; `artgen upstream` turns local edits into a patch against them). A manifest from before modules counts as
`core`, `art` and `maps`. `add` installs the files of more modules; `remove` deletes a module's untouched files and keeps
edited ones; both rewrite the `.mcp.json` entry and the `CLAUDE.md` section (one fragment per module, `content/<module>/claude-md.md`).
`update --notes <file>` writes the pull request text (version change, the changelog since the installed version, the files kept
because they were edited) that `artgen-update.yml` uses, and moves the release URLs of the library packages in the game's
`package.json` (`dist/packages.json`).

| Path | What it is |
|---|---|
| `build.mjs` | esbuild bundles of `artgen-cli/src/bin.ts`, `maps-bin.ts` and `artgen-mcp/src/bin.ts`, wasm, templates, the review UI, content for both layouts; builds module by module and writes `dist/modules.json` |
| `ui-build.mjs` | builds the review UI with `vite.ui.config.ts` (no image tools, which work on pictures, not on a repo's `art/`; the rasteriser and fonts are the `core` module's, served by `artgen ui`) |
| `lib-packages.mjs`, `pack-libs.mjs` | the four library packages a release attaches: tsc output + declarations, `npm pack` |
| `src/install.mjs` | the installer (plain Node, no deps): modules, copies, `.mcp.json` merge, managed `CLAUDE.md` section, `MANIFEST.json` hashes |
| `content/<module>/` | each module's skills, agents, commands and `CLAUDE.md` fragment (`update-pr/` holds the workflow); `{{ARTGEN}}` and `{{CMD_DIRECTION}}` are filled per layout (the maps skills call `artgen-maps.js`) |
| `CHANGELOG.md` | release notes; `scripts/artgen-release.mjs` adds a section per release |
| `DIST-README.md` | README of the published branch |
| `test/` | `dist.test.ts` (build → install → CLI + MCP from the installed files → update; the modules; `artgen ui` from the installed files), `libs.test.ts` (the library packages imported and type-checked), `fixtures.test.ts` (`examples/`) |

CI (`.github/workflows/artgen-dist.yml`) publishes `out/` to the `artgen-dist` branch after the package tests pass on
`main`. `version` in `package.json` becomes `tools/artgen/VERSION` and `artgen --version`.

**Releases.** `node scripts/artgen-release.mjs <x.y.z|patch|minor>` bumps the version in lockstep (this package,
the lockfile, the Python client) and writes the changelog section; edit it, commit, merge to `main`, then push the tag
`artgen-v<version>`. `.github/workflows/artgen-release.yml` checks the tag against the versions, runs the package and
Python tests, publishes the branch with `scripts/artgen-publish-dist.sh` and tags that commit `artgen-dist-v<version>`
(what game repos pin), builds the library package files and creates the GitHub release (changelog section, Python sdist/wheel
and the four library `.tgz` files attached). The map engines have a version line of their own: `--mapgen x.y.z|patch|minor|major|keep`
(default: a patch when a commit since the last tag touched the map engines). npm publish of
`artgen-runtime` is optional (repository variable `ARTGEN_PUBLISH_RUNTIME=true` + `NPM_TOKEN`). End-to-end check on a
scratch remote: `node scripts/artgen-release-acceptance.mjs` (tag → `npx …#artgen-dist-v<B> update` in a fixture copy →
new version, local edits kept; for the full install and a maps-only one, and the steps of the update workflow run against a
stand-in `gh`). The review UI in a real browser: `node scripts/artgen-ui-bundle-accept.mjs` (Chromium, and Firefox where installed).
After changing content, templates or the engine, run `npm run fixtures:install` and commit the fixture updates (the
fixture test fails until you do).
