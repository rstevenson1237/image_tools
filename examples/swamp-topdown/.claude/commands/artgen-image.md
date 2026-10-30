---
description: Trace a sketch, cut a token, slice a sprite sheet, snap a picture to a palette or rotate pixel art (the image tools)
argument-hint: <what to do with which picture>
---
The image tools work on pictures (PNG files), so they need no project. Pick the one that fits what the user asked for:

- **Trace** a sketch or reference to shapes: `node tools/artgen/artgen.js trace <image.png>` writes an SVG beside it (`--out`, `--invert` for light-on-dark, `--threshold`,
  `--simplify`, `--min-area`; `--holes off` for outlines only). Say how many shapes came out; if it is wrong, change one flag and run it again.
  - Into an asset (art module): `node tools/artgen/artgen.js trace-base <asset> <image.png>` writes the asset's next `base.vN.js` (the shapes as `path` primitives,
    fitted to its frame, in the material nearest the picture's colour; `--mat` picks another). It is the silhouette only: render it, then shape it.
  - Into a map: `node tools/artgen/artgen.js map trace <id> <image.png>` paints the dark shapes as land and their holes as water (`--terrain`, `--hole-terrain`;
    `--replace` swaps the edits of an earlier trace of the same `--origin`).
- **Cut** a token: `node tools/artgen/artgen.js cut <asset|image.png>` crops an approved asset's render (or a picture's subject) to a PNG for a tabletop (`--padding`,
  `--square`, `--scale 4` for a whole-number enlargement). `--fill flat --color #000000` gives the flat silhouette the Shape gate reads. An asset must be
  approved first (`--draft` allows a final that is not approved yet; `--state`, `--facing`, `--frame` pick another cell).
- **Slice** a sprite sheet: `node tools/artgen/artgen.js slice <sheet.png> --cols 4 --rows 2` (or `--cell 32x32`, or `--auto` for loose sprites) writes the cells and
  `slices.json` to a folder beside the sheet.
- **Palette**: `node tools/artgen/artgen.js quantize <image.png> --palette file.hex|#hex,#hex` snaps a picture to a palette (`--n 16` takes the picture's own
  colours, `--save out.gpl` keeps them); `node tools/artgen/artgen.js palette extract <image.png>` (art module) reads the colours into the art direction's interview.
- **Rotate** pixel art without blurring it: `node tools/artgen/artgen.js rotate <image.png> --deg 30` writes `<image>.rotated.png` (RotSprite: no new colours, clockwise on screen, `--pivot x,y`);
  `--steps 8` writes a strip of 8 evenly spaced rotations instead. Quarter turns are exact.

The same tools are in the web app (Image tools: SVG Tracer, VTT Token Cutter, Palette, Sprite Slicer). Show the user the result file and what it holds
before building on it.

Request: $ARGUMENTS
