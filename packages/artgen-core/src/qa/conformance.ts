/**
 * Conformance gate (SPEC §4.3): does an asset follow its direction? Each check passes, fails, flags
 * (reported, never blocking) or is skipped when its inputs are missing. Plus artlab hygiene metrics.
 */
import { kindPalette, type Direction, type Size } from '../direction.ts';
import { luma, normHex, parseColor } from '../lib/color.ts';
import type { Grid } from '../lib/grid.ts';
import { isShadowPixel, measure, type Metrics } from './metrics.ts';

export type CheckStatus = 'pass' | 'fail' | 'flag' | 'skip';
export interface Check { id: string; status: CheckStatus; detail: string }
export interface ConformanceReport { pass: boolean; checks: Check[]; metrics: Metrics }

export interface ConformanceInput {
  /** Frames of one asset (any states/facings). */
  frames: Grid[];
  dir: Direction;
  kind?: string;
  /** Expected frame size (resolved from the brief). */
  size?: Size;
  /** Asset source text, for the R11 lint. */
  source?: string;
  /** T2+ scene lint messages (`RenderResult.lint`): R4/R11 violations fail, the rest flag. */
  lint?: string[];
  /** Real-world height (brief `height`, metres) and the direction's world scale: the drawn body is checked against it. */
  height?: { metres: number; pxPerMetre: number };
  /** Approved anchors of the same kind. */
  anchors?: Grid[];
  symAxis?: 'x' | 'y' | 'none';
  thresholds?: Partial<Thresholds>;
}

export interface Thresholds {
  /** Min share of silhouette-edge pixels in the outline colour when `line.outer` is dark (selout: darkest ramp steps). */
  lineMin: number;
  /** Max share for `line.outer: none`. */
  lineNoneMax: number;
  /** Lit edges may be at most this much darker (luma) than shaded edges. */
  lightTolerance: number;
  /** 3×3 checkerboard windows tolerated when `dither: none`. */
  ditherMax: number;
  /** Max histogram distance (0–1) to the nearest anchor before flagging. */
  anchorMax: number;
  /** Max relative difference between the drawn body height and the brief's real-world height before flagging. */
  heightTolerance: number;
}
const DEFAULT_THRESHOLDS: Thresholds = { lineMin: 0.85, lineNoneMax: 0.15, lightTolerance: 4, ditherMax: 2, anchorMax: 0.6, heightTolerance: 0.2 };

/** Height of the opaque body in px (alpha 255: ground shadows and glows are translucent); 0 when empty. */
export function bodyHeight(g: Grid): number {
  let top = -1, bottom = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) { if (top < 0) top = y; bottom = y; break; }
  return top < 0 ? 0 : bottom - top + 1;
}

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Kinds that repeat edge to edge: conformance wraps their borders. */
export const TILE_KINDS = new Set(['tile', 'tileset', 'texture']);
/** Kinds that repeat left to right only (P6a parallax layers): conformance wraps x; they are scenery, not lit figures. */
export const LAYER_KINDS = new Set(['layer']);
/** Kinds that emit light: the light-direction check doesn't apply. */
export const EMISSIVE_KINDS = new Set(['effect']);

/** Source lint (R11): hex/rgb colour literals are forbidden in asset source. Returns offending `line: text`. */
export function lintSource(src: string): string[] {
  const out: string[] = [], re = /(#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|\brgba?\s*\(/;
  src.split('\n').forEach((l, i) => {
    const code = l.replace(/\/\/.*$/, '');
    if (re.test(code)) out.push(`${i + 1}: ${l.trim().slice(0, 80)}`);
  });
  return out;
}

/** Count 3×3 windows that form a perfect two-colour checkerboard (ordered-dither signature). */
export function checkerWindows(g: Grid): number {
  let n = 0;
  for (let y = 0; y + 2 < g.h; y++) for (let x = 0; x + 2 < g.w; x++) {
    const a = g.get(x, y), b = g.get(x + 1, y);
    if (!a || !b || a === b) continue;
    let ok = true;
    for (let j = 0; j < 3 && ok; j++) for (let i = 0; i < 3 && ok; i++) if (g.get(x + i, y + j) !== ((i + j) % 2 ? b : a)) ok = false;
    if (ok) n++;
  }
  return n;
}

/** Normalised colour-histogram distance (0 = same colour mix, 1 = disjoint). */
export function histogramDistance(a: Grid, b: Grid): number {
  const hist = (g: Grid) => {
    const m = new Map<string, number>();
    let n = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.get(x, y); if (c && g.alpha(x, y) === 255) { m.set(c, (m.get(c) ?? 0) + 1); n++; } }
    for (const [k, v] of m) m.set(k, v / (n || 1));
    return m;
  };
  const ha = hist(a), hb = hist(b);
  let d = 0;
  for (const k of new Set([...ha.keys(), ...hb.keys()])) d += Math.abs((ha.get(k) ?? 0) - (hb.get(k) ?? 0));
  return d / 2;
}

