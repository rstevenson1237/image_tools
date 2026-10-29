/**
 * The UI's engine against the CLI on the fixture game repos (`examples/`): same status rows, same renders, same
 * approval and feedback entries, same lock output. The UI and Claude Code share files (SPEC §13.3), so any drift
 * between the two readings of those files is a bug.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { decodePNG, parseLedger } from 'artgen-core';
import {
  approve as cliApprove, cliApproveSubject, cliFeedbackSubject, exportMetrics, initProject, main as cliMain, recordVersion, statusRows, writeSheet, assetPathOf, feedback as cliFeedback, initNodeSvg, lock as cliLock, openAsset, projectStatus,
  readBriefs, renderVersion as cliRender, requireProject, writeDraft,
} from 'artgen-cli';
import { ArtProject, strip } from './engine';
import { MemoryFiles } from './files';
import { loadSnapshot, rewriteImports, relativeImports, joinPath, snapshotLoader } from './snapshot';

const EXAMPLES = join(import.meta.dirname, '../../../examples');
const FIXTURES = readdirSync(EXAMPLES).filter(f => statSync(join(EXAMPLES, f)).isDirectory());

function readTree(dir: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  const go = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) go(p);
      else out[relative(dir, p).split('\\').join('/')] = new Uint8Array(readFileSync(p));
    }
  };
  go(dir);
  return out;
}

/** Engine over a copy of an art folder in memory; asset modules are loaded as data: URLs through the snapshot loader. */
async function engineFor(art: string): Promise<{ project: ArtProject; files: MemoryFiles }> {
  const files = new MemoryFiles('art', readTree(art)), snap = await loadSnapshot(files);
  const { load } = snapshotLoader(snap, code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return { project: new ArtProject(snap, load), files };
}

beforeAll(() => initNodeSvg());

describe('module loader', () => {
  it('resolves relative imports to the URLs of the files they name', () => {
    expect(joinPath('assets/prop/x', './finish.v1.js')).toBe('assets/prop/x/finish.v1.js');
    expect(joinPath('assets/prop/x', '../y/a.js')).toBe('assets/prop/y/a.js');
    const src = `import * as prev from './finish.v1.js';\nexport { a } from "../lib/a.js";\nconst m = await import('./x.js');\nimport './side.js';`;
    expect(relativeImports(src)).toEqual(['./finish.v1.js', '../lib/a.js', './x.js', './side.js']);
    expect(rewriteImports(src, s => `blob:${s.length}`)).toBe(`import * as prev from 'blob:14';\nexport { a } from "blob:11";\nconst m = await import('blob:6');\nimport 'blob:9';`);
  });

  it('refuses import cycles and missing files', () => {
    const { urlOf } = snapshotLoader({ text: { 'a.js': "import './b.js'", 'b.js': "import './a.js'", 'c.js': "import './nope.js'" } }, c => c);
    expect(() => urlOf('a.js')).toThrow(/import cycle/);
    expect(() => urlOf('c.js')).toThrow(/nope\.js does not exist/);
  });
});

describe.each(FIXTURES)('%s: the UI engine reads the project as the CLI does', fixture => {
  const root = join(EXAMPLES, fixture), p = requireProject(root);

  it('status rows match `artgen status`', async () => {
    const { project } = await engineFor(p.art);
    const ui = await project.status(), cli = await projectStatus(p);
    const pick = (r: { id: string; status: string; final?: string; score?: number; gate?: boolean; issues: string[]; why: string }) =>
      ({ id: r.id, status: r.status, final: r.final, score: r.score, gate: r.gate, issues: r.issues, why: r.why });
    expect(ui.map(pick)).toEqual(cli.map(pick));
  }, 120_000);

  it('renders every final pixel-identical to the CLI, with the same gate', async () => {
    const { project } = await engineFor(p.art);
    for (const row of await project.status()) {
      if (!row.final) continue;
      const b = readBriefs(p).find(x => x.id === row.id)!, cli = await cliRender(openAsset(assetPathOf(p, b)), row.final);
      const ui = await project.renderVersion(project.asset(row.id), row.final);
      expect(strip(ui.render).hash(), `${row.id} ${row.final}`).toBe(strip(cli.render).hash());
      expect(ui.report.pass).toBe(cli.report.pass);
    }
  }, 120_000);

  it('analytics cover every brief', async () => {
    const { project } = await engineFor(p.art);
    const { report } = project.analytics();
    expect(report.assets).toBe(readBriefs(p).length);
  }, 60_000);
});

describe('writes match the CLI (on a copy of swamp-topdown)', () => {
  let tmp: string, root: string;
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'artgen-ui-'));
    root = join(tmp, 'swamp-topdown');
    cpSync(join(EXAMPLES, 'swamp-topdown'), root, { recursive: true, filter: s => !s.includes('node_modules') });
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('feedback: same version opened, same entry (plus via)', async () => {
    const p = requireProject(root), { project } = await engineFor(p.art);
    const ui = await project.feedback('reeds', { route: 'finish', note: 'tips too bright', region: [3, 2, 4, 4], cell: 'idle/s/0' });
    const cli = await cliFeedback(p, 'reeds', { route: 'finish', note: 'tips too bright', region: [3, 2, 4, 4], cell: 'idle/s/0' });
    expect(ui.opens).toBe(cli.opens);
    const last = parseLedger(readFileSync(join(p.art, 'ledger.jsonl'), 'utf8')).pop()!;
    const { ts: _ts, ...cliEntry } = last;
    const { via, ...uiEntry } = ui.entry as Record<string, unknown>;
    expect(via).toBe('image-tools');
    expect(uiEntry).toEqual(cliEntry);
  }, 60_000);

  it('approve refuses what the CLI refuses', async () => {
    const p = requireProject(root), { project } = await engineFor(p.art);
    await expect(project.approve('lantern-post')).rejects.toThrow(/lantern-post is exported: only a final asset can be approved/);
    await expect(cliApprove(p, 'lantern-post')).rejects.toThrow(/lantern-post is exported: only a final asset can be approved/);
  }, 60_000);

  it('lock: same direction.json and anchors as `artgen direction lock`', async () => {
    const p = requireProject(root);
    writeDraft(p, undefined, 'next');
    const { project } = await engineFor(p.art);
    const ui = await project.lock('next', 'test lock');
    await cliLock(p, 'next', { note: 'test lock' });
    const written = Object.fromEntries(ui.ops.filter(o => o.op === 'write').map(o => [o.path, o.data]));
    expect(JSON.parse(written['direction.json'] as string)).toEqual(JSON.parse(readFileSync(join(p.art, 'direction.json'), 'utf8')));
    for (const k of ['character', 'prop', 'tile', 'effect']) {
      const a = decodePNG(written[`anchors/${k}.png`] as Uint8Array), b = decodePNG(new Uint8Array(readFileSync(join(p.art, 'anchors', `${k}.png`))));
      expect(a.hash(), k).toBe(b.hash());
    }
    expect(ui.direction.version).toBe(JSON.parse(readFileSync(join(p.art, 'direction.json'), 'utf8')).version);
  }, 120_000);
});

