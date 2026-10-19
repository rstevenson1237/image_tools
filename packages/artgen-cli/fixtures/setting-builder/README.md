# Consumer fixtures

Real files from artgen's consumers, kept so no change breaks them unseen. One folder per consumer, one folder per
case. A case holds the input file as the consumer's converter wrote it and a `case.md` with the consumer's commit, the
exact command it was built with, what the file must go on drawing (the facts the tests hold it to) and what it does not
yet draw well. `case.md` also states the format the file is at (`format: map 1`); the tests parse the file at that version.

The tests (`src/fixtures.test.ts`) check structure, never pixels: a theme, font or symbol may change how a fixture
looks, but never what it states.

A fixture changes only through a brief from its consumer, or through a format bump that migrates it in the same
change (see `src/format.ts` in artgen-core). A failing fixture is never edited just to make it pass.

| Consumer | Cases |
|---|---|
| `setting-builder/` | `warren`, `ravine`, `keep`, `shrine-crypts`, `bad-file`, `frontier`, `frontier-unmet` |
