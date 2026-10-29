// The map workflow (docs/WORKFLOW.md): a map, a dungeon and a settlement go through version → review → approve in a temp project,
// with the ledger and the status checked at every step; feedback opens a revision; an edit after approval makes it stale; and the
// refusals (nothing changed, unrecorded edits, a failing check, only the user approves) hold.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { encodePNG, Grid, parseLedger, sourceHash, subjects, type LedgerEntry, type SubjectKind } from 'artgen-core/maps';
import { main } from './cli.ts';
import { checkDungeonFile } from './dungeon.ts';
import { checkMapFile } from './map.ts';
import { mapsMain } from './maps-cli.ts';
import { initProject } from './project.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
let root = '', art = '';
beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'artgen-workflow-')); art = initProject(root).project.art; });
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

/** One command in the project, in-process: its exit code and what it printed. */
async function run(...argv: string[]): Promise<{ code: number; out: string }> {
  const lines: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { lines.push(a.join(' ')); });
  try { return { code: await main([...argv, '--root', root]), out: lines.join('\n') }; } finally { log.mockRestore(); }
}
const ledger = (): LedgerEntry[] => parseLedger(readFileSync(join(art, 'ledger.jsonl'), 'utf8'));
const lines = (key: string, type?: string) => ledger().filter(e => e.asset === key && (!type || e.type === type));
const rows = async (kind: string, ...ids: string[]) => JSON.parse((await run(kind, 'status', ...ids, '--json')).out).rows as { id: string; status: string; version?: string; why: string; fail: number }[];
const status = async (kind: string, id: string) => (await rows(kind, id))[0];
const file = (dir: string, id: string, name: string) => join(art, dir, id, name);
const editMap = async (id: string, from = 0) => { await run('map', 'edit', id, 'road', '--points', `0,${from + 3},9,${from + 3}`); };

