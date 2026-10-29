/**
 * The core module's operations: what every install has whichever of the art and maps modules it holds. Today that is
 * `ui`, the local review server (docs/TOOLING-PLAN.md §5b), and the two halves of the feedback loop that need no pixel-art
 * pipeline: `report` (a feedback bundle for the artgen repo) and `upstream` (local edits of installed files as a patch,
 * §5), and `metrics export` and `metrics pool` (R5: a maps-only repo exports too; the pixel-art numbers come from `Ctx.artMetrics`,
 * which only the art module's contexts provide). They import only Node and the files the maps-only bundle may hold, so that bundle has them too.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLE_KINDS, DEFAULT_REPO, openIssue, writeBundle } from '../loop/feedback-bundle.ts';
import { exportMetrics, pool, poolMarkdown } from '../loop/metrics.ts';
import { upstream } from '../loop/upstream.ts';
import { startUiServer } from '../ui-server.ts';
import { defineOp, p, type OpDef } from './registry.ts';

type Inp = Record<string, any>;

/** Open a link in the user's browser (best effort; the link is printed either way). */
function openBrowser(url: string): void {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* no browser here */ }
}

/** The modules this repo's install holds (`tools/artgen/MANIFEST.json`); all of them when it isn't an install (a checkout of the artgen repo). */
function installedModules(root: string): string[] {
  try { return Object.keys(JSON.parse(readFileSync(join(root, 'tools', 'artgen', 'MANIFEST.json'), 'utf8')).modules ?? {}); } catch { return []; }
}

export const uiOp = defineOp({
  name: 'ui', module: 'core', effect: 'write',
  summary: 'Serve the review UI (Asset Review, Art Direction, Asset Lab, the map editors) for this repo\'s art/ on this machine.',
  params: {
    port: p.int('the port to listen on (default: any free one)', { mcp: false }),
    dir: p.str('the folder with the built web tools (default: ui/ beside this program; for development)', { mcp: false }),
    open: p.bool('open the link in the default browser', { mcp: false }),
  },
  async run(i: { port?: number; dir?: string; open?: boolean }, ctx) {
    // the install's tools/artgen/ folder: next to the bundle that is running (it holds the ui folder, resvg.wasm and fonts/)
    const project = ctx.project(), here = dirname(fileURLToPath(import.meta.url)), uiDir = i.dir ?? join(here, 'ui');
    if (!existsSync(join(uiDir, 'index.html'))) throw new Error(`ui: no web tools in ${uiDir} — install the ui module: npx -y github:rstevenson1237/image_tools#artgen-dist add ui`);
    const modules = installedModules(project.root), s = await startUiServer({ root: project.root, uiDir, shared: here, port: i.port, info: { modules } });
    console.log(`artgen ui: ${s.url}\nserving ${project.art} — Ctrl-C to stop`);
    if (i.open) openBrowser(s.url);
    const signals = ['SIGINT', 'SIGTERM'] as const;
    await new Promise<void>(done => {
      const stop = () => { for (const sig of signals) process.off(sig, stop); done(); };
      for (const sig of signals) process.on(sig, stop);
    });
    await s.close();
    return { url: s.url, stopped: true };
  },
  cli: {
    usage: '       artgen ui [--port N] [--open]                   serve the review UI for art/ on this machine (the ui module); prints the link',
    text: () => 'artgen ui: stopped',
  },
  mcp: { exclude: 'starts a server that waits for a person at a browser' },
  python: { exclude: 'starts a server that waits for a person at a browser' },
});

export const reportOp = defineOp({
  name: 'report', module: 'core', effect: 'write',
  summary: 'Write a feedback bundle for an asset, map, dungeon or settlement (its files, versions, render, a case.md) to send back to the artgen repo.',
  description: 'Write a feedback bundle to art/feedback/<date>-<id>/: the input file, the command, the artgen version, the render, the ledger lines and a case.md in the layout of the artgen repo\'s consumer fixtures, plus ISSUE.md, the text of the issue it would open. Nothing is sent.',
  params: {
    id: p.str('the asset, map, dungeon or settlement id', { positional: true }),
    file: p.str('a map, dungeon or settlement file by path, in place of the id', { mcp: false }),
    kind: p.oneOf(BUNDLE_KINDS, 'which one the id (or file) is, when it could be more than one'),
    note: p.str('what is wrong or missing, in your words'),
    out: p.str('the folder to write the bundle to (default art/feedback/<date>-<id>/)', { mcp: false }),
    no_render: p.bool('leave the render out'),
    issue: p.bool('open the issue on the artgen repo with the bundle (needs GH_TOKEN or GITHUB_TOKEN; without one, prints the link to open)', { mcp: false }),
    repo: p.str(`the repo the issue goes to (default ${DEFAULT_REPO})`, { mcp: false }),
  },
  async run(i: { id?: string; file?: string; kind?: (typeof BUNDLE_KINDS)[number]; note?: string; out?: string; no_render?: boolean; issue?: boolean; repo?: string }, ctx) {
    const pr = ctx.findProject(), b = await writeBundle(pr, i.id, { file: i.file, kind: i.kind, note: i.note, out: i.out, noRender: i.no_render, repo: i.repo });
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    const issue = i.issue && token ? await openIssue(b, i.repo ?? DEFAULT_REPO, token) : undefined;
    return { dir: ctx.rel(b.dir), id: b.id, kind: b.kind, files: b.files, check: b.check, link: b.link, ...(issue && { issue }) };
  },
  cli: {
    usage: '       artgen report <id> [--kind asset|map|dungeon|settlement] [--file path] [--note "..."] [--no-render] [--issue]   a feedback bundle for the artgen repo (art/feedback/); --issue sends it',
    text: (r, i) => [
      `feedback bundle: ${r.dir} (${r.files.length} files)`, `  check: ${r.check}`,
      r.issue ? `issue opened: ${r.issue}` : i.issue ? `no GH_TOKEN or GITHUB_TOKEN here, so nothing was sent. To send it, open:\n${r.link}` : `read ${r.dir}/ISSUE.md, then send it: artgen report ${r.id} --issue (without a token this prints the link to open)`,
    ].join('\n'),
  },
  mcp: {}, python: {},
});

