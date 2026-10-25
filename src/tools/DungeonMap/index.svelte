<script lang="ts">
  /**
   * Dungeon Map: tabletop RPG dungeons and lairs in black and white. Make one room (with exits running off the map) or
   * generate a whole complex from a seed, then draw: drag out rooms, click corners for an odd-shaped room, link rooms
   * with corridors, set doors, move rooms, add a grid (any size, with a sub-grid), numbers, labels and symbols, and export SVG or PNG.
   * The dungeon is the artgen `dungeon.json` the CLI and Claude Code use: open and save it in a game repo's
   * `art/dungeons/`, or download / open the file on its own. Rendering runs in the artgen worker.
   */
  import { onDestroy, onMount } from 'svelte';
  import { dungeon, map } from 'artgen-core';
  import fontRegular from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Regular.ttf?url';
  import fontBold from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Bold.ttf?url';
  import fontItalic from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Italic.ttf?url';
  import { acquire } from '../../workers/workerRegistry';
  import type { ArtgenApi } from '../../workers/artgen.worker';
  import { project } from '../../core/project/store.svelte';
  import ProjectBar from '../../core/components/ProjectBar.svelte';
  import MapView from '../../core/components/MapView.svelte';
  import { downloadBlob, downloadText } from '../../core/utils/download';
  import { DungeonMapStore, type DungeonTool, type Side } from './store.svelte';

  const lease = acquire<ArtgenApi>('artgen');
  const store = new DungeonMapStore();
  const PREVIEW_PPU = 40;

  let svg = $state('');
  let info = $state<{ rooms: number; corridors: number; doors: number } | null>(null);
  let error = $state<string | null>(null);
  /** Why the last render failed (kept apart from action errors, which a later render must not hide). */
  let renderError = $state<string | null>(null);
  let rendering = $state(false);
  /** Poly corners placed so far, or a link's first end. */
  let pending = $state<number[]>([]);
  let linkFrom = $state<dungeon.CorridorEnd | null>(null);
  let projectDungeons = $state<string[]>([]);
  let pick = $state('');
  let fileInput = $state<HTMLInputElement>();
  let view = $state<MapView>();

  const spec = $derived(store.spec);
  const layout = $derived(dungeon.layoutDungeon(spec));
  const shown = $derived(dungeon.dungeonLayersFor(spec, store.layers));
  const selectedRoom = $derived(spec.rooms.find(r => r.id === store.selected) ?? null);

  const TOOLS: { id: DungeonTool; label: string; hint: string }[] = [
    { id: 'pan', label: 'Pan', hint: 'drag to pan, wheel to zoom' },
    { id: 'select', label: 'Select', hint: 'click a room to select it; drag a room to move it' },
    { id: 'room', label: 'Room', hint: 'drag out a room of the chosen shape' },
    { id: 'poly', label: 'Odd room', hint: 'click the corners of a room; double-click or Enter to finish' },
    { id: 'link', label: 'Corridor', hint: 'click a room, then another room (or empty floor for an exit or dead end)' },
    { id: 'door', label: 'Door', hint: 'click where a corridor meets a room to change its door' },
    { id: 'label', label: 'Label', hint: 'click to place the text below' },
    { id: 'symbol', label: 'Symbol', hint: 'click to place the symbol below' },
    { id: 'erase', label: 'Erase', hint: 'click a label, symbol, corridor or room to remove it' },
  ];
  const VIEW_LAYERS: dungeon.DungeonLayer[] = ['rock', 'grid', 'doors', 'symbols', 'numbers', 'labels'];
  const GEN: { key: 'rooms' | 'minSize' | 'maxSize' | 'caves' | 'round' | 'loops' | 'doors' | 'corridorWidth' | 'spacing'; label: string; min: number; max: number; step: number }[] = [
    { key: 'rooms', label: 'rooms', min: 1, max: 40, step: 1 },
    { key: 'minSize', label: 'smallest room (cells)', min: 1, max: 20, step: 1 },
    { key: 'maxSize', label: 'largest room (cells)', min: 1, max: 30, step: 1 },
    { key: 'caves', label: 'caves', min: 0, max: 1, step: 0.05 },
    { key: 'round', label: 'round rooms', min: 0, max: 1, step: 0.05 },
    { key: 'loops', label: 'loops', min: 0, max: 1, step: 0.05 },
    { key: 'doors', label: 'doors', min: 0, max: 1, step: 0.05 },
    { key: 'corridorWidth', label: 'corridor width (cells)', min: 1, max: 4, step: 1 },
    { key: 'spacing', label: 'space between rooms', min: 0, max: 6, step: 1 },
  ];
  const SIDES: [Side, string][] = [['n', 'north'], ['e', 'east'], ['s', 'south'], ['w', 'west']];

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
    const s = $state.snapshot(store.spec), layers = $state.snapshot(store.layers), mine = ++ticket;
    rendering = true;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const r = await lease.api.dungeonSvg(s, { layers, ppu: PREVIEW_PPU });
        if (mine !== ticket) return;
        svg = r.svg; info = { rooms: r.rooms, corridors: r.corridors, doors: r.doors }; renderError = null;
      } catch (e) {
        if (mine === ticket) renderError = e instanceof Error ? e.message : String(e);
      } finally {
        if (mine === ticket) rendering = false;
      }
    }, 100);
  });

  $effect(() => {
    void project.revision;
    if (project.files) void project.dungeonIds().then(ids => { projectDungeons = ids; if (!ids.includes(pick)) pick = ids[0] ?? ''; });
    else projectDungeons = [];
  });

  function attempt(run: () => void) {
    try { run(); error = null; } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  function onKeyDown(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
      if (e.shiftKey) store.history.redo(); else store.history.undo();
      e.preventDefault();
    } else if (e.key === 'Enter' && store.tool === 'poly' && pending.length && !typing) finishPoly();
    else if (e.key === 'Escape') cancelLine();
    else if ((e.key === 'Delete' || e.key === 'Backspace') && store.selected && !typing) removeRoom(store.selected);
  }

  function setTool(t: DungeonTool) {
    store.tool = t;
    cancelLine();
  }

  function cancelLine() { pending = []; linkFrom = null; }

  const round = (v: number) => Math.round(v * 100) / 100;
  /** The middle of the cell a point falls in (where a 1-wide corridor or a symbol sits tidily). */
  const cellMid = (v: number) => Math.floor(v) + 0.5;
  const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;
  const num = (e: Event) => Number(val(e));
  const checked = (e: Event) => (e.currentTarget as HTMLInputElement).checked;
  const doorOf = (v: string): dungeon.DoorKind | null => (v === 'none' ? null : (v as dungeon.DoorKind));

  /** The room under a point (the last drawn, so the one on top). */
  function roomAt(x: number, y: number): dungeon.RoomGeom | undefined {
    return [...layout.rooms].reverse().find(g => dungeon.inPolygon(g.outline, x, y));
  }

  function segDistance(pts: number[], x: number, y: number): number {
    let d = Infinity;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3], L = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = L ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L)) : 0;
      d = Math.min(d, Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)));
    }
    return d;
  }

  function ondrag(x0: number, y0: number, x1: number, y1: number) {
    if (store.tool === 'room') {
      const x = Math.floor(Math.min(x0, x1)), y = Math.floor(Math.min(y0, y1)), w = Math.ceil(Math.max(x0, x1)) - x, h = Math.ceil(Math.max(y0, y1)) - y;
      if (w < 1 || h < 1) return;
      attempt(() => store.change(`add ${store.roomShape} room`, m => {
        const id = dungeon.nextRoomId(m);
        m.rooms.push({ id, shape: store.roomShape, x, y, w, h });
        store.selected = id;
      }));
    } else if (store.tool === 'select') {
      const g = roomAt(x0, y0), dx = Math.round(x1 - x0), dy = Math.round(y1 - y0);
      if (!g || (!dx && !dy)) return;
      store.selected = g.room.id;
      attempt(() => store.change(`move ${g.room.id}`, m => {
        const r = m.rooms.find(r => r.id === g.room.id)!;
        r.x += dx; r.y += dy;
        if (r.points) r.points = r.points.map((v, i) => v + (i % 2 ? dy : dx));
      }));
    }
  }

  function onpoint(x: number, y: number) {
    const t = store.tool;
    if (t === 'select') { store.selected = roomAt(x, y)?.room.id ?? null; return; }
    if (t === 'poly') {
      const px = Math.round(x), py = Math.round(y), n = pending.length;
      // a double-click lands two clicks on the same corner: keep one
      if (!n || px !== pending[n - 2] || py !== pending[n - 1]) pending = [...pending, px, py];
      return;
    }
    if (t === 'link') {
      const g = roomAt(x, y), end: dungeon.CorridorEnd = g ? { room: g.room.id } : { at: [cellMid(x), cellMid(y)] };
      if (!linkFrom) {
        if (!g) { error = 'start a corridor in a room'; return; }
        linkFrom = end; pending = [g.cx, g.cy]; error = null;
        return;
      }
      const from = $state.snapshot(linkFrom);
      cancelLine();
      if ('room' in end && 'room' in from && end.room === from.room) return;
      attempt(() => store.change('add corridor', m => {
        m.corridors.push({ from, to: end, ...(store.linkWidth !== 1 && { width: store.linkWidth }), doors: [doorOf(store.linkDoors[0]), doorOf(store.linkDoors[1])] });
      }));
      return;
    }
    if (t === 'door') {
      const hit = layout.corridors.flatMap(c => c.ends.map((e, end) => ({ c: c.index, end, d: e ? Math.hypot(e.x - x, e.y - y) : Infinity })))
        .sort((a, b) => a.d - b.d)[0];
      if (!hit || hit.d > 1.2) { error = 'click where a corridor meets a room'; return; }
      attempt(() => store.change('door', m => {
        const c = m.corridors[hit.c], d = c.doors ?? [null, null], order = [null, ...dungeon.DOOR_KINDS];
        const next = order[(order.indexOf(d[hit.end]) + 1) % order.length];
        c.doors = hit.end === 0 ? [next, d[1]] : [d[0], next];
      }));
      return;
    }
    if (t === 'label') {
      if (!store.labelText.trim()) { error = 'type the label text first'; return; }
      attempt(() => store.change('label', m => { m.overlay.labels.push({ text: store.labelText.trim(), x: round(x), y: round(y), kind: store.labelKind }); }));
      return;
    }
    if (t === 'symbol') {
      attempt(() => store.change(`symbol ${store.symbol}`, m => { m.overlay.symbols.push({ kind: store.symbol, x: cellMid(x), y: cellMid(y), ...(store.symbolAngle && { angle: store.symbolAngle }) }); }));
      return;
    }
    if (t === 'erase') {
      const near = (o: { x: number; y: number }) => Math.hypot(o.x - x, o.y - y);
      const s = spec.overlay.symbols.map((o, i) => [near(o), i] as const).sort((a, b) => a[0] - b[0])[0];
      const l = spec.overlay.labels.map((o, i) => [near(o), i] as const).sort((a, b) => a[0] - b[0])[0];
      const c = layout.corridors.map(c => [segDistance(c.pts, x, y) - c.width / 2, c.index] as const).sort((a, b) => a[0] - b[0])[0];
      const room = roomAt(x, y);
      if (s && s[0] < 0.7 && (!l || s[0] <= l[0])) removeSymbol(s[1]);
      else if (l && l[0] < 1.2) removeLabel(l[1]);
      else if (c && c[0] < 0.3 && !room) removeCorridor(c[1]);
      else if (room) removeRoom(room.room.id);
      else if (c && c[0] < 0.3) removeCorridor(c[1]);
    }
  }

  function finishPoly() {
    const pts = [...pending];
    cancelLine();
    if (pts.length < 6) { if (pts.length) error = 'an odd-shaped room needs at least three corners'; return; }
    attempt(() => store.change('add room', m => {
      const id = dungeon.nextRoomId(m);
      m.rooms.push({ id, shape: 'poly', points: pts, ...dungeon.polyBox(pts) });
      store.selected = id;
    }));
  }

  function removeRoom(id: string) {
    store.change(`remove ${id}`, m => {
      m.rooms = m.rooms.filter(r => r.id !== id);
      m.corridors = m.corridors.filter(c => !(('room' in c.from && c.from.room === id) || ('room' in c.to && c.to.room === id)));
    });
    if (store.selected === id) store.selected = null;
  }
  function removeCorridor(i: number) { store.change('remove corridor', m => { m.corridors.splice(i, 1); }); }
  function removeLabel(i: number) { store.change('remove label', m => { m.overlay.labels.splice(i, 1); }); }
  function removeSymbol(i: number) { store.change('remove symbol', m => { m.overlay.symbols.splice(i, 1); }); }
  function setRoom(id: string, label: string, edit: (r: dungeon.Room) => void) { attempt(() => store.change(label, m => { edit(m.rooms.find(r => r.id === id)!); })); }
  function setGen(key: keyof dungeon.DungeonSpec['gen'], v: number | boolean) { attempt(() => store.change(`gen ${key}`, m => { (m.gen as Record<string, unknown>)[key] = v; })); }
  function setDoor(i: number, end: 0 | 1, v: string) { store.change('door', m => { const c = m.corridors[i], d = c.doors ?? [null, null]; c.doors = end === 0 ? [doorOf(v), d[1]] : [d[0], doorOf(v)]; }); }

  const grid = $derived(dungeon.gridInUnits(spec));
  function setGrid(o: { size?: number; sub?: boolean; show?: boolean }) {
    attempt(() => store.change('grid', m => { m.grid = dungeon.gridFromUnits(m, o); }));
  }

  const endName = (e: dungeon.CorridorEnd) => ('room' in e ? e.room : 'exit');

  function fresh(kind: 'generated' | 'empty' | 'room') {
    if (store.dirty && !confirm('Start a new dungeon? Unsaved changes to this one are lost.')) return;
    attempt(() => store.fresh(kind));
    cancelLine();
  }

  function regenerate() {
    if (spec.rooms.length && !confirm('Lay out every room and corridor again? (Undo brings this layout back.)')) return;
    attempt(() => store.regenerate());
  }

  async function openFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try { store.load(JSON.parse(await f.text())); error = null; } catch (err) { error = `${f.name}: ${err instanceof Error ? err.message : String(err)}`; }
  }

  async function openFromProject() {
    if (!pick) return;
    if (store.dirty && !confirm(`Open ${pick}? Unsaved changes to this dungeon are lost.`)) return;
    const r = await project.readDungeon(pick);
    if (!r) { error = `art/dungeons/${pick}/dungeon.json is gone`; return; }
    try { store.load(JSON.parse(r.text), { id: pick, stat: r.stat }); error = null; } catch (err) { error = err instanceof Error ? err.message : String(err); }
  }

  async function saveToProject(force = false) {
    const id = spec.id, base = store.source?.id === id ? store.source.stat : undefined;
    const stat = await project.saveDungeon(id, JSON.stringify($state.snapshot(store.spec), null, 2) + '\n', base, force);
    if (stat) { store.source = { id, stat }; store.dirty = false; projectDungeons = await project.dungeonIds(); pick = id; }
    else if (project.error && confirm(`${project.error}\n\nOverwrite it?`)) await saveToProject(true);
  }

  function downloadJson() {
    downloadText(JSON.stringify($state.snapshot(store.spec), null, 2) + '\n', `${spec.id}.dungeon.json`, 'application/json');
    store.dirty = false;
  }

  async function exportImage(kind: 'svg' | 'png') {
    const s = $state.snapshot(store.spec), layers = $state.snapshot(store.layers), ppu = store.exportPpu;
    try {
      if (kind === 'svg') downloadText((await lease.api.dungeonSvg(s, { layers, ppu })).svg, `${spec.id}.svg`, 'image/svg+xml');
      else downloadBlob(new Blob([(await lease.api.dungeonPng(s, { layers, ppu })) as BlobPart], { type: 'image/png' }), `${spec.id}.png`);
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
</script>

<div class="tool">
  <ProjectBar>
    {#if project.files}
      <select bind:value={pick} disabled={!projectDungeons.length} title="dungeons in art/dungeons">
        {#each projectDungeons as id (id)}<option value={id}>{id}</option>{:else}<option value="">no dungeons yet</option>{/each}
      </select>
      <button type="button" onclick={openFromProject} disabled={!pick}>Open</button>
      <button type="button" class="primary" onclick={() => saveToProject()} title="write art/dungeons/{spec.id}/dungeon.json">Save to project</button>
    {/if}
  </ProjectBar>
  {#if error ?? renderError}<p class="error" role="alert">{error ?? renderError}</p>{/if}
  <div class="layout">
    <section class="controls">
      <h3>Dungeon</h3>
      <div class="pair">
        <button type="button" onclick={() => fresh('generated')} title="rooms and corridors from a new seed">New dungeon</button>
        <button type="button" onclick={() => fresh('empty')} title="an empty map to draw rooms on">New empty</button>
      </div>
      <div class="pair">
        <button type="button" onclick={() => fileInput?.click()}>Open file…</button>
        <button type="button" onclick={downloadJson}>Download .json</button>
      </div>
      <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={openFile} />
      <label>id <input type="text" value={spec.id} onchange={e => attempt(() => store.change('id', m => { m.id = val(e).trim(); }))} /></label>
      <label>title <input type="text" value={spec.title ?? ''} placeholder="(none)" onchange={e => attempt(() => store.change('title', m => { const t = val(e).trim(); if (t) m.title = t; else delete m.title; }))} /></label>
      <div class="pair">
        <label>columns <input type="number" min="4" max={dungeon.MAX_SIDE} value={spec.cols} onchange={e => attempt(() => store.change('size', m => { m.cols = num(e); }))} /></label>
        <label>rows <input type="number" min="4" max={dungeon.MAX_SIDE} value={spec.rows} onchange={e => attempt(() => store.change('size', m => { m.rows = num(e); }))} /></label>
      </div>
      <button type="button" onclick={() => attempt(() => store.change('fit', m => dungeon.fitDungeon(m, 2)))} title="crop the map to the rooms, 2 cells around">Fit map to rooms</button>
      <p class="dim small">1 square = {spec.scale.perCell} {spec.scale.unit}{store.source ? ` · art/dungeons/${store.source.id}` : ''}{store.dirty ? ' · unsaved' : ''}</p>

      <h3>One room</h3>
      <div class="pair">
        <label>shape
          <select bind:value={store.single.shape}>{#each ['rect', 'circle', 'octagon', 'cave'] as s (s)}<option value={s}>{s}</option>{/each}</select>
        </label>
        <label>width <input type="number" min="1" max="60" bind:value={store.single.w} /></label>
        <label>height <input type="number" min="1" max="60" bind:value={store.single.h} /></label>
      </div>
      <div class="pair">
        <label>name <input type="text" bind:value={store.single.label} placeholder="(none)" /></label>
        <label>number <input type="number" min="0" bind:value={store.single.number} title="0: no number" /></label>
      </div>
      <div class="exits">
        {#each SIDES as [side, name] (side)}
          <label class="inline">{name}
            <select bind:value={store.single.exits[side]}>
              <option value="off">no exit</option><option value="none">opening</option>
              {#each dungeon.DOOR_KINDS as k (k)}<option value={k}>{dungeon.DOOR_NAMES[k].toLowerCase()}</option>{/each}
            </select>
          </label>
        {/each}
      </div>
      <button type="button" onclick={() => fresh('room')}>Make this room</button>

      <h3>Generator</h3>
      <div class="pair">
        <label>seed <input type="number" value={spec.seed} onchange={e => attempt(() => store.change('seed', m => { m.seed = num(e); return dungeon.generateDungeon(m); }))} /></label>
        <label>&nbsp;<button type="button" onclick={regenerate} title="a new layout with these settings (replaces rooms and corridors)">Generate</button></label>
      </div>
      {#each GEN as g (g.key)}
        <label>{g.label} <span class="v">{spec.gen[g.key]}</span>
          <input type="range" min={g.min} max={g.max} step={g.step} value={spec.gen[g.key]} onchange={e => setGen(g.key, num(e))} />
        </label>
      {/each}
      <label class="inline"><input type="checkbox" checked={spec.gen.entrance} onchange={e => setGen('entrance', checked(e))} /> entrance off the map edge</label>
      <p class="dim small">Settings apply on the next Generate.</p>

      <h3>Look</h3>
      <div class="pair">
        <label>grid size <input type="number" min={spec.scale.perCell} step={spec.scale.perCell} value={grid.size} disabled={!grid.show} onchange={e => setGrid({ size: num(e) })} title="a whole number of squares" /></label>
        <label>dimension
          <input type="text" class="unit" list="dungeon-units" value={spec.scale.unit} onchange={e => attempt(() => store.change('unit', m => { m.scale.unit = val(e).trim() || 'ft'; }))} />
        </label>
        <datalist id="dungeon-units">{#each dungeon.SCALE_UNITS as u (u)}<option value={u}></option>{/each}</datalist>
      </div>
      <div class="checks">
        <label class="inline"><input type="checkbox" checked={grid.show} onchange={e => setGrid({ show: checked(e) })} /> show grid</label>
        <label class="inline" title={spec.grid.size > 1 ? `a fainter line every ${grid.subSize} ${grid.unit}` : 'the grid is one square: no sub-grid'}><input type="checkbox" checked={grid.sub} disabled={!grid.show || spec.grid.size <= 1} onchange={e => setGrid({ sub: checked(e) })} /> show sub-grid</label>
      </div>
      <div class="pair">
        <label>grid on
          <select value={spec.grid.clip} onchange={e => store.change('grid', m => { m.grid.clip = val(e) as 'floor' | 'all'; })}><option value="floor">floors</option><option value="all">everything</option></select>
        </label>
      </div>
      <div class="pair">
        <label>rock
          <select value={spec.style.hatch} onchange={e => store.change('hatch', m => { m.style.hatch = val(e) as dungeon.HatchStyle; })}>
            <option value="band">hatched band</option><option value="full">hatched all over</option><option value="none">plain</option>
          </select>
        </label>
        <label>band (cells) <input type="number" min="0" max="6" step="0.1" value={spec.style.band} onchange={e => attempt(() => store.change('band', m => { m.style.band = num(e); }))} /></label>
      </div>
      <label>wall weight <span class="v">{spec.style.wall}</span>
        <input type="range" min="0.4" max="2.5" step="0.1" value={spec.style.wall} onchange={e => attempt(() => store.change('wall', m => { m.style.wall = num(e); }))} />
      </label>
      <div class="checks">
        <label class="inline"><input type="checkbox" checked={spec.numbers} onchange={e => store.change('numbers', m => { m.numbers = checked(e); })} /> room numbers</label>
        <label class="inline"><input type="checkbox" checked={spec.scaleBar} onchange={e => store.change('scale bar', m => { m.scaleBar = checked(e); })} /> scale bar</label>
        <label class="inline"><input type="checkbox" checked={spec.compass} onchange={e => store.change('compass', m => { m.compass = checked(e); })} /> compass</label>
      </div>
      <label>1 square = <span class="row"><input type="number" min="0" value={spec.scale.perCell} onchange={e => attempt(() => store.change('scale', m => { m.scale.perCell = num(e); }))} /><input type="text" class="unit" value={spec.scale.unit} onchange={e => attempt(() => store.change('scale', m => { m.scale.unit = val(e); }))} /></span></label>

      <h3>Rooms ({spec.rooms.length})</h3>
      {#if selectedRoom}
        {@const r = selectedRoom}
        <div class="inspector">
          <div class="pair">
            <label>room {r.id}
              <select value={r.shape} disabled={r.shape === 'poly'} onchange={e => setRoom(r.id, 'shape', x => { x.shape = val(e) as dungeon.RoomShape; })}>
                {#each dungeon.ROOM_SHAPES as s (s)}<option value={s} disabled={s === 'poly'}>{s}</option>{/each}
              </select>
            </label>
            <label>width <input type="number" min="1" value={r.w} disabled={r.shape === 'poly'} onchange={e => setRoom(r.id, 'size', x => { x.w = num(e); })} /></label>
            <label>height <input type="number" min="1" value={r.h} disabled={r.shape === 'poly'} onchange={e => setRoom(r.id, 'size', x => { x.h = num(e); })} /></label>
          </div>
          <div class="pair">
            <label>name <input type="text" value={r.label ?? ''} placeholder="(none)" onchange={e => setRoom(r.id, 'name', x => { const t = val(e).trim(); if (t) x.label = t; else delete x.label; })} /></label>
            <label>number <input type="text" value={r.number === false ? 'off' : r.number ?? ''} placeholder="auto" onchange={e => setRoom(r.id, 'number', x => { const t = val(e).trim(); if (t === 'off') x.number = false; else if (t) x.number = Number(t); else delete x.number; })} /></label>
          </div>
        </div>
      {/if}
      <ul class="items">
        {#each layout.rooms as g (g.room.id)}
          <li class:sel={g.room.id === store.selected}>
            <button type="button" class="link" onclick={() => (store.selected = g.room.id)}>{g.number ?? '–'} · {g.room.id} · {g.room.shape} {g.room.w}×{g.room.h}{g.room.label ? ` · ${g.room.label}` : ''}</button>
            <button type="button" class="x" onclick={() => removeRoom(g.room.id)} title="remove the room and its corridors">×</button>
          </li>
        {:else}<li class="dim small">none yet — use the Room tool, or Generate</li>{/each}
      </ul>

      <h3>Corridors ({spec.corridors.length})</h3>
      <ul class="items">
        {#each spec.corridors as c, i (i)}
          <li>
            <span>{endName(c.from)} → {endName(c.to)}</span>
            {#each [0, 1] as const as end (end)}
              <select class="door" value={c.doors?.[end] ?? 'none'} onchange={e => setDoor(i, end, val(e))} title="door at the {end ? 'second' : 'first'} end">
                <option value="none">open</option>{#each dungeon.DOOR_KINDS as k (k)}<option value={k}>{k}</option>{/each}
              </select>
            {/each}
            <button type="button" class="x" onclick={() => removeCorridor(i)} title="remove">×</button>
          </li>
        {:else}<li class="dim small">none yet — use the Corridor tool</li>{/each}
      </ul>

      <h3>Labels and symbols</h3>
      <ul class="items">
        {#each spec.overlay.labels as l, i (i)}
          <li><input type="text" value={l.text} onchange={e => attempt(() => store.change('label text', m => { m.overlay.labels[i].text = val(e); }))} /><span class="dim small">{l.kind}</span><button type="button" class="x" onclick={() => removeLabel(i)} title="remove">×</button></li>
        {/each}
        {#each spec.overlay.symbols as s, i (i)}
          <li><span>{dungeon.SYMBOLS[s.kind]?.name ?? s.kind}</span><span class="dim small">{s.x}, {s.y}</span><button type="button" class="x" onclick={() => removeSymbol(i)} title="remove">×</button></li>
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
      </div>
      <div class="toolopts">
        {#if store.tool === 'room'}
          <label class="inline">shape
            <select bind:value={store.roomShape}>{#each ['rect', 'circle', 'octagon', 'cave'] as s (s)}<option value={s}>{s}</option>{/each}</select>
          </label>
        {/if}
        {#if store.tool === 'link'}
          <label class="inline">doors
            {#each [0, 1] as const as end (end)}
              <select bind:value={store.linkDoors[end]}><option value="none">open</option>{#each dungeon.DOOR_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select>
            {/each}
          </label>
          <label class="inline">width <input type="number" min="1" max="6" bind:value={store.linkWidth} /></label>
          {#if linkFrom}<button type="button" onclick={cancelLine}>Cancel</button>{/if}
        {/if}
        {#if store.tool === 'poly' && pending.length}
          <button type="button" onclick={finishPoly}>Finish room</button>
          <button type="button" onclick={cancelLine}>Cancel</button>
        {/if}
        {#if store.tool === 'label'}
          <label class="inline">text <input type="text" bind:value={store.labelText} /></label>
          <label class="inline">kind
            <select bind:value={store.labelKind}><option value="name">name</option><option value="note">note</option><option value="area">area</option></select>
          </label>
        {/if}
        {#if store.tool === 'symbol'}
          <label class="inline">symbol
            <select bind:value={store.symbol}>{#each dungeon.SYMBOL_KINDS as k (k)}<option value={k}>{dungeon.SYMBOLS[k].name}</option>{/each}</select>
          </label>
          <label class="inline">turn
            <select bind:value={store.symbolAngle}>{#each [0, 90, 180, 270] as a (a)}<option value={a}>{a}°</option>{/each}</select>
          </label>
        {/if}
        <span class="dim small">{TOOLS.find(t => t.id === store.tool)?.hint}</span>
      </div>
      <div class="stage">
        <MapView bind:this={view} {svg} cols={spec.cols} rows={spec.rows} ppu={PREVIEW_PPU} tool={store.tool} boxTools={['room']} moveTools={['select']} {pending} {ondrag} {onpoint} onfinish={() => store.tool === 'poly' && finishPoly()} />
      </div>
      <div class="footer">
        <span class="layers">
          {#each VIEW_LAYERS as l (l)}
            <label class="inline"><input type="checkbox" checked={shown[l]} onchange={e => (store.layers = { ...store.layers, [l]: checked(e) })} /> {l}</label>
          {/each}
        </span>
        <span class="export">
          <label class="inline">px / square <input type="number" min="8" max="300" bind:value={store.exportPpu} /></label>
          <button type="button" onclick={() => exportImage('png')}>PNG</button>
          <button type="button" onclick={() => exportImage('svg')}>SVG</button>
        </span>
        <span class="dim small status">{rendering ? 'rendering…' : info ? `${spec.cols * store.exportPpu}×${spec.rows * store.exportPpu} px · ${info.rooms} rooms · ${info.corridors} corridors · ${info.doors} doors` : ''}</span>
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
  .exits {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.3rem 0.6rem;
  }
  .exits select {
    min-width: 0;
    flex: 1;
  }
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .items li.sel {
    outline: 1px solid var(--accent, #6aa0ff);
    border-radius: 4px;
  }
  button.link {
    flex: 1;
    min-width: 0;
    text-align: left;
    background: none;
    border: 0;
    padding: 0.1rem 0.2rem;
    color: inherit;
    font: inherit;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  select.door {
    width: 5.2rem;
    font-size: 0.75rem;
    padding: 0.1rem 0.2rem;
  }
</style>
