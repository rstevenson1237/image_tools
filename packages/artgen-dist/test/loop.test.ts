// The feedback loop from the installed files (docs/TOOLING-PLAN.md R4): `artgen report` from a maps-only install, `artgen upstream`
// turning local edits of installed skills and templates into a patch that applies to the sources, the source paths recorded in the
// manifest, and consumer CI (every fixture against the candidate build).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { buildDist } from '../build.mjs';
import { install } from '../src/install.mjs';
import { runConsumerCi, summary } from '../../../scripts/artgen-consumer-ci.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES = join(REPO, 'packages/artgen-cli/fixtures');
const tmp = mkdtempSync(join(tmpdir(), 'artgen-loop-dist-')), OUT = join(tmp, 'out');
const quiet = { log: () => {} };
const sh = (cwd: string, args: string[], input?: string) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', input });
const manifestOf = (game: string) => JSON.parse(readFileSync(join(game, 'tools/artgen/MANIFEST.json'), 'utf8'));
/// a game repo with the given modules installed
function game(modules: string[]): string {
  const dir = mkdtempSync(join(tmp, 'game-'));
  install(dir, { mode: 'init', modules, dist: join(OUT, 'dist'), ...quiet });
  return dir;
}

beforeAll(async () => { await buildDist(OUT, { ui: false }); }, 300_000);

describe('sources', () => {
  test('modules.json says where each copied file comes from, and the manifest keeps it for the files installed', () => {
    const idx = JSON.parse(readFileSync(join(OUT, 'dist/modules.json'), 'utf8')) as { sources: Record<string, string> };
    expect(idx.sources['claude/skills/terrain-map/SKILL.md']).toBe('packages/artgen-dist/content/maps/skills/terrain-map/SKILL.md');
    expect(idx.sources['claude/commands/artgen-review.md']).toBe('packages/artgen-dist/content/art/commands/review.md');
    expect(idx.sources['tools/artgen/templates/topdown/character/base.js']).toBe('packages/artgen-cli/templates/topdown/character/base.js');
    expect(idx.sources['github/workflows/artgen-update.yml']).toBe('packages/artgen-dist/content/update-pr/artgen-update.yml');
    expect(idx.sources['tools/artgen/artgen.js']).toBeUndefined();     // a bundle is built, not copied
    for (const s of Object.values(idx.sources)) expect(existsSync(join(REPO, s)), s).toBe(true);
    const g = game(['maps']), m = manifestOf(g);
    expect(m.sources['.claude/skills/terrain-map/SKILL.md']).toBe(idx.sources['claude/skills/terrain-map/SKILL.md']);
    expect(Object.keys(m.sources).every(f => m.files[f])).toBe(true);
    expect(m.sources['.claude/skills/artgen/SKILL.md']).toBeUndefined();   // the art module is not installed
  });
});

