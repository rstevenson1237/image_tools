---
description: Export approved assets as atlas packs (pack.json, Aseprite JSON, assets.ts)
argument-hint: [--pack name] [--include-drafts] [--runtime [--force]]
---
Run `node tools/artgen/artgen.js export $ARGUMENTS` and report the packs, atlases, the generated `assets.ts` and any asset not exported
(with its status). Drafts are only exported with `--include-drafts`; say so if the user wants a test build.
`--runtime` also vendors the artgen runtime + the adapters in `art/artgen.config.json` (`runtime.adapters`) into
`src/art/runtime/`; report the version change and any locally edited runtime files it kept (`--force` overwrites them —
ask first).
