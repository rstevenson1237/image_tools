# Rigged and animated 3D (R7b)

Status: built, 2026-11-01 (§12 has what was built, where it differs from this design, and what is not done). This is phase
R7b of [`TOOLING-PLAN.md`](TOOLING-PLAN.md) (§8, §10). It joins two earlier pieces: the shared body rigs of R6b
([`STAGES.md`](STAGES.md) §6) and the true 3D meshes of R7a ([`MESHES.md`](MESHES.md)).

## 1. Goal

After R7a a 3D-mode asset becomes a static mesh: one pose, no skeleton. After R6b the 2D characters and creatures share
one skeleton per body plan, with clips, foot IK and facings. R7b puts them together:

- the **body rigs in 3D**, in a 3D-mode model's own units and frame, so a 3D template builds its parts along the bones of a
  pose and its sprites animate from the rig, as the 2D templates do;
- the **mesh skinned** to those bones: a vertex follows the bone of the part it lies on, blended across each joint;
- **animation clips**: each state of the brief sampled from the rig as joint rotations and translations, as long as the
  sprite's state;
- **levels of detail**: the same model meshed again under smaller budgets, skinned to the same skeleton;
- one **`.glb`** with all of it, and a **runtime helper** (`riggedModel`, three.js) that plays the clips and picks the level
  of detail.

**Accept (plan §10).** The R7 accept is "every cell in §8's matrix has a template and one bench asset at or above the
approval bar; a rigged `.glb` character walks in the three.js example game". R7b owns the second half. The first half
needs R7c and scored bench runs. Also, as for every phase: `npm run check`, `npm test`, `check:packages`,
`test:packages`, the strict boundary lint, the bench and the consumer fixtures stay green, and no existing output changes.

## 2. Decisions

1. **One skeleton, two renderers.** The 3D rig is the R6b rig, not a second one: `bodyRig` gains `skeleton(state, t)`, the
   pose in the body's own frame before the facing projects it. The sprites and the `.glb` therefore move alike, and the
   `rig-lengths` stage check covers the 3D rigs too.
2. **The model is built along the pose.** A rigged template builds its scene from `rig.pose(ctx.state, ctx.t)` in every
   cell, as the 2D templates do. Each part names its `bone`. The scene keeps the pose it was built along
   (`scene3d({ k, pose })`), so the exporter knows the skeleton without reading the template.
3. **Bind pose = idle at t = 0.** `artgen rig` draws only that cell and meshes it with R7a's mesher. No T-pose is needed:
   every part sits on its bone in every pose, so the bind pose only has to keep parts on different bones apart.
4. **Rigid parts, blended joints.** A vertex belongs to the bone of the solid it lies on (the geometry solid with the least
   distance there). Near a joint it shares its weight with the bone across it, so elbows and hips bend instead of
   tearing. No heat diffusion or geodesic weights: the parts are already the segmentation.
5. **Least rotations.** A pose moves each bone rigidly: its bind start goes to its posed start, and the least rotation turns
   the bind direction onto the posed one. The R6b bones bend in planes, so this is the plane's rotation; bones keep their
   lengths, so nothing stretches along a bone.
6. **Clips are sampled, not authored.** The rig's clips are functions of t (tracks, IK, waves). The exporter samples them
   at `keys` points (default 16) with linear interpolation, which any glTF player reads. A clip lasts as long as the
   sprite's state (frames × fps, or its `durations`). A one-frame state has no length of its own, so its clip lasts 2 s.
7. **Continuous rigs.** The 2D clips step the body by whole pixels (`Math.round` on root moves). A 3D rig takes
   `continuous: true`, which skips that rounding; the sprite rigs are unchanged byte for byte.
8. **Levels of detail in one file.** Each level is a skinned mesh node (`<id>_LOD0`, `_LOD1`, …) over the same skin, a
   quarter of the previous budget at half the texel density. The switch distances (the model's height × 0, 4, 12, 30, in
   metres) are in `extras.artgen.lods`. `MSFT_lod` is not used: three.js does not read it.
9. **glTF's frame, the rig's origin.** As in R7a (metres, y up, the model facing +z), but centred on the rig's origin
   (between the feet), not on the mesh's box, so the root moves in the clips are true to the ground.
10. **The runtime stays engine-only.** `riggedModel` takes the `GLTFLoader` as an argument (it lives in `three/examples`),
    as `voxelModel` does, so the adapter still imports nothing but `three`.
11. **Layers.** The 3D rig goes in `artgen-scene/src/anim/rig3d.ts`. Skinning, the rigged builder, its checks, the writer
    and the clip strip go in `artgen-scene/src/mesh/` (primitives only). The operation and file I/O go in the CLI, the
    player in the runtime's three adapter. The strict boundary lint stays at 0.

