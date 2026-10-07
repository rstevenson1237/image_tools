<script lang="ts">
  /**
   * Nearest-neighbour preview of a sprite at an integer zoom, on a checkerboard, a flat background or an in-context
   * backdrop (iso floor; tiles repeated 3×3 so seams show). With `onregion`, dragging marks a region in sprite pixels
   * (Asset Review's pinned feedback notes); `pins` draws regions already noted.
   */
  import { drawChecker, imgCanvas, type Img, type Region } from './pixels';

  interface Props {
    img: Img;
    scale?: number;
    /** 'checker' or a CSS colour (the game background). */
    background?: string;
    /** Drawn under the sprite, centred (3× the sprite's size for the iso floor). */
    context?: Img;
    tiled?: boolean;
    /** Drawn over the sprite (diff masks). */
    overlay?: Img;
    pins?: { region: Region; label?: string }[];
    onregion?: (r: Region) => void;
    label?: string;
  }

  let { img, scale = 4, background = 'checker', context, tiled = false, overlay, pins = [], onregion, label }: Props = $props();

  let canvas: HTMLCanvasElement;
  let drag = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const reps = $derived(tiled ? 3 : 1);
  const cw = $derived((context ? Math.max(context.w, img.w * reps) : img.w * reps) * scale);
  const ch = $derived((context ? Math.max(context.h, img.h * reps) : img.h * reps) * scale);
  /** Top-left of the (centre) sprite in canvas pixels. */
  const ox = $derived(Math.floor((cw - img.w * scale) / 2 / scale) * scale);
  const oy = $derived(Math.floor((ch - img.h * scale) / 2 / scale) * scale);

  $effect(() => {
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    if (background === 'checker') drawChecker(ctx, cw, ch);
    else { ctx.fillStyle = background; ctx.fillRect(0, 0, cw, ch); }
    if (context) {
      const c = imgCanvas(context);
      ctx.drawImage(c, Math.floor((cw - context.w * scale) / 2), Math.floor((ch - context.h * scale) / 2), context.w * scale, context.h * scale);
    }
    const s = imgCanvas(img);
    for (let j = 0; j < reps; j++) for (let i = 0; i < reps; i++)
      ctx.drawImage(s, ox + (i - (reps >> 1)) * img.w * scale, oy + (j - (reps >> 1)) * img.h * scale, img.w * scale, img.h * scale);
    if (overlay) ctx.drawImage(imgCanvas(overlay), ox, oy, overlay.w * scale, overlay.h * scale);
    if (tiled) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(ox + 0.5, oy + 0.5, img.w * scale - 1, img.h * scale - 1); }
    ctx.lineWidth = 2;
    for (const p of pins) box(ctx, p.region, '#ffd166', p.label);
    if (drag) box(ctx, norm(drag), '#6ea8fe');
  });

  function box(ctx: CanvasRenderingContext2D, [x, y, w, h]: Region, color: string, text?: string) {
    ctx.strokeStyle = color;
    ctx.strokeRect(ox + x * scale + 1, oy + y * scale + 1, w * scale - 2, h * scale - 2);
    if (text) {
      ctx.fillStyle = color;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(text, ox + x * scale + 3, oy + y * scale - 3 < 10 ? oy + (y + h) * scale + 12 : oy + y * scale - 3);
    }
  }

  const norm = (d: { x0: number; y0: number; x1: number; y1: number }): Region => {
    const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1);
    return [x, y, Math.abs(d.x1 - d.x0) + 1, Math.abs(d.y1 - d.y0) + 1];
  };

  /** Sprite pixel under the pointer (tiled: wrapped into the sprite). */
  function at(e: PointerEvent): [number, number] {
    const r = canvas.getBoundingClientRect(), k = canvas.width / r.width;
    let x = Math.floor(((e.clientX - r.left) * k - ox) / scale), y = Math.floor(((e.clientY - r.top) * k - oy) / scale);
    if (tiled) { x = ((x % img.w) + img.w) % img.w; y = ((y % img.h) + img.h) % img.h; }
    return [Math.max(0, Math.min(img.w - 1, x)), Math.max(0, Math.min(img.h - 1, y))];
  }

  function down(e: PointerEvent) {
    if (!onregion || e.button !== 0) return;
    const [x, y] = at(e);
    drag = { x0: x, y0: y, x1: x, y1: y };
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    const [x, y] = at(e);
    drag = { ...drag, x1: x, y1: y };
  }
  function up() {
    if (!drag) return;
    const r = norm(drag);
    drag = null;
    onregion?.(r);
  }
</script>

<figure class:selectable={!!onregion}>
  <canvas
    bind:this={canvas}
    width={cw}
    height={ch}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={() => (drag = null)}
    aria-label={label ?? 'sprite preview'}
  ></canvas>
  {#if label}<figcaption>{label}</figcaption>{/if}
</figure>

<style>
  figure {
    margin: 0;
    display: inline-flex;
    flex-direction: column;
    gap: 0.25rem;
    max-width: 100%;
  }
  canvas {
    image-rendering: pixelated;
    border: 1px solid var(--border);
    border-radius: 4px;
    max-width: 100%;
  }
  .selectable canvas {
    cursor: crosshair;
    touch-action: none;
  }
  figcaption {
    font-size: 0.75rem;
    color: var(--text-dim);
  }
</style>
