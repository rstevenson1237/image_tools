/**
 * Pipeline analytics v2 (PLAN P7, SPEC §11.1): budget and model/effort recommendations from ledger data pooled across
 * projects (the fixture games, or every game repo a team runs artgen in). v1 (`analytics`) describes one project; this
 * turns the pooled pass records into numbers to put in `artgen.config.json`, each with its evidence and a confidence.
 *
 * - **Revision passes per kind**: the marginal gain of each base pass on the best-so-far score. The recommendation is
 *   the last pass whose mean gain is still ≥ `minGain`; a kind whose last observed pass still adds ≥ 2 × `minGain`
 *   gets one more. Needs ≥ `minAssets` assets of the kind that reached the pass.
 * - **Image-token cap per kind**: 1.5 × the 90th percentile of review-image tokens per asset, rounded up to 500, so
 *   runaway assets stop without touching typical ones.
 * - **Model / effort per stage** (base = r1, revise = r2+ and extra revisions, finish = f*, review = the reviewer's
 *   model): with two or more mappings that each have ≥ `minAssets` passes, the one with the best gain per 1k tokens
 *   whose mean gain is within 0.25 of the best; with one mapping, an experiment on the stage that gains least.
 * - Notes on finishing passes, user revisions and blind-review gaps by kind.
 *
 * Pure over the entries; the CLI (`artgen analytics --across a,b,c [--apply]`) reads the ledgers and writes the patch.
 */
import type { LedgerEntry } from '../qa/ledger.ts';
import { passRecords, type AssetMeta, type PassRecord } from './analytics.ts';
import type { ProjectConfig } from './config.ts';

export interface LedgerSet { project: string; ledger: LedgerEntry[]; metas: AssetMeta[]; config?: ProjectConfig }

export type Confidence = 'low' | 'medium' | 'high';
export type Stage = 'base' | 'revise' | 'finish' | 'review';

export interface KindBudget {
  kind: string;
  assets: number;
  /** Mean marginal gain on the best-so-far score by base pass (r2 = what v2 added over v1, …). */
  gains: { pass: string; n: number; mean: number }[];
  current?: number;
  revisionPasses: number;
  confidence: Confidence;
  why: string;
  /** Review-image tokens per asset: p90 and the suggested cap. */
  imageTokens: { n: number; p50: number; p90: number; cap?: number };
  /** Mean gain of the first finishing pass over its base, and the share of assets that needed a second finish. */
  finish: { n: number; meanGain?: number; extraFinishRate?: number };
  /** Share of finished assets the user sent back at least once. */
  userRevisionRate?: number;
  /** Mean own − blind score gap on finals. */
  blindGap?: { n: number; mean: number };
}

export interface StageModels {
  stage: Stage;
  /** meanDelta: mean gain per pass (for `base`, the mean first-pass score); deltaPerKTok: the same per 1k tokens spent. */
  mappings: { model: string; effort: string; n: number; meanDelta?: number; deltaPerKTok?: number }[];
  recommend?: { model: string; effort: string };
  why: string;
}

export interface Recommendations {
  projects: { project: string; assets: number; scores: number }[];
  kinds: KindBudget[];
  models: StageModels[];
  notes: string[];
  /** The `artgen.config.json` changes: `budget.perKind` caps, and stage models where the data picks one. */
  patch: { budget: { perKind: Record<string, { revisionPasses?: number; maxImageTokensPerAsset?: number }> }; models: Partial<Record<Stage, { model: string; effort?: string }>> };
}

export interface RecommendOptions { minAssets?: number; minGain?: number; maxPasses?: number }

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const mean = (xs: number[]) => round(xs.reduce((a, b) => a + b, 0) / xs.length);
const pct = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]; };
const stageOfRec = (r: PassRecord): Stage => (r.stage === 'finish' ? 'finish' : r.pass === 'r1' ? 'base' : 'revise');
const baseIndex = (pass: string) => { const m = pass.match(/^r(\d+)$/); return m ? +m[1] : undefined; };

