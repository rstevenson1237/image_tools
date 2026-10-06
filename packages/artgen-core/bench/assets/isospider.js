// Benchmark iso spider (artlab t3/isospider.v1, scored 7): curved quadratic legs as thick strokes, flat body
// parts with stroked outlines, highlight crescents, ss raster, 2:1 ground shadow.
// artlab's Skia path ignored paint-order="stroke" (stroke drawn over the fill, so the ring sits inside the body
// edge); resvg honours it. The attribute is dropped here so the port renders what was scored.
export const meta = { brief: 'isospider', notes: 'artlab t3/isospider.v1 ported as-is on resvg; PAL lookups became ctx.dir tokens' };

const LEGS = [[[12, 15], [6, 6], [3, 12]], [[11, 17], [3, 12], [1, 19]], [[11, 19], [3, 18], [2, 26]], [[12, 21], [7, 22], [7, 29]]];

export function svg(ctx) {
  const { pal, outline: O } = ctx.dir, P = pal.purple, st = `stroke="${O}" stroke-width="2"`;
  const leg = ([a, b, c], m) => { const f = p => (m ? `${32 - p[0]} ${p[1]}` : `${p[0]} ${p[1]}`);
    return `<path d="M${f(a)} Q${f(b)} ${f(c)}" fill="none" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/><path d="M${f(a)} Q${f(b)} ${f(c)}" fill="none" stroke="${P[1]}" stroke-width="1.3" stroke-linecap="round"/>`; };
  return ctx.lib.svg.doc(32, 32, `${LEGS.map(l => leg(l, false) + leg(l, true)).join('')}
 <ellipse cx="16" cy="10" rx="8" ry="6.5" fill="${P[1]}" ${st}/>
 <path d="M10 8 Q12 4.5 17 4.2 Q12 6 11 10 Z" fill="${P[0]}"/><path d="M18 15.5 Q23 15 23.5 10 Q24 15 18 16.5 Z" fill="${P[2]}"/>
 <path d="M14 7 H18 L16 10 L18 13 H14 L16 10 Z" fill="${pal.red[0]}"/>
 <ellipse cx="16" cy="19" rx="5" ry="3.8" fill="${P[1]}" ${st}/><path d="M12 18 Q13 15.8 16 15.6 Q13 17 13 19 Z" fill="${P[0]}"/>
 <rect x="13" y="18" width="2" height="2" fill="${pal.red[0]}"/><rect x="17" y="18" width="2" height="2" fill="${pal.red[0]}"/>
 <path d="M14.5 22.5 V24.5 M17.5 22.5 V24.5" stroke="${pal.steel[0]}" stroke-width="1"/>`);
}

export function render(ctx) {
  const { Grid, iso, svg: s } = ctx.lib;
  const g = new Grid(32, 32);
  iso.groundShadow(g, 16, 22, 10);
  return g.stamp(s.toGrid(svg(ctx), 32, 32, { mode: 'ss', outline: true, pal: [...ctx.palette(['purple', 'red']), ctx.dir.pal.steel[0]] }));
}
