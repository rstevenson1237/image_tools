// Stage keys and shape checks (docs/STAGES.md §4, §5.3), and the placeholder (§5.1).
import { describe, expect, test } from 'vitest';
import { parseDirection, pxPerMetre, VIEWS, type Direction } from 'artgen-scene/direction.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { outline } from 'artgen-primitives/lib/post.ts';
import { FACINGS, renderAsset, type AssetModule, type RenderResult } from '../render.ts';
import { BRIEF_KINDS, validateBrief, type BriefEntry } from '../w2/briefs.ts';
import { buildPack } from '../w2/pack.ts';
import { defaultPlaceholder, parsePlaceholder, placeholderChecks, placeholderModule } from '../w2/placeholder.ts';
import { compactness, placeholderKey, shapeChecks, shapeMask, shapeSheet, stageKeys, stageReport, SHAPE_READ_MAX } from './stages.ts';

const RAMPS = { cloth: ['#f0d0d0', '#c08080', '#804040'], skin: ['#f0e0c0', '#c0a070', '#806040'], wood: ['#d0a060', '#a07030', '#604010'], stone: ['#c0c0c0', '#808080', '#404040'], glow: ['#ffffc0', '#ffc040', '#c06000'] };
const scale = { character: [32, 32], prop: [24, 24], tile: 16, layer: [64, 32], effect: [16, 16], viewmodel: [48, 32], 'ui-icon': [16, 16], vehicle: [32, 32] };
const mkDir = (o: { view?: string; outer?: 'dark' | 'selout' | 'none'; ramps?: Record<string, string[]>; outline?: string } = {}): Direction => parseDirection({
  id: 't', version: 1, status: 'locked', camera: { view: o.view ?? 'iso', light: [-1, -1, 1], directions: 8 }, scale,
  palette: { ramps: o.ramps ?? RAMPS, outline: o.outline ?? '#101018' }, line: { outer: o.outer ?? 'dark', inner: 'none', weight: 1 },
});

/** A body of ramp colours with the direction's outer line drawn outside it, on a 16×16 frame. */
function body(dir: Direction, ramp = 'cloth'): Grid {
  const R = dir.palette.ramps[ramp], g = new Grid(16, 16);
  g.fill(5, 3, 6, 11, R[1]); g.fill(5, 3, 6, 2, R[0]); g.fill(5, 12, 6, 2, R[2]);
  const lined = dir.line.outer === 'none' ? g : dir.line.outer === 'dark' ? outline(g, dir.palette.outline) : outline(g, R[2]);
  lined.set(0, 15, 'rgba(0,0,0,0.35)'); // a translucent ground shadow is not shape
  return lined;
}

describe('shapeMask', () => {
  test('drops the outer line (dark outline) and translucent pixels', () => {
    const dir = mkDir(), m = shapeMask(body(dir), dir);
    expect(m.reduce((n, v) => n + v, 0)).toBe(6 * 11);
    expect(m[3 * 16 + 5]).toBe(1); expect(m[2 * 16 + 5]).toBe(0); expect(m[15 * 16 + 0]).toBe(0);
  });
  test('selout lines are the darkest step of the ramp; none keeps every opaque pixel', () => {
    const sel = mkDir({ outer: 'selout' });
    // 6x11 fill with a 1 px selout line, whose fill edge pixels (not touching air) stay
    expect(shapeMask(body(sel), sel).reduce((n, v) => n + v, 0)).toBe(6 * 11 - 6 * 2 + 6 * 2 - 0);
    const none = mkDir({ outer: 'none' });
    expect(shapeMask(body(none), none).reduce((n, v) => n + v, 0)).toBe(6 * 11);
  });
  test('a palette-only or line-only restyle keeps the mask', () => {
    const a = mkDir(), b = mkDir({ outline: '#401020', ramps: { ...RAMPS, cloth: ['#d0f0d0', '#80c080', '#408040'] } });
    expect(Array.from(shapeMask(body(a), a))).toEqual(Array.from(shapeMask(body(b), b)));
  });
});

