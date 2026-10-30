---
name: asset-production
description: Produce the game's art assets with artgen — write briefs into art/briefs.yaml, run every brief through the full pipeline (v1–v3 + finish) autonomously with the art-reviewer subagent and the gate, show the user a gallery of finished assets, handle their approvals and feedback, export atlas packs and the artgen runtime (Pixi.js, three.js, Canvas 2D adapters) for the game code, and restyle after a direction change. Use when the user asks for sprites, props, tiles or effects for the game, wants to see or approve assets, export them, wire them into the game, or change the look of existing assets.
---

# Asset production

The user gives you a list of things the game needs; you deliver **finished** assets. Everything between the brief and
the finished asset runs **without asking the user**: you write each version, the `art-reviewer` subagent scores
it, the gate checks it, and the pass machine decides the next step. The user sees only the gallery of finished assets
and answers with approvals or feedback. CLI: `node tools/artgen/artgen.js`. Asset arguments take a brief id (`goblin`) or a directory.

Read the **artgen** skill first (its rules R1–R14, T2+ and finishing references). There must be a locked
direction (`node tools/artgen/artgen.js direction show`); if not, run the art-direction skill.

## 1. Briefs (`/artgen-brief`)
Turn the user's list into briefs, one per asset, in `art/briefs.yaml`:
```
node tools/artgen/artgen.js brief add goblin --kind character --directions 8 --anims walk:4,attack:3 --notes "hunched, big ears, rusty cleaver" --priority 1
node tools/artgen/artgen.js brief add crate --kind prop --variants 3 --notes "half-sunk, iron bands"
node tools/artgen/artgen.js brief add mud --kind tile
node tools/artgen/artgen.js brief add wisp --kind effect --object "will-o'-wisp flame with orbiting sparks" --anims idle:6 --importance filler
node tools/artgen/artgen.js brief list
```
A brief may list reference images (`refs: [refs/goblin-1.png]` in `art/briefs.yaml`: PNGs under `art/refs/`). Every review sheet shows them in a REFERENCES row under the anchors (a missing one, or one that isn't a PNG, is skipped with a warning), and `node tools/artgen/artgen.js sheet <id>` writes the asset's one-page data sheet (kind, size and px per metre, states, facings, frames, template, budget, palette, the animation contract, the references) to `out/sheet.png` and `sheet.json`, which the user reads in **Asset Review**.
Kinds: `character creature prop tile tileset texture effect viewmodel ui-icon`. `--size` takes a direction scale key or
`WxH`. `--swaps red:cloth=accent` adds a palette-swap variant (ramp → ramp, exported for the runtime). `--importance
hero|standard|filler` picks the pass budget tier. `--height <metres>` gives the thing's real-world height (a barrel
1, a rat 0.25, a pillar 3): every render then reports `height` against the direction's world scale, so props and
creatures are drawn to one scale instead of filling their frames — give every non-tile brief one. An upright
character or creature drawn more than 15 % off its height **fails** the gate (`review.heightFail`); props only flag.
Editing `briefs.yaml` by hand is fine; the CLI validates it.

**Body.** `--body quadruped|serpent|flyer|large` starts a character or creature from its rig instead of the humanoid
walker: wolves, rats, lizards and kobolds on all fours, snakes, eels and naga tails, bats, wasps and birds, dragons and
other very large creatures (brief those on a large frame, `--size large`). Each rig has four facings, a walk and a
`ground` anchor. Iso briefs start from the iso walker and iso rigs. The characters and creatures are built on the shared
body rigs (`ctx.lib.rigs.body(plan, ctx, { height })`): the skeleton, gait and facing come from the library, so only dress it, and
never resize its bones per frame (the `rig-lengths` stage check fails limbs that stretch between cells).

**Materials.** `brief add` warns when a brief names a material its kind's ramps leave out (a lute or staff on a
character without wood, steel on a creature without metal, lava on a tile without glow, rubble on a prop without dirt):
the maker would draw it in another material. `node tools/artgen/artgen.js brief lint` lists the warnings for every brief. Settle each
one before `make`: add the ramp to the direction (a new direction version) or reword the brief.

