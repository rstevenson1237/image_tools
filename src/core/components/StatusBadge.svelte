<script lang="ts">
  /** Asset status pill (SPEC §5.2). */
  interface Props {
    status: string;
    title?: string;
  }
  let { status, title }: Props = $props();
</script>

<span class="badge {status}" {title}>{status}</span>

<style>
  .badge {
    display: inline-block;
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid currentColor;
    white-space: nowrap;
    color: var(--text-dim);
  }
  .brief { color: #8b93a3; }
  .in-pipeline { color: #b9a5ff; }
  .final { color: #ffd166; }
  .approved { color: #7bd88f; }
  .exported { color: #6ea8fe; }
  .revision { color: #ff9f5a; }
  .stale { color: #ff7b8a; }
</style>
