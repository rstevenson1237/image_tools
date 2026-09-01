<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Canvas } from 'fabric';
  import CanvasStage from '../../core/canvas/CanvasStage.svelte';
  import type { LoadedImage } from '../../core/canvas/types';
  import { acquire, type WorkerLease } from '../../workers/workerRegistry';
  import type { OpenCvApi } from '../../workers/opencv.worker';
  import { attachNodeEditor, type EditorTool, type NodeEditorController } from './canvas';
  import { createSvgTracerStore } from './store.svelte';
  import { copySvgToClipboard, exportSvg } from './export';
  import { nodeCount } from './model';

  const store = createSvgTracerStore();

  let stage = $state<CanvasStage>();
  let lease: WorkerLease<OpenCvApi> | undefined;
  let editor: NodeEditorController | undefined;
  /** Set on unmount so an in-flight trace cannot write into a dead store. */
  let disposed = false;

  onMount(() => {
    lease = acquire<OpenCvApi>('opencv');
    // Boot the WASM runtime in the background so the first trace isn't stalled
    // behind a 10MB download.
    void lease.api.preload().catch(() => {
      /* Surfaced on first real use instead. */
    });

    window.addEventListener('keydown', onKeyDown);
  });

  onDestroy(() => {
    disposed = true;
    window.removeEventListener('keydown', onKeyDown);
    editor?.detach();
    editor = undefined;
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
    editor = attachNodeEditor(canvas, {
      canStart: () => !store.busy && !(stage?.isPanning() ?? false) && store.document !== null,
      getDocument: () => store.document,
      getPlacement: () => store.source?.placement ?? null,
      getTool: () => store.tool,
      getSelectedPathId: () => store.selectedPathId,
      onselectpath: (pathId) => (store.selectedPathId = pathId),
      onnodedrag: (ref, to) => store.dragNode(ref, to),
      onnodedragend: (ref, from, to) => store.commitNodeDrag(ref, from, to),
      oninsertnode: (at, node) => store.insertNodeAt(at, node),
      ondeletenode: (ref) => store.deleteNodeAt(ref),
    });
  }

  function onCanvasTeardown() {
    editor?.detach();
    editor = undefined;
  }

  function onImageLoaded(image: LoadedImage) {
    // CanvasStage clears the canvas on every load, taking our path objects with
    // it — dropping the document and re-syncing keeps the editor's map honest.
    store.setSource(image);
  }

  async function trace() {
    const source = store.source;
    if (!source || !lease) return;

    store.busy = true;
    store.errorMessage = null;
    store.statusMessage = 'Tracing contours…';

    try {
      const result = await lease.api.traceContours(source.pixels, store.traceOptions);
      if (disposed) return;
      store.commitTrace(result);
      const dropped = result.droppedCount > 0 ? `, ${result.droppedCount} dropped` : '';
      store.statusMessage =
        `${result.shapes.length} shape${result.shapes.length === 1 ? '' : 's'}${dropped} ` +
        `· threshold ${Math.round(result.thresholdUsed)}`;
    } catch (error) {
      if (disposed) return;
      store.errorMessage = (error as Error).message ?? 'Trace failed.';
      store.statusMessage = null;
    } finally {
      if (!disposed) store.busy = false;
    }
  }

  function download() {
    const doc = store.document;
    const source = store.source;
    if (!doc || !source) return;
    try {
      exportSvg(doc, source.filename);
      store.statusMessage = 'SVG downloaded.';
    } catch (error) {
      store.errorMessage = (error as Error).message ?? 'Export failed.';
    }
  }

  async function copy() {
    const doc = store.document;
    if (!doc) return;
    try {
      await copySvgToClipboard(doc);
      store.statusMessage = 'SVG copied to the clipboard.';
    } catch (error) {
      store.errorMessage = (error as Error).message ?? 'Copy failed.';
    }
  }

  const tools: { id: EditorTool; label: string }[] = [
    { id: 'select', label: 'Select' },
    { id: 'insert', label: 'Add' },
    { id: 'delete', label: 'Remove' },
  ];

  // One sync path for interactive edits and for undo/redo alike.
  $effect(() => {
    store.revision;
    store.selectedPathId;
    editor?.sync();
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
    <h2>SVG Tracer</h2>

    <section>
      <h3>Trace</h3>

      <label class="checkbox">
        <input type="checkbox" bind:checked={store.settings.autoThreshold} />
        Auto threshold (Otsu)
      </label>

      <label for="st-threshold" class:disabled={store.settings.autoThreshold}>
        Threshold — {store.settings.threshold}
      </label>
      <input
        id="st-threshold"
        type="range"
        min="0"
        max="255"
        step="1"
        disabled={store.settings.autoThreshold}
        bind:value={store.settings.threshold}
      />

      <label class="checkbox">
        <input type="checkbox" bind:checked={store.settings.invert} />
        Subject is lighter than background
      </label>

      <label for="st-smoothing">Smoothing — {store.settings.smoothing}px</label>
      <input
        id="st-smoothing"
        type="range"
        min="0"
        max="25"
        step="1"
        bind:value={store.settings.smoothing}
      />

      <label for="st-simplify">Simplify — {store.settings.simplifyTolerance}px</label>
      <input
        id="st-simplify"
        type="range"
        min="0"
        max="8"
        step="0.5"
        bind:value={store.settings.simplifyTolerance}
      />

      <label for="st-min-area">Minimum area — {store.settings.minArea}px²</label>
      <input
        id="st-min-area"
        type="range"
        min="0"
        max="500"
        step="4"
        bind:value={store.settings.minArea}
      />

      <label for="st-max-paths">Maximum shapes — {store.settings.maxPaths}</label>
      <input
        id="st-max-paths"
        type="range"
        min="1"
        max="500"
        step="1"
        bind:value={store.settings.maxPaths}
      />

      <label class="checkbox">
        <input type="checkbox" bind:checked={store.settings.keepHoles} />
        Keep interior holes
      </label>

      <button class="primary" type="button" disabled={!store.canTrace} onclick={trace}>
        {store.document ? 'Re-trace' : 'Trace image'}
      </button>
      <p class="hint">
        {#if !store.source}
          Drop an image onto the canvas to begin.
        {:else if !store.document}
          Trace the image to turn it into editable paths.
        {:else}
          Re-tracing replaces every path. It is undoable.
        {/if}
      </p>
    </section>

    {#if store.document}
      <section>
        <h3>Shapes</h3>
        <ul class="paths">
          {#each store.document.paths as path (path.id)}
            <li class:selected={path.id === store.selectedPathId}>
              <button
                type="button"
                class="name"
                onclick={() => (store.selectedPathId = path.id)}
                aria-pressed={path.id === store.selectedPathId}
              >
                <span class="swatch" style:background={path.style.fill ?? 'transparent'}></span>
                {path.name}
                <span class="count">{nodeCount(path)}</span>
              </button>
              <button
                type="button"
                class="toggle"
                aria-label={path.visible ? `Hide ${path.name}` : `Show ${path.name}`}
                onclick={() => store.togglePathVisible(path.id)}
              >
                {path.visible ? '◉' : '○'}
              </button>
            </li>
          {/each}
        </ul>
        {#if store.document.paths.length === 0}
          <p class="hint">No shapes survived the trace. Try lowering the minimum area.</p>
        {/if}
      </section>

      <section>
        <h3>Edit</h3>
        <div class="segmented" role="group" aria-label="Node tool">
          {#each tools as item (item.id)}
            <button
              type="button"
              class:active={store.tool === item.id}
              onclick={() => (store.tool = item.id)}>{item.label}</button
            >
          {/each}
        </div>
        <p class="hint">
          {#if !store.selectedPathId}
            Click a shape on the canvas to edit its nodes.
          {:else if store.tool === 'select'}
            Drag a node to move it. Hold space to pan instead.
          {:else if store.tool === 'insert'}
            Click a segment to add a node to it.
          {:else}
            Click a node to remove it.
          {/if}
        </p>
        <button
          type="button"
          disabled={!store.selectedPathId}
          onclick={() => store.deleteSelectedPath()}
        >
          Delete shape
        </button>
      </section>
    {/if}

    {#if store.selectedPath}
      {@const style = store.selectedPath.style}
      <section>
        <h3>Style</h3>

        <label class="checkbox">
          <input
            type="checkbox"
            checked={style.fill !== null}
            onchange={(event) =>
              store.setSelectedStyle({
                fill: event.currentTarget.checked ? '#e6e9f0' : null,
              })}
          />
          Fill
        </label>
        {#if style.fill !== null}
          <input
            type="color"
            aria-label="Fill colour"
            value={style.fill}
            onchange={(event) => store.setSelectedStyle({ fill: event.currentTarget.value })}
          />
          <label for="st-fill-opacity">Fill opacity — {style.fillOpacity}</label>
          <input
            id="st-fill-opacity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={style.fillOpacity}
            onchange={(event) =>
              store.setSelectedStyle({ fillOpacity: Number(event.currentTarget.value) })}
          />
        {/if}

        <label class="checkbox">
          <input
            type="checkbox"
            checked={style.stroke !== null}
            onchange={(event) =>
              store.setSelectedStyle({
                stroke: event.currentTarget.checked ? '#101217' : null,
              })}
          />
          Stroke
        </label>
        {#if style.stroke !== null}
          <input
            type="color"
            aria-label="Stroke colour"
            value={style.stroke}
            onchange={(event) => store.setSelectedStyle({ stroke: event.currentTarget.value })}
          />
          <label for="st-stroke-width">Stroke width — {style.strokeWidth}px</label>
          <input
            id="st-stroke-width"
            type="range"
            min="0.5"
            max="12"
            step="0.5"
            value={style.strokeWidth}
            onchange={(event) =>
              store.setSelectedStyle({ strokeWidth: Number(event.currentTarget.value) })}
          />
        {/if}
      </section>
    {/if}

    <section>
      <h3>Export</h3>
      <button class="primary" type="button" disabled={!store.canExport} onclick={download}>
        Export SVG
      </button>
      <button type="button" disabled={!store.canExport} onclick={copy}>Copy markup</button>
    </section>

    <section class="history">
      <button type="button" disabled={!store.history.canUndo} onclick={() => store.history.undo()}>
        Undo
      </button>
      <button type="button" disabled={!store.history.canRedo} onclick={() => store.history.redo()}>
        Redo
      </button>
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
  }
  .segmented button:not(:first-child) {
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

  .paths {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-height: 190px;
    overflow-y: auto;
  }
  .paths li {
    display: flex;
    gap: 0.25rem;
  }
  .paths li.selected .name {
    border-color: var(--accent);
    color: var(--text);
  }
  .name {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    justify-content: flex-start;
    font-size: 0.78rem;
    min-width: 0;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid var(--border);
    flex: none;
  }
  .count {
    margin-left: auto;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .toggle {
    flex: none;
    width: 2rem;
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
