# Stage graph (R6)

Status: design, 2026-10-30. This is phase R6 of [`TOOLING-PLAN.md`](TOOLING-PLAN.md) (§8, §10). It builds on the
operation registry ([`OPERATION-REGISTRY.md`](OPERATION-REGISTRY.md)), the workflow package ([`WORKFLOW.md`](WORKFLOW.md))
and the image tools (R5b). §13 records what was built and where the build differs from this design.

## 1. Goal

Today an asset is one source file per version (`base.vN.js`, then `finish.vM.js`) that draws everything at once:
silhouette, materials, shading, effects and facings. The pass machine runs v1 → v2 → v3 → finish → blind re-score on
every asset, and the game gets nothing until the user approves the final. A wrong silhouette is found by the user at
the end, after three revisions and a finish were spent on it.

After R6 an asset is a chain of **named stages** (plan §8). Each stage has a check, a **stage key** (a digest that says
whether the stage's result changed) and, for the first two, an optional approval **gate**:

| # | Stage | Key (what it digests) | Check | Gate | Sub-phase |
|---|---|---|---|---|---|
| 0 | placeholder | the placeholder file (or the brief defaults) | size, pivot, box, footprint inside the frame | yes | R6a |
| 1 | shape | the silhouette of every cell, outer line removed | pivot, box, readability, facings, empty | yes | R6a |
| 2 | rig | bone names and lengths of a rigged asset | lengths the same in every cell | — | R6b |
| 3 | decorate | every pixel's colour (the "look") | the conformance gate, as today | — | R6a (key) |
| 4 | decal | the decal masks | each decal lands on its part | — | R6c |
| 5 | lighting | the normal maps and the light direction | — | — | R6a (key), R6c (runtime) |
| 6 | rotation | facings and how they are made | area, pieces, clipping of rotated facings | — | R6d |
| 7 | animation | the animation contract and the anchors of every frame | — (anim QA, as today) | — | R6a (key) |

The stages are **views of the same source**, not new source files. A version still draws everything; the engine reads
each stage's result off the render. Nothing an existing asset or consumer has written changes.

**Accept (plan §10):** on the bench, tokens and passes per approved asset fall against the R0 baseline, with no drop
in blind score; a restyle re-runs only stages 3 and later. Also (§10 for every phase): `npm run check`, `npm test`,
`check:packages`, `test:packages`, the strict boundary lint, the bench and the consumer fixtures stay green, and existing
behaviour is unchanged unless this design says otherwise (§11).

The first half of the accept needs real production runs with a model and a person, which a build session does not
have (as for R4). §12 says what is measured instead.

## 2. What R4's metrics say, and the order of the sub-phases

The plan orders R6's sub-phases by the R4 metrics. From [`metrics/baseline.json`](metrics/baseline.json), the pooled
exports ([`metrics/pool/POOL.md`](metrics/pool/POOL.md)) and the three example ledgers:

- Every asset takes **4.7–4.8 passes** before approval, and 5.6k tokens per approved asset. First-pass approval is
  0.53: half the assets needed user feedback.
- Of the 15 user feedback notes in the example ledgers, **8 were on the base route** (form, size, proportion: "it's a
  green blob", "too small and lumpy", "the head is a plain dome") and 7 on the finish route. A base-route note means
  the passes before it built decoration on a shape the user then rejected.
- No asset reaches the game before approval; there is no placeholder at all.
- Characters and creatures are a third of the scored assets in the bench and the examples (19 of 57; props are 15), and each
  template computes its own skeleton by hand; written code is about 2k of the 5k tokens per asset (archive D19).
- The top failing gate checks are `line` (3) and `light` (1). No asset in the examples needed a decal, and none is a
  2D-only rotating sprite (the bench has two vehicles).

So: **R6a** (placeholder, shape gate, stage keys) first; it attacks the biggest measured cost. **R6b** (rig library)
second; it cuts code per character and creature. **R6c** (decals, lit sprites) and **R6d** (RotSprite) add breadth and
come last.

## 3. Decisions

1. **Stages are read off the render, not authored as files.** A stage key is a digest of the stage's *output* (the
   silhouette, the bone lengths, the pixels), so a revision that redraws the decoration but keeps the silhouette has the
   same shape key, whatever changed in the source. This is the "early cut-off" rule of build systems: a stage whose
   output did not change does not make the stages after it, or its own review, run again. Rendering is cheap (about
   0.1 s an asset); what the keys save is review and model passes, not CPU. There is **no render cache** in R6.
2. **Gates are opt-in, per kind, and only `placeholder` and `shape` are gateable in R6.** `review.gates` in
   `artgen.config.json` maps a kind (or `*`) to a list of gated stages, and a brief's `gates` overrides it.
   `DEFAULT_CONFIG` has none, so existing projects behave exactly as before; `INIT_CONFIG` (new projects) gates the shape of
   characters and creatures. Filler tiles keep today's path (plan §12, risk 2).
3. **Only the user passes a gate** (D10, like `approve`). A gate's checks must pass before the user can approve it.
4. **Stage checks are a second report, not part of the conformance gate.** They are computed beside conformance, shown
   by `artgen stages`, the shape sheet and `review`, and recorded in the ledger, but they do not change
   `conformance.pass`, the printed check list of `render` or any recorded transcript. They block only the gate they
   belong to. Folding them into conformance is for a later format bump.
5. **The placeholder is an asset module made from data.** `placeholder.json` is turned into an `AssetModule`, so the
   placeholder renders, packs, exports and satisfies the animation contract through the same code as any asset.
6. **Placeholder exports are marked, never counted as the asset's export.** The game can load them; the asset's status
   does not move.
7. **The new code goes where its layer says**: pure ledger and gate logic in `artgen-workflow`; stage keys, stage
   checks, the placeholder module and the pass-machine changes in `artgen-core`; the rig library, decals and RotSprite
   in `artgen-scene` / `artgen-primitives`; the lit-sprite adapter in `artgen-runtime`; I/O and operations in the CLI. The
   strict boundary lint must stay at 0 violations.

## 4. Stage ids and stage keys

### 4.1 `artgen-workflow/src/stages.ts` (new, exported from workflow's index)

```ts
export const STAGES = ['placeholder', 'shape', 'rig', 'decorate', 'decal', 'lighting', 'rotation', 'animation'] as const;
export type StageId = (typeof STAGES)[number];
export const GATEABLE = ['placeholder', 'shape'] as const;
export type GateStage = (typeof GATEABLE)[number];
/** Stage keys of one version: a short digest per stage; absent = the stage does not apply (not rigged, no decals…). */
export type StageKeys = Partial<Record<StageId, string>>;

/** The gates of one brief: its own `gates`, else `review.gates[kind]`, else `review.gates['*']`, else none. */
export function gatesFor(cfg: Record<string, GateStage[]> | undefined, brief: { kind: string; gates?: GateStage[] }): GateStage[];

/** Stage verdicts in the ledger (`type: 'stage'`), oldest first. */
export interface StageVerdict { stage: GateStage; verdict: 'approve' | 'reject'; key: string; version?: string; note?: string; ts?: string }
export function stageVerdicts(ledger: LedgerEntry[], stage?: GateStage): StageVerdict[];
/** The latest verdict on `stage`; `approvedKey` is the key of the latest approve (undefined when the latest verdict is a reject). */
export function stageState(ledger: LedgerEntry[], stage: GateStage): { latest?: StageVerdict; approvedKey?: string };
/** Compare two key sets stage by stage: same / changed / added / removed. */
export function diffStageKeys(a: StageKeys, b: StageKeys): Record<StageId, 'same' | 'changed' | 'added' | 'removed' | 'n/a'>;
```

Add `'stage'` to `LedgerType` in `ledger.ts`. A stage entry:

```json
{"type":"stage","asset":"goblin","stage":"shape","verdict":"approve","key":"9b1e0c77","version":"base.v1","note":"good, keep the hunch","by":"user","via":"pr","ts":"…"}
```

### 4.2 `artgen-core/src/qa/stages.ts` (new, exported from artgen-core's index)

Keys are the first 8 hex digits of the same hash `Grid.hash()` uses, over a canonical byte string. Every key must be
deterministic across runs and platforms (no `Map` order or float formatting that can differ).

```ts
/**
 * The silhouette of one cell: opaque pixels (alpha 255; translucent shadows and glows are not shape), minus the
 * direction's outer line. The outer line is 1 px drawn outside the fill (`post.outline`, `post.selout`), so when
 * `line.outer` is not `none`, an opaque pixel that touches a non-opaque one (4-neighbours) and whose colour is a line
 * colour (the outline colour, or the darkest step of any ramp for `selout`) is removed. A palette-only or line-only
 * restyle therefore keeps the mask.
 */
export function shapeMask(g: Grid, dir: Direction): Uint8Array;
export function stageKeys(r: RenderResult, dir: Direction, o: { placeholder?: Placeholder; rotate?: string }): StageKeys;
export interface StageCheck extends Check { stage: StageId }
export interface StageReport { keys: StageKeys; checks: StageCheck[] }
export function stageReport(r: RenderResult, dir: Direction, o: { brief: Brief; placeholder?: Placeholder }): StageReport;
```

What each key digests:

| Stage | Bytes hashed |
|---|---|
| placeholder | the canonical JSON of the effective placeholder (§5.1) |
| shape | the size, then for each cell in render order its `state/facing/frame` and its `shapeMask` |
| rig | for each rig the cells report (R6b), plan, bone names and rig-space lengths rounded to 0.01 px; absent when no cell is rigged |
| decorate | each cell's `grid.hash()` in render order (the colours: decoration, decals and baked shading together) |
| decal | each cell's decal masks by name (R6c); absent when no decals |
| lighting | each cell's normal map hash plus the direction's `camera.light`; absent when no cell has a normal map |
| rotation | the facings, the brief's `rotate` mode and `rotateFrom` (R6d) |
| animation | the animation contract (`briefContract` of the brief, without anchors) and every cell's anchor names and positions |

A palette, line or shading restyle changes `decorate` (and `lighting` if the light moved) and nothing before it. That
is the accept's "a restyle re-runs only stages 3 and later" (§5.6).

`renderVersion` in the CLI (`asset.ts`) computes `stageReport` beside `conformance` and returns it as
`stages: StageReport` on `VersionRender`.

## 5. R6a: placeholder, shape gate, stage keys

### 5.1 The placeholder

A placeholder is flat-coloured primitives at the right size, footprint, pivot and collision box, so the game runs with
it from day one. It lives at `art/assets/<kind>/<id>/placeholder.json`:

```json
{
  "format": 1,
  "size": [32, 32],
  "pivot": [16, 30],
  "body": { "x": 9, "y": 4, "w": 14, "h": 27 },
  "footprint": { "cx": 16, "cy": 30, "rx": 7, "ry": 3 },
  "collision": { "x": 9, "y": 27, "w": 14, "h": 6 },
  "ramp": "cloth",
  "anchors": { "head": [16, 9], "hand": [8, 19] }
}
```

`artgen-core/src/w2/placeholder.ts` (new):

```ts
export interface Placeholder { format: 1; size: Size; pivot: [number, number]; body: Box; footprint?: Ellipse; collision?: Box; ramp: string; anchors: Anchors }
export function defaultPlaceholder(brief: BriefEntry, dir: Direction): Placeholder;
export function parsePlaceholder(raw: unknown, brief: BriefEntry, dir: Direction): Placeholder;   // throws on a bad file
export function placeholderChecks(ph: Placeholder, brief: BriefEntry, dir: Direction): StageCheck[];
export function placeholderModule(ph: Placeholder): AssetModule;
```

Defaults (`defaultPlaceholder`), all whole pixels:

- `size`: `resolveSize(dir, brief.size, brief.kind)`. `pivot`: `defaultAnchor(brief, view, size)` from `w2/pack.ts`
  (export it), so the placeholder's pivot is the anchor the pack will carry.
- **Standing kinds** (`character`, `creature`, `prop`, `vehicle`, and any kind whose default anchor is the bottom
  centre): body height = `round(brief.height × pxPerMetre(dir))` when the brief has a height, else `round(h × 0.88)`,
  capped at the space above the pivot. Width by `brief.body`: humanoid (or none) 0.45 × height; `quadruped` and
  `serpent` 0.8 × w with height ≤ 0.5 × h; `flyer` 0.6 × w, lifted so a gap of 0.15 × h is left above the pivot; `large`
  0.9 × w. Props: 0.6 × w. The body's bottom sits on the pivot (except flyers). Footprint: an ellipse centred on the
  pivot, `rx = body.w / 2`, `ry = max(1, round(rx / 2))` (top-down and iso; none in side view). Collision: the
  footprint's bounding box (side view: the body box).
- **Centred kinds** (`tile`, `tileset`, `texture`, `layer`, `effect`, `viewmodel`, `ui-icon`, others): tiles, textures and
  layers fill the frame (body = frame, collision = frame for tiles, none otherwise, no footprint); effects and others a
  centred body of 0.6 × the frame, no collision, no footprint.
- `ramp`: character `cloth`, creature `skin`, prop and vehicle `wood`, tile and tileset `stone`, texture `stone`, effect
  `glow`, else the first ramp of `kindPalette(dir, kind)`'s source names. Any ramp of the direction is accepted.
- `anchors`: the names the kind's starting template exports, except the face anchors (`eye`, `eye2`, `mouth`), placed
  on the body: `head` at the top centre, 15 % down; `hand` at the body's left edge, at 60 % of its height; `ground` at
  the pivot. Characters get `head`, `hand`; creatures `ground`, `head`; others none. A test renders each kind's
  template and checks that every placeholder anchor name is among its anchors, so the first real export extends the
  contract instead of breaking it.

`placeholderModule(ph)` renders every state × facing × frame of the brief (`meta.mirror: false`):

- the footprint ellipse filled in the direction's shadow colour;
- the body as a rounded box (corner radius 1 px when both sides are over 6 px) in the ramp's middle step, with a 1 px
  outer line through `ctx.lib.line`;
- a **facing tick**: a 2 × 2 px block in the ramp's lightest step on the body edge toward the facing (`s` bottom centre,
  `n` top centre, `e` right middle, `w` left middle, diagonals at the corners; 16-way facings round to the nearest of 8);
