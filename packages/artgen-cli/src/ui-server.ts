/**
 * The local review server behind `artgen ui` (docs/TOOLING-PLAN.md §5b). It serves the static build of the web tools
 * (`tools/artgen/ui/`, the `ui` module) and gives the page the project's `art/` folder as a small file API, the same
 * operations the browser's folder backends have (`src/core/project/files.ts`): list, stat, read, write and append (a file that
 * is not there is `null` from `stat` and 204 from `read`: the page asks about many that may not exist, and a 404 would be logged
 * as an error in the browser's console each time). The
 * page therefore runs the same engine the repo's CLI does, and every approval it records is on disk at once.
 *
 * It listens on the loopback address only, and the file API needs the token printed in the link (`x-artgen-token`),
 * so another page in the user's browser, or another local program, can't read or change the project. Paths stay inside
 * `art/` (no `..`, no `.git`, no symlink that leaves it). Plain Node, no dependencies.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json; charset=utf-8',
};

/** The largest file the page may write (a project's biggest files are sprite sheets of a few MB). */
export const MAX_WRITE = 64 * 1024 * 1024;

export interface UiOptions {
  /** The game repo root (the folder holding `art/`). */
  root: string;
  /** The folder with the built web tools (`index.html` and its assets). */
  uiDir: string;
  /** The install's `tools/artgen/` folder: the page loads `/resvg.wasm` and `/fonts/…` from here (the `core` module's copies). */
  shared?: string;
  /** 0 = any free port. */
  port?: number;
  /** The access token (default: random). */
  token?: string;
  /** What the page is told about this install (`modules` from `tools/artgen/MANIFEST.json`). */
  info?: Record<string, unknown>;
}

export interface UiServer {
  url: string;
  port: number;
  token: string;
  server: Server;
  close(): Promise<void>;
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** A path from the page, relative to `art/`: `/`-separated, no `.`, `..`, empty or `.git` segments, no drive or backslash. */
export function artPath(raw: string): string[] {
  if (raw.includes('\0') || raw.includes('\\') || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) throw new HttpError(400, `bad path ${JSON.stringify(raw)}`);
  const parts = raw.split('/').filter(Boolean);
  if (parts.some(p => p === '.' || p === '..' || p.toLowerCase() === '.git')) throw new HttpError(400, `bad path ${JSON.stringify(raw)}`);
  return parts;
}

/** The `art/` folder's file API. `art` is the real path of the folder. */
export class ArtFiles {
  readonly art: string;
  constructor(root: string) {
    const art = join(resolve(root), 'art');
    if (!existsSync(art)) throw new Error(`${art} does not exist`);
    this.art = realpathSync(art);
  }

  /**
   * The absolute path of `parts` under `art/`, refusing one that leaves it through a symbolic link. Every part that exists
   * is looked at, so a link to a folder outside, and a link to nothing (which a write would create the target of), are both refused.
   */
  private at(parts: string[]): string {
    let cur = this.art;
    for (const part of parts) {
      cur = join(cur, part);
      const l = lstatSync(cur, { throwIfNoEntry: false });
      if (!l) break;   // this part and the rest don't exist yet
      if (l.isSymbolicLink()) {
        let real: string;
        try { real = realpathSync(cur); } catch { throw new HttpError(403, 'path leaves art/'); }
        if (real !== this.art && !real.startsWith(this.art + sep)) throw new HttpError(403, 'path leaves art/');
      }
    }
    return join(this.art, ...parts);
  }

  list(dir: string): string[] {
    const p = this.at(artPath(dir));
    if (!existsSync(p) || !statSync(p).isDirectory()) return [];
    return readdirSync(p, { withFileTypes: true }).filter(e => e.name !== '.git').map(e => (e.isDirectory() || (e.isSymbolicLink() && statSync(join(p, e.name), { throwIfNoEntry: false })?.isDirectory()) ? `${e.name}/` : e.name)).sort();
  }

  stat(path: string): { size: number; lastModified: number } | undefined {
    const s = statSync(this.at(artPath(path)), { throwIfNoEntry: false });
    return s?.isFile() ? { size: s.size, lastModified: Math.trunc(s.mtimeMs) } : undefined;
  }

  read(path: string): Buffer | undefined {
    const p = this.at(artPath(path));
    return statSync(p, { throwIfNoEntry: false })?.isFile() ? readFileSync(p) : undefined;
  }