describe('a terrain map: new → version → review → approve', () => {
  const key = 'map:keep';
  test('each step is in the ledger and in the status', async () => {
    await run('map', 'new', 'keep', '--preset', 'local', '--size', '14x10', '--seed', '3', '--title', 'Keep');
    expect(await status('map', 'keep')).toMatchObject({ status: 'in-pipeline', why: expect.stringContaining('no version recorded yet') });
    expect(ledger()).toEqual([]);
    await expect(run('map', 'approve', 'keep')).rejects.toThrow(/in-pipeline.*only a final map can be approved/);
    await expect(run('map', 'review', 'keep')).rejects.toThrow(/no version yet/);

    const v1 = JSON.parse((await run('map', 'version', 'keep', '--note', 'first', '--json')).out);
    expect(v1).toMatchObject({ version: 'v1', file: 'art/maps/keep/map.v1.json' });
    expect(readFileSync(file('maps', 'keep', 'map.v1.json'))).toEqual(readFileSync(file('maps', 'keep', 'map.json')));
    expect(lines(key)).toEqual([expect.objectContaining({ type: 'version', version: 'v1', file: 'maps/keep/map.v1.json', note: 'first', by: 'agent', sourceHash: sourceHash(readFileSync(file('maps', 'keep', 'map.json'), 'utf8')) })]);
    expect(lines(key)[0].wallMs).toBeUndefined();
    expect(await status('map', 'keep')).toMatchObject({ status: 'final', version: 'v1' });
    await expect(run('map', 'version', 'keep')).rejects.toThrow('keep: no change since v1');

    const rv = JSON.parse((await run('map', 'review', 'keep', '--json')).out);
    expect(rv).toMatchObject({ version: 'v1', sheet: 'art/maps/keep/out/review-v1.png', pass: true });
    expect(rv.imageTokens).toBeGreaterThan(100);
    expect(existsSync(file('maps', 'keep', 'out/review-v1.png'))).toBe(true);
    expect(lines(key, 'review')).toEqual([expect.objectContaining({ version: 'v1', sheet: 'maps/keep/out/review-v1.png', conformance: expect.objectContaining({ pass: true }), by: 'agent' })]);
    expect(lines(key, 'score')).toEqual([]);

    await run('map', 'review', 'keep', 'v1', '--score', '7', '--note', 'labels read', '--reviewer', 'art-reviewer');
    expect(lines(key, 'score')).toEqual([expect.objectContaining({ version: 'v1', score: 7, note: 'labels read', reviewer: 'art-reviewer', by: 'agent' })]);
    await expect(run('map', 'review', 'keep', '--score', '11')).rejects.toThrow(/0 to 10/);
    await expect(run('map', 'review', 'keep', 'v9')).rejects.toThrow(/no v9 \(have v1\)/);

    const a = await run('map', 'approve', 'keep', '--note', 'good map');
    expect(a.out).toContain('approved map:keep v1');
    expect(lines(key, 'approve')).toEqual([expect.objectContaining({ version: 'v1', note: 'good map', by: 'user', sourceHash: v1.sourceHash })]);
    expect(lines(key, 'approve')[0].direction).toBeUndefined();
    expect(await status('map', 'keep')).toMatchObject({ status: 'approved', version: 'v1' });
    expect((await run('map', 'status', 'keep')).out).toMatch(/approve +user +good map/);
  }, 120_000);

  test('feedback opens a revision; a new version and the user\'s approval close it', async () => {
    await run('map', 'new', 'isle', '--preset', 'local', '--size', '12x9', '--seed', '5');
    await run('map', 'version', 'isle');
    await run('map', 'feedback', 'isle', '--note', 'add a road to the west gate', '--region', '0,2,4,3');
    expect(lines('map:isle', 'feedback')).toEqual([expect.objectContaining({ on: 'v1', note: 'add a road to the west gate', region: [0, 2, 4, 3], by: 'user' })]);
    expect(await status('map', 'isle')).toMatchObject({ status: 'revision', why: 'feedback on v1: rework, then record v2' });
    await expect(run('map', 'approve', 'isle')).rejects.toThrow(/is revision/);
    await editMap('isle');
    expect(await status('map', 'isle')).toMatchObject({ status: 'revision' });
    await run('map', 'version', 'isle', '--note', 'road added');
    expect(await status('map', 'isle')).toMatchObject({ status: 'final', version: 'v2' });
    expect((await run('map', 'diff', 'isle')).out).toContain('no change');
    expect((await run('map', 'diff', 'isle', 'v1', 'v2')).out).toMatch(/v1 -> v2: 1 change\n\+ edits\[0\]/);
    await run('map', 'approve', 'isle', '--note', 'yes');
    expect(await status('map', 'isle')).toMatchObject({ status: 'approved', version: 'v2' });
    expect(lines('map:isle').map(e => e.type)).toEqual(['version', 'feedback', 'version', 'approve']);
    expect(lines('map:isle', 'version')[1].wallMs).toBeGreaterThanOrEqual(0);
  }, 120_000);

  test('an edit after approval is stale; approval is refused until a version records it', async () => {
    await run('map', 'new', 'bay', '--preset', 'local', '--size', '12x9', '--seed', '8');
    await run('map', 'version', 'bay');
    await run('map', 'approve', 'bay');
    await editMap('bay');
    expect(await status('map', 'bay')).toMatchObject({ status: 'stale', why: 'edited since approved v1: record a version' });
    await expect(run('map', 'approve', 'bay')).rejects.toThrow(/is stale \(edited since approved v1/);
    expect((await run('map', 'diff', 'bay')).out).toContain('+ edits[0]');
    await run('map', 'version', 'bay');
    expect(await status('map', 'bay')).toMatchObject({ status: 'final', version: 'v2' });
  }, 120_000);

  test('an edit before any approval is in-pipeline, and approval is refused with the unrecorded edit named', async () => {
    await run('map', 'new', 'dale', '--preset', 'local', '--size', '12x9', '--seed', '9');
    await run('map', 'version', 'dale');
    await editMap('dale');
    expect(await status('map', 'dale')).toMatchObject({ status: 'in-pipeline', why: 'edited since v1: record a version' });
    await expect(run('map', 'approve', 'dale')).rejects.toThrow(/edited since v1: record a version\): only a final map can be approved — artgen map version dale first/);
    expect(lines('map:dale', 'approve')).toEqual([]);
  }, 60_000);

  test('a failing check refuses the approval, and the review says which', async () => {
    // the generator bends the ground to a requirement where it can; this fixture's requirements stay unmet
    mkdirSync(file('maps', 'rift', ''), { recursive: true });
    const spec = JSON.parse(readFileSync(join(FIXTURES, 'setting-builder', 'frontier-unmet', 'map.json'), 'utf8'));
    writeFileSync(file('maps', 'rift', 'map.json'), JSON.stringify({ ...spec, id: 'rift' }, null, 2));
    const failing = (await status('map', 'rift')).fail;
    expect(failing).toBeGreaterThan(0);
    await run('map', 'version', 'rift');
    await expect(run('map', 'approve', 'rift')).rejects.toThrow(new RegExp(`${failing} checks? fails? \\(require:`));
    expect(lines('map:rift', 'approve')).toEqual([]);
    const rv = JSON.parse((await run('map', 'review', 'rift', '--json')).out);
    expect(rv.pass).toBe(false);
    expect(rv.checks.filter((c: { status: string }) => c.status === 'fail')).toHaveLength(failing);
    expect(lines('map:rift', 'review')[0].conformance).toMatchObject({ pass: false });
    expect((await run('map', 'status', 'rift')).out).toMatch(/\(\d+ checks? fail\)/);
  }, 120_000);
});

