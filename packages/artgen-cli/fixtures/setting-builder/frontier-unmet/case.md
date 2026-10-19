# frontier-unmet — frontier with C asking for rock as well as forest

format: map 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), the last commit artgen holds from it; built in artgen from `brief-constraints.md` (artgen A2)
artgen: the `require` list and `map check`, see the CHANGELOG

`frontier` with one entry added, `C-rock`: rock at 0.9 over the same area as `C-ground`'s forest. Ground cannot be both. Rock
follows height and forest follows moisture, so the generator raises the area to rock and `C-ground` loses; `C-rock` is met. (The
brief says "C needing `rock` at 0.9 over the same area as its forest" and "names `C-ground` alone"; this is how artgen reads
the two together. If setting_builder meant C-ground itself changed to rock, send that file: it will be met, and the
case changes with it.)

```sh
node tools/artgen/artgen-maps.js map check --file map.json --json
```

## Must go on failing

- `check` exits non-zero and names `C-ground` alone as unmet (`unmet` is `["C-ground"]`); every other requirement, `C-rock` included, is met.
- Nothing is reseeded and the file is not changed.

## Does not yet draw well

Nothing to draw well: it is a file to be refused. It renders as `frontier` does, with a rock plateau where C's wood was.
