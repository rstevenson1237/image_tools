<script lang="ts">
  /**
   * Art Direction (W4, SPEC §13.1): the direction as a form. Ramps (hue-shifted generator, Lospec .hex/.gpl import,
   * extraction from a reference image), camera / scale / line / shading settings, a live style tile of the probe set
   * under the edit beside the locked direction and any candidates, then save as a draft or lock — the same files
   * `/artgen-direction` writes. A lock bumps the version: approved assets then need a restyle in Claude Code.
   */
  import { onDestroy } from 'svelte';
  import { parseGpl, parseHexPalette, rampsFromColors, VIEWS, type Direction } from 'artgen-core';
  import { acquire } from '../../workers/workerRegistry';
  import type { ArtgenApi } from '../../workers/artgen.worker';
  import { project } from '../../core/project/store.svelte';
  import ProjectBar from '../../core/components/ProjectBar.svelte';
  import PaletteRamp from '../../core/components/PaletteRamp.svelte';
  import PixelPreview from '../../core/components/PixelPreview.svelte';
  import CanvasStage from '../../core/canvas/CanvasStage.svelte';
  import type { LoadedImage } from '../../core/canvas/types';
  import { fitScale, fromImageData, type Img } from '../../core/components/pixels';

  const lease = acquire<ArtgenApi>('artgen');
  onDestroy(() => lease.release());

  type Candidate = { name: string; id: string; status: string; summary: string[]; errors: string[] };

  let locked = $state<Direction | null>(null);
  let candidates = $state<Candidate[]>([]);
  let hasProbes = $state(false);
  let source = $state('locked');
  let edited = $state<Direction | null>(null);
  let errors = $state<string[]>([]);
  let compare = $state<string[]>([]);
  let tile = $state<Img | null>(null);
  let tileFailing = $state<string[][]>([]);
  let tileLabels = $state<string[]>([]);
  let rendering = $state(false);
  let tileError = $state<string | null>(null);
  let draftName = $state('next');
  let lockNote = $state('');
  let tray = $state<{ from: string; ramps: Record<string, string[]> } | null>(null);
  let showRef = $state(false);
  let newRamp = $state('');
  let loadError = $state<string | null>(null);
  let paletteInput = $state<HTMLInputElement>();

  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const dirty = $derived(!!edited && JSON.stringify(edited) !== JSON.stringify(sourceDirection()));

  $effect(() => {
    void project.revision;
    if (project.snapshot) void refresh();
    else { locked = null; candidates = []; edited = null; tile = null; }
  });

  function sourceDirection(): Direction | null {
    if (source === 'locked') return locked;
    return cache[source] ?? null;
  }
  let cache = $state<Record<string, Direction>>({});

  let loadTicket = 0;
  async function refresh() {
    const mine = ++loadTicket;
    loadError = null;
    try {
      const api = await project.sync(lease.api), d = await api.direction();
      const c: Record<string, Direction> = {};
      for (const x of d.candidates) if (!x.errors.length) c[x.name] = await api.candidate(x.name);
      if (mine !== loadTicket) return;
      locked = d.locked; candidates = d.candidates; hasProbes = d.hasProbes;
      cache = c;
      if (source !== 'locked' && !c[source]) source = 'locked';
      if (!locked && source === 'locked' && d.candidates.length) source = d.candidates[0].name;
      edited = sourceDirection() ? clone(sourceDirection()!) : null;
      compare = compare.filter(n => c[n]);
      schedule(0);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  function pick(name: string) {
    source = name;
    edited = sourceDirection() ? clone(sourceDirection()!) : null;
    if (name !== 'locked' && !(name.length === 1 && 'abc'.includes(name))) draftName = name;
    schedule(0);
  }

  // ---- live style tile (debounced) ---------------------------------------------------------------------------------
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticket = 0;
  function schedule(ms = 450) {
    clearTimeout(timer);
    timer = setTimeout(() => void renderTile(), ms);
  }
  onDestroy(() => clearTimeout(timer));

  async function renderTile() {
    if (!edited || !hasProbes) { tile = null; return; }
    const mine = ++ticket;
    rendering = true; tileError = null;
    try {
      const api = await project.sync(lease.api), v = await api.validate(clone(edited));
      errors = v.ok ? [] : v.errors;
      if (!v.ok) return;
      const cols: { label: string; dir: unknown }[] = [{ label: dirty ? `edit (${source})` : source === 'locked' ? `locked v${locked?.version}` : source, dir: clone(edited) }];
      if (dirty && source === 'locked' && locked) cols.push({ label: `locked v${locked.version}`, dir: clone(locked) });
      for (const n of compare) if (n !== source && cache[n]) cols.push({ label: n, dir: clone(cache[n]) });
      const r = await api.styleTile(cols, `${edited.id}: style tile (live, not saved)`);
      if (mine !== ticket) return;
      tile = r.tile; tileFailing = r.failing; tileLabels = cols.map(c => c.label);
    } catch (e) {
      if (mine === ticket) tileError = e instanceof Error ? e.message : String(e);
    } finally {
      if (mine === ticket) rendering = false;
    }
  }

  function change(fn: (d: Direction) => void) {
    if (!edited) return;
    fn(edited);
    schedule();
  }

  // ---- palette -----------------------------------------------------------------------------------------------------
  const ramps = $derived(edited ? Object.entries(edited.palette.ramps) : []);

  function setRamp(name: string, colors: string[]) { change(d => { d.palette.ramps[name] = colors; }); }

  function removeRamp(name: string) {
    change(d => {
      delete d.palette.ramps[name];
      for (const [k, v] of Object.entries(d.palette.materials)) if (v === name) delete d.palette.materials[k];
    });
  }

  function addRamp() {
    const n = newRamp.trim();
    if (!n || !edited || edited.palette.ramps[n]) return;
    change(d => { d.palette.ramps[n] = ['#c0c0c0', '#808080', '#404040']; });
    newRamp = '';
  }

  async function importPalette(e: Event) {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const text = await f.text(), colors = f.name.toLowerCase().endsWith('.gpl') ? parseGpl(text) : parseHexPalette(text);
    tray = colors.length ? { from: f.name, ramps: rampsFromColors(colors) } : null;
    if (!colors.length) tileError = `${f.name}: no colours found (expects Lospec .hex or GIMP .gpl)`;
  }

  async function onReference(image: LoadedImage) {
    const api = await project.sync(lease.api);
    const r = await api.extract(fromImageData(image.pixels), 16);
    tray = { from: image.filename, ramps: r.ramps };
  }

  function useTrayRamp(colors: string[], target: string) {
    if (!target) return;
    if (target === '+new') {
      let i = 1;
      while (edited?.palette.ramps[`ref${i}`]) i++;
      change(d => { d.palette.ramps[`ref${i}`] = [...colors]; });
    } else setRamp(target, [...colors]);
  }

  // ---- save / lock -------------------------------------------------------------------------------------------------
  async function saveDraft() {
    if (!edited) return;
    const name = draftName.trim();
    if (await project.saveDraft(lease.api, name, clone(edited))) source = name;
  }

  async function saveAndLock() {
    if (!edited) return;
    const name = draftName.trim();
    if (dirty || source === 'locked') {
      if (!(await project.saveDraft(lease.api, name, clone(edited)))) return;
    }
    const target = dirty || source === 'locked' ? name : source;
    if (!confirm(`Lock ${target} as ${locked ? `${locked.id} v${locked.version + 1}` : 'version 1'}?\n\nAnchors and art/direction.png are re-rendered. Approved assets go stale until Claude Code restyles them.`)) return;
    if (await project.lock(lease.api, target, lockNote.trim())) { source = 'locked'; lockNote = ''; }
  }

  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
  const val = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value;
  const scaleKeys = $derived(edited ? Object.keys(edited.scale).filter(k => k !== 'proportions') : []);
</script>

<div class="tool">
  <ProjectBar />

  {#if !project.files}
    <div class="empty">
      <h2>Art Direction</h2>
      <p>Open a game repo with an artgen <code>art/</code> folder to edit its direction: palette ramps, line, shading and scale, with a
        live style tile of the probe set. Save the edit as a draft, or lock it as the next direction version — the same files
        <code>/artgen-direction</code> writes, so Claude Code sees your changes on its next run.</p>
    </div>
  {:else if loadError}
    <p class="error" role="alert">{loadError}</p>
  {:else if !edited}
    <p class="empty">This project has no direction or candidates yet: run <code>/artgen-direction</code> in Claude Code first (it interviews you and
      writes three candidates and the probe set).</p>
  {:else}
    <div class="layout">
      <section class="form">
        <div class="row">
          <label>Edit
            <select value={source} onchange={e => pick(val(e))}>
              {#if locked}<option value="locked">locked: {locked.id} v{locked.version}</option>{/if}
              {#each candidates as c (c.name)}<option value={c.name} disabled={!!c.errors.length}>candidate {c.name}: {c.id} ({c.status})</option>{/each}
            </select>
          </label>
          {#if dirty}<span class="dirty">edited</span><button type="button" onclick={() => pick(source)}>Revert</button>{/if}
        </div>

        <h3>Palette</h3>
        <div class="ramps">
          {#each ramps as [name, colors] (name)}
            <PaletteRamp {name} {colors} hueShift={edited.shading.hueShift} onchange={c => setRamp(name, c)} onremove={() => removeRamp(name)} />
          {/each}
        </div>
        <div class="row">
          <input type="text" placeholder="new ramp name" bind:value={newRamp} onkeydown={e => e.key === 'Enter' && addRamp()} />
          <button type="button" onclick={addRamp} disabled={!newRamp.trim()}>Add ramp</button>
          <button type="button" onclick={() => paletteInput?.click()}>Import Lospec .hex / .gpl…</button>
          <input bind:this={paletteInput} type="file" accept=".hex,.gpl,.txt" hidden onchange={importPalette} />
          <button type="button" class:primary={showRef} onclick={() => (showRef = !showRef)}>Extract from image…</button>
        </div>
        {#if showRef}
          <div class="ref">
            <CanvasStage pixelMode onimageloaded={onReference} />
          </div>
        {/if}
        {#if tray}
          <div class="tray">
            <p class="dim">Ramps from {tray.from} — put one in place of a ramp:</p>
            {#each Object.entries(tray.ramps) as [k, colors] (k)}
              <div class="trayramp">
                <span>{#each colors as c (c)}<i style:background={c} title={c}></i>{/each}</span>
                <select onchange={e => { useTrayRamp(colors, val(e)); (e.currentTarget as HTMLSelectElement).value = ''; }}>
                  <option value="">use as…</option>
                  {#each ramps as [name] (name)}<option value={name}>{name}</option>{/each}
                  <option value="+new">a new ramp</option>
                </select>
              </div>
            {/each}
            <button type="button" class="link" onclick={() => (tray = null)}>close</button>
          </div>
        {/if}
        <div class="grid">
          <label>outline <input type="color" value={edited.palette.outline} oninput={e => change(d => { d.palette.outline = val(e); })} /></label>
          <label>shadow <input type="color" value={edited.palette.shadow.color} oninput={e => change(d => { d.palette.shadow.color = val(e); })} /></label>
          <label>shadow alpha <input type="number" min="0" max="1" step="0.05" value={edited.palette.shadow.alpha} onchange={e => change(d => { d.palette.shadow.alpha = num(e); })} /></label>
          <label>game background <input type="color" value={edited.background ?? '#202028'} oninput={e => change(d => { d.background = val(e); })} /></label>
        </div>

        <h3>Camera</h3>
        <div class="grid">
          <label>view
            <select value={edited.camera.view} onchange={e => change(d => { d.camera.view = val(e) as Direction['camera']['view']; })}>
              {#each VIEWS as v (v)}<option value={v}>{v}</option>{/each}
            </select>
          </label>
          <label>directions
            <select value={String(edited.camera.directions)} onchange={e => change(d => { d.camera.directions = num(e) as 1 | 4 | 8 | 16; })}>
              {#each [1, 4, 8, 16] as n (n)}<option value={String(n)}>{n}</option>{/each}
            </select>
          </label>
          <label>pixel scale <input type="number" min="1" max="8" value={edited.camera.pixelScale} onchange={e => change(d => { d.camera.pixelScale = num(e); })} /></label>
          {#each ['x', 'y', 'z'] as axis, i (axis)}
            <label>light {axis} <input type="number" step="0.25" min="-1" max="1" value={edited.camera.light[i]} onchange={e => change(d => { d.camera.light[i] = num(e); })} /></label>
          {/each}
        </div>

        <h3>Scale</h3>
        <div class="grid">
          {#each scaleKeys as k (k)}
            {@const v = edited.scale[k]}
            {#if typeof v === 'number'}
              <label>{k} <input type="number" min="1" value={v} onchange={e => change(d => { d.scale[k] = num(e); })} /></label>
            {:else if Array.isArray(v)}
              <label>{k}
                <span class="pair">
                  <input type="number" min="1" value={v[0]} onchange={e => change(d => { (d.scale[k] as number[])[0] = num(e); })} />×<input type="number" min="1" value={v[1]} onchange={e => change(d => { (d.scale[k] as number[])[1] = num(e); })} />
                </span>
              </label>
            {/if}
          {/each}
        </div>

        <h3>Line and shading</h3>
        <div class="grid">
          <label>outer line
            <select value={edited.line.outer} onchange={e => change(d => { d.line.outer = val(e) as Direction['line']['outer']; })}>
              {#each ['dark', 'selout', 'none'] as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          </label>
          <label>inner line
            <select value={edited.line.inner} onchange={e => change(d => { d.line.inner = val(e) as Direction['line']['inner']; })}>
              {#each ['none', 'selective', 'all'] as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          </label>
          <label>bands <input type="number" min="1" max="6" value={edited.shading.bands} onchange={e => change(d => { d.shading.bands = num(e); })} /></label>
          <label>hue shift <input type="number" min="0" max="60" value={edited.shading.hueShift} onchange={e => change(d => { d.shading.hueShift = num(e); })} /></label>
          <label>dither
            <select value={edited.shading.dither} onchange={e => change(d => { d.shading.dither = val(e) as Direction['shading']['dither']; })}>
              {#each ['none', 'bayer2', 'bayer4', 'noise'] as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          </label>
          <label>highlight
            <select value={edited.shading.highlight} onchange={e => change(d => { d.shading.highlight = val(e) as Direction['shading']['highlight']; })}>
              {#each ['none', 'sparing', 'rich'] as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          </label>
          <label>detail
            <select value={edited.detail.density} onchange={e => change(d => { d.detail.density = val(e) as Direction['detail']['density']; })}>
              {#each ['low', 'medium', 'high'] as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          </label>
          <label>min feature px <input type="number" min="1" max="6" value={edited.detail.minFeaturePx} onchange={e => change(d => { d.detail.minFeaturePx = num(e); })} /></label>
        </div>

        {#if errors.length}<ul class="errors">{#each errors as e (e)}<li>{e}</li>{/each}</ul>{/if}

        <h3>Save</h3>
        <div class="row">
          <label>draft name <input type="text" bind:value={draftName} size="10" /></label>
          <button type="button" onclick={saveDraft} disabled={!!errors.length || project.busy || !draftName.trim()}>Save draft</button>
        </div>
        <div class="row">
          <label class="grow">lock note <input type="text" bind:value={lockNote} placeholder="why this version (shown in the ledger)" /></label>
          <button type="button" class="primary" onclick={saveAndLock} disabled={!!errors.length || project.busy || (!dirty && source === 'locked')}>
            {dirty || source === 'locked' ? 'Save draft and lock' : `Lock ${source}`}
          </button>
        </div>
        <p class="dim small">Locking writes art/direction.json (version {locked ? locked.version + 1 : 1}), archives the old version in art/directions/,
          re-renders the anchors and art/direction.png. Then ask Claude Code to <code>/artgen-restyle</code>: approved assets go stale until it does.</p>
      </section>

      <section class="tile">
        <div class="row">
          <h3>Style tile</h3>
          {#if rendering}<span class="dim small">rendering…</span>{/if}
          <span class="compare">compare:
            {#each candidates.filter(c => !c.errors.length && c.name !== source) as c (c.name)}
              <label><input type="checkbox" checked={compare.includes(c.name)} onchange={e => { compare = (e.currentTarget as HTMLInputElement).checked ? [...compare, c.name] : compare.filter(n => n !== c.name); schedule(0); }} /> {c.name}</label>
            {/each}
          </span>
        </div>
        {#if !hasProbes}
          <p class="dim">No probe set in art/probes/ yet — the direction workflow in Claude Code writes it.</p>
        {:else if tileError}
          <p class="error">{tileError}</p>
        {:else if tile}
          <PixelPreview img={tile} scale={fitScale(tile, 1400, 2400, 2)} background="#16161c" label="probe set under {tileLabels.join(' · ')}" />
          {#each tileFailing as f, i (i)}
            {#if f.length}<p class="warn small">{tileLabels[i]}: gate fails — {f.join('; ')}</p>{/if}
          {/each}
        {/if}
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
    max-width: 44rem;
    color: var(--text-dim);
  }
  .empty h2 {
    color: var(--text);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(22rem, 30rem) 1fr;
    min-height: 0;
    flex: 1;
  }
  .form {
    overflow-y: auto;
    padding: 0.6rem 1rem 2rem;
    border-right: 1px solid var(--border);
  }
  .tile {
    overflow: auto;
    padding: 0.6rem 1rem 2rem;
  }
  h3 {
    font-size: 0.85rem;
    margin: 1rem 0 0.45rem;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    margin: 0.35rem 0;
  }
  .ramps {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: 0.45rem 0.7rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.76rem;
    color: var(--text-dim);
  }
  .row label {
    flex-direction: row;
    align-items: center;
    gap: 0.35rem;
  }
  .grow {
    flex: 1;
  }
  .grow input {
    flex: 1;
  }
  input[type='text'],
  input[type='number'],
  select {
    font: inherit;
    font-size: 0.85rem;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.25rem 0.4rem;
    min-width: 0;
  }
  .pair {
    display: flex;
    gap: 0.2rem;
    align-items: center;
  }
  .pair input {
    width: 3.6rem;
  }
  .ref {
    height: 280px;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    margin: 0.4rem 0;
  }
  .tray {
    border: 1px dashed var(--border);
    border-radius: 6px;
    padding: 0.45rem 0.6rem;
    margin: 0.4rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .trayramp {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .trayramp span {
    display: flex;
    gap: 2px;
    min-width: 8rem;
  }
  .trayramp i {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 2px;
  }
  .compare {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-left: auto;
  }
  .compare label {
    flex-direction: row;
    gap: 0.2rem;
  }
  .dirty {
    color: #ffd166;
    font-size: 0.8rem;
  }
  .errors,
  .error {
    color: #ffb4bb;
    font-size: 0.8rem;
  }
  .error {
    padding: 0.5rem 0.9rem;
    margin: 0;
  }
  .warn {
    color: #ffd166;
  }
  .dim {
    color: var(--text-dim);
  }
  .small {
    font-size: 0.75rem;
  }
  .link {
    background: none;
    border: none;
    color: var(--accent);
    padding: 0;
    align-self: flex-start;
    font-size: 0.78rem;
  }
</style>