describe('maps, dungeons and settlements in Asset Review match the CLI (a maps-only project)', () => {
  let tmp: string, root: string;
  const art = () => join(root, 'art');
  const project = () => requireProject(root);
  const cli = async (...argv: string[]) => { const log = vi.spyOn(console, 'log').mockImplementation(() => {}); try { return await cliMain([...argv, '--root', root]); } finally { log.mockRestore(); } };
  const lineOf = (op: { op: string; path?: string; data?: unknown }) => { const { ts: _ts, ...e } = JSON.parse(String(op.data)); return e as Record<string, unknown>; };
  const lastLedger = () => { const { ts: _ts, ...e } = parseLedger(readFileSync(join(art(), 'ledger.jsonl'), 'utf8')).pop()!; return e as Record<string, unknown>; };
  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'artgen-ui-maps-'));
    root = tmp;
    initProject(root);
    await cli('map', 'new', 'keep', '--preset', 'local', '--size', '12x9', '--seed', '3');
    await cli('map', 'version', 'keep', '--note', 'first');
    await cli('dungeon', 'new', 'warren', '--seed', '2', '--rooms', '4', '--size', '24x18');
    await cli('dungeon', 'version', 'warren');
    await cli('settlement', 'new', 'ford', '--kind', 'hamlet', '--seed', '3', '--size', '30x22');
  }, 60_000);
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  const pickRow = (r: { kind: string; id: string; status: string; version?: string; why: string; fail: number; flag: number }) => ({ kind: r.kind, id: r.id, status: r.status, version: r.version, why: r.why, fail: r.fail, flag: r.flag });
  const cliRows = () => (['map', 'dungeon', 'settlement'] as const).flatMap(k => statusRows(project(), k));

  it('lists the maps with no locked art direction, with the status the CLI gives; art rows are empty then', async () => {
    const { project: ui } = await engineFor(art());
    expect(await ui.status()).toEqual([]);
    expect(ui.subjects().map(pickRow)).toEqual(cliRows().map(pickRow));
    expect(ui.subjects().map(r => [r.id, r.status])).toEqual([['keep', 'final'], ['warren', 'final'], ['ford', 'in-pipeline']]);
    expect(ui.subjects().every(r => r.pass === (r.fail === 0))).toBe(true);
    expect(ui.analytics().report.assets).toBe(0);
  });

  it('the detail has the versions with their notes, the checks and the data sheet the CLI writes', async () => {
    const { project: ui } = await engineFor(art()), d = ui.subjectDetail('map', 'keep');
    expect(d.versions).toEqual([expect.objectContaining({ version: 'v1', note: 'first', by: 'agent' })]);
    expect(d.row).toMatchObject({ key: 'map:keep', status: 'final', version: 'v1', pass: true });
    const cliSheet = writeSheet(project(), 'map', 'keep').sheet, rows = (x: { rows: { label: string }[] }) => x.rows.filter(r => r.label !== 'Version');
    expect({ ...d.sheet, rows: rows(d.sheet) }).toEqual({ ...cliSheet, rows: rows(cliSheet) });
    expect(d.markdown).toContain('# keep — terrain map');
    expect(ui.subjectFile('map', 'keep', 'v1')).toBe(readFileSync(join(art(), 'maps/keep/map.v1.json'), 'utf8'));
    expect(() => ui.subjectFile('map', 'keep', 'v9')).toThrow(/no v9 \(have v1\)/);
    expect(() => ui.subjectDetail('map', 'nope')).toThrow(/no map nope/);
  });

  it('refuses what the CLI refuses, with the same words', async () => {
    const { project: ui } = await engineFor(art());
    for (const [kind, id] of [['settlement', 'ford']] as const) {
      const cliMsg = await Promise.resolve().then(() => cliApproveSubject(project(), kind, id)).then(() => '', (e: Error) => e.message);
      expect(cliMsg).toMatch(/ford is in-pipeline \(no version recorded yet: artgen settlement version ford\)/);
      expect(() => ui.approveSubject(kind, id)).toThrow(cliMsg);
      expect(() => ui.feedbackSubject(kind, id, { note: 'x' })).toThrow(/no version yet/);
    }
    expect(() => ui.feedbackSubject('map', 'keep', { note: '  ' })).toThrow(/--note/);
    expect(() => ui.feedbackSubject('map', 'keep', { note: 'x', region: [1, 2] })).toThrow(/x,y,w,h/);
  });

  it('approve: the same entry the CLI writes (plus via); then the status follows the file in both', async () => {
    const { project: ui } = await engineFor(art()), ops = ui.approveSubject('map', 'keep', 'good map');
    expect(ops).toEqual([{ op: 'append', path: 'ledger.jsonl', data: expect.stringMatching(/\n$/) }]);
    const entry = lineOf(ops[0]);
    cliApproveSubject(project(), 'map', 'keep', { note: 'good map' });
    const { via, ...uiEntry } = entry;
    expect(via).toBe('image-tools');
    expect(uiEntry).toEqual(lastLedger());
    expect(uiEntry).toMatchObject({ type: 'approve', asset: 'map:keep', version: 'v1', by: 'user', note: 'good map' });
    expect((await engineFor(art())).project.subjects().map(pickRow)).toEqual(cliRows().map(pickRow));
    expect(cliRows().find(r => r.id === 'keep')).toMatchObject({ status: 'approved' });
    // an edit after the approval: stale in both
    await cli('map', 'edit', 'keep', 'road', '--points', '0,3,9,3');
    const after = (await engineFor(art())).project;
    expect(after.subjects().find(r => r.id === 'keep')).toMatchObject({ status: 'stale', why: 'edited since approved v1: record a version' });
    expect(after.subjects().map(pickRow)).toEqual(cliRows().map(pickRow));
    expect(after.subjectDiff('map', 'keep', 'v1', 'working')).toEqual([expect.stringMatching(/^\+ edits\[0\]/)]);
    expect(() => after.approveSubject('map', 'keep')).toThrow(/is stale \(edited since approved v1/);
  }, 60_000);

  it('feedback: the same entry (plus via), and the revision shows in both', async () => {
    await cli('dungeon', 'approve', 'warren');
    const { project: ui } = await engineFor(art()), ops = ui.feedbackSubject('dungeon', 'warren', { note: 'wider corridors', region: [2, 2, 6, 4] });
    const { via, ...uiEntry } = lineOf(ops[0]);
    cliFeedbackSubject(project(), 'dungeon', 'warren', { note: 'wider corridors', region: [2, 2, 6, 4] });
    expect(via).toBe('image-tools');
    expect(uiEntry).toEqual(lastLedger());
    const next = (await engineFor(art())).project;
    expect(next.subjects().find(r => r.id === 'warren')).toMatchObject({ status: 'revision' });
    expect(next.subjects().map(pickRow)).toEqual(cliRows().map(pickRow));
    expect(next.subjectDetail('dungeon', 'warren').feedback).toEqual([expect.objectContaining({ note: 'wider corridors', region: [2, 2, 6, 4] })]);
  }, 60_000);

  it('a locked map direction stales the approvals under another one, in both', async () => {
    await cli('map', 'version', 'keep');
    await cli('map', 'approve', 'keep');
    await cli('map', 'direction', '--theme', 'map=bw', '--lock');
    const ui = (await engineFor(art())).project;
    expect(ui.mapDirection()).toMatchObject({ id: 'maps', version: 1, status: 'locked' });
    expect(ui.subjects().find(r => r.id === 'keep')).toMatchObject({ status: 'stale', why: 'approved with no map direction, now v1' });
    expect(ui.subjectDetail('map', 'keep').theme).toBe('bw');
    expect(ui.subjects().map(pickRow)).toEqual(cliRows().map(pickRow));
    // the approval under the direction carries it
    const ops = (await engineFor(art())).project;
    await cli('map', 'feedback', 'keep', '--note', 'redo');
    await cli('map', 'edit', 'keep', 'road', '--points', '0,5,9,5');
    await cli('map', 'version', 'keep');
    const e = lineOf((await engineFor(art())).project.approveSubject('map', 'keep')[0]);
    expect(e.direction).toEqual({ id: 'maps', version: 1 });
    expect(ops).toBeDefined();
  }, 60_000);

  it('analytics add the Generators table once there is map work, with the numbers `metrics export` gives', async () => {
    const ui = (await engineFor(art())).project, { generators } = ui.analytics();
    const exported = exportMetrics(project(), { out: join(tmp, 'm.json') }).metrics.generators!;
    expect(generators).toEqual({ ...exported });
    expect(generators!.map).toMatchObject({ subjects: 1, approved: 1 });
    expect(Object.keys(generators!)).toEqual(['map', 'dungeon', 'settlement']);
  });

  it('a version recorded after the engine loaded is not seen until it reloads (the snapshot is the files at load)', async () => {
    const { project: ui } = await engineFor(art()), had = ui.subjectDetail('settlement', 'ford').versions.length;
    recordVersion(project(), 'settlement', 'ford');
    expect(ui.subjectDetail('settlement', 'ford').versions).toHaveLength(had);
    expect((await engineFor(art())).project.subjectDetail('settlement', 'ford').versions).toHaveLength(had + 1);
  });
});