describe('a dungeon and a settlement go through the same steps', () => {
  test.each([
    ['dungeon', 'warren', ['new', 'warren', '--seed', '2', '--rooms', '4', '--size', '24x18'], 'dungeons/warren/dungeon.json'],
    ['settlement', 'ford', ['new', 'ford', '--kind', 'hamlet', '--seed', '3', '--size', '30x22'], 'settlements/ford/settlement.json'],
  ] as const)('%s', async (kind, id, args, path) => {
    const key = `${kind}:${id}`;
    await run(kind, ...args);
    expect(await status(kind, id)).toMatchObject({ status: 'in-pipeline' });
    await run(kind, 'version', id, '--note', 'generated');
    expect(lines(key, 'version')).toEqual([expect.objectContaining({ version: 'v1', file: path.replace('.json', '.v1.json') })]);
    expect(existsSync(join(art, path.replace('.json', '.v1.json')))).toBe(true);
    expect(await status(kind, id)).toMatchObject({ status: 'final', version: 'v1' });
    await run(kind, 'review', id);
    expect(existsSync(join(art, path.replace(/[^/]+$/, 'out/review-v1.png')))).toBe(true);
    expect(lines(key, 'review')).toHaveLength(1);
    await run(kind, 'feedback', id, '--note', 'make it tighter');
    expect(await status(kind, id)).toMatchObject({ status: 'revision' });
    await run(kind, 'label', id, 'Edit', '--at', '3,3');
    await run(kind, 'version', id);
    await run(kind, 'approve', id, '--note', 'ok');
    expect(await status(kind, id)).toMatchObject({ status: 'approved', version: 'v2' });
    expect(lines(key).map(e => e.type)).toEqual(['version', 'review', 'feedback', 'version', 'approve']);
    expect((await run(kind, 'diff', id, 'v1', 'v2')).out).toMatch(/overlay\.labels\[0\]/);
    const sheet = JSON.parse((await run(kind, 'sheet', id, '--json')).out);
    expect(sheet.png).toBe(`art/${path.replace(/[^/]+$/, 'out/sheet.png')}`);
    expect(existsSync(join(root, sheet.png)) && existsSync(join(root, sheet.json))).toBe(true);
    expect(sheet.sheet).toMatchObject({ subject: key });
  }, 180_000);

  test('a dungeon with a lint error can\'t be approved; its warnings are copied into the approval', async () => {
    await run('dungeon', 'new', 'hole', '--empty', '--size', '20x12');
    await run('dungeon', 'room', 'hole', 'add', 'rect', '--at', '2,2', '--size', '6x4');
    await run('dungeon', 'room', 'hole', 'add', 'rect', '--at', '5,3', '--size', '6x4');
    const checks = (await run('dungeon', 'check', 'hole', '--json')).out;
    expect(JSON.parse(checks).warnings.length).toBeGreaterThan(0);
    await run('dungeon', 'version', 'hole');
    const r = await run('dungeon', 'approve', 'hole', '--note', 'overlap is the cave');
    expect(r.out).toContain('note for the user:');
    expect(lines('dungeon:hole', 'approve')[0].warnings).toEqual(expect.arrayContaining([expect.stringContaining('lint')]));
    // an error: an outline that crosses itself
    await run('dungeon', 'new', 'bad', '--empty', '--size', '20x12');
    const f = file('dungeons', 'bad', 'dungeon.json'), spec = JSON.parse(readFileSync(f, 'utf8'));
    spec.rooms = [{ id: 'r1', shape: 'poly', points: [2, 2, 8, 8, 8, 2, 2, 8], x: 2, y: 2, w: 6, h: 6 }];
    writeFileSync(f, JSON.stringify(spec));
    expect(await status('dungeon', 'bad')).toMatchObject({ fail: 1 });
    await run('dungeon', 'version', 'bad');
    await expect(run('dungeon', 'approve', 'bad')).rejects.toThrow(/1 check fail \(lint\)/);
    expect(lines('dungeon:bad', 'approve')).toEqual([]);
  }, 120_000);
});