## 3. Body rigs in 3D (`anim/rig3d.ts`)

```ts
export function bodyRig3d(plan: RigPlan | 'large', o: { height: number; proportions?: Partial<Proportions> }): BodyRig3D;

interface BodyRig3D { plan; set; height; lengths; bones /* parents first */; parents; options; pose(state, t, o?): Pose3D; bind(): Pose3D }
interface Pose3D {
  rig: BodyRig3D; state: string; t: number; bind: boolean;            // bind: idle (or stand, hover) at t = 0, no overrides
  bones: Record<string, { a: V3; b: V3 }>;                            // model units
  start(bone): V3; end(bone): V3; along(bone, u): V3;
  at(bone, u, fwd, side, up): V3;                                     // moved along the body's own axes
}
```

- **Frame.** Artgen's model frame: x to the viewer's right, y toward the viewer (the body's forward, as facing `s`), z up.
  The body's right is −x, because it faces the viewer. The feet (or a flyer's shadow) are at z = 0, and the body is
  centred on x = y = 0.
- **Lengths.** `height` model units tall. The bones are the plan's proportions of it, as in R6b, and keep their lengths
  through every clip.
- **From the 2D rig.** `bodyRig(plan, { …, continuous: true })` gives `skeleton(state, t)`: each bone's ends as
  [forward, up, right] in rig units, forward-centred. `bodyToModel` maps them to (−right, forward, up).
- `ctx.lib.rigs.body3d(plan, { height, proportions })` makes one and reports its lengths to the render, as `body()` does.
  The `rig` stage key and the `rig-lengths` check therefore cover 3D rigs as well.
- `Spec3.bone` (inherited by groups) names a part's bone. `Scene3DOptions.pose` keeps the pose, as `scene.pose`.
- `ctx.lib.pxPerMetre` (new) lets a template draw to the brief's real height.

## 4. Skinning (`mesh/skin.ts`)

- **Skeleton** (`skeletonOf(pose)`): the rig's bones (parents first), each bone's parent index, and the bind pose's bone
  ends.
- **Owner.** For each vertex, the geometry solid with the least distance there. Its `bone` is the vertex's own bone. A
  solid without a bone follows the nearest bone segment, and the result says which parts did (`unbound`). A bone the rig
  does not have is reported too (`unknown`).
- **Blends.** Each bone's neighbours are its parent (the joint at its own start) and its children (the joint at each
  child's start). Through a **short parent**, its siblings count as neighbours too: the hip (0.02 of the height) sits
  between the spine and both legs. A neighbour's weight is `1 − smoothstep(|v − joint| / r)` against the own bone's 1,
  so the two are equal at the joint and the neighbour's weight is 0 a radius away. The radius is `blend` (default 0.5) of
  the shorter bone; a short bone counts as long as the bones it joins. At most four bones a vertex, normalised.
