<script lang="ts">
  /**
   * The map on screen: the rendered SVG with zoom (wheel) and pan (drag with the pan tool, or the middle button), and a
   * pointer layer in map units on top — brush strokes, clicks and the line being drawn. Only the view lives here; every
   * change goes back to the tool as map coordinates.
   */
  import type { MapTool } from './store.svelte';

  interface Props {
    svg: string;
    cols: number;
    rows: number;
    ppu: number;
    tool: MapTool;
    /** Brush radius in map units. */
    brush: number;
    /** River / road points placed so far (x, y pairs). */
    pending: number[];
    onstroke: (pts: number[]) => void;
    onpoint: (x: number, y: number) => void;
    onfinish: () => void;
  }
  let { svg, cols, rows, ppu, tool, brush, pending, onstroke, onpoint, onfinish }: Props = $props();

  const BRUSH: MapTool[] = ['paint', 'raise', 'lower'];
  let box = $state<HTMLDivElement>();
  let scale = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  let cursor = $state<[number, number] | null>(null);
  let stroke = $state<number[]>([]);
  let drag: { mode: 'pan' | 'brush'; x: number; y: number; tx: number; ty: number } | null = null;
  let fitted = '';

  const W = $derived(cols * ppu);
  const H = $derived(rows * ppu);

  /** Fit the map in the view when its size changes. */
  $effect(() => {
    const key = `${W}x${H}`;
    if (!box || key === fitted) return;
    fitted = key;
    fit();
  });

  export function fit(): void {
    if (!box) return;
    const r = box.getBoundingClientRect();
    scale = Math.min((r.width - 24) / W, (r.height - 24) / H, 2);
    tx = (r.width - W * scale) / 2;
    ty = (r.height - H * scale) / 2;
  }

  function toMap(e: PointerEvent | MouseEvent): [number, number] {
    const r = box!.getBoundingClientRect();
    return [(e.clientX - r.left - tx) / scale / ppu, (e.clientY - r.top - ty) / scale / ppu];
  }

  function onwheel(e: WheelEvent) {
    e.preventDefault();
    const r = box!.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const next = Math.max(0.1, Math.min(8, scale * Math.exp(-e.deltaY * 0.0015)));
    tx = px - ((px - tx) * next) / scale;
    ty = py - ((py - ty) * next) / scale;
    scale = next;
  }

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    box!.setPointerCapture(e.pointerId);
    if (e.button === 1 || tool === 'pan') { drag = { mode: 'pan', x: e.clientX, y: e.clientY, tx, ty }; return; }
    const [x, y] = toMap(e);
    if (BRUSH.includes(tool)) { drag = { mode: 'brush', x: e.clientX, y: e.clientY, tx, ty }; stroke = [x, y]; return; }
    onpoint(x, y);
  }

  function onpointermove(e: PointerEvent) {
    const [x, y] = toMap(e);
    cursor = [x, y];
    if (drag?.mode === 'pan') { tx = drag.tx + e.clientX - drag.x; ty = drag.ty + e.clientY - drag.y; return; }
    if (drag?.mode === 'brush') {
      const lx = stroke[stroke.length - 2], ly = stroke[stroke.length - 1];
      if (Math.hypot(x - lx, y - ly) >= Math.max(0.15, brush * 0.25)) stroke = [...stroke, x, y];
    }
  }

  function onpointerup(e: PointerEvent) {
    if (box?.hasPointerCapture(e.pointerId)) box.releasePointerCapture(e.pointerId);
    if (drag?.mode === 'brush' && stroke.length) {
      const [x, y] = toMap(e), pts = [...stroke];
      if (Math.hypot(x - pts[pts.length - 2], y - pts[pts.length - 1]) > 0.05) pts.push(x, y);
      onstroke(pts);
    }
    drag = null;
    stroke = [];
  }

  const line = (pts: number[]) => pts.reduce((s, v, i) => s + (i % 2 ? `,${v} ` : `${v}`), '');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="view"
  class:pan={tool === 'pan'}
  bind:this={box}
  {onwheel}
  {onpointerdown}
  {onpointermove}
  {onpointerup}
  onpointerleave={() => (cursor = null)}
  ondblclick={() => onfinish()}
  data-testid="map-view"
>
  <div class="paper" style="width:{W}px;height:{H}px;transform:translate({tx}px,{ty}px) scale({scale})">
    {@html svg}
    <svg class="overlay" width={W} height={H} viewBox="0 0 {cols} {rows}">
      {#if stroke.length >= 2}
        <polyline points={line(stroke)} fill="none" stroke="rgba(220,40,40,0.45)" stroke-width={brush * 2} stroke-linecap="round" stroke-linejoin="round" />
      {/if}
      {#if pending.length >= 2}
        <polyline points={line(cursor ? [...pending, ...cursor] : pending)} fill="none" stroke="#d22" stroke-width={2 / ppu / scale} stroke-dasharray="{6 / ppu / scale} {4 / ppu / scale}" />
        {#each { length: pending.length / 2 } as _, i}
          <circle cx={pending[i * 2]} cy={pending[i * 2 + 1]} r={4 / ppu / scale} fill="#d22" />
        {/each}
      {/if}
      {#if cursor && BRUSH.includes(tool)}
        <circle cx={cursor[0]} cy={cursor[1]} r={brush} fill="none" stroke="#d22" stroke-width={1.5 / ppu / scale} />
      {/if}
    </svg>
  </div>
</div>

<style>
  .view {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    background: var(--surface, #1b1b20);
    cursor: crosshair;
    touch-action: none;
  }
  .view.pan {
    cursor: grab;
  }
  .paper {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  }
  .paper :global(svg) {
    display: block;
  }
  .overlay {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
  }
</style>
