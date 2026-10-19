# shrine-crypts — dungeon.json of M's crypt block

format: dungeon 1
consumer: setting_builder at 22da126ab7051ac0120beacca8f7c8630709204a (main), written by hand from `setting/region/M/Connections.md` and `setting/region/M/Brief.md`
artgen: 0.10.0 plus path mode (`--file`) and `dungeon check`

This case is the file as setting_builder's `tools/maps.py` will write it whole, with no converter and no project:

```sh
node tools/artgen/artgen-maps.js dungeon check --file dungeon.json --json
node tools/artgen/artgen-maps.js dungeon fit --file dungeon.json --json
node tools/artgen/artgen-maps.js dungeon render --file dungeon.json --format svg --json
```

Room sizes are in 5 ft cells from the Brief's text (M.6 40 by 4 ft, M.7 60 by 20, M.8 70 by 20, M.9 30 across, M.13
10 square); no table states them yet (setting_builder T3.2 adds them). The rooms are placed schematically from the
Connections (north is up); the distances in the text are between rooms, and the placement trims them to fit one sheet.
`fit` moves the block to the map's corner and sets its size.

## Must go on drawing

- Five rooms: M.6 to M.9 and M.13, numbered 6 to 9 and 13.
- Corridors M.6-M.7, M.7-M.8, M.7-M.9, and M.13-M.8 with a secret door at the M.8 end.
- Three exits, each a corridor to a point with a label: `up to M.2` (from M.6), `up to M.10` (from M.9), `down to L.5` (from M.13).
- `check` reports no errors, before and after `fit`.

## Does not yet draw well

- The 2 by 2 passage landing (M.13) is small beside the 14 by 4 niches gallery.
- The exits are still plain corridor stubs with a note; the stairs themselves are the two symbols below (A6).

## Stairs (artgen A6)

M.6's end of the way up is `stairs-up` at the end of its stub (20, 30.5), angle 180 (it climbs west, toward M.2), and M.13's is `stairs-down` at (-2, 31),
angle 90 (it falls south, toward L.5). The two symbols differ in the SVG, and each points its `angle`.

## Hand entries and origins (artgen A8)

For `sync`, every room and corridor is `origin: tables`; the case adds nothing to the file. A sync test makes M.8 cover a hand label and holds that the
label is reported as inside the room.