- a **state shade**: the first state uses the middle step, the next states step one band lighter, then darker,
  alternating, so the game shows a state change;
- a **frame bob**: on odd displayed frames everything but the footprint moves up 1 px, so animation timing shows.
- `anchors(ctx)` returns `ph.anchors` (plus 1 px up on odd frames, like the body).

`placeholderChecks` (stage `placeholder`): `ph-size` (equals the brief's size: fail), `ph-pivot` (inside the frame:
fail), `ph-box` (body, footprint and collision inside the frame: fail; body height more than 20 % from the brief height:
flag), `ph-ramp` (a ramp of the direction: fail).

### 5.2 Placeholder commands and export

- **`artgen placeholder <id> [--force] [--size WxH] [--pivot x,y] [--ramp name]`** (operation `placeholder`, module
  `art`, effect `write`): writes `placeholder.json` from the defaults (refuses to overwrite without `--force`; the
  flags override single fields), renders it and writes `out/placeholder.png` (the strip), prints the checks. It works
  on a brief with no versions (it creates the asset folder and `brief.json` the way `artgen new` does, without writing
  `base.v1.js`). Exit 1 when a check fails. MCP: tool `placeholder` (it writes under `art/` only). Python: generated.
  It records `{"type":"stage","asset":id,"stage":"placeholder","event":"written","key":…,"by":"agent"}`; that entry has
  no `verdict` and `stageVerdicts` ignores it.
