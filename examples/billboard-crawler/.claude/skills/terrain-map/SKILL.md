---
name: terrain-map
description: Make terrain maps for tabletop RPGs with artgen — a regional hex-crawl map or a local battle map, generated from a seed and then shaped with edits — with topographic contour lines and shaded terrain (water, rivers, marsh, sand, desert, grassland, scrub, forest, rock, snow), an optional square or hex grid, and optional labels and symbols. Renders in full colour and in black and white as SVG and PNG. Use when the user wants a world, region, overland, hex-crawl, encounter or battle map, or wants to change, label or export one.
---

# Terrain maps

A map is one file, `art/maps/<id>/map.json`: generator settings, an ordered list of **edits**, and an **overlay** of
labels and symbols. Every render is rebuilt from it into `art/maps/<id>/out/` (gitignored). The user may also open the
same file in the image tools web app (**Terrain Map**), paint on it and save it back: always re-read the map
(`node tools/artgen/artgen.js map show <id>`) before changing it. CLI: `node tools/artgen/artgen.js map …`; the `artgen` MCP server has the same
operations as `map_*` tools (images come back inline).

Coordinates are **map cells**: x to the right, y down, one unit per grid cell (a square, or a hex across its flats).
Anywhere a point is asked for you can also give a hex (`0304` = column 3, row 4) or a square cell (`C4`).

## 1. Ask, then create
Ask only what changes the map: what it is for (overland travel → `regional`; a fight or a site → `local`), roughly how
big, the land (`mixed`, `island`, or `inland` with only lakes), how wet, and the grid (hex for regional travel,
squares for battle maps, or none). Then:
```
node tools/artgen/artgen.js map new <id> --preset regional|local [--size 30x22] [--grid hex|square|none] [--title "…"] [--seed n]
node tools/artgen/artgen.js map render <id>            # colour + B/W, SVG + PNG; open the colour PNG and look at it
```
Presets: `regional` = 30×22 hexes of 6 mi, contours every 500 ft; `local` = 30×20 squares of 5 ft, contours every 5 ft.

## 2. Shape the terrain
Big changes first, with the generator; then local fixes with edits. Render and look after each round.
```
node tools/artgen/artgen.js map gen <id> --seed 7                    # a different world with the same settings
node tools/artgen/artgen.js map gen <id> --land island --sea 0.45     # sea = share of the map under water (0..0.9)
node tools/artgen/artgen.js map gen <id> --moisture 0.7 --rivers 4    # wetter: more forest and marsh, fewer deserts
node tools/artgen/artgen.js map gen <id> --relief 0.8 --roughness 0.3 # taller, smoother mountains
node tools/artgen/artgen.js map gen <id> --simplify 4 --interval 1000 # calmer: fewer, larger patches and fewer contour lines
node tools/artgen/artgen.js map edit <id> paint --terrain forest --circle 12,8,3
node tools/artgen/artgen.js map edit <id> paint --terrain water --poly 4,4,8,3,9,7,5,8       # a lake
node tools/artgen/artgen.js map edit <id> elevate --amount 0.4 --stroke 3,15,10,12,18,14 --width 3   # a ridge (negative: a valley)
node tools/artgen/artgen.js map edit <id> river --points 20,2,18,8,21,14,19,22   # source first: thin there, full width at the mouth
node tools/artgen/artgen.js map edit <id> road --points 2,10,10,11,25,9
node tools/artgen/artgen.js map edit <id> undo
```
Rivers (generated and drawn) are drawn as a water-filled ribbon between two thin banks that widens gently from the
source to the mouth. One that ends in the sea or a lake (painted lakes count) is carried to the shore and flares into
it: its banks run into the coastline and its water joins the lake's. Give `--delta off` for a plain rounded end, and
draw rivers from the source down, never from the mouth up.

Terrains: `deep water marsh sand desert grass scrub forest rock snow`. Edits apply in order on top of the generated
terrain, so a later paint wins; `gen` keeps every edit. If the user wants "the same map but …", edit — don't reseed.

## 3. Grid, labels and symbols (the follow-up layers)
```
node tools/artgen/artgen.js map grid <id> hex|square|none [--size 1] [--coords on|off]
node tools/artgen/artgen.js map label <id> "The Greywold" --at 8,6 --kind region     # region: big spaced capitals
node tools/artgen/artgen.js map label <id> "Thornby" --at 0507 --kind place          # place: bold, beside its symbol
node tools/artgen/artgen.js map label <id> "Silver Mere" --at 20,16 --kind water     # water: italic
node tools/artgen/artgen.js map symbol <id> town --at 0506                           # node tools/artgen/artgen.js map symbols lists the kinds
node tools/artgen/artgen.js map overlay <id> rm label 2 | clear labels
node tools/artgen/artgen.js map set <id> --title "The Drowned Marches" --legend on --scale-bar on --compass on
```

## 4. Render and hand over
```
node tools/artgen/artgen.js map render <id> [--theme color|bw|both] [--format svg|png|both] [--ppu 60] [--layers grid=off,labels=off]
```
`--ppu` is pixels per cell (default 40; use 70+ for print or a VTT battle map at 70 px per square). `--layers` turns
any of `terrain rivers roads contours grid symbols labels legend scale compass title` off — e.g. a clean player copy
without labels, or a terrain-only image to letter by hand. Give the user the file paths and show the PNGs.

## Readability rules (check every render)
- **Read at a glance.** Five or six terrains carry a map; if it looks busy, raise `--simplify` or the contour interval
  before anything else. Avoid one-hex specks of terrain.
- **Check the B/W render too.** Terrain there is told apart by pattern only; if two neighbouring patterns blur
  together, paint one of them over, or merge them.
- **Labels sit in open ground,** not across coastlines or on top of symbols; place labels go just below or beside
  their symbol (about 0.6 cells). Region labels span the area they name. Keep labels short.
- **Few symbols:** the places the players care about, not every farm.
- Don't hand-edit the SVG: change `map.json` (or use the commands) and re-render, so colour and B/W stay in step.
