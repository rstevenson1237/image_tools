# Game Asset Suite

A client-side image manipulation suite for game developers and Virtual Table Top players.
Everything runs in the browser — no image ever leaves the machine.

The first tool is the **VTT Token Cutter**: lasso a figure in a piece of artwork and extract a
mono-colour silhouette as a transparent, tightly-cropped PNG.

## Getting started

```bash
npm install     # also copies opencv.js into public/vendor
npm run dev     # http://localhost:5173
npm run check   # svelte-check
npm run build   # production bundle in dist/
npm run preview # serve the production build
```

`npm run dev` and `npm run build` both re-run `scripts/vendor-opencv.mjs` first, so the OpenCV
asset is always in place.

## Architecture

```
src/
├── App.svelte              Shell: sidebar + dynamically mounted tool
├── core/                   Shared infrastructure, used by every tool
│   ├── canvas/             CanvasStage.svelte — zoom, pan, grid snap, dropzone
│   ├── stores/             activeTool, generic Command-Pattern history
│   ├── tools/registry.ts   The tool registry
│   └── utils/              Geometry, ImageData/PNG helpers, pointer normalisation
├── tools/
│   └── TokenCutter/        The MVP tool: UI, selection capture, store, export
└── workers/
    ├── workerRegistry.ts   Ref-counted Comlink worker pool
    └── opencv.worker.ts    OpenCV pipeline (masking → threshold → silhouette)
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

`npm audit` reports Fabric.js advisories concerning **SVG export** serialisation. This app exports
PNGs via `canvas.toBlob` and never serialises SVG, so the affected code path is unused. The fix
requires Fabric 7, a major upgrade. The critical `tar` advisory comes in through `canvas`, a
Node-only optional dependency of Fabric that is never shipped to the browser.
