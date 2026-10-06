/**
 * Finishing pass (stage F, SPEC §6.3, R2): direct-pixel ops stored as code (`finish.vM.js`) bound to one base
 * version, so they re-apply after any re-render or restyle. Colours are direction tokens (`gold.0`, `outline`).
 *
 *   px.fix.orphans / jaggies / pillow / banding / lines     clean-up
 *   px.fx.glint / spark / glow                               small effects
 *   px.light.rim / highlight / tone / shade                  light accents
 *   px.outline.selout / inner / corners / weight             line work
 *   px.patch(g, at, rows, key)                               char-map patch (the old T1 blit), anchor-following
 *   px.set / line / fill                                     single writes
 *
 * Global ops run on every frame and facing. A patch placed at a named anchor (`ctx.at('head')`) in one cell is
 * replayed at that anchor in every other cell with the same facing that doesn't patch it itself (D15). Mirrored
 * west facings are the flipped finished east cells. Each patch records the pixels it covered; after a re-render,
 * `finishStale` reports patches whose underlying pixels changed (the asset goes back for review).
 */
import { dirContext, type DirContext, type Direction } from '../direction.ts';
import { normHex } from '../lib/color.ts';
import { Grid } from '../lib/grid.ts';
import * as post from '../lib/post.ts';
import type { Anchors, Cell, RenderResult } from '../render.ts';

export type Pt = [number, number];
/** A point that remembers which anchor it came from (patches follow it). */
export type AnchorPt = Pt & { anchor?: string };
export type Region = [number, number, number, number];

export interface OpOptions {
  /** Limit to a rectangle [x, y, w, h]. */
  region?: Region;
  /** Only pixels of these ramps. */
  ramps?: string[];
}

export interface PatchRecord {
  cell: string;
  anchor?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Colour tokens under the patch footprint before it was written (row-major, null = empty). */
  under: (string | null)[];
  /** Replayed from another cell's anchored patch. */
  replay?: boolean;
}

export interface FinishContext {
  dir: DirContext;
  lib: { px: Px; Grid: typeof Grid };
  state: string;
  facing: string;
  frame: number;
  anchors: Anchors;
  /** Anchor position (plus offset); patches placed here follow the anchor into other frames. */
  at(name: string, dx?: number, dy?: number): AnchorPt;
  /** True when this cell is `state` frame `frame` (any facing unless given). */
  key(state: string, frame?: number, facing?: string): boolean;
  /** Mark pixels that later global ops must not change (eye glints and the like). */
  protect(...pts: Pt[]): void;
}

export interface FinishModule {
  /** Base version this finish is bound to, e.g. `base.v3`. */
  base: string;
  meta?: { notes?: string };
  finish(g: Grid, ctx: FinishContext): Grid | void;
}

const N4: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export type Px = ReturnType<typeof makePx>;

