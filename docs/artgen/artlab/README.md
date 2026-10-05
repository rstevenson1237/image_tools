# artlab - procedural sprite experiment harness

Asset sets: top-down (hero, ship, tank) and isometric roguelike (isohero, isospider, isochest). See FINDINGS.md and FINDINGS-iso.md.

Node 18+. `npm install` (only dependency: @napi-rs/canvas, which mirrors the browser Canvas API).

## Layout
- `lib/core.js` palette ramps, seeded RNG, `Grid` pixel buffer
- `lib/post.js` outline, palette quantize, majority downsample, drop shadow, despeckle
- `lib/prim.js` T2 shape primitives + auto shading (`bevel|sphere|cyl|flat`, `rim`, `ink`, `mirrorX/Y`, `pattern`)
- `lib/svg.js` T3 SVG -> canvas with `raw|crisp|ss` modes and per-asset palette
- `lib/metrics.js` automated pixel-art hygiene checks
- `lib/iso.js` 2:1 iso projection, box faces, ground shadow
- `lib/voxel.js` T4 voxel models (box/ellipsoid/line/paint, fine-voxel `k`) rendered iso, optional `ss` supersample
- `techniques/<t1|t2|t3>/<asset>.v<N>.js` one file per iteration; each exports `render(seed) -> Grid` and `notes`
- `records/ledger.json` token/metric/score log; `out/` renders and review sheets

## Commands
```
node run.js render <asset> <tech> <ver>     # e.g. render tank t3 v4
node run.js review <asset> [tech|latest]    # comparison PNG for visual review
node run.js score <asset> <tech> <ver> <0-10> "note"
node run.js all                             # re-render everything (reproducible, seeded)
node run.js report [iso]                    # REPORT.md / REPORT-iso.md + final comparison sheets
node run.js reviewtech t3 hero,ship         # newest version of one technique across assets
node variants.js 8                          # seeded T2 hero variants
```
Add an asset: add an entry to `ASSETS` in run.js, then create `techniques/tX/<asset>.v1.js`.
