#!/usr/bin/env node
// Intake (docs/TOOLING-PLAN.md §5, R4): turns a feedback bundle that a consumer sent with `artgen report` into a consumer
// fixture, packages/artgen-cli/fixtures/<consumer>/<case>/, which the fixture tests then hold every later build to.
//
//   node scripts/artgen-intake.mjs <issue number | issue.json | ISSUE.md> [--consumer name] [--case name] [--repo owner/repo] [--force] [--dry-run]
//   node scripts/artgen-intake.mjs --bundle <art/feedback/… folder>       [--consumer name] [--case name] [--force] [--dry-run]
//
// An issue number is read through the GitHub API (GH_TOKEN or GITHUB_TOKEN if the repo is private). The body of the issue is the
// bundle's ISSUE.md: case.md, then the input file in a fenced block under `<!-- artgen:input map.json -->`. When the file was too
// large to paste, it is a file attached to the issue; the link is found in the body and downloaded. A bundle folder works for
// every kind, assets included (they have no inline form).
//
// The new case.md gets `status: reported` and `intake:` lines. The fixture tests then hold the file to the minimum: it parses at
// the format it states, `check` and a render do not throw, and the render is the same twice. The maintainer adds what the file
// must go on stating (the facts), in case.md and in the tests, once the report is understood. A fixture changes only through a
// brief from its consumer (fixtures/README.md): nothing here edits an existing case.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'packages', 'artgen-cli', 'fixtures');
const INPUT_NAMES = ['map.json', 'dungeon.json', 'settlement.json'];

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * The parts of a bundle's issue body: its case.md, the input file's name and text (when inline), and the links of attached files.
 * @param {string} body
 */
export function parseIssueBody(body) {
  // the file's name comes from the issue, which anyone can write: only the three names the fixtures use are taken
  const marker = body.match(/<!-- artgen:input (map\.json|dungeon\.json|settlement\.json) -->\s*```json\n([\s\S]*?)\n```/);
  const caseMd = (marker ? body.slice(0, marker.index) : body).trim() + '\n';
  const attached = [...body.matchAll(/\bhttps:\/\/github\.com\/(?:user-attachments\/(?:files|assets)\/[^\s)>\]]+|[^\s)>\]]+\/files\/[^\s)>\]]+)/g)].map(m => m[0]);
  return { caseMd, input: marker ? { name: marker[1], text: marker[2] + '\n' } : undefined, attached };
}

/**
 * The fields of a bundle's case.md.
 * @param {string} md
 */
export function parseCase(md) {
  const title = md.match(/^# (\S+?)(?: — (.*))?$/m), format = md.match(/^format: (\w+) (\d+)$/m), kind = md.match(/^kind: (\w+)$/m);
  const consumer = md.match(/^consumer: (\S+) at (\S+) \(([^)]*)\)/m);
  return {
    id: title?.[1], summary: title?.[2],
    kind: format?.[1] ?? kind?.[1], format: format ? Number(format[2]) : undefined,
    consumer: consumer?.[1], commit: consumer?.[2], branch: consumer?.[3],
    asset: md.match(/^asset: (\S+)$/m)?.[1],
  };
}

/** A consumer's folder name from its repo (`rstevenson1237/setting_builder` → `setting-builder`). */
export const consumerDir = repo => slug((repo ?? '').split('/').pop() ?? '');

/** A consumer's README with the case added to its row of the table (`| \`setting-builder/\` | \`warren\`, … |`); the text unchanged when there is no row. */
export function addToReadme(text, consumer, name) {
  const row = new RegExp(`^\\| \`${consumer}/\` \\| (.*) \\|$`, 'm'), m = text.match(row);
  if (!m || m[1].split(', ').includes(`\`${name}\``)) return text;
  return text.replace(row, `| \`${consumer}/\` | ${m[1]}, \`${name}\` |`);
}

/**
 * Write the case into `fixtures/<consumer>/<case>/`. Returns the folder.
 * @param {{ consumer: string, name: string, caseMd: string, files: Record<string, string | Buffer>, copy?: [string, string][], issue?: string, force?: boolean, dryRun?: boolean, fixtures?: string }} o
 */
