// W2 on disk (PLAN P3): briefs → make (autonomous ticks) → final → gallery → feedback on both U-stage routes →
// approve → export → direction v2 → restyle (diff sheet, back to final) → a hand edit survives the restyle; analytics.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { decodePNG, encodePNG, parseLedger, type AnimContract, type PackManifest } from 'artgen-core';
import { openAsset, renderVersion } from './asset.ts';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { main } from './cli.ts';
import { readJson, writeJson } from './project.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
afterEach(() => vi.restoreAllMocks());

describe('W2 production in a scratch game repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-w2-')), R = ['--root', root];
  const art = (...p: string[]) => join(root, 'art', ...p);
  const ledger = () => parseLedger(readFileSync(art('ledger.jsonl'), 'utf8'));

  /**
   * Drive one asset like the agent would: write each version the pass machine asks for, review and score it. Blind
   * re-scores of finals (rev 9) come from `blind`, else they equal the final's own score (no gap).
   */
  async function drive(id: string, scores: number[], blind: number[] = []) {
    let own = 6.5;
    for (let guard = 0; guard < 12; guard++) {
      const m = await json('make', id, ...R);
      const step = m.next?.step;
      if (!step) return m;
      const dir = join(root, m.next.path);
      if (step.action === 'write-base' && step.version !== 'base.v1') {
        const from = readFileSync(join(dir, `${step.from}.js`), 'utf8');
        writeFileSync(join(dir, `${step.version}.js`), `// ${step.version} (${step.pass}) from ${step.from}: revision ${guard}\n${from}`);
      } else if (step.action === 'write-finish') await run('finish', dir, '--base', step.base, ...R);
      else if (step.action === 'review') {
        await run('review', id, '--version', step.version, ...R);
        own = scores.shift() ?? 6.5;
        await run('score', id, step.version, String(own), '--note', 'test', '--reviewer', 'art-reviewer', ...R);
      } else if (step.action === 'blind-review') {
        await run('review', id, '--version', step.version, '--blind', ...R);
        await run('score', id, step.version, String(blind.shift() ?? own), '--blind', '--reviewer', 'fresh-reviewer', '--note', 'blind test', ...R);
      }
    }
    throw new Error('drive: no progress');
  }

  beforeAll(async () => {
    await run('init', ...R);
    // these runs script exactly three revision passes per asset: drop init's per-kind budgets (props at 4)
    const cfg = readJson<{ budget: { perKind?: unknown } }>(art('artgen.config.json'));
    delete cfg.budget.perKind;
    writeJson(art('artgen.config.json'), cfg);
    await run('direction', 'candidates', '--pitch', 'Grim swamp roguelike: bog goblins and leeches in the fog, a lantern as the only warm light.', ...R);
    await run('direction', 'lock', 'a', ...R);
  }, 60_000);

  test('brief add / list: validated entries in art/briefs.yaml', async () => {
    await run('brief', 'add', 'crate', '--kind', 'prop', '--notes', 'half-sunk crate', '--priority', '1', ...R);
    const g = await json('brief', 'add', 'goblin', '--kind', 'character', '--directions', '8', '--anims', 'walk:4', '--swaps', 'red:cloth=accent', '--variants', '2', ...R);
    expect(g.brief).toMatchObject({ states: ['idle', 'walk'], anims: { walk: { frames: 4 } }, swaps: { red: { cloth: 'accent' } } });
    expect((await json('brief', 'list', ...R)).map((b: { id: string }) => b.id)).toEqual(['crate', 'goblin']);
    expect(readFileSync(art('briefs.yaml'), 'utf8')).toContain('# Asset briefs');
    await expect(run('brief', 'add', 'Bad', '--kind', 'prop', ...R)).rejects.toThrow(/id must be/);
  });

  test('make scaffolds from templates and names the next step in priority order', async () => {
    const m = await json('make', ...R);
    expect(m.scaffolded).toEqual(['art/assets/prop/crate/base.v1.js', 'art/assets/character/goblin/base.v1.js']);
    expect(m.next).toMatchObject({ id: 'crate', step: { action: 'review', version: 'base.v1' } });
    expect(readJson<{ template: string }>(art('assets', 'character', 'goblin', 'brief.json')).template).toBe('topdown/character-walk');
    expect((await json('status', ...R)).map((r: { status: string }) => r.status)).toEqual(['in-pipeline', 'in-pipeline']);
  });

  test('the autonomous run: v1 → v2 → v3 (best kept) → finish → final, without questions', async () => {
    const m = await drive('crate', [5, 6.5, 6, 7]);
    expect(m.rows.find((r: { id: string }) => r.id === 'crate')).toMatchObject({ status: 'final', final: 'finish.v1', score: 7 });
    const st = ledger().filter(e => e.asset === 'crate');
    expect(st.find(e => e.type === 'status')).toMatchObject({ status: 'final', version: 'finish.v1', by: 'agent' });
    const scores = st.filter(e => e.type === 'score' && !e.blind);
    expect(scores.map(e => e.pass)).toEqual(['r1', 'r2', 'r3', 'f']);
    expect(scores[1]).toMatchObject({ delta: 1.5, model: 'default', effort: 'default' });
    expect(scores[3]).toMatchObject({ base: 'base.v2', delta: 0.5 });
    expect(typeof scores[1].wallMs).toBe('number');
    const g = await drive('goblin', [5.5, 6, 6.5, 7]);
    expect(g.next).toBeUndefined();
    // 8 facings × (idle + 4 walk frames): the review sheet shows unique facings as rows, not one 40-cell strip
    const rv = [...ledger()].reverse().find(e => e.type === 'review' && e.asset === 'goblin')!;
    const sheet = decodePNG(new Uint8Array(readFileSync(art(rv.sheet!))));
    expect(sheet.h).toBeGreaterThan(sheet.w / 3);
  }, 60_000);

  test('gallery of finished assets, then feedback on both routes (U stage) and back to final', async () => {
    const gal = await json('gallery', ...R);
    expect(gal.assets.map((a: { id: string }) => a.id)).toEqual(['crate', 'goblin']);
    expect(existsSync(join(root, gal.sheets[0]))).toBe(true);
    await expect(run('approve', 'crate', ...R)).resolves.toMatchObject({ code: 0 });
    const fb = await json('feedback', 'goblin', '--route', 'base', '--note', 'ears bigger', ...R);
    expect(fb).toMatchObject({ opens: 'base.v4', next: { action: 'write-base', version: 'base.v4', pass: 'u1', from: 'base.v3' } });
    expect((await json('status', 'goblin', ...R))[0].status).toBe('revision');
    await drive('goblin', [6.8, 7]);
    expect((await json('status', 'goblin', ...R))[0]).toMatchObject({ status: 'final', final: 'finish.v2' });
    const fb2 = await json('feedback', 'goblin', '--route', 'finish', '--note', 'one more eye pixel', '--cell', 'idle/s/0', ...R);
    expect(fb2.next).toMatchObject({ action: 'write-finish', version: 'finish.v3', base: 'base.v4' });
    await drive('goblin', [7.5]);
    expect((await json('status', 'goblin', ...R))[0]).toMatchObject({ status: 'final', final: 'finish.v3', score: 7.5 });
    expect(ledger().filter(e => e.asset === 'goblin' && e.type === 'score' && !e.blind).map(e => e.pass)).toEqual(['r1', 'r2', 'r3', 'f', 'u1', 'f2', 'f3']);
  }, 60_000);

  test('approve (gate + sheet) → export: atlas, pack.json, Aseprite JSON, assets.ts; exported status', async () => {
    await expect(run('approve', 'nope', ...R)).rejects.toThrow(/no brief/);
    await run('approve', 'goblin', '--note', 'user ok', ...R);
    expect(existsSync(art('sheets', 'approved', 'goblin-finish.v3.png'))).toBe(true);
    expect((await json('status', ...R)).map((r: { status: string }) => r.status)).toEqual(['approved', 'approved']);
    const ex = await json('export', ...R);
    expect(ex.packs[0]).toMatchObject({ pack: 'main', assets: ['crate', 'goblin'] });
    const pack = readJson<PackManifest>(join(root, 'public/assets/main/pack.json'));
    expect(pack.assets.goblin).toMatchObject({ directions: 8, variants: ['base', 'v1', 'red'], version: 'finish.v3' });
    expect(pack.assets.goblin.frames.length).toBe(2 * 8 * 5);
    expect(existsSync(join(root, 'public/assets/main/main-0.aseprite.json'))).toBe(true);
    expect(readFileSync(join(root, 'src/art/assets.ts'), 'utf8')).toContain('main: `${base}assets/main/pack.json`');
    expect((await json('status', ...R)).map((r: { status: string }) => r.status)).toEqual(['exported', 'exported']);
  }, 60_000);

  test('export --runtime vendors the runtime + configured adapters (stamped); upgrades keep local edits unless --force', async () => {
    const rt = (...p: string[]) => join(root, 'src/art/runtime', ...p);
    const first = (await json('export', '--runtime', ...R)).runtime;
    expect(first).toMatchObject({ dir: 'src/art/runtime', version: RUNTIME_VERSION, from: null, adapters: ['canvas2d'], kept: [], removed: [] });
    expect(first.written).toEqual(expect.arrayContaining(['index.ts', 'pack.ts', 'facing.ts', 'autotile.ts', 'coords.ts', 'types.ts', 'adapters/canvas2d.ts']));
    expect(first.written.some((f: string) => /test|testkit|contract/.test(f))).toBe(false);
    expect(readJson<PackManifest>(join(root, 'public/assets/main/pack.json')).runtime).toBe(RUNTIME_VERSION);
    const stamp = readJson<{ runtime: string; files: Record<string, string> }>(rt('runtime.json'));
    expect(Object.keys(stamp.files).sort()).toEqual([...first.written].sort());
    expect(readFileSync(rt('pack.ts'), 'utf8')).toContain(`// Vendored by \`artgen export --runtime\` (artgen-runtime ${RUNTIME_VERSION})`);
    // a re-export is a no-op; a local edit is kept and reported; --force restores it
    expect((await json('export', '--runtime', ...R)).runtime).toMatchObject({ written: [], kept: [] });
    writeFileSync(rt('facing.ts'), readFileSync(rt('facing.ts'), 'utf8') + '\n// tuned for our game\n');
    const kept = (await json('export', '--runtime', ...R)).runtime;
    expect(kept).toMatchObject({ written: [], kept: ['facing.ts'] });
    expect(readFileSync(rt('facing.ts'), 'utf8')).toContain('tuned for our game');
    expect((await run('export', '--runtime', ...R)).out).toMatch(/kept locally edited runtime files .*: facing\.ts/);
    expect((await json('export', '--runtime', '--force', ...R)).runtime).toMatchObject({ written: ['facing.ts'], kept: [] });
    // switching adapters in artgen.config.json swaps the vendored adapter files
    const cfgFile = art('artgen.config.json'), cfg = readJson<{ runtime: { adapters: string[] } }>(cfgFile);
    writeJson(cfgFile, { ...cfg, runtime: { adapters: ['pixi', 'three'] } });
    const sw = (await json('export', '--runtime', ...R)).runtime;
    expect([sw.written.sort(), sw.removed]).toEqual([['adapters/pixi.ts', 'adapters/three.ts'], ['adapters/canvas2d.ts']]);
    expect(existsSync(rt('adapters/canvas2d.ts'))).toBe(false);
    writeJson(cfgFile, { ...cfg, runtime: { adapters: ['phaser'] } });
    await expect(run('export', '--runtime', ...R)).rejects.toThrow(/unknown runtime adapter "phaser".*available: canvas2d, pixi, three/);
    writeJson(cfgFile, cfg);
  }, 60_000);

  test('animation contract: frozen on first export; edits that break it are refused until --break-contract; additions extend it', async () => {
    const packFile = join(root, 'public/assets/main/pack.json'), contract = () => readJson<AnimContract>(art('contracts', 'goblin.json'));
    expect(contract()).toEqual({
      format: 1, asset: 'goblin', facings: ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'], anchors: ['eye', 'eye2', 'hand', 'head', 'mouth'],
      states: { idle: { frames: 1, durations: [125], loop: true }, walk: { frames: 4, durations: [125, 125, 125, 125], loop: true } },
    });
    expect(ledger().filter(e => e.type === 'contract').map(e => [e.asset, e.change])).toEqual([['crate', 'created'], ['goblin', 'created']]);
    // per-frame anchors ride along in pack.json, one per frame; the back view has no face
    const g = readJson<PackManifest>(packFile).assets.goblin, at = (f: string) => g.frames.findIndex(x => g.facings[x[5]] === f);
    expect(g.anchors!.hand).toHaveLength(g.frames.length);
    expect([g.anchors!.eye[at('n')], g.anchors!.hand[at('n')]?.length]).toEqual([null, 2]);
    expect(g.anchors!.eye[at('s')]).not.toBeNull();
    // changing the walk in the brief is refused…
    const goblin = ['goblin', '--kind', 'character', '--directions', '8', '--swaps', 'red:cloth=accent', '--variants', '2'];
    await expect(run('brief', 'add', ...goblin, '--anims', 'walk:6', ...R)).rejects.toThrow(/would break its exported animation contract[\s\S]*"walk": 4 → 6 logical frames/);
    // …a held passing frame is a timing change: the brief takes it with --break-contract, export still refuses and writes nothing
    await run('brief', 'add', ...goblin, '--anims', 'walk:4', '--durations', 'walk=100/100/250/100', '--break-contract', ...R);
    const before = readFileSync(packFile, 'utf8');
    await expect(run('export', ...R)).rejects.toThrow(/export refused[\s\S]*goblin: state "walk": frame durations 125,125,125,125 → 100,100,250,100 ms/);
    expect(readFileSync(packFile, 'utf8')).toBe(before);
    const ex = await json('export', '--break-contract', 'goblin', ...R);
    expect(ex.contracts).toEqual([{ id: 'goblin', change: 'broken', notes: ['state "walk": frame durations 125,125,125,125 → 100,100,250,100 ms'] }]);
    expect(contract().states.walk.durations).toEqual([100, 100, 250, 100]);
    expect(readJson<PackManifest>(packFile).assets.goblin.states.walk).toEqual({ frames: 4, fps: 8, loop: true, durations: [100, 100, 250, 100] });
    // a new state only extends the contract
    await run('brief', 'add', ...goblin, '--anims', 'walk:4,hurt:2', '--durations', 'walk=100/100/250/100', ...R);
    expect((await json('export', ...R)).contracts).toEqual([{ id: 'goblin', change: 'extended', notes: ['added state "hurt"'] }]);
    expect(Object.keys(contract().states)).toEqual(['idle', 'walk', 'hurt']);
    expect((await json('export', ...R)).contracts).toEqual([]);
  }, 60_000);

  test('a hand-edited PNG becomes token ops in the next finish; direction v2 → stale → restyle → final; the edit survives', async () => {
    const crate = openAsset(art('assets', 'prop', 'crate')), cur = await renderVersion(crate, 'finish.v1');
    const ed = cur.strip.clone(), [x, y] = (() => { for (let j = 0; j < ed.h; j++) for (let i = 0; i < ed.w; i++) if (ed.alpha(i, j) === 255 && ed.get(i, j) !== crate.dir.palette.outline) return [i, j]; return [0, 0]; })();
    const accent = crate.dir.palette.ramps.accent[0];
    ed.set(x, y, accent);
    writeFileSync(join(root, 'edited.png'), encodePNG(ed));
    const ie = await json('import-edit', 'crate', join(root, 'edited.png'), ...R);
    expect(ie).toMatchObject({ file: 'art/assets/prop/crate/finish.v2.js', pixels: 1, snapped: 0 });
    expect((await json('status', 'crate', ...R))[0].status).toBe('revision');
    await drive('crate', [7]);
    await run('approve', 'crate', ...R);
    // direction v2: a new accent ramp
    const draft = await json('direction', 'new', ...R), dfile = join(root, draft.file), d = readJson<{ palette: { ramps: Record<string, string[]> } }>(dfile);
    d.palette.ramps.accent = d.palette.ramps.accent.map((_, i) => ['#e0c060', '#b08a30', '#7a5a18', '#4a3608'][i] ?? '#4a3608');
    writeJson(dfile, d);
    await run('direction', 'lock', 'next', ...R);
    expect(existsSync(art('directions', 'v1.json'))).toBe(true);
    expect((await json('status', ...R)).map((r: { status: string }) => r.status)).toEqual(['stale', 'stale']);
    const rs = await json('restyle', ...R);
    expect(rs).toMatchObject({ from: 1, to: 2, sheet: 'art/sheets/restyle-v1-v2.png' });
    for (const a of rs.assets) expect(a).toMatchObject({ tokenSame: 1, consistent: true, gate: true, stale: [] });
    expect((await json('status', ...R)).map((r: { status: string }) => r.status)).toEqual(['final', 'final']);
    const after = await renderVersion(openAsset(art('assets', 'prop', 'crate')), 'finish.v2');
    expect(after.strip.get(x, y)).toBe(readJson<{ palette: { ramps: Record<string, string[]> } }>(art('direction.json')).palette.ramps.accent[0]);
  }, 60_000);

  test('analytics: per-pass gains, revisions vs finish, user revision rate', async () => {
    const a = await json('analytics', ...R);
    expect(a.passes.map((p: { pass: string }) => p.pass)).toEqual(['r1', 'r2', 'r3', 'f', 'u', 'f2+']);
    expect(a.userRevisionRate.byRoute).toEqual({ base: 1, finish: 2 });
    expect(a.perAsset.find((x: { id: string }) => x.id === 'crate')).toMatchObject({ r1: 5, best: 6.5, fromRevisions: 1.5 });
  });
});
