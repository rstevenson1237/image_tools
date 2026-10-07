<script lang="ts">
  /**
   * Open / reopen / reload the game repo's art folder (File System Access), or the zip fallback in browsers without a
   * directory picker. Shared by the art pipeline tools; the project stays open while switching between them.
   */
  import { project } from '../project/store.svelte';

  interface Props {
    /** Tool-specific buttons, shown at the right of the bar. */
    children?: import('svelte').Snippet;
  }
  let { children }: Props = $props();

  let zipInput = $state<HTMLInputElement>();

  async function onZip(e: Event) {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (f) await project.importZip(f);
  }
</script>

<header class="bar">
  {#if project.files}
    <span class="name" title={project.isZip ? 'working on a zip in memory' : 'live folder'}>
      <span class="dot" class:zip={project.isZip}></span>{project.name}{project.isZip ? ' (zip)' : ''}
    </span>
    <button type="button" onclick={() => project.reload()} disabled={project.busy} title="re-read the files (after Claude Code changed them)">Reload</button>
    {#if project.isZip}
      <button type="button" onclick={() => project.exportZip()} title="download the art folder; unzip over the game repo root">
        Download art.zip{project.dirty.length ? ` (${project.dirty.length} changed)` : ''}
      </button>
    {/if}
    <button type="button" onclick={() => project.close()}>Close</button>
  {:else}
    {#if project.canPickFolder}
      <button type="button" class="primary" onclick={() => project.open()} disabled={project.busy}>Open game folder…</button>
      {#if project.remembered}
        <button type="button" onclick={() => project.reopen()} disabled={project.busy}>Reopen {project.remembered}</button>
      {/if}
    {/if}
    <button type="button" class:primary={!project.canPickFolder} onclick={() => zipInput?.click()} disabled={project.busy}>Import zip…</button>
    <input bind:this={zipInput} type="file" accept=".zip,application/zip" hidden onchange={onZip} />
    {#if !project.canPickFolder}
      <span class="hint">This browser can't open folders directly: zip the game repo (or its art/ folder), work here, download the zip back.</span>
    {/if}
  {/if}
  {#if children}<span class="tools">{@render children()}</span>{/if}
  {#if project.busy}<span class="busy">working…</span>{/if}
</header>
{#if project.error}<p class="msg error" role="alert">{project.error}</p>{/if}
{#if project.notice}<p class="msg notice" role="status">{project.notice}</p>{/if}

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }
  .name {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-right: 0.25rem;
  }
  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: #7bd88f;
  }
  .dot.zip {
    background: #ffd166;
  }
  .hint,
  .busy {
    font-size: 0.8rem;
    color: var(--text-dim);
  }
  .tools {
    margin-left: auto;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .msg {
    margin: 0;
    padding: 0.45rem 0.9rem;
    font-size: 0.85rem;
    white-space: pre-wrap;
  }
  .error {
    background: #3a1d22;
    color: #ffb4bb;
  }
  .notice {
    background: #1d2f24;
    color: #b6f0c2;
  }
</style>