const sprite = (_dir: Direction, o: { bodyColour?: number; w?: number } = {}): AssetModule => ({
  render(ctx) {
    const R = ctx.dir.pal.cloth, g = new Grid(...ctx.size), w = o.w ?? 6 + ctx.frame;
    g.fill(5, 3, w, 11, R[o.bodyColour ?? 1]); g.fill(5, 3, w, 2, R[0]);
    return ctx.lib.line(g);
  },
  anchors: () => ({ head: [8, 5] }),
  meta: { mirror: true },
});
const brief = (b: Partial<BriefEntry> = {}): BriefEntry => ({ id: 'a', kind: 'character', size: [16, 16], states: ['idle', 'walk'], directions: 4, anims: { walk: { frames: 3 } }, ...b });
const render = (dir: Direction, m: AssetModule, b = brief()): RenderResult => renderAsset(m, { dir, brief: b });

describe('stage keys', () => {
  const dir = mkDir();
  test('deterministic, 8 hex digits, the same for the same render', () => {
    const k = stageKeys(render(dir, sprite(dir)), dir), k2 = stageKeys(render(dir, sprite(dir)), dir);
    expect(k).toEqual(k2);
    for (const v of Object.values(k)) expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(Object.keys(k).sort()).toEqual(['animation', 'decorate', 'shape']);
  });
  test('a palette, line-colour or shading restyle changes decorate and nothing before it', () => {
    const b = mkDir({ outline: '#401020', ramps: { ...RAMPS, cloth: ['#d0f0d0', '#80c080', '#408040'] } });
    const ka = stageKeys(render(dir, sprite(dir)), dir), kb = stageKeys(render(b, sprite(b)), b);
    expect(kb.shape).toBe(ka.shape); expect(kb.animation).toBe(ka.animation); expect(kb.decorate).not.toBe(ka.decorate);
  });
  test('a different silhouette changes shape; a different body colour does not', () => {
    const k0 = stageKeys(render(dir, sprite(dir)), dir), wide = stageKeys(render(dir, sprite(dir, { w: 8 })), dir), dark = stageKeys(render(dir, sprite(dir, { bodyColour: 2 })), dir);
    expect(wide.shape).not.toBe(k0.shape);
    expect(dark.shape).toBe(k0.shape); expect(dark.decorate).not.toBe(k0.decorate);
  });
  test('the animation key follows the contract and the anchors, the lighting key the normal maps', () => {
    const base = stageKeys(render(dir, sprite(dir)), dir), moved = stageKeys(render(dir, { ...sprite(dir), anchors: () => ({ head: [8, 6] }) }), dir);
    const longer = stageKeys(render(dir, sprite(dir), brief({ anims: { walk: { frames: 4 } } })), dir);
    expect(moved.animation).not.toBe(base.animation); expect(moved.shape).toBe(base.shape);
    expect(longer.animation).not.toBe(base.animation);
    const lit: AssetModule = { render: ctx => { const g = sprite(dir).render(ctx); g.normal = new Grid(g.w, g.h).fill(0, 0, g.w, g.h, '#8080ff'); return g; } };
    expect(stageKeys(render(dir, lit), dir).lighting).toMatch(/^[0-9a-f]{8}$/);
    expect(base.lighting).toBeUndefined();
  });
  test('the placeholder key digests the canonical JSON, whatever the key order', () => {
    const ph = defaultPlaceholder(brief({ size: undefined }), dir);
    expect(placeholderKey(ph)).toBe(placeholderKey(JSON.parse(JSON.stringify({ anchors: ph.anchors, ramp: ph.ramp, body: ph.body, pivot: ph.pivot, size: ph.size, format: 1, footprint: ph.footprint, collision: ph.collision }))));
    expect(stageKeys(render(dir, sprite(dir)), dir, { placeholder: ph }).placeholder).toBe(placeholderKey(ph));
  });
});

