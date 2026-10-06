// T2+ (PLAN P1b): geometry, 2D scenes in both raster modes, procedural layers, finishing ops, 3D mode, params.
import { describe, expect, test } from 'vitest';
import { dirContext, kindPalette, parseDirection, type Direction } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { conformance } from '../qa/conformance.ts';
import { makeLib, renderAsset, type AssetModule } from '../render.ts';
import { applyFinish, finishSnapshot, finishStale, makePx, type FinishModule } from './finish.ts';
import { fillPolygons, Mask, parsePath } from './geom.ts';
import { resolveParams } from './params.ts';
import { INK, Raster } from './raster.ts';
import type { Spec } from './scene.ts';

const O = '#1a1423';
const RAMPS = { stone: ['#eeeeee', '#bbbbbb', '#888888', '#555555'], moss: ['#9ad06a', '#5a9a3e', '#2c5a2e'], gold: ['#ffe27a', '#d9a832', '#8f6418'] };
const make = (over: Record<string, unknown> = {}): Direction => parseDirection({
  id: 't2', version: 1, status: 'locked', camera: { view: 'topdown', light: [-1, -1, 1] }, scale: { prop: [16, 16] },
  palette: { ramps: RAMPS, outline: O }, shading: { bands: 4 }, ...over,
});
const dir = make();
const lib = (d = dir, kind = 'prop') => makeLib(dirContext(d), kind);
const opaqueColours = (g: Grid) => { const s = new Set<string>(); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) s.add(g.get(x, y)!); return s; };
const partial = (g: Grid, except?: number) => { let n = 0; for (let i = 3; i < g.d.length; i += 4) if (g.d[i] > 0 && g.d[i] < 255 && g.d[i] !== except) n++; return n; };
const filled = (r: Raster) => { let n = 0; for (const v of r.id) if (v >= 0) n++; return n; };
/** Mean ramp index over a region of a raster (lower = lighter). */
const meanBand = (r: Raster, x0: number, y0: number, w: number, h: number) => {
  let s = 0, n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = y * r.w + x; if (r.id[i] >= 0 && !(r.flag[i] & INK)) { s += r.band[i]; n++; } }
  return s / n;
};

describe('geometry', () => {
  test('path data: absolute/relative lines, H/V, curves and arcs end where they should', () => {
    const [sq] = parsePath('M0 0 H10 V10 h-10 Z');
    expect(sq[0]).toEqual([0, 0]); expect(sq[sq.length - 1]).toEqual([0, 0]); expect(sq).toContainEqual([10, 10]);
    const [c] = parsePath('M0 0 C0 10 10 10 10 0 S20 -10 20 0');
    expect(c[c.length - 1][0]).toBeCloseTo(20); expect(Math.max(...c.map(p => p[1]))).toBeGreaterThan(5);
    const [q] = parsePath('M0 0 Q5 10 10 0 T20 0');
    expect(q[q.length - 1]).toEqual([20, 0]);
    const [a] = parsePath('M0 5 A5 5 0 0 1 10 5');
    expect(a[a.length - 1]).toEqual([10, 5]); expect(Math.min(...a.map(p => p[1]))).toBeCloseTo(0, 1);
    expect(parsePath('M0 0 L1 1 M5 5 L6 6')).toHaveLength(2);
    expect(() => parsePath('1 2')).toThrow('must start with a command');
    expect(() => parsePath('M0 0 L 1')).toThrow('expected a number');
  });

  test('polygon fill samples pixel centres; even-odd rings leave holes', () => {
    const m = fillPolygons(new Mask(10, 10, 1), [[[2, 2], [6, 2], [6, 6], [2, 6]]]);
    expect(m.count()).toBe(16);
    expect(fillPolygons(new Mask(40, 40, 4), [[[2, 2], [6, 2], [6, 6], [2, 6]]]).count()).toBe(256);
    const ring = fillPolygons(new Mask(10, 10, 1), [[[1, 1], [9, 1], [9, 9], [1, 9]], [[3, 3], [3, 7], [7, 7], [7, 3]]], 'evenodd');
    expect(ring.count()).toBe(64 - 16); expect(ring.has(5, 5)).toBe(false);
  });

  test('distance transforms: dilation is Euclidean, inside distance peaks in the middle', () => {
    const m = new Mask(9, 9, 1); m.d[4 * 9 + 4] = 1;
    expect(m.dilate(1).count()).toBe(5);
    expect(m.dilate(1.5).count()).toBe(9);
    const sq = fillPolygons(new Mask(9, 9, 1), [[[2, 2], [7, 2], [7, 7], [2, 7]]]), d = sq.insideDistance();
    expect(d[4 * 9 + 4]).toBe(3); expect(d[2 * 9 + 2]).toBe(1); expect(d[0]).toBe(0);
  });
});