- **`artgen export --placeholders`** (new flag on `export`; MCP param `placeholders`): every brief in a pack whose
  status would not be exported (not approved or exported, and not `final` under `--include-drafts`) is exported from its
  placeholder (the file, else the defaults). In the manifest the asset has `"placeholder": true` and `version:
  "placeholder"`, `sourceHash` is the placeholder key, and the manifest lists them in `placeholders: [ids]` (sorted).
  The animation contract is written and checked as for any export, so game code written against the placeholder keeps
  working when the real art lands. The ledger `export` entry has `"version": "placeholder", "placeholder": true`.
  Without the flag, export is unchanged.
- `assetStatus` ignores placeholder exports: they never equal the final, which the current rule already requires.
  Add a test that pins it.
- **Runtime 1.3.0**: `PackAsset.placeholder?: true` and `PackManifest.placeholders?: string[]` in
  `artgen-runtime/src/types.ts` and in `artgen-core/src/w2/pack.ts` (the type-parity test keeps them in step).
  `Pack.placeholders: readonly string[]` (empty when absent). No console message: a placeholder is intended. Bump the
  runtime's `package.json` version and `RUNTIME_VERSION`, and add a line to the runtime README.

### 5.3 The shape stage

`shapeMask` is §4.2. Shape checks (stage `shape`, in `stageReport`), measured on the **stand frames** (`standFrames`
from conformance: the first state of the first facing) unless said otherwise:

