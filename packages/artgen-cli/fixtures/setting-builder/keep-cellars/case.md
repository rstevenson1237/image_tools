# keep-cellars — the Keep's lower level (artgen A5)

format: dungeon 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), `plans/sheet-maps/prototype/to_dungeon.py`; this case is built in artgen from `brief-underlay.md`
artgen: `underlay` and room `fill` (optional fields: the format version is unchanged), see the CHANGELOG

A.12 and A.13, the cellar under the Broken Wheel and the Sally Tunnel, each `fill: cellar` and `origin: tables`, over the same underlay as `keep`
(`../keep/map.json`, the same origin and scale), so the two sheets register.

```sh
node tools/artgen/artgen-maps.js dungeon render --file dungeon.json --format both
```

## Must hold

- Both rooms are drawn dashed, above everything else, and have no wall.
- There is no `walls` list.