describe('2D scenes', () => {
  test('direct mode: coverage decides, so shapes meeting off the pixel grid leave no gap', () => {
    const s = lib().t2.scene(12, 4, { mode: 'direct', outline: false });
    s.add({ type: 'rect', x: 0, y: 0, w: 5.45, h: 4, color: 'stone.0' }, { type: 'rect', x: 5.45, y: 0, w: 6.55, h: 4, color: 'moss.0' });
    const g = s.render();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) expect(g.alpha(x, y)).toBe(255);
    expect(g.get(5, 0)).toBe(RAMPS.moss[0]); // 55% moss
  });

  test.each(['direct', 'ss'] as const)('%s mode: crisp, every colour on the asset palette, outline exactly 1 px', mode => {
    const s = lib().t2.scene(24, 24, { mode });
    s.add({ type: 'ellipse', cx: 12.3, cy: 11.7, rx: 7.4, ry: 6.2, mat: 'stone', shade: 'normal' },
      { type: 'path', d: 'M4 20 Q12 13 20 20 Z', mat: 'moss', shade: 'linear', underlay: true },
      { type: 'star', cx: 12, cy: 10, r: 3.5, r2: 1.5, n: 5, mat: 'gold', shade: 'sphere' });
    const g = s.render(), pal = new Set(kindPalette(dir, 'prop'));
    expect(partial(g)).toBe(0);
    for (const c of opaqueColours(g)) expect(pal.has(c)).toBe(true);
    const r = s.raster(), outer = lib().line(r.toGrid());
    expect(outer.diffCount(g)).toBe(0); // the outer line is the direction's 1 px pass at final resolution
  });

  test('ss stages are inspectable in order (R8)', () => {
    const seen: [string, number][] = [];
    const l = makeLib(dirContext(dir), 'prop', (n, g) => seen.push([n, g.w]));
    const s = l.t2.scene(8, 8, { mode: 'ss', ss: 4, shadow: [1, 1] });
    s.add({ type: 'rect', x: 2, y: 2, w: 4, h: 4, mat: 'stone', shade: 'bevel' });
    s.render();
    expect(seen).toEqual([['raster-ss', 32], ['downsample', 8], ['outline', 8], ['shadow', 8]]);
  });

  test('underlay inks only over content beneath: internal outline yes, silhouette growth no', () => {
    const base: Spec[] = [{ type: 'rect', x: 2, y: 2, w: 12, h: 12, mat: 'stone', shade: 'flat' }];
    const top: Spec = { type: 'group', children: [{ type: 'rect', x: 6, y: 0, w: 4, h: 10, mat: 'gold', shade: 'flat' }] };
    const plain = lib().t2.scene(16, 16).add(...base, top).raster(), inked = lib().t2.scene(16, 16).add(...base, { ...top, underlay: true }).raster();
    expect(filled(inked)).toBe(filled(plain));
    expect(inked.flag.filter(f => f & INK).length).toBeGreaterThan(0);
    expect(inked.flag[10 * 16 + 7] & INK).toBe(INK); // just below the bar, over the stone
    expect(inked.flag[1 * 16 + 5] & INK).toBe(0);    // beside the bar, over nothing
    const none = lib(make({ line: { inner: 'none' } })).t2.scene(16, 16).add(...base, { ...top, underlay: true }).raster();
    expect(none.flag.some(f => f & INK)).toBe(false); // direction line.inner none: no inner lines
  });

  test('booleans, clip, repeat, mirror copies and z-order', () => {
    const r = (specs: Spec[]) => lib().t2.scene(16, 16, { mode: 'direct' }).add(...specs).raster();
    const hole = r([{ type: 'subtract', shapes: [{ type: 'rect', x: 2, y: 2, w: 12, h: 12 }, { type: 'circle', cx: 8, cy: 8, r: 3 }], mat: 'stone' }]);
    expect(hole.filled(8, 8)).toBe(false); expect(hole.filled(3, 3)).toBe(true);
    const inter = r([{ type: 'intersect', shapes: [{ type: 'rect', x: 0, y: 0, w: 8, h: 16 }, { type: 'rect', x: 4, y: 0, w: 12, h: 4 }], mat: 'stone' }]);
    expect(filled(inter)).toBe(16);
    const clipped = r([{ type: 'group', clip: { type: 'rect', x: 0, y: 0, w: 8, h: 16 }, children: [{ type: 'rect', x: 0, y: 0, w: 16, h: 2, mat: 'moss' }] }]);
    expect(filled(clipped)).toBe(16);
    const rep = r([{ type: 'group', repeat: { n: 4, dx: 4 }, children: [{ type: 'rect', x: 0, y: 0, w: 2, h: 2, mat: 'gold' }] }]);
    expect(filled(rep)).toBe(16); expect(rep.filled(12, 0)).toBe(true); expect(rep.filled(2, 0)).toBe(false);
    const mir = r([{ type: 'rect', x: 1, y: 1, w: 3, h: 3, mat: 'gold', mirrorX: 8 }]);
    expect([12, 13, 14].map(x => mir.filled(x, 2))).toEqual([true, true, true]); expect(mir.filled(15, 2)).toBe(false); expect(mir.filled(11, 2)).toBe(false);
    const z = r([{ type: 'rect', x: 0, y: 0, w: 8, h: 8, mat: 'gold', z: 1 }, { type: 'rect', x: 4, y: 4, w: 8, h: 8, mat: 'moss' }]);
    expect(z.item(5, 5)!.ramp![0]).toBe(RAMPS.gold[0]);
  });

  test('tube follows its path; transforms rotate and scale geometry', () => {
    const t = lib().t2.scene(20, 20, { mode: 'direct' }).add({ type: 'tube', d: 'M2 10 Q10 2 18 10', w: 2, mat: 'stone' }).raster();
    expect(t.filled(2, 9) || t.filled(2, 10)).toBe(true); expect(t.filled(17, 9) || t.filled(17, 10)).toBe(true); expect(t.filled(10, 15)).toBe(false);
    const rot = lib().t2.scene(20, 20, { mode: 'direct' }).add({ type: 'rect', x: -1, y: -6, w: 2, h: 12, mat: 'stone', translate: [10, 10], rotate: 90 }).raster();
    expect(rot.filled(4, 10)).toBe(true); expect(rot.filled(10, 4)).toBe(false);
  });

  test.each(['bevel', 'linear', 'sphere', 'normal', 'cyl'] as const)('%s shading is lit from the direction light', shade => {
    const spec: Spec = { type: 'ellipse', cx: 12, cy: 12, rx: 10, ry: 10, mat: 'stone', shade };
    const ul = lib().t2.scene(24, 24, { mode: 'direct' }).add(spec).raster();
    expect(meanBand(ul, 3, 3, 7, 7)).toBeLessThan(meanBand(ul, 14, 14, 7, 7));
    const lr = lib(make({ camera: { view: 'topdown', light: [1, 1, 1] } })).t2.scene(24, 24, { mode: 'direct' }).add(spec).raster();
    expect(meanBand(lr, 3, 3, 7, 7)).toBeGreaterThan(meanBand(lr, 14, 14, 7, 7));
  });

  test('shading uses only the direction bands; ink, cast shadow and AO step along the ramp', () => {
    const two = lib(make({ shading: { bands: 2 } })).t2.scene(16, 16, { mode: 'direct' }).add({ type: 'circle', cx: 8, cy: 8, r: 7, mat: 'stone', shade: 'normal' }).raster();
    expect(new Set([...two.band].filter((_, i) => two.id[i] >= 0))).toEqual(new Set([0, 3]));
    const s = lib().t2.scene(16, 16, { mode: 'direct' }).add(
      { type: 'rect', x: 0, y: 0, w: 16, h: 16, mat: 'stone', shade: 'flat', band: 1 },
      { type: 'rect', x: 4, y: 4, w: 4, h: 4, mat: 'gold', shade: 'flat', cast: 2, ink: true },
    ).raster();
    expect(s.band[9 * 16 + 9]).toBe(2); expect(s.band[12 * 16 + 12]).toBe(1); // shadow falls down-right, 2 px
    expect(s.flag[4 * 16 + 5] & INK).toBe(INK); // gold edge over stone is inked
  });

  test('lint: strokes (R4) and colours outside the direction (R11) fail conformance; empty shapes only flag', () => {
    const r = renderAsset({ render: ctx => ctx.lib.t2.scene(16, 16).add({ type: 'rect', x: 2, y: 2, w: 4, h: 4, mat: ['#ff0000'], stroke: '#000000' }, { type: 'rect', x: 40, y: 0, w: 1, h: 1, mat: 'stone' }).render() } as AssetModule,
      { dir, brief: { id: 'x', kind: 'prop', size: 'prop' } });
    expect(r.lint.some(m => m.includes('(R4)'))).toBe(true);
    expect(r.lint.some(m => m.includes('(R11)'))).toBe(true);
    expect(r.lint.some(m => m.includes('covers no pixels'))).toBe(true);
    const c = conformance({ frames: r.cells.map(x => x.grid), dir, lint: r.lint });
    expect(c.checks.find(x => x.id === 'lint')!.status).toBe('fail');
    expect(conformance({ frames: r.cells.map(x => x.grid), dir, lint: ['rect: covers no pixels'] }).checks.find(x => x.id === 'lint')!.status).toBe('flag');
  });
});

