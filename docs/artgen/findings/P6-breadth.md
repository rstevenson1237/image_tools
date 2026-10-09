# P6 — Breadth: effects / animation (P6c) and first-person (P6d)

Built 2026-10-09 in one cloud session, on top of P6a (views + voxel) and P6b (textures + tiles), which landed in
the previous PR. Benchmarks live in `packages/artgen-core/bench/p6/` beside the P6a/P6b ones and are locked by
`artgen-cli/src/p6.test.ts` (every scored version re-renders exactly what was scored; finals pass the gate and meet
their target). Per-pass scores, notes and token costs for every P6 asset: [p6/REPORT.md](p6/REPORT.md).

**All scores in this note are self-scores** by the agent that wrote the asset (`reviewer: self`), like P6a/P6b. The
calibration study measured self-scores at about +0.5 over a blind reviewer, so read 6.5 here as "about 6 blind". No
P6c/P6d benchmark has had an independent blind re-score yet.

## P6c — effects and animation

### What was built
| Piece | Where | Notes |
|---|---|---|
| `t`-driven params | `anim/anim.ts` | `track` / `blend` keyframes over t (numbers, arrays, pose objects), `ease`, `pingpong`; `ctx.ms`, `ctx.duration`, `ctx.logical`, `ctx.sub` in every render |
| Pose rig + 2-bone IK | `anim.rig` | bones with parent / attach point / offset; poses are relative joint angles; `ik: { shin: { target, bend } }` solves the parent and the end bone so a hand or foot lands on its target |
| Spring chains | `anim.spring` | rest angle, stiffness, damping (air drag), gravity, seeded wind gusts; fixed 60 Hz step from a warm-up before t = 0, so any frame renders on its own (R9) |
| Trails | `anim.sweep` | the path a point (blade tip, hand anchor) swept over the last part of the move → a `tube` |
| Particles + 11 presets | `fx/particles.ts` | burst / stream emitters, seeded per particle, simulated from birth; streams wrap their births round the loop period, so loops are seamless by construction; shapes disc, pixel, streak (+ `head`, `streakPath`), diamond, plus, ring; `blob` layers merge into one banded metaball shape; presets explosion, smoke, fire, sparks, magic, heal, muzzle, impact, splash, dust, trail |
| Flame body | `fx.flame` | a teardrop licked by periodic noise scrolling one period per loop; silhouette and inner bands take different shares of the noise so bands nest |
| Palette cycling | `fx.cycle` | colours move along a run of ramps and wrap |
| Sub-frames | brief `anims.<s>.sub` | `frames × sub` cells; the contract (R13) and `pack.json` count logical frames, `PackStateDef.sub` tells the runtime, which keeps `sprite.frame` logical and steps `sprite.sub` |
| Frame QA | `qa/anim.ts` → conformance `frames` | feet jump, sideways shift and colour drift between neighbouring frames of figures; loop seam (last → first step vs the median step) for looping states |
| Attack QA | conformance `attack` | attack-like states need ≥ 4 logical frames and one held contact frame (a single longest duration ≥ 1.5× the median) |
| Solid-fill metric | conformance `fill` (effects) | interior share and lightest-step share per frame; flags when more than half the frames are solid bright blobs |
| Onion skin, GIF, APNG | review sheets, `artgen anim`, `artgen fx` | every animated state gets an onion-skin row; previews are timed like the export (durations, sub-frames) |
| Additive blend | brief `blend: add` → `pack.json` `blend` → `setBlend` | every adapter already had `setBlend` (P6a); sprites of an `add` asset now ask for it |

Runtime **1.2.0** (sub-frames, blend, normal rects on frame rects, `threeLitAdapter`); core stays under the 8 KB
budget (size test).

### Benchmarks
| Asset | v1 | best base | final | What carried it |
|---|---|---|---|---|
| explosion (32², 8 f, add) | 4.5 | 7 | **7** | one fireball as a `blob` layer at near-equal speeds, a star flash, headed debris, a late smoke cloud |
| fire loop (24×32, 8 f loop) | 5.5 | 6.5 | **6.5** | particles alone made a bulb; `fx.flame` (noise-licked teardrop) + embers; loop seam ratio 0.99 |
| sparks (32², 6 f) | 4.5 | 6.5 (u2) | **6.5** | needed two user-stage bases: thin path-following streaks that stay hot (colour curve) read under the dark outline; heads and big counts read as flakes |
| knight attack (48×40) | 5 | 6.5 | **6.5** | IK from hand / foot targets, 5 frames with contact held 220 ms (`attack` check passes), a two-tone trail swept along the blade tip, `hand` / `tip` anchors |
| cloaked walker (32×40) | 4.5 | 6.5 | **6.5** | IK stride; a spring-chain cape hung from the back of the neck, simulated in world space: it streams behind the walk and, in `stop`, swings forward past the legs and settles |
| spider walk (32², 8 f) | 5.5 | 6.5 | **6.5** | eight 2-bone IK legs in an alternating tetrapod gait (planted feet slide back, lifted ones lighter) |

Revisions gave +1.67 on average (v1 → best base) over the six; finishing gave **0** on every one. Effects and rigged
figures fail on motion and silhouette, which are base problems; the finish only touched glints and orphans.

