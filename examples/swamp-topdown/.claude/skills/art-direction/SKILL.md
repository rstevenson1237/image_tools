---
name: art-direction
description: Set or change the game's art direction with artgen (W1) — interview the user about the game, generate three direction candidates, render style tiles, let the user choose or mix, then lock direction.json with anchors and a style sheet. Use when a game repo has no locked art/direction.json, when the user wants a new look, or asks to restyle.
---

# Art direction (W1)

Goal: in one session, go from the user's game pitch to a **locked** `art/direction.json`, saved anchors
(`art/anchors/`) and a style sheet (`art/direction.png`). The user's choices are the only manual input: you run
everything else. CLI: `node tools/artgen/artgen.js`.

## 0. Check the project
`node tools/artgen/artgen.js direction show`. No `art/` yet → `node tools/artgen/artgen.js init`. A locked direction already exists → this is a
**direction change**: `node tools/artgen/artgen.js direction new` starts a draft from it (restyling assets arrives with P3's `restyle`).

## 1. Interview (ask in one message, accept short answers, fill gaps with sensible defaults)
- the one-paragraph **pitch** (genre, setting, player fantasy)
- **view**: top-down or isometric (oblique/side/first-person probes arrive in later phases; they fall back to top-down)
- target **scale**: small (16 px characters), medium (24), large (32)
- **mood** words (3–5), era/setting
- references: describe them, or drop images into `art/refs/` → `node tools/artgen/artgen.js palette extract art/refs/x.png --interview`;
  a Lospec palette file → `node tools/artgen/artgen.js palette import file.hex --interview` (candidate A builds its ramps from it)
- constraints: colour count, facings (4 or 8), platform

Write the answers to `art/interview.json` (keys: `pitch`, `view`, `scale`, `mood`, `era`, `directions`, `maxColors`,
`background`, `notes`, `rules: { do, dont }`).

## 2. Candidates
```
node tools/artgen/artgen.js direction candidates --from art/interview.json
```
writes `art/candidates/{a,b,c}.json` — A faithful (palette true to the pitch, dark outline, 3 bands), B bold
(saturated, selout outline, 4 bands, chunky heads), C muted (darker near-duotone, no inner lines, 2 bands + dither,
slim figures) — and copies the **probe set** (character, prop, tile, effect) into `art/probes/`.

Then **tailor them to the pitch**: the generator only reads mood words. Edit the candidate JSONs where the pitch
asks for something specific (a signature accent colour, `rules.do/dont`, a background colour, ramp hues). Keep the
role ramp names. Validate: `node tools/artgen/artgen.js direction validate art/candidates/a.json`. Keep the three meaningfully
different (palette family, outline style, shading/dither, proportions).

## 3. Style tiles (short pipeline: 1 revision + finish per probe)
```
node tools/artgen/artgen.js direction tile                     # art/candidates/style-tile-r1.png: one column per candidate
```
Open the sheet. The probes are generic templates (v1). Make them **this game's** probes — one revision each:
copy `base.v1.js` to `base.v2.js` in `art/probes/<kind>/` and change subject, silhouette and gear to fit the pitch
(the swamp game's character is a lantern-bearer, its prop a rotten crate, its tile mud). Use role ramps only (R11);
keep coordinates relative to `ctx.size` so all three candidates' scales work. Then add a finishing pass to each:
```
node tools/artgen/artgen.js finish art/probes/character        # finish.v1.js bound to the latest base; edit it (see artgen skill)
node tools/artgen/artgen.js direction tile                     # round 2: what the user sees
```
Every column must pass the gate (`gate ok` under each probe). Fix failures before showing the user.

## 4. Choose / mix (the user decides)
Show the user the latest style tile (path + a two-line summary per candidate). Ask: pick one, or mix — e.g.
"A's palette, B's outlines":
```
node tools/artgen/artgen.js direction mix a --line b [--shading b] [--scale c]      # parts: palette line shading scale detail camera theme pipeline effects rules
node tools/artgen/artgen.js direction tile mix1 a                                     # render the mix beside its parents
```
A mix nobody has seen needs its own tile round before locking. Iterate until the user approves.

## 5. Lock
```
node tools/artgen/artgen.js direction lock mix1 --note "A's palette, B's outlines (user choice)"
```
writes `art/direction.json` (status `locked`, version 1 or previous + 1), renders the probes under it as
**anchors** (`art/anchors/<kind>.png`), and the **style sheet** `art/direction.png` (palette with ramp names, scale
ruler, light diagram, anchors, rules). Show the user the style sheet.

## 6. Anchors through the full pipeline (recommended, same session if budget allows)
The anchors are what every later asset is judged against, so take each probe through the full pipeline under
the locked direction (artgen skill): `pass next art/probes/<kind>` → review/score v1, v2 → write v3 → re-finish the best,
then `node tools/artgen/artgen.js direction anchors` to re-save anchors and the style sheet.

## Cost
3 candidates × 4 probes × (v1 + 1 revision + finish) ≈ 24 renders; the tile sheets cost ~1–2k image tokens each.
Expect 2–3 tile rounds before the user picks.