/** Recommendations from the pooled ledgers of several projects (asset ids are scoped per project). */
export function recommend(sets: LedgerSet[], o: RecommendOptions = {}): Recommendations {
  const minAssets = o.minAssets ?? 3, minGain = o.minGain ?? 0.25, maxPasses = o.maxPasses ?? 5;
  type Rec = PassRecord & { key: string; kind: string; reviewModel?: string };
  const recs: Rec[] = [], finals = new Map<string, string>(), feedback = new Set<string>(), blind: { key: string; kind: string; gap: number }[] = [];
  const currentPasses = new Map<string, number[]>();
  for (const set of sets) {
    const kindOf = new Map(set.metas.map(m => [m.id, m.kind])), key = (id: string) => `${set.project}\0${id}`;
    const reviewModel = new Map<string, string>();
    for (const e of set.ledger) if (e.type === 'score' && !e.blind && typeof e.reviewModel === 'string') reviewModel.set(`${e.asset}\0${e.version}`, e.reviewModel);
    for (const r of passRecords(set.ledger)) {
      const kind = kindOf.get(r.asset);
      if (kind) recs.push({ ...r, key: key(r.asset), kind, reviewModel: reviewModel.get(`${r.asset}\0${r.version}`) });
    }
    for (const e of set.ledger) {
      if (e.type === 'status' && e.status === 'final' && kindOf.has(e.asset)) finals.set(key(e.asset), kindOf.get(e.asset)!);
      if (e.type === 'feedback' && e.by === 'user' && kindOf.has(e.asset)) feedback.add(key(e.asset));
    }
    // blind gaps: latest blind score vs the latest own score of the same version
    const own = new Map<string, number>(), bl = new Map<string, number>();
    for (const e of set.ledger) if (e.type === 'score' && typeof e.score === 'number' && e.version && kindOf.has(e.asset)) (e.blind ? bl : own).set(`${e.asset}\0${e.version}`, e.score);
    for (const [k, b] of bl) if (own.has(k)) { const id = k.split('\0')[0]; blind.push({ key: key(id), kind: kindOf.get(id)!, gap: own.get(k)! - b }); }
    if (set.config) for (const m of set.metas) {
      const c = set.config.budget, v = c.perKind?.[m.kind]?.revisionPasses ?? (m.importance && c.tiers?.[m.importance]?.revisionPasses) ?? c.revisionPasses;
      if (typeof v === 'number') currentPasses.set(m.kind, [...(currentPasses.get(m.kind) ?? []), v]);
    }
  }

  const kinds: KindBudget[] = [], patch: Recommendations['patch'] = { budget: { perKind: {} }, models: {} };
  for (const kind of [...new Set(recs.map(r => r.kind))].sort()) {
    const ofKind = recs.filter(r => r.kind === kind), assets = [...new Set(ofKind.map(r => r.key))];
    // marginal gain of base pass k on the best-so-far score (the pass machine keeps the best, R12)
    const gainsBy = new Map<number, number[]>();
    for (const a of assets) {
      const bases = ofKind.filter(r => r.key === a && baseIndex(r.pass) !== undefined).sort((x, y) => baseIndex(x.pass)! - baseIndex(y.pass)!);
      let best: number | undefined;
      for (const b of bases) {
        const k = baseIndex(b.pass)!;
        if (best !== undefined) gainsBy.set(k, [...(gainsBy.get(k) ?? []), Math.max(0, b.score - best)]);
        best = best === undefined ? b.score : Math.max(best, b.score);
      }
    }
    const gains = [...gainsBy].sort((a, b) => a[0] - b[0]).map(([k, xs]) => ({ pass: `r${k}`, n: xs.length, mean: mean(xs) }));
    const solid = gains.filter(g => g.n >= minAssets), cur = currentPasses.get(kind), current = cur?.length ? Math.round(mean(cur)) : undefined;
    let revisionPasses = current ?? 3, why = `fewer than ${minAssets} assets reached a second pass: keep the current budget`, confidence: Confidence = 'low';
    if (solid.length) {
      const firstWeak = solid.find(g => g.mean < minGain), last = solid[solid.length - 1];
      if (firstWeak) {
        revisionPasses = Math.max(2, +firstWeak.pass.slice(1) - 1);
        why = `${firstWeak.pass} adds ${firstWeak.mean} on average over ${firstWeak.n} assets (< ${minGain})`;
      } else if (last.mean >= 2 * minGain) {
        revisionPasses = Math.min(maxPasses, +last.pass.slice(1) + 1);
        why = `${last.pass} still adds ${last.mean} on average over ${last.n} assets (≥ ${2 * minGain}): one more pass should pay`;
      } else {
        revisionPasses = +last.pass.slice(1);
        why = `every observed pass up to ${last.pass} adds ≥ ${minGain}`;
      }
      const n = Math.min(...solid.map(g => g.n));
      confidence = n >= 3 * minAssets ? 'high' : n >= 2 * minAssets ? 'medium' : 'low';
    }
    const perAssetImg = assets.map(a => ofKind.filter(r => r.key === a).reduce((s, r) => s + r.imageTokens, 0)).filter(x => x > 0);
    const p90 = perAssetImg.length ? pct(perAssetImg, 0.9) : 0, cap = perAssetImg.length >= minAssets + 2 ? Math.ceil((p90 * 1.5) / 500) * 500 : undefined;
    const fins = assets.map(a => ofKind.filter(r => r.key === a && r.stage === 'finish')).filter(f => f.length);
    const firstFin = fins.map(f => f.find(r => r.pass === 'f')?.delta).filter((d): d is number => d !== undefined);
    const finished = [...finals].filter(([, k]) => k === kind).map(([a]) => a), bl = blind.filter(b => b.kind === kind);
    const kb: KindBudget = {
      kind, assets: assets.length, gains, ...(current !== undefined && { current }), revisionPasses, confidence, why,
      imageTokens: { n: perAssetImg.length, p50: perAssetImg.length ? pct(perAssetImg, 0.5) : 0, p90, ...(cap && { cap }) },
      finish: { n: fins.length, ...(firstFin.length && { meanGain: mean(firstFin) }), ...(fins.length && { extraFinishRate: round(fins.filter(f => f.length > 1).length / fins.length) }) },
      ...(finished.length && { userRevisionRate: round(finished.filter(a => feedback.has(a)).length / finished.length) }),
      ...(bl.length && { blindGap: { n: bl.length, mean: mean(bl.map(b => b.gap)) } }),
    };
    kinds.push(kb);
    const entry: { revisionPasses?: number; maxImageTokensPerAsset?: number } = {};
    if (confidence !== 'low' && revisionPasses !== current) entry.revisionPasses = revisionPasses;
    if (cap) entry.maxImageTokensPerAsset = cap;
    if (Object.keys(entry).length) patch.budget.perKind[kind] = entry;
  }

  // model / effort per stage
  const models: StageModels[] = [];
  const totalTok = (r: Rec) => r.outTokens + r.inTokens + r.imageTokens;
  for (const stage of ['base', 'revise', 'finish'] as Stage[]) {
    const rs = recs.filter(r => stageOfRec(r) === stage);
    if (!rs.length) continue;
    const g = new Map<string, Rec[]>();
    for (const r of rs) { const k = `${r.model ?? 'unrecorded'}\0${r.effort ?? '-'}`; g.set(k, [...(g.get(k) ?? []), r]); }
    const mappings = [...g].map(([k, xs]) => {
      const [model, effort] = k.split('\0'), ds = xs.map(x => (stage === 'base' ? x.score : x.delta)).filter((d): d is number => d !== undefined), tok = xs.reduce((s, x) => s + totalTok(x), 0);
      return { model, effort, n: xs.length, ...(ds.length && { meanDelta: mean(ds) }), ...(tok && ds.length && { deltaPerKTok: round((ds.reduce((a, b) => a + b, 0) / tok) * 1000, 3) }) };
    }).sort((a, b) => b.n - a.n);
    const solid = mappings.filter(m => m.n >= minAssets && m.meanDelta !== undefined);
    let why: string, pick: StageModels['recommend'];
    if (solid.length >= 2) {
      const bestGain = Math.max(...solid.map(m => m.meanDelta!)), ok = solid.filter(m => m.meanDelta! >= bestGain - 0.25);
      const p = ok.sort((a, b) => (b.deltaPerKTok ?? 0) - (a.deltaPerKTok ?? 0))[0];
      pick = { model: p.model, ...(p.effort !== '-' && { effort: p.effort }) } as { model: string; effort: string };
      why = `${p.model}${p.effort !== '-' ? `/${p.effort}` : ''} ${stage === 'base' ? 'scores' : 'gains'} ${p.meanDelta} per pass (best ${bestGain}) at ${p.deltaPerKTok} per 1k tokens over ${p.n} passes`;
      if (p.model !== 'default' && p.model !== 'unrecorded') patch.models[stage] = { model: p.model, ...(p.effort !== '-' && p.effort !== 'default' && { effort: p.effort }) };
    } else {
      why = mappings.length === 1 ? `one mapping recorded (${mappings[0].model}${mappings[0].effort !== '-' ? `/${mappings[0].effort}` : ''}, ${mappings[0].n} passes): nothing to compare yet` : `fewer than ${minAssets} passes per mapping: nothing to compare yet`;
    }
    models.push({ stage, mappings, ...(pick && { recommend: pick }), why });
  }
  // the reviewer's model is judged by agreement with blind re-scores, not by gains (see the blind gaps by kind)
  const rv = new Map<string, number>();
  for (const r of recs) rv.set(r.reviewModel ?? 'unrecorded', (rv.get(r.reviewModel ?? 'unrecorded') ?? 0) + 1);
  if (rv.size) {
    const gaps = blind.map(b => b.gap);
    models.push({ stage: 'review', mappings: [...rv].map(([model, n]) => ({ model, effort: '-', n })),
      why: gaps.length ? `blind re-scores sit ${mean(gaps)} under the pipeline's own on average over ${gaps.length} finals${mean(gaps) >= 0.5 ? ': a stronger reviewer model (or effort) is worth a try' : ''}` : 'no blind re-scores yet' });
  }

  const notes: string[] = [];
  const single = models.filter(m => m.mappings.length === 1 && m.stage !== 'review');
  if (single.length) {
    const cand = single.filter(m => m.stage !== 'base' && m.mappings[0].meanDelta !== undefined).sort((a, b) => a.mappings[0].meanDelta! - b.mappings[0].meanDelta!)[0];
    if (cand) notes.push(`experiment: the ${cand.stage} stage gains least per pass (${cand.mappings[0].meanDelta}) — run its passes on a smaller model or lower effort for the next ${2 * minAssets} assets (artgen.config.json models.${cand.stage} = { "model": "…", "effort": "low" }), then compare here`);
  }
  for (const k of kinds) {
    if (k.finish.meanGain !== undefined && k.finish.n >= minAssets && k.finish.meanGain <= 0) notes.push(`${k.kind}: the first finishing pass adds ${k.finish.meanGain} on average — check what the finish template does for this kind`);
    if ((k.finish.extraFinishRate ?? 0) > 0.5 && k.finish.n >= minAssets) notes.push(`${k.kind}: ${Math.round(k.finish.extraFinishRate! * 100)}% of assets needed a second finish — the first finish leaves visible problems`);
    if ((k.userRevisionRate ?? 0) > 0.5 && k.assets >= minAssets) notes.push(`${k.kind}: the user sent back ${Math.round(k.userRevisionRate! * 100)}% of finished assets — raise this kind's bar (one more revision, or hero tier) or read the feedback notes for a common cause`);
    if (k.blindGap && k.blindGap.n >= minAssets && k.blindGap.mean >= 0.5) notes.push(`${k.kind}: blind re-scores sit ${k.blindGap.mean} under the pipeline's own over ${k.blindGap.n} finals — the in-pipeline reviewer is generous on this kind`);
  }

  return {
    projects: sets.map(s => ({ project: s.project, assets: new Set(s.metas.map(m => m.id)).size, scores: s.ledger.filter(e => e.type === 'score').length })),
    kinds, models, notes, patch,
  };
}

