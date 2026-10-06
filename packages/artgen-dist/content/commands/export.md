---
description: Export approved assets as atlas packs (pack.json, Aseprite JSON, assets.ts)
argument-hint: [--pack name] [--include-drafts]
---
Run `{{ARTGEN}} export $ARGUMENTS` and report the packs, atlases, the generated `assets.ts` and any asset not exported
(with its status). Drafts are only exported with `--include-drafts`; say so if the user wants a test build.
