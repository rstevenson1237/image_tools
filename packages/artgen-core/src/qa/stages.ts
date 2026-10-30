/**
 * Stage keys and stage checks (docs/STAGES.md §4, §5.3): what each stage of a version produced, as a short digest, and
 * the shape checks beside the conformance gate. The stages are views of the render, not files: the silhouette, the
 * colours, the anchors. A revision that redraws the decoration but keeps the silhouette keeps the same `shape` key.
 */
import type { Direction } from 'artgen-scene/direction.ts';
import { normHex } from 'artgen-primitives/lib/color.ts';
import { drawText, GLYPH_H, textWidth } from 'artgen-primitives/lib/font.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import type { StageId, StageKeys } from 'artgen-workflow/stages.ts';
import type { Check } from 'artgen-workflow/check.ts';
import { mirrorFacing, type Cell, type RenderResult } from '../render.ts';
import type { BriefEntry } from '../w2/briefs.ts';
import { briefContract } from '../w2/contract.ts';
import { defaultPlaceholder, groundY, isStanding, placeholderChecks, type Placeholder } from '../w2/placeholder.ts';

export interface StageCheck extends Check { stage: StageId }
export interface StageReport { keys: StageKeys; checks: StageCheck[] }

/** Digest of a canonical byte string: the hash `Grid.hash()` uses (cyrb53), its first 8 hex digits. */
class Digest {
  private h1 = 0xdeadbeef; private h2 = 0x41c6ce57;
  private byte(c: number): void { this.h1 = Math.imul(this.h1 ^ c, 2654435761); this.h2 = Math.imul(this.h2 ^ c, 1597334677); }
  str(s: string): this {
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); this.byte(c & 255); if (c > 255) this.byte(c >> 8); }
    this.byte(10);
    return this;
  }
  bytes(b: Uint8Array): this { for (let i = 0; i < b.length; i++) this.byte(b[i]); return this; }
  hex(): string {
    let { h1, h2 } = this;
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0').slice(0, 8);
  }
}

/** JSON with object keys sorted, so a digest does not depend on the order a file was written in. */
export function canonicalJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.entries(x as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  return JSON.stringify(x) ?? 'null';
}

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * The silhouette of one cell: opaque pixels (alpha 255; translucent shadows and glows are not shape), minus the
 * direction's outer line. The outer line is 1 px drawn outside the fill (`post.outline`, `post.selout`), so when
 * `line.outer` is not `none`, an opaque pixel that touches a non-opaque one (4-neighbours, inside the frame) and whose
 * colour is a line colour (the outline colour, or for `selout` also the darkest step of any ramp) is removed. A
 * palette-only or line-only restyle therefore keeps the mask. One byte per pixel, 1 = shape.
 */
export function shapeMask(g: Grid, dir: Direction): Uint8Array {
  const line = new Set<string>();
  if (dir.line.outer !== 'none') {
    line.add(normHex(dir.palette.outline));
    if (dir.line.outer === 'selout') for (const r of Object.values(dir.palette.ramps)) if (r.length) line.add(normHex(r[r.length - 1]));
  }
  const { w, h } = g, m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g.alpha(x, y) !== 255) continue;
    if (line.size && N4.some(([dx, dy]) => g.inb(x + dx, y + dy) && g.alpha(x + dx, y + dy) !== 255) && line.has(g.get(x, y)!)) continue;
    m[y * w + x] = 1;
  }
  return m;
}

const cellId = (c: Pick<Cell, 'state' | 'facing' | 'frame'>) => `${c.state}/${c.facing}/${c.frame}`;
const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/**
 * The keys of a version's stages (§4.2). `placeholder`: the effective placeholder (the file, else the brief defaults);
 * `rotate`: the brief's rotate mode (R6d). Stages that do not apply to the render have no key.
 */