describe('the map direction', () => {
  test('a draft changes nothing; a lock moves the version and stales approvals made under another', async () => {
    await run('map', 'new', 'peak', '--preset', 'local', '--size', '12x9', '--seed', '4');
    await run('map', 'version', 'peak');
    await run('map', 'approve', 'peak');
    expect((await run('map', 'direction')).out).toContain('no map direction yet');
    await expect(run('map', 'direction', '--lock')).rejects.toThrow(/nothing to lock yet/);
    await expect(run('map', 'direction', '--theme', 'dungeon=color')).rejects.toThrow(/--theme dungeon: one of bw/);
    await expect(run('map', 'direction', '--theme', 'map=sepia')).rejects.toThrow(/--theme map: one of color, bw/);
    await expect(run('map', 'direction', '--symbols', 'dungeon=unicorn')).rejects.toThrow(/no such symbol unicorn/);
    await run('map', 'direction', '--theme', 'map=bw,settlement=color', '--symbols', 'map=castle,town');
    expect(JSON.parse(readFileSync(join(art, 'map-direction.json'), 'utf8'))).toMatchObject({ id: 'maps', version: 0, status: 'draft', themes: { map: 'bw', settlement: 'color' }, symbols: { map: ['castle', 'town'] } });
    expect(await status('map', 'peak')).toMatchObject({ status: 'approved' });

    await run('map', 'direction', '--lock', '--note', 'printed handouts: black and white');
    expect(JSON.parse(readFileSync(join(art, 'map-direction.json'), 'utf8'))).toMatchObject({ version: 1, status: 'locked' });
    expect(lines('maps:direction')).toEqual([expect.objectContaining({ type: 'approve', version: 'v1', note: 'printed handouts: black and white', by: 'user' })]);
    expect(await status('map', 'peak')).toMatchObject({ status: 'stale', why: 'approved with no map direction, now v1' });
    await expect(run('map', 'direction', '--lock')).rejects.toThrow(/already locked at v1/);

    // review now uses the direction's theme and the approval records its version
    await run('map', 'review', 'peak');
    expect(existsSync(file('maps', 'peak', 'out/map.v1.bw.png'))).toBe(true);
    await run('map', 'feedback', 'peak', '--note', 'redo under the direction');
    await run('map', 'edit', 'peak', 'road', '--points', '0,1,9,1');
    await run('map', 'version', 'peak');
    await run('map', 'approve', 'peak');
    expect(lines('map:peak', 'approve')[1].direction).toEqual({ id: 'maps', version: 1 });
    expect(await status('map', 'peak')).toMatchObject({ status: 'approved', version: 'v2' });

    await run('map', 'direction', '--theme', 'map=color', '--lock');
    expect(await status('map', 'peak')).toMatchObject({ status: 'stale', why: 'approved under map direction v1, now v2' });
  }, 180_000);

  test('a symbol outside the direction\'s set is a warning, not a failure', async () => {
    await run('map', 'new', 'cove', '--preset', 'local', '--size', '12x9', '--seed', '6');
    await run('map', 'symbol', 'cove', 'castle', '--at', '3,3');
    await run('map', 'symbol', 'cove', 'tower', '--at', '5,5');
    expect(await status('map', 'cove')).toMatchObject({ fail: 0, flag: 1 });
    await run('map', 'version', 'cove');
    const r = await run('map', 'approve', 'cove');
    expect(r.out).toContain('note for the user: symbols: not in the map direction\'s symbol set: tower');
    expect(lines('map:cove', 'approve')[0]).toMatchObject({ direction: { id: 'maps', version: 2 } });
  }, 120_000);
});

