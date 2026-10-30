#!/usr/bin/env node
/**
 * R6a measurements (docs/STAGES.md §12): `node scripts/artgen-stage-measure.ts [compactness|sheets|restyle|replay|all]`.
 *   compactness  shape checks and compactness of the stand frames of the example finals and the bench assets (calibrates SHAPE_READ_MAX)
 *   sheets       image tokens of the shape sheet against the full review sheet, bench assets (§12.1)
 *   restyle      a palette-only direction change on a temp copy of each example: per asset, the stages whose key changed (§12.3)
 *   replay       passes before each base-route feedback note in the example ledgers (§12.4)
 * Nothing under examples/ is written: restyle works on a copy in the OS temp folder.
 */
import { register } from 'node:module';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

register(`data:text/javascript,${encodeURIComponent(`export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && s.endsWith('.js')) return next(s.slice(0, -3) + '.ts', c); throw e; } }`)}`);

const core = await import('artgen-core');
const { BENCH_ASSETS, BENCH_DIRECTIONS } = await import('artgen-core/bench');
const { runBench } = await import('../packages/artgen-cli/src/bench.ts');
const { findProject } = await import('../packages/artgen-cli/src/project.ts');
const { openAsset, renderVersion, reviewVersion } = await import('../packages/artgen-cli/src/asset.ts');
const { shapeReview } = await import('../packages/artgen-cli/src/stages.ts');
const { projectStatus, restyle, readBriefs, assetPathOf } = await import('../packages/artgen-cli/src/w2.ts');
const { initNodeSvg } = await import('../packages/artgen-cli/src/node.ts');

const ROOT = new URL('..', import.meta.url).pathname, EXAMPLES = ['swamp-topdown', 'iso-dungeon', 'billboard-crawler'].map(n => join(ROOT, 'examples', n));
const what = process.argv[2] ?? 'all';
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };

async function finals() {
  const out: { name: string; res: Awaited<ReturnType<typeof renderVersion>>; a: ReturnType<typeof openAsset> }[] = [];
  for (const root of EXAMPLES) {
    const p = findProject(root)!;
    for (const r of await projectStatus(p)) if (r.final) { const a = openAsset(join(root, r.path)); out.push({ name: `${root.split('/').pop()}/${r.id}`, res: await renderVersion(a, r.final), a }); }
  }
  return out;
}

if (what === 'compactness' || what === 'all') {
  await initNodeSvg();
  const rows: [string, number, string][] = [];
  for (const f of await finals()) {
    const stand = f.res.render.cells.filter(c => c.state === f.res.render.states[0] && c.facing === f.res.render.facings[0]);
    const cp = Math.max(...stand.map(c => core.compactness(core.shapeMask(c.grid, f.a.dir), c.grid.w, c.grid.h)));
    rows.push([f.name, cp, f.res.stages.checks.filter(c => c.stage === 'shape' && c.status !== 'pass' && c.status !== 'skip').map(c => `${c.id}:${c.status}`).join(' ')]);
  }
  const bench = await runBench(core.parseDirection ? (await import('artgen-scene/direction.ts')).parseDirection(BENCH_DIRECTIONS.benchmark) : (undefined as never));
  for (const b of bench) {
    const dir = (await import('artgen-scene/direction.ts')).parseDirection(BENCH_DIRECTIONS.benchmark), rep = core.stageReport(b.render, dir, { brief: b.asset.brief as never });
    const stand = b.render.cells.filter(c => c.state === b.render.states[0] && c.facing === b.render.facings[0]);
    rows.push([`bench/${b.asset.id}`, Math.max(...stand.map(c => core.compactness(core.shapeMask(c.grid, dir), c.grid.w, c.grid.h))), rep.checks.filter(c => c.status !== 'pass' && c.status !== 'skip').map(c => `${c.id}:${c.status}`).join(' ')]);
  }
  for (const [n, c, f] of rows) console.log(`${n.padEnd(34)} compactness ${c.toFixed(3)}  ${f}`);
  const cs = rows.map(r => r[1]);
  console.log(`n=${cs.length} min ${Math.min(...cs).toFixed(3)} median ${med(cs).toFixed(3)} max ${Math.max(...cs).toFixed(3)}`);
}

