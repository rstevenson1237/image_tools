// Benchmark tank (artlab t3/tank.v3, scored 7.5): v1's SVG minus strokes, plus dark underlay disk/rects so
// the dome and barrels keep a 1 px internal outline after downsampling; asset-restricted palette, ss raster.
export const meta = { brief: 'tank', notes: 'artlab t3/tank.v3 ported as-is on resvg (v1 SVG with v3 edits applied); tokens for PAL' };

export function svg(ctx) {
  const { pal, outline: O } = ctx.dir, A = pal.armor;
  return ctx.lib.svg.doc(64, 64, `
 <defs>
  <linearGradient id="hull" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${A[0]}"/><stop offset="1" stop-color="${A[2]}"/></linearGradient>
  <radialGradient id="dome" cx="35%" cy="35%"><stop offset="0" stop-color="${A[0]}"/><stop offset=".7" stop-color="${A[1]}"/><stop offset="1" stop-color="${A[3]}"/></radialGradient>
 </defs>
 <g>
  <rect x="7" y="10" width="10" height="48" rx="2" fill="${A[3]}"/><rect x="47" y="10" width="10" height="48" rx="2" fill="${A[3]}"/>
  <path d="M24 7 H40 L49 16 V55.5 L44.5 60 H19.5 L15 55.5 V16 Z" fill="${O}"/><path d="M24 8 H40 L48 16 V55 L44 59 H20 L16 55 V16 Z" fill="url(#hull)"/>
  <rect x="26" y="2" width="5" height="24" fill="${O}"/><rect x="33" y="2" width="5" height="24" fill="${O}"/><rect x="27" y="3" width="3" height="22" fill="${A[2]}"/><rect x="34" y="3" width="3" height="22" fill="${A[2]}"/>
  <circle cx="32" cy="34" r="12.2" fill="${O}"/><circle cx="32" cy="34" r="11" fill="url(#dome)"/>
 </g>
 ${Array.from({ length: 12 }, (_, i) => `<path d="M8 ${13 + i * 4} H16 M48 ${13 + i * 4} H56" stroke="${A[4]}" stroke-width="1.2"/>`).join('')}
 <path d="M18.5 20 V48 M45.5 20 V48" stroke="${pal.cyan[1]}" stroke-width="1"/>
 <rect x="24" y="53" width="16" height="3" fill="${pal.orange[1]}"/>
 <circle cx="32" cy="31" r="2" fill="${pal.cyan[1]}"/>`);
}

export function render(ctx) {
  return ctx.lib.svg.toGrid(svg(ctx), 64, 64, { mode: 'ss', outline: true, shadow: [2, 2], pal: ctx.palette(['armor', 'cyan', 'orange']) });
}
