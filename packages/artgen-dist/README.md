# artgen-dist

Builds the artgen **committed install** (SPEC §3.1, D1) and installs it into game repos.

```
npm run build -w artgen-dist      # → packages/artgen-dist/out (the artgen-dist branch content)
npm test -w artgen-dist           # install smoke test + fixture repo checks
node packages/artgen-dist/out/install.mjs init|update|status [--target <game repo>] [--force] [--dry-run]
```

| Path | What it is |
|---|---|
| `build.mjs` | esbuild bundles of `artgen-cli/src/bin.ts` and `artgen-mcp/src/bin.ts`, wasm, templates, content for both layouts |
| `src/install.mjs` | the installer (plain Node, no deps): copies, `.mcp.json` merge, managed `CLAUDE.md` section, `MANIFEST.json` hashes |
| `content/` | skills (`artgen`, `art-direction`), the `art-reviewer` agent, commands, the `CLAUDE.md` section; `{{ARTGEN}}` and `{{CMD_DIRECTION}}` are filled per layout |
| `DIST-README.md` | README of the published branch |
| `test/` | `dist.test.ts` (build → install → CLI + MCP from the installed files → update), `fixtures.test.ts` (`examples/`) |

CI (`.github/workflows/artgen-dist.yml`) publishes `out/` to the `artgen-dist` branch after the package tests pass on
`main`. Bump `version` in `package.json` for a release; it becomes `tools/artgen/VERSION` and `artgen --version`.
After changing content, templates or the engine, run `npm run fixtures:install` and commit the fixture updates (the
fixture test fails until you do).