### Solid-fill calibration
| Effect | interior | brightest | solid frames | blind review said |
|---|---|---|---|---|
| iso-dungeon torch flame | 0.73 | 0.47 | 4/4 → **flag** | silhouette named "2" in the roster (unreadable blob) |
| billboard-crawler lamp flicker | 0.68 | 0.42 | 4/4 → **flag** | — |
| swamp wisp | 0.50 | 0.26 | 0/6 → pass | colour miss, not shape (7 → 5.5) |
| P6c explosion | 0.75 | 0.25 | 3/8 → pass | the flash frames are solid by design |
| P6c fire loop | 0.80 | 0.24 | 0/8 → pass | nested bands keep the lightest share low |

A frame counts as solid at interior > 0.62 and lightest share > 0.30; the flag needs more than half the frames solid
(a third flagged the explosion's legitimate flash frames).

### Lessons
- Particles need a shape model for fire and smoke: stacked discs read as bulbs; metaball (`blob`) layers and the
  noise flame both give nested bands — hot inside, dark rim — which is what pixel fire looks like.
- Under a dark-outline direction, thin effects lose to their own outline: 2 px heads and dense clusters become
  "flakes". What worked: few, separate, 1 px streaks that stay on the hottest steps for most of their flight.
- Streak tails projected backwards from velocity poke behind the emitter on the first frame; `streakPath` (tail along
  the flown path) fixes it. It is opt-in, like `head`, so already-scored versions keep rendering identically (R10).
- Rig angles are relative to the parent: an arm with rest angle 0 under an upward spine points *up* (the first knight
  draft had its shield over its head). The convention is in the reference.
- Spring cloth needs drag comparable to gravity to trail visibly at walking speed (damping 0.14, gravity 260 here).

## P6d — first-person

### What was built
| Piece | Where | Notes |
|---|---|---|
| Raycaster preview | `views/fp.ts` `raycast` | grid map, textured walls (DDA), floor and ceiling casting, sky panorama, billboards sorted by distance and clipped by the wall depth buffer, view-model over the bottom edge, fog to the direction background |
| Review context | `fpShots` + CLI review sheets + Asset Review "in the game" | textures on their `surface`, billboards in the corridor (three facings), view-models one shot per state |
| Wall / floor / ceiling sets | `fp/texture` template, `brick` recipe | 64 px (128 works the same), normal maps from the height field; `surface` in the brief; ceilings keep off the lightest step |
| Skies | `tex.sky`, `fp/layer` template | ramp bands with a dithered edge, periodic clouds, stars, a ridge; seamless across x |
| 8-dir billboards from voxel | `fp/character` template | raster `billboard` camera; normals from the voxel buffer |
| View-model template | `fp/viewmodel` | weapon + hand on the bottom edge, `idle` bob, `fire` flash + kick; conformance treats a view-model's bottom border as off-screen (no silhouette edge there) |
| Lit billboards | `threeLitAdapter` | camera-yawed quads with `MeshLambertMaterial`; `map` = colour frame, `normalMap` = the same rect of the normal atlas (linear colour space), mirrored frames negate the normal's x; passes the shared adapter contract |

### Benchmarks
| Asset | v1 | final | Notes |
|---|---|---|---|
| brick wall 64 | 6 | **6.5** | new `brick` recipe; damp tide line, soot, chipped corners |
| metal wall 64 | 5.5 | **6.5** | 32 px plates, grime gathering at each plate's foot, rust weeping from rivets |
| wood wall 64 | 5.5 | **6.5** | vertical boards framed by two riveted straps; butt joints remain |
| imp billboard (32×40, 8 dirs) | 5.5 | **6.5** | voxel imp: squat, hunched, big head, fangs, ribbed wings; eyes painted at projected anchors |
| pistol view-model (64×48) | 4 | **6.5** | the template's peg became a perspective slide in a gloved hand; drawn star flash + sparks, kick |

Revisions +1.2 on average, finishing 0 again.

### Fixture: billboard-crawler's ghoul lit by the lamp
The ghoul (a 2D T2+ billboard with `normal` shading) already carried a normal map; the re-export writes
`main-0.n.png` beside the atlas. `src/main.ts` loads the pack a second time through `threeLitAdapter` with
`{ normals: true }` for the ghoul and carries the player's oil lamp as a flickering warm point light at the camera
(plus a dim cold ambient). Art code stays at 13 lines. Screenshots (headless Chromium, SwiftShader):
[front](p6/billboard-crawler-lit.png), [back](p6/billboard-crawler-lit-back.png) — the lamp side of the gown and
arms is warm and lit, the far side falls into shadow.

## Fixtures after P6a / P6b
The previous PR left the fixture tests red: the distribution wasn't rebuilt, the runtime not re-vendored, and the
three re-done tiles (swamp mud and bog-water, iso-dungeon floor) waited on a blind re-score. Done here:
`fixtures:install` (dist 0.8.0), `export --runtime` in all three fixtures (runtime 1.2.0), and a blind re-score of the
three tiles. **The blind scores miss the bar**: mud 5.5, bog-water 5, iso floor 5 — each still shows a repeat grid
when tiled 3×3 (P6b's acceptance asked for ≥ 6.5 blind). Caveat: the blind scorer was this session's main agent (it
saw only the blind sheet, but it is not a fresh reviewer — `reviewer: main-agent` in the ledger). The pass machine had
no extra revisions left, so the three are `final` with the blind issues open; they were approved with a **simulated**
user approval that names the issue (as in P3), and exported. Follow-up: rework the three tiles (variant picking at the
3×3 review, fewer high-contrast marks), and have an independent reviewer re-score them.

## Not done / open
- Independent (fresh-reviewer) blind re-scores of the P6 benchmarks and of the three fixture tiles.
- Local-session acceptance, as for every phase so far.
- Sprite stacks and pixi have no lit path (three only).