**Effects name an object.** An effect brief needs `--object`: the thing a draftsman could draw from memory ("ice lance",
"ring of fire", "a fan of playing cards"), described without the word *effect* and without colour words (colour comes
from the direction). "Cold flame", "enemies miss for 3 seconds" or "a shadow runs along the floor" have nothing to
draw and come back as a smudge however many passes they get — if no noun survives, settle the concept with the user
before production. Briefs written without one show `brief: effect brief has no object` as an open issue.

**Timing.** `--durations attack=80/80/200/80` sets milliseconds per frame (one per frame in `--anims`) and overrides
the state's fps. Give every attack a held contact frame (≥ 2× the others): without it the hit slides instead of
landing. Attacks need at least anticipation, contact, follow-through and recovery — 4 frames, not 3.

**Animation contract.** The first export of an asset freezes `art/contracts/<id>.json`: state names, logical frame
counts, per-frame durations, loop, facings and anchor names — what game code indexes. Later versions may redraw every
pixel but not change that: `brief add` refuses an edit that breaks it, and `export` refuses to write anything. Adding a
state, facing or anchor just extends the contract. Only pass `--break-contract` (brief) / `--break-contract <id>`
(export) when the user says the game code has been updated for the change — ask them first.

## 2. The autonomous run (`/artgen-make`)
Loop until `make` says nothing is left — **do not stop to ask the user** between steps:
```
node tools/artgen/artgen.js make [ids|all]       # scaffolds new briefs from templates, marks finished ones `final`, prints `next: <id> — <step>`
```
Do exactly the step it names, then call `make` again:

| step | what you do |
|---|---|
| `review base.v1` (fresh from the template) | first **adapt base.v1.js to the brief** (it is unscored, so editing it is allowed), then review |
| `review <version>` | delegate to the **art-reviewer** subagent: it builds the sheet (`node tools/artgen/artgen.js review <id> --version v`), looks at it, and records `node tools/artgen/artgen.js score <id> <v> <0-10> --note "…" --reviewer art-reviewer` |
| `blind-review <version>` | start a **new** art-reviewer subagent (never the one that reviewed the passes, never yourself) in blind mode: give it the asset id and version only. It runs `node tools/artgen/artgen.js review <id> --version <version> --blind`, judges that sheet alone, and records `node tools/artgen/artgen.js score <id> <version> <0-10> --blind --reviewer art-reviewer --note "…"`. Don't tell it the earlier scores. The version is the best-scoring one so far — a base as often as a finish |
| `write-base base.vN` (`r2`, `r3`) | copy the version it names in `from` (the best so far, R12) to `base.vN.js`, change **one thing** the last review note asked for, header comment says what |
| `write-base` (`x1`) | the final failed the gate, or the blind re-score came in under the bar or more than a point under its own score, or a roster note opened it (`feedback --by roster`): one extra autonomous revision within budget — fix the failing check, or what the blind reviewer or the roster named |
| `write-finish finish.vM` | `node tools/artgen/artgen.js finish <id> --base <base>`, then fill in the ops the review asked for (`references/finishing.md`). With `review.finish: auto` (the default) this step only comes when the base's review names a finish-level problem (outline, banding, clusters, jaggies, stray pixels) or the base already clears `approveMin` — so **name finish-level problems in review notes** when you see them |
| `write-base` / `write-finish` (`u1`, `f2`…) | a user feedback round (§4): do what the user asked, nothing else |
| `stage-gate shape|placeholder` | the **user's** step, never a maker's: the asset waits at a gate (see *Stages and gates* below) |

The pass machine already applies R12 (revise from the best), the finishing pass on the best base when it is worth it,
the blind re-score (`review.blind` in the config, on by default), the extra revision when the final fails the gate or
the blind score (`review.blindRevisions` has its own budget), and finally marks the asset `final` with any open issues
listed. **The final is the best version, not the newest**: gate-passing versions first, then the best blind score, else
the best own score — a finish that scores under its base ships the base. `status` and the gallery show `final≠best`
when a higher own score lost on the gate or its blind score. A version the user approved stays the final until a newer
one is written. In the first production run the finishing pass averaged −0.06 and regressed 30 % of assets for a third
of the tokens, which is why it is no longer automatic (`review.finish: always` brings it back). Why blind: in artgen's calibration study, scores
given by the reviewer that watched an asset improve ran half a point above blind scores and passed concept misses (a
barrel that reads as a crate). Never score your own work: an asset you
wrote is scored by the art-reviewer subagent; scores without `--reviewer` are recorded as `self` and shown as `SELF`. Animated assets: global
finishing ops run on every frame and facing; patches placed at `ctx.at('<anchor>')` follow the anchor through the other
frames of the same facing — keep `anchors(ctx)` in the base correct for every frame. Large sheets (8 facings ×
walk) are reviewed as one row per unique facing; the west facings are mirrors.

