<script lang="ts">
  import { tools } from './core/tools/registry';
  import { activeTool } from './core/stores/activeTool.svelte';

  const definition = $derived(activeTool.definition);

  // Keyed on the tool id so switching tools destroys the previous component
  // tree — that unmount is what releases its Fabric canvas and worker lease.
  const loader = $derived(definition ? definition.load() : null);
</script>

<div class="shell">
  <nav aria-label="Tools">
    <h1>Game Asset Suite</h1>
    <ul>
      {#each tools as tool (tool.id)}
        <li>
          <button
            type="button"
            class:active={tool.id === activeTool.id}
            aria-current={tool.id === activeTool.id ? 'page' : undefined}
            onclick={() => activeTool.select(tool.id)}
          >
            <span class="icon" aria-hidden="true">{tool.icon}</span>
            <span class="label">
              <strong>{tool.name}</strong>
              <small>{tool.blurb}</small>
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <p class="footnote">Everything runs locally in your browser.</p>
  </nav>

  <main>
    {#if loader}
      {#key activeTool.id}
        {#await loader}
          <p class="status">Loading {definition?.name}…</p>
        {:then module}
          {@const Tool = module.default}
          <Tool />
        {:catch error}
          <p class="status error">Could not load {definition?.name}: {error.message}</p>
        {/await}
      {/key}
    {:else}
      <p class="status">No tool selected.</p>
    {/if}
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: 100%;
  }

  nav {
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border-right: 1px solid var(--border);
    padding: 1rem 0.75rem;
    overflow-y: auto;
  }

  h1 {
    font-size: 0.95rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin: 0 0.25rem 1rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  nav button {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    width: 100%;
    text-align: left;
    background: transparent;
    border-color: transparent;
    padding: 0.55rem 0.6rem;
  }
  nav button.active {
    background: var(--panel-raised);
    border-color: var(--border);
  }
  .icon {
    font-size: 1rem;
    line-height: 1.4;
    color: var(--accent);
  }
  .label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .label small {
    color: var(--text-dim);
    font-size: 0.75rem;
    line-height: 1.3;
  }

  .footnote {
    margin-top: auto;
    padding: 0.5rem 0.6rem 0;
    font-size: 0.72rem;
    color: var(--text-dim);
  }

  main {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .status {
    padding: 2rem;
    color: var(--text-dim);
  }
  .status.error {
    color: #ffb4bb;
  }
</style>
