/**
 * The image tools that meet the asset pipeline (docs/TOOLING-PLAN.md §6b, R5b):
 *   `trace-base`  a sketch or reference picture becomes an asset's next `base.vN.js`: its shapes as `path` primitives, fitted to the frame;
 *   `cut`         a VTT token (or the flat silhouette the Shape gate reads) from an approved asset's render, or from any picture.
 * The tracing and cutting are `artgen-imagekit`, the functions the web tools run. `trace`, `slice` and `quantize`, which need no
 * asset, are in `image.ts`.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { alphaMask, applyMask, binarize, cropToken, defaultTraceOptions, silhouetteImage, silhouetteMask, traceImage, type Mask, type Pixels, type TracedRing } from 'artgen-imagekit';
import { normHex, parseColor } from 'artgen-primitives';
import { parseVersion, resolveSize, type Direction } from 'artgen-core';
import { passOf, renderVersion, versionsIn } from '../asset.ts';
import { projectStatus } from '../w2.ts';
import { assetOf, assetParam, directionParam, ledgerParam, type Inp } from './art-shared.ts';
import { readPicture, stemOf, traceOptions, traceParams, traceSummary, writePicture } from './image.ts';
import { defineOp, p } from './registry.ts';

const PLACE = 'writes a file from a picture by path outside the art/ sandbox';

/** The ramps (roles) the direction allows this kind of asset (all of them when it names none). */
const rolesFor = (dir: Direction, kind?: string): string[] => ((kind && dir.palette.perKind[kind]) || Object.keys(dir.palette.ramps)).filter(r => dir.palette.ramps[r]);

/** Of `roles`, the ramp whose middle colour is nearest to `rgb`. */
function nearestRole(ramps: Record<string, string[]>, roles: string[], rgb: [number, number, number]): string {
  let best = '', bd = Infinity;
  for (const role of roles) {
    const ramp = ramps[role];
    const [r, g, b] = parseColor(ramp[Math.floor(ramp.length / 2)]), d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bd) { bd = d; best = role; }
  }
  return best;
}

/** The mean colour of the picture where the mask is set (the subject), ignoring transparent pixels. */
function meanColor(img: Pixels, m: Mask): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < m.d.length; i++) if (m.d[i] && img.d[i * 4 + 3] > 0) { r += img.d[i * 4]; g += img.d[i * 4 + 1]; b += img.d[i * 4 + 2]; n++; }
  return n ? [r / n, g / n, b / n] : [128, 128, 128];
}

const num4 = (v: number): string => String(Math.round(v * 1e4) / 1e4);

