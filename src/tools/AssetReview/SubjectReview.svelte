<script lang="ts">
  /**
   * Asset Review for a map, dungeon or settlement (docs/WORKFLOW.md §11): the latest version rendered by the same functions as
   * the map editors, the versions with any two side by side and what changed between them, the checks, the one-page data
   * sheet with its references, and the user's two calls: approve, or request changes (a note; a region is not drawn yet).
   * The rules are the CLI's (`artgen map approve`): only a final version with no failing check can be approved.
   */
  import { onDestroy } from 'svelte';
  import type { SubjectKind } from 'artgen-core';
  import type { WorkerLease } from '../../workers/workerRegistry';
  import type { ArtgenApi } from '../../workers/artgen.worker';
  import type { SubjectDetail, SubjectRow } from '../../core/project/engine';
  import { project } from '../../core/project/store.svelte';
  import StatusBadge from '../../core/components/StatusBadge.svelte';

  interface Props { lease: WorkerLease<ArtgenApi>; row: SubjectRow }
  let { lease, row }: Props = $props();

  let detail = $state<SubjectDetail | null>(null);
  let shownA = $state<string | null>(null);
  let shownB = $state<string | null>(null);
  let urlA = $state<string | null>(null);
  let urlB = $state<string | null>(null);
  let diff = $state<string[]>([]);
  let refUrls = $state<{ path: string; url: string }[]>([]);
  let approveNote = $state('');
  let note = $state('');
  let error = $state<string | null>(null);

  const blobs: string[] = [];
  const png = (bytes: Uint8Array) => { const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' })); blobs.push(u); return u; };
  onDestroy(() => { for (const u of blobs) URL.revokeObjectURL(u); });

  /** `working` is the file as it is now (when there are edits no version holds, or no version yet). */
  const choices = $derived(detail ? [...detail.versions.map(v => v.version), ...(detail.versions.length === 0 || row.status === 'in-pipeline' || row.status === 'stale' || row.status === 'revision' ? ['working'] : [])] : []);
  const canApprove = $derived(row.status === 'final' && row.pass && !project.busy);
  const canGiveFeedback = $derived(!!row.version && !!note.trim() && !project.busy);

  const png_of = async (api: typeof lease.api, kind: SubjectKind, id: string, v: string) => png(await api.subjectPng(kind, id, v === 'working' ? undefined : v));

  let ticket = 0;
  $effect(() => {
    void project.revision; const kind = row.kind, id = row.id; void row.status; void row.version;
    const mine = ++ticket;
    void load(kind, id, mine);
  });

  async function load(kind: SubjectKind, id: string, mine: number) {
    try {
      const api = await project.sync(lease.api), d = await api.subjectDetail(kind, id);
      if (mine !== ticket) return;
      detail = d; error = null;
      const last = d.versions[d.versions.length - 1]?.version ?? 'working', prev = d.versions[d.versions.length - 2]?.version ?? null;
      if (!shownB || !(shownB === 'working' || d.versions.some(v => v.version === shownB))) { shownB = last; shownA = prev; }
      await show(api, kind, id, mine);
      const refs: { path: string; url: string }[] = [];
      for (const path of d.sheet.refs ?? []) {
        const bytes = project.files && /\.png$/i.test(path) ? await project.files.readBytes(path) : undefined;
        if (bytes) refs.push({ path, url: png(bytes) });
      }
      if (mine === ticket) refUrls = refs;
    } catch (e) { if (mine === ticket) error = e instanceof Error ? e.message : String(e); }
  }

  async function show(api: typeof lease.api, kind: SubjectKind, id: string, mine = ticket) {
    const a = shownA ? await png_of(api, kind, id, shownA) : null, b = shownB ? await png_of(api, kind, id, shownB) : null;
    const lines = shownA && shownB ? await api.subjectDiff(kind, id, shownA, shownB) : [];
    if (mine === ticket) { urlA = a; urlB = b; diff = lines; }
  }

  async function pick(side: 'A' | 'B', v: string) {
    if (side === 'A') shownA = shownA === v ? null : v; else shownB = v;
    try { await show(await project.sync(lease.api), row.kind, row.id); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  async function approve() { if (await project.approveSubject(lease.api, row.kind, row.id, approveNote.trim())) approveNote = ''; }
  async function requestChanges() { if (await project.requestSubjectChanges(lease.api, row.kind, row.id, { note })) note = ''; }

  const when = (ts?: string) => ts?.slice(0, 16).replace('T', ' ') ?? '';
</script>

<header class="head">
  <h2>{row.id}</h2>
  <span class="kind">{row.kind}</span>
  <StatusBadge status={row.status} title={row.why} />
  <span class="dim">{row.version ?? 'no version'} · {row.fail ? `${row.fail} check${row.fail > 1 ? 's' : ''} FAIL` : 'checks pass'}{row.flag ? ` · ${row.flag} warning${row.flag > 1 ? 's' : ''}` : ''}</span>
</header>
<p class="why">{row.why}</p>
{#if error}<p class="error" role="alert">{error}</p>{/if}

{#if detail}
  <div class="top">
    <div class="shots">
      {#if urlB}
        <figure><img src={urlB} alt="{row.id} {shownB}" /><figcaption>{shownB}{shownB === 'working' ? ' (the file now)' : ''} · {detail.theme}</figcaption></figure>
      {/if}
      {#if urlA}
        <figure><img src={urlA} alt="{row.id} {shownA}" /><figcaption>{shownA}{shownA === 'working' ? ' (the file now)' : ''}</figcaption></figure>
      {/if}
    </div>

    <div class="actions">
      <h3>Your call</h3>
      <label class="block">
        Approve note (optional)
        <input type="text" bind:value={approveNote} placeholder="e.g. good to print" disabled={row.status !== 'final'} />
      </label>
      <button type="button" class="primary" onclick={approve} disabled={!canApprove}>Approve {row.version ?? ''}</button>
      {#if row.status !== 'final'}
        <p class="dim small">Only a final {row.kind} can be approved ({row.status}: {row.why}).</p>
      {:else if !row.pass}
        <p class="warn small">A check fails: fix it and record a new version, or request changes.</p>
      {/if}

      <h3>Request changes</h3>
      <textarea bind:value={note} rows="3" placeholder="what should change (a note on the latest version; Claude Code reworks it and records the next one)"></textarea>
      <button type="button" onclick={requestChanges} disabled={!canGiveFeedback}>Send feedback</button>
    </div>
  </div>

  <h3>Versions</h3>
  {#if detail.versions.length}
    <table class="versions">
      <thead><tr><th>version</th><th>when</th><th>by</th><th>note</th><th>score</th><th>compare</th></tr></thead>
      <tbody>
        {#each detail.versions as v (v.version)}
          <tr class:current={v.version === row.version}>
            <td>{v.version}</td><td>{when(v.ts)}</td><td>{v.by ?? '–'}</td><td>{v.note ?? ''}</td>
            <td>{v.score ?? '–'}{v.reviewer ? ` (${v.reviewer})` : ''}</td>
            <td class="pick">
              <button type="button" class:on={shownA === v.version} onclick={() => pick('A', v.version)}>A</button>
              <button type="button" class:on={shownB === v.version} onclick={() => pick('B', v.version)}>B</button>
            </td>
          </tr>
        {/each}
        {#if choices.includes('working')}
          <tr><td>working</td><td colspan="4" class="dim">the file now, not recorded as a version</td>
            <td class="pick"><button type="button" class:on={shownA === 'working'} onclick={() => pick('A', 'working')}>A</button><button type="button" class:on={shownB === 'working'} onclick={() => pick('B', 'working')}>B</button></td></tr>
        {/if}
      </tbody>
    </table>
    {#if shownA && shownB}
      <h3>What changed, {shownA} → {shownB}</h3>
      {#if diff.length}<pre class="diff">{diff.join('\n')}</pre>{:else}<p class="dim small">no change</p>{/if}
    {/if}
  {:else}
    <p class="dim small">No version recorded yet: ask Claude Code to run <code>artgen {row.kind} version {row.id}</code>.</p>
  {/if}

  <h3>Checks ({detail.versions.length ? row.version : 'working file'})</h3>
  <table class="checks">
    <tbody>
      {#each detail.checks as c, i (i)}
        <tr class={c.status}><td>{c.id}</td><td>{c.status}</td><td>{c.detail}</td></tr>
      {/each}
    </tbody>
  </table>

  <h3>Data sheet</h3>
  <table class="sheet">
    <tbody>
      {#each detail.sheet.rows as r (r.label)}<tr><th>{r.label}</th><td>{r.value}</td></tr>{/each}
    </tbody>
  </table>
  {#if detail.sheet.must?.length}
    <h4>Must hold</h4>
    <ul class="must">
      {#each detail.sheet.must as m (m.text)}<li class:unmet={m.met === false}>{m.met === undefined ? '·' : m.met ? '✓' : '✗'} {m.text}</li>{/each}
    </ul>
  {/if}
  {#if detail.brief}
    <h4>Brief</h4>
    <p class="brief">{detail.brief.body}</p>
  {:else}
    <p class="dim small">No brief yet: <code>artgen {row.kind} brief {row.id} --text "what it is for"</code>.</p>
  {/if}
  {#if refUrls.length}
    <h4>References</h4>
    <div class="refs">{#each refUrls as r (r.path)}<figure><img src={r.url} alt={r.path} /><figcaption>{r.path}</figcaption></figure>{/each}</div>
  {/if}

  {#if detail.feedback.length || detail.approvals.length}
    <h3>History</h3>
    <ul class="history">
      {#each [...detail.feedback, ...detail.approvals].sort((a, b) => a.ts.localeCompare(b.ts)) as e (e.ts + e.type)}
        <li>
          <span class="dim">{when(e.ts)}</span>
          {#if e.type === 'approve'}approved {e.version}{e.note ? `: ${e.note}` : ''}
          {:else}feedback on {e.on}: {e.note}{Array.isArray(e.region) ? ` [region ${(e.region as number[]).join(',')}]` : ''}{/if}
          {#if e.via === 'image-tools'}<span class="dim"> · image tools</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
{:else if !error}
  <p class="dim">reading {row.id}…</p>
{/if}

<style>
  .head { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
  .head h2 { margin: 0; font-size: 1.15rem; }
  .kind { font-size: 0.72rem; padding: 0.05rem 0.4rem; border: 1px solid var(--border); border-radius: 4px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; }
  .why { color: var(--text-dim); margin: 0.35rem 0; font-size: 0.85rem; }
  .top { display: flex; gap: 1.25rem; flex-wrap: wrap; align-items: flex-start; margin: 0.5rem 0 0.75rem; }
  .shots { display: flex; gap: 0.8rem; flex-wrap: wrap; flex: 2; min-width: 18rem; }
  .shots figure, .refs figure { margin: 0; display: flex; flex-direction: column; gap: 0.25rem; max-width: 100%; }
  .shots img { max-width: 100%; max-height: 420px; border: 1px solid var(--border); background: #fff; }
  .refs { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .refs img { max-height: 120px; max-width: 220px; border: 1px solid var(--border); }
  figcaption { font-size: 0.75rem; color: var(--text-dim); }
  .actions { display: flex; flex-direction: column; gap: 0.45rem; min-width: 16rem; max-width: 24rem; flex: 1; }
  .actions h3 { margin: 0.3rem 0 0; }
  .block { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8rem; color: var(--text-dim); }
  input[type='text'], textarea { font: inherit; font-size: 0.85rem; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 0.35rem 0.5rem; }
  h3 { font-size: 0.85rem; margin: 1rem 0 0.4rem; }
  h4 { font-size: 0.8rem; margin: 0.8rem 0 0.3rem; color: var(--text-dim); }
  table { border-collapse: collapse; font-size: 0.8rem; width: 100%; }
  td, th { padding: 0.22rem 0.45rem; border-bottom: 1px solid var(--border); text-align: left; }
  th { color: var(--text-dim); font-weight: 500; }
  .sheet th { width: 8rem; }
  .versions tr.current td { background: #6ea8fe18; }
  .pick button { padding: 0 0.45rem; font-size: 0.72rem; }
  .pick button.on { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .checks .fail td { color: #ff7b8a; }
  .checks .flag td { color: #ffd166; }
  .checks .skip td { color: var(--text-dim); }
  .diff { font-size: 0.75rem; background: var(--panel-raised); padding: 0.5rem 0.7rem; border-radius: 6px; overflow-x: auto; max-height: 14rem; }
  .must { list-style: none; padding: 0; margin: 0; font-size: 0.8rem; }
  .must .unmet { color: #ff7b8a; }
  .brief { font-size: 0.85rem; white-space: pre-wrap; margin: 0.2rem 0; }
  .history { font-size: 0.8rem; padding-left: 1.1rem; }
  .dim { color: var(--text-dim); }
  .small { font-size: 0.75rem; }
  .warn { color: #ffd166; }
  .error { margin: 0; padding: 0.5rem 0.9rem; background: #3a1d22; color: #ffb4bb; font-size: 0.85rem; white-space: pre-wrap; }
</style>
