# ravine — map.json of E at 10 yards a square

format: map 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), `plans/sheet-maps/prototype/to_map.py`
artgen: 0.10.0 plus the format-version change and a map side limit of 200 (see CHANGELOG), then the `require` list (A2)

Rebuilt for artgen A2: the hand `paint`, `elevate` and `river` edits are now a `require` list, and the ground is shaped to it instead
of painted over. The file is the converter's, with those five edits replaced in artgen by the following (its road edit stays):

- `E-stream`: a stream up the path, `[8,4,8,180]`, 2 squares wide at its mouth, no delta.
- `E-wall-west`, `E-wall-east`: rock at 0.9 or more over x 0 to 4 and x 12 to 16, with `E-wall-west-height` and `E-wall-east-height`: 30 to 40 ft over the same walls. Each has `blend: 3`, because the default blend is `gen.feature` (14) and the gorge is 8 squares wide.
- `gen.rivers` is 0: the generator may not add a river of its own to the gorge (it did, once the walls were no longer painted).

The map is 16x184 squares and the script prints the origin (8.0, 180.0), so the path runs up x = 8 and the walls stand 4 squares
either side of the 8 square gorge.

The first build of this case (hand `paint` and `elevate`) was made from the setting_builder root, with `<game>` the scratch game directory:

```sh
python3 plans/sheet-maps/prototype/to_map.py E <game> 10 \
  "edit|e|river|--points|8,4,8,180|--width|2|--delta|off" \
  "edit|e|paint|--terrain|rock|--poly|0,0,4,0,4,184,0,184" \
  "edit|e|paint|--terrain|rock|--poly|12,0,16,0,16,184,12,184" \
  "edit|e|elevate|--amount|0.6|--poly|0,0,4,0,4,184,0,184" \
  "edit|e|elevate|--amount|0.6|--poly|12,0,16,0,16,184,12,184"
```

and then `node tools/artgen/artgen-maps.js map check --file map.json --json` holds every requirement above. A 1-mile gorge at 10 yards a square is 176
squares long, past the old limit of 120 squares a side, which is why artgen raised it to 200.

## Must hold (A2)

- `check` reports all five requirements met.
- The walls' contours run along the gorge, not across it: on the wall's slope the height changes about twice as fast across the gorge as along it.
- `required` is the `source` of the stream in `map facts` (`river-1`); `generatedRivers` is empty.

## Must go on drawing

- 10 yards per cell.
- A symbol and a label for every location but the route E.1 (E.2 to E.12), each label starting with the location code.
- One road along the stops.

## Facts read back (`map facts`, tested in `src/facts.test.ts`)

- `--at` each of the eleven marks with `--above river`: every mark gives a terrain, a height that is a whole multiple of the 5 ft
  topo interval, a slope band and its height above the river. The five marks on the east wall (x = 12) and the points inside
  either wall report `rock`, because the file requires both walls rock. The three west-wall marks (x = 4, the wall's foot) stand
  above the river; the river's own points are 0 above it.
- No query: the road and the required stream are each a point list from one end of the gorge to the other (y 180 to 4).
- Not so: the marks on the gorge floor (E.4, E.8, E.9, E.3, E.12: x = 4 to 10, at the wall's foot or on the floor) report the generated
  floor, `grass` or `forest`, not `rock` or `water`; the river is a ribbon, not terrain. And `gen.rivers` is 0, so
  `generatedRivers` is empty here (a map that has one is tested in artgen-core).

## Does not yet draw well

- The river, 2 squares wide, fills the gorge floor and leaves the ledges as the only dry ground.
- Symbols are small against 10-yard squares; labels stay readable.
