/** A unified diff of two texts (line by line, longest common subsequence), for the patches `artgen upstream` writes. No dependencies. */

type Op = { t: ' ' | '-' | '+'; line: string };

/** The most cells of the LCS table (4 bytes each): 4 million is 16 MB. */
const MAX_CELLS = 4_000_000;

/** The edit script turning `a` into `b`. */
function script(a: string[], b: string[]): Op[] {
  // trim the common ends first: edits to a file are usually small, so the table below stays small
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const x = a.slice(head, a.length - tail), y = b.slice(head, b.length - tail);
  // a file rewritten end to end: the table below would be (n+1)(m+1) cells, so say "all of it changed" instead
  if ((x.length + 1) * (y.length + 1) > MAX_CELLS) return [...a.slice(0, head).map((line): Op => ({ t: ' ', line })), ...x.map((line): Op => ({ t: '-', line })), ...y.map((line): Op => ({ t: '+', line })), ...a.slice(a.length - tail).map((line): Op => ({ t: ' ', line }))];
  const w = y.length + 1, len = new Uint32Array((x.length + 1) * w);
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) len[i * w + j] = x[i] === y[j] ? len[(i + 1) * w + j + 1] + 1 : Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
  const ops: Op[] = a.slice(0, head).map(line => ({ t: ' ', line }));
  let i = 0, j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { ops.push({ t: ' ', line: x[i] }); i++; j++; }
    else if (j < y.length && (i === x.length || len[i * w + j + 1] >= len[(i + 1) * w + j])) ops.push({ t: '+', line: y[j++] });
    else ops.push({ t: '-', line: x[i++] });
  }
  for (const line of a.slice(a.length - tail)) ops.push({ t: ' ', line });
  return ops;
}

/** Text as lines; a missing newline at the end of the file is not a difference (the patch gets one). */
const lines = (s: string): string[] => {
  if (s === '') return [];
  const ls = s.split('\n');
  if (s.endsWith('\n')) ls.pop();
  return ls;
};

/**
 * `diff -u` of `before` and `after` with `context` lines around each change, as one `---`/`+++` block for `path`
 * (`a/<path>`, `b/<path>`: `git apply` and `patch -p1` take it). Empty when the texts are the same.
 */
export function unifiedDiff(path: string, before: string, after: string, context = 3): string {
  const A = lines(before), B = lines(after), ops = script(A, B);
  if (!ops.some(o => o.t !== ' ')) return '';
  const out = [`--- a/${path}`, `+++ b/${path}`];
  // hunks: runs of changes with `context` lines either side, merged when they touch
  const changed = ops.map((o, i) => (o.t === ' ' ? -1 : i)).filter(i => i >= 0);
  let k = 0, aLine = 1, bLine = 1, pos = 0;
  const at: [number, number][] = [];   // line numbers (a, b) at the start of each op
  for (const o of ops) { at.push([aLine, bLine]); if (o.t !== '+') aLine++; if (o.t !== '-') bLine++; }
  while (k < changed.length) {
    let from = Math.max(0, changed[k] - context), to = Math.min(ops.length, changed[k] + context + 1);
    while (k + 1 < changed.length && changed[k + 1] - context <= to) { k++; to = Math.min(ops.length, changed[k] + context + 1); }
    k++;
    const body = ops.slice(Math.max(from, pos), to);
    from = Math.max(from, pos);
    const aCount = body.filter(o => o.t !== '+').length, bCount = body.filter(o => o.t !== '-').length;
    const [as, bs] = at[from];
    out.push(`@@ -${aCount ? as : as - 1}${aCount === 1 ? '' : `,${aCount}`} +${bCount ? bs : bs - 1}${bCount === 1 ? '' : `,${bCount}`} @@`);
    for (const o of body) out.push(o.t + o.line);
    pos = to;
  }
  return out.join('\n') + '\n';
}
