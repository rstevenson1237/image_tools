// Vendored by `artgen export --runtime` (artgen-runtime 1.2.1). Local edits are detected and kept;
// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.
/**
 * 2.5D helpers (PLAN P6a): sprite stacks and parallax layers.
 *
 * A **sprite stack** is an asset exported in the `stack` view: its first state holds one top-down slice per voxel
 * layer, bottom first. `StackSprite` draws every slice rotated by the same angle and stepped up the screen by
 * `spacing` px per layer, which reads as a 3D object turning (needs an adapter with `setRotation`).
 *
 * **Parallax** layers are wide, horizontally seamless strips (exported in the `side` view); `parallaxTiles` says where
 * to draw copies of a layer so it covers the view at its depth (0 = fixed to the screen, 1 = moves with the world).
 */
import type { Pack } from './pack.js';
import type { AssetRef } from './types.js';

export interface StackOptions<Parent = unknown> {
  parent?: Parent;
  /** Screen px between slices (default 1). */
  spacing?: number;
  /** State holding the slices (default: the asset's first state). */
  state?: string;
  /** z of the bottom slice; each slice above adds `zStep` (default 0.001), so a stack sorts as one object. */
  zStep?: number;
}

export class StackSprite<Tex = unknown, Node = unknown, Parent = unknown> {
  readonly nodes: Node[] = [];
  readonly spacing: number;
  angle = 0;
  private x = 0;
  private y = 0;
  private z = 0;
  private readonly zStep: number;
  readonly pack: Pack<Tex, Node, Parent>;
  readonly id: string;

  constructor(pack: Pack<Tex, Node, Parent>, ref: AssetRef, o: StackOptions<Parent> = {}) {
    this.pack = pack;
    this.id = typeof ref === 'string' ? ref : ref.id;
    const a = pack.asset(ref), state = o.state ?? Object.keys(a.states)[0], n = a.states[state].frames, ad = pack.adapter;
    if (!ad.setRotation) throw new Error(`${ad.id} adapter cannot rotate nodes: sprite stacks need setRotation`);
    this.spacing = o.spacing ?? 1;
    this.zStep = o.zStep ?? 0.001;
    for (let i = 0; i < n; i++) {
      const f = pack.frame(ref, { state, frame: i }), node = ad.createNode(f.tex);
      ad.setAnchor(node, a.anchor, a.size);
      ad.setFrame(node, f, false);
      if (o.parent !== undefined) ad.attach?.(o.parent, node);
      this.nodes.push(node);
    }
    this.place();
  }

  /** Turn the whole stack (radians, clockwise on screen). */
  rotate(rad: number): this { this.angle = rad; this.place(); return this; }

  at(x: number, y: number, z = 0): this { this.x = x; this.y = y; this.z = z; this.place(); return this; }

  dispose(): void { for (const n of this.nodes) this.pack.adapter.dispose(n); this.nodes.length = 0; }

  private place(): void {
    const ad = this.pack.adapter;
    this.nodes.forEach((n, i) => { ad.setPosition(n, this.x, this.y - i * this.spacing, this.z + i * this.zStep); ad.setRotation!(n, this.angle); });
  }
}

/**
 * x positions (screen px, left edges) of the copies of a `layerWidth`-wide layer that cover a `viewWidth` view when the
 * camera is at `cameraX` and the layer sits at `depth` (0 = screen-fixed sky, 1 = moves with the world).
 */
export function parallaxTiles(cameraX: number, viewWidth: number, layerWidth: number, depth: number): number[] {
  const off = -cameraX * depth, start = off - Math.ceil(off / layerWidth) * layerWidth, out: number[] = [];
  for (let x = start; x < viewWidth; x += layerWidth) out.push(x);
  return out;
}
