# H-a — packed level H.a, thirteen rooms through shared walls and six routed passages

format: dungeon 2
migrated: dungeon format 1 -> 2 (R9 D2): `style.sharedWalls: "rooms"`, what format 1 drew
consumer: rstevenson1237/setting_builder at 81a21529ad962c96d7d75e3f4cf03df43f08bd83 (claude/gallant-bardeen-pt0nlz), reported with `artgen report`
artgen: dev, maps 0.11.0

packed level H.a: the router keeps every passage a cell off every wall but its door's, because no wall is drawn between a corridor and a room (A1); the facts give no corridor path, door wall or floor, so tools/mapcheck.py rebuilds them (A5)

Made by the consumer with:

```sh
python3 tools/maps.py draw
```

Checked with:

```sh
node tools/artgen/artgen-maps.js dungeon check --file dungeon.json --json
```

check: ok
render: not made (--no-render)

## Must go on drawing

- 13 rooms, labelled H.1 to H.13, numbers off; 6 corridors, every one between two rooms with `via`; 10 connections
  through shared walls; `style.sharedWalls: true`, `hatch: full`, `wall: 2.5`.
- Facts (R9 D1): 7 doors, every one on a wall between two floors (`doors[].on: wall`); no overlaps, no unreached rooms, no exits.
  Each corridor states its drawn `path`; the floor grid names every room and corridor.

## Does not yet draw well

- The consumer's router keeps every passage a cell off every wall but its door's, because no wall is drawn between a corridor and a room (A1, R9 D2).
- corridors[1] runs along H-3's south wall for 0.6 cells beside its door (`corridor-along-wall`): the 10 ft passage arrives sideways and its floor touches the wall before it turns in.
- corridors[4] and corridors[5] leave one room and share their first 7.8 cells (`passages-tangle`): allowed, but they read as one passage that parts, not as two.