describe('shape checks (synthetic shapes)', () => {
  const dir = mkDir({ outer: 'none' });
  const cell = (draw: (g: Grid) => void, facing = 's', state = 'idle'): RenderResult['cells'][number] => { const g = new Grid(32, 32); draw(g); return { state, facing, frame: 0, grid: g, mirrored: false }; };
  const res = (cells: RenderResult['cells'], b: Partial<BriefEntry> = {}): RenderResult => ({
    brief: brief({ size: [32, 32], ...b }), size: [32, 32], states: ['idle'], facings: [...new Set(cells.map(c => c.facing))], frames: { idle: 1 }, cells, lint: [],
  });
  const status = (r: RenderResult, b: Partial<BriefEntry> = {}) => Object.fromEntries(shapeChecks(r, dir, { brief: brief({ size: [32, 32], ...b }) }).map(c => [c.id, c.status]));
  const person = (g: Grid) => { g.fill(12, 4, 8, 6, '#c08080'); g.fill(10, 10, 12, 14, '#c08080'); g.fill(11, 24, 4, 7, '#c08080'); g.fill(17, 24, 4, 7, '#c08080'); };

  test('a person-shaped figure standing on the pivot passes every check', () => {
    expect(status(res([cell(person)]))).toEqual({ 'shape-empty': 'pass', 'shape-pivot': 'pass', 'shape-box': 'pass', 'shape-read': 'pass', 'shape-facings': 'skip' });
  });
  test('an empty cell fails shape-empty', () => {
    expect(status(res([cell(person), cell(() => {}, 'n')]))['shape-empty']).toBe('fail');
  });
  test('feet far above the pivot fail shape-pivot, a 2 px gap flags', () => {
    expect(status(res([cell(g => g.fill(10, 2, 12, 20, '#c08080'))]))['shape-pivot']).toBe('fail');
    expect(status(res([cell(g => g.fill(10, 4, 12, 26, '#c08080'))]))['shape-pivot']).toBe('flag');
  });
  test('a shape much shorter than the placeholder body fails shape-box, a little shorter flags', () => {
    expect(status(res([cell(g => g.fill(10, 17, 12, 14, '#c08080'))]))['shape-box']).toBe('flag'); // against the default guess
    expect(status(res([cell(g => g.fill(10, 17, 12, 14, '#c08080'))], { height: 1.5 }), { height: 1.5 })['shape-box']).toBe('fail');
    expect(status(res([cell(g => g.fill(10, 8, 12, 23, '#c08080'))]))['shape-box']).toBe('flag');
  });
  test('a blob flags shape-read; a figure with limbs does not', () => {
    const blob = cell(g => g.fill(6, 7, 20, 24, '#c08080'));
    expect(status(res([blob]))['shape-read']).toBe('flag');
    expect(status(res([blob]), { kind: 'tile' })['shape-read']).toBe('skip');
    expect(status(res([cell(person)]))['shape-read']).toBe('pass');
    expect(SHAPE_READ_MAX).toBeLessThan(0.785);
    expect(compactness(new Uint8Array(0), 0, 0)).toBe(0);
    const disc = new Uint8Array(32 * 32); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((x - 15.5) ** 2 + (y - 15.5) ** 2 <= 14 ** 2) disc[y * 32 + x] = 1;
    expect(compactness(disc, 32, 32)).toBeGreaterThan(0.55); expect(compactness(disc, 32, 32)).toBeLessThan(0.66);
  });
  test('two facings that are not mirrors and have the same silhouette flag shape-facings; mirrors and different shapes do not', () => {
    const r = res([cell(person, 's'), cell(person, 'n')], { directions: 4 });
    expect(status(r, { directions: 4 })['shape-facings']).toBe('flag');
    expect(status(res([cell(person, 'e'), cell(person, 'w')]))['shape-facings']).toBe('pass');
    expect(status(res([cell(person, 's'), cell(g => g.fill(10, 4, 14, 27, '#c08080'), 'n')]))['shape-facings']).toBe('pass');
  });
  test('kinds without a standing pivot skip the pivot and box checks', () => {
    expect(status(res([cell(g => g.fill(4, 4, 24, 24, '#808080'))], { kind: 'effect' }), { kind: 'effect' })).toMatchObject({ 'shape-pivot': 'skip', 'shape-box': 'skip' });
    // and so do figures anchored at the frame centre (top-down)
    expect(status(res([cell(person)], { view: 'topdown' }), { view: 'topdown' })).toMatchObject({ 'shape-pivot': 'skip', 'shape-box': 'skip' });
  });
  test('stageReport brings the placeholder checks when a placeholder is given, and none otherwise', () => {
    const r = res([cell(person)]), ph = defaultPlaceholder(r.brief as BriefEntry, dir);
    expect(stageReport(r, dir, { brief: r.brief as BriefEntry }).checks.every(c => c.stage === 'shape')).toBe(true);
    expect(stageReport(r, dir, { brief: r.brief as BriefEntry, placeholder: ph }).checks.filter(c => c.stage === 'placeholder').map(c => c.id)).toEqual(['ph-size', 'ph-pivot', 'ph-box', 'ph-ramp']);
  });
  test('the shape sheet draws every drawn facing and the check lines, far smaller than a review sheet', () => {
    const r = res([cell(person, 's'), cell(g => g.fill(10, 4, 14, 27, '#c08080'), 'e'), { ...cell(g => g.fill(10, 4, 14, 27, '#c08080'), 'w'), mirrored: true }]);
    const checks = shapeChecks(r, dir, { brief: r.brief as BriefEntry });
    const sheet = shapeSheet(r, dir, { title: 'a - base.v1 shape', placeholder: defaultPlaceholder(r.brief as BriefEntry, dir), checks });
    expect(sheet.w).toBeGreaterThan(200); expect(sheet.w * sheet.h).toBeLessThan(900 * 600);
  });
});