describe('brief and references', () => {
  test('write, show, and see the notes and a reference on the data sheet; a missing or non-PNG reference is skipped with a warning', async () => {
    await run('map', 'new', 'coast', '--preset', 'local', '--size', '12x9', '--seed', '7');
    expect((await run('map', 'brief', 'coast')).out).toContain('no brief yet');
    await run('map', 'brief', 'coast', '--text', 'A fishing coast for the first session.\nShallow bay to the south.', '--refs', 'refs/coast.png,refs/missing.png,refs/notes.txt');
    await expect(run('map', 'brief', 'coast', '--refs', '../secret.png')).rejects.toThrow(/a path under art\//);
    expect(readFileSync(file('maps', 'coast', 'map.brief.md'), 'utf8')).toBe('---\nrefs: refs/coast.png, refs/missing.png, refs/notes.txt\n---\nA fishing coast for the first session.\nShallow bay to the south.\n');
    await run('map', 'brief', 'coast', '--text', 'Only the text changes.');
    expect((await run('map', 'brief', 'coast')).out).toContain('refs: refs/coast.png');
    writeFileSync(join(art, 'refs', 'coast.png'), encodePNG(new Grid(40, 30).fill(0, 0, 40, 30, '#3a6ea5')));
    writeFileSync(join(art, 'refs', 'notes.txt'), 'x');
    const s = JSON.parse((await run('map', 'sheet', 'coast', '--json')).out);
    expect(s.sheet).toMatchObject({ notes: 'Only the text changes.', refs: ['refs/coast.png', 'refs/missing.png', 'refs/notes.txt'] });
    expect(s.warnings).toEqual(['refs/missing.png: no such file, skipped', 'refs/notes.txt: not a PNG, skipped']);
    await run('map', 'version', 'coast');
    const rv = JSON.parse((await run('map', 'review', 'coast', '--json')).out);
    expect(rv.warnings).toHaveLength(2);
    expect(existsSync(file('maps', 'coast', 'out/review-v1.png'))).toBe(true);
  }, 120_000);
});

describe('metrics: every generator reports the same fields', () => {
  test('a maps-only export holds the generators and the map counts, and no id, note or path', async () => {
    const lines: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { lines.push(a.join(' ')); });
    let code: number;
    try { code = await mapsMain(['metrics', 'export', '--name', 'handouts', '--root', root]); } finally { log.mockRestore(); }
    expect(code).toBe(0);
    expect(lines.join('\n')).toMatch(/metrics for artgen .*: \d+ maps?, \d+ approved; \d+ dungeons?, \d+ approved; \d+ settlements?, \d+ approved/);
    const f = readdirSync(join(art, 'metrics')).filter(n => n.endsWith('.json'))[0], m = JSON.parse(readFileSync(join(art, 'metrics', f), 'utf8'));
    expect(m).toMatchObject({ schema: 2, repo: 'handouts' });
    for (const k of ['assets', 'byKind', 'passes', 'totals', 'blind']) expect(m[k], k).toBeUndefined();
    expect(m.maps).toMatchObject({ map: expect.any(Number), dungeon: 3, settlement: 1 });
    expect(Object.keys(m.generators)).toEqual(['map', 'dungeon', 'settlement']);
    const g = m.generators;
    expect(g.map).toMatchObject({ subjects: m.maps.map, approved: expect.any(Number), feedback: expect.any(Number) });
    expect(g.map.approved).toBe(ledger().filter(e => e.type === 'approve' && e.asset.startsWith('map:') && e.asset !== 'maps:direction').map(e => e.asset).filter((a, i, all) => all.indexOf(a) === i).length);
    expect(g.map.firstPassApproval.untouched).toBeLessThanOrEqual(g.map.approved);
    expect(g.map.checkFailures['require:C-forest']).toBeUndefined();
    expect(g.map.imageTokens).toBeGreaterThan(0);
    const text = readFileSync(join(art, 'metrics', f), 'utf8');
    for (const id of ['keep', 'isle', 'warren', 'ford', 'coast']) expect(text).not.toContain(id);
    expect(text).not.toContain(root);
  }, 60_000);

  test('the full CLI adds the art numbers when there are any; the pool reads schemas 1 and 2 together', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'artgen-pool-'));
    const old = { schema: 1, repo: 'old', artgen: '0.1.0', modules: {}, exported: '2026-10-01', assets: { total: 2, final: 2, approved: 2 }, maps: { map: 0, dungeon: 0, settlement: 0 }, byKind: {}, passes: [], totals: { outTokens: 600, inTokens: 0, imageTokens: 400, cost: 1, wallMinutes: 10 }, firstPassApproval: { approved: 2, untouched: 1, rate: 0.5 }, gateFailures: { palette: 2 }, blind: { n: 0 } };
    const gen = (approved: number, untouched: number, passes: number, tokens: number, minutes: number) => ({ subjects: approved + 1, started: approved, final: approved, approved, passesPerApproved: passes, firstPassApproval: { approved, untouched, rate: untouched / approved }, feedback: approved - untouched, imageTokens: tokens, outTokens: 0, wallMinutes: minutes, checkFailures: {} });
    const a = { schema: 2, repo: 'a', artgen: '0.2.0', modules: {}, exported: '2026-10-02', maps: { map: 3, dungeon: 0, settlement: 0 }, generators: { map: gen(2, 1, 2, 1000, 5) } };
    const b = { ...a, repo: 'b', generators: { map: gen(2, 2, 1, 500, 3), dungeon: gen(1, 1, 1, 200, 1) }, assets: { total: 1, final: 1, approved: 1 }, totals: { outTokens: 100, inTokens: 0, imageTokens: 100, cost: 0, wallMinutes: 4 }, firstPassApproval: { approved: 1, untouched: 1 }, gateFailures: {} };
    for (const [n, e] of Object.entries({ old, a, b })) writeFileSync(join(dir, `${n}.json`), JSON.stringify(e));
    const lines: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...x) => { lines.push(x.join(' ')); });
    try { await mapsMain(['metrics', 'pool', dir]); } finally { log.mockRestore(); }
    const md = lines.join('\n');
    expect(md).toContain('3 exports from 3 repos: a, b, old');
    expect(md).toContain('| 0.1.0 | 1 | 2 | 2 | 500 |');
    expect(md).toContain('| 0.2.0 | 2 | 1 | 1 | 200 |');
    expect(md).toContain('## Per generator');
    expect(md).toContain('| 0.2.0 | map | 6 | 4 | 1.5 | 0.75 | 1500 | 8 |');
    expect(md).toContain('| 0.2.0 | dungeon | 2 | 1 | 1 | 1 | 200 | 1 |');
    expect(md).not.toContain('| 0.1.0 | map');
  });
});

