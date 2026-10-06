/**
 * artgen CLI (entry point: `bin.ts`). Every command takes --json for machine-readable output.
 *
 * Project (W1, PLAN P2) — run inside a game repo:
 *   artgen init                                     scaffold art/ (direction, briefs, ledger, config)
 *   artgen direction candidates --pitch "…" [--view topdown|iso] [--mood a,b] [--scale small|medium|large]
 *                               [--directions 8] [--colors <file.hex|.gpl|image.png|#hex,…>] [--from art/interview.json]
 *   artgen direction tile [a b c …]                 style tile: the probe set under each candidate, one sheet
 *   artgen direction mix <base> --palette a --line b [--shading c] [--scale c] [--name m]
 *   artgen direction lock <candidate> [--note "…"] [--id name]   lock + anchors + art/direction.png
 *   artgen direction anchors                        re-save anchors from the probes (after their full pipeline)
 *   artgen direction new [--from <candidate>]       start a draft from the locked direction (version change)
 *   artgen direction show | validate <file>
 *   artgen palette import <file.hex|.gpl> | extract <image.png> [--n 16] | ramp <#hex> [--steps 4] [--hue-shift 12]
 *                  (import/extract add --interview to feed the colours into candidate A)
 *   artgen new <id> --kind character|prop|tile|effect|… [--view v] [--size key|WxH] [--states a,b] [--dir path]
 *   artgen finish <assetDir> [--base base.vN]       write the next finish.vM.js from the template
 *
 * Pipeline (asset directories):
 *   artgen pass status|next <assetDir>             pipeline state (v1 → v2 → v3 → finish → ready)
 *   artgen render <assetDir> [--version v] [--variant n] [--stages]
 *   artgen review <assetDir> [--version v]         review sheet: reference, best, v(n−1), v(n)
 *   artgen score <assetDir> <version> <0-10> [--note "…"]
 *   artgen variants <assetDir> [--version v] [--n 8]
 *   artgen report <dir> [--out REPORT.md] [--title "…"]
 * Asset commands take --direction <file|bench name> and --ledger <file> overrides.
 *
 * Benchmark (this repo): artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--update-golden]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPalette, generateRamp, Grid, MIX_PARTS, parseGpl, parseHexPalette, rampsFromColors, validateDirection, type Interview, type MixPart, type Size } from 'artgen-core';
import { openAsset, passState, type AssetDir, renderVersion, reviewVersion, scoreVersion, variantsSheet, versionsIn, writeRender } from './asset.ts';
import { resolveDirection, updateGolden, writeBench } from './bench.ts';
import { readGrid, writeGrid } from './node.ts';
import { findProject, initProject, readJson, requireProject, writeJson } from './project.ts';
import { report } from './report.ts';
import { newAsset, newFinish } from './templates.ts';
import { lock, readInterview, show, writeAnchors, writeCandidates, writeDraft, writeMix, writeTile } from './w1.ts';

declare const __ARTGEN_VERSION__: string | undefined;
/** Set by the artgen-dist build; `dev` when run from this repo. */
export const VERSION = typeof __ARTGEN_VERSION__ === 'string' ? __ARTGEN_VERSION__ : 'dev';

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Comma-separated values of a flag (`--states idle,walk`). */
function list(args: string[], name: string): string[] | undefined {
  const v = flag(args, name);
  return v === undefined ? undefined : v.split(',').map(s => s.trim()).filter(Boolean);
}

