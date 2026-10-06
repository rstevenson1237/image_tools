import { describe, expect, test } from 'vitest';
import { parseDirection } from './direction.ts';
import { assembleSheet, FACINGS, mirrorFacing, renderAsset, type AssetModule, type RenderContext } from './render.ts';

const dir = parseDirection({
  id: 't', version: 1, status: 'draft', camera: { view: 'topdown', light: [-1, -1, 1] }, scale: { character: [8, 6] },
  palette: { ramps: { a: ['#ff0000', '#880000'], b: ['#00ff00'] }, outline: '#000011' },
});

/** Test asset: marks state/facing/frame into pixels so cells can be told apart. */
function probe(calls: string[]): AssetModule {
  return {
    params: { size: 2 },
    render(ctx: RenderContext) {
      calls.push(`${ctx.state}/${ctx.facing}/${ctx.frame}`);
      const g = new ctx.lib.Grid(8, 6);
      g.set(0, 0, ctx.dir.pal.a[0]);                                        // asymmetric marker (top-left)
      g.set(1 + ctx.frame, 1, ctx.state === 'walk' ? ctx.dir.pal.b[0] : ctx.dir.pal.a[1]);
      g.set(FACINGS[8].indexOf(ctx.facing), 4, ctx.dir.outline);
      return g;
    },
    anchors: ctx => ({ head: [2 + ctx.frame, 1] }),
  };
}

describe('renderAsset', () => {
  test('loops states × facings × frames, rendering west facings as mirrored east ones', () => {
    const calls: string[] = [];
    const r = renderAsset(probe(calls), { dir, brief: { id: 'p', kind: 'character', size: 'character', states: ['idle', 'walk'], directions: 8, anims: { walk: { frames: 3 } } } });
    expect(r.size).toEqual([8, 6]);
    expect(r.cells).toHaveLength(8 * 1 + 8 * 3);
    expect(calls).toHaveLength(5 * 1 + 5 * 3); // s, n, ne, e, se rendered; sw, w, nw mirrored
    expect(calls.some(c => c.includes('/w/') || c.includes('/sw/') || c.includes('/nw/'))).toBe(false);
    const cell = (s: string, f: string, n: number) => r.cells.find(c => c.state === s && c.facing === f && c.frame === n)!;
    const w = cell('walk', 'w', 2), e = cell('walk', 'e', 2);
    expect(w.mirrored).toBe(true);
    expect(w.grid.diffCount(e.grid.flip('x'))).toBe(0);
    expect(w.anchors).toEqual({ head: [8 - 1 - 4, 1] });
    expect(e.anchors).toEqual({ head: [4, 1] });
  });

  test('mirror: false renders every facing', () => {
    const calls: string[] = [];
    const m = probe(calls); m.meta = { mirror: false };
    renderAsset(m, { dir, brief: { id: 'p', kind: 'character', size: 'character', directions: 4 } });
    expect(calls).toEqual(['idle/s/0', 'idle/w/0', 'idle/n/0', 'idle/e/0']);
  });

  test('ctx carries direction tokens, params, t and stage dumps', () => {
    let seen: RenderContext | undefined;
    const stages = new Map();
    renderAsset({ params: { a: 1 }, render(ctx) { seen = ctx; const g = new ctx.lib.Grid(8, 6); ctx.stage('base', g); return g; } },
      { dir, brief: { id: 'p', kind: 'character', size: 'character', anims: { idle: { frames: 4 } } }, params: { b: 2 }, seed: 9, stages });
    expect(seen!.params).toEqual({ a: 1, b: 2 });
    expect(seen!.t).toBe(3 / 4);
    expect(seen!.seed).toBe(9);
    expect(seen!.palette()).toEqual(['#ff0000', '#880000', '#00ff00', '#000011']);
    expect(seen!.palette(['b'])).toEqual(['#00ff00', '#000011']);
    expect([...stages.keys()]).toContain('idle/s/3/0-base');
  });

  test('a frame of the wrong size is an error', () => {
    expect(() => renderAsset({ render: ctx => new ctx.lib.Grid(3, 3) }, { dir, brief: { id: 'p', kind: 'character', size: 'character' } })).toThrow('brief size is 8x6');
  });

  test('assembleSheet: one row per state × facing, one column per frame', () => {
    const r = renderAsset(probe([]), { dir, brief: { id: 'p', kind: 'character', size: 'character', states: ['idle', 'walk'], directions: 4, anims: { walk: { frames: 3 } } } });
    const { grid, rects } = assembleSheet(r, 1);
    expect([grid.w, grid.h]).toEqual([3 * 8 + 2, 8 * 6 + 7]);
    const walkE2 = rects.find(q => q.state === 'walk' && q.facing === 'e' && q.frame === 2)!;
    expect(walkE2).toMatchObject({ x: 2 * 9, y: (4 + 3) * 7, w: 8, h: 6, mirrored: false });
    expect(grid.crop(walkE2.x, walkE2.y, 8, 6).diffCount(r.cells.find(c => c.state === 'walk' && c.facing === 'e' && c.frame === 2)!.grid)).toBe(0);
  });

  test('line.outer threads into prim and voxel renders', () => {
    const want = { dark: '#000011', selout: '#880000', none: null };
    for (const outer of ['dark', 'selout', 'none'] as const) {
      const d = parseDirection({ ...dir, line: { ...dir.line, outer } });
      const r = renderAsset({ render(ctx) {
        const prim = ctx.lib.prim.scene(8, 6).add({ type: 'rect', x: 2, y: 2, w: 3, h: 2, mat: ctx.dir.pal.a, shade: 'flat' }).render();
        const vox = ctx.lib.voxel.model().set(0, 0, 0, ctx.lib.voxel.face(ctx.dir.pal.a)).render(8, 6, { ox: 4, oy: 1, shadow: false });
        return new ctx.lib.Grid(16, 6).blit(prim).blit(vox, 8, 0);
      } }, { dir: d, brief: { id: 'p', kind: 'character', size: [16, 6] } });
      const g = r.cells[0].grid;
      expect([g.get(1, 2), g.get(8 + 1, 2)]).toEqual([want[outer], want[outer]]); // just left of each shape
    }
  });

  test('facing names mirror east ↔ west', () => {
    expect(['sw', 'w', 'nw', 'n', 'wsw'].map(mirrorFacing)).toEqual(['se', 'e', 'ne', 'n', 'ese']);
  });
});
