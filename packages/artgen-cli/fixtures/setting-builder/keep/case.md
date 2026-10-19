# keep — the Keep drawn as a fort plan (artgen A5)

format: dungeon 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), `plans/sheet-maps/prototype/to_dungeon.py`; this case is built in artgen from `brief-underlay.md` (artgen A5, with A6's `dais` and `gate`)
artgen: `underlay`, `walls` and room `fill` (optional fields: the format version is unchanged), see the CHANGELOG

The upper level of A: A.1 to A.11 (A.12 and A.13 are in `keep-cellars`; the first, flat drawing of all thirteen is `keep-flat`). Built from `keep-flat`
with the command below, then edited by hand in artgen as the brief says:

```sh
node tools/artgen/artgen-maps.js dungeon render --file dungeon.json --format both
```

- Rooms: A.8 is a `yard`, the rest `building`. Every entry carries `origin: tables`.
- `underlay`: `map.json`, a 66 x 54 square map at 10 ft a square (the Keep sheet's extent, 220 by 180 yards), at origin (4, 8) and 0.5 map
  units a cell (a 5 ft cell on a 10 ft sheet). The map has a rise (an `elevate` disc) under the keep, a wood (a `forest` paint) north of
  the postern, and a road from the west edge to A.1's centre (7, 28), which is the gate's cell (1, 40) at the sheet.
- `walls`: one wall round A.1 to A.11, `inset` 1 cell, 1 cell thick; round towers 3 cells across at every corner of the hull; a `gate` at A.1 (with a
  tower each side) and a `postern` at A.2 (none).
- A.10 has a `dais` (the symbol, 4 cells across), and `legend` is on so the key lists it.
- Hatching is off (`hatch: none`), so the underlay shows between the buildings.

Nudged by hand until setting_builder T4.6 sets each building's place with its footprint (`findings.md`): A.4 moved from x = 3 to x = 2, so the hull's
west side runs straight from A.3 to A.4 and the gate stands on a straight wall, not at a corner. A.12 (in `keep-cellars`) moved with it.

## Must hold (the tests, `src/underlay.test.ts` and `src/fixtures.test.ts`)

- The wall encloses every upper room, and the towers stand at every corner of the hull.
- Two gates, the main one (A.1) with two towers and the postern (A.2) with none.
- The road reaches the main gate, and ends at A.1.
- A.8 is `yard`: no wall and no fill of its own, so the underlay shows through it.
- Rendered twice it is the same, in SVG and in PNG.

## Does not yet draw well

- Two corner towers stand 2.4 cells apart at the north, where the hull is a short edge round the postern; they touch.
- Building tone and the ridge line are plain; no yards, lanes or lots are drawn (`spec.md` 8.2).
