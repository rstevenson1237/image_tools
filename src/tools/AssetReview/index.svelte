<script lang="ts">
  /**
   * Asset Review (W4, SPEC §13.1): the user's side of the autonomous pipeline (D10). Finished assets by status; per
   * asset the final in context, the pass timeline with scores, any version beside another, metrics and conformance;
   * approve, or request changes with notes pinned to regions of the sprite (the U-stage input Claude Code picks up on
   * its next `/artgen-make`). Everything is written to `art/ledger.jsonl` as `by: "user"`.
   */
  import { onDestroy } from 'svelte';
  import type { AnalyticsReport } from 'artgen-core';
  import { acquire } from '../../workers/workerRegistry';
  import type { ArtgenApi, RenderPayload } from '../../workers/artgen.worker';
  import type { AssetDetail, AssetRow } from '../../core/project/engine';
  import { project } from '../../core/project/store.svelte';
  import ProjectBar from '../../core/components/ProjectBar.svelte';
  import PixelPreview from '../../core/components/PixelPreview.svelte';
  import CompareView from '../../core/components/CompareView.svelte';
  import StatusBadge from '../../core/components/StatusBadge.svelte';
  import Analytics from './Analytics.svelte';
  import { fitScale, type Img, type Region } from '../../core/components/pixels';

  const lease = acquire<ArtgenApi>('artgen');
  onDestroy(() => lease.release());

  /** Gallery order: what waits for the user first. */
  const ORDER = ['final', 'revision', 'in-pipeline', 'stale', 'approved', 'exported', 'brief'];

  let rows = $state<AssetRow[]>([]);
  let thumbs = $state<Record<string, Img>>({});
  let selected = $state<string | null>(null);
  let detail = $state<AssetDetail | null>(null);
  let finalRender = $state<RenderPayload | null>(null);
  let compareA = $state<string | null>(null);
  let compareB = $state<string | null>(null);
  let renderA = $state<RenderPayload | null>(null);
  let renderB = $state<RenderPayload | null>(null);
  let cellIndex = $state(0);
  let bg = $state<'checker' | 'game' | 'context'>('context');
  let region = $state<Region | null>(null);
  let note = $state('');
  let route = $state<'base' | 'finish'>('finish');
  let approveNote = $state('');
  let showAnalytics = $state(false);
  let analytics = $state<AnalyticsReport | null>(null);
  let loadError = $state<string | null>(null);
  let loading = $state(false);

  const groups = $derived(ORDER.map(s => ({ status: s, rows: rows.filter(r => r.status === s) })).filter(g => g.rows.length));
  const cell = $derived(finalRender?.cells[Math.min(cellIndex, (finalRender?.cells.length ?? 1) - 1)]);
  const cellId = $derived(cell ? `${cell.state}/${cell.facing}/${cell.frame}` : undefined);
  /** Pixels the preview spans at 1×: the iso floor when shown in context, 3×3 for tiles, else the sprite. */
  const extent = (r: RenderPayload) => {
    const k = r.tile && bg !== 'checker' ? 3 : 1, c = bg === 'context' ? r.context : undefined;
    return { w: Math.max(r.size[0] * k, c?.w ?? 0), h: Math.max(r.size[1] * k, c?.h ?? 0) };
  };
  const scale = $derived(finalRender ? fitScale(extent(finalRender), 420, 360, 12) : 4);
  const background = $derived(bg === 'checker' ? 'checker' : (finalRender?.background ?? '#202028'));
  /** The cell under review in another version (same state / facing / frame), else its first cell. */
  const cellOf = (r: RenderPayload) => r.cells.find(c => `${c.state}/${c.facing}/${c.frame}` === cellId) ?? r.cells[0];
  const pins = $derived(
    (detail?.feedback ?? [])
      .filter(f => Array.isArray(f.region) && f.on === detail?.row.final && (!f.cell || f.cell === cellId))
      .map((f, i) => ({ region: f.region as Region, label: `#${i + 1}` })),
  );

  // re-read whenever the project (re)loads
  $effect(() => {
    void project.revision;
    if (project.snapshot) void refresh();
    else { rows = []; detail = null; finalRender = null; }
  });

  // a reload can start while the previous read is still running: only the latest one writes the view
  let ticket = 0, selTicket = 0;

  async function refresh() {
    const mine = ++ticket;
    loading = true; loadError = null;
    try {
      const api = await project.sync(lease.api), next = await api.status();
      if (mine !== ticket) return;
      rows = next;
      if (showAnalytics) analytics = (await api.analytics()).report;
      if (selected && rows.some(r => r.id === selected)) await select(selected, true);
      else { const first = rows.find(r => r.status === 'final') ?? rows.find(r => r.final); if (first) await select(first.id); }
      await loadThumbs(api, mine);
    } catch (e) {
      if (mine === ticket) loadError = e instanceof Error ? e.message : String(e);
    } finally {
      if (mine === ticket) loading = false;
    }
  }

  async function loadThumbs(api: typeof lease.api, mine: number) {
    const out: Record<string, Img> = {};
    for (const r of rows) if (r.final) {
      try { out[r.id] = (await api.render(r.id, r.final)).cells[0].img; } catch { /* the detail view shows the error */ }
    }
    if (mine === ticket) thumbs = out;
  }

  async function select(id: string, keep = false) {
    const mine = ++selTicket;
    selected = id;
    if (!keep) { cellIndex = 0; region = null; note = ''; approveNote = ''; }
    try {
      const api = await project.sync(lease.api), d = await api.detail(id);
      const fr = d.row.final ? await api.render(id, d.row.final) : null;
      if (mine !== selTicket) return;
      detail = d; finalRender = fr;
      const vs = d.timeline.map(t => t.version);
      const b = d.row.final ?? vs[vs.length - 1] ?? null;
      const a = b && d.timeline.find(t => t.version === b)?.base ? d.timeline.find(t => t.version === b)!.base! : vs[vs.indexOf(b ?? '') - 1] ?? null;
      if (!keep || !compareB || !vs.includes(compareB)) { compareA = a; compareB = b; }
      await loadCompare();
    } catch (e) {
      if (mine === selTicket) loadError = e instanceof Error ? e.message : String(e);
    }
  }

  async function loadCompare() {
    const mine = selTicket, api = await project.sync(lease.api);
    const a = compareA && selected ? await api.render(selected, compareA) : null, b = compareB && selected ? await api.render(selected, compareB) : null;
    if (mine === selTicket) { renderA = a; renderB = b; }
  }

  async function toggleAnalytics() {
    showAnalytics = !showAnalytics;
    if (!showAnalytics || analytics) return;
    try { analytics = (await (await project.sync(lease.api)).analytics()).report; } catch (e) { loadError = e instanceof Error ? e.message : String(e); showAnalytics = false; }
  }

  async function approve() {
    if (!selected) return;
    if (await project.approve(lease.api, selected, approveNote.trim())) approveNote = '';
  }

  async function requestChanges() {
    if (!selected) return;
    const r = await project.requestChanges(lease.api, selected, { route, note, ...(region && { region: [...region] }), ...(cellId && finalRender && finalRender.cells.length > 1 && { cell: cellId }) });
    if (r) { note = ''; region = null; }
  }

  const fmtScore = (r: Pick<AssetRow, 'score' | 'blind' | 'reviewer'>) =>
    `${r.score ?? '–'}${r.blind !== undefined ? ` · blind ${r.blind}` : r.reviewer === 'self' || (r.score !== undefined && !r.reviewer) ? ' · SELF' : ''}`;
