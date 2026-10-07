// Review independence and roster review on disk (rev 9, findings/calibration.md): every score names its reviewer; a
// blind re-score of the final by a fresh reviewer gates `final` (a miss spends the extra revision); the gallery and
// `approve` say when the score is the maker's own or the blind one disagrees; brief heights flag off-scale bodies;
// `roster` writes the lineup + shuffled silhouettes and `roster record` turns a review into per-asset open issues.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { decodePNG, parseLedger } from 'artgen-core';
import { main } from './cli.ts';
import { readJson } from './project.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
afterEach(() => vi.restoreAllMocks());

describe('rev 9: blind re-score, reviewer records, heights, roster', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-rev9-')), R = ['--root', root];
  const art = (...p: string[]) => join(root, 'art', ...p);
  const ledger = () => parseLedger(readFileSync(art('ledger.jsonl'), 'utf8'));

  /** Like the agent: write what the pass machine asks for; own scores from `own`, blind ones from `blind`. */
  async function drive(id: string, own: number[], blind: number[], reviewer = 'art-reviewer') {
    for (let guard = 0; guard < 16; guard++) {
      const m = await json('make', id, ...R), step = m.next?.step;
      if (!step) return m;
      const dir = join(root, m.next.path);
      if (step.action === 'write-base' && step.version !== 'base.v1') writeFileSync(join(dir, `${step.version}.js`), `// ${step.version} (${step.pass})\n${readFileSync(join(dir, `${step.from}.js`), 'utf8')}`);
      else if (step.action === 'write-finish') await run('finish', dir, '--base', step.base, ...R);
      else if (step.action === 'review') { await run('review', id, '--version', step.version, ...R); await run('score', id, step.version, String(own.shift() ?? 6.5), '--reviewer', reviewer, ...R); }
      else if (step.action === 'blind-review') {
        await run('review', id, '--version', step.version, '--blind', ...R);
        await run('score', id, step.version, String(blind.shift() ?? 6.5), '--blind', '--reviewer', 'fresh', '--note', 'reads as a crate, not a barrel', ...R);
      }
    }
    throw new Error('drive: no progress');
  }

  beforeAll(async () => {
    await run('init', ...R);
    await run('direction', 'candidates', '--pitch', 'Damp crypt crawler: knights, barrels and torchlight.', ...R);
    await run('direction', 'lock', 'a', ...R);
    await run('brief', 'add', 'barrel', '--kind', 'prop', '--height', '1', '--notes', 'oak barrel, iron hoops', ...R);
    await run('brief', 'add', 'hero', '--kind', 'character', '--height', '1.8', '--notes', 'knight with a kettle helm', ...R);
  }, 60_000);

  test('a blind miss spends the extra revision, then stays an open issue; blind scores need a blind sheet and a named reviewer', async () => {
    // own scores 5, 6.5, 6, finish 7; the blind reviewer says 4.5 → x1 (scored 6, below the best) → still 4.5 on the same final
    const m = await drive('barrel', [5, 6.5, 6, 7, 6], [4.5]);
    expect(m.rows.find((r: { id: string }) => r.id === 'barrel')).toMatchObject({ status: 'final', final: 'finish.v1', score: 7, issues: ['blind re-score 4.5 vs 7 (gap 2.5): reads as a crate, not a barrel'] });
    const sc = ledger().filter(e => e.asset === 'barrel' && e.type === 'score');
    expect(sc.map(e => [e.pass, e.reviewer, !!e.blind])).toEqual([['r1', 'art-reviewer', false], ['r2', 'art-reviewer', false], ['r3', 'art-reviewer', false], ['f', 'art-reviewer', false], ['b', 'fresh', true], ['x1', 'art-reviewer', false]]);
    expect(sc[4]).toMatchObject({ version: 'finish.v1', score: 4.5, gap: 2.5 });
    // the blind sheet is the final alone: one row, no earlier versions
    const rv = ledger().find(e => e.type === 'review' && e.blind)!;
    expect(String(rv.sheet)).toMatch(/review-finish\.v1-blind\.png$/);
    expect(decodePNG(new Uint8Array(readFileSync(art(String(rv.sheet))))).h).toBeLessThan(decodePNG(new Uint8Array(readFileSync(art('assets/prop/barrel/out/review-finish.v1.png')))).h);
    await expect(run('score', 'barrel', 'finish.v1', '7', '--blind', ...R)).rejects.toThrow(/--blind needs --reviewer/);
    await expect(run('score', 'barrel', 'base.v2', '7', '--blind', '--reviewer', 'x', ...R)).rejects.toThrow(/no blind sheet yet/);
  }, 120_000);

  test('a self-scored hero: the gallery marks SELF until the blind score, approve says what the score behind it was', async () => {
    await drive('hero', [6, 6.5, 7, 7], [7], 'self');
    const g = await json('gallery', ...R);
    expect(g.assets).toEqual([
      expect.objectContaining({ id: 'barrel', score: 7, blind: 4.5, reviewer: 'art-reviewer' }),
      expect.objectContaining({ id: 'hero', score: 7, blind: 7, reviewer: 'self' }),
    ]);
    const a = await json('approve', 'barrel', ...R);
    expect(a.warnings).toEqual(['blind re-score 4.5 vs 7 (gap 2.5): reads as a crate, not a barrel']);
    expect((await json('approve', 'hero', ...R)).warnings).toBeUndefined();
    // the height check reports on every render (flag only): template bodies are drawn to fill their frames
    const st = await json('pass', 'status', 'barrel', ...R);
    expect(st.next.action).toBe('ready');
    const score = ledger().filter(e => e.asset === 'barrel' && e.type === 'score').pop()!;
    expect(score.conformance!.checks.find(c => c.id === 'height')).toMatchObject({ status: expect.stringMatching(/pass|flag/), detail: expect.stringMatching(/px expected for 1 m/) });
  }, 120_000);

  test('roster: lineup + shuffled silhouettes for a fresh reviewer; its review becomes open issues on those finals', async () => {
    const r = await json('roster', ...R);
    expect(r.sizes.map((x: { id: string; height: number }) => [x.id, x.height])).toEqual([['barrel', 1], ['hero', 1.8]]);
    expect(r.pairs).toHaveLength(1);
    for (const f of [r.lineup, r.silhouettes]) expect(existsSync(join(root, f))).toBe(true);
    // the reviewer gets the sheets and the alphabetical asset list; the letter key stays in the ledger
    expect(readJson<{ lineup: string[]; assets: { id: string; height: number }[] }>(join(root, r.assets))).toMatchObject({ lineup: ['barrel', 'hero'], assets: [{ id: 'barrel', height: 1 }, { id: 'hero', height: 1.8 }] });
    const key = ledger().filter(e => e.type === 'roster' && e.key).pop()!.key as Record<string, string>, letter = (id: string) => Object.keys(key).find(k => key[k] === id)!;
    writeFileSync(join(root, 'roster-review.json'), JSON.stringify({
      silhouettes: [{ letter: letter('barrel'), guess: 'a door or a coffin', readability: 2 }, { letter: letter('hero'), guess: 'a knight', readability: 4 }],
      lineup: [{ id: 'barrel', scale: 'too big', scaleNote: 'as tall as the hero', issues: [] }, { id: 'hero', scale: 'ok' }],
      notes: ['the brazier outshines the torch'],
    }));
    const rec = await json('roster', 'record', join(root, 'roster-review.json'), '--reviewer', 'art-reviewer', ...R);
    expect(rec.issues).toEqual({ barrel: ['silhouette reads as "a door or a coffin" (2/5)', 'lineup: too big — as tall as the hero'] });
    const rows = await json('status', ...R);
    expect(rows.find((x: { id: string }) => x.id === 'barrel').issues).toEqual(expect.arrayContaining(['lineup: too big — as tall as the hero']));
    expect(rows.find((x: { id: string }) => x.id === 'hero').issues).toEqual([]);
    // a new roster round reshuffles
    expect((await json('roster', ...R)).seed).toBe(2);
  }, 120_000);

  test('analytics: who scored, and the blind gaps', async () => {
    const a = await json('analytics', ...R);
    expect(a.review.byReviewer).toEqual({ 'art-reviewer': 5, self: 4 });
    expect(a.review.blind).toMatchObject({ n: 2, over1: 1 });
  });
});
