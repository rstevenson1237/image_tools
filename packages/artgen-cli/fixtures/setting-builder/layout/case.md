# layout — the ten packed levels of setting_builder as graphs, laid out by `dungeon layout`

format: dungeon 2
consumer: rstevenson1237/setting_builder at 81a21529ad962c96d7d75e3f4cf03df43f08bd83 (claude/gallant-bardeen-pt0nlz), the inputs tools/pack.py takes
artgen: R9 D6

`graphs/<block>.json` is each DANGEROUS block's packing input as setting_builder's `pack_region` builds it (rooms and their
footprints in 5 ft cells, the ways with the bearing to keep and the wall named, BRIEF.md's pack fill, passages, detour and
footprint), exported from its tables. `dungeon.json` is G laid out from `graphs/G-a.json` with the defaults:

```sh
node tools/artgen/artgen-maps.js dungeon layout --file dungeon.json --graph graphs/G-a.json
```

## Must go on drawing

- Every graph lays out at BRIEF.md's footprint: every way a door through a shared wall or a routed passage, none walking past the detour.
- `check` reports no `door-off-wall`, `through-room`, `corridors-cross`, `way-no-passage`, `outside-bounds` or `maze-no-route`; no room is unreached.
- G: 19 rooms, 43% of the 50-cell square.

## Does not yet draw well

- Packing G and H at 12 tries takes 8 to 10 s on one core (the others 1 to 5 s); report 2 asked under 5 s a block.
