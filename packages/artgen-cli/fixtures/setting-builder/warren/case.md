# warren — dungeon.json of F

format: dungeon 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), `plans/sheet-maps/prototype/to_dungeon.py`
artgen: 0.10.0 plus the format-version change, installed from this checkout's own build into a scratch game directory

Built from the setting_builder root, with `<game>` the scratch game directory:

```sh
python3 plans/sheet-maps/prototype/to_dungeon.py F <game> F.1=8x1 F.2=8x1 F.3=6x6 F.4=4x3 F.5=3x2
```

Room sizes are in 5 ft cells, from each region's `Brief.md`; no table states them yet (setting_builder T3.2 adds them).
The generated seed (732232) is not part of what the case states.

## Must go on drawing

- One block: five rooms numbered 1-5 at 8x1, 8x1, 6x6, 4x3, 3x2.
- Corridors F.1-F.2 and F.2-F.3 open; F.3-F.4 and F.3-F.5 with doors.
- One corridor from F.1 to a point, labelled `to E.2`.
- Two trap symbols.

## Facts read back (`dungeon facts`, tested in `src/facts.test.ts`)

- Five rooms, four corridors between rooms (F.1-F.2 and F.2-F.3 open, F.3-F.4 and F.3-F.5 with doors), one exit (from F.1 at
  35,5, nearest edge east), no overlaps, no unreached rooms.

## Does not yet draw well

Nothing noted. Single-cell-high rooms (F.1, F.2) are legible but tight at small scale.
