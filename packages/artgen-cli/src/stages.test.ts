// Stages on disk (docs/STAGES.md §5): the placeholder, `export --placeholders`, the stage commands, the shape sheet,
// the gate flow end to end (brief → placeholder gate → v1 → shape gate → reject → v2 → approve → v3 → finish → ready),
// and a palette-only restyle that keeps every stage before `decorate`.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { assetStatus, decodePNG, defaultPlaceholder, imageTokens, parseLedger, type AnimContract, type LedgerEntry, type PackManifest } from 'artgen-core';
import { openAsset, passState } from './asset.ts';
import { main } from './cli.ts';
import { readJson, writeJson } from './project.ts';
import { parseReviewComment } from './loop/pr-review.ts';
import { findTemplate } from './templates.ts';
import { templateFor } from './w2.ts';
import { lockedDirection } from './w1.ts';
import { RUNTIME_VERSION } from 'artgen-runtime';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
afterEach(() => vi.restoreAllMocks());

describe('stages in a scratch game repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-stages-')), R = ['--root', root];
  const art = (...p: string[]) => join(root, 'art', ...p);
  const ledger = () => parseLedger(readFileSync(art('ledger.jsonl'), 'utf8'));
  const goblin = art('assets', 'character', 'goblin');

  /** Write the next version the pass machine asks for, review and score it; at a gate, `answer` decides what the user says. */
  async function step(id: string, answer: (g: { stage: string; version?: string }) => string[] | undefined) {
    const m = await json('make', id, ...R), s = m.next?.step;
    if (!s) return m;
    const dir = join(root, m.next.path);
    if (s.action === 'write-base' && s.version !== 'base.v1') writeFileSync(join(dir, `${s.version}.js`), `// ${s.version} from ${s.from}\n${readFileSync(join(dir, `${s.from}.js`), 'utf8')}`);
    else if (s.action === 'write-finish') await run('finish', dir, '--base', s.base, ...R);
    else if (s.action === 'review') { await run('review', id, '--version', s.version, ...R); await run('score', id, s.version, '7', '--note', 'test', '--reviewer', 'art-reviewer', ...R); }
    else if (s.action === 'blind-review') { await run('review', id, '--version', s.version, '--blind', ...R); await run('score', id, s.version, '7', '--blind', '--reviewer', 'fresh', ...R); }
    else if (s.action === 'stage-gate') {
      const a = answer(s);
      if (!a) throw new Error(`stopped at ${s.stage} gate`);
      await run(...a, ...R);
    }
    return m;
  }

  beforeAll(async () => {
    await run('init', ...R);
    await run('direction', 'candidates', '--pitch', 'Grim swamp roguelike: bog goblins and leeches in the fog.', '--view', 'iso', ...R);
    await run('direction', 'lock', 'a', ...R);
  }, 60_000);

  test('init gates the shape of characters and creatures; briefs take their own gates', async () => {
    const cfg = readJson<{ review: { gates: unknown } }>(art('artgen.config.json'));
    expect(cfg.review.gates).toEqual({ character: ['shape'], creature: ['shape'] });
    await expect(run('brief', 'add', 'bad', '--kind', 'prop', '--gates', 'colour', ...R)).rejects.toThrow(/gates must be a list of placeholder, shape/);
    const g = await json('brief', 'add', 'goblin', '--kind', 'character', '--directions', '4', '--anims', 'walk:2', '--gates', 'placeholder,shape', ...R);
    expect(g.brief).toMatchObject({ gates: ['placeholder', 'shape'] });
    await run('brief', 'add', 'crate', '--kind', 'prop', '--height', '1', ...R);
    await run('brief', 'add', 'orc', '--kind', 'character', ...R);
    expect(readFileSync(art('briefs.yaml'), 'utf8')).toContain('gates:');
  });

  test('a placeholder gate holds the first base: nothing is scaffolded, status and make say so', async () => {
    const m = await json('make', 'goblin', ...R);
    expect(m.scaffolded).toEqual([]);
    expect(existsSync(join(goblin, 'base.v1.js'))).toBe(false);
    expect(m.next).toMatchObject({ id: 'goblin', step: { action: 'stage-gate', stage: 'placeholder', pass: 'g' } });
    const st = (await json('status', 'goblin', ...R))[0];
    expect(st).toMatchObject({ status: 'in-pipeline', next: { action: 'stage-gate' } });
    expect(st.why).toMatch(/waiting for the user: write the placeholder.*artgen stage approve goblin placeholder/);
    expect((await run('status', 'goblin', ...R)).out).toMatch(/goblin\s+in-pipeline\s+stage-gate placeholder/);
    // the main session's step with the user, never a maker's
    const par = await json('make', 'goblin', '--parallel', '2', ...R);
    expect(par.work.makers).toEqual([]); expect(par.work.main.map((x: { id: string; role: string }) => [x.id, x.role])).toEqual([['goblin', 'main']]);
  });

  test('placeholder: writes placeholder.json and out/placeholder.png from the brief, checks them, refuses to overwrite', async () => {
    const r = await run('placeholder', 'goblin', ...R);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/ph-size\s+pass[\s\S]*ph-ramp\s+pass[\s\S]*artgen stage approve goblin placeholder/);
    const ph = readJson<{ size: number[]; pivot: number[]; body: { h: number }; ramp: string; anchors: object }>(join(goblin, 'placeholder.json'));
    expect(ph).toMatchObject({ format: 1, size: [24, 32], pivot: [12, 31], ramp: 'cloth' });
    expect(Object.keys(ph.anchors)).toEqual(['head', 'hand']);
    expect(existsSync(join(goblin, 'brief.json'))).toBe(true);
    const png = decodePNG(new Uint8Array(readFileSync(join(goblin, 'out', 'placeholder.png'))));
    expect(png.w).toBe(24 * 4 * 12); // 4 facings × (1 idle + 2 walk) cells at the review scale
    expect(existsSync(join(goblin, 'base.v1.js'))).toBe(false);
    const written = ledger().filter(e => e.type === 'stage' && e.stage === 'placeholder');
    expect(written).toHaveLength(1); expect(written[0]).toMatchObject({ event: 'written', by: 'agent' }); expect(written[0].verdict).toBeUndefined();
    await expect(run('placeholder', 'goblin', ...R)).rejects.toThrow(/placeholder\.json exists — pass --force/);
    // a bad size fails a check and the exit code says so; --pivot and --ramp override single fields
    const bad = await run('placeholder', 'goblin', '--force', '--size', '40x40', ...R);
    expect(bad.code).toBe(1); expect(bad.out).toMatch(/ph-size\s+fail/);
    await expect(run('stage', 'approve', 'goblin', 'placeholder', ...R)).rejects.toThrow(/the placeholder checks fail \(ph-size/);
    const forced = await json('stage', 'approve', 'goblin', 'placeholder', '--force', '--note', 'ok for now', ...R);
    expect(forced).toMatchObject({ stage: 'placeholder', verdict: 'approve', forced: true, by: 'user' });
    const ok = await run('placeholder', 'goblin', '--force', '--pivot', '12,30', '--ramp', 'skin', ...R);
    expect(ok.code).toBe(0);
    expect(readJson<{ pivot: number[]; ramp: string }>(join(goblin, 'placeholder.json'))).toMatchObject({ pivot: [12, 30], ramp: 'skin' });
    await expect(run('placeholder', 'goblin', '--force', '--pivot', '1', ...R)).rejects.toThrow(/--pivot/);
  });

  test('export --placeholders: the game runs with it from day one; status does not move; real art replaces it later', async () => {
    // before the flag: nothing to export
    expect((await run('export', ...R)).out).toMatch(/nothing approved to export yet/);
    const ex = await json('export', '--placeholders', ...R);
    expect(ex.packs[0]).toMatchObject({ pack: 'main', assets: ['goblin', 'crate', 'orc'], placeholders: ['crate', 'goblin', 'orc'] });
    expect(ex.skipped).toEqual([]);
    const m = readJson<PackManifest>(join(root, 'public/assets/main/pack.json'));
    expect(m.placeholders).toEqual(['crate', 'goblin', 'orc']);
    expect(m.runtime).toBe(RUNTIME_VERSION); expect(RUNTIME_VERSION).toBe('1.3.0');
    expect(m.assets.goblin).toMatchObject({ placeholder: true, version: 'placeholder', directions: 4, facings: ['s', 'w', 'n', 'e'] });
    expect(m.assets.goblin.sourceHash).toMatch(/^[0-9a-f]{8}$/);
    expect(Object.keys(m.assets.goblin.states)).toEqual(['idle', 'walk']);
    expect(Object.keys(m.assets.goblin.anchors!)).toEqual(['hand', 'head']);
    expect(m.assets.crate.anchors).toBeUndefined();
    // the contract is written as for any export, so game code written against the placeholder keeps working
    expect(readJson<AnimContract>(art('contracts', 'goblin.json'))).toMatchObject({ asset: 'goblin', facings: ['s', 'w', 'n', 'e'], anchors: ['hand', 'head'], states: { walk: { frames: 2 } } });
    const e = ledger().filter(x => x.type === 'export' && x.asset === 'goblin');
    expect(e).toEqual([expect.objectContaining({ version: 'placeholder', placeholder: true, pack: 'main' })]);
    // the asset's status is untouched
    const st = await json('status', ...R);
    expect(st.map((r: { id: string; status: string }) => [r.id, r.status])).toEqual([['goblin', 'in-pipeline'], ['crate', 'brief'], ['orc', 'brief']]);
    expect(readFileSync(art('..', 'src/art/assets.ts'), 'utf8')).toContain('goblin');
    // the plain export is unchanged
    expect((await json('export', ...R)).packs).toEqual([]);
  });

  test('the gate flow: placeholder → v1 → shape gate → reject → v2 → shape gate → approve → v3 → finish → ready', async () => {
    const none = () => undefined;
    // the placeholder gate: approve the placeholder as it is (stage approve takes the key of the file in effect)
    expect((await json('pass', 'next', goblin, ...R))).toMatchObject({ action: 'stage-gate', stage: 'placeholder' });
    await run('stage', 'approve', 'goblin', 'placeholder', '--note', 'good size', ...R);
    // make scaffolds base.v1 from the template; the step reviews and scores it, then the shape gate asks
    const m = await step('goblin', none);
    expect(m.scaffolded).toEqual(['art/assets/character/goblin/base.v1.js']);
    const gate = (await json('pass', 'next', 'goblin', ...R));
    expect(gate).toMatchObject({ action: 'stage-gate', stage: 'shape', version: 'base.v1', pass: 'g' });
    expect(gate.key).toMatch(/^[0-9a-f]{8}$/);
    expect((await json('status', 'goblin', ...R))[0].why).toMatch(/waiting for the user: shape gate on base\.v1/);
    // the score entry recorded the keys and the failing or flagged checks
    const sc = ledger().find(e => e.type === 'score' && e.version === 'base.v1')!;
    expect(sc.stages).toMatchObject({ shape: gate.key }); expect(Array.isArray(sc.stageChecks)).toBe(true);
    // the shape sheet is small and logged as a review entry of the stage
    const full = ledger().find(e => e.type === 'review' && e.version === 'base.v1' && !e.stage)!;
    const sh = await json('review', 'goblin', '--version', 'base.v1', '--stage', 'shape', ...R);
    expect(existsSync(sh.sheet)).toBe(true);
    expect(sh.stage).toBe('shape'); expect(sh.stageChecks.map((c: { id: string }) => c.id)).toEqual(['shape-empty', 'shape-pivot', 'shape-box', 'shape-read', 'shape-facings']);
    const png = decodePNG(new Uint8Array(readFileSync(sh.sheet)));
    expect(sh.tokens).toBe(imageTokens(png.w, png.h)); expect(sh.tokens).toBeLessThan(full.imageTokens as number);
    const shapeReview = ledger().filter(e => e.type === 'review' && e.stage === 'shape');
    expect(shapeReview).toEqual([expect.objectContaining({ version: 'base.v1', stage: 'shape', imageTokens: sh.tokens, by: 'agent' })]);
    // on a pull request the shape sheet goes to art/review/ with the answer it waits for
    const prep = await json('pr', 'prepare', ...R);
    expect(prep.gates).toEqual(['goblin']);
    expect(existsSync(art('review', 'goblin-base.v1-shape.png'))).toBe(true);
    const table = readFileSync(art('review', 'REVIEW.md'), 'utf8');
    expect(table).toContain('Waiting for your answer on a gate'); expect(table).toContain('approve goblin shape, or goblin: shape: <what to change>');
    expect((await run('pr', 'prepare', ...R)).out).toMatch(/goblin wait at a gate: the reply is approve <id> shape/);
    // the shape review did not stand in for the version's review sheet (approve and make look for that one)
    const st = await json('status', 'goblin', ...R); expect(st[0].next.action).toBe('stage-gate');
    // reject: the next base redraws the silhouette from v1
    await expect(run('stage', 'reject', 'goblin', 'shape', ...R)).rejects.toThrow(/--note/);
    const rj = await json('stage', 'reject', 'goblin', 'shape', '--note', 'arms too long', ...R);
    expect(rj).toMatchObject({ stage: 'shape', verdict: 'reject', version: 'base.v1', note: 'arms too long', by: 'user' });
    expect((await json('pass', 'next', 'goblin', ...R))).toMatchObject({ action: 'write-base', version: 'base.v2', pass: 'r2', from: 'base.v1' });
    expect((await json('pass', 'next', 'goblin', ...R)).why).toContain('arms too long');
    // v2 keeps the silhouette (a comment changed): scored, then asks again; the user approves
    await step('goblin', none); await step('goblin', none);
    expect((await json('pass', 'next', 'goblin', ...R))).toMatchObject({ action: 'stage-gate', stage: 'shape', version: 'base.v2' });
    const ap = await json('stage', 'approve', 'goblin', 'shape', '--note', 'keep the hunch', ...R);
    expect(ap).toMatchObject({ verdict: 'approve', version: 'base.v2', key: gate.key });
    // v3 keeps the silhouette: the gate is passed by key, the pass machine goes on to the finish, and no new gate
    for (let i = 0; i < 12; i++) {
      const n = await json('pass', 'next', 'goblin', ...R);
      expect(n.action).not.toBe('stage-gate');
      if (n.action === 'ready') break;
      await step('goblin', () => { throw new Error('no more gates expected'); });
    }
    const fin = await json('make', 'goblin', ...R);
    expect(fin.rows.find((r: { id: string }) => r.id === 'goblin')).toMatchObject({ status: 'final' });
    // the stages of the final: the shape is approved as it is
    const final = fin.rows.find((r: { id: string }) => r.id === 'goblin').final;
    const stg = await json('stages', 'goblin', '--version', final, ...R);
    expect(stg.states).toMatchObject({ placeholder: 'approved', shape: 'approved', decorate: 'new', rig: 'new', decal: 'n/a' });
    expect(stg.gates).toEqual(['placeholder', 'shape']);
    const text = (await run('stages', 'goblin', '--version', final, ...R)).out;
    expect(text).toMatch(/1 shape\s+[0-9a-f]{8}\s+approved/); expect(text).toMatch(/2 rig\s+[0-9a-f]{8}\s+new/); expect(text).toMatch(/shape-pivot/);
    // approve copies the final's stage keys from its score entry
    await run('approve', 'goblin', '--note', 'good', ...R);
    const approve = ledger().filter(e => e.type === 'approve' && e.asset === 'goblin').pop()!;
    expect(approve.stages).toEqual(ledger().filter(e => e.type === 'score' && !e.blind && e.version === final).pop()!.stages);
    expect((await json('stages', 'goblin', '--version', final, ...R)).states.decorate).toBe('approved');
  }, 120_000);

  test('stage verdicts: the first gate of an ungated asset can still be approved, and a stage name is validated', async () => {
    await expect(run('stage', 'approve', 'goblin', 'rig', ...R)).rejects.toThrow(/placeholder \| shape/);
    await expect(run('stage', 'approve', 'orc', 'shape', ...R)).rejects.toThrow(/no scored base/);
  });

  test('a real export replaces the placeholder and keeps the contract; the placeholder never counts as the asset\'s export', async () => {
    const ex = await json('export', '--placeholders', ...R);
    const goblinPack = readJson<PackManifest>(join(root, 'public/assets/main/pack.json'));
    expect(goblinPack.assets.goblin.placeholder).toBeUndefined();
    expect(goblinPack.assets.goblin.version).toMatch(/^(base|finish)\.v\d+$/);
    expect(goblinPack.placeholders).toEqual(['crate', 'orc']);
    expect(ex.contracts.find((c: { id: string }) => c.id === 'goblin')).toMatchObject({ change: expect.stringMatching(/extended|^$/) });
    const st = await json('status', 'goblin', ...R);
    expect(st[0].status).toBe('exported');
  }, 60_000);

  test('restyle to a palette-only direction: every stage before decorate keeps its key, the shape gate stays passed', async () => {
    const cur = readJson<{ version: number; palette: { ramps: Record<string, string[]> } }>(art('direction.json'));
    mkdirSync(art('directions'), { recursive: true });
    writeJson(art('directions', `v${cur.version}.json`), cur);
    // every ramp colour swaps its red and green channels: a new palette, the same lights and darks in the same places
    const swap = (h: string) => `#${h.slice(3, 5)}${h.slice(1, 3)}${h.slice(5)}`;
    const next = { ...cur, version: cur.version + 1, palette: { ...cur.palette, ramps: Object.fromEntries(Object.entries(cur.palette.ramps).map(([k, r]) => [k, r.map(swap)])) } };
    writeJson(art('direction.json'), next);
    const r = await json('restyle', ...R);
    const g = r.assets.find((a: { id: string }) => a.id === 'goblin');
    expect(g.stages.same).toEqual(expect.arrayContaining(['placeholder', 'shape', 'animation']));
    expect(g.stages.changed).toEqual(['decorate']);
    expect(ledger().filter(e => e.type === 'restyle' && e.asset === 'goblin').pop()!.stages).toEqual(g.stages);
    // the changed look goes back to the user; the approved shape key still matches, so no shape gate
    expect((await json('status', 'goblin', ...R))[0]).toMatchObject({ status: 'final', next: { action: 'ready' } });
    expect((await json('pass', 'next', 'goblin', ...R)).action).toBe('ready');
    expect((await json('stages', 'goblin', ...R)).states).toMatchObject({ shape: 'approved', decorate: 'changed' });
    writeJson(art('direction.json'), cur);
  }, 60_000);

  test('assetStatus ignores placeholder exports: they never equal the final', () => {
    const l = (x: Partial<LedgerEntry>[]): LedgerEntry[] => x.map(e => ({ ts: 't', asset: 'a', type: 'approve', ...e }) as LedgerEntry);
    const base = l([{ type: 'approve', version: 'base.v2', by: 'user', sourceHash: 'h', direction: { id: 'd', version: 1 } }, { type: 'export', version: 'placeholder', placeholder: true, sourceHash: 'k' }]);
    const next = { action: 'ready', final: 'base.v2', best: 'base.v2', issues: [], why: '' };
    expect(assetStatus({ ledger: base, next, direction: { id: 'd', version: 1 }, finalHash: 'h' })).toMatchObject({ status: 'approved' });
    expect(assetStatus({ ledger: [...base, ...l([{ type: 'export', version: 'base.v2', sourceHash: 'h', pack: 'main' }])], next, direction: { id: 'd', version: 1 }, finalHash: 'h' })).toMatchObject({ status: 'exported' });
  });
});

