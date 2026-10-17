<script lang="ts">
  /**
   * Terrain Map: tabletop RPG maps (regional hex crawls, local battle maps). Generate terrain from a seed, shape it with
   * brushes (paint terrain, raise / lower ground, draw rivers and roads), add a grid, labels and symbols, and export
   * SVG or PNG in colour or black & white. The map is the artgen `map.json` the CLI and Claude Code use: open and save
   * it in a game repo's `art/maps/`, or download / open the file on its own. Rendering runs in the artgen worker.
   */
  import { onDestroy, onMount } from 'svelte';
  import { map } from 'artgen-core';
  import fontRegular from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Regular.ttf?url';
  import fontBold from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Bold.ttf?url';
  import fontItalic from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Italic.ttf?url';
  import { acquire } from '../../workers/workerRegistry';
  import type { ArtgenApi } from '../../workers/artgen.worker';
  import { project } from '../../core/project/store.svelte';
  import ProjectBar from '../../core/components/ProjectBar.svelte';
  import { downloadBlob, downloadText } from '../../core/utils/download';
  import MapView from './MapView.svelte';
  import { TerrainMapStore, type MapTool } from './store.svelte';

  const lease = acquire<ArtgenApi>('artgen');
  const store = new TerrainMapStore();
  const PREVIEW_PPU = 40;

  let svg = $state('');
  let info = $state<{ terrains: map.Terrain[]; rivers: number } | null>(null);
  let error = $state<string | null>(null);
  /** Why the last render failed (kept apart from action errors, which a later render must not hide). */
  let renderError = $state<string | null>(null);
  let rendering = $state(false);
  let pending = $state<number[]>([]);
  let projectMaps = $state<string[]>([]);
  let pickMap = $state('');
  let fileInput = $state<HTMLInputElement>();
  let view = $state<MapView>();

  const spec = $derived(store.spec);
  const shown = $derived(map.layersFor(spec, store.layers));

  const TOOLS: { id: MapTool; label: string; hint: string }[] = [
    { id: 'pan', label: 'Move', hint: 'drag to pan, wheel to zoom' },
    { id: 'paint', label: 'Terrain', hint: 'paint the chosen terrain' },
    { id: 'raise', label: 'Raise', hint: 'raise the ground (hills, ridges)' },
    { id: 'lower', label: 'Lower', hint: 'lower the ground (valleys, basins)' },
    { id: 'river', label: 'River', hint: 'click from the source down to the mouth; double-click or Enter to finish (it widens downstream and opens into the water it meets)' },
    { id: 'road', label: 'Road', hint: 'click points, double-click or Enter to finish' },
    { id: 'label', label: 'Label', hint: 'click to place the text below' },
    { id: 'symbol', label: 'Symbol', hint: 'click to place the symbol below' },
    { id: 'erase', label: 'Erase', hint: 'click a label or symbol to remove it' },
  ];
  const VIEW_LAYERS: map.MapLayer[] = ['terrain', 'rivers', 'roads', 'contours', 'grid', 'symbols', 'labels'];
  const GEN: { key: keyof map.MapSpec['gen']; label: string; min: number; max: number; step: number }[] = [
    { key: 'sea', label: 'water share', min: 0, max: 0.9, step: 0.01 },
    { key: 'moisture', label: 'moisture (dry → wet)', min: 0, max: 1, step: 0.01 },
    { key: 'relief', label: 'relief (flat → peaked)', min: 0, max: 1, step: 0.01 },
    { key: 'roughness', label: 'roughness', min: 0, max: 1, step: 0.01 },
    { key: 'feature', label: 'feature size (cells)', min: 2, max: 60, step: 1 },
    { key: 'rivers', label: 'rivers', min: 0, max: 20, step: 1 },
    { key: 'simplify', label: 'simplify (readability)', min: 0, max: 6, step: 1 },
  ];

  onMount(() => {
    // the preview SVG names the same font the PNG export embeds
    for (const [url, weight, style] of [[fontRegular, '400', 'normal'], [fontBold, '700', 'normal'], [fontItalic, '400', 'italic']] as const) {
      const face = new FontFace(map.FONT_FAMILY, `url(${url})`, { weight, style });
      void face.load().then(f => document.fonts.add(f)).catch(() => {});
    }
    window.addEventListener('keydown', onKeyDown);
  });
  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
    clearTimeout(timer);
    lease.release();
  });

  // re-render after every change (debounced; the newest request wins)
  let ticket = 0, timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const s = $state.snapshot(store.spec), theme = store.theme, layers = $state.snapshot(store.layers), mine = ++ticket;
    rendering = true;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const r = await lease.api.mapSvg(s, { theme, layers, ppu: PREVIEW_PPU });
        if (mine !== ticket) return;
        svg = r.svg; info = { terrains: r.terrains, rivers: r.rivers }; renderError = null;
      } catch (e) {
        if (mine === ticket) renderError = e instanceof Error ? e.message : String(e);
      } finally {
        if (mine === ticket) rendering = false;
      }
    }, 120);
  });

  $effect(() => {
    void project.revision;
    if (project.files) void project.mapIds().then(ids => { projectMaps = ids; if (!ids.includes(pickMap)) pickMap = ids[0] ?? ''; });
    else projectMaps = [];
  });

  function attempt(run: () => void) {
    try { run(); error = null; } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  function onKeyDown(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
      if (e.shiftKey) store.history.redo(); else store.history.undo();
      e.preventDefault();
    } else if (e.key === 'Enter' && pending.length && !typing) finishLine();
    else if (e.key === 'Escape') pending = [];
  }

  function setTool(t: MapTool) {
    store.tool = t;
    pending = [];
  }

  function onstroke(pts: number[]) {
    const r = store.brush, shape: map.Shape = pts.length <= 2 ? { circle: [pts[0], pts[1], r] } : { stroke: pts, width: r * 2 };
    attempt(() => {
      if (store.tool === 'paint') store.change(`paint ${store.terrain}`, m => { m.edits.push({ op: 'paint', terrain: store.terrain, shape }); });
      else store.change(store.tool, m => { m.edits.push({ op: 'elevate', amount: store.tool === 'lower' ? -store.strength : store.strength, shape }); });
    });
  }

  function onpoint(x: number, y: number) {
    const t = store.tool;
    if (x < 0 || y < 0 || x > spec.cols || y > spec.rows) return;
    if (t === 'river' || t === 'road') {
      const n = pending.length;
      // a double-click lands two clicks on the same spot: keep one
      if (!n || Math.hypot(x - pending[n - 2], y - pending[n - 1]) > 0.1) pending = [...pending, round(x), round(y)];
    } else if (t === 'label') {
      if (!store.labelText.trim()) { error = 'type the label text first'; return; }
      attempt(() => store.change('label', m => { m.overlay.labels.push({ text: store.labelText.trim(), x: round(x), y: round(y), kind: store.labelKind }); }));
    } else if (t === 'symbol') {
      attempt(() => store.change(`symbol ${store.symbol}`, m => { m.overlay.symbols.push({ kind: store.symbol, x: round(x), y: round(y) }); }));
    } else if (t === 'erase') {
      const near = (o: { x: number; y: number }) => Math.hypot(o.x - x, o.y - y);
      const s = spec.overlay.symbols.map((o, i) => [near(o), i] as const).sort((a, b) => a[0] - b[0])[0];
      const l = spec.overlay.labels.map((o, i) => [near(o), i] as const).sort((a, b) => a[0] - b[0])[0];
      if (s && s[0] < 0.8 && (!l || s[0] <= l[0])) removeSymbol(s[1]);
      else if (l && l[0] < 1.5) removeLabel(l[1]);
    }
  }

  function finishLine() {
    const t = store.tool, pts = [...pending];
    pending = [];
    if (pts.length < 4 || (t !== 'river' && t !== 'road')) return;
    attempt(() => store.change(t, m => { m.edits.push({ op: t, points: pts }); }));
  }

  const round = (v: number) => Math.round(v * 100) / 100;
  const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;
  const num = (e: Event) => Number(val(e));
  const checked = (e: Event) => (e.currentTarget as HTMLInputElement).checked;

  function setGen(key: keyof map.MapSpec['gen'], v: number | string) { attempt(() => store.change(`gen ${key}`, m => { (m.gen as Record<string, unknown>)[key] = v; })); }
  function removeEdit(i: number) { store.change('remove edit', m => { m.edits.splice(i, 1); }); }
  function removeLabel(i: number) { store.change('remove label', m => { m.overlay.labels.splice(i, 1); }); }
  function removeSymbol(i: number) { store.change('remove symbol', m => { m.overlay.symbols.splice(i, 1); }); }

  function newMap(preset: map.Preset) {
    if (store.dirty && !confirm('Start a new map? Unsaved changes to this one are lost.')) return;
    store.newMap(preset);
    pending = [];
  }

  async function openFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try { store.load(JSON.parse(await f.text())); error = null; } catch (err) { error = `${f.name}: ${err instanceof Error ? err.message : String(err)}`; }
  }

  async function openFromProject() {
    if (!pickMap) return;
    if (store.dirty && !confirm(`Open ${pickMap}? Unsaved changes to this map are lost.`)) return;
    const r = await project.readMap(pickMap);
    if (!r) { error = `art/maps/${pickMap}/map.json is gone`; return; }
    try { store.load(JSON.parse(r.text), { id: pickMap, stat: r.stat }); error = null; } catch (err) { error = err instanceof Error ? err.message : String(err); }
  }

  async function saveToProject(force = false) {
    const id = spec.id, base = store.source?.id === id ? store.source.stat : undefined;
    const stat = await project.saveMap(id, JSON.stringify($state.snapshot(store.spec), null, 2) + '\n', base, force);
    if (stat) { store.source = { id, stat }; store.dirty = false; projectMaps = await project.mapIds(); pickMap = id; }
    else if (project.error && confirm(`${project.error}\n\nOverwrite it?`)) await saveToProject(true);
  }

  function downloadJson() {
    downloadText(JSON.stringify($state.snapshot(store.spec), null, 2) + '\n', `${spec.id}.map.json`, 'application/json');
    store.dirty = false;
  }

  async function exportImage(kind: 'svg' | 'png', theme: map.ThemeName) {
    const s = $state.snapshot(store.spec), layers = $state.snapshot(store.layers), ppu = store.exportPpu;
    try {
      if (kind === 'svg') downloadText((await lease.api.mapSvg(s, { theme, layers, ppu })).svg, `${spec.id}.${theme}.svg`, 'image/svg+xml');
      else downloadBlob(new Blob([(await lease.api.mapPng(s, { theme, layers, ppu })) as BlobPart], { type: 'image/png' }), `${spec.id}.${theme}.png`);
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
</script>

<div class="tool">
  <ProjectBar>
    {#if project.files}
      <select bind:value={pickMap} disabled={!projectMaps.length} title="maps in art/maps">
        {#each projectMaps as id (id)}<option value={id}>{id}</option>{:else}<option value="">no maps yet</option>{/each}
      </select>
      <button type="button" onclick={openFromProject} disabled={!pickMap}>Open</button>
      <button type="button" class="primary" onclick={() => saveToProject()} title="write art/maps/{spec.id}/map.json">Save to project</button>
    {/if}
  </ProjectBar>
  {#if error ?? renderError}<p class="error" role="alert">{error ?? renderError}</p>{/if}
  <div class="layout">
    <section class="controls">
      <h3>Map</h3>
      <div class="pair">
        <button type="button" onclick={() => newMap('regional')} title="hex crawl: 6-mile hexes">New regional</button>
        <button type="button" onclick={() => newMap('local')} title="battle map: 5-foot squares">New local</button>
      </div>
      <div class="pair">
        <button type="button" onclick={() => fileInput?.click()}>Open file…</button>
        <button type="button" onclick={downloadJson}>Download map.json</button>
      </div>
      <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={openFile} />
      <label>id <input type="text" value={spec.id} onchange={e => attempt(() => store.change('id', m => { m.id = val(e).trim(); }))} /></label>
      <label>title <input type="text" value={spec.title ?? ''} placeholder="(none)" onchange={e => attempt(() => store.change('title', m => { const t = val(e).trim(); if (t) m.title = t; else delete m.title; }))} /></label>
      <div class="pair">
        <label>columns <input type="number" min="4" max={map.MAX_SIDE} value={spec.cols} onchange={e => attempt(() => store.change('size', m => { m.cols = num(e); }))} /></label>
        <label>rows <input type="number" min="4" max={map.MAX_SIDE} value={spec.rows} onchange={e => attempt(() => store.change('size', m => { m.rows = num(e); }))} /></label>
      </div>
      <p class="dim small">{spec.preset} · {spec.grid.type === 'hex' ? 'hex' : 'cell'} = {spec.scale.perCell} {spec.scale.unit}{store.source ? ` · art/maps/${store.source.id}` : ''}{store.dirty ? ' · unsaved' : ''}</p>

      <h3>Terrain</h3>
      <div class="pair">
        <label>seed <input type="number" value={spec.seed} onchange={e => attempt(() => store.change('seed', m => { m.seed = num(e); }))} /></label>
        <label>&nbsp;<button type="button" onclick={() => store.reseed()} title="a new world with the same settings">New seed</button></label>
      </div>
      <label>land
        <select value={spec.gen.land} onchange={e => setGen('land', val(e))}>
          <option value="mixed">mixed (coast, lakes)</option><option value="island">island</option><option value="inland">inland (lakes only)</option>
        </select>
      </label>
      {#each GEN as g (g.key)}
        <label>{g.label} <span class="v">{spec.gen[g.key]}</span>
          <input type="range" min={g.min} max={g.max} step={g.step} value={spec.gen[g.key]} onchange={e => setGen(g.key, num(e))} />
        </label>
      {/each}

      <h3>Contours</h3>
      <div class="pair">
        <label>every ({spec.topo.unit}) <input type="number" min="1" value={spec.topo.interval} onchange={e => attempt(() => store.change('contours', m => { m.topo.interval = num(e); }))} /></label>
        <label>top ({spec.topo.unit}) <input type="number" min="1" value={spec.topo.maxElevation} onchange={e => attempt(() => store.change('contours', m => { m.topo.maxElevation = num(e); }))} /></label>
      </div>
      <div class="pair">
        <label>major every <input type="number" min="1" value={spec.topo.majorEvery} onchange={e => attempt(() => store.change('contours', m => { m.topo.majorEvery = num(e); }))} /></label>
        <label class="inline lift"><input type="checkbox" checked={spec.topo.labels} onchange={e => store.change('contour labels', m => { m.topo.labels = checked(e); })} /> heights</label>
      </div>

      <h3>Grid</h3>
      <div class="pair">
        <label>type
          <select value={spec.grid.type} onchange={e => attempt(() => store.change('grid', m => { m.grid.type = val(e) as map.GridType; }))}>
            <option value="none">none</option><option value="square">square</option><option value="hex">hex</option>
          </select>
        </label>
        <label>size (cells) <input type="number" min="0.25" step="0.25" value={spec.grid.size} onchange={e => attempt(() => store.change('grid', m => { m.grid.size = num(e); }))} /></label>
      </div>
      <div class="pair">
        <label class="inline"><input type="checkbox" checked={spec.grid.coords} onchange={e => store.change('grid', m => { m.grid.coords = checked(e); })} /> coordinates</label>
        <label>1 cell = <span class="row"><input type="number" min="0" value={spec.scale.perCell} onchange={e => attempt(() => store.change('scale', m => { m.scale.perCell = num(e); }))} /><input type="text" class="unit" value={spec.scale.unit} onchange={e => attempt(() => store.change('scale', m => { m.scale.unit = val(e); }))} /></span></label>
      </div>
      <div class="checks">
        <label class="inline"><input type="checkbox" checked={spec.legend} onchange={e => store.change('legend', m => { m.legend = checked(e); })} /> legend</label>
        <label class="inline"><input type="checkbox" checked={spec.scaleBar} onchange={e => store.change('scale bar', m => { m.scaleBar = checked(e); })} /> scale bar</label>
        <label class="inline"><input type="checkbox" checked={spec.compass} onchange={e => store.change('compass', m => { m.compass = checked(e); })} /> compass</label>
      </div>

      <h3>Edits ({spec.edits.length})</h3>
      <ul class="items">
        {#each spec.edits as ed, i (i)}
          <li><span>{i + 1}. {ed.op}{ed.op === 'paint' ? ` ${map.TERRAIN_NAMES[ed.terrain].toLowerCase()}` : ed.op === 'elevate' ? (ed.amount > 0 ? ' up' : ' down') : ''}</span><button type="button" class="x" onclick={() => removeEdit(i)} title="remove">×</button></li>
        {:else}<li class="dim small">none — the terrain is all generated</li>{/each}
      </ul>
      <h3>Labels and symbols</h3>
      <ul class="items">
        {#each spec.overlay.labels as l, i (i)}
          <li><input type="text" value={l.text} onchange={e => attempt(() => store.change('label text', m => { m.overlay.labels[i].text = val(e); }))} /><span class="dim small">{l.kind}</span><button type="button" class="x" onclick={() => removeLabel(i)} title="remove">×</button></li>
        {/each}
        {#each spec.overlay.symbols as s, i (i)}
          <li><span>{map.SYMBOLS[s.kind]?.name ?? s.kind}</span><span class="dim small">{s.x}, {s.y}</span><button type="button" class="x" onclick={() => removeSymbol(i)} title="remove">×</button></li>
        {/each}
        {#if !spec.overlay.labels.length && !spec.overlay.symbols.length}<li class="dim small">none yet — use the Label and Symbol tools</li>{/if}
      </ul>
    </section>

    <section class="main">
      <div class="toolbar">
        {#each TOOLS as t (t.id)}
          <button type="button" class:primary={store.tool === t.id} onclick={() => setTool(t.id)} title={t.hint}>{t.label}</button>
        {/each}
        <span class="sep"></span>
        <button type="button" onclick={() => store.history.undo()} disabled={!store.history.canUndo} title="Ctrl+Z">Undo</button>
        <button type="button" onclick={() => store.history.redo()} disabled={!store.history.canRedo} title="Ctrl+Shift+Z">Redo</button>
        <button type="button" onclick={() => view?.fit()}>Fit</button>
        <span class="sep"></span>
        <div class="seg" role="group" aria-label="theme">
          <button type="button" class:primary={store.theme === 'color'} onclick={() => (store.theme = 'color')}>Colour</button>
          <button type="button" class:primary={store.theme === 'bw'} onclick={() => (store.theme = 'bw')}>B&amp;W</button>
        </div>
      </div>
      <div class="toolopts">
        {#if store.tool === 'paint'}
          <label class="inline">terrain
            <select bind:value={store.terrain}>{#each map.TERRAINS as t (t)}<option value={t}>{map.TERRAIN_NAMES[t]}</option>{/each}</select>
          </label>
        {/if}
        {#if store.tool === 'paint' || store.tool === 'raise' || store.tool === 'lower'}
          <label class="inline">brush <input type="range" min="0.25" max="8" step="0.25" bind:value={store.brush} /> <span class="v">{store.brush}</span></label>
        {/if}
        {#if store.tool === 'raise' || store.tool === 'lower'}
          <label class="inline">strength <input type="range" min="0.05" max="1" step="0.05" bind:value={store.strength} /> <span class="v">{store.strength}</span></label>
        {/if}
        {#if store.tool === 'label'}
          <label class="inline">text <input type="text" bind:value={store.labelText} /></label>
          <label class="inline">kind
            <select bind:value={store.labelKind}><option value="region">region</option><option value="place">place</option><option value="water">water</option><option value="note">note</option></select>
          </label>
        {/if}
        {#if store.tool === 'symbol'}
          <label class="inline">symbol
            <select bind:value={store.symbol}>{#each map.SYMBOL_KINDS as k (k)}<option value={k}>{map.SYMBOLS[k].name}</option>{/each}</select>
          </label>
        {/if}
        {#if (store.tool === 'river' || store.tool === 'road') && pending.length}
          <button type="button" onclick={finishLine}>Finish {store.tool}</button>
          <button type="button" onclick={() => (pending = [])}>Cancel</button>
        {/if}
        <span class="dim small">{TOOLS.find(t => t.id === store.tool)?.hint}</span>
      </div>
      <div class="stage">
        <MapView bind:this={view} {svg} cols={spec.cols} rows={spec.rows} ppu={PREVIEW_PPU} tool={store.tool} brush={store.brush} {pending} {onstroke} {onpoint} onfinish={finishLine} />
      </div>
      <div class="footer">
        <span class="layers">
          {#each VIEW_LAYERS as l (l)}
            <label class="inline"><input type="checkbox" checked={shown[l]} onchange={e => (store.layers = { ...store.layers, [l]: checked(e) })} /> {l}</label>
          {/each}
        </span>
        <span class="export">
          <label class="inline">px / cell <input type="number" min="8" max="200" bind:value={store.exportPpu} /></label>
          <button type="button" onclick={() => exportImage('png', store.theme)}>PNG</button>
          <button type="button" onclick={() => exportImage('svg', store.theme)}>SVG</button>
          <button type="button" onclick={() => exportImage('png', store.theme === 'color' ? 'bw' : 'color')}>PNG ({store.theme === 'color' ? 'B&W' : 'colour'})</button>
        </span>
        <span class="dim small status">{rendering ? 'rendering…' : info ? `${spec.cols * store.exportPpu}×${spec.rows * store.exportPpu} px · ${info.terrains.length} terrains${info.rivers ? ` · ${info.rivers} rivers` : ''}` : ''}</span>
      </div>
    </section>
  </div>
</div>

<style>
  .tool {
    display: flex;
    flex-direction: column;
    height: 100%;
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
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .toolbar,
  .toolopts,
  .footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.8rem;
    border-bottom: 1px solid var(--border);
  }
  .toolopts {
    min-height: 2.6rem;
  }
  .footer {
    border-bottom: 0;
    border-top: 1px solid var(--border);
    justify-content: space-between;
  }
  .stage {
    flex: 1;
    min-height: 0;
  }
  .sep {
    width: 1px;
    height: 1.4rem;
    background: var(--border);
    margin: 0 0.2rem;
  }
  .seg {
    display: flex;
  }
  .seg button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .seg button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .layers,
  .export,
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    align-items: center;
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
  label.lift {
    align-self: flex-end;
    padding-bottom: 0.3rem;
  }
  .toolopts input[type='range'] {
    width: 8rem;
  }
  .v {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .pair {
    display: flex;
    gap: 0.6rem;
  }
  .pair > label,
  .pair > button {
    flex: 1;
    min-width: 0;
  }
  .pair input,
  .pair select {
    width: 100%;
  }
  .row {
    display: flex;
    gap: 0.3rem;
  }
  .row .unit {
    width: 3.5rem;
    flex: none;
  }
  select,
  input[type='number'],
  input[type='text'] {
    font: inherit;
    font-size: 0.85rem;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.25rem 0.4rem;
    min-width: 0;
  }
  .export input[type='number'] {
    width: 4.5rem;
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
  }
  .items li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .items li > span:first-child,
  .items li > input {
    flex: 1;
    min-width: 0;
  }
  .x {
    padding: 0 0.45rem;
    line-height: 1.3;
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