describe('the ledger and the art readers', () => {
  test('a subject key never matches a brief id, and the ids are names, never paths', async () => {
    await expect(run('map', 'version', '../x')).rejects.toThrow(/letters, digits/);
    await expect(run('map', 'status', 'nosuch')).rejects.toThrow(/no map nosuch/);
    expect([...new Set(ledger().map(e => e.asset))].every(a => a.includes(':'))).toBe(true);
  });

  test('analytics: the art numbers are the same with map work in the ledger; the Generators table appears once there is some', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'artgen-analytics-'));
    cpSync(fileURLToPath(new URL('../../../examples/iso-dungeon/art', import.meta.url)), join(dir, 'art'), { recursive: true });
    const analytics = async (...a: string[]) => { const lines: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...x) => { lines.push(x.join(' ')); }); try { await main(['analytics', ...a, '--root', dir]); } finally { log.mockRestore(); } return lines.join('\n'); };
    const before = await analytics('--json'), md0 = await analytics();
    expect(JSON.parse(before).generators).toBeUndefined();
    expect(md0).not.toContain('## Generators');
    const at = async (...a: string[]) => { const log = vi.spyOn(console, 'log').mockImplementation(() => {}); try { await main([...a, '--root', dir]); } finally { log.mockRestore(); } };
    await at('map', 'new', 'keep', '--preset', 'local', '--size', '12x9', '--seed', '3');
    await at('map', 'version', 'keep');
    await at('map', 'approve', 'keep');
    const after = JSON.parse(await analytics('--json')), { generators, ...rest } = after;
    expect(rest).toEqual(JSON.parse(before));
    expect(generators.map).toMatchObject({ subjects: 1, started: 1, final: 1, approved: 1, firstPassApproval: { approved: 1, untouched: 1, rate: 1 } });
    expect(generators.art.subjects).toBeGreaterThan(0);
    const md = await analytics();
    expect(md.startsWith(md0.trimEnd())).toBe(true);
    expect(md).toMatch(/## Generators[\s\S]*\| art \| \d+ \|[\s\S]*\| map \| 1 \| 1 \| 1 \| 1 \| 1 \| 1 \| 0 \| 0 \| 0 \|/);
    rmSync(dir, { recursive: true, force: true });
  }, 60_000);
});

