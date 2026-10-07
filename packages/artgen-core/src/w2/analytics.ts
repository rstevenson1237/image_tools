/**
 * Pipeline analytics v1 (SPEC §11.1, D19): per-pass gains and cost from the ledger's score records. Pure over the
 * entries; `artgen analytics` reads the files and prints or writes the report.
 *
 * Each score record carries the pass (`r1..r3`, `x1..` extra autonomous revision, `f`/`f2..` finish, `u1..` user
 * iteration), model + effort for the stage, code/edit token estimates (or measured input/output tokens), the review
 * sheet's image tokens, wall time since the asset's previous record, the score and the gate result.
 */
import type { LedgerEntry } from '../qa/ledger.ts';

/** Same price basis as artlab's reports (USD per million tokens), so costs are comparable. */
export const PRICE = { inPerM: 4, outPerM: 20 };
export const tokenCost = (out: number, inp: number): number => (out * PRICE.outPerM + inp * PRICE.inPerM) / 1e6;

export interface AssetMeta { id: string; kind: string; view?: string; size?: string; template?: string; importance?: string }

export interface PassRecord {
  asset: string;
  version: string;
  pass: string;
  stage: 'revision' | 'extra' | 'finish' | 'user';
  score: number;
  /** vs the previous scored base (bases) or the bound base (finishes). */
  delta?: number;
  gate?: boolean;
  outTokens: number;
  inTokens: number;
  imageTokens: number;
  wallMs?: number;
  model?: string;
  effort?: string;
}

export const stageOf = (pass: string): PassRecord['stage'] =>
  pass.startsWith('f') ? 'finish' : pass.startsWith('x') ? 'extra' : pass.startsWith('u') ? 'user' : 'revision';

