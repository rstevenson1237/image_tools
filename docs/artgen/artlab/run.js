#!/usr/bin/env node
// run.js - experiment harness.
//   node run.js render <asset> <tech> <ver>    render techniques/<tech>/<asset>.<ver>.js, log code tokens + metrics
//   node run.js review <asset> [tech]          build a review sheet PNG (what the model looks at), log image tokens
//   node run.js review <asset> latest          only the newest version per technique (cheaper review)
//   node run.js reviewtech <tech> <a,b,c>       newest version of one technique across assets
//   node run.js score <asset> <tech> <ver> <0-10> "note"   record visual-review score
//   node run.js all                            re-render every version (reproducibility check)
//   node run.js report [iso]                   write REPORT.md + final comparison sheet
const fs = require('fs'), path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { measure } = require('./lib/metrics');

const ROOT = __dirname, OUT = path.join(ROOT, 'out'), LEDGER = path.join(ROOT, 'records', 'ledger.json');
const ASSETS = {
  hero: { w: 32, h: 32, scale: 8, sym: 'x', bg: '#4f8a3c', label: 'Fantasy hero 32x32 (RPG)' },
  ship: { w: 160, h: 41, scale: 4, sym: 'y', bg: '#24527a', label: 'WWII battleship 160x41 (naval sim)' },
  tank: { w: 64, h: 64, scale: 5, sym: 'x', bg: '#6b5a45', label: 'Sci-fi tank 64x64 (RTS)' },
  // isometric roguelike set (2:1 iso, 32x16 floor tiles drawn under the sprite in review sheets)
  isohero: { w: 32, h: 48, scale: 6, sym: 'x', bg: '#2a2630', iso: true, label: 'Iso hero 32x48 (roguelike)' },
  isospider: { w: 32, h: 32, scale: 6, sym: 'x', bg: '#2a2630', iso: true, label: 'Iso creature: cave spider 32x32' },
  isochest: { w: 64, h: 32, scale: 6, sym: 'none', bg: '#2a2630', iso: true, label: 'Iso feature: chest closed|open 64x32' },
};
const TECHS = { t1: 'Direct pixel writes', t2: 'Primitive composition', t3: 'SVG -> canvas', t4: 'Voxel -> iso render' };
const PRICE = { inPerM: 4, outPerM: 20, model: 'claude-opus-5-5' }; // USD list price, Sep 2026
const CHARS_PER_TOKEN = 3.5; // code heuristic; replace with /v1/messages/count_tokens when an API key is available

fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER)) : [];
const saveLedger = () => fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
const tok = s => Math.ceil(s.length / CHARS_PER_TOKEN);
const file = (a, t, v) => path.join(ROOT, 'techniques', t, `${a}.${v}.js`);
const versions = (a, t) => fs.existsSync(path.join(ROOT, 'techniques', t)) ?
  fs.readdirSync(path.join(ROOT, 'techniques', t)).filter(f => f.startsWith(a + '.v')).map(f => f.split('.')[1]).sort((x, y) => +x.slice(1) - +y.slice(1)) : [];

function diffTokens(oldSrc, newSrc) { // tokens in lines that are new vs previous version (approx edit cost)
  const pool = new Map(); for (const l of oldSrc.split('\n')) pool.set(l, (pool.get(l) || 0) + 1);
  let added = ''; for (const l of newSrc.split('\n')) { if (pool.get(l)) pool.set(l, pool.get(l) - 1); else added += l + '\n'; }
  return tok(added);
}

