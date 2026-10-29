// The feedback loop (docs/TOOLING-PLAN.md R4): the unified diff, `report` bundles, the issue it opens, the metrics export and pool,
// and review on the pull request (prepare, parse).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';
import { main } from '../cli.ts';
import { dungeonFile } from '../dungeon.ts';
import { initProject } from '../project.ts';
import { unifiedDiff } from './diff.ts';
import { briefOf, kindOfFile, openIssue, writeBundle } from './feedback-bundle.ts';
import { exportMetrics, metricsOf, pool, poolMarkdown } from './metrics.ts';
import { parseReviewComment, prepareReview } from './pr-review.ts';
import { unfill } from './upstream.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const FIXTURES = join(REPO, 'packages/artgen-cli/fixtures/setting-builder');
const scratch = (name: string) => mkdtempSync(join(tmpdir(), `artgen-loop-${name}-`));
async function cli(...args: string[]): Promise<{ code: number; out: string }> {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
}
/// a copy of an example game repo (its art/ folder and install), to read and write freely
function example(name: string): string {
  const dir = scratch(name);
  cpSync(join(REPO, 'examples', name, 'art'), join(dir, 'art'), { recursive: true });
  return dir;
}
/// a project with the warren fixture as a dungeon
function withWarren(): { root: string; file: string } {
  const root = scratch('warren'), { project } = initProject(root), file = dungeonFile(project, 'warren');
  mkdirSync(join(file, '..'), { recursive: true });
  cpSync(join(FIXTURES, 'warren', 'dungeon.json'), file);
  return { root, file };
}

describe('unifiedDiff', () => {
  const apply = (path: string, before: string, patch: string): string => {
    const dir = scratch('apply');
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), before);
    const r = spawnSync('git', ['apply', '-'], { cwd: dir, input: patch, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    return readFileSync(join(dir, path), 'utf8');
  };
  const lines = (n: number, tweak: (i: number) => string = i => `line ${i}`) => Array.from({ length: n }, (_, i) => tweak(i + 1)).join('\n') + '\n';

  test('is empty for equal texts and ignores a missing final newline', () => {
    expect(unifiedDiff('a.md', 'x\ny\n', 'x\ny\n')).toBe('');
    expect(unifiedDiff('a.md', 'x\ny', 'x\ny\n')).toBe('');
  });
  test('a change, an insertion and a deletion apply with git apply', () => {
    const before = lines(30), after = lines(30, i => (i === 5 ? 'five, edited' : i === 20 ? '' : `line ${i}`)).replace('\n\n', '\n').replace('line 12\n', 'line 12\ninserted\n');
    const patch = unifiedDiff('docs/x.md', before, after);
    expect(patch.startsWith('--- a/docs/x.md\n+++ b/docs/x.md\n@@')).toBe(true);
    expect(apply('docs/x.md', before, patch)).toBe(after);
  });
  test('nearby changes share a hunk, distant ones do not', () => {
    const patch = unifiedDiff('f', lines(40), lines(40, i => (i === 3 || i === 6 || i === 36 ? `edit ${i}` : `line ${i}`)));
    expect(patch.match(/^@@/gm)).toHaveLength(2);
  });
  test('a file rewritten end to end is one replacement, not a memory hog', () => {
    const before = Array.from({ length: 5000 }, (_, i) => `old ${i}`).join('\n') + '\n', after = Array.from({ length: 5000 }, (_, i) => `new ${i}`).join('\n') + '\n';
    const patch = unifiedDiff('big.txt', before, after);
    expect(patch.match(/^@@/gm)).toHaveLength(1);
    expect(apply('big.txt', before, patch)).toBe(after);
  });
  test('a whole new text and an emptied one', () => {
    expect(apply('n.md', '', unifiedDiff('n.md', '', 'new\ntext\n'))).toBe('new\ntext\n');
    expect(apply('n.md', 'old\nstuff\n', unifiedDiff('n.md', 'old\nstuff\n', ''))).toBe('');
  });
});

describe('unfill', () => {
  test('puts the build\'s values back, and only the values', () => {
    expect(unfill('Run `node tools/artgen/artgen.js render x` or node tools/artgen/artgen-maps.js map check, then /artgen-review (and `/artgen-direction`).'))
      .toBe('Run `{{ARTGEN}} render x` or {{ARTGEN}} map check, then {{CMD}}review (and {{CMD_DIRECTION}}).');
    expect(unfill('see tools/artgen/templates/a and docs/artgen-notes')).toBe('see tools/artgen/templates/a and docs/artgen-notes');
  });
});

