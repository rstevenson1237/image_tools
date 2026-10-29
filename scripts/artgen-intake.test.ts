// The intake script: a feedback bundle (artgen report) or the issue it opened becomes a consumer fixture.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { writeBundle } from '../packages/artgen-cli/src/loop/feedback-bundle.ts';
import { dungeonFile } from '../packages/artgen-cli/src/dungeon.ts';
import { initProject } from '../packages/artgen-cli/src/project.ts';
// @ts-expect-error plain .mjs script, no declarations
import { addToReadme, consumerDir, parseCase, parseIssueBody, writeCase } from './artgen-intake.mjs';

const FIXTURES = join(import.meta.dirname, '..', 'packages/artgen-cli/fixtures/setting-builder');
const scratch = (n: string) => mkdtempSync(join(tmpdir(), `artgen-intake-${n}-`));

/// a git checkout holding the warren dungeon as a project, so the bundle can name a consumer commit
async function reported(note = 'the doors draw on the corridor') {
  const root = scratch('consumer'), { project } = initProject(root), file = dungeonFile(project, 'warren');
  mkdirSync(join(file, '..'), { recursive: true });
  cpSync(join(FIXTURES, 'warren', 'dungeon.json'), file);
  const git = (...a: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: root, encoding: 'utf8' });
  git('init', '-q'); git('remote', 'add', 'origin', 'https://github.com/rstevenson1237/setting_builder.git'); git('add', '.'); git('commit', '-qm', 'x');
  const sha = git('rev-parse', 'HEAD').stdout.trim();
  return { sha, bundle: await writeBundle(project, 'warren', { note, noRender: true, now: new Date('2026-10-29') }) };
}

describe('parsing', () => {
  test('the consumer folder is the repo name in kebab case', () => {
    expect(consumerDir('rstevenson1237/setting_builder')).toBe('setting-builder');
    expect(consumerDir(undefined)).toBe('');
  });
  test('case.md is read for its kind, format, consumer and commit', async () => {
    const { sha, bundle } = await reported();
    expect(parseCase(readFileSync(join(bundle.dir, 'case.md'), 'utf8'))).toMatchObject({ id: 'warren', kind: 'dungeon', format: 1, consumer: 'rstevenson1237/setting_builder', commit: sha });
  });
  test('the issue body splits into the case and the inline input', async () => {
    const { bundle } = await reported();
    const r = parseIssueBody(bundle.body);
    expect(r.input!.name).toBe('dungeon.json');
    expect(JSON.parse(r.input!.text)).toEqual(JSON.parse(readFileSync(join(FIXTURES, 'warren', 'dungeon.json'), 'utf8')));
    expect(r.caseMd).toContain('format: dungeon 1');
    expect(r.caseMd).not.toContain('artgen:input');
  });
  test('the input file\'s name is one of the three fixture names, whatever the issue says (it is written to disk)', () => {
    const r = parseIssueBody('case\n\n<!-- artgen:input ../../../etc/evil.json -->\n```json\n{}\n```\n');
    expect(r.input).toBeUndefined();
  });
  test('an attached file is found by its link', () => {
    const r = parseIssueBody('case\n\n[map.json](https://github.com/user-attachments/files/123/map.json)\n');
    expect(r.input).toBeUndefined();
    expect(r.attached).toEqual(['https://github.com/user-attachments/files/123/map.json']);
  });
  test('the README row gains the case once', () => {
    const t = '| Consumer | Cases |\n|---|---|\n| `setting-builder/` | `warren`, `ravine` |\n';
    expect(addToReadme(t, 'setting-builder', 'keep')).toContain('`warren`, `ravine`, `keep` |');
    expect(addToReadme(addToReadme(t, 'setting-builder', 'keep'), 'setting-builder', 'keep').match(/`keep`/g)).toHaveLength(1);
    expect(addToReadme(t, 'other', 'x')).toBe(t);
  });
});

describe('writeCase', () => {
  test('a bundle becomes a case with the input file, case.md marked as reported, and a README row', async () => {
    const { bundle } = await reported(), fixtures = scratch('fixtures');
    mkdirSync(join(fixtures, 'setting-builder'), { recursive: true });
    writeFileSync(join(fixtures, 'setting-builder', 'README.md'), '| Consumer | Cases |\n|---|---|\n| `setting-builder/` | `warren` |\n');
    const { caseMd, input } = parseIssueBody(bundle.body);
    const dir = writeCase({ consumer: 'setting-builder', name: 'doors', caseMd, files: { [input.name]: input.text }, issue: 'o/r#9', fixtures });
    expect(dir).toBe(join(fixtures, 'setting-builder', 'doors'));
    const md = readFileSync(join(dir, 'case.md'), 'utf8');
    expect(md).toMatch(/^format: dungeon 1\nstatus: reported — /m);
    expect(md).toMatch(/^intake: o\/r#9$/m);
    expect(md).toMatch(/\b[0-9a-f]{40}\b/);                       // what fixtures.test.ts requires of a case
    expect(readFileSync(join(dir, 'dungeon.json'), 'utf8')).toBe(input.text);
    expect(readFileSync(join(fixtures, 'setting-builder', 'README.md'), 'utf8')).toContain('`warren`, `doors`');
  });
  test('an existing case is never overwritten without --force', async () => {
    const { bundle } = await reported(), fixtures = scratch('fixtures'), { caseMd, input } = parseIssueBody(bundle.body);
    const o = { consumer: 'c', name: 'n', caseMd, files: { [input.name]: input.text }, fixtures };
    writeCase(o);
    expect(() => writeCase(o)).toThrow('a fixture changes only through a brief from its consumer');
    expect(() => writeCase({ ...o, force: true })).not.toThrow();
  });
  test('a report with no consumer commit is refused: a fixture names the commit it came from', async () => {
    const root = scratch('nogit'), { project } = initProject(root), file = dungeonFile(project, 'warren');
    mkdirSync(join(file, '..'), { recursive: true });
    cpSync(join(FIXTURES, 'warren', 'dungeon.json'), file);
    const b = await writeBundle(project, 'warren', { noRender: true });
    expect(() => writeCase({ consumer: 'c', name: 'n', caseMd: parseIssueBody(b.body).caseMd, files: {}, fixtures: scratch('f') })).toThrow('names no consumer commit');
  });
  test('--dry-run writes nothing', async () => {
    const { bundle } = await reported(), fixtures = scratch('fixtures');
    const dir = writeCase({ consumer: 'c', name: 'n', caseMd: parseIssueBody(bundle.body).caseMd, files: {}, fixtures, dryRun: true });
    expect(existsSync(dir)).toBe(false);
  });
});

describe('the command line', () => {
  test('a consumer or case name with a path in it is refused', async () => {
    const { bundle } = await reported();
    const r = spawnSync(process.execPath, [join(import.meta.dirname, 'artgen-intake.mjs'), '--bundle', bundle.dir, '--consumer', '../x', '--case', 'a', '--dry-run'], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('lower-case letters, digits and -');
  });
  test('--bundle copies the input file; the new fixture is then held to the minimum by the fixture tests', async () => {
    const { bundle } = await reported();
    const r = spawnSync(process.execPath, [join(import.meta.dirname, 'artgen-intake.mjs'), '--bundle', bundle.dir, '--consumer', 'zz-intake-test', '--case', 'doors', '--dry-run'], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('would write');
    expect(existsSync(join(FIXTURES, '..', 'zz-intake-test'))).toBe(false);
  });
});
