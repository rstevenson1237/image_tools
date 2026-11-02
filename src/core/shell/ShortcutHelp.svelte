<script lang="ts">
  /** The list of registered shortcuts (`?`): the shell's, and the open tool's. */
  import { shell, shortcuts } from './shortcuts.svelte';
  let dialog = $state<HTMLDialogElement>();
  $effect(() => {
    if (!dialog) return;
    if (shell.help && !dialog.open) dialog.showModal();
    else if (!shell.help && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={() => (shell.help = false)} aria-label="Keyboard shortcuts">
  <h2>Keyboard shortcuts</h2>
  {#key shell.rev}
  {#each shortcuts.groups as g, i (`${i}:${g.scope}`)}
    <h3>{g.scope}</h3>
    <dl>
      {#each g.list as s (s.key)}<div><dt><kbd>{s.key}</kbd></dt><dd>{s.label}</dd></div>{/each}
    </dl>
  {/each}
  {/key}
  <p class="dim">Shortcuts pause while you type in a field. <kbd>Esc</kbd> closes this list.</p>
  <button type="button" onclick={() => (shell.help = false)}>Close</button>
</dialog>

<style>
  dialog { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.4rem; min-width: 22rem; max-width: 32rem; }
  dialog::backdrop { background: rgb(0 0 0 / 0.5); }
  h2 { margin: 0 0 0.5rem; font-size: 1.05rem; }
  h3 { margin: 0.8rem 0 0.3rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
  dl { margin: 0; display: grid; gap: 0.25rem; }
  dl div { display: grid; grid-template-columns: 3rem 1fr; gap: 0.5rem; align-items: baseline; }
  dt { margin: 0; } dd { margin: 0; font-size: 0.88rem; }
  kbd { font: 0.8rem ui-monospace, monospace; padding: 0.05rem 0.4rem; border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 4px; background: var(--panel-raised); }
  .dim { color: var(--text-dim); font-size: 0.78rem; }
</style>
