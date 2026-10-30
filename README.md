# Game Asset Suite

Two things for game developers live in this repo:

- **artgen** — a pixel-art pipeline you install into your game's repo and drive from [Claude Code](https://claude.ai/code).
  You describe the game; Claude proposes three art directions, you pick or mix one, and it is locked as
  `art/direction.json` (palette, outline, light, scale, camera). From then on every sprite, prop, tile, texture and
  effect is a small JavaScript module that draws itself from that direction, goes through a fixed make → review →
  revise loop, and waits for your approval. Approved art exports as atlas packs plus a tiny typed runtime for Pixi.js,
  three.js or Canvas 2D. Change the direction later and one command re-renders the whole set.
- **The image tools** — a browser app (everything stays on your machine): a VTT token cutter, an SVG tracer, a palette tool, a sprite slicer, a terrain
  map maker, a dungeon map maker and a settlement map maker for tabletop RPGs, and three tools that open an artgen game's `art/` folder to edit the direction, review
  and approve assets, and play them.

## artgen quickstart

You need Node 20+, a git repo for your game, and Claude Code (local or claude.ai/code).

1. **Install** from your game repo's root, then commit what it adds (`.claude/`, `tools/artgen/`, `.mcp.json`,
   `CLAUDE.md`, `art/`). After that, sessions need no network or npm.
   ```bash
   npx -y github:rstevenson1237/image_tools#artgen-dist init
   ```
2. **Set the art direction:** run `/artgen-direction` in Claude Code. It asks about the game, renders three style tiles,
   and locks the one you choose (or a mix: "A's palette with B's outlines").
