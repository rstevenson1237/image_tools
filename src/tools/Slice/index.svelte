<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { zipSync, strToU8 } from 'fflate';
  import type { Cell } from 'artgen-imagekit';
  import { acquire, type WorkerLease } from '../../workers/workerRegistry';
  import type { ImagekitApi } from '../../workers/imagekit.worker';
  import { loadImageFile, stemOf } from '../../core/utils/loadImage';
  import { downloadBlob } from '../../core/utils/download';

  let lease: WorkerLease<ImagekitApi> | undefined;
  let source = $state<ImageData | null>(null);
  let filename = $state('sheet.png');
  let mode = $state<'grid' | 'sprites'>('grid');
  let by = $state<'count' | 'size'>('count');
  let cols = $state(4);
  let rows = $state(4);
  let cellW = $state(32);
  let cellH = $state(32);
  let margin = $state(0);
  let spacing = $state(0);
  let skipEmpty = $state(true);
  let trim = $state(false);
  let gap = $state(1);
  let minSize = $state(2);
  let cells = $state<Cell[]>([]);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let dragging = $state(false);
  let ticket = 0;

  onMount(() => {
    lease = acquire<ImagekitApi>('imagekit');
  });
  onDestroy(() => {
    lease?.release();
    lease = undefined;
  });

  async function open(file: File | undefined) {
    if (!file) return;
    error = null;
    try {
      source = await loadImageFile(file);
      filename = file.name;
    } catch (e) {
      error = (e as Error).message ?? 'Could not read that image.';
    }
  }

  // Re-slice whenever the picture or a setting changes.
  $effect(() => {
    const img = source;
    const settings = { mode, by, cols, rows, cellW, cellH, margin, spacing, skipEmpty, trim, gap, minSize };
    if (!img || !lease) return;
    const mine = ++ticket;
    busy = true;
    const grid = settings.by === 'count' ? { cols: settings.cols, rows: settings.rows } : { cellW: settings.cellW, cellH: settings.cellH };
    lease.api
      .slice(img, settings.mode, { ...grid, margin: settings.margin, spacing: settings.spacing, skipEmpty: settings.skipEmpty, trim: settings.trim }, { gap: settings.gap, minSize: settings.minSize })
      .then((c) => { if (mine === ticket) { cells = c; error = null; } })
      .catch((e: Error) => { if (mine === ticket) { cells = []; error = e.message; } })
      .finally(() => { if (mine === ticket) busy = false; });
  });

  // Draw the sheet with the cells outlined on top.
  $effect(() => {
    const img = source, list = cells, el = canvas;
    if (!img || !el) return;
    el.width = img.width;
    el.height = img.height;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(img, 0, 0);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ff3b6b';
    ctx.fillStyle = '#ff3b6b';
    ctx.font = '8px sans-serif';
    for (const c of list) {
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      if (c.w >= 12 && c.h >= 10) ctx.fillText(String(c.index), c.x + 2, c.y + 9);
    }
  });

  async function download() {
    const img = source;
    if (!img || !cells.length) return;
    const stem = stemOf(filename), pad = Math.max(2, String(cells.length - 1).length);
    const scratch = document.createElement('canvas');
    const whole = document.createElement('canvas');
    whole.width = img.width;
    whole.height = img.height;
    whole.getContext('2d')!.putImageData(img, 0, 0);
    const files: Record<string, Uint8Array> = {};
    const listed = [];
    for (const c of cells) {
      scratch.width = c.w;
      scratch.height = c.h;
      const ctx = scratch.getContext('2d')!;
      ctx.clearRect(0, 0, c.w, c.h);
      ctx.drawImage(whole, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
      const blob = await new Promise<Blob | null>((r) => scratch.toBlob(r, 'image/png'));
      if (!blob) throw new Error('Failed to encode PNG');
      const name = `${stem}-${String(c.index).padStart(pad, '0')}.png`;
      files[name] = new Uint8Array(await blob.arrayBuffer());
      listed.push({ ...c, file: name });
    }
    files['slices.json'] = strToU8(JSON.stringify({ sheet: filename, width: img.width, height: img.height, cells: listed }, null, 2) + '\n');
    downloadBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `${stem}-slices.zip`);
  }
</script>

