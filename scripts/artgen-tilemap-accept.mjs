// Tile map acceptance (docs/TILEMAPS.md, R7c; plan §10 R7c: "Tiled and LDtk export for maps and tilesets"). In a scratch
// folder, the CLI makes a dungeon, two terrain maps (hex and square), a settlement and a pack with the bench's blob47
// grass autotile, and exports them: flat tiles, pack tiles (the swamp-topdown mud and bog water, the iso-dungeon floor,
// the grass autotile), Tiled JSON and XML, LDtk, iso and hex, and the autotile on its own (`artgen tileset`). Checks:
//
//   - Tiled's own format: every .tmj / .tmx opens in pytiled-parser (a third-party Tiled reader) with the orientation,
//     size, tile size, tile count and layers the export reported
//   - LDtk's own format: every .ldtk validates against LDtk's published JSON schema (1.5.3)
//   - the files draw the map: each Tiled map redrawn from its tile layer and tileset image alone (orthogonal, isometric
//     and staggered-hex placement, as Tiled draws them), and each LDtk level from its tile layer, match the export's
//     preview pixel for pixel
//   - the autotile's wang set: every floor cell holds the tile whose wang id matches its neighbours, so Tiled's terrain
//     brush paints with the tiles the export chose
//
//   node scripts/artgen-tilemap-accept.mjs [--out <dir>]   (npm run accept:tilemap)
// The third-party readers are Python packages, installed once into node_modules/.cache/artgen-tilemap-accept (needs
// python3 and the network the first time, as does the schema download).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildPack, decodePNG, encodePNG, Grid } from 'artgen-core';
import { openAsset, renderVersion } from '../packages/artgen-cli/src/asset.ts';
import { BENCH_ROOT } from '../packages/artgen-cli/src/bench.ts';
import { neighbourMask, reduceCorners } from '../packages/artgen-primitives/src/lib/autobits.ts';

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const root = join(import.meta.dirname, '..'), keep = arg('--out', '');
const work = keep ? resolve(keep) : mkdtempSync(join(tmpdir(), 'artgen-tilemap-accept-'));
mkdirSync(work, { recursive: true });
const failures = [];
const ok = (cond, m) => { console.log(`${cond ? '  ok  ' : '  FAIL'} ${m}`); if (!cond) failures.push(m); };
const cli = (...args) => JSON.parse(execFileSync(process.execPath, [join(root, 'packages/artgen-cli/src/bin.ts'), ...args, '--json'], { cwd: work, encoding: 'utf8' }));
const quiet = (...args) => execFileSync(process.execPath, [join(root, 'packages/artgen-cli/src/bin.ts'), ...args], { cwd: work, encoding: 'utf8' });

// ---- the third-party readers
const cache = join(root, 'node_modules', '.cache', 'artgen-tilemap-accept'), py = join(cache, 'venv', 'bin', 'python');
const SCHEMA_URL = 'https://raw.githubusercontent.com/deepnight/ldtk/master/docs/JSON_SCHEMA.json', schema = join(cache, 'ldtk-schema.json');
mkdirSync(cache, { recursive: true });
if (!existsSync(py)) {
  execFileSync('python3', ['-m', 'venv', join(cache, 'venv')], { stdio: 'inherit' });
  execFileSync(py, ['-m', 'pip', 'install', '-q', 'pytiled-parser==2.2.9', 'jsonschema==4.23.0'], { stdio: 'inherit' });
}
if (!existsSync(schema)) execFileSync('curl', ['-sSfL', '-o', schema, SCHEMA_URL], { stdio: 'inherit' });
const READER = `
import json, sys, jsonschema, pytiled_parser, pathlib
schema = json.load(open(sys.argv[1]))
out = {}
for f in sys.argv[2:]:
    p = pathlib.Path(f)
    try:
        if p.suffix == '.ldtk':
            errs = list(jsonschema.Draft7Validator(schema).iter_errors(json.load(open(p))))
            out[f] = {'errors': [f"{list(e.path)[:6]}: {e.message[:160]}" for e in errs[:5]], 'count': len(errs)}
        else:
            m = pytiled_parser.parse_map(p)
            ts = list(m.tilesets.values())[0]
            out[f] = {'orientation': m.orientation, 'size': [m.map_size.width, m.map_size.height], 'tile': [m.tile_size.width, m.tile_size.height],
                           'tilecount': ts.tile_count, 'wangsets': len(ts.wang_sets or []), 'layers': [l.name for l in m.layers]}
    except Exception as e:
        out[f] = {'error': f"{type(e).__name__}: {e}"}
print(json.dumps(out))
`;
writeFileSync(join(cache, 'read.py'), READER);
console.log(`· readers: pytiled-parser 2.2.9, jsonschema, LDtk ${JSON.parse(readFileSync(schema, 'utf8')).version} schema`);