export function stageKeys(r: RenderResult, dir: Direction, o: { placeholder?: Placeholder; rotate?: string } = {}): StageKeys {
  const keys: StageKeys = {};
  if (o.placeholder) keys.placeholder = new Digest().str(canonicalJson(o.placeholder)).hex();
  const shape = new Digest().str(r.size.join('x')), look = new Digest(), anim = new Digest(), light = new Digest();
  let lit = false;
  for (const c of r.cells) {
    shape.str(cellId(c)).bytes(shapeMask(c.grid, dir));
    look.str(c.grid.hash());
    anim.str(cellId(c));
    for (const [k, [x, y]] of Object.entries(c.anchors ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) anim.str(`${k}=${r2(x)},${r2(y)}`);
    if (c.normal) { lit = true; light.str(c.normal.hash()); } else light.str('-');
  }
  keys.shape = shape.hex();
  const rig = rigKey(r);
  if (rig) keys.rig = rig;
  keys.decorate = look.hex();
  if (lit) keys.lighting = light.str(dir.camera.light.map(r2).join(',')).hex();
  if (o.rotate) keys.rotation = new Digest().str(`${r.facings.join(',')}|${o.rotate}`).hex();
  keys.animation = anim.str(canonicalJson({ ...briefContract(r.brief as BriefEntry, dir), anchors: [] })).hex();
  return keys;
}

/** The rig stage key (§4.2): plan, bone names and rig-space lengths (0.01 px) of every distinct rig the cells report, in render order; absent when no cell is rigged. */
function rigKey(r: RenderResult): string | undefined {
  if (!r.rigs) return undefined;
  const seen = new Set<string>(), d = new Digest();
  for (const c of r.cells) for (const g of r.rigs[cellId(c)] ?? []) {
    const s = `${g.plan}|${Object.keys(g.lengths).sort().map(b => `${b}=${r2(g.lengths[b])}`).join(',')}`;
    if (!seen.has(s)) { seen.add(s); d.str(s); }
  }
  return seen.size ? d.hex() : undefined;
}

// ---- rig check (§6.2)

/** The most a bone's rig-space length may differ between cells, px. */
export const RIG_LENGTH_TOL = 0.5;

/**
 * `rig-lengths`: for each rig (the n-th body rig a cell builds) and bone, the largest minus the smallest length over all cells
 * is at most 0.5 px. A template that recomputes its proportions per frame or facing makes limbs stretch between cells; this
 * names the bone, the two lengths and the cells. Assets with no rig have no `rig-lengths` entry (the design says `skip`; a skip row would change every recorded stage report).
 */
export function rigChecks(r: RenderResult): StageCheck[] {
  const c = (status: Check['status'], detail: string): StageCheck => ({ id: 'rig-lengths', status, detail, stage: 'rig' });
  if (!r.rigs) return []; // no rig, no check: an unrigged asset's stage report stays as it was
  const lo = new Map<string, [number, string]>(), hi = new Map<string, [number, string]>();
  let n = 0;
  for (const cell of r.cells) for (const [i, g] of (r.rigs[cellId(cell)] ?? []).entries()) for (const [b, v] of Object.entries(g.lengths)) {
    const k = `${i}:${g.plan}:${b}`, id = cellId(cell);
    if (!lo.has(k) || v < lo.get(k)![0]) lo.set(k, [v, id]);
    if (!hi.has(k) || v > hi.get(k)![0]) hi.set(k, [v, id]);
    n++;
  }
  const bad = [...lo.keys()].map(k => ({ k, d: hi.get(k)![0] - lo.get(k)![0] })).filter(x => x.d > RIG_LENGTH_TOL).sort((a, b) => b.d - a.d);
  if (!bad.length) return [c('pass', `${lo.size} bone lengths the same in every cell (within ${RIG_LENGTH_TOL} px)`)];
  const w = bad[0].k.split(':'), [a, ia] = lo.get(bad[0].k)!, [b, ib] = hi.get(bad[0].k)!;
  return [c('fail', `${w[1]} bone ${w[2]} is ${r2(a)} px in ${ia} and ${r2(b)} px in ${ib}${bad.length > 1 ? ` (and ${bad.length - 1} more bone${bad.length > 2 ? 's' : ''})` : ''}: build the rig once per cell from fixed proportions`)];
}

// ---- shape checks (§5.3)

/**
 * Compactness 4π·area / perimeter² of the shape (perimeter = pixel edges that touch a non-shape pixel or the frame
 * edge). Pixel edges make a disc 0.62 and a square 0.79; a blob has no waist, limb or head to read. Calibrated on the
 * stand frames of the 25 non-tile approved example finals and 6 bench assets that are not full-frame tiles: 0.05–0.66 (a barrel is
 * the highest), median 0.37. The threshold sits above the highest of them, so it flags solid squares and fat rounded boxes,
 * not figures; tiles and layers fill their frame on purpose and skip the check.
 */
export const SHAPE_READ_MAX = 0.7;

export function compactness(m: Uint8Array, w: number, h: number): number {
  let area = 0, perim = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    area++;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || !m[ny * w + nx]) perim++; }
  }
  return perim ? (4 * Math.PI * area) / (perim * perim) : 0;
}

/** Rows (top, bottom) the shape covers, or null when empty. */
function rows(m: Uint8Array, w: number, h: number): [number, number] | null {
  let top = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (top < 0) top = y; bottom = y; break; }
  return top < 0 ? null : [top, bottom];
}

function iou(a: Uint8Array, b: Uint8Array): number {
  let i = 0, u = 0;
  for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; }
  return u ? i / u : 1;
}

