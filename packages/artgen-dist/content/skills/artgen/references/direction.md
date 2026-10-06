# direction.json and colour tokens

| Field | Use in assets |
|---|---|
| `palette.ramps.<role>` | `ctx.dir.pal.<role>` (lightest first). Roles: skin hair cloth leather metal wood stone dirt grass accent glow |
| `palette.materials` | aliases: `mat: 'steel'` → metal ramp, `'gold'` → accent, `'foliage'` → grass, `'fx'` → glow |
| `palette.perKind` / `perKindMax` | ramps and colour count each kind may use (the gate checks both) |
| `palette.outline`, `palette.shadow` | `'outline'` token; shadows come from proc layers |
| `scale.<kind>` | frame size; `brief.size` names a key; `scale.proportions.headRatio` for characters |
| `camera` | `view`, `light` [x, y, z] (z toward viewer; [-1,-1,1] = upper-left), `directions`, `pixelScale` |
| `line` | `outer` dark|selout|none (the engine draws it), `inner` none|selective|all (underlays/ink), `weight` |
| `shading` | `bands`, `hueShift`, `dither` none|bayer2|bayer4|noise, `highlight` |
| `pipeline` | `revisionPasses`, `finishPass`, `raster` (directMaxPx, ss), default `procedural` layers |
| `background` | the game's background colour (sheets and context panels) |
| `rules.do` / `rules.dont` | read them; reviewers check them |

Tokens: `'outline'`, `'shadow'`, `'<ramp>'` (middle step), `'<ramp>.<i>'`, or a material name. Never a hex (R11).
