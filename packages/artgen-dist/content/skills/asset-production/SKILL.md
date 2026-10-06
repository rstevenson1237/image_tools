---
name: asset-production
description: Produce the game's art assets with artgen (W2) — write briefs into art/briefs.yaml, run every brief through the full pipeline (v1–v3 + finish) autonomously with the art-reviewer subagent and the gate, show the user a gallery of finished assets, handle their approvals and feedback, export atlas packs and the W3 runtime (Pixi.js, three.js, Canvas 2D adapters) for the game code, and restyle after a direction change. Use when the user asks for sprites, props, tiles or effects for the game, wants to see or approve assets, export them, wire them into the game, or change the look of existing assets.
---

# Asset production (W2)

The user gives you a list of things the game needs; you deliver **finished** assets. Everything between the brief and
the finished asset runs **without asking the user** (D10): you write each version, the `art-reviewer` subagent scores
it, the gate checks it, and the pass machine decides the next step. The user sees only the gallery of finished assets
and answers with approvals or feedback. CLI: `{{ARTGEN}}`. Asset arguments take a brief id (`goblin`) or a directory.

Read the **artgen** skill first (authoring rules R1–R12, T2+ and finishing references). There must be a locked
direction (`{{ARTGEN}} direction show`); if not, run the art-direction skill.

## 1. Briefs (`{{CMD}}brief`)
Turn the user's list into briefs, one per asset, in `art/briefs.yaml` (SPEC §5.1):
```
{{ARTGEN}} brief add goblin --kind character --directions 8 --anims walk:4,attack:3 --notes "hunched, big ears, rusty cleaver" --priority 1
{{ARTGEN}} brief add crate --kind prop --variants 3 --notes "half-sunk, iron bands"
{{ARTGEN}} brief add mud --kind tile
{{ARTGEN}} brief add wisp --kind effect --anims idle:6 --importance filler
{{ARTGEN}} brief list
```
Kinds: `character creature prop tile tileset texture effect viewmodel ui-icon`. `--size` takes a direction scale key or
`WxH`. `--swaps red:cloth=accent` adds a palette-swap variant (ramp → ramp, exported for the runtime). `--importance
hero|standard|filler` picks the pass budget tier. Editing `briefs.yaml` by hand is fine; the CLI validates it.

**Timing.** `--durations attack=80/80/200/80` sets milliseconds per frame (one per frame in `--anims`) and overrides
the state's fps. Give every attack a held contact frame (≥ 2× the others): without it the hit slides instead of
landing. Attacks need at least anticipation, contact, follow-through and recovery — 4 frames, not 3.

**Animation contract.** The first export of an asset freezes `art/contracts/<id>.json`: state names, logical frame
counts, per-frame durations, loop, facings and anchor names — what game code indexes. Later versions may redraw every
pixel but not change that: `brief add` refuses an edit that breaks it, and `export` refuses to write anything. Adding a
state, facing or anchor just extends the contract. Only pass `--break-contract` (brief) / `--break-contract <id>`
(export) when the user says the game code has been updated for the change — ask them first.

## 2. The autonomous run (`{{CMD}}make`)
Loop until `make` says nothing is left — **do not stop to ask the user** between steps:
```
{{ARTGEN}} make [ids|all]       # scaffolds new briefs from templates, marks finished ones `final`, prints `next: <id> — <step>`
```
Do exactly the step it names, then call `make` again:

| step | what you do |
|---|---|
| `review base.v1` (fresh from the template) | first **adapt base.v1.js to the brief** (it is unscored, so editing it is allowed), then review |
| `review <version>` | delegate to the **art-reviewer** subagent: it builds the sheet (`{{ARTGEN}} review <id> --version v`), looks at it, and records `{{ARTGEN}} score <id> <v> <0-10> --note "…"` |
| `write-base base.vN` (`r2`, `r3`) | copy the version it names in `from` (the best so far, R12) to `base.vN.js`, change **one thing** the last review note asked for, header comment says what |
| `write-base` (`x1`) | the final failed the gate: one extra autonomous revision within budget — fix the failing check |
| `write-finish finish.vM` | `{{ARTGEN}} finish <id> --base <base>`, then fill in the ops the review asked for (`references/finishing.md`) |
| `write-base` / `write-finish` (`u1`, `f2`…) | a user feedback round (§4): do what the user asked, nothing else |

The pass machine already applies R12 (revise from the best), the finishing pass on the best base, the extra revision
when the final fails the gate, and finally marks the asset `final` with any open issues listed. Animated assets: global
finishing ops run on every frame and facing; patches placed at `ctx.at('<anchor>')` follow the anchor through the other
frames of the same facing (D15) — keep `anchors(ctx)` in the base correct for every frame. Large sheets (8 facings ×
walk) are reviewed as one row per unique facing; the west facings are mirrors.

**Stage models (D19).** `art/artgen.config.json` → `models` maps stages (`base` = v1, `revise` = v2/v3/extra/user,
`finish`, `review`) to a model and effort. When a stage names a model other than `default`, run that stage as a
subagent with that model (the art-reviewer for `review`). Scores record the mapping; pass `--model`, `--effort`,
`--tokens-in`, `--tokens-out`, `--ms` to `score` when you have measured values.

