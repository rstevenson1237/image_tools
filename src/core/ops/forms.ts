/**
 * Forms from the operation registry (R8). `forms.json` is generated from the declarations in `packages/artgen-cli/src/ops`
 * (`npm run gen:ops`; a parity test fails when it is stale), so the web app has the same operations, parameters and help text as
 * the CLI, MCP and Python without importing any Node code. This module reads it and turns a filled-in form into the
 * `artgen …` line the CLI would take; `OperationForm.svelte` draws the form.
 */
import type { FormOp, FormParam } from 'artgen-cli';

export type { FormOp, FormParam };

/** What a form holds: strings for text, numbers and enums; a boolean for a switch; `on` / `off` / '' for `on|off` switches. */
export type FormValues = Record<string, string | boolean>;

let cache: Promise<FormOp[]> | null = null;
/** Every operation with a command line (loaded once, in its own chunk). */
export const loadForms = (): Promise<FormOp[]> => (cache ??= import('./forms.json').then(m => m.default as FormOp[]));

export const formOf = (forms: readonly FormOp[], name: string): FormOp | undefined => forms.find(f => f.name === name);

/** The command words (`stage.approve` → `stage approve`). */
export const wordsOf = (op: Pick<FormOp, 'name'>): string[] => op.name.split('.');

/** Shell-quote a value only when it needs it. */
export const quote = (v: string): string => (/^[\w@%+=:,./-]+$/.test(v) ? v : `"${v.replace(/(["\\$`])/g, '\\$1')}"`);

/** Empty starting values: switches off, everything else blank. */
export function blankValues(op: FormOp): FormValues {
  return Object.fromEntries(op.params.map((p): [string, string | boolean] => [p.key, p.kind === 'boolean' && (p.style ?? 'switch') === 'switch' ? false : '']));
}

/** The problems with a filled-in form: a missing required value (with the CLI's own message when it gave one). */
export function missing(op: FormOp, values: FormValues): string[] {
  return op.params.filter(p => p.required && p.kind !== 'boolean' && !String(values[p.key] ?? '').trim()).map(p => (typeof p.required === 'string' ? p.required : `${p.key} is required`));
}

/** The `artgen …` line a filled-in form stands for. Blank optional values are left out. */
export function commandLine(op: FormOp, values: FormValues): string {
  const out = ['artgen', ...wordsOf(op)];
  for (const p of op.params.filter(x => x.positional)) {
    const v = String(values[p.key] ?? '').trim();
    if (!v) { if (p.required) out.push(`<${p.key}>`); continue; }
    out.push(...(p.positional === 'rest' ? v.split(/\s+/) : [v]).map(quote));
  }
  for (const p of op.params.filter(x => !x.positional)) {
    const raw = values[p.key];
    if (p.kind === 'boolean') {
      const style = p.style ?? 'switch';
      if (style === 'switch') { if (raw === true) out.push(p.flag!); } else if (raw === 'on' || raw === 'off') out.push(p.flag!, raw); else if (style === 'either' && raw === true) out.push(p.flag!);
      continue;
    }
    const v = String(raw ?? '').trim();
    if (!v) continue;
    if (p.repeat) for (const x of v.split(/\s*\n\s*/).filter(Boolean)) out.push(p.flag!, quote(x));
    else if (p.multi) out.push(p.flag!, ...v.split(/\s+/).map(quote));
    else out.push(p.flag!, quote(v));
  }
  return out.join(' ');
}

/** Operations of a module, optionally narrowed by a search over the name and summary. */
export function searchForms(forms: readonly FormOp[], o: { module?: string; query?: string } = {}): FormOp[] {
  const q = (o.query ?? '').trim().toLowerCase();
  return forms.filter(f => (!o.module || f.module === o.module) && (!q || f.name.replace(/\./g, ' ').toLowerCase().includes(q) || f.summary.toLowerCase().includes(q)));
}
