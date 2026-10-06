// Vendored by `artgen export --runtime` (artgen-runtime 1.1.0). Local edits are detected and kept;
// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.
/**
 * The exported pack format (SPEC §12.1, written by `artgen export`) and the adapter interface (SPEC §12.2). The runtime
 * is vendored into game repos on its own, so it keeps its own copy of the manifest types instead of importing
 * artgen-core; a type test keeps the two in step.
 */

/** One exported frame: [atlas, x, y, w, h, facing index, state, frame, variant]. */
export type PackFrame = [number, number, number, number, number, number, string, number, number];

/** Playback of one state; `durations` (ms per frame, e.g. a held contact frame) overrides `fps` when present. */
export interface PackStateDef { frames: number; fps: number; loop: boolean; durations?: number[] }

export interface PackAsset {
  kind: string;
  view: string;
  size: [number, number];
  /** Pixel the node is positioned by (feet for standing sprites, centre for top-down, tiles and effects). */
  anchor: [number, number];
  directions: number;
  facings: string[];
  states: Record<string, PackStateDef>;
  frames: PackFrame[];
  /** Named points (hand, head, weapon tip…) in frame pixels, one entry per `frames` entry, null where a frame lacks it. */
  anchors?: Record<string, ([number, number] | null)[]>;
  /** Param variants (`base`, `v1`, …) first, then palette swaps (keys of `swaps`). */
  variants: string[];
  /** Palette swap variants: hex → hex over the base frames. */
  swaps?: Record<string, Record<string, string>>;
  version: string;
  sourceHash: string;
  tile?: number;
  /** Autotile layout of a tileset's frames (P6b): `wang16` (4-bit edges) or `blob47` (8-bit, corners gated by edges). */
  autotile?: 'wang16' | 'blob47';
  /** Autotile index → frame index within the asset's first state, when the exported order differs from the canonical one. */
  map?: number[];
  draft?: true;
}

export interface PackManifest {
  format: 1;
  pack: string;
  generator: string;
  direction: { id: string; version: number };
  /** Runtime version the pack was exported for (null before P4 exports). */
  runtime: string | null;
  atlases: string[];
  assets: Record<string, PackAsset>;
  drafts?: string[];
}

/** Decoded atlas pixels (straight-alpha RGBA, rows top to bottom). `swap` names the palette swap it was recoloured with. */
export interface AtlasImage {
  name: string;
  index: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  swap?: string;
}

/** A frame inside a loaded atlas texture. */
export interface FrameRect<Tex> { tex: Tex; atlas: AtlasImage; x: number; y: number; w: number; h: number }

/**
 * What an engine target implements (SPEC §12.2, D3). The core never touches engine objects: it picks frames and calls
 * these. New targets are new adapters; nothing in the core changes.
 */
export interface RuntimeAdapter<Tex = unknown, Node = unknown, Parent = unknown> {
  readonly id: string;
  /** Upload an atlas: nearest filtering, no mipmaps. */
  loadTexture(atlas: AtlasImage): Tex | Promise<Tex>;
  /** A drawable for one sprite (sprite / billboard / canvas record). */
  createNode(tex: Tex): Node;
  /** Show a frame; `flipX` mirrors it about the anchor (facings the pack only has mirrored). */
  setFrame(node: Node, frame: FrameRect<Tex>, flipX: boolean): void;
  /** Anchor in frame pixels; `size` is the frame size. */
  setAnchor(node: Node, anchor: readonly [number, number], size: readonly [number, number]): void;
  /** Place the node; `z` is the adapter's depth (zIndex in 2D, world z in 3D). */
  setPosition(node: Node, x: number, y: number, z?: number): void;
  /** Add the node to a scene parent (effects spawned by the runtime use this). */
  attach?(parent: Parent, node: Node): void;
  /** Remove the node from its parent and free it. */
  dispose(node: Node): void;
  disposeTexture?(tex: Tex): void;
}

/** Anything that names an asset: its id, or an entry of the generated `Assets` (typed ids). */
export type AssetRef = string | { readonly id: string };

/** An entry of the generated `assets.ts`, used to type states and variants. */
export interface AssetInfo { readonly id: string; readonly states: readonly string[]; readonly variants: readonly string[]; readonly anchors?: readonly string[] }

export type StateOf<A> = A extends { readonly states: readonly (infer S)[] } ? S & string : string;
export type VariantOf<A> = A extends { readonly variants: readonly (infer V)[] } ? V & string : string;
export type AnchorOf<A> = A extends { readonly anchors: readonly (infer N)[] } ? N & string : string;
