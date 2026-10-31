<script lang="ts">
  /**
   * The free camera (R7a, docs/MESHES.md §11): a voxel or mesh model drawn with the perspective orbit camera and the
   * software rasteriser the CLI's turntable uses, so the pixels match. Drag to turn it, the wheel to come closer; the
   * view redraws on demand, sharper (2×2 samples) once the pointer stops.
   */
  import { orbitCamera, rasterMesh, viewBounds, type ViewMesh } from 'artgen-scene/mesh/view.ts';
  import type { V3 } from 'artgen-scene/t2/scene3d.ts';

  let { mesh, light, background, size = 320 }: { mesh: ViewMesh; light: V3; background: string; size?: number } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let yaw = $state(30);
  let pitch = $state(20);
  let zoom = $state(1);
  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  let raf = 0, settle: ReturnType<typeof setTimeout> | undefined;

  const bounds = $derived(viewBounds(mesh));

  function draw(ss: number) {
    if (!canvas) return;
    const fit = orbitCamera({ target: bounds.center, yaw, pitch, w: size, h: size }, bounds.radius);
    const d = Math.hypot(fit.eye[0] - bounds.center[0], fit.eye[1] - bounds.center[2], fit.eye[2] - bounds.center[1]);
    const cam = orbitCamera({ target: bounds.center, yaw, pitch, w: size, h: size, distance: Math.max(bounds.radius * 1.2, d * zoom) });
    const g = rasterMesh(mesh, cam, { light, background, ss });
    canvas.width = size; canvas.height = size;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(g.d), size, size), 0, 0);
  }

  function redraw() {
    cancelAnimationFrame(raf);
    clearTimeout(settle);
    raf = requestAnimationFrame(() => { draw(1); settle = setTimeout(() => draw(2), 150); });
  }

  $effect(() => {
    void mesh; void light; void background; void yaw; void pitch; void zoom; void canvas;
    redraw();
    return () => { cancelAnimationFrame(raf); clearTimeout(settle); };
  });

  function down(e: PointerEvent) {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    yaw = drag.yaw - (e.clientX - drag.x) * 0.5;
    pitch = Math.max(-80, Math.min(85, drag.pitch + (e.clientY - drag.y) * 0.4));
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    zoom = Math.max(0.3, Math.min(3, zoom * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
  }
</script>

<div class="orbit">
  <canvas
    bind:this={canvas}
    width={size}
    height={size}
    aria-label="3D orbit view: drag to turn, wheel to zoom"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={() => (drag = null)}
    onpointercancel={() => (drag = null)}
    onwheel={wheel}
  ></canvas>
  <div class="row">
    <span>yaw {Math.round(((yaw % 360) + 360) % 360)}° · pitch {Math.round(pitch)}°</span>
    <button type="button" onclick={() => { yaw = 30; pitch = 20; zoom = 1; }}>Reset view</button>
  </div>
</div>

<style>
  .orbit {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
  }
  canvas {
    image-rendering: pixelated;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: grab;
    touch-action: none;
  }
  canvas:active {
    cursor: grabbing;
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    font-size: 0.75rem;
    color: var(--text-dim);
  }
</style>