/** Colours from a `.hex`/`.gpl` file, a PNG (median cut) or a comma list of hexes. */
function readColors(src: string, n = 16): string[] {
  if (/^#?[0-9a-f]{6}(,#?[0-9a-f]{6})*$/i.test(src)) return src.split(',').map(c => '#' + c.replace('#', '').toLowerCase());
  if (!existsSync(src)) throw new Error(`${src}: not found`);
  if (src.endsWith('.png')) return extractPalette(readGrid(src), n).colors;
  const text = readFileSync(src, 'utf8');
  return src.endsWith('.gpl') ? parseGpl(text) : parseHexPalette(text);
}

const parseSize = (s?: string): string | Size | undefined => {
  const m = s?.match(/^(\d+)x(\d+)$/);
  return m ? [+m[1], +m[2]] : s;
};

const USAGE = `usage: artgen init
       artgen direction candidates --pitch "..." [--view topdown|iso] [--mood a,b] [--scale small|medium|large] [--colors src] [--from interview.json]
       artgen direction tile [names...] | mix <base> --palette a --line b ... | lock <name> [--note "..."] | anchors | new [--from c] | show | validate <file>
       artgen palette import <file> | extract <image.png> [--n 16] | ramp <#hex> [--steps 4] [--hue-shift 12] [--contrast 0.45]   (--interview: feed candidate A)
       artgen new <id> --kind <kind> [--view v] [--size key|WxH] [--states a,b] [--dir path]
       artgen finish <assetDir> [--base base.vN]
       artgen pass status|next <assetDir>
       artgen render <assetDir> [--version base.vN|finish.vM] [--variant n] [--stages]
       artgen review <assetDir> [--version v]
       artgen score <assetDir> <version> <score> [--note "..."]
       artgen variants <assetDir> [--version v] [--n 8]
       artgen report <dir> [--out REPORT.md] [--title "..."]
       artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--ledger <file>] [--update-golden]
       artgen --version`;

export async function main(argv: string[]): Promise<number> {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a): a is string => a !== undefined);
  const json = args.includes('--json'), print = (human: string, data: unknown) => console.log(json ? JSON.stringify(data, null, 2) : human);
  const asset = (p: string) => openAsset(p, { direction: flag(args, '--direction'), ledger: flag(args, '--ledger') });
  const latest = (p: string) => { const vs = versionsIn(asset(p)); if (!vs.length) throw new Error(`${p}: no base.vN.js yet`); return vs[vs.length - 1]; };

  if (cmd === 'bench') {
    if (args.includes('--update-golden')) { console.log(JSON.stringify(await updateGolden(), null, 2)); return 0; }
    const dir = resolveDirection(flag(args, '--direction') ?? 'benchmark');
    const results = await writeBench(dir, flag(args, '--out') ?? 'artgen-out', { stages: args.includes('--stages'), ledger: flag(args, '--ledger') });
    return results.every(r => r.report.pass) ? 0 : 1;
  }
  if (cmd === '--version' || cmd === 'version') { console.log(VERSION); return 0; }
  if (cmd === 'init') {
    const root = flag(args, '--root') ?? process.cwd(), r = initProject(root);
    print(r.created.length ? `artgen project in ${root}/art\n  ${r.created.map(f => f.slice(root.length + 1)).join('\n  ')}` : `artgen project in ${root}/art (already initialised)`, { root, created: r.created });
    return 0;
  }
  if (cmd === 'direction' && sub === 'validate' && rest[0]) {
    const r = validateDirection(JSON.parse(readFileSync(rest[0], 'utf8')));
    console.log(r.ok ? `ok: ${r.direction!.id} v${r.direction!.version}` : r.errors.join('\n'));
    return r.ok ? 0 : 1;
  }
  if (cmd === 'direction') {
    const p = requireProject(flag(args, '--root')), pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && rest[i - 1] !== '--json'));
    if (sub === 'candidates') {
      const from = flag(args, '--from'), base: Partial<Interview> = from ? readInterview(from) : existsSync(join(p.art, 'interview.json')) ? readJson<Interview>(join(p.art, 'interview.json')) : {};
      const iv: Interview = {
        ...base, pitch: flag(args, '--pitch') ?? base.pitch ?? '', ...(flag(args, '--view') && { view: flag(args, '--view') as Interview['view'] }),
        ...(list(args, '--mood') && { mood: list(args, '--mood') }), ...(flag(args, '--scale') && { scale: flag(args, '--scale') as Interview['scale'] }),
        ...(flag(args, '--directions') && { directions: +flag(args, '--directions')! as Interview['directions'] }), ...(flag(args, '--id') && { id: flag(args, '--id') }),
        ...(flag(args, '--colors') && { colors: readColors(flag(args, '--colors')!) }), ...(flag(args, '--background') && { background: flag(args, '--background') }),
      };
      if (!iv.pitch) throw new Error('direction candidates: --pitch "<one-paragraph game pitch>" (or --from interview.json) is required');
      const r = writeCandidates(p, iv);
      print([`interview ${r.interview}`, ...r.candidates.map(c => `${c.name.toUpperCase()} ${c.file}\n    ${c.summary.join('\n    ')}`), ...(r.probes.length ? [`probes:\n  ${r.probes.join('\n  ')}`] : []), ...r.fallbacks.map(f => `note: ${f}`), 'next: artgen direction tile'].join('\n'), r);
      return 0;
    }
    if (sub === 'tile') {
      const r = await writeTile(p, pos);
      print([`style tile ${r.path} (round ${r.round}, ~${r.tokens} image tokens)`, ...r.columns.map(c => `  ${c.name} ${c.id}: ${Object.entries(c.gates).map(([k, v]) => `${k} ${v ? 'ok' : 'FAIL'}`).join(', ')}${c.failing.length ? `\n    ${c.failing.join('\n    ')}` : ''}`), `  distinct designs: ${r.distinct.pairs}/${r.columns.length}, min palette luma gap ${r.distinct.minLumaGap}`].join('\n'), r);
      return r.columns.every(c => Object.values(c.gates).every(Boolean)) ? 0 : 1;
    }
    if (sub === 'mix' && pos[0]) {
      const take: Partial<Record<MixPart, string>> = {};
      for (const part of MIX_PARTS) { const v = flag(args, `--${part}`); if (v) take[part] = v; }
      const r = writeMix(p, pos[0], take, flag(args, '--name'));
      print(`${r.name} ${r.file}: ${r.dir.theme.notes}\nnext: artgen direction tile ${r.name}`, { name: r.name, file: r.file });
      return 0;
    }
    if (sub === 'lock' && pos[0]) {
      const r = await lock(p, pos[0], { id: flag(args, '--id'), note: flag(args, '--note') });
      print([`locked ${r.direction.id} v${r.direction.version} -> ${r.file}`, `anchors: ${r.anchors.join(', ')}`, `style sheet: ${r.sheet}`, ...Object.entries(r.gates).filter(([, ok]) => !ok).map(([k]) => `  gate FAIL on probe ${k}`)].join('\n'), { direction: { id: r.direction.id, version: r.direction.version }, file: r.file, anchors: r.anchors, sheet: r.sheet, versions: r.versions, gates: r.gates });
      return 0;
    }
    if (sub === 'anchors') {
      const r = await writeAnchors(p);
      print(`anchors: ${r.anchors.join(', ')} (${Object.entries(r.versions).map(([k, v]) => `${k} ${v}`).join(', ')})\nstyle sheet: ${r.sheet}`, r);
      return 0;
    }
    if (sub === 'new') {
      const r = writeDraft(p, flag(args, '--from'), flag(args, '--name'));
      print(`draft ${r.file} — edit it, then: artgen direction tile ${r.name} && artgen direction lock ${r.name}`, r);
      return 0;
    }
    if (sub === 'show') {
      const r = show(p);
      print([
        r.locked ? `locked: ${r.locked.id} v${r.locked.version} (${r.locked.camera.view}, ${r.locked.anchors.length} anchors)` : 'locked: none yet',
        ...r.candidates.map(c => `candidate ${c.name}: ${c.id} [${c.status}]\n    ${c.summary.join('\n    ')}`),
        ...(r.tiles.length ? [`style tiles: ${r.tiles.join(', ')}`] : []),
        ...Object.entries(r.probes).map(([k, v]) => `probe ${k}: ${v || '(empty)'}`),
      ].join('\n'), { locked: r.locked && { id: r.locked.id, version: r.locked.version, anchors: r.locked.anchors }, candidates: r.candidates, tiles: r.tiles, probes: r.probes });
      return 0;
    }
  }
  if (cmd === 'palette' && sub && rest[0]) {
    if (sub === 'ramp') {
      const ramp = generateRamp(rest[0], { steps: +(flag(args, '--steps') ?? 4), hueShift: +(flag(args, '--hue-shift') ?? 12), contrast: +(flag(args, '--contrast') ?? 0.45) });
      print(ramp.join(' '), { ramp });
      return 0;
    }
    if (sub === 'import' || sub === 'extract') {
      const colors = readColors(rest[0], +(flag(args, '--n') ?? 16)), ramps = rampsFromColors(colors);
      if (args.includes('--interview')) {
        const p = requireProject(flag(args, '--root')), f = join(p.art, 'interview.json');
        const iv = existsSync(f) ? readJson<Interview>(f) : ({ pitch: '' } as Interview);
        writeJson(f, { ...iv, colors });
      }
      if (flag(args, '--swatch')) {
        const g = new Grid(colors.length * 8, 8);
        colors.forEach((c, i) => g.fill(i * 8, 0, 8, 8, c));
        writeGrid(flag(args, '--swatch')!, g);
      }
      print(`${colors.length} colours: ${colors.join(' ')}\n${Object.entries(ramps).map(([k, r]) => `  ${k}: ${r.join(' ')}`).join('\n')}${args.includes('--interview') ? '\nadded to art/interview.json (candidate A builds its ramps from them)' : ''}`, { colors, ramps });
      return 0;
    }
  }
  if (cmd === 'new' && sub) {
    const kind = flag(args, '--kind');
    if (!kind) throw new Error('new: --kind is required (character, creature, prop, tile, effect, …)');
    const p = findProject(flag(args, '--root')), view = flag(args, '--view') ?? (p && (() => { try { return readJson<{ camera?: { view?: string } }>(join(p.art, 'direction.json')).camera?.view; } catch { return undefined; } })()) ?? 'topdown';
    const path = flag(args, '--dir') ?? (p ? join(p.art, 'assets', kind, sub) : sub);
    const r = newAsset(path, { id: sub, kind, view, size: parseSize(flag(args, '--size')), states: list(args, '--states'), directions: flag(args, '--directions') ? +flag(args, '--directions')! : undefined, notes: flag(args, '--notes') });
    print(`${sub}: ${r.files.join(', ')} (template ${r.template.view}/${r.template.kind}${r.template.fallback ? ', fallback' : ''})\nnext: edit base.v1.js for the brief, then artgen review ${path}`, { files: r.files, template: r.template });
    return 0;
  }
  if (cmd === 'finish' && sub) {
    // the base: --base, else the pass machine's choice (best scored), else the latest base (W1 probes before lock)
    const vs = versionsIn({ path: sub } as AssetDir), n = vs.filter(v => v.startsWith('finish.')).length + 1;
    let base = flag(args, '--base');
    if (!base) {
      const st = await (async () => { try { return await passState(asset(sub)); } catch { return undefined; } })();
      base = st?.next.action === 'write-finish' ? st.next.base : st?.best?.version ?? vs.filter(v => v.startsWith('base.')).pop();
    }
    if (!base) throw new Error(`${sub}: no base version to finish`);
    const file = newFinish(sub, n, base);
    print(`${file} (bound to ${base})`, { file, base });
    return 0;
  }
  if (cmd === 'pass' && (sub === 'status' || sub === 'next') && rest[0]) {
    const st = await passState(asset(rest[0]));
    if (sub === 'next') { print(`${st.next.action} ${'version' in st.next ? st.next.version : ''} — ${st.next.why}`, st.next); return 0; }
    const lines = st.rows.map(r => `  ${r.pass.padEnd(4)} ${r.version.padEnd(10)} ${r.score === undefined ? 'unscored' : `score ${r.score}`}${r.gate === undefined ? '' : r.gate ? ' gate pass' : ' gate FAIL'}${r.base ? ` (on ${r.base})` : ''}`);
    print([`${st.asset}${st.best ? ` — best base ${st.best.version} (${st.best.score})` : ''}`, ...lines, ...(st.stale?.length ? ['  FINISH-STALE:', ...st.stale.map(s => `    ${s}`)] : []), `next: ${st.next.action} ${'version' in st.next ? st.next.version : ''} — ${st.next.why}`].join('\n'), st);
    return 0;
  }
  if (cmd === 'render' && sub) {
    const a = asset(sub), version = flag(args, '--version') ?? latest(sub), stages = args.includes('--stages') ? new Map<string, Grid>() : undefined;
    const variant = +(flag(args, '--variant') ?? 0);
    const r = await renderVersion(a, version, { variant, stages });
    const files = writeRender(a, r, variant ? join(a.path, 'out', `variant-${variant}`) : undefined);
    if (stages) for (const [k, g] of stages) writeGrid(join(a.path, 'out', 'stages', version, `${k.replace(/\//g, '_')}.png`), g);
    print(`${a.brief.id} ${version}: ${r.report.pass ? 'gate pass' : 'gate FAIL'}  ${r.report.checks.map(c => `${c.id}:${c.status}`).join(' ')}\n  ${files.join('\n  ')}${r.stale?.length ? `\n  FINISH-STALE: ${r.stale.join('; ')}` : ''}`,
      { version, pass: r.report.pass, checks: r.report.checks, metrics: r.report.metrics, files, stale: r.stale });
    return r.report.pass ? 0 : 1;
  }
  if (cmd === 'review' && sub) {
    const a = asset(sub), version = flag(args, '--version') ?? latest(sub), r = await reviewVersion(a, version);
    print(`review sheet ${r.path} (~${r.tokens} image tokens); gate ${r.render.report.pass ? 'pass' : 'FAIL'}`, { sheet: r.path, tokens: r.tokens, pass: r.render.report.pass, checks: r.render.report.checks });
    return 0;
  }
  if (cmd === 'score' && sub && rest[0] && rest[1]) {
    const score = +rest[1];
    if (!(score >= 0 && score <= 10)) throw new Error('score must be 0–10');
    const e = await scoreVersion(asset(sub), rest[0], score, flag(args, '--note') ?? '');
    print(`scored ${e.asset} ${e.version} (${e.pass}) ${score}; gate ${e.conformance?.pass ? 'pass' : 'FAIL'}`, e);
    return 0;
  }
  if (cmd === 'variants' && sub) {
    const r = await variantsSheet(asset(sub), flag(args, '--version') ?? latest(sub), +(flag(args, '--n') ?? 8));
    print(`${r.path}: ${r.distinct} distinct of ${r.hashes.length}`, r);
    return 0;
  }
  if (cmd === 'report' && sub) {
    const r = await report(sub, { out: flag(args, '--out'), title: flag(args, '--title') });
    if (!flag(args, '--out')) console.log(r.markdown);
    return r.summaries.every(s => s.met) ? 0 : 1;
  }
  console.log(USAGE);
  return cmd ? 1 : 0;
}
