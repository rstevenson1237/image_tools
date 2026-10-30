# artgen-runtime

The artgen runtime: plays the packs `artgen export` writes (`pack.json` + atlas PNGs) in a game.
Renderer-agnostic TypeScript core with no dependencies (3.7 KB min+gz, budget 8 KB), plus one adapter per engine as a
separate entry point. Game repos get it **vendored**: `artgen export --runtime` copies the core and the adapters
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
| `light.ts` | the lighting model of lit sprites, once: `PointLight`, `LightRig`, `decodeNormal`, and `shadeTexel`, the reference the shaders are tested against |
| `coords.ts` | `isoToScreen` / `screenToIso` (2:1), `depthKey`, `obliqueToScreen` / `screenToOblique` / `obliqueDepth` |

Angles: x right, y down; `s` faces the viewer. Anchors are frame pixels (feet for standing sprites, centre for top-down
sprites, tiles and effects); mirrored frames flip about the anchor in every adapter. Named anchors (`hand`, `head`,
`blade`…) come from the asset module per frame; `sprite.anchor('hand')` gives this frame's point as an offset from the
sprite's position (pixel centre, unscaled), so trails, sparks and held props stay in the hand when the art is redrawn.
States with `durations` hold frames for their own time (a contact frame); others step at `fps`. Runtime 1.2:
states exported with `sub` smoothing sub-frames keep `sprite.frame` logical (what the animation contract counts) and
step `sprite.sub` through the frames in between; assets with `blend: 'add'` ask the adapter for additive blending.
It also has sprite stacks (`pack.stack`, `stack.ts`), `parallaxTiles` and normal atlases (`loadPack(…, { normals: true })`).
Runtime 1.2.1: `loadPack` warns on the console when a pack carries unapproved drafts (`export --include-drafts`); pass
`onDrafts` to handle them yourself, or `false` to silence it.
Runtime 1.3.0: packs exported with `artgen export --placeholders` carry assets drawn from their placeholder
(`manifest.placeholders`, `asset.placeholder`): `pack.placeholders` lists their ids and `pack.isPlaceholder(id)` tells one apart.
Nothing is logged: a placeholder is intended, and the real art replaces it on a later export under the same animation contract.
Runtime 1.4.0: lit sprites in Pixi.js. `light.ts` (in the core) holds the point-light model and `pixiLitAdapter` in `adapters/pixi.ts` draws sprites with it:

```ts
import { loadPack, type LightRig } from './art/runtime/index.js';
import { pixiLitAdapter } from './art/runtime/adapters/pixi.js';

const rig: LightRig = { ambient: [0.25, 0.25, 0.3], bands: 3,   // bands: 0 = smooth light, n = n pixel-art steps
  lights: [{ x: 120, y: 80, z: 10, color: [1, 0.8, 0.5], intensity: 1.4, radius: 90 }] };   // the lantern; x, y in the parent's space
const pack = await loadPack(Packs.main, pixiLitAdapter({ rig }), { normals: true });   // normals: true loads the normal atlases
const ghoul = pack.sprite(Assets.ghoul, { parent: world });
app.ticker.add(() => { rig.lights[0].x = lantern.x; rig.lights[0].y = lantern.y; });   // mutate the rig; the next frame uses it
```

Sprites whose asset exports normals take the light; others are lit as flat faces toward the viewer; `ambient: [1, 1, 1]` and no lights draws every sprite
unchanged. Up to `MAX_LIGHTS` (8) lights count. Falloff is `(1 − distance / radius)²`, the angle term is `max(0, n · l)` rounded to `bands` steps.

## Adapters (`src/adapters/`)

| Entry | Engine | Nodes | Notes |
|---|---|---|---|
| `pixi.ts` | Pixi.js v8 | `Sprite` | nearest `BufferImageSource` atlases, cached frame textures, flip via `scale.x`, `zIndex` from z (parent made `sortableChildren`), `pixiStrip` → textures for `AnimatedSprite` |
| `three.ts` | three.js | `Sprite` billboard | nearest sRGB `DataTexture`s, frames by UV offset/repeat (flip = negative repeat), sized by `pixelsPerUnit`, `alphaTest` cut-out (default 0.02: translucent shadow pixels draw blended, clear pixels write no depth); `billboardAngle(heading, node, camera)` for camera-relative facing; `tileTexture` for repeating floors and walls; `voxelModel` for `.glb`; **`threeLitAdapter`** (P6d): camera-yawed Lambert quads whose `normalMap` is the frame's rect in the normal atlas, for sprites lit by scene lights |
| `pixi.ts` (`pixiLitAdapter`) | Pixi.js v8, WebGL | `Mesh` (a quad) | **lit sprites** (R6c): a GLSL shader samples the frame's rect of the colour atlas and of the normal atlas and shades each texel with a `LightRig` of point lights (`light.ts`, the same maths as `shadeTexel`); frame, flip, anchor and position are uniforms, so a frame change rebuilds nothing; the game mutates the rig and the next frame uses it; no `setRotation`; **WebGPU is not supported by this adapter** |
| `canvas2d.ts` | Canvas 2D | plain records | reference adapter (UI previews, docs): `Canvas2DLayer.draw(ctx, zoom)` in z order, `drawNode` |

## Adding a target

Implement `RuntimeAdapter<Tex, Node, Parent>` (`loadTexture`, `createNode`, `setFrame`, `setAnchor`, `setPosition`,
`dispose`, optional `attach` / `disposeTexture`) in `src/adapters/<name>.ts` and run the shared contract suite
(`src/adapters/contract.ts`) against it with an inspector — `adapters.test.ts` does this for the three shipped adapters,
the lit Pixi one and a stub written only against the public API. Nothing in the core changes; `artgen export --runtime` picks
the new file up by name.

Tests: `runtime.test.ts` (facing, frames, state machine, autotile, effects, coordinates, swaps, the three fixture packs),
`adapters.test.ts` (contract × 5 + adapter extras), `light.test.ts` (`decodeNormal`, `shadeTexel`), `typed.test.ts` (typed ids), `size.test.ts` (8 KB budget, no imports
outside the core / each adapter's engine). The lit adapter is also checked in a real browser: `npm run accept:lit` (Playwright + Chromium, pixels against `shadeTexel`).
