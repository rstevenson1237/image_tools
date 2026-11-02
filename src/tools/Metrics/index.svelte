<script lang="ts">
  /**
   * Metrics (R8, docs/TOOLING-PLAN.md §11): how the work is going, in numbers. This repo's KPIs per generator, where the time goes by
   * kind of pass, and the pooled exports per artgen version (the ones under `art/metrics/` plus any you drop in), so you can see
   * whether a release made production cheaper. It reads the ledger and the exports; it writes nothing.
   */
  import { onDestroy } from 'svelte';
  import { poolExports, type AnalyticsReport, type GeneratorMetrics, type MetricsExport } from 'artgen-core';
  import { acquire } from '../../workers/workerRegistry';
  import type { ArtgenApi } from '../../workers/artgen.worker';
  import { project } from '../../core/project/store.svelte';
  import ProjectBar from '../../core/components/ProjectBar.svelte';
  import { kpisOf, parseExportFile, trendRows, whereTimeGoes } from './model';

  const lease = acquire<ArtgenApi>('artgen');
  onDestroy(() => lease.release());

  let report = $state<AnalyticsReport | null>(null);
  let generators = $state<Record<string, GeneratorMetrics>>({});
  let own = $state<MetricsExport[]>([]);
  /** Exports dropped in from other repos: kept in memory only, never written. */
  let dropped = $state<MetricsExport[]>([]);
  let problem = $state<string | null>(null);
  let input = $state<HTMLInputElement>();

  let ticket = 0;
  $effect(() => {
    void project.revision;
    if (!project.snapshot) { report = null; generators = {}; own = []; return; }
    const mine = ++ticket;
    void (async () => {
      try {
        const api = await project.sync(lease.api), [a, g, e] = await Promise.all([api.analytics(), api.generators(), api.metricsExports()]);
        if (mine === ticket) { report = a.report; generators = g; own = e; problem = null; }
      } catch (e) { if (mine === ticket) problem = e instanceof Error ? e.message : String(e); }
    })();
  });

  const kpis = $derived(kpisOf(generators));
  const time = $derived(report ? whereTimeGoes(report) : []);
  const pool = $derived(poolExports([...own, ...dropped]));
  const trend = $derived(trendRows(pool.versions));
  const gens = $derived(pool.versions.flatMap(v => Object.entries(v.generators).map(([g, m]) => ({ artgen: v.artgen, g, ...m }))));

  async function onFiles(e: Event) {
    const el = e.currentTarget as HTMLInputElement, files = [...(el.files ?? [])];
    el.value = '';
    const next: MetricsExport[] = [], errors: string[] = [];
    for (const f of files) { try { next.push(parseExportFile(f.name, await f.text())); } catch (err) { errors.push(err instanceof Error ? err.message : String(err)); } }
    dropped = [...dropped, ...next];
    problem = errors.length ? errors.join('\n') : null;
  }

  const cell = (v: number | undefined, d = 2) => (v === undefined ? '–' : String(Math.round(v * 10 ** d) / 10 ** d));
  const pct = (v: number | undefined) => (v === undefined ? '–' : `${Math.round(v * 100)}%`);
  const change = (v: number | undefined) => (v === undefined ? '' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
</script>

<div class="tool">
  <ProjectBar>
    <button type="button" onclick={() => input?.click()}>Add exports…</button>
    <input bind:this={input} type="file" accept=".json,application/json" multiple hidden onchange={onFiles} />
    {#if dropped.length}<button type="button" onclick={() => (dropped = [])}>Clear {dropped.length} added</button>{/if}
  </ProjectBar>

  {#if !project.files}
    <div class="empty">
      <h2>Metrics</h2>
      <p>Open a game repo that has an artgen <code>art/</code> folder to see passes, tokens and minutes per approved asset, and where the time goes.
        <code>artgen metrics export</code> writes this repo's numbers to <code>art/metrics/</code>; exports from other repos can be added here to compare versions.</p>
    </div>
  {:else}
    <div class="page">
      {#if problem}<p class="error" role="alert">{problem}</p>{/if}

      {#each Object.entries(kpis) as [name, list] (name)}
        <section aria-label="{name} KPIs">
          <h3>{name === 'art' ? 'Pixel art' : name}</h3>
          <div class="tiles">
            {#each list as k (k.id)}
              <div class="tile" data-kpi="{name}-{k.id}"><b>{k.value}</b><span>{k.label}</span><small>{k.hint}</small></div>
            {/each}
          </div>
        </section>
      {:else}
        <p class="dim">No work in the ledger yet. Numbers appear once assets or maps have passes.</p>
      {/each}

      {#if time.length}
        <section aria-label="Where the time goes">
          <h3>Where the time goes</h3>
          <ul class="bars" data-testid="time-bars">
            {#each time as t (t.pass)}
              <li><span class="label">{t.pass}</span><span class="bar" style:width="{Math.max(2, Math.round(t.share * 100))}%"></span><span class="num">{t.minutes} min · {Math.round(t.share * 100)}%</span></li>
            {/each}
          </ul>
        </section>
      {/if}

      <section aria-label="Pooled exports">
        <h3>Across versions</h3>
        <p class="dim small">{pool.exports} export{pool.exports === 1 ? '' : 's'} from {pool.repos.length} repo{pool.repos.length === 1 ? '' : 's'}{pool.repos.length ? `: ${pool.repos.join(', ')}` : ''}.
          A lower tokens-per-approved number at a later version means a release made production cheaper; compare versions only when they hold the same kinds of asset.</p>
        {#if trend.length}
          <table data-testid="pool-table">
            <thead><tr><th>artgen</th><th>repos</th><th>assets</th><th>approved</th><th>tokens / approved</th><th>minutes / approved</th><th>first-pass approval</th><th>checks failing most</th></tr></thead>
            <tbody>
              {#each trend as v (v.artgen)}
                <tr>
                  <td>{v.artgen}</td><td>{v.repos}</td><td>{v.assets}</td><td>{v.approved}</td>
                  <td>{cell(v.tokensPerApproved, 0)} <span class="chg" class:good={(v.tokensChange ?? 0) < 0} class:bad={(v.tokensChange ?? 0) > 0}>{change(v.tokensChange)}</span></td>
                  <td>{cell(v.minutesPerApproved, 1)}</td><td>{pct(v.firstPassApprovalRate)}</td><td>{v.topGateFailures.map(f => `${f.check} ×${f.n}`).join(', ') || '–'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if gens.length}
            <h4>Per generator</h4>
            <table>
              <thead><tr><th>artgen</th><th>generator</th><th>subjects</th><th>approved</th><th>passes / approved</th><th>first-pass approval</th><th>review image tokens</th><th>minutes</th></tr></thead>
              <tbody>
                {#each gens as m (m.artgen + m.g)}
                  <tr><td>{m.artgen}</td><td>{m.g}</td><td>{m.subjects}</td><td>{m.approved}</td><td>{cell(m.passesPerApproved)}</td><td>{pct(m.firstPassApprovalRate)}</td><td>{m.imageTokens}</td><td>{m.wallMinutes}</td></tr>
                {/each}
              </tbody>
            </table>
          {/if}
        {:else}
          <p class="dim">No exports yet. Run <code>artgen metrics export</code> in this repo, or add exports from other repos above.</p>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .tool { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .page { overflow-y: auto; padding: 1rem 1.2rem 2rem; display: grid; gap: 1.2rem; align-content: start; }
  .empty { padding: 2rem; max-width: 46rem; color: var(--text-dim); }
  h3, h4 { margin: 0 0 0.4rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.6rem; }
  .tile { display: grid; gap: 0.1rem; padding: 0.6rem 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); }
  .tile b { font-size: 1.25rem; overflow-wrap: anywhere; }
  .tile span { font-size: 0.8rem; font-weight: 600; }
  .tile small { color: var(--text-dim); font-size: 0.72rem; line-height: 1.3; }
  .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .bars li { display: grid; grid-template-columns: 6rem 1fr 9rem; gap: 0.6rem; align-items: center; font-size: 0.82rem; }
  .bars .bar { height: 0.8rem; background: var(--accent); border-radius: 3px; min-width: 2px; }
  .bars .num { color: var(--text-dim); text-align: right; }
  table { border-collapse: collapse; font-size: 0.82rem; width: 100%; }
  th, td { text-align: left; padding: 0.3rem 0.6rem; border-bottom: 1px solid var(--border); }
  th { color: var(--text-dim); font-weight: 600; }
  .chg.good { color: #7bd88f; } .chg.bad { color: #ff7b8a; }
  .dim { color: var(--text-dim); } .small { font-size: 0.8rem; }
  .error { background: #3a1d22; color: #ffb4bb; padding: 0.45rem 0.9rem; margin: 0; white-space: pre-wrap; }
</style>
