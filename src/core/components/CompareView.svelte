<script lang="ts">
  /** v(n−1) beside v(n) (R7) at one zoom, with an optional mask of the pixels that changed. */
  import PixelPreview from './PixelPreview.svelte';
  import { diffMask, type Img } from './pixels';

  interface Props {
    before: { img: Img; label: string };
    after: { img: Img; label: string };
    scale?: number;
    background?: string;
    context?: Img;
    tiled?: boolean;
  }
  let { before, after, scale = 4, background = 'checker', context, tiled = false }: Props = $props();
  let showDiff = $state(false);

  const diff = $derived(diffMask(before.img, after.img));
</script>

<div class="compare">
  <PixelPreview img={before.img} {scale} {background} {context} {tiled} label={before.label} />
  <PixelPreview img={after.img} {scale} {background} {context} {tiled} label={after.label} overlay={showDiff && diff.changed > 0 ? diff.mask : undefined} />
  <label class="diff">
    <input type="checkbox" bind:checked={showDiff} disabled={diff.changed <= 0} />
    {#if diff.changed < 0}sizes differ{:else if diff.changed === 0}no pixel changed{:else}show {diff.changed} changed px{/if}
  </label>
</div>

<style>
  .compare {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .diff {
    flex-basis: 100%;
    font-size: 0.8rem;
    color: var(--text-dim);
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }
</style>
