// iso.js - 2:1 isometric helpers shared by T1-T3 (projection, box faces, ground shadow)
const { PAL } = require('./core');
// world (x right-down, y left-down, z up) -> screen px. 1 world unit = 2px across, 1px down.
const P = (x, y, z, ox = 0, oy = 0) => [ox + (x - y) * 2, oy + (x + y) - z * 2];
// faces of an axis box as screen polygons; light from upper-left: top=light, left(+y)=mid, right(+x)=dark
function boxFaces(x, y, z, w, d, h, ox, oy) {
  const p = (a, b, c) => P(a, b, c, ox, oy);
  return {
    top: [p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)],
    left: [p(x, y + d, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x, y + d, z)],
    right: [p(x + w, y, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x + w, y, z)],
  };
}
// 2:1 ground shadow ellipse (alpha-blended), drawn first under a sprite
function groundShadow(g, cx, cy, rx) {
  const ry = rx / 2; for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
    if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) g.set(x, y, PAL.shadow);
}
module.exports = { P, boxFaces, groundShadow };