export function writeCase(o) {
  const fixtures = o.fixtures ?? FIXTURES, dir = join(fixtures, o.consumer, o.name), c = parseCase(o.caseMd);
  if (!c.kind || (c.kind !== 'asset' && c.format === undefined)) throw new Error('case.md has no "format: <kind> <version>" line: the reported file has no version field, so it is not one artgen writes; add the version it should be read at');
  if (!c.commit || !/^[0-9a-f]{40}$/.test(c.commit)) throw new Error(`case.md names no consumer commit (got "${c.commit ?? 'none'}"): the consumer must report from a git checkout, or add the sha of the commit the file came from`);
  if (existsSync(dir) && !o.force) throw new Error(`${dir} exists: a fixture changes only through a brief from its consumer; pass --force to replace it`);
  const md = o.caseMd.replace(/^(format: .*|kind: .*)$/m, `$1\nstatus: reported — held to the minimum until its facts are written down${o.issue ? `\nintake: ${o.issue}` : ''}`);
  if (o.dryRun) return dir;
  mkdirSync(dir, { recursive: true });
  for (const [name, data] of Object.entries(o.files)) { mkdirSync(dirname(join(dir, name)), { recursive: true }); writeFileSync(join(dir, name), data); }
  for (const [from, to] of o.copy ?? []) cpSync(from, join(dir, to), { recursive: true });
  writeFileSync(join(dir, 'case.md'), md);
  const readme = join(fixtures, o.consumer, 'README.md');
  if (existsSync(readme)) writeFileSync(readme, addToReadme(readFileSync(readme, 'utf8'), o.consumer, o.name));
  return dir;
}

/** Fetch an issue's body: from the API by number, or from a local file (the API's JSON, or ISSUE.md). */
async function readIssue(arg, repo, fetchImpl = fetch) {
  if (/^\d+$/.test(arg)) {
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues/${arg}`, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'artgen-intake', ...(token && { authorization: `Bearer ${token}` }) } });
    if (!res.ok) throw new Error(`issue ${repo}#${arg}: GitHub answered ${res.status}`);
    const j = await res.json();
    return { body: j.body ?? '', ref: `${repo}#${arg}` };
  }
  const text = readFileSync(arg, 'utf8');
  if (arg.endsWith('.json')) return { body: JSON.parse(text).body ?? '', ref: undefined };
  return { body: text.replace(/^# .*\n\n/, ''), ref: undefined };   // ISSUE.md: a title line, then the body
}

async function main(argv) {
  const flags = {}, words = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--consumer', '--case', '--repo', '--bundle'].includes(a)) flags[a] = argv[++i];
    else if (a.startsWith('--')) flags[a] = true;
    else words.push(a);
  }
  const repo = flags['--repo'] ?? 'rstevenson1237/image_tools', force = !!flags['--force'], dryRun = !!flags['--dry-run'];
  let caseMd, files = {}, copy = [], issue;
  if (flags['--bundle']) {
    const b = resolve(flags['--bundle']);
    caseMd = readFileSync(join(b, 'case.md'), 'utf8');
    const c = parseCase(caseMd);
    if (c.kind === 'asset') {
      for (const f of ['direction.json', 'briefs.yaml', 'artgen.config.json', 'ledger.jsonl']) if (existsSync(join(b, f))) copy.push([join(b, f), f]);
      copy.push([join(b, 'asset'), 'asset']);
    } else {
      const input = INPUT_NAMES.find(n => existsSync(join(b, n)));
      if (!input) throw new Error(`${b}: no map.json, dungeon.json or settlement.json`);
      copy.push([join(b, input), input]);
    }
  } else {
    if (!words[0]) throw new Error('usage: artgen-intake.mjs <issue number | issue.json | ISSUE.md> | --bundle <folder> [--consumer name] [--case name] [--force] [--dry-run]');
    const { body, ref } = await readIssue(words[0], repo);
    issue = ref;
    const parsed = parseIssueBody(body);
    caseMd = parsed.caseMd;
    if (parsed.input) files[parsed.input.name] = parsed.input.text;
    else {
      const url = parsed.attached.find(u => INPUT_NAMES.some(n => u.endsWith(`/${n}`)));
      if (!url) throw new Error('the issue has no input file inline and no attached map.json, dungeon.json or settlement.json: ask the reporter to attach it (or send the bundle folder: --bundle)');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      files[INPUT_NAMES.find(n => url.endsWith(`/${n}`))] = Buffer.from(await res.arrayBuffer());   // saved under the fixture's name, whatever else the link says
    }
  }
  const c = parseCase(caseMd), consumer = flags['--consumer'] ?? consumerDir(c.consumer), name = flags['--case'] ?? slug(c.id ?? '');
  if (!consumer || !name) throw new Error('could not tell the consumer or the case name: pass --consumer and --case');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(consumer) || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`the consumer and case names are lower-case letters, digits and - (got ${consumer} and ${name})`);
  for (const [n, data] of Object.entries(files)) if (n.endsWith('.json')) JSON.parse(String(data));   // the file must parse
  const dir = writeCase({ consumer, name, caseMd, files, copy, issue, force, dryRun });
  console.log(`${dryRun ? 'would write' : 'wrote'} ${dir}\nnext: read case.md, write what the file must go on stating, and run \`npm test -w artgen-cli\``);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
