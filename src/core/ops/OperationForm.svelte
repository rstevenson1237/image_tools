<script lang="ts">
  /**
   * A form for one registry operation (R8): a field per parameter, the CLI's own help text, and the `artgen …` line the filled-in form
   * stands for. `fixed` values are held by the page (the asset a stage view is on) and not shown; `hide` leaves out parameters that make
   * no sense here (`via`, `ledger`). `submit` (when given) adds a button that hands the values to the page.
   */
  import { blankValues, commandLine, missing, type FormOp, type FormValues } from './forms';

  interface Props {
    op: FormOp;
    fixed?: FormValues;
    hide?: string[];
    /** The label of the submit button; none = the form only builds the command line. */
    submit?: string;
    busy?: boolean;
    onsubmit?: (values: FormValues) => void;
    values?: FormValues;
  }
  let { op, fixed = {}, hide = [], submit, busy = false, onsubmit, values = $bindable() }: Props = $props();

  // the form is for one operation: a new operation starts blank
  let own = $state<FormValues>({});
  $effect(() => { own = { ...blankValues(op) }; });
  const all = $derived({ ...own, ...fixed });
  $effect(() => { values = all; });

  const shown = $derived(op.params.filter(p => !(p.key in fixed) && !hide.includes(p.key)));
  const problems = $derived(missing(op, all));
  const line = $derived(commandLine(op, all));
  let copied = $state(false);

  async function copy() {
    try { await navigator.clipboard.writeText(line); copied = true; setTimeout(() => (copied = false), 1500); } catch { /* no clipboard: the line is selectable */ }
  }
</script>

<form class="op" onsubmit={(e) => { e.preventDefault(); if (!problems.length && onsubmit) onsubmit(all); }} aria-label={op.name}>
  {#each shown as p (p.key)}
    <label class:wide={p.kind === 'string' || p.kind === 'json' || p.kind === 'list'}>
      <span class="name">{p.positional ? p.key : p.flag}{#if p.required}<i title="required"> *</i>{/if}</span>
      {#if p.kind === 'boolean' && (p.style ?? 'switch') === 'switch'}
        <input type="checkbox" checked={own[p.key] === true} onchange={(e) => (own[p.key] = e.currentTarget.checked)} />
      {:else if p.kind === 'boolean'}
        <select value={String(own[p.key] ?? '')} onchange={(e) => (own[p.key] = e.currentTarget.value)}>
          <option value="">(default)</option><option value="on">on</option><option value="off">off</option>
        </select>
      {:else if p.kind === 'enum'}
        <select value={String(own[p.key] ?? '')} onchange={(e) => (own[p.key] = e.currentTarget.value)}>
          <option value="">{p.required ? 'choose…' : '(default)'}</option>
          {#each p.values ?? [] as v (v)}<option value={v}>{v}</option>{/each}
        </select>
      {:else if p.kind === 'json' || p.repeat}
        <textarea rows="3" value={String(own[p.key] ?? '')} oninput={(e) => (own[p.key] = e.currentTarget.value)} placeholder={p.repeat ? 'one per line' : '{ … } or @file'}></textarea>
      {:else}
        <input type={p.kind === 'number' || p.kind === 'integer' ? 'number' : 'text'} step={p.kind === 'integer' ? 1 : 'any'} value={String(own[p.key] ?? '')}
          oninput={(e) => (own[p.key] = e.currentTarget.value)} placeholder={p.kind === 'size' ? 'WxH' : p.kind === 'list' ? 'a,b,…' : ''} />
      {/if}
      {#if p.doc}<small>{p.doc}</small>{/if}
    </label>
  {/each}
  <div class="line">
    <code aria-label="command line">{line}</code>
    <button type="button" onclick={copy} title="copy the command line">{copied ? 'Copied' : 'Copy'}</button>
  </div>
  {#if problems.length && submit}<p class="dim" aria-live="polite" data-testid="form-problems">{problems.join('; ')}</p>{/if}
  {#if submit}<button type="submit" class="primary" disabled={busy || problems.length > 0}>{submit}</button>{/if}
</form>

<style>
  .op { display: grid; gap: 0.5rem; }
  label { display: grid; gap: 0.2rem; font-size: 0.85rem; }
  label.wide { grid-column: 1 / -1; }
  .name { font-weight: 600; font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .name i { color: #ffb4bb; font-style: normal; }
  small { color: var(--text-dim); line-height: 1.3; }
  input[type='text'], input[type='number'], select, textarea { font: inherit; color: var(--text); background: var(--panel-raised); border: 1px solid var(--border); border-radius: 6px; padding: 0.3rem 0.5rem; width: 100%; }
  .line { display: flex; gap: 0.5rem; align-items: center; }
  .line code { flex: 1; min-width: 0; padding: 0.35rem 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; font-size: 0.78rem; overflow-x: auto; white-space: nowrap; user-select: all; }
  .dim { color: var(--text-dim); font-size: 0.8rem; margin: 0; }
</style>