**Stage models.** `art/artgen.config.json` → `models` maps stages (`base` = v1, `revise` = v2/v3/extra/user,
`finish`, `review`) to a model and effort, plus optional review tiers: `reviewEarly` (the r1 and r2 reviews), `blind`
(blind re-scores) and `roster` (roster reviews); a tier left out uses `review`. When a stage or tier names a model other
than `default`, run it as a subagent with that model. Recommended: a cheaper, faster model for `reviewEarly` (early
drafts only need steering), and the strong model for revisions, `blind` and `roster` — they decide what ships. Scores
record the mapping; pass `--model`, `--effort`, `--tokens-in`, `--tokens-out`, `--ms` to `score` when you have measured
values, and `--agent-tokens-in <n>` with the total input the maker or reviewer read for the pass (skills, direction,
rigs) when you know it — without it analytics counts only code and review images, a fraction of the real cost.

**Sheet detail.** `review.sheetDetail` maps passes to `low` or `full` (default `{ "r1": "low" }`); `review --detail
low|full` overrides it. A low sheet shows the first facing at 3× beside the previous version only — about half the
image tokens — which is enough to steer a first draft. Blind sheets are always full. `review --scene` adds the sprite at
game zoom on the background, a floor and beside a wall: use it when contrast is in doubt (a dark creature for dark
floors, brown cloth that could read as skin).

**Budget.** `budget` in the config: `revisionPasses` (per `perKind` and per importance `tiers`),
`extraAutonomousRevisions`, `maxImageTokensPerAsset` (over it, `make` finishes the asset as it is and lists why),
`maxSheetEdge`, `maxUserIterations`. A per-kind entry wins over the importance tier. New projects start with
`perKind` textures at 2 passes and props at 4 (artgen's own analytics: a third pass rarely helps a texture, a fourth
still helps props); change them freely. Batches: `make` works through briefs in priority order; work one asset to `final`
before the next unless the user asked for a quick pass over all.

**v1 roster.** With two or more non-tile assets in the run, `make` holds every v2 until each asset has a scored v1 and
a roster review of the v1s is recorded (`review.earlyRoster`, on by default): it prints `v1 roster: … wait for it` and,
once every v1 is in, `next: artgen roster --stage v1`. Run it like the final roster (§3) with `--stage v1`; the
findings (look-alike silhouettes, twins, a foe that reads as friendly, scale) go into each asset's v2 step, where they
are cheap to fix.

### Stages and gates
Every version is also read as **stages**: placeholder, shape, decorate (the look), animation. Each has a key (`node tools/artgen/artgen.js stages <id>` prints them and says
which the user approved as they are now), so a revision that keeps the silhouette keeps the shape key and needs no new shape review. Two stages can be
gated, so the user sees the cheap thing before the expensive one is built on it. Gates are per kind (`review.gates` in the config; `artgen init` gates the
**shape** of characters and creatures) or per brief (`brief add --gates placeholder,shape`); projects without gates run as before.
- **Placeholder.** `node tools/artgen/artgen.js placeholder <id>` writes `placeholder.json` (flat shapes at the brief's size, pivot, footprint and collision box, the anchors
  the template will export), renders `out/placeholder.png` and checks it. When the game wants something to run with now, `node tools/artgen/artgen.js export
  --placeholders` puts every asset that is not approved into the pack from its placeholder (`placeholder: true` in `pack.json`, same animation contract);
  the real art replaces it on a later export and no status moves. A **placeholder gate** holds the first base until the user approves it:
  show them `out/placeholder.png`, then `node tools/artgen/artgen.js stage approve <id> placeholder` (or `stage reject <id> placeholder --note "…"`).