/** Finishing ops bound to a direction; `record` receives every patch, `guard` the protected pixels. */
export function makePx(dc: DirContext, record: (p: Omit<PatchRecord, 'cell'>) => void = () => {}, guard = new Set<string>()) {
  const outline = dc.outline, rampOf = new Map<string, [string, number]>();
  for (const [name, r] of Object.entries(dc.pal)) r.forEach((c, i) => { if (!rampOf.has(c)) rampOf.set(c, [name, i]); });
  const [lx, ly] = dc.camera.light.map(Math.sign);

  const color = (t: string): string => {
    if (t.startsWith('#') || t.startsWith('rgb')) return normHex(t);
    if (t === 'outline') return outline;
    const [name, idx] = t.split('.'), ramp = dc.pal[name] ?? dc.pal[dc.palette.materials[name]];
    if (!ramp) throw new Error(`finish: unknown colour token ${JSON.stringify(t)}`);
    const i = idx === undefined ? 0 : idx === 'last' ? ramp.length - 1 : +idx;
    if (!(i >= 0 && i < ramp.length)) throw new Error(`finish: colour token out of range: ${t}`);
    return ramp[i];
  };
  /** Colour `k` steps darker (negative = lighter) on its own ramp; unchanged when not on a ramp. */
  const step = (c: string, k: number): string => {
    const hit = rampOf.get(c);
    if (!hit) return c;
    const r = dc.pal[hit[0]];
    return r[Math.max(0, Math.min(r.length - 1, hit[1] + k))];
  };
  /** Colour → direction token (`ramp.i`, `outline`), so snapshots survive a restyle. */
  const tokenOf = (c: string | null): string | null => {
    if (!c) return null;
    if (c === outline) return 'outline';
    const hit = rampOf.get(c);
    return hit ? `${hit[0]}.${hit[1]}` : c;
  };
  const opaque = (g: Grid, x: number, y: number) => g.alpha(x, y) === 255;
  // the outer line: outline-coloured pixels, or with `selout` every silhouette pixel (its colour is a ramp's darkest
  // step, so without this, fill ops would recolour the line and break it)
  const selout = dc.line.outer === 'selout';
  const isLine = (g: Grid, x: number, y: number) =>
    g.get(x, y) === outline || (selout && opaque(g, x, y) && N4.some(([dx, dy]) => !opaque(g, x + dx, y + dy)));
  const fill = (g: Grid, x: number, y: number) => opaque(g, x, y) && !isLine(g, x, y);
  const open = (g: Grid, x: number, y: number) => !opaque(g, x, y) || isLine(g, x, y);
  const inScope = (o: OpOptions | undefined, g: Grid, x: number, y: number) => {
    if (guard.has(`${x},${y}`)) return false;
    if (o?.region) { const [rx, ry, rw, rh] = o.region; if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) return false; }
    if (o?.ramps) { const c = g.get(x, y), hit = c && rampOf.get(c); if (!hit || !o.ramps.includes(hit[0])) return false; }
    return true;
  };
  const each = (g: Grid, o: OpOptions | undefined, fn: (x: number, y: number) => void) => {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (inScope(o, g, x, y)) fn(x, y);
  };
  /** Collect writes first so an op reads the original pixels. */
  const batch = (g: Grid, writes: [number, number, string | null][]) => {
    for (const [x, y, c] of writes) if (c === null) g.clear(x, y); else g.set(x, y, c);
    return g;
  };
  const plot = (g: Grid, x: number, y: number, c: string) => { if (!guard.has(`${x},${y}`)) g.set(x, y, c); };

  const px = {
    color, step,
    set(g: Grid, at: Pt, token: string): Grid { plot(g, at[0], at[1], color(token)); return g; },
    fill(g: Grid, [x, y, w, h]: Region, token: string): Grid { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) plot(g, i, j, color(token)); return g; },
    /** 1 px Bresenham line. */
    line(g: Grid, a: Pt, b: Pt, token: string): Grid {
      let [x0, y0] = a; const [x1, y1] = b, c = color(token);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) {
        plot(g, x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
      return g;
    },

    /**
     * Char-map patch (T1 `blit`): `rows` of characters, `.` transparent, `_` clears the pixel, others look up a
     * token in `key`. `anchor: 'center'` (default) centres the map on `at`; `'topleft'` puts its corner there.
     */
    patch(g: Grid, at: AnchorPt, rows: string[], key: Record<string, string>, o: { anchor?: 'center' | 'topleft' } = {}): Grid {
      const h = rows.length, w = Math.max(...rows.map(r => r.length));
      const x0 = o.anchor === 'topleft' ? at[0] : at[0] - (w >> 1), y0 = o.anchor === 'topleft' ? at[1] : at[1] - (h >> 1);
      const under: (string | null)[] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) under.push(tokenOf(g.get(x0 + x, y0 + y)));
      const cols: Record<string, string> = {};
      for (const [ch, t] of Object.entries(key)) cols[ch] = color(t);
      rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch === '.') return;
        if (ch === '_') g.clear(x0 + x, y0 + y); else if (cols[ch]) g.set(x0 + x, y0 + y, cols[ch]);
        else throw new Error(`patch: no key for ${JSON.stringify(ch)}`);
        guard.add(`${x0 + x},${y0 + y}`);
      }));
      record({ anchor: at.anchor, x: x0, y: y0, w, h, under, rows, key, mode: o.anchor ?? 'center' } as Omit<PatchRecord, 'cell'>);
      return g;
    },

    fix: {
      /** Single pixels whose four neighbours all differ from them take the neighbours' majority colour (≥ 3 agree). */
      orphans(g: Grid, o?: OpOptions): Grid {
        const w: [number, number, string][] = [];
        each(g, o, (x, y) => {
          const c = g.get(x, y);
          if (!c || !opaque(g, x, y) || c === outline) return;
          const n = N4.map(([dx, dy]) => (opaque(g, x + dx, y + dy) ? g.get(x + dx, y + dy) : null));
          if (n.some(v => v === c || v === null)) return;
          const counts = new Map<string, number>();
          for (const v of n) counts.set(v!, (counts.get(v!) ?? 0) + 1);
          const [best, cnt] = [...counts].sort((a, b) => b[1] - a[1])[0];
          if (cnt >= 3 && best !== outline) w.push([x, y, best]);
        });
        return batch(g, w);
      },
      /** Thin 4-connected outline stairs to 8-connected: drop elbow pixels that only touch outline and empty space. */
      jaggies(g: Grid, o?: OpOptions): Grid {
        const isO = (x: number, y: number) => opaque(g, x, y) && g.get(x, y) === outline;
        // in place, in scan order: removing one elbow can make its neighbour necessary, so decisions see earlier ones
        each(g, o, (x, y) => {
          if (!isO(x, y)) return;
          const n = N4.map(([dx, dy]) => isO(x + dx, y + dy));
          if (N4.some(([dx, dy], i) => !n[i] && opaque(g, x + dx, y + dy))) return; // touches fill: needed
          const h = n[0] || n[1], v = n[2] || n[3];
          if (n.filter(Boolean).length === 2 && h && v) g.clear(x, y);
        });
        return g;
      },
      /** Pillow shading: edge pixels on the lit side darker than the pixel inside them take the inner colour. */
      pillow(g: Grid, o?: OpOptions): Grid {
        const w: [number, number, string][] = [];
        each(g, o, (x, y) => {
          if (!fill(g, x, y)) return;
          const c = g.get(x, y)!, rc = rampOf.get(c);
          if (!rc) return;
          for (const [dx, dy] of [[lx, 0], [0, ly]] as Pt[]) {
            if (!dx && !dy) continue;
            if (!open(g, x + dx, y + dy) || !fill(g, x - dx, y - dy)) continue;
            const inner = g.get(x - dx, y - dy)!, ri = rampOf.get(inner);
            if (ri && ri[0] === rc[0] && ri[1] < rc[1]) { w.push([x, y, inner]); break; }
          }
        });
        return batch(g, w);
      },
      /** 1 px bands squeezed between a lighter and a darker step of the same ramp merge into the lighter step. */
      banding(g: Grid, o?: OpOptions): Grid {
        const w: [number, number, string][] = [];
        each(g, o, (x, y) => {
          const c = g.get(x, y), rc = c && rampOf.get(c);
          if (!rc || !fill(g, x, y)) return;
          for (const [dx, dy] of [[1, 0], [0, 1]] as Pt[]) {
            const a = g.get(x - dx, y - dy), b = g.get(x + dx, y + dy), ra = a && rampOf.get(a), rb = b && rampOf.get(b);
            if (!ra || !rb || ra[0] !== rc[0] || rb[0] !== rc[0]) continue;
            const lo = Math.min(ra[1], rb[1]), hi = Math.max(ra[1], rb[1]);
            if (!(lo < rc[1] && rc[1] < hi)) continue;
            // the band runs perpendicular: both side neighbours along the other axis share the colour
            if (g.get(x + dy, y + dx) === c && g.get(x - dy, y - dx) === c) { w.push([x, y, dc.pal[rc[0]][lo]]); break; }
          }
        });
        return batch(g, w);
      },
      /** Close outline gaps: fill pixels exposed to empty space get the direction's outer line again. */
      lines(g: Grid): Grid {
        const out = dc.line.outer === 'none' ? g : dc.line.outer === 'selout' ? post.selout(g, Object.values(dc.pal), outline) : post.outline(g, outline);
        g.d.set(out.d);
        return g;
      },
    },

    fx: {
      /** Bright pixel (`dot`), plus or x shape; default colour is the lightest step of the pixel's ramp. */
      glint(g: Grid, at: Pt, token?: string, o: { shape?: 'dot' | 'plus' | 'x' } = {}): Grid {
        const base = g.get(at[0], at[1]), c = token ? color(token) : base ? step(base, -99) : null;
        if (!c) return g;
        plot(g, at[0], at[1], c);
        const arms: Pt[] = o.shape === 'plus' ? N4 : o.shape === 'x' ? [[1, 1], [-1, -1], [1, -1], [-1, 1]] : [];
        for (const [dx, dy] of arms) if (opaque(g, at[0] + dx, at[1] + dy) && g.get(at[0] + dx, at[1] + dy) !== outline) plot(g, at[0] + dx, at[1] + dy, step(g.get(at[0] + dx, at[1] + dy)!, -1));
        return g;
      },
      /** Four-armed spark of radius r in `token` (arms may extend over empty pixels). */
      spark(g: Grid, at: Pt, token: string, r = 2): Grid {
        const c = color(token);
        plot(g, at[0], at[1], c);
        for (let k = 1; k <= r; k++) for (const [dx, dy] of N4) plot(g, at[0] + dx * k, at[1] + dy * k, c);
        return g;
      },
      /** Lighten fill pixels within radius r by one step. */
      glow(g: Grid, at: Pt, r = 2): Grid {
        const w: [number, number, string][] = [];
        for (let y = at[1] - r; y <= at[1] + r; y++) for (let x = at[0] - r; x <= at[0] + r; x++)
          if ((x - at[0]) ** 2 + (y - at[1]) ** 2 <= r * r && fill(g, x, y) && !guard.has(`${x},${y}`)) w.push([x, y, step(g.get(x, y)!, -1)]);
        return batch(g, w);
      },
    },

    light: {
      /** Edges facing the light → lightest step (`side: 'away'`: edges facing away step one lighter). */
      rim(g: Grid, o: OpOptions & { side?: 'lit' | 'away' } = {}): Grid {
        const w: [number, number, string][] = [], s = o.side === 'away' ? -1 : 1;
        each(g, o, (x, y) => {
          if (!fill(g, x, y)) return;
          const c = g.get(x, y)!;
          if ((lx && open(g, x + lx * s, y)) || (ly && open(g, x, y + ly * s))) w.push([x, y, s > 0 ? step(c, -99) : step(c, -1)]);
        });
        return batch(g, w);
      },
      /** Set one pixel to the lightest step of its ramp (or a token). */
      highlight(g: Grid, at: Pt, token?: string): Grid {
        const c = g.get(at[0], at[1]);
        if (c && c !== outline) plot(g, at[0], at[1], token ? color(token) : step(c, -99));
        return g;
      },
      /** Move every fill pixel in scope `by` steps along its ramp (default -1 = one lighter): light-side shade fixes. */
      tone(g: Grid, o: OpOptions & { by?: number } = {}): Grid {
        const w: [number, number, string][] = [];
        each(g, o, (x, y) => { if (fill(g, x, y)) w.push([x, y, step(g.get(x, y)!, o.by ?? -1)]); });
        return batch(g, w);
      },
      /** Edges facing away from the light step one darker. */
      shade(g: Grid, o?: OpOptions): Grid {
        const w: [number, number, string][] = [];
        each(g, o, (x, y) => {
          if (!fill(g, x, y)) return;
          if ((lx && open(g, x - lx, y)) || (ly && open(g, x, y - ly))) w.push([x, y, step(g.get(x, y)!, 1)]);
        });
        return batch(g, w);
      },
    },

    outline: {
      /** Selective outline: outline pixels on the lit side take the darkest step of the fill they border. */
      selout(g: Grid, o: OpOptions & { side?: 'lit' | 'all' } = {}): Grid {
        const w: [number, number, string][] = [];
        each(g, { region: o.region }, (x, y) => {
          if (!opaque(g, x, y) || g.get(x, y) !== outline) return;
          const dirs: Pt[] = o.side === 'all' ? N4 : ([[-lx, 0], [0, -ly]] as Pt[]).filter(([a, b]) => a || b);
          for (const [dx, dy] of dirs) {
            if (!fill(g, x + dx, y + dy)) continue;
            const hit = rampOf.get(g.get(x + dx, y + dy)!);
            if (!hit || (o.ramps && !o.ramps.includes(hit[0]))) continue;
            const r = dc.pal[hit[0]];
            if (r.length > 1 && hit[1] < r.length - 1) { w.push([x, y, r[r.length - 1]]); break; }
          }
        });
        return batch(g, w);
      },
      /** Inner line where ramp `between[0]` meets `between[1]`: the first ramp's pixels there take `color` (default its darkest step). */
      inner(g: Grid, o: OpOptions & { between: [string, string]; color?: string }): Grid {
        const [a, b] = o.between, w: [number, number, string][] = [];
        each(g, o, (x, y) => {
          const c = g.get(x, y), hit = c && rampOf.get(c);
          if (!hit || hit[0] !== a || !fill(g, x, y)) return;
          if (N4.some(([dx, dy]) => { const n = g.get(x + dx, y + dy), hn = n && rampOf.get(n); return !!hn && hn[0] === b; }))
            w.push([x, y, o.color ? color(o.color) : dc.pal[a][dc.pal[a].length - 1]]);
        });
        return batch(g, w);
      },
      corners(g: Grid, o?: OpOptions): Grid { return px.fix.jaggies(g, o); },
      /** Heavier line: empty pixels 4-adjacent to the outline get the outline colour (`times` rings). */
      weight(g: Grid, o: OpOptions & { times?: number } = {}): Grid {
        for (let k = 0; k < (o.times ?? 1); k++) {
          const w: [number, number, string][] = [];
          each(g, { region: o.region }, (x, y) => {
            if (opaque(g, x, y)) return;
            if (N4.some(([dx, dy]) => opaque(g, x + dx, y + dy) && g.get(x + dx, y + dy) === outline)) w.push([x, y, outline]);
          });
          batch(g, w);
        }
        return g;
      },
    },
  };
  return px;
}