export const traceBase = defineOp({
  name: 'trace-base', module: 'art', effect: 'write', summary: 'Write an asset\'s next base.vN.js from a traced sketch or reference picture: its shapes as path primitives, fitted to the asset\'s frame.',
  params: {
    asset: assetParam('the asset: a brief id or an asset directory'), image: p.str('the sketch or reference picture (PNG)', { positional: true, required: 'trace-base: <asset> <image.png>' }),
    mat: p.str('the direction\'s material (ramp) for the shapes (default: the one nearest the picture\'s colour)'), margin: p.num('pixels to keep free round the shapes in the frame (default 2)'),
    anchor: p.oneOf(['center', 'bottom'], 'put the shapes in the middle of the frame, or on its bottom edge like a figure on the ground (default center)'),
    ...traceParams(), direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    const a = assetOf(ctx, i), img = readPicture(resolve(i.image)), opts = { ...defaultTraceOptions, ...traceOptions(i) }, t = traceImage(img, opts);
    if (!t.shapes.length) throw new Error(`${i.image}: nothing to trace (try --invert, a different --threshold, or a lower --min-area)`);
    const roles = rolesFor(a.dir, a.brief.kind), role = i.mat ?? nearestRole(a.dir.palette.ramps, roles, meanColor(img, binarize(img, opts).binary));
    if (!roles.includes(role)) throw new Error(`--mat ${role}: one of ${roles.join(', ')}`);
    // fit the shapes (their outer rings) inside the frame, keeping their proportions
    const [W, H] = resolveSize(a.dir, a.brief.size, a.brief.kind), margin = i.margin ?? 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of t.shapes) for (let k = 0; k < s.outer.points.length; k += 2) { x0 = Math.min(x0, s.outer.points[k]); x1 = Math.max(x1, s.outer.points[k]); y0 = Math.min(y0, s.outer.points[k + 1]); y1 = Math.max(y1, s.outer.points[k + 1]); }
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0), scale = Math.min((W - 2 * margin) / bw, (H - 2 * margin) / bh);
    if (!(scale > 0)) throw new Error(`--margin ${margin} leaves no room in a ${W}x${H} frame`);
    const ox = (W - bw * scale) / 2 - x0 * scale, oy = (i.anchor === 'bottom' ? H - margin - bh * scale : (H - bh * scale) / 2) - y0 * scale;
    const ring = (r: TracedRing) => `[${Array.from(r.points, (v, k) => num4(k % 2 ? (v * scale + oy) / H : (v * scale + ox) / W)).join(',')}]`;
    const n = Math.max(0, ...versionsIn(a).map(v => parseVersion(v)).filter(v => v?.kind === 'base').map(v => v!.n)) + 1, version = `base.v${n}`;
    const file = join(a.path, `${version}.js`), holes = t.shapes.reduce((c, s) => c + s.holes.length, 0), from = String(i.image).split(/[\\/]/).pop()!.replace(/[^\w.\- ]/g, '_');
    const source = [
      `// ${a.brief.id} ${version} (${passOf(a, version)}) — traced from ${from} by \`artgen trace-base\`: ${t.shapes.length} shape${t.shapes.length === 1 ? '' : 's'}${holes ? `, ${holes} hole${holes === 1 ? '' : 's'}` : ''}, fitted to the ${W}x${H} frame.`,
      '// This is the silhouette and nothing more. Shape it (split it into parts, set the materials, add the details and the face) in the next pass.',
      `export const meta = { brief: ${JSON.stringify(a.brief.id)}, pass: ${JSON.stringify(passOf(a, version))}, notes: ${JSON.stringify(`traced silhouette of ${from}`)} };`,
      '',
      '// each shape: its outline, then its holes, as [x, y, …] in fractions of the frame',
      'const SHAPES = [',
      ...t.shapes.map(s => `  [${[s.outer, ...s.holes].map(ring).join(', ')}],`),
      '];',
      '',
      'export function render(ctx) {',
      '  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h);',
      "  const d = r => r.map((v, i) => (i === 0 ? 'M' : i % 2 ? ' ' : ' L') + (v * (i % 2 ? h : w)).toFixed(2)).join('') + ' Z';",
      `  SHAPES.forEach((rings, i) => s.add({ type: 'path', name: 'shape' + i, d: rings.map(d).join(' '), fillRule: 'evenodd', mat: pal.${role}, shade: 'normal', underlay: true }));`,
      '  return ctx.lib.proc(s).render();',
      '}',
      '',
    ].join('\n');
    writeFileSync(file, source);
    return { asset: a.brief.id, file, version, mat: role, trace: traceSummary(t), size: [W, H] };
  },
  cli: {
    usage: '       artgen trace-base <asset> <image.png> [--mat ramp] [--margin px] [--anchor center|bottom] [--threshold otsu|0-255] [--invert] [--blur n] [--smoothing n] [--simplify px] [--min-area px²] [--holes off] [--max-paths n]',
    text: r => `${r.asset}: ${r.version} (${r.trace.shapes} shapes${r.trace.holes ? `, ${r.trace.holes} holes` : ''}, material ${r.mat}) → ${r.file}\nnext: artgen render ${r.asset} --version ${r.version}, then review it`,
    json: r => ({ asset: r.asset, version: r.version, file: r.file, mat: r.mat, trace: r.trace }),
  },
  mcp: { exclude: PLACE }, python: {},
});

const isPicture = (s: unknown): s is string => typeof s === 'string' && /\.png$/i.test(s) && existsSync(s);

