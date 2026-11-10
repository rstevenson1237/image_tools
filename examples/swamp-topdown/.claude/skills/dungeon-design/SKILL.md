---
name: dungeon-design
description: Design a dungeon level from a concept before drawing it — "a keep with a central shrine, about 20 rooms, fits a 23×23 sheet", "a crypt with a secret route round the tombs" — by choosing layouts (design patterns such as a row of cells off a hall, a spine through a ring hub, an axis of halls, a suite, a secret bypass, a stair vestibule), joining them, laying the level out over many seeds and showing the best three. Use when the user describes what a level is for or how it should feel, rather than handing over rooms and corridors; then hand over to the dungeon-map skill to key, dress and render it.
---

# Designing a dungeon level

The **dungeon-map** skill draws a dungeon. This one comes before it: from a concept to a design, a layout and a shortlist.
The model owns the concept, the choice of layouts, the names and the keying; the engine owns geometry, scoring and checks.
Only the user approves.

## 1. Concept

Ask three things at most, and only what the request leaves open:
- **what it is** (a crypt, a keep, a warren, a lair) and what it is for;
- **size and fit**: a number of rooms, or a sheet to fit ("fits 23×23"); a scale (5 ft squares unless the user says);
- **hard needs**, if any: a central room of a size, dense or spread out, a maze, a secret route, a stair down at the far end.

## 2. Choose layouts

`node tools/artgen/artgen-maps.js dungeon layouts` lists the patterns (bundled, and the project's own in `art/dungeons/layouts/`), with their parts,
parameters and sockets; `--tag hub` narrows them. Pick a few that make the concept's structure, not one per room:

| Layout | What it gives |
|---|---|
| `cell-row` | small rooms in two mirrored rows off a hall, each with a door onto it (`per-row`, `cell`) |
| `spine-ring-hub` | a corridor through a round chamber, with sockets at eight compass points (`ring`, `spine`) |
| `axis-of-halls` | large halls in a row, joined by wide passages (`halls`, `size`) |
| `suite` | a room with a sub-room against one wall |
| `secret-bypass` | a hidden passage between two rooms the main route also reaches |
| `stair-vestibule` | a small room that holds a stair |
| `gatehouse` | a gate passage between two towers, placed exactly (rigid) |

A structure the user shows you on a map they own can become a layout: `node tools/artgen/artgen-maps.js dungeon extract <id> --rooms a,b,c --name x`.

## 3. Write the design

A design is one JSON file (`node tools/artgen/artgen-maps.js schema design --keys`): the layouts it **uses** (with parameters), the rooms each role
holds (**bind**, by the names the level will key them with), rooms and ways of its own (fill between the structures), and
**joins** from socket to socket (`use.socket`) or to a room. Graph settings go in the same file: `width` (the passage width in
cells), `footprint`, `pad` (cells kept clear round each room: give one, 1 or 2, for a level that reads as rooms and corridors),
`passages`, `spokes`, `seed`, `tries`.

```json
{ "id": "K-a", "width": 2, "pad": 1, "footprint": 40, "seed": 1, "tries": 6,
  "uses": [{ "id": "ring", "layout": "spine-ring-hub" }, { "id": "cells", "layout": "cell-row", "params": { "per-row": 3 } }, { "id": "stair", "layout": "stair-vestibule" }],
  "bind": [{ "use": "ring", "role": "hub", "rooms": ["K.1"] }, { "use": "cells", "role": "hall", "rooms": ["K.2"] }],
  "rooms": [{ "id": "K.9", "w": 6, "h": 6 }],
  "joins": [{ "from": "ring.hub-w", "to": "cells.e" }, { "from": "ring.hub-e", "to": "stair.in" }, { "from": "ring.s", "to": "K.9" }] }
```

`node tools/artgen/artgen-maps.js dungeon design --design d.json` expands it and says what it made: the rooms of each use, the sockets left open,
and any room grown because its walls were short for its ways. Joined sockets must face each other and match in width: fix the
design when it says they do not.

## 4. Solve and show three

```
node tools/artgen/artgen-maps.js dungeon layout <id> --design d.json --seeds 12 --keep 3 --sheet art/dungeons/<id>/candidates.png
```

For a level of more than about 20 rooms, add `--nested` (and group the layouts into thematic `blocks` in the design): each
layout is laid out alone, then each block, then the level, the gaps growing until every way routes.

Each seed is scored out of 100 on what `dungeon check` finds (stacked doors, a door off its wall, floor outside the bounds,
passages from one room that cross or run together), ways left unrouted, held bearings strayed and detours. Show the user the
contact sheet with each candidate's score and what it trades off (a tighter level, a cleaner hub, one passage that runs long).
When no seed routes every way: a larger footprint, a `pad`, fewer ways on one room, or `--partial` to see the packing that
routes most and what it could not join.

## 5. Key, dress and approve

Take the chosen file to the **dungeon-map** skill: number the rooms in the order a party meets them (`a` sub-rooms for
suites), dress the focal rooms (pillars in a hall, a stair in the vestibule, secret doors on the bypass), `dungeon check`,
version and review. Only the user approves.
