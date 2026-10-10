# artgen changelog

Releases of the committed install (`artgen-dist`), the MCP server, the runtime it vendors and the Python client.

## 0.9.0 — 2026-10-10

First tagged release, and the first build actually published to the `artgen-dist` branch (see the last entry).

- MCP server: the full tool set — `finish`, `make` (with the parallel round), `gallery`, `feedback`, `approve` (the
  user's call only: needs `user_approved`), `texture`, `fx`, `export`, `restyle`, `analytics` join the direction and
  pipeline tools; asset arguments take a brief id; `direction` takes a bench name; quick looks write under
  `art/sheets/`.
- Parallel make: `artgen make --parallel <n>` returns a round of maker packets (one subagent per asset, each owning its
  `art/assets/<kind>/<id>/`) and the main agent's review steps; new `art-maker` subagent; the asset-production skill
  and `/artgen-make` describe the rounds.
- Analytics v2: `artgen analytics --across <roots> [--apply]` pools ledgers across projects and recommends revision
  passes and image-token caps per kind, model/effort per stage, with evidence and confidence; `--apply` merges the
  config patch.
- New projects: `artgen init` writes per-kind revision passes from those recommendations (textures 2, props 4).
  Existing projects keep their config.
- Runtime 1.2.1: the three.js adapters keep translucent shadow pixels (alpha cut-out 0.5 → 0.02); `loadPack` warns when a
  pack carries unapproved drafts (`onDrafts`).
- Export: `assets.ts` prefixes pack URLs with Vite's `BASE_URL`, so games served from a sub-path (GitHub Pages) load.
- CLI: `--help` describes the tool and lists every command; unknown commands say so; `texture` / `fx` explain an
  unlocked direction.
- Skills and commands no longer cite the design docs; the `artgen` skill defines every rule number the others use.
- Python client (`python/artgen`): `Artgen(project).render / review / texture / fx / export / …` over the CLI's
  `--json`, returning dicts and Pillow images; quickstart notebook.
- Release automation: `scripts/artgen-release.mjs` (version bump in lockstep, changelog), the `artgen-release`
  workflow (tag `artgen-v<version>` → tests → `artgen-dist` branch + `artgen-dist-v<version>` tag → GitHub release),
  optional npm publish of the runtime.
- Fixed: the publish step failed on the first publish (no `artgen-dist` branch yet), so no earlier build ever reached
  the branch and `npx …#artgen-dist init` could not work until this release.

## Before 0.9.0 (untagged builds, never published)

- 0.8.0 — breadth: views, voxel raster/toon, normal maps, textures and tiles, effects and animation, first-person;
  runtime 1.2.0 (sub-frames, additive blend, lit billboards).
- 0.7.0 — the image tools' Art Direction / Asset Review / Asset Lab: skills explain their ledger lines and locks.
- 0.6.0 — independent review (blind re-scores, roster review, real-world heights, silhouettes); 0.6.1 — effect briefs
  name a drawable object.
- 0.5.0 — per-frame anchors in packs, frozen animation contracts, held frames, face-first character finish.
- 0.4.0 — the runtime: Pixi.js / three.js / Canvas 2D adapters, `export --runtime`.
- 0.3.0 — production: asset-production skill and commands.
- 0.2.0 — the committed install and the art direction workflow.