// ---- the sources (made afresh, so --out can be reused)
for (const f of ['lair.json', 'vale.json', 'moor.json', 'ford.json']) rmSync(join(work, f), { force: true });
quiet('dungeon', 'new', '--seed', '7', '--file', 'lair.json');
quiet('map', 'new', '--seed', '3', '--file', 'vale.json');
quiet('map', 'new', '--preset', 'local', '--seed', '5', '--size', '24x16', '--file', 'moor.json');
quiet('map', 'grid', 'square', '--size', '1', '--file', 'moor.json');
quiet('settlement', 'new', '--kind', 'village', '--seed', '5', '--file', 'ford.json');
const packDir = join(work, 'bench-pack');
{
  const assets = [openAsset(join(BENCH_ROOT, 'p6', 'grass-autotile')), openAsset(join(BENCH_ROOT, 'p6', 'plank'))];
  const inputs = [];
  for (const a of assets) inputs.push({ brief: a.brief, view: 'topdown', renders: [(await renderVersion(a, 'finish.v1')).render], version: 'finish.v1', sourceHash: 'accept' });
  const built = buildPack('bench', assets[0].dir, inputs);
  mkdirSync(packDir, { recursive: true });
  built.atlases.forEach((g, i) => writeFileSync(join(packDir, built.manifest.atlases[i]), encodePNG(g)));
  writeFileSync(join(packDir, 'pack.json'), JSON.stringify(built.manifest));
}
const swamp = join(root, 'examples/swamp-topdown/public/assets/main/pack.json'), iso = join(root, 'examples/iso-dungeon/public/assets/main/pack.json');
console.log(`· sources in ${work}`);

// ---- the exports
const runs = [
  ['dungeon flat', cli('dungeon', 'export', '--file', 'lair.json', '--out', 'flat')],
  ['dungeon blob47', cli('dungeon', 'export', '--file', 'lair.json', '--pack', join(packDir, 'pack.json'), '--tiles', 'floor=grass-autotile', '--out', 'grass')],
  ['dungeon blob47 xml', cli('dungeon', 'export', '--file', 'lair.json', '--pack', join(packDir, 'pack.json'), '--tiles', 'floor=grass-autotile', '--xml', '--to', 'tiled', '--out', 'grass-xml')],
  ['dungeon iso', cli('dungeon', 'export', '--file', 'lair.json', '--pack', iso, '--tiles', 'floor=floor', '--out', 'iso')],
  ['terrain hex', cli('map', 'export', '--file', 'vale.json', '--out', 'hex')],
  ['terrain square', cli('map', 'export', '--file', 'moor.json', '--out', 'moor')],
  ['settlement swamp', cli('settlement', 'export', '--file', 'ford.json', '--pack', swamp, '--tiles', 'ground=mud,water=bog-water', '--out', 'swamp')],
  ['tileset blob47', cli('tileset', 'grass-autotile', '--pack', join(packDir, 'pack.json'), '--out', join(work, 'tileset'))],
];
for (const [name, r] of runs) console.log(`· ${name}: ${r.size.join('×')} ${r.orientation}, ${r.tile.join('×')} px, ${r.tiles} tiles, ${r.objects} objects → ${r.files.filter(f => !f.endsWith('.png')).map(f => f.split('/').pop()).join(' ')}`);
const abs = f => resolve(work, f);
const files = runs.flatMap(([, r]) => r.files.map(abs));

// ---- third-party readers
const read = JSON.parse(execFileSync(py, [join(cache, 'read.py'), schema, ...files.filter(f => /\.(tmj|tmx|ldtk)$/.test(f))], { encoding: 'utf8' }));
for (const [name, r] of runs) {
  for (const f of r.files.filter(x => /\.(tmj|tmx)$/.test(x))) {
    const got = read[abs(f)];
    ok(!got.error && got.orientation === r.orientation && got.size.join() === r.size.join() && got.tile.join() === r.tile.join() && got.tilecount === r.tiles && got.layers[0] === 'ground',
      `${name}: pytiled-parser reads ${f.split('/').pop()} (${got.error ?? `${got.orientation} ${got.size.join('×')}, ${got.tile.join('×')} px, ${got.tilecount} tiles, ${got.layers.length} layers, ${got.wangsets} wang sets`})`);
  }
  for (const f of r.files.filter(x => x.endsWith('.ldtk'))) {
    const got = read[abs(f)];
    ok(!got.error && got.count === 0, `${name}: ${f.split('/').pop()} validates against the LDtk schema${got.count ? `: ${got.errors.join('; ')}` : ''}${got.error ? `: ${got.error}` : ''}`);
  }
}

