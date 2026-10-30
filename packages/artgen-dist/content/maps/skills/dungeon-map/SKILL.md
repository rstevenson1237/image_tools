---
name: dungeon-map
description: Make dungeon and lair maps for tabletop RPGs with artgen — a single room (rectangular, round, octagonal, cave-like or any polygon, with exits, a number and a name) or a whole complex of rooms joined by corridors and doors, generated from a seed or laid out by hand. Black and white, hatched rock, thick walls, with an optional 10 ft grid and 5 ft sub-grid, room numbers, labels and symbols (stairs, pillars, altars, traps, chests…). Renders SVG and PNG. Use when the user wants a dungeon, lair, cave, crypt, tomb, keep interior, room or encounter-area map, or wants to change, key or export one.
---

# Dungeon maps

A dungeon is one file, `art/dungeons/<id>/dungeon.json`: settings, **rooms**, the **corridors** that join them, and an
**overlay** of labels and symbols. Every render is rebuilt from it into `art/dungeons/<id>/out/` (gitignored). The user
may also open the same file in the image tools web app (**Dungeon Map**), draw on it and save it back: always re-read
the dungeon (`{{ARTGEN}} dungeon show <id>`) before changing it. CLI: `{{ARTGEN}} dungeon …`; the `artgen` MCP server has
the same operations as `dungeon_*` tools (images come back inline).

Coordinates are **grid cells**, x to the right and y down; one cell is 5 ft. A room's `--at` is its **top-left
corner**. Anywhere a point is asked for you can also give a cell name (`C4` = column C, row 4). Output is always black
and white: white floors with a grid, thick black walls, hatched rock around them.