| Check | Rule | Status |
|---|---|---|
| `shape-empty` | a cell with an empty shape mask | fail |
| `shape-pivot` | standing kinds: the lowest row of the stand frames' shape (ignoring flyers) is within 1 px of the pivot's y (`placeholder` when there is one, else the default anchor) | fail beyond 2 px, flag at 2 px |
| `shape-box` | standing kinds: the shape's height against the placeholder body's height | flag over 15 %, fail over 30 % |
| `shape-read` | readability at 1×: compactness `4π·area / perimeter²` (perimeter = shape pixels' edges that touch a non-shape pixel) of the stand frame. 1 is a disc: a high value reads as a blob | flag above the threshold; calibrate it on the approved example finals so that none of them flags, and write the measured range in the code's comment |
| `shape-facings` | assets with more than one facing: two facings that are not mirrors of each other whose masks overlap with IoU ≥ 0.97 | flag (they read the same) |

Kinds without a standing pivot skip `shape-pivot` and `shape-box` (status `skip`).

**The shape sheet**: `artgen review <id> [--version v] --stage shape` (new `stage` param on `review`: `shape` only in
R6) writes a small sheet instead of the full review sheet: for the first state, each drawn facing's shape mask in one
flat dark colour on the light review background at 1× and 3×; on the 3× ones the placeholder body box and pivot as 1 px
guides in the accent colour; the stage checks as text under it (the sheet font). It is logged as a `review` ledger
entry with `"stage": "shape"` and its image tokens, like any review. It should cost well under the full sheet; §12
measures it.

### 5.4 Gates and the pass machine

Config (`w2/config.ts`): `ReviewPolicy.gates: Record<string, GateStage[]>`. `DEFAULT_CONFIG.review.gates = {}`.
`INIT_CONFIG.review.gates = { character: ['shape'], creature: ['shape'] }`. Briefs (`w2/briefs.ts`): optional
`gates: GateStage[]` (`validateBrief` accepts only `placeholder` and `shape`); `brief add --gates shape,placeholder`.

The pass machine (`pipeline.ts`): `PlanInput` gains

```ts
gates?: GateStage[];
/** Stage keys per version name, as recorded on score entries (missing = unknown). */
stageKeys?: Record<string, StageKeys>;
/** Key of the current placeholder (the file, else the defaults). */
placeholderKey?: string;
```

and `NextStep` a variant

```ts
| { action: 'stage-gate'; stage: GateStage; version?: string; pass: 'g'; key?: string; why: string }
```

Rules, in this order, added to `planPasses` (nothing changes when `gates` is empty or absent: every existing test
and transcript must still hold):

1. **Placeholder gate**: `gates` has `placeholder`, no base exists yet, and `stageState(ledger, 'placeholder')` has no
   `approvedKey` equal to `placeholderKey` → `stage-gate placeholder` ("write it with `artgen placeholder <id>` if it is
   missing, export it with `--placeholders` if the game wants it now, show the user `out/placeholder.png` and wait for
   `artgen stage approve <id> placeholder`"; a latest reject adds its note). Once a base exists, this gate no longer applies.
2. The existing "review any unscored version first" rule.
3. **Shape gate**, checked before writing base v2 and later bases, and before the finish and `ready` steps: `gates` has
   `shape`, and let `cand` be the base the next step builds on (the best base so far; for finish and ready, the target
   base). If `stageState(ledger, 'shape').approvedKey` equals `stageKeys[cand].shape` → the gate is passed: go on as
   today. Otherwise:
   - when the latest shape verdict is a **reject** recorded after `cand` was scored → `write-base` of the next version
     from `cand`, with `why` "the user rejected the shape of `cand`: «note» — redraw the silhouette and form before
     any decoration";
   - else → `stage-gate shape` on `cand` ("build the shape sheet (`review --stage shape`), show it to the user, wait for
     `stage approve <id> shape` or `stage reject <id> shape --note …`"), adding "the silhouette changed since the
     approved one (base.vK)" when an older approve exists.
   A missing key counts as unknown (the gate is not passed).
4. Everything else as today.

So with a shape gate, v1 is a shape draft: the skill tells the maker to draw silhouette and form only (flat materials,
no `proc` layers, no finish) and the user sees the shape sheet before decoration starts. When the shape is approved,
v2 and v3 decorate it; a revision that keeps the silhouette keeps the same shape key and needs no new shape review
(the gate is passed by key). A user who changes their mind late is still asked again, because a changed silhouette
re-opens the gate.

`passState` (CLI) fills `stageKeys` from the score entries (§5.5), and, only when the shape gate is on, renders scored
versions whose entry has no keys (older ledgers). It passes `placeholderKey` when the placeholder gate is on.

`assetStatus` is unchanged: a `stage-gate` step is `in-pipeline`, its `why` says "waiting for the user: shape gate on
base.v1". `make`'s work packets treat `stage-gate` like `ready`: it is the main session's step with the user, never a
maker's. `status` and `make` print it.

### 5.5 Recording keys, and the stage commands

- `scoreVersion` records `stages: StageKeys` and `stageChecks: ["shape-read:flag", …]` (failing and flagged only) on
  the score entry. `approve` copies the final's `stages` from its latest score entry onto the approve entry (no new
  render).
- **`artgen stages <id> [--version v]`** (operation `stages`, module `art`, effect `read`; MCP `stages`; Python):
  one line per stage: its number, id, key (or `—` and why it does not apply), and state: `approved` (the gate's
  approved key, or the approve entry's key for stages ≥ 2, equals this version's), `changed` (an approval exists with
  another key), `new` (none), `n/a`; then the stage checks. JSON gives `{ version, keys, states, checks, gates }`.
- **`artgen stage approve <id> <stage> [--version v] [--note …] [--via …]`** and **`artgen stage reject <id> <stage>
  --note …`** (operations `stage.approve`, `stage.reject`, module `art`, effect `write`). Approve refuses when a check of
  that stage fails (`--force` overrides and records `forced: true`). The version defaults to the one the pending
  `stage-gate` names, else the latest scored base. The key is computed from that version's render (shape) or the
  placeholder (placeholder). MCP: `stage_approve` and `stage_reject`, both requiring `user_approved: true` like `approve`
  (the reject records the user's words).
- **Pull request review** (`loop/pr-review.ts` `parsePrComment`): `approve goblin shape` →
  `stage approve goblin shape --via pr`; `goblin: shape: arms too long` → `stage reject goblin shape --note "arms too
  long" --via pr`. Lines without a stage name are parsed as today. `pr prepare` puts a pending shape gate's shape sheet
  in `art/review/` with a line saying which answer it waits for.

### 5.6 Restyle

`restyle` computes the stage keys before and after for each asset and records `stages: { same: [...], changed: [...] }`
on its ledger entry; the restyle sheet's label says `shape kept` or `SHAPE CHANGED`. Status rules do not change (a
changed look still goes back to the user to re-approve), but the shape gate stays passed, because the approved shape
key still matches. A test: restyle a gated asset to a direction that changes only the palette and the line colour →
`placeholder`, `shape`, `rig`, `rotation` and `animation` are `same`, `decorate` is `changed`, and `pass next` asks for no
shape gate.

### 5.7 Metrics

Art metrics (`metrics export`, `generatorMetrics` for art) gain, as optional fields (schema stays 2):

- `gates`: per gated stage `{ approved, rejected }` counts from stage entries;
- `firstInGameMinutes`: median over assets with any export of the minutes from the asset's first ledger entry to its
  first `export` entry (placeholder exports count). This is the KPI "time to first placeholder in the game" (plan §11).
- A user's stage reject counts as user feedback for `firstPassApproval` (it is the user asking for a change).

Update `docs/metrics/README.md`.

### 5.8 Skills and docs

- `asset-production` skill: a section "Stages and gates": placeholders (when the game wants something now: `artgen
  placeholder`, `export --placeholders`), the shape gate (v1 is a shape draft; `review --stage shape`; ask the user;
  `stage approve`/`stage reject`; keep the approved silhouette afterwards, `artgen stages` shows if it moved), and what
  `pass next` returns at a gate. Keep it short; the commands' `--help` carries the details.
- `art-maker` agent: under a shape gate, v1 is silhouette and form only. `art-reviewer`: a shape sheet is scored on
  the silhouette only (it reads at 1×, the pose, the proportions), not on colour.
- `/artgen-review --pr`: mention shape gates. `art/claude-md.md`: one line on gates.

### 5.9 Tests (at least)

workflow: `gatesFor`, `stageVerdicts`/`stageState`, `diffStageKeys`. core: `shapeMask` (dark outline, selout,
`none`; a palette-only restyle keeps the mask), `stageKeys` determinism and the restyle property, the shape checks on
synthetic shapes, `defaultPlaceholder` for every kind × view with every check passing, `placeholderModule` renders the
brief's full contract (states, facings, frame counts), template anchor names cover the placeholder's, `planPasses`
with each gate rule (and unchanged without gates). CLI: `placeholder`, `export --placeholders` (manifest flags,
contract, status unchanged), the stage commands, `review --stage shape`, the gate flow end to end (brief → placeholder
gate → v1 → shape gate → reject → v2 → approve → v3 → finish → ready), PR parse lines, MCP `user_approved`. Runtime:
placeholders on a loaded pack.

## 6. R6b: the shared rig library

### 6.1 `artgen-scene/src/anim/rigs.ts` (new)

A reusable skeleton per body type, retargeted across characters (plan §3: Spine, DragonBones). It builds on
`anim.rig` (FK, two-bone IK) in the same folder.

```ts
export const RIG_PLANS = ['biped', 'quadruped', 'flyer', 'serpent', 'turret'] as const;
export type RigPlan = (typeof RIG_PLANS)[number];
/** brief.body → plan: humanoid → biped, large → quadruped (with the `large` proportions), the rest by name. */
export const BODY_PLAN: Record<string, RigPlan>;

/** Bone lengths as fractions of the body height, per plan; `large` and other presets are named sets. */
export interface Proportions { [bone: string]: number }
export const PROPORTIONS: Record<RigPlan | 'large', Proportions>;

export interface BodyRigOptions {
  size: [number, number];
  facing: string;            // s, se, e, ne, n, sw, w, nw (16-way names round to 8)
  ground?: number;           // y of the feet (default round(h × 0.95))
  height?: number;           // body height in px (default from the plan and the frame)
  proportions?: Partial<Proportions>;
}

export interface BodyRig {
  plan: RigPlan;
  /** Rig-space bone lengths in px: the same for every facing, state and frame of one asset. */
  lengths: Record<string, number>;
  /** The facing as the templates use it today: yaw (radians), sin, cos and |sin|. */
  yaw: number; sx: number; front: number; side: number;
  /** A pose for a state at t ∈ [0, 1): the plan's clip for the state (unknown states use idle), plus overrides. */
  pose(state: string, t: number, o?: { angles?: Record<string, number>; ik?: Record<string, { target: P2; bend?: 1 | -1 }> }): Pose;
  /** Standard anchors of a pose in frame pixels: ground, head, hand (biped), tail (quadruped, serpent), muzzle (turret). */
  anchors(pose: Pose): Record<string, P2>;
}

export function bodyRig(plan: RigPlan | 'large', o: BodyRigOptions): BodyRig;
```

Bone names (stable; game code and finishes may refer to them through anchors only):

| Plan | Bones |
|---|---|
| biped | `hip`, `spine`, `neck`, `head`, `armL_up`, `armL_lo`, `armR_up`, `armR_lo`, `legL_up`, `legL_lo`, `legR_up`, `legR_lo` |
| quadruped | `spine`, `neck`, `head`, `tail`, `legFL_up`, `legFL_lo`, `legFR_up`, `legFR_lo`, `legBL_up`, `legBL_lo`, `legBR_up`, `legBR_lo` |
| flyer | `body`, `head`, `wingL`, `wingL_tip`, `wingR`, `wingR_tip`, `tail` |
| serpent | `seg0` … `seg7` (a chain; `seg0` is the head end) |
| turret | `hull`, `turret`, `barrel` |

**Projection.** Bones live in the body's side plane (forward, up) with a lateral offset per limb (left −, right +). A
facing's yaw projects them to the frame the way the current templates do by hand: in profile a stride shows as a
swing, facing the viewer or away it shows as a lift with the limbs side by side, and the 3/4 top-down and iso cameras
add a small vertical shift for depth. The pose's points are in frame pixels, so a template draws primitives along
`pose.along(bone, u, side)` and between `pose.start` and `pose.end`.

**Clips.** Per plan: `idle` (a 1 px breath or hover), `walk` (biped: opposite legs and arms; quadruped: diagonal
pairs; serpent: a travelling wave along the chain; flyer: wing beats; turret: none), `attack` (biped: the right arm
swings; others: a lunge of the head), `hurt` (a recoil), `hover`/`fly` (flyer), as angle tracks over t built with
`track`/`ease`. A template may override any angle.

`ctx.lib.rigs` in `render.ts` `makeLib`: `{ plans: RIG_PLANS, body(plan, o), bodyPlan: BODY_PLAN, proportions: PROPORTIONS }`.
`body(plan, o)` defaults `size` and `facing` from the render context when given `ctx` (`ctx.lib.rigs.body('biped', ctx,
o)` is the call templates use) and reports the rig to the cell (below).

### 6.2 The rig stage check

`makeLib` gets an `onRig` callback like `onScene`; `renderAsset` collects, per cell, the plan and `lengths` of every
body rig the cell built, as `RenderResult.rigs?: Record<string, { plan: string; lengths: Record<string, number> }[]>`
(keyed `state/facing/frame`; mirrored cells take their source's). Stage check `rig-lengths` (stage `rig`): for each rig
index and bone, the largest minus the smallest length over all cells is at most 0.5 px → pass; else fail, naming the
bone, the two lengths and the cells. This catches a template that recomputes its proportions per frame (limbs that
stretch between frames). Assets with no rig: `skip`, and no `rig` key.

### 6.3 Templates

Rewrite the character and creature templates to build their geometry from the rig library: `topdown/` and `iso/` ×
`character`, `character-walk`, `creature-quadruped`, `creature-serpent`, `creature-flyer`, `creature-large` (12 files).
Keep each template's params, anchor names (the face anchors on the drawn eyes, `hand`, `head`, `ground`), facings, its
look in broad strokes and its header comment style; the `layout(ctx)` function stays, built on `ctx.lib.rigs.body`.
`templates.test.ts` must pass unchanged, plus a test per template that `rig-lengths` passes over every state × facing
× frame and that the template's anchors include the placeholder's anchor names. Look at the rendered review sheets of
each template before and after (the PNGs) and keep them recognisably the same creature.

Measure and report the template code tokens before and after (`codeTokens` of each file).

### 6.4 Not in R6b

Rigs for 3D meshes and skinning (R7b); a vehicle template (the `turret` plan is in the library for one; no template
uses it yet); rig retargeting from imported sprites.

## 7. R6c: decals and lit sprites

### 7.1 Decals as a layer type

A decal is a mark placed on a surface and kept as its own layer: damage, dirt, emblems, team colours (plan §8,
stage 4). It is a procedural layer, so it works on every Scene2D asset and its pixels stay on the direction's palette:

```js
ctx.lib.proc(s)
  .add('materialNoise', { part: 'torso', amount: 0.15 })
  .add('decal', { name: 'emblem', part: 'torso', mat: 'accent', shape: { type: 'circle', cx: 16, cy: 18, r: 2.5 } })
  .add('decal', { name: 'mud', part: ['legs', 'torso'], mat: 'dirt', shape: [{ type: 'ellipse', cx: 14, cy: 27, rx: 5, ry: 2 }], opacity: 0.6 })
  .render();
```

Options: `part` (required: the target, as other layers' `part`), `shape` (one primitive spec or a list: `rect`,
`ellipse`, `circle`, `poly`, `path`, in frame pixels), `mat` (a ramp name; default `accent`), `band` (`'keep'`, the
default, takes the band of the pixel under it, so the decal is shaded with the surface; or a fixed ramp index), `opacity`
(0–1, default 1: below 1 the decal covers that share of its pixels in an ordered 4×4 Bayer pattern, so it stays pixel art),
`name` (default `decal`, then `decal2`…).

Implementation:

- `artgen-primitives/src/raster.ts` `Raster`: `decal?: Int16Array` (decal index per pixel, −1 none) and
  `decals: { name: string; ramp: string[]; inside: number; total: number }[]`. `toGrid()` colours a decal pixel with
  the decal's ramp at its band (clamped to the ramp's length). INK pixels (lines) are never covered.
- Rasterising the shape: reuse the primitives' existing fill code for the spec types; add what is missing in
  `artgen-primitives` (no import from `artgen-scene` into primitives).
- `proc.ts` layer `decal`: mask = shape ∩ target part pixels. `total` = shape pixels inside the frame, `inside` =
  those on the target.
- The layers travel with the grid: `Grid.decals?: Record<string, Uint8Array>` (beside `Grid.normal`), set by the proc
  render; `renderAsset` copies them to `Cell.decals` (flipped for mirrored cells, rotated for RotSprite cells in R6d).
  `--stages` dumps a `decal` stage image.
- Stage check `decal-inside` (stage `decal`): per decal and cell, `total = 0` → skip; `inside = 0` → fail ("decal
  emblem landed on nothing in s/0"); `inside / total < 0.5` → flag (the decal is mostly off its part). The `decal` key
  hashes `Cell.decals`.
- Team colours: a decal on `accent` (or any ramp) changes with the brief's `swaps`, as today. Document it.

### 7.2 Lit sprites in Pixi.js

The pack already carries normal-map atlases (`loadPack(…, { normals: true })`), and three.js has `threeLitAdapter`.
Pixi.js gets the same:

- **Lighting model, once, in the runtime core** (`artgen-runtime/src/light.ts`, dependency-free, counts toward the 8 KB
  budget):

  ```ts
  export interface PointLight { x: number; y: number; /** height above the sprite plane, px */ z: number; color: [number, number, number]; intensity: number; radius: number }
  export interface LightRig { ambient: [number, number, number]; lights: PointLight[]; /** 0 = smooth; n = quantise the light to n steps (pixel-art bands) */ bands: number }
  export const MAX_LIGHTS = 8;
  /** Reference shading of one texel (the shader does the same): albedo × (ambient + Σ banded Lambert × falloff). */
  export function shadeTexel(albedo: [number, number, number, number], normal: [number, number, number], px: number, py: number, rig: LightRig): [number, number, number, number];
  export function decodeNormal(r: number, g: number, b: number): [number, number, number];  // atlas RGB → unit vector, y flipped to screen (y down)
  ```

  Falloff: `max(0, 1 − d / radius)²`. Lights and texels are in the parent container's space (the space of
  `sprite.at(x, y)`). The sprite's baked shading stays: lights add on top of the ambient term; `ambient: [1, 1, 1]`
  with no lights draws the sprite unchanged.
- **`pixiLitAdapter(o: { scale?: number; rig: LightRig })`** in `adapters/pixi.ts`: nodes are Pixi v8 `Mesh`es (a quad)
  with a WebGL `Shader` (GLSL, the same maths as `shadeTexel`). The frame, flip, anchor and position go into uniforms or
  the quad, so frame changes do not rebuild geometry. The game mutates `rig` (move a lantern) and the next frame uses it.
  It passes the shared adapter contract with an inspector, as the other adapters do. WebGPU is not supported by this
  adapter: say so in its doc comment and the README.
- **Acceptance**: `scripts/artgen-lit-accept.mjs` (`npm run accept:lit`) bundles a page with esbuild (Pixi + the
  adapter + `testkit`'s synthetic pack with normals), renders it in headless Chromium (WebGL), reads the pixels back and
  compares them with `shadeTexel` (±3/255 per channel on interior pixels) for: no light, one light left, one right,
  banding on and off.
- Optional, only if the swamp example's pack already exports normals: the lantern bearer carries a point light at its
  `hand` anchor in `examples/swamp-topdown`. Otherwise leave the example alone and say so.

## 8. R6d: RotSprite

### 8.1 The algorithm (`artgen-primitives/src/lib/rotsprite.ts`)

```ts
/** Scale2x (EPX): each pixel becomes 2×2 using exact colour equality of its 4-neighbours (alpha included). */
export function scale2x(g: Grid): Grid;
/**
 * RotSprite: upscale 8× with Scale2x three times, then for every output pixel sample the 8× image at the point its
 * centre maps to under the inverse rotation about `pivot` (nearest). Multiples of 90° are exact grid rotations.
 * The output keeps the input size unless `size` is given. Output colours are always a subset of the input's.
 */
export function rotsprite(g: Grid, deg: number, o?: { pivot?: [number, number]; size?: [number, number] }): Grid;
/** The same mapping for a normal map: nearest sample, the normal's xy turned by the angle. */
export function rotateNormals(n: Grid /* or the normal map type Grid.normal uses */, deg: number, o?: { pivot?: [number, number] }): typeof n;
```

Angles are degrees, clockwise on screen (y down), matching the templates' `YAW` tables. The pivot defaults to the frame
centre `[(w − 1) / 2, (h − 1) / 2]`.

### 8.2 Rotated assets

- Brief fields: `rotate?: 'rotsprite'` and `rotateFrom?: string` (the facing the module draws; default `e`). For
  top-down sprites that turn by rotating (vehicles, ships, turrets, projectiles, thrown weapons).
- `renderAsset`: when `brief.rotate === 'rotsprite'`, render only the `rotateFrom` facing (every state and frame), then
  make every other facing by `rotsprite(grid, Δ)` where Δ is the facing's screen angle minus `rotateFrom`'s (the
  runtime's angles: e = 0°, s = 90°). Mirroring is off. Anchors rotate about the pivot (rounded); normal maps through
  `rotateNormals`; decal masks by the same mapping. The cell records `rotated: { from: string; deg: number }`.
- `ctx.lib.rotsprite(g, deg, o)` for authors (a held weapon at an angle).
- Stage checks (stage `rotation`, rotated assets only): `rotation-clip` (opaque pixels lost to the frame edge > 2 % of
  the source's: fail — make the frame larger), `rotation-area` (a facing's opaque count more than 10 % from the
  source's: flag), `rotation-pieces` (a facing has more 8-connected opaque pieces than the source: flag — a thin part
  broke apart).
- Brief validation: `rotate` needs `directions` > 1; `brief add --rotate rotsprite [--rotate-from e]`.

### 8.3 `artgen rotate`

`artgen rotate <image> --deg <n> [--steps k] [--pivot x,y] [--out file]` (operation `rotate`, module `core`, both
bundles, effect `write`): one rotation, or with `--steps k` a strip of k rotations evenly over 360°. Not an MCP tool
(it reads a picture by path outside the `art/` sandbox, like `trace`). Python: generated. `/artgen-image` mentions it.

### 8.4 Tests

`scale2x` against the published EPX rules on small cases; `rotsprite` at 0/90/180/270 equals the exact rotation; colour
subset; a 1 px diagonal line rotated 45° stays one piece; pivot; rotated-asset rendering (facings, anchors, normals,
decals), the three checks; the CLI op.

## 9. Operations added or changed

| Operation | Module | Effect | MCP | Sub-phase |
|---|---|---|---|---|
| `placeholder` | art | write | `placeholder` | R6a |
| `stages` | art | read | `stages` | R6a |
| `stage.approve`, `stage.reject` | art | write | `stage_approve`, `stage_reject` (`user_approved`) | R6a |
| `export` `--placeholders` | art | write | param `placeholders` | R6a |
| `review` `--stage shape` | art | render | param `stage` | R6a |
| `brief.add` `--gates`, `--rotate`, `--rotate-from` | art | write | params | R6a, R6d |
| `rotate` | core | write | excluded (path outside `art/`) | R6d |

Regenerate `OPERATIONS.md` and the Python methods (`npm run gen:ops`). The parity test must pass.

## 10. Guards

- **Byte-identical where nothing was meant to change**: the bench golden hashes, the consumer fixtures
  (`node packages/artgen-dist/build.mjs --no-ui && node scripts/artgen-consumer-ci.mjs`), every asset render that does
  not use a new feature.
- **Recorded expectations that may change, and only these**: the CLI and MCP transcripts where they list commands
  (new commands and flags in help text and tool lists); the `init` config (`INIT_CONFIG.review.gates`); score and
  approve ledger entries gaining `stages`/`stageChecks`; template renders (R6b); the runtime version (1.3.0). Each
  changed expectation is named in §13.
- `lint:boundaries -- --strict`: 0 violations. Bundle sizes: report before and after for `artgen.js`,
  `artgen-mcp.js`, `artgen-maps.js` and the runtime core (`size.test.ts` budget 8 KB).
- `npm run check`, `npm test`, `npm run check:packages`, `npm run test:packages`, the Python tests, `npm run
  accept:ui` stay green.

## 11. Behaviour that changes on purpose

- New projects (`artgen init`) gate the shape of characters and creatures.
- Placeholder exports exist when asked for.
- The character and creature templates are rebuilt on the rig library (new assets only; existing assets are copies and
  do not change).
- Score and approve entries carry stage keys.

## 12. Measuring the accept

The accept's production numbers (tokens and passes per approved asset on the bench, blind scores) need model runs
with a person answering the gates; R6 builds the mechanism and measures what a build session can:

1. **Shape sheet cost**: image tokens of the shape sheet against the full review sheet, for every bench asset.
2. **Template code**: code tokens of the 12 rewritten templates before and after.
3. **Restyle**: on the example games, restyle to a palette-only change of the direction and count, per asset, the
   stages whose key changed (expected: `decorate` and nothing before it).
4. **Shape gate replay**: for the 8 base-route feedback notes in the example ledgers, the passes that came before the
   note (what a shape gate after v1 would have saved, as an upper bound).

Write the numbers in §13 and in the plan's R6 "Built" section. Production runs with gates on stay a "not done" item.

## 13. Built

(Filled in by each sub-phase: what was built, where it differs from this design, the numbers from §12, changed
expectations, and what is not done.)

### R6a — placeholder, shape gate, stage keys (built 2026-10-30)

- **Built.**
  - **`artgen-workflow/src/stages.ts`** (§4.1, exported from the index; `'stage'` joins `LedgerType`): `STAGES`, `GATEABLE`, `StageKeys`, `gatesFor`, `stageVerdicts`, `stageState`, `diffStageKeys`.
  - **`artgen-core/src/qa/stages.ts`** (§4.2): `shapeMask` (opaque pixels minus the direction's outer line: `dark` removes outline-coloured edge pixels, `selout` also the darkest step of any ramp,
    `none` nothing), `stageKeys` (8-digit cyrb53 digests of canonical byte strings: placeholder, shape, decorate, lighting, animation; rig, decal and rotation are absent or optional as §4.2 says),
    `stageReport` (keys + the placeholder checks when a `placeholder.json` exists + the five shape checks), `shapeChecks`, `compactness`, `placeholderKey`, `stageCheckLabels`, and `shapeSheet` (§5.3).
    `renderVersion` returns `stages: StageReport` beside `report`; it never changes `conformance.pass`, the printed check list of `render`, or the bench hashes.
  - **`artgen-core/src/w2/placeholder.ts`** (§5.1): `defaultPlaceholder`, `parsePlaceholder`, `placeholderChecks` (`ph-size`, `ph-pivot`, `ph-box`, `ph-ramp`), `placeholderModule` (footprint in the shadow colour,
    rounded body with the direction's outer line, facing tick, state shade, frame bob, `meta.mirror: false`); `defaultAnchor` was already exported from `w2/pack.ts`.
  - **Pass machine** (`pipeline.ts`, §5.4): `PlanInput.gates/stageKeys/placeholderKey`, `NextStep` variant `stage-gate`, the placeholder gate (before the first base), the shape gate before base v2.. and before the finish and
    `ready` steps, a reject that opens the next base from the rejected one. With no gates `planPasses` is unchanged (a test compares `gates: []` with none on five states).
    `passState` fills the keys from the score entries and renders a scored base only when its entry has none (older ledgers) and the shape gate is on.
  - **Config and briefs** (§5.4): `review.gates` (`DEFAULT_CONFIG` `{}`; `INIT_CONFIG` `{ character: ['shape'], creature: ['shape'] }`), brief `gates` validated to `placeholder | shape`, `brief add --gates`.
  - **Operations** (`ops/art-stages.ts`, 157 now, 4 more; `OPERATIONS.md` and the Python client regenerated, parity test green): `placeholder`, `stages`, `stage.approve`, `stage.reject` (MCP `placeholder`, `stages`,
    `stage_approve`, `stage_reject`; the last two need `user_approved: true`), plus the flags `export --placeholders`, `review --stage shape`, `brief add --gates`. Disk side in `artgen-cli/src/stages.ts`.
  - **Make, status, export** (§5.2, §5.4): a placeholder gate stops `make` scaffolding `base.v1.js` (the asset shows `in-pipeline`, next `stage-gate placeholder`, why "waiting for the user: …"); `make` names a gate only when nothing else
    can move, and its work packets treat a gate as the main agent's step. `export --placeholders` exports every asset that would not be exported and never had real art exported, from its placeholder (`placeholder: true`,
    `version: "placeholder"`, `sourceHash` = the key, `manifest.placeholders` sorted, contract written and checked, `export` ledger entry marked); the plain export is unchanged. Runtime **1.3.0**: `PackAsset.placeholder`,
    `PackManifest.placeholders` (core and runtime types), `Pack.placeholders`, `pack.isPlaceholder(id)`; no console message.
  - **Ledger, restyle, PR, metrics** (§5.5–§5.7): score entries record `stages` and `stageChecks`, approve copies `stages` from the final's score entry, `type: 'stage'` entries (`event: 'written'` for a placeholder file, `verdict`
    for the user's answer), restyle records `stages: { same, changed }` and labels gated assets `shape kept` / `SHAPE CHANGED`, `parseReviewComment` reads `approve goblin shape` and `goblin: shape: …`, `pr prepare` copies pending shape
    sheets (and placeholder pictures) to `art/review/` with the answer each waits for, metrics gain `gates` and `firstInGameMinutes` (and a user stage reject counts as feedback).
  - **Skills and docs** (§5.8): a "Stages and gates" section in `asset-production`, `art-maker` (v1 is silhouette only under a shape gate), `art-reviewer` (a shape sheet is scored on silhouette only), `/artgen-review --pr`, one line in
    `art/claude-md.md`, `docs/metrics/README.md`, the runtime README.
  - **Tests** (§5.9): workflow 4 (`stages.test.ts`) + 4 (metrics); core 25 (`qa/stages.test.ts`: masks, keys, restyle property, shape checks, 216 placeholder variants: kind × view × body × height, module contract) + 6 (`pipeline.test.ts` gates);
    CLI 11 (`stages.test.ts`: placeholder, `export --placeholders`, the gate flow brief → placeholder gate → v1 → shape gate → reject → v2 → approve → v3 → finish → final → approve, `stages`, shape sheet cost, `pr prepare`, restyle,
    every template's anchors cover the placeholder's, PR lines); MCP 1 (`user_approved`); runtime 1 (placeholders on a loaded pack).
  - **`scripts/artgen-stage-measure.ts`** measures §12 items 1, 3 and 4 (and calibrates `shape-read`); nothing under `examples/` is written by it.

- **Where the build differs from the design.**
  1. **Top-down ground line.** The design puts the body's bottom and the footprint on the pivot, but the export anchor in top-down is the frame centre, which would give a body at most half the frame. In views whose
     pivot is in the upper part of the frame (pivot row < 60 % of the height) the body stands on the template ground line (`round(0.95 h)`) and the pivot stays the export anchor. For the same reason `shape-pivot` and
     `shape-box` are skipped (status `skip`, "the pivot is the frame centre") there. They run in iso, oblique, side and first-person views.
  2. **Standing kinds** are exactly `character`, `creature`, `prop`, `vehicle`; "any kind whose default anchor is the bottom centre" would have made `viewmodel` and `layer` standing.
  3. **Footprint** is one pixel wider than the body each side (`rx = round(w/2) + 1`), clamped into the frame; with `rx = w/2` it hid completely behind the body. The collision box is its bounding box.
  4. **Creature anchors.** Creatures with a non-humanoid `body` get `ground`, `head`; humanoid creatures (which start from the character templates, with no `ground` anchor) get `head`, `hand`. The test renders every
     template and checks the placeholder's anchor names are among its anchors.
  5. **`shape-box` fails only against something firm**: the brief's `height` or a `placeholder.json`; against the default guess (0.88 of the frame) it flags at most. Against the 25 non-tile approved example finals the default guess
     failed props and low creatures that are correctly short. Low bodies (`quadruped`, `serpent`, `flyer`) skip the `ph-box` height flag, as conformance does for `height`.
  6. **`shape-read`** uses the design's compactness; pixel perimeter makes a disc 0.62 and a square 0.79, so the threshold is **0.70**, calibrated as asked (stand frames of the example finals and bench assets that are not tiles:
     0.05–0.66, median 0.37, none flags). It flags solid squares and fat boxes, not round blobs. Tiles, tilesets, textures and layers skip it (they fill their frame on purpose).
  7. **`shape-pivot` against the approved examples**: of the 25 non-tile approved example finals and 6 bench assets, 5 would fail (`shape-pivot` fails beyond 2 px: sprites drawn 3+ px above the anchor row in iso / first-person views:
     brazier, rat, iron bed, wheelchair, isohero) and 5 flag. The rule is the design's; the shape gate applies to new characters and creatures, whose templates stand on row 0.95 h, and `--force` is recorded as `forced`.
  8. **Placeholder picture.** `out/placeholder.png` is the strip at the review scale (default 4x), not 1x, since the user is meant to look at it.
  9. **The shape review** is logged as a `review` entry with `stage: 'shape'`; everything that looks up "the review sheet of a version" (approve, `make`'s resume check, `score`'s image tokens, `pr prepare`, the feedback bundle)
     skips entries with a `stage`, so a shape sheet never stands in for the full sheet. Its tokens still count in the review totals.
  10. **Restyle** records `stages` on every restyle entry and result; only the sheet label is limited to assets with a shape gate, so ungated restyle sheets are byte-identical.
  11. **`stages` states** gain `rejected` (a gated stage whose latest verdict on this key is a reject). `stage approve|reject` take the asset as `asset` (a brief id or directory) like the other asset operations.
  12. **Shape reject** opens the next base as an extra autonomous revision (pass `x`), not a user iteration; it counts against `extraAutonomousRevisions` only where that budget is read (a failing gate or a blind miss).
  13. **`firstInGameMinutes`** takes the upper middle value for an even count. `ReviewItem` / `pr prepare` return a `gates` list; the `pr.parse` MCP description names the stage lines.

- **§12 numbers.**
  1. **Shape sheet against the full review sheet** (image tokens). On the 25 non-tile finals of the three example games, built in a scratch copy with `review` and `review --stage shape` (the full sheet has the earlier versions and
     the anchors): **36,342 against 4,110, 11 %**; per asset 5–36 % (the 8-facing figures and animated assets 5–10 %, a plain prop 26–36 %). On the six bench assets, whose full sheet is a single row of one facing with no
     earlier version or anchors: 1,997 against 1,159, 58 % (45–86 %). A shape sheet is a fixed ~140–270 tokens, whatever the review sheet carries.
  2. **Template code** is R6b.
  3. **Restyle** to a palette-only change (every ramp colour turned 40° in hue, outline and line kept), temp copies of the three examples: 30 finals, **`decorate` changed in 30 of 30 and nothing else did**
     (`placeholder`, `shape`, `animation` same; `rig`, `decal`, `lighting`, `rotation` not applicable). The same property is a test (`stageKeys` on two directions; a CLI restyle of a gated asset).
  4. **Shape gate replay.** The example ledgers hold 8 base-route user notes with **34** scored passes before them (mean 4.3). Four are tile notes (tiling, grout, too uniform), which no shape gate sees. The other four are on shaped
     kinds: reeds, rubble and the iron bed (props) and the ghoul (a creature), 16 passes, so a gate after v1 saves at most **12** of them. Only the ghoul is on a kind `init` gates by default (4 passes, at most **3** saved);
     the props need `gates: [shape]` on the brief or in `review.gates`. This is an upper bound: a rejected v1 still costs its pass, and the user may reject again.
  5. **Time to the first placeholder in the game** is a command (`placeholder`, `export --placeholders`) and a metric; a production run is needed to put a number on it.

- **Recorded expectations that changed.** (§10 allows these only.)
  - **MCP tool list** (`server.test.ts`) and **MCP transcript** (`__golden__/mcp-transcript.txt`, regenerated with `UPDATE_GOLDEN=1`): the four new tools; score entries gain `stages` and `stageChecks`; the restyle results gain `stages`
    (and the restyle ledger entries). The diff was read line by line: nothing else moved.
  - **`init` config**: `review.gates = { character: ['shape'], creature: ['shape'] }`. Three scripted CLI tests (`w2.test.ts`, `p7.test.ts`, `review.test.ts`) that drive the ungated pipeline now set `review.gates = {}` after `init`
    (as they already dropped the per-kind budgets); the gated pipeline is `stages.test.ts`.
  - **Runtime 1.3.0**: `RUNTIME_VERSION`, the package versions, `package-lock.json`, and the three example games (`npm run fixtures:install`, then `export --runtime` in each, as for 1.2.1): the installed skills, agents, command and
    `CLAUDE.md`, the vendored runtime, `pack.json` (`runtime`, `generator`) and `*.aseprite.json` (`version`). The atlases are byte-identical. Each example ledger gains 10 appended `export` lines; no existing line changed.
  - Bench golden hashes, the CLI transcript, the consumer fixtures, the conformance output and every render that uses no new feature: unchanged.

- **Test counts, before → after.** artgen-cli 311 → 322, artgen-core 158 → 189, artgen-workflow 38 → 46, artgen-mcp 30 → 31, artgen-runtime 89 → 90, artgen-dist 73, imagekit 320, mapgen 133, primitives 41, scene 21 (unchanged); root `npm test`
  96 (unchanged); Python 16 (unchanged). The operations: 153 → 157.
- **Bundles, before → after** (`node packages/artgen-dist/build.mjs`): `artgen.js` 1,659,460 → 1,707,688 bytes (+48 KB), `artgen-mcp.js` 1,657,677 → 1,705,909 (+48 KB), `artgen-maps.js` 769,270 → 770,238 (+1 KB: the workflow stage module).
  The runtime core is 4,826 → 4,858 bytes min+gz (budget 8 KB).
- **Not done.** Production runs with gates on (tokens and passes per approved asset on the bench, blind scores, time to the first placeholder) need a model and a person answering the gates. No gate for rig, decal, lighting or rotation
  (R6b–R6d). `shape-pivot` for top-down views (see 1). A shape sheet in the image tools' web UI (Asset Review shows the full sheet; the gate is answered by CLI, MCP or the pull request). Nothing is cached: keys save review and passes, not CPU (§3.1).
