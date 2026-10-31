# True 3D meshes and the free camera (R7a)

Status: built, 2026-10-31 (§12 has what was built, where it differs from this design, and what is not done). This is phase R7a of
[`TOOLING-PLAN.md`](TOOLING-PLAN.md) (§8, §8b, §10). It builds on the 3D mode (`Scene3D`), the voxel exports, the
operation registry ([`OPERATION-REGISTRY.md`](OPERATION-REGISTRY.md)) and the stage graph ([`STAGES.md`](STAGES.md)).

## 1. Goal

Today a `Scene3D` asset renders as voxels, and from the voxels as every 2D and 2.5D view, a `.vox` and a greedy-meshed
`.glb` (plan §8b). Its only 3D output is blocky: one cube per voxel, flat colours, no UVs, no textures. There is no free
camera: every view is an affine pixel-art projection.

After R7a the same source also becomes a **true 3D mesh**:

- smooth or faceted triangles, under a polygon budget;
- UVs that don't overlap, at a set texel density;
- three baked textures (colour, normal, roughness and metal) from the direction's palette, the same slabs the voxels
  show, and a 3D grain layer;
- one `.glb` the game loads with three.js's `GLTFLoader`.

It also adds a **perspective camera**, with a turntable strip for review and an orbit preview in Asset Lab for both
voxel and mesh assets; **mesh checks**; and the converters of plan §8b: `artgen convert` (outside `.glb` and `.vox` files
in, voxelised at the direction's scale) and `artgen extrude` (a 2D picture becomes a slab with depth).

**Accept (plan §10).** The R7 accept ("every cell in §8's matrix has a template and one bench asset at or above the
approval bar; a rigged `.glb` character walks in the three.js example game") is for R7 as a whole, after R7b and R7c, and
needs scored bench runs. For R7a: every 3D asset in the bench meshes under its budget and passes the mesh checks; its
`.glb` reads back with the same counts; an outside `.glb` and a `.vox` convert into an asset that renders; and the orbit
preview shows a voxel and a mesh asset in the web UI. Also (§10 for every phase): `npm run check`, `npm test`,
`check:packages`, `test:packages`, the strict boundary lint, the bench and the consumer fixtures stay green, and no
existing output changes.

## 2. Decisions

1. **One source, a second renderer.** A mesh is made from the `Scene3D` specs, not from the voxels: each solid is a
   signed distance function, so a sphere is round at any budget and a box keeps its corners. The voxels stay the
   pixel-art path, unchanged byte for byte.
2. **The mesh follows the voxel rules for colour.** A point on the surface takes the colour of the voxel under it:
   later specs paint over earlier ones, a slab recolours what it overlaps and `add: true` slabs add geometry. The mesh
   and the sprite therefore show the same parts in the same materials.
3. **Dual contouring under a budget.** The distance field is sampled on a grid and meshed with dual contouring (one
   vertex per cell, placed by the edge normals, so sharp edges stay sharp; quads from the four cells round each crossing
   edge). The result is closed by construction. The grid size is the largest one whose triangle count fits the budget
   (a binary search; meshing is deterministic). There is no decimation step.
4. **Smooth or faceted per part.** `mode: auto` follows each part's `shade`: `toon` parts get smooth normals from the
   field, `flat` parts get one normal per triangle (the low-poly look). `smooth` and `faceted` force one for all.
5. **UVs are box-projected charts.** Triangles are grouped by their main axis (±x, ±y, ±z) and by shared edges into
   charts. Each chart is projected onto its axis plane, so the texel density is set and nearly even (within cos 55°). A
   chart that folds over itself is split into layers that don't. Charts are shelf-packed on whole texels with a 2-texel
   gutter.
6. **Textures are baked from the source, not from the mesh.** Each texel finds its point on the true surface: colour
   from the voxel rules (decision 2), normal from the field's gradient (so the normal map puts back the detail the budget
   took out), roughness and metal from the material. Colours are palette-exact: the middle step of the material's ramp,
   moved along the ramp by the grain layer. Nothing is generated from images (D18).
7. **Two looks.** `pbr` (default) bakes albedo and leaves light to the engine. `baked` bakes the direction's banded
   light into the colour, as the sprites have it, and marks the material unlit (`KHR_materials_unlit`).
8. **Textures sample nearest.** The glTF sampler is nearest, with no mipmaps, so texels stay square pixels in the game.
9. **One world scale.** A model unit is `2 × scale` pixels in the raster renderer (the sprite's own render options,
   recorded by the scene), and the direction says how many pixels a metre is (`pxPerMetre`). So the mesh is as large in
   metres as the sprite is on screen, and `convert` voxelises an outside mesh at the same scale.
10. **A software renderer for previews.** The perspective camera and the triangle rasteriser are plain TypeScript in
    the scene layer, so the CLI's turntable and the web UI's orbit preview are the same pixels. The game uses three.js.
11. **Layers.** Meshing, UVs, baking, glTF read and write, checks, voxelising and the camera go in `artgen-scene`
    (`src/mesh/`, primitives only); the CLI holds the operations and file I/O; the web app the orbit view. The strict
    boundary lint stays at 0.

## 3. The distance field (`mesh/field.ts`)

`sceneField(scene, o)` turns a `Scene3D` into a list of **solids**, the same units `Scene3D.voxels()` walks (a
primitive, or a `union`, `subtract` or `intersect` node as one solid; a `group` passes its transform, material, part and
shade to its children). Each solid has:

| Field | |
|---|---|
| `sdf(p)` | signed distance in model units (≤ 0 inside), after inverting the node's and its parents' transforms |
| `geometry` | true for every solid but a slab without `add` |
| `slab` | slabs only paint what they overlap |
| `ramp`, `role` | the material ramp, and the ramp's name when the spec named one (roughness, §6) |
| `part`, `shade`, `grain`, `rough`, `metal` | from the spec or its parents |

Distances per primitive: `box` and `slab` exact; `ellipsoid` the usual bound (exact on the surface, close nearby);
`capsule` exact; `sdf` the given function, clipped to its `bbox`; `cells` (imported `.vox`) the distance to the nearest
cube of opposite occupancy within two cells. Booleans: union `min`, subtract `max(a, −b…)`, intersect `max`.
Transforms are the voxel ones read as continuous maps: mirror about the origin, quarter turns about it, translations
rounded to the voxel grid (`round(t·k)/k`), so a part sits where its voxels are. The voxels round a quarter turn about a
half-voxel origin half a voxel up (`Math.round`); the field turns with the same shift, so inside the field and inside a
voxel agree at every voxel centre (tested).

- **Geometry** at `p` is the minimum over the geometry solids.
- **Colour** at a surface point: step half a voxel inside along the normal; the last solid in walk order that contains
  that point gives the colour (a slab by its box, the rest by `sdf ≤ 0`). If none does (the budgeted mesh is off the
  true surface), the nearest solid gives it.

## 4. Meshing (`mesh/build.ts`)

```ts
export interface MeshOptions {
  budget?: number;                  // triangles (default by kind, §4.1)
  mode?: 'auto' | 'smooth' | 'faceted';
  texels?: number;                  // texels per model unit (default 4)
  look?: 'pbr' | 'baked';
  seed?: number;                    // grain
}
export function buildMesh(scene: Scene3D, o?: MeshOptions): MeshResult;
```

1. Bounds: the voxel set's box (fine voxels ÷ k) plus one voxel, inside a grid with one empty cell all round.
2. Sample the field at grid points, `n` cells along the longest side.
3. Dual contouring: on each grid edge with a sign change, find the crossing (bisection on the real field) and its normal
   (central differences). In each cell with crossings, place the vertex at the least-squares point of the crossings'
   planes, pulled a little toward their mean, and clamp it to the cell. Each crossing edge gives a quad of the four
   cells round it, wound outward, split along its shorter diagonal.
4. Budget: binary search on `n` (4 to 160) for the largest grid whose triangle count fits.
5. Parts and modes: each triangle takes the part of the colour solid at its centre; its normals are smooth (vertex
   normals from the field) or faceted (the face normal) by decision 4.
6. UVs (§5), bake (§6).

### 4.1 Budgets

| Kind | Triangles |
|---|---|
| character, creature | 4000 |
| vehicle, building | 3000 |
| prop, item, weapon | 1500 |
| tile, tileset, texture | 500 |
| any other | 2000 |

A brief may set `mesh: { budget, mode, texels, look }`; the command line overrides it.

## 5. UVs (`mesh/uv.ts`)

- Charts: triangles joined across shared edges when they have the same main axis. First, a triangle whose neighbours
  mostly face another axis joins them when it faces that axis well enough (its normal's component along it at least 0.6,
  so its density stays above √0.6 ≈ 0.77): organic surfaces give fewer, larger charts.
- Projection: the chart's axis plane, in texels (`texels` per model unit). The chart's u runs along the plane's first
  axis and v along its second, oriented so the texture is not mirrored seen from outside.
- Folds: the chart's triangles are drawn into texel masks in turn; each goes to the first layer whose mask it doesn't
  touch, and each layer becomes a chart of its own (usually two or three for a fold).
- Packing: charts by height, onto shelves of a power-of-two width, at whole-texel offsets with a 2-texel gutter; the
  atlas is the smallest power-of-two height that holds them. Over 2048 texels, the density halves and packing runs again
  (the result reports the density it used).
- Vertices are split where charts meet (a vertex has one UV). Tangents come from the chart's projection axes.

## 6. Baking (`mesh/bake.ts`)

For each texel inside a triangle (texel centres, the top-left rule), the point on the triangle, moved onto the true
surface along the field's gradient, gives:

| Map | Value |
|---|---|
| colour | `pbr`: the ramp's middle step, moved one step lighter or darker where the solid's `grain` (0–1, default 0) noise says so. `baked`: the step the direction's banded light picks for the true normal (the light of the `iso` camera, read in world space) |
| normal | the true normal in the triangle's tangent frame (OpenGL convention, as glTF has it) |
| roughness and metal | glTF's packing (G roughness, B metal): the solid's `rough` and `metal`, else by the material's name: metal 0.35 / 1; glass, ice, water, gem 0.1 / 0; skin 0.55; leather 0.65; wood 0.8; stone 0.9; cloth, fur, grass, dirt 0.95; else 0.85 / 0 |

After baking, each chart's texels grow two texels into the gutter, so sampling at a chart's edge never reads the
background.

## 7. glTF (`mesh/gltf.ts`)

- **Write** (`meshGlb`): one node, one mesh, one primitive with `POSITION`, `NORMAL`, `TANGENT`, `TEXCOORD_0` and
  `indices`; one material with `baseColorTexture`, `normalTexture` and `metallicRoughnessTexture` (nearest sampler, no
  mipmaps); the PNGs in the binary chunk. Axes and the footprint centre at the origin as `voxelGlb` has them (artgen
  x / y / z → glTF x / z / y). `extras.artgen` records the budget, mode, look and texel density. The GLB container code is
  shared with `voxelGlb`, whose output is unchanged.
- **Read** (`readGlb`, `glbTriangles`): the JSON and binary chunks, accessors (any component type, strides, normalised),
  the node tree with matrices or TRS, triangle lists, strips and fans (points and lines are skipped and reported), and per-vertex colour from
  `COLOR_0`, the base colour texture (PNG; a JPEG falls back to the factor, with a warning) or the base colour factor.

## 8. Checks (`mesh/checks.ts`)

Each check is `{ id, status, detail }` (the workflow's `Check`):

| Id | When it is not `pass` |
|---|---|
| `mesh-closed` | an edge is not matched by the same edge the other way (a hole or a flipped triangle) |
| `mesh-budget` | more triangles than the budget |
| `mesh-scale` | flags (a warning, as the sprite's own `height` check) when the brief gives a `height` and the mesh's height in metres is more than 20 % off it; `skip` without one. The mesh is as tall as the sprite is drawn, so the two agree |
| `uv-bounds` | a UV is outside 0–1 |
| `uv-overlap` | a texel centre is inside two triangles |
| `texel-density` | a triangle's texel density is under 0.7 or over 1.3 times the target |

## 9. The perspective camera and previews (`mesh/view.ts`)

- `orbitCamera({ target, yaw, pitch, distance, fov, w, h })`: a look-at camera round a target, y toward the viewer and z
  up as in the voxel cameras; `yaw` 0 looks from the front (+y), as facing `s` does.
- `rasterMesh(mesh, camera, o)`: triangles drawn with a depth buffer and perspective-correct weights at `ss` samples per
  pixel (a triangle with a corner behind the near plane is skipped; the orbit view keeps the camera outside the model).
  A texel's colour, lit by a key light (the direction's, read as above) through the normal map, plus ambient. Vertex
  colours (voxel meshes) light by the face normal.
- `voxelViewMesh(set, k)`: the greedy-mesh quads as triangles with the ramp's middle colour, in model units, so voxels
  and meshes share the camera.
- `turntable(mesh, o)`: `angles` (default 8) views round the model at one pitch, side by side.

## 10. Operations

| Operation | Module | Effect | What it does |
|---|---|---|---|
| `mesh <asset>` | art | render | the 3D-mode scene of one cell (default the first) → `out/<id>.mesh.glb`, `out/<id>-turntable.png`, the checks; exit 1 on a failing check |
| `turntable <asset>` | art | render | the turntable strip of the voxel or the mesh model; MCP returns the PNG |
| `convert <file.glb\|file.vox>` | art | write | voxelise an outside mesh at the direction's scale and snap its colours to the palette; `--asset <id>` writes the asset's next `base.vN.js`, else `--out` a `.vox` or (`--to mesh`) a mesh `.glb` |
| `extrude <image.png\|asset>` | art | write | the opaque pixels as columns `--depth` voxels deep, standing up (the picture's plane is x–z); the same outputs as `convert` |

`convert` and `extrude` write a base that wraps the cells: the `.vox` bytes inline as base64, read with the new
`ctx.lib.t2.vox(base64)` and added with `addVox`, with each colour named by its direction role (so a restyle recolours
it). The base renders with the raster renderer in the brief's view (`billboard` for `fp`; the slices for `stack`; centred
for `topdown`, else at the raster's default anchor) and records where it came from in a ledger `note` (`source`: the
tool, the file's name and hash, the options and `k`), so the conversion can be run again.

Sizes: a `.glb` keeps its own size in metres (`--height` rescales it). A `.vox` going into an asset is made as tall as the
brief's `height`, else given the fewest voxels a unit (`k`) that keep it inside the frame, 2 px clear, at any facing (its
footprint read as a circle). An extruded picture takes `k = 2`: a pixel is half a model unit, the sprites' 2 px a unit,
so the model is as large as the picture.

None of the four but `turntable` is an MCP tool: they write model files for the game or read files outside `art/`.

Voxelising (`mesh/voxelize.ts`): triangles in artgen's frame, scaled so a metre is `pxPerMetre ÷ 2` model units (or
`--height` metres tall), at `k` voxels per unit. Surface voxels are the ones a triangle overlaps (the separating-axis
test); the outside is flood-filled from the padded border, and the rest is solid. A surface voxel takes the colour of the
nearest triangle's sample there, interior voxels the colour of the nearest surface voxel; colours snap to the nearest
role the kind allows. Up to 256 voxels a side (the `.vox` limit).

## 11. The web UI

Asset Lab gets a **3D** panel for a version that renders a 3D-mode scene: drag to orbit, the wheel to zoom, and a choice
of voxels or mesh. The worker builds the model (`model3d`), the page draws it with `rasterMesh`, the same code as the CLI
turntable.

## 12. Built (2026-10-31)

- **Engine** (`artgen-scene/src/mesh/`, primitives only): `field.ts` (the solids as distance functions, paint by the
  voxel rules), `contour.ts` (dual contouring and the budget search), `uv.ts` (charts, folds as layers, shelf packing,
  `texelsIn` with a shared-edge rule), `bake.ts` (colour, normal, roughness-metal; grain; the `baked` look),
  `build.ts` (`buildMesh`, `meshBudget`), `gltf.ts` (`meshGlb`, `readGlb`, `glbTriangles`), `checks.ts`, `view.ts`
  (orbit camera, rasteriser, turntable, `voxelViewMesh`), `voxelize.ts`. `voxelGlb` shares the GLB container code
  (`glbBytes`); its bytes are unchanged. `Scene3D` records how it was drawn (`rendered`) and takes `grain`, `rough` and
  `metal` on a spec; the voxel path ignores them.
- **Pipeline:** `ctx.lib.t2.vox(base64)`; a brief's `mesh: { budget, mode, texels, look }` (validated).
- **Operations** (162 now, 4 more, generated into `OPERATIONS.md` and the Python client): `mesh`, `turntable` (an MCP tool
  returning the PNG), `convert`, `extrude`. `voxel` finds its scene with the same `scene3dOf`.
- **Web:** Asset Lab's 3D panel (`OrbitView.svelte`, the worker's `model3d`, `ArtProject.scene3d`).
- **Skills:** `references/breadth.md` (art) has a section on meshes, the free camera and the converters; `/artgen-image`
  (core) mentions `extrude` and `convert`. The example games are reinstalled.