// ---- redraw each map from its files alone, as Tiled and LDtk place tiles, and compare with the preview
const png = f => decodePNG(new Uint8Array(readFileSync(f)));
const same = (a, b) => a.w === b.w && a.h === b.h && Buffer.compare(Buffer.from(a.d), Buffer.from(b.d)) === 0;
function drawTiled(tmjFile) {
  const dir = tmjFile.replace(/[^/]+$/, ''), map = JSON.parse(readFileSync(tmjFile, 'utf8')), ts = JSON.parse(readFileSync(dir + map.tilesets[0].source, 'utf8'));
  const sheet = png(dir + ts.image), { width: W, height: H, tilewidth: tw, tileheight: th } = map, iw = ts.tilewidth, ih = ts.tileheight, lift = ih - th;
  let place, cw, ch;
  if (map.orientation === 'isometric') { cw = (W + H) * (tw / 2); ch = (W + H) * (th / 2) + lift; place = (x, y) => [(x - y + H - 1) * (tw / 2), (x + y) * (th / 2)]; }
  else if (map.orientation === 'hexagonal') { const col = (tw + map.hexsidelength) / 2; cw = Math.ceil((W - 1) * col + tw); ch = H * th + Math.ceil(th / 2) + lift; place = (x, y) => [Math.round(x * col), y * th + (x % 2 ? Math.round(th / 2) : 0)]; }
  else { cw = W * tw; ch = H * th + lift; place = (x, y) => [x * tw, y * th]; }
  const out = new Grid(cw, ch).fill(0, 0, cw, ch, '#1e1e24');
  map.layers[0].data.forEach((gid, i) => {
    if (!gid) return;
    const t = gid - map.tilesets[0].firstgid, [px, py] = place(i % W, Math.floor(i / W));
    out.over(sheet.crop((t % ts.columns) * iw, Math.floor(t / ts.columns) * ih, iw, ih), px, py);
  });
  return out;
}
function drawLdtk(file) {
  const dir = file.replace(/[^/]+$/, ''), p = JSON.parse(readFileSync(file, 'utf8')), level = p.levels[0], ts = p.defs.tilesets[0], sheet = png(dir + ts.relPath), G = ts.tileGridSize;
  const out = new Grid(level.pxWid, level.pxHei).fill(0, 0, level.pxWid, level.pxHei, '#1e1e24');
  for (const t of level.layerInstances.find(l => l.__type === 'Tiles').gridTiles) out.over(sheet.crop(t.src[0], t.src[1], G, G), t.px[0], t.px[1]);
  return out;
}
for (const [name, r] of runs) {
  const preview = png(abs(r.files.find(f => f.endsWith('-preview.png'))));
  const tmj = r.files.find(f => f.endsWith('.tmj')), ldtk = r.files.find(f => f.endsWith('.ldtk'));
  if (tmj) ok(same(drawTiled(abs(tmj)), preview), `${name}: the Tiled map drawn from its files matches the preview (${preview.w}×${preview.h} px)`);
  if (ldtk) ok(same(drawLdtk(abs(ldtk)), preview), `${name}: the LDtk level drawn from its files matches the preview`);
}

// ---- the wang set picks the tile the export chose
for (const name of ['dungeon blob47', 'tileset blob47']) {
  const r = runs.find(x => x[0] === name)[1], tmj = abs(r.files.find(f => f.endsWith('.tmj'))), map = JSON.parse(readFileSync(tmj, 'utf8'));
  const ts = JSON.parse(readFileSync(tmj.replace(/[^/]+$/, '') + map.tilesets[0].source, 'utf8')), ws = ts.wangsets[0], W = map.width, H = map.height, data = map.layers[0].data;
  const mine = new Set(ws.wangtiles.map(w => w.tileid + 1)), byId = new Map(ws.wangtiles.map(w => [w.wangid.join(), w.tileid + 1]));
  const inSet = (x, y) => x < 0 || y < 0 || x >= W || y >= H || mine.has(data[y * W + x]);
  let cells = 0, right = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mine.has(data[y * W + x])) {
    const m = reduceCorners(neighbourMask(x, y, inSet)), want = [1, 2, 4, 8, 16, 32, 64, 128].map(b => (m & b ? 1 : 2)).join();
    cells++; if (byId.get(want) === data[y * W + x]) right++;
  }
  ok(cells > 0 && right === cells && ws.wangtiles.length === 47, `${name}: the wang set (${ws.type}, ${ws.wangtiles.length} tiles) gives every one of ${cells} cells the tile it holds`);
}

console.log(failures.length ? `\n${failures.length} failed` : `\nall passed (${work})`);
process.exit(failures.length ? 1 : 0);
