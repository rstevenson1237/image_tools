// metrics.js - objective pixel-art quality signals (complements human/LLM visual review)
const { paletteList } = require('./core');

function luma(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

function measure(g, { symAxis = 'x' } = {}) {
  const { w, h, d } = g, pal = new Set(paletteList());
  let filled = 0, partial = 0, offPal = 0, orphans = 0, edge = 0, edgeDark = 0, symHit = 0, symTot = 0;
  const colors = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = d[i + 3]; if (!a) continue;
    if (a === 89 && !d[i] && !d[i + 1] && !d[i + 2]) continue; // deliberate drop-shadow pixel
    filled++; if (a < 255) partial++;
    const c = g.get(x, y); colors.add(c); if (!pal.has(c)) offPal++;
    const n = [g.get(x + 1, y), g.get(x - 1, y), g.get(x, y + 1), g.get(x, y - 1)];
    if (n.every(v => v !== c)) orphans++;
    if (n.some(v => !v)) { edge++; if (luma(d, i) < 70) edgeDark++; }
    const mx = symAxis === 'x' ? w - 1 - x : x, my = symAxis === 'x' ? y : h - 1 - y;
    if (symAxis !== 'none') { symTot++; if (g.get(mx, my) === c) symHit++; }
  }
  const pct = v => filled ? +(100 * v / filled).toFixed(1) : 0;
  const m = {
    fillPct: +(100 * filled / (w * h)).toFixed(1), colors: colors.size, aaPartialPct: pct(partial),
    offPalettePct: pct(offPal), orphanPct: pct(orphans), outlinePct: edge ? +(100 * edgeDark / edge).toFixed(1) : 0,
    symmetryPct: symTot ? +(100 * symHit / symTot).toFixed(1) : 0,
  };
  // Heuristic 0-10 "pixel-art hygiene" score: rewards clean palette, outlines, few orphans, limited colours
  let s = 10;
  s -= Math.min(3, m.aaPartialPct / 5); s -= Math.min(2, m.offPalettePct / 10); s -= Math.min(2, Math.max(0, m.orphanPct - 4) / 4);
  s -= m.outlinePct < 60 ? (60 - m.outlinePct) / 30 : 0; s -= m.colors > 24 ? Math.min(2, (m.colors - 24) / 10) : 0;
  m.hygiene = +Math.max(0, s).toFixed(1);
  return m;
}

module.exports = { measure };