describe('templates and the placeholder anchors', () => {
  test('every placeholder anchor name is among the anchors the brief\'s starting template exports', async () => {
    const root = mkdtempSync(join(tmpdir(), 'artgen-ph-anchors-'));
    const R = ['--root', root];
    await run('init', ...R);
    await run('direction', 'candidates', '--pitch', 'Grim swamp roguelike: bog goblins in the fog.', ...R);
    await run('direction', 'lock', 'a', ...R);
    const { initNodeSvg } = await import('./node.ts');
    await initNodeSvg();
    const { renderAsset } = await import('artgen-core');
    const { pathToFileURL } = await import('node:url');
    const p = { root, art: join(root, 'art') }, dir = lockedDirection(p)!;
    for (const view of ['topdown', 'iso'] as const) {
      const briefs = [
        { kind: 'character' }, { kind: 'character', directions: 8, anims: { walk: { frames: 2 } } },
        { kind: 'creature' }, { kind: 'creature', body: 'humanoid' }, ...(['quadruped', 'serpent', 'flyer', 'large'] as const).map(body => ({ kind: 'creature', body })),
      ];
      for (const [i, b] of briefs.entries()) {
        const brief = { id: `t${i}`, view, states: ['idle'], ...b } as never as Parameters<typeof templateFor>[0];
        const t = templateFor(brief, dir), ph = defaultPlaceholder(brief, dir);
        const mod = await import(pathToFileURL(join(t.dir, 'base.js')).href), r = renderAsset(mod, { dir, brief });
        const names = new Set(r.cells.flatMap(c => Object.keys(c.anchors ?? {})));
        for (const n of Object.keys(ph.anchors)) expect(names.has(n), `${view} ${JSON.stringify(b)} (${t.view}/${t.kind}): ${n}`).toBe(true);
        expect(Object.keys(ph.anchors).length, `${view} ${JSON.stringify(b)}`).toBeGreaterThan(0);
      }
    }
    void findTemplate; void passState; void openAsset; void writeJson;
  }, 60_000);
});

