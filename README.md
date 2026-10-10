# Game Asset Suite

Two things for game developers live in this repo:

- **artgen** — a pixel-art pipeline you install into your game's repo and drive from [Claude Code](https://claude.ai/code).
  You describe the game; Claude proposes three art directions, you pick or mix one, and it is locked as
  `art/direction.json` (palette, outline, light, scale, camera). From then on every sprite, prop, tile, texture and
  effect is a small JavaScript module that draws itself from that direction, goes through a fixed make → review →
  revise loop, and waits for your approval. Approved art exports as atlas packs plus a tiny typed runtime for Pixi.js,
  three.js or Canvas 2D. Change the direction later and one command re-renders the whole set.
- **The image tools** — a browser app (everything stays on your machine): a VTT token cutter, an SVG tracer, and three
  tools that open an artgen game's `art/` folder to edit the direction, review and approve assets, and play them.

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

Later: `npx -y github:rstevenson1237/image_tools#artgen-dist update` (keeps your local edits), or pin a release with
`#artgen-dist-v0.9.0` ([changelog](packages/artgen-dist/CHANGELOG.md)). `node tools/artgen/artgen.js --help` lists
the CLI; the same tools are an MCP server (`artgen`) in every install, and `python/artgen` is a Python client.
[`examples/`](examples/) holds three small games built entirely this way: a top-down swamp (Pixi.js), an isometric
dungeon (Pixi.js) and a first-person billboard crawler (three.js).

| Package | What it is |
|---|---|
| [`packages/artgen-core`](packages/artgen-core) | the engine: direction model, primitives, procedural layers, finishing ops, checks, export |
| [`packages/artgen-cli`](packages/artgen-cli) | the `artgen` CLI the skills call |
| [`packages/artgen-runtime`](packages/artgen-runtime) | the runtime vendored into games, with Pixi.js / three.js / Canvas 2D adapters |
| [`packages/artgen-mcp`](packages/artgen-mcp) | the MCP server |
| [`packages/artgen-dist`](packages/artgen-dist) | builds the installable distribution and the installer |
| [`python/artgen`](python/artgen) | Python client |

How artgen was designed and built (intake, spec, plan, decisions, per-phase findings and the original artlab
experiments) is archived in [`docs/archive/artgen`](docs/archive/artgen/README.md).

## The image tools

- **VTT Token Cutter** — lasso a figure in a piece of artwork and extract a mono-colour
  silhouette as a transparent, tightly-cropped PNG.
- **SVG Tracer** — trace artwork to vector paths, fix the trace node by node, and export SVG.
- **Art Direction** — open a game's `art/` folder (File System Access in Chromium; a zip round trip elsewhere), edit
  palette ramps and style settings with a live style tile, compare candidates, save a draft or lock a new version.
- **Asset Review** — finished assets by status, the pass timeline with scores, version compare, conformance; approve,
  or request changes with notes pinned to regions of the sprite; pipeline analytics.
- **Asset Lab** — drive an asset's params, seed and variant, and play it through the artgen runtime by state, facing
  and frame; export it alone as a pack.

The art tools write the same files Claude Code reads, so changes made in either show up in the other.

## Developing this repo

```bash
npm install     # also copies opencv.js into public/vendor
npm run dev     # http://localhost:5173
npm run check   # svelte-check
npm test        # vitest — the vector model, SVG serializer, artgen project engine (vs the CLI)
npm run build   # production bundle in dist/
npm run preview # serve the production build

npm run check:packages  # typecheck the artgen workspace packages
npm run test:packages   # vitest in each artgen workspace package
npm run build:dist      # build the artgen committed-install distribution (packages/artgen-dist/out)
npm run fixtures:install  # restore the generated tools in the examples/ fixture game repos
```

`npm run dev` and `npm run build` both re-run `scripts/vendor-opencv.mjs` first, so the OpenCV
asset is always in place.

## Architecture