describe('an asset: the data sheet and references on the review sheet', () => {
  test('sheet writes out/sheet.png and sheet.json; review shows the references and skips the ones it cannot read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'artgen-assetsheet-'));
    cpSync(fileURLToPath(new URL('../../../examples/iso-dungeon/art', import.meta.url)), join(dir, 'art'), { recursive: true });
    const at = async (...a: string[]) => { const lines: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...x) => { lines.push(x.join(' ')); }); try { await main([...a, '--root', dir]); } finally { log.mockRestore(); } return lines.join('\n'); };
    const sheet = JSON.parse(await at('sheet', 'skeleton-knight', '--json'));
    expect(sheet.png).toBe('art/assets/character/skeleton-knight/out/sheet.png');
    expect(existsSync(join(dir, sheet.png)) && existsSync(join(dir, sheet.json))).toBe(true);
    expect(sheet.sheet).toMatchObject({ title: 'skeleton-knight — character', subject: 'skeleton-knight', swatches: expect.any(Array) });
    expect(sheet.sheet.rows.map((r: { label: string }) => r.label)).toEqual(['Kind', 'Importance', 'View', 'Size', 'States', 'Facings', 'Frames', 'Template', 'Budget']);
    expect((await at('sheet', 'skeleton-knight')).split('\n')[2]).toBe('# skeleton-knight — character');
    await expect(at('sheet', 'nobody')).rejects.toThrow('no brief nobody');

    const f = join(dir, 'art', 'briefs.yaml');
    writeFileSync(f, readFileSync(f, 'utf8').replace('- id: skeleton-knight\n', '- id: skeleton-knight\n  refs: [refs/skeleton-knight-edited.png, refs/missing.png, refs/README.md]\n'));
    expect(JSON.parse(await at('sheet', 'skeleton-knight', '--json')).warnings).toEqual(['refs/missing.png: no such file, skipped', 'refs/README.md: not a PNG, skipped']);
    const plain = JSON.parse(await at('review', 'chest', '--json')), withRefs = JSON.parse(await at('review', 'skeleton-knight', '--json'));
    expect(plain.warnings).toBeUndefined();
    expect(withRefs.warnings).toEqual(['refs/missing.png: no such file, skipped', 'refs/README.md: not a PNG, skipped']);
    expect(existsSync(withRefs.sheet)).toBe(true);
    expect((await at('review', 'skeleton-knight')).split('\n').filter(l => l.includes('warning:'))).toHaveLength(2);
    // a blind review is the version alone: no references
    expect(JSON.parse(await at('review', 'skeleton-knight', '--blind', '--json')).warnings).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  }, 120_000);
});

