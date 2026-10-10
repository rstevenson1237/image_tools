# artgen-dist

Builds the artgen **committed install** and installs it into game repos. The distribution is committed into each game
repo (not installed as a Claude Code plugin) because plugins don't load in claude.ai/code cloud sessions; committed
`.claude/` files and `.mcp.json` do.

```
npm run build -w artgen-dist      # → packages/artgen-dist/out (the artgen-dist branch content)
npm test -w artgen-dist           # install smoke test + fixture repo checks
node packages/artgen-dist/out/install.mjs init|update|status [--target <game repo>] [--force] [--dry-run]
```

| Path | What it is |
|---|---|
| `build.mjs` | esbuild bundles of `artgen-cli/src/bin.ts` and `artgen-mcp/src/bin.ts`, wasm, templates, content for both layouts |
| `src/install.mjs` | the installer (plain Node, no deps): copies, `.mcp.json` merge, managed `CLAUDE.md` section, `MANIFEST.json` hashes |
| `content/` | skills (`artgen`, `art-direction`, `asset-production`), the `art-reviewer` and `art-maker` agents, commands, the `CLAUDE.md` section; `{{ARTGEN}}` and `{{CMD_DIRECTION}}` are filled per layout |
| `CHANGELOG.md` | release notes; `scripts/artgen-release.mjs` adds a section per release |
| `DIST-README.md` | README of the published branch |
| `test/` | `dist.test.ts` (build → install → CLI + MCP from the installed files → update), `fixtures.test.ts` (`examples/`) |

CI (`.github/workflows/artgen-dist.yml`) publishes `out/` to the `artgen-dist` branch after the package tests pass on
`main`. `version` in `package.json` becomes `tools/artgen/VERSION` and `artgen --version`.

**Releases.** `node scripts/artgen-release.mjs <x.y.z|patch|minor>` bumps the version in lockstep (this package,
the lockfile, the Python client) and writes the changelog section; edit it, commit, merge to `main`, then push the tag
`artgen-v<version>`. `.github/workflows/artgen-release.yml` checks the tag against the versions, runs the package and
Python tests, publishes the branch with `scripts/artgen-publish-dist.sh` and tags that commit `artgen-dist-v<version>`
(what game repos pin), and creates the GitHub release (changelog section, Python sdist/wheel attached). npm publish of
`artgen-runtime` is optional (repository variable `ARTGEN_PUBLISH_RUNTIME=true` + `NPM_TOKEN`). End-to-end check on a
scratch remote: `node scripts/artgen-release-acceptance.mjs` (tag → `npx …#artgen-dist-v<B> update` in a fixture copy →
new version, local edits kept).
After changing content, templates or the engine, run `npm run fixtures:install` and commit the fixture updates (the
fixture test fails until you do).