```
src/
├── App.svelte              Shell: sidebar + dynamically mounted tool
├── core/                   Shared infrastructure, used by every tool
│   ├── canvas/             CanvasStage.svelte — zoom, pan, grid snap, dropzone
│   ├── components/         StatusBadge, PixelPreview, CompareView, PaletteRamp, ProjectBar (art pipeline tools)
│   ├── project/            artgen project: file access (FSA / zip), snapshot, engine, store
│   ├── stores/             activeTool, generic Command-Pattern history
│   ├── tools/registry.ts   The tool registry (with sidebar groups)
│   └── utils/              Geometry, ImageData helpers, downloads, pointer normalisation
├── tools/
│   ├── TokenCutter/        UI, selection capture, store, export
│   ├── SvgTracer/          UI, node editor, vector model, SVG serializer, store
│   ├── ArtDirection/       direction editor + live style tile
│   ├── AssetReview/        gallery, timeline, compare, approve / feedback, analytics
│   └── AssetLab/           params + runtime playback
└── workers/
    ├── workerRegistry.ts   Ref-counted Comlink worker pool
    ├── opencv.worker.ts    OpenCV pipelines (silhouette extraction, contour tracing)
    └── artgen.worker.ts    @artgen/core over the opened project (asset code runs here, never on the page)
```

Each tool is registered in `src/core/tools/registry.ts` with a lazy `load()` import, so its UI,
canvas wiring, and worker are code-split. Switching tools unmounts the previous component tree,
which disposes its Fabric canvas and releases its worker lease — the pool terminates the worker
once the last lease is gone.

### Processing pipeline

`extractSilhouette` runs in a worker: build a polygon mask from the lasso → greyscale → blur →
threshold (Otsu or manual) → morphological close → intersect with the source alpha and the lasso
→ optionally keep the largest filled blob → emit RGBA where the subject takes the chosen colour
and everything else is transparent. Every `cv.Mat` is tracked in a `MatScope` and released in a
`finally`, so a mid-pipeline exception cannot leak the WASM heap.

### Tracing pipeline

`traceContours` shares `binarize` with the extractor, then runs `findContours` with `RETR_CCOMP`
— a strict two-level hierarchy — so each outer contour is grouped with its own holes before
anything crosses back to the main thread. Contours are simplified with `approxPolyDP`, dropped
below `minArea`, sorted largest-first and capped at `maxPaths`, and returned as flat
`Float32Array` rings that are *transferred* rather than cloned. `RETR_CCOMP` deliberately
flattens deeper nesting: an island inside a hole comes back as its own top-level shape, which is
what even-odd filling wants.

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

## Two things worth knowing before you touch the worker

**Cross-Origin isolation is set in dev, but is not required.** `vite.config.ts` sends
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on the
dev and preview servers. The current OpenCV.js build is single-threaded and contains no
`SharedArrayBuffer` reference, so the app runs correctly on hosts that cannot set headers at all
(verified end-to-end with `crossOriginIsolated === false`). The headers stay in dev so that
switching to a threaded WASM build — which *would* need them — fails locally instead of in
production.

**Loading OpenCV.js is genuinely awkward**, and the two obvious approaches both fail silently:

- `import()`ing the npm package inside the worker wedges the thread outright.
- `importScripts` only exists in classic workers, and Vite leaves ESM imports in classic workers
  un-bundled in dev, so they fail to parse.

So the worker fetches `public/vendor/opencv.js` and runs it through an **indirect** `eval`, which
evaluates in global scope and lets the UMD's fallback branch assign `self.cv`. The file must be
served from `public/` — Vite's dev server rewrites anything under `/node_modules` into an ES
module, which would corrupt the UMD. `scripts/vendor-opencv.mjs` copies it there from the npm
package (the copy is gitignored; npm stays the source of truth for the version).

The Emscripten module is also **thenable and resolves with itself**. Awaiting it — or returning
it from an `async` function, which is the easy one to miss — makes the promise machinery re-chain
forever and hang the worker with no error. The loader boxes it during init and then deletes
`then` outright.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. To turn it on once:
**Settings → Pages → Source → GitHub Actions**. The site then lands at
`https://<user>.github.io/<repo>/`.

Two details make this work:

- **Sub-path.** Pages serves from `/<repo>/`, not the domain root, so the workflow passes
  `BASE_PATH` and Vite builds for it. The OpenCV worker resolves its asset through
  `import.meta.env.BASE_URL`, so it follows automatically.
- **The 10 MB OpenCV asset is gitignored**, and produced in CI — `npm ci` runs the `postinstall`
  vendor script, so `public/vendor/opencv.js` exists before the build. Nothing large is committed.

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
