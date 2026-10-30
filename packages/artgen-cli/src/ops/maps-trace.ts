/**
 * `artgen map trace`: a sketch or a real map's outline (a coast, a cave, a lake) becomes terrain paint edits on a map. It is the
 * map side of the image tools (docs/TOOLING-PLAN.md §6b, R5b); the tracing is `artgen-imagekit`, shared with `artgen trace`.
 * Edits carry an `origin`, so tracing the same sketch again with `--replace` swaps its earlier edits for the new ones.
 */
import { resolve } from 'node:path';
import { traceImage, type TracedRing } from 'artgen-imagekit';
import { map } from 'artgen-core/maps';
import { updateMap } from '../map.ts';
import { readPicture, traceOptions, traceParams, traceSummary } from './image.ts';
import { idParam, pathParam, projectOf, refOf, type Inp } from './maps-shared.ts';
import { defineOp, p, type OpDef } from './registry.ts';

/** A ring in map cells: the picture scaled to fit inside the map (one scale both ways) and centred. Ring points are pixel indexes, so each is moved to its pixel's centre. */
function toCells(r: TracedRing, scale: number, ox: number, oy: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < r.points.length; k += 2) out.push(Math.round(((r.points[k] + 0.5) * scale + ox) * 100) / 100, Math.round(((r.points[k + 1] + 0.5) * scale + oy) * 100) / 100);
  return out;
}

export const mapTrace = defineOp({
  name: 'map.trace', module: 'maps', effect: 'write', summary: 'Trace a picture\'s outline onto a terrain map as paint edits (the dark shapes become land, their holes water).',
  params: {
    id: idParam('the map id', 'map trace: <id> <image.png>'), path: pathParam('map'),
    image: p.str('the sketch or map picture (PNG)', { positional: true, required: 'map trace: <id> <image.png>', mcp: false }),
    terrain: p.oneOf(map.TERRAINS, 'what the traced shapes are (default grass)', { mcp: false }), hole_terrain: p.oneOf(map.TERRAINS, 'what the holes in a shape are (default water)', { mcp: false }),
    origin: p.str('who wrote these edits (default trace); --replace swaps its earlier ones', { mcp: false }), replace: p.bool('first remove this origin\'s earlier edits', { mcp: false }),
    ...traceParams(),
  },
  run(i: Inp, ctx) {
    const terrain = (i.terrain ?? 'grass') as map.Terrain, holeTerrain = (i.hole_terrain ?? 'water') as map.Terrain, origin = i.origin ?? 'trace';
    if (!map.TERRAINS.includes(terrain) || !map.TERRAINS.includes(holeTerrain)) throw new Error(`--terrain, --hole-terrain: one of ${map.TERRAINS.join(', ')}`);
    const t = traceImage(readPicture(resolve(i.image)), traceOptions(i));
    let added = 0, removed = 0;
    const m = updateMap(projectOf(i, ctx), refOf(i), m => {
      const scale = Math.min(m.cols / t.width, m.rows / t.height), ox = (m.cols - t.width * scale) / 2, oy = (m.rows - t.height * scale) / 2;
      if (i.replace) { const keep = m.edits.filter(e => e.origin !== origin); removed = m.edits.length - keep.length; m.edits = keep; }
      for (const s of t.shapes) {
        m.edits.push({ op: 'paint', terrain, shape: { poly: toCells(s.outer, scale, ox, oy) }, origin });
        added++;
        for (const h of s.holes) { m.edits.push({ op: 'paint', terrain: holeTerrain, shape: { poly: toCells(h, scale, ox, oy) }, origin }); added++; }
      }
    });
    return { m, added, removed, trace: traceSummary(t), origin };
  },
  cli: {
    usage: '       artgen map trace <id> <image.png> [--terrain grass] [--hole-terrain water] [--origin trace] [--replace]   (+ the artgen trace flags: --threshold --invert --blur --smoothing --simplify --min-area --holes --max-paths)',
    text: (r, i) => `${r.m.id}: ${r.added} paint edits from ${r.trace.shapes} shapes${r.removed ? ` (replaced ${r.removed} of origin ${r.origin})` : ''} (${r.m.edits.length} edits)\n${i.path ? `next: artgen map render --file ${i.path}` : `next: artgen map render ${r.m.id}`}`,
    json: r => ({ id: r.m.id, added: r.added, removed: r.removed, edits: r.m.edits.length, trace: r.trace }),
  },
  mcp: { exclude: 'reads a picture by path outside the art/ sandbox' }, python: {},
});

export const MAP_TRACE_OPS: OpDef[] = [mapTrace];
