// W1 on disk (PLAN P2): init → candidates → style tile → finish a probe → mix → lock → anchors + style sheet, then
// the probes continue through the full pipeline under the locked direction. Plus new/palette and the placeholder guard.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { decodePNG, parseLedger, validateDirection } from 'artgen-core';
import { openAsset, passState } from './asset.ts';
import { main } from './cli.ts';
import { findProject } from './project.ts';
import { candidateNames, lockedDirection } from './w1.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
afterEach(() => vi.restoreAllMocks());

describe('W1 art direction in a scratch game repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-w1-')), R = ['--root', root];
  const art = (...p: string[]) => join(root, 'art', ...p);

  beforeAll(async () => {
    expect((await run('init', ...R)).code).toBe(0);
  });

  test('init scaffolds art/ once and never overwrites', async () => {
    for (const f of ['direction.json', 'briefs.yaml', 'ledger.jsonl', 'artgen.config.json', 'package.json', '.gitignore']) expect(existsSync(art(f))).toBe(true);
    expect(JSON.parse(readFileSync(art('package.json'), 'utf8')).type).toBe('module');
    expect(findProject(join(root, 'art', 'assets'))!.root).toBe(root);
    expect((await json('init', ...R)).created).toEqual([]);
  });

  test('assets cannot render against the placeholder direction', async () => {
    await run('new', 'crate', '--kind', 'prop', ...R);
    expect(() => openAsset(art('assets', 'prop', 'crate'))).toThrow(/not locked yet/);
  });

  test('candidates → three drafts and the probe set; tile → one sheet, every probe passes the gate', async () => {
    const c = await json('direction', 'candidates', '--pitch', 'Grim swamp roguelike: bog goblins and leeches in the fog.', '--mood', 'damp,eerie', ...R);
    expect(c.candidates.map((x: { name: string }) => x.name)).toEqual(['a', 'b', 'c']);
    expect(c.probes).toHaveLength(8);
    const t = await run('direction', 'tile', ...R);
    expect(t.code).toBe(0);
    const tile = await json('direction', 'tile', 'a', 'c', ...R);
    expect(tile.round).toBe(2);
    expect(tile.columns.map((x: { name: string }) => x.name)).toEqual(['a', 'c']);
    const png = decodePNG(new Uint8Array(readFileSync(join(root, tile.path))));
    expect(Math.max(png.w, png.h)).toBeLessThanOrEqual(1568);
  });

  test('a probe revision and finish show on the next tile (short pipeline)', async () => {
    const src = readFileSync(art('probes', 'prop', 'base.v1.js'), 'utf8');
    writeFileSync(art('probes', 'prop', 'base.v2.js'), src.replace("bands: { type: 'choice', options: [1, 2], default: 2 }", "bands: { type: 'choice', options: [1, 2], default: 1 }"));
    const f = await json('finish', art('probes', 'prop'));
    expect(f.base).toBe('base.v2');
    const tile = await json('direction', 'tile', 'a', ...R);
    expect(tile.columns[0].gates.prop).toBe(true);
  });

  test("mix (B as the base, A's palette) → lock: direction.json v1, anchors, style sheet, ledger", async () => {
    const m = await json('direction', 'mix', 'b', '--palette', 'a', ...R);
    expect(m.name).toBe('mix1');
    expect(candidateNames(findProject(root)!)).toEqual(['a', 'b', 'c', 'mix1']);
    const l = await json('direction', 'lock', 'mix1', '--note', 'user: B with A palette', ...R);
    expect(l.direction).toEqual({ id: 'grim-swamp-roguelike', version: 1 });
    const d = lockedDirection(findProject(root)!)!;
    expect(validateDirection(d).ok).toBe(true);
    expect(d.anchors).toEqual(['anchors/character.png', 'anchors/prop.png', 'anchors/tile.png', 'anchors/effect.png']);
    expect(d.line.outer).toBe('selout');
    for (const f of [...d.anchors, 'direction.png']) expect(existsSync(art(f))).toBe(true);
    expect(l.versions.prop).toBe('finish.v1');
    const ledger = parseLedger(readFileSync(art('ledger.jsonl'), 'utf8')).filter(e => e.asset === 'direction');
    expect(ledger.map(e => e.type)).toEqual(['note', 'review', 'review', 'review', 'note', 'approve', 'note']);
    expect(ledger.find(e => e.type === 'approve')).toMatchObject({ by: 'user', version: 'v1' });
    // locking again bumps the version
    expect((await json('direction', 'lock', 'a', ...R)).direction.version).toBe(2);
  });

  test('after lock the probes run the full pipeline under the locked direction', async () => {
    const st = await passState(openAsset(art('probes', 'prop')));
    expect(st.next).toMatchObject({ action: 'review', version: 'base.v1' });
    expect((await json('direction', 'show', ...R)).locked).toMatchObject({ id: 'grim-swamp-roguelike', version: 2 });
    const draft = await json('direction', 'new', ...R);
    expect(draft.file).toBe('art/candidates/next.json');
  });

  test('palette ramp / import / extract', async () => {
    expect((await json('palette', 'ramp', '#4a7a3a', '--steps', '4')).ramp).toHaveLength(4);
    writeFileSync(join(root, 'p.hex'), 'ff0000\n00ff00\n0000ff\n');
    const imp = await json('palette', 'import', join(root, 'p.hex'), '--interview', ...R);
    expect(imp.colors).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    expect(JSON.parse(readFileSync(art('interview.json'), 'utf8')).colors).toEqual(imp.colors);
    const ex = await json('palette', 'extract', art('anchors', 'character.png'), '--n', '6');
    expect(ex.colors.length).toBeGreaterThan(2);
  });
});