  write(path: string, data: Uint8Array): void {
    const parts = artPath(path);
    if (!parts.length) throw new HttpError(400, 'no file name');
    const p = this.at(parts);
    mkdirSync(dirname(p), { recursive: true });
    this.at(parts);   // the folders just made are inside art/ too
    writeFileSync(p, data);
  }

  append(path: string, data: Uint8Array): void {
    const parts = artPath(path);
    if (!parts.length) throw new HttpError(400, 'no file name');
    const p = this.at(parts);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, data);
  }
}

const sameToken = (a: string, b: string): boolean => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of req) {
    n += (c as Buffer).length;
    if (n > MAX_WRITE) throw new HttpError(413, 'too large');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks);
}

const send = (res: ServerResponse, status: number, data: string | Buffer, type = 'application/json; charset=utf-8', extra: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
  res.end(data);
};

/** Start the server. Resolves once it is listening. */
export async function startUiServer(o: UiOptions): Promise<UiServer> {
  const files = new ArtFiles(o.root), ui = resolve(o.uiDir), token = o.token ?? randomBytes(16).toString('hex');
  if (!existsSync(join(ui, 'index.html'))) throw new Error(`no web tools in ${ui} — install the ui module: npx -y github:rstevenson1237/image_tools#artgen-dist add ui`);
  let port = 0;
  const hostOk = (h: string | undefined) => h === `127.0.0.1:${port}` || h === `localhost:${port}`;

  const api = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const t = req.headers['x-artgen-token'];
    if (typeof t !== 'string' || !sameToken(t, token)) throw new HttpError(401, 'missing or wrong token — open the link `artgen ui` printed');
    const path = url.searchParams.get('path') ?? '', route = url.pathname.slice('/api/'.length);
    if (req.method === 'GET' && route === 'info') return send(res, 200, JSON.stringify({ name: basename(resolve(o.root)), ...o.info }));
    if (req.method === 'GET' && route === 'list') return send(res, 200, JSON.stringify(files.list(url.searchParams.get('dir') ?? '')));
    // a file that isn't there is an answer, not an error (the page asks about many that may not exist): `stat` says null, `read` says 204
    if (req.method === 'GET' && route === 'stat') return send(res, 200, JSON.stringify(files.stat(path) ?? null));
    if (req.method === 'GET' && route === 'read') { const b = files.read(path); return b ? send(res, 200, b, 'application/octet-stream') : send(res, 204, ''); }
    if (req.method === 'PUT' && route === 'write') { files.write(path, await body(req)); return send(res, 200, '{}'); }
    if (req.method === 'POST' && route === 'append') { files.append(path, await body(req)); return send(res, 200, '{}'); }
    throw new HttpError(404, `no such call: ${req.method} /api/${route}`);
  };

  const serve = (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'GET only');
    let decoded: string;
    try { decoded = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'bad address'); }
    if (decoded.includes('\0')) throw new HttpError(400, 'bad address');
    const rel = decoded.replace(/^\/+/, '') || 'index.html';
    const base = o.shared && (rel === 'resvg.wasm' || /^fonts\/[^/]+$/.test(rel)) ? resolve(o.shared) : ui;
    const f = resolve(base, rel);
    if (f !== base && !f.startsWith(base + sep)) throw new HttpError(403, 'outside the web tools');
    if (!statSync(f, { throwIfNoEntry: false })?.isFile()) throw new HttpError(404, 'not found');
    send(res, 200, req.method === 'HEAD' ? '' : readFileSync(f), TYPES[extname(f).toLowerCase()] ?? 'application/octet-stream', { 'cache-control': 'no-cache' });
  };

  const server = createServer((req, res) => {
    void (async () => {
      try {
        // a page on another origin can reach 127.0.0.1 with the browser's own network; the Host check stops DNS rebinding
        if (!hostOk(req.headers.host)) throw new HttpError(403, 'unexpected Host header');
        let url: URL;
        try { url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`); } catch { throw new HttpError(400, 'bad address'); }
        if (url.pathname.startsWith('/api/')) await api(req, res, url); else serve(req, res, url);
      } catch (e) {
        const status = e instanceof HttpError ? e.status : 500;
        if (!res.headersSent) send(res, status, JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        else res.end();
      }
    })();
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(o.port ?? 0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      ok({ url: `http://127.0.0.1:${port}/?t=${token}`, port, token, server, close: () => new Promise<void>(r => { server.close(() => r()); server.closeAllConnections(); }) });
    });
  });
}
