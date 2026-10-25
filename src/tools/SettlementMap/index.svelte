<script lang="ts">
  /**
   * Settlement Map: tabletop villages, towns, cities and castles from plain shapes, as a referee's reference. Generate
   * one from a seed (roads, walls and gates, water and bridges, buildings, fields, woods, trees and props), then draw:
   * drag out buildings, click out roads, rivers, walls and fields, place trees, props and labels. Double-click a
   * building for its floor plan: lay its floors out, drag out rooms, put doors in shared walls, doors and windows in
   * the outer wall, and furniture. Colour or black and white, with a grid; export SVG or PNG of either view.
   * The settlement is the artgen `settlement.json` the CLI and Claude Code use: open and save it in a game repo's
   * `art/settlements/`, or download / open the file on its own. Rendering and generating run in the artgen worker.
   */
  import { onDestroy, onMount } from 'svelte';
  import { dungeon, map, settlement } from 'artgen-core';
  import fontRegular from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Regular.ttf?url';
  import fontBold from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Bold.ttf?url';
  import fontItalic from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Italic.ttf?url';
  import { acquire } from '../../workers/workerRegistry';
  import type { ArtgenApi } from '../../workers/artgen.worker';
  import { project } from '../../core/project/store.svelte';
  import ProjectBar from '../../core/components/ProjectBar.svelte';
  import MapView from '../../core/components/MapView.svelte';
  import { downloadBlob, downloadText } from '../../core/utils/download';
  import { SettlementMapStore, type PlanTool, type SiteTool } from './store.svelte';

  const lease = acquire<ArtgenApi>('artgen');
  const store = new SettlementMapStore();
  const SITE_PPU = 20, PLAN_PPU = 40;

  let svg = $state('');
  let info = $state<{ width: number; height: number; buildings: number; bridges: number } | null>(null);
  let error = $state<string | null>(null);
  let renderError = $state<string | null>(null);
  let rendering = $state(false);
  let generating = $state(false);
  /** Line points placed so far (roads, water, walls, areas), in sheet cells. */
  let pending = $state<number[]>([]);
  let projectSettlements = $state<string[]>([]);
  let pick = $state('');
  let fileInput = $state<HTMLInputElement>();
  let view = $state<MapView>();
  /** The terrain map the file's underlay names, read from the open project (null: none, or not found). */
  let underlayMap = $state<unknown>(null);
  let newKind = $state<settlement.SettlementKind>('village');

  const spec = $derived(store.spec);
  const layout = $derived(settlement.layoutSettlement(spec));
  const problems = $derived(settlement.lintSettlement(spec, layout));
  const plan = $derived(store.view === 'plan');
  const building = $derived(spec.buildings.find(b => b.id === store.building) ?? null);
  const floor = $derived(building?.floors?.find(f => f.level === store.level) ?? null);
  const sheet = $derived(plan && building ? settlement.planSheet(spec, building) : { cols: spec.cols, rows: spec.rows, margin: 0 });
  const floorLayout = $derived(plan && building ? settlement.layoutFloor(spec, building, floor ?? { level: store.level, rooms: [] }) : null);
  const selectedBuilding = $derived(!plan ? (spec.buildings.find(b => b.id === store.selected) ?? null) : null);
  const selectedFixture = $derived(plan && floor && store.fixture !== null ? (floor.fixtures?.[store.fixture] ?? null) : null);
  const tool = $derived(plan ? store.planTool : store.siteTool);

  const SITE_TOOLS: { id: SiteTool; label: string; hint: string }[] = [
    { id: 'pan', label: 'Pan', hint: 'drag to pan, wheel to zoom' },
    { id: 'select', label: 'Select', hint: 'click a building to select it, drag it to move it; double-click it for its floor plan' },
    { id: 'building', label: 'Building', hint: 'drag out a building of the kind and shape below' },
    { id: 'road', label: 'Road', hint: 'click the points of a road; double-click or Enter to finish' },
    { id: 'water', label: 'Water', hint: 'click the points of a river or stream (a line) or a pond, lake or sea (an area); double-click to finish' },
    { id: 'wall', label: 'Wall', hint: 'click the points of a wall; double-click to finish (closed: back round to the first point)' },
    { id: 'area', label: 'Area', hint: 'click the corners of a field, garden, wood, square…; double-click to finish' },
    { id: 'tree', label: 'Tree', hint: 'click to plant the kind below' },
    { id: 'prop', label: 'Prop', hint: 'click to place a well, cart, stall… on the site' },
    { id: 'label', label: 'Label', hint: 'click to place the text below' },
    { id: 'erase', label: 'Erase', hint: 'click a prop, tree, label, building, road, water, wall or area to remove it' },
  ];
  const PLAN_TOOLS: { id: PlanTool; label: string; hint: string }[] = [
    { id: 'pan', label: 'Pan', hint: 'drag to pan, wheel to zoom' },
    { id: 'select', label: 'Select', hint: 'click a room or a piece of furniture; drag furniture to move it' },
    { id: 'room', label: 'Room', hint: 'drag out a room (plan cells of 5 ft)' },
    { id: 'connect', label: 'Inner door', hint: 'click the wall two rooms share: a door of the kind below' },
    { id: 'door', label: 'Door', hint: 'click the outer wall for a door' },
    { id: 'window', label: 'Window', hint: 'click the outer wall for a window' },
    { id: 'fixture', label: 'Furniture', hint: 'click to place the piece below, at its true size' },
    { id: 'erase', label: 'Erase', hint: 'click furniture, a door, a window, an inner door or a room to remove it' },
  ];
  const SITE_LAYERS: settlement.SettlementLayer[] = ['areas', 'water', 'roads', 'walls', 'buildings', 'trees', 'props', 'grid', 'numbers', 'labels', 'legend', 'compass'];
  const PLAN_LAYERS: settlement.SettlementLayer[] = ['grid', 'fixtures', 'doors', 'windows', 'numbers', 'labels', 'legend', 'compass'];
  const LINE_TOOLS = ['road', 'water', 'wall', 'area'];

  onMount(() => {
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

  /** The render options for the current view. */
  const viewOptions = (ppu: number) => ({
    view: store.view, ...(store.view === 'plan' && store.building && { building: store.building, floor: store.level }), theme: store.theme, buildings: store.buildingsMode,
    layers: $state.snapshot(store.layers), ppu, ...(underlayMap ? { underlayMap: $state.snapshot(underlayMap) } : {}),
  });

  // re-render after every change (debounced; the newest request wins)
  let ticket = 0, timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const s = $state.snapshot(store.spec), o = viewOptions(store.view === 'plan' ? PLAN_PPU : SITE_PPU), mine = ++ticket;
    if (store.view === 'plan' && !s.buildings.some(b => b.id === store.building)) { store.backToSite(); return; }
    rendering = true;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const r = await lease.api.settlementSvg(s, o);
        if (mine !== ticket) return;
        svg = r.svg; info = { width: r.width, height: r.height, buildings: r.buildings, bridges: r.bridges }; renderError = null;
      } catch (e) {
        if (mine === ticket) renderError = e instanceof Error ? e.message : String(e);
      } finally {
        if (mine === ticket) rendering = false;
      }
    }, 120);
  });

  $effect(() => {
    void project.revision;
    if (project.files) void project.settlementIds().then(ids => { projectSettlements = ids; if (!ids.includes(pick)) pick = ids[0] ?? ''; });
    else projectSettlements = [];
  });

  // the underlay's map, read from the project: its path is from the settlement's folder
  $effect(() => {
    const u = store.spec.underlay, id = store.source?.id ?? store.spec.id;
    void project.revision;
    if (!u || !project.files) { underlayMap = null; return; }
    const parts: string[] = [];
    for (const seg of `settlements/${id}/${u.map}`.split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg); }
    void project.readArtText(parts.join('/')).then(t => { try { underlayMap = t ? JSON.parse(t) : null; } catch { underlayMap = null; } });
  });

  function attempt(run: () => void) {
    try { run(); error = null; } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
  /** An edit op as an undoable step, with any error shown. */
  const op = (o: settlement.SettlementOp) => attempt(() => { store.edit(o); });

  function onKeyDown(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select');
    if (typing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (e.shiftKey) store.history.redo(); else store.history.undo(); e.preventDefault(); }
    else if (e.key === 'Enter' && pending.length) finishLine();
    else if (e.key === 'Escape') { if (pending.length) pending = []; else if (plan) store.backToSite(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (plan && store.fixture !== null) removeFixture(store.fixture);
      else if (!plan && store.selected) op({ op: 'building.rm', id: store.selected });
    }
  }

  function setTool(t: string) {
    if (plan) store.planTool = t as PlanTool; else store.siteTool = t as SiteTool;
    pending = [];
  }

  const half = (v: number) => Math.round(v * 2) / 2;
  const round = (v: number) => Math.round(v * 100) / 100;
  const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;
  const num = (e: Event) => Number(val(e));
  const checked = (e: Event) => (e.currentTarget as HTMLInputElement).checked;
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  // ---- the site ----------------------------------------------------------------------------------------------------

  /** The nearest thing on the site to a point, within reach, for the eraser. */
  function siteThingAt(x: number, y: number): settlement.SettlementOp | null {
    const near = (px: number, py: number, r: number) => Math.hypot(px - x, py - y) < r;
    let i = spec.props.findIndex(p => near(p.x, p.y, 1.2));
    if (i >= 0) return { op: 'prop.rm', index: i };
    i = spec.overlay.labels.findIndex(l => near(l.x, l.y, 1.5));
    if (i >= 0) return { op: 'label.rm', index: i };
    i = spec.trees.findIndex(t => near(t.x, t.y, Math.max(0.8, (t.size ?? 2) / 2)));
    if (i >= 0) return { op: 'tree.rm', index: i };
    const b = settlement.buildingAt(layout, x, y);
    if (b) return { op: 'building.rm', id: b.building.id };
    const dist = (pts: number[], closed = false) => dungeon.geom.nearestOnLine(closed ? [...pts, pts[0], pts[1]] : pts, x, y).d;
    i = layout.walls.findIndex(w => dist(w.pts, w.closed) < w.thickness / 2 + 0.6);
    if (i >= 0) return { op: 'wall.rm', index: i };
    i = layout.roads.findIndex(r => dist(r.pts) < r.width / 2 + 0.4);
    if (i >= 0) return { op: 'road.rm', index: i };
    i = layout.water.findIndex(w => (w.area ? dungeon.inPolygon(w.pts, x, y) : dist(w.pts, w.closed) < w.width / 2 + 0.4));
    if (i >= 0) return { op: 'water.rm', index: i };
    for (i = spec.areas.length - 1; i >= 0 && !dungeon.inPolygon(spec.areas[i].points, x, y); i--);
    if (i >= 0) return { op: 'area.rm', index: i };
    return null;
  }

  function finishLine() {
    const pts = pending.slice(), n = pts.length / 2;
    pending = [];
    const t = store.siteTool;
    if (t === 'road' && n >= 2) op({ op: 'road.add', kind: store.roadKind, points: pts, ...(n > 2 && { curve: 'smooth' }) });
    else if (t === 'water') {
      const line = settlement.WATER_LINES.includes(store.waterKind);
      if (n >= (line ? 2 : 3)) op({ op: 'water.add', kind: store.waterKind, points: pts });
      else error = line ? 'a river or stream needs two points or more' : 'a pond, lake or sea needs three corners or more';
    } else if (t === 'wall' && n >= 2) op({ op: 'wall.add', kind: store.wallKind, points: pts, ...(store.wallClosed && n >= 3 && { closed: true }), ...(store.wallTowers !== 'none' && { towers: { shape: store.wallTowers, at: 'corners' } }) });
    else if (t === 'area' && n >= 3) op({ op: 'area.add', kind: store.areaKind, points: pts });
  }

  // ---- the plan ----------------------------------------------------------------------------------------------------

  /** A point on the plan sheet in the building's plan cells (from its footprint's corner). */
  const toPlan = (x: number, y: number): [number, number] => [x - sheet.margin, y - sheet.margin];
  const where = () => ({ building: store.building!, level: store.level });

  function fixtureAt(px: number, py: number): number | null {
    if (!floorLayout) return null;
    for (let i = floorLayout.fixtures.length - 1; i >= 0; i--) {
      const f = floorLayout.fixtures[i], turned = Math.abs(Math.round(f.angle / 90)) % 2 === 1, w = turned ? f.h : f.w, h = turned ? f.w : f.h;
      if (Math.abs(px - f.x) <= w / 2 + 0.1 && Math.abs(py - f.y) <= h / 2 + 0.1) return f.index;
    }
    return null;
  }

  function removeFixture(i: number) {
    store.fixture = null;
    op({ op: 'fixture.rm', ...where(), index: i });
  }

  /** Remove the opening (door, window or inner door) nearest a plan point, if one is within reach. */
  function removeOpeningAt(px: number, py: number): boolean {
    if (!floorLayout || !floor) return false;
    const d = (o: { x: number; y: number }) => Math.hypot(o.x - px, o.y - py);
    const door = floorLayout.doors.findIndex(o => d(o) < 0.8), win = floorLayout.windows.findIndex(o => d(o) < 0.8);
    if (door >= 0) { attempt(() => store.change('remove door', m => { const f = m.buildings.find(b => b.id === store.building)!.floors!.find(x => x.level === store.level)!; f.doors!.splice(door, 1); })); return true; }
    if (win >= 0) { attempt(() => store.change('remove window', m => { const f = m.buildings.find(b => b.id === store.building)!.floors!.find(x => x.level === store.level)!; f.windows!.splice(win, 1); })); return true; }
    // each connection's opening, by laying the floor out with that connection alone
    const conn = (floor.connections ?? []).findIndex(c => settlement.layoutFloor(spec, building!, { ...floor, connections: [c] }).inner.some(g => d(g) < 0.8));
    if (conn >= 0) { op({ op: 'disconnect', ...where(), index: conn }); return true; }
    return false;
  }

  // ---- pointer -----------------------------------------------------------------------------------------------------

  function ondrag(x0: number, y0: number, x1: number, y1: number) {
    if (plan) {
      const [a0, b0] = toPlan(x0, y0), [a1, b1] = toPlan(x1, y1);
      if (store.planTool === 'room') {
        const x = Math.floor(Math.min(a0, a1)), y = Math.floor(Math.min(b0, b1)), w = Math.ceil(Math.max(a0, a1)) - x, h = Math.ceil(Math.max(b0, b1)) - y;
        if (w >= 1 && h >= 1) op({ op: 'room.add', ...where(), shape: 'rect', x, y, w, h });
      } else if (store.planTool === 'select') {
        const i = fixtureAt(a0, b0);
        if (i === null) return;
        store.fixture = i;
        const dx = half(a1 - a0), dy = half(b1 - b0);
        attempt(() => store.change('move furniture', m => { const f = m.buildings.find(b => b.id === store.building)!.floors!.find(x => x.level === store.level)!.fixtures![i]; f.x = round(f.x + dx); f.y = round(f.y + dy); }));
      }
      return;
    }
    if (store.siteTool === 'building') {
      const x = Math.floor(Math.min(x0, x1)), y = Math.floor(Math.min(y0, y1)), w = Math.ceil(Math.max(x0, x1)) - x, h = Math.ceil(Math.max(y0, y1)) - y;
      if (w < 1 || h < 1) return;
      attempt(() => { store.edit({ op: 'building.add', kind: store.buildingKind, shape: store.buildingShape === 'poly' ? 'rect' : store.buildingShape, x, y, w, h, ...(store.buildingAngle && { angle: store.buildingAngle }) }); store.selected = store.spec.buildings[store.spec.buildings.length - 1].id; });
    } else if (store.siteTool === 'select') {
      const g = settlement.buildingAt(layout, x0, y0), dx = half(x1 - x0), dy = half(y1 - y0);
      if (!g || (!dx && !dy)) return;
      store.selected = g.building.id;
      op({ op: 'building.move', id: g.building.id, x: round(g.building.x + dx), y: round(g.building.y + dy) });
    }
  }

  function onpoint(x: number, y: number) {
    error = null;
    if (plan) {
      const [px, py] = toPlan(x, y), t = store.planTool;
      if (!building) return;
      if (t === 'select') {
        const i = fixtureAt(px, py);
        store.fixture = i;
        store.selected = i === null ? ([...(floorLayout?.rooms ?? [])].reverse().find(g => dungeon.inPolygon(g.outline, px, py))?.room.id ?? null) : null;
      } else if (t === 'fixture') {
        op({ op: 'fixture.add', ...where(), kind: store.fixtureKind, x: half(px), y: half(py), ...(store.fixtureAngle && { angle: store.fixtureAngle }) });
        store.fixture = (floor?.fixtures?.length ?? 1) - 1;
      } else if (t === 'door' || t === 'window') {
        const s = settlement.snapToLine(settlement.planOutline(spec, building), true, [px, py]);
        if (Math.hypot(s.x - px, s.y - py) > 1) { error = `click on the outer wall for a ${t}`; return; }
        op({ op: t, ...where(), at: [half(s.x), half(s.y)], ...(t === 'door' && store.doorKind !== 'door' && { kind: store.doorKind }) });
      } else if (t === 'connect') {
        let best: { a: string; b: string; x: number; y: number; d: number } | null = null;
        const rooms = floorLayout?.rooms ?? [];
        for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++)
          for (const [p, q] of dungeon.geom.sharedEdges(rooms[i].outline, rooms[j].outline)) {
            const n = dungeon.geom.nearestOnLine([...p, ...q], px, py);
            if (!best || n.d < best.d) best = { a: rooms[i].room.id, b: rooms[j].room.id, x: n.x, y: n.y, d: n.d };
          }
        if (!best || best.d > 0.6) { error = 'click on the wall two rooms share'; return; }
        op({ op: 'connect', ...where(), a: best.a, b: best.b, at: [round(best.x), round(best.y)], ...(store.doorKind !== 'door' && { kind: store.doorKind }) });
      } else if (t === 'erase') {
        const i = fixtureAt(px, py);
        if (i !== null) { removeFixture(i); return; }
        if (removeOpeningAt(px, py)) return;
        const g = [...(floorLayout?.rooms ?? [])].reverse().find(r => dungeon.inPolygon(r.outline, px, py));
        if (g) op({ op: 'room.rm', ...where(), id: g.room.id });
      }
      return;
    }
    const t = store.siteTool;
    if (t === 'select') { store.selected = settlement.buildingAt(layout, x, y)?.building.id ?? null; return; }
    if (LINE_TOOLS.includes(t)) {
      const px = half(x), py = half(y), n = pending.length;
      if (!n || px !== pending[n - 2] || py !== pending[n - 1]) pending = [...pending, px, py];
      return;
    }
    if (t === 'tree') op({ op: 'tree.add', kind: store.treeKind, x: round(x), y: round(y) });
    else if (t === 'prop') op({ op: 'prop.add', kind: store.propKind, x: half(x), y: half(y) });
    else if (t === 'label') { if (store.labelText.trim()) op({ op: 'label', text: store.labelText.trim(), x: half(x), y: half(y), kind: store.labelKind }); }
    else if (t === 'erase') { const o = siteThingAt(x, y); if (o) { if (o.op === 'building.rm' && store.selected === o.id) store.selected = null; op(o); } }
  }

  function onfinish() {
    if (!plan && LINE_TOOLS.includes(store.siteTool)) finishLine();
    else if (!plan && store.siteTool === 'select' && store.selected) store.openPlan(store.selected);
  }

  // ---- file and generator ------------------------------------------------------------------------------------------

  async function regenerate(newSeed: boolean) {
    if (spec.buildings.some(b => b.origin === 'gen') && !confirm('Lay the settlement out again? Everything the generator drew is replaced; what you drew by hand stays. (Undo brings this layout back.)')) return;
    generating = true;
    try {
      const s = $state.snapshot(store.spec) as settlement.SettlementSpec;
      if (newSeed) s.seed = Math.floor(Math.random() * 1e6);
      const next = await lease.api.settlementGenerate(s, underlayMap ? $state.snapshot(underlayMap) : undefined);
      attempt(() => store.change('generate', () => next));
      store.selected = null;
    } catch (e) { error = e instanceof Error ? e.message : String(e); } finally { generating = false; }
  }

  async function fresh(empty: boolean) {
    if (store.dirty && !confirm('Start a new settlement? Unsaved changes are lost.')) return;
    const base = settlement.newSettlement(spec.id, newKind, { seed: Math.floor(Math.random() * 1e6) });
    generating = true;
    try { store.load(empty ? base : await lease.api.settlementGenerate(base)); error = null; } catch (e) { error = e instanceof Error ? e.message : String(e); } finally { generating = false; }
  }

  async function openFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try { store.load(JSON.parse(await f.text())); error = null; } catch (err) { error = `${f.name}: ${err instanceof Error ? err.message : String(err)}`; }
  }

  async function openFromProject() {
    if (!pick) return;
    if (store.dirty && !confirm(`Open ${pick}? Unsaved changes to this settlement are lost.`)) return;
    const r = await project.readSettlement(pick);
    if (!r) { error = `art/settlements/${pick}/settlement.json is gone`; return; }
    try { store.load(JSON.parse(r.text), { id: pick, stat: r.stat }); error = null; } catch (err) { error = err instanceof Error ? err.message : String(err); }
  }

  async function saveToProject(force = false) {
    const id = spec.id, base = store.source?.id === id ? store.source.stat : undefined;
    const stat = await project.saveSettlement(id, JSON.stringify($state.snapshot(store.spec), null, 2) + '\n', base, force);
    if (stat) { store.source = { id, stat }; store.dirty = false; projectSettlements = await project.settlementIds(); pick = id; }
    else if (project.error && confirm(`${project.error}\n\nOverwrite it?`)) await saveToProject(true);
  }

  function downloadJson() {
    downloadText(JSON.stringify($state.snapshot(store.spec), null, 2) + '\n', `${spec.id}.settlement.json`, 'application/json');
    store.dirty = false;
  }

  async function exportImage(kind: 'svg' | 'png') {
    const s = $state.snapshot(store.spec), o = viewOptions(store.exportPpu), name = plan ? `${spec.id}.${store.building}.${store.level < 0 ? `c${-store.level}` : `f${store.level}`}.${store.theme}` : `${spec.id}.${store.theme}`;
    try {
      if (kind === 'svg') downloadText((await lease.api.settlementSvg(s, o)).svg, `${name}.svg`, 'image/svg+xml');
      else downloadBlob(new Blob([(await lease.api.settlementPng(s, o)) as BlobPart], { type: 'image/png' }), `${name}.png`);
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  function layOut() {
    if (!building) return;
    if (building.floors?.length && !confirm(`Lay out every floor of ${building.id} again? (Undo brings these floors back.)`)) return;
    op({ op: 'interior', id: building.id });
    store.level = settlement.groundFloor(store.spec.buildings.find(b => b.id === store.building)!)?.level ?? 0;
  }

  function addFloor(level: number) {
    op({ op: 'floor.add', building: store.building!, level });
    store.level = level;
  }
</script>

<div class="tool">
  <ProjectBar>
    {#if project.files}
      <select bind:value={pick} disabled={!projectSettlements.length} title="settlements in art/settlements">
        {#each projectSettlements as id (id)}<option value={id}>{id}</option>{:else}<option value="">no settlements yet</option>{/each}
      </select>
      <button type="button" onclick={openFromProject} disabled={!pick}>Open</button>
      <button type="button" class="primary" onclick={() => saveToProject()} title="write art/settlements/{spec.id}/settlement.json">Save to project</button>
    {/if}
  </ProjectBar>
  {#if error ?? renderError}<p class="error" role="alert">{error ?? renderError}</p>{/if}
  <div class="layout">
    <section class="controls">
      <h3>Settlement</h3>
      <div class="pair">
        <label>kind <select bind:value={newKind}>{#each settlement.SETTLEMENT_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
      </div>
      <div class="pair">
        <button type="button" onclick={() => fresh(false)} disabled={generating} title="a new layout of this kind from a new seed">New {newKind}</button>
        <button type="button" onclick={() => fresh(true)} title="an empty sheet to draw on">New empty</button>
      </div>
      <div class="pair">
        <button type="button" onclick={() => fileInput?.click()}>Open file…</button>
        <button type="button" onclick={downloadJson}>Download .json</button>
      </div>
      <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={openFile} />
      <label>id <input type="text" value={spec.id} onchange={e => attempt(() => store.change('id', m => { m.id = val(e).trim(); }))} /></label>
      <label>title <input type="text" value={spec.title ?? ''} placeholder="(none)" onchange={e => attempt(() => store.change('title', m => { const t = val(e).trim(); if (t) m.title = t; else delete m.title; }))} /></label>
      <div class="pair">
        <label>columns <input type="number" min="4" max={settlement.MAX_SIDE} value={spec.cols} onchange={e => attempt(() => store.change('size', m => { m.cols = num(e); }))} /></label>
        <label>rows <input type="number" min="4" max={settlement.MAX_SIDE} value={spec.rows} onchange={e => attempt(() => store.change('size', m => { m.rows = num(e); }))} /></label>
      </div>
      <p class="dim small">a {spec.kind} · 1 square = {spec.scale.perCell} {spec.scale.unit}{spec.underlay ? ` · over ${spec.underlay.map}${underlayMap ? '' : ' (not found: open the project)'}` : ''}{store.source ? ` · art/settlements/${store.source.id}` : ''}{store.dirty ? ' · unsaved' : ''}</p>

      <h3>Generator</h3>
      <div class="pair">
        <label>seed <input type="number" value={spec.seed} onchange={e => attempt(() => store.change('seed', m => { m.seed = num(e); }))} /></label>
        <label>kind <select value={spec.kind} onchange={e => attempt(() => store.change('kind', m => { m.kind = val(e) as settlement.SettlementKind; }))}>{#each settlement.SETTLEMENT_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
      </div>
      {#each [['buildings', 0, 300, 1], ['density', 0, 1, 0.05], ['trees', 0, 1, 0.05], ['fields', 0, 1, 0.05]] as const as [key, min, max, step] (key)}
        <label>{key} <span class="v">{spec.gen[key]}</span>
          <input type="range" {min} {max} {step} value={spec.gen[key]} onchange={e => attempt(() => store.change(key, m => { m.gen[key] = num(e); }))} />
        </label>
      {/each}
      <div class="pair">
        <label>streets <select value={spec.gen.streets} onchange={e => attempt(() => store.change('streets', m => { m.gen.streets = val(e) as typeof m.gen.streets; }))}>{#each settlement.STREET_PLANS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
        <label>wall <select value={spec.gen.wall} onchange={e => attempt(() => store.change('wall', m => { m.gen.wall = val(e) as typeof m.gen.wall; }))}>{#each settlement.GEN_WALLS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
        <label>water <select value={spec.gen.water} onchange={e => attempt(() => store.change('water', m => { m.gen.water = val(e) as typeof m.gen.water; }))}>{#each settlement.GEN_WATERS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
      </div>
      <div class="checks">
        {#each ['market', 'castle', 'interiors'] as const as k (k)}
          <label class="inline"><input type="checkbox" checked={spec.gen[k]} onchange={e => attempt(() => store.change(k, m => { m.gen[k] = checked(e); }))} /> {k}</label>
        {/each}
      </div>
      <div class="pair">
        <button type="button" onclick={() => regenerate(false)} disabled={generating}>Lay out</button>
        <button type="button" onclick={() => regenerate(true)} disabled={generating}>New seed</button>
      </div>

      <h3>Look</h3>
      <div class="pair">
        <label>theme <select bind:value={store.theme}><option value="color">colour</option><option value="bw">black &amp; white</option></select></label>
        <label>buildings <select bind:value={store.buildingsMode}><option value="roofs">roofs</option><option value="outline">outlines</option><option value="interior">cut away</option></select></label>
      </div>
      <div class="pair">
        <label>grid ({spec.scale.unit}) <input type="number" min="1" value={spec.grid.size * spec.scale.perCell} onchange={e => attempt(() => store.change('grid', m => { m.grid = { ...m.grid, show: true, size: num(e) / m.scale.perCell }; }))} /></label>
        <label>ground <select value={spec.ground} onchange={e => attempt(() => store.change('ground', m => { m.ground = val(e) as settlement.Ground; }))}>{#each settlement.GROUNDS as g (g)}<option value={g}>{g}</option>{/each}</select></label>
      </div>
      <div class="checks">
        <label class="inline"><input type="checkbox" checked={spec.grid.show} onchange={e => attempt(() => store.change('grid', m => { m.grid.show = checked(e); }))} /> grid</label>
        <label class="inline"><input type="checkbox" checked={spec.grid.sub} onchange={e => attempt(() => store.change('sub-grid', m => { m.grid.sub = checked(e); }))} /> sub-grid</label>
        {#each [['numbers', 'numbers'], ['scaleBar', 'scale bar'], ['compass', 'compass'], ['legend', 'legend']] as const as [k, name] (k)}
          <label class="inline"><input type="checkbox" checked={!!spec[k]} onchange={e => attempt(() => store.change(name, m => { m[k] = checked(e); }))} /> {name}</label>
        {/each}
      </div>

      {#if !plan}
        <h3>Buildings ({spec.buildings.length})</h3>
        {#if selectedBuilding}
          {@const b = selectedBuilding}
          <div class="inspector">
            <div class="pair">
              <label>kind <select value={b.kind} onchange={e => op({ op: 'building.set', id: b.id, kind: val(e) })}>{#each settlement.BUILDING_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
              <label>shape <select value={b.shape} onchange={e => op({ op: 'building.set', id: b.id, shape: val(e) })}>{#each settlement.BUILDING_SHAPES.filter(s => s !== 'poly' || b.shape === 'poly') as k (k)}<option value={k}>{k}</option>{/each}</select></label>
            </div>
            <div class="pair">
              <label>roof <select value={b.roof ?? ''} onchange={e => op({ op: 'building.set', id: b.id, roof: val(e) || null })}><option value="">({settlement.roofOf({ ...b, roof: undefined })})</option>{#each settlement.ROOFS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
              <label>turn <input type="number" step="5" value={b.angle ?? 0} onchange={e => op({ op: 'building.set', id: b.id, angle: num(e) || null })} /></label>
            </div>
            <div class="pair">
              <label>w <input type="number" min="0.5" step="0.5" value={b.w} onchange={e => op({ op: 'building.set', id: b.id, w: num(e) })} /></label>
              <label>h <input type="number" min="0.5" step="0.5" value={b.h} onchange={e => op({ op: 'building.set', id: b.id, h: num(e) })} /></label>
              <label>storeys <input type="number" min="1" max="12" value={b.stories ?? 1} onchange={e => op({ op: 'building.set', id: b.id, stories: num(e) })} /></label>
            </div>
            <label>name <input type="text" value={b.label ?? ''} placeholder="(none)" onchange={e => op({ op: 'building.set', id: b.id, label: val(e).trim() || null })} /></label>
            <div class="pair">
              <button type="button" class="primary" onclick={() => store.openPlan(b.id)}>Floor plan</button>
              <button type="button" onclick={() => op({ op: 'building.rm', id: b.id })}>Delete</button>
            </div>
          </div>
        {/if}
        <ul class="items">
          {#each layout.buildings as g (g.building.id)}
            <li class:sel={store.selected === g.building.id}>
              <button type="button" class="link" onclick={() => (store.selected = g.building.id)} ondblclick={() => store.openPlan(g.building.id)}>{g.number ?? '–'}. {g.building.label ?? cap(g.building.kind)} <span class="dim">({g.building.id}{g.building.floors?.length ? `, ${g.building.floors.length} fl.` : ''})</span></button>
            </li>
          {:else}<li class="dim small">none yet — use the Building tool, or Lay out</li>{/each}
        </ul>
      {:else if building}
        <h3>{building.label ?? cap(building.kind)} <span class="dim">({building.id})</span></h3>
        <button type="button" onclick={() => store.backToSite()}>← Back to the site</button>
        <div class="floors">
          {#each [...(building.floors ?? [])].sort((p, q) => q.level - p.level) as f (f.level)}
            <button type="button" class:primary={store.level === f.level} onclick={() => { store.level = f.level; store.fixture = null; }}>{settlement.floorName(f)}</button>
          {/each}
        </div>
        <div class="pair">
          <button type="button" onclick={layOut} title="rooms, doors, windows, stairs and furniture from the building's kind">{building.floors?.length ? 'Lay out again' : 'Lay out floors'}</button>
          <button type="button" onclick={() => addFloor(Math.max(-1, ...(building.floors ?? []).map(f => f.level)) + 1)}>Add floor</button>
          <button type="button" onclick={() => addFloor(Math.min(1, ...(building.floors ?? []).map(f => f.level)) - 1)}>Add cellar</button>
        </div>
        {#if floor}
          <h3>Rooms ({floor.rooms.length})</h3>
          <ul class="items">
            {#each floor.rooms as r (r.id)}
              <li class:sel={store.selected === r.id}>
                <input type="text" value={r.label ?? ''} placeholder={r.id} onchange={e => op({ op: 'room.set', ...where(), id: r.id, label: val(e).trim() || null })} />
                <button type="button" class="x" onclick={() => op({ op: 'room.rm', ...where(), id: r.id })} title="remove">×</button>
              </li>
            {:else}<li class="dim small">none yet — drag out rooms with the Room tool, or Lay out floors</li>{/each}
          </ul>
          {#if selectedFixture}
            {@const f = selectedFixture}
            {@const i = store.fixture!}
            <div class="inspector">
              <b>{settlement.FIXTURES[f.kind]?.name ?? f.kind}</b>
              <div class="pair">
                <label>turn <select value={f.angle ?? 0} onchange={e => attempt(() => store.change('turn furniture', m => { const x = m.buildings.find(b => b.id === store.building)!.floors!.find(y => y.level === store.level)!.fixtures![i]; const a = num(e); if (a) x.angle = a; else delete x.angle; }))}>{#each [0, 90, 180, 270] as a (a)}<option value={a}>{a}°</option>{/each}</select></label>
                <label>label <input type="text" value={f.label ?? ''} onchange={e => attempt(() => store.change('label furniture', m => { const x = m.buildings.find(b => b.id === store.building)!.floors!.find(y => y.level === store.level)!.fixtures![i]; const t = val(e).trim(); if (t) x.label = t; else delete x.label; }))} /></label>
              </div>
              <button type="button" onclick={() => removeFixture(i)}>Remove</button>
            </div>
          {/if}
          <p class="dim small">{floor.fixtures?.length ?? 0} pieces of furniture · {floor.doors?.length ?? 0} doors · {floor.windows?.length ?? 0} windows</p>
        {:else}
          <p class="dim small">no floor at this level yet: lay the floors out, or add one</p>
        {/if}
      {/if}

      <h3>Problems ({problems.length})</h3>
      <ul class="items problems">
        {#each problems.slice(0, 30) as p, i (i)}<li class={p.severity}><b>{p.severity}</b> <span class="dim">{p.path}</span> {p.message}</li>{:else}<li class="dim small">none</li>{/each}
      </ul>
    </section>

    <section class="main">
      <div class="toolbar">
        {#each plan ? PLAN_TOOLS : SITE_TOOLS as t (t.id)}
          <button type="button" class:primary={tool === t.id} onclick={() => setTool(t.id)} title={t.hint}>{t.label}</button>
        {/each}
        <span class="sep"></span>
        <button type="button" onclick={() => store.history.undo()} disabled={!store.history.canUndo} title="Ctrl+Z">Undo</button>
        <button type="button" onclick={() => store.history.redo()} disabled={!store.history.canRedo} title="Ctrl+Shift+Z">Redo</button>
        <button type="button" onclick={() => view?.fit()}>Fit</button>
        {#if plan}<button type="button" onclick={() => store.backToSite()}>Site</button>{/if}
      </div>
      <div class="toolopts">
        {#if !plan}
          {#if tool === 'building'}
            <label class="inline">kind <select bind:value={store.buildingKind}>{#each settlement.BUILDING_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
            <label class="inline">shape <select bind:value={store.buildingShape}>{#each settlement.BUILDING_SHAPES.filter(s => s !== 'poly') as k (k)}<option value={k}>{k}</option>{/each}</select></label>
            <label class="inline">turn <input type="number" step="5" bind:value={store.buildingAngle} /></label>
          {:else if tool === 'road'}
            <label class="inline">kind <select bind:value={store.roadKind}>{#each settlement.ROAD_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
          {:else if tool === 'water'}
            <label class="inline">kind <select bind:value={store.waterKind}>{#each settlement.WATER_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
          {:else if tool === 'wall'}
            <label class="inline">kind <select bind:value={store.wallKind}>{#each settlement.WALL_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
            <label class="inline"><input type="checkbox" bind:checked={store.wallClosed} /> closed</label>
            <label class="inline">towers <select bind:value={store.wallTowers}><option value="none">none</option><option value="round">round</option><option value="square">square</option></select></label>
            {#if selectedBuilding === null && spec.walls.length}<span class="dim small">gates: settlement wall … gate (CLI), or draw the wall with a gap</span>{/if}
          {:else if tool === 'area'}
            <label class="inline">kind <select bind:value={store.areaKind}>{#each settlement.AREA_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
          {:else if tool === 'tree'}
            <label class="inline">kind <select bind:value={store.treeKind}>{#each settlement.TREE_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
          {:else if tool === 'prop'}
            <label class="inline">prop <select bind:value={store.propKind}>{#each settlement.FIXTURE_KINDS.filter(k => settlement.FIXTURES[k].group === 'outdoor' || k === 'statue' || k === 'barrel' || k === 'crate') as k (k)}<option value={k}>{settlement.FIXTURES[k].name}</option>{/each}</select></label>
          {:else if tool === 'label'}
            <label class="inline">text <input type="text" bind:value={store.labelText} /></label>
            <label class="inline">kind <select bind:value={store.labelKind}>{#each settlement.LABEL_KINDS as k (k)}<option value={k}>{k}</option>{/each}</select></label>
          {/if}
          {#if LINE_TOOLS.includes(tool) && pending.length}
            <button type="button" onclick={finishLine}>Finish</button>
            <button type="button" onclick={() => (pending = [])}>Cancel</button>
          {/if}
        {:else}
          {#if tool === 'fixture'}
            <label class="inline">piece
              <select bind:value={store.fixtureKind}>
                {#each ['furniture', 'fittings', 'worship', 'household', 'stairs', 'outdoor'] as group (group)}
                  <optgroup label={group}>{#each settlement.FIXTURE_KINDS.filter(k => settlement.FIXTURES[k].group === group) as k (k)}<option value={k}>{settlement.FIXTURES[k].name}</option>{/each}</optgroup>
                {/each}
              </select>
            </label>
            <label class="inline">turn <select bind:value={store.fixtureAngle}>{#each [0, 90, 180, 270] as a (a)}<option value={a}>{a}°</option>{/each}</select></label>
          {:else if tool === 'door' || tool === 'connect'}
            <label class="inline">kind <select bind:value={store.doorKind}>{#each [...dungeon.DOOR_KINDS, 'open'] as k (k)}<option value={k}>{k}</option>{/each}</select></label>
          {/if}
        {/if}
        <span class="dim small">{(plan ? PLAN_TOOLS : SITE_TOOLS).find(t => t.id === tool)?.hint}</span>
      </div>
      <div class="stage">
        <MapView bind:this={view} {svg} cols={sheet.cols} rows={sheet.rows} ppu={plan ? PLAN_PPU : SITE_PPU} {tool} boxTools={['building', 'room']} moveTools={['select']} {pending} {ondrag} {onpoint} {onfinish} />
      </div>
      <div class="footer">
        <span class="layers">
          {#each plan ? PLAN_LAYERS : SITE_LAYERS as l (l)}
            <label class="inline"><input type="checkbox" checked={settlement.settlementLayersFor(spec, store.view, store.layers)[l]} onchange={e => (store.layers = { ...store.layers, [l]: checked(e) })} /> {l}</label>
          {/each}
        </span>
        <span class="export">
          <label class="inline">px / square <input type="number" min="4" max="300" bind:value={store.exportPpu} /></label>
          <button type="button" onclick={() => exportImage('png')}>PNG</button>
          <button type="button" onclick={() => exportImage('svg')}>SVG</button>
        </span>
        <span class="dim small status">{generating ? 'laying out…' : rendering ? 'rendering…' : info ? `${plan ? `plan of ${store.building}` : `${info.buildings} buildings · ${info.bridges} bridges`} · ${Math.round((info.width * store.exportPpu) / (plan ? PLAN_PPU : SITE_PPU))}×${Math.round((info.height * store.exportPpu) / (plan ? PLAN_PPU : SITE_PPU))} px` : ''}</span>
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
  .checks,
  .floors {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    align-items: center;
  }
  .floors {
    gap: 0.3rem;
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
  .toolopts input[type='number'],
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
  .items li > input {
    flex: 1;
    min-width: 0;
  }
  .items li.sel {
    outline: 1px solid var(--accent, #6aa0ff);
    border-radius: 4px;
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
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .problems li { font-size: 0.8rem; display: block; }
  .problems li.error b { color: var(--danger, #c0392b); }
  .problems li.warning b { color: var(--warn, #b7791f); }
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
</style>
