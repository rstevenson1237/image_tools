<script lang="ts">
  /**
   * The frame the Terrain, Dungeon and Settlement editors share: the project bar with the open / save controls for the
   * kind of document, an error banner, and the two-column layout (a controls column and the canvas area). Everything
   * the editor draws goes in the two snippets; the frame's styles reach into them (`.toolbar`, `.pair`, `.items`, …).
   */
  import type { Snippet } from 'svelte';
  import { project } from '../project/store.svelte';
  import ProjectBar from '../components/ProjectBar.svelte';
  import type { MapProjectFiles } from './projectFiles.svelte';

  interface Props {
    files: MapProjectFiles;
    /** Id of the open document: names the file the Save button writes. */
    id: string;
    error: string | null;
    controls: Snippet;
    main: Snippet;
  }
  let { files, id, error, controls, main }: Props = $props();
  const kind = $derived(files.kind);
</script>

<div class="map-editor">
  <ProjectBar>
    {#if project.files}
      <select bind:value={files.pick} disabled={!files.ids.length} title="{kind.plural} in {kind.dir}">
        {#each files.ids as fid (fid)}<option value={fid}>{fid}</option>{:else}<option value="">no {kind.plural} yet</option>{/each}
      </select>
      <button type="button" onclick={() => files.openFromProject()} disabled={!files.pick}>Open</button>
      <button type="button" class="primary" onclick={() => files.saveToProject()} title="write {kind.dir}/{id}/{kind.file}">Save to project</button>
    {/if}
  </ProjectBar>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="layout">
    <section class="controls">{@render controls()}</section>
    <section class="main">{@render main()}</section>
  </div>
</div>

<style>
  .map-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .map-editor .layout {
    display: grid;
    grid-template-columns: 19rem 1fr;
    min-height: 0;
    flex: 1;
  }
  .map-editor .controls {
    overflow-y: auto;
    padding: 0.7rem 1rem 2rem;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .map-editor .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .map-editor :global(.toolbar),
  .map-editor :global(.toolopts),
  .map-editor :global(.footer) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.8rem;
    border-bottom: 1px solid var(--border);
  }
  .map-editor :global(.toolopts) {
    min-height: 2.6rem;
  }
  .map-editor :global(.footer) {
    border-bottom: 0;
    border-top: 1px solid var(--border);
    justify-content: space-between;
  }
  .map-editor :global(.stage) {
    flex: 1;
    min-height: 0;
  }
  .map-editor :global(.sep) {
    width: 1px;
    height: 1.4rem;
    background: var(--border);
    margin: 0 0.2rem;
  }
  .map-editor :global(h3) {
    font-size: 0.85rem;
    margin: 0.8rem 0 0.1rem;
  }
  .map-editor :global(label) {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
  .map-editor :global(label.inline) {
    flex-direction: row;
    align-items: center;
    gap: 0.35rem;
  }
  .map-editor :global(.v) {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .map-editor :global(.pair) {
    display: flex;
    gap: 0.6rem;
  }
  .map-editor :global(.pair > label),
  .map-editor :global(.pair > button) {
    flex: 1;
    min-width: 0;
  }
  .map-editor :global(.pair input),
  .map-editor :global(.pair select) {
    width: 100%;
  }
  .map-editor :global(select),
  .map-editor :global(input[type='number']),
  .map-editor :global(input[type='text']) {
    font: inherit;
    font-size: 0.85rem;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.25rem 0.4rem;
    min-width: 0;
  }
  .map-editor :global(.items) {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
  }
  .map-editor :global(.items li) {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .map-editor :global(.x) {
    padding: 0 0.45rem;
    line-height: 1.3;
  }
  .map-editor :global(.dim) {
    color: var(--text-dim);
    margin: 0;
  }
  .map-editor :global(.small) {
    font-size: 0.75rem;
  }
  .map-editor .error {
    margin: 0;
    padding: 0.5rem 0.9rem;
    background: #3a1d22;
    color: #ffb4bb;
    font-size: 0.85rem;
    white-space: pre-wrap;
  }
</style>