describe('report', () => {
  test('a dungeon bundle: the input file, case.md in the fixture layout, the render, the issue text', async () => {
    const { root } = withWarren(), { project } = { project: { root, art: join(root, 'art') } };
    const b = await writeBundle(project, 'warren', { note: 'the F.3 doors draw on top of the corridor', now: new Date('2026-10-29T10:00:00Z') });
    expect(b.dir).toBe(join(root, 'art', 'feedback', '2026-10-29-warren'));
    expect(b.kind).toBe('dungeon');
    expect(b.files).toEqual(expect.arrayContaining(['dungeon.json', 'case.md', 'report.json', 'ISSUE.md', 'dungeon.svg', 'dungeon.png']));
    expect(readFileSync(join(b.dir, 'dungeon.json'), 'utf8')).toBe(readFileSync(join(FIXTURES, 'warren', 'dungeon.json'), 'utf8'));
    const md = readFileSync(join(b.dir, 'case.md'), 'utf8');
    expect(md).toMatch(/^# warren — the F\.3 doors draw on top of the corridor$/m);
    expect(md).toMatch(/^format: dungeon 1$/m);          // what fixtures.test.ts requires of a case
    expect(md).toMatch(/^consumer: .* at \S+ \(/m);
    expect(md).toMatch(/```sh\nnode tools\/artgen\/artgen-maps\.js dungeon check --file dungeon\.json --json\n```/);
    expect(b.check).toBe('ok');
    // the issue text holds the case and the file inline, and the link goes to the artgen repo's issue form
    expect(b.body).toContain('<!-- artgen:input dungeon.json -->');
    expect(b.link).toMatch(/^https:\/\/github\.com\/rstevenson1237\/image_tools\/issues\/new\?labels=artgen-feedback&title=/);
    expect(new URL(b.link).searchParams.get('body')!.length).toBeLessThan(2000);
    // a second report on the same day does not overwrite the first
    expect((await writeBundle(project, 'warren', { now: new Date('2026-10-29T12:00:00Z'), noRender: true })).dir).toBe(join(root, 'art', 'feedback', '2026-10-29-warren-2'));
  });

  test('a bad file is reported with what check says, and a render that cannot be made says so', async () => {
    const root = scratch('bad'), file = join(root, 'dungeon.json');
    cpSync(join(FIXTURES, 'bad-file', 'dungeon.json'), file);
    const b = await writeBundle(null, undefined, { file, note: 'two mistakes', out: join(root, 'bundle') });
    expect(b.check).toContain('corridors[5].to.room');
    expect(existsSync(join(b.dir, 'dungeon.json'))).toBe(true);
    expect(readFileSync(join(b.dir, 'case.md'), 'utf8')).toMatch(/^render: failed: /m);
  });

  test('a file the size of a real map is attached, not pasted', async () => {
    const root = scratch('big'), file = join(root, 'map.json'), m = JSON.parse(readFileSync(join(FIXTURES, 'frontier', 'map.json'), 'utf8'));
    writeFileSync(file, JSON.stringify({ ...m, pad: 'x'.repeat(50_000) }));
    const b = await writeBundle(null, undefined, { file, noRender: true, out: join(root, 'b') });
    expect(b.body).not.toContain('artgen:input');
    expect(b.body).toContain('attach');
  });

  test('the id must be one thing', async () => {
    const { root } = withWarren(), project = { root, art: join(root, 'art') };
    await expect(writeBundle(project, 'nothing-here', {})).rejects.toThrow('not an asset, a map, a dungeon or a settlement');
    // the same id as a map and a dungeon: say which
    mkdirSync(join(root, 'art', 'maps', 'warren'), { recursive: true });
    cpSync(join(FIXTURES, 'frontier', 'map.json'), join(root, 'art', 'maps', 'warren', 'map.json'));
    await expect(writeBundle(project, 'warren', {})).rejects.toThrow('warren is a map and a dungeon — say which with --kind');
    expect((await writeBundle(project, 'warren', { kind: 'dungeon', noRender: true })).kind).toBe('dungeon');
  });

  test('the file kinds are told apart by their keys', () => {
    for (const [dir, kind] of [['warren', 'dungeon'], ['frontier', 'map']] as const) {
      const f = readdirSync(join(FIXTURES, dir)).find(n => n.endsWith('.json'))!;
      expect(kindOfFile(JSON.parse(readFileSync(join(FIXTURES, dir, f), 'utf8')))).toBe(kind);
    }
    expect(kindOfFile({ nope: 1 })).toBeUndefined();
  });

  test('an asset bundle: its sources, the ledger lines of that asset and no other', async () => {
    const root = example('swamp-topdown'), project = { root, art: join(root, 'art') };
    const b = await writeBundle(project, 'leech', { note: 'the tail is cut off', now: new Date('2026-10-29T00:00:00Z') });
    expect(b.kind).toBe('asset');
    expect(b.files).toEqual(expect.arrayContaining(['direction.json', 'briefs.yaml', 'ledger.jsonl', 'case.md', 'asset/brief.json']));
    expect(b.files.some(f => /^asset\/base\.v\d+\.js$/.test(f))).toBe(true);
    const ledger = readFileSync(join(b.dir, 'ledger.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(ledger.length).toBeGreaterThan(0);
    expect(new Set(ledger.map(e => e.asset))).toEqual(new Set(['leech']));
    expect(b.body).toContain('zip the folder');
  });

  test('an asset in a project under a folder called out is still copied; its own out/ is not', async () => {
    const parent = scratch('out-parent'), root = join(parent, 'out', 'game');
    mkdirSync(join(parent, 'out'), { recursive: true });
    cpSync(example('swamp-topdown'), root, { recursive: true });
    mkdirSync(join(root, 'art', 'assets', 'creature', 'leech', 'out'), { recursive: true });
    writeFileSync(join(root, 'art', 'assets', 'creature', 'leech', 'out', 'render.png'), 'x');
    const b = await writeBundle({ root, art: join(root, 'art') }, 'leech', {});
    expect(b.files.some(f => /^asset\/base\.v\d+\.js$/.test(f))).toBe(true);
    expect(b.files.some(f => f.startsWith('asset/out/'))).toBe(false);
  });

  test('a file\'s own id is made safe before it names a folder', async () => {
    const root = scratch('unsafe'), file = join(root, 'dungeon.json');
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(join(FIXTURES, 'warren', 'dungeon.json'), 'utf8')), id: '../../x y' }));
    const b = await writeBundle(null, undefined, { file, noRender: true, now: new Date('2026-10-29') });
    expect(b.id).toBe('x-y');
    expect(b.dir).toBe(join(root, 'feedback-2026-10-29-x-y'));
  });

  test('the asset\'s brief is cut out of briefs.yaml, and the whole file is said to be copied when it can\'t be', async () => {
    const yaml = '# briefs\n- id: goblin\n  kind: character\n  notes: "x"\n- kind: prop\n  id: crate\n- id: orc\n  kind: character\n';
    expect(briefOf(yaml, 'crate')).toBe('- kind: prop\n  id: crate\n');
    expect(briefOf(yaml, 'goblin')).toBe('- id: goblin\n  kind: character\n  notes: "x"\n');
    expect(briefOf(yaml, 'nobody')).toBeUndefined();
    expect(briefOf('not a list', 'x')).toBeUndefined();
    const root = example('swamp-topdown'), project = { root, art: join(root, 'art') };
    const b = await writeBundle(project, 'leech', {});
    const brief = readFileSync(join(b.dir, 'briefs.yaml'), 'utf8');
    expect(brief).toContain('leech');
    expect(brief).not.toContain('wisp');
  });

  test('a folder is pointed at bench-report, which is where `report <dir>` went', async () => {
    const root = example('swamp-topdown'), project = { root, art: join(root, 'art') };
    await expect(writeBundle(project, join(root, 'art', 'assets'), {})).rejects.toThrow('bench-report');
  });

  test('the command: `report` writes the bundle, says what to do next and sends nothing', async () => {
    const { root } = withWarren();
    const r = await cli('report', 'warren', '--root', root, '--note', 'doors', '--no-render');
    expect(r.code).toBe(0);
    expect(r.out).toContain('feedback bundle: ');
    expect(r.out).toContain('report warren --issue');
    const j = JSON.parse((await cli('report', 'warren', '--root', root, '--no-render', '--json')).out);
    expect(j).toMatchObject({ id: 'warren', kind: 'dungeon' });
    expect(readdirSync(join(root, 'art', 'feedback'))).toHaveLength(2);
  });

  test('--issue without a token prints the link instead', async () => {
    const { root } = withWarren(), saved = { a: process.env.GH_TOKEN, b: process.env.GITHUB_TOKEN };
    delete process.env.GH_TOKEN; delete process.env.GITHUB_TOKEN;
    try {
      const r = await cli('report', 'warren', '--root', root, '--no-render', '--issue');
      expect(r.out).toContain('nothing was sent');
      expect(r.out).toContain('https://github.com/rstevenson1237/image_tools/issues/new?');
    } finally { if (saved.a) process.env.GH_TOKEN = saved.a; if (saved.b) process.env.GITHUB_TOKEN = saved.b; }
  });

  test('openIssue posts the bundle with the token and returns the issue link; a refusal says what to do', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ html_url: 'https://github.com/o/r/issues/7' }), { status: 201 }); }) as unknown as typeof fetch;
    expect(await openIssue({ title: 'T', body: 'B' }, 'o/r', 'tok', ok)).toBe('https://github.com/o/r/issues/7');
    expect(calls[0].url).toBe('https://api.github.com/repos/o/r/issues');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ title: 'T', body: 'B', labels: ['artgen-feedback'] });
    const no = (async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    await expect(openIssue({ title: 'T', body: 'B' }, 'o/r', 'tok', no)).rejects.toThrow(/403.*open the link/);
  });
});