describe('artgen upstream', () => {
  // the sources the patch is applied to: only the files under test, at the paths the manifest names
  const sourceTree = (paths: string[]): string => {
    const dir = mkdtempSync(join(tmp, 'src-'));
    for (const p of paths) { mkdirSync(join(dir, p, '..'), { recursive: true }); cpSync(join(REPO, p), join(dir, p)); }
    return dir;
  };

  test('a skill, a command and a template edited in a game repo become one patch that applies to their sources', () => {
    const g = game(['art', 'maps']), m = manifestOf(g);
    const edit = (rel: string, f: (t: string) => string) => writeFileSync(join(g, rel), f(readFileSync(join(g, rel), 'utf8')));
    edit('.claude/skills/terrain-map/SKILL.md', t => t.replace(/\n$/, '') + '\n\nAlways ask for the scale bar first.\n');
    edit('.claude/commands/artgen-review.md', t => t.replace(/\n$/, '') + '\nThen run `node tools/artgen/artgen.js pr prepare` when the user is on the phone.\n');
    edit('tools/artgen/templates/topdown/character/base.js', t => t + '\n// a comment added in the game repo\n');
    edit('tools/artgen/artgen.js', t => t + '\n// a bundle edited by hand\n');
    const r = sh(g, ['tools/artgen/artgen-maps.js', 'upstream', '--base', OUT, '--json']);
    expect(r.status, r.stderr).toBe(0);
    const j = JSON.parse(r.stdout) as { version: string; out: string; files: { installed: string; source?: string; status: string }[] };
    const by = Object.fromEntries(j.files.map(f => [f.installed, f]));
    expect(by['.claude/skills/terrain-map/SKILL.md']).toMatchObject({ status: 'patch', source: 'packages/artgen-dist/content/maps/skills/terrain-map/SKILL.md' });
    expect(by['.claude/commands/artgen-review.md']).toMatchObject({ status: 'patch', source: 'packages/artgen-dist/content/art/commands/review.md' });
    expect(by['tools/artgen/templates/topdown/character/base.js']).toMatchObject({ status: 'patch' });
    expect(by['tools/artgen/artgen.js']).toMatchObject({ status: 'built' });
    expect(Object.keys(by)).toHaveLength(4);
    expect(j.version).toBe(m.version);
    expect(j.out).toMatch(/\/art\/feedback\/upstream-\d{4}-\d{2}-\d{2}\.patch$/);
    const patch = readFileSync(j.out, 'utf8');
    // the patch is on the sources: {{ARTGEN}} and {{CMD}} are back, a path is the source's
    expect(patch).toContain('--- a/packages/artgen-dist/content/maps/skills/terrain-map/SKILL.md');
    expect(patch).toContain('+Always ask for the scale bar first.');
    expect(patch).not.toContain('node tools/artgen/artgen-maps.js');
    // and it applies to a checkout, giving the edited text with the placeholders still in
    const files = Object.values(by).filter(f => f.status === 'patch').map(f => f.source!);
    const tree = sourceTree(files);
    const apply = spawnSync('git', ['apply', j.out], { cwd: tree, encoding: 'utf8' });
    expect(apply.status, apply.stderr).toBe(0);
    expect(readFileSync(join(tree, 'packages/artgen-dist/content/maps/skills/terrain-map/SKILL.md'), 'utf8')).toContain('Always ask for the scale bar first.');
    expect(readFileSync(join(tree, 'packages/artgen-dist/content/maps/skills/terrain-map/SKILL.md'), 'utf8')).toContain('{{ARTGEN}}');
    expect(readFileSync(join(tree, 'packages/artgen-cli/templates/topdown/character/base.js'), 'utf8')).toContain('// a comment added in the game repo');
    // nothing was changed in the game repo besides the patch
    expect(readFileSync(join(g, '.claude/skills/terrain-map/SKILL.md'), 'utf8')).toContain('Always ask for the scale bar first.');
  });

  test('untouched installs say so, a deleted file is listed, and the text output says how to apply the patch', () => {
    const g = game(['maps']);
    expect(sh(g, ['tools/artgen/artgen-maps.js', 'upstream', '--base', OUT]).stdout).toContain('no installed file is edited');
    const f = join(g, '.claude/commands/artgen-map.md');
    writeFileSync(f, readFileSync(f, 'utf8') + 'one more line\n');
    const r = sh(g, ['tools/artgen/artgen-maps.js', 'upstream', '--base', OUT, '--out', join(g, 'mine.patch')]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/patch +\.claude\/commands\/artgen-map\.md -> packages\/artgen-dist\/content\/maps\/commands\/map\.md/);
    expect(r.stdout).toContain('git apply');
    expect(existsSync(join(g, 'mine.patch'))).toBe(true);
  });

  test('an install that does not record its sources is told to update once; without the base nothing is invented', () => {
    const g = game(['maps']), mf = join(g, 'tools/artgen/MANIFEST.json'), m = manifestOf(g);
    delete m.sources;
    writeFileSync(mf, JSON.stringify(m));
    const r = sh(g, ['tools/artgen/artgen-maps.js', 'upstream']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('does not record where its files come from');
  });

  test('a base that is not at the installed version is flagged, not trusted', () => {
    const g = game(['maps']), f = join(g, '.claude/commands/artgen-map.md');
    const other = mkdtempSync(join(tmp, 'base-'));
    cpSync(join(OUT, 'dist'), join(other, 'dist'), { recursive: true });
    writeFileSync(join(other, 'dist/claude/commands/artgen-map.md'), readFileSync(join(other, 'dist/claude/commands/artgen-map.md'), 'utf8') + 'a line from another release\n');
    writeFileSync(f, readFileSync(f, 'utf8') + 'my line\n');
    const j = JSON.parse(sh(g, ['tools/artgen/artgen-maps.js', 'upstream', '--base', other, '--json']).stdout);
    expect(j.files[0].note).toContain('the base is not the file as installed');
  });
});

describe('artgen report from a maps-only install', () => {
  test('the maps-only bundle has report and upstream, and writes the bundle of a dungeon without the pixel-art pipeline', () => {
    const g = game(['maps']);
    expect(sh(g, ['tools/artgen/artgen-maps.js', '--help']).stdout).toMatch(/artgen report <id>[\s\S]*artgen upstream/);
    mkdirSync(join(g, 'art/dungeons/warren'), { recursive: true });
    cpSync(join(FIXTURES, 'setting-builder/warren/dungeon.json'), join(g, 'art/dungeons/warren/dungeon.json'));
    expect(existsSync(join(g, 'art/artgen.config.json'))).toBe(true);   // a project, so the id is found
    const r = sh(g, ['tools/artgen/artgen-maps.js', 'report', 'warren', '--note', 'doors', '--json']);
    expect(r.status, r.stderr).toBe(0);
    const j = JSON.parse(r.stdout) as { dir: string; kind: string; files: string[]; link: string };
    expect(j.kind).toBe('dungeon');
    expect(j.files).toEqual(expect.arrayContaining(['dungeon.json', 'dungeon.svg', 'dungeon.png', 'case.md', 'ISSUE.md', 'report.json']));
    // the bundle names the install it was made with
    expect(JSON.parse(readFileSync(join(j.dir, 'report.json'), 'utf8'))).toMatchObject({ id: 'warren', kind: 'dungeon', installed: manifestOf(g).modules.core });
    expect(readdirSync(join(g, 'art/feedback'))).toHaveLength(1);
  });
});

describe('consumer CI', () => {
  test('every fixture passes against the candidate build', () => {
    const r = runConsumerCi(OUT, FIXTURES);
    expect(r.results.length).toBeGreaterThanOrEqual(9);
    expect(r.results.filter((x: { ok: boolean }) => !x.ok), summary(r, OUT)).toEqual([]);
    expect(summary(r, OUT)).toContain('9 of 9 pass');
  });

  test('a regression stops it: a case that must go on passing and is refused, or one that must go on failing and is accepted', () => {
    const fixtures = mkdtempSync(join(tmp, 'fixtures-'));
    cpSync(join(FIXTURES, 'setting-builder/warren'), join(fixtures, 'c/passes-no-more'), { recursive: true });
    cpSync(join(FIXTURES, 'setting-builder/warren'), join(fixtures, 'c/fails-no-more'), { recursive: true });
    const broken = JSON.parse(readFileSync(join(FIXTURES, 'setting-builder/bad-file/dungeon.json'), 'utf8'));
    writeFileSync(join(fixtures, 'c/passes-no-more/dungeon.json'), JSON.stringify(broken));                         // case.md says it passes; the build refuses it
    writeFileSync(join(fixtures, 'c/fails-no-more/case.md'), readFileSync(join(fixtures, 'c/fails-no-more/case.md'), 'utf8') + '\n## Must go on failing\n\n- check exits non-zero\n');   // case.md says it fails; the build accepts it
    const r = runConsumerCi(OUT, fixtures) as { results: { id: string; ok: boolean; detail: string }[]; failed: number };
    expect(r.failed).toBe(2);
    expect(r.results.find(x => x.id === 'c/passes-no-more')!.detail).toContain('must go on passing');
    expect(r.results.find(x => x.id === 'c/fails-no-more')!.detail).toContain('must go on failing');
    expect(sh(REPO, ['scripts/artgen-consumer-ci.mjs', '--dist', OUT, '--fixtures', fixtures]).status).toBe(1);
  });

  test('an asset bundle from a report is rendered by the full CLI in a scratch project', () => {
    const fixtures = mkdtempSync(join(tmp, 'fixtures-')), c = join(fixtures, 'c/leech');
    const art = join(REPO, 'examples/swamp-topdown/art');
    mkdirSync(c, { recursive: true });
    for (const f of ['direction.json', 'briefs.yaml', 'artgen.config.json', 'ledger.jsonl']) cpSync(join(art, f), join(c, f));
    cpSync(join(art, 'assets/creature/leech'), join(c, 'asset'), { recursive: true });
    writeFileSync(join(c, 'case.md'), '# leech\n\nkind: asset\nasset: assets/creature/leech\n');
    const r = runConsumerCi(OUT, fixtures) as { results: { id: string; ok: boolean; detail: string }[] };
    expect(r.results, JSON.stringify(r.results)).toEqual([{ id: 'c/leech', ok: true, detail: expect.stringMatching(/^render exit [01]$/) }]);
  });
});