const sg = (v?: number) => (v === undefined ? '-' : `${v >= 0 ? '+' : ''}${v}`);

export function recommendMarkdown(r: Recommendations, title = 'artgen analytics v2: recommendations'): string {
  let md = `# ${title}\n\nPooled over ${r.projects.length} project(s): ${r.projects.map(p => `${p.project} (${p.assets} assets, ${p.scores} scores)`).join(', ')}.\n\n`;
  md += '## Revision passes by kind\n\nMean gain on the best-so-far score from each base pass (n = assets that reached it).\n\n| Kind | Assets | Gains by pass | Current | Recommended | Confidence | Why |\n|---|---|---|---|---|---|---|\n';
  for (const k of r.kinds) md += `| ${k.kind} | ${k.assets} | ${k.gains.map(g => `${g.pass} ${sg(g.mean)} (${g.n})`).join(', ') || '-'} | ${k.current ?? '-'} | ${k.revisionPasses} | ${k.confidence} | ${k.why} |\n`;
  md += '\n## Image-token caps by kind\n\n| Kind | Assets | p50 | p90 | Suggested cap |\n|---|---|---|---|---|\n';
  for (const k of r.kinds) md += `| ${k.kind} | ${k.imageTokens.n} | ${k.imageTokens.p50} | ${k.imageTokens.p90} | ${k.imageTokens.cap ?? '- (too few assets)'} |\n`;
  md += '\n## Finishing, user revisions and blind gaps by kind\n\n| Kind | Finished | First finish gain | Second finish needed | User sent back | Blind gap (own − blind) |\n|---|---|---|---|---|---|\n';
  for (const k of r.kinds) md += `| ${k.kind} | ${k.finish.n} | ${sg(k.finish.meanGain)} | ${k.finish.extraFinishRate === undefined ? '-' : `${Math.round(k.finish.extraFinishRate * 100)}%`} | ${k.userRevisionRate === undefined ? '-' : `${Math.round(k.userRevisionRate * 100)}%`} | ${k.blindGap ? `${sg(k.blindGap.mean)} (${k.blindGap.n})` : '-'} |\n`;
  md += '\n## Model / effort by stage\n\n| Stage | Mappings (passes, mean Δ, Δ per 1k tok) | Recommendation |\n|---|---|---|\n';
  for (const m of r.models) md += `| ${m.stage} | ${m.mappings.map(x => `${x.model}${x.effort !== '-' ? `/${x.effort}` : ''} (${x.n}, ${sg(x.meanDelta)}, ${x.deltaPerKTok ?? '-'})`).join('; ')} | ${m.recommend ? `**${m.recommend.model}${m.recommend.effort ? `/${m.recommend.effort}` : ''}** — ` : ''}${m.why} |\n`;
  md += `\n## Notes\n\n${r.notes.length ? r.notes.map(n => `- ${n}`).join('\n') : '- none'}\n`;
  const kinds = Object.keys(r.patch.budget.perKind), stages = Object.keys(r.patch.models);
  md += `\n## Config patch\n\n${kinds.length || stages.length ? `\`artgen analytics --across … --apply\` merges this into art/artgen.config.json:\n\n\`\`\`json\n${JSON.stringify({ ...(kinds.length && { budget: r.patch.budget }), ...(stages.length && { models: r.patch.models }) }, null, 2)}\n\`\`\`` : 'nothing to change: no recommendation clears its confidence bar'}\n`;
  return md;
}

/** Merge the patch into a config: `budget.perKind` entries per kind, stage models. Returns the new config. */
export function applyRecommendations(cfg: ProjectConfig, patch: Recommendations['patch']): ProjectConfig {
  const perKind = { ...(cfg.budget.perKind ?? {}) };
  for (const [k, v] of Object.entries(patch.budget.perKind)) perKind[k] = { ...(perKind[k] ?? {}), ...v };
  return { ...cfg, budget: { ...cfg.budget, ...(Object.keys(perKind).length && { perKind }) }, models: { ...cfg.models, ...patch.models } };
}
