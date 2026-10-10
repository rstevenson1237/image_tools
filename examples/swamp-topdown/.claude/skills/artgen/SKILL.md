---
name: artgen
description: Pixel and voxel game art with the artgen pipeline in this repo (art/ folder). Use for any work on game sprites, props, tiles, effects, animations, textures or first-person assets — writing or revising asset sources (base.vN.js, finish.vM.js), rendering, reviewing, scoring, and the conformance gate. For producing a batch of assets from briefs, the user's approvals, export and restyle, use the asset-production skill; for setting or changing the art direction itself, the art-direction skill.
---

# artgen — the asset pipeline

Every asset is **code**: a plain ESM module that draws with T2+ primitives and reads every colour, size, line and
light setting from the locked art direction (`art/direction.json`, handed to the module as `ctx.dir`). The CLI renders,
checks and records; you write the sources and judge the sheets.

CLI: `node tools/artgen/artgen.js <command>` (Node 20+, no npm install). Add `--json` for machine-readable output. The `artgen` MCP
server exposes the same core tools (`direction_get`, `pass_status`, `render`, `review`, `conformance`, `score`,
`direction_tile`, `status`) and returns images directly. Briefs, the autonomous run (`make`), the gallery, approvals,
feedback, export and restyle are in the **asset-production** skill.

## Before writing anything
1. `node tools/artgen/artgen.js direction show` — there must be a **locked** direction. If not, use the art-direction skill first.
2. Read `art/direction.json`: ramps (by role: `skin hair cloth leather metal wood stone dirt grass accent glow`),
   `scale` (frame size per kind), `line`, `shading`, `camera.view`, `rules`. Look at `art/direction.png` and the
   anchors in `art/anchors/` — new assets must sit beside them.

## One pipeline for every asset (R1)

| Stage | What you do | File |
|---|---|---|
| S1 base | T2+ primitive scene from the brief + direction tokens | `base.vN.js` |
| S2 procedural | `ctx.lib.proc(scene).add(...)` layers: noise, patterns, rim light, AO, shadows, dither | same file |
| R1–R3 | v1 first build, then v2, v3 — each rendered, reviewed, scored; revise from the **best** so far (R12) | `base.v1..v3.js` |
| F finish | one direct-pixel pass on the best base, stored as ops (R2) | `finish.v1.js` |
| U user | the user approves or gives feedback → `base.vN+1` (form/colour) or `finish.vM+1` (pixels) | |

The loop — let the state machine decide each step:
```
node tools/artgen/artgen.js brief add <id> --kind character|creature|prop|tile|effect …  # then `make` scaffolds base.v1.js from a template
node tools/artgen/artgen.js new <id> --kind … [--size key|WxH] [--states idle,walk]     # an asset outside briefs.yaml (brief.json + base.v1.js)
node tools/artgen/artgen.js pass next <assetDir>          # write-base / review / write-finish / ready, and why
node tools/artgen/artgen.js review <assetDir>             # sheet: best so far, v(n−1), v(n) — checker, scaled, in context; open the PNG
node tools/artgen/artgen.js score <assetDir> base.v2 6.5 --note "what works, what to fix next"
node tools/artgen/artgen.js finish <assetDir>             # finish.vM.js from the template, bound to the best base
node tools/artgen/artgen.js pass status <assetDir>
node tools/artgen/artgen.js render <assetDir> [--version v] [--stages]   # --stages dumps every stage (R8) when something looks wrong
node tools/artgen/artgen.js variants <assetDir> --n 8     # seeded variants from the param schema
```
Scoring: delegate to the **art-reviewer** subagent (fresh eyes, scores against the direction and anchors) when the
asset matters; otherwise score yourself with the rubric in `references/review.md`. The conformance gate must pass
before an asset is shown to the user as finished.

## Rules
- **R10** never edit a version that has a score; write the next version (`base.v3.js` from `base.v2.js` + header comment saying what changed).
- **R11** no colour literals in sources — `pal.<ramp>`, `mat: 'metal'`, tokens like `'accent.0'` / `'outline'`. The gate fails on hex.
- **R12** revise from the best-scoring version, not the latest (`pass next` names it).
- **R4** no strokes; outlines come from the direction's line pass and `underlay` ink.
- **R5** iso/voxel decoration is a surface `slab`, never a solid poking into another solid.
- **R7** always look at the review sheet image before scoring; compare v(n) with v(n−1) and the anchors.
- **R3/R9** renders are deterministic: seeded RNG (`ctx.rng`), no platform AA, palette-exact output.
- Coordinates relative to `ctx.size` keep an asset valid when the direction's scale changes.

## Pitfalls (from the P1b parity run)
- `shade: 'normal'` on long thin parts gives blotchy bands; use `flat`/`cyl` for limbs, straps, cloaks — keep `normal` for masses.
- `bevel` on tubes leaves orphan pixels; `cyl` with `axis` reads better.
- A group's `underlay` doesn't separate siblings: give each limb its own underlay.
- Mirrored copies get their own underlay (`mirrorX`), so a mirrored hood gets an ink seam on the axis — draw symmetric masses once.
- Adding detail or params often regresses a version (R12 catches it); change one thing per revision and say what.
- The finishing pass adds ~+0.5 when a pixel-level problem is left (faces, hair tips, line weight) and ~0 on a clean
  base. It does not fix a weak silhouette — that is a base revision. Generic clean-up (`fix.orphans`, `jaggies`,
  `corners`) rarely changes T2+ output (its speckle is material noise, which reads as texture): write ops that target
  what the review named (an edge to light, a notch, a highlight run). P3 fixtures: revisions +1.27, finishing +0.13.
- Style-tile probes run a short pipeline (v1 + finish), roughly a point below a fully revised asset.
- Turning figures (`--directions 8`) start from the walker template: `ctx.facing` → yaw, `ctx.t` drives the walk.
  Draw s, se, e, ne, n; west facings are mirrors. Check every facing row on the sheet, not just the first.
- Markings and variation: the `detail` procedural layer stamps a seeded mask template (Bollinger-style) onto a part;
  pass `seed: ctx.variant` so every variant gets its own markings.

## References
- `references/t2.md` — T2+ primitives, shading, groups, 3D mode, procedural layers, params (read before writing a base).
- `references/finishing.md` — finishing ops (`px.fix/fx/light/outline/patch`), anchors, `finish-stale`.
- `references/review.md` — review sheet anatomy, 0–10 rubric, what to write in a score note.
- `references/direction.md` — direction.json fields and colour tokens.
- `references/breadth.md` — views and voxel models, textures and tiles, effects (particles, flames, cycling),
  animation (pose rig with IK, spring chains, attacks, sub-frames) and first-person assets (walls, skies, billboards,
  view-models, lit billboards).