/** Latest score record per asset version, in ledger order of first appearance, with deltas filled in. */
export function passRecords(ledger: LedgerEntry[]): PassRecord[] {
  const latest = new Map<string, LedgerEntry>();
  for (const e of ledger) if (e.type === 'score' && !e.blind && e.version && typeof e.score === 'number' && e.asset !== 'direction') latest.set(`${e.asset}\0${e.version}`, e);
  const out: PassRecord[] = [], lastBase = new Map<string, number>(), baseScore = new Map<string, number>();
  for (const e of latest.values()) {
    const tk = (e.tokens ?? {}) as { code?: number; edit?: number; in?: number; out?: number };
    const pass = e.pass ?? (e.version!.startsWith('finish') ? 'f' : 'r?'), stage = stageOf(pass), key = (v: string) => `${e.asset}\0${v}`;
    let delta: number | undefined;
    if (e.version!.startsWith('base')) {
      const prev = lastBase.get(e.asset);
      if (prev !== undefined) delta = round(e.score! - prev);
      lastBase.set(e.asset, e.score!); baseScore.set(key(e.version!), e.score!);
    } else if (typeof e.base === 'string' && baseScore.has(key(e.base))) delta = round(e.score! - baseScore.get(key(e.base))!);
    out.push({
      asset: e.asset, version: e.version!, pass, stage, score: e.score!, delta, gate: e.conformance?.pass,
      outTokens: tk.out ?? tk.edit ?? 0, inTokens: tk.in ?? 0, imageTokens: (e.imageTokens as number) ?? 0,
      wallMs: typeof e.wallMs === 'number' ? e.wallMs : undefined, model: e.model as string | undefined, effort: e.effort as string | undefined,
    });
  }
  return out;
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface AnalyticsReport {
  assets: number;
  passes: { pass: string; n: number; meanScore?: number; meanDelta?: number; regressed: number; gatePass: number; outTokens: number; imageTokens: number; meanWallS?: number }[];
  perAsset: { id: string; kind: string; r1?: number; best?: number; final?: number; fromRevisions?: number; fromFinish?: number; passes: number; outTokens: number; imageTokens: number; cost: number }[];
  byGroup: Record<'kind' | 'size' | 'view' | 'importance', { key: string; n: number; meanFinal?: number; meanCost?: number; meanPasses?: number }[]>;
  firstPassByTemplate: { template: string; n: number; meanR1?: number }[];
  regressions: { asset: string; version: string; pass: string; delta: number }[];
  userRevisionRate: { feedback: number; finals: number; rate?: number; byRoute: Record<string, number> };
  models: { model: string; effort: string; n: number; meanDelta?: number; deltaPerKTok?: number }[];
  /** Who scored, and how blind re-scores of finals compare with the finals' own scores (rev 9). */
  review: { byReviewer: Record<string, number>; blind: { n: number; meanGap?: number; over1: number; assets: { asset: string; version: string; own: number; blind: number; gap: number }[] } };
  suggestions: string[];
  totals: { outTokens: number; inTokens: number; imageTokens: number; cost: number; meanFromRevisions?: number; meanFromFinish?: number };
}

export function analytics(ledger: LedgerEntry[], metas: AssetMeta[]): AnalyticsReport {
  const recs = passRecords(ledger), ids = [...new Set(recs.map(r => r.asset))], meta = new Map(metas.map(m => [m.id, m]));
  const passKey = (p: string) => (/^f\d*$/.test(p) ? (p === 'f' ? 'f' : 'f2+') : /^[xu]\d+$/.test(p) ? p[0] : p);
  const ORDER = ['r1', 'r2', 'r3', 'r4', 'r5', 'x', 'f', 'u', 'f2+'];
  const passes = [...new Set(recs.map(r => passKey(r.pass)))].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99)).map(pass => {
    const rs = recs.filter(r => passKey(r.pass) === pass), walls = rs.map(r => r.wallMs).filter((w): w is number => w !== undefined);
    return {
      pass, n: rs.length, meanScore: mean(rs.map(r => r.score)), meanDelta: mean(rs.map(r => r.delta).filter((d): d is number => d !== undefined)),
      regressed: rs.filter(r => (r.delta ?? 0) < 0).length, gatePass: rs.filter(r => r.gate).length,
      outTokens: sum(rs.map(r => r.outTokens)), imageTokens: sum(rs.map(r => r.imageTokens)), meanWallS: walls.length ? round(mean(walls)! / 1000, 0) : undefined,
    };
  });
  const perAsset = ids.map(id => {
    const rs = recs.filter(r => r.asset === id), bases = rs.filter(r => r.version.startsWith('base')), fins = rs.filter(r => r.stage === 'finish');
    const r1 = rs.find(r => r.pass === 'r1')?.score, best = bases.length ? Math.max(...bases.filter(b => b.stage !== 'user').map(b => b.score)) : undefined;
    const fin = fins[fins.length - 1], finBase = fin && rs.find(r => r.version === (ledger.find(e => e.type === 'score' && e.asset === id && e.version === fin.version)?.base as string));
    const out = sum(rs.map(r => r.outTokens + r.inTokens)), img = sum(rs.map(r => r.imageTokens));
    return {
      id, kind: meta.get(id)?.kind ?? '?', r1, best: Number.isFinite(best) ? best : undefined, final: fin?.score ?? best,
      fromRevisions: r1 !== undefined && best !== undefined && Number.isFinite(best) ? round(best - r1) : undefined,
      fromFinish: fin && finBase ? round(fin.score - finBase.score) : undefined,
      passes: rs.length, outTokens: out, imageTokens: img, cost: round(tokenCost(sum(rs.map(r => r.outTokens)), img + sum(rs.map(r => r.inTokens))), 4),
    };
  });
  const group = (f: (m: AssetMeta | undefined) => string | undefined) => {
    const g = new Map<string, typeof perAsset>();
    for (const a of perAsset) { const k = f(meta.get(a.id)) ?? '-'; g.set(k, [...(g.get(k) ?? []), a]); }
    return [...g].map(([key, as]) => ({ key, n: as.length, meanFinal: mean(as.map(a => a.final).filter((x): x is number => x !== undefined)), meanCost: as.length ? round(mean(as.map(a => a.cost)) ?? 0, 4) : undefined, meanPasses: mean(as.map(a => a.passes)) }));
  };
  const tmpl = new Map<string, number[]>();
  for (const a of perAsset) if (a.r1 !== undefined) { const t = meta.get(a.id)?.template ?? '-'; tmpl.set(t, [...(tmpl.get(t) ?? []), a.r1]); }
  const fb = ledger.filter(e => e.type === 'feedback' && e.by === 'user' && e.asset !== 'direction');
  const finals = new Set(ledger.filter(e => e.type === 'status' && e.status === 'final').map(e => e.asset)).size || perAsset.filter(a => a.final !== undefined).length;
  const byRoute: Record<string, number> = {};
  for (const e of fb) byRoute[String(e.route ?? '?')] = (byRoute[String(e.route ?? '?')] ?? 0) + 1;
  const mg = new Map<string, PassRecord[]>();
  for (const r of recs) { const k = `${r.model ?? 'unrecorded'}\0${r.effort ?? '-'}`; mg.set(k, [...(mg.get(k) ?? []), r]); }
  const models = [...mg].map(([k, rs]) => {
    const [model, effort] = k.split('\0'), ds = rs.map(r => r.delta).filter((d): d is number => d !== undefined), tok = sum(rs.map(r => r.outTokens + r.inTokens + r.imageTokens));
    return { model, effort, n: rs.length, meanDelta: mean(ds), deltaPerKTok: tok ? round((sum(ds) / tok) * 1000, 3) : undefined };
  });
  const suggestions: string[] = [];
  for (const kind of [...new Set(perAsset.map(a => a.kind))]) {
    const ofKind = (p: string) => recs.filter(r => r.pass === p && meta.get(r.asset)?.kind === kind && r.delta !== undefined).map(r => r.delta!);
    const d3 = ofKind('r3'), d2 = ofKind('r2');
    if (d3.length >= 3 && mean(d3)! <= 0.1) suggestions.push(`${kind}: v3 adds ${mean(d3)} on average over ${d3.length} assets — try budget.perKind.${kind}.revisionPasses = 2`);
    else if (d3.length >= 3 && mean(d3)! >= 0.75) suggestions.push(`${kind}: v3 still adds ${mean(d3)} on average — a fourth revision may pay off (budget.perKind.${kind}.revisionPasses = 4)`);
    if (d2.length >= 3 && mean(d2)! <= 0) suggestions.push(`${kind}: v2 does not improve on v1 (${mean(d2)}) — look at the template or the review notes`);
  }
  const ff = perAsset.map(a => a.fromFinish).filter((x): x is number => x !== undefined);
  if (ff.length >= 3 && mean(ff)! <= 0) suggestions.push(`the finishing pass adds ${mean(ff)} on average — check it is fixing what the review sheets show`);
  const regRate = recs.filter(r => r.stage === 'revision' && (r.delta ?? 0) < 0).length / Math.max(1, recs.filter(r => r.stage === 'revision' && r.delta !== undefined).length);
  if (recs.length >= 10 && regRate > 0.3) suggestions.push(`${Math.round(regRate * 100)}% of revisions regressed — change one thing per revision (R12 keeps the best, but each regression costs a pass)`);
  const byReviewer: Record<string, number> = {}, own = new Map<string, number>();
  for (const e of ledger) if (e.type === 'score' && !e.blind && e.asset !== 'direction' && typeof e.score === 'number') {
    const k = typeof e.reviewer === 'string' ? e.reviewer : 'unrecorded';
    byReviewer[k] = (byReviewer[k] ?? 0) + 1;
    own.set(`${e.asset}\0${e.version}`, e.score);
  }
  const blindLatest = new Map<string, LedgerEntry>();
  for (const e of ledger) if (e.type === 'score' && e.blind && typeof e.score === 'number') blindLatest.set(`${e.asset}\0${e.version}`, e);
  const blindRows = [...blindLatest].filter(([k]) => own.has(k)).map(([k, e]) => ({ asset: e.asset, version: e.version!, own: own.get(k)!, blind: e.score!, gap: round(own.get(k)! - e.score!) }));
  const meanGap = mean(blindRows.map(b => b.gap));
  if (blindRows.length >= 3 && meanGap! >= 0.5) suggestions.push(`blind re-scores average ${meanGap} below the pipeline's own scores over ${blindRows.length} finals — run every review through the art-reviewer subagent, not the authoring agent`);
  const totOut = sum(recs.map(r => r.outTokens)), totIn = sum(recs.map(r => r.inTokens)), totImg = sum(recs.map(r => r.imageTokens));
  return {
    assets: ids.length, passes, perAsset,
    byGroup: { kind: group(m => m?.kind), size: group(m => m?.size), view: group(m => m?.view), importance: group(m => m?.importance) },
    firstPassByTemplate: [...tmpl].map(([template, xs]) => ({ template, n: xs.length, meanR1: mean(xs) })),
    regressions: recs.filter(r => r.delta !== undefined && r.delta < 0).map(r => ({ asset: r.asset, version: r.version, pass: r.pass, delta: r.delta! })),
    userRevisionRate: { feedback: fb.length, finals, rate: finals ? round(new Set(fb.map(e => e.asset)).size / finals) : undefined, byRoute },
    models, review: { byReviewer, blind: { n: blindRows.length, meanGap, over1: blindRows.filter(b => b.gap > 1).length, assets: blindRows } }, suggestions,
    totals: { outTokens: totOut, inTokens: totIn, imageTokens: totImg, cost: round(tokenCost(totOut, totIn + totImg), 4), meanFromRevisions: mean(perAsset.map(a => a.fromRevisions).filter((x): x is number => x !== undefined)), meanFromFinish: mean(ff) },
  };
}