describe('metrics', () => {
  test('the export holds counts and ratios only: no asset id, note or path', () => {
    const root = example('swamp-topdown'), project = { root, art: join(root, 'art') };
    const { file, metrics } = exportMetrics(project, { name: 'swamp', now: new Date('2026-10-29T08:30:00Z') });
    expect(file).toBe(join(root, 'art', 'metrics', `${metrics.artgen}.json`));
    expect(metrics).toMatchObject({ schema: 1, repo: 'swamp', exported: '2026-10-29' });
    expect(metrics.assets.total).toBeGreaterThan(0);
    expect(metrics.assets.approved).toBeGreaterThanOrEqual(0);
    expect(Object.keys(metrics.byKind).length).toBeGreaterThan(0);
    const text = readFileSync(file, 'utf8');
    for (const id of ['leech', 'wisp', 'reeds', 'bog-water']) expect(text).not.toContain(id);
    expect(text).not.toContain(root);
    expect(metrics.firstPassApproval.untouched).toBeLessThanOrEqual(metrics.firstPassApproval.approved);
  });

  test('the repo name is a hash of the folder name unless given', () => {
    const root = example('swamp-topdown');
    expect(metricsOf({ root, art: join(root, 'art') }).repo).toMatch(/^repo-[0-9a-f]{8}$/);
  });

  test('the pool puts two repos side by side per version, and counts a repo once per version', () => {
    const dir = scratch('pool'), a = example('swamp-topdown'), b = example('iso-dungeon');
    exportMetrics({ root: a, art: join(a, 'art') }, { name: 'swamp', out: join(dir, 'a.json'), now: new Date('2026-10-28') });
    exportMetrics({ root: a, art: join(a, 'art') }, { name: 'swamp', out: join(dir, 'a2.json'), now: new Date('2026-10-29') });
    exportMetrics({ root: b, art: join(b, 'art') }, { name: 'iso', out: join(dir, 'b.json') });
    const r = pool([dir]);
    expect(r.repos).toEqual(['iso', 'swamp']);
    expect(r.exports).toBe(2);
    expect(r.versions).toHaveLength(1);
    expect(r.versions[0].repos).toEqual(['iso', 'swamp']);
    expect(poolMarkdown(r)).toContain('2 exports from 2 repos: iso, swamp');
    writeFileSync(join(dir, 'x.json'), '{"schema":9}');
    expect(() => pool([dir])).toThrow('not an artgen metrics export');
  });

  test('the commands: metrics export, then metrics pool over the file it wrote', async () => {
    const root = example('swamp-topdown');
    const e = await cli('metrics', 'export', '--root', root, '--name', 'swamp');
    expect(e.code).toBe(0);
    expect(e.out).toContain('counts and ratios only');
    const p = await cli('metrics', 'pool', join(root, 'art', 'metrics'));
    expect(p.out).toContain('1 exports from 1 repo: swamp');
  });
});

