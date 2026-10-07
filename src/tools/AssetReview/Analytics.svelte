<script lang="ts">
  /** Pipeline analytics (D19, SPEC §11.1): per-pass gains, cost per asset, revision rate, review independence. */
  import type { AnalyticsReport } from 'artgen-core';

  interface Props {
    report: AnalyticsReport;
  }
  let { report }: Props = $props();

  const fmt = (v: number | undefined, d = 2) => (v === undefined ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toString());
  const signed = (v: number | undefined) => (v === undefined ? '–' : `${v > 0 ? '+' : ''}${fmt(v)}`);
  const money = (v: number) => `$${v.toFixed(2)}`;
  const k = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));
</script>

<section class="analytics" aria-label="Analytics">
  <div class="tiles">
    <div><b>{report.assets}</b><span>assets</span></div>
    <div><b>{signed(report.totals.meanFromRevisions)}</b><span>mean gain from revisions</span></div>
    <div><b>{signed(report.totals.meanFromFinish)}</b><span>mean gain from finishing</span></div>
    <div><b>{money(report.totals.cost)}</b><span>est. cost ({k(report.totals.outTokens)} out, {k(report.totals.imageTokens)} image tok)</span></div>
    <div>
      <b>{report.userRevisionRate.rate === undefined ? '–' : `${Math.round(report.userRevisionRate.rate * 100)}%`}</b>
      <span>user revision rate ({report.userRevisionRate.feedback} notes / {report.userRevisionRate.finals} finals)</span>
    </div>
    <div>
      <b>{report.review.blind.n ? signed(report.review.blind.meanGap) : '–'}</b>
      <span>mean blind gap (own − blind, {report.review.blind.n} finals)</span>
    </div>
  </div>

  <h3>Per pass</h3>
  <table>
    <thead><tr><th>pass</th><th>n</th><th>mean score</th><th>mean Δ</th><th>regressed</th><th>gate pass</th><th>out tok</th><th>image tok</th><th>mean wall</th></tr></thead>
    <tbody>
      {#each report.passes as p (p.pass)}
        <tr>
          <td>{p.pass}</td><td>{p.n}</td><td>{fmt(p.meanScore)}</td>
          <td class:neg={(p.meanDelta ?? 0) < 0} class:pos={(p.meanDelta ?? 0) > 0}>{signed(p.meanDelta)}</td>
          <td>{p.regressed}</td><td>{p.gatePass}/{p.n}</td><td>{k(p.outTokens)}</td><td>{k(p.imageTokens)}</td>
          <td>{p.meanWallS === undefined ? '–' : `${Math.round(p.meanWallS)} s`}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h3>Per asset</h3>
  <table>
    <thead><tr><th>asset</th><th>kind</th><th>r1</th><th>best</th><th>final</th><th>from revisions</th><th>from finish</th><th>passes</th><th>cost</th></tr></thead>
    <tbody>
      {#each report.perAsset as a (a.id)}
        <tr>
          <td>{a.id}</td><td>{a.kind}</td><td>{fmt(a.r1)}</td><td>{fmt(a.best)}</td><td>{fmt(a.final)}</td>
          <td>{signed(a.fromRevisions)}</td><td>{signed(a.fromFinish)}</td><td>{a.passes}</td><td>{money(a.cost)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h3>Cost and quality by kind</h3>
  <table>
    <thead><tr><th>kind</th><th>n</th><th>mean final</th><th>mean cost</th><th>mean passes</th></tr></thead>
    <tbody>
      {#each report.byGroup.kind as g (g.key)}
        <tr><td>{g.key}</td><td>{g.n}</td><td>{fmt(g.meanFinal)}</td><td>{g.meanCost === undefined ? '–' : money(g.meanCost)}</td><td>{fmt(g.meanPasses, 1)}</td></tr>
      {/each}
    </tbody>
  </table>

  <h3>Review independence</h3>
  <p class="dim">
    Scores by reviewer: {Object.entries(report.review.byReviewer).map(([r, n]) => `${r} ${n}`).join(', ') || 'none'}.
    {report.review.blind.over1} final(s) more than 1 point under their own score when re-scored blind.
  </p>

  {#if report.regressions.length}
    <h3>Regressions</h3>
    <ul>{#each report.regressions as r (r.asset + r.version)}<li>{r.asset} {r.version} ({r.pass}): {signed(r.delta)}</li>{/each}</ul>
  {/if}

  {#if report.suggestions.length}
    <h3>Budget suggestions</h3>
    <ul>{#each report.suggestions as s (s)}<li>{s}</li>{/each}</ul>
  {/if}
</section>

<style>
  .analytics {
    padding: 0.25rem 0 1rem;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.5rem;
  }
  .tiles div {
    background: var(--panel-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.55rem 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .tiles b {
    font-size: 1.25rem;
  }
  .tiles span {
    font-size: 0.72rem;
    color: var(--text-dim);
  }
  h3 {
    font-size: 0.85rem;
    margin: 1rem 0 0.4rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.78rem;
    width: 100%;
  }
  th,
  td {
    text-align: right;
    padding: 0.2rem 0.45rem;
    border-bottom: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  th {
    color: var(--text-dim);
    font-weight: 500;
  }
  .neg {
    color: #ff7b8a;
  }
  .pos {
    color: #7bd88f;
  }
  .dim,
  ul {
    font-size: 0.8rem;
    color: var(--text-dim);
  }
</style>