- **Joint poses** (`jointPoses(sk, pose, map?)`): per bone `p ↦ t + R (p − origin)`. `map` first puts the points in
  another frame (glTF's), so the rotations come out proper there too.
- **Posing** (`skinPose`): linear blend skinning of positions, normals and tangents.

## 5. The rigged model (`mesh/rigged.ts`)

```ts
buildRigged(scene: Scene3D, o: MeshOptions & SkinOptions & { lods?: number; keys?: number; clips: { state; duration; loop }[] }): RiggedModel
```

1. The scene must carry a pose, and that pose must be the bind pose. Otherwise it throws with what to do.
2. Levels: budget, budget / 4, budget / 16, … (at least 60 triangles, up to 4 levels, stopping when a level would not be
   smaller), each with half the previous texel density. Each level is meshed with `buildMesh` and skinned with
   `skinWeights`.
3. Clips: `keys` samples over [0, duration]. A looping clip's last key is the pose at t = 0.

## 6. glTF (`riggedGlb`)

- Nodes: a root named after the asset; under it, a node per bone (rest translation relative to its parent, no rotation)
  and a node per level (`mesh`, `skin: 0`).
- One skin: the joints in bone order, `skeleton` = the root, and inverse bind matrices that translate by −(bind start).
- Each level's primitive: `POSITION`, `NORMAL`, `TANGENT`, `TEXCOORD_0`, `JOINTS_0` (unsigned byte), `WEIGHTS_0` (float),
  `indices`, and its own material and three textures (R7a's nearest sampler).
- An animation per clip, named by the state: a shared time accessor, and per bone a rotation (quaternion, kept on the
  same hemisphere key to key) and a translation channel, `LINEAR`. Local transforms are `R_parent⁻¹ R` and
  `R_parent⁻¹ (t − t_parent)`.
- `extras.artgen`: `rig` (plan, set, height, bones), `lods` (node, name, triangles, budget, texel density, distance),
  `clips` (duration, loop, keys), `metresPerUnit`, `look`, `mode`.

## 7. Checks (`riggedChecks`)

R7a's mesh checks on LOD0, then:

| Id | When it is not `pass` |
|---|---|
| `skin-weights` | fail: a vertex's weights do not sum to 1, or name a bone the skeleton has not |
| `skin-bound` | fail: a part names a bone the rig has not; flag: parts with no bone (their vertices follow the nearest bone) |
| `clip-lengths` | flag: a bone is more than 1 % off its bind length in some clip key (the serpent's rearing lifts change lengths in 3D) |
| `skin-stretch` | flag: in some clip key a mesh edge is more than 2.5 times its bind length (edges shorter than half the median are left out). This is the check that catches parts touching in the bind pose that move apart: the mesh bridges them and the bridge tears |
| `lod-budget` | fail: a level over its budget |

## 8. Operation

| Operation | Module | Effect | What it does |
|---|---|---|---|
| `rig <asset>` | art | render | the version's bind cell (idle, one facing, frame 0) → `out/<id>.rigged.glb` and `out/<id>-clips.png` (a row per clip, the poses from one 3/4 camera, framed on the bind pose's box), with the checks; exit 1 on a failing check |

Options: `--version`, the mesh options (`--budget --mode --texels --look`), `--lods`, `--keys`, `--scale`, `--out`. A brief's
`mesh` takes `lods` (1–4) and `keys` (2–120). Not an MCP tool: it writes model files for the game.

## 9. Template and briefs

- `templates/fp/character-rigged/`: a biped built along `body3d('biped', { height: 18, proportions })` with game proportions
  (a head about a sixth of the height). It has capsule limbs, hips, torso, neck and head, boots and hands, a belt slab and a
  hair slab. It draws in the brief's own view, at the brief's `height` (else 85 % of the frame), and its anchors are
  `head`, `hand`, and the eyes on `s`.
- A brief's `rigged: true` (`brief add --rigged`) starts a character or creature from it. Only humanoids for now: other
  bodies are refused with a pointer to `body3d` by hand.

## 10. Runtime (1.5.0)

`riggedModel(loader, url, { state })` in `adapters/three.ts` returns `{ object, clips, mixer, state, done, lods, lod, info,
play(state, { fade, restart }), at, face, update(dtMs, camera?), dispose }`. Clips loop as exported. One-shots clamp and set
`done`. `update` with a camera shows the level for its distance, measured in the model's metres (a model scaled down
switches sooner). The skinned meshes are not frustum-culled on their bind box.

## 11. The example and the accept

`examples/billboard-crawler` gets a night **warden**: briefed `rigged: true`, made v1 → v3 and a finish, and exported with
`artgen rig warden --out public/assets/models`. `src/main.ts` loads it with `GLTFLoader` + `riggedModel`, walks it round a
circle the other way from the ghoul, faces it along its path and stops it to strike when the ghoul comes near.

`npm run accept:rig` (`scripts/artgen-rig-accept.mjs`) builds the game with Vite, serves it and plays it in headless
Chromium (SwiftShader). It checks:

- the clips and the 12-bone skeleton over three skinned levels;
- the game walks the warden round its circle;
- the thigh turns at every quarter of the walk and the foot swings fore and aft of the hip;
- the frame differs where the warden stands;
- attack holds at its end, then the walk resumes;
- LOD0 shows near and LOD2 far;
- the page logs no errors.

## 12. Built (2026-11-01)

- **Engine** (`artgen-scene`):
  - `anim/rigs.ts` gains `skeleton()`, `bones`, `parents` and `continuous`.
  - `anim/rig3d.ts` holds `bodyRig3d` and `bodyToModel`.
  - `Spec3.bone`, `Scene3DOptions.pose` / `scene.pose`; the field's solids carry `bone`.
  - `mesh/skin.ts`, `mesh/rigged.ts` (`buildRigged`, `riggedChecks`, `riggedGlb`, `posedView`, `clipStrip`, `quatOf`).
  - `mesh/gltf.ts` now shares its writer (`glMeshArrays`, `binWriter`, `materialOf`) with `meshGlb`, whose bytes are
    unchanged (hashed before and after).
- **Pipeline** (`artgen-core`): `ctx.lib.rigs.body3d`, `ctx.lib.pxPerMetre`; the brief's `rigged`, `mesh.lods` and
  `mesh.keys` (validated).
- **CLI:**
  - `artgen rig` (163 operations, one more; `OPERATIONS.md` and the Python client regenerated) and `brief add --rigged`.
  - `templateFor` sends `rigged` briefs to `character-rigged`.
  - The template `fp/character-rigged` and the bench asset `bench/r7/rigged-hero` (from the template, on the p6
    direction).
- **Runtime 1.5.0:** `riggedModel`. The three examples are reinstalled and their runtimes re-vendored. Their `pack.json`
  files change only in `runtime`, and their ledgers gain the export lines.
- **Example:** the warden in billboard-crawler (above), the game's `screenshot.png` retaken, `npm run accept:rig`.
- **Skills:**
  - `asset-production`: *Rigged 3D figures* under briefs; `riggedModel` under *Runtime*.
  - `artgen`: `references/breadth.md`, *Rigged and animated meshes*.
  - `templates/README.md` and the runtime README.
- **Measured:**
  - The bench rigged biped: LOD0 3,956 / 4,000, LOD1 988 / 1,000 and LOD2 224 / 250 triangles; 12 bones, 4 clips,
    every check passing.
  - `artgen rig` takes about 2 s on the command line, the bind cell's render included; meshing, skinning and three
    levels take about 0.6 s of that.
  - The `.glb` is 404 KB (the static `mesh` `.glb` of the same model is 198 KB: two more levels, their textures and the
    clips).
  - The warden: 3,968 / 940 / 124 triangles, 463 KB.
  - In the game, attack and walk play, and the level of detail switches at 6.7 m and 20.2 m.
- **Tests** (before → after):

  | Package | Tests |
  |---|---|
  | artgen-scene | 53 → 61 (3D rig frame and lengths, continuous rigs, owners and joint blends, joint poses, levels and checks, bind-pose errors, and the `.glb`: its skin and walk evaluated as a glTF viewer does, against the engine's own posed mesh, to 1e-4 m) |
  | artgen-cli | 348 → 352 (the template over every state × facing × frame; `artgen rig` on the bench; the brief's `lods` and `keys`; the error for an asset without a rig) |
  | artgen-runtime | 115 → 118 (`riggedModel`) |
  | artgen-dist | 73 → 74, plus 2 skipped (the warden's `.glb` and the game loading it; billboard-crawler only) |

  The fixture tests' W2 record and W2 export now cover the 10 sprite briefs: the rigged warden came later and is still in
  the pipeline. Its own test is the one above. The game's art code stays under 20 lines: the warden's path maths is game
  logic, so it moved out of the `art` block.

  `npm run accept:rig` passes.
- **Guards:**
  - The other tests and the bench golden hashes pass.
  - The consumer fixtures (`scripts/artgen-consumer-ci.mjs`), `check`, `check:packages` and the strict boundary lint pass.
  - The 2D rigs' poses are unchanged (`continuous` is off unless asked for); the R6b template renders and the rig keys do
    not move.
  - `RUNTIME_VERSION` is 1.5.0 (`stages.test.ts` reads it).
  - Bundles: `artgen.js` and `artgen-mcp.js` 1.83 → 1.86 MB; `artgen-maps.js` unchanged.

**Where the build differs from the design above:**

- **The blend radius of a short bone.** It was first half the shorter bone at the joint. At the hip (0.36 units) that
  left the thighs rigid against the pelvis: a coat skirt over the hips stretched 7×. Now a short bone counts as long as
  the bones it joins, and the same skirt stretches 2.5× at most.
- **One-frame states last 2 s.** At first such a clip lasted 0.125 s, the length of one sprite frame, and the idle breath
  flickered at 8 Hz.
- **The LOD switch distances follow the model's scale.** At first they were compared with world distance as they were;
  the example draws the warden at 0.8 scale.
- **`ctx.lib.pxPerMetre` is read when asked.** Computed when the library was built, it threw for directions with no
  character scale (27 scene tests in artgen-core caught it).
- **The fixture tests' brief count.** The billboard-crawler tests expected exactly 10 briefs, all exported. They now
  read the sprite briefs, and the warden has its own test (above).
- **A finished one-shot plays again when asked.** `play(state)` keeps a running state, but a one-shot that is `done` starts
  over, so a game can strike twice without `restart`.

**Not done here:**

- **The warden's approval.** The pipeline holds the warden for a blind review by a fresh reviewer, which the authoring
  agent may not give itself (`score --blind` refuses it), and only a final asset can be approved. Its sprites are
  therefore not in the pack. The model does not need approval to export, so the game plays the `.glb` of base.v3.
- **Rigged templates for the other bodies.** Quadruped, flyer, serpent and large work through `body3d` by hand; there is
  no template yet, and `rigged` refuses them.
- **Scored bench runs.** None for the R7 accept's first half, which also needs R7c's cells.
- **In-between frames.** Clips are linear between 16 samples; IK feet can slide a little between keys (more `keys` cut it).
- **Mesh features.** No decimation (R7a's note stands), no twist bones, no blend shapes, no root motion (the walk is in
  place; the game moves the model).
- **Elsewhere.** The web UI's orbit view does not play clips. Firefox is not installed in this sandbox.
