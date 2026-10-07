/**
 * `artgen report <dir>`: per-pass scores, gates and cost for every asset directory under `dir`, in the style of
 * artlab's REPORT-iso.md, plus a final comparison sheet (reference beside the pipeline's final).
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { contactSheet, iso, latestScores, type Grid } from 'artgen-core';
import { ledgerFor, openAsset, passState, renderVersion, type AssetDir } from './asset.ts';
import { readGrid, writeGrid } from './node.ts';

/** Same price basis as artlab's reports, so costs are comparable: USD per million tokens. */
export const PRICE = { inPerM: 4, outPerM: 20 };
const cost = (out: number, inp: number) => (out * PRICE.outPerM + inp * PRICE.inPerM) / 1e6;

export interface AssetSummary {
  id: string;
  target?: number;
  r1?: number;
  bestRevision?: { version: string; score: number };
  finish?: number;
  final?: string;
  revisionGain?: number;
  finishGain?: number;
  outTokens: number;
  reviewTokens: number;
  cost: number;
  met: boolean;
}

export function assetDirs(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(root, d.name, 'brief.json'))).map(d => join(root, d.name));
}

export async function report(root: string, opts: { title?: string; out?: string } = {}): Promise<{ markdown: string; summaries: AssetSummary[] }> {
  const assets = assetDirs(root).map(p => openAsset(p));
  let md = `# ${opts.title ?? 'artgen pipeline report'}\n\nPrice basis (same as artlab): $${PRICE.inPerM}/M input (review images), $${PRICE.outPerM}/M output (code). ` +
    `Code tokens are estimates (3.5 chars/token); "edit" counts lines new vs the previous version. Review tokens are (w·h)/750 per review sheet.\n\n`;
  md += '| Asset | Pass | Version | Score | Δ | Gate | Hygiene | Colours | Code tok | Edit tok | Review tok | Note |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n';
  const summaries: AssetSummary[] = [];
  for (const a of assets) {
    const ledger = ledgerFor(a), scores = latestScores(ledger), st = await passState(a);
    const entries = st.rows.map(row => ({ row, e: [...ledger].reverse().find(e => e.type === 'score' && !e.blind && e.version === row.version) }));
    let prev: number | undefined, out = 0, inp = 0;
    for (const { row, e } of entries) {
      const tk = (e?.tokens ?? {}) as { code?: number; edit?: number };
      const rv = ledger.filter(x => x.type === 'review' && x.version === row.version).reduce((n, x) => n + ((x.imageTokens as number) ?? 0), 0);
      out += tk.edit ?? 0; inp += rv;
      const d = row.score !== undefined && prev !== undefined && !row.version.startsWith('finish') ? row.score - prev : row.version.startsWith('finish') && st.best ? (row.score ?? 0) - st.best.score : undefined;
      md += `| ${a.brief.id} | ${row.pass} | ${row.version}${row.base ? ` (on ${row.base})` : ''} | ${row.score ?? '-'} | ${d === undefined ? '' : (d >= 0 ? '+' : '') + d} | ${row.gate === undefined ? '-' : row.gate ? 'pass' : 'FAIL'} | ${e?.metrics?.hygiene ?? '-'} | ${e?.metrics?.colors ?? '-'} | ${tk.code ?? '-'} | ${tk.edit ?? '-'} | ${rv || '-'} | ${String(e?.note ?? '').replace(/\|/g, '/')} |\n`;
      if (!row.version.startsWith('finish') && row.score !== undefined) prev = row.score;
    }
    const r1 = scores.get('base.v1')?.score, fin = st.rows.filter(r => r.version.startsWith('finish')).pop();
    const finalScore = fin?.score ?? st.best?.score;
    summaries.push({
      id: a.brief.id, target: a.brief.target, r1, bestRevision: st.best, finish: fin?.score, final: fin?.version ?? st.best?.version,
      revisionGain: r1 !== undefined && st.best ? st.best.score - r1 : undefined, finishGain: fin?.score !== undefined && st.best ? fin.score - st.best.score : undefined,
      outTokens: out, reviewTokens: inp, cost: cost(out, inp), met: finalScore !== undefined && (a.brief.target === undefined || finalScore >= a.brief.target),
    });
  }
  md += '\n## Per asset\n\n| Asset | Target | r1 | Best revision | Finish | From revisions | From finish | Output tok | Review tok | Est. cost | Target met |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  const sign = (v?: number) => (v === undefined ? '-' : (v >= 0 ? '+' : '') + v);
  for (const s of summaries) md += `| ${s.id} | ${s.target ?? '-'} | ${s.r1 ?? '-'} | ${s.bestRevision ? `${s.bestRevision.score} (${s.bestRevision.version})` : '-'} | ${s.finish ?? '-'} | ${sign(s.revisionGain)} | ${sign(s.finishGain)} | ${s.outTokens} | ${s.reviewTokens} | $${s.cost.toFixed(3)} | ${s.met ? 'yes' : '**no**'} |\n`;
  const tot = summaries.reduce((t, s) => ({ out: t.out + s.outTokens, inp: t.inp + s.reviewTokens }), { out: 0, inp: 0 });
  const avg = (f: (s: AssetSummary) => number | undefined) => { const v = summaries.map(f).filter((x): x is number => x !== undefined); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '-'; };
  md += `\nTotals: ${tot.out} output tok, ${tot.inp} review tok, est. $${cost(tot.out, tot.inp).toFixed(3)}. Average gain from revisions ${avg(s => s.revisionGain)}, from the finishing pass ${avg(s => s.finishGain)}. ` +
    `${summaries.filter(s => s.met).length}/${summaries.length} assets at or above target.\n`;
  if (opts.out) {
    writeFileSync(opts.out, md);
    await finalComparison(assets, summaries, resolve(opts.out, '..', 'final-comparison.png'));
  }
  return { markdown: md, summaries };
}

/** Reference (left) beside the pipeline final (right) for every asset. */
export async function finalComparison(assets: AssetDir[], summaries: AssetSummary[], path: string): Promise<void> {
  const items: { label: string; grid: Grid; bg?: string; context?: Grid }[] = [];
  for (const a of assets) {
    const s = summaries.find(x => x.id === a.brief.id);
    if (!s?.final) continue;
    const fin = (await renderVersion(a, s.final)).strip, R = a.brief.review ?? {};
    const ctx = (g: Grid) => (R.iso ? iso.isoFloor(g.w, g.h) : undefined);
    if (a.brief.reference) { const ref = readGrid(resolve(a.path, a.brief.reference)); items.push({ label: `${a.brief.id} ref ${s.target ?? ''}`, grid: ref, bg: R.bg, context: ctx(ref) }); }
    items.push({ label: `${a.brief.id} ${s.final} ${s.finish ?? s.bestRevision?.score ?? ''}`, grid: fin, bg: R.bg, context: ctx(fin) });
  }
  writeGrid(path, contactSheet('reference (left) vs T2+ pipeline final (right)', items, 4, 4));
}