## 1. Ask, then create
Ask only what changes the map: one room or a complex; roughly how many rooms and how big; built (square rooms,
corridors, doors) or natural (caves); spread out with corridors, or dense (rooms side by side, like a keep's floor); the grid (its size and unit, whether to show a sub-grid at every square, or none). Then one of:
```
{{ARTGEN}} dungeon new <id> --room rect --room-size 8x8 --exits n,e,s:secret,w:none --number 20   # one room
{{ARTGEN}} dungeon new <id> --rooms 10 --size 40x30 --title "Lair of the Ash Wyrm" [--seed n]       # generated
{{ARTGEN}} dungeon new <id> --empty --size 30x24                                                     # by hand
{{ARTGEN}} dungeon render <id>         # SVG + PNG; open the PNG and look at it
```
Room shapes: `rect circle octagon cave poly`. Exits on a single room run off the map edge; give each side a door kind
after a colon (`n:locked`), `:none` for an open passage (default: a plain door), and a note after another colon
(`n:door:Up to the keep`) to fade the exit out under a boxed note saying where it leads.

## 2. Shape the layout
Big changes with the generator; then fix rooms one by one. Render and look after each round.
```
{{ARTGEN}} dungeon gen <id> --seed 7                         # a different layout, same settings (replaces rooms and corridors)
{{ARTGEN}} dungeon gen <id> --rooms 12 --min-size 4 --max-size 9 --caves 0.3 --round 0.1 --loops 0.4 --doors 0.7
{{ARTGEN}} dungeon gen <id> --layout dense --density 0.6          # rooms side by side, doors in their shared walls (a warren, a keep floor)
{{ARTGEN}} dungeon gen <id> --layout blocks --rooms 20            # a few blocks split into rooms, joined by corridors
{{ARTGEN}} dungeon room <id> add rect --at 10,4 --size 6x4 --label "Guard room"
{{ARTGEN}} dungeon room <id> add cave --at 20,12 --size 10x7
{{ARTGEN}} dungeon room <id> add poly --points 2,2,8,2,8,8,5,8,5,5,2,5      # an L-shaped room
{{ARTGEN}} dungeon room <id> move r3 --at 14,6 | set r3 --shape octagon --size 7x7 --number off | rm r3
{{ARTGEN}} dungeon link <id> r1 r2 --doors door,secret                        # door at r1's end, secret door at r2's
{{ARTGEN}} dungeon link <id> r2 r5 --width 2 --route vh                       # 10 ft passage, down then across
{{ARTGEN}} dungeon link <id> r4 41,12                                         # an exit running off the east edge
{{ARTGEN}} dungeon link <id> r4 41,12 --exit "To the river caves (L2, 14)"    # …that fades out, with a boxed note saying where it leads
{{ARTGEN}} dungeon link <id> r1 r4 --from-side s --to-side n --id main      # leave r1 by its south wall, enter r4 by its north
{{ARTGEN}} dungeon link <id> corridor:main r3 --to-side s                    # a T: a corridor off the main one into r3's south wall
{{ARTGEN}} dungeon link <id> r1 r2 --route around                            # along the grid, round the rooms in the way
{{ARTGEN}} dungeon link <id> r4 r7 --style natural --curve smooth --width 2  # a winding cave passage with rough walls
{{ARTGEN}} dungeon door <id> 3 to portcullis | unlink <id> 3
{{ARTGEN}} dungeon connect <id> r3 r4 [--kind secret|open] [--at x,y]          # rooms that touch: a door (or an opening) in their shared wall
{{ARTGEN}} dungeon block <id> add hex --at 2,2 --size 18x16 --split grid --min 4   # one shape split into rooms with doors between (rect|octagon|circle|hex|poly; bsp|rows|cols|grid)
{{ARTGEN}} dungeon block <id> split b1 --seed 9 | block <id> rm b1               # another layout of the same block (other rooms keep their numbers) | remove it
{{ARTGEN}} dungeon link <id> b1 r7 --route around                              # a block id: its room nearest the other end
{{ARTGEN}} dungeon fit <id> --margin 2                                        # crop the map to the rooms
```
Corridors start at room centres: rooms that line up get one straight corridor, others an L-shaped elbow (`--route
hv|vh`, or `--via x,y,…` for your own bends). `--from-side`/`--to-side` (and `--from-offset`, cells along the wall) make a
corridor leave by a given wall; `dungeon check` warns when a corridor runs through a room it does not join: reroute it
with `--route around`. A corridor opens into a room wherever it meets it. Rooms that touch keep the
wall between them; `connect` puts a door or an opening in it (dense layouts: rooms side by side, no corridors). Door kinds: `door secret locked portcullis arch` (or `none`). Gen keeps labels and symbols but
replaces every room and corridor: if the user wants "the same dungeon but …", edit — don't regenerate.

## 3. Grid, numbers, labels and symbols (the follow-up layers)
```
{{ARTGEN}} dungeon grid <id> --size 10 --unit ft --sub on [--clip floor|all]   # a line every 10 ft, a fainter one every square; on the floor (default) or everywhere
{{ARTGEN}} dungeon grid <id> --show off                   # no grid (shorthands: 10 | 5 | 10+5 | none)
{{ARTGEN}} dungeon style <id> --hatch band|full|none --band 1 --numbers on --scale-bar on --compass off --title "…"
{{ARTGEN}} dungeon style <id> --furniture auto            # title, scale bar, compass and legend in a band below the map when they would hide something (outside: always; --furniture-side right)
{{ARTGEN}} dungeon label <id> "Bone pit" --at 12,9 --kind note       # name: bold · note: italic · area: big spaced capitals
{{ARTGEN}} dungeon symbol <id> stairs --at 11,4 --angle 90            # {{ARTGEN}} dungeon symbols lists the kinds
{{ARTGEN}} dungeon label <id> "To the river caves" --at 30,9 --kind note --href caves.svg   # a link (http(s), a relative path or #anchor) in the SVG
{{ARTGEN}} dungeon room <id> set r3 --href "https://wiki.example/keep#A3"                    # the room's number and name link there
{{ARTGEN}} dungeon overlay <id> rm label 2 | clear symbols
```
Rooms are numbered in file order on a black badge; set a room's own number or name with `room set`.

## 4. Render and hand over
```
{{ARTGEN}} dungeon render <id> [--format svg|png|both] [--ppu 70] [--layers grid=off,numbers=off,labels=off]
```
`--ppu` is pixels per cell (default 40; 70 for a VTT at 70 px per 5 ft square, more for print). `--fit 180x260mm` picks the ppu that fits a page instead. `--crop x,y,w,h` renders a window of the sheet, and `--room <id|F.3> [--margin 2]` (repeatable) the window round a room, its doors and the start of its corridors. `--layers` turns any of
`rock floors grid doors symbols numbers labels title scale compass` off — e.g. a player copy without numbers. Secret
doors are drawn in every copy; for a player handout, make a copy of the dungeon and set them to `none` there. Give the
user the file paths and show the PNG.

## Check, then look
`{{ARTGEN}} dungeon check <id>` after every round of changes: errors (a room outline that crosses itself) must be fixed;
each warning (rooms laid over each other, a corridor through a room it does not join or across another, a door that is
never drawn, a symbol under a room number) is most likely a mistake: fix it or know why it stays.

## 5. Brief, versions, review, and the user's approval
A dungeon goes through the same steps as a pixel asset: write what it is for, record each round as a version, review it, show it to the user, and let them decide. **Only the user approves**: never run `approve` yourself (over MCP it needs `user_approved`, and only after they said so in this conversation).
```
{{ARTGEN}} dungeon brief <id> --text "what it is for, in the user's words" --refs refs/coast.png   # before you generate; references are PNGs under art/
{{ARTGEN}} dungeon version <id> --note "what this round changes"   # a frozen copy (dungeon.v1.json, v2, …); refused when nothing changed
{{ARTGEN}} dungeon review <id>        # the render, the one-page data sheet and the references on one sheet
{{ARTGEN}} dungeon review <id> --score 7 --note "labels read" --reviewer art-reviewer   # the same, and logs a score for the version
{{ARTGEN}} dungeon diff <id> v1 v2   # what changed between two versions (no versions named: the latest one against the file now)
{{ARTGEN}} dungeon status             # in-pipeline, revision, final (waiting for the user), approved, stale; with one id also its history
{{ARTGEN}} dungeon approve <id> --note "the user's words"    # only after the user said so
{{ARTGEN}} dungeon feedback <id> --note "the user's words"   # they want changes: rework, version again, review again
```
Look at the review sheet before you show it: room numbers can be read, symbols don't overlap, the legend matches what is drawn, corridors reach the rooms they join, and the lint findings are known. The checks it lists must not fail (an approval is refused while one does); warnings are the user's to weigh. A fresh reviewer subagent scores better than the maker (`--reviewer`). Then show the user the sheet (or point them to **Asset Review** in `{{ARTGEN}} ui`, where the versions sit side by side) and ask: approve, or what to change. A map edited after its approval is `stale` until a new version is recorded and approved.

The **map direction** (`art/map-direction.json`) fixes the theme of each kind of map and the symbols a kind may use, for review sheets and checks: `{{ARTGEN}} map direction --theme map=bw,settlement=color --symbols dungeon=altar,statue`, then `--lock` once the user agrees (locking moves its version up, so maps approved under the old one are `stale`). It never changes what `dungeon render` draws.

## Readability rules (check every render)
- **Read at a glance.** Clear room shapes, straight corridors, few bends. If it looks busy, use fewer rooms, larger
  spacing, or fewer loops.
- **Numbers sit in open floor,** not on a symbol: move a symbol rather than the number.
- **Few symbols:** what the players interact with (stairs, altars, traps, treasure), not every chair.
- **Short labels;** key details belong in the adventure text, keyed by room number.
- Don't hand-edit the SVG: change `dungeon.json` (or use the commands) and re-render.
