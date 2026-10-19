# frontier — the Frontier at 200 yards a square, with requirements

format: map 1
consumer: setting_builder at a34e7f5c90986c052e960ddf716c214aed658ff1 (main), the last commit artgen holds from it; this case is built in artgen from `brief-constraints.md` (artgen A2)
artgen: the `require` list (an optional field: the format version is unchanged) and `map check`, see the CHANGELOG

The Frontier A to E, 106 x 141 squares at 200 yards, seed 5 (the seed is part of the case: `check` holds at it, and artgen never
reseeds by itself). `gen.rivers` is 2 so that the generator has rivers of its own to keep off the road. The hand placement
of `findings.md` T1.3 was not available when this was built, so the areas below were placed from the outline in the brief
(`BRIEF.md`'s A to E, south to north: B's road comes in from the bottom, A is its end, D lies by the road, C is the wood
between A and E, E is the hills and their stream). Replace them with T1.3's own when setting_builder sends them; the tests
hold the file to what `check` says, not to these coordinates.

| id | kind | asks |
|---|---|---|
| `A-ground` | height | 20 to 60 ft over a disc of 7 squares round A's way in (54, 94) |
| `B-road` | path | a road from the south edge (52, 140.5) to A's way in (54, 98), through 4 points, within 1 square |
| `B-road-clear` | clear | no generated river within 5 squares of that road |
| `C-ground` | terrain | forest, 0.8 or more, in a 9-sided area between A and E |
| `D-ground` | terrain | marsh, 0.7 or more, beside the road |
| `D-low` | height | 0 to 10 ft over the same area (it is a separate entry because an entry is one kind) |
| `E-ground` | terrain | rock, 0.6 or more, in the north |
| `E-hills` | height | 150 to 400 ft over the same area (topo.maxElevation is 450, so rock, which starts at 70 % of it, is 315 ft and up) |
| `E-stream` | path | a stream from (62, 14) down through E to the wood at (60, 53) |

```sh
node tools/artgen/artgen-maps.js map check --file map.json --json
node tools/artgen/artgen-maps.js map render --file map.json --format svg
```

## Must go on holding

- `check` reports every requirement met at the committed seed and exits 0.
- No generated river crosses `B-road-clear`. With that entry taken out, the same file has a generated river inside the strip,
  4.5 squares from the road (so the entry is what keeps it out, not luck).
- C's forest edge is not a straight line: along the edge within 3 squares of C's outline, no run of more than 4 squares
  along one row or column (squares counted as forest when more than half their samples are). The same area painted as
  forest (`paint`) has a run of more than 4, which is what this guards against.
- With `gen.rivers` at 0 the only river is `E-stream`.

## Does not yet draw well

- Rock is a broad plateau with a ragged edge: the hills have no ridges or passes, only the noise the generator already has.
- The road avoids water and takes gentle ground between its points, but never crosses a river by a ford or bridge; where it meets one it runs through.
- The labels A to E are small against 200-yard squares.

## A6, A7

A is also a `castle` symbol, at its label. Rendered `--fit 260x180mm` its mark is 5 mm across and every region label is 9 pt (a `place`'s default) or more.
