<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Canvas, FabricImage, Point } from 'fabric';
  import { clamp } from '../utils/geometry';
  import { imageDataFromElement } from '../utils/imageData';
  import type { LoadedImage } from './types';
  import { normalizePointer, type NormalizedPointer } from '../utils/pointerEvent';

  interface Props {
    /** Grid step in scene units. 0 disables snapping. */
    gridSize?: number;
    snapToGrid?: boolean;
    minZoom?: number;
    maxZoom?: number;
    /** Fired once the Fabric canvas exists, so tools can attach their own handlers. */
    oncanvasready?: (canvas: Canvas) => void;
    /** Fired before the canvas is disposed, so tools can detach cleanly. */
    oncanvasteardown?: (canvas: Canvas) => void;
    onimageloaded?: (image: LoadedImage) => void;
  }

  let {
    gridSize = 16,
    snapToGrid = false,
    minZoom = 0.05,
    maxZoom = 16,
    oncanvasready,
    oncanvasteardown,
    onimageloaded,
  }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let wrapperEl: HTMLDivElement;
  let fileInputEl: HTMLInputElement;
  let canvas: Canvas | undefined;
  let resizeObserver: ResizeObserver | undefined;

  let spaceHeld = $state(false);
  let isDragOver = $state(false);
  let hasImage = $state(false);
  let zoomPercent = $state(100);
  let errorMessage = $state<string | null>(null);

  // Object URLs created for dropped files, revoked on teardown.
  const objectUrls: string[] = [];

  let panning = false;
  let lastPanPoint: { x: number; y: number } | null = null;
  let selectionBeforePan = true;

  function isPanTrigger(pointer: NormalizedPointer): boolean {
    return pointer.button === 1 || (pointer.button === 0 && spaceHeld);
  }

  onMount(() => {
    canvas = new Canvas(canvasEl, {
      backgroundColor: '#1c1f26',
      preserveObjectStacking: true,
      selection: false,
    });

    fitToWrapper();

    canvas.on('mouse:down', (opt) => {
      const pointer = normalizePointer(opt.e);
      if (!pointer || !isPanTrigger(pointer)) return;
      panning = true;
      lastPanPoint = { x: pointer.clientX, y: pointer.clientY };
      selectionBeforePan = canvas!.selection;
      canvas!.selection = false;
      canvas!.setCursor('grabbing');
      opt.e.preventDefault();
    });

    canvas.on('mouse:move', (opt) => {
      if (!panning || !lastPanPoint) return;
      const pointer = normalizePointer(opt.e);
      if (!pointer) return;
      canvas!.relativePan(
        new Point(pointer.clientX - lastPanPoint.x, pointer.clientY - lastPanPoint.y),
      );
      lastPanPoint = { x: pointer.clientX, y: pointer.clientY };
    });

    const endPan = () => {
      if (!panning) return;
      panning = false;
      lastPanPoint = null;
      canvas!.selection = selectionBeforePan;
    };
    canvas.on('mouse:up', endPan);
    canvas.on('mouse:out', endPan);

    canvas.on('mouse:wheel', (opt) => {
      const event = opt.e as WheelEvent;
      const next = clamp(canvas!.getZoom() * 0.999 ** event.deltaY, minZoom, maxZoom);
      canvas!.zoomToPoint(new Point(event.offsetX, event.offsetY), next);
      zoomPercent = Math.round(next * 100);
      event.preventDefault();
      event.stopPropagation();
    });

    canvas.on('object:moving', (opt) => {
      if (!snapToGrid || gridSize <= 0) return;
      const target = opt.target;
      target.set({
        left: Math.round((target.left ?? 0) / gridSize) * gridSize,
        top: Math.round((target.top ?? 0) / gridSize) * gridSize,
      });
    });

    resizeObserver = new ResizeObserver(fitToWrapper);
    resizeObserver.observe(wrapperEl);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    oncanvasready?.(canvas);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    resizeObserver?.disconnect();
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.length = 0;
    if (canvas) {
      oncanvasteardown?.(canvas);
      // Fabric v6 dispose is async; nothing else depends on it completing.
      void canvas.dispose();
      canvas = undefined;
    }
  });

  function onKeyDown(event: KeyboardEvent) {
    if (event.code === 'Space' && !isTypingTarget(event.target)) {
      spaceHeld = true;
      event.preventDefault();
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') spaceHeld = false;
  }

  function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
  }

  function fitToWrapper() {
    if (!canvas || !wrapperEl) return;
    const { clientWidth, clientHeight } = wrapperEl;
    if (clientWidth === 0 || clientHeight === 0) return;
    canvas.setDimensions({ width: clientWidth, height: clientHeight });
    canvas.requestRenderAll();
  }

  export function resetView() {
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    zoomPercent = 100;
    canvas.requestRenderAll();
  }

  export function getCanvas(): Canvas | undefined {
    return canvas;
  }

  /**
   * True while the stage owns the pointer for panning. Tools consult this before
   * starting their own drag gesture so space-drag doesn't also draw a lasso.
   */
  export function isPanning(): boolean {
    return panning || spaceHeld;
  }

  async function loadFile(file: File) {
    if (!canvas) return;
    if (!file.type.startsWith('image/')) {
      errorMessage = `"${file.name}" is not an image file.`;
      return;
    }
    errorMessage = null;

    const url = URL.createObjectURL(file);
    objectUrls.push(url);

    try {
      const image = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
      // Guard against the component unmounting mid-decode.
      if (!canvas) return;

      const naturalWidth = image.width ?? 0;
      const naturalHeight = image.height ?? 0;
      if (naturalWidth === 0 || naturalHeight === 0) {
        errorMessage = `Could not read dimensions from "${file.name}".`;
        return;
      }

      const scale = Math.min(
        1,
        (canvas.getWidth() * 0.9) / naturalWidth,
        (canvas.getHeight() * 0.9) / naturalHeight,
      );
      const left = (canvas.getWidth() - naturalWidth * scale) / 2;
      const top = (canvas.getHeight() - naturalHeight * scale) / 2;

      image.set({
        left,
        top,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
      });

      canvas.clear();
      canvas.backgroundColor = '#1c1f26';
      canvas.add(image);
      canvas.requestRenderAll();
      resetView();
      hasImage = true;

      onimageloaded?.({
        object: image,
        placement: { left, top, scaleX: scale, scaleY: scale },
        pixels: imageDataFromElement(image.getElement(), naturalWidth, naturalHeight),
        filename: file.name,
      });
    } catch (error) {
      errorMessage = `Failed to load "${file.name}": ${(error as Error).message}`;
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void loadFile(file);
  }

  function onFilePicked(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void loadFile(file);
  }
</script>

<div
  class="stage"
  class:drag-over={isDragOver}
  class:panning={spaceHeld}
  bind:this={wrapperEl}
  ondrop={onDrop}
  ondragover={(e) => {
    e.preventDefault();
    isDragOver = true;
  }}
  ondragleave={() => (isDragOver = false)}
  role="application"
  aria-label="Image workspace"
>
  <canvas bind:this={canvasEl}></canvas>

  {#if !hasImage}
    <div class="placeholder">
      <p class="headline">Drop an image here</p>
      <p class="hint">PNG, JPG or WebP — nothing leaves your browser.</p>
      <button type="button" onclick={() => fileInputEl.click()}>Choose a file…</button>
    </div>
  {/if}

  <div class="hud">
    <span>{zoomPercent}%</span>
    <button type="button" onclick={resetView}>Reset view</button>
    {#if hasImage}
      <button type="button" onclick={() => fileInputEl.click()}>Replace image</button>
    {/if}
    <span class="tip">Scroll to zoom · Space-drag or middle-drag to pan</span>
  </div>

  {#if errorMessage}
    <p class="error" role="alert">{errorMessage}</p>
  {/if}

  <input
    class="visually-hidden"
    type="file"
    accept="image/*"
    bind:this={fileInputEl}
    onchange={onFilePicked}
  />
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #1c1f26;
    border-radius: 8px;
    outline: 2px solid transparent;
    transition: outline-color 120ms ease;
  }
  .stage.drag-over {
    outline-color: var(--accent, #6ea8fe);
  }
  .stage.panning :global(canvas) {
    cursor: grab;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    pointer-events: none;
    color: #8b93a3;
    text-align: center;
  }
  .placeholder button {
    pointer-events: auto;
  }
  .headline {
    margin: 0;
    font-size: 1.1rem;
    color: #c7cddb;
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
  }

  .hud {
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.78rem;
    color: #8b93a3;
    background: rgba(16, 18, 23, 0.82);
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
  }
  .tip {
    opacity: 0.75;
  }

  .error {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    background: #4b1f24;
    color: #ffb4bb;
    font-size: 0.85rem;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
