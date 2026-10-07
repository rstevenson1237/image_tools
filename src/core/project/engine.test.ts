/**
 * The UI's engine against the CLI on the fixture game repos (`examples/`): same status rows, same renders, same
 * approval and feedback entries, same lock output. The UI and Claude Code share files (SPEC §13.3), so any drift
 * between the two readings of those files is a bug.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodePNG, parseLedger } from 'artgen-core';
import {
  approve as cliApprove, assetPathOf, feedback as cliFeedback, initNodeSvg, lock as cliLock, openAsset, projectStatus,
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
    await expect(project.approve('mud')).rejects.toThrow(/mud is exported: only a final asset can be approved/);
    await expect(cliApprove(p, 'mud')).rejects.toThrow(/mud is exported: only a final asset can be approved/);
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
