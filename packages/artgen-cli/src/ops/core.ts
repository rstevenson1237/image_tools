/**
 * The core module's operations: what every install has whichever of the art and maps modules it holds. Today that is
 * `ui`, the local review server (docs/TOOLING-PLAN.md §5b). It imports only Node and `ui-server.ts`, so the maps-only
 * bundle holds it too.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startUiServer } from '../ui-server.ts';
import { defineOp, p, type OpDef } from './registry.ts';

/** Open a link in the user's browser (best effort; the link is printed either way). */
function openBrowser(url: string): void {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* no browser here */ }
}

/** The modules this repo's install holds (`tools/artgen/MANIFEST.json`); all of them when it isn't an install (a checkout of the artgen repo). */
function installedModules(root: string): string[] {
  try { return Object.keys(JSON.parse(readFileSync(join(root, 'tools', 'artgen', 'MANIFEST.json'), 'utf8')).modules ?? {}); } catch { return []; }
}

export const uiOp = defineOp({
  name: 'ui', module: 'core', effect: 'write',
  summary: 'Serve the review UI (Asset Review, Art Direction, Asset Lab, the map editors) for this repo\'s art/ on this machine.',
  params: {
    port: p.int('the port to listen on (default: any free one)', { mcp: false }),
    dir: p.str('the folder with the built web tools (default: ui/ beside this program; for development)', { mcp: false }),
    open: p.bool('open the link in the default browser', { mcp: false }),
  },
  async run(i: { port?: number; dir?: string; open?: boolean }, ctx) {
    // the install's tools/artgen/ folder: next to the bundle that is running (it holds the ui folder, resvg.wasm and fonts/)
    const project = ctx.project(), here = dirname(fileURLToPath(import.meta.url)), uiDir = i.dir ?? join(here, 'ui');
    if (!existsSync(join(uiDir, 'index.html'))) throw new Error(`ui: no web tools in ${uiDir} — install the ui module: npx -y github:rstevenson1237/image_tools#artgen-dist add ui`);
    const modules = installedModules(project.root), s = await startUiServer({ root: project.root, uiDir, shared: here, port: i.port, info: { modules } });
    console.log(`artgen ui: ${s.url}\nserving ${project.art} — Ctrl-C to stop`);
    if (i.open) openBrowser(s.url);
    const signals = ['SIGINT', 'SIGTERM'] as const;
    await new Promise<void>(done => {
      const stop = () => { for (const sig of signals) process.off(sig, stop); done(); };
      for (const sig of signals) process.on(sig, stop);
    });
    await s.close();
    return { url: s.url, stopped: true };
  },
  cli: {
    usage: '       artgen ui [--port N] [--open]                   serve the review UI for art/ on this machine (the ui module); prints the link',
    text: () => 'artgen ui: stopped',
  },
  mcp: { exclude: 'starts a server that waits for a person at a browser' },
  python: { exclude: 'starts a server that waits for a person at a browser' },
});

export const CORE_OPS: OpDef[] = [uiOp];