/** Shape checks of a render (§5.3): measured on the stand frames (the first state of the first facing) unless said otherwise. */
export function shapeChecks(r: RenderResult, dir: Direction, o: { brief: BriefEntry; placeholder?: Placeholder }): StageCheck[] {
  const [w, h] = r.size, c = (id: string, status: Check['status'], detail: string): StageCheck => ({ id, status, detail, stage: 'shape' });
  const masks = new Map<Cell, Uint8Array>(r.cells.map(x => [x, shapeMask(x.grid, dir)]));
  const out: StageCheck[] = [];
  const empty = r.cells.filter(x => !masks.get(x)!.some(Boolean));
  out.push(empty.length ? c('shape-empty', 'fail', `${empty.length} cell${empty.length > 1 ? 's' : ''} with no shape: ${empty.slice(0, 3).map(cellId).join(', ')}`) : c('shape-empty', 'pass', 'every cell has a shape'));
  const stand = r.cells.filter(x => x.state === r.states[0] && x.facing === r.facings[0]), cells0 = stand.length ? stand : r.cells.slice(0, 1);
  const ph = o.placeholder ?? safeDefault(o.brief, dir);
  // pivot and box measure a figure standing on its pivot: bottom-anchored views only (top-down anchors are the frame centre)
  const standing = isStanding(o.brief) && !!ph && ph.pivot[1] >= h * 0.6, flyer = o.brief.body === 'flyer', firm = !!o.placeholder || !!o.brief.height;
  if (!standing) {
    out.push(c('shape-pivot', 'skip', isStanding(o.brief) ? 'the pivot is the frame centre (top-down)' : 'not a standing kind'), c('shape-box', 'skip', isStanding(o.brief) ? 'the pivot is the frame centre (top-down)' : 'not a standing kind'));
  } else {
    const ground = groundY(ph!.pivot, r.size), spans = cells0.map(x => rows(masks.get(x)!, w, h)).filter((x): x is [number, number] => !!x);
    if (!spans.length) out.push(c('shape-pivot', 'skip', 'no shape'), c('shape-box', 'skip', 'no shape'));
    else {
      const low = Math.max(...spans.map(s => s[1])), d = Math.abs(low - ground);
      out.push(flyer ? c('shape-pivot', 'skip', 'flyers hover above the pivot')
        : c('shape-pivot', d > 2 ? 'fail' : d === 2 ? 'flag' : 'pass', `lowest shape row ${low}, pivot row ${ground}`));
      const hs = Math.max(...spans.map(s => s[1] - s[0] + 1)), hb = ph!.body.h, dev = Math.abs(hs - hb) / hb;
      // against the brief's height or a placeholder the user saw the shape may fail; against the default guess (0.88 of the frame) it only flags
      out.push(c('shape-box', dev > 0.3 ? (firm ? 'fail' : 'flag') : dev > 0.15 ? 'flag' : 'pass', `shape ${hs} px tall, placeholder body ${hb} px (${dev >= 0.005 ? `${hs >= hb ? '+' : '-'}${Math.round(dev * 100)}%` : 'same'})`));
    }
  }
  const comp = cells0.map(x => compactness(masks.get(x)!, w, h)).filter(v => v > 0);
  out.push(!comp.length || FILLS.has(o.brief.kind) ? c('shape-read', 'skip', FILLS.has(o.brief.kind) ? 'fills its frame on purpose' : 'no shape')
    : c('shape-read', Math.max(...comp) > SHAPE_READ_MAX ? 'flag' : 'pass', `compactness ${Math.max(...comp).toFixed(2)} (a blob reads above ${SHAPE_READ_MAX})`));
  if (r.facings.length < 2) out.push(c('shape-facings', 'skip', 'one facing'));
  else {
    const first = new Map<string, Uint8Array>();
    for (const x of r.cells) if (x.state === r.states[0] && x.frame === 0 && !first.has(x.facing)) first.set(x.facing, masks.get(x)!);
    const same: string[] = [];
    for (const [i, a] of r.facings.entries()) for (const b of r.facings.slice(i + 1)) {
      const ma = first.get(a), mb = first.get(b);
      if (!ma || !mb || mirrorFacing(a) === b) continue;
      if (iou(ma, mb) >= 0.97 && ma.some(Boolean)) same.push(`${a}/${b}`);
    }
    out.push(same.length ? c('shape-facings', 'flag', `${same.slice(0, 4).join(', ')}${same.length > 4 ? ` +${same.length - 4}` : ''}: not mirrors, yet the silhouettes match (they read the same)`) : c('shape-facings', 'pass', 'every facing has its own silhouette'));
  }
  return out;
}

const FILLS = new Set(['tile', 'tileset', 'texture', 'layer']);

function safeDefault(brief: BriefEntry, dir: Direction): Placeholder | undefined {
  try { return defaultPlaceholder(brief, dir); } catch { return undefined; }
}