3. **Make assets:** `/artgen-brief` to list what you need ("a goblin with 8 facings and a walk cycle, a crate, a mud
   tile"), then `/artgen-make`. Claude works through every asset on its own and doesn't stop to ask.
4. **Approve:** `/artgen-review` shows the finished assets; `/artgen-approve <id>` or `/artgen-feedback <id>` for each.
   You can also do this in the **Asset Review** tool of the image tools app.
5. **Use them in the game:** `/artgen-export` writes the atlas packs, `src/art/assets.ts` (typed ids) and the runtime:
   ```ts
   const pack = await loadPack(Packs.main, pixiAdapter());
   const goblin = pack.sprite(Assets.goblin).play('walk').at(x, y);
   app.ticker.add(t => goblin.faceToward(dx, dy).update(t.deltaMS));   // picks the facing, steps the frames
   ```

**Tabletop maps.** The same install makes terrain maps for tabletop RPGs: `/artgen-map a hex crawl of a marshy coast
with a ruined keep` (or `artgen map new|gen|edit|label|symbol|grid|render`, or the `map_*` MCP tools). A map is
`art/maps/<id>/map.json` — generator settings, terrain edits and an overlay of labels and symbols — rendered with
contour lines, shaded terrain, an optional square or hex grid, in colour and black & white, as SVG and PNG. The
**Terrain Map** tool in the image tools opens, edits and saves the same file.

**Dungeon maps.** `/artgen-dungeon a flooded crypt with eight rooms and a secret shrine` (or `artgen dungeon
new|gen|room|link|door|grid|style|label|symbol|fit|render`, or the `dungeon_*` MCP tools) makes black-and-white dungeon
and lair maps: a single room (rectangle, circle, octagon, cave or any polygon, with exits, a number and a name) or rooms
joined by corridors and doors, generated from a seed or laid out by hand. White floors, thick walls and hatched rock,
with an optional 10 ft grid and 5 ft sub-grid, room numbers, labels and symbols. A dungeon is
`art/dungeons/<id>/dungeon.json`; the **Dungeon Map** tool in the image tools opens, edits and saves the same file.

**Settlement maps.** `/artgen-settlement a walled river town with a castle and a market` (or `artgen settlement
new|gen|building|interior|room|fixture|road|water|wall|area|tree|render|…`, or the `settlement_*` MCP tools) lays out
hamlets, villages, towns, cities and castles from plain shapes as a referee's reference: roads of six kinds, rivers,
ponds and moats with bridges, curtain, stone, palisade, fence, hedge and drystone walls with towers, gatehouses and
drawbridges, buildings with roofs, fields, gardens, woods and squares, trees and props, generated from a seed (on a
terrain map if you have one) or drawn by hand. Each building can hold its floor plans (rooms, doors, windows, stairs and
furniture at true size), shown close up or cut away on the site; colour or black and white, with a grid. A settlement
is `art/settlements/<id>/settlement.json`; the **Settlement Map** tool in the image tools opens, edits and saves it.

**Modules.** A bare `init` installs `core`, `art` and `maps`. Take only what the repo needs, and add or drop the rest later:
```bash
npx -y github:rstevenson1237/image_tools#artgen-dist init --with maps          # tabletop maps only: no art skills, agents or CLI
npx -y github:rstevenson1237/image_tools#artgen-dist add ui update-pr         # the review UI, and the weekly update pull request
npx -y github:rstevenson1237/image_tools#artgen-dist remove maps              # edited files stay; `modules` lists what each holds
```
`ui` is the review UI: `node tools/artgen/artgen.js ui` serves Asset Review, Art Direction, Asset Lab and the map editors
from the repo, opens its `art/` through that local server (any browser) and writes approvals and notes to the same
files and ledger lines the CLI does; it always matches the repo's engine version. Cloud sessions can't be reached from
your browser, so review there on the pull request instead. `update-pr` adds `.github/workflows/artgen-update.yml`: once a
week it runs `update` and opens a pull request with the changelog and the files it kept because you edited them.

Code that imports the engine (a game's runtime, a tool that builds maps in code) installs the library packages attached
to each release: `npm install https://github.com/rstevenson1237/image_tools/releases/download/artgen-v0.12.0/artgen-mapgen-0.11.0.tgz`
(`artgen-runtime`, `artgen-primitives`, `artgen-scene`, `artgen-workflow` and `artgen-mapgen`; no registry). `update` moves those URLs in
your `package.json` to the new release.

Later: `npx -y github:rstevenson1237/image_tools#artgen-dist update` (keeps your local edits), or pin a release with
`#artgen-dist-v0.11.0` ([changelog](packages/artgen-dist/CHANGELOG.md)). `node tools/artgen/artgen.js --help` lists
the CLI; the same tools are an MCP server (`artgen`) in every install, and `python/artgen` is a Python client.
[`examples/`](examples/) holds three small games built entirely this way: a top-down swamp (Pixi.js), an isometric
dungeon (Pixi.js) and a first-person billboard crawler (three.js).

| Package | What it is |
|---|---|
| [`packages/artgen-primitives`](packages/artgen-primitives) | engine layer 1: grid, colour, palette, noise, PNG, SVG, geometry, format versions |
| [`packages/artgen-scene`](packages/artgen-scene) | engine layer 2: direction types, 2D/3D scenes, procedural layers, voxels, views, animation, effects, textures |
| [`packages/artgen-workflow`](packages/artgen-workflow) | what pixel art and maps share once something is made: ledger, status, versions and diffs, analytics, metrics, the data sheet |
| [`packages/artgen-mapgen`](packages/artgen-mapgen) | the terrain, dungeon and settlement map engines |
| [`packages/artgen-imagekit`](packages/artgen-imagekit) | the image tools as plain TypeScript on pixels: trace, cut, palette, slice (the web tools, `artgen trace`, `cut`, `slice`, `quantize` and `map trace` all run it) |
| [`packages/artgen-core`](packages/artgen-core) | the artgen pipeline (rendering, passes, checks, workflows, export) and the facade that re-exports the four above |
| [`packages/artgen-cli`](packages/artgen-cli) | the `artgen` CLI the skills call |
| [`packages/artgen-runtime`](packages/artgen-runtime) | the runtime vendored into games, with Pixi.js / three.js / Canvas 2D adapters |
| [`packages/artgen-mcp`](packages/artgen-mcp) | the MCP server |
| [`packages/artgen-dist`](packages/artgen-dist) | builds the installable distribution (modules `core`, `art`, `maps`, `ui`, `update-pr`), the installer and the release library packages |
| [`python/artgen`](python/artgen) | Python client |

How artgen was designed and built (intake, spec, plan, decisions, per-phase findings and the original artlab
experiments) is archived in [`docs/archive/artgen`](docs/archive/artgen/README.md).
What comes next (package split, modular install, the feedback loop, stages) is proposed in
[`docs/TOOLING-PLAN.md`](docs/TOOLING-PLAN.md).

## The image tools

- **VTT Token Cutter** — lasso a figure in a piece of artwork and extract a mono-colour
  silhouette as a transparent, tightly-cropped PNG.
- **SVG Tracer** — trace artwork to vector paths, fix the trace node by node, and export SVG.
- **Palette** — take the dominant colours of a picture, snap the picture to them (or to a `.hex` / `.gpl` file),
  and save the palette.
- **Sprite Slicer** — cut a sprite sheet into its sprites, by a grid or as loose sprites found by their pixels, and
  download the cells with a `slices.json`.

The same operations are on the command line, so Claude Code can use them: `artgen trace`, `trace-base` (a sketch becomes an
asset's base), `map trace` (a sketch becomes a map's ground), `cut` (a token from an approved asset), `slice` and
`quantize`.
- **Terrain Map** — tabletop RPG maps: a regional hex crawl or a local battle map generated from a seed, then shaped
  with brushes (paint terrain, raise or lower ground, rivers, roads). Topographic contours over shaded terrain; add a
  square or hex grid, labels and symbols; export SVG or PNG in colour or black & white. Works on its own (open or
  download `map.json`) or on a game repo's `art/maps/`, which Claude Code edits with `/artgen-map`.
- **Dungeon Map** — tabletop RPG dungeons and lairs in black and white: make one room with exits, or generate a
  complex from a seed, then drag out rooms (rect, round, octagonal, cave, or any polygon), link them with corridors,
  set doors (plain, secret, locked, portcullis, arch), move rooms; add a 10 ft / 5 ft grid, room numbers, labels and
  symbols; export SVG or PNG. Works on its own or on a game repo's `art/dungeons/`, which Claude Code edits with
  `/artgen-dungeon`.
- **Settlement Map** — tabletop RPG villages, towns, cities and castles: generate one from a seed (roads, walls and
  gates, water and bridges, buildings, fields, woods, trees and props), then drag out buildings and click out roads,
  rivers, walls and fields; double-click a building for its floor plan (lay its floors out, drag out rooms, add doors,
  windows and furniture); colour or black and white, roofs or cut-away buildings; export SVG or PNG of either view.
  Works on its own or on a game repo's `art/settlements/`, which Claude Code edits with `/artgen-settlement`.
- **Art Direction** — open a game's `art/` folder (File System Access in Chromium; a zip round trip elsewhere), edit
  palette ramps and style settings with a live style tile, compare candidates, save a draft or lock a new version.
- **Asset Review** — finished assets by status, the pass timeline with scores, version compare, conformance; approve,
  or request changes with notes pinned to regions of the sprite; pipeline analytics.
- **Asset Lab** — drive an asset's params, seed and variant, and play it through the artgen runtime by state, facing
  and frame; export it alone as a pack.

The art tools write the same files Claude Code reads, so changes made in either show up in the other.

## Developing this repo

```bash
npm install
npm run dev     # http://localhost:5173
npm run check   # svelte-check
npm test        # vitest — the vector model, SVG serializer, artgen project engine (vs the CLI)
npm run build   # production bundle in dist/
npm run preview # serve the production build

npm run check:packages  # typecheck the artgen workspace packages
npm run test:packages   # vitest in each artgen workspace package
npm run build:dist      # build the artgen committed-install distribution (packages/artgen-dist/out), review UI included
npm run pack:libs       # build the library package files a release attaches (lib-dist/)
npm run accept:ui       # headless-browser run of `artgen ui` against a fixture game (needs Playwright)
npm run accept:images   # headless-browser run of the four image tools against the production build (needs Playwright)
npm run accept:release  # tag → `npx …#artgen-dist-v<B> update` for the full and the maps-only install
npm run fixtures:install  # restore the generated tools in the examples/ fixture game repos
```

## Architecture

```
src/
├── App.svelte              Shell: sidebar + dynamically mounted tool
├── core/                   Shared infrastructure, used by every tool
│   ├── canvas/             CanvasStage.svelte — zoom, pan, grid snap, dropzone
│   ├── components/         StatusBadge, PixelPreview, CompareView, PaletteRamp, ProjectBar (art pipeline tools)
│   ├── maps/               the shared map-editor shell: layout and styles, project open / save, preview render loop, helpers
│   ├── project/            artgen project: file access (FSA / zip), snapshot, engine, store
│   ├── stores/             activeTool, generic Command-Pattern history
│   ├── tools/registry.ts   The tool registry (sidebar groups: image, maps, art)
│   └── utils/              Geometry, ImageData helpers, downloads, pointer normalisation
├── tools/
│   ├── TokenCutter/        UI, selection capture, store, export
│   ├── SvgTracer/          UI, node editor, vector model, SVG serializer, store
│   ├── Palette/            colours of a picture, snap to a palette, .hex / .gpl
│   ├── Slice/              sprite sheet to cells (grid or loose sprites), zip
│   ├── TerrainMap/         map editor over the `map` engine (generator, contours, themes, SVG renderer)
│   ├── DungeonMap/         dungeon editor over the `dungeon` engine
│   ├── SettlementMap/      settlement editor (site and floor plans) over the `settlement` engine
│   ├── ArtDirection/       direction editor + live style tile
│   ├── AssetReview/        gallery, timeline, compare, approve / feedback, analytics
│   └── AssetLab/           params + runtime playback
└── workers/
    ├── workerRegistry.ts   Ref-counted Comlink worker pool
    ├── imagekit.worker.ts  artgen-imagekit over the page's pictures (silhouette, trace, palette, slice)
    └── artgen.worker.ts    @artgen/core over the opened project (asset code runs here, never on the page)
```

Each tool is registered in `src/core/tools/registry.ts` with a lazy `load()` import, so its UI,
canvas wiring, and worker are code-split. Switching tools unmounts the previous component tree,
which disposes its Fabric canvas and releases its worker lease — the pool terminates the worker
once the last lease is gone.

### Processing pipeline

The processing is `packages/artgen-imagekit`: plain TypeScript on RGBA pixels, with no WASM to load. (Until R5b the tools ran
on a 10 MB OpenCV build; imagekit reimplements the steps they used, and `packages/artgen-imagekit/fixtures/opencv/` holds
what OpenCV gave on a set of pictures so the tests keep the TypeScript to it: masks pixel for pixel, traced rings point for
point.) The worker `src/workers/imagekit.worker.ts` only moves pictures in and out, so a large one does not freeze the page.

`extractSilhouette` builds a polygon mask from the lasso → greyscale → blur → threshold (Otsu or manual) → morphological
close → intersects with the source alpha and the lasso → optionally keeps the largest filled blob → emits RGBA where the
subject takes the chosen colour and everything else is transparent.

### Tracing pipeline

`traceImage` shares `binarize` with the extractor, then finds the borders of the blobs (Suzuki and Abe's border following, as
OpenCV's `findContours` does it) in a strict two-level hierarchy — each outer contour is grouped with its own holes. Contours
are simplified (Douglas–Peucker, as `approxPolyDP`), dropped below `minArea`, sorted largest-first and capped at `maxPaths`, and
returned as flat `Float32Array` rings that are *transferred* rather than cloned. The two-level hierarchy deliberately flattens
deeper nesting: an island inside a hole comes back as its own top-level shape, which is what even-odd filling wants.

The SVG Tracer keeps a plain TypeScript document (`SvgTracer/model.ts`) as its source of truth
and treats Fabric as a renderer. Fabric has no per-vertex editing API, and its geometry setters
re-centre an object's origin, so a Fabric-owned model would move a shape every time you dragged
one of its nodes. Keeping the model plain also keeps it free of runes and the DOM, which is what
makes it and the serializer unit-testable.

Two consequences worth knowing. Node handles are painted straight into the 2D context on
`after:render`, for the selected path only, rather than becoming thousands of Fabric objects. And
commands must never capture the document in a closure: `$state` hands back a *new* proxy when the
same object is reassigned after a null — which is exactly what undoing and redoing a trace does —
and writes through the stale proxy do not surface on the new one.

### Art pipeline tools

The three artgen tools share one open project (`src/core/project/store.svelte.ts`). The `artgen` worker runs the same
`@artgen/core` the CLI runs, over a snapshot of the `art/` folder; asset modules (code from the game repo) are imported
there as blob URLs, never on the page. `engine.ts` derives status, renders, conformance and analytics exactly as the CLI
does — `engine.test.ts` checks it against the CLI on the fixture repos in `examples/`. Writes are plans the worker
returns; the store re-reads the files first, refuses if Claude Code changed one meanwhile, and appends ledger lines rather
than rewriting the file. `scripts/artgen-ui-accept.mjs` drives the whole loop in headless Chromium.

## Cross-Origin isolation

`vite.config.ts` sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on the dev
and preview servers. Nothing in the app uses `SharedArrayBuffer`, so it runs correctly on hosts that cannot set headers at all
(verified end-to-end with `crossOriginIsolated === false`). The headers stay in dev so that switching to a threaded WASM
build — which *would* need them — fails locally instead of in production.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. To turn it on once:
**Settings → Pages → Source → GitHub Actions**. The site then lands at
`https://<user>.github.io/<repo>/`.

Two details make this work:

- **Sub-path.** Pages serves from `/<repo>/`, not the domain root, so the workflow passes
  `BASE_PATH` and Vite builds for it.
- **Nothing large is fetched at run time.** The image tools are plain TypeScript in the bundle (the site is about 4.6 MB;
  it was 15 MB with the OpenCV asset), so there is no vendor step before the build.

Pages cannot set custom headers, so `crossOriginIsolated` is false there. That is fine — see the
isolation note above. The whole pipeline was verified against a header-free static server on a
sub-path, producing byte-identical output to the isolated run.

Any static host works on the same terms (Netlify, Cloudflare Pages, S3); only `base` changes.

## Adding a tool

1. Create `src/tools/YourTool/index.svelte`.
2. Add an entry to `tools` in `src/core/tools/registry.ts` with a lazy `load()` and the workers
   it needs.
3. Mount `CanvasStage` and use `oncanvasready` to attach tool-specific interaction.
4. Acquire workers with `acquire(kind)` in `onMount` and call `lease.release()` in `onDestroy`.
5. Create a history instance with `createHistory()` so undo stays local to the tool.

## Known advisories

`npm audit` reports **0 vulnerabilities**. Fabric.js is on 7.4.0, which fixes the SVG-export
serialisation advisories that affected the 6.x line, and whose optional `canvas` dependency no
longer drags in the vulnerable `tar` chain.

The SVG Tracer does serialise SVG, but through its own serializer in
`src/tools/SvgTracer/svg.ts` — not `canvas.toSVG()` — so Fabric's SVG-export path stays unused.
That serializer emits no user-supplied text: colours are validated against a hex regex and fall
back to black, and path names are never written into the output.