export const upstreamOp = defineOp({
  name: 'upstream', module: 'core', effect: 'write',
  summary: 'Your local edits to the installed skills, agents, commands and templates as a patch against their sources in the artgen repo.',
  params: {
    base: p.str('a folder with the artgen distribution at the installed version (default: fetched from the release tag on GitHub)', { mcp: false }),
    out: p.str('where to write the patch (default art/feedback/upstream-<date>.patch)', { mcp: false }),
    repo: p.str(`the artgen repo (default ${DEFAULT_REPO})`, { mcp: false }),
  },
  async run(i: { base?: string; out?: string; repo?: string }, ctx) {
    const r = await upstream(ctx.findProject()?.root ?? process.cwd(), { base: i.base, out: i.out, repo: i.repo });
    return { ...r, out: r.out && ctx.rel(r.out) };
  },
  cli: {
    usage: '       artgen upstream [--base dir] [--out file.patch]   local edits of installed files as a patch against the artgen repo\'s sources',
    text: r => r.files.length ? [
      ...r.files.map((f: { installed: string; source?: string; status: string; note?: string }) => `${f.status.padEnd(8)} ${f.installed}${f.source ? ` -> ${f.source}` : ''}${f.note ? `  (${f.note})` : ''}`),
      r.out ? `patch for artgen ${r.version}: ${r.out}\napply it in the artgen repo: git apply ${r.out}` : 'no patch to write',
    ].join('\n') : `no installed file is edited (artgen ${r.version})`,
    json: r => ({ ...r, patch: undefined }),
  },
  mcp: { exclude: 'compares installed files and may fetch from GitHub; the user sends edits upstream' }, python: {},
});

export const metricsExport = defineOp({
  name: 'metrics.export', module: 'core', effect: 'write',
  summary: 'Write this repo\'s counts and ratios (assets, passes, tokens, minutes, scores, gate failures, per kind; per generator, maps too) to art/metrics/<version>.json for the pool.',
  description: 'Write art/metrics/<artgen version>.json: counts and ratios from the ledger and briefs (per generator: pixel art and each kind of map; for art also assets, passes, tokens, minutes, scores, gate failures per kind), the artgen version and the installed modules. No images, ids, notes or paths.',
  params: { name: p.str('how this repo appears in the pool (default: a short hash of its folder name)'), out: p.str('write the file here instead', { mcp: false }) },
  run: (i: Inp, ctx) => { const r = exportMetrics(ctx.project(), { name: i.name, out: i.out, art: ctx.artMetrics }); return { file: ctx.rel(r.file), metrics: r.metrics }; },
  cli: {
    usage: '       artgen metrics export [--name repo] [--out file]   counts and ratios for the pool (art/metrics/<version>.json)',
    text: r => {
      const m = r.metrics, g = Object.entries(m.generators ?? {}).filter(([k]) => k !== 'art').map(([k, x]) => `${x.subjects} ${k}${x.subjects === 1 ? '' : 's'}, ${x.approved} approved`).join('; ');
      const head = m.assets ? `${m.assets.total} assets, ${m.assets.approved} approved, ${m.totals!.outTokens + m.totals!.imageTokens} tokens${g ? `; ${g}` : ''}` : g || 'nothing to count yet';
      return `metrics for artgen ${m.artgen}: ${head}\n${r.file}\nread it before you share it: it holds counts and ratios only`;
    },
    json: r => r.metrics,
  },
  mcp: {}, python: {},
});

export const metricsPool = defineOp({
  name: 'metrics.pool', module: 'core', effect: 'read',
  summary: 'Put exported metrics from several repos side by side per artgen version (tokens and minutes per approved asset, first-pass approval, gate failures; per generator).',
  params: { paths: p.str('export files or folders of them', { positional: 'rest', required: 'metrics pool: name the export files or folders to pool', schema: { type: 'array', items: { type: 'string' } }, mcp: false }), out: p.str('also write the markdown here', { mcp: false }) },
  run(i: Inp) {
    const r = pool(i.paths as string[]), markdown = poolMarkdown(r);
    if (i.out) writeFileSync(i.out, markdown);
    return { markdown, pool: r };
  },
  cli: { usage: '       artgen metrics pool <file|folder>… [--out pool.md]   exports from several repos, per artgen version', text: r => r.markdown, json: r => r.pool },
  mcp: { exclude: 'reads export files by path outside art/' }, python: {},
});

export const CORE_OPS: OpDef[] = [uiOp, reportOp, upstreamOp, metricsExport, metricsPool];
