# artgen (Python client)

A thin Python client for [artgen](../../README.md#artgen-quickstart), the pixel-art pipeline in this repo. It doesn't
reimplement anything: each call runs the artgen CLI with `--json` in a game repo and returns the parsed
answer as a dict, with the PNGs it wrote available as Pillow images. A `session()` keeps the artgen MCP server open
for bulk work.

Needs Node 20+ and a game repo with artgen installed (`tools/artgen/artgen.js`, the committed install), or
`ARTGEN_CLI` pointing at an `artgen.js`.

```
pip install -e python/artgen          # from a clone of this repo; not on PyPI yet
```

```python
from artgen import Artgen

ag = Artgen("path/to/game")                     # finds tools/artgen/artgen.js
tex = ag.texture("stone", size=32, seed=7)      # tile, normal map, 3×3 preview + seam / repetition metrics
tex.preview.save("stone-preview.png")

sheet = ag.review("goblin")                     # the review sheet of the latest version (logged to the ledger)
sheet.sheet.show()
r = ag.render("goblin", version="finish.v1")    # strip + gate checks
print(r.passed, [c["id"] for c in r["checks"] if c["status"] == "fail"])

fx = ag.fx("sparks", size=24, frames=6)         # strip, onion skin, fx.gif
ag.status()                                     # every brief: brief → in-pipeline → final → approved → exported
ag.export(include_drafts=True)                  # atlases + pack.json + assets.ts
ag.analytics(across=["../game-a", "../game-b"]) # pooled budget / model recommendations (analytics v2)

with ag.session() as s:                         # one MCP server process for many calls (~6× faster per call)
    tiles = [s.call("texture", material=m, size=32).images[0] for m in ("stone", "wood", "brick")]
```

Every CLI command is reachable through `ag.run("<command>", ...args)`; the named methods cover the common ones
(`direction`, `status`, `briefs`, `brief_add`, `make`, `render`, `review`, `score`, `variants`, `gallery`, `feedback`,
`approve`, `export`, `restyle`, `texture`, `materials`, `fx`, `presets`, `anim`, `analytics`). Errors raise
`ArtgenError` with the CLI's message. `approve` and `feedback` record the **user's** decisions — call them for a
person, never on your own.

Example: [`examples/artgen-quickstart.ipynb`](examples/artgen-quickstart.ipynb) (a texture, a material board laid out
with Pillow, a review sheet, an effect) on a scratch copy of the `iso-dungeon` fixture.

Tests: `pip install -e 'python/artgen[test]' && python -m pytest python/artgen` (after `npm ci`; they run the CLI from
this repo's sources, or `ARTGEN_CLI`).

Publishing: `pyproject.toml` is ready; the release workflow attaches the sdist and wheel to the GitHub release, and
nothing goes to PyPI until the owner says so. The version moves in lockstep with `artgen-dist`
(`scripts/artgen-release.mjs`).
