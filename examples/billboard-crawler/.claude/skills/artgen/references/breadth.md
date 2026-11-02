# Breadth: views, voxels, meshes, textures, effects, animation, first-person

Everything here goes through the same pipeline (base v1–v3 → finish → user) and the same gate. Pick the template for
the view and kind (`artgen new <id> --kind … --view …`, or `make` from a brief) and adapt it.

## Views and voxel
- Views: `topdown`, `iso`, `oblique` (top + front face), `stack` (z-slices), `side` (+ parallax `layer` kind), `fp`.
  The review sheet shows each in its context: iso floor, oblique room, side scroll strip, stack turned through 8
  angles, parallax layers scrolled, first-person corridor.
- Each view is a module (`VIEW_MODULES`): projection, anchor and sort, probe templates, review context, its checks, the
  runtime helpers, and how a map is laid out for it (Tiled orthogonal, or isometric for `iso`). `free` (the perspective
  orbit camera) is the module for meshes: no brief names it; any 3D-mode asset reaches it with `artgen mesh` or `rig`.
- 3D mode: `ctx.lib.t2.scene3d({ k })` + `box / ellipsoid / capsule / slab / sdf / cells` and booleans, rendered with
  `m.render(w, h, { renderer: 'raster', view: 'iso'|'topdown'|'oblique'|'side'|'billboard', facing: ctx.facing,
  scale, at })`. `shade: 'toon'` for organic parts. Any of 4/8/16 facings from one model (`meta.mirror: false`).
  `m.screen(w, h, opts, [x, y, z])` projects a model point → anchor that follows every facing.
- Normal maps travel with every cell (2D `normal` shading and the voxel normal buffer) and export beside the atlas
  (`pack.json` `normals`); `artgen voxel <asset>` writes `.vox` + greedy-meshed `.glb`.

## True 3D meshes, the free camera and converters
- `artgen mesh <asset>` turns the same 3D-mode scene into a true 3D mesh: `out/<id>.mesh.glb` (smooth or faceted triangles
  under a budget, UVs, colour / normal / roughness textures baked from the palette, nearest sampling) and
  `out/<id>-turntable.png` (8 views with the perspective camera). It prints the mesh checks (`mesh-closed`, `mesh-budget`,
  `mesh-scale`, `uv-bounds`, `uv-overlap`, `texel-density`) and exits 1 when one fails. Budgets by kind (character 4000,
  prop 1500, tile 500); a brief's `mesh: { budget, mode: auto|smooth|faceted, texels, look: pbr|baked }` sets its own.
- The mesh follows the voxel rules: `toon` parts get smooth normals, `flat` parts facets; slabs colour the mesh as they
  colour the voxels; `grain: 0–1` on a spec moves texels one ramp step (a 3D noise layer); `rough` / `metal` override the
  material's (metal 0.35 / 1, stone 0.9, cloth 0.95, …).
- `artgen turntable <asset> [--source mesh|voxel]` — the model from fixed angles, for review (also an MCP tool). Asset Lab
  shows any 3D-mode version in 3D (voxels or mesh): drag to turn it.
- In the game: three.js `GLTFLoader` loads the `.mesh.glb` as it is (textures already nearest-filtered).
- Converters: `artgen convert <file.glb|file.vox> --asset <id>` voxelises an outside model at the direction's scale (a
  `.glb` at its own size in metres or `--height m`; a `.vox` fitted to the frame), snaps its colours to the kind's ramps
  and writes the asset's next `base.vN.js` (the voxels inline, read by `ctx.lib.t2.vox`); the ledger records the source.
  `artgen extrude <image.png|asset> --depth px --asset <id>` stands a picture up as a slab (signs, weapons, flat props).
  Without `--asset` both write a `.vox` (or `--to mesh` a mesh `.glb`). Shape and decorate the result in the next pass.

## Rigged and animated meshes (`artgen rig`)
- A rigged figure is a 3D-mode model built along the shared body rig in 3D: `const rig = ctx.lib.rigs.body3d('biped', {
  height, proportions }), P = rig.pose(ctx.state, ctx.t)`, then `ctx.lib.t2.scene3d({ k, pose: P })` and parts along the bones,
  each with its `bone`: `{ type: 'capsule', a: P.start('armL_up'), b: P.end('armL_up'), r, mat, bone: 'armL_up' }`;
  `P.at(bone, u, fwd, side, up)` places things in the body's frame (eyes, keys, a held item). Model frame: x right on
  screen, y toward the viewer (the body's forward), z up, the feet on z = 0, the body's right at −x. Start from the
  template `fp/character-rigged` (brief `rigged: true`); it draws in the brief's view at the brief's `height`.
- The sprites are the rig's poses (every state, facing and frame); `artgen rig <id> [--lods n] [--keys n] [--out dir]`
  meshes the bind pose (idle, t = 0) under the budget, skins it to the bones (a vertex follows the bone of the part it lies
  on, blended across each joint), samples each brief state as a clip as long as the sprite's (a one-frame state: 2 s) and
  adds levels of detail (a quarter of the budget each): `out/<id>.rigged.glb` and `out/<id>-clips.png` (a row per clip).
- Its checks: the mesh checks on LOD0, then `skin-weights`, `skin-bound` (fails on a bone the rig hasn't; flags parts
  without one), `clip-lengths`, `skin-stretch` and `lod-budget`. **`skin-stretch` flags parts that touch in the bind pose
  but move apart** (a hand against the hip, a long coat skirt over swinging thighs, a prop at the hip where the hand hangs):
  the mesh bridges them and the bridge tears when they part. Leave a gap of half a unit or more between parts on
  different bones, or end a skirt near the hip joints.
- In the game: the runtime's `riggedModel(new GLTFLoader(), url)` (three adapter) plays the clips by state and picks the
  level of detail by distance; any glTF viewer reads the file (skin, `AnimationClip`s named by state, nearest-sampled textures).

## Textures and tiles
- `ctx.lib.tex.material(name, { size: ctx.size, scale, seed, ramps, range, params })` — `artgen texture --list`:
  stone cobble wood metal grass dirt sand snow water lava tech carpet brick. Seamless, palette-exact, with a normal map.
- Autotiles (`brief autotile: wang16|blob47`), iso floor / block tiles, WFC, L-systems: see the tileset templates.
- Gate flags for tiles: `seam`, `repetition` (visible grid), border contrast; `review.periodic: true` for designed
  repeats (bricks, panels).
- Tilesets for a level editor: once a tile asset is exported in a pack, `artgen tileset <asset> --pack
  public/assets/main/pack.json` writes it for Tiled (`.tsj`, or `--xml` for `.tsx`; an autotile set becomes a wang set,
  so Tiled's terrain brush paints with it) and LDtk (`.ldtk`), on a small sample map. The map commands bind tiles the same
  way (`artgen dungeon export <id> --pack … --tiles floor=<asset>`). The view's `tile-shape` check refuses tiles that do
  not fit its cell: square for top-down, a 2:1 diamond (or taller) for iso.

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
- Body rigs (R6b): `const rig = ctx.lib.rigs.body('biped', ctx, { height }); const p = rig.pose(ctx.state, ctx.t)` gives a skeleton with idle, walk, attack and hurt clips, foot IK and the facing's projection; `rig.anchors(p)` has ground/head/hand/tail/muzzle. Plans: biped, quadruped (`large`), flyer, serpent, turret.
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
