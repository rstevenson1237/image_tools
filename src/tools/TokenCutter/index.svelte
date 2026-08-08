<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Canvas } from 'fabric';
  import CanvasStage from '../../core/canvas/CanvasStage.svelte';
  import type { LoadedImage } from '../../core/canvas/types';
  import { acquire, type WorkerLease } from '../../workers/workerRegistry';
  import type { OpenCvApi } from '../../workers/opencv.worker';
  import { sceneToImage, type Point } from '../../core/utils/geometry';
  import { attachSelection, type SelectionController } from './canvas';
  import { createTokenCutterStore } from './store.svelte';
  import { exportSilhouette } from './export';
  import { imageDataToCanvas } from '../../core/utils/imageData';

  const store = createTokenCutterStore();

  let stage = $state<CanvasStage>();
  let previewEl = $state<HTMLDivElement>();
  let lease: WorkerLease<OpenCvApi> | undefined;
  let selection: SelectionController | undefined;

  onMount(() => {
    lease = acquire<OpenCvApi>('opencv');
    // Boot the WASM runtime in the background so the first extraction isn't
    // stalled behind a 10MB download.
    void lease.api.preload().catch(() => {
      /* Surfaced on first real use instead. */
    });

    window.addEventListener('keydown', onKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
    selection?.detach();
    selection = undefined;
    lease?.release();
    lease = undefined;
  });

  function onKeyDown(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    if (event.shiftKey) {
      if (store.history.canRedo) store.history.redo();
    } else if (store.history.canUndo) {
      store.history.undo();
    }
    event.preventDefault();
  }

  function onCanvasReady(canvas: Canvas) {
    selection = attachSelection(canvas, {
      getMode: () => store.mode,
      canStart: () => !store.busy && !(stage?.isPanning() ?? false) && store.source !== null,
      onselection: (polygon) => store.setPolygon(polygon),
    });
  }

  function onCanvasTeardown() {
    selection?.detach();
    selection = undefined;
  }

  function onImageLoaded(image: LoadedImage) {
    store.setSource(image);
    selection?.clearPreview();
  }

  async function extract() {
    const source = store.source;
    const polygon = store.polygon;
    if (!source || !polygon || !lease) return;

    store.busy = true;
    store.errorMessage = null;
    store.statusMessage = 'Extracting silhouette…';

    try {
      // The worker needs mask points in source-image pixels, not scene units.
      const imagePolygon: Point[] = polygon.map((point) => sceneToImage(point, source.placement));

      const result = await lease.api.extractSilhouette(
        source.pixels,
        imagePolygon,
        store.settings.color,
        {
          threshold: store.settings.autoThreshold ? 'otsu' : store.settings.threshold,
          invert: store.settings.invert,
          keepLargestBlob: store.settings.keepLargestBlob,
          smoothing: store.settings.smoothing,
        },
      );

      store.commitExtraction(result, polygon);
      store.statusMessage = 'Silhouette ready.';
    } catch (error) {
      store.errorMessage = (error as Error).message ?? 'Extraction failed.';
      store.statusMessage = null;
    } finally {
      store.busy = false;
    }
  }

  async function download() {
    const silhouette = store.silhouette;
    const source = store.source;
    if (!silhouette || !source) return;
    try {
      await exportSilhouette(silhouette, source.filename, {
        padding: store.settings.padding,
        square: store.settings.square,
      });
      store.statusMessage = 'PNG downloaded.';
    } catch (error) {
      store.errorMessage = (error as Error).message ?? 'Export failed.';
    }
  }

  // Mirror the latest silhouette into the preview pane.
  $effect(() => {
    const silhouette = store.silhouette;
    const target = previewEl;
    if (!target) return;
    target.replaceChildren();
    if (!silhouette) return;
    const canvas = imageDataToCanvas(silhouette);
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'contain';
    target.appendChild(canvas);
  });
</script>

<div class="tool">
  <div class="workspace">
    <CanvasStage
      bind:this={stage}
      oncanvasready={onCanvasReady}
      oncanvasteardown={onCanvasTeardown}
      onimageloaded={onImageLoaded}
    />
    {#if store.busy}
      <div class="overlay" role="status">
        <div class="spinner" aria-hidden="true"></div>
        <p>{store.statusMessage ?? 'Working…'}</p>
      </div>
    {/if}
  </div>

  <aside class="panel">
    <h2>Token Cutter</h2>

    <section>
      <h3>Selection</h3>
      <div class="segmented" role="group" aria-label="Selection mode">
        <button
          type="button"
          class:active={store.mode === 'lasso'}
          onclick={() => (store.mode = 'lasso')}>Lasso</button
        >
        <button
          type="button"
          class:active={store.mode === 'marquee'}
          onclick={() => (store.mode = 'marquee')}>Marquee</button
        >
      </div>
      <p class="hint">
        {#if !store.source}
          Drop an image onto the canvas to begin.
        {:else if store.polygon}
          Selection captured ({store.polygon.length} points).
        {:else}
          Drag on the canvas to outline the figure.
        {/if}
      </p>
    </section>

    <section>
      <h3>Silhouette</h3>

      <label for="tc-color">Colour</label>
      <input id="tc-color" type="color" bind:value={store.settings.color} />

      <label class="checkbox">
        <input type="checkbox" bind:checked={store.settings.autoThreshold} />
        Auto threshold (Otsu)
      </label>

      <label for="tc-threshold" class:disabled={store.settings.autoThreshold}>
        Threshold — {store.settings.threshold}
      </label>
      <input
        id="tc-threshold"
        type="range"
        min="0"
        max="255"
        step="1"
        disabled={store.settings.autoThreshold}
        bind:value={store.settings.threshold}
      />

      <label for="tc-smoothing">Smoothing — {store.settings.smoothing}px</label>
      <input
        id="tc-smoothing"
        type="range"
        min="0"
        max="25"
        step="1"
        bind:value={store.settings.smoothing}
      />

      <label class="checkbox">
        <input type="checkbox" bind:checked={store.settings.invert} />
        Subject is lighter than background
      </label>

      <label class="checkbox">
        <input type="checkbox" bind:checked={store.settings.keepLargestBlob} />
        Keep largest shape only
      </label>

      <button class="primary" type="button" disabled={!store.canExtract} onclick={extract}>
        Extract silhouette
      </button>
    </section>

    <section>
      <h3>Preview</h3>
      <div class="preview" bind:this={previewEl} aria-label="Silhouette preview"></div>
    </section>

    <section>
      <h3>Export</h3>
      <label for="tc-padding">Padding — {store.settings.padding}px</label>
      <input
        id="tc-padding"
        type="range"
        min="0"
        max="64"
        step="1"
        bind:value={store.settings.padding}
      />
      <label class="checkbox">
        <input type="checkbox" bind:checked={store.settings.square} />
        Pad to a square
      </label>
      <button type="button" disabled={!store.canExport} onclick={download}>Export PNG</button>
    </section>

    <section class="history">
      <button
        type="button"
        disabled={!store.history.canUndo}
        onclick={() => store.history.undo()}>Undo</button
      >
      <button
        type="button"
        disabled={!store.history.canRedo}
        onclick={() => store.history.redo()}>Redo</button
      >
    </section>

    {#if store.errorMessage}
      <p class="error" role="alert">{store.errorMessage}</p>
    {:else if store.statusMessage && !store.busy}
      <p class="status">{store.statusMessage}</p>
    {/if}
  </aside>
</div>

<style>
  .tool {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 0.75rem;
    height: 100%;
    padding: 0.75rem;
  }

  .workspace {
    position: relative;
    min-width: 0;
  }

  .panel {
    overflow-y: auto;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.9rem;
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-bottom: 0.9rem;
    margin-bottom: 0.9rem;
    border-bottom: 1px solid var(--border);
  }
  section:last-of-type {
    border-bottom: none;
  }

  label {
    font-size: 0.8rem;
    color: var(--text-dim);
  }
  label.disabled {
    opacity: 0.5;
  }
  .checkbox {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--text);
  }

  .segmented {
    display: flex;
  }
  .segmented button {
    flex: 1;
    border-radius: 0;
  }
  .segmented button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .segmented button:last-child {
    border-radius: 0 6px 6px 0;
    border-left: none;
  }
  .segmented button.active {
    background: var(--accent);
    color: var(--accent-contrast);
    border-color: var(--accent);
  }

  .hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-dim);
  }

  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 130px;
    border-radius: 6px;
    /* Chequerboard so transparency is visible. */
    background-color: #2a2f3a;
    background-image:
      linear-gradient(45deg, #232833 25%, transparent 25%),
      linear-gradient(-45deg, #232833 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #232833 75%),
      linear-gradient(-45deg, transparent 75%, #232833 75%);
    background-size: 16px 16px;
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0;
    overflow: hidden;
  }

  .history {
    flex-direction: row;
    gap: 0.5rem;
  }
  .history button {
    flex: 1;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: rgba(12, 14, 18, 0.72);
    border-radius: 8px;
    color: var(--text);
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2.4s;
    }
  }

  .error {
    margin: 0;
    padding: 0.5rem 0.65rem;
    border-radius: 6px;
    background: #4b1f24;
    color: #ffb4bb;
    font-size: 0.8rem;
  }
  .status {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-dim);
  }
</style>