export interface FinishResult {
  render: RenderResult;
  patches: PatchRecord[];
}

/** Apply a finish module to every cell of a render (west facings mirror the finished east cells). */
export function applyFinish(r: RenderResult, mod: FinishModule, dir: Direction): FinishResult {
  const dc = dirContext(dir), patches: PatchRecord[] = [], done = new Map<string, Grid>();
  const keyOf = (c: Cell) => `${c.state}/${c.facing}/${c.frame}`;
  const sources = r.cells.filter(c => !c.mirrored);
  for (const c of sources) {
    const guard = new Set<string>(), cellKey = keyOf(c);
    const px = makePx(dc, p => patches.push({ cell: cellKey, ...p }), guard);
    const anchors = c.anchors ?? {};
    const ctx: FinishContext = {
      dir: dc, lib: { px, Grid }, state: c.state, facing: c.facing, frame: c.frame, anchors,
      at(name, dx = 0, dy = 0) {
        const a = anchors[name];
        if (!a) throw new Error(`finish: cell ${cellKey} has no anchor ${JSON.stringify(name)}`);
        return Object.assign([a[0] + dx, a[1] + dy] as Pt, { anchor: dx || dy ? `${name}${dx >= 0 ? '+' : ''}${dx},${dy >= 0 ? '+' : ''}${dy}` : name });
      },
      key: (state, frame = 0, facing) => c.state === state && c.frame === frame && (facing === undefined || c.facing === facing),
      protect: (...pts) => pts.forEach(([x, y]) => guard.add(`${x},${y}`)),
    };
    const g = c.grid.clone();
    done.set(cellKey, mod.finish(g, ctx) ?? g);
  }
  // replay anchored patches into cells of the same facing that don't patch that anchor themselves
  const anchored = patches.filter(p => p.anchor && !p.replay);
  for (const c of sources) {
    const k = keyOf(c), own = new Set(patches.filter(p => p.cell === k).map(p => p.anchor));
    for (const p of anchored) {
      if (p.cell === k || own.has(p.anchor) || p.cell.split('/')[1] !== c.facing) continue;
      const [name, off] = splitAnchor(p.anchor!), a = c.anchors?.[name];
      if (!a) continue;
      const g = done.get(k)!, px = makePx(dc, rec => patches.push({ cell: k, ...rec, replay: true }));
      const src = p as PatchRecord & { rows: string[]; key: Record<string, string>; mode: 'center' | 'topleft' };
      px.patch(g, Object.assign([a[0] + off[0], a[1] + off[1]] as Pt, { anchor: p.anchor }), src.rows, src.key, { anchor: src.mode });
      own.add(p.anchor);
    }
  }
  const cells = r.cells.map(c => {
    if (!c.mirrored) return { ...c, grid: done.get(keyOf(c))! };
    const src = done.get(`${c.state}/${c.facing.replace(/[we]/g, ch => (ch === 'w' ? 'e' : 'w'))}/${c.frame}`);
    return { ...c, grid: src ? src.flip('x') : c.grid };
  });
  return { render: { ...r, cells }, patches };
}

