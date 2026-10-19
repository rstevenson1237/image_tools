/** SVG drawing helpers shared by the map and dungeon renderers: escaping, number rounding, the label font, halo text, a compass. */

export const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const n1 = (v: number) => (Math.round(v * 10) / 10).toString();

export const FONT_FAMILY = 'Alegreya Sans';
export const FONT = `'${FONT_FAMILY}', 'Segoe UI', Helvetica, Arial, sans-serif`;

/** Text with a paper-coloured halo so it stays legible over any terrain. */
export function haloText(text: string, x: number, y: number, size: number, color: string, th: { halo: string }, attrs = ''): string {
  const a = `x="${n1(x)}" y="${n1(y)}" font-size="${n1(size)}" text-anchor="middle" ${attrs}`;
  return `<text ${a} fill="none" stroke="${th.halo}" stroke-width="${n1(size * 0.22)}" stroke-linejoin="round" stroke-opacity="0.9">${esc(text)}</text><text ${a} fill="${color}">${esc(text)}</text>`;
}

/** A north arrow in a disc, `r` across, centred on cx, cy. */
export function compassSvg(cx: number, cy: number, r: number, u: number, th: { ink: string; paper: string }): string {
  return `<g id="compass" stroke="${th.ink}" stroke-width="${n1(u)}" stroke-linejoin="round"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${th.paper}" fill-opacity="0.85"/><path d="M${n1(cx)} ${n1(cy - r * 0.9)}L${n1(cx + r * 0.3)} ${n1(cy)}L${n1(cx)} ${n1(cy + r * 0.9)}L${n1(cx - r * 0.3)} ${n1(cy)}Z" fill="${th.paper}"/><path d="M${n1(cx)} ${n1(cy - r * 0.9)}L${n1(cx + r * 0.3)} ${n1(cy)}L${n1(cx - r * 0.3)} ${n1(cy)}Z" fill="${th.ink}"/><text x="${n1(cx)}" y="${n1(cy - r - 4 * u)}" font-size="${n1(13 * u)}" font-weight="700" text-anchor="middle" fill="${th.ink}" stroke="none">N</text></g>`;
}
