/**
 * A subject's brief (docs/WORKFLOW.md §7.3): `<dir>/<id>/<stem>.brief.md`, what the map is for in the user's words. It may start
 * with front matter of plain `key: value` lines between `---` lines. The keys read are `title` and `refs` (comma-separated paths
 * under art/). Parsed by hand, without a YAML package: the maps-only bundle must stay small.
 */
export interface SubjectBrief {
  title?: string;
  refs: string[];
  /** The text after the front matter. */
  body: string;
}

export function parseSubjectBrief(text: string): SubjectBrief {
  const t = text.replace(/\r\n/g, '\n'), m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(t);
  const out: SubjectBrief = { refs: [], body: (m ? t.slice(m[0].length) : t).trim() };
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const v = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    if (kv[1] === 'title' && v) out.title = v;
    if (kv[1] === 'refs') out.refs = v.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
  }
  return out;
}

/** A brief as text: front matter for the title and refs when there are any, then the body. */
export function formatSubjectBrief(b: { title?: string; refs?: string[]; body: string }): string {
  const head = [...(b.title ? [`title: ${b.title}`] : []), ...(b.refs?.length ? [`refs: ${b.refs.join(', ')}`] : [])];
  return `${head.length ? `---\n${head.join('\n')}\n---\n` : ''}${b.body.trim()}\n`;
}

/** The brief's body cut to `n` lines of about `width` characters, for a data sheet's notes. */
export function briefNotes(body: string, n = 6, width = 60): string {
  const lines: string[] = [];
  for (const para of body.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) { if (line && line.length + 1 + w.length > width) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w; }
    lines.push(line);
  }
  const kept = lines.filter((l, i) => l || (i > 0 && lines[i - 1]));
  return kept.length > n ? `${kept.slice(0, n).join('\n').trimEnd()} ...` : kept.join('\n').trim();
}

/** A reference path is under `art/` and stays there: no `..`, no absolute path. */
export const refOk = (r: string): boolean => !!r && !r.startsWith('/') && !/^[A-Za-z]:/.test(r) && !r.split(/[\\/]/).includes('..');