async function render(a, t, v, log = true) {
  const f = file(a, t, v); delete require.cache[require.resolve(f)];
  const mod = require(f), t0 = Date.now(); const g = await mod.render(1); const ms = Date.now() - t0;
  const dir = path.join(OUT, a); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${t}-${v}.png`), await g.toCanvas(1).encode('png'));
  fs.writeFileSync(path.join(dir, `${t}-${v}@${ASSETS[a].scale}x.png`), await g.toCanvas(ASSETS[a].scale).encode('png'));
  const m = measure(g, { symAxis: ASSETS[a].sym }); m.renderMs = ms;
  if (log) {
    const src = fs.readFileSync(f, 'utf8'), vs = versions(a, t), prev = vs[vs.indexOf(v) - 1];
    const entry = { type: 'code', asset: a, tech: t, ver: v, fullTokens: tok(src),
      diffTokens: prev ? diffTokens(fs.readFileSync(file(a, t, prev), 'utf8'), src) : tok(src), metrics: m, notes: mod.notes || '' };
    const i = ledger.findIndex(e => e.type === 'code' && e.asset === a && e.tech === t && e.ver === v);
    if (i >= 0) ledger[i] = { ...ledger[i], ...entry }; else ledger.push(entry); saveLedger();
  }
  console.log(`${a} ${t} ${v}`, JSON.stringify(m));
  return { g, m };
}

function isoFloor(w, h) { // 2:1 diamond floor tiles (32x16), alternating stone tones
  const { Grid } = require('./lib/core'); const g = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.floor((x / 2 + (y + 4)) / 16), v = Math.floor((-x / 2 + (y + 4)) / 16), e = ((x / 2 + y + 4) % 16 < 1) || ((-x / 2 + y + 4 + 1024) % 16 < 1);
    g.set(x, y, e ? '#23202a' : (u + v) % 2 ? '#4a4452' : '#545060'); }
  return g;
}
function checker(ctx, x, y, w, h, s = 8) {
  for (let j = 0; j < h; j += s) for (let i = 0; i < w; i += s) {
    ctx.fillStyle = ((i + j) / s) % 2 ? '#2a2a33' : '#33333d'; ctx.fillRect(x + i, y + j, Math.min(s, w - i), Math.min(s, h - j));
  }
}

// Sheet: one row per (tech, version): [1x native] [scaled on checker] [scaled on game background]
async function sheet(rows, outName, title) {
  const pad = 12, lab = 18; let W = 0, H = 40;
  for (const r of rows) { const A = ASSETS[r.a]; r.sw = A.w * A.scale; r.sh = A.h * A.scale; W = Math.max(W, A.w + r.sw * 2 + pad * 5); H += r.sh + lab + pad; }
  const c = createCanvas(W, H), ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#16161c'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px DejaVu Sans'; ctx.fillText(title, pad, 26);
  let y = 40;
  for (const r of rows) {
    const A = ASSETS[r.a]; ctx.fillStyle = '#ddd'; ctx.font = '12px DejaVu Sans Mono';
    ctx.fillText(r.label, pad, y + 12); y += lab;
    const g1 = r.g.toCanvas(1), gs = r.g.toCanvas(A.scale);
    checker(ctx, pad, y, A.w, A.h, 4); ctx.drawImage(g1, pad, y);
    const x2 = pad * 2 + A.w; checker(ctx, x2, y, r.sw, r.sh); ctx.drawImage(gs, x2, y);
    const x3 = x2 + r.sw + pad; ctx.fillStyle = A.bg; ctx.fillRect(x3, y, r.sw, r.sh);
    if (A.iso) ctx.drawImage(isoFloor(A.w, A.h).toCanvas(A.scale), x3, y);
    ctx.drawImage(gs, x3, y);
    y += r.sh + pad;
  }
  const p = path.join(OUT, outName); fs.writeFileSync(p, await c.encode('png'));
  return { path: p, w: W, h: H };
}

// Claude vision cost estimate: ~ (w*h)/750 tokens after resizing long edge to <=1568
function imageTokens(w, h) { const s = Math.min(1, 1568 / Math.max(w, h)); return Math.ceil((w * s) * (h * s) / 750); }

async function review(a, t) { // t may be a tech id, or 'latest' = newest version of each tech only
  const rows = [], latest = t === 'latest'; if (latest) t = undefined;
  for (const tech of t ? [t] : Object.keys(TECHS)) for (const v of (latest ? versions(a, tech).slice(-1) : versions(a, tech))) {
    const { g, m } = await render(a, tech, v, false);
    rows.push({ a, g, label: `${tech} ${v} | ${TECHS[tech]} | hyg ${m.hygiene} col ${m.colors} aa ${m.aaPartialPct}% orph ${m.orphanPct}% outl ${m.outlinePct}% sym ${m.symmetryPct}%` });
  }
  const s = await sheet(rows, `review-${a}${t ? '-' + t : latest ? '-latest' : ''}.png`, `${ASSETS[a].label}${t ? ' - ' + TECHS[t] : ''}`);
  ledger.push({ type: 'review', asset: a, tech: t || 'all', image: path.basename(s.path), tokens: imageTokens(s.w, s.h) }); saveLedger();
  console.log('review sheet', s.path, `${s.w}x${s.h}`, 'est image tokens', imageTokens(s.w, s.h));
}

function score(a, t, v, sc, note) {
  const e = ledger.find(e => e.type === 'code' && e.asset === a && e.tech === t && e.ver === v);
  if (!e) throw new Error('render first'); e.visual = +sc; e.reviewNote = note || ''; saveLedger(); console.log('scored', a, t, v, sc);
}

async function report(group = 'topdown') { // group: topdown | iso
  const inGroup = a => (group === 'iso') === !!ASSETS[a].iso;
  const libTok = fs.readdirSync(path.join(ROOT, 'lib')).reduce((n, f) => n + tok(fs.readFileSync(path.join(ROOT, 'lib', f), 'utf8')), 0);
  const cost = (o, i) => (o * PRICE.outPerM + i * PRICE.inPerM) / 1e6;
  let md = `# Art-generation technique experiment\n\nModel price basis: ${PRICE.model} $${PRICE.inPerM}/M in, $${PRICE.outPerM}/M out. Token counts are estimates (${CHARS_PER_TOKEN} chars/token for code; (w*h)/750 for review images). Shared library: ~${libTok} tokens.\n\n`;
  md += `| Asset | Tech | Ver | Code tok (full) | Edit tok | Hygiene | Visual | Colors | AA% | Orphan% | Outline% | Note |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const summary = {}, finals = [];
  for (const a of Object.keys(ASSETS).filter(inGroup)) for (const t of Object.keys(TECHS)) {
    const es = ledger.filter(e => e.type === 'code' && e.asset === a && e.tech === t).sort((x, y) => +x.ver.slice(1) - +y.ver.slice(1));
    const rv = ledger.filter(e => e.type === 'review' && e.asset === a && (e.tech === t || e.tech === 'all'));
    for (const e of es) md += `| ${a} | ${t} | ${e.ver} | ${e.fullTokens} | ${e.diffTokens} | ${e.metrics.hygiene} | ${e.visual ?? '-'} | ${e.metrics.colors} | ${e.metrics.aaPartialPct} | ${e.metrics.orphanPct} | ${e.metrics.outlinePct} | ${(e.reviewNote || '').replace(/\|/g, '/')} |\n`;
    if (!es.length) continue;
    const out = es.reduce((n, e) => n + e.diffTokens, 0), inp = rv.reduce((n, e) => n + e.tokens, 0) / (rv.some(e => e.tech === 'all') ? 3 : 1);
    const last = es[es.length - 1]; summary[t] ??= { out: 0, inp: 0, vis: [], hyg: [], iters: 0 };
    Object.assign(summary[t], { out: summary[t].out + out, inp: summary[t].inp + inp, iters: summary[t].iters + es.length });
    summary[t].vis.push(last.visual ?? 0); summary[t].hyg.push(last.metrics.hygiene);
    finals.push({ a, t, v: last.ver });
  }
  const TECH_LIB = { t1: [], t2: ['prim.js'], t3: ['svg.js'], t4: ['voxel.js'] }; // technique-specific library code is part of its cost
  for (const [t, fs_] of Object.entries(TECH_LIB)) if (summary[t]) summary[t].out += fs_.reduce((n, f) => n + tok(fs.readFileSync(path.join(ROOT, 'lib', f), 'utf8')), 0);
  md += `\n## Per-technique totals (all three assets, incl. technique-specific lib)\n\n| Tech | Iterations | Output tok | Review tok | Est. cost | Avg final visual | Avg final hygiene | Visual pts per $0.01 |\n|---|---|---|---|---|---|---|---|\n`;
  for (const [t, s] of Object.entries(summary)) {
    const c = cost(s.out, s.inp), av = s.vis.reduce((x, y) => x + y, 0) / s.vis.length, ah = s.hyg.reduce((x, y) => x + y, 0) / s.hyg.length;
    md += `| ${t} ${TECHS[t]} | ${s.iters} | ${s.out} | ${Math.round(s.inp)} | $${c.toFixed(3)} | ${av.toFixed(1)} | ${ah.toFixed(1)} | ${(av / (c * 100)).toFixed(1)} |\n`;
  }
  fs.writeFileSync(path.join(ROOT, group === 'iso' ? 'REPORT-iso.md' : 'REPORT.md'), md);
  const rows = []; for (const f of finals) { const { g } = await render(f.a, f.t, f.v, false); rows.push({ a: f.a, g, label: `${f.a} | ${f.t} ${TECHS[f.t]} (final ${f.v})` }); }
  await sheet(rows, group === 'iso' ? 'final-comparison-iso.png' : 'final-comparison.png', `Final iteration of each technique x asset (${group})`); console.log(md);
}

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'render') await render(a[0], a[1], a[2]);
  else if (cmd === 'review') await review(a[0], a[1]);
  else if (cmd === 'reviewtech') { // newest version of one technique across several assets: reviewtech t3 hero,ship,tank
    const rows = []; for (const as of a[1].split(',')) { const v = versions(as, a[0]).slice(-1)[0]; const { g, m } = await render(as, a[0], v, false);
      rows.push({ a: as, g, label: `${as} ${a[0]} ${v} | hyg ${m.hygiene} col ${m.colors} orph ${m.orphanPct}%` }); }
    const s = await sheet(rows, `review-${a[0]}-${a[1].replace(/,/g, '-')}.png`, `${TECHS[a[0]]}: newest versions`);
    ledger.push({ type: 'review', asset: a[1], tech: a[0], image: path.basename(s.path), tokens: imageTokens(s.w, s.h) }); saveLedger(); console.log(s.path, imageTokens(s.w, s.h)); }
  else if (cmd === 'score') score(...a);
  else if (cmd === 'all') { for (const as of Object.keys(ASSETS)) for (const t of Object.keys(TECHS)) for (const v of versions(as, t)) await render(as, t, v); }
  else if (cmd === 'report') await report(a[0]);
  else console.log('usage: render|review|score|all|report');
})();
