#!/usr/bin/env node
import { createRequire as __artgenRequire } from 'node:module'; const require = __artgenRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../artgen-core/src/map/index.ts
var map_exports = {};
__export(map_exports, {
  DIRECTED: () => DIRECTED,
  FACTS_RULES: () => RULES,
  FONT_FAMILY: () => FONT_FAMILY,
  GRID_TYPES: () => GRID_TYPES,
  LABEL_KINDS: () => LABEL_KINDS,
  LAND_MODES: () => LAND_MODES,
  LEGEND_SYMBOLS: () => LEGEND_SYMBOLS,
  MAP_FORMAT: () => MAP_FORMAT,
  MAP_LAYERS: () => MAP_LAYERS,
  MARK_DISTANCE: () => MARK_DISTANCE,
  MAX_SIDE: () => MAX_SIDE,
  PATTERNS: () => PATTERNS,
  PRESETS: () => PRESETS,
  PRESET_DEFAULTS: () => PRESET_DEFAULTS,
  REQUIREMENT_KINDS: () => REQUIREMENT_KINDS,
  RESOLUTION: () => RESOLUTION,
  SYMBOLS: () => SYMBOLS,
  SYMBOL_KINDS: () => SYMBOL_KINDS,
  TERRAINS: () => TERRAINS,
  TERRAIN_NAMES: () => TERRAIN_NAMES,
  THEME: () => THEME,
  THEMES: () => THEMES,
  areaOutline: () => areaOutline,
  cellCenter: () => cellCenter,
  chaikin: () => chaikin,
  checkMap: () => checkMap,
  checkRequirements: () => checkRequirements,
  contourLines: () => contourLines,
  coverage: () => coverage,
  feetIn: () => feetIn,
  fieldKey: () => fieldKey,
  generateMap: () => generateMap,
  gridGeometry: () => gridGeometry,
  isolines: () => isolines,
  layersFor: () => layersFor,
  mapFacts: () => mapFacts,
  mapLabelLayout: () => mapLabelLayout,
  newMap: () => newMap,
  parseMap: () => parseMap,
  parsePoint: () => parsePoint,
  pathData: () => pathData,
  renderMapSvg: () => renderMapSvg,
  riverWidth: () => riverWidth,
  simplifyLine: () => simplifyLine,
  syncMap: () => syncMap,
  terrainRegions: () => terrainRegions,
  terrainsUsed: () => terrainsUsed,
  validateMap: () => validateMap
});

// ../artgen-core/src/format.ts
function readFormat(raw, kind, current, migrations = {}) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const v = r.version === void 0 ? 1 : r.version;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) throw new Error(`${kind}: version must be a whole number from 1 (got ${JSON.stringify(v)})`);
  if (v > current) throw new Error(`${kind} is format version ${v}; this artgen reads ${kind} format ${current} and older (update artgen)`);
  let out = r;
  for (let n = v; n < current; n++) {
    const step = migrations[n];
    if (!step) throw new Error(`${kind} format ${n} -> ${n + 1}: no migration`);
    out = { ...step(out), version: n + 1 };
  }
  return out;
}

// ../artgen-core/src/map/spec.ts
var TERRAINS = ["deep", "water", "marsh", "sand", "desert", "grass", "scrub", "forest", "rock", "snow"];
var TERRAIN_NAMES = {
  deep: "Deep water",
  water: "Shallow water",
  marsh: "Marsh",
  sand: "Sand / beach",
  desert: "Desert",
  grass: "Grassland",
  scrub: "Scrub",
  forest: "Forest",
  rock: "Rock / mountain",
  snow: "Snow"
};
var PRESETS = ["regional", "local"];
var LAND_MODES = ["mixed", "island", "inland"];
var GRID_TYPES = ["none", "square", "hex"];
var LABEL_KINDS = ["region", "place", "water", "note"];
var REQUIREMENT_KINDS = ["terrain", "height", "path", "clear"];
var RESOLUTION = { regional: 8, local: 6 };
var PRESET_DEFAULTS = {
  regional: {
    cols: 30,
    rows: 22,
    gen: { land: "mixed", sea: 0.3, moisture: 0.5, roughness: 0.5, relief: 0.5, rivers: 3, simplify: 3, feature: 10 },
    topo: { maxElevation: 5e3, interval: 500, majorEvery: 5, unit: "ft", labels: false },
    grid: { type: "hex", size: 1, coords: true },
    scale: { perCell: 6, unit: "mi" },
    legend: true,
    scaleBar: true,
    compass: true
  },
  local: {
    cols: 30,
    rows: 20,
    gen: { land: "inland", sea: 0.08, moisture: 0.55, roughness: 0.4, relief: 0.3, rivers: 1, simplify: 2, feature: 14 },
    topo: { maxElevation: 40, interval: 5, majorEvery: 4, unit: "ft", labels: false },
    grid: { type: "square", size: 1, coords: false },
    scale: { perCell: 5, unit: "ft" },
    legend: true,
    scaleBar: true,
    compass: false
  }
};
var MAP_FORMAT = 1;
var MIGRATIONS = {};
var MAX_SIDE = 200;
function newMap(id, preset = "regional", over = {}) {
  const d = structuredClone(PRESET_DEFAULTS[preset]);
  return parseMap({ ...d, ...over, id, version: MAP_FORMAT, preset, seed: over.seed ?? 1, gen: { ...d.gen, ...over.gen }, topo: { ...d.topo, ...over.topo }, grid: { ...d.grid, ...over.grid }, scale: { ...d.scale, ...over.scale }, edits: over.edits ?? [], overlay: over.overlay ?? { labels: [], symbols: [] } });
}
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
var nums = (v) => Array.isArray(v) && v.every(isNum);
function originError(entry, at3, e) {
  const v = entry?.origin;
  if (v !== void 0 && (typeof v !== "string" || !v)) e.push(`${at3}.origin: a non-empty string`);
}
function shapeErrors(s, at3) {
  if (!s || typeof s !== "object") return [`${at3}: shape required ({circle:[x,y,r]}, {poly:[x,y,\u2026]} or {stroke:[x,y,\u2026], width})`];
  const o = s;
  if ("circle" in o) return nums(o.circle) && o.circle.length === 3 && o.circle[2] > 0 ? [] : [`${at3}.circle: [x, y, r] with r > 0`];
  if ("poly" in o) return nums(o.poly) && o.poly.length >= 6 && o.poly.length % 2 === 0 ? [] : [`${at3}.poly: at least 3 x,y pairs`];
  if ("stroke" in o) return nums(o.stroke) && o.stroke.length >= 2 && o.stroke.length % 2 === 0 && isNum(o.width) && o.width > 0 ? [] : [`${at3}.stroke: x,y pairs and width > 0`];
  return [`${at3}: unknown shape (circle, poly or stroke)`];
}
function requirementErrors(m) {
  const e = [], list3 = m.require;
  if (list3 === void 0) return e;
  if (!Array.isArray(list3)) return ["require: an array"];
  const seen = /* @__PURE__ */ new Set(), top = isNum(m.topo?.maxElevation) ? m.topo.maxElevation : Infinity;
  list3.forEach((r, i) => {
    const at3 = `require[${i}]`;
    if (!r || typeof r !== "object") {
      e.push(`${at3}: an object`);
      return;
    }
    if (typeof r.id !== "string" || !/^[\w.-]+$/.test(r.id)) e.push(`${at3}.id: letters, digits, - . and _ only`);
    else if (seen.has(r.id)) e.push(`${at3}.id: ${r.id} is used twice`);
    else seen.add(r.id);
    if (r.blend !== void 0 && !(isNum(r.blend) && r.blend >= 0)) e.push(`${at3}.blend: map units, 0 or more`);
    originError(r, at3, e);
    if (r.kind === "terrain") {
      e.push(...shapeErrors(r.area, `${at3}.area`));
      if (!TERRAINS.includes(r.terrain)) e.push(`${at3}.terrain: one of ${TERRAINS.join(", ")}`);
      else if (r.terrain === "snow" && m.preset === "local") e.push(`${at3}.terrain: snow does not appear on a local map`);
      if (!isNum(r.share) || r.share <= 0 || r.share > 1) e.push(`${at3}.share: above 0 and at most 1`);
    } else if (r.kind === "height") {
      e.push(...shapeErrors(r.area, `${at3}.area`));
      if (!isNum(r.low) || !isNum(r.high) || r.low < 0 || r.high <= r.low) e.push(`${at3}: low and high, 0 \u2264 low < high`);
      else if (r.high > top) e.push(`${at3}.high: at most topo.maxElevation (${top})`);
      if (r.share !== void 0 && !(isNum(r.share) && r.share > 0 && r.share <= 1)) e.push(`${at3}.share: above 0 and at most 1`);
    } else if (r.kind === "path") {
      if (r.path !== "stream" && r.path !== "road") e.push(`${at3}.path: stream or road`);
      if (!nums(r.points) || r.points.length < 4 || r.points.length % 2) e.push(`${at3}.points: at least 2 x,y pairs`);
      if (r.tolerance !== void 0 && !(isNum(r.tolerance) && r.tolerance > 0)) e.push(`${at3}.tolerance: map units, above 0`);
      if (r.width !== void 0 && !(isNum(r.width) && r.width > 0)) e.push(`${at3}.width: > 0`);
      if (r.delta !== void 0 && typeof r.delta !== "boolean") e.push(`${at3}.delta: true or false`);
    } else if (r.kind === "clear") e.push(...shapeErrors(r.area, `${at3}.area`));
    else e.push(`${at3}.kind: ${REQUIREMENT_KINDS.join(", ")}`);
  });
  return e;
}
function validateMap(raw) {
  const e = [];
  if (!raw || typeof raw !== "object") return ["map: expected an object"];
  const m = raw;
  if (typeof m.id !== "string" || !/^[\w-]+$/.test(m.id)) e.push("id: letters, digits, - and _ only");
  if (!PRESETS.includes(m.preset)) e.push(`preset: one of ${PRESETS.join(", ")}`);
  for (const k of ["cols", "rows"]) if (!isNum(m[k]) || m[k] < 4 || m[k] > MAX_SIDE || !Number.isInteger(m[k])) e.push(`${k}: an integer from 4 to ${MAX_SIDE}`);
  if (!isNum(m.seed)) e.push("seed: a number");
  const g = m.gen;
  if (!g) e.push("gen: required");
  else {
    if (!LAND_MODES.includes(g.land)) e.push(`gen.land: one of ${LAND_MODES.join(", ")}`);
    for (const [k, lo, hi] of [["sea", 0, 0.9], ["moisture", 0, 1], ["roughness", 0, 1], ["relief", 0, 1], ["rivers", 0, 20], ["simplify", 0, 6], ["feature", 2, 60]])
      if (!isNum(g[k]) || g[k] < lo || g[k] > hi) e.push(`gen.${k}: ${lo}..${hi}`);
  }
  const t = m.topo;
  if (!t || !isNum(t.maxElevation) || t.maxElevation <= 0 || !isNum(t.interval) || t.interval <= 0 || t.interval > t.maxElevation || !isNum(t.majorEvery) || t.majorEvery < 1)
    e.push("topo: maxElevation > 0, 0 < interval \u2264 maxElevation, majorEvery \u2265 1");
  else if (t.maxElevation / t.interval > 60) e.push("topo.interval: at most 60 contour levels (raise the interval)");
  if (!m.grid || !GRID_TYPES.includes(m.grid.type) || !isNum(m.grid.size) || m.grid.size < 0.25) e.push(`grid: type ${GRID_TYPES.join("|")}, size \u2265 0.25`);
  if (!m.scale || !isNum(m.scale.perCell) || typeof m.scale.unit !== "string") e.push("scale: perCell (number) and unit");
  (Array.isArray(m.edits) ? m.edits : (e.push("edits: an array"), [])).forEach((ed, i) => {
    const at3 = `edits[${i}]`;
    if (ed?.op === "paint") {
      if (!TERRAINS.includes(ed.terrain)) e.push(`${at3}.terrain: one of ${TERRAINS.join(", ")}`);
      e.push(...shapeErrors(ed.shape, `${at3}.shape`));
    } else if (ed?.op === "elevate") {
      if (!isNum(ed.amount) || Math.abs(ed.amount) > 1) e.push(`${at3}.amount: -1..1`);
      e.push(...shapeErrors(ed.shape, `${at3}.shape`));
    } else if (ed?.op === "river" || ed?.op === "road") {
      if (!nums(ed.points) || ed.points.length < 4 || ed.points.length % 2) e.push(`${at3}.points: at least 2 x,y pairs`);
      if (ed.op === "river" && ed.width !== void 0 && !(isNum(ed.width) && ed.width > 0)) e.push(`${at3}.width: > 0`);
      if (ed.op === "river" && ed.delta !== void 0 && typeof ed.delta !== "boolean") e.push(`${at3}.delta: true or false`);
    } else e.push(`${at3}.op: paint, elevate, river or road`);
    originError(ed, at3, e);
  });
  e.push(...requirementErrors(m));
  const o = m.overlay;
  if (!o || !Array.isArray(o.labels) || !Array.isArray(o.symbols)) e.push("overlay: { labels: [], symbols: [] }");
  else {
    o.labels.forEach((l, i) => {
      if (typeof l?.text !== "string" || !isNum(l.x) || !isNum(l.y) || !LABEL_KINDS.includes(l.kind)) e.push(`overlay.labels[${i}]: text, x, y, kind (${LABEL_KINDS.join("|")})`);
      else originError(l, `overlay.labels[${i}]`, e);
    });
    o.symbols.forEach((s, i) => {
      if (typeof s?.kind !== "string" || !isNum(s.x) || !isNum(s.y)) e.push(`overlay.symbols[${i}]: kind, x, y`);
      else {
        if (s.angle !== void 0 && !isNum(s.angle)) e.push(`overlay.symbols[${i}].angle: degrees`);
        originError(s, `overlay.symbols[${i}]`, e);
      }
    });
  }
  return e;
}
function parseMap(raw) {
  const r = readFormat(raw, "map", MAP_FORMAT, MIGRATIONS), d = PRESET_DEFAULTS[PRESETS.includes(r.preset) ? r.preset : "regional"];
  const m = {
    ...structuredClone(d),
    ...r,
    version: MAP_FORMAT,
    gen: { ...d.gen, ...r.gen },
    topo: { ...d.topo, ...r.topo },
    grid: { ...d.grid, ...r.grid },
    scale: { ...d.scale, ...r.scale },
    edits: r.edits ?? [],
    overlay: { labels: r.overlay?.labels ?? [], symbols: r.overlay?.symbols ?? [] }
  };
  if (r.require === void 0) delete m.require;
  const errors = validateMap(m);
  if (errors.length) throw new Error(`invalid map${typeof r.id === "string" ? ` ${r.id}` : ""}:
  ${errors.join("\n  ")}`);
  return m;
}
function checkMap(raw) {
  let r;
  try {
    r = readFormat(raw, "map", MAP_FORMAT, MIGRATIONS);
  } catch (err) {
    const v = raw?.version;
    return { version: typeof v === "number" ? v : null, errors: [{ path: "version", message: err.message }] };
  }
  const d = PRESET_DEFAULTS[PRESETS.includes(r.preset) ? r.preset : "regional"];
  const m = { ...structuredClone(d), ...r, gen: { ...d.gen, ...r.gen }, topo: { ...d.topo, ...r.topo }, grid: { ...d.grid, ...r.grid }, scale: { ...d.scale, ...r.scale }, edits: r.edits ?? [], overlay: { labels: r.overlay?.labels ?? [], symbols: r.overlay?.symbols ?? [] } };
  return { version: MAP_FORMAT, errors: validateMap(m).map((s) => {
    const i = s.indexOf(": ");
    return i < 0 ? { path: "", message: s } : { path: s.slice(0, i), message: s.slice(i + 2) };
  }) };
}
function cellCenter(spec, ref) {
  const s = spec.grid.size;
  const hex = ref.match(/^(\d{2})(\d{2})$/);
  if (hex) {
    const c = +hex[1] - 1, r = +hex[2] - 1, R2 = s / Math.sqrt(3);
    return [R2 + c * 1.5 * R2, s / 2 + r * s + (c % 2 ? s / 2 : 0)];
  }
  const sq = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (sq) {
    const c = [...sq[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, r = +sq[2] - 1;
    return [(c + 0.5) * s, (r + 0.5) * s];
  }
  throw new Error(`${ref}: expected hex coordinates (0304) or a square cell (C4)`);
}
function parsePoint(spec, at3) {
  const xy = at3.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
  if (xy) return [+xy[1], +xy[2]];
  return cellCenter(spec, at3.replace(/^(hex|cell):/i, ""));
}

// ../artgen-core/src/lib/rng.ts
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ../artgen-core/src/lib/noise.ts
var hash2 = (i, j, seed) => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};
var mod = (a, b) => (a % b + b) % b;
var smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function pGradient(x, y, o) {
  const oct = o.octaves ?? 1, g = o.gain ?? 0.5, seed = o.seed ?? 1;
  let sum = 0, amp = 1, norm = 0, cx = o.cells ?? 4, cy = o.cellsY ?? cx;
  for (let k = 0; k < oct; k++) {
    const fx = x / o.w * cx, fy = y / o.h * cy, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, u = smooth(tx), v = smooth(ty);
    const grad = (a, b, dx, dy) => {
      const t = hash2(mod(a, cx), mod(b, cy), seed + k * 7919) * Math.PI * 2;
      return Math.cos(t) * dx + Math.sin(t) * dy;
    };
    const n00 = grad(i, j, tx, ty), n10 = grad(i + 1, j, tx - 1, ty), n01 = grad(i, j + 1, tx, ty - 1), n11 = grad(i + 1, j + 1, tx - 1, ty - 1);
    const nx0 = n00 + (n10 - n00) * u, nx1 = n01 + (n11 - n01) * u;
    sum += amp * (nx0 + (nx1 - nx0) * v);
    norm += amp;
    amp *= g;
    cx *= 2;
    cy *= 2;
  }
  return Math.max(0, Math.min(1, 0.5 + sum / norm * 0.75));
}

// ../artgen-core/src/map/geometry.ts
function coverage(s, x, y, soft = false) {
  const fall = (d, r) => d >= r ? 0 : !soft || d <= r * 0.4 ? 1 : 0.5 + 0.5 * Math.cos((d - r * 0.4) / (r * 0.6) * Math.PI);
  if ("circle" in s) return fall(Math.hypot(x - s.circle[0], y - s.circle[1]), s.circle[2]);
  if ("poly" in s) {
    const p = s.poly;
    let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      if (p[i + 1] > y !== p[j + 1] > y && x < (p[j] - p[i]) * (y - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) inside = !inside;
    }
    return inside ? 1 : 0;
  }
  return fall(distToPolyline(s.stroke, x, y), s.width / 2);
}
function distToPolyline(p, x, y) {
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]);
  let best = Infinity;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
function bbox(s) {
  if ("circle" in s) {
    const [x, y, r] = s.circle;
    return [x - r, y - r, x + r, y + r];
  }
  const p = "poly" in s ? s.poly : s.stroke, pad = "stroke" in s ? s.width / 2 : 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]);
    x1 = Math.max(x1, p[i]);
    y0 = Math.min(y0, p[i + 1]);
    y1 = Math.max(y1, p[i + 1]);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
function eachCovered(f, s, soft, fn) {
  const [x0, y0, x1, y1] = bbox(s), r = f.res;
  for (let j = Math.max(0, Math.floor(y0 * r)); j < Math.min(f.h, Math.ceil(y1 * r) + 1); j++)
    for (let i = Math.max(0, Math.floor(x0 * r)); i < Math.min(f.w, Math.ceil(x1 * r) + 1); i++) {
      const c = coverage(s, (i + 0.5) / r, (j + 0.5) / r, soft);
      if (c > 0) fn(j * f.w + i, c);
    }
}
function distanceTo(f, s, reach, inside = false) {
  const out = new Float32Array(f.w * f.h).fill(inside ? 0 : reach), r = f.res, pad = Math.ceil(reach * r) + 1;
  const [bx0, by0, bx1, by1] = bbox(s);
  const x0 = Math.max(0, Math.floor(bx0 * r) - pad), y0 = Math.max(0, Math.floor(by0 * r) - pad), x1 = Math.min(f.w - 1, Math.ceil(bx1 * r) + pad), y1 = Math.min(f.h - 1, Math.ceil(by1 * r) + pad);
  const ww = x1 - x0 + 1, hh = y1 - y0 + 1, big = 1e9, d = new Float32Array(ww * hh).fill(big);
  for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) if (coverage(s, (x0 + i + 0.5) / r, (y0 + j + 0.5) / r) > 0 !== inside) d[j * ww + i] = 0;
  const D = Math.SQRT2;
  for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
    let v = d[j * ww + i];
    if (i > 0) v = Math.min(v, d[j * ww + i - 1] + 1);
    if (j > 0) {
      v = Math.min(v, d[(j - 1) * ww + i] + 1);
      if (i > 0) v = Math.min(v, d[(j - 1) * ww + i - 1] + D);
      if (i < ww - 1) v = Math.min(v, d[(j - 1) * ww + i + 1] + D);
    }
    d[j * ww + i] = v;
  }
  for (let j = hh - 1; j >= 0; j--) for (let i = ww - 1; i >= 0; i--) {
    let v = d[j * ww + i];
    if (i < ww - 1) v = Math.min(v, d[j * ww + i + 1] + 1);
    if (j < hh - 1) {
      v = Math.min(v, d[(j + 1) * ww + i] + 1);
      if (i < ww - 1) v = Math.min(v, d[(j + 1) * ww + i + 1] + D);
      if (i > 0) v = Math.min(v, d[(j + 1) * ww + i - 1] + D);
    }
    d[j * ww + i] = v;
  }
  for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) out[(y0 + j) * f.w + x0 + i] = Math.min(reach, d[j * ww + i] / r) * (inside && d[j * ww + i] === 0 ? 0 : 1);
  return out;
}

// ../artgen-core/src/map/shape.ts
var WET_EDGE = /* @__PURE__ */ new Set(["forest", "grass", "scrub", "desert", "marsh"]);
function bands(t, local) {
  const dry = [0.08, (local ? 0.7 : 0.64) - 0.12];
  switch (t) {
    case "forest":
      return { e: dry, m: [0.65, 0.75] };
    case "grass":
      return { e: dry, m: [0.42, 0.55] };
    case "scrub":
      return { e: dry, m: [0.25, 0.35] };
    case "desert":
      return { e: dry, m: [0.03, 0.15] };
    case "marsh":
      return { e: [8e-3, 0.15], m: [0.82, 0.95] };
    case "sand":
      return { e: [8e-3, 0.03], m: [0.05, 0.6] };
    case "rock":
      return { e: local ? [0.76, 1] : [0.68, 0.8] };
    case "snow":
      return { e: [0.88, 1] };
    default:
      return {};
  }
}
function weights(spec, f, area, blend, mode) {
  if (!(blend > 0)) {
    const w2 = new Float32Array(f.w * f.h);
    eachCovered(f, area, false, (i) => {
      w2[i] = 1;
    });
    return w2;
  }
  const out = distanceTo(f, area, blend), wet = mode === "wet";
  const inner = wet ? distanceTo(f, area, blend, true) : null;
  let core2 = 0;
  if (inner) for (let n = 0; n < inner.length; n++) core2 = Math.max(core2, inner[n]);
  const lead = inner ? Math.min(blend * 0.2, core2 * 0.2) : 0, amp = inner ? Math.min(blend * 0.3, core2 * 0.3) : blend * 0.4, ramp = blend * 0.25;
  const noise = (scale, seed) => ({ w: f.w * 4, h: f.h * 4, cells: Math.max(2, Math.round(4 * spec.cols / (spec.gen.feature * scale))), cellsY: Math.max(2, Math.round(4 * spec.rows / (spec.gen.feature * scale))), octaves: 2, seed: spec.seed + seed });
  const waves = mode === "wet" ? [noise(0.26, 303), noise(0.11, 509)] : mode === "land" ? [noise(1, 709)] : [];
  const w = new Float32Array(f.w * f.h);
  for (let n = 0; n < w.length; n++) {
    const d = out[n], deep = inner ? inner[n] : 0;
    if (d >= blend) continue;
    if (d <= 0 && (!inner || deep >= lead + amp)) {
      w[n] = 1;
      continue;
    }
    const i = n % f.w, j = (n - i) / f.w, signed = d > 0 ? d : -deep;
    let v = 0;
    if (waves.length) v = Math.max(-1, Math.min(1, (waves.reduce((t, o) => t + pGradient(i + f.w, j + f.h, o), 0) - waves.length / 2) * (wet ? 2.6 : 3)));
    const a = inner ? amp : amp * Math.min(1, signed / ramp), s = Math.max(0, signed + lead + v * a) / (blend + lead);
    w[n] = s >= 1 ? 0 : (1 - s) ** 3;
  }
  return w;
}
var intersect = (a, b) => {
  const lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1]);
  return lo <= hi ? [lo, hi] : null;
};
function streamCurve(p) {
  const n = p.length / 2, out = [p[0], p[1]], P = (i) => [p[Math.max(0, Math.min(n - 1, i)) * 2], p[Math.max(0, Math.min(n - 1, i)) * 2 + 1]];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)], k = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.5));
    for (let s = 1; s <= k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      out.push(...[0, 1].map((a) => 0.5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3)));
    }
  }
  return out;
}
function shapeGround(spec, f, raw, seaLevel, margin) {
  const list3 = spec.require ?? [], local = spec.preset === "local", N = f.w * f.h, feature = spec.gen.feature;
  const base = Float32Array.from(raw, (v) => Math.max(0, Math.min(1, v)));
  const toRaw = (e) => seaLevel + e * (1 - seaLevel);
  const blendOf = (r) => r.blend ?? feature;
  for (const r of list3) {
    if (r.kind !== "path" || r.path !== "stream") continue;
    const p = streamCurve(r.points), valley = Math.min(feature * 0.5, 4), steps = [];
    for (let i = 0; i < p.length - 2; i += 2) {
      const len = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]), k = Math.max(1, Math.ceil(len * f.res));
      for (let s = 0; s < k; s++) steps.push([p[i] + (p[i + 2] - p[i]) * s / k, p[i + 1] + (p[i + 3] - p[i + 1]) * s / k]);
    }
    steps.push([p[p.length - 2], p[p.length - 1]]);
    const at3 = (x, y) => raw[Math.min(f.h - 1, Math.max(0, Math.floor(y * f.res))) * f.w + Math.min(f.w - 1, Math.max(0, Math.floor(x * f.res)))];
    const bed = steps.map(([x, y]) => at3(x, y)), floor2 = Math.max(seaLevel + 4e-3, 0);
    for (let i = 1; i < bed.length; i++) bed[i] = Math.min(bed[i], bed[i - 1]);
    const win = Math.max(1, Math.round(f.res)), smooth3 = bed.map((_, i) => {
      let s = 0, c = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(bed.length - 1, i + win); k++) {
        s += bed[k];
        c++;
      }
      return Math.max(floor2, s / c);
    });
    const strokes = steps.length, reach = valley;
    const best = new Float32Array(N).fill(reach), bedAt = new Float32Array(N);
    for (let k = 0; k < strokes; k++) {
      const [sx, sy] = steps[k], x0 = Math.max(0, Math.floor((sx - reach) * f.res)), x1 = Math.min(f.w - 1, Math.ceil((sx + reach) * f.res)), y0 = Math.max(0, Math.floor((sy - reach) * f.res)), y1 = Math.min(f.h - 1, Math.ceil((sy + reach) * f.res));
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const d = Math.hypot((i + 0.5) / f.res - sx, (j + 0.5) / f.res - sy), n = j * f.w + i;
        if (d < best[n]) {
          best[n] = d;
          bedAt[n] = smooth3[k];
        }
      }
    }
    for (let n = 0; n < N; n++) {
      if (best[n] >= reach) continue;
      const wgt = 0.5 + 0.5 * Math.cos(best[n] / reach * Math.PI), target = Math.min(raw[n], bedAt[n]);
      raw[n] += (target - raw[n]) * wgt;
    }
  }
  const heights = list3.filter((r) => r.kind === "height");
  const heightW = new Map(heights.map((h) => [h, weights(spec, f, h.area, blendOf(h), "height")]));
  const toBand = (h) => [Math.max(h.low / spec.topo.maxElevation, 2e-3), Math.min(h.high / spec.topo.maxElevation, 1)];
  const pull = (w, lo, hi, profile = base) => {
    for (let n = 0; n < N; n++) if (w[n] > 0) raw[n] += (lo + (hi - lo) * profile[n] - raw[n]) * w[n];
  };
  const rise = (h) => {
    const depth = distanceTo(f, h.area, Math.min(Math.max(blendOf(h), 1) * 4, 80), true);
    let core2 = 0;
    for (let n = 0; n < N; n++) core2 = Math.max(core2, depth[n]);
    return Float32Array.from(base, (b, n) => core2 > 0 ? Math.min(1, 0.7 * (depth[n] / core2) + 0.3 * b) : b);
  };
  const moist = [], ground2 = [];
  const terrains = list3.flatMap((r) => r.kind === "terrain" ? [{ r, w: weights(spec, f, r.area, blendOf(r), WET_EDGE.has(r.terrain) ? "wet" : "land"), b: bands(r.terrain, local) }] : []);
  const within = (a, b) => {
    let inside = 0, total = 0;
    for (let n = 0; n < N; n++) if (a[n] === 1) {
      total++;
      if (b[n] === 1) inside++;
    }
    return total ? inside / total : 0;
  };
  const heightBand = new Map(heights.map((h) => [h, toBand(h)]));
  for (const t of terrains) {
    if (t.r.terrain === "water" || t.r.terrain === "deep") {
      const gap = Math.max(0.08, seaLevel * 0.35), lo = t.r.terrain === "deep" ? 0 : seaLevel - gap * 0.9, hi = t.r.terrain === "deep" ? Math.max(0, seaLevel - gap * 1.15) : seaLevel - 4e-3;
      if (hi > lo) pull(t.w, lo, hi);
      if (t.b.m) moist.push({ w: t.w, band: t.b.m });
      continue;
    }
    if (t.b.m) moist.push({ w: t.w, band: t.b.m });
    if (!t.b.e) continue;
    let e = t.b.e;
    for (const h of heights) {
      const hw = heightW.get(h), hb = heightBand.get(h);
      if (within(t.w, hw) > 0.5) e = intersect(e, hb) ?? hb;
      if (within(hw, t.w) > 0.5) heightBand.set(h, intersect(hb, t.b.e) ?? hb);
    }
    ground2.push({ w: t.w, band: e });
  }
  for (const g of ground2) pull(g.w, toRaw(g.band[0]), toRaw(g.band[1]));
  for (const h of heights) {
    const [lo, hi] = heightBand.get(h);
    pull(heightW.get(h), toRaw(lo), toRaw(hi), rise(h));
  }
  const clear = list3.filter((r) => r.kind === "clear");
  let blocked = null;
  for (const c of clear) {
    blocked ??= new Uint8Array(N);
    const d = distanceTo(f, c.area, margin + 0.01);
    for (let n = 0; n < N; n++) if (d[n] <= margin) blocked[n] = 1;
  }
  return {
    moisture(n, m) {
      for (const { w, band } of moist) if (w[n] > 0) m += (band[0] + (band[1] - band[0]) * Math.max(0, Math.min(1, m)) - m) * w[n];
      return m;
    },
    blocked,
    clear
  };
}
function streamsOf(spec) {
  return (spec.require ?? []).flatMap((r) => r.kind === "path" && r.path === "stream" ? [{ id: r.id, points: r.points, width: r.width, delta: r.delta }] : []);
}
function routeRoad(points, f, elev, wet) {
  const step = Math.max(1, Math.round(f.res / 2)), W = Math.ceil(f.w / step), H = Math.ceil(f.h / step), unit = step / f.res;
  const at3 = (i, j) => Math.min(f.h - 1, j * step + (step >> 1)) * f.w + Math.min(f.w - 1, i * step + (step >> 1));
  const cell = (x, y) => [Math.max(0, Math.min(W - 1, Math.floor(x * f.res / step))), Math.max(0, Math.min(H - 1, Math.floor(y * f.res / step)))];
  const out = [points[0], points[1]];
  for (let p = 2; p < points.length; p += 2) {
    const [si, sj] = cell(points[p - 2], points[p - 1]), [ti, tj] = cell(points[p], points[p + 1]);
    const dist = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), done = new Uint8Array(W * H), heap2 = [], key = new Float32Array(W * H);
    const less = (a, b) => key[a] < key[b];
    const push = (n) => {
      heap2.push(n);
      let c = heap2.length - 1;
      while (c) {
        const q = c - 1 >> 1;
        if (!less(heap2[c], heap2[q])) break;
        [heap2[c], heap2[q]] = [heap2[q], heap2[c]];
        c = q;
      }
    };
    const pop = () => {
      const top = heap2[0], last = heap2.pop();
      if (heap2.length) {
        heap2[0] = last;
        let c = 0;
        for (; ; ) {
          const l = c * 2 + 1, r = l + 1;
          let m = c;
          if (l < heap2.length && less(heap2[l], heap2[m])) m = l;
          if (r < heap2.length && less(heap2[r], heap2[m])) m = r;
          if (m === c) break;
          [heap2[c], heap2[m]] = [heap2[m], heap2[c]];
          c = m;
        }
      }
      return top;
    };
    const goal = tj * W + ti, h = (i, j) => Math.hypot(i - ti, j - tj) * unit;
    dist[sj * W + si] = 0;
    key[sj * W + si] = h(si, sj);
    push(sj * W + si);
    while (heap2.length) {
      const n = pop();
      if (done[n]) continue;
      done[n] = 1;
      if (n === goal) break;
      const i = n % W, j = (n - i) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj, m = y * W + x;
        if (!di && !dj || x < 0 || y < 0 || x >= W || y >= H || done[m]) continue;
        const len = Math.hypot(di, dj) * unit, rise = Math.abs(elev[at3(x, y)] - elev[at3(i, j)]);
        const c = dist[n] + len + rise * 40 + (wet[at3(x, y)] ? len * 3 : 0);
        if (c < dist[m]) {
          dist[m] = c;
          from[m] = n;
          key[m] = c + h(x, y);
          push(m);
        }
      }
    }
    const path = [];
    for (let n = goal; n >= 0 && n !== sj * W + si; n = from[n]) {
      const i = n % W, j = (n - i) / W;
      path.push((i + 0.5) * step / f.res, (j + 0.5) * step / f.res);
    }
    for (let k = path.length - 2; k >= 0; k -= 2) out.push(path[k], path[k + 1]);
    out.push(points[p], points[p + 1]);
  }
  return out;
}

// ../artgen-core/src/lib/trace.ts
function isolines(f, w, h, t) {
  const segs = [];
  const hk = (i, j) => `h${j * w + i}`, vk = (i, j) => `v${j * w + i}`;
  const lerp = (a, b) => a === b ? 0.5 : (t - a) / (b - a);
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = f[j * w + i], b = f[j * w + i + 1], c = f[(j + 1) * w + i + 1], d = f[(j + 1) * w + i];
    const k = (a >= t ? 8 : 0) | (b >= t ? 4 : 0) | (c >= t ? 2 : 0) | (d >= t ? 1 : 0);
    if (k === 0 || k === 15) continue;
    const T2 = () => [hk(i, j), i + lerp(a, b), j];
    const R2 = () => [vk(i + 1, j), i + 1, j + lerp(b, c)];
    const B = () => [hk(i, j + 1), i + lerp(d, c), j + 1];
    const L2 = () => [vk(i, j), i, j + lerp(a, d)];
    const add = (p, q) => segs.push([...p, ...q]);
    const mid = (a + b + c + d) / 4 >= t;
    switch (k) {
      case 1:
      case 14:
        add(L2(), B());
        break;
      case 2:
      case 13:
        add(B(), R2());
        break;
      case 3:
      case 12:
        add(L2(), R2());
        break;
      case 4:
      case 11:
        add(T2(), R2());
        break;
      case 6:
      case 9:
        add(T2(), B());
        break;
      case 7:
      case 8:
        add(L2(), T2());
        break;
      case 5:
        if (mid) {
          add(L2(), T2());
          add(B(), R2());
        } else {
          add(T2(), R2());
          add(L2(), B());
        }
        break;
      case 10:
        if (mid) {
          add(T2(), R2());
          add(L2(), B());
        } else {
          add(L2(), T2());
          add(B(), R2());
        }
        break;
    }
  }
  const at3 = /* @__PURE__ */ new Map();
  segs.forEach((s, n) => {
    for (const key of [s[0], s[3]]) {
      const l = at3.get(key);
      if (l) l.push(n);
      else at3.set(key, [n]);
    }
  });
  const used = new Uint8Array(segs.length), lines = [];
  const walk = (key, from, out) => {
    for (let cur = from, k = key; ; ) {
      const next = (at3.get(k) ?? []).find((n) => n !== cur && !used[n]);
      if (next === void 0) return k;
      used[next] = 1;
      const s = segs[next], far = s[0] === k ? 3 : 0;
      out.push(s[far + 1], s[far + 2]);
      cur = next;
      k = s[far];
    }
  };
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const s = segs[n], fwd = [s[1], s[2], s[4], s[5]];
    const endKey = walk(s[3], n, fwd);
    if (endKey === s[0]) {
      fwd.length -= 2;
      lines.push({ pts: fwd, closed: true });
      continue;
    }
    const back = [];
    walk(s[0], n, back);
    const pts2 = [];
    for (let q = back.length - 2; q >= 0; q -= 2) pts2.push(back[q], back[q + 1]);
    lines.push({ pts: pts2.concat(fwd), closed: false });
  }
  return lines;
}
function chaikin(l, passes = 2) {
  let p = l.pts;
  for (let k = 0; k < passes && p.length >= 6; k++) {
    const n = p.length / 2, out = [];
    if (!l.closed) out.push(p[0], p[1]);
    for (let i = 0; i < (l.closed ? n : n - 1); i++) {
      const j = (i + 1) % n, x0 = p[i * 2], y0 = p[i * 2 + 1], x1 = p[j * 2], y1 = p[j * 2 + 1];
      out.push(x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25, x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75);
    }
    if (!l.closed) out.push(p[p.length - 2], p[p.length - 1]);
    p = out;
  }
  return { pts: p, closed: l.closed };
}
function simplifyLine(l, eps) {
  const p = l.pts, n = p.length / 2;
  if (n < 4) return l;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(), ax = p[a * 2], ay = p[a * 2 + 1], dx = p[b * 2] - ax, dy = p[b * 2 + 1] - ay, len = Math.hypot(dx, dy) || 1;
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p[i * 2] - ax) * dy - (p[i * 2 + 1] - ay) * dx) / len;
      if (d > far) {
        far = d;
        best = i;
      }
    }
    if (best >= 0 && far > eps) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return { pts: out, closed: l.closed };
}
var lineLength = (p) => {
  let s = 0;
  for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
  return s;
};
function pathData(lines, k = 1) {
  const f = (v) => (Math.round(v * k * 10) / 10).toString();
  return lines.map((l) => {
    let d = `M${f(l.pts[0])} ${f(l.pts[1])}`;
    for (let i = 2; i < l.pts.length; i += 2) d += `L${f(l.pts[i])} ${f(l.pts[i + 1])}`;
    return l.closed ? d + "Z" : d;
  }).join("");
}

// ../artgen-core/src/map/generate.ts
var T = Object.fromEntries(TERRAINS.map((t, i) => [t, i]));
var isWater = (t) => t === T.deep || t === T.water;
function quantile(f, q) {
  if (q <= 0) return -Infinity;
  const s = Float32Array.from(f).sort();
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
function blur(f, w, h, r, passes = 1) {
  let a = f;
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += a[j * w + Math.min(w - 1, Math.max(0, i + k))];
      tmp[j * w + i] = s / (2 * r + 1);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, j + k)) * w + i];
      out[j * w + i] = s / (2 * r + 1);
    }
    a = out;
  }
  return a;
}
function heightField(spec, w, h) {
  const g = spec.gen, R2 = 4, cells = Math.max(2, Math.round(R2 * Math.max(spec.cols, spec.rows) / g.feature));
  const opts = { w: w * R2, h: h * R2, cells, cellsY: Math.max(2, Math.round(cells * h / w)), octaves: 5, gain: 0.35 + g.roughness * 0.25, seed: spec.seed };
  const r = rng(spec.seed), ox = Math.floor(r() * w * (R2 - 1)), oy = Math.floor(r() * h * (R2 - 1));
  const f = new Float32Array(w * h);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let v = pGradient(i + ox, j + oy, opts);
    if (g.land === "island") {
      const dx = (i + 0.5) / w - 0.5, dy = (j + 0.5) / h - 0.5;
      v -= Math.pow(Math.hypot(dx, dy) * 2, 2.2) * 0.55;
    }
    f[j * w + i] = v;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const k = 1.7 - g.relief * 1.1;
  for (let n = 0; n < f.length; n++) f[n] = Math.pow((f[n] - lo) / (hi - lo || 1), k);
  return f;
}
function fillDepressions(h, w, hh, water) {
  const out = Float32Array.from(h), seen = new Uint8Array(h.length), heap2 = [];
  const less = (a, b) => out[a] < out[b];
  const push = (n) => {
    heap2.push(n);
    let c = heap2.length - 1;
    while (c) {
      const p = c - 1 >> 1;
      if (!less(heap2[c], heap2[p])) break;
      [heap2[c], heap2[p]] = [heap2[p], heap2[c]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap2[0], last = heap2.pop();
    if (heap2.length) {
      heap2[0] = last;
      let c = 0;
      for (; ; ) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < heap2.length && less(heap2[l], heap2[m])) m = l;
        if (r < heap2.length && less(heap2[r], heap2[m])) m = r;
        if (m === c) break;
        [heap2[c], heap2[m]] = [heap2[m], heap2[c]];
        c = m;
      }
    }
    return top;
  };
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
    const n = j * w + i;
    if (water[n] || i === 0 || j === 0 || i === w - 1 || j === hh - 1) {
      seen[n] = 1;
      push(n);
    }
  }
  while (heap2.length) {
    const n = pop(), i = n % w, j = (n - i) / w;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj, m = y * w + x;
      if (!di && !dj || x < 0 || y < 0 || x >= w || y >= hh || seen[m]) continue;
      seen[m] = 1;
      if (out[m] <= out[n]) out[m] = out[n] + 1e-6;
      push(m);
    }
  }
  return out;
}
function traceRivers(spec, filled, elev, water, w, h, res, wet, blocked) {
  const n = spec.gen.rivers;
  if (!n) return [];
  const r = rng(spec.seed * 31 + 7), cands = [];
  for (let k = 0; k < elev.length; k++) if (!water[k] && !blocked?.[k] && elev[k] > 0.4 && elev[k] < 0.85) cands.push(k);
  cands.sort((a, b) => elev[b] - elev[a]);
  const spacing = Math.max(spec.cols, spec.rows) / (n + 1) * res, sources = [];
  for (let tries = 0; tries < 400 && sources.length < n && cands.length; tries++) {
    const k = cands[Math.floor(Math.pow(r(), 2) * cands.length)], x = k % w, y = (k - x) / w;
    if (sources.every((s) => Math.hypot(s % w - x, Math.floor(s / w) - y) > spacing)) sources.push(k);
  }
  const out = [];
  for (const s of sources) {
    const path = [];
    let k = s, mouth = false;
    for (let step = 0; step < w * h; step++) {
      const x = k % w, y = (k - x) / w;
      path.push((x + 0.5) / res, (y + 0.5) / res);
      if (water[k]) {
        mouth = true;
        break;
      }
      if (wet[k] === 2) break;
      wet[k] = 2;
      let best = -1, low = filled[k];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const xx = x + di, yy = y + dj, m = yy * w + xx;
        if (!di && !dj || xx < 0 || yy < 0 || xx >= w || yy >= h || blocked?.[m]) continue;
        if (filled[m] < low) {
          low = filled[m];
          best = m;
        }
      }
      if (best < 0) break;
      k = best;
    }
    if (path.length / 2 < res * 3) continue;
    out.push({ pts: smoothLine(path, res), mouth });
  }
  return out;
}
function toShore(pts2, water) {
  const n = pts2.length / 2;
  for (let i = 2; i < n; i++) if (water(pts2[i * 2], pts2[i * 2 + 1])) return pts2.slice(0, (i + 1) * 2);
  const ex = pts2[n * 2 - 2], ey = pts2[n * 2 - 1];
  let k = n - 2, dx = 0, dy = 0;
  while (k > 0 && Math.hypot(ex - pts2[k * 2], ey - pts2[k * 2 + 1]) < 0.5) k--;
  dx = ex - pts2[k * 2];
  dy = ey - pts2[k * 2 + 1];
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  for (let d = 0.1; d <= 3; d += 0.1) {
    const x = ex + dx / len * d, y = ey + dy / len * d;
    if (water(x, y)) return [...pts2, ex + dx / len * (d + 0.15), ey + dy / len * (d + 0.15)];
  }
  return null;
}
var riverWidth = (spec) => spec.preset === "local" ? 0.35 : 0.16;
var SOURCE = 0.6;
var FLARE = 1.2;
var FLARE_LAND = 3;
var FLARE_WATER = 1.5;
var smoothstep = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
function resample(p, step) {
  const out = [p[0], p[1]];
  let carry = 0;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], seg = Math.hypot(p[i] - ax, p[i + 1] - ay);
    let d = step - carry;
    for (; d <= seg; d += step) out.push(ax + (p[i] - ax) * d / seg, ay + (p[i + 1] - ay) * d / seg);
    carry = seg - (d - step);
  }
  const n = out.length;
  if (Math.hypot(out[n - 2] - p[p.length - 2], out[n - 1] - p[p.length - 1]) > step * 0.3) out.push(p[p.length - 2], p[p.length - 1]);
  else {
    out[n - 2] = p[p.length - 2];
    out[n - 1] = p[p.length - 1];
  }
  return out;
}
function riverRibbon(line2, W, mouth) {
  let p = line2;
  if (mouth) {
    const n2 = p.length / 2, ex = p[n2 * 2 - 2], ey = p[n2 * 2 - 1];
    let k = n2 - 2;
    while (k > 0 && Math.hypot(ex - p[k * 2], ey - p[k * 2 + 1]) < W * 2) k--;
    const dx = ex - p[k * 2], dy = ey - p[k * 2 + 1], len = Math.hypot(dx, dy) || 1;
    p = [...p, ex + dx / len * W * FLARE_WATER, ey + dy / len * W * FLARE_WATER];
  }
  const c = resample(p, Math.min(0.1, W * 0.4)), n = c.length / 2, s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]));
  const L2 = s[n - 1] || 1, shore = mouth ? Math.max(L2 * 0.5, L2 - W * FLARE_WATER) : L2;
  const widths = s.map((d) => {
    const base = W * (SOURCE + (1 - SOURCE) * Math.pow(Math.min(d, shore) / shore, 0.6));
    return mouth ? base * (1 + FLARE * smoothstep((d - (shore - W * FLARE_LAND)) / (W * (FLARE_LAND + FLARE_WATER)))) : base;
  });
  const nx = [], ny = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2), tx = c[b * 2] - c[a * 2], ty = c[b * 2 + 1] - c[a * 2 + 1], tl = Math.hypot(tx, ty) || 1;
    nx.push(-ty / tl);
    ny.push(tx / tl);
  }
  const side = (i, sgn) => [c[i * 2] + nx[i] * sgn * widths[i] / 2, c[i * 2 + 1] + ny[i] * sgn * widths[i] / 2];
  const cap = (i, dir, from) => {
    const out = [], r = widths[i] / 2, tx = ny[i] * dir, ty = -nx[i] * dir;
    for (let k = 1; k < 8; k++) {
      const a = k / 8 * Math.PI, cs = Math.cos(a) * from, sn = Math.sin(a);
      out.push(c[i * 2] + r * (nx[i] * cs + tx * sn), c[i * 2 + 1] + r * (ny[i] * cs + ty * sn));
    }
    return out;
  };
  const outline2 = [];
  for (let i = 0; i < n; i++) outline2.push(...side(i, 1));
  if (!mouth) outline2.push(...cap(n - 1, 1, 1));
  for (let i = n - 1; i >= 0; i--) outline2.push(...side(i, -1));
  outline2.push(...cap(0, -1, -1));
  return { pts: c, widths, outline: outline2, mouth };
}
function smoothLine(pts2, res) {
  const thin = [pts2[0], pts2[1]];
  for (let i = 2; i < pts2.length - 2; i += 2) if (Math.hypot(pts2[i] - thin[thin.length - 2], pts2[i + 1] - thin[thin.length - 1]) >= 0.5) thin.push(pts2[i], pts2[i + 1]);
  thin.push(pts2[pts2.length - 2], pts2[pts2.length - 1]);
  return simplifyLine(chaikin({ pts: thin, closed: false }, 3), 0.15 / res).pts;
}
function markLine(pts2, width, w, h, res, wet) {
  eachCovered({ res, w, h }, { stroke: pts2, width: Math.max(width, 1 / res) * 2 }, false, (i) => {
    if (!wet[i]) wet[i] = 1;
  });
}
function simplifyTerrain(t, w, h, passes, minArea) {
  let a = t;
  for (let p = 0; p < passes; p++) {
    const out = new Uint8Array(a.length), count = new Uint16Array(TERRAINS.length);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      count.fill(0);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) count[a[Math.min(h - 1, Math.max(0, j + dj)) * w + Math.min(w - 1, Math.max(0, i + di))]]++;
      const own = a[j * w + i];
      let best = own;
      for (let c = 0; c < count.length; c++) if (count[c] > count[best]) best = c;
      out[j * w + i] = count[best] >= 5 ? best : own;
    }
    a = out;
  }
  if (minArea <= 1) return a;
  const label = new Int32Array(a.length).fill(-1), stack = [];
  for (let s = 0; s < a.length; s++) {
    if (label[s] >= 0) continue;
    const cls = a[s], members = [], border = /* @__PURE__ */ new Map();
    label[s] = s;
    stack.push(s);
    while (stack.length) {
      const n = stack.pop(), i = n % w, j = (n - i) / w;
      members.push(n);
      for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const m = y * w + x;
        if (a[m] === cls) {
          if (label[m] < 0) {
            label[m] = s;
            stack.push(m);
          }
        } else border.set(a[m], (border.get(a[m]) ?? 0) + 1);
      }
    }
    if (members.length >= minArea || !border.size) continue;
    let into = -1, most = 0;
    for (const [c, k] of border) if (k > most) {
      most = k;
      into = c;
    }
    for (const n of members) a[n] = into;
  }
  return a;
}
function classify(e, m, local) {
  if (e < 0.035) return m > 0.72 ? T.marsh : T.sand;
  if (!local && e > 0.84) return T.snow;
  if (e > (local ? 0.7 : 0.64)) return T.rock;
  if (m > 0.78 && e < 0.2) return T.marsh;
  if (m < 0.2) return T.desert;
  if (m < 0.38) return T.scrub;
  if (m < 0.6) return T.grass;
  return T.forest;
}
function generateMap(spec) {
  const res = RESOLUTION[spec.preset], w = spec.cols * res, h = spec.rows * res, N = w * h, g = spec.gen;
  const field = { res, w, h };
  const raw = heightField(spec, w, h), sea = quantile(raw, g.sea), seaLevel = Number.isFinite(sea) ? sea : -0.01;
  for (const ed of spec.edits) if (ed.op === "elevate") eachCovered(field, ed.shape, true, (i, c) => {
    raw[i] = Math.max(0, Math.min(1.2, raw[i] + ed.amount * c));
  });
  const shaped = spec.require?.length ? shapeGround(spec, field, raw, seaLevel, riverWidth(spec) / 2 + 0.6) : null;
  const water = new Uint8Array(N), elev = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    if (raw[n] < seaLevel) water[n] = 1;
    else elev[n] = Math.min(1, (raw[n] - seaLevel) / (1 - seaLevel || 1));
  }
  const terrain = new Uint8Array(N), wet = new Uint8Array(N);
  const open = Uint8Array.from(water);
  for (const ed of spec.edits) if (ed.op === "paint") {
    const v = ed.terrain === "water" || ed.terrain === "deep" ? 1 : 0;
    eachCovered(field, ed.shape, false, (i) => {
      open[i] = v;
    });
  }
  const mains = traceRivers(spec, fillDepressions(raw, w, h, water), elev, open, w, h, res, wet, shaped?.blocked ?? null).map((r) => ({ ...r, width: riverWidth(spec), source: "generated" }));
  for (const ed of spec.edits) if (ed.op === "river") mains.push({ pts: smoothLine(ed.points, res), width: ed.width ?? riverWidth(spec), mouth: ed.delta !== false, source: "edit" });
  for (const s of streamsOf(spec)) mains.push({ pts: smoothLine(streamCurve(s.points), res), width: s.width ?? riverWidth(spec), mouth: s.delta !== false, source: "required", for: s.id });
  const roads = [];
  for (const ed of spec.edits) {
    if (ed.op === "road") roads.push({ pts: smoothLine(ed.points, res), width: spec.preset === "local" ? 0.5 : 0.08 });
  }
  for (const r of spec.require ?? []) if (r.kind === "path" && r.path === "road") roads.push({ pts: smoothLine(routeRoad(r.points, field, elev, open), res), width: spec.preset === "local" ? 0.5 : 0.08, for: r.id });
  for (const rv of mains) markLine(rv.pts, rv.width, w, h, res, wet);
  const near3 = new Float32Array(N);
  for (let n = 0; n < N; n++) near3[n] = water[n] || wet[n] ? 1 : 0;
  const nearB = blur(near3, w, h, Math.max(1, Math.round(res * 1.5)), 2);
  const mopts = { w: w * 4, h: h * 4, cells: Math.max(2, Math.round(4 * Math.max(spec.cols, spec.rows) / (g.feature * 1.4))), octaves: 3, seed: spec.seed + 101 };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = j * w + i;
    if (water[n]) {
      terrain[n] = raw[n] < seaLevel - Math.max(0.08, seaLevel * 0.35) ? T.deep : T.water;
      continue;
    }
    const m = 0.5 + (pGradient(i + w, j + h, mopts) - 0.5) * 1.8 + nearB[n] * 0.25 + (g.moisture - 0.5) * 0.9 - elev[n] * 0.12;
    const wet01 = Math.max(0, Math.min(1, m));
    terrain[n] = classify(elev[n], shaped ? shaped.moisture(n, wet01) : wet01, spec.preset === "local");
  }
  const minArea = Math.round(Math.pow(g.simplify * res * 0.55, 2));
  const simple = simplifyTerrain(terrain, w, h, Math.ceil(g.simplify), minArea);
  for (const ed of spec.edits) if (ed.op === "paint") {
    const c = T[ed.terrain];
    eachCovered(field, ed.shape, false, (i) => {
      simple[i] = c;
    });
  }
  for (let n = 0; n < N; n++) if (isWater(simple[n])) elev[n] = 0;
  const shown4 = (x, y) => {
    const i = Math.floor(x * res), j = Math.floor(y * res);
    return i >= 0 && j >= 0 && i < w && j < h && isWater(simple[j * w + i]);
  };
  const rivers = mains.map((m) => {
    let fit = m.mouth ? toShore(m.pts, shown4) : null;
    if (fit && m.source === "required" && fit.length < m.pts.length) fit = null;
    if (fit && m.source === "generated" && shaped?.clear.length && touches(fit, shaped.clear.map((c) => c.area))) fit = null;
    return { ...riverRibbon(fit ?? m.pts, m.width, !!fit), source: m.source, ...m.for !== void 0 && { for: m.for } };
  });
  return { res, w, h, elevation: elev, terrain: simple, rivers, roads };
}
function touches(pts2, shapes) {
  for (let i = 0; i < pts2.length; i += 2) for (const s of shapes) if (coverage(s, pts2[i], pts2[i + 1]) > 0) return true;
  return false;
}
function terrainsUsed(f) {
  const count = new Array(TERRAINS.length).fill(0);
  for (const t of f.terrain) count[t]++;
  return TERRAINS.map((t, i) => [t, count[i]]).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

// ../artgen-core/src/map/gridlines.ts
var letters = (n) => {
  let s = "";
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
};
var two = (n) => String(n).padStart(2, "0");
function gridGeometry(spec, k = 1) {
  const { cols: W, rows: H } = spec, s = spec.grid.size, f = (v) => (Math.round(v * k * 10) / 10).toString();
  const cells = [];
  let d = "";
  if (spec.grid.type === "square") {
    for (let x = 0; x <= W + 1e-9; x += s) d += `M${f(x)} 0V${f(H)}`;
    for (let y = 0; y <= H + 1e-9; y += s) d += `M0 ${f(y)}H${f(W)}`;
    for (let c = 0; (c + 0.5) * s < W; c++) for (let r = 0; (r + 0.5) * s < H; r++) cells.push({ x: (c + 0.5) * s, y: (r + 0.5) * s, name: `${letters(c)}${r + 1}` });
  } else if (spec.grid.type === "hex") {
    const R2 = s / Math.sqrt(3);
    for (let c = 0; c * 1.5 * R2 - R2 < W; c++) for (let r = -1; r * s - s < H; r++) {
      const cx = R2 + c * 1.5 * R2, cy = s / 2 + r * s + (c % 2 ? s / 2 : 0);
      const P = (a) => `${f(cx + R2 * Math.cos(a * Math.PI / 3))} ${f(cy + R2 * Math.sin(a * Math.PI / 3))}`;
      d += `M${P(0)}L${P(1)}L${P(2)}L${P(3)}L${P(4)}L${P(5)}Z`;
      if (r >= 0 && cx < W && cy < H && cx > 0 && cy > 0) cells.push({ x: cx, y: cy, name: `${two(c + 1)}${two(r + 1)}` });
    }
  }
  return { d, cells };
}

// ../artgen-core/src/map/symbols.ts
var SYMBOLS = {
  village: { name: "Village", svg: '<circle r="3.2" fill="{ink}"/>' },
  town: { name: "Town", svg: '<circle r="5.5" fill="{fill}" stroke="{ink}" stroke-width="1.6"/><circle r="2.2" fill="{ink}"/>' },
  city: { name: "City", svg: '<rect x="-6.5" y="-6.5" width="13" height="13" fill="{fill}" stroke="{ink}" stroke-width="1.6"/><rect x="-3" y="-3" width="6" height="6" fill="{ink}"/>' },
  castle: { name: "Castle", svg: '<path d="M-7 8V-3H-5V-6H-2.5V-3H-1V-6H1V-3H2.5V-6H5V-3H7V8Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-1.8 8V3A1.8 1.8 0 0 1 1.8 3V8" fill="{ink}"/>' },
  tower: { name: "Tower", svg: '<path d="M-3.5 8.5L-2.5 -4.5H-4.5V-8.5H-2V-6.5H-0.7V-8.5H0.7V-6.5H2V-8.5H4.5V-4.5H2.5L3.5 8.5Z" fill="{fill}" stroke="{ink}" stroke-width="1.3" stroke-linejoin="round"/>' },
  ruin: { name: "Ruin", svg: '<path d="M-7 8V-2A7 7 0 0 1 3 -6.3M7 8V0" fill="none" stroke="{ink}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="4 2.2"/><path d="M-8.5 8H8.5" stroke="{ink}" stroke-width="1.6"/>' },
  temple: { name: "Temple", svg: '<path d="M-8 -2L0 -8L8 -2Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-5.5 -1V6M-2 -1V6M2 -1V6M5.5 -1V6M-8 7.5H8" stroke="{ink}" stroke-width="1.5"/>' },
  cave: { name: "Cave", svg: '<path d="M-8 7Q-8 -7 0 -7Q8 -7 8 7Z" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-3.5 7Q-3.5 -1 0 -1Q3.5 -1 3.5 7Z" fill="{ink}"/>' },
  dungeon: { name: "Dungeon", svg: '<rect x="-7" y="-7" width="14" height="14" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><path d="M-4 4H-1V1H2V-2H5" fill="none" stroke="{ink}" stroke-width="1.5"/>' },
  camp: { name: "Camp", svg: '<path d="M-8 7L0 -7L8 7Z" fill="{fill}" stroke="{ink}" stroke-width="1.5" stroke-linejoin="round"/><path d="M0 -7V7M-2.5 7L0 2L2.5 7" fill="none" stroke="{ink}" stroke-width="1.3"/>' },
  port: { name: "Port", svg: '<circle cy="-6" r="1.8" fill="none" stroke="{ink}" stroke-width="1.4"/><path d="M0 -4V7M-4 -1H4M-6.5 2.5Q-6 7 0 7Q6 7 6.5 2.5" fill="none" stroke="{ink}" stroke-width="1.6" stroke-linecap="round"/>' },
  bridge: { name: "Bridge", svg: '<path d="M-7 -5Q-3 -2 -3 0Q-3 2 -7 5M7 -5Q3 -2 3 0Q3 2 7 5" fill="none" stroke="{ink}" stroke-width="1.8" stroke-linecap="round"/>' },
  battle: { name: "Battle site", svg: '<path d="M-6.5 -6.5L6.5 6.5M6.5 -6.5L-6.5 6.5M-7 3.5L-3.5 7M7 3.5L3.5 7" stroke="{ink}" stroke-width="1.8" stroke-linecap="round"/>' },
  poi: { name: "Point of interest", svg: '<path d="M0 -8L2.35 -3.2L7.6 -2.5L3.8 1.2L4.7 6.5L0 4L-4.7 6.5L-3.8 1.2L-7.6 -2.5L-2.35 -3.2Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/>' },
  mountain: { name: "Mountain", svg: '<path d="M-9 7L-2 -7L2 0L4 -3L9 7Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-2 -7L-0.2 -1.5" stroke="{ink}" stroke-width="1.2"/>' },
  hill: { name: "Hill", svg: '<path d="M-8 5Q0 -9 8 5" fill="{fill}" stroke="{ink}" stroke-width="1.5"/>' },
  tree: { name: "Tree", svg: '<path d="M0 8V2" stroke="{ink}" stroke-width="1.6"/><circle cy="-2" r="5.5" fill="{fill}" stroke="{ink}" stroke-width="1.4"/>' },
  skull: { name: "Danger", svg: '<path d="M-6 -1A6 6 0 1 1 6 -1V3H3V6H-3V3H-6Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="-2.4" cy="-1" r="1.6" fill="{ink}"/><circle cx="2.4" cy="-1" r="1.6" fill="{ink}"/>' },
  door: { name: "Door / entrance", svg: '<rect x="-4.5" y="-7" width="9" height="14" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><circle cx="2" cy="0.5" r="1" fill="{ink}"/>' },
  "cave-mouth": { name: "Cave mouth (in a cliff, facing its angle)", svg: '<path d="M-3 -9.5V9.5" fill="none" stroke="{ink}" stroke-width="1.8" stroke-linecap="round"/><path d="M-3 -6A6 6 0 0 1 -3 6Z" fill="{ink}" stroke="{ink}" stroke-width="1" stroke-linejoin="round"/><path d="M-3 -3.4A3.4 3.4 0 0 1 -3 3.4Z" fill="{fill}"/>' },
  gate: { name: "Gate (a break in a wall line)", svg: '<path d="M-9.5 0H-5M5 0H9.5" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="butt"/><rect x="-6" y="-3.2" width="3" height="6.4" fill="{fill}" stroke="{ink}" stroke-width="1.2"/><rect x="3" y="-3.2" width="3" height="6.4" fill="{fill}" stroke="{ink}" stroke-width="1.2"/><path d="M-3 0H3" stroke="{ink}" stroke-width="1" stroke-dasharray="1.4 1.2"/>' },
  treasure: { name: "Treasure", svg: '<rect x="-7" y="-2" width="14" height="8" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-7 -2Q-7 -7 0 -7Q7 -7 7 -2M-1.5 -2V2H1.5V-2" fill="none" stroke="{ink}" stroke-width="1.4"/>' }
};
var DIRECTED = ["cave-mouth", "gate"];
var SYMBOL_KINDS = Object.keys(SYMBOLS);

// ../artgen-core/src/map/theme.ts
var THEMES = ["color", "bw"];
var PATTERNS = {
  lines: '<path d="M0 2.5H10M0 7.5H10" stroke="{ink}" stroke-width="0.7"/>',
  waves: '<path d="M0.5 3.5q1.25 -1.4 2.5 0t2.5 0M5.5 8.5q1.25 -1.4 2.5 0t2.5 0" fill="none" stroke="{ink}" stroke-width="0.6"/>',
  marsh: '<path d="M1 4H5M2 4V2.6M3.5 4V2.3M6 9H9.5M7 9V7.6M8.5 9V7.3" fill="none" stroke="{ink}" stroke-width="0.6"/>',
  sparse: '<circle cx="2.5" cy="3" r="0.55" fill="{ink}"/><circle cx="7.5" cy="8" r="0.55" fill="{ink}"/>',
  dots: '<circle cx="2" cy="2" r="0.6" fill="{ink}"/><circle cx="7" cy="2.5" r="0.6" fill="{ink}"/><circle cx="4.5" cy="7" r="0.6" fill="{ink}"/><circle cx="9.3" cy="7.8" r="0.6" fill="{ink}"/><circle cx="0.5" cy="8.8" r="0.6" fill="{ink}"/>',
  tufts: '<path d="M1.5 5.5l1 -2 1 2M6.5 10l1 -2 1 2" fill="none" stroke="{ink}" stroke-width="0.6" stroke-linejoin="round"/>',
  trees: '<circle cx="3" cy="3" r="1.7" fill="none" stroke="{ink}" stroke-width="0.6"/><circle cx="8" cy="8" r="1.7" fill="none" stroke="{ink}" stroke-width="0.6"/>',
  hatch: '<path d="M0 10L10 0M-2.5 2.5L2.5 -2.5M7.5 12.5L12.5 7.5" stroke="{ink}" stroke-width="0.6"/>',
  snow: '<path d="M3 2V4.4M1.8 3.2H4.2M8 7V9.4M6.8 8.2H9.2" stroke="{ink}" stroke-width="0.5"/>'
};
var THEME = {
  color: {
    name: "color",
    paper: "#f6f0e1",
    ink: "#2a241c",
    terrain: {
      deep: { fill: "#5d8db5" },
      water: { fill: "#9cc5df" },
      marsh: { fill: "#a9bb93", pattern: "marsh", ink: "#4f6a45" },
      sand: { fill: "#f0e2b6" },
      desert: { fill: "#e6cc8f", pattern: "sparse", ink: "#a8854a" },
      grass: { fill: "#cddca3" },
      scrub: { fill: "#c2bf82", pattern: "tufts", ink: "#77733c" },
      forest: { fill: "#86ad6f", pattern: "trees", ink: "#3f6534" },
      rock: { fill: "#b3a998", pattern: "hatch", ink: "#7d7263" },
      snow: { fill: "#f8f8f4" }
    },
    edge: "own",
    edgeWidth: 1,
    coast: "#3d6a8f",
    coastWidth: 1.3,
    contour: "#7f5f3f",
    contourOpacity: 0.65,
    riverBank: "#3d6a8f",
    riverBankWidth: 0.9,
    road: "#7a4f2a",
    grid: "#2b2b2b",
    gridOpacity: 0.3,
    label: { region: "#3b2a1a", place: "#1e1e1e", water: "#1f4f7a", note: "#3a3a3a" },
    halo: "#ffffff",
    symbolFill: "#fbf7ee"
  },
  bw: {
    name: "bw",
    paper: "#ffffff",
    ink: "#000000",
    terrain: {
      deep: { fill: "#ffffff", pattern: "lines", ink: "#000000" },
      water: { fill: "#ffffff", pattern: "waves", ink: "#000000" },
      marsh: { fill: "#ffffff", pattern: "marsh", ink: "#000000" },
      sand: { fill: "#ffffff", pattern: "sparse", ink: "#000000" },
      desert: { fill: "#ffffff", pattern: "dots", ink: "#000000" },
      grass: { fill: "#ffffff" },
      scrub: { fill: "#ffffff", pattern: "tufts", ink: "#000000" },
      forest: { fill: "#ffffff", pattern: "trees", ink: "#000000" },
      rock: { fill: "#ffffff", pattern: "hatch", ink: "#000000" },
      snow: { fill: "#ffffff", pattern: "snow", ink: "#000000" }
    },
    edge: "#000000",
    edgeWidth: 0.7,
    coast: "#000000",
    coastWidth: 1.6,
    contour: "#555555",
    contourOpacity: 0.8,
    riverBank: "#000000",
    riverBankWidth: 1.1,
    road: "#000000",
    grid: "#000000",
    gridOpacity: 0.3,
    label: { region: "#000000", place: "#000000", water: "#000000", note: "#000000" },
    halo: "#ffffff",
    symbolFill: "#ffffff"
  }
};

// ../artgen-core/src/lib/view.ts
var PX_PER_MM = 96 / 25.4;
var r3 = (v) => Math.round(v * 1e3) / 1e3;
function clampCrop(c, cols, rows2) {
  const x0 = Math.max(0, c[0]), y0 = Math.max(0, c[1]), x1 = Math.min(cols, c[0] + c[2]), y1 = Math.min(rows2, c[1] + c[3]);
  if (!(x1 > x0 && y1 > y0)) throw new Error(`crop ${c.join(",")} is outside the sheet (0,0,${cols},${rows2})`);
  return [r3(x0), r3(y0), r3(x1 - x0), r3(y1 - y0)];
}
function frameOf(crop, cols, rows2, k) {
  const [x, y, w, h] = crop ? clampCrop(crop, cols, rows2) : [0, 0, cols, rows2];
  return { x: x * k, y: y * k, w: w * k, h: h * k, r: (x + w) * k, b: (y + h) * k };
}
function parseCrop(v, perCell = 1) {
  const m = v.trim().match(/^(.*?)\s*(cells?)?$/i), xs = m[1].split(",").map((s) => s.trim());
  const n = xs.map(Number);
  if (xs.length !== 4 || xs.some((s, i) => s === "" || !Number.isFinite(n[i]))) throw new Error('--crop: x,y,w,h in map units (add "cells" to give grid cells), e.g. 0,60,16,46');
  if (n[2] <= 0 || n[3] <= 0) throw new Error("--crop: w and h must be above 0");
  const f = m[2] ? perCell : 1;
  return [n[0] * f, n[1] * f, n[2] * f, n[3] * f];
}
function parseFit(v) {
  const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(mm|px)?$/i);
  if (!m || +m[1] <= 0 || +m[2] <= 0) throw new Error("--fit: WxH with an optional unit, e.g. 180x260mm or 800x600px");
  return { w: +m[1], h: +m[2], unit: m[3]?.toLowerCase() ?? "px" };
}
function fitPpu(w, h, fit) {
  const f = fit.unit === "mm" ? PX_PER_MM : 1;
  return Math.min(fit.w * f / w, fit.h * f / h);
}
function sizeAttrs(f, unit = "px") {
  const s = unit === "mm" ? (v) => `${Math.round(v / PX_PER_MM * 100) / 100}mm` : (v) => String(r3(v));
  return `width="${s(f.w)}" height="${s(f.h)}" viewBox="${r3(f.x)} ${r3(f.y)} ${r3(f.w)} ${r3(f.h)}"`;
}

// ../artgen-core/src/lib/page.ts
var PAGE_PT = {
  map: { region: 12, place: 9, water: 8, note: 7 },
  dungeon: { name: 9, note: 7, area: 12, room: 8, number: 8 }
};
var PAGE_SYMBOL_MM = 5;
var pageUnit = (pageScale) => pageScale / PX_PER_MM;
var pointsToPx = (pt2, pageScale) => pt2 * 4 / 3 * pageUnit(pageScale);
var overlaps = (a, b, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
function textBox(text, cx, baseline, size, o = {}) {
  const w = text.length * (size * (o.bold ? 0.62 : 0.56) + (o.spacing ?? 0)), h = size * 1.15;
  return { x: cx - w / 2, y: baseline - size * 0.82, w, h };
}
function placeLabels(labels, obstacles, bounds, gap = 0) {
  const taken = obstacles.slice(), out = [];
  const inside = (b) => !bounds || b.x >= bounds.x - 1e-6 && b.y >= bounds.y - 1e-6 && b.x + b.w <= bounds.x + bounds.w + 1e-6 && b.y + b.h <= bounds.y + bounds.h + 1e-6;
  const free = (b) => inside(b) && !taken.some((t) => overlaps(b, t, gap));
  for (const l of labels) {
    const at3 = (dx, dy) => ({ ...l.box, x: l.box.x + dx, y: l.box.y + dy });
    if (free(l.box)) {
      taken.push(l.box);
      out.push({ x: l.x, y: l.y, moved: false, placed: true });
      continue;
    }
    const rx = l.clear + l.box.w / 2 + gap, ry = l.clear + l.box.h / 2 + gap;
    let found = null;
    for (const f of [1, 1.6, 2.4]) {
      const sides = [[rx * f, 0], [-rx * f, 0], [0, -ry * f], [0, ry * f], [rx * f, -ry * f], [rx * f, ry * f], [-rx * f, -ry * f], [-rx * f, ry * f]];
      found = sides.find(([dx, dy]) => free(at3(dx, dy))) ?? null;
      if (found) break;
    }
    if (found) {
      taken.push(at3(found[0], found[1]));
      out.push({ x: l.x + found[0], y: l.y + found[1], moved: true, placed: true });
    } else {
      taken.push(l.box);
      out.push({ x: l.x, y: l.y, moved: false, placed: false });
    }
  }
  return out;
}

// ../artgen-core/src/lib/svgdraw.ts
var esc = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var n1 = (v) => (Math.round(v * 10) / 10).toString();
var FONT_FAMILY = "Alegreya Sans";
var FONT = `'${FONT_FAMILY}', 'Segoe UI', Helvetica, Arial, sans-serif`;
function haloText(text, x, y, size, color, th, attrs = "") {
  const a = `x="${n1(x)}" y="${n1(y)}" font-size="${n1(size)}" text-anchor="middle" ${attrs}`;
  return `<text ${a} fill="none" stroke="${th.halo}" stroke-width="${n1(size * 0.22)}" stroke-linejoin="round" stroke-opacity="0.9">${esc(text)}</text><text ${a} fill="${color}">${esc(text)}</text>`;
}
function compassSvg(cx, cy, r, u, th) {
  return `<g id="compass" stroke="${th.ink}" stroke-width="${n1(u)}" stroke-linejoin="round"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${th.paper}" fill-opacity="0.85"/><path d="M${n1(cx)} ${n1(cy - r * 0.9)}L${n1(cx + r * 0.3)} ${n1(cy)}L${n1(cx)} ${n1(cy + r * 0.9)}L${n1(cx - r * 0.3)} ${n1(cy)}Z" fill="${th.paper}"/><path d="M${n1(cx)} ${n1(cy - r * 0.9)}L${n1(cx + r * 0.3)} ${n1(cy)}L${n1(cx - r * 0.3)} ${n1(cy)}Z" fill="${th.ink}"/><text x="${n1(cx)}" y="${n1(cy - r - 4 * u)}" font-size="${n1(13 * u)}" font-weight="700" text-anchor="middle" fill="${th.ink}" stroke="none">N</text></g>`;
}

// ../artgen-core/src/map/render.ts
var MAP_LAYERS = ["terrain", "rivers", "roads", "contours", "grid", "symbols", "labels", "legend", "scale", "compass", "title"];
var LEGEND_SYMBOLS = ["cave-mouth", "gate"];
function mapLabelLayout(spec, k, pageScale) {
  const raw = spec.overlay.labels.map((l) => ({ x: l.x * k, y: l.y * k }));
  if (!pageScale) return { at: raw, unplaced: [] };
  const symBox = (s) => {
    const z = PAGE_SYMBOL_MM * pageScale * (s.scale ?? 1);
    return { x: s.x * k - z / 2, y: s.y * k - z / 2, w: z, h: z };
  };
  const items = spec.overlay.labels.map((l) => {
    const size = labelSize(l, 1, pageScale), base = size * 1;
    const box2 = textBox(l.kind === "region" ? l.text.toUpperCase() : l.text, l.x * k, l.y * k + base * 0.35, size, { bold: l.kind === "region" || l.kind === "place", spacing: l.kind === "region" ? size * 0.18 : 0 });
    return { x: l.x * k, y: l.y * k, box: box2, clear: 0 };
  });
  const placed = placeLabels(items, spec.overlay.symbols.map(symBox), { x: 0, y: 0, w: spec.cols * k, h: spec.rows * k }, pageScale * 0.3);
  return { at: placed.map((p) => ({ x: p.x, y: p.y })), unplaced: placed.flatMap((p, index) => p.placed ? [] : [{ index, text: spec.overlay.labels[index].text }]) };
}
function labelSize(l, u, pageScale) {
  return (pageScale ? pointsToPx(PAGE_PT.map[l.kind], pageScale) : { region: 30, place: 16, water: 20, note: 13 }[l.kind] * u) * (l.size ?? 1);
}
var fieldKey = (s) => JSON.stringify([s.preset, s.cols, s.rows, s.seed, s.gen, s.edits]);
function layersFor(spec, over = {}) {
  const on = Object.fromEntries(MAP_LAYERS.map((l) => [l, true]));
  on.grid = spec.grid.type !== "none";
  on.legend = spec.legend;
  on.scale = spec.scaleBar;
  on.compass = spec.compass;
  on.title = !!spec.title;
  return { ...on, ...over };
}
function toUnits(lines, res, pad, passes) {
  return lines.map((l) => simplifyLine(chaikin({ pts: l.pts.map((v) => (v + 0.5 - pad) / res), closed: l.closed }, passes), 0.04));
}
function terrainRegions(f) {
  const pw = f.w + 4, ph = f.h + 4, out = /* @__PURE__ */ new Map();
  for (const t of terrainsUsed(f)) {
    const k = TERRAINS.indexOf(t), m = new Float32Array(pw * ph);
    for (let j = 1; j < ph - 1; j++) for (let i = 1; i < pw - 1; i++) {
      const sx = Math.min(f.w - 1, Math.max(0, i - 2)), sy = Math.min(f.h - 1, Math.max(0, j - 2));
      m[j * pw + i] = f.terrain[sy * f.w + sx] === k ? 1 : 0;
    }
    const sm = new Float32Array(m.length);
    for (let j = 1; j < ph - 1; j++) for (let i = 1; i < pw - 1; i++) {
      let s = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += m[(j + dj) * pw + i + di] * (di && dj ? 1 : di || dj ? 2 : 4);
      sm[j * pw + i] = s / 16;
    }
    out.set(t, toUnits(isolines(sm, pw, ph, 0.5), f.res, 2, 1).filter((l) => l.closed && l.pts.length >= 6));
  }
  return out;
}
function contourLines(spec, f) {
  const step = spec.topo.interval / spec.topo.maxElevation, e = Float32Array.from(f.elevation), w = f.w, h = f.h;
  const passes = 1 + Math.round(spec.gen.simplify / 2);
  for (let p = 0; p < passes; p++) {
    const src = Float32Array.from(e);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj;
        if (x >= 0 && y >= 0 && x < w && y < h) {
          s += src[y * w + x];
          n++;
        }
      }
      e[j * w + i] = s / n;
    }
  }
  const out = [], minLen = spec.preset === "local" ? 2 : 1.5;
  for (let k = 1; k * step < 1 - 1e-9; k++) {
    const lines = toUnits(isolines(e, w, h, k * step), f.res, 0, 2).filter((l) => lineLength(l.closed ? [...l.pts, l.pts[0], l.pts[1]] : l.pts) >= minLen);
    if (lines.length) out.push({ level: k, lines });
  }
  return out;
}
function patternDefs(th, tile) {
  return TERRAINS.map((t) => {
    const st = th.terrain[t];
    if (!st.pattern) return "";
    return `<pattern id="pat-${t}" patternUnits="userSpaceOnUse" width="${n1(tile)}" height="${n1(tile)}"><g transform="scale(${n1(tile / 10)})">${PATTERNS[st.pattern].replaceAll("{ink}", st.ink ?? th.ink)}</g></pattern>`;
  }).join("");
}
function symbolSvg(kind, x, y, size, th, angle = 0) {
  const s = SYMBOLS[kind] ?? SYMBOLS.poi;
  return `<g transform="translate(${n1(x)} ${n1(y)})${angle ? ` rotate(${n1(angle)})` : ""} scale(${(size / 20).toFixed(3)})">${s.svg.replaceAll("{ink}", th.ink).replaceAll("{fill}", th.symbolFill)}</g>`;
}
function scaleCells(width) {
  const target = width / 5;
  for (const n of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50]) if (n >= target * 0.75) return n;
  return Math.max(1, Math.round(target));
}
function renderMapSvg(spec, o = {}) {
  const th = THEME[o.theme ?? "color"], k = o.ppu ?? 40, W = spec.cols * k, H = spec.rows * k, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, fr = frameOf(o.crop, spec.cols, spec.rows, k);
  const f = o.field ?? generateMap(spec), on = layersFor(spec, o.layers), tile = Math.max(9, Math.min(24, k * 0.4)) * (th.name === "bw" ? 1.4 : 1);
  const parts = [];
  const used = terrainsUsed(f);
  const regions = on.terrain || on.rivers && f.rivers.length ? terrainRegions(f) : /* @__PURE__ */ new Map();
  if (on.terrain) {
    const base = used.find((t) => t !== "deep" && t !== "water") ?? used[0];
    const order = [...used.filter((t) => t !== "deep" && t !== "water"), ...used.filter((t) => t === "water" || t === "deep").reverse()];
    let g = `<rect width="${W}" height="${H}" fill="${th.terrain[base].fill}"/>`;
    for (const t of order) {
      const d = pathData(regions.get(t) ?? [], k), st = th.terrain[t], water = t === "water" || t === "deep";
      if (!d) continue;
      const edge = water ? th.coast : th.edge === "own" ? st.fill : th.edge, ew = water ? th.coastWidth : th.edgeWidth;
      g += `<path d="${d}" fill="${st.fill}" fill-rule="evenodd" stroke="${edge}" stroke-width="${n1(ew * u)}" stroke-linejoin="round"/>`;
      if (st.pattern) g += `<path d="${d}" fill="url(#pat-${t})" fill-rule="evenodd"/>`;
    }
    parts.push(`<g id="terrain">${g}</g>`);
  } else parts.push(`<rect width="${W}" height="${H}" fill="${th.paper}"/>`);
  const lineGroup = (id, lines, draw) => lines.length ? `<g id="${id}" fill="none" stroke-linecap="round" stroke-linejoin="round">${lines.map((l) => draw(pathData([{ pts: l.pts, closed: false }], k), Math.max(1.2 * u, l.width * k))).join("")}</g>` : "";
  const defs = [];
  const riverD = on.rivers && f.rivers.length ? pathData(f.rivers.map((r) => ({ pts: r.outline, closed: true })), k) : "";
  if (riverD) {
    const d = riverD, water = pathData([...regions.get("water") ?? [], ...regions.get("deep") ?? []], k);
    defs.push(`<mask id="river-land" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${water ? `<path d="${water}" fill="#000" fill-rule="evenodd"/>` : ""}</mask>`);
    parts.push(`<g id="rivers" stroke-linejoin="round"><g mask="url(#river-land)"><path d="${d}" fill="${th.riverBank}" stroke="${th.riverBank}" stroke-width="${n1(th.riverBankWidth * 2 * u)}"/></g><path d="${d}" fill="${th.terrain.water.fill}"/></g>`);
  }
  if (on.roads) parts.push(lineGroup("roads", f.roads, (d, w) => `<path d="${d}" stroke="${th.road}" stroke-width="${n1(w)}" stroke-dasharray="${n1(w * 3)} ${n1(w * 2)}"/>`));
  if (on.contours) {
    const major = spec.topo.majorEvery;
    let g = "";
    for (const { level, lines } of contourLines(spec, f)) {
      const isMajor = level % major === 0, d = pathData(lines, k);
      g += `<path d="${d}" stroke-width="${n1((isMajor ? 1.5 : 0.75) * u)}"/>`;
      if (isMajor && spec.topo.labels) {
        const best = lines.reduce((a, b) => b.pts.length > a.pts.length ? b : a);
        const mid = best.pts.length >> 2 << 1, x = best.pts[mid] * k, y = best.pts[mid + 1] * k;
        g += `<g stroke="none">${haloText(`${level * spec.topo.interval} ${spec.topo.unit}`, x, y + 4 * u, 10 * u, th.contour, th)}</g>`;
      }
    }
    if (riverD) defs.push(`<mask id="no-river" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${riverD}" fill="#000" stroke="#000" stroke-width="${n1(th.riverBankWidth * 2 * u)}" stroke-linejoin="round"/></mask>`);
    parts.push(`<g id="contours"${riverD ? ' mask="url(#no-river)"' : ""} fill="none" stroke="${th.contour}" stroke-opacity="${th.contourOpacity}" stroke-linejoin="round" stroke-linecap="round">${g}</g>`);
  }
  if (on.grid && spec.grid.type !== "none") {
    const gg = gridGeometry(spec, k);
    let g = `<path d="${gg.d}" fill="none" stroke="${th.grid}" stroke-opacity="${th.gridOpacity}" stroke-width="${n1(u)}"/>`;
    if (spec.grid.coords) {
      const fs = Math.max(6, 7 * u * spec.grid.size), dy = (spec.grid.type === "hex" ? -0.33 : -0.34) * spec.grid.size * k;
      g += `<g fill="${th.grid}" fill-opacity="${Math.min(1, th.gridOpacity + 0.2)}" font-size="${n1(fs)}" text-anchor="middle">${gg.cells.map((c) => `<text x="${n1(c.x * k)}" y="${n1(c.y * k + dy + fs * 0.35)}">${c.name}</text>`).join("")}</g>`;
    }
    parts.push(`<g id="grid">${g}</g>`);
  }
  if (on.symbols && spec.overlay.symbols.length)
    parts.push(`<g id="symbols">${spec.overlay.symbols.map((s) => symbolSvg(s.kind, s.x * k, s.y * k, (o.pageScale ? PAGE_SYMBOL_MM * o.pageScale : 22 * u) * (s.scale ?? 1), th, s.angle)).join("")}</g>`);
  if (on.labels && spec.overlay.labels.length) {
    const at3 = mapLabelLayout(spec, k, o.pageScale).at;
    const g = spec.overlay.labels.map((l, i) => {
      const base = labelSize(l, u, o.pageScale), lx = at3[i].x / k, ly = at3[i].y / k;
      const attrs = l.kind === "region" ? `font-weight="700" letter-spacing="${n1(base * 0.18)}"` : l.kind === "water" ? 'font-style="italic"' : l.kind === "place" ? 'font-weight="700"' : "";
      const text = l.kind === "region" ? l.text.toUpperCase() : l.text;
      const t = haloText(text, lx * k, ly * k + base * 0.35, base, th.label[l.kind], th, attrs);
      return l.angle ? `<g transform="rotate(${n1(l.angle)} ${n1(lx * k)} ${n1(ly * k)})">${t}</g>` : t;
    }).join("");
    parts.push(`<g id="labels">${g}</g>`);
  }
  const box2 = (x, y, w, h) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${th.paper}" fill-opacity="0.92" stroke="${th.ink}" stroke-width="${n1(u)}"/>`;
  const pad = 12 * u;
  if (on.legend) {
    const rows2 = used.map((t) => [t, TERRAIN_NAMES[t]]);
    if (f.rivers.length) rows2.push(["river", "River"]);
    if (f.roads.length) rows2.push(["road", "Road"]);
    for (const kind of LEGEND_SYMBOLS) if (on.symbols && spec.overlay.symbols.some((s) => s.kind === kind)) rows2.push([`symbol:${kind}`, SYMBOLS[kind].name.split(" (")[0]]);
    const rh = 18 * u, fs = 12 * u, bw = 150 * u, bh = rows2.length * rh + 12 * u, x = fr.r - bw - pad, y = fr.b - bh - pad;
    let g = box2(x, y, bw, bh);
    rows2.forEach(([t, name], i) => {
      const sx = x + 8 * u, sy = y + 6 * u + i * rh + 2 * u, sw = 24 * u, sh = rh - 5 * u;
      if (t === "river") g += `<path d="M${n1(sx)} ${n1(sy + sh / 2)}h${n1(sw)}" stroke="${th.riverBank}" stroke-width="${n1(5 * u)}"/><path d="M${n1(sx + th.riverBankWidth * u)} ${n1(sy + sh / 2)}h${n1(sw - 2 * th.riverBankWidth * u)}" stroke="${th.terrain.water.fill}" stroke-width="${n1(5 * u - 2 * th.riverBankWidth * u)}"/>`;
      else if (t.startsWith("symbol:")) g += symbolSvg(t.slice(7), sx + sw / 2, sy + sh / 2, 15 * u, th);
      else if (t === "road") g += `<path d="M${n1(sx)} ${n1(sy + sh / 2)}h${n1(sw)}" stroke="${th.road}" stroke-width="${n1(2 * u)}" stroke-dasharray="${n1(5 * u)} ${n1(3 * u)}"/>`;
      else {
        const st = th.terrain[t];
        g += `<rect x="${n1(sx)}" y="${n1(sy)}" width="${n1(sw)}" height="${n1(sh)}" fill="${st.fill}" stroke="${th.ink}" stroke-width="${n1(0.6 * u)}"/>`;
        if (st.pattern) g += `<rect x="${n1(sx)}" y="${n1(sy)}" width="${n1(sw)}" height="${n1(sh)}" fill="url(#pat-${t})"/>`;
      }
      g += `<text x="${n1(sx + sw + 7 * u)}" y="${n1(sy + sh / 2 + fs * 0.35)}" font-size="${n1(fs)}" fill="${th.ink}">${esc(name)}</text>`;
    });
    parts.push(`<g id="legend">${g}</g>`);
  }
  if (on.scale) {
    const n = scaleCells(fr.w / k), len = n * k, fs = 11 * u, x = fr.x + pad + 8 * u, y = fr.b - pad - 20 * u, seg = 4;
    let g = box2(fr.x + pad, y - 18 * u, len + 34 * u, 40 * u);
    for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + len / seg * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? th.paper : th.ink}" stroke="${th.ink}" stroke-width="${n1(0.8 * u)}"/>`;
    g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${th.ink}" text-anchor="middle">0</text>`;
    g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${th.ink}" text-anchor="middle">${n * spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${th.ink}" text-anchor="middle">1 ${spec.grid.type === "hex" ? "hex" : "square"} = ${spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    parts.push(`<g id="scale">${g}</g>`);
  }
  if (on.compass) parts.push(compassSvg(fr.r - pad - 18 * u - 4 * u, fr.y + pad + 18 * u + 14 * u, 18 * u, u, th));
  if (on.title && spec.title) {
    const fs = 26 * u, w = Math.max(120 * u, spec.title.length * fs * 0.62 + 30 * u);
    parts.push(`<g id="title">${box2(fr.x + pad, fr.y + pad, w, fs * 1.7)}<text x="${n1(fr.x + pad + w / 2)}" y="${n1(fr.y + pad + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.06)}" text-anchor="middle" fill="${th.ink}">${esc(spec.title)}</text></g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(fr, o.unit)} font-family="${FONT}"><defs>${patternDefs(th, tile)}${defs.join("")}<clipPath id="map-clip"><rect x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}"/></clipPath></defs><g clip-path="url(#map-clip)">${parts.join("")}</g></svg>`;
}

// ../artgen-core/src/lib/round.ts
function roundTo(v, step) {
  const out = Math.round(v / step) * step;
  return +(out === 0 ? 0 : out).toFixed(6);
}
function percentShares(counts) {
  const total = counts.reduce((s, [, c]) => s + c, 0);
  if (!total) return [];
  const raw = counts.map(([k, c]) => ({ k, share: Math.floor(c / total * 100), rem: c / total * 100 % 1 }));
  let left = 100 - raw.reduce((s, r) => s + r.share, 0);
  for (const r of [...raw].sort((a, b) => b.rem - a.rem || raw.indexOf(a) - raw.indexOf(b))) {
    if (left <= 0) break;
    r.share++;
    left--;
  }
  return raw.filter((r) => r.share > 0).map((r) => [r.k, r.share]);
}

// ../artgen-core/src/map/facts.ts
var RULES = {
  /** Heights (and heights above a reference) are whole multiples of `topo.interval`. */
  height: "topo.interval",
  /** Positions, lengths and distances in map units; a scale-unit value is the rounded map value times `scale.perCell`, to this step. */
  position: 0.1,
  /** Terrain shares are whole percent, summing to 100 (largest remainder). */
  share: 1,
  /** Slope is the height change across a window this wide (map units), centred on the point. */
  slopeWindow: 1,
  /** A slope is `flat` below the first threshold, `gentle` below the second, `steep` below the third and `cliff` from there (rise over run, both in one unit). */
  slopeBands: { flat: 0.05, gentle: 0.2, steep: 0.6 },
  /** A polyline is thinned to within this distance (map units) of the line it came from before it is listed. */
  lineTolerance: 0.25,
  /** A hilltop or hollow must stand this many `topo.interval`s clear of the saddle that joins it to higher (or lower) ground. */
  prominence: 2,
  /** `--above lowest` looks this far (map units) when `--radius` is not given. */
  radius: 5
};
var LENGTH_IN_FEET = {
  in: 1 / 12,
  inch: 1 / 12,
  ft: 1,
  foot: 1,
  feet: 1,
  yd: 3,
  yard: 3,
  mi: 5280,
  mile: 5280,
  m: 3.280839895,
  metre: 3.280839895,
  meter: 3.280839895,
  km: 3280.839895,
  kilometre: 3280.839895,
  kilometer: 3280.839895
};
function feetIn(unit) {
  const u = unit.trim().toLowerCase().replace(/\.$/, "").replace(/s$/, "");
  return LENGTH_IN_FEET[u] ?? LENGTH_IN_FEET[`${u}s`] ?? null;
}
function ground(spec, f) {
  const { res, w, h } = f, top = spec.topo.maxElevation, step = spec.topo.interval, per = spec.scale.perCell;
  const rnd = (v) => roundTo(v, RULES.position);
  const length = (map) => {
    const m = rnd(map);
    return { map: m, scale: rnd(m * per) };
  };
  const pt2 = (x, y) => [rnd(x), rnd(y)];
  const shown4 = (height2) => roundTo(height2, step);
  const sample = (i, j) => f.elevation[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))];
  const height = (x, y) => {
    const u = x * res - 0.5, v = y * res - 0.5, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    return top * ((sample(i, j) * (1 - fx) + sample(i + 1, j) * fx) * (1 - fy) + (sample(i, j + 1) * (1 - fx) + sample(i + 1, j + 1) * fx) * fy);
  };
  const terrainAt = (x, y) => TERRAINS[f.terrain[Math.min(h - 1, Math.floor(y * res)) * w + Math.min(w - 1, Math.floor(x * res))]];
  const centre = (n) => {
    const i = n % w;
    return [(i + 0.5) / res, ((n - i) / w + 0.5) / res];
  };
  const slope = (x, y) => {
    const d = RULES.slopeWindow / 2, x0 = Math.max(0, x - d), x1 = Math.min(spec.cols, x + d), y0 = Math.max(0, y - d), y1 = Math.min(spec.rows, y + d);
    const gx = (height(x1, y) - height(x0, y)) / (x1 - x0), gy = (height(x, y1) - height(x, y0)) / (y1 - y0);
    const perUnit = Math.hypot(gx, gy), gradient = roundTo(perUnit / per, 1e-3);
    const rise = feetIn(spec.topo.unit), run = feetIn(spec.scale.unit);
    if (rise === null || run === null) return { gradient, band: null };
    const ratio = perUnit * rise / (per * run), b = RULES.slopeBands;
    return { gradient, band: ratio < b.flat ? "flat" : ratio < b.gentle ? "gentle" : ratio < b.steep ? "steep" : "cliff" };
  };
  const lines = [
    ...f.rivers.map((r, i) => ({ kind: "river", name: `river-${i + 1}`, pts: r.pts, widths: r.widths, source: r.source, mouth: r.mouth })),
    ...f.roads.map((r, i) => ({ kind: "road", name: `road-${i + 1}`, pts: r.pts, widths: void 0, source: void 0, mouth: void 0 }))
  ];
  const nearest = (kind, x, y) => {
    let best = null;
    for (const line2 of lines) {
      if (line2.kind !== kind) continue;
      const p = line2.pts;
      for (let i = 2; i < p.length; i += 2) {
        const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
        const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { line: line2, d, at: [px, py], width: line2.widths ? line2.widths[i / 2 - 1] * (1 - t) + line2.widths[i / 2] * t : 0 };
      }
    }
    return best;
  };
  const near3 = (kind, x, y) => {
    const n = nearest(kind, x, y);
    if (!n) return null;
    return { name: n.line.name, ...n.line.source && { source: n.line.source }, distance: length(n.d), at: pt2(...n.at), ...kind === "river" && { within: n.d <= n.width / 2 }, rawAt: n.at };
  };
  return { res, w, h, rnd, length, pt: pt2, shown: shown4, height, terrainAt, centre, slope, lines, near: near3 };
}
function shares(f, ids) {
  const count = new Array(TERRAINS.length).fill(0);
  if (ids) for (const n of ids) count[f.terrain[n]]++;
  else for (const t of f.terrain) count[t]++;
  const out = percentShares(TERRAINS.map((t, i) => [t, count[i]]).filter(([, c]) => c > 0));
  return out.map(([terrain, share2]) => ({ terrain, share: share2 })).sort((a, b) => b.share - a.share || TERRAINS.indexOf(a.terrain) - TERRAINS.indexOf(b.terrain));
}
function samplesIn(f, poly) {
  const out = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    x0 = Math.min(x0, poly[i]);
    x1 = Math.max(x1, poly[i]);
    y0 = Math.min(y0, poly[i + 1]);
    y1 = Math.max(y1, poly[i + 1]);
  }
  for (let j = Math.max(0, Math.floor(y0 * f.res)); j <= Math.min(f.h - 1, Math.ceil(y1 * f.res)); j++)
    for (let i = Math.max(0, Math.floor(x0 * f.res)); i <= Math.min(f.w - 1, Math.ceil(x1 * f.res)); i++)
      if (coverage({ poly }, (i + 0.5) / f.res, (j + 0.5) / f.res)) out.push(j * f.w + i);
  return out;
}
function samplesOf(f, s) {
  const out = [];
  eachCovered(f, s, false, (i) => out.push(i));
  return out.sort((a, b) => a - b);
}
function extremes(g, f, spec, ids) {
  let lo = -1, hi = -1;
  const n = ids ? ids.length : f.elevation.length;
  for (let k = 0; k < n; k++) {
    const s = ids ? ids[k] : k;
    if (lo < 0 || f.elevation[s] < f.elevation[lo]) lo = s;
    if (hi < 0 || f.elevation[s] > f.elevation[hi]) hi = s;
  }
  const at3 = (s) => ({ height: g.shown(f.elevation[s] * spec.topo.maxElevation), at: g.pt(...g.centre(s)) });
  return { lowest: at3(lo), highest: at3(hi) };
}
function crossings(pts2, poly) {
  const inside = (x, y) => coverage({ poly }, x, y) > 0;
  const runs = [];
  let cur = null;
  for (let i = 2; i < pts2.length; i += 2) {
    const ax = pts2[i - 2], ay = pts2[i - 1], dx = pts2[i] - ax, dy = pts2[i + 1] - ay, len = Math.hypot(dx, dy);
    if (!len) continue;
    const ts = [0, 1];
    for (let a = poly.length - 2, b = 0; b < poly.length; a = b, b += 2) {
      const ex = poly[b] - poly[a], ey = poly[b + 1] - poly[a + 1], den = dx * ey - dy * ex;
      if (!den) continue;
      const t = ((poly[a] - ax) * ey - (poly[a + 1] - ay) * ex) / den, u = ((poly[a] - ax) * dy - (poly[a + 1] - ay) * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort((p, q) => p - q);
    for (let k = 1; k < ts.length; k++) {
      const t0 = ts[k - 1], t1 = ts[k];
      if (t1 - t0 < 1e-9) continue;
      const mid = (t0 + t1) / 2, here = inside(ax + dx * mid, ay + dy * mid);
      if (here && !cur) {
        cur = { enters: i === 2 && t0 === 0 ? null : [ax + dx * t0, ay + dy * t0], leaves: null, length: 0 };
        runs.push(cur);
      }
      if (here && cur) cur.length += len * (t1 - t0);
      if (!here && cur) {
        cur.leaves = [ax + dx * t0, ay + dy * t0];
        cur = null;
      }
    }
  }
  return runs;
}
function prominences(v, cols) {
  const N = v.length, order = Array.from({ length: N }, (_, i) => i).sort((a, b) => v[b] - v[a] || a - b);
  const parent = new Int32Array(N).fill(-1), peak = new Int32Array(N), out = [];
  const find = (n) => {
    while (parent[n] !== n) {
      parent[n] = parent[parent[n]];
      n = parent[n];
    }
    return n;
  };
  for (const n of order) {
    parent[n] = n;
    peak[n] = n;
    const i = n % cols, j = (n - i) / cols;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj, m = y * cols + x;
      if (!di && !dj || x < 0 || x >= cols || y < 0 || m < 0 || m >= N || parent[m] < 0) continue;
      const a = find(n), b = find(m);
      if (a === b) continue;
      const keep = v[peak[a]] > v[peak[b]] || v[peak[a]] === v[peak[b]] && peak[a] < peak[b] ? a : b, lose = keep === a ? b : a;
      out.push({ n: peak[lose], prominence: v[peak[lose]] - v[n] });
      parent[lose] = keep;
    }
  }
  let lowest = 0;
  for (let n = 1; n < N; n++) if (v[n] < v[lowest]) lowest = n;
  out.push({ n: peak[find(order[0])], prominence: v[order[0]] - v[lowest] });
  return out;
}
function summits(g, f, spec) {
  const { cols, rows: rows2 } = spec, N = cols * rows2, r = g.res, step = spec.topo.interval, need = RULES.prominence * step;
  const cell = new Float64Array(N), flip = new Float64Array(N);
  for (let cj = 0; cj < rows2; cj++) for (let ci = 0; ci < cols; ci++) {
    let s = 0;
    for (let j = cj * r; j < (cj + 1) * r; j++) for (let i = ci * r; i < (ci + 1) * r; i++) s += f.elevation[j * f.w + i];
    cell[cj * cols + ci] = s / (r * r) * spec.topo.maxElevation;
    flip[cj * cols + ci] = -cell[cj * cols + ci];
  }
  const out = (list3, dry, order) => list3.filter((c) => c.prominence >= need - 1e-9 && (!dry || g.shown(cell[c.n]) > 0)).sort((a, b) => order(cell[a.n], cell[b.n]) || b.prominence - a.prominence || a.n - b.n).map((c) => ({ height: g.shown(cell[c.n]), at: g.pt(c.n % cols + 0.5, Math.floor(c.n / cols) + 0.5), prominence: roundTo(c.prominence, step) }));
  return { hilltops: out(prominences(cell, cols), false, (a, b) => b - a), hollows: out(prominences(flip, cols), true, (a, b) => a - b) };
}
var listed = (g, pts2) => {
  const t = simplifyLine({ pts: pts2, closed: false }, RULES.lineTolerance).pts, out = [];
  for (let i = 0; i < t.length; i += 2) out.push(g.pt(t[i], t[i + 1]));
  return out;
};
var pathLength = (p) => {
  let s = 0;
  for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
  return s;
};
function areaOutline(v) {
  if (v.length === 4) return [v[0], v[1], v[2], v[1], v[2], v[3], v[0], v[3]];
  if (v.length >= 6 && v.length % 2 === 0) return v;
  throw new Error("--area: x0,y0,x1,y1 (a rectangle) or three or more x,y pairs");
}
function mapFacts(spec, q = {}, field = generateMap(spec)) {
  const g = ground(spec, field), out = {
    version: spec.version,
    id: spec.id,
    size: { cols: spec.cols, rows: spec.rows },
    unit: { map: "cell", scale: spec.scale.unit, height: spec.topo.unit },
    rules: RULES
  };
  if (q.above && q.above !== "river" && q.above !== "lowest") throw new Error("--above: river or lowest");
  const radius = q.radius ?? RULES.radius;
  if (!(radius > 0)) throw new Error("--radius: a number above 0 (map units)");
  if (q.at?.length) {
    out.points = q.at.map(([x, y]) => {
      if (!(x >= 0 && x <= spec.cols && y >= 0 && y <= spec.rows)) throw new Error(`at ${x},${y}: outside the map (0..${spec.cols} by 0..${spec.rows})`);
      const height = g.shown(g.height(x, y)), river = g.near("river", x, y), road = g.near("road", x, y);
      const strip = (n) => {
        if (!n) return null;
        const { rawAt: _, ...rest } = n;
        return rest;
      };
      const p = { at: g.pt(x, y), terrain: g.terrainAt(x, y), height, slope: g.slope(x, y), river: strip(river), road: strip(road) };
      if (q.above === "river") {
        const ref = river && g.shown(g.height(...river.rawAt));
        p.above = { of: "river", value: ref === null ? null : roundTo(height - ref, spec.topo.interval), reference: river && ref !== null ? { height: ref, at: river.at } : null };
      } else if (q.above === "lowest") {
        let low = null, lowAt = [x, y];
        for (let j = Math.max(0, Math.floor((y - radius) * field.res)); j <= Math.min(field.h - 1, Math.ceil((y + radius) * field.res)); j++)
          for (let i = Math.max(0, Math.floor((x - radius) * field.res)); i <= Math.min(field.w - 1, Math.ceil((x + radius) * field.res)); i++) {
            const [cx, cy] = [(i + 0.5) / field.res, (j + 0.5) / field.res];
            if (Math.hypot(cx - x, cy - y) <= radius && (low === null || field.elevation[j * field.w + i] < low)) {
              low = field.elevation[j * field.w + i];
              lowAt = [cx, cy];
            }
          }
        const ref = g.shown((low ?? 0) * spec.topo.maxElevation);
        p.above = { of: "lowest", value: roundTo(height - ref, spec.topo.interval), reference: { height: ref, at: g.pt(...lowAt) } };
      }
      return p;
    });
  }
  if (q.areas?.length) {
    out.areas = q.areas.map((poly) => {
      const ids = samplesIn(field, poly);
      if (!ids.length) throw new Error(`area ${poly.join(",")}: holds no ground (inside the map and larger than a sample, ${(1 / field.res).toFixed(2)} cells)`);
      const cross2 = (kind) => g.lines.filter((l) => l.kind === kind).flatMap((l) => crossings(l.pts, poly).map((c) => ({
        name: l.name,
        ...l.source && { source: l.source },
        enters: c.enters && g.pt(...c.enters),
        leaves: c.leaves && g.pt(...c.leaves),
        length: g.length(c.length)
      })));
      const pairs2 = [];
      for (let i = 0; i < poly.length; i += 2) pairs2.push(g.pt(poly[i], poly[i + 1]));
      return { area: pairs2, terrain: shares(field, ids), ...extremes(g, field, spec, ids), rivers: cross2("river"), roads: cross2("road") };
    });
  }
  if (!out.points && !out.areas) {
    const line2 = (l) => ({ name: l.name, ...l.source && { source: l.source }, points: listed(g, l.pts), length: g.length(pathLength(l.pts)), ...l.mouth !== void 0 && { mouth: l.mouth } });
    out.features = {
      rivers: g.lines.filter((l) => l.kind === "river" && l.source !== "generated").map(line2),
      generatedRivers: g.lines.filter((l) => l.kind === "river" && l.source === "generated").map(line2),
      roads: g.lines.filter((l) => l.kind === "road").map(line2),
      ...summits(g, field, spec),
      terrain: shares(field),
      ...extremes(g, field, spec)
    };
  }
  return out;
}

// ../artgen-core/src/map/require.ts
var two2 = (v) => v.toFixed(2);
function distanceToLines(lines, x, y) {
  let best = Infinity;
  for (const p of lines) for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
function measure(spec, f, r) {
  if (r.kind === "terrain") {
    const ids = samplesOf(f, r.area), measured = (shares(f, ids).find((s) => s.terrain === r.terrain)?.share ?? 0) / 100;
    return { what: r.terrain, measured, needed: r.share, op: ">=", met: measured >= r.share - 1e-9 };
  }
  if (r.kind === "height") {
    const ids = samplesOf(f, r.area), top = spec.topo.maxElevation, eps = top * 1e-6, need = r.share ?? 0.9;
    const inside = ids.filter((n) => {
      const h = f.elevation[n] * top;
      return h >= r.low - eps && h <= r.high + eps;
    }).length;
    const measured = ids.length ? Math.round(inside / ids.length * 100) / 100 : 0;
    return { what: `${r.low}-${r.high} ${spec.topo.unit}`, measured, needed: need, op: ">=", met: measured >= need - 1e-9 };
  }
  if (r.kind === "path") {
    const lines = r.path === "stream" ? f.rivers.filter((v) => v.for === r.id).map((v) => v.pts) : f.roads.filter((v) => v.for === r.id).map((v) => v.pts), tol = r.tolerance ?? 1;
    let far = 0;
    for (let i = 0; i < r.points.length; i += 2) far = Math.max(far, distanceToLines(lines, r.points[i], r.points[i + 1]));
    const measured = Number.isFinite(far) ? Math.round(far * 100) / 100 : null;
    return { what: r.path, measured, needed: tol, op: "<=", met: measured !== null && measured <= tol + 1e-9 };
  }
  const crossing = f.rivers.filter((v) => v.source === "generated" && [v.pts, v.outline].some((p) => {
    for (let i = 0; i < p.length; i += 2) if (coverage(r.area, p[i], p[i + 1]) > 0) return true;
    return false;
  }));
  return { what: "rivers", measured: crossing.length, needed: 0, op: "<=", met: crossing.length === 0 };
}
function checkRequirements(spec, field = generateMap(spec)) {
  return (spec.require ?? []).map((r) => {
    const m = measure(spec, field, r), cmp = m.met ? m.op : m.op === ">=" ? "<" : ">";
    return { id: r.id, kind: r.kind, ...m, text: `${r.id} ${r.kind} ${m.what} ${m.measured === null ? "no path" : two2(m.measured)} ${cmp} ${two2(m.needed)} ${m.met ? "met" : "unmet"}` };
  });
}

// ../artgen-core/src/lib/sync.ts
function checkIncoming(name, incoming, origin) {
  incoming.forEach((e, i) => {
    if (e.origin !== origin) throw new Error(`--from: ${name}[${i}] has ${e.origin === void 0 ? "no origin" : `origin ${JSON.stringify(e.origin)}`}, not ${JSON.stringify(origin)}: every entry in the file synced from carries the origin`);
  });
}
function mergeList(name, target, incoming, origin) {
  checkIncoming(name, incoming, origin);
  const generated = [], hand = [], removed = [];
  let placed = false;
  for (const e of target) {
    if (e.origin === origin) {
      removed.push(e);
      if (!placed) {
        generated.push(...incoming);
        placed = true;
      }
    } else if (e.origin !== void 0) generated.push(e);
    else hand.push(e);
  }
  if (!placed) generated.push(...incoming);
  return { list: [...generated, ...hand], removed, kept: target.length - removed.length };
}
var near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) < d;

// ../artgen-core/src/map/sync.ts
var MARK_DISTANCE = 0.75;
var markName = (m) => m.text !== void 0 ? `label "${m.text}"` : `symbol ${m.kind}`;
function syncMap(target, from, origin) {
  const conflicts = [], lists = {};
  const take = (name, a, b) => {
    const r = mergeList(name, a, b, origin);
    lists[name] = { removed: r.removed.length, added: b.length, kept: r.kept };
    return r.list;
  };
  const edits = take("edits", target.edits, from.edits), require4 = take("require", target.require ?? [], from.require ?? []);
  const labels = take("labels", target.overlay.labels, from.overlay.labels), symbols = take("symbols", target.overlay.symbols, from.overlay.symbols);
  const spec = parseMap({ ...target, edits, ...(target.require?.length || from.require?.length) && { require: require4 }, overlay: { labels, symbols } });
  const oldMarks = [...target.overlay.labels, ...target.overlay.symbols], newMarks = [...spec.overlay.labels, ...spec.overlay.symbols], pre = [...labels, ...symbols];
  const over = (marks, m) => marks.find((o) => o !== m && near(o, m, MARK_DISTANCE));
  newMarks.forEach((m, i) => {
    if (m.origin !== void 0) return;
    const was = oldMarks.includes(pre[i]) ? pre[i] : void 0, hit = over(newMarks, m);
    if (hit && !(was && over(oldMarks, was)))
      conflicts.push({ kind: "over-mark", list: m.text !== void 0 ? "labels" : "symbols", index: oldMarks.indexOf(pre[i]), message: `hand ${markName(m)} at ${m.x},${m.y} is now over ${markName(hit)}` });
  });
  return { spec, report: { version: MAP_FORMAT, origin, lists, conflicts } };
}

// ../artgen-core/src/dungeon/index.ts
var dungeon_exports = {};
__export(dungeon_exports, {
  BLOCK_SHAPES: () => BLOCK_SHAPES,
  CORRIDOR_STYLES: () => CORRIDOR_STYLES,
  CURVES: () => CURVES,
  DEFAULTS: () => DEFAULTS,
  DOOR_KINDS: () => DOOR_KINDS,
  DOOR_NAMES: () => DOOR_NAMES,
  DUNGEON_FORMAT: () => DUNGEON_FORMAT,
  DUNGEON_LAYERS: () => DUNGEON_LAYERS,
  EXIT_FADE: () => EXIT_FADE,
  FACTS_RULES: () => RULES2,
  FURNITURE_PLACES: () => FURNITURE_PLACES,
  FURNITURE_SIDES: () => FURNITURE_SIDES,
  GATE_KINDS: () => GATE_KINDS,
  GEN_LAYOUTS: () => GEN_LAYOUTS,
  HATCH_STYLES: () => HATCH_STYLES,
  LABEL_KINDS: () => LABEL_KINDS2,
  LEGEND_NAMES: () => LEGEND_NAMES,
  MARK_DISTANCE: () => MARK_DISTANCE2,
  MAX_SIDE: () => MAX_SIDE2,
  ROOM_FILLS: () => ROOM_FILLS,
  ROOM_SHAPES: () => ROOM_SHAPES,
  ROUTES: () => ROUTES,
  SCALE_UNITS: () => SCALE_UNITS,
  SIDES: () => SIDES,
  SPLIT_MODES: () => SPLIT_MODES,
  SYMBOLS: () => SYMBOLS2,
  SYMBOL_KINDS: () => SYMBOL_KINDS2,
  WALL_DEFAULTS: () => WALL_DEFAULTS,
  WALL_TOWER_SHAPES: () => WALL_TOWER_SHAPES,
  applyBlock: () => applyBlock,
  badgeBox: () => badgeBox,
  blockOutline: () => blockOutline,
  blockRoomNear: () => blockRoomNear,
  checkDungeon: () => checkDungeon,
  clipToRect: () => clipToRect,
  contentBox: () => contentBox,
  convexHull: () => convexHull,
  corridorDeps: () => corridorDeps,
  corridorOrder: () => corridorOrder,
  coversContent: () => coversContent,
  dungeonFacts: () => dungeonFacts,
  dungeonFurniture: () => dungeonFurniture,
  dungeonLabelLayout: () => dungeonLabelLayout,
  dungeonLayersFor: () => dungeonLayersFor,
  dungeonRenderSize: () => dungeonRenderSize,
  fitDungeon: () => fitDungeon,
  generateDungeon: () => generateDungeon,
  geom: () => geom_exports,
  gridFromUnits: () => gridFromUnits,
  gridInUnits: () => gridInUnits,
  hexPoints: () => hexPoints,
  hrefError: () => hrefError,
  inPolygon: () => inPolygon,
  layoutDungeon: () => layoutDungeon,
  layoutExits: () => layoutExits,
  layoutWalls: () => layoutWalls,
  linked: () => linked,
  lintDungeon: () => lintDungeon,
  newDungeon: () => newDungeon,
  nextCorridorId: () => nextCorridorId,
  nextRoomId: () => nextRoomId,
  offsetRing: () => offsetRing,
  originError: () => originError2,
  parseDungeon: () => parseDungeon,
  parsePoint: () => parsePoint2,
  placeFurniture: () => placeFurniture,
  polyBox: () => polyBox,
  removeBlock: () => removeBlock,
  removeCorridor: () => removeCorridor,
  removeRoom: () => removeRoom,
  renderDungeonSvg: () => renderDungeonSvg,
  roomCrop: () => roomCrop,
  roomOutline: () => roomOutline,
  sharedWallsOn: () => sharedWallsOn,
  singleRoom: () => singleRoom,
  splitBlock: () => splitBlock,
  syncDungeon: () => syncDungeon,
  toIssue: () => toIssue,
  underlaySvg: () => underlaySvg,
  underlayWindow: () => underlayWindow,
  validateDungeon: () => validateDungeon,
  wallFacts: () => wallFacts,
  withoutDangling: () => withoutDangling,
  wrapText: () => wrapText
});

// ../artgen-core/src/dungeon/spec.ts
var ROOM_SHAPES = ["rect", "circle", "octagon", "cave", "poly"];
var DOOR_KINDS = ["door", "secret", "locked", "portcullis", "arch"];
var DOOR_NAMES = {
  door: "Door",
  secret: "Secret door",
  locked: "Locked door",
  portcullis: "Portcullis / bars",
  arch: "Archway"
};
var ROUTES = ["auto", "hv", "vh", "straight", "around"];
var SIDES = ["n", "e", "s", "w"];
var CORRIDOR_STYLES = ["built", "natural"];
var CURVES = ["none", "smooth"];
var HATCH_STYLES = ["band", "full", "none"];
var LABEL_KINDS2 = ["name", "note", "area"];
var ROOM_FILLS = ["floor", "building", "yard", "cellar"];
var WALL_TOWER_SHAPES = ["round", "square"];
var GATE_KINDS = ["gate", "postern"];
var BLOCK_SHAPES = ["rect", "octagon", "circle", "poly"];
var SPLIT_MODES = ["bsp", "rows", "cols", "grid", "cuts"];
var GEN_LAYOUTS = ["scatter", "dense", "blocks"];
var DEFAULTS = {
  cols: 40,
  rows: 30,
  gen: { rooms: 8, minSize: 3, maxSize: 8, caves: 0.15, round: 0.1, loops: 0.25, doors: 0.6, corridorWidth: 1, spacing: 2, entrance: true },
  grid: { show: true, size: 2, sub: true, clip: "floor" },
  style: { hatch: "band", band: 0.9, wall: 1 },
  scale: { perCell: 5, unit: "ft" },
  numbers: true,
  scaleBar: true,
  compass: false
};
var DUNGEON_FORMAT = 1;
var MIGRATIONS2 = {};
var MAX_SIDE2 = 160;
function newDungeon(id, over = {}) {
  const d = structuredClone(DEFAULTS);
  return parseDungeon({
    ...d,
    ...over,
    id,
    version: DUNGEON_FORMAT,
    seed: over.seed ?? 1,
    gen: { ...d.gen, ...over.gen },
    grid: { ...d.grid, ...over.grid },
    style: { ...d.style, ...over.style },
    scale: { ...d.scale, ...over.scale },
    rooms: over.rooms ?? [],
    corridors: over.corridors ?? [],
    overlay: over.overlay ?? { labels: [], symbols: [] }
  });
}
var isNum2 = (v) => typeof v === "number" && Number.isFinite(v);
var nums2 = (v) => Array.isArray(v) && v.every(isNum2);
var isPoint = (v) => nums2(v) && v.length === 2;
function endErrors(e, at3, ids, corridorIds) {
  const shape = `${at3}: {room: id}, {at: [x, y]} or {corridor: id}`;
  if (!e || typeof e !== "object") return [shape];
  const o = e, out = [];
  if ("room" in o) {
    if (!ids.has(o.room)) out.push(`${at3}.room: no room ${JSON.stringify(o.room)}`);
    if (o.side !== void 0 && !SIDES.includes(o.side)) out.push(`${at3}.side: ${SIDES.join(", ")}`);
    if (o.offset !== void 0 && !(isNum2(o.offset) && o.offset >= 0)) out.push(`${at3}.offset: cells along the wall, 0 or more`);
    if (o.offset !== void 0 && o.side === void 0) out.push(`${at3}.offset: goes with side`);
    return out;
  }
  if ("at" in o) {
    if (!isPoint(o.at)) out.push(`${at3}.at: [x, y]`);
    const x = o.exit;
    if (x !== void 0) {
      if (!x || typeof x !== "object" || typeof x.text !== "string") out.push(`${at3}.exit: {text, href?, fade?}`);
      else {
        if (x.href !== void 0 && hrefError(x.href)) out.push(`${at3}.exit.href: ${hrefError(x.href)}`);
        if (x.fade !== void 0 && !(isNum2(x.fade) && x.fade >= 0 && x.fade <= 20)) out.push(`${at3}.exit.fade: cells, 0..20`);
      }
    }
    return out;
  }
  if ("corridor" in o) {
    if (typeof o.corridor !== "string" || !corridorIds.has(o.corridor)) out.push(`${at3}.corridor: no corridor with id ${JSON.stringify(o.corridor)}`);
    if (o.near !== void 0 && !isPoint(o.near)) out.push(`${at3}.near: [x, y]`);
    return out;
  }
  return [shape];
}
function corridorDeps(corridors) {
  const byId = new Map(corridors.flatMap((c, i) => typeof c?.id === "string" ? [[c.id, i]] : []));
  return corridors.map((c) => [c?.from, c?.to].flatMap((e) => e && typeof e === "object" && "corridor" in e && byId.has(e.corridor) ? [byId.get(e.corridor)] : []));
}
function corridorOrder(corridors) {
  const deps = corridorDeps(corridors), state = corridors.map(() => 0), out = [];
  const visit = (i) => {
    if (state[i] === 2) return true;
    if (state[i] === 1) return false;
    state[i] = 1;
    for (const d of deps[i]) if (!visit(d)) return false;
    state[i] = 2;
    out.push(i);
    return true;
  };
  for (let i = 0; i < corridors.length; i++) if (!visit(i)) return null;
  return out;
}
function hrefError(v) {
  if (typeof v !== "string" || !v.trim()) return "a link: http(s)://\u2026, a relative path or #anchor";
  if (/[\s<>"'`]|[\u0000-\u001f]/.test(v)) return "a link with no spaces, quotes or angle brackets";
  const scheme = v.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") return `http(s) links only, not ${scheme}:`;
  if (v.startsWith("//")) return "a full http(s):// address, not one starting //";
  return null;
}
function originError2(entry, at3, e) {
  const v = entry?.origin;
  if (v !== void 0 && (typeof v !== "string" || !v)) e.push(`${at3}.origin: a non-empty string`);
}
function enclosureErrors(m, ids) {
  const e = [];
  if (m.legend !== void 0 && typeof m.legend !== "boolean") e.push("legend: true or false");
  const f = m.furniture;
  if (f !== void 0 && (!f || typeof f !== "object" || !["over", "outside", "auto"].includes(f.place) || f.side !== void 0 && !["bottom", "right"].includes(f.side)))
    e.push("furniture: {place: over|outside|auto, side?: bottom|right}");
  const u = m.underlay;
  if (u !== void 0) {
    if (!u || typeof u !== "object" || typeof u.map !== "string" || !u.map) e.push("underlay.map: the map file's path");
    else {
      if (!isPoint(u.origin)) e.push("underlay.origin: [x, y] in map units");
      if (!isNum2(u.scale) || u.scale <= 0) e.push("underlay.scale: map units in one cell, above 0");
      if (u.theme !== void 0 && u.theme !== "color" && u.theme !== "bw") e.push("underlay.theme: color or bw");
    }
  }
  const walls = m.walls;
  if (walls === void 0) return e;
  if (!Array.isArray(walls)) return [...e, "walls: an array"];
  walls.forEach((w, i) => {
    const at3 = `walls[${i}]`;
    if (!w || typeof w !== "object") {
      e.push(`${at3}: an object`);
      return;
    }
    if (w.rooms !== void 0) {
      if (!Array.isArray(w.rooms) || !w.rooms.length) e.push(`${at3}.rooms: room ids`);
      else for (const r of w.rooms) if (!ids.has(r)) e.push(`${at3}.rooms: no room ${JSON.stringify(r)}`);
    }
    if (w.poly !== void 0 && !(nums2(w.poly) && w.poly.length >= 6 && w.poly.length % 2 === 0)) e.push(`${at3}.poly: at least 3 x,y pairs`);
    if (w.rooms === void 0 && w.poly === void 0) e.push(`${at3}: rooms (ids) or poly`);
    if (w.thickness !== void 0 && !(isNum2(w.thickness) && w.thickness > 0 && w.thickness <= 4)) e.push(`${at3}.thickness: cells, above 0 and at most 4`);
    if (w.inset !== void 0 && !(isNum2(w.inset) && w.inset >= 0)) e.push(`${at3}.inset: cells, 0 or more`);
    const t = w.towers;
    if (t !== void 0) {
      if (!t || !WALL_TOWER_SHAPES.includes(t.shape)) e.push(`${at3}.towers.shape: ${WALL_TOWER_SHAPES.join(" or ")}`);
      if (t?.size !== void 0 && !(isNum2(t.size) && t.size > 0)) e.push(`${at3}.towers.size: cells, above 0`);
      if (t?.at !== void 0 && t.at !== "corners" && !(nums2(t.at) && t.at.every(Number.isInteger))) e.push(`${at3}.towers.at: "corners" or vertex indices`);
    }
    (w.gates === void 0 ? [] : Array.isArray(w.gates) ? w.gates : (e.push(`${at3}.gates: an array`), [])).forEach((g, j) => {
      const ga = `${at3}.gates[${j}]`;
      if (!isPoint(g?.at)) e.push(`${ga}.at: [x, y] in cells`);
      if (!GATE_KINDS.includes(g?.kind)) e.push(`${ga}.kind: ${GATE_KINDS.join(" or ")}`);
      if (g?.room !== void 0 && !ids.has(g.room)) e.push(`${ga}.room: no room ${JSON.stringify(g.room)}`);
      if (g?.width !== void 0 && !(isNum2(g.width) && g.width > 0)) e.push(`${ga}.width: cells, above 0`);
    });
    originError2(w, at3, e);
  });
  return e;
}
function validateDungeon(raw) {
  const e = [];
  if (!raw || typeof raw !== "object") return ["dungeon: expected an object"];
  const m = raw;
  if (typeof m.id !== "string" || !/^[\w-]+$/.test(m.id)) e.push("id: letters, digits, - and _ only");
  for (const k of ["cols", "rows"]) if (!isNum2(m[k]) || m[k] < 4 || m[k] > MAX_SIDE2 || !Number.isInteger(m[k])) e.push(`${k}: an integer from 4 to ${MAX_SIDE2}`);
  if (!isNum2(m.seed)) e.push("seed: a number");
  const g = m.gen;
  if (!g) e.push("gen: required");
  else {
    for (const [k, lo, hi] of [["rooms", 1, 80], ["minSize", 1, 40], ["maxSize", 1, 40], ["caves", 0, 1], ["round", 0, 1], ["loops", 0, 1], ["doors", 0, 1], ["corridorWidth", 1, 6], ["spacing", 0, 10]])
      if (!isNum2(g[k]) || g[k] < lo || g[k] > hi) e.push(`gen.${k}: ${lo}..${hi}`);
    if (isNum2(g.minSize) && isNum2(g.maxSize) && g.minSize > g.maxSize) e.push("gen.minSize: at most maxSize");
    if (typeof g.entrance !== "boolean") e.push("gen.entrance: true or false");
    if (g.layout !== void 0 && !GEN_LAYOUTS.includes(g.layout)) e.push(`gen.layout: ${GEN_LAYOUTS.join(", ")}`);
    if (g.density !== void 0 && !(isNum2(g.density) && g.density > 0 && g.density <= 1)) e.push("gen.density: above 0, at most 1");
  }
  if (!m.grid || typeof m.grid.show !== "boolean" || !isNum2(m.grid.size) || m.grid.size < 0.5 || typeof m.grid.sub !== "boolean" || !["floor", "all"].includes(m.grid.clip))
    e.push("grid: show, size \u2265 0.5 (cells), sub (true|false), clip floor|all");
  if (!m.style || !HATCH_STYLES.includes(m.style.hatch) || !isNum2(m.style.band) || m.style.band < 0 || m.style.band > 6 || !isNum2(m.style.wall) || m.style.wall < 0.2 || m.style.wall > 4)
    e.push(`style: hatch ${HATCH_STYLES.join("|")}, band 0..6, wall 0.2..4`);
  if (m.style?.sharedWalls !== void 0 && typeof m.style.sharedWalls !== "boolean") e.push("style.sharedWalls: true or false");
  if (!m.scale || !isNum2(m.scale.perCell) || typeof m.scale.unit !== "string") e.push("scale: perCell (number) and unit");
  const ids = /* @__PURE__ */ new Set();
  (Array.isArray(m.rooms) ? m.rooms : (e.push("rooms: an array"), [])).forEach((r, i) => {
    const at3 = `rooms[${i}]`;
    if (typeof r?.id !== "string" || !/^[\w-]+$/.test(r.id)) e.push(`${at3}.id: letters, digits, - and _ only`);
    else if (ids.has(r.id)) e.push(`${at3}.id: ${r.id} is used twice`);
    else ids.add(r.id);
    if (!ROOM_SHAPES.includes(r?.shape)) e.push(`${at3}.shape: one of ${ROOM_SHAPES.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum2(r?.[k])) e.push(`${at3}.${k}: a number (cells)`);
    for (const k of ["w", "h"]) if (!isNum2(r?.[k]) || r[k] < 1) e.push(`${at3}.${k}: at least 1 cell`);
    if (r?.shape === "poly" && !(nums2(r.points) && r.points.length >= 6 && r.points.length % 2 === 0)) e.push(`${at3}.points: at least 3 x,y pairs`);
    if (r?.label !== void 0 && typeof r.label !== "string") e.push(`${at3}.label: text`);
    if (r?.number !== void 0 && r.number !== false && !isNum2(r.number)) e.push(`${at3}.number: a number or false`);
    if (r?.fill !== void 0 && !ROOM_FILLS.includes(r.fill)) e.push(`${at3}.fill: one of ${ROOM_FILLS.join(", ")}`);
    if (r?.href !== void 0 && hrefError(r.href)) e.push(`${at3}.href: ${hrefError(r.href)}`);
    if (r?.hand !== void 0 && !(Array.isArray(r.hand) && r.hand.every((f) => typeof f === "string"))) e.push(`${at3}.hand: field names`);
    originError2(r, at3, e);
  });
  const corridorIds = /* @__PURE__ */ new Set();
  (Array.isArray(m.corridors) ? m.corridors : []).forEach((c, i) => {
    if (c?.id === void 0) return;
    if (typeof c.id !== "string" || !/^[\w-]+$/.test(c.id)) e.push(`corridors[${i}].id: letters, digits, - and _ only`);
    else if (corridorIds.has(c.id)) e.push(`corridors[${i}].id: ${c.id} is used twice`);
    else corridorIds.add(c.id);
  });
  (Array.isArray(m.corridors) ? m.corridors : (e.push("corridors: an array"), [])).forEach((c, i) => {
    const at3 = `corridors[${i}]`;
    e.push(...endErrors(c?.from, `${at3}.from`, ids, corridorIds), ...endErrors(c?.to, `${at3}.to`, ids, corridorIds));
    for (const side of ["from", "to"]) {
      const x = c?.[side];
      if (x && x.corridor !== void 0 && x.corridor === c?.id) e.push(`${at3}.${side}.corridor: a corridor cannot join itself`);
    }
    if (c?.curve !== void 0 && !CURVES.includes(c.curve)) e.push(`${at3}.curve: ${CURVES.join(" or ")}`);
    if (c?.style !== void 0 && !CORRIDOR_STYLES.includes(c.style)) e.push(`${at3}.style: ${CORRIDOR_STYLES.join(" or ")}`);
    if (c?.seed !== void 0 && !isNum2(c.seed)) e.push(`${at3}.seed: a number`);
    if (c?.width !== void 0 && !(isNum2(c.width) && c.width >= 0.5 && c.width <= 6)) e.push(`${at3}.width: 0.5..6`);
    if (c?.route !== void 0 && !ROUTES.includes(c.route)) e.push(`${at3}.route: one of ${ROUTES.join(", ")}`);
    if (c?.via !== void 0 && !(nums2(c.via) && c.via.length % 2 === 0)) e.push(`${at3}.via: x,y pairs`);
    if (c?.doors !== void 0 && !(Array.isArray(c.doors) && c.doors.length === 2 && c.doors.every((d) => d === null || DOOR_KINDS.includes(d))))
      e.push(`${at3}.doors: [from, to], each null or one of ${DOOR_KINDS.join(", ")}`);
    originError2(c, at3, e);
  });
  if (m.connections !== void 0) {
    if (!Array.isArray(m.connections)) e.push("connections: an array");
    else m.connections.forEach((c, i) => {
      const at3 = `connections[${i}]`;
      if (!c || typeof c !== "object") {
        e.push(`${at3}: {a, b, at?, kind?, width?}`);
        return;
      }
      for (const k of ["a", "b"]) if (!ids.has(c[k])) e.push(`${at3}.${k}: no room ${JSON.stringify(c[k])}`);
      if (c.a === c.b) e.push(`${at3}: a room cannot connect to itself`);
      if (c.at !== void 0 && !isPoint(c.at)) e.push(`${at3}.at: [x, y]`);
      if (c.kind !== void 0 && c.kind !== "open" && !DOOR_KINDS.includes(c.kind)) e.push(`${at3}.kind: open or one of ${DOOR_KINDS.join(", ")}`);
      if (c.width !== void 0 && !(isNum2(c.width) && c.width >= 0.5 && c.width <= 20)) e.push(`${at3}.width: 0.5..20`);
      originError2(c, at3, e);
    });
  }
  if (m.blocks !== void 0) {
    if (!Array.isArray(m.blocks)) e.push("blocks: an array");
    else {
      const seen = /* @__PURE__ */ new Set();
      m.blocks.forEach((b, i) => {
        const at3 = `blocks[${i}]`;
        if (!b || typeof b !== "object") {
          e.push(`${at3}: {id, shape, x, y, w, h, split}`);
          return;
        }
        if (typeof b.id !== "string" || !/^[\w-]+$/.test(b.id)) e.push(`${at3}.id: letters, digits, - and _ only`);
        else if (seen.has(b.id)) e.push(`${at3}.id: ${b.id} is used twice`);
        else seen.add(b.id);
        if (!BLOCK_SHAPES.includes(b.shape)) e.push(`${at3}.shape: one of ${BLOCK_SHAPES.join(", ")}`);
        for (const k of ["x", "y"]) if (!isNum2(b[k])) e.push(`${at3}.${k}: a number (cells)`);
        for (const k of ["w", "h"]) if (!isNum2(b[k]) || b[k] < 1) e.push(`${at3}.${k}: at least 1 cell`);
        if (b.shape === "poly" && !(nums2(b.points) && b.points.length >= 6 && b.points.length % 2 === 0)) e.push(`${at3}.points: at least 3 x,y pairs`);
        const sp = b.split;
        if (!sp || typeof sp !== "object" || !SPLIT_MODES.includes(sp.mode)) e.push(`${at3}.split.mode: one of ${SPLIT_MODES.join(", ")}`);
        else {
          if (sp.min !== void 0 && !(isNum2(sp.min) && sp.min >= 1 && sp.min <= 40)) e.push(`${at3}.split.min: 1..40 cells`);
          if (sp.seed !== void 0 && !isNum2(sp.seed)) e.push(`${at3}.split.seed: a number`);
          if (sp.cuts !== void 0 && !(sp.cuts && typeof sp.cuts === "object" && (sp.cuts.x === void 0 || nums2(sp.cuts.x)) && (sp.cuts.y === void 0 || nums2(sp.cuts.y)))) e.push(`${at3}.split.cuts: {x?: [cells], y?: [cells]}`);
          if (sp.mode === "cuts" && !(sp.cuts?.x?.length || sp.cuts?.y?.length)) e.push(`${at3}.split.cuts: the x and/or y lines to cut at`);
        }
        if (b.doors !== void 0 && !(isNum2(b.doors) && b.doors >= 0 && b.doors <= 1)) e.push(`${at3}.doors: 0..1`);
        originError2(b, at3, e);
      });
    }
  }
  if (Array.isArray(m.corridors) && !e.some((x) => x.startsWith("corridors")) && !corridorOrder(m.corridors)) e.push("corridors: corridors join each other in a ring ({corridor: id} ends); one must end at a room or a point");
  e.push(...enclosureErrors(m, ids));
  const o = m.overlay;
  if (!o || !Array.isArray(o.labels) || !Array.isArray(o.symbols)) e.push("overlay: { labels: [], symbols: [] }");
  else {
    o.labels.forEach((l, i) => {
      if (typeof l?.text !== "string" || !isNum2(l.x) || !isNum2(l.y) || !LABEL_KINDS2.includes(l.kind)) {
        e.push(`overlay.labels[${i}]: text, x, y, kind (${LABEL_KINDS2.join("|")})`);
        return;
      }
      if (l.href !== void 0 && hrefError(l.href)) e.push(`overlay.labels[${i}].href: ${hrefError(l.href)}`);
      originError2(l, `overlay.labels[${i}]`, e);
    });
    o.symbols.forEach((s, i) => {
      if (typeof s?.kind !== "string" || !isNum2(s.x) || !isNum2(s.y)) e.push(`overlay.symbols[${i}]: kind, x, y`);
      else originError2(s, `overlay.symbols[${i}]`, e);
    });
  }
  return e;
}
function polyBox(points) {
  const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(1, Math.max(...xs) - x), h: Math.max(1, Math.max(...ys) - y) };
}
function withDefaults(r) {
  const d = DEFAULTS;
  const rooms = (Array.isArray(r.rooms) ? r.rooms : []).map((room) => room?.shape === "poly" && Array.isArray(room.points) && room.points.length >= 6 && room.x === void 0 ? { ...room, ...polyBox(room.points) } : room);
  const m = {
    ...structuredClone(d),
    ...r,
    version: DUNGEON_FORMAT,
    gen: { ...d.gen, ...r.gen },
    grid: { ...d.grid, ...r.grid },
    style: { ...d.style, ...r.style },
    scale: { ...d.scale, ...r.scale },
    rooms,
    corridors: r.corridors ?? [],
    overlay: { labels: r.overlay?.labels ?? [], symbols: r.overlay?.symbols ?? [] }
  };
  return m;
}
function parseDungeon(raw) {
  const r = readFormat(raw, "dungeon", DUNGEON_FORMAT, MIGRATIONS2), m = withDefaults(r);
  const errors = validateDungeon(m);
  if (errors.length) throw new Error(`invalid dungeon${typeof r.id === "string" ? ` ${r.id}` : ""}:
  ${errors.join("\n  ")}`);
  return m;
}
var toIssue = (s) => {
  const i = s.indexOf(": ");
  return i < 0 ? { path: "", message: s } : { path: s.slice(0, i), message: s.slice(i + 2) };
};
function checkDungeon(raw) {
  let r;
  try {
    r = readFormat(raw, "dungeon", DUNGEON_FORMAT, MIGRATIONS2);
  } catch (err) {
    const v = raw?.version;
    return { version: typeof v === "number" ? v : null, errors: [{ path: "version", message: err.message }] };
  }
  return { version: DUNGEON_FORMAT, errors: validateDungeon(withDefaults(r)).map(toIssue) };
}
var SCALE_UNITS = ["ft", "m", "yd", "mi", "km"];
function gridFromUnits(spec, o) {
  const per = spec.scale.perCell, g = { ...spec.grid };
  if (o.show !== void 0) g.show = o.show;
  if (o.size !== void 0) {
    const cells = o.size / per;
    if (!(Number.isFinite(cells) && cells >= 1 && Math.abs(cells - Math.round(cells)) < 1e-9))
      throw new Error(`grid size: a whole number of squares (1 square = ${per} ${spec.scale.unit}), so ${per}, ${2 * per}, ${3 * per} \u2026`);
    g.size = Math.round(cells);
    g.show = o.show ?? true;
  }
  if (o.sub !== void 0) g.sub = o.sub;
  return g;
}
function gridInUnits(spec) {
  const per = spec.scale.perCell;
  return { show: spec.grid.show, size: spec.grid.size * per, unit: spec.scale.unit, sub: spec.grid.sub && spec.grid.size > 1, subSize: per };
}
function parsePoint2(at3) {
  const xy = at3.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
  if (xy) return [+xy[1], +xy[2]];
  const sq = at3.replace(/^cell:/i, "").toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (sq) {
    const c = [...sq[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, r = +sq[2] - 1;
    return [c + 0.5, r + 0.5];
  }
  throw new Error(`${at3}: expected x,y (cells) or a cell name (C4)`);
}
function withoutDangling(list3) {
  for (; ; ) {
    const ids = new Set(list3.flatMap((c) => c.id ? [c.id] : []));
    const next = list3.filter((c) => ![c.from, c.to].some((e) => "corridor" in e && !ids.has(e.corridor)));
    if (next.length === list3.length) return next;
    list3 = next;
  }
}
function removeRoom(m, id) {
  const before = m.corridors.length;
  m.rooms = m.rooms.filter((r) => r.id !== id);
  if (m.connections) m.connections = m.connections.filter((c) => c.a !== id && c.b !== id);
  m.corridors = withoutDangling(m.corridors.filter((c) => ![c.from, c.to].some((e) => "room" in e && e.room === id)));
  return before - m.corridors.length;
}
function removeCorridor(m, index) {
  const before = m.corridors.length;
  m.corridors = withoutDangling(m.corridors.filter((_, i) => i !== index));
  return before - m.corridors.length;
}
function nextCorridorId(spec) {
  const used = new Set(spec.corridors.flatMap((c) => c.id ? [c.id] : []));
  for (let n = 1; ; n++) if (!used.has(`c${n}`)) return `c${n}`;
}
var sharedWallsOn = (m) => m.style.sharedWalls ?? !!(m.connections?.length || m.blocks?.length);
function nextRoomId(spec) {
  const used = new Set(spec.rooms.map((r) => r.id));
  for (let n = spec.rooms.length + 1; ; n++) if (!used.has(`r${n}`)) return `r${n}`;
}

// ../artgen-core/src/dungeon/geom.ts
var geom_exports = {};
__export(geom_exports, {
  area2: () => area2,
  edges: () => edges,
  lineLength: () => lineLength2,
  nearestOnLine: () => nearestOnLine,
  polygonArea: () => polygonArea,
  samples: () => samples,
  segmentCross: () => segmentCross,
  segmentDistance: () => segmentDistance,
  selfCrossing: () => selfCrossing,
  sharedEdges: () => sharedEdges
});
function area2(p) {
  let s = 0;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) s += p[j] * p[i + 1] - p[i] * p[j + 1];
  return s;
}
var polygonArea = (p) => Math.abs(area2(p)) / 2;
var cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function segmentCross(a, b, c, d, eps = 1e-9) {
  const d1 = cross(c[0], c[1], d[0], d[1], a[0], a[1]), d2 = cross(c[0], c[1], d[0], d[1], b[0], b[1]);
  const d3 = cross(a[0], a[1], b[0], b[1], c[0], c[1]), d4 = cross(a[0], a[1], b[0], b[1], d[0], d[1]);
  if (!((d1 > eps && d2 < -eps || d1 < -eps && d2 > eps) && (d3 > eps && d4 < -eps || d3 < -eps && d4 > eps))) return null;
  const t = d1 / (d1 - d2);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function selfCrossing(p) {
  const n = p.length / 2, pt2 = (i) => [p[2 * (i % n)], p[2 * (i % n) + 1]];
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (segmentCross(pt2(i), pt2(i + 1), pt2(j), pt2(j + 1))) return [i, j];
  }
  return null;
}
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function nearestOnLine(pts2, x, y) {
  let best = { x: pts2[0], y: pts2[1], d: Infinity, along: 0, seg: 0 }, at3 = 0;
  for (let i = 0; i + 3 < pts2.length; i += 2) {
    const ax = pts2[i], ay = pts2[i + 1], bx = pts2[i + 2], by = pts2[i + 3], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, len = Math.sqrt(L2);
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0, px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { x: px, y: py, d, along: at3 + t * len, seg: i / 2 };
    at3 += len;
  }
  return best;
}
function lineLength2(pts2) {
  let s = 0;
  for (let i = 2; i < pts2.length; i += 2) s += Math.hypot(pts2[i] - pts2[i - 2], pts2[i + 1] - pts2[i - 1]);
  return s;
}
function samples(pts2, step) {
  const out = [[pts2[0], pts2[1]]];
  for (let i = 0; i + 3 < pts2.length; i += 2) {
    const len = Math.hypot(pts2[i + 2] - pts2[i], pts2[i + 3] - pts2[i + 1]), n = Math.max(1, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) out.push([pts2[i] + (pts2[i + 2] - pts2[i]) * k / n, pts2[i + 1] + (pts2[i + 3] - pts2[i + 1]) * k / n]);
  }
  return out;
}
function edges(p) {
  const out = [];
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) out.push([[p[j], p[j + 1]], [p[i], p[i + 1]]]);
  return out;
}
function sharedEdges(a, b, eps = 1e-6) {
  const out = [];
  for (const [p0, p1] of edges(a)) for (const [q0, q1] of edges(b)) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L2 = Math.hypot(dx, dy);
    if (L2 < eps) continue;
    const off = (q) => Math.abs((q[0] - p0[0]) * dy - (q[1] - p0[1]) * dx) / L2;
    if (off(q0) > eps || off(q1) > eps) continue;
    const t = (q) => ((q[0] - p0[0]) * dx + (q[1] - p0[1]) * dy) / (L2 * L2);
    const lo = Math.max(0, Math.min(t(q0), t(q1))), hi = Math.min(1, Math.max(t(q0), t(q1)));
    if (hi - lo < eps / L2) continue;
    out.push([[p0[0] + dx * lo, p0[1] + dy * lo], [p0[0] + dx * hi, p0[1] + dy * hi]]);
  }
  return out;
}

// ../artgen-core/src/dungeon/corridors.ts
var snap = (v, w) => Math.round(w) % 2 ? Math.floor(v) + 0.5 : Math.round(v);
var OUT = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
function sidePort(g, side, offset, width) {
  const r = g.room, d = OUT[side], across = side === "n" || side === "s";
  const along2 = across ? offset !== void 0 ? r.x + offset : snap(g.cx, width) : offset !== void 0 ? r.y + offset : snap(g.cy, width);
  const p = across ? [along2, g.cy] : [g.cx, along2];
  const edge = side === "n" ? r.y : side === "s" ? r.y + r.h : side === "w" ? r.x : r.x + r.w;
  const stub = across ? [along2, edge + d[1]] : [edge + d[0], along2];
  return { p, stub, dir: d, room: g };
}
function junctionPort(line2, toward) {
  const j = nearestOnLine(line2, toward[0], toward[1]), i = j.seg * 2;
  const tx = line2[i + 2] - line2[i], ty = line2[i + 3] - line2[i + 1], L2 = Math.hypot(tx, ty) || 1;
  let dir = [-ty / L2, tx / L2];
  if ((toward[0] - j.x) * dir[0] + (toward[1] - j.y) * dir[1] < 0) dir = [-dir[0], -dir[1]];
  return { p: [j.x, j.y], dir };
}
var horizontal = (d) => Math.abs(d[0]) >= Math.abs(d[1]);
function portRoute(a, b, width) {
  const A = a.stub ?? a.p, B = b.stub ?? b.p;
  if (a.dir && b.dir) {
    const ha = horizontal(a.dir), hb = horizontal(b.dir);
    if (ha && hb) {
      if (A[1] === B[1]) return [...A, ...B];
      const mx = snap((A[0] + B[0]) / 2, width);
      return [...A, mx, A[1], mx, B[1], ...B];
    }
    if (!ha && !hb) {
      if (A[0] === B[0]) return [...A, ...B];
      const my = snap((A[1] + B[1]) / 2, width);
      return [...A, A[0], my, B[0], my, ...B];
    }
    return ha ? [...A, B[0], A[1], ...B] : [...A, A[0], B[1], ...B];
  }
  const d = a.dir ?? b.dir;
  if (!d) return [...A, B[0], A[1], ...B];
  const first = a.dir ? horizontal(d) : !horizontal(d);
  return first ? [...A, B[0], A[1], ...B] : [...A, A[0], B[1], ...B];
}
function tidy(pts2) {
  const out = [];
  for (let i = 0; i < pts2.length; i += 2) {
    const n = out.length;
    if (n && Math.abs(out[n - 2] - pts2[i]) < 1e-9 && Math.abs(out[n - 1] - pts2[i + 1]) < 1e-9) continue;
    if (n >= 4) {
      const ax = out[n - 4], ay = out[n - 3], bx = out[n - 2], by = out[n - 1];
      if (Math.abs((bx - ax) * (pts2[i + 1] - ay) - (by - ay) * (pts2[i] - ax)) < 1e-9 && (bx - ax) * (pts2[i] - bx) + (by - ay) * (pts2[i + 1] - by) >= 0) {
        out[n - 2] = pts2[i];
        out[n - 1] = pts2[i + 1];
        continue;
      }
    }
    out.push(pts2[i], pts2[i + 1]);
  }
  return out;
}
function routeAround(a, b, width, avoid, cols, rows2) {
  const o = Math.round(width) % 2 ? 0.5 : 0, x0 = -1, y0 = -1, W = cols + 3, H = rows2 + 3;
  const node = (x, y) => [Math.round(x - o) - x0, Math.round(y - o) - y0];
  const [sx, sy] = node(a[0], a[1]), [gx, gy] = node(b[0], b[1]);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H || gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
  const clear = width / 2 + 0.35;
  const blocked = new Uint8Array(W * H);
  for (const g of avoid) {
    const r = g.room, i0 = Math.max(0, Math.floor(r.x - clear - o) - x0), i1 = Math.min(W - 1, Math.ceil(r.x + r.w + clear - o) - x0);
    const j0 = Math.max(0, Math.floor(r.y - clear - o) - y0), j1 = Math.min(H - 1, Math.ceil(r.y + r.h + clear - o) - y0);
    const es = edges(g.outline);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i + x0 + o, y = j + y0 + o;
      if (inPolygon(g.outline, x, y) || es.some(([p, q]) => segmentDistance(x, y, p, q) < clear)) blocked[j * W + i] = 1;
    }
  }
  blocked[sy * W + sx] = 0;
  blocked[gy * W + gx] = 0;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]], N = W * H * 4, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap2 = [];
  const push = (d, s) => {
    heap2.push([d, s]);
    let i = heap2.length - 1;
    while (i) {
      const p = i - 1 >> 1;
      if (heap2[p][0] <= heap2[i][0]) break;
      [heap2[p], heap2[i]] = [heap2[i], heap2[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap2[0], last = heap2.pop();
    if (heap2.length) {
      heap2[0] = last;
      let i = 0;
      for (; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap2.length && heap2[l][0] < heap2[m][0]) m = l;
        if (r < heap2.length && heap2[r][0] < heap2[m][0]) m = r;
        if (m === i) break;
        [heap2[m], heap2[i]] = [heap2[i], heap2[m]];
        i = m;
      }
    }
    return top;
  };
  for (let d = 0; d < 4; d++) {
    const s = (sy * W + sx) * 4 + d;
    dist[s] = 0;
    push(0, s);
  }
  let end = -1;
  while (heap2.length) {
    const [d, s] = pop();
    if (d > dist[s]) continue;
    const c = s >> 2, h = s & 3, cx = c % W, cy = (c - cx) / W;
    if (cx === gx && cy === gy) {
      end = s;
      break;
    }
    for (let nh = 0; nh < 4; nh++) {
      if (nh === (h + 2 & 3)) continue;
      const nx = cx + DIRS[nh][0], ny = cy + DIRS[nh][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked[ny * W + nx]) continue;
      const ns = (ny * W + nx) * 4 + nh, nd = d + 1 + (nh === h ? 0 : 4);
      if (nd < dist[ns]) {
        dist[ns] = nd;
        prev[ns] = s;
        push(nd, ns);
      }
    }
  }
  if (end < 0) return null;
  const pts2 = [];
  for (let s = end; s >= 0; s = prev[s]) {
    const c = s >> 2, cx = c % W;
    pts2.unshift(cx + x0 + o, (c - cx) / W + y0 + o);
  }
  const n = pts2.length;
  return tidy([...a, pts2[0], a[1], ...pts2, b[0], pts2[n - 1], ...b]);
}
function smoothLine2(pts2, perCell = 3) {
  const n = pts2.length / 2;
  if (n < 3) return pts2.slice();
  const P = (i) => {
    const k = Math.max(0, Math.min(n - 1, i));
    return [pts2[2 * k], pts2[2 * k + 1]];
  };
  const out = [...P(0)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0 ? [2 * P(0)[0] - P(1)[0], 2 * P(0)[1] - P(1)[1]] : P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = i === n - 2 ? [2 * P(n - 1)[0] - P(n - 2)[0], 2 * P(n - 1)[1] - P(n - 2)[1]] : P(i + 2);
    const t = (a, b) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + t(p0, p1), t2 = t1 + t(p1, p2), t3 = t2 + t(p2, p3);
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * perCell));
    for (let k = 1; k <= steps; k++) {
      const tt = t1 + (t2 - t1) * k / steps;
      const lerp = (a, b, ta, tb) => [((tb - tt) * a[0] + (tt - ta) * b[0]) / (tb - ta), ((tb - tt) * a[1] + (tt - ta) * b[1]) / (tb - ta)];
      const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
      const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3), C3 = lerp(B1, B2, t1, t2);
      out.push(C3[0], C3[1]);
    }
  }
  out.splice(out.length - 2, 2, ...P(n - 1));
  return out;
}
function naturalOutline(pts2, width, seed) {
  const rand = rng(seed), ph = Array.from({ length: 6 }, () => rand() * Math.PI * 2);
  const s = [];
  let at3 = 0;
  for (let i = 0; i + 3 < pts2.length; i += 2) {
    const len = Math.hypot(pts2[i + 2] - pts2[i], pts2[i + 3] - pts2[i + 1]), n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = i ? 1 : 0; k <= n; k++) s.push({ x: pts2[i] + (pts2[i + 2] - pts2[i]) * k / n, y: pts2[i + 1] + (pts2[i + 3] - pts2[i + 1]) * k / n, at: at3 + len * k / n });
    at3 += len;
  }
  if (s.length < 2) return [];
  const wall = (a, p, q, r) => Math.max(0.3, 0.5 + 0.16 * Math.sin(a * 0.9 + p) + 0.11 * Math.sin(a * 2.1 + q) + 0.06 * Math.sin(a * 4.3 + r));
  const left = [], right = [];
  s.forEach((c, i) => {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], tx = b.x - a.x, ty = b.y - a.y, L2 = Math.hypot(tx, ty) || 1, nx = -ty / L2, ny = tx / L2;
    const ease = Math.min(1, c.at / 1.5, (at3 - c.at) / 1.5), l = width * (0.5 + (wall(c.at, ph[0], ph[1], ph[2]) - 0.5) * ease), r = width * (0.5 + (wall(c.at, ph[3], ph[4], ph[5]) - 0.5) * ease);
    left.push(c.x + nx * l, c.y + ny * l);
    right.unshift(c.x - nx * r, c.y - ny * r);
  });
  return chaikin({ pts: [...left, ...right], closed: true }, 2).pts;
}

// ../artgen-core/src/dungeon/walls.ts
var WALL_DEFAULTS = { thickness: 1, inset: 1, towerSize: 3, gateWidth: 2, posternWidth: 1 };
function convexHull(pts2) {
  const ps = [];
  for (let i = 0; i < pts2.length; i += 2) ps.push([pts2[i], pts2[i + 1]]);
  ps.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const uniq = ps.filter((p, i) => !i || p[0] !== ps[i - 1][0] || p[1] !== ps[i - 1][1]);
  if (uniq.length < 3) return uniq;
  const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list3) => {
    const h = [];
    for (const p of list3) {
      while (h.length >= 2 && cross2(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(uniq), ...half([...uniq].reverse())];
}
var area22 = (r) => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0);
function offsetRing(ring2, d) {
  if (!d || ring2.length < 3) return ring2;
  const sign = area22(ring2) > 0 ? 1 : -1, n = ring2.length;
  const normal = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [sign * dy / l, -sign * dx / l];
  };
  return ring2.map((p, i) => {
    const a = normal(ring2[(i + n - 1) % n], p), b = normal(p, ring2[(i + 1) % n]), k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k];
  });
}
function snapToRing(ring2, at3) {
  let best = { x: ring2[0][0], y: ring2[0][1], angle: 0 }, bd = Infinity;
  ring2.forEach((a, i) => {
    const b = ring2[(i + 1) % ring2.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((at3[0] - a[0]) * dx + (at3[1] - a[1]) * dy) / L2)) : 0, x = a[0] + t * dx, y = a[1] + t * dy, d = Math.hypot(at3[0] - x, at3[1] - y);
    if (d < bd) {
      bd = d;
      best = { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI };
    }
  });
  return best;
}
function wallGeom(w, index, l) {
  const byId = new Map(l.rooms.map((g) => [g.room.id, g]));
  let ring2;
  if (w.poly) ring2 = Array.from({ length: w.poly.length / 2 }, (_, i) => [w.poly[2 * i], w.poly[2 * i + 1]]);
  else ring2 = offsetRing(convexHull((w.rooms ?? []).flatMap((id) => byId.get(id)?.outline ?? [])), w.inset ?? WALL_DEFAULTS.inset);
  const thickness = w.thickness ?? WALL_DEFAULTS.thickness, tw = w.towers, size = tw?.size ?? WALL_DEFAULTS.towerSize, shape = tw?.shape ?? "round";
  const towers = [];
  if (tw) {
    const at3 = tw.at ?? "corners", verts = at3 === "corners" ? ring2.map((_, i) => i) : at3.filter((i) => i >= 0 && i < ring2.length);
    for (const i of verts) towers.push({ x: ring2[i][0], y: ring2[i][1], shape, size, source: "corner", vertex: i });
  }
  const gates = (w.gates ?? []).map((g) => {
    const s = snapToRing(ring2, g.at), width = g.width ?? (g.kind === "postern" ? WALL_DEFAULTS.posternWidth : WALL_DEFAULTS.gateWidth);
    const dx = Math.cos(s.angle * Math.PI / 180), dy = Math.sin(s.angle * Math.PI / 180), off = width / 2 + size / 2;
    const side = g.kind === "gate" ? [-1, 1].map((sg) => ({ x: s.x + sg * off * dx, y: s.y + sg * off * dy, shape, size, source: "gate" })) : [];
    towers.push(...side);
    return { kind: g.kind, x: s.x, y: s.y, angle: s.angle, width, ...g.room !== void 0 && { room: g.room }, towers: side };
  });
  const ids = w.rooms ?? l.rooms.map((g) => g.room.id);
  const enclosed = ids.map((room) => {
    const g = byId.get(room), flat2 = ring2.flat();
    return { room, inside: !!g && g.outline.every((_, i) => i % 2 || inPolygon(flat2, g.outline[i], g.outline[i + 1]) || onRing(ring2, g.outline[i], g.outline[i + 1])) };
  });
  return { index, ...w.id !== void 0 && { id: w.id }, thickness, ring: ring2.flat(), towers, gates, enclosed };
}
var onRing = (ring2, x, y) => {
  const s = snapToRing(ring2, [x, y]);
  return Math.hypot(s.x - x, s.y - y) < 1e-6;
};
function layoutWalls(spec, l) {
  return (spec.walls ?? []).map((w, i) => wallGeom(w, i, l));
}
var r1 = (v) => roundTo(v, 0.1);
function wallFacts(spec, l) {
  return layoutWalls(spec, l).map((w) => ({
    index: w.index,
    id: w.id ?? null,
    thickness: w.thickness,
    corners: Array.from({ length: w.ring.length / 2 }, (_, i) => [r1(w.ring[2 * i]), r1(w.ring[2 * i + 1])]),
    towers: w.towers.map((t) => ({ at: [r1(t.x), r1(t.y)], shape: t.shape, size: t.size, source: t.source, vertex: t.vertex ?? null })),
    gates: w.gates.map((g) => ({ kind: g.kind, at: [r1(g.x), r1(g.y)], angle: Math.round(g.angle), width: g.width, room: g.room ?? null, towers: g.towers.length })),
    enclosed: w.enclosed
  }));
}

// ../artgen-core/src/dungeon/layout.ts
var idSeed = (id) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
function roomOutline(r) {
  const { x, y, w, h } = r, cx = x + w / 2, cy = y + h / 2;
  if (r.shape === "rect") return [x, y, x + w, y, x + w, y + h, x, y + h];
  if (r.shape === "poly") return r.points.slice();
  if (r.shape === "octagon") {
    const c = Math.max(0.5, Math.round(Math.min(w, h) * 0.3 * 2) / 2);
    return [x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c];
  }
  const n = r.shape === "circle" ? 64 : 22, out = [];
  if (r.shape === "circle") {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      out.push(cx + Math.cos(a) * w / 2, cy + Math.sin(a) * h / 2);
    }
    return out;
  }
  const rand = rng(r.seed ?? idSeed(r.id)), ph = [rand(), rand(), rand(), rand()].map((v) => v * Math.PI * 2), amp = [0.12, 0.08, 0.05];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const f = 0.84 + amp[0] * Math.sin(2 * a + ph[0]) + amp[1] * Math.sin(3 * a + ph[1]) + amp[2] * Math.sin(5 * a + ph[2]) + 0.04 * (rand() - 0.5);
    out.push(cx + Math.cos(a) * (w / 2) * Math.min(1, f + 0.08), cy + Math.sin(a) * (h / 2) * Math.min(1, f + 0.08));
  }
  return chaikin({ pts: out, closed: true }, 2).pts;
}
function inPolygon(p, x, y) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function edgeDistance(p, x, y) {
  let d = Infinity;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const ax = p[j], ay = p[j + 1], bx = p[i], by = p[i + 1], L2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2)) : 0;
    d = Math.min(d, Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)));
  }
  return d;
}
function roomAnchor(r, outline2) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  if (r.shape !== "poly") return [cx, cy];
  let best = [cx, cy], score = -Infinity;
  for (let j = r.y + 0.5; j < r.y + r.h; j += 0.5) for (let i = r.x + 0.5; i < r.x + r.w; i += 0.5) {
    if (!inPolygon(outline2, i, j)) continue;
    const s = Math.min(edgeDistance(outline2, i, j), 1.5) - 0.01 * Math.hypot(i - cx, j - cy);
    if (s > score) {
      score = s;
      best = [i, j];
    }
  }
  return best;
}
function core(g) {
  const r = g.room, s = r.shape === "rect" || r.shape === "poly" ? 0 : 0.2;
  return [r.x + r.w * s, r.y + r.h * s, r.x + r.w * (1 - s), r.y + r.h * (1 - s)];
}
function route(a, b, width, how, rooms) {
  const pa = Array.isArray(a) ? a : [a.cx, a.cy], pb = Array.isArray(b) ? b : [b.cx, b.cy];
  if (how === "straight") return [...pa, ...pb];
  if (how === "auto" && !Array.isArray(a) && !Array.isArray(b)) {
    const [ax0, ay0, ax1, ay1] = core(a), [bx0, by0, bx1, by1] = core(b);
    const lo = Math.max(ax0, bx0), hi = Math.min(ax1, bx1);
    if (hi - lo >= width + 1) {
      const x = Math.min(hi - width / 2, Math.max(lo + width / 2, snap((lo + hi) / 2, width)));
      return [x, pa[1], x, pb[1]];
    }
    const lo2 = Math.max(ay0, by0), hi2 = Math.min(ay1, by1);
    if (hi2 - lo2 >= width + 1) {
      const y = Math.min(hi2 - width / 2, Math.max(lo2 + width / 2, snap((lo2 + hi2) / 2, width)));
      return [pa[0], y, pb[0], y];
    }
  }
  const ax = Array.isArray(a) ? pa[0] : snap(pa[0], width), ay = Array.isArray(a) ? pa[1] : snap(pa[1], width);
  const bx = Array.isArray(b) ? pb[0] : snap(pb[0], width), by = Array.isArray(b) ? pb[1] : snap(pb[1], width);
  const hv = [ax, ay, bx, ay, bx, by], vh = [ax, ay, ax, by, bx, by];
  if (how === "hv") return hv;
  if (how === "vh") return vh;
  const blocked = (x, y) => rooms.some((g) => g !== a && g !== b && inPolygon(g.outline, x, y));
  return blocked(bx, ay) && !blocked(ax, by) ? vh : hv;
}
function exitPoint(outline2, pts2) {
  let along2 = 0;
  for (let i = 0; i + 3 < pts2.length; i += 2) {
    const x0 = pts2[i], y0 = pts2[i + 1], x1 = pts2[i + 2], y1 = pts2[i + 3];
    if (inPolygon(outline2, x1, y1)) {
      along2 += Math.hypot(x1 - x0, y1 - y0);
      continue;
    }
    let lo = 0, hi = 1;
    if (!inPolygon(outline2, x0, y0)) return null;
    for (let k = 0; k < 30; k++) {
      const t = (lo + hi) / 2;
      if (inPolygon(outline2, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) lo = t;
      else hi = t;
    }
    return { x: x0 + (x1 - x0) * lo, y: y0 + (y1 - y0) * lo, angle: Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI, along: along2 + Math.hypot(x1 - x0, y1 - y0) * lo };
  }
  return null;
}
var reversed = (p) => {
  const out = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
};
var pointEnd = (path) => ({ x: path[0], y: path[1], angle: Math.atan2(path[1] - path[3], path[0] - path[2]) * 180 / Math.PI, along: 0 });
function corridorGeom(c, index, rooms, byId, lineOf, spec) {
  const width = c.width ?? 1, how = c.route ?? "auto";
  const simple = (e) => "at" in e || "room" in e && e.side === void 0;
  let pts2;
  if (simple(c.from) && simple(c.to)) {
    const end = (e) => "room" in e ? byId.get(e.room) : e.at;
    const a = end(c.from), b = end(c.to), pa = Array.isArray(a) ? a : [a.cx, a.cy], pb = Array.isArray(b) ? b : [b.cx, b.cy];
    pts2 = c.via?.length ? [...pa, ...c.via, ...pb] : how === "around" ? around(pa, pb, a, b, width, rooms, spec) ?? route(a, b, width, "auto", rooms) : route(a, b, width, how, rooms);
  } else {
    const port = (e, other) => {
      if ("room" in e) {
        const g = byId.get(e.room);
        return e.side ? sidePort(g, e.side, e.offset, width) : { p: [g.cx, g.cy], room: g };
      }
      if ("at" in e) return { p: e.at };
      return junctionPort(lineOf.get(e.corridor) ?? [0, 0, 0, 0], e.near ?? other);
    };
    const guess = (e) => "room" in e ? [byId.get(e.room).cx, byId.get(e.room).cy] : "at" in e ? e.at : e.near ?? [spec.cols / 2, spec.rows / 2];
    const b0 = "corridor" in c.to ? null : port(c.to, guess(c.from)), a = port(c.from, b0 ? b0.stub ?? b0.p : guess(c.to)), b = b0 ?? port(c.to, a.stub ?? a.p);
    const A = a.stub ?? a.p, B = b.stub ?? b.p;
    const mid = c.via?.length ? [...A, ...c.via, ...B] : how === "straight" ? [...A, ...B] : how === "around" ? around(A, B, a.room ?? A, b.room ?? B, width, rooms, spec) ?? portRoute(a, b, width) : how === "hv" ? [...A, B[0], A[1], ...B] : how === "vh" ? [...A, A[0], B[1], ...B] : portRoute(a, b, width);
    pts2 = tidy([...a.p, ...mid, ...b.p]);
  }
  if (c.curve === "smooth") pts2 = smoothLine2(pts2);
  const ends = [[c.from, pts2], [c.to, reversed(pts2)]].map(([e, path]) => "room" in e ? exitPoint(byId.get(e.room).outline, path) : pointEnd(path));
  const outline2 = c.style === "natural" ? naturalOutline(pts2, width, c.seed ?? idSeed(c.id ?? `corridor-${index}`)) : void 0;
  return { index, pts: pts2, width, ends, ...outline2?.length && { outline: outline2 } };
}
function around(A, B, a, b, width, rooms, spec) {
  const avoid = rooms.filter((g) => g !== a && g !== b && g.room.fill !== "cellar" && g.room.fill !== "yard" && !inPolygon(g.outline, A[0], A[1]) && !inPolygon(g.outline, B[0], B[1]));
  return routeAround(A, B, width, avoid, spec.cols, spec.rows);
}
function layoutDungeon(spec) {
  let auto = 0;
  const rooms = spec.rooms.map((room, index) => {
    const outline2 = roomOutline(room), [cx, cy] = roomAnchor(room, outline2);
    const number = room.number === false ? void 0 : room.number ?? ++auto;
    if (typeof room.number === "number") auto = Math.max(auto, room.number);
    return { room, index, outline: outline2, cx, cy, number };
  });
  const byId = new Map(rooms.map((g) => [g.room.id, g]));
  const geoms = new Array(spec.corridors.length), lineOf = /* @__PURE__ */ new Map();
  for (const index of corridorOrder(spec.corridors) ?? spec.corridors.map((_, i) => i)) {
    const c = spec.corridors[index];
    geoms[index] = corridorGeom(c, index, rooms, byId, lineOf, spec);
    if (c.id) lineOf.set(c.id, geoms[index].pts);
  }
  const corridors = geoms, doors = [];
  corridors.forEach((g, index) => g.ends.forEach((p, i) => {
    const kind = spec.corridors[index].doors?.[i];
    if (p && kind) doors.push({ kind, x: p.x, y: p.y, angle: p.angle, width: g.width, corridor: index });
  }));
  const { connections, partitions } = layoutConnections(spec, rooms, byId);
  for (const c of connections) if (c.kind !== "open" && c.wall) doors.push({ kind: c.kind, x: c.x, y: c.y, angle: c.angle, width: c.width, corridor: -1, connection: c.index, inner: true });
  return { rooms, corridors, doors, connections, partitions };
}
var near2 = (a, b, e = 1e-6) => a.x <= b.x + b.w + e && b.x <= a.x + a.w + e && a.y <= b.y + b.h + e && b.y <= a.y + a.h + e;
function layoutConnections(spec, rooms, byId) {
  const connections = (spec.connections ?? []).map((c, index) => {
    const A = byId.get(c.a), B = byId.get(c.b), width = c.width ?? 1, kind = c.kind ?? "door";
    const segs = sharedEdges(A.outline, B.outline);
    if (!segs.length) {
      const [x2, y2] = c.at ?? [(A.cx + B.cx) / 2, (A.cy + B.cy) / 2];
      return { index, a: c.a, b: c.b, kind, x: x2, y: y2, angle: Math.atan2(B.cy - A.cy, B.cx - A.cx) * 180 / Math.PI, width, wall: null };
    }
    const len = (g) => Math.hypot(g[1][0] - g[0][0], g[1][1] - g[0][1]);
    const proj = (g, p) => {
      const L3 = len(g) || 1, t = ((p[0] - g[0][0]) * (g[1][0] - g[0][0]) + (p[1] - g[0][1]) * (g[1][1] - g[0][1])) / (L3 * L3);
      return t * L3;
    };
    const dist = (g, p) => {
      const t = Math.max(0, Math.min(len(g), proj(g, p))) / (len(g) || 1);
      return Math.hypot(g[0][0] + (g[1][0] - g[0][0]) * t - p[0], g[0][1] + (g[1][1] - g[0][1]) * t - p[1]);
    };
    const seg = c.at ? segs.reduce((m, g) => dist(g, c.at) < dist(m, c.at) ? g : m) : segs.reduce((m, g) => len(g) > len(m) ? g : m);
    const L2 = len(seg), ux = (seg[1][0] - seg[0][0]) / L2, uy = (seg[1][1] - seg[0][1]) / L2;
    let along2 = c.at ? proj(seg, c.at) : L2 / 2;
    if (!c.at) {
      const v = seg[0][0] * Math.abs(ux) + seg[0][1] * Math.abs(uy), sign = Math.abs(ux) > Math.abs(uy) ? Math.sign(ux) : Math.sign(uy);
      if (Math.abs(ux) < 1e-9 || Math.abs(uy) < 1e-9) along2 = (snap(v + sign * along2, width) - v) * sign;
    }
    along2 = L2 >= width ? Math.max(width / 2, Math.min(L2 - width / 2, along2)) : L2 / 2;
    const x = seg[0][0] + ux * along2, y = seg[0][1] + uy * along2;
    let nx = -uy, ny = ux;
    if ((B.cx - x) * nx + (B.cy - y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { index, a: c.a, b: c.b, kind, x, y, angle: Math.atan2(ny, nx) * 180 / Math.PI, width, wall: seg };
  });
  const partitions = [], floors = sharedWallsOn(spec) ? rooms.filter((g) => (g.room.fill ?? "floor") === "floor") : [];
  for (let i = 0; i < floors.length; i++) for (let j = i + 1; j < floors.length; j++) {
    const A = floors[i], B = floors[j];
    if (!near2(A.room, B.room)) continue;
    const gaps = connections.filter((c) => c.wall && (c.a === A.room.id && c.b === B.room.id || c.a === B.room.id && c.b === A.room.id));
    for (const seg of sharedEdges(A.outline, B.outline)) {
      const L2 = Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]), ux = (seg[1][0] - seg[0][0]) / L2, uy = (seg[1][1] - seg[0][1]) / L2;
      const cuts = gaps.map((c) => {
        const t = (c.x - seg[0][0]) * ux + (c.y - seg[0][1]) * uy, off = Math.abs((c.x - seg[0][0]) * uy - (c.y - seg[0][1]) * ux);
        return off < 1e-6 ? [t - c.width / 2, t + c.width / 2] : null;
      }).filter((v) => !!v).sort((p, q) => p[0] - q[0]);
      let from = 0;
      for (const [c0, c1] of [...cuts, [L2, L2]]) {
        if (c0 > from + 1e-6) partitions.push([seg[0][0] + ux * from, seg[0][1] + uy * from, seg[0][0] + ux * Math.min(c0, L2), seg[0][1] + uy * Math.min(c0, L2)]);
        from = Math.max(from, c1);
      }
    }
  }
  return { connections, partitions };
}
function contentBox(spec, l = layoutDungeon(spec)) {
  const xs = [], ys = [];
  const add = (p, pad = 0) => {
    for (let i = 0; i < p.length; i += 2) {
      xs.push(p[i] - pad, p[i] + pad);
      ys.push(p[i + 1] - pad, p[i + 1] + pad);
    }
  };
  for (const g of l.rooms) add(g.outline);
  for (const c of l.corridors) add(c.outline ?? c.pts, c.outline ? 0 : c.width / 2);
  for (const o of [...spec.overlay.labels, ...spec.overlay.symbols]) add([o.x, o.y], 0.5);
  for (const w of layoutWalls(spec, l)) {
    add(w.ring, w.thickness / 2);
    for (const t of w.towers) add([t.x, t.y], t.size / 2);
  }
  if (!xs.length) return null;
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function fitDungeon(spec, margin = 2) {
  const box2 = contentBox(spec);
  if (!box2) return spec;
  const dx = Math.round(margin - box2[0]), dy = Math.round(margin - box2[1]);
  const mv = (p) => p.map((v, i) => v + (i % 2 ? dy : dx));
  const out = structuredClone(spec);
  for (const r of out.rooms) {
    r.x += dx;
    r.y += dy;
    if (r.points) r.points = mv(r.points);
  }
  for (const c of out.corridors) {
    for (const e of [c.from, c.to]) {
      if ("at" in e) e.at = [e.at[0] + dx, e.at[1] + dy];
      if ("corridor" in e && e.near) e.near = [e.near[0] + dx, e.near[1] + dy];
    }
    if (c.via) c.via = mv(c.via);
  }
  for (const o of [...out.overlay.labels, ...out.overlay.symbols]) {
    o.x += dx;
    o.y += dy;
  }
  for (const c of out.connections ?? []) if (c.at) c.at = [c.at[0] + dx, c.at[1] + dy];
  for (const b of out.blocks ?? []) {
    b.x += dx;
    b.y += dy;
    if (b.points) b.points = mv(b.points);
    if (b.split.cuts) b.split.cuts = { ...b.split.cuts.x && { x: b.split.cuts.x.map((v) => v + dx) }, ...b.split.cuts.y && { y: b.split.cuts.y.map((v) => v + dy) } };
  }
  for (const w of out.walls ?? []) {
    if (w.poly) w.poly = mv(w.poly);
    for (const g of w.gates ?? []) g.at = [g.at[0] + dx, g.at[1] + dy];
  }
  if (out.underlay) out.underlay.origin = [out.underlay.origin[0] - dx * out.underlay.scale, out.underlay.origin[1] - dy * out.underlay.scale];
  out.cols = Math.max(4, Math.ceil(box2[2] + dx + margin));
  out.rows = Math.max(4, Math.ceil(box2[3] + dy + margin));
  return out;
}
function stretch(path, from, to) {
  const out = [];
  let at3 = 0;
  const point = (i, t) => [path[i] + (path[i + 2] - path[i]) * t, path[i + 1] + (path[i + 3] - path[i + 1]) * t];
  for (let i = 0; i + 3 < path.length; i += 2) {
    const len = Math.hypot(path[i + 2] - path[i], path[i + 3] - path[i + 1]);
    if (len > 0 && at3 + len > from && at3 < to) {
      out.push(...point(i, Math.max(0, (from - at3) / len)), ...point(i, Math.min(1, (to - at3) / len)));
    }
    at3 += len;
  }
  return out;
}
function findRoom(l, ref) {
  const hits2 = [(g) => g.room.id === ref, (g) => g.room.label === ref, (g) => g.room.label?.split(/\s+/)[0] === ref].map((test) => l.rooms.filter(test)).find((h) => h.length);
  if (!hits2) throw new Error(`--room: no room ${ref} (ids: ${l.rooms.map((g) => g.room.id).join(", ")}; labels: ${l.rooms.flatMap((g) => g.room.label ? [g.room.label.split(/\s+/)[0]] : []).join(", ")})`);
  if (hits2.length > 1) throw new Error(`--room: ${ref} names ${hits2.length} rooms (${hits2.map((g) => g.room.id).join(", ")}); use an id`);
  return hits2[0];
}
function roomCrop(spec, ids, margin = 2, l = layoutDungeon(spec)) {
  if (!ids.length) throw new Error("--room: at least one room id");
  const xs = [], ys = [];
  const add = (p, pad) => {
    for (let i = 0; i < p.length; i += 2) {
      xs.push(p[i] - pad, p[i] + pad);
      ys.push(p[i + 1] - pad, p[i + 1] + pad);
    }
  };
  for (const ref of ids) {
    const g = findRoom(l, ref), id = g.room.id;
    add(g.outline, 0.5);
    spec.corridors.forEach((sc, i) => {
      const c = l.corridors[i];
      [sc.from, sc.to].forEach((e, end) => {
        const x = c.ends[end];
        if (!("room" in e) || e.room !== id || !x) return;
        add(stretch(end === 0 ? c.pts : reversed(c.pts), x.along, x.along + margin), c.width / 2 + 0.5);
      });
    });
  }
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
}

// ../artgen-core/src/dungeon/blocks.ts
function hexPoints(x, y, w, h) {
  return [x + w / 4, y, x + 3 * w / 4, y, x + w, y + h / 2, x + 3 * w / 4, y + h, x + w / 4, y + h, x, y + h / 2];
}
function blockOutline(b) {
  return roomOutline({ id: b.id, shape: b.shape, x: b.x, y: b.y, w: b.w, h: b.h, ...b.points && { points: b.points } });
}
function clipToRect(poly, [x0, y0, x1, y1]) {
  let pts2 = [];
  for (let i = 0; i < poly.length; i += 2) pts2.push([poly[i], poly[i + 1]]);
  const edges2 = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]
  ];
  for (const [inside, cut] of edges2) {
    const out = [];
    pts2.forEach((p, i) => {
      const prev = pts2[(i + pts2.length - 1) % pts2.length];
      if (inside(p)) {
        if (!inside(prev)) out.push(cut(prev, p));
        out.push(p);
      } else if (inside(prev)) out.push(cut(prev, p));
    });
    pts2 = out;
    if (!pts2.length) return [];
  }
  const r = (v) => Math.round(v * 1e6) / 1e6, flat2 = [];
  for (const p of pts2.map(([x, y]) => [r(x), r(y)])) if (!flat2.length || flat2[flat2.length - 1][0] !== p[0] || flat2[flat2.length - 1][1] !== p[1]) flat2.push(p);
  if (flat2.length > 1 && flat2[0][0] === flat2[flat2.length - 1][0] && flat2[0][1] === flat2[flat2.length - 1][1]) flat2.pop();
  const keep = flat2.filter((p, i) => {
    const a = flat2[(i + flat2.length - 1) % flat2.length], b = flat2[(i + 1) % flat2.length];
    return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-9;
  });
  return keep.length >= 3 ? keep.flat() : [];
}
function pieces(b, rand) {
  const x0 = Math.floor(b.x), y0 = Math.floor(b.y), x1 = Math.ceil(b.x + b.w), y1 = Math.ceil(b.y + b.h);
  const min = Math.max(1, b.split.min ?? 3), mode = b.split.mode;
  const along2 = (lo, hi, cuts, n) => {
    const at3 = cuts?.length ? cuts.filter((c) => c > lo && c < hi).sort((p, q) => p - q) : Array.from({ length: n - 1 }, (_, i) => Math.round(lo + (hi - lo) * (i + 1) / n));
    return [lo, ...at3, hi];
  };
  if (mode === "rows" || mode === "cols" || mode === "grid" || mode === "cuts") {
    const xs = mode === "rows" || mode === "cuts" && !b.split.cuts?.x?.length ? [x0, x1] : along2(x0, x1, b.split.cuts?.x, Math.max(1, Math.floor((x1 - x0) / min)));
    const ys = mode === "cols" || mode === "cuts" && !b.split.cuts?.y?.length ? [y0, y1] : along2(y0, y1, b.split.cuts?.y, Math.max(1, Math.floor((y1 - y0) / min)));
    const out2 = [];
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) out2.push([xs[i], ys[j], xs[i + 1], ys[j + 1]]);
    return out2;
  }
  const out = [], cut = (r, depth) => {
    const w = r[2] - r[0], h = r[3] - r[1], big = w * h > min * min * 4;
    if (w < 2 * min && h < 2 * min || !big && depth > 1 && rand() < 0.35) {
      out.push(r);
      return;
    }
    const vertical = w < 2 * min ? false : h < 2 * min ? true : w / h > 1.25 ? true : h / w > 1.25 ? false : rand() < 0.5;
    const len = vertical ? w : h, at3 = (vertical ? r[0] : r[1]) + min + Math.floor(rand() * (len - 2 * min + 1));
    if (vertical) {
      cut([r[0], r[1], at3, r[3]], depth + 1);
      cut([at3, r[1], r[2], r[3]], depth + 1);
    } else {
      cut([r[0], r[1], r[2], at3], depth + 1);
      cut([r[0], at3, r[2], r[3]], depth + 1);
    }
  };
  cut([x0, y0, x1, y1], 0);
  return out;
}
function splitBlock(b) {
  const rand = rng(b.split.seed ?? idSeed(b.id)), outline2 = blockOutline(b), origin = `block:${b.id}`, min = Math.max(1, b.split.min ?? 3);
  const small = Math.max(2, min * min * 0.35), area = (r) => {
    const c = clipToRect(outline2, r);
    return c.length ? polygonArea(c) : 0;
  };
  let rects = pieces(b, rand).filter((r) => area(r) > 1e-6);
  for (let merged = true; merged; ) {
    merged = false;
    for (const r of rects) {
      if (area(r) >= small) continue;
      const side = rects.filter((n2) => n2 !== r && (n2[1] === r[1] && n2[3] === r[3] && (n2[2] === r[0] || n2[0] === r[2]) || n2[0] === r[0] && n2[2] === r[2] && (n2[3] === r[1] || n2[1] === r[3])));
      if (!side.length) continue;
      const n = side.reduce((m, x) => area(x) > area(m) ? x : m), u = [Math.min(r[0], n[0]), Math.min(r[1], n[1]), Math.max(r[2], n[2]), Math.max(r[3], n[3])];
      rects = [...rects.filter((x) => x !== r && x !== n), u];
      merged = true;
      break;
    }
  }
  rects.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const rooms = [];
  for (const r of rects) {
    const clip = clipToRect(outline2, r);
    if (!clip.length || polygonArea(clip) < small) continue;
    const id = `${b.id}-${rooms.length + 1}`, whole = Math.abs(polygonArea(clip) - (r[2] - r[0]) * (r[3] - r[1])) < 1e-6;
    rooms.push(whole ? { id, shape: "rect", x: r[0], y: r[1], w: r[2] - r[0], h: r[3] - r[1], origin } : { id, shape: "poly", points: clip, ...polyBox(clip), origin });
  }
  const outlines = rooms.map((r) => roomOutline(r)), pairs2 = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++)
    if (sharedEdges(outlines[i], outlines[j]).some(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= 1 - 1e-6)) pairs2.push([i, j]);
  for (let i = pairs2.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs2[i], pairs2[j]] = [pairs2[j], pairs2[i]];
  }
  const group = rooms.map((_, i) => i), find = (i) => group[i] === i ? i : group[i] = find(group[i]);
  const tree = /* @__PURE__ */ new Set(), extra = b.doors ?? 0.25;
  pairs2.forEach(([i, j], k) => {
    if (find(i) !== find(j)) {
      group[find(i)] = find(j);
      tree.add(k);
    }
  });
  const used = pairs2.filter((_, k) => tree.has(k) || rand() < extra);
  const kind = () => {
    const t = rand();
    return t < 0.12 ? "open" : t < 0.2 ? "secret" : void 0;
  };
  const connections = used.map(([i, j]) => {
    const k = kind();
    return { a: rooms[i].id, b: rooms[j].id, ...k && { kind: k }, origin };
  });
  return { rooms, connections };
}
function applyBlock(spec, id) {
  const b = spec.blocks?.find((x) => x.id === id);
  if (!b) throw new Error(`no block ${id} (have: ${(spec.blocks ?? []).map((x) => x.id).join(", ") || "none"})`);
  const origin = `block:${id}`, made = splitBlock(b), out = structuredClone(spec);
  const replace = (list3, fresh) => {
    const at3 = list3.findIndex((e) => e.origin === origin), rest = list3.filter((e) => e.origin !== origin);
    const pos = at3 < 0 ? rest.length : list3.slice(0, at3).filter((e) => e.origin !== origin).length;
    return [...rest.slice(0, pos), ...fresh, ...rest.slice(pos)];
  };
  out.rooms = replace(out.rooms, made.rooms);
  const ids = new Set(out.rooms.map((r) => r.id)), dropped = [];
  const conns = replace(out.connections ?? [], made.connections).filter((c) => {
    if (ids.has(c.a) && ids.has(c.b)) return true;
    dropped.push(`connection ${c.a} \u2194 ${c.b}: ${ids.has(c.a) ? c.b : c.a} is gone`);
    return false;
  });
  if (conns.length) out.connections = conns;
  else delete out.connections;
  const kept = out.corridors.filter((c) => {
    const gone = [c.from, c.to].find((e) => "room" in e && !ids.has(e.room));
    if (gone) dropped.push(`corridor ${"room" in c.from ? c.from.room : "from a point"} \u2192 ${"room" in c.to ? c.to.room : "a point"}: ${gone.room} is gone`);
    return !gone;
  });
  out.corridors = withoutDangling(kept);
  if (out.corridors.length < kept.length) dropped.push(`${kept.length - out.corridors.length} corridor(s) that joined those`);
  return { spec: out, dropped };
}
function removeBlock(spec, id) {
  const origin = `block:${id}`, gone = new Set(spec.rooms.filter((r) => r.origin === origin).map((r) => r.id));
  spec.blocks = (spec.blocks ?? []).filter((b) => b.id !== id);
  if (!spec.blocks.length) delete spec.blocks;
  spec.rooms = spec.rooms.filter((r) => !gone.has(r.id));
  if (spec.connections) {
    spec.connections = spec.connections.filter((c) => !gone.has(c.a) && !gone.has(c.b));
    if (!spec.connections.length) delete spec.connections;
  }
  spec.corridors = withoutDangling(spec.corridors.filter((c) => ![c.from, c.to].some((e) => "room" in e && gone.has(e.room))));
}
function blockRoomNear(spec, id, x, y) {
  const own = spec.rooms.filter((r) => r.origin === `block:${id}`);
  if (!own.length) return null;
  return own.reduce((m, r) => Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y) < Math.hypot(m.x + m.w / 2 - x, m.y + m.h / 2 - y) ? r : m).id;
}

// ../artgen-core/src/dungeon/generate.ts
var DOOR_WEIGHTS = { door: 70, secret: 8, locked: 10, portcullis: 6, arch: 6 };
function singleRoom(spec, o) {
  const m = o.margin ?? 3, out = structuredClone(spec);
  const room = { id: "r1", shape: o.shape, x: m, y: m, w: o.w, h: o.h, ...o.label && { label: o.label }, ...o.number !== void 0 && { number: o.number } };
  out.cols = o.w + 2 * m;
  out.rows = o.h + 2 * m;
  out.rooms = [room];
  out.corridors = (o.exits ?? []).map((e) => {
    const w = spec.gen.corridorWidth, odd = Math.round(w) % 2 === 1;
    const mid = (len) => e.at !== void 0 ? e.at : odd ? Math.floor(len / 2) + 0.5 : Math.round(len / 2);
    const at3 = e.side === "n" ? [m + mid(o.w), -1] : e.side === "s" ? [m + mid(o.w), out.rows + 1] : e.side === "w" ? [-1, m + mid(o.h)] : [out.cols + 1, m + mid(o.h)];
    const via = e.side === "n" || e.side === "s" ? [at3[0], m + o.h / 2] : [m + o.w / 2, at3[1]];
    return { from: { room: "r1" }, to: { at: at3, ...e.text && { exit: { text: e.text } } }, via, width: w, doors: [e.door === void 0 ? "door" : e.door, null] };
  });
  return out;
}
function generateDungeon(spec) {
  if (spec.gen.layout === "dense") return generateDense(spec);
  if (spec.gen.layout === "blocks") return generateBlocks(spec);
  const g = spec.gen, r = rng(spec.seed * 7919 + 13), out = structuredClone(spec);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const placed = [];
  const free = (x, y, w, h) => placed.every((p) => x >= p.x + p.w + g.spacing || p.x >= x + w + g.spacing || y >= p.y + p.h + g.spacing || p.y >= y + h + g.spacing);
  for (let n = 0; n < g.rooms; n++) {
    const roll = r(), shape = roll < g.caves ? "cave" : roll < g.caves + g.round ? r() < 0.5 ? "circle" : "octagon" : "rect";
    for (let tries = 0; tries < 400; tries++) {
      let w = int(g.minSize, g.maxSize), h = int(g.minSize, g.maxSize);
      if (shape === "circle" || shape === "octagon") {
        w = h = Math.max(w, 4);
        if (w % 2 === 0) {
          w++;
          h++;
        }
      }
      if (shape === "cave") {
        w = Math.max(w + 2, 5);
        h = Math.max(h + 1, 4);
      }
      if (w > spec.cols - 2 || h > spec.rows - 2) continue;
      const x = int(1, spec.cols - w - 1), y = int(1, spec.rows - h - 1);
      if (!free(x, y, w, h)) continue;
      placed.push({ id: "", shape, x, y, w, h });
      break;
    }
  }
  placed.sort((a, b) => Math.floor(a.y / 6) - Math.floor(b.y / 6) || a.x - b.x);
  placed.forEach((p, i) => {
    p.id = `r${i + 1}`;
  });
  const c = (p) => [p.x + p.w / 2, p.y + p.h / 2];
  const dist = (a, b) => Math.hypot(c(a)[0] - c(b)[0], c(a)[1] - c(b)[1]);
  const links = [], inTree = new Set(placed.length ? [0] : []);
  while (inTree.size < placed.length) {
    let best = [0, 0], bd = Infinity;
    for (const i of inTree) for (let j = 0; j < placed.length; j++) if (!inTree.has(j) && dist(placed[i], placed[j]) < bd) {
      bd = dist(placed[i], placed[j]);
      best = [i, j];
    }
    links.push(best);
    inTree.add(best[1]);
  }
  const has = (i, j) => links.some(([a, b]) => a === i && b === j || a === j && b === i);
  const extra = Math.round(g.loops * placed.length * 0.5);
  const cands = placed.flatMap((p, i) => placed.map((q, j) => [i, j, dist(p, q)]).filter(([, j]) => j > i)).filter(([i, j]) => !has(i, j)).sort((a, b) => a[2] - b[2]).slice(0, placed.length * 2);
  for (const [i, j] of cands) {
    if (links.length >= placed.length - 1 + extra) break;
    if (r() < 0.6) links.push([i, j]);
  }
  const door = (room) => {
    if (room.shape === "cave" || r() >= g.doors) return null;
    let t = r() * 100;
    for (const k of DOOR_KINDS) {
      t -= DOOR_WEIGHTS[k];
      if (t < 0) return k;
    }
    return "door";
  };
  const corridors = links.map(([i, j]) => ({ from: { room: placed[i].id }, to: { room: placed[j].id }, width: g.corridorWidth, doors: [door(placed[i]), door(placed[j])] }));
  if (g.entrance && placed.length) corridors.unshift(entrance(spec, placed[0], placed[0].shape === "cave" ? null : "door"));
  out.rooms = placed;
  out.corridors = corridors;
  delete out.connections;
  delete out.blocks;
  return out;
}
function entrance(spec, p, door) {
  const g = spec.gen, cx = p.x + p.w / 2, cy = p.y + p.h / 2, odd = Math.round(g.corridorWidth) % 2 === 1, s = (v) => odd ? Math.floor(v) + 0.5 : Math.round(v);
  const d = [[cy, "n"], [spec.rows - cy, "s"], [cx, "w"], [spec.cols - cx, "e"]];
  const side = d.reduce((a, b) => b[0] < a[0] ? b : a)[1];
  const at3 = side === "n" ? [s(cx), -1] : side === "s" ? [s(cx), spec.rows + 1] : side === "w" ? [-1, s(cy)] : [spec.cols + 1, s(cy)];
  const via = side === "n" || side === "s" ? [at3[0], cy] : [cx, at3[1]];
  return { from: { room: p.id }, to: { at: at3 }, via, width: g.corridorWidth, doors: [door, null] };
}
function doorOrOpen(r, doors) {
  if (r() >= doors) return "open";
  let t = r() * 100;
  for (const k of DOOR_KINDS) {
    t -= DOOR_WEIGHTS[k];
    if (t < 0) return k;
  }
  return "door";
}
function readingOrder(rooms) {
  rooms.sort((a, b) => Math.floor(a.y / 6) - Math.floor(b.y / 6) || a.x - b.x);
  rooms.forEach((p, i) => {
    p.id = `r${i + 1}`;
  });
}
function joinTouching(rooms, r, loops, doors) {
  const outlines = rooms.map(roomOutline), pairs2 = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++)
    if (sharedEdges(outlines[i], outlines[j]).some(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) >= 2 - 1e-6)) pairs2.push([i, j]);
  for (let i = pairs2.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pairs2[i], pairs2[j]] = [pairs2[j], pairs2[i]];
  }
  const group = rooms.map((_, i) => i), find = (i) => group[i] === i ? i : group[i] = find(group[i]);
  return pairs2.flatMap(([i, j]) => {
    const tree = find(i) !== find(j);
    if (tree) group[find(i)] = find(j);
    if (!tree && r() >= loops * 0.6) return [];
    const kind = doorOrOpen(r, doors);
    return [{ a: rooms[i].id, b: rooms[j].id, ...kind !== "door" && { kind } }];
  });
}
function generateDense(spec) {
  const g = spec.gen, r = rng(spec.seed * 7919 + 17), out = structuredClone(spec), int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const placed = [], target = (g.density ?? 0.5) * spec.cols * spec.rows;
  const fits = (x, y, w, h) => x >= 1 && y >= 1 && x + w <= spec.cols - 1 && y + h <= spec.rows - 1 && placed.every((p) => x >= p.x + p.w || p.x >= x + w || y >= p.y + p.h || p.y >= y + h);
  const touch = (x, y, w, h) => placed.reduce((n, p) => {
    const vx = Math.min(x + w, p.x + p.w) - Math.max(x, p.x), vy = Math.min(y + h, p.y + p.h) - Math.max(y, p.y);
    return n + ((x === p.x + p.w || p.x === x + w) && vy > 0 ? vy : 0) + ((y === p.y + p.h || p.y === y + h) && vx > 0 ? vx : 0);
  }, 0);
  const w0 = int(g.minSize, g.maxSize), h0 = int(g.minSize, g.maxSize);
  if (w0 <= spec.cols - 2 && h0 <= spec.rows - 2) placed.push({ id: "", shape: "rect", x: Math.floor((spec.cols - w0) / 2), y: Math.floor((spec.rows - h0) / 2), w: w0, h: h0 });
  for (let tries = 0; placed.length && placed.length < g.rooms && tries < g.rooms * 60; tries++) {
    if (placed.reduce((n, p) => n + p.w * p.h, 0) >= target) break;
    let best = null, bestScore = -1;
    for (let k = 0; k < 8; k++) {
      const p = placed[Math.floor(r() * placed.length)], w = int(g.minSize, g.maxSize), h = int(g.minSize, g.maxSize), side = Math.floor(r() * 4);
      const x = side === 1 ? p.x + p.w : side === 3 ? p.x - w : int(p.x - w + 2, p.x + p.w - 2);
      const y = side === 2 ? p.y + p.h : side === 0 ? p.y - h : int(p.y - h + 2, p.y + p.h - 2);
      if (!fits(x, y, w, h)) continue;
      const score = touch(x, y, w, h) + r() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = { id: "", shape: "rect", x, y, w, h };
      }
    }
    if (best) placed.push(best);
  }
  readingOrder(placed);
  out.rooms = placed;
  out.connections = joinTouching(placed, r, g.loops, g.doors);
  if (!out.connections.length) delete out.connections;
  out.corridors = g.entrance && placed.length ? [entrance(spec, edgeRoom(spec, placed), "door")] : [];
  delete out.blocks;
  return out;
}
function edgeRoom(spec, rooms) {
  const gap = (p) => Math.min(p.x, p.y, spec.cols - p.x - p.w, spec.rows - p.y - p.h);
  return rooms.reduce((m, p) => gap(p) < gap(m) ? p : m);
}
function generateBlocks(spec) {
  const g = spec.gen, r = rng(spec.seed * 7919 + 19), int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const n = Math.max(1, Math.min(6, Math.round(g.rooms / 5))), side = Math.round(Math.sqrt(Math.max(1, g.rooms / n)) * (g.minSize + g.maxSize) / 2);
  const gap = Math.max(2, g.spacing + g.corridorWidth + 1), boxes = [];
  for (let k = 0; k < n; k++) for (let tries = 0; tries < 300; tries++) {
    const w = Math.min(spec.cols - 4, int(Math.round(side * 0.75), Math.round(side * 1.3))), h = Math.min(spec.rows - 4, int(Math.round(side * 0.6), Math.round(side * 1.1)));
    if (w < g.minSize * 2 || h < g.minSize) break;
    const x = int(2, spec.cols - w - 2), y = int(2, spec.rows - h - 2);
    if (boxes.some((b) => !(x >= b[0] + b[2] + gap || b[0] >= x + w + gap || y >= b[1] + b[3] + gap || b[1] >= y + h + gap))) continue;
    boxes.push([x, y, w, h]);
    break;
  }
  let out = { ...structuredClone(spec), rooms: [], corridors: [], blocks: [] };
  delete out.connections;
  boxes.sort((a, b) => Math.floor(a[1] / 6) - Math.floor(b[1] / 6) || a[0] - b[0]);
  boxes.forEach(([x, y, w, h], k) => {
    const id = `b${k + 1}`, split = { mode: "bsp", min: g.minSize, seed: int(1, 1e6) }, roll = r();
    out.blocks.push(roll < g.round / 2 ? { id, shape: "poly", points: hexPoints(x, y, w, h), x, y, w, h, split, doors: g.loops } : roll < g.round ? { id, shape: "octagon", x, y, w, h, split, doors: g.loops } : { id, shape: "rect", x, y, w, h, split, doors: g.loops });
  });
  for (const b of out.blocks) out = applyBlock(out, b.id).spec;
  if (!out.blocks.length) delete out.blocks;
  const bs = out.blocks ?? [], c = (b) => [b.x + b.w / 2, b.y + b.h / 2], inTree = new Set(bs.length ? [0] : []), links = [];
  while (inTree.size < bs.length) {
    let best = [0, 0], bd = Infinity;
    for (const i of inTree) for (let j = 0; j < bs.length; j++) if (!inTree.has(j)) {
      const d = Math.hypot(c(bs[i])[0] - c(bs[j])[0], c(bs[i])[1] - c(bs[j])[1]);
      if (d < bd) {
        bd = d;
        best = [i, j];
      }
    }
    links.push(best);
    inTree.add(best[1]);
  }
  const facing = (from, to) => {
    const dx = c(to)[0] - c(from)[0], dy = c(to)[1] - c(from)[1];
    return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "e" : "w" : dy > 0 ? "s" : "n";
  };
  const port = (b, other) => {
    const side2 = facing(b, other), own = out.rooms.filter((r4) => r4.origin === `block:${b.id}` && r4.shape === "rect");
    const edge = (r4) => side2 === "e" ? r4.x + r4.w === Math.ceil(b.x + b.w) : side2 === "w" ? r4.x === Math.floor(b.x) : side2 === "s" ? r4.y + r4.h === Math.ceil(b.y + b.h) : r4.y === Math.floor(b.y);
    const on = own.filter(edge), o = c(other), d = (r4) => Math.hypot(r4.x + r4.w / 2 - o[0], r4.y + r4.h / 2 - o[1]);
    if (!on.length) return { room: blockRoomNear(out, b.id, o[0], o[1]) };
    return { room: on.reduce((m, r4) => d(r4) < d(m) ? r4 : m).id, side: side2 };
  };
  out.corridors = links.map(([i, j]) => ({ from: port(bs[i], bs[j]), to: port(bs[j], bs[i]), route: "around", width: g.corridorWidth, doors: ["door", "door"] }));
  if (g.entrance && out.rooms.length) out.corridors.unshift(entrance(spec, edgeRoom(spec, out.rooms), "door"));
  return out;
}

// ../artgen-core/src/dungeon/symbols.ts
var SYMBOLS2 = {
  stairs: { name: "Stairs (rise to the right)", svg: '<rect x="-9" y="-9" width="18" height="18" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-5.5 -9V9M-2 -9V9M1.5 -9V9M5 -9V9" stroke="{ink}" stroke-width="1.2"/>' },
  "stairs-up": { name: "Stairs up (climb toward its angle)", svg: '<path d="M-9 -4L9 -9V9L-9 4Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-5.5 -4.6V4.6M-2 -5.8V5.8M1.5 -7V7M5 -8.2V8.2" stroke="{ink}" stroke-width="1.2"/><path d="M-7.5 0H5.5M2.2 -3.2L5.8 0L2.2 3.2Z" fill="{ink}" stroke="{ink}" stroke-width="1.2" stroke-linejoin="round"/>' },
  "stairs-down": { name: "Stairs down (fall toward its angle)", svg: '<path d="M-9 -9L9 -4V4L-9 9Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-5.5 -8.2V8.2M-2 -7V7M1.5 -5.8V5.8M5 -4.6V4.6" stroke="{ink}" stroke-width="1.2" stroke-dasharray="2.2 1.4"/><path d="M-7.5 0H4M2.2 -3.2L5.8 0L2.2 3.2" fill="none" stroke="{ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' },
  curtain: { name: "Curtain (along an edge or across a passage)", svg: '<path d="M-9.5 0q1.6 -3.6 3.2 0t3.2 0t3.2 0t3.2 0t3.2 0t3.2 0" fill="none" stroke="{ink}" stroke-width="1.5" stroke-linecap="round"/><path d="M-9.5 -3V3M9.5 -3V3" stroke="{ink}" stroke-width="1.6" stroke-linecap="round"/>' },
  dais: { name: "Dais (a raised floor, by its outline)", svg: '<rect x="-9" y="-9" width="18" height="18" fill="{fill}" stroke="{ink}" stroke-width="1.6"/><rect x="-6" y="-6" width="12" height="12" fill="none" stroke="{ink}" stroke-width="0.9"/><path d="M-9 -9L-6 -6M9 -9L6 -6M-9 9L-6 6M9 9L6 6" stroke="{ink}" stroke-width="0.9"/>' },
  gate: { name: "Gate (a break in a wall line)", svg: SYMBOLS.gate.svg },
  ladder: { name: "Ladder / shaft", svg: '<circle r="8" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-3 -7V7M3 -7V7M-3 -3.5H3M-3 0H3M-3 3.5H3" stroke="{ink}" stroke-width="1.2"/>' },
  pillar: { name: "Pillar", svg: '<circle r="5.5" fill="{ink}"/>' },
  statue: { name: "Statue", svg: '<circle r="7" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M0 -4.5L1.3 -1.3L4.5 -1L2 1.2L2.8 4.5L0 2.8L-2.8 4.5L-2 1.2L-4.5 -1L-1.3 -1.3Z" fill="{ink}"/>' },
  altar: { name: "Altar", svg: '<rect x="-8" y="-4.5" width="16" height="9" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><path d="M0 -2.5V2.5M-2.5 0H2.5" stroke="{ink}" stroke-width="1.3"/>' },
  chest: { name: "Chest / treasure", svg: SYMBOLS.treasure.svg },
  trap: { name: "Trap", svg: '<rect x="-7" y="-7" width="14" height="14" fill="none" stroke="{ink}" stroke-width="1.3" stroke-dasharray="2.4 1.6"/><path d="M-4 -4L4 4M4 -4L-4 4" stroke="{ink}" stroke-width="1.5" stroke-linecap="round"/>' },
  pit: { name: "Pit", svg: '<rect x="-8" y="-8" width="16" height="16" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><path d="M-8 8L8 -8M-8 2L2 -8M-2 8L8 -2M-8 -4L-4 -8M4 8L8 4" stroke="{ink}" stroke-width="1"/>' },
  pool: { name: "Pool / well", svg: '<circle r="7.5" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><circle r="4.5" fill="none" stroke="{ink}" stroke-width="0.9"/><path d="M-2.5 0q1.25 -1.2 2.5 0t2.5 0" fill="none" stroke="{ink}" stroke-width="0.9"/>' },
  fountain: { name: "Fountain", svg: '<circle r="8.5" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><circle r="2.5" fill="{ink}"/><path d="M0 -6.5V-4M0 4V6.5M-6.5 0H-4M4 0H6.5" stroke="{ink}" stroke-width="1"/>' },
  rubble: { name: "Rubble", svg: '<path d="M-8 3L-5 0L-2 2.5L-4 6ZM1 -6L5 -7L6 -3L2 -2ZM2 3L6 2L7.5 6L3 7ZM-6 -6L-3 -7L-3 -3Z" fill="{ink}"/>' },
  throne: { name: "Throne", svg: '<path d="M-6 8V-8H6V8M-6 0H6" fill="{fill}" stroke="{ink}" stroke-width="1.5" stroke-linejoin="round"/><path d="M-6 -8L-3.5 -5L0 -8L3.5 -5L6 -8" fill="none" stroke="{ink}" stroke-width="1.2"/>' },
  bed: { name: "Bed", svg: '<rect x="-5" y="-8.5" width="10" height="17" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><rect x="-3.5" y="-7" width="7" height="3.5" fill="none" stroke="{ink}" stroke-width="1"/><path d="M-5 -1.5H5" stroke="{ink}" stroke-width="1"/>' },
  table: { name: "Table", svg: '<rect x="-8" y="-5" width="16" height="10" fill="{fill}" stroke="{ink}" stroke-width="1.5"/>' },
  coffin: { name: "Coffin / sarcophagus", svg: '<path d="M-3 -9H3L5 -4L3.5 9H-3.5L-5 -4Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M0 -5V3M-2.5 -2.5H2.5" stroke="{ink}" stroke-width="1.1"/>' },
  barrel: { name: "Barrel", svg: '<circle r="6" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><circle r="3.4" fill="none" stroke="{ink}" stroke-width="0.9"/>' },
  crate: { name: "Crate", svg: '<rect x="-6" y="-6" width="12" height="12" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-6 -6L6 6" stroke="{ink}" stroke-width="1.1"/>' },
  fire: { name: "Brazier / fire", svg: '<circle r="7" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M0 -5Q4 -1 2.5 3Q1.5 5 0 5Q-1.5 5 -2.5 3Q-4 -1 0 -5Z" fill="{ink}"/>' },
  web: { name: "Web", svg: '<path d="M-9 -9L9 9M9 -9L-9 9M0 -9V9M-9 0H9" stroke="{ink}" stroke-width="0.7"/><path d="M-3 -3Q0 -1.6 3 -3Q1.6 0 3 3Q0 1.6 -3 3Q-1.6 0 -3 -3ZM-6 -6Q0 -3.6 6 -6Q3.6 0 6 6Q0 3.6 -6 6Q-3.6 0 -6 -6Z" fill="none" stroke="{ink}" stroke-width="0.7"/>' },
  bones: { name: "Bones", svg: '<path d="M-6 -6L6 6M6 -6L-6 6" stroke="{ink}" stroke-width="2.2" stroke-linecap="round"/><circle cx="-6.5" cy="-6.5" r="1.8" fill="{ink}"/><circle cx="6.5" cy="-6.5" r="1.8" fill="{ink}"/><circle cx="-6.5" cy="6.5" r="1.8" fill="{ink}"/><circle cx="6.5" cy="6.5" r="1.8" fill="{ink}"/>' },
  skull: { name: "Danger", svg: SYMBOLS.skull.svg },
  door: { name: "Door (free-standing)", svg: '<rect x="-7" y="-2.5" width="14" height="5" fill="{fill}" stroke="{ink}" stroke-width="1.5"/>' },
  arrow: { name: "Arrow (way on)", svg: '<path d="M-8 0H5M1 -5L7 0L1 5" fill="none" stroke="{ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' }
};
var SYMBOL_KINDS2 = Object.keys(SYMBOLS2);

// ../artgen-core/src/dungeon/exits.ts
var EXIT_FADE = 3;
function pointAt(path, d) {
  let at3 = 0;
  for (let i = 0; i + 3 < path.length; i += 2) {
    const len = Math.hypot(path[i + 2] - path[i], path[i + 3] - path[i + 1]);
    if (at3 + len >= d && len > 0) {
      const t = (d - at3) / len;
      return [path[i] + (path[i + 2] - path[i]) * t, path[i + 1] + (path[i + 3] - path[i + 1]) * t];
    }
    at3 += len;
  }
  return [path[path.length - 2], path[path.length - 1]];
}
function onSheet(path, cols, rows2) {
  const inside = (x, y) => x >= 0 && y >= 0 && x <= cols && y <= rows2;
  if (inside(path[0], path[1])) return 0;
  let at3 = 0;
  for (let i = 0; i + 3 < path.length; i += 2) {
    const x0 = path[i], y0 = path[i + 1], x1 = path[i + 2], y1 = path[i + 3], len = Math.hypot(x1 - x0, y1 - y0);
    if (inside(x1, y1)) {
      const dx = x1 - x0, dy = y1 - y0;
      let t = 0;
      for (const [p, q] of [[-dx, x0], [dx, cols - x0], [-dy, y0], [dy, rows2 - y0]]) if (p < 0) t = Math.max(t, q / p);
      return at3 + len * t;
    }
    at3 += len;
  }
  return null;
}
function layoutExits(spec, l) {
  const out = [];
  spec.corridors.forEach((c, index) => {
    const g = l.corridors[index];
    [c.from, c.to].forEach((e, end) => {
      if (!("at" in e) || !e.exit) return;
      const path = [];
      if (end === 0) path.push(...g.pts);
      else for (let i = g.pts.length - 2; i >= 0; i -= 2) path.push(g.pts[i], g.pts[i + 1]);
      const s0 = onSheet(path, spec.cols, spec.rows);
      if (s0 === null) return;
      const fade = e.exit.fade ?? EXIT_FADE, edge = pointAt(path, s0), from = pointAt(path, s0 + fade), back = pointAt(path, s0 + Math.max(0.5, fade));
      const dx = edge[0] - back[0], dy = edge[1] - back[1], L2 = Math.hypot(dx, dy) || 1;
      out.push({ corridor: index, end, exit: e.exit, edge, from, dir: [dx / L2, dy / L2], off: s0 > 0, width: g.width });
    });
  });
  return out;
}

// ../artgen-core/src/dungeon/furniture.ts
var FURNITURE_PLACES = ["over", "outside", "auto"];
var FURNITURE_SIDES = ["bottom", "right"];
function coversContent(spec, l, k, box2) {
  const x0 = box2.x / k, y0 = box2.y / k, x1 = (box2.x + box2.w) / k, y1 = (box2.y + box2.h) / k, m = 0.14 * spec.style.wall + 0.3;
  const marks = [...spec.overlay.labels, ...spec.overlay.symbols].map((o) => ({ x: o.x - 0.6, y: o.y - 0.6, w: 1.2, h: 1.2 }));
  const cells = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  if (marks.some((b) => overlaps(b, cells))) return true;
  if (l.rooms.some((g) => overlaps({ x: g.cx - 0.6, y: g.cy - 0.6, w: 1.2, h: 1.2 }, cells))) return true;
  const walls = layoutWalls(spec, l);
  for (let y = y0; y <= y1 + 1e-9; y += 0.25) for (let x = x0; x <= x1 + 1e-9; x += 0.25) {
    for (const g of l.rooms) {
      if (g.room.x - m > x || g.room.x + g.room.w + m < x || g.room.y - m > y || g.room.y + g.room.h + m < y) continue;
      if (inPolygon(g.outline, x, y) || edges(g.outline).some(([a, b]) => segmentDistance(x, y, a, b) < m)) return true;
    }
    for (const c of l.corridors) if (nearestOnLine(c.pts, x, y).d < c.width / 2 + m) return true;
    for (const w of walls) if (edges(w.ring).some(([a, b]) => segmentDistance(x, y, a, b) < w.thickness / 2 + m)) return true;
  }
  return false;
}
function placeFurniture(items, fr, place2, side, pad, covers) {
  const out = items.map((item) => ({ item, outside: item.band || place2 === "outside" || place2 === "auto" && covers({ x: item.over.x, y: item.over.y, w: item.w, h: item.h }) }));
  const moved = out.filter((p) => p.outside).sort((a, b) => (a.item.rank ?? 0) - (b.item.rank ?? 0));
  const placed = [];
  let right = 0, bottom = 0;
  if (side === "bottom") {
    let x = fr.x + pad, y = fr.b + pad, row = 0;
    for (const p of moved) {
      if (x > fr.x + pad && x + p.item.w + pad > fr.r) {
        x = fr.x + pad;
        y += row + pad;
        row = 0;
      }
      placed.push({ item: p.item, x, y, outside: true });
      x += p.item.w + pad;
      row = Math.max(row, p.item.h);
      bottom = Math.max(bottom, y + row + pad - fr.b);
      right = Math.max(right, x - fr.r);
    }
  } else {
    let x = fr.r + pad, y = fr.y + pad, col = 0;
    for (const p of moved) {
      if (y > fr.y + pad && y + p.item.h + pad > fr.b) {
        y = fr.y + pad;
        x += col + pad;
        col = 0;
      }
      placed.push({ item: p.item, x, y, outside: true });
      y += p.item.h + pad;
      col = Math.max(col, p.item.w);
      right = Math.max(right, x + col + pad - fr.r);
      bottom = Math.max(bottom, y - fr.b);
    }
  }
  for (const p of out) if (!p.outside) placed.push({ item: p.item, x: p.item.over.x, y: p.item.over.y, outside: false });
  placed.sort((a, b) => items.indexOf(a.item) - items.indexOf(b.item));
  return { placed, band: { right: Math.max(0, right), bottom: Math.max(0, bottom) } };
}

// ../artgen-core/src/dungeon/underlay.ts
function underlayWindow(spec, map) {
  const u = spec.underlay;
  if (!u) return null;
  const x0 = Math.max(0, u.origin[0]), y0 = Math.max(0, u.origin[1]);
  const x1 = Math.min(map.cols, u.origin[0] + spec.cols * u.scale), y1 = Math.min(map.rows, u.origin[1] + spec.rows * u.scale);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
}
function underlaySvg(spec, map, k, field) {
  const u = spec.underlay, win = underlayWindow(spec, map);
  if (!u || !win) return "";
  const ppu = k / u.scale;
  const svg = renderMapSvg(map, {
    theme: u.theme ?? "color",
    ppu,
    crop: win,
    field: field ?? generateMap(map),
    layers: { legend: false, scale: false, compass: false, title: false, grid: false, labels: false, symbols: false }
  });
  const x = (win[0] - u.origin[0]) / u.scale * k, y = (win[1] - u.origin[1]) / u.scale * k;
  const placed = svg.replace(/^<svg ([^>]*?)width="[^"]*" height="[^"]*"/, (_m, pre) => `<svg ${pre}x="${n1(x)}" y="${n1(y)}" width="${n1(win[2] * ppu)}" height="${n1(win[3] * ppu)}"`).replace(/ id="([^"]+)"/g, ' id="u-$1"').replace(/url\(#([^)]+)\)/g, "url(#u-$1)");
  return `<g id="underlay">${placed}</g>`;
}

// ../artgen-core/src/dungeon/render.ts
var DUNGEON_LAYERS = ["underlay", "rock", "floors", "buildings", "enclosure", "grid", "exits", "doors", "symbols", "cellars", "numbers", "labels", "legend", "title", "scale", "compass"];
var INK = "#000000";
var PAPER = "#ffffff";
var TH = { ink: INK, paper: PAPER, halo: PAPER };
var ROOF = "#dcdcdc";
var RIDGE = "#8c8c8c";
var fillOf = (r) => r.fill ?? "floor";
var BASE_PX = { area: 24, name: 15, note: 12 };
function labelSize2(l, u, pageScale) {
  return (pageScale ? pointsToPx(PAGE_PT.dungeon[l.kind], pageScale) : BASE_PX[l.kind] * u) * (l.size ?? 1);
}
var numberSize = (u, pageScale) => pageScale ? pointsToPx(PAGE_PT.dungeon.number, pageScale) : 19 * u;
var nameSize = (u, pageScale) => pageScale ? pointsToPx(PAGE_PT.dungeon.room, pageScale) : 15 * u;
function dungeonLabelLayout(spec, k, pageScale, l = layoutDungeon(spec), numbers2 = spec.numbers) {
  const raw = spec.overlay.labels.map((lb) => ({ x: lb.x * k, y: lb.y * k }));
  if (!pageScale) return { at: raw, unplaced: [] };
  const u = pageUnit(pageScale), obstacles = spec.overlay.symbols.map((s) => {
    const z = PAGE_SYMBOL_MM * pageScale * (s.scale ?? 1);
    return { x: s.x * k - z / 2, y: s.y * k - z / 2, w: z, h: z };
  });
  for (const g of l.rooms) {
    const x = g.cx * k, y = g.cy * k, fs = numberSize(u, pageScale), badge2 = numbers2 && g.number !== void 0;
    if (badge2) {
      const txt = String(g.number), bh = fs * 1.45, bw = Math.max(bh, txt.length * fs * 0.62 + fs * 0.7);
      obstacles.push({ x: x - bw / 2, y: y - bh / 2, w: bw, h: bh });
    }
    if (g.room.label) obstacles.push(textBox(g.room.label, x, y + (badge2 ? fs * 1.6 : fs * 0.3), nameSize(u, pageScale), { bold: true }));
  }
  const items = spec.overlay.labels.map((lb) => {
    const size = labelSize2(lb, u, pageScale), text = lb.kind === "area" ? lb.text.toUpperCase() : lb.text;
    return { x: lb.x * k, y: lb.y * k, box: textBox(text, lb.x * k, lb.y * k + size * 0.35, size, { bold: lb.kind !== "note", spacing: lb.kind === "area" ? size * 0.16 : 0 }), clear: 0 };
  });
  const placed = placeLabels(items, obstacles, { x: 0, y: 0, w: spec.cols * k, h: spec.rows * k }, pageScale * 0.3);
  return { at: placed.map((p) => ({ x: p.x, y: p.y })), unplaced: placed.flatMap((p, index) => p.placed ? [] : [{ index, text: spec.overlay.labels[index].text }]) };
}
var LEGEND_NAMES = (kind) => (SYMBOLS2[kind] ?? SYMBOLS2.trap).name.split(" (")[0];
function dungeonLayersFor(spec, over = {}) {
  const on = Object.fromEntries(DUNGEON_LAYERS.map((l) => [l, true]));
  on.rock = spec.style.hatch !== "none";
  on.underlay = !!spec.underlay;
  on.enclosure = !!spec.walls?.length;
  on.legend = !!spec.legend;
  on.grid = spec.grid.show;
  on.numbers = spec.numbers;
  on.scale = spec.scaleBar;
  on.compass = spec.compass;
  on.title = !!spec.title;
  return { ...on, ...over };
}
function hatchPattern(k, cells = 4) {
  const T2 = cells * k, r = rng(7), step = 0.5 * k, L2 = 0.42 * k, gap = 0.11 * k, sw = Math.max(0.8, 0.045 * k);
  let d = "";
  for (let gy = 0; gy < T2 / step; gy++) for (let gx = 0; gx < T2 / step; gx++) {
    const cx = (gx + 0.5 + (r() - 0.5) * 0.5) * step, cy = (gy + 0.5 + (r() - 0.5) * 0.5) * step, a = r() * Math.PI;
    const dx = Math.cos(a) * L2 / 2, dy = Math.sin(a) * L2 / 2, px = -Math.sin(a) * gap, py = Math.cos(a) * gap;
    for (const ox of [-T2, 0, T2]) for (const oy of [-T2, 0, T2]) {
      const x = cx + ox, y = cy + oy;
      if (x < -L2 || y < -L2 || x > T2 + L2 || y > T2 + L2) continue;
      for (const s of [-1, 0, 1]) d += `M${n1(x - dx + px * s)} ${n1(y - dy + py * s)}L${n1(x + dx + px * s)} ${n1(y + dy + py * s)}`;
    }
  }
  return `<pattern id="hatch" patternUnits="userSpaceOnUse" width="${n1(T2)}" height="${n1(T2)}"><path d="${d}" stroke="${INK}" stroke-width="${n1(sw)}" stroke-linecap="round"/></pattern>`;
}
function doorSvg(dr, k, t, u) {
  const W = dr.width * k, d = Math.max(t * 1.5, 0.28 * k), hw = W / 2, sw = n1(Math.max(1, 1.4 * u));
  const rect = (x, y, w, h, fill) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="${fill}"${fill === PAPER ? ` stroke="${INK}" stroke-width="${sw}"` : ""}/>`;
  let g = "";
  if (dr.kind === "door") g = rect(-d / 2, -hw, d, W, PAPER);
  else if (dr.kind === "locked") g = rect(-d / 2, -hw, d, W, PAPER) + `<path d="M${n1(-d / 2)} 0H${n1(d / 2)}" stroke="${INK}" stroke-width="${n1(Math.max(2, d * 0.35))}"/>`;
  else if (dr.kind === "secret") g = rect(-t / 2 - 0.5, -hw - 0.5, t + 1, W + 1, INK);
  else if (dr.kind === "portcullis") {
    const n = Math.max(3, Math.round(dr.width * 4));
    for (let i = 0; i < n; i++) g += `<circle cy="${n1(-hw + W * (i + 0.5) / n)}" r="${n1(Math.max(1.2, 0.06 * k))}" fill="${INK}"/>`;
  } else if (dr.kind === "arch") g = rect(-d / 2, -hw - d * 0.25, d, d * 0.6, INK) + rect(-d / 2, hw - d * 0.35, d, d * 0.6, INK);
  const off = dr.inner ? 0 : t / 2, ox = dr.x * k + Math.cos(dr.angle * Math.PI / 180) * off, oy = dr.y * k + Math.sin(dr.angle * Math.PI / 180) * off;
  let out = `<g transform="translate(${n1(ox)} ${n1(oy)}) rotate(${n1(dr.angle)})">${g}</g>`;
  if (dr.kind === "secret") {
    const fs = Math.max(10, 0.5 * k);
    out += haloText("S", ox, oy + fs * 0.35, fs, INK, TH, 'font-weight="700"');
  }
  return out;
}
function wrapText(text, max) {
  const lines = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== void 0 && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.length ? lines : [""];
}
function clockwise(p) {
  if (area2(p) >= 0) return p;
  const out = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
}
var linked = (href, svg) => href ? `<a href="${esc(href)}">${svg}</a>` : svg;
function scaleCells2(width) {
  const target = width / 5;
  for (const n of [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40]) if (n >= target * 0.75) return n;
  return Math.max(1, Math.round(target));
}
function dungeonFurniture(spec, o = {}, l = o.layout ?? layoutDungeon(spec), on = dungeonLayersFor(spec, o.layers)) {
  const k = o.ppu ?? 40, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, fr = frameOf(o.crop, spec.cols, spec.rows, k), pad = 12 * u;
  const box2 = (x, y, w, h) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(u)}"/>`;
  const items = [];
  if (on.legend) {
    const kinds = [...new Set(spec.overlay.symbols.map((s) => s.kind))];
    if (kinds.length) {
      const rh = 22 * u, fs = 12 * u, w = 190 * u, h = kinds.length * rh + 12 * u;
      items.push({
        id: "legend",
        rank: 2,
        w,
        h,
        over: { x: fr.r - w - pad, y: fr.b - h - pad },
        draw: (x, y) => {
          let g = box2(x, y, w, h);
          kinds.forEach((kind, i) => {
            const sy = y + 6 * u + i * rh + rh / 2, sym = SYMBOLS2[kind] ?? SYMBOLS2.trap;
            g += `<g transform="translate(${n1(x + 18 * u)} ${n1(sy)}) scale(${(18 * u / 20).toFixed(3)})">${sym.svg.replaceAll("{ink}", INK).replaceAll("{fill}", PAPER)}</g>`;
            g += `<text x="${n1(x + 36 * u)}" y="${n1(sy + fs * 0.35)}" font-size="${n1(fs)}" fill="${INK}">${esc(LEGEND_NAMES(kind))}</text>`;
          });
          return `<g id="legend">${g}</g>`;
        }
      });
    }
  }
  if (on.scale) {
    const n = scaleCells2(fr.w / k), len = n * k, fs = 11 * u, seg = Math.min(4, n), w = len + 34 * u, h = 40 * u;
    items.push({
      id: "scale",
      rank: 1,
      w,
      h,
      over: { x: fr.x + pad, y: fr.b - pad - 38 * u },
      draw: (bx, by) => {
        const x = bx + 8 * u, y = by + 18 * u;
        let g = box2(bx, by, w, h);
        for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + len / seg * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? PAPER : INK}" stroke="${INK}" stroke-width="${n1(0.8 * u)}"/>`;
        g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${INK}" text-anchor="middle">0</text>`;
        g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${INK}" text-anchor="middle">${n * spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
        g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${INK}" text-anchor="middle">1 square = ${spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
        return `<g id="scale">${g}</g>`;
      }
    });
  }
  if (on.compass) items.push({ id: "compass", rank: 3, w: 40 * u, h: 52 * u, over: { x: fr.r - pad - 42 * u, y: fr.y + pad }, draw: (x, y) => compassSvg(x + 20 * u, y + 32 * u, 18 * u, u, TH) });
  if (on.title && spec.title) {
    const fs = 24 * u, w = Math.max(120 * u, spec.title.length * fs * 0.62 + 30 * u), h = fs * 1.7, title = spec.title;
    items.push({ id: "title", rank: 0, w, h, over: { x: fr.x + pad, y: fr.y + pad }, draw: (x, y) => `<g id="title">${box2(x, y, w, h)}<text x="${n1(x + w / 2)}" y="${n1(y + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.06)}" text-anchor="middle" fill="${INK}">${esc(title)}</text></g>` });
  }
  const f = spec.furniture ?? { place: "over" };
  return placeFurniture(items, fr, f.place, f.side ?? "bottom", pad, (b) => coversContent(spec, l, k, b));
}
function dungeonRenderSize(spec, o = {}) {
  const k = o.ppu ?? 40, fr = frameOf(o.crop, spec.cols, spec.rows, k), band = dungeonFurniture(spec, o).band;
  return { width: fr.w + band.right, height: fr.h + band.bottom, band };
}
function renderDungeonSvg(spec, o = {}) {
  const k = o.ppu ?? 40, W = spec.cols * k, H = spec.rows * k, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, t = 0.14 * k * spec.style.wall, fr = frameOf(o.crop, spec.cols, spec.rows, k);
  const l = o.layout ?? layoutDungeon(spec), on = dungeonLayersFor(spec, o.layers);
  const parts = [`<rect width="${W}" height="${H}" fill="${PAPER}"/>`], defs = [];
  const roomD = pathData([...l.rooms.filter((g) => fillOf(g.room) === "floor").map((g) => ({ pts: clockwise(g.outline), closed: true })), ...l.corridors.flatMap((c) => c.outline ? [{ pts: clockwise(c.outline), closed: true }] : [])], k);
  const corr = l.corridors.filter((c) => !c.outline).map((c) => ({ d: pathData([{ pts: c.pts, closed: false }], k), w: c.width * k }));
  if (on.underlay && spec.underlay && o.underlay) parts.push(underlaySvg(spec, o.underlay.map, k, o.underlay.field));
  if (on.rock && spec.style.hatch !== "none") {
    defs.push(hatchPattern(k));
    const band2 = spec.style.band * k;
    const g = spec.style.hatch === "full" ? `<rect width="${W}" height="${H}" fill="url(#hatch)"/>` : `<g fill="url(#hatch)" stroke="url(#hatch)" stroke-linejoin="round" stroke-linecap="round">${roomD ? `<path d="${roomD}" stroke-width="${n1(2 * (t + band2))}"/>` : ""}${corr.map((c) => `<path d="${c.d}" fill="none" stroke-width="${n1(c.w + 2 * (t + band2))}"/>`).join("")}</g>`;
    parts.push(`<g id="rock">${g}</g>`);
  }
  const floor2 = (fill, extra) => (roomD ? `<path d="${roomD}" fill="${fill}"${extra ? ` stroke="${fill}" stroke-width="${n1(extra * 2)}" stroke-linejoin="miter"` : ""}/>` : "") + corr.map((c) => `<path d="${c.d}" fill="none" stroke="${fill}" stroke-width="${n1(c.w + extra * 2)}" stroke-linecap="square" stroke-linejoin="miter"/>`).join("");
  const inner = l.partitions.length ? `<path id="partitions" d="${l.partitions.map((p) => `M${n1(p[0] * k)} ${n1(p[1] * k)}L${n1(p[2] * k)} ${n1(p[3] * k)}`).join("")}" stroke="${INK}" stroke-width="${n1(t * 1.1)}" stroke-linecap="square" fill="none"/>` : "";
  if (on.floors) parts.push(`<g id="floors"><g id="walls">${floor2(INK, t)}</g><g id="floor">${floor2(PAPER, 0)}</g>${inner}</g>`);
  const ofFill = (f) => l.rooms.filter((g) => fillOf(g.room) === f);
  if (on.buildings && ofFill("building").length) {
    const sw = n1(Math.max(1, t * 0.55));
    parts.push(`<g id="buildings">${ofFill("building").map((g) => {
      const d = pathData([{ pts: g.outline, closed: true }], k), r = g.room;
      const long = r.w >= r.h, inset = Math.min(0.5, (long ? r.h : r.w) / 2), ridge = r.shape === "rect" || r.shape === "octagon" ? long ? `M${n1((r.x + inset) * k)} ${n1((r.y + r.h / 2) * k)}H${n1((r.x + r.w - inset) * k)}` : `M${n1((r.x + r.w / 2) * k)} ${n1((r.y + inset) * k)}V${n1((r.y + r.h - inset) * k)}` : "";
      return `<path d="${d}" fill="${ROOF}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="miter"/>${ridge ? `<path d="${ridge}" stroke="${RIDGE}" stroke-width="${n1(Math.max(1, t * 0.5))}" stroke-linecap="round"/>` : ""}`;
    }).join("")}</g>`);
  }
  if (on.enclosure && spec.walls?.length) {
    const defs2 = [];
    let g = "";
    for (const w of layoutWalls(spec, l)) {
      const ring2 = pathData([{ pts: w.ring, closed: true }], k), th = w.thickness * k, cut = w.gates.map((gt) => `<rect x="${n1(-gt.width * k / 2)}" y="${n1(-th)}" width="${n1(gt.width * k)}" height="${n1(2 * th)}" transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(gt.angle)})" fill="#000"/>`).join("");
      const mid = `gates-${w.index}`;
      if (cut) defs2.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${cut}</mask>`);
      g += `<g id="wall-${w.index}"><g${cut ? ` mask="url(#${mid})"` : ""}><path d="${ring2}" fill="none" stroke="${INK}" stroke-width="${n1(th)}" stroke-linejoin="miter"/></g>`;
      const tower = (tw) => {
        const r = tw.size * k / 2, ring22 = Math.max(1, th * 0.4);
        return tw.shape === "square" ? `<rect x="${n1(tw.x * k - r)}" y="${n1(tw.y * k - r)}" width="${n1(2 * r)}" height="${n1(2 * r)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(ring22)}"/>` : `<circle cx="${n1(tw.x * k)}" cy="${n1(tw.y * k)}" r="${n1(r)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(ring22)}"/>`;
      };
      g += w.towers.map(tower).join("");
      g += w.gates.map((gt) => `<g transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(gt.angle)}) scale(${(gt.width * k / 10).toFixed(3)})">${SYMBOLS2.gate.svg.replaceAll("{ink}", INK).replaceAll("{fill}", PAPER)}</g>`).join("");
      g += "</g>";
    }
    defs.push(...defs2);
    parts.push(`<g id="enclosure">${g}</g>`);
  }
  if (on.grid && spec.grid.show) {
    const s = spec.grid.size, line2 = (step) => {
      let d = "";
      for (let x = 0; x <= spec.cols + 1e-9; x += step) d += `M${n1(x * k)} 0V${H}`;
      for (let y = 0; y <= spec.rows + 1e-9; y += step) d += `M0 ${n1(y * k)}H${W}`;
      return d;
    };
    let g = "";
    if (spec.grid.sub && s > 1) g += `<path d="${line2(1)}" stroke="${INK}" stroke-opacity="0.16" stroke-width="${n1(0.8 * u)}"/>`;
    g += `<path d="${line2(s)}" stroke="${INK}" stroke-opacity="0.38" stroke-width="${n1(1.1 * u)}"/>`;
    const clip = spec.grid.clip === "floor";
    if (clip) defs.push(`<mask id="floor-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${floor2("#ffffff", 0)}</mask>`);
    parts.push(`<g id="grid" fill="none"${clip ? ' mask="url(#floor-mask)"' : ""}>${g}</g>`);
  }
  const exits = on.exits ? layoutExits(spec, l) : [];
  if (exits.length) {
    let g = "";
    exits.forEach((x, i) => {
      const len = Math.hypot(x.edge[0] - x.from[0], x.edge[1] - x.from[1]) * k, ext = 2 * k, wide = (x.width + 1) * k + 2 * (t + (spec.style.hatch === "band" ? spec.style.band * k : 0));
      if (len > 0.5) {
        const angle = Math.atan2(x.dir[1], x.dir[0]) * 180 / Math.PI, stop = (len / (len + ext)).toFixed(3);
        defs.push(`<linearGradient id="exit-fade-${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${PAPER}" stop-opacity="0"/><stop offset="${stop}" stop-color="${PAPER}" stop-opacity="1"/></linearGradient>`);
        g += `<g transform="translate(${n1(x.from[0] * k)} ${n1(x.from[1] * k)}) rotate(${n1(angle)})"><rect x="0" y="${n1(-wide / 2)}" width="${n1(len + ext)}" height="${n1(wide)}" fill="url(#exit-fade-${i})"/></g>`;
      }
      const fs = o.pageScale ? pointsToPx(PAGE_PT.dungeon.note, o.pageScale) : 12 * u, lines = wrapText(x.exit.text, Math.abs(x.dir[0]) > Math.abs(x.dir[1]) ? 16 : 28);
      const w = Math.max(...lines.map((t2) => t2.length)) * fs * 0.56 + 14 * u, h = fs * (0.7 + 1.2 * lines.length);
      const reach = Math.abs(x.dir[0]) * w / 2 + Math.abs(x.dir[1]) * h / 2 + 4 * u;
      const cx = Math.min(fr.r - w / 2 - 2 * u, Math.max(fr.x + w / 2 + 2 * u, x.edge[0] * k - x.dir[0] * reach));
      const cy = Math.min(fr.b - h / 2 - 2 * u, Math.max(fr.y + h / 2 + 2 * u, x.edge[1] * k - x.dir[1] * reach));
      const text = lines.map((t2, j) => `<text x="${n1(cx)}" y="${n1(cy + fs * (0.35 + 1.2 * (j - (lines.length - 1) / 2)))}" font-size="${n1(fs)}" text-anchor="middle" fill="${INK}">${esc(t2)}</text>`).join("");
      g += linked(x.exit.href, `<rect x="${n1(cx - w / 2)}" y="${n1(cy - h / 2)}" width="${n1(w)}" height="${n1(h)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(1.2 * u)}"/>${text}`);
    });
    parts.push(`<g id="exits">${g}</g>`);
  }
  if (on.doors && l.doors.length) parts.push(`<g id="doors">${l.doors.map((d) => doorSvg(d, k, t, u)).join("")}</g>`);
  if (on.symbols && spec.overlay.symbols.length)
    parts.push(`<g id="symbols">${spec.overlay.symbols.map((s) => {
      const sym = SYMBOLS2[s.kind] ?? SYMBOLS2.trap;
      return `<g transform="translate(${n1(s.x * k)} ${n1(s.y * k)})${s.angle ? ` rotate(${n1(s.angle)})` : ""} scale(${((o.pageScale ? PAGE_SYMBOL_MM * o.pageScale : k) / 20 * (s.scale ?? 1)).toFixed(3)})">${sym.svg.replaceAll("{ink}", INK).replaceAll("{fill}", PAPER)}</g>`;
    }).join("")}</g>`);
  if (on.cellars && ofFill("cellar").length)
    parts.push(`<g id="cellars" fill="none" stroke="${INK}" stroke-width="${n1(Math.max(1.4 * u, t * 0.7))}" stroke-dasharray="${n1(6 * u)} ${n1(4 * u)}" stroke-linejoin="round">${ofFill("cellar").map((g) => `<path d="${pathData([{ pts: g.outline, closed: true }], k)}"/>`).join("")}</g>`);
  if (on.numbers || on.labels) {
    let nums4 = "", names = "";
    for (const g of l.rooms) {
      const x = g.cx * k, y = g.cy * k, badge2 = on.numbers && g.number !== void 0;
      if (badge2) {
        const txt = String(g.number), fs = numberSize(u, o.pageScale), bh = fs * 1.45, bw = Math.max(bh, txt.length * fs * 0.62 + fs * 0.7);
        nums4 += linked(g.room.href, `<rect x="${n1(x - bw / 2)}" y="${n1(y - bh / 2)}" width="${n1(bw)}" height="${n1(bh)}" rx="${n1(bh * 0.32)}" fill="${INK}"/><text x="${n1(x)}" y="${n1(y + fs * 0.36)}" font-size="${n1(fs)}" font-weight="700" text-anchor="middle" fill="${PAPER}">${esc(txt)}</text>`);
      }
      if (on.labels && g.room.label) names += linked(g.room.href, haloText(g.room.label, x, y + (badge2 ? numberSize(u, o.pageScale) * (31 / 19) : 5 * u), nameSize(u, o.pageScale), INK, TH, 'font-weight="700"'));
    }
    if (nums4) parts.push(`<g id="numbers">${nums4}</g>`);
    if (names) parts.push(`<g id="room-labels">${names}</g>`);
  }
  if (on.labels && spec.overlay.labels.length) {
    const at3 = dungeonLabelLayout(spec, k, o.pageScale, l, on.numbers).at;
    const g = spec.overlay.labels.map((lb, i) => {
      const base = labelSize2(lb, u, o.pageScale), lx = at3[i].x / k, ly = at3[i].y / k;
      const attrs = lb.kind === "area" ? `font-weight="700" letter-spacing="${n1(base * 0.16)}"` : lb.kind === "name" ? 'font-weight="700"' : 'font-style="italic"';
      const tx = haloText(lb.kind === "area" ? lb.text.toUpperCase() : lb.text, lx * k, ly * k + base * 0.35, base, INK, TH, attrs);
      return linked(lb.href, lb.angle ? `<g transform="rotate(${n1(lb.angle)} ${n1(lx * k)} ${n1(ly * k)})">${tx}</g>` : tx);
    }).join("");
    parts.push(`<g id="labels">${g}</g>`);
  }
  const furn = dungeonFurniture(spec, o, l, on);
  const drawn = furn.placed.map((p) => p.item.draw(p.x, p.y)).join("");
  const out = { ...fr, w: fr.w + furn.band.right, h: fr.h + furn.band.bottom, r: fr.r + furn.band.right, b: fr.b + furn.band.bottom };
  const band = furn.band.right || furn.band.bottom ? `<rect x="${n1(out.x)}" y="${n1(out.y)}" width="${n1(out.w)}" height="${n1(out.h)}" fill="${PAPER}"/>` : "";
  const frame = band ? `<rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}" fill="none" stroke="${INK}" stroke-width="${n1(1.5 * u)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(out, o.unit)} font-family="${FONT}"><defs>${defs.join("")}<clipPath id="map-clip"><rect x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}"/></clipPath></defs>${band}<g clip-path="url(#map-clip)">${parts.join("")}${band ? "" : drawn}</g>${frame}${band ? drawn : ""}</svg>`;
}

// ../artgen-core/src/dungeon/facts.ts
var RULES2 = {
  /** Positions, lengths and distances in cells. */
  position: 0.1
};
function dungeonFacts(spec, layout = layoutDungeon(spec)) {
  const per = spec.scale.perCell, rnd = (v) => roundTo(v, RULES2.position);
  const length = (cells) => {
    const m = rnd(cells);
    return { map: m, scale: rnd(m * per) };
  };
  const pt2 = (x, y) => [rnd(x), rnd(y)];
  const box2 = (b) => {
    const c = { x: rnd(b.x), y: rnd(b.y), w: rnd(b.w), h: rnd(b.h) };
    return { cells: c, scale: { x: rnd(c.x * per), y: rnd(c.y * per), w: rnd(c.w * per), h: rnd(c.h * per) } };
  };
  const roomOf = (e) => "room" in e ? e.room : null;
  const ends = ["from", "to"];
  const rooms = layout.rooms.map((g) => ({
    id: g.room.id,
    number: g.number ?? null,
    label: g.room.label ?? null,
    shape: g.room.shape,
    box: box2(g.room),
    doors: []
  }));
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const corridors = [], exits = [], reached = /* @__PURE__ */ new Set();
  spec.corridors.forEach((c, index) => {
    const geom = layout.corridors[index], doors = [c.doors?.[0] ?? null, c.doors?.[1] ?? null];
    let run = 0;
    for (let i = 2; i < geom.pts.length; i += 2) run += Math.hypot(geom.pts[i] - geom.pts[i - 2], geom.pts[i + 1] - geom.pts[i - 1]);
    run = Math.max(0, run - (geom.ends[0]?.along ?? 0) - (geom.ends[1]?.along ?? 0));
    const joins = ends.flatMap((side, k) => {
      const e = c[side];
      if (!("corridor" in e)) return [];
      const j = spec.corridors.findIndex((x) => x.id === e.corridor), p = geom.ends[k];
      return j >= 0 && p ? [{ corridor: j, at: pt2(p.x, p.y) }] : [];
    });
    corridors.push({ index, from: c.from, to: c.to, width: geom.width, doors, length: length(run), ...joins.length && { joins } });
    ends.forEach((side, k) => {
      const e = c[side], p = geom.ends[k], other = roomOf(c[ends[1 - k]]);
      if ("room" in e) {
        reached.add(e.room);
        if (doors[k]) byId.get(e.room)?.doors.push({ kind: doors[k], at: p ? pt2(p.x, p.y) : null, corridor: index, to: other });
      } else if ("at" in e) {
        const [x, y] = e.at, dist = [["n", y], ["e", spec.cols - x], ["s", spec.rows - y], ["w", x]];
        const [edge, d] = dist.reduce((a, b) => b[1] < a[1] ? b : a);
        exits.push({ corridor: index, end: side, at: pt2(x, y), room: other, door: doors[k], edge, distance: length(d), ...e.exit && { text: e.exit.text }, ...e.exit?.href && { href: e.exit.href } });
      }
    });
  });
  for (const c of layout.connections) for (const [id, other] of [[c.a, c.b], [c.b, c.a]]) {
    const r = byId.get(id);
    if (!r) continue;
    reached.add(id);
    (r.connections ??= []).push({ to: other, kind: c.kind, at: c.wall ? pt2(c.x, c.y) : null, connection: c.index });
  }
  const overlaps2 = [];
  for (let a = 0; a < layout.rooms.length; a++) for (let b = a + 1; b < layout.rooms.length; b++) {
    const A = layout.rooms[a], B = layout.rooms[b], cells = [];
    const x0 = Math.floor(Math.max(A.room.x, B.room.x)), x1 = Math.ceil(Math.min(A.room.x + A.room.w, B.room.x + B.room.w));
    const y0 = Math.floor(Math.max(A.room.y, B.room.y)), y1 = Math.ceil(Math.min(A.room.y + A.room.h, B.room.y + B.room.h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inPolygon(A.outline, x + 0.5, y + 0.5) && inPolygon(B.outline, x + 0.5, y + 0.5)) cells.push([x, y]);
    if (!cells.length) continue;
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]), bx = Math.min(...xs), by = Math.min(...ys);
    overlaps2.push({ rooms: [A.room.id, B.room.id], cells, count: cells.length, box: box2({ x: bx, y: by, w: Math.max(...xs) + 1 - bx, h: Math.max(...ys) + 1 - by }) });
  }
  return {
    version: spec.version,
    id: spec.id,
    size: { cols: spec.cols, rows: spec.rows },
    unit: { map: "cell", scale: spec.scale.unit },
    rules: RULES2,
    rooms,
    corridors,
    exits,
    overlaps: overlaps2,
    unreached: rooms.filter((r) => !reached.has(r.id)).map((r) => r.id),
    ...spec.walls?.length && { walls: wallFacts(spec, layout) }
  };
}

// ../artgen-core/src/dungeon/sync.ts
var MARK_DISTANCE2 = 0.75;
var markName2 = (m) => m.text !== void 0 ? `label "${m.text}"` : `symbol ${m.kind}`;
var insideRoom = (rooms, m) => rooms.find((g) => inPolygon(g.outline, m.x, m.y))?.room.id;
var overMark = (marks, m) => marks.find((o) => o !== m && near(o, m, MARK_DISTANCE2));
function syncDungeon(target, from, origin) {
  const conflicts = [], lists = {};
  const take = (name, a, b) => {
    const r = mergeList(name, a, b, origin);
    lists[name] = { removed: r.removed.length, added: b.length, kept: r.kept };
    return r;
  };
  const rooms = take("rooms", target.rooms, from.rooms);
  for (const old of rooms.removed) {
    const now = from.rooms.find((r) => r.id === old.id);
    if (!now || !old.hand?.length) continue;
    old.hand.forEach((field) => {
      const hand = old[field], table = now[field];
      if (JSON.stringify(hand) !== JSON.stringify(table))
        conflicts.push({ kind: "overridden", list: "rooms", index: target.rooms.indexOf(old), entry: old.id, field, hand, table, message: `${old.id}.${field}: the hand value ${JSON.stringify(hand)} is replaced by the table's ${JSON.stringify(table)}` });
    });
  }
  const corridors = take("corridors", target.corridors, from.corridors), walls = take("walls", target.walls ?? [], from.walls ?? []);
  const connections = take("connections", target.connections ?? [], from.connections ?? []);
  const labels = take("labels", target.overlay.labels, from.overlay.labels), symbols = take("symbols", target.overlay.symbols, from.overlay.symbols);
  const ids = new Set(rooms.list.map((r) => r.id));
  const dropped = (name, list3, source, refs) => list3.filter((e) => {
    const missing = refs(e).find((id) => !ids.has(id));
    if (missing === void 0 || e.origin === origin) return true;
    conflicts.push({ kind: "dropped", list: name, index: source.indexOf(e), message: `${name}[${source.indexOf(e)}] is dropped: it refers to ${missing}, which the sync removed` });
    return false;
  });
  const end = (e) => "room" in e ? [e.room] : [];
  const keptRooms = dropped("corridors", corridors.list, target.corridors, (c) => [...end(c.from), ...end(c.to)]);
  let keptCorridors = keptRooms;
  for (let changed = true; changed; ) {
    const corridorIds = new Set(keptCorridors.flatMap((c) => c.id ? [c.id] : []));
    const next = keptCorridors.filter((c) => {
      const missing = [c.from, c.to].find((e) => "corridor" in e && !corridorIds.has(e.corridor));
      if (!missing) return true;
      conflicts.push({ kind: "dropped", list: "corridors", index: target.corridors.indexOf(c), message: `corridors[${target.corridors.indexOf(c)}] is dropped: it joins corridor ${missing.corridor}, which the sync removed` });
      return false;
    });
    changed = next.length !== keptCorridors.length;
    keptCorridors = next;
  }
  const keptConnections = dropped("connections", connections.list, target.connections ?? [], (c) => [c.a, c.b]);
  const keptWalls = dropped("walls", walls.list, target.walls ?? [], (w) => [...w.rooms ?? [], ...(w.gates ?? []).flatMap((g) => g.room ? [g.room] : [])]);
  const spec = parseDungeon({
    ...target,
    rooms: rooms.list,
    corridors: keptCorridors,
    ...(target.walls?.length || from.walls?.length) && { walls: keptWalls },
    ...(target.connections?.length || from.connections?.length) && { connections: keptConnections },
    overlay: { labels: labels.list, symbols: symbols.list }
  });
  const before = layoutDungeon(target).rooms, after = layoutDungeon(spec).rooms;
  const oldMarks = [...target.overlay.labels, ...target.overlay.symbols], newMarks = [...spec.overlay.labels, ...spec.overlay.symbols], pre = [...labels.list, ...symbols.list];
  newMarks.forEach((m, i) => {
    if (m.origin !== void 0) return;
    const was = oldMarks.includes(pre[i]) ? pre[i] : void 0, room = insideRoom(after, m);
    if (room !== void 0 && !(was && insideRoom(before, was) !== void 0))
      conflicts.push({ kind: "inside-room", list: m.text !== void 0 ? "labels" : "symbols", index: oldMarks.indexOf(pre[i]), message: `hand ${markName2(m)} at ${m.x},${m.y} is now inside room ${room}` });
    const over = overMark(newMarks, m);
    if (over && !(was && overMark(oldMarks, was)))
      conflicts.push({ kind: "over-mark", list: m.text !== void 0 ? "labels" : "symbols", index: oldMarks.indexOf(pre[i]), message: `hand ${markName2(m)} at ${m.x},${m.y} is now over ${markName2(over)}` });
  });
  return { spec, report: { version: DUNGEON_FORMAT, origin, lists, conflicts } };
}

// ../artgen-core/src/dungeon/lint.ts
var MIN_AREA = 0.5;
var LABEL_CELLS = { area: 24 / 40, name: 15 / 40, note: 12 / 40 };
var NUMBER_CELLS = 19 / 40;
function badgeBox(g) {
  if (g.number === void 0) return null;
  const fs = NUMBER_CELLS, bh = fs * 1.45, bw = Math.max(bh, String(g.number).length * fs * 0.62 + fs * 0.7);
  return { x: g.cx - bw / 2, y: g.cy - bh / 2, w: bw, h: bh };
}
var passable = (g) => g.room.fill === "cellar" || g.room.fill === "yard";
function lintDungeon(spec, l = layoutDungeon(spec)) {
  const out = [];
  const add = (severity, path, message) => out.push({ severity, path, message });
  const offSheet = (x, y, pad = 0) => x < -pad || y < -pad || x > spec.cols + pad || y > spec.rows + pad;
  l.rooms.forEach((g, i) => {
    const at3 = `rooms[${i}]`, p = g.outline;
    let crossed = false;
    if (g.room.shape === "poly") {
      const pts2 = p.length / 2;
      for (let k = 0; k < pts2; k++) {
        const j = (k + 1) % pts2;
        if (Math.hypot(p[2 * j] - p[2 * k], p[2 * j + 1] - p[2 * k + 1]) < 1e-9) {
          add("warning", `${at3}.points`, `corner ${j} repeats corner ${k} (a zero-length wall)`);
          break;
        }
      }
      const x = selfCrossing(p);
      if (x) {
        add("error", `${at3}.points`, `the outline crosses itself (walls ${x[0]} and ${x[1]}); list the corners in order round the room`);
        crossed = true;
      }
    }
    if (!crossed && Math.abs(area2(p)) / 2 < MIN_AREA) add("error", at3, `${g.room.id} has almost no floor (${(Math.abs(area2(p)) / 2).toFixed(2)} square cells)`);
    const r = g.room;
    if (r.x + r.w <= 0 || r.y + r.h <= 0 || r.x >= spec.cols || r.y >= spec.rows) add("warning", at3, `${r.id} is off the sheet (0,0 to ${spec.cols},${spec.rows})`);
    else if (r.x < 0 || r.y < 0 || r.x + r.w > spec.cols || r.y + r.h > spec.rows) add("warning", at3, `${r.id} runs off the sheet (0,0 to ${spec.cols},${spec.rows}); \`dungeon fit\` makes room`);
  });
  for (let a = 0; a < l.rooms.length; a++) for (let b = a + 1; b < l.rooms.length; b++) {
    const A = l.rooms[a], B = l.rooms[b];
    if ([A, B].some((g) => g.room.fill === "cellar")) continue;
    const x0 = Math.floor(Math.max(A.room.x, B.room.x)), x1 = Math.ceil(Math.min(A.room.x + A.room.w, B.room.x + B.room.w));
    const y0 = Math.floor(Math.max(A.room.y, B.room.y)), y1 = Math.ceil(Math.min(A.room.y + A.room.h, B.room.y + B.room.h));
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inPolygon(A.outline, x + 0.5, y + 0.5) && inPolygon(B.outline, x + 0.5, y + 0.5)) n++;
    if (n) add("warning", `rooms[${b}]`, `${B.room.id} lies over ${A.room.id} (${n} cell${n === 1 ? "" : "s"}); the wall between them is not drawn`);
  }
  const roomsOf = (i) => new Set([spec.corridors[i].from, spec.corridors[i].to].flatMap((e) => "room" in e ? [e.room] : []));
  l.corridors.forEach((c, i) => {
    const sc = spec.corridors[i], at3 = `corridors[${i}]`, joins = roomsOf(i);
    const v = sc.via ?? [];
    for (let k = 2; k < v.length; k += 2) if (v[k] === v[k - 2] && v[k + 1] === v[k - 1]) {
      add("warning", `${at3}.via`, `bend ${k / 2} repeats bend ${k / 2 - 1}`);
      break;
    }
    ["from", "to"].forEach((side, k) => {
      const e = sc[side];
      if ("room" in e && !c.ends[k]) add("warning", `${at3}.${side}`, `the corridor never leaves ${e.room} (it ends inside it)${sc.doors?.[k] ? `, so its ${sc.doors[k]} is not drawn` : ""}`);
      if ("at" in e) {
        const inside = l.rooms.find((g) => inPolygon(g.outline, e.at[0], e.at[1]));
        if (inside) add("warning", `${at3}.${side}`, `ends at ${e.at.join(",")}, inside ${inside.room.id}; link to the room instead`);
      }
    });
    if (lineLength2(c.pts) < 1e-9) add("warning", at3, "the corridor has no length (both ends at one point), so nothing is drawn");
    const hit = /* @__PURE__ */ new Set();
    for (const [x, y] of samples(c.pts, 0.25)) for (const g of l.rooms) {
      if (joins.has(g.room.id) || passable(g) || hit.has(g.room.id)) continue;
      if (inPolygon(g.outline, x, y)) hit.add(g.room.id);
    }
    for (const id of hit) add("warning", at3, `runs through ${id}, which it does not join (set via or route, or link through ${id})`);
  });
  const joined = (a, b) => [spec.corridors[a].from, spec.corridors[a].to].some((e) => "corridor" in e && e.corridor === spec.corridors[b].id) || [spec.corridors[b].from, spec.corridors[b].to].some((e) => "corridor" in e && e.corridor === spec.corridors[a].id);
  for (let a = 0; a < l.corridors.length; a++) for (let b = a + 1; b < l.corridors.length; b++) {
    if (joined(a, b)) continue;
    const A = l.corridors[a].pts, B = l.corridors[b].pts;
    let found = null;
    for (let i = 0; i + 3 < A.length && !found; i += 2) for (let j = 0; j + 3 < B.length && !found; j += 2) {
      const x = segmentCross([A[i], A[i + 1]], [A[i + 2], A[i + 3]], [B[j], B[j + 1]], [B[j + 2], B[j + 3]]);
      if (x && !l.rooms.some((g) => inPolygon(g.outline, x[0], x[1]))) found = x;
    }
    if (found) add("warning", `corridors[${b}]`, `crosses corridor ${a} at ${found.map((v) => v.toFixed(1)).join(",")} with no junction (the floors join there)`);
  }
  l.connections.forEach((c, i) => {
    const at3 = `connections[${i}]`;
    if (!c.wall) {
      add("warning", at3, `${c.a} and ${c.b} share no wall, so the ${c.kind === "open" ? "opening" : c.kind} is not drawn; move one room against the other, or link them with a corridor`);
      return;
    }
    const len = Math.hypot(c.wall[1][0] - c.wall[0][0], c.wall[1][1] - c.wall[0][1]);
    if (len < c.width - 1e-6) add("warning", at3, `the wall ${c.a} and ${c.b} share is ${len.toFixed(1)} cells, narrower than the ${c.width}-cell ${c.kind === "open" ? "opening" : c.kind}`);
    const sc = spec.connections[i];
    if (sc.at && Math.hypot(sc.at[0] - c.x, sc.at[1] - c.y) > 0.75) add("warning", `${at3}.at`, `${sc.at.join(",")} is not on the wall ${c.a} and ${c.b} share; the ${c.kind === "open" ? "opening" : c.kind} is at ${c.x.toFixed(1)},${c.y.toFixed(1)}`);
  });
  const badges = spec.numbers ? l.rooms.flatMap((g) => {
    const b = badgeBox(g);
    return b ? [{ g, b }] : [];
  }) : [];
  spec.overlay.symbols.forEach((s, i) => {
    const at3 = `overlay.symbols[${i}]`, z = (s.scale ?? 1) * 0.9, box2 = { x: s.x - z / 2, y: s.y - z / 2, w: z, h: z };
    if (offSheet(s.x, s.y)) add("warning", at3, `${s.kind} at ${s.x},${s.y} is off the sheet`);
    const on = badges.find(({ b }) => overlaps(box2, b));
    if (on) add("warning", at3, `${s.kind} at ${s.x},${s.y} is under room ${on.g.room.id}'s number; move the symbol`);
  });
  const labelBoxes = spec.overlay.labels.map((lb) => {
    const size = LABEL_CELLS[lb.kind] * (lb.size ?? 1), text = lb.kind === "area" ? lb.text.toUpperCase() : lb.text;
    return textBox(text, lb.x, lb.y + size * 0.35, size, { bold: lb.kind !== "note", spacing: lb.kind === "area" ? size * 0.16 : 0 });
  });
  spec.overlay.labels.forEach((lb, i) => {
    const at3 = `overlay.labels[${i}]`;
    if (offSheet(lb.x, lb.y)) add("warning", at3, `"${lb.text}" at ${lb.x},${lb.y} is off the sheet`);
    const other = labelBoxes.findIndex((b, j) => j < i && !lb.angle && !spec.overlay.labels[j].angle && overlaps(labelBoxes[i], b));
    if (other >= 0) add("warning", at3, `"${lb.text}" overlaps label ${other} "${spec.overlay.labels[other].text}"`);
  });
  return out;
}

// ../artgen-core/src/settlement/index.ts
var settlement_exports = {};
__export(settlement_exports, {
  AREA_KINDS: () => AREA_KINDS,
  BUILDING_KINDS: () => BUILDING_KINDS,
  BUILDING_MODES: () => BUILDING_MODES,
  BUILDING_SHAPES: () => BUILDING_SHAPES,
  CURVES: () => CURVES2,
  DEFAULTS: () => DEFAULTS2,
  FIXTURES: () => FIXTURES,
  FIXTURE_KINDS: () => FIXTURE_KINDS,
  GATE_FT: () => GATE_FT,
  GATE_KINDS: () => GATE_KINDS2,
  GEN_WALLS: () => GEN_WALLS,
  GEN_WATERS: () => GEN_WATERS,
  GROUNDS: () => GROUNDS,
  KIND_DEFAULTS: () => KIND_DEFAULTS,
  LABEL_KINDS: () => LABEL_KINDS3,
  MAX_SIDE: () => MAX_SIDE3,
  PALETTES: () => PALETTES,
  PLAN_LAYERS: () => PLAN_LAYERS,
  PLAN_MARGIN: () => PLAN_MARGIN,
  ROAD_KINDS: () => ROAD_KINDS,
  ROAD_WIDTH_FT: () => ROAD_WIDTH_FT,
  ROOFS: () => ROOFS,
  SETTLEMENT_FORMAT: () => SETTLEMENT_FORMAT,
  SETTLEMENT_KINDS: () => SETTLEMENT_KINDS,
  SETTLEMENT_OPS: () => SETTLEMENT_OPS,
  SITE_LAYERS: () => SITE_LAYERS,
  STREET_PLANS: () => STREET_PLANS,
  SYMBOLS: () => SYMBOLS3,
  SYMBOL_KINDS: () => SYMBOL_KINDS3,
  THEMES: () => THEMES2,
  TOWER_FT: () => TOWER_FT,
  TOWER_SHAPES: () => TOWER_SHAPES,
  TREE_FT: () => TREE_FT,
  TREE_KINDS: () => TREE_KINDS,
  VIEWS: () => VIEWS,
  WALL_KINDS: () => WALL_KINDS,
  WALL_THICK_FT: () => WALL_THICK_FT,
  WATER_KINDS: () => WATER_KINDS,
  WATER_LINES: () => WATER_LINES,
  WATER_WIDTH_FT: () => WATER_WIDTH_FT,
  buildingAt: () => buildingAt,
  buildingWings: () => buildingWings,
  checkSettlement: () => checkSettlement,
  editSettlement: () => editSettlement,
  feetIn: () => feetIn2,
  fixtureSize: () => fixtureSize,
  floorAsDungeon: () => floorAsDungeon,
  floorAt: () => floorAt,
  floorName: () => floorName,
  footprint: () => footprint,
  frontSide: () => frontSide,
  generateInterior: () => generateInterior,
  generateSettlement: () => generateSettlement,
  groundFloor: () => groundFloor,
  groundFromMap: () => groundFromMap,
  inWater: () => inWater,
  layoutFloor: () => layoutFloor,
  layoutSettlement: () => layoutSettlement,
  lintSettlement: () => lintSettlement,
  newSettlement: () => newSettlement,
  nextId: () => nextId,
  parseSettlement: () => parseSettlement,
  planFactor: () => planFactor,
  planOutline: () => planOutline,
  planSheet: () => planSheet,
  planTarget: () => planTarget,
  planToSite: () => planToSite,
  removeBuilding: () => removeBuilding,
  renderSettlementSvg: () => renderSettlementSvg,
  roadWidth: () => roadWidth,
  roofOf: () => roofOf,
  rotatePts: () => rotatePts,
  settlementFacts: () => settlementFacts,
  settlementFromMap: () => settlementFromMap,
  settlementLayersFor: () => settlementLayersFor,
  settlementRenderSize: () => settlementRenderSize,
  siteToPlan: () => siteToPlan,
  snapToLine: () => snapToLine,
  storiesOf: () => storiesOf,
  unitsToCells: () => unitsToCells,
  validateSettlement: () => validateSettlement,
  wallThickness: () => wallThickness,
  waterWidth: () => waterWidth,
  withInterior: () => withInterior
});

// ../artgen-core/src/settlement/fixtures.ts
var R = (x, y, w, h, fill, s, extra = "") => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="${fill}" stroke="{ink}" stroke-width="${n1(s)}"${extra}/>`;
var C = (cx, cy, r, fill, s) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(Math.max(0.5, r))}" fill="${fill}" stroke="{ink}" stroke-width="${n1(s)}"/>`;
var E = (rx, ry, fill, s) => `<ellipse rx="${n1(Math.max(0.5, rx))}" ry="${n1(Math.max(0.5, ry))}" fill="${fill}" stroke="{ink}" stroke-width="${n1(s)}"/>`;
var L = (d, s, color = "{ink}") => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n1(s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
var box = (w, h, fill, s) => R(-w / 2, -h / 2, w, h, fill, s);
var treads = (w, h, n) => {
  let d = "";
  for (let i = 1; i < n; i++) {
    const x = -w / 2 + w * i / n;
    d += `M${n1(x)} ${n1(-h / 2)}V${n1(h / 2)}`;
  }
  return d;
};
var FIXTURES = {
  // furniture
  bed: { name: "Bed", ft: [3, 6], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + R(-w * 0.35, -h / 2 + h * 0.06, w * 0.7, h * 0.18, "{paper}", s * 0.7) + L(`M${n1(-w / 2)} ${n1(-h * 0.12)}H${n1(w / 2)}`, s * 0.7) },
  "double-bed": { name: "Double bed", ft: [5, 6.5], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + R(-w * 0.44, -h / 2 + h * 0.06, w * 0.4, h * 0.16, "{paper}", s * 0.7) + R(w * 0.04, -h / 2 + h * 0.06, w * 0.4, h * 0.16, "{paper}", s * 0.7) + L(`M${n1(-w / 2)} ${n1(-h * 0.14)}H${n1(w / 2)}`, s * 0.7) },
  table: { name: "Table", ft: [6, 3], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) },
  "round-table": { name: "Round table", ft: [4, 4], group: "furniture", draw: (w, h, s) => E(w / 2, h / 2, "{fill}", s) },
  "long-table": { name: "Long table (feast)", ft: [16, 3.5], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + L(`M${n1(-w / 2 + h * 0.3)} 0H${n1(w / 2 - h * 0.3)}`, s * 0.5) },
  chair: { name: "Chair", ft: [1.6, 1.6], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s * 0.8) + L(`M${n1(-w / 2)} ${n1(-h / 2 + h * 0.2)}H${n1(w / 2)}`, s * 1.2) },
  stool: { name: "Stool", ft: [1.3, 1.3], group: "furniture", draw: (w, h, s) => E(w / 2, h / 2, "{fill}", s * 0.8) },
  bench: { name: "Bench", ft: [5, 1.2], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s * 0.8) },
  chest: { name: "Chest", ft: [3, 1.6], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + L(`M${n1(-w / 2)} ${n1(-h * 0.1)}H${n1(w / 2)}`, s * 0.7) + R(-w * 0.07, -h * 0.2, w * 0.14, h * 0.3, "{accent}", s * 0.5) },
  wardrobe: { name: "Wardrobe", ft: [4, 2], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + L(`M0 ${n1(-h / 2)}V${n1(h / 2)}`, s * 0.7) },
  shelf: { name: "Shelves", ft: [4, 1.2], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + L(`M${n1(-w / 6)} ${n1(-h / 2)}V${n1(h / 2)}M${n1(w / 6)} ${n1(-h / 2)}V${n1(h / 2)}`, s * 0.5) },
  bookcase: { name: "Bookcase", ft: [4, 1.5], group: "furniture", draw: (w, h, s) => {
    let d = "";
    for (let i = 1; i < 8; i++) d += `M${n1(-w / 2 + w * i / 8)} ${n1(-h / 2 + h * 0.2)}V${n1(h / 2 - h * 0.15)}`;
    return box(w, h, "{fill}", s) + L(d, s * 0.5);
  } },
  desk: { name: "Desk", ft: [4, 2.2], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + R(w * 0.15, -h / 2, w * 0.35, h, "none", s * 0.5) },
  counter: { name: "Counter", ft: [8, 2], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + L(`M${n1(-w / 2)} ${n1(h * 0.15)}H${n1(w / 2)}`, s * 0.6) },
  bar: { name: "Bar (with kegs)", ft: [10, 2.5], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + [-0.3, 0, 0.3].map((f) => C(w * f, 0, h * 0.28, "{accent}", s * 0.5)).join("") },
  // fittings
  barrel: { name: "Barrel", ft: [2, 2], group: "fittings", draw: (w, h, s) => E(w / 2, h / 2, "{fill}", s) + E(w * 0.28, h * 0.28, "none", s * 0.6) },
  crate: { name: "Crate", ft: [2, 2], group: "fittings", draw: (w, h, s) => box(w, h, "{fill}", s) + L(`M${n1(-w / 2)} ${n1(-h / 2)}L${n1(w / 2)} ${n1(h / 2)}M${n1(w / 2)} ${n1(-h / 2)}L${n1(-w / 2)} ${n1(h / 2)}`, s * 0.6) },
  sacks: { name: "Sacks", ft: [3, 2], group: "fittings", draw: (w, h, s) => `<g transform="translate(${n1(-w * 0.22)} 0)">${E(w * 0.26, h * 0.42, "{fill}", s * 0.8)}</g><g transform="translate(${n1(w * 0.22)} ${n1(h * 0.05)})">${E(w * 0.26, h * 0.42, "{fill}", s * 0.8)}</g>` },
  hearth: { name: "Hearth (open fire)", ft: [4, 4], group: "fittings", draw: (w, h, s) => E(w / 2, h / 2, "{stone}", s) + E(w * 0.26, h * 0.26, "{accent}", s * 0.6) },
  fireplace: { name: "Fireplace (in a wall)", ft: [5, 2.5], group: "fittings", draw: (w, h, s) => box(w, h, "{stone}", s) + `<path d="M${n1(-w * 0.3)} ${n1(h / 2)}V${n1(-h * 0.05)}H${n1(w * 0.3)}V${n1(h / 2)}Z" fill="{accent}" stroke="{ink}" stroke-width="${n1(s * 0.6)}"/>` },
  oven: { name: "Oven", ft: [4, 4], group: "fittings", draw: (w, h, s) => `<path d="M${n1(-w / 2)} ${n1(h / 2)}V${n1(-h * 0.1)}A${n1(w / 2)} ${n1(h * 0.4)} 0 0 1 ${n1(w / 2)} ${n1(-h * 0.1)}V${n1(h / 2)}Z" fill="{stone}" stroke="{ink}" stroke-width="${n1(s)}"/>` + R(-w * 0.2, h * 0.15, w * 0.4, h * 0.35, "{accent}", s * 0.6) },
  forge: { name: "Forge", ft: [5, 4], group: "fittings", draw: (w, h, s) => box(w, h, "{stone}", s) + E(w * 0.26, h * 0.26, "{accent}", s * 0.6) },
  anvil: { name: "Anvil", ft: [2.5, 1.2], group: "fittings", draw: (w, h, s) => `<path d="M${n1(-w / 2)} ${n1(-h / 2)}H${n1(w * 0.3)}L${n1(w / 2)} 0L${n1(w * 0.3)} ${n1(h / 2)}H${n1(-w / 2)}Z" fill="{accent}" stroke="{ink}" stroke-width="${n1(s)}"/>` },
  cauldron: { name: "Cauldron", ft: [2.5, 2.5], group: "fittings", draw: (w, h, s) => E(w / 2, h / 2, "{accent}", s) + E(w * 0.32, h * 0.32, "{water}", s * 0.5) },
  loom: { name: "Loom", ft: [5, 3], group: "fittings", draw: (w, h, s) => {
    let d = "";
    for (let i = 1; i < 7; i++) d += `M${n1(-w / 2 + w * i / 7)} ${n1(-h / 2)}V${n1(h / 2)}`;
    return box(w, h, "none", s) + L(d, s * 0.4);
  } },
  // worship and ceremony
  altar: { name: "Altar", ft: [6, 3], group: "worship", draw: (w, h, s) => box(w, h, "{stone}", s) + L(`M0 ${n1(-h * 0.3)}V${n1(h * 0.3)}M${n1(-h * 0.3)} 0H${n1(h * 0.3)}`, s * 0.8) },
  pew: { name: "Pew", ft: [8, 2], group: "worship", draw: (w, h, s) => box(w, h, "{fill}", s * 0.8) + L(`M${n1(-w / 2)} ${n1(-h / 2 + h * 0.25)}H${n1(w / 2)}`, s) },
  throne: { name: "Throne", ft: [3, 3], group: "worship", draw: (w, h, s) => box(w, h, "{accent}", s) + R(-w / 2, -h / 2, w, h * 0.3, "{fill}", s) + R(-w / 2, -h / 2, w * 0.18, h, "{fill}", s * 0.7) + R(w / 2 - w * 0.18, -h / 2, w * 0.18, h, "{fill}", s * 0.7) },
  rug: { name: "Rug", ft: [8, 5], group: "worship", draw: (w, h, s) => R(-w / 2, -h / 2, w, h, "{accent}", s * 0.6, ' fill-opacity="0.35"') + R(-w * 0.38, -h * 0.34, w * 0.76, h * 0.68, "none", s * 0.5) },
  statue: { name: "Statue", ft: [3, 3], group: "worship", draw: (w, h, s) => box(w, h, "{stone}", s) + C(0, 0, Math.min(w, h) * 0.28, "{paper}", s * 0.8) },
  pillar: { name: "Pillar", ft: [2, 2], group: "worship", draw: (w, h, s) => E(w / 2, h / 2, "{stone}", s) },
  // household
  bath: { name: "Bath / tub", ft: [5, 2.6], group: "household", draw: (w, h, s) => `<rect x="${n1(-w / 2)}" y="${n1(-h / 2)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(h * 0.45)}" fill="{fill}" stroke="{ink}" stroke-width="${n1(s)}"/><rect x="${n1(-w * 0.4)}" y="${n1(-h * 0.3)}" width="${n1(w * 0.8)}" height="${n1(h * 0.6)}" rx="${n1(h * 0.3)}" fill="{water}" stroke="{ink}" stroke-width="${n1(s * 0.5)}"/>` },
  privy: { name: "Privy", ft: [3, 3], group: "household", draw: (w, h, s) => box(w, h, "{fill}", s) + E(w * 0.22, h * 0.26, "{paper}", s * 0.7) },
  trough: { name: "Trough", ft: [6, 2], group: "household", draw: (w, h, s) => box(w, h, "{fill}", s) + R(-w * 0.42, -h * 0.28, w * 0.84, h * 0.56, "{water}", s * 0.5) },
  "weapon-rack": { name: "Weapon rack", ft: [4, 1], group: "household", draw: (w, h, s) => {
    let d = `M${n1(-w / 2)} 0H${n1(w / 2)}`;
    for (let i = 1; i < 5; i++) d += `M${n1(-w / 2 + w * i / 5)} ${n1(-h * 0.8)}V${n1(h * 0.8)}`;
    return box(w, h, "{fill}", s * 0.7) + L(d, s * 0.7, "{accent}");
  } },
  // stairs and openings (stairs climb toward their angle: +x before turning)
  stairs: { name: "Stairs (climb to the right)", ft: [10, 4], group: "stairs", draw: (w, h, s) => box(w, h, "{paper}", s) + L(treads(w, h, Math.max(3, Math.round(w / (h * 0.3)))), s * 0.6) },
  "stairs-up": { name: "Stairs up", ft: [10, 4], group: "stairs", draw: (w, h, s) => box(w, h, "{paper}", s) + L(treads(w, h, Math.max(3, Math.round(w / (h * 0.3)))), s * 0.6) + L(`M${n1(-w * 0.38)} 0H${n1(w * 0.34)}M${n1(w * 0.2)} ${n1(-h * 0.2)}L${n1(w * 0.36)} 0L${n1(w * 0.2)} ${n1(h * 0.2)}`, s) },
  "stairs-down": { name: "Stairs down", ft: [10, 4], group: "stairs", draw: (w, h, s) => box(w, h, "{paper}", s) + L(treads(w, h, Math.max(3, Math.round(w / (h * 0.3)))), s * 0.6) + L(`M${n1(w * 0.38)} 0H${n1(-w * 0.34)}M${n1(-w * 0.2)} ${n1(-h * 0.2)}L${n1(-w * 0.36)} 0L${n1(-w * 0.2)} ${n1(h * 0.2)}`, s) },
  "spiral-stairs": { name: "Spiral stairs", ft: [6, 6], group: "stairs", draw: (w, h, s) => {
    let d = "";
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      d += `M0 0L${n1(Math.cos(a) * w / 2)} ${n1(Math.sin(a) * h / 2)}`;
    }
    return E(w / 2, h / 2, "{paper}", s) + L(d, s * 0.5) + C(0, 0, Math.min(w, h) * 0.1, "{ink}", 0);
  } },
  ladder: { name: "Ladder", ft: [2, 5], group: "stairs", draw: (w, h, s) => {
    let d = `M${n1(-w * 0.35)} ${n1(-h / 2)}V${n1(h / 2)}M${n1(w * 0.35)} ${n1(-h / 2)}V${n1(h / 2)}`;
    for (let i = 1; i < 5; i++) d += `M${n1(-w * 0.35)} ${n1(-h / 2 + h * i / 5)}H${n1(w * 0.35)}`;
    return L(d, s);
  } },
  trapdoor: { name: "Trapdoor", ft: [3, 3], group: "stairs", draw: (w, h, s) => box(w, h, "{fill}", s) + L(`M${n1(-w / 2)} ${n1(-h / 2)}L${n1(w / 2)} ${n1(h / 2)}`, s * 0.6) + C(w * 0.3, 0, Math.min(w, h) * 0.06, "{ink}", 0) },
  millstone: { name: "Millstone", ft: [6, 6], group: "fittings", draw: (w, h, s) => E(w / 2, h / 2, "{stone}", s) + E(w * 0.12, h * 0.12, "{paper}", s * 0.6) + L(`M${n1(-w * 0.4)} 0H${n1(-w * 0.15)}M${n1(w * 0.15)} 0H${n1(w * 0.4)}`, s * 0.5) },
  bunk: { name: "Bunk bed", ft: [3, 6.5], group: "furniture", draw: (w, h, s) => box(w, h, "{fill}", s) + R(-w / 2, -h / 2, w, h * 0.5, "none", s * 0.6) + R(-w * 0.35, -h / 2 + h * 0.05, w * 0.7, h * 0.12, "{paper}", s * 0.6) + R(-w * 0.35, h * 0.05, w * 0.7, h * 0.12, "{paper}", s * 0.6) },
  dais: { name: "Dais", ft: [12, 8], group: "worship", draw: (w, h, s) => box(w, h, "{stone}", s) + R(-w * 0.4, -h * 0.35, w * 0.8, h * 0.7, "none", s * 0.5) },
  // site and outdoor
  well: { name: "Well", ft: [5, 5], group: "outdoor", draw: (w, h, s) => E(w / 2, h / 2, "{stone}", s) + E(w * 0.3, h * 0.3, "{water}", s * 0.7) },
  fountain: { name: "Fountain", ft: [12, 12], group: "outdoor", draw: (w, h, s) => E(w / 2, h / 2, "{stone}", s) + E(w * 0.4, h * 0.4, "{water}", s * 0.6) + C(0, 0, Math.min(w, h) * 0.1, "{stone}", s * 0.7) },
  stall: { name: "Market stall", ft: [8, 5], group: "outdoor", draw: (w, h, s) => box(w, h, "{accent}", s) + L(`M${n1(-w / 2)} ${n1(-h / 2)}L${n1(w / 2)} ${n1(h / 2)}M${n1(w / 2)} ${n1(-h / 2)}L${n1(-w / 2)} ${n1(h / 2)}`, s * 0.5) },
  cart: { name: "Cart", ft: [5, 9], group: "outdoor", draw: (w, h, s) => R(-w * 0.4, -h * 0.25, w * 0.8, h * 0.7, "{fill}", s) + R(-w / 2, 0, w * 0.1, h * 0.3, "{ink}", 0) + R(w * 0.4, 0, w * 0.1, h * 0.3, "{ink}", 0) + L(`M${n1(-w * 0.2)} ${n1(-h * 0.25)}L${n1(-w * 0.15)} ${n1(-h / 2)}M${n1(w * 0.2)} ${n1(-h * 0.25)}L${n1(w * 0.15)} ${n1(-h / 2)}`, s) },
  haystack: { name: "Haystack", ft: [8, 8], group: "outdoor", draw: (w, h, s) => E(w / 2, h / 2, "{fill}", s) + E(w * 0.32, h * 0.32, "none", s * 0.5) + E(w * 0.14, h * 0.14, "none", s * 0.5) },
  woodpile: { name: "Woodpile", ft: [6, 3], group: "outdoor", draw: (w, h, s) => box(w, h, "{fill}", s) + [-0.3, 0, 0.3].map((f) => C(w * f, 0, h * 0.3, "none", s * 0.5)).join("") },
  signpost: { name: "Signpost", ft: [3, 3], group: "outdoor", draw: (w, h, s) => C(0, 0, Math.min(w, h) * 0.15, "{ink}", 0) + L(`M0 0L${n1(w / 2)} ${n1(-h * 0.2)}M0 0L${n1(-w / 2)} ${n1(-h * 0.1)}`, s * 1.2) },
  cross: { name: "Wayside cross / grave", ft: [2, 3], group: "outdoor", draw: (w, h, s) => L(`M0 ${n1(-h / 2)}V${n1(h / 2)}M${n1(-w / 2)} ${n1(-h * 0.18)}H${n1(w / 2)}`, s * 1.4) },
  gallows: { name: "Gallows", ft: [8, 8], group: "outdoor", draw: (w, h, s) => box(w, h, "{fill}", s) + L(`M${n1(-w * 0.3)} ${n1(h * 0.3)}V${n1(-h * 0.3)}H${n1(w * 0.3)}V${n1(-h * 0.1)}`, s * 1.3) },
  pen: { name: "Pen / sty", ft: [10, 8], group: "outdoor", draw: (w, h, s) => R(-w / 2, -h / 2, w, h, "none", s, ` stroke-dasharray="${n1(s * 3)} ${n1(s * 1.5)}"`) },
  boat: { name: "Boat", ft: [5, 14], group: "outdoor", draw: (w, h, s) => `<path d="M0 ${n1(-h / 2)}Q${n1(w / 2)} ${n1(-h * 0.2)} ${n1(w / 2)} ${n1(h * 0.3)}L${n1(w * 0.3)} ${n1(h / 2)}H${n1(-w * 0.3)}L${n1(-w / 2)} ${n1(h * 0.3)}Q${n1(-w / 2)} ${n1(-h * 0.2)} 0 ${n1(-h / 2)}Z" fill="{fill}" stroke="{ink}" stroke-width="${n1(s)}"/>` + L(`M${n1(-w * 0.4)} 0H${n1(w * 0.4)}M${n1(-w * 0.4)} ${n1(h * 0.22)}H${n1(w * 0.4)}`, s * 0.6) },
  dock: { name: "Jetty / dock", ft: [6, 20], group: "outdoor", draw: (w, h, s) => {
    let d = "";
    for (let i = 1; i < Math.max(2, Math.round(h / w * 3)); i++) d += `M${n1(-w / 2)} ${n1(-h / 2 + h * i / Math.max(2, Math.round(h / w * 3)))}H${n1(w / 2)}`;
    return box(w, h, "{fill}", s) + L(d, s * 0.4);
  } }
};
var FIXTURE_KINDS = Object.keys(FIXTURES);
function fixtureSize(f, perCell) {
  const k = FIXTURES[f.kind];
  return [f.w ?? (k ? k.ft[0] / perCell : 1), f.h ?? (k ? k.ft[1] / perCell : 1)];
}

// ../artgen-core/src/settlement/spec.ts
var SETTLEMENT_KINDS = ["hamlet", "village", "town", "city", "castle"];
var GROUNDS = ["grass", "dirt", "sand", "snow", "stone"];
var STREET_PLANS = ["organic", "grid", "radial"];
var GEN_WALLS = ["none", "palisade", "stone"];
var GEN_WATERS = ["none", "river", "lake", "coast", "moat"];
var ROAD_KINDS = ["highway", "street", "lane", "alley", "path", "track"];
var ROAD_WIDTH_FT = { highway: 20, street: 15, lane: 10, alley: 5, path: 3, track: 8 };
var WATER_KINDS = ["river", "stream", "canal", "moat", "pond", "lake", "sea"];
var WATER_LINES = ["river", "stream", "canal", "moat"];
var WATER_WIDTH_FT = { river: 40, stream: 8, canal: 20, moat: 20, pond: 0, lake: 0, sea: 0 };
var WALL_KINDS = ["curtain", "stone", "palisade", "fence", "hedge", "drystone", "ruined"];
var WALL_THICK_FT = { curtain: 10, stone: 6, palisade: 2, fence: 1, hedge: 4, drystone: 2, ruined: 6 };
var TOWER_SHAPES = ["round", "square"];
var GATE_KINDS2 = ["gatehouse", "gate", "postern", "opening"];
var BUILDING_KINDS = [
  "house",
  "cottage",
  "shop",
  "inn",
  "tavern",
  "smithy",
  "temple",
  "chapel",
  "hall",
  "barn",
  "stable",
  "mill",
  "warehouse",
  "keep",
  "tower",
  "gatehouse",
  "barracks",
  "manor",
  "ruin"
];
var BUILDING_SHAPES = ["rect", "L", "T", "circle", "octagon", "poly"];
var ROOFS = ["gable", "hip", "flat", "battlement", "cone", "thatch", "none"];
var AREA_KINDS = ["field", "garden", "orchard", "wood", "scrub", "marsh", "graveyard", "market", "square", "yard", "paddock", "rubble"];
var TREE_KINDS = ["tree", "conifer", "bush", "rock", "boulder", "stump", "reeds"];
var LABEL_KINDS3 = ["name", "note", "area", "street"];
var CURVES2 = ["none", "smooth"];
var SETTLEMENT_FORMAT = 1;
var MIGRATIONS3 = {};
var MAX_SIDE3 = 240;
var KIND_DEFAULTS = {
  hamlet: { cols: 50, rows: 40, perCell: 5, buildings: 7, wall: "none", castle: false, market: false },
  village: { cols: 80, rows: 60, perCell: 5, buildings: 22, wall: "none", castle: false, market: true },
  town: { cols: 110, rows: 90, perCell: 10, buildings: 70, wall: "stone", castle: false, market: true },
  city: { cols: 160, rows: 130, perCell: 10, buildings: 160, wall: "stone", castle: true, market: true },
  castle: { cols: 84, rows: 72, perCell: 5, buildings: 8, wall: "none", castle: true, market: false }
};
var DEFAULTS2 = {
  cols: 80,
  rows: 60,
  ground: "grass",
  gen: { buildings: 22, density: 0.6, streets: "organic", wall: "none", water: "river", trees: 0.4, fields: 0.5, market: true, castle: false, interiors: false },
  grid: { show: true, size: 2, sub: false },
  scale: { perCell: 5, unit: "ft" },
  interior: { perCell: 5 },
  numbers: true,
  scaleBar: true,
  compass: true
};
function newSettlement(id, kind = "village", over = {}) {
  const d = structuredClone(DEFAULTS2), k = KIND_DEFAULTS[kind];
  const grid = { ...d.grid, size: k.perCell === 10 ? 1 : 2 };
  return parseSettlement({
    ...d,
    cols: k.cols,
    rows: k.rows,
    ...over,
    id,
    kind,
    version: SETTLEMENT_FORMAT,
    seed: over.seed ?? 1,
    gen: { ...d.gen, buildings: k.buildings, wall: k.wall, castle: k.castle, market: k.market, ...kind === "castle" && { water: "moat", fields: 0.2 }, ...over.gen },
    grid: { ...grid, ...over.grid },
    scale: { ...d.scale, perCell: k.perCell, ...over.scale },
    interior: { ...d.interior, ...over.interior },
    roads: over.roads ?? [],
    water: over.water ?? [],
    walls: over.walls ?? [],
    buildings: over.buildings ?? [],
    areas: over.areas ?? [],
    trees: over.trees ?? [],
    props: over.props ?? [],
    overlay: over.overlay ?? { labels: [], symbols: [] }
  });
}
var isNum3 = (v) => typeof v === "number" && Number.isFinite(v);
var nums3 = (v) => Array.isArray(v) && v.every(isNum3);
var isPoint2 = (v) => nums3(v) && v.length === 2;
var idOk = (v) => typeof v === "string" && /^[\w-]+$/.test(v);
var pairs = (v, min) => nums3(v) && v.length >= min * 2 && v.length % 2 === 0;
function list(v, at3, e) {
  if (v === void 0) return [];
  if (!Array.isArray(v)) {
    e.push(`${at3}: an array`);
    return [];
  }
  return v;
}
function uniqueIds(items, at3, e, required = false) {
  const seen = /* @__PURE__ */ new Set();
  items.forEach((x, i) => {
    if (x?.id === void 0) {
      if (required) e.push(`${at3}[${i}].id: letters, digits, - and _ only`);
      return;
    }
    if (!idOk(x.id)) e.push(`${at3}[${i}].id: letters, digits, - and _ only`);
    else if (seen.has(x.id)) e.push(`${at3}[${i}].id: ${x.id} is used twice`);
    else seen.add(x.id);
  });
  return seen;
}
function fixtureErrors(f, at3, e) {
  if (!f || typeof f !== "object") {
    e.push(`${at3}: {kind, x, y}`);
    return;
  }
  if (typeof f.kind !== "string" || !FIXTURES[f.kind]) e.push(`${at3}.kind: one of the fixture kinds (artgen settlement fixtures)`);
  for (const k of ["x", "y"]) if (!isNum3(f[k])) e.push(`${at3}.${k}: a number (cells)`);
  for (const k of ["w", "h"]) if (f[k] !== void 0 && !(isNum3(f[k]) && f[k] > 0)) e.push(`${at3}.${k}: cells, above 0`);
  if (f.angle !== void 0 && !isNum3(f.angle)) e.push(`${at3}.angle: degrees`);
  if (f.label !== void 0 && typeof f.label !== "string") e.push(`${at3}.label: text`);
  originError2(f, at3, e);
}
function floorErrors(fl2, at3, e) {
  if (!fl2 || typeof fl2 !== "object") {
    e.push(`${at3}: {level, rooms}`);
    return;
  }
  if (!isNum3(fl2.level) || !Number.isInteger(fl2.level)) e.push(`${at3}.level: a whole number (0 ground, 1 above, -1 cellar)`);
  if (fl2.name !== void 0 && typeof fl2.name !== "string") e.push(`${at3}.name: text`);
  const rooms = list(fl2.rooms, `${at3}.rooms`, e), ids = uniqueIds(rooms, `${at3}.rooms`, e, true);
  if (fl2.rooms === void 0) e.push(`${at3}.rooms: an array`);
  rooms.forEach((r, i) => {
    const ra = `${at3}.rooms[${i}]`;
    if (!ROOM_SHAPES.includes(r?.shape)) e.push(`${ra}.shape: one of ${ROOM_SHAPES.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum3(r?.[k])) e.push(`${ra}.${k}: a number (plan cells)`);
    for (const k of ["w", "h"]) if (!isNum3(r?.[k]) || r[k] < 0.5) e.push(`${ra}.${k}: at least half a cell`);
    if (r?.shape === "poly" && !pairs(r.points, 3)) e.push(`${ra}.points: at least 3 x,y pairs`);
    if (r?.label !== void 0 && typeof r.label !== "string") e.push(`${ra}.label: text`);
    if (r?.number !== void 0 && r.number !== false && !isNum3(r.number)) e.push(`${ra}.number: a number or false`);
    originError2(r, ra, e);
  });
  list(fl2.connections, `${at3}.connections`, e).forEach((c, i) => {
    const ca = `${at3}.connections[${i}]`;
    if (!c || typeof c !== "object") {
      e.push(`${ca}: {a, b, kind?}`);
      return;
    }
    for (const k of ["a", "b"]) if (!ids.has(c[k])) e.push(`${ca}.${k}: no room ${JSON.stringify(c[k])}`);
    if (c.a === c.b) e.push(`${ca}: a room cannot connect to itself`);
    if (c.at !== void 0 && !isPoint2(c.at)) e.push(`${ca}.at: [x, y]`);
    if (c.kind !== void 0 && c.kind !== "open" && !DOOR_KINDS.includes(c.kind)) e.push(`${ca}.kind: open or one of ${DOOR_KINDS.join(", ")}`);
    if (c.width !== void 0 && !(isNum3(c.width) && c.width >= 0.5 && c.width <= 20)) e.push(`${ca}.width: 0.5..20`);
  });
  list(fl2.doors, `${at3}.doors`, e).forEach((d, i) => {
    const da = `${at3}.doors[${i}]`;
    if (!isPoint2(d?.at)) e.push(`${da}.at: [x, y] in plan cells`);
    if (d?.kind !== void 0 && d.kind !== "open" && !DOOR_KINDS.includes(d.kind)) e.push(`${da}.kind: open or one of ${DOOR_KINDS.join(", ")}`);
    if (d?.width !== void 0 && !(isNum3(d.width) && d.width > 0)) e.push(`${da}.width: cells, above 0`);
  });
  list(fl2.windows, `${at3}.windows`, e).forEach((w, i) => {
    if (!isPoint2(w?.at)) e.push(`${at3}.windows[${i}].at: [x, y] in plan cells`);
    if (w?.width !== void 0 && !(isNum3(w.width) && w.width > 0)) e.push(`${at3}.windows[${i}].width: cells, above 0`);
  });
  list(fl2.fixtures, `${at3}.fixtures`, e).forEach((f, i) => fixtureErrors(f, `${at3}.fixtures[${i}]`, e));
  originError2(fl2, at3, e);
}
function validateSettlement(raw) {
  const e = [];
  if (!raw || typeof raw !== "object") return ["settlement: expected an object"];
  const m = raw;
  if (!idOk(m.id)) e.push("id: letters, digits, - and _ only");
  if (!SETTLEMENT_KINDS.includes(m.kind)) e.push(`kind: one of ${SETTLEMENT_KINDS.join(", ")}`);
  for (const k of ["cols", "rows"]) if (!isNum3(m[k]) || m[k] < 4 || m[k] > MAX_SIDE3 || !Number.isInteger(m[k])) e.push(`${k}: an integer from 4 to ${MAX_SIDE3}`);
  if (!isNum3(m.seed)) e.push("seed: a number");
  if (m.title !== void 0 && typeof m.title !== "string") e.push("title: text");
  if (!GROUNDS.includes(m.ground)) e.push(`ground: one of ${GROUNDS.join(", ")}`);
  const g = m.gen;
  if (!g || typeof g !== "object") e.push("gen: required");
  else {
    if (!isNum3(g.buildings) || g.buildings < 0 || g.buildings > 600) e.push("gen.buildings: 0..600");
    for (const k of ["density", "trees", "fields"]) if (!isNum3(g[k]) || g[k] < 0 || g[k] > 1) e.push(`gen.${k}: 0..1`);
    if (!STREET_PLANS.includes(g.streets)) e.push(`gen.streets: ${STREET_PLANS.join(", ")}`);
    if (!GEN_WALLS.includes(g.wall)) e.push(`gen.wall: ${GEN_WALLS.join(", ")}`);
    if (!GEN_WATERS.includes(g.water)) e.push(`gen.water: ${GEN_WATERS.join(", ")}`);
    for (const k of ["market", "castle", "interiors"]) if (typeof g[k] !== "boolean") e.push(`gen.${k}: true or false`);
  }
  if (!m.grid || typeof m.grid.show !== "boolean" || !isNum3(m.grid.size) || m.grid.size < 0.5 || typeof m.grid.sub !== "boolean") e.push("grid: show, size \u2265 0.5 (cells), sub (true|false)");
  if (!m.scale || !isNum3(m.scale.perCell) || m.scale.perCell <= 0 || typeof m.scale.unit !== "string") e.push("scale: perCell (above 0) and unit");
  if (!m.interior || !isNum3(m.interior.perCell) || m.interior.perCell <= 0) e.push("interior.perCell: plan cell size, above 0");
  for (const k of ["numbers", "scaleBar", "compass"]) if (typeof m[k] !== "boolean") e.push(`${k}: true or false`);
  if (m.legend !== void 0 && typeof m.legend !== "boolean") e.push("legend: true or false");
  const f = m.furniture;
  if (f !== void 0 && (!f || typeof f !== "object" || !["over", "outside", "auto"].includes(f.place) || f.side !== void 0 && !["bottom", "right"].includes(f.side)))
    e.push("furniture: {place: over|outside|auto, side?: bottom|right}");
  const roads = list(m.roads, "roads", e);
  uniqueIds(roads, "roads", e);
  roads.forEach((r, i) => {
    const at3 = `roads[${i}]`;
    if (!ROAD_KINDS.includes(r?.kind)) e.push(`${at3}.kind: one of ${ROAD_KINDS.join(", ")}`);
    if (!pairs(r?.points, 2)) e.push(`${at3}.points: at least 2 x,y pairs`);
    if (r?.width !== void 0 && !(isNum3(r.width) && r.width > 0 && r.width <= 20)) e.push(`${at3}.width: cells, above 0 and at most 20`);
    if (r?.curve !== void 0 && !CURVES2.includes(r.curve)) e.push(`${at3}.curve: ${CURVES2.join(" or ")}`);
    if (r?.label !== void 0 && typeof r.label !== "string") e.push(`${at3}.label: text`);
    originError2(r, at3, e);
  });
  const water = list(m.water, "water", e);
  uniqueIds(water, "water", e);
  water.forEach((w, i) => {
    const at3 = `water[${i}]`;
    if (!WATER_KINDS.includes(w?.kind)) e.push(`${at3}.kind: one of ${WATER_KINDS.join(", ")}`);
    else if (!pairs(w?.points, WATER_LINES.includes(w.kind) ? 2 : 3)) e.push(`${at3}.points: at least ${WATER_LINES.includes(w.kind) ? 2 : 3} x,y pairs`);
    if (w?.width !== void 0 && !(isNum3(w.width) && w.width > 0 && w.width <= 60)) e.push(`${at3}.width: cells, above 0 and at most 60`);
    originError2(w, at3, e);
  });
  const walls = list(m.walls, "walls", e);
  uniqueIds(walls, "walls", e);
  walls.forEach((w, i) => {
    const at3 = `walls[${i}]`;
    if (!w || typeof w !== "object") {
      e.push(`${at3}: {kind, points}`);
      return;
    }
    if (!WALL_KINDS.includes(w.kind)) e.push(`${at3}.kind: one of ${WALL_KINDS.join(", ")}`);
    if (!pairs(w.points, 2)) e.push(`${at3}.points: at least 2 x,y pairs`);
    if (w.closed !== void 0 && typeof w.closed !== "boolean") e.push(`${at3}.closed: true or false`);
    if (w.closed && nums3(w.points) && w.points.length < 6) e.push(`${at3}.closed: a closed wall needs 3 points or more`);
    if (w.thickness !== void 0 && !(isNum3(w.thickness) && w.thickness > 0 && w.thickness <= 6)) e.push(`${at3}.thickness: cells, above 0 and at most 6`);
    const t = w.towers;
    if (t !== void 0) {
      if (!t || !TOWER_SHAPES.includes(t.shape)) e.push(`${at3}.towers.shape: ${TOWER_SHAPES.join(" or ")}`);
      if (t?.size !== void 0 && !(isNum3(t.size) && t.size > 0)) e.push(`${at3}.towers.size: cells, above 0`);
      if (t?.at !== void 0 && t.at !== "corners" && !(nums3(t.at) && t.at.every(Number.isInteger))) e.push(`${at3}.towers.at: "corners" or vertex indices`);
      if (t?.every !== void 0 && !(isNum3(t.every) && t.every >= 2)) e.push(`${at3}.towers.every: cells between towers, 2 or more`);
    }
    list(w.gates, `${at3}.gates`, e).forEach((gt, j) => {
      const ga = `${at3}.gates[${j}]`;
      if (!isPoint2(gt?.at)) e.push(`${ga}.at: [x, y] in cells`);
      if (!GATE_KINDS2.includes(gt?.kind)) e.push(`${ga}.kind: one of ${GATE_KINDS2.join(", ")}`);
      if (gt?.width !== void 0 && !(isNum3(gt.width) && gt.width > 0)) e.push(`${ga}.width: cells, above 0`);
      if (gt?.drawbridge !== void 0 && typeof gt.drawbridge !== "boolean") e.push(`${ga}.drawbridge: true or false`);
    });
    originError2(w, at3, e);
  });
  const buildings = list(m.buildings, "buildings", e);
  if (m.buildings === void 0) e.push("buildings: an array");
  uniqueIds(buildings, "buildings", e, true);
  buildings.forEach((b, i) => {
    const at3 = `buildings[${i}]`;
    if (!b || typeof b !== "object") {
      e.push(`${at3}: {id, kind, shape, x, y, w, h}`);
      return;
    }
    if (!BUILDING_KINDS.includes(b.kind)) e.push(`${at3}.kind: one of ${BUILDING_KINDS.join(", ")}`);
    if (!BUILDING_SHAPES.includes(b.shape)) e.push(`${at3}.shape: one of ${BUILDING_SHAPES.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum3(b[k])) e.push(`${at3}.${k}: a number (cells)`);
    for (const k of ["w", "h"]) if (!isNum3(b[k]) || b[k] < 0.5) e.push(`${at3}.${k}: at least half a cell`);
    if (b.shape === "poly" && !pairs(b.points, 3)) e.push(`${at3}.points: at least 3 x,y pairs`);
    if (b.wing !== void 0 && !(isPoint2(b.wing) && b.wing[0] > 0 && b.wing[1] > 0 && b.wing[0] < b.w && b.wing[1] < b.h)) e.push(`${at3}.wing: [w, h], each above 0 and less than the box`);
    if (b.angle !== void 0 && !isNum3(b.angle)) e.push(`${at3}.angle: degrees`);
    if (b.roof !== void 0 && !ROOFS.includes(b.roof)) e.push(`${at3}.roof: one of ${ROOFS.join(", ")}`);
    if (b.stories !== void 0 && !(Number.isInteger(b.stories) && b.stories >= 1 && b.stories <= 12)) e.push(`${at3}.stories: 1..12`);
    if (b.label !== void 0 && typeof b.label !== "string") e.push(`${at3}.label: text`);
    if (b.number !== void 0 && b.number !== false && !isNum3(b.number)) e.push(`${at3}.number: a number or false`);
    if (b.href !== void 0 && hrefError(b.href)) e.push(`${at3}.href: ${hrefError(b.href)}`);
    const floors = list(b.floors, `${at3}.floors`, e), levels = /* @__PURE__ */ new Set();
    floors.forEach((fl2, j) => {
      floorErrors(fl2, `${at3}.floors[${j}]`, e);
      if (isNum3(fl2?.level)) {
        if (levels.has(fl2.level)) e.push(`${at3}.floors[${j}].level: level ${fl2.level} is used twice`);
        levels.add(fl2.level);
      }
    });
    originError2(b, at3, e);
  });
  const areas = list(m.areas, "areas", e);
  uniqueIds(areas, "areas", e);
  areas.forEach((a, i) => {
    const at3 = `areas[${i}]`;
    if (!AREA_KINDS.includes(a?.kind)) e.push(`${at3}.kind: one of ${AREA_KINDS.join(", ")}`);
    if (!pairs(a?.points, 3)) e.push(`${at3}.points: at least 3 x,y pairs`);
    if (a?.label !== void 0 && typeof a.label !== "string") e.push(`${at3}.label: text`);
    originError2(a, at3, e);
  });
  list(m.trees, "trees", e).forEach((t, i) => {
    const at3 = `trees[${i}]`;
    if (!TREE_KINDS.includes(t?.kind)) e.push(`${at3}.kind: one of ${TREE_KINDS.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum3(t?.[k])) e.push(`${at3}.${k}: a number (cells)`);
    if (t?.size !== void 0 && !(isNum3(t.size) && t.size > 0)) e.push(`${at3}.size: cells across, above 0`);
    originError2(t, at3, e);
  });
  list(m.props, "props", e).forEach((p, i) => fixtureErrors(p, `props[${i}]`, e));
  const u = m.underlay;
  if (u !== void 0) {
    if (!u || typeof u !== "object" || typeof u.map !== "string" || !u.map) e.push("underlay.map: the map file's path");
    else {
      if (!isPoint2(u.origin)) e.push("underlay.origin: [x, y] in map units");
      if (!isNum3(u.scale) || u.scale <= 0) e.push("underlay.scale: map units in one cell, above 0");
      if (u.theme !== void 0 && u.theme !== "color" && u.theme !== "bw") e.push("underlay.theme: color or bw");
    }
  }
  const o = m.overlay;
  if (!o || !Array.isArray(o.labels) || !Array.isArray(o.symbols)) e.push("overlay: { labels: [], symbols: [] }");
  else {
    o.labels.forEach((l, i) => {
      if (typeof l?.text !== "string" || !isNum3(l.x) || !isNum3(l.y) || !LABEL_KINDS3.includes(l.kind)) {
        e.push(`overlay.labels[${i}]: text, x, y, kind (${LABEL_KINDS3.join("|")})`);
        return;
      }
      if (l.href !== void 0 && hrefError(l.href)) e.push(`overlay.labels[${i}].href: ${hrefError(l.href)}`);
      originError2(l, `overlay.labels[${i}]`, e);
    });
    o.symbols.forEach((s, i) => {
      if (typeof s?.kind !== "string" || !isNum3(s.x) || !isNum3(s.y)) e.push(`overlay.symbols[${i}]: kind, x, y`);
      else originError2(s, `overlay.symbols[${i}]`, e);
    });
  }
  return e;
}
function withDefaults2(r) {
  const d = DEFAULTS2;
  const box2 = (x) => x?.shape === "poly" && Array.isArray(x.points) && x.points.length >= 6 && x.x === void 0 ? { ...x, ...polyBox(x.points) } : x;
  const buildings = (Array.isArray(r.buildings) ? r.buildings : []).map((b) => {
    const bb = box2(b);
    return Array.isArray(bb?.floors) ? { ...bb, floors: bb.floors.map((fl2) => fl2 && Array.isArray(fl2.rooms) ? { ...fl2, rooms: fl2.rooms.map(box2) } : fl2) } : bb;
  });
  return {
    ...structuredClone(d),
    ...r,
    kind: r.kind ?? "village",
    version: SETTLEMENT_FORMAT,
    gen: { ...d.gen, ...r.gen },
    grid: { ...d.grid, ...r.grid },
    scale: { ...d.scale, ...r.scale },
    interior: { ...d.interior, ...r.interior },
    roads: r.roads ?? [],
    water: r.water ?? [],
    walls: r.walls ?? [],
    buildings,
    areas: r.areas ?? [],
    trees: r.trees ?? [],
    props: r.props ?? [],
    overlay: { labels: r.overlay?.labels ?? [], symbols: r.overlay?.symbols ?? [] }
  };
}
function parseSettlement(raw) {
  const r = readFormat(raw, "settlement", SETTLEMENT_FORMAT, MIGRATIONS3), m = withDefaults2(r);
  const errors = validateSettlement(m);
  if (errors.length) throw new Error(`invalid settlement${typeof r.id === "string" ? ` ${r.id}` : ""}:
  ${errors.join("\n  ")}`);
  return m;
}
function checkSettlement(raw) {
  let r;
  try {
    r = readFormat(raw, "settlement", SETTLEMENT_FORMAT, MIGRATIONS3);
  } catch (err) {
    const v = raw?.version;
    return { version: typeof v === "number" ? v : null, errors: [{ path: "version", message: err.message }] };
  }
  return { version: SETTLEMENT_FORMAT, errors: validateSettlement(withDefaults2(r)).map(toIssue) };
}
function nextId(items, prefix) {
  const used = new Set(items.flatMap((x) => x.id ? [x.id] : []));
  for (let n = 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
}
var planFactor = (spec) => spec.scale.perCell / spec.interior.perCell;
var unitsToCells = (spec, v) => v / spec.scale.perCell;
function roofOf(b) {
  if (b.roof) return b.roof;
  if (b.kind === "ruin") return "none";
  if (b.kind === "keep" || b.kind === "gatehouse" || b.kind === "barracks") return "battlement";
  if (b.kind === "tower") return b.shape === "circle" || b.shape === "octagon" ? "cone" : "battlement";
  if (b.shape === "circle" || b.shape === "octagon") return "cone";
  if (b.kind === "cottage" || b.kind === "barn") return "thatch";
  if (b.kind === "temple" || b.kind === "hall" || b.kind === "manor") return "hip";
  return "gable";
}
var floorAt = (b, level) => b.floors?.find((f) => f.level === level);
function groundFloor(b) {
  const fl2 = [...b.floors ?? []].sort((p, q) => p.level - q.level);
  return fl2.find((f) => f.level === 0) ?? fl2.find((f) => f.level > 0) ?? fl2[0];
}
var floorName = (f) => f.name ?? (f.level === 0 ? "Ground floor" : f.level < 0 ? f.level === -1 ? "Cellar" : `Cellar ${-f.level}` : f.level === 1 ? "Upper floor" : `Floor ${f.level}`);
function removeBuilding(m, id) {
  const n = m.buildings.length;
  m.buildings = m.buildings.filter((b) => b.id !== id);
  return m.buildings.length !== n;
}

// ../artgen-core/src/settlement/theme.ts
var THEMES2 = ["color", "bw"];
var C2 = THEME.color;
var PALETTES = {
  color: {
    paper: C2.paper,
    ink: "#2a241c",
    halo: "#ffffff",
    ground: { grass: "#d4e0ad", dirt: "#e2d3b0", sand: C2.terrain.sand.fill, snow: "#f4f4ef", stone: "#d6d1c6" },
    water: C2.terrain.water.fill,
    waterEdge: C2.riverBank,
    ripples: false,
    road: {
      highway: { fill: "#cbbfa8", edge: "#6e6252" },
      street: { fill: "#d9cdb5", edge: "#8a7b63" },
      lane: { fill: "#e2cfa5", edge: "#a88f62" },
      alley: { fill: "#d9cdb5", edge: "#8a7b63" },
      path: { fill: "#dcc79a", edge: "#a88f62", dash: true },
      track: { fill: "none", edge: "#a88f62", ruts: true }
    },
    area: {
      field: { fill: "#e7dca0", pattern: "furrows" },
      garden: { fill: "#bcd48f", pattern: "rows" },
      orchard: { fill: "#c6d79a" },
      wood: { fill: "#9fbf85" },
      scrub: { fill: "#c9c88f", pattern: "tufts" },
      marsh: { fill: "#b2c29d", pattern: "marsh" },
      graveyard: { fill: "#c3cfa4", pattern: "graves" },
      market: { fill: "#e3d6bc", pattern: "cobbles" },
      square: { fill: "#ddd2bb", pattern: "cobbles" },
      yard: { fill: "#e4d9c1" },
      paddock: { fill: "#cfdc9e", edge: "#8a7b63", dash: true },
      rubble: { fill: "#d4cdbd", pattern: "rubble" }
    },
    roof: { tile: "#b9785b", thatch: "#d2b56e", slate: "#7f8796", stone: "#a8a194", wood: "#9a7a55" },
    ridge: "#5b3b2a",
    wall: { curtain: "#9b9284", stone: "#a69e90", palisade: "#7b5a39", fence: "#7b5a39", hedge: "#6f9a5a", drystone: "#9b9284", ruined: "#a69e90" },
    tower: "#b8b0a2",
    floor: "#f3ead6",
    outerWall: "#3b342b",
    tree: "#7fa764",
    treeDark: "#4f7a3d",
    rock: "#a8a194",
    fixture: { fill: "#d8c09a", accent: "#c0603a", stone: "#c9c3b6", water: C2.terrain.water.fill, paper: "#fbf7ee" },
    grid: "#2b2b2b",
    gridOpacity: 0.22,
    badge: "#2a241c",
    badgeText: "#ffffff"
  },
  bw: {
    paper: "#ffffff",
    ink: "#000000",
    halo: "#ffffff",
    ground: { grass: "#ffffff", dirt: "#ffffff", sand: "#ffffff", snow: "#ffffff", stone: "#ffffff" },
    water: "#ffffff",
    waterEdge: "#000000",
    ripples: true,
    road: {
      highway: { fill: "#ffffff", edge: "#000000" },
      street: { fill: "#ffffff", edge: "#000000" },
      lane: { fill: "#ffffff", edge: "#000000" },
      alley: { fill: "#ffffff", edge: "#000000" },
      path: { fill: "none", edge: "#000000", dash: true },
      track: { fill: "none", edge: "#000000", ruts: true }
    },
    area: {
      field: { fill: "#ffffff", pattern: "furrows" },
      garden: { fill: "#ffffff", pattern: "rows" },
      orchard: { fill: "#ffffff" },
      wood: { fill: "#ffffff" },
      scrub: { fill: "#ffffff", pattern: "tufts" },
      marsh: { fill: "#ffffff", pattern: "marsh" },
      graveyard: { fill: "#ffffff", pattern: "graves" },
      market: { fill: "#ffffff", pattern: "cobbles" },
      square: { fill: "#ffffff", pattern: "cobbles" },
      yard: { fill: "#ffffff" },
      paddock: { fill: "#ffffff", edge: "#000000", dash: true },
      rubble: { fill: "#ffffff", pattern: "rubble" }
    },
    roof: { tile: "#d0d0d0", thatch: "#e6e6e6", slate: "#a8a8a8", stone: "#bdbdbd", wood: "#c4c4c4" },
    ridge: "#000000",
    wall: { curtain: "#6e6e6e", stone: "#8a8a8a", palisade: "#000000", fence: "#000000", hedge: "#ffffff", drystone: "#ffffff", ruined: "#9a9a9a" },
    tower: "#bdbdbd",
    floor: "#ffffff",
    outerWall: "#000000",
    tree: "#ffffff",
    treeDark: "#000000",
    rock: "#ffffff",
    fixture: { fill: "#ffffff", accent: "#9a9a9a", stone: "#d6d6d6", water: "#ffffff", paper: "#ffffff" },
    grid: "#000000",
    gridOpacity: 0.22,
    badge: "#000000",
    badgeText: "#ffffff"
  }
};
function roofTone(kind) {
  if (kind === "cottage" || kind === "barn" || kind === "stable") return "thatch";
  if (kind === "keep" || kind === "tower" || kind === "gatehouse" || kind === "barracks" || kind === "ruin") return "stone";
  if (kind === "temple" || kind === "chapel" || kind === "hall" || kind === "manor") return "slate";
  if (kind === "mill" || kind === "warehouse") return "wood";
  return "tile";
}
var AREA_PATTERNS = {
  furrows: '<path d="M0 2.5H10M0 7.5H10" stroke="{ink}" stroke-width="0.5" stroke-opacity="0.55"/>',
  rows: '<path d="M1 2.5H4M6 2.5H9M1 7.5H4M6 7.5H9" stroke="{ink}" stroke-width="0.9" stroke-linecap="round" stroke-opacity="0.6"/>',
  tufts: '<path d="M1.5 5.5l1 -2 1 2M6.5 10l1 -2 1 2" fill="none" stroke="{ink}" stroke-width="0.6" stroke-linejoin="round"/>',
  marsh: '<path d="M1 4H5M2 4V2.6M3.5 4V2.3M6 9H9.5M7 9V7.6M8.5 9V7.3" fill="none" stroke="{ink}" stroke-width="0.6"/>',
  graves: '<path d="M2.5 1.5V5M1.3 2.6H3.7M7.5 6V9.5M6.3 7.1H8.7" stroke="{ink}" stroke-width="0.6" stroke-linecap="round"/>',
  cobbles: '<path d="M0 3.3H10M0 6.6H10M2 0V3.3M7 0V3.3M4.5 3.3V6.6M9.5 3.3V6.6M2 6.6V10M7 6.6V10" stroke="{ink}" stroke-width="0.35" stroke-opacity="0.45"/>',
  rubble: '<path d="M1 3L3 2L3.6 4L1.6 4.6ZM6 6L8.2 5.5L8.8 7.8L6.4 8.4ZM6.5 1L7.8 1.4L7.4 2.6Z" fill="{ink}" fill-opacity="0.5"/>',
  ripples: '<path d="M0.5 3.5q1.25 -1.2 2.5 0t2.5 0M5.5 8.5q1.25 -1.2 2.5 0t2.5 0" fill="none" stroke="{ink}" stroke-width="0.55"/>'
};
var patternInk = (theme) => theme === "bw" ? "#000000" : "#5e5340";

// ../artgen-core/src/settlement/layout.ts
var TREE_FT = { tree: 15, conifer: 12, bush: 5, rock: 4, boulder: 8, stump: 2, reeds: 4 };
var GATE_FT = { gatehouse: 12, gate: 10, postern: 4, opening: 10 };
var TOWER_FT = 20;
var DEG = Math.PI / 180;
function rotatePts(pts2, angle, cx, cy) {
  if (!angle) return pts2.slice();
  const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG), out = [];
  for (let i = 0; i < pts2.length; i += 2) {
    const dx = pts2[i] - cx, dy = pts2[i + 1] - cy;
    out.push(cx + dx * c - dy * s, cy + dx * s + dy * c);
  }
  return out;
}
var rectPts = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h];
function buildingWings(b) {
  const [ww, wh] = b.wing ?? [b.w / 2, b.h / 2];
  if (b.shape === "L") return [[b.x, b.y, ww, b.h], [b.x + ww, b.y + b.h - wh, b.w - ww, wh]];
  if (b.shape === "T") return [[b.x, b.y, b.w, wh], [b.x + (b.w - ww) / 2, b.y + wh, ww, b.h - wh]];
  return [[b.x, b.y, b.w, b.h]];
}
function footprint(b) {
  const { x, y, w, h } = b, [ww, wh] = b.wing ?? [w / 2, h / 2];
  if (b.shape === "L") return [x, y, x + ww, y, x + ww, y + h - wh, x + w, y + h - wh, x + w, y + h, x, y + h];
  if (b.shape === "T") {
    const sx = x + (w - ww) / 2;
    return [x, y, x + w, y, x + w, y + wh, sx + ww, y + wh, sx + ww, y + h, sx, y + h, sx, y + wh, x, y + wh];
  }
  if (b.shape === "rect") return rectPts(x, y, w, h);
  return roomOutline({ id: b.id, shape: b.shape, x, y, w, h, ...b.points && { points: b.points } });
}
var buildingCentre = (b) => [b.x + b.w / 2, b.y + b.h / 2];
function planToSite(spec, b, px, py) {
  const f = planFactor(spec), [cx, cy] = buildingCentre(b), r = rotatePts([b.x + px / f, b.y + py / f], b.angle ?? 0, cx, cy);
  return [r[0], r[1]];
}
function siteToPlan(spec, b, x, y) {
  const f = planFactor(spec), [cx, cy] = buildingCentre(b), r = rotatePts([x, y], -(b.angle ?? 0), cx, cy);
  return [(r[0] - b.x) * f, (r[1] - b.y) * f];
}
function planOutline(spec, b) {
  const f = planFactor(spec);
  return footprint(b).map((v, i) => (v - (i % 2 ? b.y : b.x)) * f);
}
var roadWidth = (spec, r) => r.width ?? Math.max(0.3, ROAD_WIDTH_FT[r.kind] / spec.scale.perCell);
var waterWidth = (spec, w) => w.width ?? Math.max(0.3, WATER_WIDTH_FT[w.kind] / spec.scale.perCell);
var wallThickness = (spec, w) => w.thickness ?? Math.max(0.2, WALL_THICK_FT[w.kind] / spec.scale.perCell);
var closedLine = (p) => p.length >= 6 && Math.abs(p[0] - p[p.length - 2]) < 1e-9 && Math.abs(p[1] - p[p.length - 1]) < 1e-9;
var smooth2 = (p, closed, passes = 3) => chaikin({ pts: p, closed }, passes).pts;
function snapToLine(pts2, closed, at3) {
  const ring2 = closed ? [...pts2, pts2[0], pts2[1]] : pts2, n = nearestOnLine(ring2, at3[0], at3[1]), i = n.seg * 2;
  return { x: n.x, y: n.y, angle: Math.atan2(ring2[i + 3] - ring2[i + 1], ring2[i + 2] - ring2[i]) / DEG, along: n.along };
}
function along(pts2, step, start = 0) {
  const out = [];
  let carry = start;
  for (let i = 0; i + 3 < pts2.length; i += 2) {
    const dx = pts2[i + 2] - pts2[i], dy = pts2[i + 3] - pts2[i + 1], len = Math.hypot(dx, dy);
    if (!len) continue;
    let t = carry;
    for (; t <= len + 1e-9; t += step) out.push({ x: pts2[i] + dx * t / len, y: pts2[i + 1] + dy * t / len, angle: Math.atan2(dy, dx) / DEG });
    carry = t - len;
  }
  return out;
}
var centroid = (p) => {
  let x = 0, y = 0;
  for (let i = 0; i < p.length; i += 2) {
    x += p[i];
    y += p[i + 1];
  }
  return [2 * x / p.length, 2 * y / p.length];
};
function wallGeom2(spec, index, water) {
  const w = spec.walls[index], closed = !!w.closed, pts2 = w.points.slice(), thickness = wallThickness(spec, w);
  const t = w.towers, size = t?.size ?? Math.max(1, TOWER_FT / spec.scale.perCell), shape = t?.shape ?? "round";
  const towers = [];
  const nVert = pts2.length / 2, segAngle = (i) => {
    const j = closed ? (i + 1) % nVert : Math.min(i + 1, nVert - 1), k = j === i ? i - 1 : i;
    const a = j === i ? [pts2[2 * k], pts2[2 * k + 1], pts2[2 * i], pts2[2 * i + 1]] : [pts2[2 * i], pts2[2 * i + 1], pts2[2 * j], pts2[2 * j + 1]];
    return Math.atan2(a[3] - a[1], a[2] - a[0]) / DEG;
  };
  if (t) {
    const verts = t.at === void 0 || t.at === "corners" ? t.every && t.at === void 0 ? [] : Array.from({ length: nVert }, (_, i) => i) : t.at.filter((i) => i >= 0 && i < nVert);
    for (const i of verts) towers.push({ x: pts2[2 * i], y: pts2[2 * i + 1], shape, size, angle: segAngle(i) });
    if (t.every) {
      const ring2 = closed ? [...pts2, pts2[0], pts2[1]] : pts2, total = lineLength2(ring2), n = Math.max(1, Math.round(total / t.every));
      for (const p of along(ring2, total / n, 0)) if (!towers.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < size * 1.2)) towers.push({ x: p.x, y: p.y, shape, size, angle: p.angle });
    }
  }
  const [mx, my] = closed ? centroid(pts2) : [NaN, NaN];
  const gates = (w.gates ?? []).map((g) => {
    const s = snapToLine(pts2, closed, g.at), width = g.width ?? Math.max(0.6, GATE_FT[g.kind] / spec.scale.perCell);
    let nx = -Math.sin(s.angle * DEG), ny = Math.cos(s.angle * DEG);
    if (closed && (s.x - mx) * nx + (s.y - my) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    let span = 0;
    if (g.drawbridge) {
      span = 2;
      for (const m of water) if (!m.area) {
        const d = nearestOnLine(m.pts, s.x + nx * (thickness / 2 + m.width / 2), s.y + ny * (thickness / 2 + m.width / 2));
        if (d.d < m.width) span = Math.max(span, d.d + m.width + thickness / 2 + 0.5);
      }
    }
    return { kind: g.kind, x: s.x, y: s.y, angle: s.angle, width, drawbridge: span, outward: [nx, ny] };
  });
  const kept = towers.filter((tw) => !gates.some((g) => g.kind !== "postern" && Math.hypot(tw.x - g.x, tw.y - g.y) < g.width / 2 + tw.size * 0.4));
  for (const g of gates) if (g.kind === "gatehouse") {
    const dx = Math.cos(g.angle * DEG), dy = Math.sin(g.angle * DEG), off = g.width / 2 + size / 2;
    for (const sg of [-1, 1]) kept.push({ x: g.x + sg * off * dx + g.outward[0] * size * 0.25, y: g.y + sg * off * dy + g.outward[1] * size * 0.25, shape, size, angle: g.angle });
  }
  return { index, kind: w.kind, pts: pts2, closed, thickness, towers: kept, gates };
}
function inWater(water, x, y, pad = 0) {
  return water.some((w) => w.area ? inPolygon(w.pts, x, y) : nearestOnLine(w.closed ? [...w.pts, w.pts[0], w.pts[1]] : w.pts, x, y).d < w.width / 2 + pad);
}
function bridgesOf(roads, water) {
  const out = [];
  for (const r of roads) {
    const step = 0.2, pts2 = along(r.pts, step);
    let run = [];
    const flush = () => {
      if (run.length) {
        const a = run[0], b = run[run.length - 1], len = Math.hypot(b.x - a.x, b.y - a.y) || step, ux = (b.x - a.x) / len || Math.cos(a.angle * DEG), uy = (b.y - a.y) / len || Math.sin(a.angle * DEG), ext = 0.5;
        out.push({ road: r.index, x0: a.x - ux * ext, y0: a.y - uy * ext, x1: b.x + ux * ext, y1: b.y + uy * ext, width: r.width + 0.3 });
      }
      run = [];
    };
    for (const p of pts2) {
      if (inWater(water, p.x, p.y)) run.push(p);
      else flush();
    }
    flush();
  }
  return out;
}
function areaTrees(spec) {
  const out = [], per = spec.scale.perCell;
  spec.areas.forEach((a, i) => {
    if (a.kind !== "wood" && a.kind !== "orchard") return;
    const xs = a.points.filter((_, j) => j % 2 === 0), ys = a.points.filter((_, j) => j % 2 === 1);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), rand = rng(idSeed(a.id ?? `area-${i}`));
    if (a.kind === "orchard") {
      const gap2 = Math.max(1, 18 / per);
      for (let y = y0 + gap2 / 2; y < y1; y += gap2) for (let x = x0 + gap2 / 2; x < x1; x += gap2) if (inPolygon(a.points, x, y)) out.push({ kind: "tree", x, y, size: 11 / per * (0.85 + rand() * 0.3) });
      return;
    }
    const crown2 = TREE_FT.tree / per, gap = Math.max(0.8, crown2 * 0.8), cap = 3e3;
    for (let y = y0 + gap / 2; y < y1 && out.length < cap; y += gap) for (let x = x0 + gap / 2; x < x1 && out.length < cap; x += gap) {
      const px = x + (rand() - 0.5) * gap * 0.8, py = y + (rand() - 0.5) * gap * 0.8;
      if (inPolygon(a.points, px, py)) out.push({ kind: rand() < 0.25 ? "conifer" : "tree", x: px, y: py, size: crown2 * (0.75 + rand() * 0.5) });
    }
  });
  return out;
}
function layoutSettlement(spec) {
  let auto = 0;
  const buildings = spec.buildings.map((b, index) => {
    const [cx, cy] = buildingCentre(b), a = b.angle ?? 0;
    const number = b.number === false ? void 0 : b.number ?? ++auto;
    if (typeof b.number === "number") auto = Math.max(auto, b.number);
    return { building: b, index, outline: rotatePts(footprint(b), a, cx, cy), wings: buildingWings(b).map(([x, y, w, h]) => rotatePts(rectPts(x, y, w, h), a, cx, cy)), cx, cy, number };
  });
  const roads = spec.roads.map((r, index) => ({ index, kind: r.kind, pts: r.curve === "smooth" ? smooth2(r.points, false) : r.points.slice(), width: roadWidth(spec, r), closed: false }));
  const water = spec.water.map((w, index) => {
    const area = !WATER_LINES.includes(w.kind), closed = area || closedLine(w.points);
    const raw = closed && !area ? w.points.slice(0, -2) : w.points;
    const pts2 = w.kind === "canal" || w.kind === "moat" ? raw.slice() : smooth2(raw, closed, area ? 3 : 2);
    return { index, kind: w.kind, pts: pts2, width: area ? 0 : waterWidth(spec, w), closed, area };
  });
  const walls = spec.walls.map((_, i) => wallGeom2(spec, i, water));
  return { buildings, roads, water, walls, bridges: bridgesOf(roads, water), areaTrees: areaTrees(spec) };
}
function buildingAt(l, x, y) {
  for (let i = l.buildings.length - 1; i >= 0; i--) if (inPolygon(l.buildings[i].outline, x, y)) return l.buildings[i];
  return void 0;
}
function floorAsDungeon(floor2, w, h) {
  const d = structuredClone(DEFAULTS);
  return {
    ...d,
    id: "floor",
    version: 1,
    seed: 1,
    cols: Math.max(4, Math.ceil(w)),
    rows: Math.max(4, Math.ceil(h)),
    style: { ...d.style, hatch: "none", sharedWalls: true },
    rooms: floor2.rooms.map((r) => ({ ...r, fill: "floor" })),
    corridors: [],
    connections: floor2.connections ?? [],
    overlay: { labels: [], symbols: [] }
  };
}
function uncovered(a, b, covers) {
  const L2 = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L2 < 1e-9) return [];
  const ux = (b[0] - a[0]) / L2, uy = (b[1] - a[1]) / L2, t = (p) => (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
  const cut = covers.map(([p, q]) => [Math.min(t(p), t(q)), Math.max(t(p), t(q))]).sort((p, q) => p[0] - q[0]);
  const out = [];
  let from = 0;
  for (const [c0, c1] of [...cut, [L2, L2]]) {
    if (c0 > from + 1e-6) out.push([[a[0] + ux * from, a[1] + uy * from], [a[0] + ux * Math.min(c0, L2), a[1] + uy * Math.min(c0, L2)]]);
    from = Math.max(from, c1);
    if (from >= L2) break;
  }
  return out;
}
function onOutline(outline2, at3) {
  const s = snapToLine(outline2, true, at3);
  return { x: s.x, y: s.y, angle: s.angle };
}
function layoutFloor(spec, b, floor2) {
  const outline2 = planOutline(spec, b), f = planFactor(spec), w = b.w * f, h = b.h * f;
  const dl = layoutDungeon(floorAsDungeon(floor2, w, h));
  const partitions = dl.partitions.slice();
  const outerEdges = dl.rooms.map((g) => sharedEdges(g.outline, outline2));
  dl.rooms.forEach((g, i) => {
    const covers = [...outerEdges[i]];
    dl.rooms.forEach((o, j) => {
      if (j !== i) covers.push(...sharedEdges(g.outline, o.outline));
    });
    for (const [a, c] of edges(g.outline)) {
      const L2 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, off = (p) => Math.abs((p[0] - a[0]) * (c[1] - a[1]) - (p[1] - a[1]) * (c[0] - a[0])) / L2;
      for (const [p, q] of uncovered(a, c, covers.filter(([p0, p1]) => off(p0) < 1e-6 && off(p1) < 1e-6))) partitions.push([p[0], p[1], q[0], q[1]]);
    }
  });
  const inner = dl.connections.filter((c) => c.wall).map((c) => ({ kind: c.kind, x: c.x, y: c.y, angle: c.angle + 90, width: c.width }));
  const doors = (floor2.doors ?? []).map((d) => ({ kind: d.kind ?? "door", width: d.width ?? 1, ...onOutline(outline2, d.at) }));
  const windows = (floor2.windows ?? []).map((d) => ({ kind: "window", width: d.width ?? 1, ...onOutline(outline2, d.at) }));
  const fixtures = (floor2.fixtures ?? []).map((x, index) => {
    const [fw, fh] = fixtureSize(x, spec.interior.perCell);
    return { index, kind: x.kind, x: x.x, y: x.y, w: fw, h: fh, angle: x.angle ?? 0, ...x.label !== void 0 && { label: x.label } };
  });
  return { outline: outline2, w, h, rooms: dl.rooms, partitions, inner, doors, windows, fixtures };
}

// ../artgen-core/src/settlement/render.ts
var SITE_LAYERS = ["ground", "underlay", "areas", "water", "roads", "bridges", "walls", "buildings", "trees", "props", "grid", "symbols", "numbers", "labels", "legend", "title", "scale", "compass"];
var PLAN_LAYERS = ["ground", "floor", "grid", "walls", "doors", "windows", "fixtures", "numbers", "labels", "legend", "title", "scale", "compass"];
var VIEWS = ["site", "plan"];
var BUILDING_MODES = ["roofs", "outline", "interior"];
var SYMBOLS3 = { ...SYMBOLS, ...SYMBOLS2 };
var SYMBOL_KINDS3 = Object.keys(SYMBOLS3);
var PLAN_MARGIN = 2;
var tok = (svg, p) => svg.replaceAll("{ink}", p.ink).replaceAll("{fill}", p.fixture.fill).replaceAll("{accent}", p.fixture.accent).replaceAll("{stone}", p.fixture.stone).replaceAll("{water}", p.fixture.water).replaceAll("{paper}", p.fixture.paper);
var ring = (pts2, k) => pathData([{ pts: pts2, closed: true }], k);
var line = (pts2, k, closed = false) => pathData([{ pts: pts2, closed }], k);
var toP = (pts2) => Array.from({ length: pts2.length / 2 }, (_, i) => [pts2[2 * i], pts2[2 * i + 1]]);
function patternDef(id, name, k, ink, cells = 1) {
  const T2 = Math.max(4, k * cells);
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n1(T2)}" height="${n1(T2)}"><g transform="scale(${(T2 / 10).toFixed(4)})">${AREA_PATTERNS[name].replaceAll("{ink}", ink)}</g></pattern>`;
}
function settlementLayersFor(spec, view, over = {}) {
  const all = [...SITE_LAYERS, ...PLAN_LAYERS], on = Object.fromEntries(all.map((l) => [l, true]));
  on.underlay = !!spec.underlay;
  on.grid = spec.grid.show;
  on.numbers = spec.numbers;
  on.scale = spec.scaleBar;
  on.compass = spec.compass;
  on.legend = !!spec.legend;
  on.title = view === "plan" || !!spec.title;
  return { ...on, ...over };
}
function crown(cx, cy, r, bumps, fill, edge, sw, seed) {
  const rand = rng(seed), a0 = rand() * Math.PI * 2, pts2 = [];
  for (let i = 0; i < bumps; i++) {
    const a = a0 + i / bumps * Math.PI * 2, rr = r * (0.86 + rand() * 0.1);
    pts2.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const br = r * Math.sin(Math.PI / bumps) * 1.15;
  let d = `M${n1(pts2[0][0])} ${n1(pts2[0][1])}`;
  for (let i = 1; i <= bumps; i++) {
    const p = pts2[i % bumps];
    d += `A${n1(br)} ${n1(br)} 0 0 1 ${n1(p[0])} ${n1(p[1])}`;
  }
  return `<path d="${d}Z" fill="${fill}" stroke="${edge}" stroke-width="${n1(sw)}" stroke-linejoin="round"/>`;
}
function treeSvg(t, k, p, u, per, seed) {
  const r = (t.size ?? TREE_FT[t.kind] / per) * k / 2, x = t.x * k, y = t.y * k, sw = Math.max(0.6, 0.9 * u);
  if (t.kind === "tree") return crown(x, y, r, 9, p.tree, p.treeDark, sw, seed) + (p.ripples ? "" : `<circle cx="${n1(x - r * 0.25)}" cy="${n1(y - r * 0.25)}" r="${n1(r * 0.35)}" fill="#ffffff" fill-opacity="0.18"/>`);
  if (t.kind === "conifer") {
    let d2 = "";
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * 0.55 : r;
      d2 += `${i ? "L" : "M"}${n1(x + Math.cos(a) * rr)} ${n1(y + Math.sin(a) * rr)}`;
    }
    return `<path d="${d2}Z" fill="${p.ripples ? p.paper : p.treeDark}" fill-opacity="${p.ripples ? 1 : 0.85}" stroke="${p.treeDark}" stroke-width="${n1(sw)}" stroke-linejoin="round"/><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(Math.max(0.6, r * 0.12))}" fill="${p.ink}"/>`;
  }
  if (t.kind === "bush") return crown(x, y, r, 6, p.tree, p.treeDark, sw * 0.8, seed);
  if (t.kind === "rock" || t.kind === "boulder") {
    const rand = rng(seed), n = 7;
    let d2 = "";
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rand() * 0.4, rr = r * (0.7 + rand() * 0.3);
      d2 += `${i ? "L" : "M"}${n1(x + Math.cos(a) * rr)} ${n1(y + Math.sin(a) * rr)}`;
    }
    return `<path d="${d2}Z" fill="${p.rock}" stroke="${p.ink}" stroke-width="${n1(sw)}" stroke-linejoin="round"/>`;
  }
  if (t.kind === "stump") return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${p.fixture.fill}" stroke="${p.ink}" stroke-width="${n1(sw)}"/><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * 0.45)}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.6)}"/>`;
  let d = "";
  for (let i = -2; i <= 2; i++) d += `M${n1(x + i * r * 0.35)} ${n1(y + r * 0.5)}l${n1(i * r * 0.08)} ${n1(-r)}`;
  return `<path d="${d}" stroke="${p.treeDark}" stroke-width="${n1(sw)}" stroke-linecap="round" fill="none"/>`;
}
function fixtureSvg(f, k, p, sw) {
  const kind = FIXTURES[f.kind];
  if (!kind) return "";
  return `<g transform="translate(${n1(f.x * k)} ${n1(f.y * k)})${f.angle ? ` rotate(${n1(f.angle)})` : ""}">${tok(kind.draw(f.w * k, f.h * k, sw), p)}</g>`;
}
function openingSvg(o, k, t, p, sw) {
  const W = o.width * k, gap = `<rect x="${n1(-W / 2)}" y="${n1(-t * 0.62)}" width="${n1(W)}" height="${n1(t * 1.24)}" fill="${p.floor}"/>`;
  const leaf = (x, w) => `<rect x="${n1(x)}" y="${n1(-t * 0.22)}" width="${n1(w)}" height="${n1(t * 0.44)}" fill="${p.fixture.fill}" stroke="${p.ink}" stroke-width="${n1(sw)}"/>`;
  let g = "";
  if (o.kind === "window") g = `<rect x="${n1(-W / 2)}" y="${n1(-t / 2)}" width="${n1(W)}" height="${n1(t)}" fill="${p.fixture.paper}" stroke="${p.ink}" stroke-width="${n1(sw)}"/><path d="M${n1(-W / 2)} 0H${n1(W / 2)}" stroke="${p.ink}" stroke-width="${n1(sw * 0.7)}"/>`;
  else if (o.kind === "secret") g = `<path d="M${n1(-W / 2)} 0H${n1(W / 2)}" stroke="${p.paper}" stroke-width="${n1(t * 0.25)}" stroke-dasharray="${n1(t * 0.5)} ${n1(t * 0.4)}"/>`;
  else if (o.kind === "open") g = gap;
  else if (o.kind === "portcullis") {
    g = gap;
    const n = Math.max(3, Math.round(o.width * 4));
    for (let i = 0; i < n; i++) g += `<circle cx="${n1(-W / 2 + W * (i + 0.5) / n)}" r="${n1(Math.max(0.8, t * 0.2))}" fill="${p.ink}"/>`;
  } else if (o.kind === "arch") g = gap + `<rect x="${n1(-W / 2 - t * 0.3)}" y="${n1(-t * 0.62)}" width="${n1(t * 0.6)}" height="${n1(t * 1.24)}" fill="${p.ink}"/><rect x="${n1(W / 2 - t * 0.3)}" y="${n1(-t * 0.62)}" width="${n1(t * 0.6)}" height="${n1(t * 1.24)}" fill="${p.ink}"/>`;
  else {
    g = gap + leaf(-W / 2, W);
    if (o.kind === "locked") g += `<path d="M0 ${n1(-t * 0.5)}V${n1(t * 0.5)}" stroke="${p.ink}" stroke-width="${n1(Math.max(sw * 1.5, t * 0.3))}"/>`;
  }
  return `<g transform="translate(${n1(o.x * k)} ${n1(o.y * k)}) rotate(${n1(o.angle)})">${g}</g>`;
}
function badge(text, x, y, fs, p) {
  const bh = fs * 1.45, bw = Math.max(bh, text.length * fs * 0.62 + fs * 0.7);
  return `<rect x="${n1(x - bw / 2)}" y="${n1(y - bh / 2)}" width="${n1(bw)}" height="${n1(bh)}" rx="${n1(bh * 0.32)}" fill="${p.badge}"/><text x="${n1(x)}" y="${n1(y + fs * 0.36)}" font-size="${n1(fs)}" font-weight="700" text-anchor="middle" fill="${p.badgeText}">${esc(text)}</text>`;
}
function floorSvg(fl2, k, p, u, on, clipId, gridSize, text) {
  const out = {}, tOut = Math.max(1.5 * u, 0.3 * k), tIn = Math.max(1 * u, 0.15 * k), sw = Math.max(0.6, 0.9 * u);
  const d = ring(fl2.outline, k);
  if (on.floor) out.floor = `<path d="${d}" fill="${p.floor}"/>`;
  if (on.grid) {
    let gd = "";
    for (let x = 0; x <= fl2.w + 1e-9; x += gridSize) gd += `M${n1(x * k)} 0V${n1(fl2.h * k)}`;
    for (let y = 0; y <= fl2.h + 1e-9; y += gridSize) gd += `M0 ${n1(y * k)}H${n1(fl2.w * k)}`;
    out.grid = `<clipPath id="${clipId}"><path d="${d}"/></clipPath><path d="${gd}" clip-path="url(#${clipId})" stroke="${p.grid}" stroke-opacity="${p.gridOpacity}" stroke-width="${n1(0.8 * u)}" fill="none"/>`;
  }
  if (on.fixtures && fl2.fixtures.length) out.fixtures = fl2.fixtures.map((f) => fixtureSvg(f, k, p, sw)).join("");
  if (on.walls) {
    const parts = fl2.partitions.map((s) => `M${n1(s[0] * k)} ${n1(s[1] * k)}L${n1(s[2] * k)} ${n1(s[3] * k)}`).join("");
    out.walls = (parts ? `<path d="${parts}" stroke="${p.outerWall}" stroke-width="${n1(tIn)}" stroke-linecap="square" fill="none"/>` : "") + `<path d="${d}" fill="none" stroke="${p.outerWall}" stroke-width="${n1(tOut)}" stroke-linejoin="miter"/>`;
  }
  if (on.doors) out.doors = fl2.inner.map((o) => openingSvg(o, k, tIn, p, sw)).join("") + fl2.doors.map((o) => openingSvg(o, k, tOut, p, sw)).join("");
  if (on.windows) out.windows = fl2.windows.map((o) => openingSvg(o, k, tOut, p, sw)).join("");
  let nums4 = "", names = "";
  for (const g of fl2.rooms) {
    const x = g.cx * k, y = g.cy * k, has = on.numbers && g.number !== void 0;
    if (has) nums4 += badge(String(g.number), x, y, text.number, p);
    if (on.labels && g.room.label) names += haloText(g.room.label, x, y + (has ? text.number * 1.6 : text.name * 0.3), text.name, p.ink, { halo: p.halo }, 'font-weight="700"');
  }
  if (on.labels) {
    for (const f of fl2.fixtures) if (f.label) names += haloText(f.label, f.x * k, (f.y + f.h / 2) * k + text.name, text.name * 0.85, p.ink, { halo: p.halo }, 'font-style="italic"');
  }
  if (nums4) out.numbers = nums4;
  if (names) out.labels = names;
  return out;
}
function ridgeOf(w) {
  const c = toP(w), side = (i, j) => Math.hypot(c[j][0] - c[i][0], c[j][1] - c[i][1]);
  const mid = (i, j) => [(c[i][0] + c[j][0]) / 2, (c[i][1] + c[j][1]) / 2];
  const long01 = side(0, 1) >= side(1, 2);
  return long01 ? { a: mid(0, 3), b: mid(1, 2), corners: c, short: side(1, 2) } : { a: mid(0, 1), b: mid(3, 2), corners: c, short: side(0, 1) };
}
function roofSvg(g, k, p, u) {
  const b = g.building, roof = roofOf(b), d = ring(g.outline, k), sw = Math.max(0.8, 1.1 * u), tone = p.roof[roofTone(b.kind)];
  const round = b.shape === "circle" || b.shape === "octagon" || b.shape === "poly";
  const shadow = p.ripples ? "" : `<path d="${d}" transform="translate(${n1(0.22 * k)} ${n1(0.22 * k)})" fill="#000000" fill-opacity="0.16"/>`;
  if (roof === "none") {
    return `<path d="${d}" fill="${p.floor}" fill-opacity="0.55" stroke="${p.outerWall}" stroke-width="${n1(Math.max(1.5 * u, 0.25 * k))}" stroke-dasharray="${n1(k * 0.9)} ${n1(k * 0.35)} ${n1(k * 0.4)} ${n1(k * 0.5)}" stroke-linejoin="miter"/>`;
  }
  let g2 = `${shadow}<path d="${d}" fill="${tone}" stroke="${p.ink}" stroke-width="${n1(sw)}" stroke-linejoin="${roof === "thatch" ? "round" : "miter"}"/>`;
  const ln2 = (dd2, w = sw * 0.9, color = p.ridge) => `<path d="${dd2}" fill="none" stroke="${color}" stroke-width="${n1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const M = (q) => `${n1(q[0] * k)} ${n1(q[1] * k)}`;
  if (roof === "cone" || round && (roof === "gable" || roof === "hip" || roof === "thatch")) {
    const pts2 = toP(g.outline), step = Math.max(1, Math.floor(pts2.length / 8));
    let dd2 = "";
    for (let i = 0; i < pts2.length; i += step) dd2 += `M${M([g.cx, g.cy])}L${M(pts2[i])}`;
    g2 += ln2(dd2, sw * 0.6) + `<circle cx="${n1(g.cx * k)}" cy="${n1(g.cy * k)}" r="${n1(Math.max(1.5, 0.12 * k))}" fill="${p.ridge}"/>`;
    return g2;
  }
  if (roof === "flat" || roof === "battlement") {
    const inset = Math.min(0.35, Math.min(b.w, b.h) * 0.12), r = offsetRing(toP(g.outline), area2(g.outline) > 0 ? -inset : inset).flat();
    if (roof === "battlement") g2 += `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="${n1(Math.max(2 * u, 0.3 * k))}" stroke-dasharray="${n1(0.4 * k)} ${n1(0.32 * k)}" stroke-linejoin="miter"/>`;
    g2 += `<path d="${ring(r, k)}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.7)}"/>`;
    return g2;
  }
  let dd = "";
  for (const w of g.wings) {
    const r = ridgeOf(w), len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) || 1, ux = (r.b[0] - r.a[0]) / len, uy = (r.b[1] - r.a[1]) / len;
    const cut = roof === "hip" ? Math.min(len / 2 - 0.05, r.short / 2) : 0, a = [r.a[0] + ux * cut, r.a[1] + uy * cut], bb = [r.b[0] - ux * cut, r.b[1] - uy * cut];
    dd += `M${M(a)}L${M(bb)}`;
    if (roof === "hip") {
      for (const c of r.corners) {
        const e = Math.hypot(c[0] - a[0], c[1] - a[1]) < Math.hypot(c[0] - bb[0], c[1] - bb[1]) ? a : bb;
        dd += `M${M(c)}L${M(e)}`;
      }
    }
  }
  g2 += ln2(dd, roof === "hip" ? sw * 0.7 : sw);
  if (roof === "thatch") {
    const r = offsetRing(toP(g.outline), area2(g.outline) > 0 ? -0.25 : 0.25).flat();
    g2 += `<path d="${ring(r, k)}" fill="none" stroke="${p.ridge}" stroke-opacity="0.5" stroke-width="${n1(sw * 0.6)}" stroke-dasharray="${n1(0.15 * k)} ${n1(0.2 * k)}"/>`;
  }
  return g2;
}
function wallSvg(w, k, p, u, W, H, defs) {
  const d = line(w.pts, k, w.closed), th = w.thickness * k, sw = Math.max(0.8, 1.1 * u), tone = p.wall[w.kind];
  const mid = `wall-gates-${w.index}`, cut = w.gates.map((g2) => `<rect x="${n1(-g2.width * k / 2)}" y="${n1(-th * 2)}" width="${n1(g2.width * k)}" height="${n1(th * 4)}" transform="translate(${n1(g2.x * k)} ${n1(g2.y * k)}) rotate(${n1(g2.angle)})" fill="#000"/>`).join("");
  if (cut) defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${n1(W)}" height="${n1(H)}"><rect width="${n1(W)}" height="${n1(H)}" fill="#fff"/>${cut}</mask>`);
  const S = (width, color, extra = "") => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n1(width)}"${extra.includes("linecap") ? "" : ' stroke-linejoin="miter" stroke-linecap="butt"'}${extra}/>`;
  let body = "";
  const dots = (step, r, fill, edge) => {
    const pts2 = w.closed ? [...w.pts, w.pts[0], w.pts[1]] : w.pts;
    let s = "", carry = 0;
    for (let i = 0; i + 3 < pts2.length; i += 2) {
      const dx = pts2[i + 2] - pts2[i], dy = pts2[i + 3] - pts2[i + 1], len = Math.hypot(dx, dy);
      let t = carry;
      for (; t <= len; t += step) s += `<circle cx="${n1((pts2[i] + dx * t / len) * k)}" cy="${n1((pts2[i + 1] + dy * t / len) * k)}" r="${n1(r)}" fill="${fill}" stroke="${edge}" stroke-width="${n1(sw * 0.7)}"/>`;
      carry = t - len;
    }
    return s;
  };
  if (w.kind === "curtain") body = S(th + 2 * sw, p.ink) + S(th, tone) + S(th * 0.28, p.ink, ` stroke-dasharray="${n1(th * 0.45)} ${n1(th * 0.35)}"`);
  else if (w.kind === "stone") body = S(th + 2 * sw, p.ink) + S(th, tone);
  else if (w.kind === "ruined") body = S(th + 2 * sw, p.ink, ` stroke-dasharray="${n1(k * 3)} ${n1(k * 1.2)} ${n1(k * 1.5)} ${n1(k * 0.9)}"`) + S(th, tone, ` stroke-dasharray="${n1(k * 3)} ${n1(k * 1.2)} ${n1(k * 1.5)} ${n1(k * 0.9)}"`);
  else if (w.kind === "drystone") body = S(th + 2 * sw, p.ink) + S(th, p.ripples ? p.paper : tone) + S(th * 0.45, p.ink, ` stroke-dasharray="${n1(th * 0.3)} ${n1(th * 0.5)}" stroke-opacity="0.7"`);
  else if (w.kind === "palisade") body = S(th * 0.5, p.wall.palisade) + dots(th * 0.95, th / 2, p.ripples ? p.paper : "#a07a50", p.ink);
  else if (w.kind === "hedge") body = S(th, p.ripples ? p.paper : tone, ' stroke-linecap="round" stroke-linejoin="round"') + dots(th * 0.7, th * 0.52, p.ripples ? p.paper : tone, p.treeDark);
  else body = S(Math.max(sw, th * 0.6), tone) + dots(Math.max(1, 6 / Math.max(1, th / k)) * k * 0.25 + k, Math.max(sw, th * 0.7), tone, p.ink);
  let g = `<g${cut ? ` mask="url(#${mid})"` : ""}>${body}</g>`;
  for (const gt of w.gates) if (gt.drawbridge > 0) {
    const a = Math.atan2(gt.outward[1], gt.outward[0]) * 180 / Math.PI, len = gt.drawbridge * k, bw = gt.width * k;
    let planks = "";
    for (let x = len / 6; x < len; x += len / 6) planks += `M${n1(x)} ${n1(-bw / 2)}V${n1(bw / 2)}`;
    g = `<g transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(a)})"><rect x="0" y="${n1(-bw / 2)}" width="${n1(len)}" height="${n1(bw)}" fill="${p.fixture.fill}" stroke="${p.ink}" stroke-width="${n1(sw)}"/><path d="${planks}" stroke="${p.ink}" stroke-width="${n1(sw * 0.5)}"/></g>` + g;
  }
  for (const t of w.towers) {
    const r = t.size * k / 2;
    g += t.shape === "square" ? `<g transform="translate(${n1(t.x * k)} ${n1(t.y * k)}) rotate(${n1(t.angle)})"><rect x="${n1(-r)}" y="${n1(-r)}" width="${n1(2 * r)}" height="${n1(2 * r)}" fill="${p.tower}" stroke="${p.ink}" stroke-width="${n1(sw * 1.3)}"/><rect x="${n1(-r * 0.7)}" y="${n1(-r * 0.7)}" width="${n1(1.4 * r)}" height="${n1(1.4 * r)}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.6)}"/></g>` : `<circle cx="${n1(t.x * k)}" cy="${n1(t.y * k)}" r="${n1(r)}" fill="${p.tower}" stroke="${p.ink}" stroke-width="${n1(sw * 1.3)}"/><circle cx="${n1(t.x * k)}" cy="${n1(t.y * k)}" r="${n1(r * 0.68)}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.6)}"/>`;
  }
  for (const gt of w.gates) {
    const gw = gt.width * k, depth = Math.max(th * 2.2, k * 1.2);
    let s = "";
    if (gt.kind === "gatehouse") {
      s += `<rect x="${n1(-gw / 2 - th)}" y="${n1(-depth / 2)}" width="${n1(gw + 2 * th)}" height="${n1(depth)}" fill="${p.tower}" stroke="${p.ink}" stroke-width="${n1(sw * 1.2)}"/>`;
      s += `<rect x="${n1(-gw / 2)}" y="${n1(-depth / 2 - sw)}" width="${n1(gw)}" height="${n1(depth + 2 * sw)}" fill="${p.road.street.fill}"/>`;
      s += `<path d="M${n1(-gw / 2)} ${n1(-depth / 2)}V${n1(depth / 2)}M${n1(gw / 2)} ${n1(-depth / 2)}V${n1(depth / 2)}" stroke="${p.ink}" stroke-width="${n1(sw)}"/>`;
      const n = Math.max(3, Math.round(gt.width * 3));
      for (const y of [-depth * 0.25, depth * 0.25]) for (let i = 0; i < n; i++) s += `<circle cx="${n1(-gw / 2 + gw * (i + 0.5) / n)}" cy="${n1(y)}" r="${n1(Math.max(0.8, 0.07 * k))}" fill="${p.ink}"/>`;
    } else if (gt.kind === "gate" || gt.kind === "postern") {
      const leaf = (x, lw) => `<rect x="${n1(x)}" y="${n1(-th * 0.2)}" width="${n1(lw)}" height="${n1(th * 0.4)}" fill="${p.fixture.fill}" stroke="${p.ink}" stroke-width="${n1(sw)}"/>`;
      s += gt.kind === "gate" ? leaf(-gw / 2, gw / 2) + leaf(0, gw / 2) : leaf(-gw / 2, gw);
      s += `<path d="M${n1(-gw / 2)} ${n1(-th * 0.6)}V${n1(th * 0.6)}M${n1(gw / 2)} ${n1(-th * 0.6)}V${n1(th * 0.6)}" stroke="${p.ink}" stroke-width="${n1(sw * 1.6)}"/>`;
    }
    if (s) g += `<g transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(gt.angle)})">${s}</g>`;
  }
  return `<g id="wall-${w.index}">${g}</g>`;
}
function scaleCells3(width) {
  const target = width / 5;
  for (const n of [1, 2, 4, 5, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100]) if (n >= target * 0.75) return n;
  return Math.max(1, Math.round(target));
}
function furniture(a) {
  const { fr, k, u, p } = a, pad = 12 * u, items = [];
  const box2 = (x, y, w, h) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${p.paper}" fill-opacity="0.94" stroke="${p.ink}" stroke-width="${n1(u)}"/>`;
  if (a.on.legend && a.legend.length) {
    const rh = 20 * u, fs = 11.5 * u, w = 170 * u, h = a.legend.length * rh + 12 * u;
    items.push({ id: "legend", rank: 2, w, h, over: { x: fr.r - w - pad, y: fr.b - h - pad }, draw: (x, y) => {
      let g = box2(x, y, w, h);
      a.legend.forEach((e, i) => {
        const sy = y + 6 * u + i * rh + rh / 2;
        g += a.legend[i].swatch(x + 18 * u, sy, 16 * u);
        g += `<text x="${n1(x + 34 * u)}" y="${n1(sy + fs * 0.35)}" font-size="${n1(fs)}" fill="${p.ink}">${esc(e.name)}</text>`;
      });
      return `<g id="legend">${g}</g>`;
    } });
  }
  if (a.on.scale) {
    const n = scaleCells3(fr.w / k), len = n * k, fs = 11 * u, seg = Math.min(4, n), w = len + 34 * u, h = 40 * u;
    items.push({ id: "scale", rank: 1, w, h, over: { x: fr.x + pad, y: fr.b - pad - h }, draw: (bx, by) => {
      const x = bx + 17 * u, y = by + 18 * u;
      let g = box2(bx, by, w, h);
      for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + len / seg * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? p.paper : p.ink}" stroke="${p.ink}" stroke-width="${n1(0.8 * u)}"/>`;
      g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${p.ink}" text-anchor="middle">0</text>`;
      g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${p.ink}" text-anchor="middle">${n * a.perCell} ${esc(a.unit)}</text>`;
      g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${p.ink}" text-anchor="middle">1 square = ${a.perCell} ${esc(a.unit)}</text>`;
      return `<g id="scale">${g}</g>`;
    } });
  }
  if (a.on.compass) items.push({ id: "compass", rank: 3, w: 44 * u, h: 56 * u, over: { x: fr.r - pad - 46 * u, y: fr.y + pad }, draw: (x, y) => {
    const c = compassSvg(x + 22 * u, y + 34 * u, 18 * u, u, { ink: p.ink, paper: p.paper });
    return a.north ? `<g transform="rotate(${n1(a.north)} ${n1(x + 22 * u)} ${n1(y + 34 * u)})">${c}</g>` : c;
  } });
  if (a.on.title && a.title) {
    const room = fr.w - 2 * pad - (a.on.compass ? 54 * u : 0), fs = Math.min(22 * u, Math.max(9 * u, (room - 30 * u) / (a.title.length * 0.6))), w = Math.min(room, Math.max(120 * u, a.title.length * fs * 0.6 + 30 * u)), h = fs * 1.7, title = a.title;
    items.push({ id: "title", rank: 0, w, h, over: { x: fr.x + pad, y: fr.y + pad }, draw: (x, y) => `<g id="title">${box2(x, y, w, h)}<text x="${n1(x + w / 2)}" y="${n1(y + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.05)}" text-anchor="middle" fill="${p.ink}">${esc(title)}</text></g>` });
  }
  return placeFurniture(items, fr, a.place, a.side, pad, a.covers);
}
function finish(fr, furn, defs, parts, p, u, unit) {
  const drawn = furn.placed.map((q) => q.item.draw(q.x, q.y)).join("");
  const out = { ...fr, w: fr.w + furn.band.right, h: fr.h + furn.band.bottom, r: fr.r + furn.band.right, b: fr.b + furn.band.bottom };
  const band = furn.band.right || furn.band.bottom ? `<rect x="${n1(out.x)}" y="${n1(out.y)}" width="${n1(out.w)}" height="${n1(out.h)}" fill="${p.paper}"/>` : "";
  const frame = band ? `<rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}" fill="none" stroke="${p.ink}" stroke-width="${n1(1.5 * u)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(out, unit)} font-family="${FONT}"><defs>${defs.join("")}<clipPath id="map-clip"><rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}"/></clipPath></defs>${band}<g clip-path="url(#map-clip)">${parts.join("")}${band ? "" : drawn}</g>${frame}${band ? drawn : ""}</svg>`;
}
var LABEL_PX = { area: 22, name: 15, note: 12, street: 12 };
function labelSize3(l, u, pageScale) {
  const pt2 = { area: PAGE_PT.dungeon.area, name: PAGE_PT.dungeon.name, note: PAGE_PT.dungeon.note, street: PAGE_PT.dungeon.note }[l.kind];
  return (pageScale ? pointsToPx(pt2, pageScale) : LABEL_PX[l.kind] * u) * (l.size ?? 1);
}
var textSizes = (u, pageScale) => ({ number: pageScale ? pointsToPx(PAGE_PT.dungeon.number, pageScale) : 15 * u, name: pageScale ? pointsToPx(PAGE_PT.dungeon.room, pageScale) : 12.5 * u });
function labelSvg(l, k, u, p, pageScale) {
  const fs = labelSize3(l, u, pageScale), text = l.kind === "area" ? l.text.toUpperCase() : l.text;
  const attrs = l.kind === "area" ? `font-weight="700" letter-spacing="${n1(fs * 0.16)}"` : l.kind === "name" ? 'font-weight="700"' : 'font-style="italic"';
  const t = haloText(text, l.x * k, l.y * k + fs * 0.35, fs, p.ink, { halo: p.halo }, attrs);
  const out = l.angle ? `<g transform="rotate(${n1(l.angle)} ${n1(l.x * k)} ${n1(l.y * k)})">${t}</g>` : t;
  return l.href ? `<a href="${esc(l.href)}">${out}</a>` : out;
}
function planSheet(spec, b) {
  const f = planFactor(spec);
  return { cols: Math.ceil(b.w * f - 1e-9) + 2 * PLAN_MARGIN, rows: Math.ceil(b.h * f - 1e-9) + 2 * PLAN_MARGIN, margin: PLAN_MARGIN };
}
function planTarget(spec, id, level) {
  const building2 = id ? spec.buildings.find((b) => b.id === id) : spec.buildings.find((b) => b.floors?.length);
  if (!building2) throw new Error(id ? `no building ${id}` : "no building with floors (give --building)");
  const floor2 = level !== void 0 ? floorAt(building2, level) : groundFloor(building2);
  if (level !== void 0 && !floor2) throw new Error(`building ${building2.id} has no floor at level ${level} (it has ${(building2.floors ?? []).map((f) => f.level).join(", ") || "none"})`);
  return { building: building2, floor: floor2 };
}
function legendFor(spec, p, view, floor2) {
  const out = [];
  if (view === "plan") {
    for (const kind of [...new Set((floor2?.fixtures ?? []).map((f) => f.kind))]) {
      const fx = FIXTURES[kind];
      if (!fx) continue;
      out.push({ name: fx.name.split(" (")[0], swatch: (x, y, s) => {
        const r = Math.max(fx.ft[0], fx.ft[1]);
        return `<g transform="translate(${n1(x)} ${n1(y)})">${tok(fx.draw(fx.ft[0] / r * s, fx.ft[1] / r * s, Math.max(0.6, s / 16)), p)}</g>`;
      } });
    }
    return out;
  }
  const sw = (x, y, s, fill, edge, extra = "") => `<rect x="${n1(x - s / 2)}" y="${n1(y - s * 0.35)}" width="${n1(s)}" height="${n1(s * 0.7)}" fill="${fill}" stroke="${edge}" stroke-width="1"${extra}/>`;
  const name = (s) => s[0].toUpperCase() + s.slice(1);
  for (const kind of [...new Set(spec.roads.map((r) => r.kind))]) {
    const st = p.road[kind];
    out.push({ name: `${name(kind)}`, swatch: (x, y, s) => kind === "path" ? `<path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${st.edge}" stroke-width="1.5" stroke-dasharray="3 2"/>` : sw(x, y, s, st.fill === "none" ? p.paper : st.fill, st.edge) });
  }
  for (const kind of [...new Set(spec.walls.map((w) => w.kind))]) out.push({ name: `${name(kind)} wall`, swatch: (x, y, s) => `<path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${p.ink}" stroke-width="${n1(s * 0.4)}"/><path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${p.wall[kind]}" stroke-width="${n1(s * 0.3)}"/>` });
  for (const kind of [...new Set(spec.water.map((w) => w.kind))]) out.push({ name: name(kind), swatch: (x, y, s) => sw(x, y, s, p.water, p.waterEdge) });
  for (const kind of [...new Set(spec.areas.map((a) => a.kind))]) out.push({ name: name(kind), swatch: (x, y, s) => sw(x, y, s, p.area[kind].fill, p.ink, ' stroke-opacity="0.4"') });
  return out;
}
function siteSvg(spec, o) {
  const k = o.ppu ?? 24, W = spec.cols * k, H = spec.rows * k, u = o.pageScale ? pageUnit(o.pageScale) : k / 24, p = PALETTES[o.theme ?? "color"];
  const l = o.layout ?? layoutSettlement(spec), on = settlementLayersFor(spec, "site", o.layers), mode = o.buildings ?? "roofs", fr = frameOf(o.crop, spec.cols, spec.rows, k);
  const parts = [], defs = [], per = spec.scale.perCell, sw = Math.max(0.6, 0.9 * u), ink = patternInk(o.theme ?? "color");
  const pat = /* @__PURE__ */ new Set(), usePat = (name, cells = 1) => {
    const id = `p-${name}`;
    if (!pat.has(id)) {
      pat.add(id);
      defs.push(patternDef(id, name, k, ink, cells));
    }
    return `url(#${id})`;
  };
  if (on.ground) parts.push(`<rect id="ground" width="${n1(W)}" height="${n1(H)}" fill="${p.ground[spec.ground]}"/>`);
  if (on.underlay && spec.underlay && o.underlay) parts.push(underlaySvg(spec, o.underlay.map, k, o.underlay.field));
  if (on.areas && spec.areas.length) {
    let g = "";
    for (const a of spec.areas) {
      const st = p.area[a.kind], d = ring(a.points, k);
      g += `<path d="${d}" fill="${st.fill}"${st.edge ? ` stroke="${st.edge}" stroke-width="${n1(sw * 1.4)}"${st.dash ? ` stroke-dasharray="${n1(k * 0.5)} ${n1(k * 0.25)}"` : ""}` : ""}/>`;
      if (st.pattern) g += `<path d="${d}" fill="${usePat(st.pattern, a.kind === "field" ? 1.5 : 1)}"/>`;
      if (p.ripples && !st.edge) g += `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="${n1(sw * 0.7)}" stroke-opacity="0.6"/>`;
    }
    parts.push(`<g id="areas">${g}</g>`);
  }
  if (on.water && l.water.length) {
    const edge = l.water.map((w) => w.area ? `<path d="${ring(w.pts, k)}" fill="${p.waterEdge}" stroke="${p.waterEdge}" stroke-width="${n1(sw * 2.4)}" stroke-linejoin="round"/>` : `<path d="${line(w.pts, k, w.closed)}" fill="none" stroke="${p.waterEdge}" stroke-width="${n1(w.width * k + sw * 2.4)}" stroke-linecap="${w.kind === "canal" || w.kind === "moat" ? "butt" : "round"}" stroke-linejoin="round"/>`).join("");
    const fill = (paint) => l.water.map((w) => w.area ? `<path d="${ring(w.pts, k)}" fill="${paint}"/>` : `<path d="${line(w.pts, k, w.closed)}" fill="none" stroke="${paint}" stroke-width="${n1(w.width * k)}" stroke-linecap="${w.kind === "canal" || w.kind === "moat" ? "butt" : "round"}" stroke-linejoin="round"/>`).join("");
    parts.push(`<g id="water">${edge}${fill(p.water)}${p.ripples ? fill(usePat("ripples", 1.5)) : ""}</g>`);
  }
  if (on.roads && l.roads.length) {
    const sorted = [...l.roads].sort((a, b) => b.width - a.width);
    let edges2 = "", fills = "";
    for (const r of sorted) {
      const st = p.road[r.kind], d = line(r.pts, k), w = r.width * k;
      if (r.kind === "path") {
        fills += `<path d="${d}" fill="none" stroke="${st.edge}" stroke-width="${n1(Math.max(sw, w * 0.5))}" stroke-dasharray="${n1(w * 1.2)} ${n1(w * 0.8)}" stroke-linecap="round" stroke-linejoin="round"/>`;
        continue;
      }
      const cap = st.ruts ? "butt" : "round";
      edges2 += `<path d="${d}" fill="none" stroke="${st.edge}" stroke-width="${n1(w + (st.ruts ? 0 : sw * 2.2))}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
      fills += `<path d="${d}" fill="none" stroke="${st.ruts ? p.ground[spec.ground] : st.fill}" stroke-width="${n1(st.ruts ? w * 0.62 : w)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
    }
    parts.push(`<g id="roads">${edges2}${fills}</g>`);
  }
  if (on.bridges && l.bridges.length) {
    let g = "";
    for (const b of l.bridges) {
      const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) * k, a = Math.atan2(b.y1 - b.y0, b.x1 - b.x0) * 180 / Math.PI, bw = b.width * k;
      g += `<g transform="translate(${n1(b.x0 * k)} ${n1(b.y0 * k)}) rotate(${n1(a)})"><rect x="0" y="${n1(-bw / 2)}" width="${n1(len)}" height="${n1(bw)}" fill="${p.fixture.stone}" stroke="${p.ink}" stroke-width="${n1(sw)}"/><path d="M0 ${n1(-bw / 2 + sw * 1.5)}H${n1(len)}M0 ${n1(bw / 2 - sw * 1.5)}H${n1(len)}" stroke="${p.ink}" stroke-width="${n1(sw * 1.6)}"/></g>`;
    }
    parts.push(`<g id="bridges">${g}</g>`);
  }
  if (on.walls && l.walls.length) parts.push(`<g id="walls">${l.walls.map((w) => wallSvg(w, k, p, u, W, H, defs)).join("")}</g>`);
  const txt = textSizes(u, o.pageScale);
  if (on.buildings && l.buildings.length) {
    let g = "";
    for (const bg of l.buildings) {
      const b = bg.building, fl2 = mode === "interior" ? groundFloor(b) : void 0;
      if (fl2) {
        const f2 = planFactor(spec), kp = k / f2, lay = layoutFloor(spec, b, fl2), [cx, cy] = [bg.cx * k, bg.cy * k];
        const drawn = floorSvg(lay, kp, p, u * 0.8, { grid: false, numbers: false, labels: false, fixtures: true, doors: true, windows: true, walls: true, floor: true }, `clip-b-${bg.index}`, 1, txt);
        g += `<g transform="translate(${n1(cx)} ${n1(cy)}) rotate(${n1(b.angle ?? 0)}) translate(${n1(-b.w / 2 * k)} ${n1(-b.h / 2 * k)})">${["floor", "fixtures", "walls", "doors", "windows"].map((x) => drawn[x] ?? "").join("")}</g>`;
      } else if (mode === "roofs") g += roofSvg(bg, k, p, u);
      else g += `<path d="${ring(bg.outline, k)}" fill="${p.floor}" stroke="${p.outerWall}" stroke-width="${n1(Math.max(1.5 * u, 0.25 * k))}" stroke-linejoin="miter"/>`;
    }
    parts.push(`<g id="buildings">${g}</g>`);
  }
  if (on.trees && (spec.trees.length || l.areaTrees.length)) {
    const all = [...l.areaTrees, ...spec.trees];
    parts.push(`<g id="trees">${all.map((t, i) => treeSvg(t, k, p, u, per, idSeed(`${t.x.toFixed(2)},${t.y.toFixed(2)}`) ^ i)).join("")}</g>`);
  }
  if (on.props && spec.props.length) parts.push(`<g id="props">${spec.props.map((f2) => {
    const [w, h] = fixtureSize(f2, per);
    return fixtureSvg({ kind: f2.kind, x: f2.x, y: f2.y, w, h, angle: f2.angle ?? 0 }, k, p, sw);
  }).join("")}</g>`);
  if (on.grid && spec.grid.show) {
    const s = spec.grid.size, ln2 = (step) => {
      let d = "";
      for (let x = 0; x <= spec.cols + 1e-9; x += step) d += `M${n1(x * k)} 0V${n1(H)}`;
      for (let y = 0; y <= spec.rows + 1e-9; y += step) d += `M0 ${n1(y * k)}H${n1(W)}`;
      return d;
    };
    let g = "";
    if (spec.grid.sub && s > 1) g += `<path d="${ln2(1)}" stroke="${p.grid}" stroke-opacity="${p.gridOpacity * 0.5}" stroke-width="${n1(0.6 * u)}"/>`;
    g += `<path d="${ln2(s)}" stroke="${p.grid}" stroke-opacity="${p.gridOpacity}" stroke-width="${n1(0.9 * u)}"/>`;
    parts.push(`<g id="grid" fill="none">${g}</g>`);
  }
  if (on.symbols && spec.overlay.symbols.length)
    parts.push(`<g id="symbols">${spec.overlay.symbols.map((s) => {
      const sym = SYMBOLS3[s.kind] ?? SYMBOLS2.trap;
      return `<g transform="translate(${n1(s.x * k)} ${n1(s.y * k)})${s.angle ? ` rotate(${n1(s.angle)})` : ""} scale(${(k / 20 * (s.scale ?? 1) * 1.5).toFixed(3)})">${sym.svg.replaceAll("{ink}", p.ink).replaceAll("{fill}", p.fixture.paper)}</g>`;
    }).join("")}</g>`);
  if (on.numbers || on.labels) {
    let nums4 = "", names = "";
    for (const bg of l.buildings) {
      const x = bg.cx * k, y = bg.cy * k, has = on.numbers && bg.number !== void 0, b = bg.building;
      if (has) nums4 += b.href ? `<a href="${esc(b.href)}">${badge(String(bg.number), x, y, txt.number, p)}</a>` : badge(String(bg.number), x, y, txt.number, p);
      if (on.labels && b.label) names += haloText(b.label, x, y + (has ? txt.number * 1.6 : txt.name * 0.3), txt.name, p.ink, { halo: p.halo }, 'font-weight="700"');
    }
    if (on.labels) {
      for (const a of spec.areas) if (a.label) {
        const xs = a.points.filter((_, i) => i % 2 === 0), ys = a.points.filter((_, i) => i % 2 === 1);
        names += haloText(a.label, (Math.min(...xs) + Math.max(...xs)) / 2 * k, (Math.min(...ys) + Math.max(...ys)) / 2 * k, txt.name, p.ink, { halo: p.halo }, 'font-style="italic"');
      }
      for (const r of l.roads) {
        const label = spec.roads[r.index].label;
        if (!label || r.pts.length < 4) continue;
        const i = Math.floor((r.pts.length / 2 - 1) / 2) * 2, x0 = r.pts[i], y0 = r.pts[i + 1], x1 = r.pts[i + 2], y1 = r.pts[i + 3];
        let a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
        if (a > 90) a -= 180;
        else if (a < -90) a += 180;
        const mx = (x0 + x1) / 2 * k, my = (y0 + y1) / 2 * k;
        names += `<g transform="rotate(${n1(a)} ${n1(mx)} ${n1(my)})">${haloText(label, mx, my + txt.name * 0.35, txt.name * 0.9, p.ink, { halo: p.halo }, 'font-style="italic"')}</g>`;
      }
    }
    if (nums4) parts.push(`<g id="numbers">${nums4}</g>`);
    if (names) parts.push(`<g id="names">${names}</g>`);
  }
  if (on.labels && spec.overlay.labels.length) parts.push(`<g id="labels">${spec.overlay.labels.map((lb) => labelSvg(lb, k, u, p, o.pageScale)).join("")}</g>`);
  const boxes = l.buildings.map((bg) => {
    const xs = bg.outline.filter((_, i) => i % 2 === 0), ys = bg.outline.filter((_, i) => i % 2 === 1);
    return { x: Math.min(...xs) * k, y: Math.min(...ys) * k, w: (Math.max(...xs) - Math.min(...xs)) * k, h: (Math.max(...ys) - Math.min(...ys)) * k };
  });
  const f = spec.furniture ?? { place: "over" };
  const furn = furniture({ fr, k, u, p, on, title: spec.title, perCell: per, unit: spec.scale.unit, legend: legendFor(spec, p, "site"), north: 0, place: f.place, side: f.side ?? "bottom", covers: (b) => boxes.some((x) => overlaps(x, b)) });
  return finish(fr, furn, defs, parts, p, u, o.unit);
}
function planSvg(spec, o) {
  const { building: b, floor: floor2 } = planTarget(spec, o.building, o.floor), sheet = planSheet(spec, b);
  const k = o.ppu ?? 40, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, p = PALETTES[o.theme ?? "color"], on = settlementLayersFor(spec, "plan", o.layers);
  const fr = frameOf(o.crop, sheet.cols, sheet.rows, k), W = sheet.cols * k, H = sheet.rows * k, M = sheet.margin * k;
  const parts = [], defs = [], txt = textSizes(u, o.pageScale);
  if (on.ground) parts.push(`<rect id="ground" width="${n1(W)}" height="${n1(H)}" fill="${p.ground[spec.ground]}"/>`);
  const empty = { level: 0, rooms: [] }, lay = layoutFloor(spec, b, floor2 ?? empty);
  const drawn = floorSvg(lay, k, p, u, { grid: on.grid, numbers: on.numbers, labels: on.labels, fixtures: on.fixtures, doors: on.doors, windows: on.windows, walls: on.walls, floor: on.floor }, "plan-clip", 1, txt);
  for (const layer of ["floor", "grid", "fixtures", "walls", "doors", "windows", "numbers", "labels"]) if (drawn[layer]) parts.push(`<g id="${layer}" transform="translate(${n1(M)} ${n1(M)})">${drawn[layer]}</g>`);
  const title = `${b.label ?? b.kind[0].toUpperCase() + b.kind.slice(1)} \u2014 ${floor2 ? floorName(floor2) : "no floors yet"}`;
  const f = spec.furniture ?? { place: "auto" };
  const fb = { x: M, y: M, w: lay.w * k, h: lay.h * k };
  const furn = furniture({ fr, k, u, p, on, title, perCell: spec.interior.perCell, unit: spec.scale.unit, legend: legendFor(spec, p, "plan", floor2), north: -(b.angle ?? 0), place: f.place, side: f.side ?? "bottom", covers: (x) => overlaps(x, fb) });
  return finish(fr, furn, defs, parts, p, u, o.unit);
}
function renderSettlementSvg(spec, o = {}) {
  return (o.view ?? "site") === "plan" ? planSvg(spec, o) : siteSvg(spec, o);
}
function settlementRenderSize(spec, o = {}) {
  const svg = renderSettlementSvg(spec, { ...o, unit: "px", layers: { ...o.layers, underlay: false } }), m = svg.match(/width="([\d.]+)[a-z]*" height="([\d.]+)/);
  return { width: m ? +m[1] : 0, height: m ? +m[2] : 0 };
}

// ../artgen-core/src/settlement/interior.ts
var ORIGIN = "gen";
var ROLES = {
  house: { ground: ["hall", "store"], upper: [["bedroom", "bedroom"]], min: 3, stories: 1 },
  cottage: { ground: ["cottage"], upper: [], min: 3, single: true, stories: 1 },
  shop: { ground: ["shop", "store"], upper: [["bedroom", "bedroom"]], min: 3, stories: 2 },
  inn: { ground: ["taproom", "kitchen", "store"], upper: [["guest", "guest", "guest", "guest"]], cellar: ["cellar"], min: 3, stories: 2 },
  tavern: { ground: ["taproom", "kitchen", "store"], upper: [], cellar: ["cellar"], min: 3, stories: 1 },
  smithy: { ground: ["forge", "store"], upper: [], min: 3, stories: 1 },
  temple: { ground: ["nave", "vestry", "store"], upper: [], min: 4, stories: 1 },
  chapel: { ground: ["nave"], upper: [], min: 4, single: true, stories: 1 },
  hall: { ground: ["great-hall", "kitchen", "store"], upper: [], min: 4, stories: 1 },
  barn: { ground: ["barn"], upper: [], min: 4, single: true, stories: 1 },
  stable: { ground: ["stable"], upper: [], min: 4, single: true, stories: 1 },
  mill: { ground: ["mill", "store"], upper: [["store"]], min: 3, stories: 2 },
  warehouse: { ground: ["warehouse", "warehouse"], upper: [], min: 4, stories: 1 },
  keep: { ground: ["store", "guard", "store"], upper: [["great-hall"], ["lord", "chamber"]], cellar: ["cellar"], min: 3, stories: 3 },
  tower: { ground: ["guard"], upper: [["armoury"], ["chamber"]], min: 3, single: true, stories: 3 },
  gatehouse: { ground: ["guard"], upper: [["winch"]], min: 3, single: true, stories: 2 },
  barracks: { ground: ["barracks", "mess"], upper: [], min: 4, stories: 1 },
  manor: { ground: ["great-hall", "kitchen", "study", "store"], upper: [["lord", "bedroom", "bedroom"]], cellar: ["cellar"], min: 3, stories: 2 },
  ruin: { ground: ["ruin"], upper: [], min: 4, stories: 1 }
};
var storiesOf = (kind) => ROLES[kind].stories;
var ROOM_NAMES = {
  hall: "Hall",
  store: "Store",
  bedroom: "Bedroom",
  cottage: "Living room",
  shop: "Shop",
  taproom: "Taproom",
  kitchen: "Kitchen",
  guest: "Guest room",
  cellar: "Cellar",
  forge: "Forge",
  nave: "Nave",
  vestry: "Vestry",
  "great-hall": "Great hall",
  barn: "Barn",
  stable: "Stalls",
  mill: "Mill room",
  warehouse: "Warehouse",
  guard: "Guard room",
  lord: "Lord's chamber",
  chamber: "Chamber",
  armoury: "Armoury",
  winch: "Winch room",
  barracks: "Barracks",
  mess: "Mess",
  study: "Study",
  ruin: "Ruin"
};
var FURNISH = {
  hall: [["fireplace", "wall"], ["table", "centre"], ["bench", "wall"], ["chest", "wall"], ["shelf", "wall", 1, 0.6]],
  cottage: [["hearth", "centre"], ["bed", "wall"], ["table", "wall"], ["stool", "free", 2], ["chest", "wall"], ["barrel", "corner", 1, 0.6]],
  bedroom: [["bed", "wall", 1], ["bed", "wall", 1, 0.4], ["chest", "wall"], ["wardrobe", "wall", 1, 0.5]],
  store: [["barrel", "corner", 2], ["crate", "corner", 2], ["sacks", "wall"], ["shelf", "wall", 1, 0.6]],
  shop: [["counter", "centre"], ["shelf", "wall", 2], ["chest", "wall"], ["crate", "corner", 1, 0.6]],
  taproom: [["bar", "far"], ["fireplace", "wall"], ["table", "free"], ["round-table", "free", 2], ["stool", "free", 3], ["bench", "wall", 1, 0.6]],
  kitchen: [["oven", "wall"], ["table", "centre"], ["barrel", "corner"], ["shelf", "wall"], ["cauldron", "free", 1, 0.6]],
  guest: [["bed", "wall"], ["chest", "wall"], ["stool", "free", 1, 0.5]],
  cellar: [["barrel", "wall", 4], ["crate", "corner", 2], ["sacks", "wall", 1, 0.7]],
  forge: [["forge", "wall"], ["anvil", "centre"], ["trough", "wall"], ["weapon-rack", "wall"], ["barrel", "corner", 1, 0.6]],
  nave: [["altar", "far"], ["pew", "rows", 8], ["statue", "corner", 2, 0.6]],
  vestry: [["chest", "wall"], ["shelf", "wall"], ["table", "centre", 1, 0.6]],
  "great-hall": [["throne", "far"], ["long-table", "feast"], ["fireplace", "wall"], ["rug", "under", 1, 0.5]],
  barn: [["haystack", "corner", 2], ["sacks", "wall", 2], ["crate", "corner"], ["cart", "free", 1, 0.6]],
  stable: [["trough", "wall", 2], ["haystack", "corner"], ["sacks", "wall"]],
  mill: [["millstone", "centre"], ["sacks", "wall", 3], ["crate", "corner"]],
  warehouse: [["crate", "corner", 4], ["barrel", "wall", 3], ["sacks", "wall", 2]],
  guard: [["table", "centre"], ["stool", "free", 2], ["weapon-rack", "wall"], ["chest", "wall"], ["bunk", "wall", 1, 0.6]],
  barracks: [["bunk", "rows", 8], ["chest", "wall", 2], ["weapon-rack", "wall"]],
  mess: [["long-table", "feast"], ["fireplace", "wall"], ["barrel", "corner"]],
  lord: [["double-bed", "wall"], ["wardrobe", "wall"], ["chest", "wall"], ["desk", "wall"], ["rug", "under"], ["bath", "free", 1, 0.5]],
  chamber: [["bed", "wall"], ["chest", "wall"], ["desk", "wall", 1, 0.6]],
  study: [["desk", "wall"], ["bookcase", "wall", 2], ["chair", "free"], ["rug", "under", 1, 0.6]],
  armoury: [["weapon-rack", "wall", 3], ["chest", "wall", 2], ["crate", "corner"]],
  winch: [["cauldron", "centre"], ["weapon-rack", "wall"], ["crate", "corner"]],
  ruin: [["crate", "free", 1, 0.3]]
};
var boxOf = (f, w, h, angle) => {
  const turned = Math.abs(Math.round(angle / 90)) % 2 === 1, bw = turned ? h : w, bh = turned ? w : h;
  return { x: f.x - bw / 2, y: f.y - bh / 2, w: bw, h: bh };
};
var hits = (a, b, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
var r2 = (v) => Math.round(v * 100) / 100;
function frontSide(spec, b) {
  const f = planFactor(spec), W = b.w * f, H = b.h * f;
  const mids = [["n", W / 2, 0], ["e", W, H / 2], ["s", W / 2, H], ["w", 0, H / 2]];
  let best = "s", bd = Infinity;
  for (const [side, px, py] of mids) {
    const [x, y] = planToSite(spec, b, px, py);
    for (const r of spec.roads) {
      if (r.kind === "path" || r.kind === "track") continue;
      const d = nearestOnLine(r.points, x, y).d - roadWidth(spec, r) / 2;
      if (d < bd) {
        bd = d;
        best = side;
      }
    }
  }
  return best;
}
function splitFloor(spec, b, level, min, single, rand) {
  const f = planFactor(spec), tag = level < 0 ? `c${-level}` : `f${level}`;
  const blocks = [];
  if (b.shape === "rect" || b.shape === "L" || b.shape === "T") buildingWings(b).forEach(([x, y, w, h], i) => blocks.push({ id: `${tag}${"abc"[i]}`, shape: "rect", x: (x - b.x) * f, y: (y - b.y) * f, w: w * f, h: h * f, split: { mode: "bsp", min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 }));
  else if (b.shape === "poly") {
    const o = planOutline(spec, b), xs = o.filter((_, i) => i % 2 === 0), ys = o.filter((_, i) => i % 2 === 1);
    blocks.push({ id: `${tag}a`, shape: "poly", points: o, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), split: { mode: "bsp", min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 });
  } else blocks.push({ id: `${tag}a`, shape: b.shape, x: 0, y: 0, w: b.w * f, h: b.h * f, split: { mode: "bsp", min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 });
  const rooms = [], connections = [], wingRooms = [];
  for (const bl of blocks) {
    const whole = single || bl.w * bl.h < min * min * 2.2;
    const part = whole ? { rooms: [bl.shape === "rect" ? { id: `${bl.id}-1`, shape: "rect", x: bl.x, y: bl.y, w: bl.w, h: bl.h } : { id: `${bl.id}-1`, shape: bl.shape === "poly" ? "poly" : bl.shape, x: bl.x, y: bl.y, w: bl.w, h: bl.h, ...bl.points && { points: bl.points } }], connections: [] } : splitBlock(bl);
    wingRooms.push(part.rooms);
    rooms.push(...part.rooms);
    connections.push(...part.connections.map((c) => ({ a: c.a, b: c.b, ...c.kind && c.kind !== "secret" && { kind: c.kind } })));
  }
  for (let i = 1; i < wingRooms.length; i++) {
    let best = null;
    for (const a of wingRooms[0]) for (const c of wingRooms[i]) {
      const len = sharedEdges(roomOutline(a), roomOutline(c)).reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
      if (len >= 1 && (!best || len > best[2])) best = [a, c, len];
    }
    if (best) connections.push({ a: best[0].id, b: best[1].id });
  }
  return { rooms: rooms.map((r) => ({ ...r, x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h), origin: ORIGIN })), connections: connections.map((c) => ({ ...c, origin: ORIGIN })) };
}
function place(pl, room, outline2, kind, where, rand, per, farFrom, size) {
  const fx = FIXTURES[kind];
  if (!fx) return false;
  let [fw, fh] = size ?? [fx.ft[0] / per, fx.ft[1] / per];
  const { x, y, w, h } = room, inset = 0.12;
  const cands = [];
  const along2 = (n) => Array.from({ length: n }, () => 0.15 + rand() * 0.7);
  const wall = (side, t) => {
    if (side === "n") return { x: x + w * t, y: y + inset + fh / 2, angle: 0 };
    if (side === "s") return { x: x + w * t, y: y + h - inset - fh / 2, angle: 180 };
    if (side === "w") return { x: x + inset + fh / 2, y: y + h * t, angle: 270 };
    return { x: x + w - inset - fh / 2, y: y + h * t, angle: 90 };
  };
  const sides = ["n", "s", "e", "w"];
  if (where === "far" && farFrom) {
    const far = sides.map((s) => {
      const p = wall(s, 0.5);
      return { s, d: Math.hypot(p.x - farFrom.x, p.y - farFrom.y) };
    }).sort((p, q) => q.d - p.d);
    for (const { s } of far) cands.push(wall(s, 0.5), ...along2(3).map((t) => wall(s, t)));
  } else if (where === "wall" || where === "far") for (const s of sides.sort(() => rand() - 0.5)) cands.push(...along2(4).map((t) => wall(s, t)));
  else if (where === "corner") for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]].sort(() => rand() - 0.5)) cands.push({ x: x + inset + fw / 2 + cx * (w - 2 * inset - fw), y: y + inset + fh / 2 + cy * (h - 2 * inset - fh), angle: 0 });
  else if (where === "centre" || where === "under") {
    const turn = h > w * 1.2 ? 90 : 0;
    cands.push({ x: x + w / 2, y: y + h / 2, angle: turn }, ...Array.from({ length: 6 }, () => ({ x: x + w / 2 + (rand() - 0.5) * w * 0.3, y: y + h / 2 + (rand() - 0.5) * h * 0.3, angle: turn })));
  } else for (let i = 0; i < 24; i++) cands.push({ x: x + 0.4 + rand() * (w - 0.8), y: y + 0.4 + rand() * (h - 0.8), angle: rand() < 0.5 ? 0 : 90 });
  for (const c of cands) {
    const bx = boxOf(c, fw, fh, c.angle), corners = [[bx.x, bx.y], [bx.x + bx.w, bx.y], [bx.x, bx.y + bx.h], [bx.x + bx.w, bx.y + bx.h]];
    if (!corners.every(([px, py]) => inPolygon(outline2, px + (px < c.x ? 0.02 : -0.02), py + (py < c.y ? 0.02 : -0.02)))) continue;
    if (where !== "under" && pl.boxes.some((o) => hits(o, bx, 0.12))) continue;
    if (pl.keepOut.some((k) => k.x > bx.x - 0.7 && k.x < bx.x + bx.w + 0.7 && k.y > bx.y - 0.7 && k.y < bx.y + bx.h + 0.7)) continue;
    pl.fixtures.push({ kind, x: r2(c.x), y: r2(c.y), ...size && { w: r2(fw), h: r2(fh) }, ...c.angle && { angle: c.angle }, origin: ORIGIN });
    if (where !== "under") pl.boxes.push(bx);
    return true;
  }
  return false;
}
function rows(pl, room, kind, n, per, door) {
  const fx = FIXTURES[kind], long = room.w >= room.h, L2 = long ? room.w : room.h, S = long ? room.h : room.w, aisle = 1;
  const len = Math.min(fx.ft[0] / per, (S - aisle - 0.4) / 2), depth = fx.ft[1] / per, step = depth + (kind === "bunk" ? 0.6 : 0.5);
  if (len < 0.6) return;
  const fromStart = !door || (long ? Math.abs(door.x - room.x) < Math.abs(door.x - room.x - room.w) : Math.abs(door.y - room.y) < Math.abs(door.y - room.y - room.h));
  let placed = 0;
  for (let t = 1.2 + depth / 2; t < L2 - 2.2 && placed < n; t += step) {
    const a = fromStart ? t : L2 - t;
    for (const sg of [-1, 1]) {
      const off = aisle / 2 + len / 2, c = long ? { x: room.x + a, y: room.y + room.h / 2 + sg * off } : { x: room.x + room.w / 2 + sg * off, y: room.y + a };
      const angle = long ? 90 : 0, bx = boxOf(c, len, depth, angle);
      if (pl.boxes.some((o) => hits(o, bx, 0.05)) || pl.keepOut.some((k) => k.x > bx.x - 0.6 && k.x < bx.x + bx.w + 0.6 && k.y > bx.y - 0.6 && k.y < bx.y + bx.h + 0.6)) continue;
      pl.fixtures.push({ kind, x: r2(c.x), y: r2(c.y), w: r2(len), h: r2(depth), ...angle && { angle }, origin: ORIGIN });
      pl.boxes.push(bx);
      placed++;
    }
  }
}
function feast(pl, room, kind, per) {
  const long = room.w >= room.h, L2 = (long ? room.w : room.h) * 0.6, d = FIXTURES[kind].ft[1] / per, b = FIXTURES.bench.ft[1] / per, c = { x: room.x + room.w / 2, y: room.y + room.h / 2 };
  if (L2 < 1.5 || (long ? room.h : room.w) < d + 2 * b + 1) return;
  const angle = long ? 0 : 90, items = [[kind, 0, L2, d], ["bench", -(d / 2 + b / 2 + 0.15), L2 * 0.9, b], ["bench", d / 2 + b / 2 + 0.15, L2 * 0.9, b]];
  for (const [k, off, w, h] of items) {
    const p = long ? { x: c.x, y: c.y + off } : { x: c.x + off, y: c.y }, bx = boxOf(p, w, h, angle);
    if (pl.boxes.some((o) => hits(o, bx, 0.05))) continue;
    pl.fixtures.push({ kind: k, x: r2(p.x), y: r2(p.y), w: r2(w), h: r2(h), ...angle && { angle }, origin: ORIGIN });
    pl.boxes.push(bx);
  }
}
function windowsFor(outline2, doors, kind) {
  const narrow = kind === "keep" || kind === "tower" || kind === "gatehouse" || kind === "barracks", none = kind === "barn" || kind === "ruin" || kind === "warehouse";
  if (none) return [];
  const out = [], gap = narrow ? 4 : 3, width = narrow ? 0.4 : kind === "temple" || kind === "chapel" ? 1.4 : 1;
  for (let i = 0, j = outline2.length - 2; i < outline2.length; j = i, i += 2) {
    const ax = outline2[j], ay = outline2[j + 1], bx = outline2[i], by = outline2[i + 1], L2 = Math.hypot(bx - ax, by - ay);
    if (L2 < 2.4) continue;
    const n = Math.max(1, Math.floor((L2 - 1) / gap)), step = L2 / (n + 1);
    for (let k = 1; k <= n; k++) {
      const t = step * k, x = ax + (bx - ax) * t / L2, y = ay + (by - ay) * t / L2;
      if (t < 1 || L2 - t < 1 || doors.some((d) => Math.hypot(d.x - x, d.y - y) < 1.6)) continue;
      out.push({ at: [r2(x), r2(y)], ...width !== 1 && { width } });
    }
  }
  return out;
}
function doorOn(outline2, side, W, H) {
  let best = side === "n" ? [W / 2, 0] : side === "s" ? [W / 2, H] : side === "w" ? [0, H / 2] : [W, H / 2], len = 0;
  for (let i = 0, j = outline2.length - 2; i < outline2.length; j = i, i += 2) {
    const ax = outline2[j], ay = outline2[j + 1], bx = outline2[i], by = outline2[i + 1], L2 = Math.hypot(bx - ax, by - ay);
    const horizontal2 = Math.abs(ay - by) < 1e-6, vertical = Math.abs(ax - bx) < 1e-6;
    const facing = side === "n" || side === "s" ? horizontal2 : vertical;
    if (!facing || L2 < 1) continue;
    const out = side === "n" ? -ay : side === "s" ? ay : side === "w" ? -ax : ax, score = L2 + out * 0.01;
    if (score > len) {
      len = score;
      best = horizontal2 ? [Math.round((ax + bx) / 2 * 2) / 2, ay] : [ax, Math.round((ay + by) / 2 * 2) / 2];
    }
  }
  return best;
}
function generateInterior(spec, b, o = {}) {
  const R2 = ROLES[b.kind], rand = rng(o.seed ?? idSeed(`${b.id}:${b.kind}`)), f = planFactor(spec), per = spec.interior.perCell;
  const W = b.w * f, H = b.h * f, outline2 = planOutline(spec, b), stories = Math.max(1, o.stories ?? b.stories ?? R2.stories);
  const roundish = b.shape === "circle" || b.shape === "octagon";
  const levels = [...R2.cellar && W * H >= 30 ? [-1] : [], ...Array.from({ length: stories }, (_, i) => i)];
  const front = frontSide(spec, b), entry = doorOn(outline2, front, W, H);
  const back = W * H > 60 && rand() < 0.5 ? doorOn(outline2, { n: "s", s: "n", e: "w", w: "e" }[front], W, H) : null;
  const spiral = roundish || b.kind === "tower" || b.kind === "keep" || b.kind === "gatehouse";
  const sw = spiral ? FIXTURES["spiral-stairs"].ft[0] / per : FIXTURES.stairs.ft[0] / per, sd = spiral ? sw : FIXTURES.stairs.ft[1] / per;
  let stair = null;
  if (levels.length > 1) {
    const cands = [];
    for (const [cx, cy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]]) {
      const x = spiral ? W * cx : cx < 0.5 ? 0.15 + sw / 2 : W - 0.15 - sw / 2, y = spiral ? H * cy : cy < 0.5 ? 0.15 + sd / 2 : H - 0.15 - sd / 2;
      cands.push({ x: r2(x), y: r2(y), angle: 0 });
    }
    cands.sort((p, q) => Math.hypot(q.x - entry[0], q.y - entry[1]) - Math.hypot(p.x - entry[0], p.y - entry[1]));
    stair = cands.find((c) => {
      const bx = boxOf(c, sw, sd, 0);
      return [[bx.x, bx.y], [bx.x + bx.w, bx.y], [bx.x, bx.y + bx.h], [bx.x + bx.w, bx.y + bx.h]].every(([px, py]) => inPolygon(outline2, px, py));
    }) ?? null;
  }
  const floors = [];
  for (const level of levels) {
    const roles = level < 0 ? R2.cellar : level === 0 ? R2.ground : R2.upper[Math.min(level - 1, R2.upper.length - 1)] ?? ["store"];
    const single = !!R2.single || roles.length === 1 || level < 0;
    const { rooms, connections } = splitFloor(spec, b, level, Math.max(2, R2.min - (level > 0 ? 0.5 : 0)), single, rand);
    const fl2 = { level, rooms, connections, origin: ORIGIN };
    if (level === 0) fl2.doors = [{ at: entry }, ...back ? [{ at: back }] : []];
    fl2.windows = level < 0 ? [] : windowsFor(outline2, level === 0 ? [{ x: entry[0], y: entry[1] }, ...back ? [{ x: back[0], y: back[1] }] : []] : [], b.kind);
    if (!fl2.windows.length) delete fl2.windows;
    const lay = layoutFloor(spec, b, fl2);
    const pl = { fixtures: [], boxes: [], keepOut: [...lay.inner, ...lay.doors].map((d) => ({ x: d.x, y: d.y })) };
    if (stair) {
      const up = levels.includes(level + 1), down = levels.includes(level - 1);
      const kind = spiral ? "spiral-stairs" : level < 0 || up ? "stairs-up" : "stairs-down";
      if (up || down) {
        pl.fixtures.push({ kind, x: stair.x, y: stair.y, origin: ORIGIN });
        pl.boxes.push(boxOf(stair, sw, sd, 0));
      }
    }
    const order = rooms.map((r, i) => ({ r, i, a: polygonArea(roomOutline(r)) })).sort((p, q) => q.a - p.a);
    order.forEach(({ r }, n) => {
      const role = roles[n] ?? (level > 0 ? "bedroom" : "store"), out = roomOutline(r);
      const doorNear = lay.doors.concat(lay.inner).filter((d) => d.x >= r.x - 0.1 && d.x <= r.x + r.w + 0.1 && d.y >= r.y - 0.1 && d.y <= r.y + r.h + 0.1)[0] ?? null;
      if (ROOM_NAMES[role] && r.w * r.h >= 6) r.label = ROOM_NAMES[role];
      for (const [kind, where, count = 1, chance = 1] of FURNISH[role] ?? []) {
        if (rand() > chance) continue;
        if (where === "rows") rows(pl, r, kind, count, per, doorNear);
        else if (where === "feast") feast(pl, r, kind, per);
        else for (let c = 0; c < count; c++) place(pl, r, out, kind, where, rand, per, doorNear);
      }
    });
    fl2.fixtures = [...pl.fixtures.filter((x) => x.kind === "rug"), ...pl.fixtures.filter((x) => x.kind !== "rug")];
    if (level === levels[levels.length - 1] && level === 0 && !fl2.fixtures.length) delete fl2.fixtures;
    floors.push(fl2);
  }
  return floors;
}
function withInterior(spec, id, o = {}) {
  const b = spec.buildings.find((x) => x.id === id);
  if (!b) throw new Error(`no building ${id}`);
  const floors = generateInterior(spec, b, o);
  return { ...spec, buildings: spec.buildings.map((x) => x.id === id ? { ...x, floors, ...o.stories !== void 0 && { stories: o.stories } } : x) };
}

// ../artgen-core/src/settlement/generate.ts
var ORIGIN2 = "gen";
var r22 = (v) => Math.round(v * 100) / 100;
var flat = (pts2) => pts2.flatMap(([x, y]) => [r22(x), r22(y)]);
function groundFromMap(spec, field) {
  const u = spec.underlay, T2 = (t) => TERRAINS.indexOf(t);
  const at3 = (x, y) => {
    const mx = u.origin[0] + x * u.scale, my = u.origin[1] + y * u.scale, i = Math.floor(mx * field.res), j = Math.floor(my * field.res);
    return i < 0 || j < 0 || i >= field.w || j >= field.h ? -1 : j * field.w + i;
  };
  const elev = (x, y) => {
    const n = at3(x, y);
    return n < 0 ? 0 : field.elevation[n];
  };
  return {
    water: (x, y) => {
      const n = at3(x, y);
      return n >= 0 && (field.terrain[n] === T2("water") || field.terrain[n] === T2("deep"));
    },
    slope: (x, y) => {
      const d = 1;
      return Math.hypot(elev(x + d, y) - elev(x - d, y), elev(x, y + d) - elev(x, y - d)) / (2 * d * u.scale);
    },
    forest: (x, y) => {
      const n = at3(x, y);
      return n >= 0 && field.terrain[n] === T2("forest");
    }
  };
}
var FLAT = { water: () => false, slope: () => 0, forest: () => false };
var SIZE_FT = {
  house: [20, 30, 15, 22],
  cottage: [15, 22, 12, 16],
  shop: [18, 25, 22, 30],
  inn: [40, 50, 30, 40],
  tavern: [30, 35, 25, 30],
  smithy: [25, 30, 20, 25],
  temple: [35, 45, 55, 70],
  chapel: [20, 25, 30, 35],
  hall: [50, 60, 30, 35],
  barn: [40, 50, 25, 30],
  stable: [40, 50, 15, 20],
  mill: [25, 30, 25, 30],
  warehouse: [40, 50, 25, 30],
  keep: [40, 50, 40, 50],
  tower: [20, 25, 20, 25],
  gatehouse: [30, 30, 20, 20],
  barracks: [50, 60, 20, 25],
  manor: [50, 60, 35, 45],
  ruin: [20, 30, 15, 20]
};
var SHAPE_OF = { temple: "T", manor: "L", inn: "L" };
var INN_A = ["Prancing", "Drowned", "Golden", "Sleeping", "Crooked", "Laughing", "Silver", "Black", "Wandering", "Red", "Jolly", "Rusty"];
var INN_B = ["Pony", "Rat", "Goose", "Giant", "Lantern", "Boar", "Kettle", "Stag", "Friar", "Dragon", "Anchor", "Crown"];
var Grid = class {
  res = 2;
  w;
  h;
  used;
  constructor(cols, rows2) {
    this.w = cols * 2;
    this.h = rows2 * 2;
    this.used = new Uint8Array(this.w * this.h);
  }
  idx(x, y) {
    const i = Math.floor(x * this.res), j = Math.floor(y * this.res);
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i;
  }
  taken(x, y) {
    const n = this.idx(x, y);
    return n < 0 || this.used[n] > 0;
  }
  mark(x, y, v = 1) {
    const n = this.idx(x, y);
    if (n >= 0) this.used[n] = Math.max(this.used[n], v);
  }
  /** Mark (or test) a polygon, grown by `pad` cells. */
  poly(p, pad, test) {
    const xs = p.filter((_, i) => i % 2 === 0), ys = p.filter((_, i) => i % 2 === 1), s = 1 / this.res;
    for (let y = Math.min(...ys) - pad; y <= Math.max(...ys) + pad; y += s) for (let x = Math.min(...xs) - pad; x <= Math.max(...xs) + pad; x += s) {
      const inside = inPolygon(p, x, y) || pad > 0 && nearestOnLine([...p, p[0], p[1]], x, y).d <= pad;
      if (!inside) continue;
      if (test) {
        if (this.taken(x, y)) return true;
      } else this.mark(x, y);
    }
    return false;
  }
  line(pts2, half) {
    const s = 1 / this.res;
    for (let i = 0; i + 3 < pts2.length; i += 2) {
      const x0 = Math.min(pts2[i], pts2[i + 2]) - half, x1 = Math.max(pts2[i], pts2[i + 2]) + half, y0 = Math.min(pts2[i + 1], pts2[i + 3]) - half, y1 = Math.max(pts2[i + 1], pts2[i + 3]) + half;
      for (let y = y0; y <= y1; y += s) for (let x = x0; x <= x1; x += s) if (nearestOnLine(pts2.slice(i, i + 4), x, y).d <= half) this.mark(x, y);
    }
  }
};
function route2(a, b, cols, rows2, cost) {
  const W = cols + 1, H = rows2 + 1, key = (x, y) => y * W + x, N = W * H;
  const g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const ax = Math.max(0, Math.min(cols, Math.round(a[0]))), ay = Math.max(0, Math.min(rows2, Math.round(a[1]))), bx = Math.max(0, Math.min(cols, Math.round(b[0]))), by = Math.max(0, Math.min(rows2, Math.round(b[1])));
  const h = (x, y) => Math.hypot(x - bx, y - by);
  const heap2 = [], push = (f, n) => {
    heap2.push([f, n]);
    let i = heap2.length - 1;
    while (i > 0) {
      const p = i - 1 >> 1;
      if (heap2[p][0] <= heap2[i][0]) break;
      [heap2[p], heap2[i]] = [heap2[i], heap2[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap2[0], last = heap2.pop();
    if (heap2.length) {
      heap2[0] = last;
      let i = 0;
      for (; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap2.length && heap2[l][0] < heap2[m][0]) m = l;
        if (r < heap2.length && heap2[r][0] < heap2[m][0]) m = r;
        if (m === i) break;
        [heap2[m], heap2[i]] = [heap2[i], heap2[m]];
        i = m;
      }
    }
    return top;
  };
  g[key(ax, ay)] = 0;
  push(h(ax, ay), key(ax, ay));
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap2.length) {
    const [, n] = pop();
    if (done[n]) continue;
    done[n] = 1;
    const x = n % W, y = (n - x) / W;
    if (x === bx && y === by) break;
    for (const [dx, dy] of steps) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const m = key(nx, ny), c = g[n] + Math.hypot(dx, dy) * cost(nx, ny);
      if (c < g[m]) {
        g[m] = c;
        from[m] = n;
        push(c + h(nx, ny), m);
      }
    }
  }
  const out = [];
  for (let n = key(bx, by); n >= 0; n = from[n]) out.push([n % W, Math.floor(n / W)]);
  out.reverse();
  return out.length ? out : [a, b];
}
var calm = (pts2) => simplifyLine(chaikin({ pts: pts2.flat(), closed: false }, 2), 0.35).pts.map(r22);
function edgePoint(c, angle, cols, rows2) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const t = Math.min(dx > 0 ? (cols - c[0]) / dx : dx < 0 ? -c[0] / dx : Infinity, dy > 0 ? (rows2 - c[1]) / dy : dy < 0 ? -c[1] / dy : Infinity);
  return [c[0] + dx * t, c[1] + dy * t];
}
function blob(c, rx, ry, n, wobble, rand) {
  const out = [], a0 = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + i / n * Math.PI * 2, f = 1 + (rand() - 0.5) * wobble;
    out.push([c[0] + Math.cos(a) * rx * f, c[1] + Math.sin(a) * ry * f]);
  }
  return out;
}
function mapWater(spec, field) {
  const u = spec.underlay, out = [], toSheet = (mx, my) => [(mx - u.origin[0]) / u.scale, (my - u.origin[1]) / u.scale];
  for (const r of field.rivers) {
    const pts2 = [];
    for (let i = 0; i < r.pts.length; i += 2) pts2.push(toSheet(r.pts[i], r.pts[i + 1]));
    const inside = pts2.map(([x, y]) => x > -2 && y > -2 && x < spec.cols + 2 && y < spec.rows + 2);
    const first = inside.indexOf(true), last = inside.lastIndexOf(true);
    if (first < 0) continue;
    const run = pts2.slice(Math.max(0, first - 1), last + 2), width = r.widths.reduce((s, v) => s + v, 0) / r.widths.length / u.scale;
    if (run.length >= 2) out.push({ kind: width > 3 ? "river" : "stream", points: flat(simplifyLine({ pts: run.flat(), closed: false }, 0.3).pts.reduce((a, v, i, s) => i % 2 ? a : [...a, [v, s[i + 1]]], [])), width: r22(Math.max(0.6, width)), origin: ORIGIN2 });
  }
  const W = spec.cols + 3, H = spec.rows + 3, f = new Float32Array(W * H), g = groundFromMap(spec, field);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) f[j * W + i] = g.water(i - 1, j - 1) ? 1 : 0;
  for (const l of isolines(f, W, H, 0.5)) {
    if (!l.closed || l.pts.length < 8) continue;
    const pts2 = simplifyLine(l, 0.4).pts.map((v, i) => r22(Math.max(-1, Math.min(i % 2 ? spec.rows + 1 : spec.cols + 1, v - 0.5))));
    const area = polygonArea(pts2);
    if (area < 4) continue;
    const touches2 = pts2.some((v, i) => v <= -0.5 || v >= (i % 2 ? spec.rows : spec.cols) + 0.5);
    out.push({ kind: touches2 && area > spec.cols * spec.rows * 0.08 ? "sea" : area > 60 ? "lake" : "pond", points: pts2, origin: ORIGIN2 });
  }
  return out;
}
function mapWoods(spec, ground2) {
  const W = spec.cols + 3, H = spec.rows + 3, f = new Float32Array(W * H), out = [];
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) f[j * W + i] = ground2.forest(i - 1, j - 1) ? 1 : 0;
  for (const l of isolines(f, W, H, 0.5)) {
    if (!l.closed) continue;
    const pts2 = simplifyLine(l, 0.5).pts.map((v, i) => r22(Math.max(0, Math.min(i % 2 ? spec.rows : spec.cols, v - 0.5))));
    if (pts2.length >= 6 && polygonArea(pts2) > 12) out.push({ kind: "wood", points: pts2, origin: ORIGIN2 });
  }
  return out;
}
function crossings2(line2, ringPts) {
  const out = [];
  for (let i = 0; i + 3 < line2.length; i += 2) for (let j = 0; j < ringPts.length; j++) {
    const c = segmentCross([line2[i], line2[i + 1]], [line2[i + 2], line2[i + 3]], ringPts[j], ringPts[(j + 1) % ringPts.length]);
    if (c) out.push(c);
  }
  return out;
}
function generateSettlement(spec, ctx = {}) {
  const s = structuredClone(spec), g = s.gen, rand = rng(s.seed * 7919 + 29), cols = s.cols, rows2 = s.rows, per = s.scale.perCell, ft = (v) => v / per;
  const hand = (xs) => xs.filter((x) => x.origin !== ORIGIN2);
  s.roads = hand(s.roads);
  s.water = hand(s.water);
  s.walls = hand(s.walls);
  s.buildings = hand(s.buildings);
  s.areas = hand(s.areas);
  s.trees = hand(s.trees);
  s.props = hand(s.props);
  s.overlay = { labels: s.overlay.labels.filter((l) => l.origin !== ORIGIN2), symbols: s.overlay.symbols.filter((x) => x.origin !== ORIGIN2) };
  const ground2 = s.underlay && ctx.field ? groundFromMap(s, ctx.field) : FLAT;
  const big = s.kind === "town" || s.kind === "city", castleOnly = s.kind === "castle";
  if (s.underlay && ctx.field) {
    s.water.push(...mapWater(s, ctx.field));
    s.areas.push(...mapWoods(s, ground2));
  } else if (g.water === "river") {
    const vertical = rand() < 0.5, n2 = 7, pts2 = [], off = (vertical ? cols : rows2) * (0.62 + rand() * 0.2);
    for (let i = 0; i <= n2; i++) {
      const t = i / n2, wob = Math.sin(t * Math.PI * (1.5 + rand()) + rand() * 6) * (vertical ? cols : rows2) * 0.06;
      pts2.push(vertical ? [off + wob, -1 + t * (rows2 + 2)] : [-1 + t * (cols + 2), off + wob]);
    }
    const width = ft(s.kind === "hamlet" ? 10 : s.kind === "village" ? 25 : 45);
    s.water.push({ kind: s.kind === "hamlet" ? "stream" : "river", points: flat(pts2), width: r22(width), origin: ORIGIN2 });
  } else if (g.water === "lake") {
    const c = [cols * (rand() < 0.5 ? 0.2 : 0.8), rows2 * (rand() < 0.5 ? 0.22 : 0.78)];
    s.water.push({ kind: "lake", points: flat(blob(c, cols * 0.14, rows2 * 0.14, 10, 0.4, rand)), origin: ORIGIN2 });
  } else if (g.water === "coast") {
    const side = Math.floor(rand() * 4), depth = 0.16 + rand() * 0.06, pts2 = [], n2 = 10;
    for (let i = 0; i <= n2; i++) {
      const t = i / n2, w = Math.sin(t * 7 + rand() * 3) * 0.03 + depth;
      pts2.push(side === 0 ? [t * cols, rows2 * w] : side === 1 ? [cols * (1 - w), t * rows2] : side === 2 ? [t * cols, rows2 * (1 - w)] : [cols * w, t * rows2]);
    }
    const corner = side === 0 ? [[cols + 1, -1], [-1, -1]] : side === 1 ? [[cols + 1, rows2 + 1], [cols + 1, -1]] : side === 2 ? [[cols + 1, rows2 + 1], [-1, rows2 + 1]] : [[-1, rows2 + 1], [-1, -1]];
    const ring2 = side === 0 || side === 3 ? [...pts2, ...side === 0 ? corner : corner.reverse()] : [...pts2, ...corner];
    s.water.push({ kind: "sea", points: flat(ring2), origin: ORIGIN2 });
  }
  let lay = layoutSettlement(s);
  const wet = (x, y, pad = 0) => ground2.water(x, y) || lay.water.some((w) => w.area ? inPolygon(w.pts, x, y) || pad > 0 && nearestOnLine([...w.pts, w.pts[0], w.pts[1]], x, y).d < pad : nearestOnLine(w.pts, x, y).d < w.width / 2 + pad);
  let C3 = [cols * (0.42 + rand() * 0.16), rows2 * (0.42 + rand() * 0.16)];
  for (let r = 0; r < Math.max(cols, rows2) && wet(C3[0], C3[1], 4); r += 1) C3 = [C3[0] + (rand() - 0.5) * r * 0.8, C3[1] + (rand() - 0.5) * r * 0.8].map((v, i) => Math.max(4, Math.min((i ? rows2 : cols) - 4, v)));
  const occ = new Grid(cols, rows2);
  for (let y = 0.25; y < rows2; y += 0.5) for (let x = 0.25; x < cols; x += 0.5) if (wet(x, y, 0.3)) occ.mark(x, y);
  for (const b of s.buildings) occ.poly(rotatePts(footprint(b), b.angle ?? 0, b.x + b.w / 2, b.y + b.h / 2), 0.3, false);
  const roadCost = (x, y) => (wet(x, y) ? 14 : 1) + ground2.slope(x, y) * 40 + (x <= 0 || y <= 0 || x >= cols || y >= rows2 ? 3 : 0);
  const addRoad = (kind, pts2, label) => {
    const r = { kind, points: pts2, curve: "smooth", ...label && { label }, origin: ORIGIN2 };
    s.roads.push(r);
    occ.line(pts2, roadWidth(s, r) / 2 + 0.2);
    return r;
  };
  const lotFt = big ? 25 * 30 : 30 * 40, coreR = Math.max(ft(60), Math.sqrt(g.buildings * ft(Math.sqrt(lotFt)) ** 2 / (Math.PI * (0.25 + g.density * 0.35))));
  const Rcore = Math.min(coreR, Math.min(cols, rows2) * 0.42);
  const through = [];
  const nThrough = castleOnly ? 1 : s.kind === "hamlet" ? 1 : s.kind === "village" ? 2 : big ? 4 : 2;
  const a0 = rand() * Math.PI * 2;
  for (let i = 0; i < nThrough; i++) {
    const a = a0 + i * Math.PI * 2 / nThrough + (rand() - 0.5) * 0.5, e = edgePoint(C3, a, cols, rows2);
    const kind = big ? "highway" : castleOnly ? "lane" : "street";
    through.push(addRoad(kind, calm(route2(e, C3, cols, rows2, roadCost))));
  }
  if (s.kind === "hamlet" || s.kind === "village") {
    const e = edgePoint(C3, a0 + Math.PI + (rand() - 0.5) * 0.6, cols, rows2);
    through.push(addRoad(s.kind === "hamlet" ? "lane" : "street", calm(route2(C3, e, cols, rows2, roadCost))));
  }
  if (g.market && !castleOnly) {
    const half = ft(big ? 45 : 30);
    const sq = [[C3[0] - half, C3[1] - half * 0.75], [C3[0] + half, C3[1] - half * 0.75], [C3[0] + half, C3[1] + half * 0.75], [C3[0] - half, C3[1] + half * 0.75]];
    s.areas.push({ kind: big ? "market" : "square", points: flat(sq), label: big ? "Market" : void 0, origin: ORIGIN2 });
    occ.poly(flat(sq), 0.2, false);
    s.props.push({ kind: big ? "fountain" : "well", x: r22(C3[0]), y: r22(C3[1]), origin: ORIGIN2 });
    if (big) for (let i = 0; i < 4; i++) s.props.push({ kind: "stall", x: r22(C3[0] + (i % 2 ? 1 : -1) * half * 0.6), y: r22(C3[1] + (i < 2 ? -1 : 1) * half * 0.45), angle: i < 2 ? 0 : 180, origin: ORIGIN2 });
  } else if (!castleOnly) s.props.push({ kind: "well", x: r22(C3[0] + ft(12)), y: r22(C3[1] + ft(12)), origin: ORIGIN2 });
  let wallRing = null;
  if (g.wall !== "none" && !castleOnly) {
    let ring2 = blob(C3, Rcore + ft(25), (Rcore + ft(25)) * (0.8 + rand() * 0.3), big ? 12 : 9, 0.18, rand);
    ring2 = ring2.map(([x, y]) => {
      let p = [x, y];
      for (let k = 0; k < 20 && (wet(p[0], p[1], 1) || p[0] < 2 || p[1] < 2 || p[0] > cols - 2 || p[1] > rows2 - 2); k++) p = [p[0] + (C3[0] - p[0]) * 0.1, p[1] + (C3[1] - p[1]) * 0.1];
      return p;
    });
    wallRing = ring2;
    const kind = g.wall === "stone" ? "stone" : "palisade", gates = [];
    for (const r of through) for (const c of crossings2(r.points, ring2)) if (!gates.some((q) => Math.hypot(q.at[0] - c[0], q.at[1] - c[1]) < 4)) gates.push({ at: [r22(c[0]), r22(c[1])], kind: kind === "stone" ? "gatehouse" : "gate", ...g.water === "moat" && { drawbridge: true } });
    const w = { kind, points: flat(ring2), closed: true, ...kind === "stone" ? { towers: { shape: rand() < 0.5 ? "round" : "square", at: "corners" } } : {}, gates, origin: ORIGIN2 };
    s.walls.push(w);
    occ.line([...w.points, w.points[0], w.points[1]], wallThickness(s, w) / 2 + ft(8));
    if (g.water === "moat") s.water.push({ kind: "moat", points: flat([...offsetRing(ring2, wallThickness(s, w) / 2 + ft(14)), offsetRing(ring2, wallThickness(s, w) / 2 + ft(14))[0]]), width: r22(ft(18)), origin: ORIGIN2 });
  }
  if (!castleOnly) {
    const lanes = s.kind === "hamlet" ? 1 : s.kind === "village" ? 3 : s.kind === "city" ? 18 : big ? 10 : 4, sideKind = big ? "street" : "lane";
    if (g.streets === "grid" && big) {
      const step = ft(140);
      for (let x = C3[0] - Rcore; x <= C3[0] + Rcore; x += step) addRoad("street", [r22(x), r22(C3[1] - Rcore), r22(x), r22(C3[1] + Rcore)]).curve = "none";
      for (let y = C3[1] - Rcore; y <= C3[1] + Rcore; y += step) addRoad("street", [r22(C3[0] - Rcore), r22(y), r22(C3[0] + Rcore), r22(y)]).curve = "none";
    } else {
      if (g.streets === "radial" && big) addRoad("street", flat([...blob(C3, Rcore * 0.55, Rcore * 0.55, 14, 0.1, rand), blob(C3, Rcore * 0.55, Rcore * 0.55, 14, 0.1, rng(0))[0]]));
      for (let i = 0, tries2 = 0; i < lanes && tries2 < lanes * 8; tries2++) {
        const pool = s.roads.flatMap((r) => r.kind === "path" || r.kind === "track" ? [] : Array.from({ length: r.points.length / 2 - 1 }, (_, j) => [r.points[2 * j], r.points[2 * j + 1], r.points[2 * j + 2], r.points[2 * j + 3]])).filter((q) => Math.hypot(q[0] - C3[0], q[1] - C3[1]) < Rcore * 0.85);
        if (!pool.length) break;
        const [sx, sy, nx, ny] = pool[Math.floor(rand() * pool.length)], a = Math.atan2(ny - sy, nx - sx) + (rand() < 0.5 ? 1 : -1) * Math.PI / 2 + (rand() - 0.5) * 0.5;
        const len = Rcore * (0.35 + rand() * 0.45);
        let end = [sx + Math.cos(a) * len, sy + Math.sin(a) * len];
        for (let k = 0; k < 12 && (Math.hypot(end[0] - C3[0], end[1] - C3[1]) > Rcore * 0.95 || wallRing && !inPolygon(flat(wallRing), end[0], end[1])); k++) end = [end[0] + (sx - end[0]) * 0.15, end[1] + (sy - end[1]) * 0.15];
        end = [Math.max(1, Math.min(cols - 1, end[0])), Math.max(1, Math.min(rows2 - 1, end[1]))];
        if (wet(end[0], end[1], 1) || Math.hypot(end[0] - sx, end[1] - sy) < Rcore * 0.2) continue;
        const pts2 = calm(route2([sx, sy], end, cols, rows2, roadCost));
        const along2 = [];
        for (let j = 2; j < pts2.length; j += 2) along2.push([pts2[j], pts2[j + 1]]);
        const doubled = along2.filter(([x, y]) => s.roads.some((r) => nearestOnLine(r.points, x, y).d < roadWidth(s, r) / 2 + ft(20))).length;
        if (along2.length && doubled > along2.length * 0.4) continue;
        addRoad(i >= lanes * 0.6 && big ? "alley" : sideKind, pts2);
        i++;
      }
    }
  }
  const castleRect = (cx, cy, w, h) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
  const put = (kind, cx, cy, w, h, extra = {}) => {
    const b = { id: "", kind, shape: SHAPE_OF[kind] && kind !== "inn" ? SHAPE_OF[kind] : "rect", x: r22(cx - w / 2), y: r22(cy - h / 2), w: r22(w), h: r22(h), stories: storiesOf(kind), origin: ORIGIN2, ...extra };
    s.buildings.push(b);
    occ.poly(rotatePts(footprint(b), b.angle ?? 0, cx, cy), 0.2, false);
    return b;
  };
  const fit = (kind, long, short, cands, extra = {}) => {
    for (const { p, vertical } of cands) {
      const w = vertical ? short : long, h = vertical ? long : short, box2 = flat(castleRect(p[0], p[1], w, h));
      if (box2.some((v, i) => v < 0.5 || v > (i % 2 ? rows2 : cols) - 0.5) || occ.poly(box2, ft(2), true)) continue;
      return put(kind, p[0], p[1], w, h, extra);
    }
    return null;
  };
  const alongWalls = (cc, cw, ch, inset, near3, far = false) => {
    const out = [], step = ft(5);
    for (let t = -0.5; t <= 0.5; t += step / Math.max(cw, ch)) {
      out.push({ p: [cc[0] + t * cw, cc[1] - ch / 2 + inset], vertical: false, d: 0 }, { p: [cc[0] + t * cw, cc[1] + ch / 2 - inset], vertical: false, d: 0 });
      out.push({ p: [cc[0] - cw / 2 + inset, cc[1] + t * ch], vertical: true, d: 0 }, { p: [cc[0] + cw / 2 - inset, cc[1] + t * ch], vertical: true, d: 0 });
    }
    for (const o of out) o.d = Math.hypot(o.p[0] - near3[0], o.p[1] - near3[1]) * (far ? -1 : 1);
    return out.sort((a, b) => a.d - b.d);
  };
  if (g.castle) {
    const cw = ft(castleOnly ? 150 : 130), ch = ft(castleOnly ? 120 : 110);
    const dir = a0 + Math.PI / nThrough;
    const cc = castleOnly ? C3 : [Math.max(cw / 2 + 4, Math.min(cols - cw / 2 - 4, C3[0] + Math.cos(dir) * Rcore * 0.75)), Math.max(ch / 2 + 4, Math.min(rows2 - ch / 2 - 4, C3[1] + Math.sin(dir) * Rcore * 0.75))];
    const inner = castleRect(cc[0], cc[1], cw, ch), road = through[0], gateAt = crossings2(road.points, inner)[0] ?? [cc[0], cc[1] + ch / 2];
    const tower = ft(28), curtain = { kind: "curtain", points: flat(inner), closed: true, towers: { shape: rand() < 0.6 ? "round" : "square", at: "corners", size: r22(tower) }, gates: [{ at: [r22(gateAt[0]), r22(gateAt[1])], kind: "gatehouse", ...(castleOnly || g.water === "moat") && { drawbridge: true } }], origin: ORIGIN2 };
    s.walls.push(curtain);
    s.buildings = s.buildings.filter((b) => b.origin !== ORIGIN2 || !inPolygon(flat(inner), b.x + b.w / 2, b.y + b.h / 2));
    occ.line([...flat(inner), inner[0][0], inner[0][1]], wallThickness(s, curtain) / 2 + ft(2));
    for (const [x, y] of inner) occ.poly(flat(castleRect(x, y, tower * 1.1, tower * 1.1)), 0, false);
    occ.poly(flat(castleRect(gateAt[0], gateAt[1], ft(70), ft(70))), 0, false);
    const back = [cc[0] - (gateAt[0] - cc[0]), cc[1] - (gateAt[1] - cc[1])], inset = (d) => wallThickness(s, curtain) / 2 + ft(9) + d / 2;
    const keep = fit("keep", ft(45), ft(45), alongWalls(cc, cw, ch, inset(ft(45)), back).map((o) => ({ ...o, p: [o.p[0] + (cc[0] - o.p[0]) * 0.25, o.p[1] + (cc[1] - o.p[1]) * 0.25] })), { label: "Keep", roof: "battlement" });
    const k0 = keep ? [keep.x + keep.w / 2, keep.y + keep.h / 2] : cc;
    fit("hall", ft(55), ft(30), alongWalls(cc, cw, ch, inset(ft(30)), k0), { label: "Great hall" });
    fit("chapel", ft(32), ft(22), alongWalls(cc, cw, ch, inset(ft(22)), k0, true).filter((o) => Math.hypot(o.p[0] - gateAt[0], o.p[1] - gateAt[1]) > ft(50)), { label: "Chapel" });
    fit("barracks", ft(40), ft(22), alongWalls(cc, cw, ch, inset(ft(22)), gateAt), {});
    s.props.push({ kind: "well", x: r22(cc[0] + (gateAt[0] - cc[0]) * 0.3), y: r22(cc[1] + (gateAt[1] - cc[1]) * 0.3), origin: ORIGIN2 });
    occ.poly(flat(inner), ft(6), false);
    if (castleOnly) {
      const outer = blob(cc, Math.min(cw * 1.2, cc[0] - 3, cols - cc[0] - 3), Math.min(ch * 1.3, cc[1] - 3, rows2 - cc[1] - 3), 10, 0.1, rand);
      const og = crossings2(road.points, outer)[0];
      s.walls.push({ kind: "stone", points: flat(outer), closed: true, towers: { shape: "round", at: "corners" }, gates: og ? [{ at: [r22(og[0]), r22(og[1])], kind: "gatehouse" }] : [], origin: ORIGIN2 });
      occ.line([...flat(outer), outer[0][0], outer[0][1]], ft(14));
      if (og) occ.poly(flat(castleRect(og[0], og[1], ft(60), ft(60))), 0, false);
      if (g.water === "moat") {
        const m = offsetRing(inner, wallThickness(s, curtain) / 2 + ft(16));
        s.water.push({ kind: "moat", points: flat([...m, m[0]]), width: r22(ft(20)), origin: ORIGIN2 });
        occ.line(flat([...m, m[0]]), ft(14));
      }
      const ring2 = [];
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * Math.PI * 2, d = 0.86 + rand() * 0.1;
        ring2.push({ p: [cc[0] + Math.cos(a) * cw * d, cc[1] + Math.sin(a) * ch * d], vertical: Math.abs(Math.cos(a)) > 0.7 });
      }
      for (const [kind, l, sh, extra] of [["stable", 45, 15, { label: "Stables" }], ["barn", 40, 28, {}], ["smithy", 25, 22, {}]]) fit(kind, ft(l), ft(sh), ring2.sort(() => rand() - 0.5), extra);
    }
  }
  lay = layoutSettlement(s);
  const quota = Math.max(0, Math.round(g.buildings));
  let placed = s.buildings.filter((b) => b.origin === ORIGIN2 && !["keep", "hall", "chapel", "barracks"].includes(b.kind)).length;
  const specials = castleOnly ? [] : s.kind === "hamlet" ? ["barn"] : s.kind === "village" ? ["inn", "temple", "smithy", "mill", "barn", "tavern"] : ["temple", "inn", "inn", "tavern", "smithy", "smithy", "hall", "manor", "warehouse", "warehouse", "mill", "stable", "chapel", "tavern"];
  const queue = [...specials], later = [], tries = {};
  const fill = () => big ? rand() < 0.55 ? "house" : "shop" : s.kind === "hamlet" ? rand() < 0.6 ? "cottage" : "house" : rand() < 0.4 ? "cottage" : "house";
  const spots = [];
  for (const r of lay.roads) {
    if (r.kind === "path" || r.kind === "track") continue;
    for (let i = 0; i + 3 < r.pts.length; i += 2) {
      const x0 = r.pts[i], y0 = r.pts[i + 1], x1 = r.pts[i + 2], y1 = r.pts[i + 3], len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 0.01) continue;
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len, step = ft(big ? 14 : 20) * (1.3 - g.density * 0.5);
      for (let t = 0; t < len; t += step) for (const sg of [-1, 1]) {
        const x = x0 + ux * t, y = y0 + uy * t;
        spots.push({ x, y, angle: Math.atan2(uy, ux) * 180 / Math.PI, nx: -uy * sg, ny: ux * sg, off: r.width / 2 + ft(big ? 3 : 6) + rand() * ft(4), d: Math.hypot(x - C3[0], y - C3[1]) + rand() * ft(30), road: r.kind });
      }
    }
  }
  spots.sort((p, q) => p.d - q.d);
  const reach = wallRing ? null : Rcore * 1.35;
  const named = (b) => {
    if (b.kind === "inn" || b.kind === "tavern") b.label = `The ${INN_A[Math.floor(rand() * INN_A.length)]} ${INN_B[Math.floor(rand() * INN_B.length)]}`;
    else if (b.kind === "temple") b.label = "Temple";
  };
  const nearWater = (x, y) => lay.water.some((w) => w.area ? nearestOnLine([...w.pts, w.pts[0], w.pts[1]], x, y).d < ft(25) : nearestOnLine(w.pts, x, y).d < w.width / 2 + ft(25));
  const retry = (k) => {
    if (specials.includes(k)) ((tries[k] = (tries[k] ?? 0) + 1) < 25 ? queue : later).push(k);
  };
  for (const sp of spots) {
    if (placed >= quota) break;
    if (wallRing && !inPolygon(flat(wallRing), sp.x, sp.y) && placed < quota * 0.8) continue;
    if (reach && sp.d > reach * 1.15) continue;
    const first = queue.length ? queue.shift() : null, kinds = first && !(first === "mill" && !nearWater(sp.x, sp.y)) ? [first, fill()] : [fill()];
    if (first && kinds.length === 1) retry(first);
    let b = null, kind = kinds[0], fw = 0, dh = 0;
    for (const k of kinds) {
      const [f0, f1, d0, d1] = SIZE_FT[k];
      fw = ft(f0 + rand() * (f1 - f0));
      dh = ft(d0 + rand() * (d1 - d0));
      const cx = sp.x + sp.nx * (sp.off + dh / 2), cy = sp.y + sp.ny * (sp.off + dh / 2);
      const shape = SHAPE_OF[k] ?? (k === "house" && rand() < 0.15 ? "L" : "rect");
      const c = { id: "", kind: k, shape, x: r22(cx - fw / 2), y: r22(cy - dh / 2), w: r22(fw), h: r22(dh), angle: r22(sp.angle), stories: k === "house" || k === "shop" ? big ? 2 : rand() < 0.3 ? 2 : 1 : storiesOf(k), origin: ORIGIN2 };
      if (shape === "T" || shape === "L") {
        const facing = sp.nx * -Math.sin(sp.angle * Math.PI / 180) + sp.ny * Math.cos(sp.angle * Math.PI / 180);
        if (facing < 0) c.angle = r22(sp.angle + 180);
      }
      const out = rotatePts(footprint(c), c.angle ?? 0, cx, cy);
      if (out.some((v, i) => v < 0.5 || v > (i % 2 ? rows2 : cols) - 0.5) || occ.poly(out, ft(2 + (1 - g.density) * 6), true)) {
        if (k === first) retry(k);
        continue;
      }
      occ.poly(out, ft(1), false);
      b = c;
      kind = k;
      break;
    }
    if (!b) continue;
    s.buildings.push(b);
    placed++;
    named(b);
    const behind = (depth, kindA) => {
      const bx = sp.x + sp.nx * (sp.off + dh + 0.3), by = sp.y + sp.ny * (sp.off + dh + 0.3), ux = Math.cos(sp.angle * Math.PI / 180), uy = Math.sin(sp.angle * Math.PI / 180), hw = fw / 2;
      const poly = [[bx - ux * hw, by - uy * hw], [bx + ux * hw, by + uy * hw], [bx + ux * hw + sp.nx * depth, by + uy * hw + sp.ny * depth], [bx - ux * hw + sp.nx * depth, by - uy * hw + sp.ny * depth]];
      if (poly.some(([x, y]) => x < 0 || y < 0 || x > cols || y > rows2) || occ.poly(flat(poly), 0, true)) return;
      occ.poly(flat(poly), 0.2, false);
      s.areas.push({ kind: kindA, points: flat(poly), origin: ORIGIN2 });
    };
    if (kind === "temple") behind(ft(40), "graveyard");
    else if (!big && (kind === "house" || kind === "cottage") && rand() < 0.6) behind(ft(15 + rand() * 20), "garden");
    else if (kind === "smithy" || kind === "inn") behind(ft(20), "yard");
  }
  queue.push(...later);
  if (big || queue.length) {
    for (let n2 = 0; n2 < quota * 40 && (placed < quota || queue.length) && (big || queue.length); n2++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * Rcore * (big ? 1 : 1.3), x = C3[0] + Math.cos(a) * d, y = C3[1] + Math.sin(a) * d;
      if (wallRing && !inPolygon(flat(wallRing), x, y) || occ.taken(x, y)) continue;
      let best = { d: Infinity, angle: 0 };
      for (const r of lay.roads) {
        if (r.kind === "path" || r.kind === "track") continue;
        const n3 = nearestOnLine(r.pts, x, y);
        if (n3.d < best.d) {
          const i = n3.seg * 2;
          best = { d: n3.d, angle: Math.atan2(r.pts[i + 3] - r.pts[i + 1], r.pts[i + 2] - r.pts[i]) * 180 / Math.PI };
        }
      }
      if (best.d > ft(160)) continue;
      const kind = queue.length && (n2 % 2 === 0 || !big) ? queue[0] : big && placed < quota ? fill() : null;
      if (!kind) continue;
      const [f0, f1, d0, d1] = SIZE_FT[kind], fw = ft(f0 + rand() * (f1 - f0)), dh = ft(d0 + rand() * (d1 - d0));
      const b = { id: "", kind, shape: SHAPE_OF[kind] ?? "rect", x: r22(x - fw / 2), y: r22(y - dh / 2), w: r22(fw), h: r22(dh), angle: r22(best.angle), stories: kind === "house" || kind === "shop" ? 2 : storiesOf(kind), origin: ORIGIN2 };
      const out = rotatePts(footprint(b), b.angle, x, y);
      if (out.some((v, i) => v < 0.5 || v > (i % 2 ? rows2 : cols) - 0.5) || occ.poly(out, ft(3), true)) continue;
      occ.poly(out, ft(1), false);
      s.buildings.push(b);
      placed++;
      if (kind === queue[0]) {
        queue.shift();
        named(b);
      }
    }
  }
  const fieldCount = Math.round(g.fields * (castleOnly ? 3 : big ? 6 : 8));
  for (let i = 0, tries2 = 0; i < fieldCount && tries2 < fieldCount * 30; tries2++) {
    const a = rand() * Math.PI * 2, d = Rcore * (1.3 + rand() * 1.2), cx = C3[0] + Math.cos(a) * d, cy = C3[1] + Math.sin(a) * d;
    const w = ft(60 + rand() * 120), h = ft(40 + rand() * 80), ang = rand() * 40 - 20;
    const poly = rotatePts([cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2], ang, cx, cy);
    if (poly.some((v, j) => v < 0 || v > (j % 2 ? rows2 : cols)) || occ.poly(poly, 0.5, true)) continue;
    occ.poly(poly, 0.3, false);
    const kindA = rand() < 0.65 ? "field" : rand() < 0.5 ? "paddock" : "orchard";
    s.areas.push({ kind: kindA, points: poly.map(r22), origin: ORIGIN2 });
    i++;
  }
  if (g.trees > 0.35 && !s.areas.some((a) => a.kind === "wood")) {
    const corners = [[0, 0], [cols, 0], [0, rows2], [cols, rows2]].sort((p, q) => Math.hypot(q[0] - C3[0], q[1] - C3[1]) - Math.hypot(p[0] - C3[0], p[1] - C3[1]));
    for (const cn of corners) {
      const c = [cn[0] ? cols - cols * 0.12 : cols * 0.12, cn[1] ? rows2 - rows2 * 0.12 : rows2 * 0.12], ring2 = blob(c, cols * 0.13, rows2 * 0.13, 9, 0.35, rand).map(([x, y]) => [Math.max(0, Math.min(cols, x)), Math.max(0, Math.min(rows2, y))]);
      if (occ.poly(flat(ring2), 0, true)) continue;
      occ.poly(flat(ring2), 0, false);
      s.areas.push({ kind: "wood", points: flat(ring2), origin: ORIGIN2 });
      break;
    }
  }
  const treeN = Math.round(g.trees * cols * rows2 * 0.012), sizes = { tree: ft(15), conifer: ft(12), bush: ft(5) };
  for (let i = 0, tries2 = 0; i < treeN && tries2 < treeN * 6; tries2++) {
    const x = rand() * cols, y = rand() * rows2;
    if (occ.taken(x, y) || s.areas.some((a) => a.kind !== "paddock" && a.kind !== "garden" && inPolygon(a.points, x, y))) continue;
    const t = rand(), kind = ground2.forest(x, y) || t < 0.62 ? "tree" : t < 0.78 ? "conifer" : t < 0.95 ? "bush" : "boulder";
    const size = kind === "boulder" ? ft(8) : sizes[kind] * (0.8 + rand() * 0.4);
    s.trees.push({ kind, x: r22(x), y: r22(y), size: r22(size), origin: ORIGIN2 });
    occ.mark(x, y);
    i++;
  }
  for (const b of s.buildings) {
    if (b.origin !== ORIGIN2) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, side = rotatePts([cx + b.w / 2 + ft(5), cy], b.angle ?? 0, cx, cy);
    const prop = b.kind === "barn" ? { kind: "haystack", x: side[0], y: side[1] } : b.kind === "stable" ? { kind: "trough", x: side[0], y: side[1], angle: (b.angle ?? 0) + 90 } : b.kind === "inn" ? { kind: "cart", x: side[0], y: side[1], angle: b.angle ?? 0 } : b.kind === "smithy" ? { kind: "woodpile", x: side[0], y: side[1], angle: (b.angle ?? 0) + 90 } : null;
    if (prop && !occ.taken(prop.x, prop.y)) {
      s.props.push({ ...prop, x: r22(prop.x), y: r22(prop.y), ...prop.angle !== void 0 && { angle: r22(prop.angle) }, origin: ORIGIN2 });
      occ.mark(prop.x, prop.y);
    }
  }
  const used = new Set(s.buildings.filter((b) => b.origin !== ORIGIN2).map((b) => b.id));
  let n = 0;
  for (const b of s.buildings) if (b.origin === ORIGIN2) {
    do
      n++;
    while (used.has(`b${n}`));
    b.id = `b${n}`;
    used.add(b.id);
  }
  if (g.interiors) {
    for (const b of s.buildings) if (b.origin === ORIGIN2) b.floors = generateInterior(s, b);
  }
  return parseSettlement(s);
}
var feetIn2 = (unit) => ({ ft: 1, yd: 3, m: 3.28084, mi: 5280, km: 3280.84 })[unit] ?? 1;
function settlementFromMap(spec, mapPath, map, field, origin) {
  const scale = Math.round(spec.scale.perCell * feetIn2(spec.scale.unit) / (map.scale.perCell * feetIn2(map.scale.unit)) * 1e4) / 1e4;
  const s = { ...spec, underlay: { map: mapPath, origin, scale } };
  return generateSettlement(s, { map, field });
}

// ../artgen-core/src/settlement/lint.ts
function share(poly, test) {
  const xs = poly.filter((_, i) => i % 2 === 0), ys = poly.filter((_, i) => i % 2 === 1);
  let n = 0, hit = 0;
  for (let y = Math.min(...ys) + 0.25; y < Math.max(...ys); y += 0.5) for (let x = Math.min(...xs) + 0.25; x < Math.max(...xs); x += 0.5) {
    if (!inPolygon(poly, x, y)) continue;
    n++;
    if (test(x, y)) hit++;
  }
  return n ? hit / n : 0;
}
var STAIRS = ["stairs", "stairs-up", "stairs-down", "spiral-stairs", "ladder", "trapdoor"];
function lintSettlement(spec, l = layoutSettlement(spec)) {
  const out = [];
  const add = (severity, path, message) => out.push({ severity, path, message });
  const off = (x, y) => x < 0 || y < 0 || x > spec.cols || y > spec.rows;
  l.buildings.forEach((g, i) => {
    const at3 = `buildings[${i}]`, b = g.building;
    if (polygonArea(g.outline) < 0.25) add("error", at3, "the footprint has (almost) no area");
    if (g.outline.some((v, j) => j % 2 ? v < 0 || v > spec.rows : v < 0 || v > spec.cols)) add("warning", at3, `${b.id} runs off the sheet`);
    const wet = share(g.outline, (x, y) => inWater(l.water, x, y));
    if (wet > 0.2) add("warning", at3, `${b.id} stands in water (${Math.round(wet * 100)}% of it)`);
    const onRoad = l.roads.findIndex((r) => r.kind !== "path" && share(g.outline, (x, y) => nearestOnLine(r.pts, x, y).d < r.width / 2) > 0.2);
    if (onRoad >= 0) add("warning", at3, `${b.id} stands across roads[${onRoad}] (a ${l.roads[onRoad].kind})`);
    for (let j = 0; j < i; j++) {
      const o = l.buildings[j], ob = o.building;
      if (Math.abs(o.cx - g.cx) > (b.w + b.h + ob.w + ob.h) / 2 || Math.abs(o.cy - g.cy) > (b.w + b.h + ob.w + ob.h) / 2) continue;
      if (share(g.outline, (x, y) => inPolygon(o.outline, x, y)) > 0.05) add("warning", at3, `${b.id} overlaps ${ob.id} (buildings[${j}])`);
    }
    const outline2 = planOutline(spec, b), levels = new Map((b.floors ?? []).map((f) => [f.level, f]));
    (b.floors ?? []).forEach((fl2, fi) => {
      const fa = `${at3}.floors[${fi}]`;
      fl2.rooms.forEach((r, ri) => {
        const ro = roomOutline(r);
        if (share(ro, (x, y) => !inPolygon(outline2, x, y)) > 0.1) add("warning", `${fa}.rooms[${ri}]`, `room ${r.id} reaches outside the footprint`);
      });
      const boxes = (fl2.fixtures ?? []).map((f) => {
        const [w, h] = fixtureSize(f, spec.interior.perCell), turned = Math.abs(Math.round((f.angle ?? 0) / 90)) % 2 === 1;
        return { x: f.x, y: f.y, w: turned ? h : w, h: turned ? w : h };
      });
      (fl2.fixtures ?? []).forEach((f, xi) => {
        const bx = boxes[xi], corners = [[bx.x - bx.w / 2, bx.y - bx.h / 2], [bx.x + bx.w / 2, bx.y - bx.h / 2], [bx.x - bx.w / 2, bx.y + bx.h / 2], [bx.x + bx.w / 2, bx.y + bx.h / 2]];
        if (corners.filter(([x, y]) => !inPolygon(outline2, x, y)).length > 1) add("warning", `${fa}.fixtures[${xi}]`, `${f.kind} stands outside the building`);
        for (let yi = 0; yi < xi; yi++) {
          const o = boxes[yi];
          if (f.kind === "rug" || fl2.fixtures[yi].kind === "rug") continue;
          const ox = Math.min(bx.x + bx.w / 2, o.x + o.w / 2) - Math.max(bx.x - bx.w / 2, o.x - o.w / 2), oy = Math.min(bx.y + bx.h / 2, o.y + o.h / 2) - Math.max(bx.y - bx.h / 2, o.y - o.h / 2);
          if (ox > 0.15 && oy > 0.15) add("warning", `${fa}.fixtures[${xi}]`, `${f.kind} sits on ${fl2.fixtures[yi].kind} (fixtures[${yi}])`);
        }
        const up = f.kind === "stairs-up" || f.kind === "ladder" || f.kind === "spiral-stairs", down = f.kind === "stairs-down" || f.kind === "trapdoor";
        for (const [want, dir] of [[up, 1], [down, -1]]) {
          if (!want) continue;
          const next = levels.get(fl2.level + dir);
          if (!next) {
            if (f.kind !== "ladder" && f.kind !== "spiral-stairs") add("warning", `${fa}.fixtures[${xi}]`, `${f.kind} on ${fl2.level} leads to level ${fl2.level + dir}, which ${b.id} does not have`);
            continue;
          }
          if (!(next.fixtures ?? []).some((n) => STAIRS.includes(n.kind) && Math.hypot(n.x - f.x, n.y - f.y) < 2.5)) add("warning", `${fa}.fixtures[${xi}]`, `${f.kind} meets no stairs on level ${fl2.level + dir}`);
        }
      });
    });
  });
  l.walls.forEach((w, i) => {
    spec.walls[i].gates?.forEach((gt, j) => {
      const s = snapToLine(w.pts, w.closed, gt.at);
      if (Math.hypot(s.x - gt.at[0], s.y - gt.at[1]) > 3) add("warning", `walls[${i}].gates[${j}]`, `the gate is ${Math.round(Math.hypot(s.x - gt.at[0], s.y - gt.at[1]))} cells from its wall (drawn on the wall)`);
    });
  });
  spec.overlay.labels.forEach((lb, i) => {
    if (off(lb.x, lb.y)) add("warning", `overlay.labels[${i}]`, `"${lb.text}" is off the sheet`);
  });
  spec.overlay.symbols.forEach((s, i) => {
    if (off(s.x, s.y)) add("warning", `overlay.symbols[${i}]`, `${s.kind} is off the sheet`);
  });
  spec.props.forEach((p, i) => {
    if (off(p.x, p.y)) add("warning", `props[${i}]`, `${p.kind} is off the sheet`);
  });
  return out;
}

// ../artgen-core/src/settlement/facts.ts
var r12 = (v) => roundTo(v, 0.1);
var tally = (xs) => xs.reduce((m, k) => (m[k] = (m[k] ?? 0) + 1, m), {});
function settlementFacts(spec, l = layoutSettlement(spec)) {
  const per = spec.scale.perCell, unit = spec.scale.unit, len = (cells) => r12(cells * per), sq = (cells) => Math.round(cells * per * per);
  return {
    version: SETTLEMENT_FORMAT,
    id: spec.id,
    kind: spec.kind,
    size: { cols: spec.cols, rows: spec.rows, scale: `1 cell = ${per} ${unit}` },
    counts: {
      buildings: tally(spec.buildings.map((b) => b.kind)),
      roads: tally(spec.roads.map((r) => r.kind)),
      walls: tally(spec.walls.map((w) => w.kind)),
      water: tally(spec.water.map((w) => w.kind)),
      areas: tally(spec.areas.map((a) => a.kind)),
      trees: spec.trees.length + l.areaTrees.length,
      props: tally(spec.props.map((p) => p.kind))
    },
    buildings: l.buildings.map((g) => {
      const b = g.building;
      return {
        id: b.id,
        ...g.number !== void 0 && { number: g.number },
        kind: b.kind,
        ...b.label && { label: b.label },
        box: { x: r12(b.x), y: r12(b.y), w: r12(b.w), h: r12(b.h), angle: r12(b.angle ?? 0) },
        size: `${len(b.w)} \xD7 ${len(b.h)} ${unit}`,
        stories: b.stories ?? Math.max(1, (b.floors ?? []).filter((f) => f.level >= 0).length),
        floors: [...b.floors ?? []].sort((p, q) => p.level - q.level).map((f) => ({ level: f.level, name: floorName(f), rooms: f.rooms.length, doors: (f.doors?.length ?? 0) + (f.connections?.filter((c) => c.kind !== "open").length ?? 0), windows: f.windows?.length ?? 0, fixtures: tally((f.fixtures ?? []).map((x) => x.kind)) }))
      };
    }),
    walls: l.walls.map((w) => ({ index: w.index, kind: w.kind, length: len(lineLength2(w.closed ? [...w.pts, w.pts[0], w.pts[1]] : w.pts)), closed: w.closed, towers: w.towers.length, gates: w.gates.map((g) => ({ kind: g.kind, at: [r12(g.x), r12(g.y)] })) })),
    roads: l.roads.map((r) => ({ index: r.index, kind: r.kind, length: len(lineLength2(r.pts)), ...spec.roads[r.index].label && { label: spec.roads[r.index].label } })),
    water: l.water.map((w) => w.area ? { index: w.index, kind: w.kind, area: sq(polygonArea(w.pts)) } : { index: w.index, kind: w.kind, length: len(lineLength2(w.pts)) }),
    areas: spec.areas.map((a, index) => ({ index, kind: a.kind, area: sq(polygonArea(a.points)), ...a.label && { label: a.label } })),
    bridges: l.bridges.length
  };
}

// ../artgen-core/src/settlement/edit.ts
var SETTLEMENT_OPS = [
  "building.add",
  "building.set",
  "building.move",
  "building.rm",
  "interior",
  "interior.clear",
  "floor.add",
  "floor.rm",
  "room.add",
  "room.set",
  "room.rm",
  "connect",
  "disconnect",
  "door",
  "window",
  "fixture.add",
  "fixture.rm",
  "road.add",
  "road.rm",
  "water.add",
  "water.rm",
  "wall.add",
  "wall.gate",
  "wall.rm",
  "area.add",
  "area.rm",
  "tree.add",
  "tree.scatter",
  "tree.rm",
  "prop.add",
  "prop.rm",
  "label",
  "symbol",
  "label.rm",
  "symbol.rm"
];
var str = (o, k) => {
  const v = o[k];
  if (typeof v !== "string" || !v) throw new Error(`${o.op}: ${k} (text) is required`);
  return v;
};
var num = (o, k) => {
  const v = o[k];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${o.op}: ${k} (a number) is required`);
  return v;
};
var opt = (o, k) => o[k];
var pt = (o, k) => {
  const v = o[k];
  if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === "number")) throw new Error(`${o.op}: ${k} ([x, y]) is required`);
  return v;
};
var pts = (o, k, min) => {
  const v = o[k];
  if (!Array.isArray(v) || v.length < min * 2 || v.length % 2 || !v.every((n) => typeof n === "number")) throw new Error(`${o.op}: ${k} (at least ${min} x,y pairs) is required`);
  return v;
};
function oneOf(o, k, list3, fallback) {
  const v = o[k] ?? fallback;
  if (!list3.includes(v)) throw new Error(`${o.op}: ${k}: one of ${list3.join(", ")}`);
  return v;
}
function fields(t, o, keys) {
  const done = [];
  for (const k of keys) if (k in o) {
    const v = o[k];
    if (v === null || v === "none") delete t[k];
    else t[k] = v;
    done.push(k);
  }
  return done;
}
var at = (xs, i, what) => {
  if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= xs.length) throw new Error(`no ${what} ${String(i)} (there are ${xs.length})`);
  return i;
};
function building(m, id) {
  const b = m.buildings.find((x) => x.id === id);
  if (!b) throw new Error(`no building ${String(id)}${m.buildings.length ? ` (there are ${m.buildings.slice(0, 8).map((x) => x.id).join(", ")}${m.buildings.length > 8 ? ", \u2026" : ""})` : ""}`);
  return b;
}
function floor(m, o, make = false) {
  const b = building(m, o.building), level = typeof o.level === "number" ? o.level : 0;
  let f = b.floors?.find((x) => x.level === level);
  if (!f) {
    if (!make) throw new Error(`building ${b.id} has no floor at level ${level} (floor.add, or interior to lay them all out)`);
    f = { level, rooms: [] };
    b.floors = [...b.floors ?? [], f].sort((p, q) => p.level - q.level);
  }
  return { b, f };
}
var BUILDING_FIELDS = ["shape", "angle", "roof", "stories", "label", "number", "href", "wing", "points", "kind", "origin"];
function editSettlement(m, o) {
  switch (o.op) {
    case "building.add": {
      const kind = oneOf(o, "kind", BUILDING_KINDS), shape = oneOf(o, "shape", BUILDING_SHAPES, "rect");
      const id = opt(o, "id") ?? nextId(m.buildings, "b");
      if (m.buildings.some((b2) => b2.id === id)) throw new Error(`building ${id} already exists`);
      const box2 = shape === "poly" ? polyBox(pts(o, "points", 3)) : { x: num(o, "x"), y: num(o, "y"), w: num(o, "w"), h: num(o, "h") };
      const b = { id, kind, shape, ...box2 };
      fields(b, o, BUILDING_FIELDS.filter((k) => k !== "kind" && k !== "shape"));
      m.buildings.push(b);
      return `added ${kind} ${id} at ${box2.x},${box2.y} (${box2.w}\xD7${box2.h})`;
    }
    case "building.set": {
      const b = building(m, o.id), done = fields(b, o, [...BUILDING_FIELDS, "x", "y", "w", "h"]);
      if ("kind" in o) oneOf(o, "kind", BUILDING_KINDS);
      if ("shape" in o) oneOf(o, "shape", BUILDING_SHAPES);
      if ("roof" in o && o.roof !== null && o.roof !== "none") oneOf(o, "roof", ROOFS);
      if (b.shape === "poly" && b.points) Object.assign(b, polyBox(b.points));
      return `set ${done.join(", ") || "nothing"} of ${b.id}`;
    }
    case "building.move": {
      const b = building(m, o.id), x = num(o, "x"), y = num(o, "y");
      if (b.points) b.points = b.points.map((v, i) => v + (i % 2 ? y - b.y : x - b.x));
      b.x = x;
      b.y = y;
      return `moved ${b.id} to ${x},${y}`;
    }
    case "building.rm": {
      const b = building(m, o.id);
      m.buildings = m.buildings.filter((x) => x !== b);
      return `removed ${b.id}`;
    }
    case "interior": {
      const b = building(m, o.id ?? o.building), stories = opt(o, "stories");
      b.floors = generateInterior(m, b, { ...typeof o.seed === "number" && { seed: o.seed }, ...stories !== void 0 && { stories } });
      if (stories !== void 0) b.stories = stories;
      return `laid out ${b.id}: ${b.floors.map((f) => `level ${f.level} ${f.rooms.length} rooms, ${f.fixtures?.length ?? 0} fixtures`).join("; ")}`;
    }
    case "interior.clear": {
      const b = building(m, o.id ?? o.building);
      delete b.floors;
      return `cleared the floors of ${b.id}`;
    }
    case "floor.add": {
      const { b, f } = floor(m, o, true);
      if (typeof o.name === "string") f.name = o.name;
      return `${b.id} has a floor at level ${f.level}`;
    }
    case "floor.rm": {
      const { b, f } = floor(m, o);
      b.floors = b.floors.filter((x) => x !== f);
      if (!b.floors.length) delete b.floors;
      return `removed level ${f.level} of ${b.id}`;
    }
    case "room.add": {
      const { b, f } = floor(m, o, true), shape = oneOf(o, "shape", ["rect", "circle", "octagon", "cave", "poly"], "rect");
      const id = opt(o, "id") ?? nextId(f.rooms, `${f.level < 0 ? "c" : "f"}${Math.abs(f.level)}r`);
      if (f.rooms.some((r4) => r4.id === id)) throw new Error(`room ${id} already exists on that floor`);
      const box2 = shape === "poly" ? polyBox(pts(o, "points", 3)) : { x: num(o, "x"), y: num(o, "y"), w: num(o, "w"), h: num(o, "h") };
      const r = { id, shape, ...box2, ...shape === "poly" && { points: o.points } };
      fields(r, o, ["label", "number"]);
      f.rooms.push(r);
      return `added room ${id} to ${b.id} level ${f.level}`;
    }
    case "room.set": {
      const { f } = floor(m, o), r = f.rooms.find((x) => x.id === o.id);
      if (!r) throw new Error(`no room ${String(o.id)} on that floor`);
      return `set ${fields(r, o, ["x", "y", "w", "h", "shape", "label", "number", "points"]).join(", ") || "nothing"} of room ${r.id}`;
    }
    case "room.rm": {
      const { f } = floor(m, o), id = str(o, "id");
      if (!f.rooms.some((r) => r.id === id)) throw new Error(`no room ${id} on that floor`);
      f.rooms = f.rooms.filter((r) => r.id !== id);
      if (f.connections) f.connections = f.connections.filter((c) => c.a !== id && c.b !== id);
      return `removed room ${id}`;
    }
    case "connect": {
      const { f } = floor(m, o), c = { a: str(o, "a"), b: str(o, "b") };
      fields(c, o, ["kind", "at", "width"]);
      f.connections = [...f.connections ?? [], c];
      return `connected ${c.a} and ${c.b}${c.kind ? ` (${c.kind})` : ""}`;
    }
    case "disconnect": {
      const { f } = floor(m, o), i = at(f.connections ?? [], o.index, "connection");
      f.connections.splice(i, 1);
      return `removed connection ${i}`;
    }
    case "door": {
      const { b, f } = floor(m, o, true), d = { at: pt(o, "at"), ...o.kind !== void 0 && { kind: o.kind }, ...typeof o.width === "number" && { width: o.width } };
      f.doors = [...f.doors ?? [], d];
      return `door at ${d.at.join(",")} of ${b.id}`;
    }
    case "window": {
      const { b, f } = floor(m, o, true), w = { at: pt(o, "at"), ...typeof o.width === "number" && { width: o.width } };
      f.windows = [...f.windows ?? [], w];
      return `window at ${w.at.join(",")} of ${b.id}`;
    }
    case "fixture.add":
    case "prop.add": {
      const x = { kind: str(o, "kind"), x: num(o, "x"), y: num(o, "y") };
      fields(x, o, ["w", "h", "angle", "label", "origin"]);
      if (o.op === "prop.add" || o.building === void 0) {
        m.props.push(x);
        return `added ${x.kind} on the site at ${x.x},${x.y}`;
      }
      const { b, f } = floor(m, o, true);
      f.fixtures = [...f.fixtures ?? [], x];
      return `added ${x.kind} to ${b.id} level ${f.level} at ${x.x},${x.y}`;
    }
    case "fixture.rm": {
      const { f } = floor(m, o), i = at(f.fixtures ?? [], o.index, "fixture");
      const [x] = f.fixtures.splice(i, 1);
      return `removed ${x.kind}`;
    }
    case "prop.rm": {
      const i = at(m.props, o.index, "prop");
      const [x] = m.props.splice(i, 1);
      return `removed ${x.kind}`;
    }
    case "road.add": {
      const r = { kind: oneOf(o, "kind", ROAD_KINDS), points: pts(o, "points", 2) };
      fields(r, o, ["id", "width", "curve", "label", "origin"]);
      m.roads.push(r);
      return `added a ${r.kind} (road ${m.roads.length - 1})`;
    }
    case "water.add": {
      const w = { kind: oneOf(o, "kind", WATER_KINDS), points: pts(o, "points", 2) };
      fields(w, o, ["id", "width", "origin"]);
      m.water.push(w);
      return `added a ${w.kind} (water ${m.water.length - 1})`;
    }
    case "wall.add": {
      const w = { kind: oneOf(o, "kind", WALL_KINDS), points: pts(o, "points", 2) };
      fields(w, o, ["id", "closed", "thickness", "towers", "gates", "origin"]);
      m.walls.push(w);
      return `added a ${w.kind} wall (wall ${m.walls.length - 1})`;
    }
    case "wall.gate": {
      const w = m.walls[at(m.walls, o.index, "wall")], g = { at: pt(o, "at"), kind: oneOf(o, "kind", GATE_KINDS2, "gate") };
      fields(g, o, ["width", "drawbridge", "label"]);
      w.gates = [...w.gates ?? [], g];
      return `added a ${g.kind} to wall ${o.index}`;
    }
    case "area.add": {
      const a = { kind: oneOf(o, "kind", AREA_KINDS), points: pts(o, "points", 3) };
      fields(a, o, ["id", "label", "origin"]);
      m.areas.push(a);
      return `added a ${a.kind} (area ${m.areas.length - 1})`;
    }
    case "tree.add": {
      const t = { kind: oneOf(o, "kind", TREE_KINDS, "tree"), x: num(o, "x"), y: num(o, "y") };
      fields(t, o, ["size", "origin"]);
      m.trees.push(t);
      return `added a ${t.kind} at ${t.x},${t.y}`;
    }
    case "tree.scatter": {
      const kind = oneOf(o, "kind", TREE_KINDS, "tree"), area = pts(o, "area", 3), count = num(o, "count"), rand = rng(typeof o.seed === "number" ? o.seed : m.trees.length + 1);
      const box2 = polyBox(area);
      let added = 0;
      for (let i = 0; i < count * 20 && added < count; i++) {
        const x = box2.x + rand() * box2.w, y = box2.y + rand() * box2.h;
        if (!inPolygon(area, x, y)) continue;
        m.trees.push({ kind, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
        added++;
      }
      return `scattered ${added} ${kind}${added === 1 ? "" : "s"}`;
    }
    case "label": {
      const l = { text: str(o, "text"), x: num(o, "x"), y: num(o, "y"), kind: o.kind ?? "name" };
      fields(l, o, ["size", "angle", "href", "origin"]);
      m.overlay.labels.push(l);
      return `label "${l.text}" at ${l.x},${l.y}`;
    }
    case "symbol": {
      const s = { kind: str(o, "kind"), x: num(o, "x"), y: num(o, "y") };
      fields(s, o, ["scale", "angle", "origin"]);
      m.overlay.symbols.push(s);
      return `symbol ${s.kind} at ${s.x},${s.y}`;
    }
    case "road.rm":
    case "water.rm":
    case "wall.rm":
    case "area.rm":
    case "tree.rm":
    case "label.rm":
    case "symbol.rm": {
      const key = o.op.split(".")[0], list3 = key === "label" ? m.overlay.labels : key === "symbol" ? m.overlay.symbols : key === "road" ? m.roads : key === "water" ? m.water : key === "wall" ? m.walls : key === "area" ? m.areas : m.trees;
      list3.splice(at(list3, o.index, key), 1);
      return `removed ${key} ${o.index}`;
    }
  }
  throw new Error(`no edit ${JSON.stringify(o.op)}: ${SETTLEMENT_OPS.join(", ")}`);
}

// ../../node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
var require2 = createRequire("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j = b[i]; j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v = le[cd[i] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i = 0; i < d.length; ++i) {
    if (d[i])
      t.push({ s: i, f: d[i] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i2].f ? i0++ : i2++];
    r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i = 1; i < s; ++i) {
    if (t2[i].s > maxSym)
      maxSym = t2[i].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i < s; ++i) {
      var i2_1 = t2[i].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i;
    }
    for (; i >= 0 && dt; --i) {
      var i2_3 = t2[i].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i = 1; i <= s; ++i) {
    if (c[i] == cln && i != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i = 0; i < cl.length; ++i)
    l += cf[i] * cl[i];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i = 0; i < s; ++i)
    out[o + i + 4] = dat[i];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d2 = lc(ddt), lcdt = _d2.c, ndc = _d2.n;
  var lcfreq = new u16(19);
  for (var i = 0; i < lclt.length; ++i)
    ++lcfreq[lclt[i] & 31];
  for (var i = 0; i < lcdt.length; ++i)
    ++lcfreq[lcdt[i] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i = 0; i < nlcc; ++i)
      wbits(out, p + 3 * i, lct[clim[i]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i = 0; i < clct.length; ++i) {
        var len = clct[i] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i = 0; i < li; ++i) {
    var sym = syms[i];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt2 = deo[lvl - 1];
    var n = opt2 >> 13, c = opt2 & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i2) {
      return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i + 2 < s; ++i) {
      var hv = hsh(i);
      var imod = i & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i) {
        var rem = s - i;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
          li = lc_1 = eb = 0, bs = i;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i + l] == dat[i + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i];
          ++lf[dat[i]];
        }
      }
    }
    for (i = Math.max(i, wi); i < s; ++i) {
      syms[li++] = dat[i];
      ++lf[dat[i]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i, st.w = wi;
    }
  } else {
    for (var i = st.w || 0; i < s + lst; i += 65535) {
      var e = i + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var adler = function() {
  var a = 1, b = 0;
  return {
    p: function(d) {
      var n = a, m = b;
      var l = d.length | 0;
      for (var i = 0; i != l; ) {
        var e = Math.min(i + 2655, l);
        for (; i < e; ++i)
          m += n += d[i];
        n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
      }
      a = n, b = m;
    },
    d: function() {
      a %= 65521, b %= 65521;
      return (a & 255) << 24 | (a & 65280) << 8 | (b & 255) << 8 | b >> 8;
    }
  };
};
var dopt = function(dat, opt2, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt2.dictionary) {
      var dict = opt2.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt2.level == null ? 6 : opt2.level, opt2.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt2.mem, pre, post, st);
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
var zlh = function(c, o) {
  var lv = o.level, fl2 = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
  c[0] = 120, c[1] = fl2 << 6 | (o.dictionary && 32);
  c[1] |= 31 - (c[0] << 8 | c[1]) % 31;
  if (o.dictionary) {
    var h = adler();
    h.p(o.dictionary);
    wbytes(c, 2, h.d());
  }
};
function zlibSync(data, opts) {
  if (!opts)
    opts = {};
  var a = adler();
  a.p(data);
  var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
  return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// ../artgen-core/src/lib/color.ts
var cache = /* @__PURE__ */ new Map();
function parseColor(c) {
  const hit = cache.get(c);
  if (hit) return hit;
  let r;
  if (c.startsWith("rgb")) {
    const m = (c.match(/[\d.]+/g) ?? []).map(Number);
    if (m.length < 3) throw new Error(`bad colour: ${c}`);
    r = [m[0], m[1], m[2], m.length > 3 ? Math.round(m[3] * 255) : 255];
  } else if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(c)) {
    const n = (i) => parseInt(c.slice(i, i + 2), 16);
    r = [n(1), n(3), n(5), c.length === 9 ? n(7) : 255];
  } else if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    const n = (i) => parseInt(c[i] + c[i], 16);
    r = [n(1), n(2), n(3), 255];
  } else throw new Error(`bad colour: ${c}`);
  cache.set(c, r);
  return r;
}
var h2 = (v) => v.toString(16).padStart(2, "0");
var toHex = (r, g, b) => "#" + h2(r) + h2(g) + h2(b);

// ../artgen-core/src/lib/grid.ts
var Grid2 = class _Grid {
  w;
  h;
  d;
  /** Normal map of this image (same size; RGB = normal, OpenGL convention), when the renderer produced one. */
  normal;
  constructor(w, h, data) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
    if (data) this.d.set(data);
  }
  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  /** Write a colour. Partial alpha blends over an opaque pixel and keeps its alpha (artlab: used for shadows). */
  set(x, y, c) {
    x |= 0;
    y |= 0;
    if (!this.inb(x, y) || c == null) return;
    const [r, g, b, a] = parseColor(c), i = (y * this.w + x) * 4, d = this.d;
    if (a === 255 || d[i + 3] === 0) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a;
      return;
    }
    const t = a / 255;
    d[i] = d[i] * (1 - t) + r * t;
    d[i + 1] = d[i + 1] * (1 - t) + g * t;
    d[i + 2] = d[i + 2] * (1 - t) + b * t;
  }
  /** Clear a pixel to transparent. */
  clear(x, y) {
    if (this.inb(x, y)) this.d.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4);
  }
  alpha(x, y) {
    return this.inb(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0;
  }
  /** `#rrggbb` of a non-transparent pixel, else null. */
  get(x, y) {
    if (!this.inb(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (!this.d[i + 3]) return null;
    return toHex(this.d[i], this.d[i + 1], this.d[i + 2]);
  }
  clone() {
    return new _Grid(this.w, this.h, this.d);
  }
  /** Draw another grid's non-transparent pixels on top. */
  stamp(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c) this.set(x + ox, y + oy, c);
    }
    return this;
  }
  /** Source-over composite of `src` (straight alpha), so partial-alpha shadows blend as in a game. */
  over(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4, sa = src.d[i + 3] / 255;
      if (!sa || !this.inb(x + ox, y + oy)) continue;
      const j = ((y + oy) * this.w + x + ox) * 4, da = this.d[j + 3] / 255, oa = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) this.d[j + c] = (src.d[i + c] * sa + this.d[j + c] * da * (1 - sa)) / oa;
      this.d[j + 3] = oa * 255;
    }
    return this;
  }
  /** Copy raw RGBA (including partial alpha) from src, replacing pixels where src is non-transparent. */
  blit(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (!src.d[i + 3] || !this.inb(x + ox, y + oy)) continue;
      this.d.set(src.d.subarray(i, i + 4), ((y + oy) * this.w + x + ox) * 4);
    }
    return this;
  }
  crop(x, y, w, h) {
    const g = new _Grid(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!this.inb(x + i, y + j)) continue;
      const s = ((y + j) * this.w + x + i) * 4;
      g.d.set(this.d.subarray(s, s + 4), (j * w + i) * 4);
    }
    return g;
  }
  pad(top, right = top, bottom = top, left = right) {
    return this.crop(-left, -top, this.w + left + right, this.h + top + bottom);
  }
  /** Bounding box of non-transparent pixels, or null when empty. */
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[(y * this.w + x) * 4 + 3]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  trim() {
    const b = this.bounds();
    return b ? this.crop(b.x, b.y, b.w, b.h) : new _Grid(0, 0);
  }
  flip(axis = "x") {
    const g = new _Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const sx = axis === "x" ? this.w - 1 - x : x, sy = axis === "y" ? this.h - 1 - y : y, s = (sy * this.w + sx) * 4;
      g.d.set(this.d.subarray(s, s + 4), (y * this.w + x) * 4);
    }
    return g;
  }
  /** Nearest-neighbour integer upscale. */
  scale(n) {
    if (n === 1) return this.clone();
    const g = new _Grid(this.w * n, this.h * n);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const s = ((y / n | 0) * this.w + (x / n | 0)) * 4;
      g.d.set(this.d.subarray(s, s + 4), (y * g.w + x) * 4);
    }
    return g;
  }
  /** Fill a rectangle with a colour (blending like `set`). */
  fill(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  /** Stable content hash (cyrb53 over size + RGBA bytes), 14 hex chars. */
  hash() {
    let h1 = 3735928559 ^ this.w, h22 = 1103547991 ^ this.h;
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      h1 = Math.imul(h1 ^ c, 2654435761);
      h22 = Math.imul(h22 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h22 ^ h22 >>> 13, 3266489909);
    h22 = Math.imul(h22 ^ h22 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
    return (4294967296 * (2097151 & h22) + (h1 >>> 0)).toString(16).padStart(14, "0");
  }
  /**
   * Indexed form: `palette` lists distinct RGBA colours in first-seen order, `index` holds palette
   * position + 1 per pixel (0 = transparent).
   */
  toIndexed() {
    const key = /* @__PURE__ */ new Map(), palette = [], alphas = [], index = new Uint16Array(this.w * this.h);
    for (let p = 0; p < index.length; p++) {
      const i = p * 4, a = this.d[i + 3];
      if (!a) continue;
      const k = (this.d[i] << 24 | this.d[i + 1] << 16 | this.d[i + 2] << 8 | a) >>> 0;
      let n = key.get(k);
      if (n === void 0) {
        n = palette.length;
        key.set(k, n);
        palette.push(toHex(this.d[i], this.d[i + 1], this.d[i + 2]));
        alphas.push(a);
      }
      index[p] = n + 1;
    }
    return { palette, alphas, index };
  }
  /** Number of pixels that differ (any channel) from another grid of the same size. */
  diffCount(o) {
    if (o.w !== this.w || o.h !== this.h) return Math.max(this.w * this.h, o.w * o.h);
    let n = 0;
    for (let p = 0; p < this.w * this.h; p++) {
      const i = p * 4;
      if (this.d[i] !== o.d[i] || this.d[i + 1] !== o.d[i + 1] || this.d[i + 2] !== o.d[i + 2] || this.d[i + 3] !== o.d[i + 3]) n++;
    }
    return n;
  }
};

// ../artgen-core/src/lib/png.ts
var SIG = [137, 80, 78, 71, 13, 10, 26, 10];
var CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  return c >>> 0;
});
function crc32(b) {
  let c = 4294967295;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(g) {
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, g.w);
  dv.setUint32(4, g.h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = new Uint8Array(g.h * (g.w * 4 + 1));
  for (let y = 0; y < g.h; y++) raw.set(g.d.subarray(y * g.w * 4, (y + 1) * g.w * 4), y * (g.w * 4 + 1) + 1);
  const parts = [new Uint8Array(SIG), chunk("IHDR", ihdr), chunk("IDAT", zlibSync(raw, { level: 9 })), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ../../node_modules/@resvg/resvg-wasm/index.mjs
var wasm;
var heap = new Array(128).fill(void 0);
heap.push(void 0, null, true, false);
var heap_next = heap.length;
function addHeapObject(obj) {
  if (heap_next === heap.length)
    heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
function getObject(idx) {
  return heap[idx];
}
function dropObject(idx) {
  if (idx < 132)
    return;
  heap[idx] = heap_next;
  heap_next = idx;
}
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
var WASM_VECTOR_LEN = 0;
var cachedUint8Memory0 = null;
function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}
var cachedTextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder("utf-8") : { encode: () => {
  throw Error("TextEncoder not available");
} };
var encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
  return cachedTextEncoder.encodeInto(arg, view);
} : function(arg, view) {
  const buf = cachedTextEncoder.encode(arg);
  view.set(buf);
  return {
    read: arg.length,
    written: buf.length
  };
};
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8Memory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8Memory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
var cachedInt32Memory0 = null;
function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}
var cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }) : { decode: () => {
  throw Error("TextDecoder not available");
} };
if (typeof TextDecoder !== "undefined") {
  cachedTextDecoder.decode();
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
  return instance.ptr;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
var BBoxFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_bbox_free(ptr >>> 0));
var BBox = class _BBox {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_BBox.prototype);
    obj.__wbg_ptr = ptr;
    BBoxFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    BBoxFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_bbox_free(ptr);
  }
  /**
  * @returns {number}
  */
  get x() {
    const ret = wasm.__wbg_get_bbox_x(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set x(arg0) {
    wasm.__wbg_set_bbox_x(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get y() {
    const ret = wasm.__wbg_get_bbox_y(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set y(arg0) {
    wasm.__wbg_set_bbox_y(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get width() {
    const ret = wasm.__wbg_get_bbox_width(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set width(arg0) {
    wasm.__wbg_set_bbox_width(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get height() {
    const ret = wasm.__wbg_get_bbox_height(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set height(arg0) {
    wasm.__wbg_set_bbox_height(this.__wbg_ptr, arg0);
  }
};
var RenderedImageFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_renderedimage_free(ptr >>> 0));
var RenderedImage = class _RenderedImage {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_RenderedImage.prototype);
    obj.__wbg_ptr = ptr;
    RenderedImageFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RenderedImageFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_renderedimage_free(ptr);
  }
  /**
  * Get the PNG width
  * @returns {number}
  */
  get width() {
    const ret = wasm.renderedimage_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
  * Get the PNG height
  * @returns {number}
  */
  get height() {
    const ret = wasm.renderedimage_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
  * Write the image data to Uint8Array
  * @returns {Uint8Array}
  */
  asPng() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.renderedimage_asPng(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r13 = getInt32Memory0()[retptr / 4 + 1];
      var r23 = getInt32Memory0()[retptr / 4 + 2];
      if (r23) {
        throw takeObject(r13);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Get the RGBA pixels of the image
  * @returns {Uint8Array}
  */
  get pixels() {
    const ret = wasm.renderedimage_pixels(this.__wbg_ptr);
    return takeObject(ret);
  }
};
var ResvgFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_resvg_free(ptr >>> 0));
var Resvg = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ResvgFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_resvg_free(ptr);
  }
  /**
  * @param {Uint8Array | string} svg
  * @param {string | undefined} [options]
  * @param {Array<any> | undefined} [custom_font_buffers]
  */
  constructor(svg, options, custom_font_buffers) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      var ptr0 = isLikeNone(options) ? 0 : passStringToWasm0(options, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len0 = WASM_VECTOR_LEN;
      wasm.resvg_new(retptr, addHeapObject(svg), ptr0, len0, isLikeNone(custom_font_buffers) ? 0 : addHeapObject(custom_font_buffers));
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r13 = getInt32Memory0()[retptr / 4 + 1];
      var r23 = getInt32Memory0()[retptr / 4 + 2];
      if (r23) {
        throw takeObject(r13);
      }
      this.__wbg_ptr = r0 >>> 0;
      return this;
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Get the SVG width
  * @returns {number}
  */
  get width() {
    const ret = wasm.resvg_width(this.__wbg_ptr);
    return ret;
  }
  /**
  * Get the SVG height
  * @returns {number}
  */
  get height() {
    const ret = wasm.resvg_height(this.__wbg_ptr);
    return ret;
  }
  /**
  * Renders an SVG in Wasm
  * @returns {RenderedImage}
  */
  render() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_render(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r13 = getInt32Memory0()[retptr / 4 + 1];
      var r23 = getInt32Memory0()[retptr / 4 + 2];
      if (r23) {
        throw takeObject(r13);
      }
      return RenderedImage.__wrap(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Output usvg-simplified SVG string
  * @returns {string}
  */
  toString() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_toString(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r13 = getInt32Memory0()[retptr / 4 + 1];
      deferred1_0 = r0;
      deferred1_1 = r13;
      return getStringFromWasm0(r0, r13);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
  * Calculate a maximum bounding box of all visible elements in this SVG.
  *
  * Note: path bounding box are approx values.
  * @returns {BBox | undefined}
  */
  innerBBox() {
    const ret = wasm.resvg_innerBBox(this.__wbg_ptr);
    return ret === 0 ? void 0 : BBox.__wrap(ret);
  }
  /**
  * Calculate a maximum bounding box of all visible elements in this SVG.
  * This will first apply transform.
  * Similar to `SVGGraphicsElement.getBBox()` DOM API.
  * @returns {BBox | undefined}
  */
  getBBox() {
    const ret = wasm.resvg_getBBox(this.__wbg_ptr);
    return ret === 0 ? void 0 : BBox.__wrap(ret);
  }
  /**
  * Use a given `BBox` to crop the svg. Currently this method simply changes
  * the viewbox/size of the svg and do not move the elements for simplicity
  * @param {BBox} bbox
  */
  cropByBBox(bbox2) {
    _assertClass(bbox2, BBox);
    wasm.resvg_cropByBBox(this.__wbg_ptr, bbox2.__wbg_ptr);
  }
  /**
  * @returns {Array<any>}
  */
  imagesToResolve() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_imagesToResolve(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r13 = getInt32Memory0()[retptr / 4 + 1];
      var r23 = getInt32Memory0()[retptr / 4 + 2];
      if (r23) {
        throw takeObject(r13);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * @param {string} href
  * @param {Uint8Array} buffer
  */
  resolveImage(href, buffer) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(href, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.resvg_resolveImage(retptr, this.__wbg_ptr, ptr0, len0, addHeapObject(buffer));
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r13 = getInt32Memory0()[retptr / 4 + 1];
      if (r13) {
        throw takeObject(r0);
      }
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
};
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get("Content-Type") != "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}
function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_new_28c511d9baebfa89 = function(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_buffer_12d079cc21e14bdb = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb = function(arg0, arg1, arg2) {
    const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbg_new_63b92bc8671ed464 = function(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_values_839f3396d5aac002 = function(arg0) {
    const ret = getObject(arg0).values();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_next_196c84450b364254 = function() {
    return handleError(function(arg0) {
      const ret = getObject(arg0).next();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_done_298b57d23c0fc80c = function(arg0) {
    const ret = getObject(arg0).done;
    return ret;
  };
  imports.wbg.__wbg_value_d93c65011f51a456 = function(arg0) {
    const ret = getObject(arg0).value;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_instanceof_Uint8Array_2b3bbecd033d19f6 = function(arg0) {
    let result;
    try {
      result = getObject(arg0) instanceof Uint8Array;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof obj === "string" ? obj : void 0;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
  };
  imports.wbg.__wbg_new_16b304a2cfa7ff4a = function() {
    const ret = new Array();
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_push_a5b05aedc7234f9f = function(arg0, arg1) {
    const ret = getObject(arg0).push(getObject(arg1));
    return ret;
  };
  imports.wbg.__wbg_length_c20a40f15020d68a = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbg_set_a47bac70306a19a7 = function(arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
  };
  imports.wbg.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  return imports;
}
function __wbg_init_memory(imports, maybe_memory) {
}
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedInt32Memory0 = null;
  cachedUint8Memory0 = null;
  return wasm;
}
async function __wbg_init(input) {
  if (wasm !== void 0)
    return wasm;
  if (typeof input === "undefined") {
    input = new URL("index_bg.wasm", void 0);
  }
  const imports = __wbg_get_imports();
  if (typeof input === "string" || typeof Request === "function" && input instanceof Request || typeof URL === "function" && input instanceof URL) {
    input = fetch(input);
  }
  __wbg_init_memory(imports);
  const { instance, module } = await __wbg_load(await input, imports);
  return __wbg_finalize_init(instance, module);
}
var dist_default = __wbg_init;
var initialized = false;
var initWasm = async (module_or_path) => {
  if (initialized) {
    throw new Error("Already initialized. The `initWasm()` function can be used only once.");
  }
  await dist_default(await module_or_path);
  initialized = true;
};
var Resvg2 = class extends Resvg {
  /**
   * @param {Uint8Array | string} svg
   * @param {ResvgRenderOptions | undefined} options
   */
  constructor(svg, options) {
    if (!initialized)
      throw new Error("Wasm has not been initialized. Call `initWasm()` function.");
    const font = options?.font;
    if (!!font && isCustomFontsOptions(font)) {
      const serializableOptions = {
        ...options,
        font: {
          ...font,
          fontBuffers: void 0
        }
      };
      super(svg, JSON.stringify(serializableOptions), font.fontBuffers);
    } else {
      super(svg, JSON.stringify(options));
    }
  }
};
function isCustomFontsOptions(value) {
  return Object.prototype.hasOwnProperty.call(value, "fontBuffers");
}

// ../artgen-core/src/lib/post.ts
var N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
var N8 = [...N4, [1, 1], [-1, -1], [1, -1], [-1, 1]];
var BAYER = {
  bayer2: [[0, 2], [3, 1]].map((r) => r.map((v) => (v + 0.5) / 4)),
  bayer4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16))
};

// ../artgen-core/src/lib/svg.ts
var ready = null;
var initialised = false;
function initSvg(wasm2) {
  ready ??= initWasm(wasm2).then(() => {
    initialised = true;
  });
  return ready;
}
var fonts = [];
var defaultFont = "";
function setSvgFonts(buffers, family = "") {
  fonts = buffers;
  defaultFont = family;
}
function rasterizeSvg(svg, w, h) {
  if (!initialised) throw new Error("SVG rasteriser not initialised: call initSvg(wasm) first");
  const r = new Resvg2(svg, { fitTo: { mode: "width", value: w }, font: { loadSystemFonts: false, ...fonts.length && { fontBuffers: fonts, ...defaultFont && { defaultFontFamily: defaultFont, sansSerifFamily: defaultFont } } } });
  const img = r.render(), px = img.pixels, iw = img.width, ih = img.height, g = new Grid2(w, h);
  for (let y = 0; y < Math.min(h, ih); y++) for (let x = 0; x < Math.min(w, iw); x++) {
    const s = (y * iw + x) * 4, a = px[s + 3];
    if (!a) continue;
    const i = (y * w + x) * 4;
    g.d[i] = px[s] * 255 / a;
    g.d[i + 1] = px[s + 1] * 255 / a;
    g.d[i + 2] = px[s + 2] * 255 / a;
    g.d[i + 3] = a;
  }
  img.free();
  r.free();
  return g;
}

// ../artgen-cli/src/dungeon.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync3, readdirSync as readdirSync2, readFileSync as readFileSync4, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname as dirname3, join as join4, relative as relative2, resolve as resolve3 } from "node:path";

// ../artgen-cli/src/map.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readdirSync, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, join as join3, relative, resolve as resolve2 } from "node:path";

// ../artgen-cli/src/node-svg.ts
import { existsSync, readFileSync } from "node:fs";
import { createRequire as createRequire2 } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
var require3 = createRequire2(import.meta.url);
function initNodeSvg() {
  const local = fileURLToPath(new URL("./resvg.wasm", import.meta.url));
  let file = local;
  if (!existsSync(local)) {
    try {
      file = require3.resolve("@resvg/resvg-wasm/index_bg.wasm");
    } catch {
      throw new Error(`PNG output needs resvg.wasm next to this script (${local}) \u2014 copy it from artgen-dist maps/, or render --format svg`);
    }
  }
  return initSvg(readFileSync(file));
}
var MAP_FONTS = ["AlegreyaSans-Regular.ttf", "AlegreyaSans-Bold.ttf", "AlegreyaSans-Italic.ttf"];
async function initNodeMapSvg() {
  await initNodeSvg();
  const local = fileURLToPath(new URL("./fonts/", import.meta.url)), dir = existsSync(join(local, MAP_FONTS[0])) ? local : fileURLToPath(new URL("../../artgen-core/assets/fonts/", import.meta.url));
  if (!MAP_FONTS.every((f) => existsSync(join(dir, f)))) {
    console.error(`note: no fonts/ next to this script (${local}); labels are left out of the PNG`);
    return;
  }
  setSvgFonts(MAP_FONTS.map((f) => new Uint8Array(readFileSync(join(dir, f)))), map_exports.FONT_FAMILY);
}

// ../artgen-cli/src/projectfs.ts
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, writeFileSync } from "node:fs";
import { basename, dirname, extname, join as join2, resolve } from "node:path";
var CONFIG_FILE = "artgen.config.json";
var fileStem = (file) => basename(file, extname(file));
var fileId = (file) => fileStem(file).replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "map";
function findProject(start = process.cwd()) {
  for (let d = resolve(start); ; d = dirname(d)) {
    if (existsSync2(join2(d, "art", CONFIG_FILE))) return { root: d, art: join2(d, "art") };
    if (dirname(d) === d) return null;
  }
}
function requireProject(start) {
  const p = findProject(start);
  if (!p) throw new Error("no artgen project here (art/artgen.config.json not found up the tree) \u2014 run `artgen init` in the game repo root");
  return p;
}
var readJson = (p) => JSON.parse(readFileSync2(p, "utf8"));
var writeJson = (p, v) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};

// ../artgen-cli/src/map.ts
var mapsDir = (p) => join3(p.art, "maps");
function mapFile(p, ref) {
  if (typeof ref !== "string") return resolve2(ref.file);
  if (!/^[\w-]+$/.test(ref ?? "")) throw new Error(`map id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p) throw new Error("no artgen project here: name the map file with --file <path>");
  return join3(mapsDir(p), ref, "map.json");
}
var shown = (p, f) => relative(p?.root ?? process.cwd(), f);
var mapSummary = (m) => ({ id: m.id, preset: m.preset, size: `${m.cols}x${m.rows}`, ...m.title && { title: m.title }, edits: m.edits.length, labels: m.overlay.labels.length, symbols: m.overlay.symbols.length });
function listMaps(p) {
  if (!existsSync3(mapsDir(p))) return [];
  return readdirSync(mapsDir(p), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync3(join3(mapsDir(p), d.name, "map.json"))).map((d) => mapSummary(readMap(p, d.name)));
}
function readMap(p, ref) {
  const f = mapFile(p, ref);
  if (!existsSync3(f)) throw new Error(typeof ref === "string" ? `no map ${ref} (${shown(p, f)}) \u2014 artgen map new ${ref}` : `no map file ${shown(p, f)} \u2014 artgen map new --file ${ref.file}`);
  return map_exports.parseMap(readJson(f));
}
function writeMap(p, m, ref = m.id) {
  const spec = map_exports.parseMap(m), f = mapFile(p, ref);
  writeJson(f, spec);
  return shown(p, f);
}
function createMap(p, id, preset, over = {}, force = false, at3 = id) {
  if (existsSync3(mapFile(p, at3)) && !force) throw new Error(typeof at3 === "string" ? `map ${id} already exists (edit it, or pick another id)` : `${shown(p, mapFile(p, at3))} already exists (edit it, or --force)`);
  const m = map_exports.newMap(id, preset, over);
  return { file: writeMap(p, m, at3), map: m };
}
function updateMap(p, ref, change) {
  const m = readMap(p, ref);
  change(m);
  writeMap(p, m, ref);
  return m;
}
function checkMapFile(p, ref) {
  const f = mapFile(p, ref);
  let raw;
  try {
    raw = JSON.parse(readFileSync3(f, "utf8"));
  } catch (e) {
    const missing = e.code === "ENOENT";
    return { file: shown(p, f), ok: false, errors: [{ path: "", message: missing ? `no such file: ${shown(p, f)}` : `not JSON: ${e.message}` }], requirements: [], unmet: [] };
  }
  const { errors } = map_exports.checkMap(raw);
  if (errors.length) return { file: shown(p, f), ok: false, errors, requirements: [], unmet: [] };
  const requirements = map_exports.checkRequirements(map_exports.parseMap(raw)), unmet = requirements.filter((r) => !r.met).map((r) => r.id);
  return { file: shown(p, f), ok: !unmet.length, errors, requirements, unmet };
}
async function renderMapFiles(p, ref, o = {}) {
  const m = readMap(p, ref), field = map_exports.generateMap(m), id = typeof ref === "string" ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === "string" ? join3(mapsDir(p), id, "out") : dirname2(mapFile(p, ref)));
  const formats = o.formats ?? ["svg", "png"], files = [];
  if (o.fit && o.ppu !== void 0) throw new Error("--fit and --ppu both set the scale: use one");
  const crop = clampCrop(o.crop ?? [0, 0, m.cols, m.rows], m.cols, m.rows), ppu = o.fit ? fitPpu(crop[2], crop[3], o.fit) : o.ppu ?? 40;
  const size = [Math.round(crop[2] * ppu), Math.round(crop[3] * ppu)], unit = o.fit?.unit ?? "px";
  const pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : void 0);
  if (formats.includes("png")) await initNodeMapSvg();
  mkdirSync2(out, { recursive: true });
  for (const theme of o.themes ?? ["color"]) {
    const svg = map_exports.renderMapSvg(m, { theme, ppu, layers: o.layers, field, ...o.crop && { crop }, unit, pageScale }), base = join3(out, `${id}.${theme}`);
    if (formats.includes("svg")) {
      writeFileSync2(`${base}.svg`, svg);
      files.push(`${base}.svg`);
    }
    if (formats.includes("png")) {
      writeFileSync2(`${base}.png`, encodePNG(rasterizeSvg(svg, size[0], size[1])));
      files.push(`${base}.png`);
    }
  }
  return { files: files.map((f) => relative(process.cwd(), f)), terrains: map_exports.terrainsUsed(field), rivers: field.rivers.length, size, crop, ppu, svg: svgSize(crop, ppu, unit), pageScale: pageScale ?? null, unplaced: map_exports.mapLabelLayout(m, ppu, pageScale).unplaced };
}
function svgSize(crop, ppu, unit) {
  const f = unit === "mm" ? 96 / 25.4 : 1, r = (v) => Math.round(v * ppu / f * 100) / 100;
  return { width: r(crop[2]), height: r(crop[3]), unit };
}
function numbers(v, what, pairs2 = true) {
  const xs = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  if (!xs.length || xs.some((x) => !Number.isFinite(x)) || pairs2 && xs.length % 2) throw new Error(`${what}: comma-separated numbers${pairs2 ? " in x,y pairs" : ""}`);
  return xs;
}
function shapeFrom(o) {
  const arr = (v, what, pairs2 = true) => Array.isArray(v) ? v.map(Number) : numbers(v, what, pairs2);
  if (o.circle !== void 0) {
    const c = arr(o.circle, "--circle x,y,r", false);
    if (c.length !== 3) throw new Error("--circle: x,y,r");
    return { circle: [c[0], c[1], c[2]] };
  }
  if (o.poly !== void 0) return { poly: arr(o.poly, "--poly") };
  if (o.stroke !== void 0) return { stroke: arr(o.stroke, "--stroke"), width: Number(o.width ?? 1) };
  throw new Error("a shape is required: --circle x,y,r | --poly x,y,x,y,\u2026 | --stroke x,y,\u2026 --width w");
}
var onOff = (v) => v === void 0 ? void 0 : /^(on|true|yes|1)$/i.test(v);
function parseLayers(v, names = map_exports.MAP_LAYERS) {
  if (!v) return void 0;
  const out = {};
  for (const part of v.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [name, val] = part.split("=");
    if (!names.includes(name)) throw new Error(`--layers: unknown layer ${name} (${names.join(", ")})`);
    out[name] = val === void 0 ? false : onOff(val);
  }
  return out;
}
function describeMap(m) {
  const g = m.gen;
  return [
    `${m.id}${m.title ? ` "${m.title}"` : ""}: ${m.preset}, ${m.cols}\xD7${m.rows} ${m.grid.type === "hex" ? "hexes" : "cells"} of ${m.scale.perCell} ${m.scale.unit}, seed ${m.seed}`,
    `  gen: land ${g.land}, sea ${g.sea}, moisture ${g.moisture}, roughness ${g.roughness}, relief ${g.relief}, rivers ${g.rivers}, simplify ${g.simplify}, feature ${g.feature}`,
    `  topo: every ${m.topo.interval} ${m.topo.unit} up to ${m.topo.maxElevation}, major every ${m.topo.majorEvery}${m.topo.labels ? ", labelled" : ""}`,
    `  grid: ${m.grid.type}${m.grid.type !== "none" ? ` size ${m.grid.size}${m.grid.coords ? ", coordinates" : ""}` : ""}; legend ${m.legend ? "on" : "off"}, scale bar ${m.scaleBar ? "on" : "off"}, compass ${m.compass ? "on" : "off"}`,
    ...m.require?.length ? [`  require (${m.require.length}):${m.require.map((r) => `
    ${r.id} ${r.kind}${r.kind === "terrain" ? ` ${r.terrain} ${r.share}` : r.kind === "height" ? ` ${r.low}-${r.high} ${m.topo.unit}` : r.kind === "path" ? ` ${r.path}` : ""}`).join("")}`] : [],
    `  edits (${m.edits.length}):${m.edits.map((e, i) => `
    ${i}. ${e.op}${e.op === "paint" ? ` ${e.terrain}` : e.op === "elevate" ? ` ${e.amount}` : ""} ${"shape" in e ? JSON.stringify(e.shape) : JSON.stringify(e.points)}`).join("")}`,
    `  labels (${m.overlay.labels.length}):${m.overlay.labels.map((l, i) => `
    ${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}`).join("")}`,
    `  symbols (${m.overlay.symbols.length}):${m.overlay.symbols.map((s, i) => `
    ${i}. ${s.kind} at ${s.x},${s.y}`).join("")}`
  ].join("\n");
}
var km = (l, unit) => `${l.map} (${l.scale} ${unit})`;
var at2 = (p) => `${p[0]},${p[1]}`;
function describeMapFacts(r) {
  const { scale, height } = r.unit, out = [`${r.id}: ${r.size.cols}\xD7${r.size.rows} cells; heights in ${height}, distances in cells (${scale})`];
  const share2 = (s) => s.map((x) => `${x.terrain} ${x.share}%`).join(", ");
  const hi = (h) => `${h.height} ${height} at ${at2(h.at)}${h.prominence ? ` (stands ${h.prominence} ${height} clear)` : ""}`;
  for (const p of r.points ?? []) {
    out.push(`at ${at2(p.at)}: ${p.terrain}, ${p.height} ${height}, slope ${p.slope.band ?? "?"} (${p.slope.gradient} ${height}/${scale})`);
    for (const k of ["river", "road"]) if (p[k]) out.push(`  ${k}: ${p[k].name}${p[k].source ? ` (${p[k].source})` : ""} ${km(p[k].distance, scale)} away at ${at2(p[k].at)}${p[k].within ? ", in it" : ""}`);
    if (p.above) out.push(`  ${p.above.value === null ? `no ${p.above.of} to measure from` : `${p.above.value} ${height} above the ${p.above.of === "river" ? "river" : "lowest ground"}`}${p.above.reference ? ` (${hi(p.above.reference)})` : ""}`);
  }
  for (const a of r.areas ?? []) {
    out.push(`area ${a.area.map(at2).join(" ")}: ${share2(a.terrain)}; lowest ${hi(a.lowest)}, highest ${hi(a.highest)}`);
    for (const c of [...a.rivers, ...a.roads]) out.push(`  ${c.name}${c.source ? ` (${c.source})` : ""}: ${c.enters ? `in at ${at2(c.enters)}` : "starts inside"}, ${c.leaves ? `out at ${at2(c.leaves)}` : "ends inside"}, ${km(c.length, scale)}`);
  }
  const f = r.features;
  if (f) {
    out.push(`terrain: ${share2(f.terrain)}; lowest ${hi(f.lowest)}, highest ${hi(f.highest)}`);
    for (const [what, lines] of [["river", f.rivers], ["generated river", f.generatedRivers], ["road", f.roads]])
      for (const l of lines) out.push(`${what} ${l.name}: ${km(l.length, scale)}, ${l.points.length} points from ${at2(l.points[0])} to ${at2(l.points[l.points.length - 1])}`);
    out.push(`hilltops: ${f.hilltops.map(hi).join("; ") || "none"}`, `hollows: ${f.hollows.map(hi).join("; ") || "none"}`);
  }
  return out.join("\n");
}
function flagValues(args, name) {
  const out = [];
  args.forEach((a, i) => {
    if (a !== name) return;
    for (let k = i + 1; k < args.length && !args[k].startsWith("--"); k++) out.push(args[k]);
  });
  return out;
}
function factsQuery(m, args, flag2) {
  const above = flag2(args, "--above"), radius = flag2(args, "--radius");
  if (above !== void 0 && above !== "river" && above !== "lowest") throw new Error("--above: river or lowest");
  if (radius !== void 0 && !(Number.isFinite(+radius) && +radius > 0)) throw new Error("--radius: a number above 0 (map units)");
  const areas = args.flatMap((a, i) => a === "--area" ? [map_exports.areaOutline(numbers(args[i + 1], "--area", false))] : []);
  return { at: flagValues(args, "--at").map((v) => map_exports.parsePoint(m, v)), areas, ...above && { above }, ...radius !== void 0 && { radius: +radius } };
}

// ../artgen-cli/src/dungeon.ts
var dungeonsDir = (p) => join4(p.art, "dungeons");
function dungeonFile(p, ref) {
  if (typeof ref !== "string") return resolve3(ref.file);
  if (!/^[\w-]+$/.test(ref ?? "")) throw new Error(`dungeon id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p) throw new Error("no artgen project here: name the dungeon file with --file <path>");
  return join4(dungeonsDir(p), ref, "dungeon.json");
}
var shown2 = (p, f) => relative2(p?.root ?? process.cwd(), f);
var dungeonSummary = (m) => ({ id: m.id, size: `${m.cols}x${m.rows}`, ...m.title && { title: m.title }, rooms: m.rooms.length, corridors: m.corridors.length, labels: m.overlay.labels.length, symbols: m.overlay.symbols.length });
function listDungeons(p) {
  if (!existsSync4(dungeonsDir(p))) return [];
  return readdirSync2(dungeonsDir(p), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync4(join4(dungeonsDir(p), d.name, "dungeon.json"))).map((d) => dungeonSummary(readDungeon(p, d.name)));
}
function readDungeon(p, ref) {
  const f = dungeonFile(p, ref);
  if (!existsSync4(f)) throw new Error(typeof ref === "string" ? `no dungeon ${ref} (${shown2(p, f)}) \u2014 artgen dungeon new ${ref}` : `no dungeon file ${shown2(p, f)} \u2014 artgen dungeon new --file ${ref.file}`);
  return dungeon_exports.parseDungeon(readJson(f));
}
function writeDungeon(p, m, ref = m.id) {
  const spec = dungeon_exports.parseDungeon(m), f = dungeonFile(p, ref);
  writeJson(f, spec);
  return shown2(p, f);
}
function createDungeon(p, m, force = false, at3 = m.id) {
  if (existsSync4(dungeonFile(p, at3)) && !force) throw new Error(typeof at3 === "string" ? `dungeon ${m.id} already exists (edit it, or pick another id)` : `${shown2(p, dungeonFile(p, at3))} already exists (edit it, or --force)`);
  return { file: writeDungeon(p, m, at3), dungeon: m };
}
function updateDungeon(p, ref, change) {
  const m = readDungeon(p, ref), next = change(m) ?? m;
  writeDungeon(p, next, ref);
  return next;
}
function checkDungeonFile(p, ref) {
  const f = dungeonFile(p, ref);
  let raw;
  try {
    raw = JSON.parse(readFileSync4(f, "utf8"));
  } catch (e) {
    const missing = e.code === "ENOENT";
    return { file: shown2(p, f), ok: false, errors: [{ path: "", message: missing ? `no such file: ${shown2(p, f)}` : `not JSON: ${e.message}` }], warnings: [] };
  }
  const r = dungeon_exports.checkDungeon(raw), errors = [...r.errors], warnings = [];
  if (!errors.length) for (const x of dungeon_exports.lintDungeon(dungeon_exports.parseDungeon(raw))) (x.severity === "error" ? errors : warnings).push({ path: x.path, message: x.message });
  const u = raw?.underlay;
  if (!errors.some((e) => e.path.startsWith("underlay")) && u && typeof u.map === "string" && !existsSync4(resolve3(dirname3(f), u.map)))
    errors.push({ path: "underlay.map", message: `no such map file ${u.map}` });
  return { file: shown2(p, f), ok: !errors.length, errors, warnings };
}
function readUnderlay(p, ref, m) {
  if (!m.underlay) return null;
  const f = resolve3(dirname3(dungeonFile(p, ref)), m.underlay.map);
  if (!existsSync4(f)) throw new Error(`underlay.map: no such map file ${m.underlay.map} (looked for ${shown2(p, f)})`);
  const spec = map_exports.parseMap(readJson(f));
  return { map: spec, field: map_exports.generateMap(spec) };
}
async function renderDungeonFiles(p, ref, o = {}) {
  const m = readDungeon(p, ref), layout = dungeon_exports.layoutDungeon(m), id = typeof ref === "string" ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === "string" ? join4(dungeonsDir(p), id, "out") : dirname3(dungeonFile(p, ref)));
  const formats = o.formats ?? ["svg", "png"], files = [];
  if (o.fit && o.ppu !== void 0) throw new Error("--fit and --ppu both set the scale: use one");
  if (o.crop && o.rooms?.length) throw new Error("--crop and --room both set the window: use one");
  if (o.margin !== void 0 && !o.rooms?.length) throw new Error("--margin goes with --room");
  const window = o.rooms?.length ? dungeon_exports.roomCrop(m, o.rooms, o.margin, layout) : o.crop;
  const crop = clampCrop(window ?? [0, 0, m.cols, m.rows], m.cols, m.rows), unit = o.fit?.unit ?? "px";
  const pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : void 0), underlay = readUnderlay(p, ref, m);
  const view = { layers: o.layers, layout, ...window && { crop }, pageScale };
  let ppu = o.fit ? fitPpu(crop[2], crop[3], o.fit) : o.ppu ?? 40;
  const fits = (k) => {
    const r = dungeon_exports.dungeonRenderSize(m, { ...view, ppu: k }), f = o.fit.unit === "mm" ? PX_PER_MM : 1;
    return r.width <= o.fit.w * f + 1e-6 && r.height <= o.fit.h * f + 1e-6;
  };
  if (o.fit && !fits(ppu)) {
    let lo = 0, hi = ppu;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    ppu = lo;
  }
  const px = dungeon_exports.dungeonRenderSize(m, { ...view, ppu }), size = [Math.round(px.width), Math.round(px.height)];
  if (formats.includes("png")) await initNodeMapSvg();
  mkdirSync3(out, { recursive: true });
  const svg = dungeon_exports.renderDungeonSvg(m, { ...view, ppu, unit, ...underlay && { underlay } }), base = join4(out, id);
  if (formats.includes("svg")) {
    writeFileSync3(`${base}.svg`, svg);
    files.push(`${base}.svg`);
  }
  if (formats.includes("png")) {
    writeFileSync3(`${base}.png`, encodePNG(rasterizeSvg(svg, size[0], size[1])));
    files.push(`${base}.png`);
  }
  return { files: files.map((f) => relative2(process.cwd(), f)), rooms: m.rooms.length, corridors: m.corridors.length, doors: layout.doors.length, size, crop, ppu, svg: svgSize([0, 0, px.width, px.height], 1, unit), pageScale: pageScale ?? null, unplaced: dungeon_exports.dungeonLabelLayout(m, ppu, pageScale, layout).unplaced };
}
function cornerPoint(at3) {
  const [x, y] = dungeon_exports.parsePoint(at3);
  return /^\s*-?[\d.]+\s*,/.test(at3) ? [x, y] : [Math.floor(x), Math.floor(y)];
}
function corridorEnd(m, ref, side, offset) {
  if (side !== void 0 && !dungeon_exports.SIDES.includes(side)) throw new Error(`--from-side / --to-side: ${dungeon_exports.SIDES.join(", ")}`);
  if (m.rooms.some((r) => r.id === ref)) return { room: ref, ...side && { side }, ...side && offset !== void 0 && { offset } };
  if (side) throw new Error(`a side goes with a room end, and ${ref} is not a room`);
  const c = ref.replace(/^corridor:/, "");
  if (ref.startsWith("corridor:") || m.corridors.some((x) => x.id === c)) {
    if (!m.corridors.some((x) => x.id === c)) throw new Error(`no corridor with id ${c} (give one an id: link \u2026 --id ${c})`);
    return { corridor: c };
  }
  return { at: dungeon_exports.parsePoint(ref) };
}
var endText = (e) => "room" in e ? `${e.room}${e.side ? `.${e.side}${e.offset !== void 0 ? `+${e.offset}` : ""}` : ""}` : "at" in e ? `(${e.at.join(",")})${e.exit ? ` "${e.exit.text}"` : ""}` : `corridor ${e.corridor}`;
function doorPair(v) {
  if (v === void 0) return void 0;
  const parts = v.split(",").map((s) => s.trim()), kind = (s) => {
    if (!s || s === "none" || s === "open") return null;
    if (!dungeon_exports.DOOR_KINDS.includes(s)) throw new Error(`--doors: none or one of ${dungeon_exports.DOOR_KINDS.join(", ")}`);
    return s;
  };
  return [kind(parts[0]), kind(parts.length > 1 ? parts[1] : parts[0])];
}
function gridMode(m, mode) {
  const per = m.scale.perCell, g = { ...m.grid };
  if (mode === "none" || mode === "off") return { ...g, show: false };
  const parts = mode.split("+").map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n <= 0)) throw new Error("grid: 10, 5, 10+5 or none (feet; or the map's unit)");
  return { ...g, show: true, size: parts[0] / per, sub: parts.length > 1 };
}
function warningLines(m, max = 5) {
  const found = dungeon_exports.lintDungeon(m);
  if (!found.length) return [];
  const lines = found.slice(0, max).map((x) => `  ${x.severity}: ${x.path}: ${x.message}`);
  if (found.length > max) lines.push(`  \u2026 ${found.length - max} more (artgen dungeon check ${m.id})`);
  return lines;
}
function describeDungeon(m) {
  const g = m.gen, end = endText;
  const gridFt = (n) => `${n * m.scale.perCell} ${m.scale.unit}`;
  return [
    `${m.id}${m.title ? ` "${m.title}"` : ""}: ${m.cols}\xD7${m.rows} cells of ${m.scale.perCell} ${m.scale.unit}, seed ${m.seed}`,
    `  gen: rooms ${g.rooms}, size ${g.minSize}..${g.maxSize}, caves ${g.caves}, round ${g.round}, loops ${g.loops}, doors ${g.doors}, corridor width ${g.corridorWidth}, spacing ${g.spacing}, entrance ${g.entrance ? "on" : "off"}${g.layout && g.layout !== "scatter" ? `, layout ${g.layout}${g.layout === "dense" ? ` (density ${g.density ?? 0.5})` : ""}` : ""}`,
    `  grid: ${m.grid.show ? `size ${gridFt(m.grid.size)}, sub-grid ${m.grid.sub && m.grid.size > 1 ? `${gridFt(1)}` : "off"}, ${m.grid.clip === "floor" ? "on the floor" : "everywhere"}` : "off"}; hatch ${m.style.hatch}${m.style.hatch === "band" ? ` (${m.style.band} cells)` : ""}; shared walls ${dungeon_exports.sharedWallsOn(m) ? "on" : "off"}${m.style.sharedWalls === void 0 ? " (auto)" : ""}; numbers ${m.numbers ? "on" : "off"}, scale bar ${m.scaleBar ? "on" : "off"}, compass ${m.compass ? "on" : "off"}`,
    ...m.furniture && m.furniture.place !== "over" ? [`  furniture: ${m.furniture.place}, band ${m.furniture.side ?? "bottom"}`] : [],
    `  rooms (${m.rooms.length}):${m.rooms.map((r) => `
    ${r.id}: ${r.shape} ${r.w}\xD7${r.h} at ${r.x},${r.y}${r.fill && r.fill !== "floor" ? `, ${r.fill}` : ""}${r.number === false ? ", no number" : r.number !== void 0 ? `, #${r.number}` : ""}${r.label ? ` "${r.label}"` : ""}${r.href ? ` \u2192 ${r.href}` : ""}`).join("")}`,
    `  corridors (${m.corridors.length}):${m.corridors.map((c, i) => `
    ${i}.${c.id ? ` [${c.id}]` : ""} ${end(c.from)} \u2192 ${end(c.to)}${c.width && c.width !== 1 ? `, width ${c.width}` : ""}${c.via ? `, via ${c.via.join(",")}` : c.route && c.route !== "auto" ? `, ${c.route}` : ""}${c.curve === "smooth" ? ", curved" : ""}${c.style === "natural" ? ", natural" : ""}${c.doors?.some(Boolean) ? `, doors ${c.doors.map((d) => d ?? "none").join("/")}` : ""}`).join("")}`,
    ...m.blocks?.length ? [`  blocks (${m.blocks.length}):${m.blocks.map((b) => `
    ${b.id}: ${b.shape} ${b.w}\xD7${b.h} at ${b.x},${b.y}, split ${b.split.mode}${b.split.min ? ` (min ${b.split.min})` : ""}${b.split.seed !== void 0 ? `, seed ${b.split.seed}` : ""}: ${m.rooms.filter((r) => r.origin === `block:${b.id}`).length} rooms`).join("")}`] : [],
    ...m.connections?.length ? [`  connections (${m.connections.length}):${m.connections.map((c, i) => `
    ${i}. ${c.a} \u2194 ${c.b}: ${c.kind ?? "door"}${c.width && c.width !== 1 ? `, width ${c.width}` : ""}${c.at ? ` at ${c.at.join(",")}` : ""}`).join("")}`] : [],
    `  labels (${m.overlay.labels.length}):${m.overlay.labels.map((l, i) => `
    ${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}${l.href ? ` \u2192 ${l.href}` : ""}`).join("")}`,
    `  symbols (${m.overlay.symbols.length}):${m.overlay.symbols.map((s, i) => `
    ${i}. ${s.kind} at ${s.x},${s.y}${s.angle ? ` turned ${s.angle}\xB0` : ""}`).join("")}`
  ].join("\n");
}
function describeDungeonFacts(r) {
  const unit = r.unit.scale, box2 = (b) => `${b.cells.w}\xD7${b.cells.h} cells (${b.scale.w}\xD7${b.scale.h} ${unit}) at ${b.cells.x},${b.cells.y}`;
  const end = endText;
  return [
    `${r.id}: ${r.size.cols}\xD7${r.size.rows} cells; positions in cells, lengths also in ${unit}`,
    `rooms (${r.rooms.length}):${r.rooms.map((m) => `
  ${m.id}${m.number !== null ? ` #${m.number}` : ""}: ${m.shape} ${box2(m.box)}${m.label ? ` "${m.label}"` : ""}${m.doors.length ? `; doors ${m.doors.map((d) => `${d.kind}${d.at ? ` at ${d.at.join(",")}` : ""}`).join(", ")}` : ""}${m.connections?.length ? `; joins ${m.connections.map((c) => `${c.to} (${c.kind})`).join(", ")}` : ""}`).join("")}`,
    `corridors (${r.corridors.length}):${r.corridors.map((c) => `
  ${c.index}. ${end(c.from)} \u2192 ${end(c.to)}: ${c.length.map} cells (${c.length.scale} ${unit}), width ${c.width}${c.doors.some(Boolean) ? `, doors ${c.doors.map((d) => d ?? "none").join("/")}` : ""}`).join("")}`,
    `exits (${r.exits.length}):${r.exits.map((x) => `
  corridor ${x.corridor} ${x.end} at ${x.at.join(",")}${x.room ? ` from ${x.room}` : ""}: nearest edge ${x.edge}, ${x.distance.map} cells (${x.distance.scale} ${unit})`).join("")}`,
    `overlaps (${r.overlaps.length}):${r.overlaps.map((o) => `
  ${o.rooms.join(" / ")}: ${o.count} cells, ${box2(o.box)}`).join("")}`,
    `unreached rooms: ${r.unreached.join(", ") || "none"}`,
    ...(r.walls ?? []).map((w) => `wall ${w.id ?? w.index}: ${w.corners.length} corners, ${w.towers.length} towers (${w.towers.filter((t) => t.source === "corner").length} at corners), thickness ${w.thickness}; ${w.enclosed.every((e) => e.inside) ? "encloses every room" : `does not enclose ${w.enclosed.filter((e) => !e.inside).map((e) => e.room).join(", ")}`}${w.gates.map((g) => `
  ${g.kind} at ${g.at.join(",")} (wall at ${g.angle}\xB0, ${g.width} wide, ${g.towers} towers${g.room ? `, opens into ${g.room}` : ""})`).join("")}`)
  ].join("\n");
}

// ../artgen-cli/src/settlement.ts
import { existsSync as existsSync5, mkdirSync as mkdirSync4, readdirSync as readdirSync3, readFileSync as readFileSync5, writeFileSync as writeFileSync4 } from "node:fs";
import { dirname as dirname4, join as join5, relative as relative3, resolve as resolve4 } from "node:path";
var settlementsDir = (p) => join5(p.art, "settlements");
function settlementFile(p, ref) {
  if (typeof ref !== "string") return resolve4(ref.file);
  if (!/^[\w-]+$/.test(ref ?? "")) throw new Error(`settlement id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p) throw new Error("no artgen project here: name the settlement file with --file <path>");
  return join5(settlementsDir(p), ref, "settlement.json");
}
var shown3 = (p, f) => relative3(p?.root ?? process.cwd(), f);
var settlementSummary = (m) => ({
  id: m.id,
  kind: m.kind,
  size: `${m.cols}x${m.rows}`,
  ...m.title && { title: m.title },
  buildings: m.buildings.length,
  interiors: m.buildings.filter((b) => b.floors?.length).length,
  roads: m.roads.length,
  walls: m.walls.length,
  water: m.water.length
});
function listSettlements(p) {
  if (!existsSync5(settlementsDir(p))) return [];
  return readdirSync3(settlementsDir(p), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync5(join5(settlementsDir(p), d.name, "settlement.json"))).map((d) => settlementSummary(readSettlement(p, d.name)));
}
function readSettlement(p, ref) {
  const f = settlementFile(p, ref);
  if (!existsSync5(f)) throw new Error(typeof ref === "string" ? `no settlement ${ref} (${shown3(p, f)}) \u2014 artgen settlement new ${ref}` : `no settlement file ${shown3(p, f)} \u2014 artgen settlement new --file ${ref.file}`);
  return settlement_exports.parseSettlement(readJson(f));
}
function writeSettlement(p, m, ref = m.id) {
  const spec = settlement_exports.parseSettlement(m), f = settlementFile(p, ref);
  writeJson(f, spec);
  return shown3(p, f);
}
function createSettlement(p, m, force = false, at3 = m.id) {
  if (existsSync5(settlementFile(p, at3)) && !force) throw new Error(typeof at3 === "string" ? `settlement ${m.id} already exists (edit it, or pick another id)` : `${shown3(p, settlementFile(p, at3))} already exists (edit it, or --force)`);
  return { file: writeSettlement(p, m, at3), settlement: m };
}
function updateSettlement(p, ref, change) {
  const m = readSettlement(p, ref), next = change(m) ?? m;
  writeSettlement(p, next, ref);
  return next;
}
function readSettlementUnderlay(p, ref, m) {
  if (!m.underlay) return null;
  const f = resolve4(dirname4(settlementFile(p, ref)), m.underlay.map);
  if (!existsSync5(f)) throw new Error(`underlay.map: no such map file ${m.underlay.map} (looked for ${shown3(p, f)})`);
  const spec = map_exports.parseMap(readJson(f));
  return { map: spec, field: map_exports.generateMap(spec) };
}
function mapForSettlement(p, ref, mapRef) {
  const path = /[\\/.]/.test(mapRef) ? resolve4(mapRef) : (() => {
    if (!p) throw new Error("--map: a map file path (no project here)");
    return join5(p.art, "maps", mapRef, "map.json");
  })();
  if (!existsSync5(path)) throw new Error(`--map: no map ${mapRef} (${shown3(p, path)})`);
  return { path, rel: relative3(dirname4(settlementFile(p, ref)), path).split("\\").join("/") };
}
function checkSettlementFile(p, ref) {
  const f = settlementFile(p, ref);
  let raw;
  try {
    raw = JSON.parse(readFileSync5(f, "utf8"));
  } catch (e) {
    const missing = e.code === "ENOENT";
    return { file: shown3(p, f), ok: false, errors: [{ path: "", message: missing ? `no such file: ${shown3(p, f)}` : `not JSON: ${e.message}` }], warnings: [] };
  }
  const r = settlement_exports.checkSettlement(raw), errors = [...r.errors], warnings = [];
  if (!errors.length) for (const x of settlement_exports.lintSettlement(settlement_exports.parseSettlement(raw))) (x.severity === "error" ? errors : warnings).push({ path: x.path, message: x.message });
  const u = raw?.underlay;
  if (!errors.some((e) => e.path.startsWith("underlay")) && u && typeof u.map === "string" && !existsSync5(resolve4(dirname4(f), u.map))) errors.push({ path: "underlay.map", message: `no such map file ${u.map}` });
  return { file: shown3(p, f), ok: !errors.length, errors, warnings };
}
function settlementWarningLines(m, max = 5) {
  const found = settlement_exports.lintSettlement(m);
  const lines = found.slice(0, max).map((x) => `  ${x.severity}: ${x.path}: ${x.message}`);
  if (found.length > max) lines.push(`  \u2026 ${found.length - max} more (artgen settlement check ${m.id})`);
  return lines;
}
async function renderSettlementFiles(p, ref, o = {}) {
  const m = readSettlement(p, ref), id = typeof ref === "string" ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === "string" ? join5(settlementsDir(p), id, "out") : dirname4(settlementFile(p, ref)));
  const formats = o.formats ?? ["svg", "png"], themes = o.themes ?? ["color"];
  if (o.fit && o.ppu !== void 0) throw new Error("--fit and --ppu both set the scale: use one");
  const underlay = readSettlementUnderlay(p, ref, m), layout = settlement_exports.layoutSettlement(m);
  const jobs = [];
  if (o.plans) {
    jobs.push({ view: "site" });
    for (const b of m.buildings) for (const f of b.floors ?? []) jobs.push({ view: "plan", building: b.id, floor: f.level });
  } else if ((o.view ?? (o.building ? "plan" : "site")) === "plan") {
    const t = settlement_exports.planTarget(m, o.building, o.floor);
    jobs.push({ view: "plan", building: t.building.id, ...t.floor && { floor: t.floor.level } });
  } else jobs.push({ view: "site" });
  if (formats.includes("png")) await initNodeMapSvg();
  mkdirSync4(out, { recursive: true });
  const results = [];
  for (const job of jobs) {
    const sheet = job.view === "plan" ? settlement_exports.planSheet(m, m.buildings.find((b) => b.id === job.building)) : { cols: m.cols, rows: m.rows };
    const crop = clampCrop(o.crop ?? [0, 0, sheet.cols, sheet.rows], sheet.cols, sheet.rows), unit = o.fit?.unit ?? "px", pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : void 0);
    const view = { view: job.view, ...job.building && { building: job.building }, ...job.floor !== void 0 && { floor: job.floor }, buildings: o.buildings, layers: o.layers, ...job.view === "site" && { layout }, ...o.crop && { crop }, pageScale };
    let ppu = o.fit ? fitPpu(crop[2], crop[3], o.fit) : o.ppu ?? (job.view === "plan" ? 40 : 24);
    if (o.fit) {
      const f = o.fit.unit === "mm" ? PX_PER_MM : 1, fits = (k) => {
        const r = settlement_exports.settlementRenderSize(m, { ...view, ppu: k });
        return r.width <= o.fit.w * f + 1e-6 && r.height <= o.fit.h * f + 1e-6;
      };
      if (!fits(ppu)) {
        let lo = 0, hi = ppu;
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        ppu = lo;
      }
    }
    const px = settlement_exports.settlementRenderSize(m, { ...view, ppu }), size = [Math.round(px.width), Math.round(px.height)], files = [];
    const stem = job.view === "plan" ? `${id}.${job.building}.${(job.floor ?? 0) < 0 ? `c${-(job.floor ?? 0)}` : `f${job.floor ?? 0}`}` : id;
    for (const theme of themes) {
      const svg = settlement_exports.renderSettlementSvg(m, { ...view, ppu, unit, theme, ...underlay && job.view === "site" && { underlay } }), base = join5(out, `${stem}.${theme}`);
      if (formats.includes("svg")) {
        writeFileSync4(`${base}.svg`, svg);
        files.push(`${base}.svg`);
      }
      if (formats.includes("png")) {
        writeFileSync4(`${base}.png`, encodePNG(rasterizeSvg(svg, size[0], size[1])));
        files.push(`${base}.png`);
      }
    }
    results.push({ files: files.map((f) => relative3(process.cwd(), f)), view: job.view, ...job.building && { building: job.building }, ...job.floor !== void 0 && { floor: job.floor }, size, crop, ppu, svg: svgSize([0, 0, px.width, px.height], 1, unit) });
  }
  return results;
}
function describeSettlement(m) {
  const g = m.gen, l = settlement_exports.layoutSettlement(m), unit = m.scale.unit;
  const counts = (xs) => Object.entries(xs.reduce((a, k) => (a[k] = (a[k] ?? 0) + 1, a), {})).map(([k, n]) => `${n} ${k}`).join(", ") || "none";
  return [
    `${m.id}${m.title ? ` "${m.title}"` : ""}: a ${m.kind}, ${m.cols}\xD7${m.rows} cells of ${m.scale.perCell} ${unit} (plans in ${m.interior.perCell} ${unit} cells), seed ${m.seed}, ${m.ground} ground`,
    `  gen: buildings ${g.buildings}, density ${g.density}, streets ${g.streets}, wall ${g.wall}, water ${g.water}, trees ${g.trees}, fields ${g.fields}, market ${g.market ? "on" : "off"}, castle ${g.castle ? "on" : "off"}, interiors ${g.interiors ? "on" : "off"}`,
    `  grid: ${m.grid.show ? `every ${m.grid.size * m.scale.perCell} ${unit}${m.grid.sub ? ", sub-grid" : ""}` : "off"}; numbers ${m.numbers ? "on" : "off"}, scale bar ${m.scaleBar ? "on" : "off"}, compass ${m.compass ? "on" : "off"}, legend ${m.legend ? "on" : "off"}${m.underlay ? `; underlay ${m.underlay.map} at ${m.underlay.origin.join(",")}, ${m.underlay.scale} map units a cell` : ""}`,
    `  buildings (${m.buildings.length}):${l.buildings.map((bg) => {
      const b = bg.building;
      return `
    ${b.id}${bg.number !== void 0 ? ` #${bg.number}` : ""}: ${b.kind}, ${b.shape} ${b.w}\xD7${b.h} at ${b.x},${b.y}${b.angle ? ` turned ${b.angle}\xB0` : ""}${b.label ? ` "${b.label}"` : ""}${b.floors?.length ? `; floors ${b.floors.map((f) => `${f.level} (${f.rooms.length} rooms, ${f.fixtures?.length ?? 0} fixtures)`).join(", ")}` : ""}`;
    }).join("")}`,
    `  roads (${m.roads.length}): ${counts(m.roads.map((r) => r.kind))}`,
    `  water (${m.water.length}): ${counts(m.water.map((w) => w.kind))}${l.bridges.length ? `; ${l.bridges.length} bridge${l.bridges.length === 1 ? "" : "s"}` : ""}`,
    `  walls (${m.walls.length}):${m.walls.map((w, i) => `
    ${i}. ${w.kind}${w.closed ? ", closed" : ""}, ${w.points.length / 2} points, ${l.walls[i].towers.length} towers, gates ${w.gates?.map((gt) => gt.kind).join(", ") || "none"}`).join("")}`,
    `  areas (${m.areas.length}): ${counts(m.areas.map((a) => a.kind))}; trees ${m.trees.length} (+${l.areaTrees.length} in woods and orchards); props: ${counts(m.props.map((x) => x.kind))}`,
    `  labels ${m.overlay.labels.length}, symbols ${m.overlay.symbols.length}`
  ].join("\n");
}
function describeSettlementFacts(f) {
  const t = (r) => Object.entries(r).map(([k, n]) => `${n} ${k}`).join(", ") || "none";
  return [
    `${f.id}: a ${f.kind}, ${f.size.cols}\xD7${f.size.rows} cells, ${f.size.scale}`,
    `buildings: ${t(f.counts.buildings)}; roads: ${t(f.counts.roads)}; walls: ${t(f.counts.walls)}; water: ${t(f.counts.water)}; areas: ${t(f.counts.areas)}; trees ${f.counts.trees}; ${f.bridges} bridges`,
    ...f.buildings.map((b) => `  ${b.id}${b.number !== void 0 ? ` #${b.number}` : ""} ${b.kind}${b.label ? ` "${b.label}"` : ""}: ${b.size}, ${b.stories} storey${b.stories === 1 ? "" : "s"}${b.floors.map((fl2) => `
    ${fl2.name}: ${fl2.rooms} rooms, ${fl2.doors} doors, ${fl2.windows} windows; ${t(fl2.fixtures)}`).join("")}`),
    ...f.walls.map((w) => `  wall ${w.index}: ${w.kind}, ${w.length} long, ${w.towers} towers, gates ${w.gates.map((g) => `${g.kind} at ${g.at.join(",")}`).join("; ") || "none"}`),
    ...f.roads.map((r) => `  road ${r.index}: ${r.kind}, ${r.length}${r.label ? ` "${r.label}"` : ""}`)
  ].join("\n");
}

// ../artgen-cli/src/maps-cli.ts
function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : void 0;
}
function list2(args, name) {
  const v = flag(args, name);
  return v === void 0 ? void 0 : v.split(",").map((s) => s.trim()).filter(Boolean);
}
function viewFlags(args, cell) {
  const crop = flag(args, "--crop"), fit = flag(args, "--fit");
  return { ...crop !== void 0 && { crop: parseCrop(crop, cell) }, ...fit !== void 0 && { fit: parseFit(fit) } };
}
var originFlag = (args) => {
  const v = flag(args, "--origin");
  if (v === void 0) return void 0;
  if (!v) throw new Error("--origin: a non-empty name");
  return { origin: v };
};
var pageScaleFlag = (args) => {
  const v = flag(args, "--page-scale");
  if (v === void 0) return void 0;
  if (!(+v > 0)) throw new Error("--page-scale: output pixels per millimetre, above 0");
  return +v;
};
function syncText(file, r) {
  const lists = Object.entries(r.lists).filter(([, c]) => c.removed || c.added).map(([n, c]) => `${n}: ${c.removed} of ${r.origin} replaced by ${c.added}`);
  return [`${file}: synced origin ${r.origin}${lists.length ? ` (${lists.join("; ")})` : " (nothing of that origin on either side)"}`, `${r.conflicts.length} conflict${r.conflicts.length === 1 ? "" : "s"}${r.conflicts.length ? ":" : ""}`, ...r.conflicts.map((c) => `  ${c.kind}: ${c.message}`)].join("\n");
}
var num2 = (args, name) => {
  const v = flag(args, name);
  if (v === void 0) return void 0;
  if (!Number.isFinite(+v)) throw new Error(`${name}: a number`);
  return +v;
};
var MAP_USAGE = `       artgen map new <id> [--preset regional|local] [--size 30x22] [--grid hex|square|none] [--seed n] [--title "..."]
       artgen map gen <id> [--seed n] [--land mixed|island|inland] [--sea f] [--moisture f] [--roughness f] [--relief f] [--rivers n] [--simplify n] [--feature n] [--interval n] [--max-elevation n] [--topo-labels on|off]
       artgen map edit <id> paint --terrain t <shape> | elevate --amount \xB1f <shape> | river --points x,y,\u2026 [--width w] [--delta off] | road --points x,y,\u2026 | undo
                  <shape>: --circle x,y,r | --poly x,y,x,y,\u2026 | --stroke x,y,\u2026 --width w   (terrains: ${map_exports.TERRAINS.join(", ")})
       artgen map grid <id> hex|square|none [--size n] [--coords on|off]
       artgen map label <id> "Text" --at x,y|0304|C4 [--kind region|place|water|note] [--size f] [--angle deg]
       artgen map symbol <id> <kind> --at x,y|0304|C4 [--scale f] [--angle deg] [--origin name] | map symbols | map overlay <id> rm label|symbol <i> | clear [labels|symbols]
       artgen map set <id> [--title "..."] [--legend on|off] [--scale-bar on|off] [--compass on|off] [--per-cell n] [--unit mi]
       artgen map render <id> [--theme color|bw|both] [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h[cells]] [--layers grid=off,labels=off] [--out dir]
         (--fit and --page-scale set label, symbol and stroke sizes in points and millimetres on the page, 9 pt place labels, 7 pt notes, 5 mm symbols, and keep labels off one another; --json lists any that found no room.
          --crop is a window on the full render, in map units or, with "cells" after it, grid cells; --fit picks the ppu that fits the crop or the whole map in the box)
       artgen map show <id> | list
       artgen map facts <id> [--at x,y \u2026 | C4 | 0304] [--area x,y,x,y,\u2026] [--above river|lowest] [--radius n] [--json]
                  the ground as numbers: --at gives each point's terrain, height, slope and nearest river and road; --area the terrain shares, lowest and highest
                  ground and the rivers and roads that cross it; neither gives the whole map's rivers, roads, hilltops, hollows and terrain shares.
                  Positions in map units, lengths also in the scale unit, heights in topo.unit and whole multiples of topo.interval
       artgen map check <id> [--json]   the file's format errors with their JSON paths, then each \`require\` entry measured: \`C-forest terrain forest 0.71 < 0.80 unmet\`; exits 1 on any error or unmet requirement
       artgen dungeon new <id> [--size 40x30] [--seed n] [--title "..."] [--empty] | new <id> --room rect|circle|octagon|cave --room-size 8x6 [--exits n,e:secret,s:none:To the caves,w] [--label "..."] [--number n|off]
       artgen dungeon gen <id> [--seed n] [--rooms n] [--min-size n] [--max-size n] [--caves f] [--round f] [--loops f] [--doors f] [--corridor-width n] [--spacing n] [--entrance on|off] [--size 40x30]
                  [--layout scatter|dense|blocks] [--density f]   dense: rooms side by side, joined through shared walls; blocks: blocks split into rooms, joined by corridors
       artgen dungeon room <id> add <shape> --at x,y|C4 --size WxH [--points x,y,\u2026] [--label "..."] [--number n|off] [--room-id r9] [--fill floor|building|yard|cellar] [--href url] [--origin name] | move <rid> --at x,y | set <rid> [--shape s] [--size WxH] [--label "..."] [--number n|off] [--fill f] [--href url|none] | rm <rid>
       artgen dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id> [--width 1] [--route auto|hv|vh|straight|around] [--via x,y,\u2026] [--doors door,none] [--from-side n|e|s|w] [--from-offset n] [--to-side \u2026] [--to-offset n] [--curve smooth] [--style natural] [--seed n] [--id name] [--exit "To the caves" [--exit-href url] [--fade 3]] [--origin name] | unlink <id> <i> | door <id> <i> from|to <kind|none>
       artgen dungeon block <id> add rect|octagon|circle|hex|poly --at x,y --size WxH [--points x,y,\u2026] [--split bsp|rows|cols|grid|cuts] [--min 3] [--cuts-x 4,8] [--cuts-y 6] [--seed n] [--doors 0.25] [--block-id b1]
                  | split <bid> [--seed n] [--split mode] [--min n] | rm <bid>   one shape split into rooms that share walls, with doors between (a block id in link means its nearest room)
       artgen dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1] | disconnect <id> <i>   a door or opening in the wall two touching rooms share
                  (shapes: ${dungeon_exports.ROOM_SHAPES.join(", ")}; doors: ${dungeon_exports.DOOR_KINDS.join(", ")})
       artgen dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all] | style <id> [--hatch band|full|none] [--band n] [--wall f] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--title "..."] [--per-cell n] [--unit ft] [--furniture over|outside|auto] [--furniture-side bottom|right] [--shared-walls on|off|auto]
       artgen dungeon label <id> "Text" --at x,y|C4 [--kind name|note|area] [--size f] [--angle deg] [--href url] [--origin name] | symbol <id> <kind> --at x,y|C4 [--scale f] [--angle deg] [--origin name] | symbols
       artgen dungeon overlay <id> rm label|symbol <i> | clear [labels|symbols] | fit <id> [--margin 2]
       artgen dungeon check <id> [--json]   every error in the file with its JSON path, then drawing errors and warnings (a room outline that crosses itself, rooms laid over each other, a corridor through a room it does not join or across another, a door never drawn, a mark off the sheet or on a badge); exits 1 when there are errors
       artgen map sync <id>|--file target.json --from new.json --origin tables [--json]   replace the entries of one origin, keep every other (hand entries last); lists what that disturbs
       artgen dungeon sync <id>|--file target.json --from new.json --origin tables [--json]   the same for rooms, corridors, walls, labels and symbols; a hand-edited field of a generated room is reported and the table's value kept
       artgen dungeon facts <id> [--json]   each room's box and doors, each corridor's ends and length, the exits, the overlapping rooms and the rooms no corridor reaches
       artgen dungeon render <id> [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h] [--room id|F.3 \u2026 [--margin 2]] [--layers grid=off,labels=off] [--out dir] | show <id> | list
         (--room, repeated, crops round those rooms, their doors and the first --margin cells of each corridor)
       artgen settlement new <id> [--kind hamlet|village|town|city|castle] [--size 80x60] [--seed n] [--title "..."] [--empty] [--interiors] [--map <map id|path> --at x,y]
                  a village, town or castle laid out from a seed (--empty: a blank sheet to draw on); --map sets a terrain map under it, its water, woods and slopes shaping the layout
       artgen settlement gen <id> [--seed n] [--kind k] [--size WxH] [--buildings n] [--density f] [--streets organic|grid|radial] [--wall none|palisade|stone] [--water none|river|lake|coast|moat]
                  [--trees f] [--fields f] [--market on|off] [--castle on|off] [--interiors on|off]   lays it out again; entries drawn by hand (no origin) are kept
       artgen settlement building <id> add <kind> --at x,y --size WxH [--shape rect|L|T|circle|octagon|poly] [--points x,y,\u2026] [--wing w,h] [--angle deg] [--roof r] [--stories n] [--label "..."] [--number n|off] [--building-id b9] [--href url]
                  | set <bid> [the same flags] | move <bid> --at x,y | rm <bid>      (kinds: ${settlement_exports.BUILDING_KINDS.join(", ")}; roofs: ${settlement_exports.ROOFS.join(", ")})
       artgen settlement interior <id> <bid> [--seed n] [--stories n] | interior <id> <bid> clear     lay a building's floors out (rooms, doors, windows, stairs, furniture), or clear them
       artgen settlement floor <id> <bid> add|rm --level n [--name "..."] | room <id> <bid> add <shape> --at x,y --size WxH [--level n] [--label "..."] [--room-id r] | room <id> <bid> set|rm <rid> [--level n] \u2026
       artgen settlement connect <id> <bid> <room> <room> [--level n] [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width n] | disconnect <id> <bid> <i> [--level n]
       artgen settlement door|window <id> <bid> --at x,y [--level n] [--kind k] [--width n]      a door or window in the outer wall (plan cells from the footprint's top-left corner)
       artgen settlement fixture <id> <bid> add <kind> --at x,y [--level n] [--size WxH] [--angle deg] [--label "..."] | rm <i> [--level n] | prop <id> add <kind> --at x,y [--size WxH] [--angle deg] | prop <id> rm <i> | fixtures
       artgen settlement road <id> add highway|street|lane|alley|path|track --points x,y,\u2026 [--width n] [--curve smooth] [--label "..."] | water <id> add river|stream|canal|moat|pond|lake|sea --points x,y,\u2026 [--width n]
       artgen settlement wall <id> add curtain|stone|palisade|fence|hedge|drystone|ruined --points x,y,\u2026 [--closed] [--thickness n] [--towers round|square [--tower-size n] [--tower-every n]]
                  | wall <id> gate <i> --at x,y [--kind gatehouse|gate|postern|opening] [--width n] [--drawbridge] | area <id> add <kind> --points x,y,\u2026 [--label "..."] | tree <id> add <kind> --at x,y [--size n] | tree <id> scatter <kind> --area x,y,\u2026 --count n
                  | road|water|wall|area|tree <id> rm <i>      (areas: ${settlement_exports.AREA_KINDS.join(", ")}; trees: ${settlement_exports.TREE_KINDS.join(", ")})
       artgen settlement grid <id> [10|5|none] [--sub on|off] | style <id> [--title "..."] [--ground grass|dirt|sand|snow|stone] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--per-cell n] [--unit ft] [--plan-cell n] [--furniture over|outside|auto]
       artgen settlement label <id> "Text" --at x,y [--kind name|note|area|street] [--size f] [--angle deg] | symbol <id> <kind> --at x,y [--scale f] [--angle deg] | overlay <id> rm label|symbol <i> | symbols
       artgen settlement check <id> [--json] | facts <id> [--json] | show <id> | list
       artgen settlement render <id> [--view site|plan] [--building bid [--floor n]] [--plans] [--buildings roofs|outline|interior] [--theme color|bw|both] [--format svg|png|both] [--ppu n | --fit 180x260mm] [--crop x,y,w,h] [--layers grid=off] [--out dir]
                  the site (roofs, outlines, or cut away to the ground floor), one building's floor plan, or with --plans the site and every floor of every building
       artgen formats   (the map, dungeon and settlement file format versions this artgen reads; a newer file is refused)
       (map, dungeon and settlement commands take --file <path> in place of <id>: no project needed; renders go beside the file or to --out)`;
var withVersion = (data, version) => data && typeof data === "object" && !Array.isArray(data) ? { version, ...data } : { version, items: data };
async function mapCommand(sub, args, emit) {
  const print = (human, data) => emit(human, withVersion(data, map_exports.MAP_FORMAT));
  const file = flag(args, "--file"), p = file || sub === "symbols" ? null : requireProject(flag(args, "--root"));
  const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--json")).slice(1);
  if (file && sub !== "new") pos.unshift("");
  const id = pos[0];
  const need = (what) => {
    if (file) return { file };
    if (!id) throw new Error(`map ${sub}: ${what}`);
    return id;
  };
  const next = (i) => file ? `next: artgen map render --file ${file}` : `next: artgen map render ${i ?? id}`;
  if (sub === "list") {
    const ms = file ? [mapSummary(readMap(null, { file }))] : listMaps(p);
    print(ms.length ? ms.map((m) => `${m.id.padEnd(16)} ${m.preset.padEnd(9)} ${m.size.padEnd(7)} ${m.edits} edits, ${m.labels} labels, ${m.symbols} symbols${m.title ? `  "${m.title}"` : ""}`).join("\n") : "no maps yet: artgen map new <id>", ms);
    return 0;
  }
  if (sub === "symbols") {
    print(Object.entries(map_exports.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join("\n"), map_exports.SYMBOL_KINDS);
    return 0;
  }
  if (sub === "show") {
    const m = readMap(p, need("<id>"));
    print(describeMap(m), m);
    return 0;
  }
  if (sub === "new") {
    const preset = flag(args, "--preset") ?? "regional";
    if (!map_exports.PRESETS.includes(preset)) throw new Error(`--preset: ${map_exports.PRESETS.join(" or ")}`);
    const sz = flag(args, "--size")?.match(/^(\d+)x(\d+)$/), grid = flag(args, "--grid");
    if (flag(args, "--size") && !sz) throw new Error("--size: COLSxROWS, e.g. 30x22");
    const r = createMap(p, file ? id ?? fileId(file) : need("<id> is required"), preset, {
      seed: num2(args, "--seed") ?? Math.floor(Math.random() * 1e6),
      ...sz && { cols: +sz[1], rows: +sz[2] },
      ...flag(args, "--title") && { title: flag(args, "--title") },
      ...grid && { grid: { ...map_exports.PRESET_DEFAULTS[preset].grid, type: grid } }
    }, args.includes("--force"), file ? { file } : void 0);
    print(`${r.file}
${describeMap(r.map)}
${next(r.map.id)}`, { file: r.file, map: r.map });
    return 0;
  }
  if (sub === "gen") {
    const m = updateMap(p, need("<id>"), (m2) => {
      if (num2(args, "--seed") !== void 0) m2.seed = num2(args, "--seed");
      const land = flag(args, "--land");
      if (land) m2.gen.land = land;
      for (const k of ["sea", "moisture", "roughness", "relief", "rivers", "simplify", "feature"]) {
        const v = num2(args, `--${k}`);
        if (v !== void 0) m2.gen[k] = v;
      }
      if (num2(args, "--interval") !== void 0) m2.topo.interval = num2(args, "--interval");
      if (num2(args, "--max-elevation") !== void 0) m2.topo.maxElevation = num2(args, "--max-elevation");
      if (num2(args, "--major-every") !== void 0) m2.topo.majorEvery = num2(args, "--major-every");
      if (onOff(flag(args, "--topo-labels")) !== void 0) m2.topo.labels = onOff(flag(args, "--topo-labels"));
    });
    print(`${describeMap(m)}
${next(id)}`, m);
    return 0;
  }
  if (sub === "edit") {
    const op = pos[1];
    let summary = "";
    const m = updateMap(p, need("<id> <op>"), (m2) => {
      const shape = () => shapeFrom({ circle: flag(args, "--circle"), poly: flag(args, "--poly"), stroke: flag(args, "--stroke"), width: flag(args, "--width") });
      if (op === "undo") {
        const e = m2.edits.pop();
        if (!e) throw new Error(`${m2.id}: no edits to undo`);
        summary = `removed ${e.op}`;
        return;
      }
      if (op === "paint") {
        const t = flag(args, "--terrain");
        if (!map_exports.TERRAINS.includes(t)) throw new Error(`--terrain: one of ${map_exports.TERRAINS.join(", ")}`);
        m2.edits.push({ op, terrain: t, shape: shape() });
      } else if (op === "elevate") m2.edits.push({ op, amount: num2(args, "--amount") ?? 0.2, shape: shape() });
      else if (op === "river") m2.edits.push({ op, points: numbers(flag(args, "--points"), "--points"), ...num2(args, "--width") !== void 0 && { width: num2(args, "--width") }, ...onOff(flag(args, "--delta")) === false && { delta: false } });
      else if (op === "road") m2.edits.push({ op, points: numbers(flag(args, "--points"), "--points") });
      else throw new Error("map edit <id> paint|elevate|river|road|undo");
      if (originFlag(args)) m2.edits[m2.edits.length - 1].origin = originFlag(args).origin;
      summary = `edit ${m2.edits.length - 1}: ${op}`;
    });
    print(`${m.id}: ${summary} (${m.edits.length} edits)
${next(m.id)}`, m);
    return 0;
  }
  if (sub === "grid") {
    const type = pos[1];
    if (!map_exports.GRID_TYPES.includes(type)) throw new Error(`map grid <id> ${map_exports.GRID_TYPES.join("|")}`);
    const m = updateMap(p, need("<id>"), (m2) => {
      m2.grid.type = type;
      if (num2(args, "--size") !== void 0) m2.grid.size = num2(args, "--size");
      if (onOff(flag(args, "--coords")) !== void 0) m2.grid.coords = onOff(flag(args, "--coords"));
    });
    print(`${m.id}: grid ${m.grid.type}${m.grid.type !== "none" ? ` size ${m.grid.size}${m.grid.coords ? ", coordinates" : ""}` : ""}
${next(m.id)}`, m.grid);
    return 0;
  }
  if (sub === "label" || sub === "symbol") {
    const what = pos[1], at3 = flag(args, "--at");
    if (!what || !at3) throw new Error(sub === "label" ? 'map label <id> "Text" --at x,y|0304|C4' : "map symbol <id> <kind> --at x,y|0304|C4 (kinds: artgen map symbols)");
    const m = updateMap(p, need("<id>"), (m2) => {
      const [x, y] = map_exports.parsePoint(m2, at3);
      if (sub === "label") {
        const kind = flag(args, "--kind") ?? "place";
        if (!map_exports.LABEL_KINDS.includes(kind)) throw new Error(`--kind: ${map_exports.LABEL_KINDS.join(", ")}`);
        m2.overlay.labels.push({ text: what, x, y, kind, ...num2(args, "--size") !== void 0 && { size: num2(args, "--size") }, ...num2(args, "--angle") !== void 0 && { angle: num2(args, "--angle") }, ...originFlag(args) });
      } else {
        if (!map_exports.SYMBOLS[what]) throw new Error(`unknown symbol ${what} (have: ${map_exports.SYMBOL_KINDS.join(", ")})`);
        m2.overlay.symbols.push({ kind: what, x, y, ...num2(args, "--scale") !== void 0 && { scale: num2(args, "--scale") }, ...num2(args, "--angle") !== void 0 && { angle: num2(args, "--angle") }, ...originFlag(args) });
      }
    });
    const n = sub === "label" ? m.overlay.labels.length : m.overlay.symbols.length;
    print(`${m.id}: ${sub} ${n - 1} "${what}"
${next(m.id)}`, sub === "label" ? m.overlay.labels : m.overlay.symbols);
    return 0;
  }
  if (sub === "overlay") {
    const [, action, which, index] = pos;
    const m = updateMap(p, need("<id> rm|clear"), (m2) => {
      if (action === "rm") {
        const list3 = which === "label" ? m2.overlay.labels : which === "symbol" ? m2.overlay.symbols : null, i = Number(index);
        if (!list3 || !Number.isInteger(i) || i < 0 || i >= list3.length) throw new Error(`map overlay <id> rm label|symbol <index> (labels 0..${m2.overlay.labels.length - 1}, symbols 0..${m2.overlay.symbols.length - 1})`);
        list3.splice(i, 1);
      } else if (action === "clear") {
        if (!which || which === "labels") m2.overlay.labels = [];
        if (!which || which === "symbols") m2.overlay.symbols = [];
      } else throw new Error("map overlay <id> rm label|symbol <index> | clear [labels|symbols]");
    });
    print(`${m.id}: ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols`, m.overlay);
    return 0;
  }
  if (sub === "set") {
    const m = updateMap(p, need("<id>"), (m2) => {
      const t = flag(args, "--title");
      if (t !== void 0) {
        if (t) m2.title = t;
        else delete m2.title;
      }
      for (const [f, k] of [["--legend", "legend"], ["--scale-bar", "scaleBar"], ["--compass", "compass"]]) {
        const v = onOff(flag(args, f));
        if (v !== void 0) m2[k] = v;
      }
      if (num2(args, "--per-cell") !== void 0) m2.scale.perCell = num2(args, "--per-cell");
      if (flag(args, "--unit")) m2.scale.unit = flag(args, "--unit");
    });
    print(`${describeMap(m)}
${next(m.id)}`, m);
    return 0;
  }
  if (sub === "facts") {
    const m = readMap(p, need("<id>")), r = map_exports.mapFacts(m, factsQuery(m, args, flag));
    print(describeMapFacts(r), r);
    return 0;
  }
  if (sub === "check") {
    const r = checkMapFile(p, need("<id>"));
    print(r.errors.length ? [`${r.file}: ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}`, ...r.errors.map((e) => `  ${e.path || "(file)"}: ${e.message}`)].join("\n") : [`${r.file}: ${r.requirements.length ? r.ok ? `all ${r.requirements.length} requirements met` : `${r.unmet.length} of ${r.requirements.length} requirements unmet` : "ok, no requirements"}`, ...r.requirements.map((q) => `  ${q.text}`)].join("\n"), r);
    return r.ok ? 0 : 1;
  }
  if (sub === "render") {
    const theme = flag(args, "--theme") ?? "both", format = flag(args, "--format") ?? "both";
    if (!["color", "bw", "both"].includes(theme)) throw new Error("--theme: color, bw or both");
    if (!["svg", "png", "both"].includes(format)) throw new Error("--format: svg, png or both");
    const r = await renderMapFiles(p, need("<id>"), {
      themes: theme === "both" ? ["color", "bw"] : [theme],
      formats: format === "both" ? ["svg", "png"] : [format],
      ppu: num2(args, "--ppu"),
      pageScale: pageScaleFlag(args),
      ...viewFlags(args, readMap(p, need("<id>")).grid.size),
      layers: parseLayers(flag(args, "--layers")),
      out: flag(args, "--out")
    });
    print([`${file ?? id} ${r.size.join("\xD7")} px, ${r.ppu} px a unit, window ${r.crop.join(",")}: ${r.terrains.join(", ")}${r.rivers ? `, ${r.rivers} rivers` : ""}`, ...r.unplaced.map((u) => `  no free spot for label ${u.index} "${u.text}"`), ...r.files.map((f) => `  ${f}`)].join("\n"), r);
    return 0;
  }
  if (sub === "sync") {
    const origin = flag(args, "--origin"), from = flag(args, "--from");
    if (!origin || !from) throw new Error("map sync <id>|--file target.json --from new.json --origin tables");
    let report;
    updateMap(p, need("<id>"), (m) => {
      const r = map_exports.syncMap(m, map_exports.parseMap(readJson(from)), origin);
      report = r.report;
      Object.assign(m, r.spec);
      if (!r.spec.require) delete m.require;
    });
    print(syncText(String(file ?? id), report), report);
    return 0;
  }
  throw new Error("map: new | gen | edit | grid | label | symbol | symbols | overlay | set | render | show | facts | check | sync | list (artgen --help)");
}
function sizeFlag(args, name) {
  const v = flag(args, name);
  if (v === void 0) return void 0;
  const m = v.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (!m) throw new Error(`${name}: WIDTHxHEIGHT in cells, e.g. 8x6`);
  return [+m[1], +m[2]];
}
function roomNumber(args) {
  const v = flag(args, "--number");
  if (v === void 0) return void 0;
  if (onOff(v) === false && !/^\d/.test(v)) return false;
  if (!Number.isFinite(+v)) throw new Error("--number: a number or off");
  return +v;
}
function fillFlag(args) {
  const v = flag(args, "--fill");
  if (v === void 0) return void 0;
  if (!dungeon_exports.ROOM_FILLS.includes(v)) throw new Error(`--fill: ${dungeon_exports.ROOM_FILLS.join(", ")}`);
  return v;
}
function handEdit(r, fields2) {
  if (r.origin) r.hand = [.../* @__PURE__ */ new Set([...r.hand ?? [], ...fields2])];
}
async function dungeonCommand(sub, args, emit) {
  const print = (human, data) => emit(human, withVersion(data, dungeon_exports.DUNGEON_FORMAT));
  const file = flag(args, "--file"), p = file || sub === "symbols" ? null : requireProject(flag(args, "--root"));
  const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--json")).slice(1);
  if (file && sub !== "new") pos.unshift("");
  const id = pos[0];
  const need = (what) => {
    if (file) return { file };
    if (!id) throw new Error(`dungeon ${sub}: ${what}`);
    return id;
  };
  const next = (i) => file ? `next: artgen dungeon render --file ${file}` : `next: artgen dungeon render ${i ?? id}`;
  if (sub === "list") {
    const ds = file ? [dungeonSummary(readDungeon(null, { file }))] : listDungeons(p);
    print(ds.length ? ds.map((d) => `${d.id.padEnd(16)} ${d.size.padEnd(7)} ${d.rooms} rooms, ${d.corridors} corridors, ${d.labels} labels, ${d.symbols} symbols${d.title ? `  "${d.title}"` : ""}`).join("\n") : "no dungeons yet: artgen dungeon new <id>", ds);
    return 0;
  }
  if (sub === "symbols") {
    print(Object.entries(dungeon_exports.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join("\n"), dungeon_exports.SYMBOL_KINDS);
    return 0;
  }
  if (sub === "show") {
    const m = readDungeon(p, need("<id>"));
    print(describeDungeon(m), m);
    return 0;
  }
  const genFlags = (m) => {
    if (num2(args, "--seed") !== void 0) m.seed = num2(args, "--seed");
    const sz = sizeFlag(args, "--size");
    if (sz) [m.cols, m.rows] = sz;
    for (const [f, k] of [["--rooms", "rooms"], ["--min-size", "minSize"], ["--max-size", "maxSize"], ["--caves", "caves"], ["--round", "round"], ["--loops", "loops"], ["--doors", "doors"], ["--corridor-width", "corridorWidth"], ["--spacing", "spacing"]]) {
      const v = num2(args, f);
      if (v !== void 0) m.gen[k] = v;
    }
    if (onOff(flag(args, "--entrance")) !== void 0) m.gen.entrance = onOff(flag(args, "--entrance"));
    const layout = flag(args, "--layout");
    if (layout !== void 0) {
      if (!dungeon_exports.GEN_LAYOUTS.includes(layout)) throw new Error(`--layout: ${dungeon_exports.GEN_LAYOUTS.join(", ")}`);
      if (layout === "scatter") delete m.gen.layout;
      else m.gen.layout = layout;
    }
    if (num2(args, "--density") !== void 0) m.gen.density = num2(args, "--density");
  };
  if (sub === "new") {
    const base = dungeon_exports.newDungeon(file ? id ?? fileId(file) : need("<id> is required"), { seed: Math.floor(Math.random() * 1e6), ...flag(args, "--title") && { title: flag(args, "--title") } });
    genFlags(base);
    let m = dungeon_exports.parseDungeon(base);
    const shape = flag(args, "--room");
    if (shape) {
      if (!dungeon_exports.ROOM_SHAPES.includes(shape) || shape === "poly") throw new Error("--room: rect, circle, octagon or cave");
      const [w, h] = sizeFlag(args, "--room-size") ?? [8, 8];
      const exits = (list2(args, "--exits") ?? []).map((e) => {
        const [side, kind, ...note] = e.split(":");
        if (!["n", "e", "s", "w"].includes(side)) throw new Error("--exits: sides n, e, s, w, each optionally :door kind and :a note (n,e:secret,s:none:To the caves)");
        return { side, door: kind === void 0 || kind === "" ? void 0 : doorPair(kind)[0], ...note.length && { text: note.join(":") } };
      });
      m = dungeon_exports.singleRoom(m, { shape, w, h, exits, label: flag(args, "--label"), number: roomNumber(args) });
    } else if (!args.includes("--empty")) m = dungeon_exports.generateDungeon(m);
    const r = createDungeon(p, m, args.includes("--force"), file ? { file } : void 0);
    print(`${r.file}
${describeDungeon(r.dungeon)}
${next(r.dungeon.id)}`, r);
    return 0;
  }
  if (sub === "gen") {
    const m = updateDungeon(p, need("<id>"), (m2) => {
      genFlags(m2);
      return dungeon_exports.generateDungeon(dungeon_exports.parseDungeon(m2));
    });
    print(`${describeDungeon(m)}
${next(m.id)}`, m);
    return 0;
  }
  if (sub === "room") {
    const op = pos[1], rid = pos[2];
    let summary = "";
    const m = updateDungeon(p, need("<id> add|move|set|rm"), (m2) => {
      const find = () => {
        const r = m2.rooms.find((r4) => r4.id === rid);
        if (!r) throw new Error(`no room ${rid} (have: ${m2.rooms.map((r4) => r4.id).join(", ") || "none"})`);
        return r;
      };
      if (op === "add") {
        const shape = rid;
        if (!dungeon_exports.ROOM_SHAPES.includes(shape)) throw new Error(`dungeon room <id> add <shape>: one of ${dungeon_exports.ROOM_SHAPES.join(", ")}`);
        const roomId = flag(args, "--room-id") ?? dungeon_exports.nextRoomId(m2), n = roomNumber(args), label = flag(args, "--label");
        let room;
        if (shape === "poly") {
          const points = numbers(flag(args, "--points"), "--points");
          room = { id: roomId, shape, points, ...dungeon_exports.polyBox(points) };
        } else {
          const at3 = flag(args, "--at"), sz = sizeFlag(args, "--size");
          if (!at3 || !sz) throw new Error("dungeon room <id> add <shape> --at x,y|C4 --size WxH");
          const [x, y] = cornerPoint(at3);
          room = { id: roomId, shape, x, y, w: sz[0], h: sz[1] };
        }
        if (label) room.label = label;
        if (n !== void 0) room.number = n;
        const fill = fillFlag(args);
        if (fill) room.fill = fill;
        if (flag(args, "--href")) room.href = flag(args, "--href");
        Object.assign(room, originFlag(args));
        m2.rooms.push(room);
        summary = `added ${shape} room ${roomId}`;
      } else if (op === "move") {
        const r = find(), at3 = flag(args, "--at");
        if (!at3) throw new Error("dungeon room <id> move <rid> --at x,y|C4");
        const [x, y] = cornerPoint(at3), dx = x - r.x, dy = y - r.y;
        r.x = x;
        r.y = y;
        handEdit(r, ["x", "y"]);
        if (r.points) r.points = r.points.map((v, i) => v + (i % 2 ? dy : dx));
        summary = `moved ${r.id} to ${x},${y}`;
      } else if (op === "set") {
        const r = find(), shape = flag(args, "--shape"), sz = sizeFlag(args, "--size"), label = flag(args, "--label"), n = roomNumber(args);
        if (shape) {
          if (!dungeon_exports.ROOM_SHAPES.includes(shape) || shape === "poly") throw new Error("--shape: rect, circle, octagon or cave");
          r.shape = shape;
          delete r.points;
        }
        if (sz) {
          [r.w, r.h] = sz;
          handEdit(r, ["w", "h"]);
        }
        if (shape) handEdit(r, ["shape"]);
        if (label !== void 0) {
          if (label) r.label = label;
          else delete r.label;
          handEdit(r, ["label"]);
        }
        if (n !== void 0) r.number = n;
        const fill = fillFlag(args);
        if (fill) {
          if (fill === "floor") delete r.fill;
          else r.fill = fill;
          handEdit(r, ["fill"]);
        }
        const href = flag(args, "--href");
        if (href !== void 0) {
          if (href && href !== "none") r.href = href;
          else delete r.href;
        }
        summary = `changed ${r.id}`;
      } else if (op === "rm") {
        const r = find(), n = dungeon_exports.removeRoom(m2, r.id);
        summary = `removed ${r.id} and ${n} corridors`;
      } else throw new Error("dungeon room <id> add|move|set|rm");
    });
    print([`${m.id}: ${summary} (${m.rooms.length} rooms)`, ...warningLines(m), next(m.id)].join("\n"), m.rooms);
    return 0;
  }
  if (sub === "link") {
    const [, a, b] = pos;
    if (!a || !b) throw new Error("dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id>");
    let [ea, eb] = [a, b];
    const m = updateDungeon(p, need("<id>"), (m2) => {
      const isBlock = (v) => !!m2.blocks?.some((x) => x.id === v) && !m2.rooms.some((r) => r.id === v);
      const centre = (v) => {
        const r = m2.rooms.find((x) => x.id === v);
        return r ? [r.x + r.w / 2, r.y + r.h / 2] : (() => {
          try {
            return dungeon_exports.parsePoint(v);
          } catch {
            return [m2.cols / 2, m2.rows / 2];
          }
        })();
      };
      if (isBlock(ea)) ea = dungeon_exports.blockRoomNear(m2, ea, ...isBlock(eb) ? [m2.cols / 2, m2.rows / 2] : centre(eb)) ?? ea;
      if (isBlock(eb)) eb = dungeon_exports.blockRoomNear(m2, eb, ...centre(ea)) ?? eb;
      const route3 = flag(args, "--route"), doors = doorPair(flag(args, "--doors"));
      if (route3 && !dungeon_exports.ROUTES.includes(route3)) throw new Error(`--route: ${dungeon_exports.ROUTES.join(", ")}`);
      const curve = flag(args, "--curve"), style = flag(args, "--style"), cid = flag(args, "--id");
      const note = flag(args, "--exit"), exit = note !== void 0 ? { text: note, ...flag(args, "--exit-href") && { href: flag(args, "--exit-href") }, ...num2(args, "--fade") !== void 0 && { fade: num2(args, "--fade") } } : void 0;
      const withExit = (e) => exit && "at" in e ? { ...e, exit } : e;
      if (curve && !dungeon_exports.CURVES.includes(curve)) throw new Error(`--curve: ${dungeon_exports.CURVES.join(", ")}`);
      if (style && !dungeon_exports.CORRIDOR_STYLES.includes(style)) throw new Error(`--style: ${dungeon_exports.CORRIDOR_STYLES.join(", ")}`);
      if (exit && !("at" in corridorEnd(m2, eb))) throw new Error("--exit: the second end must be a point (x,y or a cell name), where the corridor leaves the map");
      m2.corridors.push({
        ...cid && { id: cid },
        from: corridorEnd(m2, ea, flag(args, "--from-side"), num2(args, "--from-offset")),
        to: withExit(corridorEnd(m2, eb, flag(args, "--to-side"), num2(args, "--to-offset"))),
        ...num2(args, "--width") !== void 0 && { width: num2(args, "--width") },
        ...route3 && { route: route3 },
        ...flag(args, "--via") && { via: numbers(flag(args, "--via"), "--via") },
        ...doors && { doors },
        ...curve && curve !== "none" && { curve },
        ...style && style !== "built" && { style },
        ...num2(args, "--seed") !== void 0 && { seed: num2(args, "--seed") },
        ...originFlag(args)
      });
    });
    print([`${m.id}: corridor ${m.corridors.length - 1}: ${ea} \u2192 ${eb}`, ...warningLines(m), next(m.id)].join("\n"), m.corridors);
    return 0;
  }
  if (sub === "block") {
    const op = pos[1], bid = pos[2];
    let note = "";
    const m = updateDungeon(p, need("<id> add|split|rm"), (m2) => {
      const splitFlags = (base) => {
        const mode = flag(args, "--split") ?? base?.mode ?? "bsp";
        if (!dungeon_exports.SPLIT_MODES.includes(mode)) throw new Error(`--split: ${dungeon_exports.SPLIT_MODES.join(", ")}`);
        const cx = flag(args, "--cuts-x"), cy = flag(args, "--cuts-y"), cuts = cx || cy ? { ...cx && { x: numbers(cx, "--cuts-x", false) }, ...cy && { y: numbers(cy, "--cuts-y", false) } } : base?.cuts;
        const min = num2(args, "--min") ?? base?.min, seed = num2(args, "--seed") ?? (op === "split" && !flag(args, "--split") && num2(args, "--min") === void 0 ? Math.floor(Math.random() * 1e6) : base?.seed);
        return { mode, ...min !== void 0 && { min }, ...cuts && { cuts }, ...seed !== void 0 && { seed } };
      };
      let id2;
      if (op === "add") {
        const shape = bid, at3 = flag(args, "--at"), sz = sizeFlag(args, "--size");
        if (!["rect", "octagon", "circle", "hex", "poly"].includes(shape)) throw new Error("dungeon block <id> add rect|octagon|circle|hex|poly");
        id2 = flag(args, "--block-id") ?? (() => {
          const used = new Set((m2.blocks ?? []).map((b2) => b2.id));
          for (let n = 1; ; n++) if (!used.has(`b${n}`)) return `b${n}`;
        })();
        let b;
        if (shape === "poly") {
          const points = numbers(flag(args, "--points"), "--points");
          b = { id: id2, shape: "poly", points, ...dungeon_exports.polyBox(points), split: splitFlags() };
        } else {
          if (!at3 || !sz) throw new Error("dungeon block <id> add <shape> --at x,y|C4 --size WxH");
          const [x, y] = cornerPoint(at3);
          b = shape === "hex" ? { id: id2, shape: "poly", points: dungeon_exports.hexPoints(x, y, sz[0], sz[1]), x, y, w: sz[0], h: sz[1], split: splitFlags() } : { id: id2, shape, x, y, w: sz[0], h: sz[1], split: splitFlags() };
        }
        if (num2(args, "--doors") !== void 0) b.doors = num2(args, "--doors");
        (m2.blocks ??= []).push(b);
      } else if (op === "split") {
        const b = m2.blocks?.find((x) => x.id === bid);
        if (!b) throw new Error(`no block ${bid} (have: ${(m2.blocks ?? []).map((x) => x.id).join(", ") || "none"})`);
        b.split = splitFlags(b.split);
        if (num2(args, "--doors") !== void 0) b.doors = num2(args, "--doors");
        id2 = b.id;
      } else if (op === "rm") {
        if (!m2.blocks?.some((x) => x.id === bid)) throw new Error(`no block ${bid}`);
        dungeon_exports.removeBlock(m2, bid);
        note = `removed block ${bid} and its rooms`;
        return;
      } else throw new Error("dungeon block <id> add|split|rm");
      const r = dungeon_exports.applyBlock(dungeon_exports.parseDungeon(m2), id2);
      const made = r.spec.rooms.filter((x) => x.origin === `block:${id2}`).length;
      note = [`block ${id2}: ${made} rooms, ${(r.spec.connections ?? []).filter((c) => c.origin === `block:${id2}`).length} connections`, ...r.dropped.map((d) => `  dropped ${d}`)].join("\n");
      return r.spec;
    });
    print([`${m.id}: ${note}`, ...warningLines(m), next(m.id)].join("\n"), m.blocks ?? []);
    return 0;
  }
  if (sub === "connect") {
    const [, a, b] = pos;
    if (!a || !b) throw new Error("dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1]");
    const m = updateDungeon(p, need("<id>"), (m2) => {
      const kind = flag(args, "--kind") ?? "door", at3 = flag(args, "--at"), width = num2(args, "--width");
      if (kind !== "open" && !dungeon_exports.DOOR_KINDS.includes(kind)) throw new Error(`--kind: open or one of ${dungeon_exports.DOOR_KINDS.join(", ")}`);
      (m2.connections ??= []).push({ a, b, ...at3 && { at: dungeon_exports.parsePoint(at3) }, ...kind !== "door" && { kind }, ...width !== void 0 && { width }, ...originFlag(args) });
    });
    print([`${m.id}: connection ${m.connections.length - 1}: ${a} \u2194 ${b}`, ...warningLines(m), next(m.id)].join("\n"), m.connections);
    return 0;
  }
  if (sub === "disconnect") {
    const i = Number(pos[1]);
    const m = updateDungeon(p, need("<id> <index>"), (m2) => {
      if (!Number.isInteger(i) || i < 0 || i >= (m2.connections?.length ?? 0)) throw new Error(`dungeon disconnect <id> <index> (connections 0..${(m2.connections?.length ?? 0) - 1}; artgen dungeon show)`);
      m2.connections.splice(i, 1);
      if (!m2.connections.length) delete m2.connections;
    });
    print(`${m.id}: ${m.connections?.length ?? 0} connections
${next(m.id)}`, m.connections ?? []);
    return 0;
  }
  if (sub === "unlink" || sub === "door") {
    const i = Number(pos[1]);
    const m = updateDungeon(p, need(`<id> <index>`), (m2) => {
      if (!Number.isInteger(i) || i < 0 || i >= m2.corridors.length) throw new Error(`dungeon ${sub} <id> <index> (corridors 0..${m2.corridors.length - 1}; artgen dungeon show)`);
      if (sub === "unlink") {
        dungeon_exports.removeCorridor(m2, i);
        return;
      }
      const end = pos[2], kind = doorPair(pos[3] ?? "none")[0];
      if (end !== "from" && end !== "to") throw new Error("dungeon door <id> <index> from|to <kind|none>");
      const c = m2.corridors[i], d = c.doors ?? [null, null];
      c.doors = end === "from" ? [kind, d[1]] : [d[0], kind];
    });
    print([`${m.id}: ${m.corridors.length} corridors`, ...warningLines(m), next(m.id)].join("\n"), m.corridors);
    return 0;
  }
  if (sub === "grid") {
    const mode = pos[1], size = num2(args, "--size"), sub2 = onOff(flag(args, "--sub")), show = onOff(flag(args, "--show")), unit = flag(args, "--unit");
    if (!mode && size === void 0 && sub2 === void 0 && show === void 0 && !unit && !flag(args, "--clip"))
      throw new Error("dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all]");
    const m = updateDungeon(p, need("<id>"), (m2) => {
      if (unit) m2.scale.unit = unit;
      if (mode) m2.grid = gridMode(m2, mode);
      m2.grid = dungeon_exports.gridFromUnits(m2, { size, sub: sub2, show });
      const clip = flag(args, "--clip");
      if (clip) {
        if (clip !== "floor" && clip !== "all") throw new Error("--clip: floor or all");
        m2.grid.clip = clip;
      }
    });
    print(`${describeDungeon(m).split("\n")[2].trim()}
${next(m.id)}`, m.grid);
    return 0;
  }
  if (sub === "style") {
    const m = updateDungeon(p, need("<id>"), (m2) => {
      const hatch = flag(args, "--hatch");
      if (hatch) {
        if (!dungeon_exports.HATCH_STYLES.includes(hatch)) throw new Error(`--hatch: ${dungeon_exports.HATCH_STYLES.join(", ")}`);
        m2.style.hatch = hatch;
      }
      if (num2(args, "--band") !== void 0) m2.style.band = num2(args, "--band");
      if (num2(args, "--wall") !== void 0) m2.style.wall = num2(args, "--wall");
      const shared = flag(args, "--shared-walls");
      if (shared === "auto") delete m2.style.sharedWalls;
      else if (onOff(shared) !== void 0) m2.style.sharedWalls = onOff(shared);
      const t = flag(args, "--title");
      if (t !== void 0) {
        if (t) m2.title = t;
        else delete m2.title;
      }
      for (const [f, k] of [["--numbers", "numbers"], ["--scale-bar", "scaleBar"], ["--compass", "compass"], ["--legend", "legend"]]) {
        const v = onOff(flag(args, f));
        if (v !== void 0) m2[k] = v;
      }
      if (num2(args, "--per-cell") !== void 0) m2.scale.perCell = num2(args, "--per-cell");
      if (flag(args, "--unit")) m2.scale.unit = flag(args, "--unit");
      const place2 = flag(args, "--furniture"), side = flag(args, "--furniture-side");
      if (place2 !== void 0 || side !== void 0) {
        if (place2 !== void 0 && !dungeon_exports.FURNITURE_PLACES.includes(place2)) throw new Error(`--furniture: ${dungeon_exports.FURNITURE_PLACES.join(", ")}`);
        if (side !== void 0 && !dungeon_exports.FURNITURE_SIDES.includes(side)) throw new Error(`--furniture-side: ${dungeon_exports.FURNITURE_SIDES.join(", ")}`);
        const f = { place: place2 ?? m2.furniture?.place ?? "outside", ...(side ?? m2.furniture?.side) && { side: side ?? m2.furniture?.side } };
        if (f.place === "over" && !f.side) delete m2.furniture;
        else m2.furniture = f;
      }
    });
    print(`${describeDungeon(m)}
${next(m.id)}`, m);
    return 0;
  }
  if (sub === "label" || sub === "symbol") {
    const what = pos[1], at3 = flag(args, "--at");
    if (!what || !at3) throw new Error(sub === "label" ? 'dungeon label <id> "Text" --at x,y|C4' : "dungeon symbol <id> <kind> --at x,y|C4 (kinds: artgen dungeon symbols)");
    const m = updateDungeon(p, need("<id>"), (m2) => {
      const [x, y] = dungeon_exports.parsePoint(at3), angle = num2(args, "--angle");
      if (sub === "label") {
        const kind = flag(args, "--kind") ?? "name";
        if (!dungeon_exports.LABEL_KINDS.includes(kind)) throw new Error(`--kind: ${dungeon_exports.LABEL_KINDS.join(", ")}`);
        m2.overlay.labels.push({ text: what, x, y, kind, ...num2(args, "--size") !== void 0 && { size: num2(args, "--size") }, ...angle !== void 0 && { angle }, ...flag(args, "--href") && { href: flag(args, "--href") }, ...originFlag(args) });
      } else {
        if (!dungeon_exports.SYMBOLS[what]) throw new Error(`unknown symbol ${what} (have: ${dungeon_exports.SYMBOL_KINDS.join(", ")})`);
        m2.overlay.symbols.push({ kind: what, x, y, ...num2(args, "--scale") !== void 0 && { scale: num2(args, "--scale") }, ...angle !== void 0 && { angle }, ...originFlag(args) });
      }
    });
    const n = sub === "label" ? m.overlay.labels.length : m.overlay.symbols.length;
    print([`${m.id}: ${sub} ${n - 1} "${what}"`, ...warningLines(m), next(m.id)].join("\n"), sub === "label" ? m.overlay.labels : m.overlay.symbols);
    return 0;
  }
  if (sub === "overlay") {
    const [, action, which, index] = pos;
    const m = updateDungeon(p, need("<id> rm|clear"), (m2) => {
      if (action === "rm") {
        const items = which === "label" ? m2.overlay.labels : which === "symbol" ? m2.overlay.symbols : null, i = Number(index);
        if (!items || !Number.isInteger(i) || i < 0 || i >= items.length) throw new Error(`dungeon overlay <id> rm label|symbol <index> (labels 0..${m2.overlay.labels.length - 1}, symbols 0..${m2.overlay.symbols.length - 1})`);
        items.splice(i, 1);
      } else if (action === "clear") {
        if (!which || which === "labels") m2.overlay.labels = [];
        if (!which || which === "symbols") m2.overlay.symbols = [];
      } else throw new Error("dungeon overlay <id> rm label|symbol <index> | clear [labels|symbols]");
    });
    print(`${m.id}: ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols`, m.overlay);
    return 0;
  }
  if (sub === "check") {
    const r = checkDungeonFile(p, need("<id>"));
    const n = (k, w) => `${k} ${w}${k === 1 ? "" : "s"}`;
    print([
      r.ok ? `${r.file}: ok${r.warnings.length ? `, ${n(r.warnings.length, "warning")}` : ""}` : `${r.file}: ${n(r.errors.length, "error")}${r.warnings.length ? `, ${n(r.warnings.length, "warning")}` : ""}`,
      ...r.errors.map((e) => `  error: ${e.path || "(file)"}: ${e.message}`),
      ...r.warnings.map((e) => `  warning: ${e.path || "(file)"}: ${e.message}`)
    ].join("\n"), r);
    return r.ok ? 0 : 1;
  }
  if (sub === "fit") {
    const m = updateDungeon(p, need("<id>"), (m2) => dungeon_exports.fitDungeon(m2, num2(args, "--margin") ?? 2));
    print(`${m.id}: ${m.cols}\xD7${m.rows} cells
${next(m.id)}`, { cols: m.cols, rows: m.rows });
    return 0;
  }
  if (sub === "facts") {
    const r = dungeon_exports.dungeonFacts(readDungeon(p, need("<id>")));
    print(describeDungeonFacts(r), r);
    return 0;
  }
  if (sub === "render") {
    const format = flag(args, "--format") ?? "both";
    if (!["svg", "png", "both"].includes(format)) throw new Error("--format: svg, png or both");
    const r = await renderDungeonFiles(p, need("<id>"), {
      formats: format === "both" ? ["svg", "png"] : [format],
      ppu: num2(args, "--ppu"),
      pageScale: pageScaleFlag(args),
      ...viewFlags(args, 1),
      rooms: args.flatMap((a, i) => a === "--room" ? [args[i + 1] ?? (() => {
        throw new Error("--room: a room id");
      })()] : []),
      margin: num2(args, "--margin"),
      layers: parseLayers(flag(args, "--layers"), dungeon_exports.DUNGEON_LAYERS),
      out: flag(args, "--out")
    });
    print([`${file ?? id} ${r.size.join("\xD7")} px, ${r.ppu} px a cell, window ${r.crop.join(",")}: ${r.rooms} rooms, ${r.corridors} corridors, ${r.doors} doors`, ...r.unplaced.map((u) => `  no free spot for label ${u.index} "${u.text}"`), ...r.files.map((f) => `  ${f}`)].join("\n"), r);
    return 0;
  }
  if (sub === "sync") {
    const origin = flag(args, "--origin"), from = flag(args, "--from");
    if (!origin || !from) throw new Error("dungeon sync <id>|--file target.json --from new.json --origin tables");
    let report;
    updateDungeon(p, need("<id>"), (m) => {
      const r = dungeon_exports.syncDungeon(m, dungeon_exports.parseDungeon(readJson(from)), origin);
      report = r.report;
      return r.spec;
    });
    print(syncText(String(file ?? id), report), report);
    return 0;
  }
  throw new Error("dungeon: new | gen | room | block | link | unlink | door | connect | disconnect | grid | style | label | symbol | symbols | overlay | check | fit | render | show | facts | sync | list (artgen --help)");
}
function pointFlag(args, name, required = true) {
  const v = flag(args, name);
  if (v === void 0) {
    if (required) throw new Error(`${name} x,y is required`);
    return void 0;
  }
  return dungeon_exports.parsePoint(v);
}
function buildingFields(args) {
  const o = {};
  for (const k of ["shape", "roof", "label", "href", "kind"]) {
    const v = flag(args, `--${k}`);
    if (v !== void 0) o[k] = v;
  }
  for (const k of ["angle", "stories"]) {
    const v = num2(args, `--${k}`);
    if (v !== void 0) o[k] = v;
  }
  const nb = roomNumber(args);
  if (nb !== void 0) o.number = nb;
  const pts2 = flag(args, "--points"), wing = flag(args, "--wing"), at3 = pointFlag(args, "--at", false), size = sizeFlag(args, "--size");
  if (pts2 !== void 0) o.points = numbers(pts2, "--points");
  if (wing !== void 0) o.wing = numbers(wing, "--wing");
  if (at3) [o.x, o.y] = at3;
  if (size) [o.w, o.h] = size;
  return o;
}
async function settlementCommand(sub, args, emit) {
  const print = (human, data) => emit(human, withVersion(data, settlement_exports.SETTLEMENT_FORMAT));
  const file = flag(args, "--file"), p = file || sub === "symbols" || sub === "fixtures" ? null : requireProject(flag(args, "--root"));
  const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--json", "--closed", "--drawbridge", "--empty", "--interiors", "--plans", "--force"].includes(args[i - 1]))).slice(1);
  if (file && sub !== "new") pos.unshift("");
  const id = pos[0];
  const ref = (what) => {
    if (file) return { file };
    if (!id) throw new Error(`settlement ${sub}: ${what}`);
    return id;
  };
  const next = (i) => file ? `next: artgen settlement render --file ${file}` : `next: artgen settlement render ${i ?? id}`;
  const level = num2(args, "--level") ?? 0;
  const edit = (...ops) => {
    const lines = [];
    const m = updateSettlement(p, ref("<id>"), (m2) => {
      for (const o of ops) lines.push(settlement_exports.editSettlement(m2, o));
    });
    print([...lines, ...settlementWarningLines(m), next(m.id)].join("\n"), { done: lines, settlement: settlementSummary(m) });
    return 0;
  };
  if (sub === "list") {
    const ss = file ? [settlementSummary(readSettlement(null, { file }))] : listSettlements(p);
    print(ss.length ? ss.map((s) => `${s.id.padEnd(16)} ${s.kind.padEnd(8)} ${s.size.padEnd(8)} ${s.buildings} buildings (${s.interiors} with floors), ${s.roads} roads, ${s.walls} walls${s.title ? `  "${s.title}"` : ""}`).join("\n") : "no settlements yet: artgen settlement new <id>", ss);
    return 0;
  }
  if (sub === "symbols") {
    print(Object.entries(settlement_exports.SYMBOLS).map(([k, v]) => `${k.padEnd(12)} ${v.name}`).join("\n"), settlement_exports.SYMBOL_KINDS);
    return 0;
  }
  if (sub === "fixtures") {
    print(Object.entries(settlement_exports.FIXTURES).map(([k, v]) => `${k.padEnd(14)} ${v.group.padEnd(10)} ${String(v.ft[0]).padStart(3)}\xD7${String(v.ft[1]).padEnd(4)} ft  ${v.name}`).join("\n"), Object.entries(settlement_exports.FIXTURES).map(([kind, v]) => ({ kind, name: v.name, group: v.group, ft: v.ft })));
    return 0;
  }
  if (sub === "show") {
    const m = readSettlement(p, ref("<id>"));
    print(describeSettlement(m), m);
    return 0;
  }
  const genFlags = (m) => {
    if (num2(args, "--seed") !== void 0) m.seed = num2(args, "--seed");
    const sz = sizeFlag(args, "--size");
    if (sz) [m.cols, m.rows] = sz;
    const kind = flag(args, "--kind");
    if (kind !== void 0) {
      if (!settlement_exports.SETTLEMENT_KINDS.includes(kind)) throw new Error(`--kind: ${settlement_exports.SETTLEMENT_KINDS.join(", ")}`);
      m.kind = kind;
    }
    for (const k of ["buildings", "density", "trees", "fields"]) {
      const v = num2(args, `--${k}`);
      if (v !== void 0) m.gen[k] = v;
    }
    for (const k of ["streets", "wall", "water"]) {
      const v = flag(args, `--${k}`);
      if (v !== void 0) m.gen[k] = v;
    }
    for (const k of ["market", "castle", "interiors"]) {
      const v = onOff(flag(args, `--${k}`));
      if (v !== void 0) m.gen[k] = v;
    }
  };
  const generate = (m, at3) => {
    const u = readSettlementUnderlay(p, at3, m);
    return settlement_exports.generateSettlement(m, u ?? {});
  };
  if (sub === "new") {
    const sid = file ? id ?? fileId(file) : ref("<id> is required"), kind = flag(args, "--kind") ?? "village";
    if (!settlement_exports.SETTLEMENT_KINDS.includes(kind)) throw new Error(`--kind: ${settlement_exports.SETTLEMENT_KINDS.join(", ")}`);
    const base = settlement_exports.newSettlement(sid, kind, { seed: Math.floor(Math.random() * 1e6), ...flag(args, "--title") && { title: flag(args, "--title") } });
    genFlags(base);
    if (args.includes("--interiors")) base.gen.interiors = true;
    const at3 = file ? { file } : sid, mapRef = flag(args, "--map");
    if (mapRef) {
      const mp = mapForSettlement(p, at3, mapRef), mspec = map_exports.parseMap(readJson(mp.path)), origin = pointFlag(args, "--at") ?? [0, 0];
      const scale = Math.round(base.scale.perCell * settlement_exports.feetIn(base.scale.unit) / (mspec.scale.perCell * settlement_exports.feetIn(mspec.scale.unit)) * 1e4) / 1e4;
      base.underlay = { map: mp.rel, origin, scale };
    }
    const m = args.includes("--empty") ? settlement_exports.parseSettlement(base) : generate(settlement_exports.parseSettlement(base), at3);
    const r = createSettlement(p, m, args.includes("--force"), file ? { file } : void 0);
    print(`${r.file}
${describeSettlement(r.settlement)}
${next(r.settlement.id)}`, { file: r.file, settlement: r.settlement });
    return 0;
  }
  if (sub === "gen") {
    const m = updateSettlement(p, ref("<id>"), (m2) => {
      genFlags(m2);
      return generate(settlement_exports.parseSettlement(m2), file ? { file } : id);
    });
    print(`${describeSettlement(m)}
${next(m.id)}`, m);
    return 0;
  }
  if (sub === "building") {
    const act = pos[1], bid = pos[2];
    if (act === "add") {
      const kind = pos[2];
      if (!kind) throw new Error("settlement building <id> add <kind> --at x,y --size WxH");
      const o = buildingFields(args);
      return edit({ op: "building.add", ...o, kind, ...flag(args, "--building-id") && { id: flag(args, "--building-id") } });
    }
    if (act === "set") return edit({ op: "building.set", id: bid, ...buildingFields(args) });
    if (act === "move") {
      const at3 = pointFlag(args, "--at");
      return edit({ op: "building.move", id: bid, x: at3[0], y: at3[1] });
    }
    if (act === "rm") return edit({ op: "building.rm", id: bid });
    throw new Error("settlement building <id> add|set|move|rm \u2026");
  }
  if (sub === "interior") return pos[2] === "clear" ? edit({ op: "interior.clear", id: pos[1] }) : edit({ op: "interior", id: pos[1], ...num2(args, "--seed") !== void 0 && { seed: num2(args, "--seed") }, ...num2(args, "--stories") !== void 0 && { stories: num2(args, "--stories") } });
  if (sub === "floor") {
    const act = pos[2];
    if (act !== "add" && act !== "rm") throw new Error('settlement floor <id> <bid> add|rm --level n [--name "..."]');
    return edit({ op: `floor.${act}`, building: pos[1], level, ...flag(args, "--name") && { name: flag(args, "--name") } });
  }
  if (sub === "room") {
    const [, bid, act, x] = pos, size = sizeFlag(args, "--size"), at3 = pointFlag(args, "--at", false);
    if (act === "add") return edit({ op: "room.add", building: bid, level, shape: x ?? "rect", ...at3 && { x: at3[0], y: at3[1] }, ...size && { w: size[0], h: size[1] }, ...flag(args, "--points") && { points: numbers(flag(args, "--points"), "--points") }, ...flag(args, "--label") && { label: flag(args, "--label") }, ...flag(args, "--room-id") && { id: flag(args, "--room-id") } });
    if (act === "set") return edit({ op: "room.set", building: bid, level, id: x, ...at3 && { x: at3[0], y: at3[1] }, ...size && { w: size[0], h: size[1] }, ...flag(args, "--label") !== void 0 && { label: flag(args, "--label") } });
    if (act === "rm") return edit({ op: "room.rm", building: bid, level, id: x });
    throw new Error("settlement room <id> <bid> add|set|rm \u2026");
  }
  if (sub === "connect") return edit({ op: "connect", building: pos[1], level, a: pos[2], b: pos[3], ...flag(args, "--kind") && { kind: flag(args, "--kind") }, ...pointFlag(args, "--at", false) && { at: pointFlag(args, "--at") }, ...num2(args, "--width") !== void 0 && { width: num2(args, "--width") } });
  if (sub === "disconnect") return edit({ op: "disconnect", building: pos[1], level, index: Number(pos[2]) });
  if (sub === "door" || sub === "window") return edit({ op: sub, building: pos[1], level, at: pointFlag(args, "--at"), ...flag(args, "--kind") && { kind: flag(args, "--kind") }, ...num2(args, "--width") !== void 0 && { width: num2(args, "--width") } });
  if (sub === "fixture" || sub === "prop") {
    const prop = sub === "prop", act = prop ? pos[1] : pos[2], what = prop ? pos[2] : pos[3], size = sizeFlag(args, "--size");
    if (act === "add") {
      const at3 = pointFlag(args, "--at");
      return edit({ op: prop ? "prop.add" : "fixture.add", ...!prop && { building: pos[1], level }, kind: what, x: at3[0], y: at3[1], ...size && { w: size[0], h: size[1] }, ...num2(args, "--angle") !== void 0 && { angle: num2(args, "--angle") }, ...flag(args, "--label") && { label: flag(args, "--label") } });
    }
    if (act === "rm") return edit({ op: prop ? "prop.rm" : "fixture.rm", ...!prop && { building: pos[1], level }, index: Number(what) });
    throw new Error(prop ? "settlement prop <id> add <kind> --at x,y | rm <i>" : "settlement fixture <id> <bid> add <kind> --at x,y [--level n] | rm <i>");
  }
  if (sub === "road" || sub === "water" || sub === "wall" || sub === "area" || sub === "tree") {
    const act = pos[1], what = pos[2];
    if (act === "rm") return edit({ op: `${sub}.rm`, index: Number(what) });
    if (sub === "wall" && act === "gate") return edit({ op: "wall.gate", index: Number(what), at: pointFlag(args, "--at"), kind: flag(args, "--kind") ?? "gate", ...num2(args, "--width") !== void 0 && { width: num2(args, "--width") }, ...args.includes("--drawbridge") && { drawbridge: true } });
    if (sub === "tree" && act === "scatter") return edit({ op: "tree.scatter", kind: what ?? "tree", area: numbers(flag(args, "--area"), "--area"), count: num2(args, "--count") ?? 10, ...num2(args, "--seed") !== void 0 && { seed: num2(args, "--seed") } });
    if (act !== "add") throw new Error(`settlement ${sub} <id> add <kind> \u2026 | rm <i>`);
    if (sub === "tree") {
      const at3 = pointFlag(args, "--at");
      return edit({ op: "tree.add", kind: what ?? "tree", x: at3[0], y: at3[1], ...num2(args, "--size") !== void 0 && { size: num2(args, "--size") } });
    }
    const o = { op: `${sub}.add`, kind: what, points: numbers(flag(args, "--points"), "--points") };
    if (num2(args, "--width") !== void 0) o.width = num2(args, "--width");
    if (flag(args, "--curve")) o.curve = flag(args, "--curve");
    if (flag(args, "--label")) o.label = flag(args, "--label");
    if (sub === "wall") {
      if (args.includes("--closed")) o.closed = true;
      if (num2(args, "--thickness") !== void 0) o.thickness = num2(args, "--thickness");
      const tw = flag(args, "--towers");
      if (tw) o.towers = { shape: tw, ...num2(args, "--tower-size") !== void 0 && { size: num2(args, "--tower-size") }, ...num2(args, "--tower-every") !== void 0 && { every: num2(args, "--tower-every") } };
    }
    return edit(o);
  }
  if (sub === "label") {
    const at3 = pointFlag(args, "--at");
    return edit({ op: "label", text: pos[1], x: at3[0], y: at3[1], kind: flag(args, "--kind") ?? "name", ...num2(args, "--size") !== void 0 && { size: num2(args, "--size") }, ...num2(args, "--angle") !== void 0 && { angle: num2(args, "--angle") }, ...flag(args, "--href") && { href: flag(args, "--href") } });
  }
  if (sub === "symbol") {
    const at3 = pointFlag(args, "--at");
    return edit({ op: "symbol", kind: pos[1], x: at3[0], y: at3[1], ...num2(args, "--scale") !== void 0 && { scale: num2(args, "--scale") }, ...num2(args, "--angle") !== void 0 && { angle: num2(args, "--angle") } });
  }
  if (sub === "overlay") {
    if (pos[1] !== "rm" || !["label", "symbol"].includes(pos[2])) throw new Error("settlement overlay <id> rm label|symbol <i>");
    return edit({ op: `${pos[2]}.rm`, index: Number(pos[3]) });
  }
  if (sub === "grid") {
    const m = updateSettlement(p, ref("<id>"), (m2) => {
      const mode = pos[1];
      if (mode === "none" || mode === "off") m2.grid.show = false;
      else if (mode !== void 0) {
        const v = Number(mode);
        if (!(v > 0)) throw new Error("grid: a size in the sheet's unit (10), or none");
        m2.grid = { ...m2.grid, show: true, size: v / m2.scale.perCell };
      }
      const sub2 = onOff(flag(args, "--sub"));
      if (sub2 !== void 0) m2.grid.sub = sub2;
    });
    print(`grid ${m.grid.show ? `every ${m.grid.size * m.scale.perCell} ${m.scale.unit}${m.grid.sub ? ", sub-grid" : ""}` : "off"}
${next(m.id)}`, m.grid);
    return 0;
  }
  if (sub === "style") {
    const m = updateSettlement(p, ref("<id>"), (m2) => {
      const t = flag(args, "--title");
      if (t !== void 0) {
        if (t) m2.title = t;
        else delete m2.title;
      }
      const ground2 = flag(args, "--ground");
      if (ground2 !== void 0) m2.ground = ground2;
      for (const [f, k] of [["--numbers", "numbers"], ["--scale-bar", "scaleBar"], ["--compass", "compass"], ["--legend", "legend"]]) {
        const v = onOff(flag(args, f));
        if (v !== void 0) m2[k] = v;
      }
      if (num2(args, "--per-cell") !== void 0) m2.scale.perCell = num2(args, "--per-cell");
      if (flag(args, "--unit")) m2.scale.unit = flag(args, "--unit");
      if (num2(args, "--plan-cell") !== void 0) m2.interior.perCell = num2(args, "--plan-cell");
      const place2 = flag(args, "--furniture");
      if (place2) m2.furniture = { place: place2, ...flag(args, "--furniture-side") && { side: flag(args, "--furniture-side") } };
    });
    print(`${describeSettlement(m).split("\n").slice(0, 3).join("\n")}
${next(m.id)}`, m);
    return 0;
  }
  if (sub === "check") {
    const r = checkSettlementFile(p, ref("<id>"));
    print([`${r.file}: ${r.ok ? "ok" : `${r.errors.length} error${r.errors.length === 1 ? "" : "s"}`}${r.warnings.length ? `, ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}` : ""}`, ...r.errors.map((e) => `  error: ${e.path || "(file)"}: ${e.message}`), ...r.warnings.map((w) => `  warning: ${w.path}: ${w.message}`)].join("\n"), r);
    return r.ok ? 0 : 1;
  }
  if (sub === "facts") {
    const f = settlement_exports.settlementFacts(readSettlement(p, ref("<id>")));
    print(describeSettlementFacts(f), f);
    return 0;
  }
  if (sub === "render") {
    const format = flag(args, "--format") ?? "both", theme = flag(args, "--theme") ?? "color", view = flag(args, "--view"), modeB = flag(args, "--buildings");
    if (!["svg", "png", "both"].includes(format)) throw new Error("--format: svg, png or both");
    if (!["color", "bw", "both"].includes(theme)) throw new Error("--theme: color, bw or both");
    if (view !== void 0 && !settlement_exports.VIEWS.includes(view)) throw new Error("--view: site or plan");
    if (modeB !== void 0 && !settlement_exports.BUILDING_MODES.includes(modeB)) throw new Error(`--buildings: ${settlement_exports.BUILDING_MODES.join(", ")}`);
    const rs = await renderSettlementFiles(p, ref("<id>"), {
      formats: format === "both" ? ["svg", "png"] : [format],
      themes: theme === "both" ? ["color", "bw"] : [theme],
      ...view && { view },
      ...flag(args, "--building") && { building: flag(args, "--building") },
      ...num2(args, "--floor") !== void 0 && { floor: num2(args, "--floor") },
      ...modeB && { buildings: modeB },
      plans: args.includes("--plans"),
      ppu: num2(args, "--ppu"),
      pageScale: pageScaleFlag(args),
      ...viewFlags(args, 1),
      layers: parseLayers(flag(args, "--layers"), [.../* @__PURE__ */ new Set([...settlement_exports.SITE_LAYERS, ...settlement_exports.PLAN_LAYERS])]),
      out: flag(args, "--out")
    });
    print(rs.map((r) => [`${file ?? id} ${r.view === "plan" ? `${r.building} level ${r.floor ?? 0}` : "site"}: ${r.size.join("\xD7")} px, ${Math.round(r.ppu * 100) / 100} px a cell`, ...r.files.map((f) => `  ${f}`)].join("\n")).join("\n"), rs.length === 1 ? rs[0] : { renders: rs });
    return 0;
  }
  throw new Error("settlement: new | gen | building | interior | floor | room | connect | disconnect | door | window | fixture | prop | road | water | wall | area | tree | grid | style | label | symbol | overlay | check | facts | render | show | list | fixtures | symbols (artgen --help)");
}
function formatsCommand(emit) {
  const formats = { map: map_exports.MAP_FORMAT, dungeon: dungeon_exports.DUNGEON_FORMAT, settlement: settlement_exports.SETTLEMENT_FORMAT };
  emit(Object.entries(formats).map(([k, v]) => `${k} ${v}`).join("\n"), formats);
  return 0;
}
async function mapsMain(argv) {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a) => a !== void 0);
  const json = args.includes("--json"), print = (human, data) => console.log(json ? JSON.stringify(data, null, 2) : human);
  if (cmd === "--version" || cmd === "version") {
    console.log(MAPS_VERSION);
    return 0;
  }
  if (!cmd || cmd === "--help" || cmd === "help") {
    console.log(`artgen-maps ${MAPS_VERSION} \u2014 the artgen map, dungeon and settlement engines, usable alone.

usage:
${MAP_USAGE}
       artgen-maps.js --version | --help`);
    return 0;
  }
  if (cmd === "formats") return formatsCommand(print);
  if (cmd === "map") return mapCommand(sub, args, print);
  if (cmd === "dungeon") return dungeonCommand(sub, args, print);
  if (cmd === "settlement") return settlementCommand(sub, args, print);
  throw new Error(`artgen-maps: ${cmd}: not a command here; this bundle has map, dungeon, settlement and formats (--help)`);
}
var MAPS_VERSION = `${true ? "0.11.0" : "dev"} (${true ? "1eb8e45" : "unknown"})`;

// ../artgen-cli/src/maps-bin.ts
mapsMain(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