<div class="tool">
  <div
    class="workspace"
    class:dragging
    role="presentation"
    ondragover={(e) => { e.preventDefault(); dragging = true; }}
    ondragleave={() => (dragging = false)}
    ondrop={(e) => { e.preventDefault(); dragging = false; void open(e.dataTransfer?.files?.[0]); }}
  >
    {#if !source}
      <label class="drop">Drop a sprite sheet here, or choose one<input type="file" accept="image/*" onchange={(e) => open(e.currentTarget.files?.[0])} /></label>
    {/if}
    <canvas bind:this={canvas} class:hidden={!source} aria-label="Sprite sheet with the cells outlined"></canvas>
  </div>

  <aside class="panel">
    <h2>Sprite Slicer</h2>
    <section>
      <h3>Sheet</h3>
      <label class="file">Choose a sprite sheet<input type="file" accept="image/*" onchange={(e) => open(e.currentTarget.files?.[0])} /></label>
      <div class="segmented" role="group" aria-label="How to slice">
        <button type="button" class:active={mode === 'grid'} onclick={() => (mode = 'grid')}>Grid</button>
        <button type="button" class:active={mode === 'sprites'} onclick={() => (mode = 'sprites')}>Loose sprites</button>
      </div>
    </section>

    {#if mode === 'grid'}
      <section>
        <h3>Grid</h3>
        <div class="segmented" role="group" aria-label="Grid by">
          <button type="button" class:active={by === 'count'} onclick={() => (by = 'count')}>By count</button>
          <button type="button" class:active={by === 'size'} onclick={() => (by = 'size')}>By cell size</button>
        </div>
        {#if by === 'count'}
          <label>Columns <input type="number" min="1" max="256" bind:value={cols} /></label>
          <label>Rows <input type="number" min="1" max="256" bind:value={rows} /></label>
        {:else}
          <label>Cell width <input type="number" min="1" max="4096" bind:value={cellW} /></label>
          <label>Cell height <input type="number" min="1" max="4096" bind:value={cellH} /></label>
        {/if}
        <label>Margin <input type="number" min="0" max="256" bind:value={margin} /></label>
        <label>Spacing <input type="number" min="0" max="256" bind:value={spacing} /></label>
        <label class="checkbox"><input type="checkbox" bind:checked={skipEmpty} /> Skip empty cells</label>
        <label class="checkbox"><input type="checkbox" bind:checked={trim} /> Trim each cell to its sprite</label>
      </section>
    {:else}
      <section>
        <h3>Loose sprites</h3>
        <label>Gap that still joins pixels <input type="number" min="0" max="32" bind:value={gap} /></label>
        <label>Ignore blobs under <input type="number" min="1" max="256" bind:value={minSize} /> px</label>
      </section>
    {/if}

    <section>
      <h3>Result</h3>
      <p class="hint">{busy ? 'Slicing…' : source ? `${cells.length} cell${cells.length === 1 ? '' : 's'}` : 'No sheet yet.'}</p>
      <button type="button" class="primary" disabled={!cells.length} onclick={download}>Download .zip (PNGs + slices.json)</button>
    </section>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </aside>
</div>

<style>
  .tool { display: grid; grid-template-columns: 1fr 280px; gap: 0.75rem; height: 100%; padding: 0.75rem; }
  .workspace { min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: auto; border: 1px dashed var(--border); border-radius: 8px; }
  .workspace.dragging { border-color: var(--accent); }
  .drop { display: flex; flex-direction: column; gap: 0.6rem; align-items: center; color: var(--text-dim); }
  canvas { max-width: 100%; max-height: 100%; image-rendering: pixelated; background: #232833; }
  canvas.hidden { display: none; }
  .panel { overflow-y: auto; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 0.9rem; }
  h2 { margin: 0 0 0.75rem; font-size: 1rem; }
  h3 { margin: 0 0 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); }
  section { display: flex; flex-direction: column; gap: 0.4rem; padding-bottom: 0.9rem; margin-bottom: 0.9rem; border-bottom: 1px solid var(--border); }
  section:last-of-type { border-bottom: none; }
  label { font-size: 0.8rem; color: var(--text-dim); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  label input[type='number'] { width: 5rem; }
  .checkbox { justify-content: flex-start; color: var(--text); }
  .file { cursor: pointer; display: block; }
  .segmented { display: flex; }
  .segmented button { flex: 1; border-radius: 0; }
  .segmented button:first-child { border-radius: 6px 0 0 6px; }
  .segmented button:last-child { border-radius: 0 6px 6px 0; border-left: none; }
  .segmented button.active { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .hint { margin: 0; font-size: 0.8rem; color: var(--text-dim); }
  .error { margin: 0; padding: 0.5rem 0.65rem; border-radius: 6px; background: #4b1f24; color: #ffb4bb; font-size: 0.8rem; }
</style>