export const cut = defineOp({
  name: 'cut', module: 'art', effect: 'write', summary: 'Cut a token (or the flat silhouette the Shape gate reads) from an approved asset\'s render, or from a picture.',
  params: {
    target: p.str('an asset (a brief id or directory; it must be approved) or a picture (PNG)', { positional: true, required: 'cut: <asset|image.png>' }),
    out: p.str('the PNG to write (default: art/tokens/<id>.png for an asset, <image>-token.png for a picture)'),
    fill: p.oneOf(['art', 'flat'], 'keep the picture\'s pixels inside the cut, or fill it with --color (default art)'), color: p.str('--fill flat: the colour, #rrggbb (default #000000)'),
    padding: p.int('transparent margin round the subject in pixels (default 8)'), square: p.bool('pad the result to a square'), scale: p.int('enlarge by this whole number, nearest neighbour (default 1)'),
    version: p.str('asset: the version to cut (default: the final)'), draft: p.bool('asset: cut a final that is not approved yet'),
    state: p.str('asset: the state to cut (default: the first)'), facing: p.str('asset: the facing to cut (default: the first)'), frame: p.int('asset: the frame to cut (default 0)'),
    threshold: p.str('picture: grey level 0–255 that splits subject from background, or otsu (default)'), invert: p.bool('picture: the lighter region is the subject'),
    smoothing: p.int('picture: close kernel that seals speckle (default 5)'), keep_all: p.bool('picture: keep every blob, not only the largest'),
    direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    if (i.threshold !== undefined && i.threshold !== 'otsu' && !(Number.isFinite(+i.threshold) && +i.threshold >= 0 && +i.threshold <= 255)) throw new Error('--threshold: otsu or a grey level from 0 to 255');
    if (i.scale !== undefined && !(i.scale >= 1 && i.scale <= 32)) throw new Error('--scale: a whole number from 1 to 32');
    let img: Pixels, mask: Mask, out: string, id: string, source: string;
    if (/\.png$/i.test(i.target) && !existsSync(i.target)) throw new Error(`${i.target}: not found`);
    if (isPicture(i.target)) {
      const file = resolve(i.target);
      img = readPicture(file);
      mask = silhouetteMask(img, [], { threshold: i.threshold === undefined || i.threshold === 'otsu' ? 'otsu' : +i.threshold, invert: i.invert === true, smoothing: i.smoothing ?? 5, keepLargestBlob: !i.keep_all });
      out = resolve(i.out ?? `${stemOf(file)}-token.png`); id = stemOf(file).split(/[\\/]/).pop()!; source = file;
    } else {
      const a = assetOf(ctx, { ...i, asset: i.target });
      let version = i.version as string | undefined;
      if (a.project && !version) {
        const row = (await projectStatus(a.project, [a.brief.id]))[0];
        const ok = row && (row.status === 'approved' || row.status === 'exported' || (i.draft === true && row.status === 'final'));
        if (!ok) throw new Error(`${a.brief.id} is ${row?.status ?? 'unknown'}${row?.final ? ` (final ${row.final})` : ''}: cut tokens from approved assets, or pass --draft for a final that is not approved yet (or --version for a version you pick)`);
        version = row.final;
      }
      version ??= versionsIn(a).at(-1);
      if (!version) throw new Error(`${a.brief.id}: no base.vN.js yet`);
      const r = (await renderVersion(a, version)).render;
      const cell = r.cells.find(c => c.state === (i.state ?? r.states[0]) && c.facing === (i.facing ?? r.facings[0]) && c.frame === (i.frame ?? 0));
      if (!cell) throw new Error(`${a.brief.id} ${version}: no cell ${i.state ?? r.states[0]}/${i.facing ?? r.facings[0]}/${i.frame ?? 0} (states ${r.states.join(', ')}; facings ${r.facings.join(', ')}; frames 0–${Math.max(...Object.values(r.frames)) - 1})`);
      img = cell.grid;
      mask = alphaMask(img);
      out = resolve(i.out ?? join(a.project?.art ?? a.path, a.project ? 'tokens' : '', `${a.brief.id}.png`)); id = a.brief.id; source = `${a.brief.id} ${version}`;
    }
    const flat = i.fill === 'flat', colored = flat ? silhouetteImage(mask, normHex(i.color ?? '#000000')) : applyMask(img, mask);
    const token = cropToken(colored, { padding: i.padding ?? 8, square: i.square === true, scale: i.scale ?? 1 });
    writePicture(out, token);
    return { id, source, out, width: token.w, height: token.h, fill: flat ? 'flat' : 'art' };
  },
  cli: {
    usage: '       artgen cut <asset|image.png> [--out file.png] [--fill art|flat] [--color #rrggbb] [--padding px] [--square] [--scale n]   (asset: [--version v] [--draft] [--state s] [--facing f] [--frame n]; picture: [--threshold otsu|0-255] [--invert] [--smoothing n] [--keep-all])',
    text: r => `${r.out}: ${r.width}x${r.height} ${r.fill === 'flat' ? 'silhouette' : 'token'} of ${r.source}`,
    json: r => ({ id: r.id, source: r.source, out: r.out, width: r.width, height: r.height, fill: r.fill }),
  },
  mcp: { exclude: PLACE }, python: {},
});

export const IMAGE_ART_OPS = [traceBase, cut];
