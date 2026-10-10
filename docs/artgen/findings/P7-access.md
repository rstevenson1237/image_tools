# P7 findings — access + release

Date: 2026-10-10 · Phase: [PLAN P7](../PLAN.md#p7--access--release-m) · Code: `packages/artgen-mcp`,
`packages/artgen-cli/src/w2.ts` (parallel make, pooled analytics), `packages/artgen-core/src/w2/recommend.ts`,
`python/artgen`, `scripts/artgen-{release,publish-dist,release-acceptance}.*`, `.github/workflows/artgen-release.yml`
· Evidence: [p7/](p7/)

Built in one cloud session. artgen-dist **0.9.0**, the first version meant to be tagged. The three fixture games are
updated to it.

## What was built

**MCP server: the full tool set (SPEC §14).** The P2/P3 server had 8 tools. It now has 18: `finish`, `make`
(with the parallel round), `gallery`, `feedback`, `approve`, `texture`, `fx`, `export`, `restyle` and `analytics`
join `direction_get`, `direction_tile`, `pass_status`, `render`, `review`, `conformance`, `score` and `status`.
Images come back as MCP image content (render strips, review sheets, gallery pages, texture previews and normal maps,
fx strips and onion skins, the restyle sheet). The sandbox works as before: an asset argument must resolve inside
`art/`. It now also accepts a brief id, or a bare name under `art/assets/[<kind>/]`, and the first candidate that
exists wins. `texture` and `fx` write only under `art/sheets/`. `export` writes where the config says, as the CLI
does. `direction` accepts a bench direction name (`benchmark`, `alt`). `approve` records a user decision (D10), so it
refuses without `user_approved: true`, and its description tells the agent to call it only after the user said so.
The server reports the dist version as its `serverInfo.version`.

Fixed along the way: `packages/artgen-mcp/src/bin.ts` had never run from sources. The runtime package imports
`./x.js`, so it needs the `.js → .ts` resolve hook that `artgen-cli/src/bin.ts` registers. The bundle never needed
it, which is why nothing caught it. The Python session and `npx artgen-mcp` in this repo now work.

**Parallel make.** `artgen make --parallel <n>` (MCP: `make { parallel }`) returns `work`, split three ways:
- `makers`: up to n authoring steps, one per asset. A maker step is `write-base`, `write-finish`, or a template
  `base.v1` nobody has reviewed yet. Each packet names the asset directory it `owns` and the file(s) it `writes`.
- `queued`: maker steps that wait for the next round.
- `main`: review and blind-review steps, which stay with the main agent.

A new **art-maker** subagent takes one packet. It writes only its files, renders inside its directory and runs
`artgen review` (one ledger append), then returns the sheet. The main agent has a fresh art-reviewer score each
sheet, runs blind re-scores and, after the last round, the roster review. The asset-production skill and
`/artgen-make` describe the rounds, plus a `git status art/` check for makers that overstep.

The ledger is the only file two makers write. `appendLedger` is a single `appendFileSync` (O_APPEND), so concurrent
appends stay whole lines. The test checks this with 6 processes × 150 appends of 3 KB lines: 900 whole lines, each
process's in order. A parallel round in a scratch project ran three makers' `artgen review` as separate processes at
once, and the ledger gained exactly their three review lines.

**Analytics v2.** `artgen analytics --across <roots…> [--apply] [--min-assets n]` pools ledgers from project roots,
or from bench folders with a `ledger.jsonl` beside asset dirs. Asset ids are scoped per project. Per kind it reports:
- **Revision passes:** the marginal gain of each base pass on the best-so-far score (R12 keeps the best). The
  recommendation is the last pass whose mean gain is ≥ 0.25. If the last observed pass still adds ≥ 0.5, it
  recommends one more pass.
- **Image-token cap:** 1.5 × p90, rounded up to 500.
- Finishing gain, how often a second finish was needed, the user revision rate and the blind gap.

Per stage it compares model/effort mappings by gain per pass and gain per 1k tokens. When two mappings each have
enough passes, it recommends the cheaper one if its gain is within 0.25 of the best. With one mapping it proposes an
experiment on the stage that gains least. The reviewer model is judged by the blind gap, not by gains. Every row
carries its n and a confidence. Only medium/high confidence reaches the config patch, which `--apply` merges into the
project's `artgen.config.json` (`budget.perKind`, `models`).

**Python client** (`python/artgen`, D7: thin client). `Artgen(project)` finds `tools/artgen/artgen.js` (or
`ARTGEN_CLI`), runs commands with `--json` in the project root, and returns dicts. Typed results open the PNGs as
Pillow images: `Render`, `Sheet`, `Texture`, `Effect`. A non-zero exit that still printed JSON (a failing gate) comes
back as a result, not an exception. `Artgen.session()` keeps the MCP server open for bulk work (below). There are
9 pytest tests (no mocks: the CLI is the contract), including one that runs the quickstart notebook's code cells.
`pyproject.toml` is ready. The release attaches the sdist and wheel; nothing goes to PyPI without the owner's word.

**Release automation.**
- `scripts/artgen-release.mjs <version|patch|minor|major>` bumps the version in lockstep (artgen-dist via
  `npm version`, so the lockfile follows; the Python client) and writes the changelog section from commit subjects
  since the last `artgen-v*` tag.
- `scripts/artgen-publish-dist.sh <out> [tag]` is the publish step, shared by both workflows. A release tag goes on
  the published `artgen-dist` commit as `artgen-dist-v<version>` and is never moved.
- `.github/workflows/artgen-release.yml` runs on a pushed tag `artgen-v<version>`. It checks the tag against both
  versions, runs the package and Python tests, publishes and tags the branch, and creates the GitHub release (the
  changelog section plus the Python sdist/wheel). An optional job publishes `artgen-runtime` to npm (D4); it needs
  `ARTGEN_PUBLISH_RUNTIME=true` and `NPM_TOKEN`.
- CI gained a Python job.
- `packages/artgen-dist/CHANGELOG.md` starts at 0.9.0, with a summary of the untagged 0.2–0.8 builds.

The version bump also resynced `package-lock.json`, which still recorded runtime 1.1.0 and dist 0.6.1.

## Acceptance

| Criterion | Result |
|---|---|
| MCP inspector renders + reviews a benchmark asset | **Pass.** `@modelcontextprotocol/inspector@0.17.2 --cli` against the bundled `tools/artgen/artgen-mcp.js` in a scratch game repo installed from the 0.9.0 build. `tools/list` returned the 18 tools. `render` and `review` of the bench hero (`artgen-core/bench/pipeline/hero`, `finish.v1`, `direction: benchmark`) each returned text + image, gate pass, review sheet ~865 image tokens: [inspector-review-hero.png](p7/inspector-review-hero.png), [inspector-render-hero.png](p7/inspector-render-hero.png). The same check runs in-process in `server.test.ts`. |
| Python example generates a texture and a sheet | **Pass.** [`artgen-quickstart.ipynb`](../../../python/artgen/examples/artgen-quickstart.ipynb) on a scratch copy of iso-dungeon: stone 32 px (seam ratio 0.71; the repetition flag names tile-sized blotches) [python-texture-stone-3x3.png](p7/python-texture-stone-3x3.png), a four-material board laid out with Pillow [python-material-board.png](p7/python-material-board.png), skeleton-knight's review sheet [python-review-skeleton-knight.png](p7/python-review-skeleton-knight.png), and a sparks onion skin. `test_notebook.py` runs it in CI. |
| Tagging a release and running `update` in a fixture repo moves it to the new version with local edits preserved | **Pass** on a stand-in remote (`node scripts/artgen-release-acceptance.mjs`). The 0.9.0 build was published with the workflow's script and tagged `artgen-dist-v0.9.0`. A copy of swamp-topdown was installed from that tag through `npx -y git+file://…#artgen-dist-v0.9.0 init`, then got two local edits (art-reviewer agent, managed CLAUDE.md section). 0.9.1 was published and tagged (one skill changed, one command dropped). `npx …#artgen-dist-v0.9.1 update` showed `0.9.0 → 0.9.1`, replaced the skill, removed the command, kept both edits, `status` listed them, and `art/` was untouched. Re-publishing an existing tag is refused. The real tag push on GitHub waits for the owner (below). |

## Measurements

- **CLI call vs MCP session** (10 textures, 32 px, iso-dungeon copy, bundled tools): **242 ms per texture** through
  the CLI (one Node process per call: start, wasm init, direction parse) vs **37 ms per texture** through one MCP
  session. That is 6.5×, which settles D7's "subprocess per call is slow for bulk" point without a separate
  `serve --stdio` mode: the MCP server already is one, and `Artgen.session()` uses it.
- `node artgen.js --version` takes ~150 ms, so roughly 60 % of a CLI texture call is process start-up.

## Analytics v2 on the fixture data

Pooled over the three fixtures and bench/p6 (51 assets, 238 scores): [p7/RECOMMEND.md](p7/RECOMMEND.md). Highlights:
- **Textures can stop at v2** (r3 adds +0.17 over 6 assets, medium confidence).
- **Props and effects** still gain ≥ 0.5 at r3, so the recommendation is a fourth pass (props: high confidence over
  14 assets; effects: medium).
- **Characters and creatures** should stay at 3 passes.
- **Finishing** adds +0.08 per pass on average, and 0 for creatures, effects and tiles. Combined with only one
  model mapping on record, that makes the finish stage the suggested model/effort experiment.
- **Tiles:** the user sent back every finished tile, and blind re-scores sit 1.33 under the pipeline's own. This
  matches the P6b follow-up (the reworked tiles are still below the bar).

The fixtures' configs were **not** changed. The recommendations go to the owner first, as the skill says.

## Not done / open

- **Pushing the first real release tag** (`artgen-v0.9.0`) is the owner's step after this merges. The workflow then
  publishes `artgen-dist-v0.9.0`. Until a tag exists, `#artgen-dist` (main) is the only ref, as before.
- **PyPI**: not published (by design). The name `artgen` may be taken on PyPI; check before the first upload.
- **npm runtime publish**: wired but off. The package keeps its workspace name `artgen-runtime`; SPEC §12 says
  `@artgen/runtime`, which needs an npm scope the owner controls.
- Parallel make has run with simulated makers (separate CLI processes), not with real art-maker subagents in a
  Claude Code session. The skill text is the contract; a first real run should check that the makers stay inside
  their `owns` directories.
- Analytics v2 has one model mapping (`default`) in all data, so model recommendations are untested on real
  mixed data (unit-tested on synthetic ledgers).