function splitAnchor(a: string): [string, Pt] {
  const m = a.match(/^(.*?)([+-]\d+),([+-]\d+)$/);
  return m ? [m[1], [+m[2], +m[3]]] : [a, [0, 0]];
}

/** Records kept with a finish (`finish.vM.snapshot.json`): footprint pixels per patch. */
export const finishSnapshot = (patches: PatchRecord[]) =>
  patches.map(({ cell, anchor, x, y, w, h, under, replay }) => ({ cell, anchor, x, y, w, h, under, ...(replay && { replay }) }));

/**
 * `finish-stale` check: patches whose underlying pixels changed by more than `tolerance` (share of the footprint)
 * since the snapshot, or that no longer exist. An empty list means the finish still fits the base render.
 */
export function finishStale(snapshot: PatchRecord[], current: PatchRecord[], tolerance = 0.25): string[] {
  const ids = (list: PatchRecord[]) => {
    const seen = new Map<string, number>();
    return list.map(p => { const n = seen.get(p.cell) ?? 0; seen.set(p.cell, n + 1); return `${p.cell}#${p.anchor ?? `patch${n}`}`; });
  };
  const out: string[] = [], curIds = ids(current), now = new Map(current.map((p, i) => [curIds[i], p]));
  ids(snapshot).forEach((id, i) => {
    const p = snapshot[i], c = now.get(id);
    if (!c) { out.push(`${id}: patch no longer applied`); return; }
    if (c.under.length !== p.under.length) { out.push(`${id}: footprint changed`); return; }
    const diff = p.under.filter((v, k) => v !== c.under[k]).length / Math.max(1, p.under.length);
    if (diff > tolerance) out.push(`${id}: ${(100 * diff).toFixed(0)}% of the pixels under the patch changed`);
  });
  return out;
}
