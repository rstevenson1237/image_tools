// Vendored by `artgen export --runtime` (artgen-runtime 1.0.0). Local edits are detected and kept;
// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.
/**
 * artgen runtime core (W3, SPEC §12): loads exported packs, picks frames (state × facing × frame, mirror-aware
 * facing), resolves autotiles, plays effects, and converts iso/oblique coordinates. Renderer-agnostic and
 * dependency-free: engines plug in through a `RuntimeAdapter` (separate entry points: `./adapters/pixi`,
 * `./adapters/three`, `./adapters/canvas2d`).
 */
export { RUNTIME_VERSION, loadPack, createPack, checkManifest, recolor, Pack, ArtSprite, TileSet, EffectPlayer } from './pack.js';
export type { DecodedImage, LoadOptions, FrameSelect, SpriteOptions, EffectOptions } from './pack.js';
export { facingAngle, chooseFacing, angleDelta, angleOf } from './facing.js';
export type { FacingChoice } from './facing.js';
export { N, NE, E, SE, S, SW, W, NW, BLOB47, neighbourMask, reduceCorners, wang16, blob47, resolveAutotile, cellHash } from './autotile.js';
export { isoToScreen, screenToIso, depthKey, obliqueToScreen, screenToOblique, obliqueDepth } from './coords.js';
export type { IsoTile, ObliqueTile } from './coords.js';
export type { AssetInfo, AssetRef, AtlasImage, FrameRect, PackAsset, PackFrame, PackManifest, PackStateDef, RuntimeAdapter, StateOf, VariantOf } from './types.js';
