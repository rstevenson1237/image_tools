<script lang="ts">
  /**
   * The stage view (R8, docs/TOOLING-PLAN.md §8): an asset's production stages as a chain of nodes, each with its key, whether you
   * approved it as it is, and its cache status against another version (same key = the result is reused; changed = it runs again).
   * The gated stages (placeholder, shape) take your verdict here, through the form the operation registry generates for
   * `stage approve | reject`, so the page and the CLI take the same arguments.
   */
  import { STAGES, type GateStage, type StageId } from 'artgen-core';
  import type { StagesView } from '../../core/project/engine';
  import type { Img } from '../../core/components/pixels';
  import PixelPreview from '../../core/components/PixelPreview.svelte';
  import { formOf, loadForms, type FormOp, type FormValues } from '../../core/ops/forms';
  import OperationForm from '../../core/ops/OperationForm.svelte';

  interface Props {
    view: StagesView;
    /** The shape sheet of the version: silhouettes against the placeholder, with the shape checks. */
    sheet?: Img | null;
    /** Versions of the asset, to choose what the cache status compares against. */
    versions: string[];
    against: string | null;
    busy?: boolean;
    onagainst: (version: string | null) => void;
    onverdict: (stage: GateStage, verdict: 'approve' | 'reject', values: FormValues) => void;
  }
  let { view, sheet = null, versions, against, busy = false, onagainst, onverdict }: Props = $props();

  const WHY: Record<StageId, string> = {
    placeholder: 'flat boxes at the right size, pivot and footprint', shape: 'the silhouette of every cell', rig: 'bones and their lengths (rigged assets)', decorate: 'the colours: materials, layers, shading',
    decal: 'marks kept on their own layer', lighting: 'normal maps and the light direction', rotation: 'how the facings are made', animation: 'the animation contract and every cell\'s anchors',
  };
  const isGate = (s: StageId): s is GateStage => s === 'placeholder' || s === 'shape';

  let picked = $state<StageId | null>(null);
  /** The open stage: the one you picked, else the first gated stage that waits for you, else shape. */
  const open = $derived<StageId>(picked ?? view.gates.find(g => view.states[g] === 'new' || view.states[g] === 'changed') ?? 'shape');
  const checks = $derived(view.checks.filter(c => c.stage === open));

  let forms = $state<FormOp[]>([]);
  void loadForms().then(f => (forms = f));
  let verdict = $state<'approve' | 'reject'>('approve');
  const op = $derived(formOf(forms, verdict === 'approve' ? 'stage.approve' : 'stage.reject'));

  const cache = (s: StageId): 'reused' | 'runs again' | 'new' | 'dropped' | null => {
    const d = view.against?.diff[s];
    return d === 'same' ? 'reused' : d === 'changed' ? 'runs again' : d === 'added' ? 'new' : d === 'removed' ? 'dropped' : null;
  };
  const latest = (s: GateStage) => [...view.verdicts].reverse().find(v => v.stage === s);
</script>

