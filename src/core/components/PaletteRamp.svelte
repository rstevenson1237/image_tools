<script lang="ts">
  /**
   * One named palette ramp (lightest first): edit each swatch, add or drop one, or regenerate the ramp around a base
   * colour with a hue shift (highlights toward warm, shadows toward cool — `generateRamp` in @artgen/core).
   */
  import { generateRamp } from 'artgen-core';

  interface Props {
    name: string;
    colors: string[];
    hueShift?: number;
    onchange: (colors: string[]) => void;
    onremove?: () => void;
  }
  let { name, colors, hueShift = 12, onchange, onremove }: Props = $props();

  let open = $state(false);
  let base = $state('');
  let steps = $state(0);
  let shift = $state(0);
  let contrast = $state(0.45);

  function toggle() {
    open = !open;
    if (open) { base = colors[Math.floor(colors.length / 2)] ?? '#808080'; steps = colors.length || 3; shift = hueShift; }
  }

  const set = (i: number, c: string) => onchange(colors.map((x, k) => (k === i ? c : x)));
  const preview = $derived(open ? generateRamp(base, { steps, hueShift: shift, contrast }) : []);
</script>

<div class="ramp" data-ramp={name}>
  <span class="name" title={name}>{name}</span>
  <div class="swatches">
    {#each colors as c, i (i)}
      <label class="sw" style:background={c} title="{name}.{i} {c}">
        <input type="color" value={c} aria-label="{name} {i}" oninput={(e) => set(i, (e.currentTarget as HTMLInputElement).value)} />
      </label>
    {/each}
    <button type="button" class="mini" title="add a darker swatch" onclick={() => onchange([...colors, colors[colors.length - 1] ?? '#808080'])}>+</button>
    <button type="button" class="mini" title="drop the darkest swatch" disabled={colors.length <= 1} onclick={() => onchange(colors.slice(0, -1))}>−</button>
    <button type="button" class="mini" class:on={open} title="regenerate with a hue-shifted ramp" onclick={toggle}>↻</button>
    {#if onremove}<button type="button" class="mini" title="remove ramp" onclick={onremove}>×</button>{/if}
  </div>
  {#if open}
    <div class="gen">
      <label>base <input type="color" bind:value={base} /></label>
      <label>steps <input type="number" min="1" max="8" bind:value={steps} /></label>
      <label>hue shift <input type="number" min="0" max="60" bind:value={shift} /></label>
      <label>contrast <input type="range" min="0.1" max="0.9" step="0.05" bind:value={contrast} /></label>
      <span class="preview">{#each preview as c (c)}<i style:background={c} title={c}></i>{/each}</span>
      <button type="button" onclick={() => { onchange(preview); open = false; }}>Use</button>
    </div>
  {/if}
</div>

<style>
  .ramp {
    display: grid;
    grid-template-columns: 5.5rem 1fr;
    gap: 0.4rem;
    align-items: center;
  }
  .name {
    font-size: 0.8rem;
    font-family: ui-monospace, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .swatches {
    display: flex;
    gap: 3px;
    align-items: center;
    flex-wrap: wrap;
  }
  .sw {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 3px;
    border: 1px solid #0006;
    position: relative;
    cursor: pointer;
  }
  .sw input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  .mini {
    padding: 0 0.4rem;
    height: 1.6rem;
    font-size: 0.8rem;
  }
  .mini.on {
    border-color: var(--accent);
  }
  .gen {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.78rem;
    color: var(--text-dim);
    padding: 0.4rem;
    border: 1px dashed var(--border);
    border-radius: 6px;
  }
  .gen input[type='number'] {
    width: 3.2rem;
  }
  .gen input[type='color'] {
    width: 2rem;
    height: 1.4rem;
  }
  .gen input[type='range'] {
    width: 5rem;
  }
  .preview {
    display: flex;
    gap: 2px;
  }
  .preview i {
    width: 1rem;
    height: 1rem;
    border-radius: 2px;
  }
</style>
