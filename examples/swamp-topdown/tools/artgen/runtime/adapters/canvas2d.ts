/**
 * Canvas 2D adapter — the reference target (SPEC §12.2): used by the image tools UI previews, docs and the adapter
 * contract tests. Nodes are plain records drawn by a `Canvas2DLayer` (sorted by z) or `drawNode`.
 */
import type { AtlasImage, FrameRect, RuntimeAdapter } from '../types.js';

/** The bits of a canvas this adapter uses (HTMLCanvasElement and OffscreenCanvas both fit). */
export interface CanvasLike {
  width: number;
  height: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContext(kind: '2d'): any;
}

/** The bits of a 2D context `drawNode` uses. */
export interface Context2DLike {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  drawImage(img: CanvasLike, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  imageSmoothingEnabled: boolean;
}

export interface Canvas2DNode {
  tex: CanvasLike;
  frame: FrameRect<CanvasLike> | null;
  flipX: boolean;
  anchor: [number, number];
  x: number;
  y: number;
  z: number;
  visible: boolean;
  layer: Canvas2DLayer | null;
}

/** A draw list: nodes drawn in z order (stable for equal z). */
export class Canvas2DLayer {
  readonly nodes: Canvas2DNode[] = [];
  add(n: Canvas2DNode): void { n.layer?.remove(n); n.layer = this; this.nodes.push(n); }
  remove(n: Canvas2DNode): void { const i = this.nodes.indexOf(n); if (i >= 0) this.nodes.splice(i, 1); n.layer = null; }
  /** Draw every node; `scale` is an integer pixel zoom, (ox, oy) a screen offset in pixels. */
  draw(ctx: Context2DLike, scale = 1, ox = 0, oy = 0): void {
    const order = this.nodes.map((n, i) => [n, i] as const).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]);
    for (const [n] of order) drawNode(ctx, n, scale, ox, oy);
  }
}

/** Draw one node with nearest-neighbour scaling; flipped nodes mirror about their anchor. */
export function drawNode(ctx: Context2DLike, n: Canvas2DNode, scale = 1, ox = 0, oy = 0): void {
  if (!n.frame || !n.visible) return;
  const { x, y, w, h } = n.frame, [ax, ay] = n.anchor;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(ox + n.x * scale), Math.round(oy + n.y * scale));
  ctx.scale(n.flipX ? -scale : scale, scale);
  ctx.drawImage(n.tex, x, y, w, h, -ax, -ay, w, h);
  ctx.restore();
}

export interface Canvas2DAdapterOptions {
  /** Canvas factory (default: OffscreenCanvas, else a DOM canvas). */
  createCanvas?: (w: number, h: number) => CanvasLike;
}

function defaultCanvas(w: number, h: number): CanvasLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g.OffscreenCanvas) return new g.OffscreenCanvas(w, h);
  const c = g.document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvas2dAdapter(opts: Canvas2DAdapterOptions = {}): RuntimeAdapter<CanvasLike, Canvas2DNode, Canvas2DLayer> {
  const make = opts.createCanvas ?? defaultCanvas;
  return {
    id: 'canvas2d',
    loadTexture(a: AtlasImage) {
      const c = make(a.width, a.height), ctx = c.getContext('2d');
      const img = ctx.createImageData(a.width, a.height);
      img.data.set(a.data);
      ctx.putImageData(img, 0, 0);
      return c;
    },
    createNode: tex => ({ tex, frame: null, flipX: false, anchor: [0, 0], x: 0, y: 0, z: 0, visible: true, layer: null }),
    setFrame(n, f, flipX) { n.tex = f.tex; n.frame = f; n.flipX = flipX; },
    setAnchor(n, a) { n.anchor = [a[0], a[1]]; },
    setPosition(n, x, y, z) { n.x = x; n.y = y; if (z !== undefined) n.z = z; },
    attach: (layer, n) => layer.add(n),
    dispose(n) { n.layer?.remove(n); n.frame = null; },
  };
}
