// Benchmark ship (artlab t3/ship.v3, scored 7.5): SVG authored for the downsampler — outlines from dark
// underlay shapes (no strokes), flat deck with <pattern> planks, asset-restricted palette, ss raster.
export const meta = { brief: 'ship', notes: 'artlab t3/ship.v3 ported as-is on resvg; PAL lookups became ctx.dir tokens' };

const HULL = 'M7 12.5 Q3.5 20.5 7 28.5 L95 31 Q140 26.5 156 20.5 Q140 14.5 95 10 Z';

export function svg(ctx) {
  const { pal } = ctx.dir, N = pal.navy, O = N[4], T = pal.teak;
  const turret = (x, dir, big) => { const c = big ? N[0] : N[1];
    return `<g transform="translate(${x} 20.5) scale(${dir} 1)">
  <path d="M5 -2.5 H17 V-1.5 H5 Z M5 -0.5 H17 V0.5 H5 Z M5 1.5 H17 V2.5 H5 Z" fill="${N[3]}"/>
  <path d="M-7.5 0 A7.5 7.5 0 0 1 0 -7.5 H4 L6.5 -5 V5 L4 7.5 H0 A7.5 7.5 0 0 1 -7.5 0 Z" fill="${O}"/>
  <path d="M-6.5 0 A6.5 6.5 0 0 1 0 -6.5 H3.5 L5.5 -4.5 V4.5 L3.5 6.5 H0 A6.5 6.5 0 0 1 -6.5 0 Z" fill="${c}"/>
  <rect x="-6" y="-6" width="10" height="2" fill="${N[0]}"/><rect x="-6" y="4" width="10" height="2" fill="${N[2]}"/></g>`; };
  return ctx.lib.svg.doc(160, 41, `
 <defs><pattern id="pl" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${T[0]}"/><rect y="3" width="4" height="1" fill="${T[1]}"/></pattern></defs>
 <path d="${HULL}" fill="${N[1]}"/>
 <path d="${HULL}" fill="url(#pl)" transform="translate(4 2.1) scale(0.96 0.9)"/>
 <rect x="56" y="13" width="37" height="15" fill="${O}"/><rect x="57" y="14" width="35" height="13" fill="${N[2]}"/>
 <rect x="62" y="16" width="25" height="9" fill="${N[1]}"/><rect x="85" y="17" width="7" height="7" fill="${N[0]}"/>
 <circle cx="70" cy="20.5" r="3.5" fill="${O}"/><circle cx="70" cy="20.5" r="2.5" fill="${N[3]}"/>
 <circle cx="78" cy="20.5" r="3.5" fill="${O}"/><circle cx="78" cy="20.5" r="2.5" fill="${N[3]}"/>
 ${[0, 1, 2, 3].map(i => `<rect x="${61 + i * 8}" y="10" width="4" height="3" fill="${N[0]}"/><rect x="${61 + i * 8}" y="28" width="4" height="3" fill="${N[0]}"/>`).join('')}
 ${turret(42.5, -1)}${turret(119, 1)}${turret(105, 1, true)}`);
}

export function render(ctx) {
  return ctx.lib.svg.toGrid(svg(ctx), 160, 41, { mode: 'ss', outline: true, shadow: [2, 2], pal: ctx.palette(['teak', 'navy']) });
}