const s = (v?: number, sign = false) => (v === undefined ? '-' : `${sign && v >= 0 ? '+' : ''}${v}`);

export function analyticsMarkdown(r: AnalyticsReport, title = 'artgen pipeline analytics'): string {
  let md = `# ${title}\n\n${r.assets} assets. Price basis: $${PRICE.inPerM}/M input (review images, measured input), $${PRICE.outPerM}/M output (code; estimated at 3.5 chars/token unless measured).\n\n`;
  md += `Totals: ${r.totals.outTokens} output tok, ${r.totals.imageTokens} review-image tok${r.totals.inTokens ? `, ${r.totals.inTokens} measured input tok` : ''}, est. $${r.totals.cost.toFixed(3)}. ` +
    `Average gain from revisions ${s(r.totals.meanFromRevisions, true)}, from the finishing pass ${s(r.totals.meanFromFinish, true)}.\n\n`;
  md += '## Per pass\n\n| Pass | n | Mean score | Mean Δ | Regressed | Gate pass | Output tok | Review tok | Mean wall s |\n|---|---|---|---|---|---|---|---|---|\n';
  for (const p of r.passes) md += `| ${p.pass} | ${p.n} | ${s(p.meanScore)} | ${s(p.meanDelta, true)} | ${p.regressed} | ${p.gatePass}/${p.n} | ${p.outTokens} | ${p.imageTokens} | ${s(p.meanWallS)} |\n`;
  md += '\n## Per asset\n\n| Asset | Kind | r1 | Best revision | Final | From revisions | From finish | Passes | Output tok | Review tok | Est. cost |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  for (const a of r.perAsset) md += `| ${a.id} | ${a.kind} | ${s(a.r1)} | ${s(a.best)} | ${s(a.final)} | ${s(a.fromRevisions, true)} | ${s(a.fromFinish, true)} | ${a.passes} | ${a.outTokens} | ${a.imageTokens} | $${a.cost.toFixed(4)} |\n`;
  for (const [k, rows] of Object.entries(r.byGroup)) {
    if (rows.length < 2 && rows[0]?.key === '-') continue;
    md += `\n## Cost by ${k}\n\n| ${k} | n | Mean final | Mean cost | Mean passes |\n|---|---|---|---|---|\n`;
    for (const g of rows) md += `| ${g.key} | ${g.n} | ${s(g.meanFinal)} | ${g.meanCost === undefined ? '-' : `$${g.meanCost.toFixed(4)}`} | ${s(g.meanPasses)} |\n`;
  }
  md += '\n## First-pass quality by template\n\n| Template | n | Mean r1 |\n|---|---|---|\n';
  for (const t of r.firstPassByTemplate) md += `| ${t.template} | ${t.n} | ${s(t.meanR1)} |\n`;
  md += `\n## Regressions\n\n${r.regressions.length ? r.regressions.map(x => `- ${x.asset} ${x.version} (${x.pass}) ${x.delta}`).join('\n') : 'none'}\n`;
  const u = r.userRevisionRate;
  md += `\n## User revisions\n\n${u.feedback} feedback rounds over ${u.finals} finished assets (rate ${s(u.rate)})${Object.keys(u.byRoute).length ? `; by route: ${Object.entries(u.byRoute).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}.\n`;
  md += '\n## Model / effort per stage\n\n| Model | Effort | Passes | Mean Δ | Δ per 1k tok |\n|---|---|---|---|---|\n';
  for (const m of r.models) md += `| ${m.model} | ${m.effort} | ${m.n} | ${s(m.meanDelta, true)} | ${s(m.deltaPerKTok)} |\n`;
  const rv = r.review;
  md += `\n## Review independence\n\nScores by reviewer: ${Object.entries(rv.byReviewer).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}. ` +
    `Blind re-scores: ${rv.blind.n}${rv.blind.n ? `, mean gap ${s(rv.blind.meanGap, true)} (own − blind), ${rv.blind.over1} more than 1 point apart` : ''}.\n`;
  if (rv.blind.n) { md += '\n| Asset | Final | Own | Blind | Gap |\n|---|---|---|---|---|\n'; for (const b of rv.blind.assets) md += `| ${b.asset} | ${b.version} | ${b.own} | ${b.blind} | ${s(b.gap, true)} |\n`; }
  md += `\n## Budget suggestions\n\n${r.suggestions.length ? r.suggestions.map(x => `- ${x}`).join('\n') : '- none: no kind crosses a threshold (v3 adding ≤ 0.1 or ≥ 0.75 over ≥ 3 assets, v2 not improving, finish ≤ 0, > 30% regressions)'}\n`;
  return md;
}