describe('review on the pull request', () => {
  const ids = ['goblin', 'orc', 'bog-water'];
  test('approve, feedback with and without a route, several approvals on a line', () => {
    const r = parseReviewComment('approve goblin\norc: the arms are too long\nbog-water: finish: the edge is too dark\n', ids);
    expect(r.actions).toEqual([
      { type: 'approve', id: 'goblin', note: '' },
      { type: 'feedback', id: 'orc', note: 'the arms are too long' },
      { type: 'feedback', id: 'bog-water', note: 'the edge is too dark', route: 'finish' },
    ]);
    expect(parseReviewComment('approve goblin, orc', ids).actions.map(a => a.id)).toEqual(['goblin', 'orc']);
    expect(parseReviewComment('approve goblin — looks great', ids).actions).toEqual([{ type: 'approve', id: 'goblin', note: 'looks great' }]);
  });
  test('list marks, code ticks and case are forgiven; ids are exact', () => {
    const r = parseReviewComment('- `approve goblin`\n* Approve orc\n1. approve bog-water\n2. thanks!', ids);
    expect(r.actions.map(a => `${a.type} ${a.id}`)).toEqual(['approve goblin', 'approve orc', 'approve bog-water']);
    expect(r.ignored).toEqual(['2. thanks!']);
    expect(parseReviewComment('approve Goblin', ids).unknown).toEqual(['approve Goblin']);
  });
  test('a quoted line is never a command: not a reply\'s quote, not a copy of the instructions', () => {
    const r = parseReviewComment('> approve goblin\n> orc: the arms are too long\n>> approve bog-water\n>\nthanks, looks good', ids);
    expect(r.actions).toEqual([]);
    expect(r.unknown).toEqual([]);
    expect(r.ignored).toEqual(['> approve goblin', '> orc: the arms are too long', '>> approve bog-water', 'thanks, looks good']);
  });
  test('an id that is not under review is reported, never guessed at', () => {
    const r = parseReviewComment('approve gobln\ntroll: too small\napprove goblin, troll', ids);
    expect(r.actions).toEqual([{ type: 'approve', id: 'goblin', note: '' }]);
    expect(r.unknown).toEqual(['approve gobln', 'troll: too small', 'approve troll']);
  });
  test('prepare writes REVIEW.md and says which assets have no review sheet yet', async () => {
    const root = example('swamp-topdown'), project = { root, art: join(root, 'art') };
    // by default only the finals still waiting for approval: the example's assets are all exported
    const none = await prepareReview(project, { now: new Date('2026-10-29') });
    expect(none.items).toEqual([]);
    expect(none.table).toContain('No finished assets are waiting for review.');
    const r = await prepareReview(project, { ids: ['leech', 'wisp'], now: new Date('2026-10-29') });
    expect(existsSync(join(root, 'art', 'review', 'REVIEW.md'))).toBe(true);
    expect(r.table).toContain('Answer in a comment on this pull request');
    expect(r.table).toMatch(/^# Asset review — /m);
    // the example's sheets are not committed, so each is named as missing its sheet
    expect(r.items.map(i => i.id).sort()).toEqual(['leech', 'wisp']);
    // a file of the user's in the folder is left alone by the next prepare
    writeFileSync(join(root, 'art', 'review', 'notes.png'), 'mine');
    await prepareReview(project, { ids: ['leech'] });
    expect(existsSync(join(root, 'art', 'review', 'notes.png'))).toBe(true);
    expect(r.missing.sort()).toEqual(['leech', 'wisp']);
  });
  test('prepare copies the sheet of the final and links it', async () => {
    const root = example('swamp-topdown'), project = { root, art: join(root, 'art') };
    // give the first final asset a review sheet on disk where the ledger says it is
    const first = (await prepareReview(project, { ids: ['leech'] })).items[0];
    const led = readFileSync(join(root, 'art', 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const rv = [...led].reverse().find(e => e.type === 'review' && e.asset === first.id && e.version === first.version);
    expect(rv, 'the example has a review entry for its final').toBeTruthy();
    const sheet = join(root, 'art', String(rv.sheet).split(',')[0]);
    mkdirSync(join(sheet, '..'), { recursive: true });
    writeFileSync(sheet, Buffer.from('89504e470d0a1a0a', 'hex'));
    const r = await prepareReview(project, { ids: ['leech'], base: 'https://github.com/o/r/blob/branch/art/review' });
    const item = r.items.find(i => i.id === first.id)!;
    expect(item.sheet).toBe(`${first.id}-${first.version}.png`);
    expect(existsSync(join(root, 'art', 'review', item.sheet!))).toBe(true);
    expect(r.table).toContain(`![${first.id} ${first.version}](https://github.com/o/r/blob/branch/art/review/${item.sheet})`);
  });
  test('the commands: pr parse and approve/feedback with --via pr', async () => {
    const root = example('swamp-topdown');
    const r = await cli('pr', 'parse', 'approve leech\nreeds: finish: too bright', '--root', root);
    expect(r.out).toBe('approve leech --via pr\nfeedback reeds --route finish --note "too bright" --via pr');
    const bad = await cli('approve', '--help');
    expect(bad.out).toContain('--via');
  });
});