/** Keys and checks of a render. Placeholder checks run when a placeholder is given (the file); the shape checks measure against it, else the defaults. */
export function stageReport(r: RenderResult, dir: Direction, o: { brief: BriefEntry; placeholder?: Placeholder; rotate?: string }): StageReport {
  const ph = o.placeholder ?? safeDefault(o.brief, dir);
  return {
    keys: stageKeys(r, dir, { placeholder: ph, rotate: o.rotate }),
    checks: [...(o.placeholder ? placeholderChecks(o.placeholder, o.brief, dir) : []), ...shapeChecks(r, dir, { brief: o.brief, placeholder: ph }), ...rigChecks(r)],
  };
}

/** `shape-read:flag` for every failing or flagged check (the score entry's `stageChecks`). */
export const stageCheckLabels = (checks: StageCheck[]): string[] => checks.filter(x => x.status === 'fail' || x.status === 'flag').map(x => `${x.id}:${x.status}`);

/** Key of a placeholder (§4.2): the digest of its canonical JSON. */
export const placeholderKey = (ph: Placeholder): string => new Digest().str(canonicalJson(ph)).hex();

// ---- the shape sheet (§5.3)

const SHAPE_BG = '#c8c8c8', SHAPE_INK = '#23232b', GUIDE = '#e0407a', SHEET_BG = '#16161c', SHEET_FG = '#dddddd';

/**
 * The shape sheet of a render: for the first state, each drawn facing's shape in one flat dark colour on the light review
 * background, at 1× and at 3× (with the placeholder body box and pivot as 1 px guides in the accent colour), and the stage
 * checks as text under it. Far smaller than the full review sheet: no colour, no earlier versions, no context panels.
 */
export function shapeSheet(r: RenderResult, dir: Direction, o: { title: string; placeholder?: Placeholder; checks: StageCheck[]; maxEdge?: number }): Grid {
  const [w, h] = r.size, PAD = 12, TXT = 2, LAB = GLYPH_H * TXT + 6, K = 3, maxW = Math.min(o.maxEdge ?? 1568, 960);
  const drawn = r.facings.filter(f => r.cells.some(c => c.state === r.states[0] && c.facing === f && c.frame === 0 && !c.mirrored));
  const cells = drawn.map(f => r.cells.find(c => c.state === r.states[0] && c.facing === f && c.frame === 0)!);
  const maskGrid = (c: Cell): Grid => {
    const m = shapeMask(c.grid, dir), g = new Grid(w, h);
    g.fill(0, 0, w, h, SHAPE_BG);
    for (let i = 0; i < m.length; i++) if (m[i]) g.set(i % w, (i / w) | 0, SHAPE_INK);
    return g;
  };
  const colW = w + PAD + w * K + PAD * 2, perRow = Math.max(1, Math.floor((maxW - PAD) / colW)), nRows = Math.ceil(cells.length / perRow), rowH = LAB + h * K + PAD;
  const lines = o.checks.map(c => `${c.id} ${c.status.toUpperCase()} ${c.detail}`);
  const W = Math.max(PAD * 2 + textWidth(o.title, TXT), PAD + Math.min(perRow, cells.length) * colW, ...lines.map(l => Math.min(PAD * 2 + textWidth(l, TXT), maxW)));
  const H = PAD + LAB + nRows * rowH + (lines.length ? lines.length * LAB + PAD : 0);
  const g = new Grid(W, H).fill(0, 0, W, H, SHEET_BG);
  drawText(g, PAD, PAD, o.title, '#ffffff', TXT);
  cells.forEach((c, i) => {
    const x = PAD + (i % perRow) * colW, top = PAD + LAB + Math.floor(i / perRow) * rowH, y = top + LAB, base = maskGrid(c), big = base.scale(K);
    if (o.placeholder) {
      const b = o.placeholder.body, [px, py] = o.placeholder.pivot;
      for (let t = 0; t < b.w * K; t++) { big.set(b.x * K + t, b.y * K, GUIDE); big.set(b.x * K + t, (b.y + b.h) * K - 1, GUIDE); }
      for (let t = 0; t < b.h * K; t++) { big.set(b.x * K, b.y * K + t, GUIDE); big.set((b.x + b.w) * K - 1, b.y * K + t, GUIDE); }
      for (let t = -4; t <= 4; t++) { big.set(px * K + 1 + t, py * K + 1, GUIDE); big.set(px * K + 1, py * K + 1 + t, GUIDE); }
    }
    drawText(g, x, top, `${r.states[0]}/${c.facing}`, SHEET_FG, TXT);
    g.blit(base, x, y); g.blit(big, x + w + PAD, y);
  });
  let ty = PAD + LAB + nRows * rowH;
  for (const [i, l] of lines.entries()) { drawText(g, PAD, ty + 2, l, o.checks[i].status === 'fail' ? '#ff6b6b' : o.checks[i].status === 'flag' ? '#ffc857' : SHEET_FG, TXT); ty += LAB; }
  return g;
}