</script>

<div class="tool">
  <ProjectBar>
    <button type="button" class:primary={showAnalytics} onclick={toggleAnalytics} disabled={!project.snapshot}>Analytics</button>
  </ProjectBar>

  {#if !project.files}
    <div class="empty">
      <h2>Asset Review</h2>
      <p>Open a game repo that has an artgen <code>art/</code> folder. Finished assets wait here for your approval; notes you pin
        to a sprite go to Claude Code as feedback on its next <code>/artgen-make</code>.</p>
    </div>
  {:else}
    {#if loadError}<p class="error" role="alert">{loadError}</p>{/if}
    <div class="layout" class:wide={showAnalytics}>
      <aside class="gallery" aria-label="Assets by status">
        {#if loading && !rows.length}<p class="dim">reading the project…</p>{/if}
        {#each groups as g (g.status)}
          <h3><StatusBadge status={g.status} /> <span class="dim">{g.rows.length}</span></h3>
          <ul>
            {#each g.rows as r (r.id)}
              <li>
                <button type="button" class:active={r.id === selected} onclick={() => select(r.id)} data-asset={r.id}>
                  {#if thumbs[r.id]}
                    <PixelPreview img={thumbs[r.id]} scale={fitScale(thumbs[r.id], 48, 48, 4)} background="checker" />
                  {:else}<span class="ph"></span>{/if}
                  <span class="meta">
                    <strong>{r.id}</strong>
                    <small>{r.kind} · {r.final ?? 'no final'} · {fmtScore(r)}</small>
                    {#if r.issues.length}<small class="warn">{r.issues.length} open issue{r.issues.length > 1 ? 's' : ''}</small>{/if}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/each}
      </aside>

      <section class="detail">
        {#if showAnalytics && analytics}
          <Analytics report={analytics} />
        {:else if detail}
          {@const row = detail.row}
          <header class="head">
            <h2>{row.id}</h2>
            <StatusBadge status={row.status} title={row.why} />
            <span class="dim">{row.kind} · {detail.view}{row.final ? ` · ${row.final}` : ''} · score {fmtScore(row)}{row.gate === false ? ' · GATE FAILS' : ''}</span>
          </header>
          <p class="why">{row.why}</p>
          {#if row.issues.length}
            <ul class="issues">{#each row.issues as i (i)}<li>{i}</li>{/each}</ul>
          {/if}

          {#if finalRender && cell}
            <div class="final">
              <div class="view">
                <PixelPreview
                  img={cell.img}
                  {scale}
                  {background}
                  context={bg === 'context' ? finalRender.context : undefined}
                  tiled={finalRender.tile && bg !== 'checker'}
                  pins={region ? [...pins, { region, label: 'new note' }] : pins}
                  onregion={r => (region = r)}
                  label="drag to pin a note to a region · {cellId}"
                />
                <div class="controls">
                  <span class="seg" role="group" aria-label="background">
                    {#each [['context', 'in context'], ['game', 'game bg'], ['checker', 'checker']] as [k, l] (k)}
                      <button type="button" class:on={bg === k} onclick={() => (bg = k as typeof bg)}>{l}</button>
                    {/each}
                  </span>
                  {#if finalRender.cells.length > 1}
                    <label class="cells">
                      cell
                      <select bind:value={cellIndex}>
                        {#each finalRender.cells as c, i (i)}<option value={i}>{c.state} / {c.facing} / {c.frame}{c.mirrored ? ' (mirrored)' : ''}</option>{/each}
                      </select>
                    </label>
                  {/if}
                </div>
              </div>

              <div class="actions">
                <h3>Your call</h3>
                <label class="block">
                  Approve note (optional)
                  <input type="text" bind:value={approveNote} placeholder="e.g. good to ship" disabled={row.status !== 'final'} />
                </label>
                <button type="button" class="primary" onclick={approve} disabled={row.status !== 'final' || project.busy}>Approve {row.final}</button>
                {#if row.status !== 'final'}<p class="dim small">Only a final asset can be approved ({row.status}).</p>{/if}

                <h3>Request changes</h3>
                <span class="seg" role="radiogroup" aria-label="route">
                  <button type="button" class:on={route === 'finish'} onclick={() => (route = 'finish')} title="pixel-level fix on the current base">pixels (finish)</button>
                  <button type="button" class:on={route === 'base'} onclick={() => (route = 'base')} title="form, proportion or colour: a new base">form / colour (base)</button>
                </span>
                <textarea bind:value={note} rows="3" placeholder={region ? `what should change in the pinned region ${region.join(',')}` : 'what should change (drag on the sprite to pin it to a region)'}></textarea>
                {#if region}<button type="button" class="link" onclick={() => (region = null)}>unpin region {region.join(', ')}</button>{/if}
                <button type="button" onclick={requestChanges} disabled={!note.trim() || !['final', 'approved', 'exported', 'stale'].includes(row.status) || project.busy}>Send feedback</button>
              </div>
            </div>
          {/if}

          <h3>Pass timeline</h3>
          <table class="timeline">
            <thead><tr><th>version</th><th>pass</th><th>score</th><th>blind</th><th>reviewer</th><th>gate</th><th>compare</th></tr></thead>
            <tbody>
              {#each detail.timeline as t (t.version)}
                <tr class:current={t.version === row.final}>
                  <td>{t.version}{t.base ? ` ← ${t.base}` : ''}</td>
                  <td>{t.pass}</td>
                  <td>{t.score ?? '–'}</td>
                  <td>{t.blind ?? '–'}</td>
                  <td>{t.reviewer ?? (t.score !== undefined ? 'self' : '–')}</td>
                  <td class:fail={t.gate === false}>{t.gate === undefined ? '–' : t.gate ? 'pass' : 'FAIL'}</td>
                  <td class="pick">
                    <button type="button" class:on={compareA === t.version} onclick={() => { compareA = t.version; void loadCompare(); }}>A</button>
                    <button type="button" class:on={compareB === t.version} onclick={() => { compareB = t.version; void loadCompare(); }}>B</button>
                  </td>
                </tr>
                {#if t.note}<tr class="note"><td colspan="7">{t.note}</td></tr>{/if}
              {/each}
            </tbody>
          </table>

          {#if renderA && renderB}
            {@const a = cellOf(renderA)}
            {@const b = cellOf(renderB)}
            {@const where = renderB.cells.length > 1 ? ` · ${b.state}/${b.facing}/${b.frame}` : ''}
            <h3>Compare {renderA.version} → {renderB.version}{where}</h3>
            <CompareView
              before={{ img: a.img, label: `A ${renderA.version}` }}
              after={{ img: b.img, label: `B ${renderB.version}` }}
              scale={fitScale(extent(renderB), 300, 260, 10)}
              background={bg === 'checker' ? 'checker' : (renderB.background ?? '#202028')}
              context={bg === 'context' ? renderB.context : undefined}
              tiled={renderB.tile && bg !== 'checker'}
            />
          {/if}

          {#if finalRender}
            <h3>Conformance and metrics ({finalRender.version})</h3>
            <table class="checks">
              <tbody>
                {#each finalRender.report.checks as c (c.id)}
                  <tr class={c.status}><td>{c.id}</td><td>{c.status}</td><td>{c.detail}</td></tr>
                {/each}
              </tbody>
            </table>
            <p class="dim small">
              {#each Object.entries(finalRender.report.metrics) as [k, v] (k)}<span class="metric">{k} {typeof v === 'number' ? Math.round(v * 100) / 100 : JSON.stringify(v)}</span>{/each}
            </p>
            {#if finalRender.stale?.length}<p class="warn">finish-stale: {finalRender.stale.join('; ')}</p>{/if}
          {/if}

          {#if detail.feedback.length || detail.approvals.length}
            <h3>History</h3>
            <ul class="history">
              {#each [...detail.feedback, ...detail.approvals].sort((a, b) => a.ts.localeCompare(b.ts)) as e (e.ts + e.type)}
                <li>
                  <span class="dim">{e.ts.slice(0, 16).replace('T', ' ')}</span>
                  {#if e.type === 'approve'}approved {e.version}{e.note ? `: ${e.note}` : ''}
                  {:else}feedback ({e.route}) on {e.on} → {e.opens}: {e.note}{Array.isArray(e.region) ? ` [region ${(e.region as number[]).join(',')}]` : ''}{/if}
                  {#if e.via === 'image-tools'}<span class="dim"> · image tools</span>{/if}
                </li>
              {/each}
            </ul>
          {/if}
        {:else if !loading}
          <p class="dim">Select an asset.</p>
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
    max-width: 42rem;
    color: var(--text-dim);
  }
  .empty h2 {
    color: var(--text);
  }
  .layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    min-height: 0;
    flex: 1;
  }
  .gallery {
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 0.5rem 0.6rem 1rem;
  }
  .gallery h3 {
    margin: 0.8rem 0 0.35rem;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .gallery ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .gallery li button {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    width: 100%;
    text-align: left;
    background: transparent;
    border-color: transparent;
    padding: 0.3rem 0.4rem;
  }
  .gallery li button.active {
    background: var(--panel-raised);
    border-color: var(--border);
  }
  .ph {
    width: 48px;
    height: 48px;
    border: 1px dashed var(--border);
    border-radius: 4px;
    flex: none;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .meta small {
    color: var(--text-dim);
    font-size: 0.72rem;
  }
  .detail {
    overflow-y: auto;
    padding: 0.8rem 1.1rem 2rem;
  }
  .head {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .head h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .why {
    color: var(--text-dim);
    margin: 0.35rem 0;
    font-size: 0.85rem;
  }
  .issues {
    margin: 0.3rem 0;
    font-size: 0.8rem;
    color: #ffd166;
  }
  .final {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
    align-items: flex-start;
    margin: 0.5rem 0 0.75rem;
  }
  .view {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .controls {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.8rem;
  }
  .seg {
    display: inline-flex;
  }
  .seg button {
    border-radius: 0;
    font-size: 0.78rem;
    padding: 0.25rem 0.55rem;
  }
  .seg button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .seg button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .seg button.on,
  .pick button.on {
    background: var(--accent);
    color: var(--accent-contrast);
    border-color: var(--accent);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    min-width: 16rem;
    max-width: 24rem;
    flex: 1;
  }
  .actions h3 {
    margin: 0.3rem 0 0;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }
  input[type='text'],
  textarea,
  select {
    font: inherit;
    font-size: 0.85rem;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
  }
  .link {
    background: none;
    border: none;
    color: var(--accent);
    padding: 0;
    text-align: left;
    font-size: 0.78rem;
  }
  h3 {
    font-size: 0.85rem;
    margin: 1rem 0 0.4rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
    width: 100%;
  }
  td,
  th {
    padding: 0.22rem 0.45rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }
  th {
    color: var(--text-dim);
    font-weight: 500;
  }
  .timeline tr.current td {
    background: #6ea8fe18;
  }
  .timeline .note td {
    color: var(--text-dim);
    font-size: 0.75rem;
    padding-left: 1.2rem;
  }
  .pick button {
    padding: 0 0.45rem;
    font-size: 0.72rem;
  }
  .fail,
  .checks .fail td {
    color: #ff7b8a;
  }
  .checks .flag td {
    color: #ffd166;
  }
  .checks .skip td {
    color: var(--text-dim);
  }
  .metric {
    margin-right: 0.8rem;
  }
  .history {
    font-size: 0.8rem;
    padding-left: 1.1rem;
  }
  .dim {
    color: var(--text-dim);
  }
  .small {
    font-size: 0.75rem;
  }
  .warn {
    color: #ffd166;
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