**Budget (D19).** `budget` in the config: `revisionPasses` (per `perKind` and per importance `tiers`),
`extraAutonomousRevisions`, `maxImageTokensPerAsset` (over it, `make` finishes the asset as it is and lists why),
`maxSheetEdge`, `maxUserIterations`. Batches: `make` works through briefs in priority order; work one asset to `final`
before the next unless the user asked for a quick pass over all.

## 3. Show the user (`{{CMD}}review`)
When `make` reports nothing left: `{{ARTGEN}} gallery` → open each `art/sheets/gallery-N.png` and show them to the
user with a short line per asset (score, open issues). `{{ARTGEN}} status` lists every brief:
`brief → in-pipeline → final → approved → exported`, plus `revision` (user feedback in progress) and `stale`
(approved, then the direction changed).

## 4. The user answers (`{{CMD}}approve`, `{{CMD}}feedback`)
- Approve: `{{ARTGEN}} approve <id> [--note "…"]` — only the user decides this; run it when they say so. It refuses a
  final whose gate fails (R6): explain the open issue and propose feedback instead.
- Feedback: pick the **route** from what they asked for, record it, then go back to `make` (it runs autonomously):
  - form, proportion, colour choice, pose, missing part → `{{ARTGEN}} feedback <id> --route base --note "…"` (a new
    base from the version they saw; re-finished afterwards)
  - pixel-level (a stray pixel, eye shape, line weight, a glint) → `{{ARTGEN}} feedback <id> --route finish --note "…"`
    (`--cell idle/s/0`, `--region x,y,w,h` pin it)
  - after `maxUserIterations` rounds the CLI asks you to escalate: talk it through with the user before going on.
- Hand edits: the user fixed pixels in Aseprite → `{{ARTGEN}} import-edit <id> edited.png [--cell state/facing/frame]`
  (the PNG is `out/<final>.png`, or one cell); it writes the next finish as colour tokens, then review it.

## 5. Export (`{{CMD}}export`)
`{{ARTGEN}} export [--pack main]` packs every **approved** asset into the paths in `artgen.config.json`:
`<packDir>/<pack>/<pack>-N.png` atlases (MaxRects), `pack.json` (artgen's manifest: frames per state × facing × frame
× variant, fps or per-frame durations, loop, anchor, swaps, and per-frame named anchors), `<pack>-N.aseprite.json`, and
`src/art/assets.ts` with typed ids (states, variants, anchor names). It checks and records each asset's animation
contract (§1) and lists `contract <id>: created | extended | broken`. Packs choose
assets with `include` patterns (`*`, `goblin*`, `kind:tile`) or a brief's `pack`. `--include-drafts` adds finished but
unapproved assets flagged as drafts (for a test build; say so to the user).

**Runtime (W3).** `{{ARTGEN}} export --runtime` also vendors the artgen runtime into `export.runtimeDir`
(`src/art/runtime/`: the engine-agnostic core + the adapters listed in `artgen.config.json` → `runtime.adapters`:
`pixi`, `three`, `canvas2d`), stamped in `runtime.json`. Re-running it upgrades the runtime; files the game edited are
kept and reported — tell the user, and only pass `--force` if they agree to lose those edits. Set the adapter to the
game's engine before the first `--runtime` export. Game code then needs a handful of lines:

```ts
import { loadPack } from './art/runtime/index.js';
import { pixiAdapter } from './art/runtime/adapters/pixi.js';     // or threeAdapter / canvas2dAdapter
import { Assets, Packs } from './art/assets';
const pack = await loadPack(Packs.main, pixiAdapter());
const hero = pack.sprite(Assets.hero, { state: 'walk', parent: stage });   // states / variants are typed
hero.faceToward(dx, dy).at(x, y, depth).update(dtMs);                      // nearest facing, mirror-aware
pack.tiles(Assets.floor).node(x, y, { variant, parent });                    // tiles: autotile resolve + variants
pack.effect(Assets.spark, { parent }).spawn(x, y);                           // effects (update them every frame)
const h = hero.anchor('hand');                                               // this frame's hand, relative to the sprite
if (h) sparks.spawn(x + h.x * scale, y + h.y * scale);                       // VFX and held props follow the drawing
```
Iso games use `isoToScreen` / `depthKey` for placement and draw order; three.js billboards use
`face(billboardAngle(heading, sprite.node, camera))` and `tileTexture(pack, Assets.floor, { repeat })` for surfaces.
Reference: `tools/artgen/runtime/` (the README-level docs are the comments at the top of each file).

## 6. Restyle (`{{CMD}}restyle`)
After a new direction version is locked (art-direction skill → `direction new` → tile → lock):
`{{ARTGEN}} restyle` re-renders every finished asset under the old and new direction, writes
`art/sheets/restyle-vA-vB.png` (before | after | token diff) and sends changed assets back to `final`. Open the sheet:
a palette or line change should keep tokens at ~100 %; check gate failures and FINISH-STALE patches, revise those
(feedback on the finish route), then show the gallery for re-approval and re-export.

## 7. Analytics
`{{ARTGEN}} analytics [--out art/ANALYTICS.md]`: score gained per pass (revisions vs finishing), cost per asset by kind,
size and view, regressions, first-pass quality per template, user revision rate, model/effort comparison, and budget
suggestions (e.g. stop at v2 for a kind where v3 rarely helps). Mention notable suggestions to the user; change the
config only with their agreement.
