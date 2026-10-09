/**
 * Wave function collapse, simple tiled model (SPEC §6.4 `tiles`, PLAN P6b): fills a `w × h` map with tiles whose edge
 * sockets agree with their neighbours'. Seeded (R9): the same seed gives the same map. Used for layouts (rooms,
 * paths, decor scatter) and to choose among tile variants so a floor doesn't repeat one tile.
 *
 * A tile names its sockets clockwise from north, `[n, e, s, w]`; two tiles may touch when the facing sockets are equal
 * (`a.e === b.w` for a left of b, `a.s === b.n` for a above b).
 */
import { rng as mulberry } from '../lib/rng.ts';

export interface WfcTile { id: string; edges: [string, string, string, string]; weight?: number }

export interface WfcOptions {
  seed?: number;
  /** Opposite map edges are neighbours (a map that tiles). */
  periodic?: boolean;
  /** Fresh attempts after a contradiction (default 20). */
  restarts?: number;
  /** Cells fixed before solving: `fixed[y * w + x] = tile id`. */
  fixed?: Record<number, string>;
}

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], OPP = [2, 3, 0, 1];

/** Solve; returns tile ids row by row (`out[y][x]`). Throws when every attempt hits a contradiction. */
export function wfc(tiles: WfcTile[], w: number, h: number, o: WfcOptions = {}): string[][] {
  const n = tiles.length;
  if (!n) throw new Error('wfc: no tiles');
  // compat[d][a] = tiles allowed next to a in direction d
  const compat = [0, 1, 2, 3].map(d => tiles.map(a => tiles.map((b, j) => (a.edges[d] === b.edges[OPP[d]] ? j : -1)).filter(j => j >= 0)));
  const weights = tiles.map(t => t.weight ?? 1);
  for (let attempt = 0; attempt <= (o.restarts ?? 20); attempt++) {
    const r = mulberry((o.seed ?? 1) * 7919 + attempt), cells: Set<number>[] = Array.from({ length: w * h }, () => new Set(tiles.map((_, i) => i)));
    const nb = (c: number, d: number) => {
      let x = (c % w) + DX[d], y = Math.floor(c / w) + DY[d];
      if (o.periodic) { x = (x + w) % w; y = (y + h) % h; } else if (x < 0 || y < 0 || x >= w || y >= h) return -1;
      return y * w + x;
    };
    const propagate = (start: number[]): boolean => {
      const queue = [...start];
      while (queue.length) {
        const c = queue.pop()!;
        for (let d = 0; d < 4; d++) {
          const m = nb(c, d);
          if (m < 0) continue;
          const allowed = new Set<number>();
          for (const a of cells[c]) for (const b of compat[d][a]) allowed.add(b);
          let changed = false;
          for (const b of [...cells[m]]) if (!allowed.has(b)) { cells[m].delete(b); changed = true; }
          if (!cells[m].size) return false;
          if (changed) queue.push(m);
        }
      }
      return true;
    };
    // an arc-consistent start: tiles that can never have a partner on some side drop out before anything collapses
    let ok = propagate(cells.map((_, i) => i));
    if (ok && o.fixed) {
      const touched: number[] = [];
      for (const [k, id] of Object.entries(o.fixed)) {
        const i = tiles.findIndex(t => t.id === id);
        if (i < 0) throw new Error(`wfc: fixed tile ${id} is not in the set`);
        cells[+k] = new Set([i]); touched.push(+k);
      }
      ok = propagate(touched);
    }
    if (!ok && !o.fixed && attempt === 0) break; // the set itself is inconsistent: no seed will help
    while (ok) {
      // lowest entropy cell still open (ties broken by the seed)
      let best = -1, be = Infinity;
      for (let c = 0; c < cells.length; c++) {
        const s = cells[c];
        if (s.size < 2) continue;
        let sw = 0, swl = 0;
        for (const i of s) { sw += weights[i]; swl += weights[i] * Math.log(weights[i]); }
        const e = Math.log(sw) - swl / sw + r() * 1e-6;
        if (e < be) { be = e; best = c; }
      }
      if (best < 0) break;
      const opts = [...cells[best]], total = opts.reduce((a, i) => a + weights[i], 0);
      let pick = r() * total, choice = opts[opts.length - 1];
      for (const i of opts) { pick -= weights[i]; if (pick <= 0) { choice = i; break; } }
      cells[best] = new Set([choice]);
      ok = propagate([best]);
    }
    if (ok) return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => tiles[[...cells[y * w + x]][0]].id));
  }
  throw new Error(`wfc: no solution after ${(o.restarts ?? 20) + 1} attempts (check the sockets: every tile needs partners on all four sides)`);
}
