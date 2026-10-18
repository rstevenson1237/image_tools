<script lang="ts">
  /**
   * A map on screen (Terrain Map, Dungeon Map): the rendered SVG with zoom (wheel) and pan (drag with the `pan` tool, or
   * the middle button), and a pointer layer in map units on top — brush strokes, dragged boxes and moves, clicks and the
   * line being drawn. Only the view lives here; every change goes back to the tool as map coordinates.
   */
  interface Props {
    svg: string;
    cols: number;
    rows: number;
    ppu: number;
    tool: string;
    /** Tools that paint a brush stroke (`onstroke`). */
    brushTools?: string[];
    /** Tools that drag out a box (`ondrag`, drawn as a rectangle). */
    boxTools?: string[];
    /** Tools that drag from one point to another (`ondrag`, drawn as an arrow); a click without moving is `onpoint`. */
    moveTools?: string[];
    /** Brush radius in map units. */
    brush?: number;
    /** Line points placed so far (x, y pairs). */
    pending: number[];
    /** Snap dragged boxes to whole cells. */
    snapBox?: boolean;
    onstroke?: (pts: number[]) => void;
    ondrag?: (x0: number, y0: number, x1: number, y1: number) => void;
    onpoint: (x: number, y: number) => void;
    onfinish: () => void;
  }
  let { svg, cols, rows, ppu, tool, brushTools = [], boxTools = [], moveTools = [], brush = 1, pending, snapBox = true, onstroke, ondrag, onpoint, onfinish }: Props = $props();

  const BRUSH = $derived(brushTools);
  let box = $state<HTMLDivElement>();
  let scale = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  let cursor = $state<[number, number] | null>(null);
  let stroke = $state<number[]>([]);
  let drag: { mode: 'pan' | 'brush' | 'drag'; x: number; y: number; tx: number; ty: number } | null = null;
  let span = $state<[number, number, number, number] | null>(null);
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
    if (boxTools.includes(tool) || moveTools.includes(tool)) { drag = { mode: 'drag', x: e.clientX, y: e.clientY, tx, ty }; span = [x, y, x, y]; return; }
    onpoint(x, y);
  }

  function onpointermove(e: PointerEvent) {
    const [x, y] = toMap(e);
    cursor = [x, y];
    if (drag?.mode === 'pan') { tx = drag.tx + e.clientX - drag.x; ty = drag.ty + e.clientY - drag.y; return; }
    if (drag?.mode === 'drag' && span) { span = [span[0], span[1], x, y]; return; }
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
      onstroke?.(pts);
    }
    if (drag?.mode === 'drag' && span) {
      const [x0, y0] = span, [x1, y1] = toMap(e), moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4;
      if (!moved) onpoint(x0, y0);
      else ondrag?.(x0, y0, x1, y1);
    }
    span = null;
    drag = null;
    stroke = [];
  }

  const line = (pts: number[]) => pts.reduce((s, v, i) => s + (i % 2 ? `,${v} ` : `${v}`), '');
  /** The dragged box, snapped to whole cells when `snapBox`. */
  const box4 = $derived.by(() => {
    if (!span) return null;
    const f = snapBox ? Math.floor : (v: number) => v, c = snapBox ? Math.ceil : (v: number) => v;
    const x0 = f(Math.min(span[0], span[2])), y0 = f(Math.min(span[1], span[3])), x1 = c(Math.max(span[0], span[2])), y1 = c(Math.max(span[1], span[3]));
    return [x0, y0, x1 - x0, y1 - y0];
  });
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
      {#if box4 && boxTools.includes(tool)}
        <rect x={box4[0]} y={box4[1]} width={box4[2]} height={box4[3]} fill="rgba(210,34,34,0.12)" stroke="#d22" stroke-width={2 / ppu / scale} stroke-dasharray="{6 / ppu / scale} {4 / ppu / scale}" />
      {/if}
      {#if span && moveTools.includes(tool)}
        <line x1={span[0]} y1={span[1]} x2={span[2]} y2={span[3]} stroke="#d22" stroke-width={2 / ppu / scale} stroke-dasharray="{6 / ppu / scale} {4 / ppu / scale}" />
        <circle cx={span[2]} cy={span[3]} r={4 / ppu / scale} fill="#d22" />
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
