# artgen-runtime

The W3 runtime (PLAN P4, SPEC §12): plays the packs `artgen export` writes (`pack.json` + atlas PNGs) in a game.
Renderer-agnostic TypeScript core with no dependencies (3.7 KB min+gz, budget 8 KB), plus one adapter per engine as a
separate entry point. Game repos get it **vendored** (D4): `artgen export --runtime` copies the core and the adapters
listed in `art/artgen.config.json` (`runtime.adapters`) into `src/art/runtime/`, stamped in `runtime.json`.

```ts
import { loadPack, depthKey, isoToScreen } from './art/runtime/index.js';
import { pixiAdapter } from './art/runtime/adapters/pixi.js';
import { Assets, Packs } from './art/assets';          // generated typed ids

const pack = await loadPack(Packs.main, pixiAdapter());
const hero = pack.sprite(Assets.hero, { state: 'walk', parent: world });  // states and variants are typed
hero.faceToward(dx, dy).at(x, y, depthKey(tx, ty)).update(dtMs);         // nearest facing (mirror-aware)
const floor = pack.tiles(Assets.floor);
floor.node(x, y, { index: floor.resolve(mask), variant: floor.pick(tx, ty), parent });
const sparks = pack.effect(Assets.spark, { parent: world }); sparks.spawn(x, y); sparks.update(dtMs);
```

## Core (`src/`)

| Module | What it holds |
|---|---|
| `types.ts` | the `pack.json` types (kept in step with artgen-core by a type test), `RuntimeAdapter`, `AssetRef`, `StateOf` / `VariantOf` / `AnchorOf` |
| `pack.ts` | `loadPack` / `createPack` (format + runtime-major check), `Pack` (frame lookup, named anchors per frame, palette swaps as recoloured atlases, `pixels`), `ArtSprite` (state × facing × frame, fps or per-frame durations (`frameAt`), loop, speed; `anchor(name)` relative to the sprite, mirrored when flipped; touches the node only when the frame changes), `TileSet` (autotile resolve, variant pick, tile nodes), `EffectPlayer` (spawn, update, dispose finished one-shots; `loop` override) |
| `facing.ts` | screen angles (e = 0, s = π/2), `chooseFacing`: nearest exported facing, else a mirrored one (`flipX`) |
| `autotile.ts` | 8-bit neighbour masks, `wang16`, `blob47` (corners gated by edges; 47 canonical masks), `cellHash` |
| `coords.ts` | `isoToScreen` / `screenToIso` (2:1), `depthKey`, `obliqueToScreen` / `screenToOblique` / `obliqueDepth` |

Angles: x right, y down; `s` faces the viewer. Anchors are frame pixels (feet for standing sprites, centre for top-down
sprites, tiles and effects); mirrored frames flip about the anchor in every adapter. Named anchors (`hand`, `head`,
`blade`…) come from the asset module per frame; `sprite.anchor('hand')` gives this frame's point as an offset from the
sprite's position (pixel centre, unscaled), so trails, sparks and held props stay in the hand when the art is redrawn.
States with `durations` hold frames for their own time (a contact frame); others step at `fps`.

## Adapters (`src/adapters/`)

| Entry | Engine | Nodes | Notes |
|---|---|---|---|
| `pixi.ts` | Pixi.js v8 | `Sprite` | nearest `BufferImageSource` atlases, cached frame textures, flip via `scale.x`, `zIndex` from z (parent made `sortableChildren`), `pixiStrip` → textures for `AnimatedSprite` |
| `three.ts` | three.js | `Sprite` billboard | nearest sRGB `DataTexture`s, frames by UV offset/repeat (flip = negative repeat), sized by `pixelsPerUnit`, `alphaTest` cut-out; `billboardAngle(heading, node, camera)` for camera-relative facing; `tileTexture` for repeating floors and walls |
| `canvas2d.ts` | Canvas 2D | plain records | reference adapter (UI previews, docs): `Canvas2DLayer.draw(ctx, zoom)` in z order, `drawNode` |

## Adding a target

Implement `RuntimeAdapter<Tex, Node, Parent>` (`loadTexture`, `createNode`, `setFrame`, `setAnchor`, `setPosition`,
`dispose`, optional `attach` / `disposeTexture`) in `src/adapters/<name>.ts` and run the shared contract suite
(`src/adapters/contract.ts`) against it with an inspector — `adapters.test.ts` does this for the three shipped adapters
and a stub fourth one written only against the public API. Nothing in the core changes; `artgen export --runtime` picks
the new file up by name.

Tests: `runtime.test.ts` (facing, frames, state machine, autotile, effects, coordinates, swaps, the three fixture packs),
`adapters.test.ts` (contract × 4 + adapter extras), `typed.test.ts` (typed ids), `size.test.ts` (8 KB budget, no imports
outside the core / each adapter's engine).
