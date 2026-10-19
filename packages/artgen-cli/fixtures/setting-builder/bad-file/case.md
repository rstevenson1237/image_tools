# bad-file — warren with two mistakes

format: dungeon 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), `warren` altered by hand to be invalid
artgen: 0.10.0 plus path mode (`--file`) and `dungeon check`

`warren` with a corridor from `r3` to a room `r9` that does not exist, and room `r5` made 0 cells wide.

```sh
node tools/artgen/artgen-maps.js dungeon check --file dungeon.json --json
```

## Must go on failing

- `check` exits non-zero and lists both errors by JSON path: `corridors[5].to.room` and `rooms[4].w`.
- The file is not changed and nothing is rendered.

## Does not yet draw well

Not drawn: an invalid file is refused.
