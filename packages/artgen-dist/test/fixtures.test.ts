// The fixture game repos (examples/, PLAN §1) as W1 acceptance evidence: each went from a pitch to a locked direction
// through the committed install. Checks that the record is complete, that the anchors re-render exactly from the
// committed probe sources, and that the installed toolset matches the current distribution (fixtures are updated
// with `npm run fixtures:install` whenever the distribution changes).
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { decodePNG, parseLedger } from 'artgen-core';
import { candidateNames, lockedDirection, readJson, renderProbes, type Project } from 'artgen-cli';
import { buildDist } from '../build.mjs';
import { distFiles } from '../src/install.mjs';

const EXAMPLES = fileURLToPath(new URL('../../../examples/', import.meta.url));
const FIXTURES = ['swamp-topdown', 'iso-dungeon', 'billboard-crawler'];
const GENERATED = new Set(['tools/artgen/artgen.js', 'tools/artgen/artgen-mcp.js', 'tools/artgen/resvg.wasm']);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex').slice(0, 16);
let dist = '';

beforeAll(async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'artgen-fixtures-')), 'out');
  await buildDist(out);
  dist = join(out, 'dist');
});

describe.each(FIXTURES)('fixture %s', name => {
  const root = join(EXAMPLES, name), p: Project = { root, art: join(root, 'art') };

  test('W1 record: interview, 3 candidates + a mix, style tiles, locked direction, anchors, style sheet', () => {
    expect(readJson<{ pitch: string }>(join(p.art, 'interview.json')).pitch.length).toBeGreaterThan(80);
    expect(candidateNames(p)).toEqual(['a', 'b', 'c', 'mix1']);
    const tiles = readdirSync(join(p.art, 'candidates')).filter(f => f.startsWith('style-tile-'));
    expect(tiles.length).toBeGreaterThanOrEqual(3);
    const d = lockedDirection(p)!;
    expect(d).toMatchObject({ status: 'locked', version: 1 });
    for (const f of [...d.anchors, 'direction.png']) expect(existsSync(join(p.art, f)), f).toBe(true);
    const ledger = parseLedger(readFileSync(join(p.art, 'ledger.jsonl'), 'utf8')).filter(e => e.asset === 'direction');
    expect(ledger.find(e => e.type === 'approve')).toMatchObject({ by: 'user', direction: { id: d.id, version: 1 } });
    expect(ledger.filter(e => e.type === 'review').length).toBe(tiles.length);
  });

  test('anchors re-render exactly from the committed probe sources under the locked direction', async () => {
    const d = lockedDirection(p)!, { images } = await renderProbes(p, d);
    const strip = images.effect;
    for (const kind of ['character', 'prop', 'tile'] as const) {
      const committed = decodePNG(new Uint8Array(readFileSync(join(p.art, 'anchors', `${kind}.png`))));
      expect(images[kind].hash(), `${name} ${kind}`).toBe(committed.hash());
    }
    expect(decodePNG(new Uint8Array(readFileSync(join(p.art, 'anchors', 'effect.png')))).w).toBe(strip.reduce((n, f) => n + f.w, 0) + strip.length - 1);
  });

  test('the installed toolset matches the current distribution', () => {
    const stale: string[] = [];
    for (const [rel, src] of Object.entries(distFiles(dist) as Record<string, string>)) {
      if (GENERATED.has(rel)) continue;
      const f = join(root, rel);
      if (!existsSync(f) || sha(readFileSync(f)) !== sha(readFileSync(src))) stale.push(relative(EXAMPLES, f));
    }
    expect(stale, 'run `npm run fixtures:install` and commit the result').toEqual([]);
  });
});