- **Measured.** Every 3D-mode bench asset (`p6/car`, `house`, `imp`, `skeleton`, `isohero-toon`, `isospider-toon`,
  `pipeline/isochest`) meshes under its kind's budget in 0.3–1 s and passes the mesh checks; its `.glb` reads back with the
  same triangle count. Texel density stays within 0.77–1 of the target. Turntables of the meshes and of the voxels show
  the same parts in the same materials from every angle.
- **Tests:** scene 38 → 53 (field against voxels at every voxel centre, contouring, budgets, normals, UVs, palette-exact
  textures, grain and the baked look, glTF round trip, voxelising, the camera); cli 343 → 348 (the bench meshes; `mesh`,
  `turntable`, `convert` from a hand-built `.glb` and a `.vox`, `extrude` from a picture and from an asset, each into an
  asset whose base renders and passes the gate); mcp 31 → 32 (`turntable`, both sources). `npm run accept:ui` adds a step:
  a 3D-mode prop in Asset Lab as mesh and as voxels, turned by a drag (passes in headless Chromium).
- **Guards:** the other tests, the bench golden hashes, the consumer fixtures (`scripts/artgen-consumer-ci.mjs`), the
  Python tests (16), `check`, `check:packages` and the strict boundary lint pass. The MCP tool list gains `turntable`
  after `pr_parse` (its place in the art operations). Bundles: `artgen.js` and `artgen-mcp.js` 1.75 → 1.83 MB;
  `artgen-maps.js` unchanged; the web build's JS 1.38 → 1.41 MB.

**Where the build differs from the design above:** `mesh-scale` flags rather than fails (§8), since the sprite's own
`height` check does the same and the mesh is exactly as tall as the sprite (the bench imp is 38 % over its brief on both);
folding charts split into layers rather than single triangles (§5), and a triangle may join its neighbours' axis
(§5), both for fewer charts; the converted base keeps the raster renderer's default anchor and a `.vox` is fitted to the
frame through the view's camera (§10), after a first version clipped an iso footprint.

**Not done here.** Decimation: the budget sets the grid, so a plain box still uses most of its budget (the crate's 1,404
triangles of 1,500); merging coplanar triangles would cut that. Rigged and animated meshes and levels of detail (R7b),
and a `meshModel` helper in the three.js adapter (R7b loads them; `GLTFLoader` reads today's `.glb` as it is). Turntables
on the review sheet (the plan's §12 risk note) and the shape sheet in 3D. The R7 accept (every cell of the output matrix
with a bench asset at the approval bar; a rigged character walking in the three.js example) needs R7b, R7c and scored
runs. Firefox (not installed in this sandbox).