- **Shape.** With a shape gate **v1 is a shape draft**: draw silhouette and form only (flat materials, no `proc` layers, no finish), nothing else. After v1 is
  scored `make` / `pass next` return `stage-gate shape`: build the small shape sheet (`node tools/artgen/artgen.js review <id> --version base.v1 --stage shape`), show it to the
  user (the silhouettes at 1× and 3×, the placeholder box and pivot, the shape checks), and wait. Their answer is yours to record, never your own call:
  `node tools/artgen/artgen.js stage approve <id> shape --note "<their words>"`, or `stage reject <id> shape --note "<what they asked for>"`, after which the next base
  redraws the silhouette and form before any decoration. Approve refuses while a shape check *fails* (`--force` only when the user says so). After the approval
  keep the approved silhouette: v2 and v3 decorate it, and `artgen stages <id>` shows whether the shape moved (`changed` asks the user again).
- **Decals** (stage 4). Damage, dirt, emblems and team colours go in as `decal` proc layers (`.add('decal', { name, part, mat, shape })`), not as extra body shapes: each is
  its own mask on its own ramp, shaded with the surface, and `artgen stages <id>` shows the `decal` key and the `decal-inside` check (a decal that lands on nothing fails).
  A decal on `accent` follows the brief's `swaps`, so a team colour is one layer.
- **Rotated assets** (stage 6). A vehicle, ship, turret or projectile that turns freely is drawn once: `brief add <id> --kind prop --directions 8 --rotate rotsprite [--rotate-from e]`.
  The module draws only the `rotate-from` facing (default `e`, pointing east) and every other facing is that cell turned by RotSprite (anchors, normals and decals turn with it, nothing
  is mirrored). Keep the part near the middle of the frame: `node tools/artgen/artgen.js stages <id>` fails `rotation-clip` when a turn pushes more than 2 % of its pixels out, and flags `rotation-area` and
  `rotation-pieces` (a thin part that broke apart). `ctx.lib.rotsprite(grid, deg)` turns a part inside a drawing (a held weapon at an angle).
- On a pull request the user answers `approve goblin shape` or `goblin: shape: arms too long`; `pr prepare` puts the pending shape sheets in `art/review/`.

### Parallel make (many assets)
With several briefs in the pipeline, run them as **rounds** — one maker subagent per asset, all at once:
```
node tools/artgen/artgen.js make [ids|all] --parallel 4 --json   # `work.makers` (this round), `work.queued`, `work.main`
```
- Each **maker** packet is an authoring step for one asset (`write-base`, `write-finish`, or adapting a template
  `base.v1`). Start one **art-maker** subagent per packet, in parallel, and hand it the packet (`id`, `owns`, `step`,
  `writes`). It owns that asset's directory: it writes only the file(s) in `writes`, renders and fixes the gate inside
  its directory, then runs `node tools/artgen/artgen.js review <id> --version <v>` and returns the sheet path. The ledger line that
  review appends is the one shared write (appends are whole lines, safe from parallel processes).
- The **main** agent (you) keeps everything that judges or decides: the `review` packets and each maker's returned
  sheet go to a fresh **art-reviewer** (scores with `--reviewer art-reviewer`), `blind-review` packets to a new
  art-reviewer in blind mode, and after the last round the roster review (§3). Makers never score, approve, run
  `make`, edit `briefs.yaml` or touch another asset's directory.
- When the round's reviews are scored, call `make --parallel` again; `queued` packets join the next round. Check
  `git status art/` after a round: changes outside the makers' `owns` directories (other than `art/ledger.jsonl`)
  mean a maker overstepped — revert them.
- Use it for batches of 3+ assets; one or two go faster through the plain loop. Pick the round size (4 is a good
  default) by how many subagents you can run at once.
- **Waves.** For big batches add `--wave <n>` (e.g. 10): only the first n unfinished assets get packets; the rest wait
  in `queued` until those reach final. Fewer assets in flight means fewer half-done ones when a usage limit pauses
  the run.
- **Resume.** Everything `make` decides comes from the files and the ledger, so after a pause or a stalled subagent
  just call `make --parallel` again and start fresh makers on the packets it returns. A packet marked `resume: true` is
  a version file a maker wrote but never reviewed: the new maker checks it, completes it if it is unfinished, and
  reviews it — it does not start over.

