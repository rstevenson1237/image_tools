# Breadth: views, voxels, textures, effects, animation, first-person

Everything here goes through the same pipeline (base v1–v3 → finish → user) and the same gate. Pick the template for
the view and kind (`artgen new <id> --kind … --view …`, or `make` from a brief) and adapt it.

## Views and voxel
- Views: `topdown`, `iso`, `oblique` (top + front face), `stack` (z-slices), `side` (+ parallax `layer` kind), `fp`.
  The review sheet shows each in its context: iso floor, oblique room, side scroll strip, stack turned through 8
  angles, parallax layers scrolled, first-person corridor.
- 3D mode: `ctx.lib.t2.scene3d({ k })` + `box / ellipsoid / capsule / slab / sdf / cells` and booleans, rendered with
  `m.render(w, h, { renderer: 'raster', view: 'iso'|'topdown'|'oblique'|'side'|'billboard', facing: ctx.facing,
  scale, at })`. `shade: 'toon'` for organic parts. Any of 4/8/16 facings from one model (`meta.mirror: false`).
  `m.screen(w, h, opts, [x, y, z])` projects a model point → anchor that follows every facing.
- Normal maps travel with every cell (2D `normal` shading and the voxel normal buffer) and export beside the atlas
  (`pack.json` `normals`); `artgen voxel <asset>` writes `.vox` + greedy-meshed `.glb`.

## Textures and tiles
- `ctx.lib.tex.material(name, { size: ctx.size, scale, seed, ramps, range, params })` — `artgen texture --list`:
  stone cobble wood metal grass dirt sand snow water lava tech carpet brick. Seamless, palette-exact, with a normal map.
- Autotiles (`brief autotile: wang16|blob47`), iso floor / block tiles, WFC, L-systems: see the tileset templates.
- Gate flags for tiles: `seam`, `repetition` (visible grid), border contrast; `review.periodic: true` for designed
  repeats (bricks, panels).

## Effects
- Particles: `ctx.lib.fx.particles(layers, { w, h, t: ctx.t, duration: ctx.duration })`. Presets:
  `ctx.lib.fx.preset('explosion'|'smoke'|'fire'|'sparks'|'magic'|'heal'|'muzzle'|'impact'|'splash'|'dust'|'trail',
  { w, h, duration, origin, angle, scale, colors })`. Quick look: `artgen fx <preset> --size 32 --frames 8`.
- Emitter fields: `count`, `mode: 'burst'|'stream'` (streams loop seamlessly), `origin`, `area`, `path`, `angle`
  (degrees, 0 = down, 180 = up), `spread`, `speed` px/s, `life` ms, `delay`, `drag`, `gravity` (negative = rising),
  `turbulence`, `swirl`, `size [birth, death]`, `shape: disc|pixel|streak|diamond|plus|ring`, `streak` seconds,
  `streakPath` (tail follows the flown path), `head`, `band [from, to]` of the colour run, `curve` (> 1 stays hot
  longer), `blob` (merge the layer into one banded shape: flames, smoke, fireballs), `heat`.
- Flames: `ctx.lib.fx.flame({ w, h, t: ctx.t, base, width, height, cells, lick })` — a noise-licked teardrop that loops
  seamlessly; draw embers on it with `fx.draw(g, fx.simulate(layers, …))`, then `fx.line(g)`.
- Palette cycling: `ctx.lib.fx.cycle(g, ['glow', 'accent'], Math.round(ctx.t * n))`.
- Briefs: `kind: effect`, an `object` (a drawable thing, no colour words), `blend: add` for light (the runtime draws it
  additively). Effects keep inside their frame; the gate's `fill` check flags solid blobs (a disc of the lightest
  colour) — break shapes up, darker body under a small hot core.

## Animation
- Time: `ctx.t` (0–1 over displayed frames), `ctx.ms` / `ctx.duration` (real time, from fps or `durations`),
  `ctx.logical` / `ctx.sub`.
- Tracks: `ctx.lib.anim.track([[0, a], [0.5, b]], t)`, `blend({ 0: poseA, 0.4: poseB }, t)`, `ease`, `pingpong`.
- Pose rig — animate intent, not limbs: `const r = ctx.lib.anim.rig({ root: [x, y], bones: { spine: { len: 9, angle:
  180 }, arm: { parent: 'spine', at: 0.9, len: 5 }, fore: { parent: 'arm', len: 5 }, … } })`, then
  `const p = r.pose({ spine: 6 }, { ik: { fore: { target: handXY, bend: -1 }, shin: { target: footXY, bend: 1 } } })`;
  draw capsules from `p.start(b)` to `p.end(b)`; `p.along(b, u, side)` for attachment points. Angles in degrees,
  0 = down, 180 = up, relative to the parent.
- Spring chains for hair, cloth, tails: `const c = ctx.lib.anim.spring({ n, len, stiffness, damping, gravity, wind,
  seed })`; `c.at(ctx.ms, ms => ({ pos: worldXY(ms), angle }), { warm })` returns points relative to the root. Drive
  the root in world space (a walker's shoulder moves at walking speed) and the chain trails; a `stop` state that
  replays the walk before 0 ms keeps it swinging after the body halts.
- Trails: `ctx.lib.anim.sweep(t => tipAt(t), t, span, n)` → points for a `tube` behind the blade.
- Attacks: ≥ 4 logical frames (anticipation, swing, contact, recovery) and one held contact frame:
  `anims: { attack: { frames: 5, durations: [120, 90, 60, 220, 140] } }`; export `hand` / `tip` anchors.
- Sub-frames: `anims.walk.sub: 2` renders two display frames per logical frame (smoothing). The animation contract
  (R13) counts logical frames; the runtime maps them (`sprite.frame` stays logical).
- Gate flags: `frames` (feet jumping, colour drift, loop seam), `attack`. Review sheets add an onion-skin row; `artgen
  anim <asset>` writes GIF + APNG previews per state.

## First-person
- Kinds in `view: fp`: `texture` with `surface: wall|floor|ceiling` (64 or 128 px, from `fp/texture`), skies as
  `kind: layer` (`ctx.lib.tex.sky({ w, h, ramp, clouds, stars, ridge })`), 8-direction billboards from one voxel model
  (`fp/character`: raster `billboard` camera), `viewmodel` (`fp/viewmodel`: weapon + hand on the bottom edge, `idle` +
  `fire` with a drawn flash and a held kick), effects (`fp/effect`).
- The review sheet (and Asset Review's "in the game") shows each in a raycaster corridor: textures on their surface,
  billboards standing in the corridor, the view-model over the bottom of the screen.
- Lit billboards: export keeps the normal maps; in three.js load with `loadPack(url, threeLitAdapter(), { normals:
  true })` and add lights — the sprite is shaded by them.