describe('pull request comments name stages', () => {
  const ids = ['goblin', 'orc'];
  test('"approve goblin shape" approves a gate, "goblin: shape: arms too long" rejects one; other lines parse as before', () => {
    const r = parseReviewComment('approve goblin shape\norc: shape: the head is a dome\napprove goblin placeholder — fine\ngoblin: placeholder: too small\napprove orc\norc: finish: edge too dark\norc: the arms are too long', ids);
    expect(r.actions).toEqual([
      { type: 'stage-approve', id: 'goblin', stage: 'shape', note: '' },
      { type: 'stage-reject', id: 'orc', stage: 'shape', note: 'the head is a dome' },
      { type: 'stage-approve', id: 'goblin', stage: 'placeholder', note: 'fine' },
      { type: 'stage-reject', id: 'goblin', stage: 'placeholder', note: 'too small' },
      { type: 'approve', id: 'orc', note: '' },
      { type: 'feedback', id: 'orc', note: 'edge too dark', route: 'finish' },
      { type: 'feedback', id: 'orc', note: 'the arms are too long' },
    ]);
    expect(r.unknown).toEqual([]);
    expect(parseReviewComment('approve gobln shape', ids).unknown).toEqual(['approve gobln shape']);
    expect(parseReviewComment('approve goblin, orc', ids).actions.map(a => a.type)).toEqual(['approve', 'approve']);
  });
});
