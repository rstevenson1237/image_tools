# artgen — Decision Brief

Companion to [INTAKE §7](INTAKE.md#7-decisions-needed-from-you). One entry per decision: what it decides, the
recommended default, the friction it causes, and the alternatives. **Resolution** lines record the owner's
answers (2026-10-05); SPEC and PLAN rev 4 are written against them.

## Resolutions

| # | Decision | Resolution |
|---|---|---|
| D1 | How a game repo gets the toolset | **Resolved after evaluation: committed install** (an install script vendors a built distribution into the game repo's `.claude/` + `tools/artgen/`). Plugins don't load in cloud sessions. The plugin stays available for local use. See D1 |
| D2 | Where code lives | Approved: npm workspace in this repo |
| D3 | Runtime targets | **Changed: Pixi.js and three.js first**, through a modular adapter interface so more targets can be added; Canvas2D stays as the reference/preview adapter; Phaser dropped from the first set |
| D4 | Runtime distribution | Approved: vendored on export |
| D5 | UI file access | Approved: File System Access + zip fallback |
| D6 | Direction candidates | Approved: 3 |
| D7 | Python | Approved: thin client |
| D8 | 2.5D | Approved (oblique → stack → side), **built as pluggable view modules** so more targets can be added over time |
| D9 | First-person | Approved: raycaster/billboard assets + voxel export |
| D10 | Approval | **Changed: autonomous iteration by the agent**; the user sees only the finished asset and approves or asks for revisions |
| D11 | artlab | **Changed: keep until fully superseded, then archive** together with these planning docs |
| D12–D17 | Pipeline details, export formats, source format | Approved as recommended |
| D18 | Outside image models | **Changed: design a pathway (extension point) but don't build it now** |
| D19 | Budget | Approved, **plus analytics** to tune budgets and model/effort per stage |

## D1 — How a game repo gets the toolset
**Blocks:** P2 · **Resolution:** committed install via an install script (evaluated below). Submodule rejected;
plugin kept as an optional extra for local use.

### What we checked (Claude Code docs, 2026-10-05)
| Question | Answer | Source |
|---|---|---|
| Does `/plugin` work in Claude Code on the web? | **No.** "Commands that only run in the terminal interface, such as `/plugin` or `/resume`, aren't available" in cloud sessions | code.claude.com/docs/en/claude-code-on-the-web |
| Do plugins the repo turns on load in a cloud session? | **No.** "A cloud session doesn't install the plugins a repository turns on under `enabledPlugins`, including ones from the marketplaces it lists under `extraKnownMarketplaces`" | code.claude.com/docs/en/cloud-environments, *What carries over* |
| What does load in a cloud session? | Everything **committed** to the repo: `CLAUDE.md`, `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/rules/`, hooks and permissions in `.claude/settings.json`, and `.mcp.json` servers (single-repo sessions) | same page |
| Is Node available in cloud sessions? | Yes, Node 20/21/22 (22 on `PATH`) | same page, *Installed tools* |
| Anything else? | Skills enabled on your claude.ai account load in cloud sessions automatically; SessionStart hooks run in cloud and locally | same page |

So the only mechanism that works the same in **local and cloud** sessions is having the files committed in the
game repo. Plugins work locally only; submodules work only if the cloud clone initialises them (not documented)
and still don't put files where Claude Code looks (`.claude/` at the repo root).

### Options compared
| | **Install script → committed files** (chosen) | Git submodule | Plugin marketplace |
|---|---|---|---|
| Works in cloud sessions | **Yes** — all files are in the clone | Unclear: submodule init on clone isn't documented; private submodule needs separate GitHub access; skills must still be copied or symlinked into `.claude/` | **No** |
| Works locally | Yes | Yes | Yes |
| First install | One command, then commit | `git submodule add` + symlinks/copy step + commit | `/plugin marketplace add` + `/plugin install`, per machine |
| Updates | Re-run `artgen update` (diff shown, local edits detected by hash) and commit | `git submodule update --remote` + re-link | Auto-update can be on; per machine |
| Pins a version per game repo | Yes (`tools/artgen/VERSION`) | Yes (commit SHA) | No (per machine) |
| Repo footprint | ~1–2 MB (skills, 2 JS bundles, templates) | Whole image_tools repo, including the web app, unless a slim dist repo is used | None |
| Collaborators | Nothing to do | Must remember `--recurse-submodules` | Each installs it |
| Simplicity of execution | **Highest** | Medium-low | High locally, n/a in cloud |

### How the committed install works
```
# once, from a local shell or inside any Claude Code session with network access:
npx -y github:rstevenson1237/image_tools#artgen-dist init      # or: node path/to/install.mjs init
```
Writes into the game repo (then you commit):
```
.claude/skills/artgen/, art-direction/, asset-production/   # skills (SKILL.md + references + templates)
.claude/agents/art-reviewer.md
.claude/commands/…                                          # thin command wrappers, if useful
.mcp.json                                                   # merged entry: node tools/artgen/artgen-mcp.js
tools/artgen/artgen.js, artgen-mcp.js                       # single-file bundles, no npm install needed
tools/artgen/VERSION, MANIFEST.json                         # version + file hashes (detects local edits)
art/ …                                                      # project scaffold (direction, briefs, ledger)
CLAUDE.md                                                   # appended "art pipeline" section
```
- `artgen-dist` is a branch built by CI from this repo containing only the distribution and `install.mjs`.
- After installation nothing needs network or npm: cloud sessions get everything from the clone.
- `artgen update` compares `MANIFEST.json` hashes, refuses to overwrite locally edited files without `--force`,
  and prints the version change.
- The same build also publishes the plugin layout, so local users can still `/plugin install` if they prefer.

### Remaining friction
- **Repo visibility:** resolved — the repo is public, so `npx github:…` needs no credentials locally or in
  cloud sessions (network access to GitHub permitting).
- Files are copied into each game repo, so updates are a deliberate step per repo (that's also the version pin).
- Command naming may differ between the committed and plugin forms (`/artgen:…` comes from the plugin
  namespace). Skills are the primary interface; command names get settled in P2.
  **Settled in P2:** committed install → `/artgen-init`, `/artgen-direction` (`.claude/commands/artgen-*.md`;
  command files outside a plugin aren't namespaced); plugin layout → `/artgen:init`, `/artgen:direction`. The skills,
  agent and CLI are identical in both, and the skills name the CLI path for their layout.
- Found in P2: `.js` files are CommonJS in a game repo whose `package.json` says `"type": "commonjs"` (or, on older
  Node, has no type). The install ships `tools/artgen/package.json` and `artgen init` writes `art/package.json`, both
  `"type": "module"`, so the bundles and asset sources load as ESM everywhere.

## D2 — Where engine and UI code live
**Blocks:** P0 · **Recommended:** npm workspace in **this repo** (`packages/artgen-core`, `-cli`, `-runtime`,
`-mcp`), web tools in `src/tools/`.

**Resolution:** Approved.

**Why it matters:** the UI (W4) must run the same engine as the CLI. Same repo means one change updates both.

**Friction points**
- Converting the root `package.json` to a workspace touches the app's CI and Pages deploy (P0 isolates this).
- The repo's identity shifts from "browser image tools" to "image tools + art pipeline + plugin marketplace";
  the README and CI grow.
- CI time rises (engine tests, golden images, plugin smoke test). Path filters can keep app-only PRs fast.
- The repo name `image_tools` becomes the marketplace name users type. Renaming later breaks installs.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **Workspace in this repo** (rec.) | One version of the engine for CLI and UI; one PR changes both | Bigger repo, mixed concerns |
| Separate `artgen` repo, UI imports it as an npm dependency | Clean separation; clearer marketplace name | Two repos to release in lockstep; needs npm publishing for the UI to consume |
| Separate repo, UI also moves there | Everything art in one place | Splits the image tools app; loses the shared framework (W4 wants it here) |

---

## D3 — Runtime targets (W3)
**Blocks:** P4 · **Recommended:** engine-agnostic TS runtime core + **Canvas2D** (reference) and **Phaser**
adapters; PixiJS and a Godot importer next.

**Resolution:** **Pixi.js and three.js first**, behind a modular adapter interface; Canvas2D stays as the reference adapter (also used by the UI). Phaser and others become later adapters.

**Why it matters:** this is the only deliverable your game code touches directly. Building for the wrong
engine means W3 doesn't help you at all.

**Friction points**
- **I don't know your engine.** This is the decision most likely to be wrong by default.
- Non-JS engines (Godot, Unity) can't use a TS runtime; they need an **importer** that writes engine resources
  (Godot `SpriteFrames`/`TileSet` `.tres`, Unity sprite metadata) instead, which is a different kind of work.
- Each adapter is ongoing maintenance as engines change versions (Phaser 3 → 4, Godot 4.x).
- Engine features overlap the runtime (Phaser has its own animation system); the adapter must lean on them, not
  duplicate them.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **TS core + Canvas2D + Phaser** (rec.) | Covers plain web and a popular 2D engine; Canvas2D also powers UI previews | No help for Godot/Unity users |
| Name your engine now (Godot / Unity / Pixi / Three / pygame / Love2D…) | Builds exactly what you'll use | Less general |
| Export formats only, no runtime | Least work; Aseprite/TexturePacker JSON is read by most engines | Loses typed asset ids, facing math, autotile resolver — the parts that make it "easy" |

---

## D4 — How the runtime gets into a game repo
**Blocks:** P4 · **Recommended:** **vendored** — `artgen export --runtime` copies `src/art/runtime/` (version
stamped) plus generated `src/art/assets.ts` into the game repo. npm publication later.

**Resolution:** Approved.

**Friction points**
- Vendored code can be edited locally and then overwritten on the next export. The stamp detects local edits and
  refuses to overwrite without `--force`.
- Each game repo carries its own copy; fixes need a re-export per repo.
- Some teams dislike generated code in the source tree (it shows up in diffs and lint).

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **Vendor on export** (rec.) | No registry, no auth, works offline; game repo is self-contained | Copies drift; re-export needed for fixes |
| Publish `@artgen/runtime` to npm | Normal dependency management; semver | Needs an npm account/scope and release discipline from day one |
| GitHub Packages | Private by default | Consumers need an auth token in every game repo and CI |
| Git dependency (`github:…#tag`) | No publishing | Workspace subpackages don't install cleanly from git; slow installs |

---

## D5 — How the UI reaches a game repo's files (W4)
**Blocks:** P5 · **Recommended:** **File System Access API** — the web app opens the game's `art/` folder
directly (handle remembered in IndexedDB); zip import/export fallback; optional `artgen ui` local server later.

**Resolution:** Approved — matches the existing tools.

**Why it matters:** W4 only works if UI edits and Claude Code's edits land in the same files.

**Friction points**
- `showDirectoryPicker` is **Chromium-only** (Chrome, Edge, Arc, Brave). Firefox and Safari users get the zip
  fallback, which is a manual round trip and can overwrite concurrent Claude edits.
- Browsers ask for permission again each session, even with a remembered handle.
- **Concurrent edits:** the UI and Claude Code writing `direction.json` or the ledger at the same time. Needs
  last-modified checks before write and an append-only ledger (already in the spec).
- **Claude Code on the web runs in a cloud container**, not on your machine. The browser can't see that
  container's files at all; the UI then works on your local clone, and changes travel by git push/pull. Smooth
  for local Claude Code, clunky for cloud sessions.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **File System Access + zip fallback** (rec.) | Stays fully client-side (the app's principle); works from GitHub Pages | Chromium-only for the good path; no cloud-session support |
| `artgen ui` local server (serves the app + a small file API on localhost) | Any browser; safe concurrent writes through one process | A server process to run; departs from "static app" |
| UI reads/writes through GitHub (commits via API) | Works with cloud sessions; history for free | Needs GitHub auth in the browser; slow loop; network required |
| Upload/download only | Simplest | Not really shared state; W4's "Claude sees my edits" goal mostly lost |

---

## D6 — Number of art direction candidates (W1)
**Blocks:** P2 · **Recommended:** **3** candidates, each rendered as a style tile (character, prop, tile, effect)
with a short pipeline (1 revision + finish), then mix-and-match.

**Resolution:** Approved.

**Friction points**
- Cost and time: 3 candidates × 4 probe assets × (1 revision + finish) ≈ 24 render/review cycles before you see
  anything. Expect a long first session.
- Placeholder quality: style tiles use the short pipeline, so they look rougher than final assets and may bias
  the choice.
- Mixing ("A's palette, B's outlines") can produce combinations nobody has rendered; it needs another tile
  round.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **3 candidates** (rec.) | Real choice without overload | ~24 cycles up front |
| 2 candidates | Faster, cheaper | Often a false binary |
| 4–6 candidates | Wider exploration | Review sheets get large (vision token cost); decision fatigue |
| 1 proposal + iterate | Fastest to a first look | Anchors on the first idea; less exploration |
| Palette-only candidates first, then line/shading | Cheap first round (swatches, no renders) | Palettes are hard to judge without sprites |

---

## D7 — Python's role
**Blocks:** P7 · **Recommended:** **thin typed client** (`pip install artgen`) that calls the CLI with `--json`
and returns Pillow images + dicts. Optional Blender adapter later.

**Resolution:** Approved.

**Friction points**
- Requires Node on the Python user's machine; the client is a wrapper, not standalone.
- Subprocess per call is slow for bulk generation (hundreds of textures). A persistent `artgen serve --stdio`
  mode fixes this at some complexity.
- Two languages' tests and packaging to maintain.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **Thin client** (rec.) | One engine; little duplication | Node required; process overhead |
| Python-native engine (numpy) | No Node; natural for Python pipelines | Two engines that drift; doubles the work |
| Python only via MCP | Zero extra code | Awkward for scripts and notebooks |
| Drop Python | Less to maintain | Loses Python pipelines and Blender later |

---

## D8 — What "2.5D" means
**Blocks:** P6a · **Recommended:** all three, in this order: (a) **3/4 oblique** top-down (Zelda/Stardew),
(b) **sprite-stacking** from voxel slices, (c) **side-view with parallax** layers.

**Resolution:** Approved, with views built as **pluggable modules** (projection + probe set + context preview + conformance + runtime helper) so more targets can be added over time.

**Friction points**
- Three different projections means three probe sets, review contexts and runtime helpers. Doing all three
  spreads P6a thin.
- Sprite-stacking needs runtime support (drawing slices rotated per frame) that most engines lack, so it puts
  more weight on D3.
- "2.5D" can also mean billboard sprites in a 3D world, overlapping with first-person (D9).

**Alternatives:** pick one as the 2.5D target (oblique is the most common in shipped pixel games); or define 2.5D
as billboards in a 3D scene (shares work with D9); or defer 2.5D entirely until a project needs it.

---

## D9 — First-person target
**Blocks:** P6d · **Recommended:** **retro raycaster/billboard** assets (wall/floor/ceiling textures, 8-direction
billboard sprites, weapon view-models, skies) **plus** `.vox`/glTF export for voxel-world engines.

**Resolution:** Approved.

**Friction points**
- The raycaster preview renderer is only for review. It's a useful context view, but it's code we must write and
  keep up.
- 8-direction billboards come from 3D mode, so FP quality inherits voxel quality (the organic-shape plateau, E4).
- Voxel-world export (glTF greedy mesh) is effectively a second product: a 3D mesh pipeline with its own
  validation.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **Raycaster assets + voxel export** (rec.) | Covers both retro FPS and voxel games | Two different products |
| Raycaster/billboard only | Focused; fits "pixel" best | No help for voxel-world games |
| Voxel-world only (`.vox`/glTF) | Strong voxel story | No pixel FP assets |
| Defer FP | Saves P6d | Leaves a coverage gap you asked for |

---

## D10 — Who approves assets
**Blocks:** P2 · **Recommended:** **you approve**; Claude's 0–10 score and the conformance gate recommend.

**Resolution:** **Autonomous iteration**: the agent runs the whole pipeline (3 revisions + finish) with the reviewer subagent and the gate, and the user sees only the finished asset, then approves or asks for revisions. The style choice in W1 (D6) is still the user's.

**Friction points**
- You become the bottleneck: a 50-asset project is 50+ approval decisions, more with user iterations. Batch
  gallery review and UI approve-buttons (W4) ease it.
- Claude's scores are self-assessed and drift upward over a session; they're useful for ranking passes, less so
  for absolute quality.
- Without approval, nothing exports, so you can't test a game build with draft art unless "export drafts" is
  allowed (proposed: `--include-drafts` with a watermark flag in the manifest).

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **User approves** (rec.) | You stay in control of the look | Throughput bound by your time |
| Auto-approve at score ≥ X and gate pass; you spot-check | Fast bulk production | Self-scoring bias ships weak assets |
| Auto-approve some kinds (textures, effects), manual for characters/props | Effort goes where it matters | Two rules to remember |
| Separate reviewer model/session as second judge | Reduces self-scoring bias | More cost; still not you |

---

## D11 — What happens to artlab
**Blocks:** P0 · **Recommended:** import it as a **frozen reference** (`docs/artgen/artlab/`), port its libraries
as engine internals, and use its six assets and scores as the **parity benchmark**.

**Resolution:** **Keep artlab until completely superseded, then archive it together with these planning docs.** Superseded = P1b parity passed and the benchmark runs from the new engine.

**Friction points**
- Old JS code with `require` and `@napi-rs/canvas` sits next to the new TS engine. It's frozen, but it adds a
  native dependency if it's ever run in CI.
- The scores in the findings were given by Claude in different sessions; re-scoring the ported renders might not
  reproduce 7.5 exactly. Parity is judged by comparing the old PNGs with the new renders side by side, not only
  against the numbers.

**Alternatives:** keep artlab outside the repo and import only the libraries (cleaner, but the benchmark's source
is lost); or start fresh (no benchmark — not recommended, since P1b depends on it).

---

## D12 — What "three pass revision" counts
**Blocks:** P1b · **Recommended:** **three reviewed versions total**: v1 (first build), v2, v3.

**Resolution:** Approved.

**Why it matters:** sets cost per asset and when finishing starts. artlab trajectories gained most between v1 and
v3 (T3 ship 5.5 → 7, T2 chest 4 → 6.5), with v4 rare.

**Friction points**
- A fixed count wastes passes on easy assets (T1 hero was 7 on v1) and may cut hard ones short (T3 chest needed
  v4 to reach 6).
- Every pass is a review image (~40% of cost, E11), so the cadence decides cost per asset.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **v1 + v2 + v3** (rec.) | Matches where artlab's gains were | Hard assets may need more |
| v1 + three revisions (v4) | Literal reading of "three pass revision"; more headroom | ~33% more review cost per asset |
| Up to 3, stop early at target score | Saves cost on easy assets | Score-based stopping relies on self-scores (see D10) |
| Per kind (e.g. 2 for textures, 3 for characters, 4 for hero assets) | Effort where it matters | More configuration |

The value lives in `direction.pipeline.revisionPasses`, so this can change per project later. The question is the
default.

---

## D13 — Where voxels sit
**Blocks:** P1b · **Recommended:** **T2+ 3D mode**: authors write the same primitives in 3D, rendered by the voxel
renderers. Used for iso props, states, rotations, sprite stacks and FP billboards.

**Resolution:** Approved.

**Friction points**
- 3D authoring is harder for Claude than 2D (painter's order, interpenetration, E6); the 3D mode needs its own
  lint and templates.
- Voxels scored 4.5–5 on organic shapes. The `toon` shading and finishing pass are expected to lift that, but
  this hasn't been tested yet.
- Your pipeline description didn't mention voxels, so this is my reading. If you don't need rotations or iso
  states, 3D mode is significant work you could skip.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **T2+ 3D mode** (rec.) | One authoring language; rotations and states for free | Biggest single engine feature |
| Keep voxels as a separate technique (artlab T4) | Already works for boxy props (7/10) | Breaks "one pipeline" |
| No voxel source; `.vox` export only from 2D | Much less work | No auto-rotation; 8 facings drawn by hand; weak FP billboards |
| Drop voxels entirely | Simplest | Loses the "pixel and voxel" goal |

---

## D14 — What happens to the old T1/T3/T4 code
**Blocks:** P1b · **Recommended:** **absorbed**: T1 → finishing `patch`; T3's supersample path → T2+ `ss` mode,
with SVG paths importable (including from the SVG Tracer); T4 → T2+ 3D mode. No separate authoring modes.

**Resolution:** Approved.

**Friction points**
- If T2+ misses parity on some form (most likely organic curves like the spider's legs), there's no fallback
  authoring mode. P1b defines an escalation step for this.
- Small characters lose T1's "first try 7" economy: T2+ v1 → v3 + finish costs more than one T1 pass for a 16 px
  sprite.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **Absorb all** (rec.) | One way to build; library improvements help everything | No escape hatch |
| Keep T3 (SVG base) as a fallback for forms that fail parity | Safety net for curves | Two authoring styles; the router comes back |
| Keep T1 as an authoring mode for ≤16 px sprites | Cheapest path for tiny sprites | Exception to the single pipeline |

---

## D15 — Finishing pass on animations
**Blocks:** P3 · **Recommended:** **global finishing operations on every frame**, plus **patches on key frames that
follow named anchor points** (e.g. `head`, `blade.tip`) through the other frames.

**Resolution:** Approved.

**Why it matters:** an 8-direction, 4-state character with 4–6 frames per state is 128–192 frames. Hand-finishing
each one is not viable.

**Friction points**
- Anchors must be exported by the base code for every frame; authors have to maintain them.
- Patches that follow anchors don't rotate. A face patch drawn for the south-facing view is wrong for the north
  view, so patches need per-facing variants (8 facings → up to 5 patches with mirroring).
- Global fixes (orphan removal, jaggy fixes) can disturb intentional single pixels in some frames (eye glints) —
  needs protected-pixel masks.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **Global ops + anchored key-frame patches** (rec.) | Scales to large sheets | Anchor upkeep; per-facing patch variants |
| Finish key frames only, interpolate the rest | Less authoring | Interpolating pixels is unreliable |
| Hand-finish every frame | Best quality | Cost explodes; breaks on every re-render |
| Finishing for static assets only; animations get global ops only | Simple | Animated characters — the most important assets — lose the pass that adds the most |

---

## D16 — Export formats *(new)*
**Blocks:** P3 · **Recommended:** palette-exact PNG, atlas + `pack.json` (artgen's own manifest), Aseprite-style
JSON, normal-map PNG, and (P6) `.vox` + glTF.

**Resolution:** Approved.

**Friction points**
- `pack.json` is our own format: the runtime reads it, but no engine does without an adapter (D3).
- Aseprite and TexturePacker JSON variants differ slightly (hash vs array); we pick one and document it.
- Engine-specific formats (Godot `.tres`, Unity `.meta`) are deliberately left for later.

**Alternatives:** TexturePacker JSON as the main manifest (read natively by Phaser, Pixi and others; loses facing and
autotile metadata unless extended); or engine-native output only (once D3 is answered).

---

## D17 — Asset source format *(new)*
**Blocks:** P1 · **Recommended:** assets are **code modules** (plain ESM JavaScript): `base.vN.js` and
`finish.vM.js`.

**Resolution:** Approved.

**Why it matters:** the findings came from code authoring; restyling, parameters and seeds rely on assets
being functions.

**Friction points**
- The UI (W4) can't easily *edit* code. It can change `params`, the seed and the direction, but not geometry.
- Running asset code in the browser UI executes whatever is in the game repo. It's your own repo, but it's
  arbitrary JS in the page (run it in the worker to isolate it).
- JS rather than TS for asset files: no type checking for authors, but no build step and fewer tokens.

**Alternatives**
| Option | Pros | Cons |
|---|---|---|
| **JS modules** (rec.) | Full expressiveness; matches the findings | UI can only tweak params |
| Declarative JSON/YAML scenes + small code hooks | UI can edit geometry; safe to load | Less expressive; Claude writes awkward JSON for complex shapes |
| TS modules | Type-checked authoring | Needs a transpile step in CLI and UI |

---

## D18 — Generative image models stay out *(new, confirming a non-goal)*
**Blocks:** P1 · **Recommended:** **out of scope** — everything is procedural code written by Claude.

**Resolution:** **Design a pathway, don't build it now**: SPEC defines an image-source extension point (external image → palette quantize → finishing pass → conformance) with no implementation.

**Friction points**
- Some looks (painterly textures, organic detail) are much easier for diffusion models.
- Excluding them keeps outputs deterministic, palette-exact, restyleable and free of licence questions.

**Alternatives:** allow an optional "reference only" use (generate concept images to *inform* direction, never
shipped); or an import path that converts external images through palette quantize + finishing (then those
assets are no longer restyleable).

---

## D19 — Per-asset effort and budget *(new)*
**Blocks:** P2 · **Recommended:** default cadence as in D12, with a **per-project budget** in
`artgen.config.json` (max passes, max review-sheet size, max user iterations before escalating) and cost reported
per asset from the ledger.

**Resolution:** Approved, **plus analytics**: record model, effort, tokens, time and score per pass so budgets and the model/effort per stage can be tuned from data.

**Friction points**
- The fixed pipeline is ~5 review cycles per asset (3 revisions, finish, user round) vs artlab's ~2–3. artlab's
  ledger shows visible-token cost of a few cents per cycle, but real sessions cost several times that. For a
  50-asset game, cost and session time are real.
- Animated multi-facing assets make review sheets large; sheets are capped at 1568 px on the long side and
  long animations get reviewed as key frames.

**Alternatives:** no budget (simplest, unpredictable cost); hard per-asset caps that stop and ask; or tiers by asset
importance (hero / standard / filler) mapping to different pass counts (combines with D12's per-kind option).