describe('the placeholder', () => {
  const dirs: Record<string, Direction> = Object.fromEntries(VIEWS.map(v => [v, mkDir({ view: v })]));
  const bodies = [undefined, 'quadruped', 'serpent', 'flyer', 'large'] as const;

  test('defaults for every kind × view × body pass every placeholder check', () => {
    let n = 0;
    for (const view of VIEWS) for (const kind of BRIEF_KINDS) for (const body of kind === 'character' || kind === 'creature' ? bodies : [undefined]) {
      const dir = dirs[view], b: BriefEntry = { id: 'x', kind, view, ...(body && { body }) };
      for (const withHeight of [false, true]) {
        const bb = withHeight && (kind === 'character' || kind === 'creature') ? { ...b, height: 1.2 } : b, ph = defaultPlaceholder(bb, dir);
        const bad = placeholderChecks(ph, bb, dir).filter(c => c.status !== 'pass');
        expect(bad, `${view}/${kind}/${body}/${withHeight}: ${JSON.stringify(bad)}`).toEqual([]);
        expect(validateBrief({ ...bb, id: 'x' })).toEqual([]);
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  test('a standing figure: body on the pivot, footprint below it, anchors on the body', () => {
    const dir = dirs.iso, ph = defaultPlaceholder({ id: 'g', kind: 'character', view: 'iso' }, dir);
    expect(ph.size).toEqual([32, 32]); expect(ph.pivot).toEqual([16, 31]);
    expect(ph.body.y + ph.body.h - 1).toBe(31); expect(ph.body.h).toBe(Math.round(32 * 0.88)); expect(ph.body.w).toBe(Math.round(ph.body.h * 0.45));
    expect(ph.footprint).toMatchObject({ cx: 16, rx: Math.round(ph.body.w / 2) + 1 }); expect(ph.collision).toEqual({ x: 16 - ph.footprint!.rx, y: ph.footprint!.cy - ph.footprint!.ry, w: 2 * ph.footprint!.rx, h: 2 * ph.footprint!.ry });
    expect(Object.keys(ph.anchors)).toEqual(['head', 'hand']);
    expect(ph.ramp).toBe('cloth');
    const h = defaultPlaceholder({ id: 'g', kind: 'character', view: 'iso', height: 1 }, dir);
    expect(h.body.h).toBe(Math.round(pxPerMetre(dir)));
  });
  test('top-down figures stand on the template ground line, not the centre pivot; side view has no footprint', () => {
    const td = defaultPlaceholder({ id: 'g', kind: 'character', view: 'topdown' }, dirs.topdown);
    expect(td.pivot).toEqual([16, 16]); expect(td.body.y + td.body.h - 1).toBe(30);
    expect(defaultPlaceholder({ id: 'g', kind: 'character', view: 'side' }, dirs.side).footprint).toBeUndefined();
    const fl = defaultPlaceholder({ id: 'b', kind: 'creature', view: 'iso', body: 'flyer' }, dirs.iso);
    expect(fl.body.y + fl.body.h - 1).toBe(31 - Math.round(32 * 0.15)); expect(Object.keys(fl.anchors)).toEqual(['ground', 'head']);
  });
  test('tiles fill the frame, effects sit in the middle', () => {
    expect(defaultPlaceholder({ id: 't', kind: 'tile' }, dirs.iso)).toMatchObject({ size: [16, 16], body: { x: 0, y: 0, w: 16, h: 16 }, collision: { x: 0, y: 0, w: 16, h: 16 }, ramp: 'stone' });
    const fx = defaultPlaceholder({ id: 'f', kind: 'effect' }, dirs.iso);
    expect(fx.collision).toBeUndefined(); expect(fx.footprint).toBeUndefined(); expect(fx.ramp).toBe('glow');
  });
  test('parsePlaceholder fills the omitted fields from the defaults and throws on a bad file', () => {
    const b: BriefEntry = { id: 'g', kind: 'character', view: 'iso' }, dir = dirs.iso, d = defaultPlaceholder(b, dir);
    expect(parsePlaceholder({ format: 1 }, b, dir)).toEqual({ ...d, footprint: undefined, collision: undefined, anchors: d.anchors });
    expect(parsePlaceholder(JSON.parse(JSON.stringify(d)), b, dir)).toEqual(d);
    for (const bad of [null, { format: 2 }, { format: 1, size: [3] }, { format: 1, body: { x: 0, y: 0, w: 0, h: 3 } }, { format: 1, footprint: { cx: 1 } }, { format: 1, anchors: { head: 'x' } }, { format: 1, pivot: [1.5, 2] }])
      expect(() => parsePlaceholder(bad, b, dir)).toThrow(/placeholder\.json/);
  });
  test('the checks catch a wrong size, a pivot outside, a box outside, an off-height body and an unknown ramp', () => {
    const b: BriefEntry = { id: 'g', kind: 'character', view: 'iso', height: 1.5 }, dir = dirs.iso, d = defaultPlaceholder(b, dir);
    const st = (ph: typeof d) => Object.fromEntries(placeholderChecks(ph, b, dir).map(c => [c.id, c.status]));
    expect(st(d)).toEqual({ 'ph-size': 'pass', 'ph-pivot': 'pass', 'ph-box': 'pass', 'ph-ramp': 'pass' });
    expect(st({ ...d, size: [30, 32] })['ph-size']).toBe('fail');
    expect(st({ ...d, pivot: [40, 3] })['ph-pivot']).toBe('fail');
    expect(st({ ...d, body: { ...d.body, x: 30 } })['ph-box']).toBe('fail');
    expect(st({ ...d, body: { ...d.body, y: 12, h: 10 } })['ph-box']).toBe('flag');
    expect(st({ ...d, ramp: 'nope' })['ph-ramp']).toBe('fail');
  });

  test('the module renders the brief\'s whole contract: states, facings, frames, anchors', () => {
    const dir = dirs.iso, b: BriefEntry = { id: 'g', kind: 'character', view: 'iso', states: ['idle', 'walk', 'hurt'], directions: 8, anims: { walk: { frames: 4 }, hurt: { frames: 2, sub: 2 } } };
    const r = renderAsset(placeholderModule(defaultPlaceholder(b, dir)), { dir, brief: b });
    expect(r.states).toEqual(['idle', 'walk', 'hurt']); expect(r.facings).toEqual(FACINGS[8]);
    expect(r.frames).toEqual({ idle: 1, walk: 4, hurt: 4 });
    expect(r.cells).toHaveLength(8 * (1 + 4 + 4)); expect(r.cells.some(c => c.mirrored)).toBe(false);
    for (const c of r.cells) { expect(c.grid.w).toBe(32); expect(Object.keys(c.anchors!).sort()).toEqual(['hand', 'head']); }
    const pk = buildPack('p', dir, [{ brief: b, view: 'iso', renders: [r], version: 'placeholder', sourceHash: 'k', placeholder: true }]);
    expect(pk.manifest.placeholders).toEqual(['g']); expect(pk.manifest.assets.g.placeholder).toBe(true);
    expect(pk.manifest.assets.g.states.hurt).toMatchObject({ frames: 2, sub: 2 });
  });
  test('the facing tick turns with the facing, states differ in shade, odd frames bob, the footprint stays', () => {
    const dir = dirs.iso, b: BriefEntry = { id: 'g', kind: 'character', view: 'iso', states: ['idle', 'walk'], directions: 4, anims: { walk: { frames: 2 } } };
    const r = renderAsset(placeholderModule(defaultPlaceholder(b, dir)), { dir, brief: b }), at = (s: string, f: string, n: number) => r.cells.find(c => c.state === s && c.facing === f && c.frame === n)!.grid;
    expect(at('idle', 's', 0).hash()).not.toBe(at('idle', 'n', 0).hash());
    expect(at('idle', 's', 0).hash()).not.toBe(at('walk', 's', 0).hash());
    const a = at('walk', 's', 0), c = at('walk', 's', 1);
    expect(a.hash()).not.toBe(c.hash());
    const foot = (g: Grid) => { let n = 0; for (let y = 28; y < 32; y++) for (let x = 0; x < 32; x++) if (g.alpha(x, y) > 0 && g.alpha(x, y) < 255) n++; return n; };
    expect(foot(a)).toBe(foot(c)); expect(foot(a)).toBeGreaterThan(0);
  });
});

describe('the rig stage (R6b, §6.2)', () => {
  const dir = mkDir(), cellAt = (frame: number): RenderResult['cells'][number] => ({ state: 'idle', facing: 's', frame, grid: body(dir), mirrored: false });
  const withRigs = (len: (f: number) => number): RenderResult => ({
    brief: { id: 'r', kind: 'character', states: ['idle'] } as never, size: [16, 16], states: ['idle'], facings: ['s'], frames: { idle: 3 }, cells: [0, 1, 2].map(cellAt), lint: [],
    rigs: Object.fromEntries([0, 1, 2].map(f => [`idle/s/${f}`, [{ plan: 'biped', lengths: { spine: 10, legL_up: len(f) } }]])),
  });
  const brief = { id: 'r', kind: 'character', states: ['idle'] } as BriefEntry;
  test('rig-lengths passes within 0.5 px and names the bone and cells when a length drifts', () => {
    expect(stageReport(withRigs(() => 4), dir, { brief }).checks.find(c => c.id === 'rig-lengths')).toMatchObject({ stage: 'rig', status: 'pass' });
    expect(stageReport(withRigs(f => 4 + f * 0.2), dir, { brief }).checks.find(c => c.id === 'rig-lengths')).toMatchObject({ status: 'pass' });
    const bad = stageReport(withRigs(f => 4 + f), dir, { brief }).checks.find(c => c.id === 'rig-lengths')!;
    expect(bad.status).toBe('fail');
    expect(bad.detail).toContain('legL_up is 4.00 px in idle/s/0 and 6.00 px in idle/s/2');
  });
  test('the rig key digests plan, bones and lengths; unrigged renders have no key and no check', () => {
    const k = (len: number) => stageReport(withRigs(() => len), dir, { brief }).keys.rig;
    expect(k(4)).toMatch(/^[0-9a-f]{8}$/); expect(k(4)).toBe(k(4)); expect(k(4)).not.toBe(k(5)); expect(k(4)).toBe(k(4.004));
    const plain = { ...withRigs(() => 4), rigs: undefined } as RenderResult, rep = stageReport(plain, dir, { brief });
    expect(rep.keys.rig).toBeUndefined(); expect(rep.checks.some(c => c.stage === 'rig')).toBe(false);
  });
});