describe('procedural pass', () => {
  const scene = () => lib().t2.scene(24, 24, { mode: 'direct' }).add({ type: 'rect', name: 'slab', x: 2, y: 2, w: 20, h: 20, mat: 'stone', shade: 'flat', band: 1 });

  test('materialNoise is seeded, stays on the ramp and leaves the silhouette edge alone', () => {
    const a = lib().proc(scene()).add('materialNoise', { amount: 0.5, scale: 2 }).render(), b = lib().proc(scene()).add('materialNoise', { amount: 0.5, scale: 2 }).render();
    const c = makeLib(dirContext(dir), 'prop', undefined, 7).proc(scene()).add('materialNoise', { amount: 0.5, scale: 2 }).render();
    const plain = scene().render();
    expect(a.hash()).toBe(b.hash()); expect(a.hash()).not.toBe(c.hash()); expect(a.hash()).not.toBe(plain.hash());
    for (const col of opaqueColours(a)) expect([...RAMPS.stone, O]).toContain(col);
    for (let i = 2; i < 22; i++) expect(a.get(i, 2)).toBe(plain.get(i, 2));
  });

  test('pattern stripes, lit rim, ground shadow; dither only when the direction allows it', () => {
    const st = lib().proc(scene()).add('pattern', { type: 'stripes', axis: 'x', period: 4, step: 1 }).render();
    expect(st.get(10, 4)).toBe(RAMPS.stone[2]); expect(st.get(10, 5)).toBe(RAMPS.stone[1]);
    const rim = lib().proc(scene()).add('rimLight').render();
    expect(rim.get(2, 10)).toBe(RAMPS.stone[0]); expect(rim.get(21, 10)).toBe(RAMPS.stone[1]);
    const gs = lib().proc(scene()).add('groundShadow', { cx: 12, cy: 23, rx: 10 }).render();
    expect(partial(gs)).toBeGreaterThan(0);
    const grad = () => lib(make({ shading: { bands: 4, dither: 'bayer2' } })).t2.scene(24, 24, { mode: 'direct' }).add({ type: 'rect', x: 0, y: 0, w: 24, h: 24, mat: 'stone', shade: 'linear' });
    const flat = lib(make({ shading: { bands: 4, dither: 'bayer2' } })).proc(grad()).render();
    const dith = lib(make({ shading: { bands: 4, dither: 'bayer2' } })).proc(grad()).add('dither').render();
    expect(dith.hash()).not.toBe(flat.hash());
    expect(lib().proc(lib().t2.scene(24, 24).add({ type: 'rect', x: 0, y: 0, w: 24, h: 24, mat: 'stone', shade: 'linear' })).add('dither').render().hash())
      .toBe(lib().t2.scene(24, 24).add({ type: 'rect', x: 0, y: 0, w: 24, h: 24, mat: 'stone', shade: 'linear' }).render().hash());
  });

  test('works on finished grids too, and the direction supplies default layers', () => {
    const g = scene().render(), same = lib().proc(g).render();
    expect(same.diffCount(g)).toBe(0);
    expect(Raster.fromGrid(g, dirContext(dir).pal, O).toGrid().diffCount(g)).toBe(0);
    const withDefault = lib(make({ pipeline: { procedural: ['rimLight'] } })).proc(scene()).render();
    expect(withDefault.hash()).toBe(lib().proc(scene()).add('rimLight').render().hash());
    expect(() => lib().proc(scene()).add('nope')).toThrow('does not exist');
  });
});

