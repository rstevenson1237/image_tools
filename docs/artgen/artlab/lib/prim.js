// prim.js - Technique 2: declarative art primitives rasterised without anti-aliasing,
// with automatic material shading. A sprite is a list of shape specs -> Scene.render().
const { Grid, PAL } = require('./core');
const post = require('./post');

// ---- rasterisers: return an array of [x,y] pixel coords (pixel-centre sampling) ----
const R = {
  ellipse({ cx, cy, rx, ry }) {
    const out = [];
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) out.push([x, y]);
      }
    return out;
  },
  rect({ x, y, w, h, r = 0 }) {
    const out = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (r) { // cut corners for a rounded look
        const cx = Math.min(i, w - 1 - i), cy = Math.min(j, h - 1 - j);
        if (cx < r && cy < r && (r - cx) + (r - cy) > r + 1) continue;
      }
      out.push([x + i, y + j]);
    }
    return out;
  },
  poly({ pts }) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), out = [];
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5, py = y + 0.5; let ins = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins;
        }
        if (ins) out.push([x, y]);
      }
    return out;
  },
  line({ x0, y0, x1, y1, w = 1 }) {
    const out = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) out.push([x0 + i, y0 + j]);
      if (x0 === x1 && y0 === y1) break; const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return out;
  },
};

// mirror a spec across vertical axis x=ax (or horizontal y=ay)
function mirrorSpec(s, ax, ay) {
  const m = JSON.parse(JSON.stringify({ ...s, pattern: undefined })); m.pattern = s.pattern;
  const fx = v => ax != null ? 2 * ax - v : v, fy = v => ay != null ? 2 * ay - v : v;
  if (s.type === 'ellipse') { m.cx = fx(s.cx); m.cy = fy(s.cy); }
  if (s.type === 'rect') { if (ax != null) m.x = 2 * ax - s.x - s.w; if (ay != null) m.y = 2 * ay - s.y - s.h; }
  if (s.type === 'poly') m.pts = s.pts.map(([x, y]) => [fx(x), fy(y)]);
  if (s.type === 'line') { m.x0 = Math.round(fx(s.x0 + .5) - .5); m.x1 = Math.round(fx(s.x1 + .5) - .5); m.y0 = Math.round(fy(s.y0 + .5) - .5); m.y1 = Math.round(fy(s.y1 + .5) - .5); }
  return m;
}

class Scene {
  constructor(w, h, opts = {}) { this.w = w; this.h = h; this.shapes = []; this.light = opts.light || [-1, -1]; }
  add(spec) { this.shapes.push(spec); if (spec.mirrorX != null) this.shapes.push(mirrorSpec(spec, spec.mirrorX)); if (spec.mirrorY != null) this.shapes.push(mirrorSpec(spec, null, spec.mirrorY)); return this; }
  addAll(list) { list.forEach(s => this.add(s)); return this; }
  // shade modes: 'flat' | 'bevel' (edge light/dark) | 'sphere' (normal-based bands) | 'cyl' (bands across one axis)
  shadeColor(s, x, y, set) {
    const mat = Array.isArray(s.mat) ? s.mat : [s.mat]; if (mat.length === 1 || s.shade === 'flat') return mat[Math.min(1, mat.length - 1)] || mat[0];
    const [lx, ly] = this.light, last = mat.length - 1;
    if (s.shade === 'sphere' && s.type === 'ellipse') {
      const nx = (x + .5 - s.cx) / s.rx, ny = (y + .5 - s.cy) / s.ry;
      const d = (nx * lx + ny * ly) / Math.SQRT2; // +1 = facing light (v2 fix: sign was inverted)
      if (s.rim && nx * nx + ny * ny > s.rim) return mat[last];
      return mat[Math.max(0, Math.min(last, Math.round((1 - (d + 1) / 2) * last)))];
    }
    if (s.shade === 'cyl') { // banding across the short axis
      const horiz = s.axis === 'x'; const t = horiz ? (y + .5 - s.y) / s.h : (x + .5 - s.x) / s.w;
      return mat[Math.max(0, Math.min(last, Math.floor(t * (last + 1))))];
    }
    const has = (a, b) => set.has(a + ',' + b);
    const lit = !has(x + lx, y) || !has(x, y + ly), dark = !has(x - lx, y) || !has(x, y - ly);
    if (lit && !dark) return mat[0]; if (dark && !lit) return mat[last]; return mat[Math.min(1, last)];
  }
  render({ outline = true, outlineColor = PAL.outline, shadow = null } = {}) {
    let g = new Grid(this.w, this.h);
    for (const s of this.shapes) {
      const px = R[s.type](s), set = new Set(px.map(p => p[0] + ',' + p[1])), buf = [];
      for (const [x, y] of px) {
        let c = s.color || this.shadeColor(s, x, y, set);
        if (s.pattern) c = s.pattern(x, y, c) || c;
        // v2: selective inner outline where this shape overlaps something already drawn
        if (s.ink && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => !set.has((x+dx)+','+(y+dy)) && g.alpha(x+dx, y+dy) > 200)) c = s.ink;
        if (s.inkAll && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => !set.has((x+dx)+','+(y+dy)))) c = s.inkAll;
        buf.push([x, y, c]);
      }
      for (const [x, y, c] of buf) g.set(x, y, c);
    }
    if (outline) g = post.outline(g, outlineColor);
    if (shadow) g = post.dropShadow(g, shadow[0], shadow[1]);
    return g;
  }
}

module.exports = { Scene, R, mirrorSpec };
