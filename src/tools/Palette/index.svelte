<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { formatGpl, formatHex, parsePaletteText, type Dither } from 'artgen-imagekit';
  import '../../workers/registerImagekit';
  import { acquire, type WorkerLease } from '../../workers/workerRegistry';
  import type { ImagekitApi } from '../../workers/imagekit.worker';
  import { loadImageFile, stemOf } from '../../core/utils/loadImage';
  import { imageDataToCanvas } from '../../core/utils/imageData';
  import { downloadCanvasAsPng, downloadText } from '../../core/utils/download';

  let lease: WorkerLease<ImagekitApi> | undefined;
  let source = $state<ImageData | null>(null);
  let filename = $state('image.png');
  let count = $state(16);
  let colors = $state<string[]>([]);
  let dither = $state<Dither>('none');
  let snapped = $state<ImageData | null>(null);
  /** Worker calls in flight; the overlay shows while any is. */
  let pending = $state(0);
  const busy = $derived(pending > 0);
  let error = $state<string | null>(null);
  let original = $state<HTMLDivElement>();
  let result = $state<HTMLDivElement>();
  let copied = $state<string | null>(null);
  let dragging = $state(false);
  /** Bumped by every request of a kind, so a slow answer cannot overwrite a newer one. */
  let extractTicket = 0;
  let snapTicket = 0;

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
      await extract();
    } catch (e) {
      error = (e as Error).message ?? 'Could not read that image.';
    }
  }

  /** Runs a worker call, counting it as pending and showing a failure rather than leaving it unhandled. */
  async function work<T>(call: () => Promise<T>, fallback: string): Promise<T | undefined> {
    pending++;
    try {
      return await call();
    } catch (e) {
      error = (e as Error).message ?? fallback;
      return undefined;
    } finally {
      pending--;
    }
  }

  async function extract() {
    if (!source || !lease) return;
    const mine = ++extractTicket, img = source, api = lease.api;
    const r = await work(() => api.extractPalette(img, count), 'Extraction failed.');
    if (!r || mine !== extractTicket) return;
    colors = r.colors;
    await snap();
  }

  async function snap() {
    if (!source || !lease || !colors.length) {
      snapped = null;
      return;
    }
    const mine = ++snapTicket, img = source, api = lease.api, list = [...colors], d = dither;
    const out = await work(() => api.quantize(img, list, d), 'Snapping failed.');
    if (out && mine === snapTicket) snapped = out;
  }

  async function loadPaletteFile(file: File | undefined) {
    if (!file) return;
    error = null;
    try {
      const list = parsePaletteText(await file.text());
      if (!list.length) throw new Error(`${file.name}: no colours found (a .hex or .gpl file)`);
      colors = list;
      await snap();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function removeColor(i: number) {
    colors = colors.filter((_, k) => k !== i);
    void snap();
  }

  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex);
      copied = hex;
      setTimeout(() => (copied = null), 1200);
    } catch {
      /* clipboard blocked: the swatch still shows the value */
    }
  }

  const draw = (target: HTMLDivElement | undefined, image: ImageData | null) => {
    if (!target) return;
    target.replaceChildren();
    if (!image) return;
    const canvas = imageDataToCanvas(image);
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.imageRendering = 'pixelated';
    target.appendChild(canvas);
  };
  $effect(() => draw(original, source));
  $effect(() => draw(result, snapped));

  const stem = $derived(stemOf(filename));
  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    void open(event.dataTransfer?.files?.[0]);
  }
</script>