## 3. Roster review, then show the user (`/artgen-review`)
When `make` reports nothing left, review the **roster** before the gallery — it catches what no single-asset review can
(assets drawn to fill their frames, a brazier outshining the torch, friend and foe in one ramp, two styles in one game):
1. `node tools/artgen/artgen.js roster` writes `art/sheets/roster-lineup.png` (every finished non-tile asset on one baseline),
   `art/sheets/roster-silhouettes.png` (shuffled, lettered black silhouettes) and `art/sheets/roster-assets.json`, and
   prints the size table (drawn vs brief height, measured as the gate measures it) and the most similar silhouette
   pairs. Over 26 assets it pages in the same call: `roster-lineup-1.png`, `roster-silhouettes-1.png`, `-2`… with
   labels running on past Z (AA, AB…); give the reviewer every page.
2. Start a fresh **art-reviewer** in roster mode with those files only. It returns the review JSON.
3. `node tools/artgen/artgen.js roster record <file> --reviewer art-reviewer` turns it into open issues on those finals (silhouettes
   rated ≤ 2, wrong scale, lineup issues).
4. Act on the issues the user would mind before showing them: `node tools/artgen/artgen.js feedback <id> --by roster --route base
   --note "<the roster note>"` opens a revision recorded as **yours** (an extra autonomous revision within
   `review.rosterRevisions`, never counted as the user's), then `make` runs it. List the rest with the asset.

Then `node tools/artgen/artgen.js gallery` → open each `art/sheets/gallery-N.png` and show them to the user with a short line per asset:
score, blind score (`b6.5` on the sheet; `SELF` means only the maker scored it) and open issues. Assets whose blind
score (else own score) is under `review.approveMin` are labelled **BELOW BAR**: present them separately, after the
others, say they are under the bar and why, and ask whether to approve them as they are, give feedback, or leave them —
never fold them into a batch approval. `node tools/artgen/artgen.js status` lists every brief:
`brief → in-pipeline → final → approved → exported`, plus `revision` (user feedback in progress) and `stale`
(approved, then the direction changed).

## 4. The user answers (`/artgen-approve`, `/artgen-feedback`)
- Approve: `node tools/artgen/artgen.js approve <id> [--note "…"]` — only the user decides this; run it when they say so. It refuses a
  final whose gate fails (R6): explain the open issue and propose feedback instead. When it prints a note for the
  user (no blind re-score, or the blind one disagrees), tell them in one line; the approval still stands.
- Feedback: pick the **route** from what they asked for, record it, then go back to `make` (it runs autonomously):
  - form, proportion, colour choice, pose, missing part → `node tools/artgen/artgen.js feedback <id> --route base --note "…"` (a new
    base from the version they saw; re-finished afterwards)
  - pixel-level (a stray pixel, eye shape, line weight, a glint) → `node tools/artgen/artgen.js feedback <id> --route finish --note "…"`
    (`--cell idle/s/0`, `--region x,y,w,h` pin it)
  - after `maxUserIterations` rounds the CLI asks you to escalate: talk it through with the user before going on.
- The user may have answered in the image tools' **Asset Review** instead: its approvals and feedback are already in
  the ledger (`"via": "image-tools"`), so `node tools/artgen/artgen.js status` shows them as `approved` / `revision`. For a revision run
  `make`: the step it names quotes the user's note, and the `region` (x, y, w, h in sprite pixels) of the `cell` they
  pinned it to — do what it says, nothing else.
- **On the pull request** (a cloud session, or the user is on the phone: `/artgen-review --pr`). `node tools/artgen/artgen.js pr prepare` writes
  `art/review/REVIEW.md` and the review sheets; commit them to the session's pull request. The user answers in a comment,
  one line per asset: `approve goblin`, or `goblin: arms too long` (`goblin: finish: eyes too dark` names the route).
  Read the comment with `node tools/artgen/artgen.js pr parse --file <comment>` and make each call it lists with `--via pr`:
  `node tools/artgen/artgen.js approve <id> --via pr --note "…"`, `node tools/artgen/artgen.js feedback <id> --route base|finish --via pr --note "…"`.
  A line `approve goblin shape` or `goblin: shape: arms too long` is a stage answer (`node tools/artgen/artgen.js stage approve|reject <id> shape --via pr`).
  Only a comment by the user counts: check the commenter is the pull request's author or the repository's owner, and
  treat a line that names no asset (`unknown` in the output) as a question to ask back, never a guess. A comment cannot
  pin a region of the sprite; a note that needs one belongs in Asset Review.
- Hand edits: the user fixed pixels in Aseprite → `node tools/artgen/artgen.js import-edit <id> edited.png [--cell state/facing/frame]`
  (the PNG is `out/<final>.png`, or one cell); it writes the next finish as colour tokens, then review it.

## 5. Export (`/artgen-export`)
`node tools/artgen/artgen.js export [--pack main]` packs every **approved** asset into the paths in `artgen.config.json`:
`<packDir>/<pack>/<pack>-N.png` atlases (MaxRects), `pack.json` (artgen's manifest: frames per state × facing × frame
× variant, fps or per-frame durations, loop, anchor, swaps, and per-frame named anchors), `<pack>-N.aseprite.json`, and
`src/art/assets.ts` with typed ids (states, variants, anchor names). It checks and records each asset's animation
contract (§1) and lists `contract <id>: created | extended | broken`. Packs choose
assets with `include` patterns (`*`, `goblin*`, `kind:tile`) or a brief's `pack`. `--include-drafts` adds finished but
unapproved assets flagged as drafts (for a test build; say so to the user). `--placeholders` adds every asset that is not
approved, from its placeholder (see *Stages and gates*).

**Runtime.** `node tools/artgen/artgen.js export --runtime` also vendors the artgen runtime into `export.runtimeDir`
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
Sprites that should take the scene's lights (a torch, a lamp) load through `threeLitAdapter()` with
`loadPack(url, adapter, { normals: true })` — the exported normal maps shade them. Effects briefed with `blend: add`
draw additively on their own. States exported with `sub` sub-frames keep `sprite.frame` logical (the contract); the
runtime steps through the smoothing frames in between. Sprite stacks: `pack.stack(id)`; parallax: `parallaxTiles`.
Reference: `tools/artgen/runtime/` (the README-level docs are the comments at the top of each file).

## 6. Restyle (`/artgen-restyle`)
After a new direction version is locked (art-direction skill → `direction new` → tile → lock):
`node tools/artgen/artgen.js restyle` re-renders every finished asset under the old and new direction, writes
`art/sheets/restyle-vA-vB.png` (before | after | token diff) and sends changed assets back to `final`. Open the sheet:
a palette or line change should keep tokens at ~100 %; check gate failures and FINISH-STALE patches, revise those
(feedback on the finish route), then show the gallery for re-approval and re-export.

## 7. Analytics
`node tools/artgen/artgen.js analytics [--out art/ANALYTICS.md]`: score gained per pass (revisions vs finishing), cost per asset by kind,
size and view, regressions, first-pass quality per template, user revision rate, model/effort comparison, and budget
suggestions (e.g. stop at v2 for a kind where v3 rarely helps). Mention notable suggestions to the user; change the
config only with their agreement.

**Across projects (v2).** One game has too few assets per kind to tune a budget; pool the ledgers of several (other
game repos with artgen, or bench folders): `node tools/artgen/artgen.js analytics --across ../game-a,../game-b,. [--out art/RECOMMEND.md]`.
It recommends `revisionPasses` per kind (the last pass whose mean gain on the best-so-far score is still ≥ 0.25),
an image-token cap per kind (1.5 × p90), a model/effort per stage when two mappings have been tried (else an
experiment for the stage that gains least), and notes on finishing, user revisions and blind gaps — each with its
evidence and a confidence. `--apply` merges the config patch (`budget.perKind`, `models`) into this project's
`art/artgen.config.json`; only with the user's agreement.

**Pooling for the artgen repo.** `node tools/artgen/artgen.js metrics export` writes `art/metrics/<artgen version>.json`: counts and ratios per kind and per pass
(assets, approved, tokens, minutes, first-pass approval, gate checks that failed), with no images, ids, notes or paths. The user decides
whether to commit it or send it on; `node tools/artgen/artgen.js metrics pool <file or folder>…` puts exports from several repos side by side per artgen
version, which is how a release is judged on whether it made production cheaper.