describe('the same verdict as the check commands', () => {
  const CASES: [SubjectKind, string, string][] = [
    ['map', 'frontier', 'map.json'], ['map', 'frontier-unmet', 'map.json'], ['map', 'ravine', 'map.json'], ['map', 'keep', 'map.json'],
    ['dungeon', 'warren', 'dungeon.json'], ['dungeon', 'shrine-crypts', 'dungeon.json'], ['dungeon', 'keep-cellars', 'dungeon.json'], ['dungeon', 'keep-flat', 'dungeon.json'], ['dungeon', 'bad-file', 'dungeon.json'], ['dungeon', 'keep', 'dungeon.json'],
  ];
  test.each(CASES)('%s %s', (kind, name, f) => {
    const path = join(FIXTURES, 'setting-builder', name, f), text = readFileSync(path, 'utf8'), dir = resolve(path, '..');
    const checks = subjects.checkSource(kind, text, { exists: rel => existsSync(resolve(dir, rel)) }), failed = checks.filter(c => c.status === 'fail'), flagged = checks.filter(c => c.status === 'flag');
    if (kind === 'map') {
      const r = checkMapFile(null, { file: path });
      expect(failed.length === 0).toBe(r.ok);
      expect(failed.filter(c => c.id.startsWith('require:')).map(c => c.id.slice(8))).toEqual(r.unmet);
      expect(failed.filter(c => c.id === 'format')).toHaveLength(r.errors.length);
    } else {
      const r = checkDungeonFile(null, { file: path });
      expect(failed.length === 0).toBe(r.ok);
      expect(failed.map(c => c.detail).sort()).toEqual(r.errors.map(e => `${e.path || '(file)'}: ${e.message}`).sort());
      expect(flagged.map(c => c.detail).sort()).toEqual(r.warnings.map(e => `${e.path || '(file)'}: ${e.message}`).sort());
    }
  }, 60_000);

  test('a file that is not JSON fails format', () => {
    expect(subjects.checkSource('map', '{nope', {})).toEqual([expect.objectContaining({ id: 'format', status: 'fail', detail: expect.stringContaining('not JSON') })]);
  });

  test('a missing underlay map fails, and is not looked for when the caller cannot look', () => {
    const text = readFileSync(join(FIXTURES, 'setting-builder', 'keep', 'dungeon.json'), 'utf8'), raw = JSON.parse(text);
    raw.underlay = { map: 'nowhere/map.json', origin: [0, 0], scale: 5 };
    const some = (exists?: (p: string) => boolean) => subjects.checkSource('dungeon', JSON.stringify(raw), { exists }).filter(c => c.id === 'underlay');
    expect(some(() => false)).toEqual([expect.objectContaining({ status: 'fail', detail: 'underlay.map: no such map file nowhere/map.json' })]);
    expect(some()).toEqual([]);
  });
});

describe('the maps-only entry', () => {
  test('has the workflow commands and takes no --file on them', async () => {
    const lines: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { lines.push(a.join(' ')); });
    try {
      await mapsMain(['map', 'status', '--root', root]);
      expect(lines.join('\n')).toMatch(/^keep +\w+/m);
      await expect(mapsMain(['map', 'version', 'keep', '--file', 'x.json', '--root', root])).rejects.toThrow(/unknown flag --file/);
      expect(readdirSync(join(art, 'maps', 'keep')).sort()).toEqual(expect.arrayContaining(['map.json', 'map.v1.json', 'out']));
    } finally { log.mockRestore(); }
  });
});