if (what === 'sheets' || what === 'all') {
  await initNodeSvg();
  const { parseDirection } = await import('artgen-scene/direction.ts');
  const dir = parseDirection(BENCH_DIRECTIONS.benchmark);
  let full = 0, shape = 0;
  console.log('asset        full-sheet tokens   shape-sheet tokens');
  for (const b of await runBench(dir)) {
    const A = b.asset.review, ctx = A.iso ? core.iso.isoFloor(b.strip.w, b.strip.h) : undefined;
    const fs = core.reviewSheet({ title: A.label, rows: [{ label: b.asset.id, grid: b.strip, scale: A.scale, bg: A.bg, context: ctx }] });
    const rep = core.stageReport(b.render, dir, { brief: b.asset.brief as never });
    const ss = core.shapeSheet(b.render, dir, { title: `${b.asset.id} base.v1 shape`, placeholder: core.defaultPlaceholder(b.asset.brief as never, dir), checks: rep.checks.filter(c => c.stage === 'shape') });
    const tf = core.imageTokens(fs.w, fs.h), ts = core.imageTokens(ss.w, ss.h);
    full += tf; shape += ts;
    console.log(`${b.asset.id.padEnd(12)} ${String(tf).padStart(8)} ${String(ts).padStart(18)}  (${Math.round((ts / tf) * 100)}%)`);
  }
  console.log(`total        ${String(full).padStart(8)} ${String(shape).padStart(18)}  (${Math.round((shape / full) * 100)}%)  [bench: one-row sheets, one facing; no earlier versions or anchors]`);
  // the real thing on temp copies of the example games: the review sheet of each final as `review` builds it (earlier versions, anchors) against `review --stage shape`
  let f2 = 0, s2 = 0, n2 = 0;
  console.log('example final                       full review sheet   shape sheet');
  for (const src of EXAMPLES) {
    const tmp = mkdtempSync(join(tmpdir(), 'artgen-measure-'));
    try {
      cpSync(src, tmp, { recursive: true, filter: x => !x.includes('node_modules') });
      const p = findProject(tmp)!;
      for (const r of await projectStatus(p)) if (r.final && r.kind !== 'tile' && r.kind !== 'texture') {
        const a = openAsset(join(tmp, r.path)), full = await reviewVersion(a, r.final), sh = await shapeReview(a, r.final);
        f2 += full.tokens; s2 += sh.tokens; n2++;
        console.log(`${(src.split('/').pop() + '/' + r.id).padEnd(34)} ${String(full.tokens).padStart(8)} ${String(sh.tokens).padStart(14)}  (${Math.round((sh.tokens / full.tokens) * 100)}%)`);
      }
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`examples (${n2} non-tile finals): full ${f2}, shape ${s2} (${Math.round((s2 / f2) * 100)}%)`);
}

if (what === 'restyle' || what === 'all') {
  await initNodeSvg();
  for (const src of EXAMPLES) {
    const tmp = mkdtempSync(join(tmpdir(), 'artgen-measure-'));
    try {
      cpSync(src, tmp, { recursive: true, filter: s => !s.includes('node_modules') });
      const p = findProject(tmp)!, dirFile = join(p.art, 'direction.json'), cur = JSON.parse(readFileSync(dirFile, 'utf8'));
      // a palette-only change: every ramp colour turns 40° round the hue wheel; outline, shading and line stay
      const turn = (hex: string) => {
        const [r, g, b] = core.parseColor(hex).map((v: number) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
        let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h * 60 + 40 + 360) % 360; const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
        const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
        return '#' + [rr + m, gg + m, bb + m].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
      };
      const next = JSON.parse(JSON.stringify(cur));
      next.version = cur.version + 1;
      for (const k of Object.keys(next.palette.ramps)) next.palette.ramps[k] = next.palette.ramps[k].map(turn);
      writeFileSync(join(p.art, 'directions', `v${cur.version}.json`), JSON.stringify(cur, null, 2));
      writeFileSync(dirFile, JSON.stringify(next, null, 2));
      const res = await restyle(p, { from: cur.version });
      const tally: Record<string, number> = {};
      for (const a of res.assets) for (const s of a.stages.changed) tally[s] = (tally[s] ?? 0) + 1;
      const same = res.assets.filter(a => a.stages.changed.length === 1 && a.stages.changed[0] === 'decorate').length;
      console.log(`${src.split('/').pop()}: ${res.assets.length} finals restyled v${res.from} -> v${res.to}; stages changed per asset: ${JSON.stringify(tally)}; only decorate changed in ${same}/${res.assets.length}`);
      for (const a of res.assets) if (!(a.stages.changed.length === 1 && a.stages.changed[0] === 'decorate')) console.log(`   ${a.id}: changed ${a.stages.changed.join(', ') || 'none'}`);
      void readBriefs; void assetPathOf;
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }
}

if (what === 'replay' || what === 'all') {
  // passes before each base-route note by the user in the example ledgers (§12.4); a shape gate would put the user's eyes on the shape after v1
  const rows: { name: string; kind: string; before: number; note: string }[] = [];
  for (const root of EXAMPLES) {
    const f = join(root, 'art', 'ledger.jsonl');
    if (!existsSync(f)) continue;
    const kinds = new Map(readBriefs(findProject(root)!).map(b => [b.id, b.kind])), ledger = core.parseLedger(readFileSync(f, 'utf8'));
    ledger.forEach((e, i) => {
      if (e.type !== 'feedback' || e.by !== 'user' || e.route !== 'base') return;
      const before = new Set(ledger.slice(0, i).filter(x => x.asset === e.asset && x.type === 'score' && !x.blind && x.version).map(x => x.version)).size;
      rows.push({ name: `${root.split('/').pop()}/${e.asset}`, kind: kinds.get(e.asset) ?? '?', before, note: String(e.note).slice(0, 60) });
    });
  }
  for (const r of rows) console.log(`${r.name.padEnd(32)} ${r.kind.padEnd(9)} ${r.before} scored passes before the note: ${r.note}`);
  const sum = (xs: typeof rows) => xs.reduce((n, r) => n + r.before, 0), saved = (xs: typeof rows) => sum(xs) - xs.length;
  const figures = rows.filter(r => r.kind === 'character' || r.kind === 'creature'), shaped = rows.filter(r => r.kind !== 'tile' && r.kind !== 'texture' && r.kind !== 'tileset');
  console.log(`${rows.length} base-route notes, ${sum(rows)} passes before them (mean ${(sum(rows) / rows.length).toFixed(1)}).`);
  console.log(`on gated kinds by default (character, creature): ${figures.length} notes, ${sum(figures)} passes; a shape gate after v1 puts the shape in front of the user after 1 pass, so at most ${saved(figures)} passes saved.`);
  console.log(`on any shaped kind (+ props, effects; gates set per brief): ${shaped.length} notes, ${sum(shaped)} passes, at most ${saved(shaped)} saved. The rest (${rows.length - shaped.length}) are tile pattern notes, which no shape gate sees.`);
}
