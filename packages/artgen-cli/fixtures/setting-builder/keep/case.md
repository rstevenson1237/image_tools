# keep — dungeon.json of A, hatching off

format: dungeon 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), `plans/sheet-maps/prototype/to_dungeon.py`
artgen: 0.10.0 plus the format-version change, installed from this checkout's own build into a scratch game directory

Built from the setting_builder root, with `<game>` the scratch game directory:

```sh
python3 plans/sheet-maps/prototype/to_dungeon.py A <game> A.1=8x2 A.2=2x1 A.3=8x4 A.4=6x4 \
  A.5=6x2 A.6=5x4 A.7=3x2 A.8=16x16 A.9=8x4 A.10=10x5 A.11=12x5 A.12=6x3 A.13=30x1
node tools/artgen/artgen.js dungeon style a --hatch none     # in <game>
```

Room sizes are in 5 ft cells, from each region's `Brief.md`; no table states them yet (setting_builder T3.2 adds them).

## Must go on drawing

- 13 rooms at the sizes above, laid out at their places.
- `hatch: none`.

## Does not yet draw well

A.12 and A.13 lie under A.4 and A.10 and overlap them until Blocks split them by level (setting_builder T3.2). The test
asserts nothing about that overlap.
