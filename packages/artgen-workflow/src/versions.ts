/**
 * Versions of a subject (docs/WORKFLOW.md §5). A version is a byte copy of the working file, named `v1`, `v2`… and stored
 * beside it as `<stem>.v<N>.json`. `diffJson` says what changed between two of them.
 */
export const versionNumber = (name: string): number | null => { const m = /^v(\d+)$/.exec(name); return m && +m[1] > 0 ? +m[1] : null; };

/** Version names, oldest first; anything that isn't `v<N>` is left out. */
export const sortVersions = (names: string[]): string[] => names.filter(n => versionNumber(n) !== null).sort((a, b) => versionNumber(a)! - versionNumber(b)!);

/** `v1` for none, else one above the highest. */
export const nextVersion = (names: string[]): string => `v${Math.max(0, ...names.map(versionNumber).filter((n): n is number => n !== null)) + 1}`;

/** `map` + `v3` → `map.v3.json`. */
export const versionFile = (stem: string, version: string): string => `${stem}.${version}.json`;

/** `map.v3.json` → `v3` (null when the file isn't a version of this stem). */
export function versionOfFile(stem: string, file: string): string | null {
  const m = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(v\\d+)\\.json$`).exec(file);
  return m && versionNumber(m[1]) !== null ? m[1] : null;
}

export interface Change { path: string; op: 'added' | 'removed' | 'changed'; from?: unknown; to?: unknown }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** An array whose items all have a string `id`, each used once: compared by id. */
const byId = (a: unknown[], b: unknown[]): boolean => [a, b].every(xs => {
  const ids = xs.map(x => (isObj(x) && typeof x.id === 'string' ? x.id : null));
  return ids.every(id => id !== null) && new Set(ids).size === ids.length;
});

/**
 * What changed from `a` to `b`, one entry per leaf. Objects are compared key by key. An array whose items all have a string
 * `id` is compared by id (`rooms[id=hall].w`), any other array by index (`edits[2]`). Sorted by path, so the result is the
 * same every time.
 */
export function diffJson(a: unknown, b: unknown): Change[] {
  const out: Change[] = [];
  const walk = (x: unknown, y: unknown, path: string): void => {
    if (isObj(x) && isObj(y)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        const p = path ? `${path}.${k}` : k;
        if (!(k in y)) out.push({ path: p, op: 'removed', from: x[k] });
        else if (!(k in x)) out.push({ path: p, op: 'added', to: y[k] });
        else walk(x[k], y[k], p);
      }
    } else if (Array.isArray(x) && Array.isArray(y)) {
      if (byId(x, y)) {
        const ix = new Map(x.map(v => [(v as { id: string }).id, v])), iy = new Map(y.map(v => [(v as { id: string }).id, v]));
        for (const id of new Set([...ix.keys(), ...iy.keys()])) {
          const p = `${path}[id=${id}]`;
          if (!iy.has(id)) out.push({ path: p, op: 'removed', from: ix.get(id) });
          else if (!ix.has(id)) out.push({ path: p, op: 'added', to: iy.get(id) });
          else walk(ix.get(id), iy.get(id), p);
        }
      } else for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const p = `${path}[${i}]`;
        if (i >= y.length) out.push({ path: p, op: 'removed', from: x[i] });
        else if (i >= x.length) out.push({ path: p, op: 'added', to: y[i] });
        else walk(x[i], y[i], p);
      }
    } else if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ path, op: 'changed', from: x, to: y });
  };
  walk(a, b, '');
  return out.sort((p, q) => (p.path < q.path ? -1 : p.path > q.path ? 1 : 0));
}

/** One line per change, long values cut to `max` characters: `rooms[id=hall].w: 6 -> 8`. */
export function diffLines(changes: Change[], max = 60): string[] {
  const show = (v: unknown): string => { const s = JSON.stringify(v) ?? 'undefined'; return s.length > max ? `${s.slice(0, max - 3)}...` : s; };
  return changes.map(c => c.op === 'added' ? `+ ${c.path || '(file)'}: ${show(c.to)}` : c.op === 'removed' ? `- ${c.path || '(file)'}: ${show(c.from)}` : `~ ${c.path || '(file)'}: ${show(c.from)} -> ${show(c.to)}`);
}