describe('finishing ops', () => {
  const dc = dirContext(dir), [lt, mid] = RAMPS.stone;
  const block = () => { const g = new Grid(10, 10).fill(1, 1, 8, 8, O).fill(2, 2, 6, 6, mid); return g; };

  test('fix: orphans, jaggies (elbows that touch no fill, incl. box corners), pillow; protected pixels are skipped', () => {
    const px = makePx(dc), g = block(); g.set(4, 4, RAMPS.gold[0]);
    px.fix.orphans(g); expect(g.get(4, 4)).toBe(mid);
    const guard = new Set(['4,4']), px2 = makePx(dc, undefined, guard), h = block(); h.set(4, 4, RAMPS.gold[0]);
    px2.fix.orphans(h); expect(h.get(4, 4)).toBe(RAMPS.gold[0]);
    const stair = new Grid(6, 6); for (const [x, y] of [[0, 3], [1, 3], [1, 2], [2, 2], [2, 1], [3, 1]]) stair.set(x, y, O);
    px.fix.jaggies(stair);
    expect([[0, 3], [1, 3], [2, 2], [3, 1]].map(([x, y]) => stair.get(x, y))).toEqual([O, O, O, O]); // still one 8-connected line
    expect(stair.get(1, 2)).toBeNull(); expect(stair.get(2, 1)).toBeNull();
    const box = block(); px.fix.jaggies(box); expect(box.diffCount(block())).toBe(4); // box corners round off, nothing else moves
    expect([box.get(1, 1), box.get(8, 8), box.get(2, 1), box.get(2, 2)]).toEqual([null, null, O, mid]);
    const pil = block().fill(2, 2, 6, 1, RAMPS.stone[3]).fill(2, 3, 6, 1, lt); px.fix.pillow(pil);
    expect(pil.get(4, 2)).toBe(lt);
  });

  test('light, fx and outline ops move pixels along their own ramp and use tokens', () => {
    const px = makePx(dc);
    const t = block(); px.light.tone(t, { region: [2, 2, 3, 3] }); expect(t.get(2, 2)).toBe(lt); expect(t.get(6, 6)).toBe(mid);
    const r = block(); px.light.rim(r); expect(r.get(2, 4)).toBe(lt); expect(r.get(7, 4)).toBe(mid);
    const s = block(); px.outline.selout(s); expect(s.get(1, 4)).toBe(RAMPS.stone[3]); expect(s.get(8, 4)).toBe(O);
    const w = block(); px.outline.weight(w); expect(w.get(0, 4)).toBe(O);
    const gl = block(); px.fx.glint(gl, [4, 4], 'gold.0', { shape: 'plus' }); expect(gl.get(4, 4)).toBe(RAMPS.gold[0]); expect(gl.get(5, 4)).toBe(lt);
    expect(() => px.set(block(), [0, 0], 'nope.1')).toThrow('unknown colour token');
  });

  test('with a selout direction the silhouette is the line: fill ops leave it alone', () => {
    const sel = dirContext(make({ line: { outer: 'selout' } })), px = makePx(sel);
    // a selout sprite: darkest stone on the silhouette, mid inside
    const g = new Grid(10, 10).fill(1, 1, 8, 8, RAMPS.stone[3]).fill(2, 2, 6, 6, mid);
    px.light.rim(g);
    expect(g.get(1, 4)).toBe(RAMPS.stone[3]); // the line stays
    expect(g.get(2, 4)).toBe(lt); // the lit edge inside it is rimmed
    expect(g.get(7, 4)).toBe(mid);
  });

  test('patches follow anchors into other frames; west facings mirror the finished east cells; snapshots catch stale finishes', () => {
    const mod: AssetModule = {
      render: ctx => { const g = new Grid(12, 12); g.fill(2, 2 + ctx.frame, 8, 8, ctx.dir.pal.stone[1]); return ctx.lib.line(g); },
      anchors: ctx => ({ eye: [4, 5 + ctx.frame] }),
    };
    const brief = { id: 'blob', kind: 'prop', size: [12, 12] as [number, number], directions: 4 as const, states: ['idle'], anims: { idle: { frames: 2 } } };
    const fin: FinishModule = { base: 'base.v1', finish(g, ctx) { if (ctx.key('idle', 0)) ctx.lib.px.patch(g, ctx.at('eye'), ['ab'], { a: 'gold.0', b: 'outline' }); return g; } };
    const r = renderAsset(mod, { dir, brief }), f = applyFinish(r, fin, dir);
    const cell = (facing: string, frame: number) => f.render.cells.find(c => c.facing === facing && c.frame === frame)!.grid;
    expect(cell('e', 0).get(3, 5)).toBe(RAMPS.gold[0]);
    expect(cell('e', 1).get(3, 6)).toBe(RAMPS.gold[0]); // replayed at the frame-1 anchor
    expect(cell('w', 1).diffCount(cell('e', 1).flip('x'))).toBe(0);
    expect(f.patches.filter(p => p.replay).map(p => p.cell).sort()).toEqual(['idle/e/1', 'idle/n/1', 'idle/s/1']); // w is mirrored from e
    const snap = finishSnapshot(f.patches);
    expect(finishStale(snap, applyFinish(renderAsset(mod, { dir, brief }), fin, dir).patches)).toEqual([]);
    const alt = make({ palette: { ramps: { stone: ['#ffffff', '#aaaaaa', '#777777', '#444444'], moss: RAMPS.moss, gold: ['#fff0aa', '#ccaa22', '#664400'] }, outline: '#000000' } });
    expect(finishStale(snap, applyFinish(renderAsset(mod, { dir: alt, brief }), fin, alt).patches)).toEqual([]); // restyle: same tokens
    const moved: AssetModule = { ...mod, render: ctx => { const g = new Grid(12, 12); g.fill(5, 0, 7, 12, ctx.dir.pal.moss[0]); return g; } };
    expect(finishStale(snap, applyFinish(renderAsset(moved, { dir, brief }), fin, dir).patches).length).toBeGreaterThan(0);
  });
});

