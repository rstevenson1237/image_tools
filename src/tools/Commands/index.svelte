<script lang="ts">
  /**
   * Commands (R8): every artgen operation, with the form the operation registry generates for it (the same parameters and help text as
   * the CLI, MCP and Python). Fill one in to get the `artgen …` line; the few that are your own decisions (approve, stage approve and
   * reject, stages) can also run here on the open project, by the CLI's rules.
   */
  import { onDestroy } from 'svelte';
  import { acquire } from '../../workers/workerRegistry';
  import type { ArtgenApi } from '../../workers/artgen.worker';
  import { project } from '../../core/project/store.svelte';
  import ProjectBar from '../../core/components/ProjectBar.svelte';
  import OperationForm from '../../core/ops/OperationForm.svelte';
  import { loadForms, searchForms, type FormOp, type FormValues } from '../../core/ops/forms';
  import { runnable, runOp } from '../../core/ops/webOps';
  import { useShortcuts } from '../../core/shell/shortcuts.svelte';

  const lease = acquire<ArtgenApi>('artgen');
  onDestroy(() => lease.release());

  let search = $state<HTMLInputElement>();
  useShortcuts('Commands', [{ key: '/', label: 'search the operations', run: () => search?.focus() }]);

  let forms = $state<FormOp[]>([]);
  let loadError = $state<string | null>(null);
  loadForms().then(f => (forms = f), e => (loadError = String(e)));

  let module = $state<'' | 'art' | 'maps' | 'core'>('');
  let query = $state('');
  let name = $state<string | null>(null);
  let output = $state<string | null>(null);
  let failure = $state<string | null>(null);

  const list = $derived(searchForms(forms, { module: module || undefined, query }));
  const op = $derived(forms.find(f => f.name === name));

  function pick(n: string) { name = n; output = null; failure = null; }

  async function run(values: FormValues) {
    if (!op) return;
    output = null; failure = null;
    try { output = await runOp(lease.api, op.name, values); } catch (e) { failure = e instanceof Error ? e.message : String(e); }
  }
</script>

<div class="tool">
  <ProjectBar />
  <div class="layout">
    <aside aria-label="Operations">
      <input type="search" bind:this={search} bind:value={query} placeholder="search {forms.length} operations" aria-label="search operations" />
      <span class="seg" role="radiogroup" aria-label="module">
        {#each [['', 'all'], ['art', 'art'], ['maps', 'maps'], ['core', 'core']] as [m, label] (m)}
          <button type="button" class:on={module === m} onclick={() => (module = m as typeof module)}>{label}</button>
        {/each}
      </span>
      {#if loadError}<p class="error" role="alert">{loadError}</p>{/if}
      <ul>
        {#each list as f (f.name)}
          <li><button type="button" class:active={f.name === name} data-op={f.name} onclick={() => pick(f.name)}>
            <strong>{f.name.replace(/\./g, ' ')}</strong>
            <small>{f.summary}</small>
          </button></li>
        {/each}
      </ul>
    </aside>

    <main>
      {#if op}
        {#key op.name}
          <h2>artgen {op.name.replace(/\./g, ' ')} <span class="effect {op.effect}">{op.effect}</span></h2>
          <p class="dim">{op.summary}</p>
          <OperationForm {op} hide={['via', 'ledger', 'direction', 'user_approved']} busy={project.busy}
            submit={runnable(op.name) && project.files ? `Run on ${project.name}` : undefined} onsubmit={run} />
          {#if runnable(op.name) && !project.files}<p class="dim small">Open a game repo to run this here.</p>{/if}
          {#if failure}<p class="error" role="alert">{failure}</p>{/if}
          {#if project.notice && output}<p class="notice" role="status">{project.notice}</p>{/if}
          {#if output}<pre data-testid="op-output">{output}</pre>{/if}
        {/key}
      {:else}
        <p class="dim">Pick an operation. The form shows its parameters and the command line it stands for; copy that line into a terminal or hand it to Claude Code.</p>
      {/if}
    </main>
  </div>
</div>

<style>
  .tool { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .layout { display: grid; grid-template-columns: 22rem 1fr; flex: 1; min-height: 0; }
  aside { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; border-right: 1px solid var(--border); min-height: 0; }
  aside ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; display: grid; gap: 0.2rem; }
  aside li button { display: grid; gap: 0.1rem; width: 100%; text-align: left; background: transparent; border-color: transparent; }
  aside li button.active { background: var(--panel-raised); border-color: var(--border); }
  aside small { color: var(--text-dim); font-size: 0.72rem; line-height: 1.3; }
  input[type='search'] { font: inherit; color: var(--text); background: var(--panel-raised); border: 1px solid var(--border); border-radius: 6px; padding: 0.3rem 0.5rem; }
  .seg { display: inline-flex; gap: 0.25rem; }
  .seg button.on { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
  main { overflow-y: auto; padding: 1rem 1.2rem; display: grid; gap: 0.7rem; align-content: start; max-width: 52rem; }
  h2 { margin: 0; font-size: 1.05rem; font-family: ui-monospace, monospace; }
  .effect { font-family: system-ui, sans-serif; font-size: 0.7rem; padding: 0.05rem 0.45rem; border: 1px solid currentColor; border-radius: 999px; color: var(--text-dim); }
  .effect.write { color: #ffd166; } .effect.render { color: #6ea8fe; }
  .dim { color: var(--text-dim); margin: 0; } .small { font-size: 0.8rem; }
  .error { background: #3a1d22; color: #ffb4bb; padding: 0.45rem 0.9rem; margin: 0; }
  .notice { background: #1d2f24; color: #b6f0c2; padding: 0.45rem 0.9rem; margin: 0; }
  pre { margin: 0; padding: 0.6rem; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; overflow: auto; max-height: 24rem; font-size: 0.78rem; }
</style>
