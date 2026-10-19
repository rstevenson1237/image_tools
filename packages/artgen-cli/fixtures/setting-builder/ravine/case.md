# ravine — map.json of E at 10 yards a square

format: map 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), `plans/sheet-maps/prototype/to_map.py`
artgen: 0.10.0 plus the format-version change and a map side limit of 200 (see CHANGELOG), installed from this checkout's own build into a scratch game directory

Built from the setting_builder root, with `<game>` the scratch game directory. The map is 16x184 squares and the
script prints the origin (8.0, 180.0), so the path runs up x = 8 and the walls stand 4 squares either side of the 8
square gorge. The hand edits are the `<edits>` arguments (each is one `map` command, fields split by `|`):

```sh
python3 plans/sheet-maps/prototype/to_map.py E <game> 10 \
  "edit|e|river|--points|8,4,8,180|--width|2|--delta|off" \
  "edit|e|paint|--terrain|rock|--poly|0,0,4,0,4,184,0,184" \
  "edit|e|paint|--terrain|rock|--poly|12,0,16,0,16,184,12,184" \
  "edit|e|elevate|--amount|0.6|--poly|0,0,4,0,4,184,0,184" \
  "edit|e|elevate|--amount|0.6|--poly|12,0,16,0,16,184,12,184"
```

The ground is hand-painted because no table states any. A 1-mile gorge at 10 yards a square is 176 squares long, past
the old limit of 120 squares a side, which is why artgen raised it to 200.

## Must go on drawing

- 10 yards per cell.
- A symbol and a label for every location but the route E.1 (E.2 to E.12), each label starting with the location code.
- One road along the stops.

## Facts read back (`map facts`, tested in `src/facts.test.ts`)

- `--at` each of the eleven marks with `--above river`: every mark gives a terrain, a height that is a whole multiple of the 5 ft
  topo interval, a slope band and its height above the river. The five marks on the east wall (x = 12) and the points inside
  either wall report `rock`, because the file paints both walls rock. The three west-wall marks (x = 4, the wall's foot) stand
  above the river; the river's own points are 0 above it.
- No query: the road and the river the edits drew are each a point list from one end of the gorge to the other (y 180 to 4).
- Not so: the marks on the gorge floor (E.4, E.8, E.9, E.3, E.12: x = 4 to 10, at the wall's foot or on the floor) report the generated
  floor, `grass` or `forest`, not `rock` or `water`; the river is a ribbon, not terrain. And `gen.rivers` is 1, but the generator
  traces no river on this map, so `generatedRivers` is empty here (a map that has one is tested in artgen-core).

## Does not yet draw well

- The river, 2 squares wide, fills the gorge floor and leaves the ledges as the only dry ground.
- Symbols are small against 10-yard squares; labels stay readable.
