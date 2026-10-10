# artgen design archive

How artgen was planned, built and measured, kept for reference. **Nothing here is current documentation.** For using
artgen, read the [main README](../../../README.md#artgen-quickstart), the package READMEs under
[`packages/`](../../../packages) and the skills the install ships (`packages/artgen-dist/content/`), which are written to
stand on their own.

Archived 2026-10-10 (PLAN P8), after every phase P0–P7 had landed and nothing in the suite imported artlab code.

## What is here

| Path | What it is |
|---|---|
| [`INTAKE.md`](INTAKE.md) | the original request, the four workflows (W1–W4), the evidence from artlab (E1–E12), goals (G1–G8), success criteria |
| [`DECISIONS.md`](DECISIONS.md) | decisions D1–D19, with the friction points and alternatives considered |
| [`SPEC.md`](SPEC.md) | the specification (rev 11), with "as built" notes per phase |
| [`PLAN.md`](PLAN.md) | phases P0–P8 with acceptance criteria and a status note for each |
| [`findings/`](findings) | one note per phase (what was built, measurements, open items), the calibration study, and their evidence (sheets, screenshots, reports) |
| [`artlab/`](artlab) | the prototype harness the engine was ported from: techniques T1–T4, its ledger, findings and the two final comparison sheets |

## Reading the citations in code comments

Source comments in the engine, CLI, MCP server and app still cite these documents, as design history. They resolve
here:

| Citation | Where |
|---|---|
| `SPEC §n` | a section of [`SPEC.md`](SPEC.md) |
| `PLAN Pn`, `P1b`, `P6a`–`P6d` | a phase in [`PLAN.md`](PLAN.md); its findings note is `findings/Pn-*.md` |
| `Dn` | a decision in [`DECISIONS.md`](DECISIONS.md) |
| `W1`–`W4` | the workflows: W1 art direction, W2 production, W3 the runtime, W4 the image tools UI ([`INTAKE.md`](INTAKE.md) §2) |
| `En`, `Gn` | artlab evidence and goals in [`INTAKE.md`](INTAKE.md) §3–4 |
| `Rn` | the pipeline rules; live definitions are in the `artgen` skill, the originals in [`SPEC.md`](SPEC.md) §2 |
| `rev n` | a SPEC revision (rev 8: animation contracts; rev 9: independent review; rev 10–11: P6c/d and P7 as built) |
| `T1`–`T4`, `T2+` | artlab's techniques (char-maps, primitives, SVG, voxels) and the primitive engine that replaced them |

## Where it ended up against the intake

| Success criterion (INTAKE §9) | Outcome |
|---|---|
| W1: install → 3 style tiles → locked direction + style sheet | Met in cloud sessions with simulated user choices |
| W2: 10-asset briefs, approved ≥ 6.5, one-command restyle | Met on all three example games (30 assets, 6.5–7), self-scored |
| W3: Pixi.js and three.js games in < 20 lines of art code | Met (11–13 lines) |
| W4: the image tools open `art/`, edit, approve; Claude Code sees it | Met in headless Chromium; Firefox zip fallback untested |
| T2 parity (G8): every artlab benchmark ≥ its best final | **4 of 6**; ship 7 vs 7.5 and isohero 6.5 vs 7, accepted at P1b |
| Coverage matrix, every cell ≥ 6.5 | Filled, on self-scores (calibration put self-scores ~0.5 above blind) |

## Known gaps at archive time

Raised during development, not built. Kept here so they aren't lost.

- **Acceptance in a local session** (the owner's machine, own choices) never ran for any phase; every acceptance was a
  cloud session with simulated choices and mostly self-scored reviews. Parallel `make` has not run with real
  `art-maker` subagents.
- **Tiles below the bar:** the reworked swamp mud, bog-water and iso floor scored 5–5.5 blind (target ≥ 6.5) and were
  approved with a simulated approval. Fresh-reviewer blind re-scores of the P6 benchmarks were never done.
- **Not built from the spec:** RotSprite (`rotate` layer, `rotsprite` pass); the SVG Tracer → `path` and Token Cutter
  → `clip` integrations; the external image-source extension point (D18, designed only); the optional `artgen ui`
  local server; lit sprites for Pixi.js and sprite stacks; a draft watermark (the runtime warns on the console instead).
- **Open questions:** whether iso floor tiles should be exempt from `line.outer: dark`; whether the importance tier
  should win over a per-kind budget (today per-kind wins).
- **Owner steps:** push the first release tag (`artgen-v0.9.0`), check the PyPI name `artgen` before any upload, and
  pick an npm scope if the runtime is ever published as `@artgen/runtime`.
- Deliberately not built: the kind-median size check (calibration), saving Asset Lab params and adding briefs from
  the UI (assets are code).

## Changes after the last phase note

The review before archiving (2026-10-10) fixed the first publish of the `artgen-dist` branch (it had failed on every
merge since P2, so the documented install never worked), base-relative pack URLs, CLI help and errors, translucent
shadows in the three.js adapters, a draft warning in `loadPack`, per-kind revision passes for new projects, the
example games' production build, and npm audit findings; see `packages/artgen-dist/CHANGELOG.md` (0.9.0).