export function conformance(input: ConformanceInput): ConformanceReport {
  const { frames, dir, kind, size, source, anchors = [], symAxis = 'x' } = input;
  const th = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const checks: Check[] = [], add = (id: string, status: CheckStatus, detail: string) => checks.push({ id, status, detail });
  const shadowRGBA = [...parseColor(dir.palette.shadow.color).slice(0, 3), Math.round(dir.palette.shadow.alpha * 255)];
  const shadowStr = `rgba(${shadowRGBA.slice(0, 3).join(',')},${dir.palette.shadow.alpha})`;
  const allowed = new Set(kindPalette(dir, kind)), outline = normHex(dir.palette.outline);
  // tiles repeat, so their frame border wraps around instead of being a silhouette edge
  const wraps = !!kind && TILE_KINDS.has(kind), wrapsX = wraps || (!!kind && LAYER_KINDS.has(kind));
  const opaque = (g: Grid, x: number, y: number) => {
    if (wrapsX) x = ((x % g.w) + g.w) % g.w;
    if (wraps) y = ((y % g.h) + g.h) % g.h;
    else if (wrapsX) y = Math.max(0, Math.min(g.h - 1, y)); // a layer's scenery runs on past its top and bottom
    if (!g.inb(x, y)) return false;
    const i = (y * g.w + x) * 4;
    return g.d[i + 3] > 0 && !isShadowPixel(g.d, i, shadowRGBA);
  };

  // palette: 0 off-palette pixels, colour count within perKindMax
  const colors = new Set<string>();
  let off = 0, partial = 0;
  for (const g of frames) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!opaque(g, x, y)) continue;
    const c = g.get(x, y)!;
    colors.add(c);
    if (!allowed.has(c)) off++;
    if (g.alpha(x, y) < 255) partial++;
  }
  const max = kind ? dir.palette.perKindMax[kind] : undefined;
  if (off) add('palette', 'fail', `${off} off-palette pixels`);
  else if (max && colors.size > max) add('palette', 'fail', `${colors.size} colours > perKindMax.${kind} ${max}`);
  else add('palette', 'pass', `${colors.size} colours, all in ${kind && dir.palette.perKind[kind] ? `${kind} ramps` : 'direction ramps'}`);

  // scale
  if (!size) add('scale', 'skip', 'no expected size');
  else {
    const bad = frames.filter(g => g.w !== size[0] || g.h !== size[1]);
    add('scale', bad.length ? 'fail' : 'pass', bad.length ? `${bad.length} frames not ${size.join('x')}` : `${size.join('x')}`);
  }

  // aa: no partial alpha except the shadow colour
  add('aa', partial ? 'fail' : 'pass', partial ? `${partial} partial-alpha pixels` : 'no partial alpha');

  // line: silhouette edge pixels (next to transparent or shadow) in the outline colour / selout ramp ends
  const darkest = new Set(Object.values(dir.palette.ramps).map(r => normHex(r[r.length - 1])));
  let edge = 0, inked = 0;
  for (const g of frames) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!opaque(g, x, y) || !N4.some(([dx, dy]) => !opaque(g, x + dx, y + dy))) continue;
    edge++;
    const c = g.get(x, y)!;
    if (c === outline || (dir.line.outer === 'selout' && darkest.has(c))) inked++;
  }
  const share = edge ? inked / edge : 0, pctS = `${(100 * share).toFixed(1)}% of ${edge} edge px`;
  if (!edge) add('line', 'skip', 'empty frames');
  else if (dir.line.outer === 'none') add('line', share <= th.lineNoneMax ? 'pass' : 'fail', `outline-coloured edge ${pctS} (want none)`);
  else add('line', share >= th.lineMin ? 'pass' : 'fail', `${dir.line.outer} edge ${pctS} (min ${100 * th.lineMin}%)`);

  // light: edges facing the light are not darker than edges facing away (sign test)
  // the line itself (outline colour, or selout's darkest ramp steps on the silhouette) is not lit or shaded surface
  const lx = Math.sign(dir.camera.light[0]), ly = Math.sign(dir.camera.light[1]);
  const isLine = (g: Grid, x: number, y: number) => {
    const c = g.get(x, y);
    if (c === outline) return true;
    return dir.line.outer === 'selout' && !!c && darkest.has(c) && N4.some(([dx, dy]) => !opaque(g, x + dx, y + dy));
  };
  let litSum = 0, litN = 0, shSum = 0, shN = 0;
  for (const g of frames) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!opaque(g, x, y)) continue;
    if (isLine(g, x, y)) continue;
    const exposed = (dx: number, dy: number) => !opaque(g, x + dx, y + dy) || isLine(g, x + dx, y + dy);
    const lit = (!!lx && exposed(lx, 0)) || (!!ly && exposed(0, ly)), away = (!!lx && exposed(-lx, 0)) || (!!ly && exposed(0, -ly));
    if (lit === away) continue;
    const i = (y * g.w + x) * 4, L = luma(g.d[i], g.d[i + 1], g.d[i + 2]);
    if (lit) { litSum += L; litN++; } else { shSum += L; shN++; }
  }
  if (kind && EMISSIVE_KINDS.has(kind)) add('light', 'skip', `${kind}: emissive, no light direction`);
  else if (wraps) add('light', 'skip', `${kind}: ground plane, no silhouette lighting`);
  else if (wrapsX) add('light', 'skip', `${kind}: scenery layer, lit by its own depth`);
  else if (litN < 4 || shN < 4) add('light', 'skip', 'too few lit/shaded edge pixels');
  else {
    const dl = litSum / litN - shSum / shN;
    add('light', dl >= -th.lightTolerance ? 'pass' : 'fail', `lit − shaded edge luma ${dl.toFixed(1)}`);
  }

  // dither
  const checker = frames.reduce((n, g) => n + checkerWindows(g), 0);
  if (dir.shading.dither === 'none') add('dither', checker <= th.ditherMax ? 'pass' : 'fail', `${checker} checkerboard windows`);
  else add('dither', 'pass', `dither ${dir.shading.dither} allowed (${checker} windows)`);

  // source lint (R11)
  if (source === undefined) add('source', 'skip', 'no source');
  else {
    const hits = lintSource(source);
    add('source', hits.length ? 'fail' : 'pass', hits.length ? `colour literals: ${hits.slice(0, 3).join(' | ')}` : 'no colour literals');
  }

  // T2+ scene lint
  if (input.lint === undefined) add('lint', 'skip', 'no scene lint');
  else {
    const hard = input.lint.filter(m => /\((R4|R11)\)/.test(m));
    add('lint', hard.length ? 'fail' : input.lint.length ? 'flag' : 'pass', input.lint.length ? input.lint.slice(0, 3).join(' | ') : 'clean');
  }

  // real-world height (flag only, rev 9): assets drawn to one world scale, not to fill their frames
  if (!input.height) add('height', 'skip', 'no real-world height in the brief');
  else if (kind && (TILE_KINDS.has(kind) || LAYER_KINDS.has(kind))) add('height', 'skip', `${kind}: ground plane or scenery`);
  else {
    const want = input.height.metres * input.height.pxPerMetre, got = bodyHeight(frames[0]), dev = (got - want) / want;
    const fits = !size || want <= size[1];
    add('height', Math.abs(dev) <= th.heightTolerance ? 'pass' : 'flag',
      `${got} px drawn, ${want.toFixed(1)} px expected for ${input.height.metres} m (${dev >= 0 ? '+' : ''}${Math.round(dev * 100)} %)${fits ? '' : `; the ${size![1]} px frame is too short for it`}`);
  }

  // anchor similarity (flag only)
  if (!anchors.length) add('anchors', 'skip', 'no anchors for this kind');
  else {
    const dmin = Math.min(...frames.flatMap(f => anchors.map(a => histogramDistance(f, a))));
    add('anchors', dmin <= th.anchorMax ? 'pass' : 'flag', `nearest anchor histogram distance ${dmin.toFixed(2)}`);
  }

  const metrics = measure(frames[0], { symAxis, palette: [...allowed], shadow: shadowStr });
  return { pass: checks.every(c => c.status !== 'fail'), checks, metrics };
}
