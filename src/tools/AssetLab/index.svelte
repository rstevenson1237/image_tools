<script lang="ts">
  /**
   * Asset Lab (W4, SPEC §13.1): load one asset version, drive its declared params (sliders, toggles, choices, ramp
   * swaps), seed and param variant, and play it through the W3 runtime's canvas2d adapter — exactly how a game would
   * show its exported pack — by state, facing (or a turning angle) and frame. Exports the asset alone as a pack.
   * Nothing here writes to the project: tweaks you like go back to Claude Code as a note or a new version.
   */
  import { onDestroy } from 'svelte';
  import { strToU8, zipSync } from 'fflate';
  import { createPack, type ArtSprite, type Pack, type PackManifest } from 'artgen-runtime';
  import { canvas2dAdapter, drawNode, type Canvas2DLayer, type Canvas2DNode, type CanvasLike, type Context2DLike } from 'artgen-runtime/canvas2d';
  import type { ParamSpec } from 'artgen-core';
  import { acquire } from '../../workers/workerRegistry';
  import type { ArtgenApi } from '../../workers/artgen.worker';
  import type { AssetRow } from '../../core/project/engine';
  import { project } from '../../core/project/store.svelte';
  import { downloadBlob } from '../../core/utils/download';
  import ProjectBar from '../../core/components/ProjectBar.svelte';
  import StatusBadge from '../../core/components/StatusBadge.svelte';
  import { drawChecker } from '../../core/components/pixels';

  const lease = acquire<ArtgenApi>('artgen');
  onDestroy(() => lease.release());

  type Sprite = ArtSprite<CanvasLike, Canvas2DNode>;

  let rows = $state<AssetRow[]>([]);
  let id = $state<string | null>(null);
  let versions = $state<string[]>([]);
  let version = $state<string | null>(null);
  let schema = $state<Record<string, unknown>>({});
  let values = $state<Record<string, unknown>>({});
  let seed = $state(1);
  let variant = $state(0);
  let anim = $state('');
  let facing = $state(0);
  let frame = $state(0);
  let playing = $state(true);
  let spin = $state(false);
  let zoom = $state(6);
  let bgMode = $state<'game' | 'checker'>('game');
  let background = $state('#202028');
  let manifest = $state.raw<PackManifest | null>(null);
  let error = $state<string | null>(null);
  let rendering = $state(false);
  let canvas = $state<HTMLCanvasElement>();

  let pack: Pack<CanvasLike, Canvas2DNode, Canvas2DLayer> | null = null;
  let sprite: Sprite | null = null;
  let packPng: Uint8Array[] = [];
  let raf = 0;

  const asset = $derived(manifest && id ? manifest.assets[id] : null);
  const specs = $derived(Object.entries(schema).filter(([, v]) => isSpec(v)) as [string, ParamSpec][]);
  const fixed = $derived(Object.entries(schema).filter(([, v]) => !isSpec(v)));
  const frames = $derived(asset?.states[anim]?.frames ?? 1);

  function isSpec(v: unknown): v is ParamSpec {
    return typeof v === 'object' && v !== null && !Array.isArray(v) && ['range', 'toggle', 'choice', 'swap'].includes((v as { type?: string }).type ?? '');
  }

  $effect(() => {
    void project.revision;
    if (project.snapshot) void loadRows();
    else { rows = []; manifest = null; }
  });

  let ticket = 0;
  async function loadRows() {
    const mine = ++ticket;
    error = null;
    try {
      const api = await project.sync(lease.api), next = (await api.status()).filter(r => r.status !== 'brief');
      if (mine !== ticket) return;
      rows = next;
      if (!id || !rows.some(r => r.id === id)) id = rows.find(r => r.final)?.id ?? rows[0]?.id ?? null;
      if (id) await pickAsset(id, true);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function pickAsset(next: string, keepVersion = false) {
    id = next;
    const api = await project.sync(lease.api), d = await api.detail(next);
    versions = d.versions;
    background = d.background ?? '#202028';
    if (!keepVersion || !version || !versions.includes(version)) version = d.row.final ?? versions[versions.length - 1] ?? null;
    await pickVersion(version, keepVersion);
  }

  async function pickVersion(v: string | null, keepParams = false) {
    version = v;
    if (!id || !v) return;
    schema = await (await project.sync(lease.api)).params(id, v);
    if (!keepParams) { values = {}; variant = 0; seed = 1; }
    await rebuild();
  }

  /** Render the version with the current params into a one-asset pack, then load it through the runtime. */
  async function rebuild() {
    if (!id || !version) return;
    rendering = true; error = null;
    try {
      const api = await project.sync(lease.api);
      const r = await api.labPack(id, version, { seed, variant, params: $state.snapshot(values) as Record<string, unknown> });
      const p = await createPack(r.manifest, r.atlases.map(a => ({ width: a.w, height: a.h, data: a.data })), canvas2dAdapter());
      pack?.dispose(); sprite?.dispose();
      pack = p; packPng = r.png; manifest = r.manifest;
      const a = r.manifest.assets[id];
      if (!a.states[anim]) anim = Object.keys(a.states)[0];
      if (facing >= a.facings.length) facing = 0;
      sprite = p.sprite(id, { state: anim });
      sprite.setFacing(a.facings[facing]);
      frame = Math.min(frame, (a.states[anim]?.frames ?? 1) - 1);
      draw();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      rendering = false;
    }
  }

  let lastT = 0, angle = Math.PI / 2;
  function tick(t: number) {
    const dt = lastT ? Math.min(100, t - lastT) : 0;
    lastT = t;
    if (sprite && playing) {
      if (spin) { angle += dt * 0.0012; sprite.face(angle); facing = sprite.facing; }
      if (!sprite.update(dt)) sprite.play(sprite.state, true);
      frame = sprite.frame;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  onDestroy(() => { cancelAnimationFrame(raf); sprite?.dispose(); pack?.dispose(); });

  function draw() {
    if (!canvas || !pack || !sprite || !asset || !id) return;
    const ctx = canvas.getContext('2d')!, [w, h] = asset.size, tile = asset.tile !== undefined, reps = tile ? 3 : 1;
    canvas.width = Math.max(w * reps * zoom + 32, 160); canvas.height = Math.max(h * reps * zoom + 32, 160);
    ctx.imageSmoothingEnabled = false;
    if (bgMode === 'checker') drawChecker(ctx, canvas.width, canvas.height);
    else { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    const [ax, ay] = asset.anchor, x0 = Math.floor((canvas.width - w * reps * zoom) / 2), y0 = Math.floor((canvas.height - h * reps * zoom) / 2);
    // paused: the scrubbed frame straight from the pack; playing: the sprite's own state machine
    const rect = playing ? sprite.rect : pack.frame(id, { variant: 0, state: anim, facing, frame });
    const node: Canvas2DNode = { tex: rect.tex, frame: rect, flipX: playing && sprite.flipX, anchor: [ax, ay], x: 0, y: 0, z: 0, visible: true, layer: null };
    for (let j = 0; j < reps; j++) for (let i = 0; i < reps; i++) drawNode(ctx as unknown as Context2DLike, node, zoom, x0 + (i * w + ax) * zoom, y0 + (j * h + ay) * zoom);
  }

  function setState(s: string) {
    anim = s; frame = 0;
    sprite?.play(s as never, true);
  }

  function setFacing(i: number) {
    facing = i; spin = false;
    if (sprite && asset) sprite.setFacing(asset.facings[i]);
  }

  function setParam(k: string, v: unknown) {
    values = { ...values, [k]: v };
    scheduleRebuild();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  function scheduleRebuild() { clearTimeout(timer); timer = setTimeout(() => void rebuild(), 200); }
  onDestroy(() => clearTimeout(timer));

  function exportAsset() {
    if (!manifest || !id || !version) return;
    const files: Record<string, Uint8Array> = { [`${id}/pack.json`]: strToU8(JSON.stringify(manifest, null, 2) + '\n') };
    manifest.atlases.forEach((name, i) => (files[`${id}/${name}`] = packPng[i]));
    downloadBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `${id}-${version}${variant || Object.keys(values).length ? '-lab' : ''}.zip`);
  }

  const paramValue = (k: string, s: ParamSpec) => values[k] ?? (s.type === 'range' ? (s.default ?? (s.min + s.max) / 2) : s.type === 'toggle' ? (s.default ?? false) : (s.default ?? s.options[0]));
</script>

<div class="tool">
  <ProjectBar>
    <button type="button" onclick={exportAsset} disabled={!manifest}>Export asset (pack zip)</button>
  </ProjectBar>

  {#if !project.files}
    <div class="empty">
      <h2>Asset Lab</h2>
      <p>Open a game repo with an artgen <code>art/</code> folder, pick an asset and version, and play it through the runtime's canvas2d
        adapter while you move its params, seed, variant, facing and frame. The asset code runs in a worker; nothing is written back.</p>
    </div>
  {:else}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="layout">
      <section class="controls">
        <label>asset
          <select value={id} onchange={e => pickAsset((e.currentTarget as HTMLSelectElement).value)}>
            {#each rows as r (r.id)}<option value={r.id}>{r.id} ({r.kind}, {r.status})</option>{/each}
          </select>
        </label>
        {#if id}
          {@const row = rows.find(r => r.id === id)}
          {#if row}<p class="dim"><StatusBadge status={row.status} /> final {row.final ?? '–'} · score {row.score ?? '–'}</p>{/if}
        {/if}
        <label>version
          <select value={version} onchange={e => pickVersion((e.currentTarget as HTMLSelectElement).value, true)}>
            {#each versions as v (v)}<option value={v}>{v}</option>{/each}
          </select>
        </label>

        <h3>Params</h3>
        {#if !specs.length && !fixed.length}<p class="dim small">This version declares no params.</p>{/if}
        {#each specs as [k, s] (k)}
          {#if s.type === 'range'}
            <label>{k} <span class="v">{Number(paramValue(k, s)).toFixed(2)}</span>
              <input type="range" min={s.min} max={s.max} step={s.step ?? (s.max - s.min) / 100} value={paramValue(k, s)} oninput={e => setParam(k, Number((e.currentTarget as HTMLInputElement).value))} />
            </label>
          {:else if s.type === 'toggle'}
            <label class="inline"><input type="checkbox" checked={!!paramValue(k, s)} onchange={e => setParam(k, (e.currentTarget as HTMLInputElement).checked)} /> {k}</label>
          {:else}
            <label>{k}{s.type === 'swap' ? ' (ramp)' : ''}
              <select value={JSON.stringify(paramValue(k, s))} onchange={e => setParam(k, JSON.parse((e.currentTarget as HTMLSelectElement).value))}>
                {#each s.options as o (JSON.stringify(o))}<option value={JSON.stringify(o)}>{typeof o === 'string' ? o : JSON.stringify(o)}</option>{/each}
              </select>
            </label>
          {/if}
        {/each}
        {#if fixed.length}<p class="dim small">fixed: {fixed.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}</p>{/if}
        <div class="pair">
          <label>seed <input type="number" min="1" value={seed} onchange={e => { seed = Number((e.currentTarget as HTMLInputElement).value) || 1; void rebuild(); }} /></label>
          <label>variant <input type="number" min="0" max="99" value={variant} onchange={e => { variant = Number((e.currentTarget as HTMLInputElement).value) || 0; values = {}; void rebuild(); }} /></label>
        </div>
        <button type="button" onclick={() => { values = {}; variant = 0; seed = 1; void rebuild(); }}>Reset params</button>

        {#if asset}
          <h3>Playback</h3>
          <label>state
            <select value={anim} onchange={e => setState((e.currentTarget as HTMLSelectElement).value)}>
              {#each Object.entries(asset.states) as [s, d] (s)}<option value={s}>{s} ({d.frames} frame{d.frames > 1 ? 's' : ''}{d.loop ? ', loop' : ''})</option>{/each}
            </select>
          </label>
          {#if asset.facings.length > 1}
            <label>facing
              <select value={facing} onchange={e => setFacing(Number((e.currentTarget as HTMLSelectElement).value))}>
                {#each asset.facings as f, i (f)}<option value={i}>{f}</option>{/each}
              </select>
            </label>
            <label class="inline"><input type="checkbox" bind:checked={spin} disabled={!playing} /> turn (face an angle, mirror-aware)</label>
          {/if}
          <label class="inline"><input type="checkbox" bind:checked={playing} /> play</label>
          <label>frame <span class="v">{frame + 1} / {frames}</span>
            <input type="range" min="0" max={frames - 1} step="1" value={frame} disabled={playing || frames < 2} oninput={e => (frame = Number((e.currentTarget as HTMLInputElement).value))} />
          </label>
          <div class="pair">
            <label>zoom
              <select bind:value={zoom}>{#each [1, 2, 3, 4, 6, 8, 12] as z (z)}<option value={z}>{z}×</option>{/each}</select>
            </label>
            <label>background
              <select bind:value={bgMode}><option value="game">game</option><option value="checker">checker</option></select>
            </label>
          </div>
        {/if}
      </section>
      <section class="stage">
        <canvas bind:this={canvas} aria-label="runtime preview"></canvas>
        <p class="dim small">
          {rendering ? 'rendering…' : asset ? `${id} ${version} · ${asset.size.join('×')} · ${asset.facings.length} facing(s) · played by artgen-runtime (canvas2d adapter)` : ''}
        </p>
      </section>
    </div>
  {/if}
</div>

<style>
  .tool {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .empty {
    padding: 2rem;
    max-width: 42rem;
    color: var(--text-dim);
  }
  .empty h2 {
    color: var(--text);
  }
  .layout {
    display: grid;
    grid-template-columns: 19rem 1fr;
    min-height: 0;
    flex: 1;
  }
  .controls {
    overflow-y: auto;
    padding: 0.7rem 1rem 2rem;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .stage {
    overflow: auto;
    padding: 1rem;
  }
  canvas {
    image-rendering: pixelated;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  h3 {
    font-size: 0.85rem;
    margin: 0.8rem 0 0.1rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
  label.inline {
    flex-direction: row;
    align-items: center;
    gap: 0.35rem;
  }
  .v {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .pair {
    display: flex;
    gap: 0.6rem;
  }
  .pair label {
    flex: 1;
    min-width: 0;
  }
  .pair input,
  .pair select {
    width: 100%;
  }
  select,
  input[type='number'] {
    font: inherit;
    font-size: 0.85rem;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.25rem 0.4rem;
    min-width: 0;
  }
  .dim {
    color: var(--text-dim);
    margin: 0;
  }
  .small {
    font-size: 0.75rem;
  }
  .error {
    margin: 0;
    padding: 0.5rem 0.9rem;
    background: #3a1d22;
    color: #ffb4bb;
    font-size: 0.85rem;
    white-space: pre-wrap;
  }
</style>
