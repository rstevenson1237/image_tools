// P7: parallel make (maker packets per asset, the ledger as the one shared write, concurrent appends stay whole lines)
// and analytics v2 (pooled recommendations across the fixture projects, --apply into a project's config).
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { parseLedger } from 'artgen-core';
import { main } from './cli.ts';
import { readJson } from './project.ts';
import { ledgerSet } from './w2.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, '..', '..', '..'), BIN = join(HERE, 'bin.ts');
const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
/** A separate node process, like a maker subagent's shell. */
const proc = (args: string[], cwd: string) => new Promise<{ code: number | null; out: string }>(res => {
  const c = spawn(process.execPath, args, { cwd }); let out = '';
  c.stdout.on('data', b => (out += b)); c.stderr.on('data', b => (out += b)); c.on('close', code => res({ code, out }));
});
afterEach(() => vi.restoreAllMocks());

describe('parallel make (P7)', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-p7-')), R = ['--root', root];
  const ledger = () => parseLedger(readFileSync(join(root, 'art', 'ledger.jsonl'), 'utf8'));

  beforeAll(async () => {
    await run('init', ...R);
    await run('direction', 'candidates', '--pitch', 'grim swamp roguelike with bog goblins', '--view', 'topdown', ...R);
    await run('direction', 'lock', 'a', ...R);
    await run('brief', 'add', 'goblin', '--kind', 'character', ...R);
    for (const id of ['crate', 'reed', 'stump']) await run('brief', 'add', id, '--kind', 'prop', ...R);
  }, 60_000);

  test('a round: makers review their own assets concurrently, the ledger takes every line, the next round asks for v2', async () => {
    const m = await json('make', '--parallel', '3', ...R);
    expect(m.work.makers.map((x: { id: string }) => x.id)).toEqual(['goblin', 'crate', 'reed']);
    expect(m.work.queued.map((x: { id: string }) => x.id)).toEqual(['stump']);
    expect(m.work.makers.every((x: { owns: string; writes: string[] }) => x.writes.every(w => w.startsWith(`${x.owns}/`)))).toBe(true);
    expect((await run('make', '--parallel', '3', ...R)).out).toMatch(/parallel round: 3 maker subagent\(s\)[\s\S]*queued for the next round \(1\)/);

    // the makers (separate processes, at once) render and review their asset; each review appends one ledger line
    const before = ledger().length;
    const rs = await Promise.all(m.work.makers.map((x: { id: string }) => proc([BIN, 'review', x.id, ...R], root)));
    for (const r of rs) expect(r.code, r.out).toBe(0);
    const added = ledger().slice(before);
    expect(added.map(e => `${e.type} ${e.asset}`).sort()).toEqual(['review crate', 'review goblin', 'review reed']);

    // the main agent scores (from a fresh reviewer); the next round's makers write v2
    for (const x of m.work.makers) await run('score', x.id, 'base.v1', '5', '--reviewer', 'art-reviewer', ...R);
    const m2 = await json('make', '--parallel', '4', ...R);
    expect(m2.work.makers.map((x: { id: string; step: { version: string } }) => `${x.id} ${x.step.version}`)).toEqual(['goblin base.v2', 'crate base.v2', 'reed base.v2', 'stump base.v1']);
    expect(m2.work.makers[0].writes).toEqual(['art/assets/character/goblin/base.v2.js']);
  }, 60_000);

  test('concurrent ledger appends from many processes stay whole lines', async () => {
    const f = join(mkdtempSync(join(tmpdir(), 'artgen-ledger-')), 'ledger.jsonl'), node = join(HERE, 'node.ts');
    const script = `import { appendLedger } from ${JSON.stringify(node)};
      const note = 'x'.repeat(3000);
      for (let i = 0; i < 150; i++) appendLedger(${JSON.stringify(f)}, { type: 'note', asset: 'p' + process.argv[1], note, i, by: 'agent' });`;
    const rs = await Promise.all(Array.from({ length: 6 }, (_, k) => proc(['--input-type=module', '-e', script, String(k)], REPO)));
    for (const r of rs) expect(r.code, r.out).toBe(0);
    const lines = readFileSync(f, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(900);
    const es = lines.map(l => JSON.parse(l) as { asset: string; i: number });
    for (let k = 0; k < 6; k++) expect(es.filter(e => e.asset === `p${k}`).map(e => e.i)).toEqual(Array.from({ length: 150 }, (_, i) => i));
  }, 60_000);
});

describe('analytics v2 across the fixture projects (P7)', () => {
  const fixtures = ['swamp-topdown', 'iso-dungeon', 'billboard-crawler'].map(n => join(REPO, 'examples', n));

  test('ledger sets: projects and a bench folder', () => {
    const s = ledgerSet(fixtures[0]);
    expect(s.metas.length).toBeGreaterThanOrEqual(10);
    expect(s.config?.budget.revisionPasses).toBe(3);
    const b = ledgerSet(join(REPO, 'packages/artgen-core/bench/p6'));
    expect(b.metas.find(m => m.id === 'brick-wall')?.kind).toBeTruthy();
    expect(() => ledgerSet(tmpdir())).toThrow(/neither a project/);
  });

  test('--across pools the fixtures; --apply merges the patch into this project\'s config only', async () => {
    const root = mkdtempSync(join(tmpdir(), 'artgen-p7-apply-'));
    cpSync(join(fixtures[1], 'art'), join(root, 'art'), { recursive: true });
    const before = readJson<Record<string, unknown>>(join(root, 'art', 'artgen.config.json'));
    const r = await json('analytics', '--across', fixtures.join(','), '--apply', '--root', root);
    expect(r.projects).toHaveLength(3);
    expect(r.kinds.map((k: { kind: string }) => k.kind)).toEqual(expect.arrayContaining(['character', 'prop']));
    expect(r.applied).toBe('art/artgen.config.json');
    const after = readJson<{ budget: { perKind?: Record<string, unknown>; revisionPasses: number }; export: unknown; models: unknown }>(join(root, 'art', 'artgen.config.json'));
    expect(after.budget.perKind).toEqual(r.patch.budget.perKind);
    expect(Object.keys(after.budget.perKind ?? {}).length).toBeGreaterThan(0);
    expect(after.budget.revisionPasses).toBe(3);
    expect(after.export).toEqual(before.export);
    // the fixtures themselves are untouched
    expect(readJson<{ budget: { perKind?: unknown } }>(join(fixtures[1], 'art', 'artgen.config.json')).budget.perKind).toBeUndefined();
    expect((await run('analytics', '--across', fixtures[0])).out).toMatch(/## Revision passes by kind[\s\S]*## Config patch/);
  }, 60_000);
});