describe('3D mode', () => {
  const model = () => lib().t2.scene3d();

  test('slabs recolour the surface they lie on (add: true also fills); interpenetrating solids are linted (R5)', () => {
    const m = model().add({ type: 'box', x: 0, y: 0, z: 0, w: 4, d: 3, h: 2, mat: 'stone' }, { type: 'slab', x: 1, y: -2, z: 0, w: 1, d: 7, h: 4, mat: 'gold' });
    const v = m.voxels();
    expect(v.size).toBe(24);
    expect([...v.values()].filter(x => x.ramp[0] === RAMPS.gold[0])).toHaveLength(6);
    expect(m.lint()).toEqual([]);
    expect(model().add({ type: 'box', x: 0, y: 0, z: 0, w: 2, d: 2, h: 1, mat: 'stone' }, { type: 'slab', add: true, x: 0, y: 0, z: 1, w: 1, d: 1, h: 1, mat: 'gold' }).voxels().size).toBe(5);
    const bad = model().add({ type: 'box', x: 0, y: 0, z: 0, w: 4, d: 4, h: 2, mat: 'stone' }, { type: 'box', name: 'strap', x: 1, y: 0, z: 0, w: 1, d: 4, h: 2, mat: 'gold' });
    expect(bad.lint()[0]).toMatch(/strap interpenetrates.*\(R5\)/);
  });

  test('facings rotate the model; booleans and groups transform voxels', () => {
    const m = model().add({ type: 'box', x: 0, y: 0, z: 0, w: 4, d: 2, h: 1, mat: 'stone' }, { type: 'box', x: 0, y: 0, z: 1, w: 1, d: 1, h: 1, mat: 'gold' });
    const s = m.render(32, 32, { ox: 16, oy: 12 }), e = m.render(32, 32, { ox: 16, oy: 12, facing: 'e' }), n = m.render(32, 32, { ox: 16, oy: 12, facing: 'n' });
    expect(s.hash()).not.toBe(e.hash()); expect(s.hash()).not.toBe(n.hash());
    expect(() => m.render(32, 32, { ox: 16, oy: 12, facing: 'ne' })).toThrow('not supported');
    const sub = model().add({ type: 'subtract', mat: 'stone', shapes: [{ type: 'box', x: 0, y: 0, z: 0, w: 3, d: 3, h: 3 }, { type: 'box', x: 1, y: 1, z: 1, w: 1, d: 1, h: 1 }] });
    expect(sub.voxels().size).toBe(26);
    const g = model().add({ type: 'group', translate: [2, 0, 0], rotate: 90, children: [{ type: 'box', x: 0, y: 0, z: 0, w: 3, d: 1, h: 1, mat: 'stone' }] });
    expect([...g.voxels().values()].map(x => x.v.join(',')).sort()).toEqual(['1,0,0', '1,1,0', '1,2,0']);
  });
});

describe('params', () => {
  const schema = { size: { type: 'range', min: 1, max: 5, step: 1 }, hat: { type: 'toggle', default: true }, cloth: { type: 'swap', options: ['moss', 'stone'] }, fixed: 3 };
  test('variant 0 = defaults, variants are seeded and deterministic, overrides win, plain values stay', () => {
    expect(resolveParams(schema)).toEqual({ size: 3, hat: true, cloth: 'moss', fixed: 3 });
    expect(resolveParams(schema, 4)).toEqual(resolveParams(schema, 4));
    const seen = new Set(Array.from({ length: 8 }, (_, k) => JSON.stringify(resolveParams(schema, k + 1))));
    expect(seen.size).toBeGreaterThan(4);
    for (let k = 1; k < 8; k++) { const p = resolveParams(schema, k); expect(p.fixed).toBe(3); expect([1, 2, 3, 4, 5]).toContain(p.size); }
    expect(resolveParams(schema, 2, { size: 9 }).size).toBe(9);
  });
});