<section class="stages" aria-label="Stages">
  <div class="head">
    <h3>Stages of {view.version}</h3>
    <label class="cmp">
      cache against
      <select value={against ?? ''} onchange={(e) => onagainst(e.currentTarget.value || null)}>
        <option value="">(nothing)</option>
        {#each versions.filter(v => v !== view.version) as v (v)}<option value={v}>{v}</option>{/each}
      </select>
    </label>
  </div>
  <p class="dim small">
    Each stage has a key, a digest of what it produced. A revision that keeps a stage's key leaves that stage, and what you approved on it, as it was.
    {view.gates.length ? `Gates on ${view.gates.join(' and ')}: the pipeline stops there for your verdict.` : 'This asset has no gates; you can still give a verdict on placeholder or shape.'}
  </p>

  <ol class="chain" data-testid="stage-chain">
    {#each STAGES as s, n (s)}
      {@const state = view.states[s]}
      <li>
        <button type="button" class="node {state}" class:open={open === s} aria-pressed={open === s} data-stage={s} data-state={state} onclick={() => (picked = s)} title={WHY[s]}>
          <span class="n">{n}</span>
          <strong>{s}</strong>
          <code>{view.keys[s] ?? '–'}</code>
          <span class="state">{state === 'n/a' ? 'n/a' : state}</span>
          {#if isGate(s) && view.gates.includes(s)}<span class="gate">gate</span>{/if}
          {#if cache(s)}<span class="cache {cache(s)?.replace(' ', '-')}">{cache(s)}</span>{/if}
        </button>
      </li>
    {/each}
  </ol>

  <div class="detail" data-testid="stage-detail">
    <h4>{open}{view.keys[open] ? ` · ${view.keys[open]}` : ''}</h4>
    <p class="dim small">{WHY[open]}.{view.keys[open] === undefined ? ' It does not apply to this asset.' : ''}</p>
    {#if open === 'shape' && sheet}
      <div class="sheet" aria-label="shape sheet"><PixelPreview img={sheet} scale={Math.max(1, Math.min(2, Math.floor(900 / sheet.w)))} background="#202028" /></div>
    {/if}
    {#if checks.length}
      <ul class="checks">
        {#each checks as c (c.id)}<li class={c.status}><b>{c.id}</b> {c.status}{c.detail ? `: ${c.detail}` : ''}</li>{/each}
      </ul>
    {:else if open === 'shape' || open === 'placeholder'}
      <p class="dim small">No check of this stage failed or was flagged.</p>
    {/if}

    {#if isGate(open) && view.keys[open] !== undefined}
      {@const last = latest(open)}
      {#if last}<p class="small">Your last verdict: <b>{last.verdict}</b>{last.version ? ` on ${last.version}` : ''}{last.key === view.keys[open] ? ' (this key)' : ' (an earlier key)'}{last.note ? ` - ${last.note}` : ''}</p>{/if}
      <div class="verdict">
        <span class="seg" role="radiogroup" aria-label="verdict">
          <button type="button" class:on={verdict === 'approve'} onclick={() => (verdict = 'approve')}>approve it</button>
          <button type="button" class:on={verdict === 'reject'} onclick={() => (verdict = 'reject')}>reject it</button>
        </span>
        {#if op}
          {#key `${verdict}:${open}:${view.version}`}
            <OperationForm {op} {busy} hide={['via', 'ledger', 'direction', 'user_approved']}
              fixed={{ asset: view.id, stage: open, ...(open === 'shape' && { version: view.version }) }}
              submit={verdict === 'approve' ? `Record: approve ${open}` : `Record: reject ${open}`} onsubmit={(values) => onverdict(open as GateStage, verdict, values)} />
          {/key}
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .stages { display: grid; gap: 0.5rem; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  h3, h4 { margin: 0; }
  .cmp { font-size: 0.8rem; color: var(--text-dim); display: flex; gap: 0.4rem; align-items: center; }
  .chain { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem 1.2rem; }
  .chain li { position: relative; }
  .chain li:not(:last-child)::after { content: '→'; position: absolute; right: -1.05rem; top: 50%; transform: translateY(-50%); color: var(--text-dim); }
  .node { display: grid; gap: 0.15rem; text-align: left; min-width: 7.2rem; padding: 0.45rem 0.6rem; border-left: 4px solid var(--border); }
  .node.open { border-color: var(--accent); background: var(--panel-raised); }
  .node .n { font-size: 0.68rem; color: var(--text-dim); }
  .node code { font-size: 0.72rem; color: var(--text-dim); }
  .node .state { font-size: 0.72rem; font-weight: 600; }
  .node.approved { border-left-color: #7bd88f; } .node.approved .state { color: #7bd88f; }
  .node.changed { border-left-color: #ffd166; } .node.changed .state { color: #ffd166; }
  .node.new { border-left-color: #6ea8fe; } .node.new .state { color: #6ea8fe; }
  .node.rejected { border-left-color: #ff7b8a; } .node.rejected .state { color: #ff7b8a; }
  .node[data-state='n/a'] { opacity: 0.55; }
  .gate { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); }
  .cache { font-size: 0.7rem; }
  .cache.reused { color: #7bd88f; } .cache.runs-again { color: #ffd166; } .cache.new, .cache.dropped { color: var(--text-dim); }
  .detail { border: 1px solid var(--border); border-radius: 8px; padding: 0.7rem 0.8rem; display: grid; gap: 0.5rem; background: var(--panel); }
  .sheet { overflow-x: auto; }
  .checks { margin: 0; padding-left: 1.1rem; font-size: 0.82rem; }
  .checks .fail { color: #ff7b8a; } .checks .flag { color: #ffd166; } .checks .pass { color: #7bd88f; }
  .verdict { display: grid; gap: 0.5rem; }
  .seg { display: inline-flex; gap: 0.25rem; }
  .seg button.on { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  .dim { color: var(--text-dim); margin: 0; } .small { font-size: 0.8rem; }
</style>
