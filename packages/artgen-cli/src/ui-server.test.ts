// The local review server (`artgen ui`): static files, the file API over art/, the token and the paths it refuses.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startUiServer, artPath, type UiServer } from './ui-server.ts';

const tmp = mkdtempSync(join(tmpdir(), 'artgen-ui-')), root = join(tmp, 'game'), ui = join(tmp, 'ui'), outside = join(tmp, 'outside');
let s: UiServer, base = '';
const H = () => ({ 'x-artgen-token': s.token });
const call = (path: string, init: RequestInit = {}, token = true) => fetch(base + path, { ...init, headers: { ...(token ? H() : {}), ...(init.headers as Record<string, string>) } });

beforeAll(async () => {
  mkdirSync(join(root, 'art', 'assets'), { recursive: true }); mkdirSync(ui, { recursive: true }); mkdirSync(outside);
  writeFileSync(join(root, 'art', 'artgen.config.json'), '{}');
  writeFileSync(join(root, 'art', 'ledger.jsonl'), '{"a":1}\n');
  writeFileSync(join(root, 'secret.txt'), 'not in art');
  writeFileSync(join(outside, 'x.txt'), 'outside');
  symlinkSync(outside, join(root, 'art', 'link'));
  symlinkSync(join(outside, 'planted.txt'), join(root, 'art', 'dangling.png'));   // to a file that does not exist yet
  writeFileSync(join(ui, 'index.html'), '<!doctype html><title>ui</title>');
  writeFileSync(join(ui, 'app.js'), 'export {}');
  s = await startUiServer({ root, uiDir: ui, info: { modules: ['core', 'art'] } });
  base = `http://127.0.0.1:${s.port}`;
});
afterAll(async () => { await s.close(); rmSync(tmp, { recursive: true, force: true }); });

describe('artgen ui server', () => {
  test('serves the web tools without a token, with the right types', async () => {
    const r = await fetch(base + '/');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/text\/html/);
    expect(await r.text()).toContain('<title>ui</title>');
    expect((await fetch(base + '/app.js')).headers.get('content-type')).toMatch(/javascript/);
    expect((await fetch(base + '/nope.js')).status).toBe(404);
    expect((await fetch(base + '/%2e%2e/game/secret.txt')).status).toBeGreaterThanOrEqual(400);
  });

  test('the file API needs the token', async () => {
    expect((await call('/api/info', {}, false)).status).toBe(401);
    expect((await call('/api/info', { headers: { 'x-artgen-token': 'wrong' } }, false)).status).toBe(401);
    expect((await (await call('/api/info')).json())).toEqual({ name: 'game', modules: ['core', 'art'] });
  });

  test('a request for another Host is refused (DNS rebinding)', async () => {
    const status = await new Promise<number>((ok, fail) => {
      const r = request({ host: '127.0.0.1', port: s.port, path: '/api/info', headers: { ...H(), host: 'evil.example' } }, res => { res.resume(); ok(res.statusCode!); });
      r.on('error', fail); r.end();
    });
    expect(status).toBe(403);
  });

  test('list, stat, read, write and append work on art/', async () => {
    expect(await (await call('/api/list?dir=')).json()).toEqual(['artgen.config.json', 'assets/', 'dangling.png', 'ledger.jsonl', 'link/']);
    expect(await (await call('/api/list?dir=nothing')).json()).toEqual([]);
    const st = (await (await call('/api/stat?path=ledger.jsonl')).json()) as { size: number; lastModified: number };
    expect(st.size).toBe(8);
    expect(typeof st.lastModified).toBe('number');
    expect(await (await call('/api/stat?path=missing.json')).json()).toBeNull();
    expect(await (await call('/api/read?path=ledger.jsonl')).text()).toBe('{"a":1}\n');
    expect((await call('/api/read?path=missing.json')).status).toBe(204);

    expect((await call('/api/write?path=maps/isle/map.json', { method: 'PUT', body: '{"w":1}' })).status).toBe(200);
    expect(readFileSync(join(root, 'art/maps/isle/map.json'), 'utf8')).toBe('{"w":1}');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 255, 128]);
    await call('/api/write?path=sheets/a.png', { method: 'PUT', body: png });
    expect(Buffer.from(await (await call('/api/read?path=sheets/a.png')).arrayBuffer())).toEqual(png);

    await call('/api/append?path=ledger.jsonl', { method: 'POST', body: '{"b":2}\n' });
    expect(readFileSync(join(root, 'art/ledger.jsonl'), 'utf8')).toBe('{"a":1}\n{"b":2}\n');
  });

  test('paths stay inside art/: no .., no .git, no absolute path, no link that leaves it', async () => {
    for (const bad of ['../secret.txt', 'assets/../../secret.txt', '/etc/passwd', '.git/config', 'a/.git/x', 'C:/x', 'a\\b']) {
      for (const [route, init] of [['read', {}], ['write', { method: 'PUT', body: 'x' }]] as const) {
        const r = await call(`/api/${route}?path=${encodeURIComponent(bad)}`, init);
        expect(r.status, `${route} ${bad}`).toBe(400);
      }
    }
    expect((await call('/api/read?path=link/x.txt')).status).toBe(403);
    expect((await call('/api/write?path=link/y.txt', { method: 'PUT', body: 'x' })).status).toBe(403);
    expect(() => readFileSync(join(outside, 'y.txt'))).toThrow();
    // a link to nothing would be written through to its target
    for (const [route, init] of [['write', { method: 'PUT', body: 'x' }], ['append', { method: 'POST', body: 'x' }]] as const) {
      expect((await call(`/api/${route}?path=dangling.png`, init)).status, route).toBe(403);
    }
    expect(existsSync(join(outside, 'planted.txt'))).toBe(false);
    expect((await call('/api/write?path=.GIT/config', { method: 'PUT', body: 'x' })).status).toBe(400);
    expect((await call('/api/write?path=', { method: 'PUT', body: 'x' })).status).toBe(400);
    expect(readFileSync(join(root, 'secret.txt'), 'utf8')).toBe('not in art');
  });

  test('a malformed address is a 400, not a server error', async () => {
    for (const bad of ['/%E0%A4%A', '/%00', '/assets/%']) expect((await fetch(base + bad)).status, bad).toBe(400);
  });

  test('artPath splits a relative path and refuses the rest', () => {
    expect(artPath('a//b/c.json')).toEqual(['a', 'b', 'c.json']);
    expect(artPath('')).toEqual([]);
    expect(() => artPath('a/../b')).toThrow(/bad path/);
  });

  test('no web tools: a clear error', async () => {
    await expect(startUiServer({ root, uiDir: join(tmp, 'none') })).rejects.toThrow(/install the ui module/);
  });
});