<div class="tool">
  <div
    class="workspace"
    class:dragging
    role="presentation"
    ondragover={(e) => { e.preventDefault(); dragging = true; }}
    ondragleave={() => (dragging = false)}
    ondrop={onDrop}
  >
    {#if !source}
      <label class="drop">
        Drop an image here, or choose one
        <input type="file" accept="image/*" onchange={(e) => open(e.currentTarget.files?.[0])} />
      </label>
    {/if}
    <div class="pair" class:hidden={!source}>
      <figure><div class="view" bind:this={original}></div><figcaption>Original</figcaption></figure>
      <figure><div class="view" bind:this={result}></div><figcaption>Snapped to the palette</figcaption></figure>
    </div>
    {#if busy}<div class="overlay" role="status">Working…</div>{/if}
  </div>

  <aside class="panel">
    <h2>Palette</h2>
    <section>
      <h3>Image</h3>
      <label class="file">Choose an image<input type="file" accept="image/*" onchange={(e) => open(e.currentTarget.files?.[0])} /></label>
      <label for="pl-count">Colours to take — {count}</label>
      <input id="pl-count" type="range" min="2" max="64" step="1" bind:value={count} onchange={extract} />
    </section>

    <section>
      <h3>Colours ({colors.length})</h3>
      <div class="swatches">
        {#each colors as hex, i (hex + i)}
          <button type="button" class="swatch" style:background={hex} title="{hex} — click to copy, shift-click to remove" onclick={(e) => (e.shiftKey ? removeColor(i) : copy(hex))}>
            {#if copied === hex}<span>✓</span>{/if}
          </button>
        {/each}
      </div>
      <p class="hint">{copied ? `Copied ${copied}` : 'Click a colour to copy it; shift-click removes it from the palette.'}</p>
      <label class="file">Use a palette file (.hex, .gpl)<input type="file" accept=".hex,.gpl,.txt" onchange={(e) => loadPaletteFile(e.currentTarget.files?.[0])} /></label>
    </section>

    <section>
      <h3>Snap</h3>
      <label for="pl-dither">Dither</label>
      <select id="pl-dither" bind:value={dither} onchange={() => snap()}>
        <option value="none">None</option>
        <option value="bayer2">Ordered 2×2</option>
        <option value="bayer4">Ordered 4×4</option>
        <option value="noise">Noise</option>
      </select>
      <button type="button" disabled={!snapped} onclick={() => snapped && downloadCanvasAsPng(imageDataToCanvas(snapped), `${stem}-palette.png`)}>Download PNG</button>
    </section>

    <section>
      <h3>Save the palette</h3>
      <button type="button" disabled={!colors.length} onclick={() => downloadText(formatHex(colors), `${stem}.hex`)}>Download .hex</button>
      <button type="button" disabled={!colors.length} onclick={() => downloadText(formatGpl(colors, stem), `${stem}.gpl`)}>Download .gpl</button>
    </section>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </aside>
</div>

<style>
  .tool { display: grid; grid-template-columns: 1fr 280px; gap: 0.75rem; height: 100%; padding: 0.75rem; }
  .workspace { position: relative; min-width: 0; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--border); border-radius: 8px; }
  .workspace.dragging { border-color: var(--accent); }
  .drop { display: flex; flex-direction: column; gap: 0.6rem; align-items: center; color: var(--text-dim); cursor: pointer; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%; height: 100%; padding: 0.75rem; box-sizing: border-box; }
  .pair.hidden { display: none; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 0.35rem; min-height: 0; }
  figcaption { font-size: 0.75rem; color: var(--text-dim); text-align: center; }
  .view { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 6px; background: #232833; }
  .panel { overflow-y: auto; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 0.9rem; }
  h2 { margin: 0 0 0.75rem; font-size: 1rem; }
  h3 { margin: 0 0 0.5rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); }
  section { display: flex; flex-direction: column; gap: 0.4rem; padding-bottom: 0.9rem; margin-bottom: 0.9rem; border-bottom: 1px solid var(--border); }
  section:last-of-type { border-bottom: none; }
  label { font-size: 0.8rem; color: var(--text-dim); }
  .file { cursor: pointer; }
  .file input, .drop input { font-size: 0.75rem; }
  .swatches { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; }
  .swatch { aspect-ratio: 1; padding: 0; border: 1px solid var(--border); border-radius: 3px; cursor: pointer; color: #fff; mix-blend-mode: difference; font-size: 0.7rem; }
  .hint { margin: 0; font-size: 0.75rem; color: var(--text-dim); }
  .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(12, 14, 18, 0.6); border-radius: 8px; }
  .error { margin: 0; padding: 0.5rem 0.65rem; border-radius: 6px; background: #4b1f24; color: #ffb4bb; font-size: 0.8rem; }
</style>
