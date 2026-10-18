---
name: dungeon-map
description: Make dungeon and lair maps for tabletop RPGs with artgen — a single room (rectangular, round, octagonal, cave-like or any polygon, with exits, a number and a name) or a whole complex of rooms joined by corridors and doors, generated from a seed or laid out by hand. Black and white, hatched rock, thick walls, with an optional 10 ft grid and 5 ft sub-grid, room numbers, labels and symbols (stairs, pillars, altars, traps, chests…). Renders SVG and PNG. Use when the user wants a dungeon, lair, cave, crypt, tomb, keep interior, room or encounter-area map, or wants to change, key or export one.
---

# Dungeon maps

A dungeon is one file, `art/dungeons/<id>/dungeon.json`: settings, **rooms**, the **corridors** that join them, and an
**overlay** of labels and symbols. Every render is rebuilt from it into `art/dungeons/<id>/out/` (gitignored). The user
may also open the same file in the image tools web app (**Dungeon Map**), draw on it and save it back: always re-read
the dungeon (`node tools/artgen/artgen.js dungeon show <id>`) before changing it. CLI: `node tools/artgen/artgen.js dungeon …`; the `artgen` MCP server has
the same operations as `dungeon_*` tools (images come back inline).

Coordinates are **grid cells**, x to the right and y down; one cell is 5 ft. A room's `--at` is its **top-left
corner**. Anywhere a point is asked for you can also give a cell name (`C4` = column C, row 4). Output is always black
and white: white floors with a grid, thick black walls, hatched rock around them.

## 1. Ask, then create
Ask only what changes the map: one room or a complex; roughly how many rooms and how big; built (square rooms,
corridors, doors) or natural (caves); the grid (10 ft, 10 ft with a 5 ft sub-grid, 5 ft, or none). Then one of:
```
node tools/artgen/artgen.js dungeon new <id> --room rect --room-size 8x8 --exits n,e,s:secret,w:none --number 20   # one room
node tools/artgen/artgen.js dungeon new <id> --rooms 10 --size 40x30 --title "Lair of the Ash Wyrm" [--seed n]       # generated
node tools/artgen/artgen.js dungeon new <id> --empty --size 30x24                                                     # by hand
node tools/artgen/artgen.js dungeon render <id>         # SVG + PNG; open the PNG and look at it
```
Room shapes: `rect circle octagon cave poly`. Exits on a single room run off the map edge; give each side a door kind
after a colon (`n:locked`), `:none` for an open passage (default: a plain door).

## 2. Shape the layout
Big changes with the generator; then fix rooms one by one. Render and look after each round.
```
node tools/artgen/artgen.js dungeon gen <id> --seed 7                         # a different layout, same settings (replaces rooms and corridors)
node tools/artgen/artgen.js dungeon gen <id> --rooms 12 --min-size 4 --max-size 9 --caves 0.3 --round 0.1 --loops 0.4 --doors 0.7
node tools/artgen/artgen.js dungeon room <id> add rect --at 10,4 --size 6x4 --label "Guard room"
node tools/artgen/artgen.js dungeon room <id> add cave --at 20,12 --size 10x7
node tools/artgen/artgen.js dungeon room <id> add poly --points 2,2,8,2,8,8,5,8,5,5,2,5      # an L-shaped room
node tools/artgen/artgen.js dungeon room <id> move r3 --at 14,6 | set r3 --shape octagon --size 7x7 --number off | rm r3
node tools/artgen/artgen.js dungeon link <id> r1 r2 --doors door,secret                        # door at r1's end, secret door at r2's
node tools/artgen/artgen.js dungeon link <id> r2 r5 --width 2 --route vh                       # 10 ft passage, down then across
node tools/artgen/artgen.js dungeon link <id> r4 41,12                                         # an exit running off the east edge
node tools/artgen/artgen.js dungeon door <id> 3 to portcullis | unlink <id> 3
node tools/artgen/artgen.js dungeon fit <id> --margin 2                                        # crop the map to the rooms
```
Corridors start at room centres: rooms that line up get one straight corridor, others an L-shaped elbow (`--route
hv|vh`, or `--via x,y,…` for your own bends). Walls between overlapping floor vanish, so a corridor opens into a room
wherever it meets it. Door kinds: `door secret locked portcullis arch` (or `none`). Gen keeps labels and symbols but
replaces every room and corridor: if the user wants "the same dungeon but …", edit — don't regenerate.

## 3. Grid, numbers, labels and symbols (the follow-up layers)
```
node tools/artgen/artgen.js dungeon grid <id> 10+5 [--clip floor|all]     # 10 ft lines + fainter 5 ft; 10 | 5 | none; on the floor (default) or everywhere
node tools/artgen/artgen.js dungeon style <id> --hatch band|full|none --band 1 --numbers on --scale-bar on --compass off --title "…"
node tools/artgen/artgen.js dungeon label <id> "Bone pit" --at 12,9 --kind note       # name: bold · note: italic · area: big spaced capitals
node tools/artgen/artgen.js dungeon symbol <id> stairs --at 11,4 --angle 90            # node tools/artgen/artgen.js dungeon symbols lists the kinds
node tools/artgen/artgen.js dungeon overlay <id> rm label 2 | clear symbols
```
Rooms are numbered in file order on a black badge; set a room's own number or name with `room set`.

## 4. Render and hand over
```
node tools/artgen/artgen.js dungeon render <id> [--format svg|png|both] [--ppu 70] [--layers grid=off,numbers=off,labels=off]
```
`--ppu` is pixels per cell (default 40; 70 for a VTT at 70 px per 5 ft square, more for print). `--layers` turns any of
`rock floors grid doors symbols numbers labels title scale compass` off — e.g. a player copy without numbers. Secret
doors are drawn in every copy; for a player handout, make a copy of the dungeon and set them to `none` there. Give the
user the file paths and show the PNG.

## Readability rules (check every render)
- **Read at a glance.** Clear room shapes, straight corridors, few bends. If it looks busy, use fewer rooms, larger
  spacing, or fewer loops.
- **Numbers sit in open floor,** not on a symbol: move a symbol rather than the number.
- **Few symbols:** what the players interact with (stairs, altars, traps, treasure), not every chair.
- **Short labels;** key details belong in the adventure text, keyed by room number.
- Don't hand-edit the SVG: change `dungeon.json` (or use the commands) and re-render.
