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
function originError(entry, at2, e) {
  const v = entry?.origin;
  if (v !== void 0 && (typeof v !== "string" || !v)) e.push(`${at2}.origin: a non-empty string`);
}
function shapeErrors(s, at2) {
  if (!s || typeof s !== "object") return [`${at2}: shape required ({circle:[x,y,r]}, {poly:[x,y,\u2026]} or {stroke:[x,y,\u2026], width})`];
  const o = s;
  if ("circle" in o) return nums(o.circle) && o.circle.length === 3 && o.circle[2] > 0 ? [] : [`${at2}.circle: [x, y, r] with r > 0`];
  if ("poly" in o) return nums(o.poly) && o.poly.length >= 6 && o.poly.length % 2 === 0 ? [] : [`${at2}.poly: at least 3 x,y pairs`];
  if ("stroke" in o) return nums(o.stroke) && o.stroke.length >= 2 && o.stroke.length % 2 === 0 && isNum(o.width) && o.width > 0 ? [] : [`${at2}.stroke: x,y pairs and width > 0`];
  return [`${at2}: unknown shape (circle, poly or stroke)`];
}
function requirementErrors(m) {
  const e = [], list2 = m.require;
  if (list2 === void 0) return e;
  if (!Array.isArray(list2)) return ["require: an array"];
  const seen = /* @__PURE__ */ new Set(), top = isNum(m.topo?.maxElevation) ? m.topo.maxElevation : Infinity;
  list2.forEach((r, i) => {
    const at2 = `require[${i}]`;
    if (!r || typeof r !== "object") {
      e.push(`${at2}: an object`);
      return;
    }
    if (typeof r.id !== "string" || !/^[\w.-]+$/.test(r.id)) e.push(`${at2}.id: letters, digits, - . and _ only`);
    else if (seen.has(r.id)) e.push(`${at2}.id: ${r.id} is used twice`);
    else seen.add(r.id);
    if (r.blend !== void 0 && !(isNum(r.blend) && r.blend >= 0)) e.push(`${at2}.blend: map units, 0 or more`);
    originError(r, at2, e);
    if (r.kind === "terrain") {
      e.push(...shapeErrors(r.area, `${at2}.area`));
      if (!TERRAINS.includes(r.terrain)) e.push(`${at2}.terrain: one of ${TERRAINS.join(", ")}`);
      else if (r.terrain === "snow" && m.preset === "local") e.push(`${at2}.terrain: snow does not appear on a local map`);
      if (!isNum(r.share) || r.share <= 0 || r.share > 1) e.push(`${at2}.share: above 0 and at most 1`);
    } else if (r.kind === "height") {
      e.push(...shapeErrors(r.area, `${at2}.area`));
      if (!isNum(r.low) || !isNum(r.high) || r.low < 0 || r.high <= r.low) e.push(`${at2}: low and high, 0 \u2264 low < high`);
      else if (r.high > top) e.push(`${at2}.high: at most topo.maxElevation (${top})`);
      if (r.share !== void 0 && !(isNum(r.share) && r.share > 0 && r.share <= 1)) e.push(`${at2}.share: above 0 and at most 1`);
    } else if (r.kind === "path") {
      if (r.path !== "stream" && r.path !== "road") e.push(`${at2}.path: stream or road`);
      if (!nums(r.points) || r.points.length < 4 || r.points.length % 2) e.push(`${at2}.points: at least 2 x,y pairs`);
      if (r.tolerance !== void 0 && !(isNum(r.tolerance) && r.tolerance > 0)) e.push(`${at2}.tolerance: map units, above 0`);
      if (r.width !== void 0 && !(isNum(r.width) && r.width > 0)) e.push(`${at2}.width: > 0`);
      if (r.delta !== void 0 && typeof r.delta !== "boolean") e.push(`${at2}.delta: true or false`);
    } else if (r.kind === "clear") e.push(...shapeErrors(r.area, `${at2}.area`));
    else e.push(`${at2}.kind: ${REQUIREMENT_KINDS.join(", ")}`);
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
    const at2 = `edits[${i}]`;
    if (ed?.op === "paint") {
      if (!TERRAINS.includes(ed.terrain)) e.push(`${at2}.terrain: one of ${TERRAINS.join(", ")}`);
      e.push(...shapeErrors(ed.shape, `${at2}.shape`));
    } else if (ed?.op === "elevate") {
      if (!isNum(ed.amount) || Math.abs(ed.amount) > 1) e.push(`${at2}.amount: -1..1`);
      e.push(...shapeErrors(ed.shape, `${at2}.shape`));
    } else if (ed?.op === "river" || ed?.op === "road") {
      if (!nums(ed.points) || ed.points.length < 4 || ed.points.length % 2) e.push(`${at2}.points: at least 2 x,y pairs`);
      if (ed.op === "river" && ed.width !== void 0 && !(isNum(ed.width) && ed.width > 0)) e.push(`${at2}.width: > 0`);
      if (ed.op === "river" && ed.delta !== void 0 && typeof ed.delta !== "boolean") e.push(`${at2}.delta: true or false`);
    } else e.push(`${at2}.op: paint, elevate, river or road`);
    originError(ed, at2, e);
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
    const c = +hex[1] - 1, r = +hex[2] - 1, R = s / Math.sqrt(3);
    return [R + c * 1.5 * R, s / 2 + r * s + (c % 2 ? s / 2 : 0)];
  }
  const sq = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (sq) {
    const c = [...sq[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, r = +sq[2] - 1;
    return [(c + 0.5) * s, (r + 0.5) * s];
  }
  throw new Error(`${ref}: expected hex coordinates (0304) or a square cell (C4)`);
}
function parsePoint(spec, at2) {
  const xy = at2.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
  if (xy) return [+xy[1], +xy[2]];
  return cellCenter(spec, at2.replace(/^(hex|cell):/i, ""));
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
  const list2 = spec.require ?? [], local = spec.preset === "local", N = f.w * f.h, feature = spec.gen.feature;
  const base = Float32Array.from(raw, (v) => Math.max(0, Math.min(1, v)));
  const toRaw = (e) => seaLevel + e * (1 - seaLevel);
  const blendOf = (r) => r.blend ?? feature;
  for (const r of list2) {
    if (r.kind !== "path" || r.path !== "stream") continue;
    const p = streamCurve(r.points), valley = Math.min(feature * 0.5, 4), steps = [];
    for (let i = 0; i < p.length - 2; i += 2) {
      const len = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]), k = Math.max(1, Math.ceil(len * f.res));
      for (let s = 0; s < k; s++) steps.push([p[i] + (p[i + 2] - p[i]) * s / k, p[i + 1] + (p[i + 3] - p[i + 1]) * s / k]);
    }
    steps.push([p[p.length - 2], p[p.length - 1]]);
    const at2 = (x, y) => raw[Math.min(f.h - 1, Math.max(0, Math.floor(y * f.res))) * f.w + Math.min(f.w - 1, Math.max(0, Math.floor(x * f.res)))];
    const bed = steps.map(([x, y]) => at2(x, y)), floor = Math.max(seaLevel + 4e-3, 0);
    for (let i = 1; i < bed.length; i++) bed[i] = Math.min(bed[i], bed[i - 1]);
    const win = Math.max(1, Math.round(f.res)), smooth2 = bed.map((_, i) => {
      let s = 0, c = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(bed.length - 1, i + win); k++) {
        s += bed[k];
        c++;
      }
      return Math.max(floor, s / c);
    });
    const strokes = steps.length, reach = valley;
    const best = new Float32Array(N).fill(reach), bedAt = new Float32Array(N);
    for (let k = 0; k < strokes; k++) {
      const [sx, sy] = steps[k], x0 = Math.max(0, Math.floor((sx - reach) * f.res)), x1 = Math.min(f.w - 1, Math.ceil((sx + reach) * f.res)), y0 = Math.max(0, Math.floor((sy - reach) * f.res)), y1 = Math.min(f.h - 1, Math.ceil((sy + reach) * f.res));
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const d = Math.hypot((i + 0.5) / f.res - sx, (j + 0.5) / f.res - sy), n = j * f.w + i;
        if (d < best[n]) {
          best[n] = d;
          bedAt[n] = smooth2[k];
        }
      }
    }
    for (let n = 0; n < N; n++) {
      if (best[n] >= reach) continue;
      const wgt = 0.5 + 0.5 * Math.cos(best[n] / reach * Math.PI), target = Math.min(raw[n], bedAt[n]);
      raw[n] += (target - raw[n]) * wgt;
    }
  }
  const heights = list2.filter((r) => r.kind === "height");
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
  const terrains = list2.flatMap((r) => r.kind === "terrain" ? [{ r, w: weights(spec, f, r.area, blendOf(r), WET_EDGE.has(r.terrain) ? "wet" : "land"), b: bands(r.terrain, local) }] : []);
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
  const clear = list2.filter((r) => r.kind === "clear");
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
  const at2 = (i, j) => Math.min(f.h - 1, j * step + (step >> 1)) * f.w + Math.min(f.w - 1, i * step + (step >> 1));
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
        const len = Math.hypot(di, dj) * unit, rise = Math.abs(elev[at2(x, y)] - elev[at2(i, j)]);
        const c = dist[n] + len + rise * 40 + (wet[at2(x, y)] ? len * 3 : 0);
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
    const R = () => [vk(i + 1, j), i + 1, j + lerp(b, c)];
    const B = () => [hk(i, j + 1), i + lerp(d, c), j + 1];
    const L = () => [vk(i, j), i, j + lerp(a, d)];
    const add = (p, q) => segs.push([...p, ...q]);
    const mid = (a + b + c + d) / 4 >= t;
    switch (k) {
      case 1:
      case 14:
        add(L(), B());
        break;
      case 2:
      case 13:
        add(B(), R());
        break;
      case 3:
      case 12:
        add(L(), R());
        break;
      case 4:
      case 11:
        add(T2(), R());
        break;
      case 6:
      case 9:
        add(T2(), B());
        break;
      case 7:
      case 8:
        add(L(), T2());
        break;
      case 5:
        if (mid) {
          add(L(), T2());
          add(B(), R());
        } else {
          add(T2(), R());
          add(L(), B());
        }
        break;
      case 10:
        if (mid) {
          add(T2(), R());
          add(L(), B());
        } else {
          add(L(), T2());
          add(B(), R());
        }
        break;
    }
  }
  const at2 = /* @__PURE__ */ new Map();
  segs.forEach((s, n) => {
    for (const key of [s[0], s[3]]) {
      const l = at2.get(key);
      if (l) l.push(n);
      else at2.set(key, [n]);
    }
  });
  const used = new Uint8Array(segs.length), lines = [];
  const walk = (key, from, out) => {
    for (let cur = from, k = key; ; ) {
      const next = (at2.get(k) ?? []).find((n) => n !== cur && !used[n]);
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
    const pts = [];
    for (let q = back.length - 2; q >= 0; q -= 2) pts.push(back[q], back[q + 1]);
    lines.push({ pts: pts.concat(fwd), closed: false });
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
  const g = spec.gen, R = 4, cells = Math.max(2, Math.round(R * Math.max(spec.cols, spec.rows) / g.feature));
  const opts = { w: w * R, h: h * R, cells, cellsY: Math.max(2, Math.round(cells * h / w)), octaves: 5, gain: 0.35 + g.roughness * 0.25, seed: spec.seed };
  const r = rng(spec.seed), ox = Math.floor(r() * w * (R - 1)), oy = Math.floor(r() * h * (R - 1));
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
function toShore(pts, water) {
  const n = pts.length / 2;
  for (let i = 2; i < n; i++) if (water(pts[i * 2], pts[i * 2 + 1])) return pts.slice(0, (i + 1) * 2);
  const ex = pts[n * 2 - 2], ey = pts[n * 2 - 1];
  let k = n - 2, dx = 0, dy = 0;
  while (k > 0 && Math.hypot(ex - pts[k * 2], ey - pts[k * 2 + 1]) < 0.5) k--;
  dx = ex - pts[k * 2];
  dy = ey - pts[k * 2 + 1];
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  for (let d = 0.1; d <= 3; d += 0.1) {
    const x = ex + dx / len * d, y = ey + dy / len * d;
    if (water(x, y)) return [...pts, ex + dx / len * (d + 0.15), ey + dy / len * (d + 0.15)];
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
function riverRibbon(line, W, mouth) {
  let p = line;
  if (mouth) {
    const n2 = p.length / 2, ex = p[n2 * 2 - 2], ey = p[n2 * 2 - 1];
    let k = n2 - 2;
    while (k > 0 && Math.hypot(ex - p[k * 2], ey - p[k * 2 + 1]) < W * 2) k--;
    const dx = ex - p[k * 2], dy = ey - p[k * 2 + 1], len = Math.hypot(dx, dy) || 1;
    p = [...p, ex + dx / len * W * FLARE_WATER, ey + dy / len * W * FLARE_WATER];
  }
  const c = resample(p, Math.min(0.1, W * 0.4)), n = c.length / 2, s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]));
  const L = s[n - 1] || 1, shore = mouth ? Math.max(L * 0.5, L - W * FLARE_WATER) : L;
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
function smoothLine(pts, res) {
  const thin = [pts[0], pts[1]];
  for (let i = 2; i < pts.length - 2; i += 2) if (Math.hypot(pts[i] - thin[thin.length - 2], pts[i + 1] - thin[thin.length - 1]) >= 0.5) thin.push(pts[i], pts[i + 1]);
  thin.push(pts[pts.length - 2], pts[pts.length - 1]);
  return simplifyLine(chaikin({ pts: thin, closed: false }, 3), 0.15 / res).pts;
}
function markLine(pts, width, w, h, res, wet) {
  eachCovered({ res, w, h }, { stroke: pts, width: Math.max(width, 1 / res) * 2 }, false, (i) => {
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
  const near2 = new Float32Array(N);
  for (let n = 0; n < N; n++) near2[n] = water[n] || wet[n] ? 1 : 0;
  const nearB = blur(near2, w, h, Math.max(1, Math.round(res * 1.5)), 2);
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
  const shown3 = (x, y) => {
    const i = Math.floor(x * res), j = Math.floor(y * res);
    return i >= 0 && j >= 0 && i < w && j < h && isWater(simple[j * w + i]);
  };
  const rivers = mains.map((m) => {
    let fit = m.mouth ? toShore(m.pts, shown3) : null;
    if (fit && m.source === "required" && fit.length < m.pts.length) fit = null;
    if (fit && m.source === "generated" && shaped?.clear.length && touches(fit, shaped.clear.map((c) => c.area))) fit = null;
    return { ...riverRibbon(fit ?? m.pts, m.width, !!fit), source: m.source, ...m.for !== void 0 && { for: m.for } };
  });
  return { res, w, h, elevation: elev, terrain: simple, rivers, roads };
}
function touches(pts, shapes) {
  for (let i = 0; i < pts.length; i += 2) for (const s of shapes) if (coverage(s, pts[i], pts[i + 1]) > 0) return true;
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
    const R = s / Math.sqrt(3);
    for (let c = 0; c * 1.5 * R - R < W; c++) for (let r = -1; r * s - s < H; r++) {
      const cx = R + c * 1.5 * R, cy = s / 2 + r * s + (c % 2 ? s / 2 : 0);
      const P = (a) => `${f(cx + R * Math.cos(a * Math.PI / 3))} ${f(cy + R * Math.sin(a * Math.PI / 3))}`;
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
function clampCrop(c, cols, rows) {
  const x0 = Math.max(0, c[0]), y0 = Math.max(0, c[1]), x1 = Math.min(cols, c[0] + c[2]), y1 = Math.min(rows, c[1] + c[3]);
  if (!(x1 > x0 && y1 > y0)) throw new Error(`crop ${c.join(",")} is outside the sheet (0,0,${cols},${rows})`);
  return [r3(x0), r3(y0), r3(x1 - x0), r3(y1 - y0)];
}
function frameOf(crop, cols, rows, k) {
  const [x, y, w, h] = crop ? clampCrop(crop, cols, rows) : [0, 0, cols, rows];
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
var pointsToPx = (pt, pageScale) => pt * 4 / 3 * pageUnit(pageScale);
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
    const at2 = (dx, dy) => ({ ...l.box, x: l.box.x + dx, y: l.box.y + dy });
    if (free(l.box)) {
      taken.push(l.box);
      out.push({ x: l.x, y: l.y, moved: false, placed: true });
      continue;
    }
    const rx = l.clear + l.box.w / 2 + gap, ry = l.clear + l.box.h / 2 + gap;
    let found = null;
    for (const f of [1, 1.6, 2.4]) {
      const sides = [[rx * f, 0], [-rx * f, 0], [0, -ry * f], [0, ry * f], [rx * f, -ry * f], [rx * f, ry * f], [-rx * f, -ry * f], [-rx * f, ry * f]];
      found = sides.find(([dx, dy]) => free(at2(dx, dy))) ?? null;
      if (found) break;
    }
    if (found) {
      taken.push(at2(found[0], found[1]));
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
    const box = textBox(l.kind === "region" ? l.text.toUpperCase() : l.text, l.x * k, l.y * k + base * 0.35, size, { bold: l.kind === "region" || l.kind === "place", spacing: l.kind === "region" ? size * 0.18 : 0 });
    return { x: l.x * k, y: l.y * k, box, clear: 0 };
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
    const at2 = mapLabelLayout(spec, k, o.pageScale).at;
    const g = spec.overlay.labels.map((l, i) => {
      const base = labelSize(l, u, o.pageScale), lx = at2[i].x / k, ly = at2[i].y / k;
      const attrs = l.kind === "region" ? `font-weight="700" letter-spacing="${n1(base * 0.18)}"` : l.kind === "water" ? 'font-style="italic"' : l.kind === "place" ? 'font-weight="700"' : "";
      const text = l.kind === "region" ? l.text.toUpperCase() : l.text;
      const t = haloText(text, lx * k, ly * k + base * 0.35, base, th.label[l.kind], th, attrs);
      return l.angle ? `<g transform="rotate(${n1(l.angle)} ${n1(lx * k)} ${n1(ly * k)})">${t}</g>` : t;
    }).join("");
    parts.push(`<g id="labels">${g}</g>`);
  }
  const box = (x, y, w, h) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${th.paper}" fill-opacity="0.92" stroke="${th.ink}" stroke-width="${n1(u)}"/>`;
  const pad = 12 * u;
  if (on.legend) {
    const rows = used.map((t) => [t, TERRAIN_NAMES[t]]);
    if (f.rivers.length) rows.push(["river", "River"]);
    if (f.roads.length) rows.push(["road", "Road"]);
    for (const kind of LEGEND_SYMBOLS) if (on.symbols && spec.overlay.symbols.some((s) => s.kind === kind)) rows.push([`symbol:${kind}`, SYMBOLS[kind].name.split(" (")[0]]);
    const rh = 18 * u, fs = 12 * u, bw = 150 * u, bh = rows.length * rh + 12 * u, x = fr.r - bw - pad, y = fr.b - bh - pad;
    let g = box(x, y, bw, bh);
    rows.forEach(([t, name], i) => {
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
    let g = box(fr.x + pad, y - 18 * u, len + 34 * u, 40 * u);
    for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + len / seg * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? th.paper : th.ink}" stroke="${th.ink}" stroke-width="${n1(0.8 * u)}"/>`;
    g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${th.ink}" text-anchor="middle">0</text>`;
    g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${th.ink}" text-anchor="middle">${n * spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${th.ink}" text-anchor="middle">1 ${spec.grid.type === "hex" ? "hex" : "square"} = ${spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    parts.push(`<g id="scale">${g}</g>`);
  }
  if (on.compass) parts.push(compassSvg(fr.r - pad - 18 * u - 4 * u, fr.y + pad + 18 * u + 14 * u, 18 * u, u, th));
  if (on.title && spec.title) {
    const fs = 26 * u, w = Math.max(120 * u, spec.title.length * fs * 0.62 + 30 * u);
    parts.push(`<g id="title">${box(fr.x + pad, fr.y + pad, w, fs * 1.7)}<text x="${n1(fr.x + pad + w / 2)}" y="${n1(fr.y + pad + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.06)}" text-anchor="middle" fill="${th.ink}">${esc(spec.title)}</text></g>`);
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
  const pt = (x, y) => [rnd(x), rnd(y)];
  const shown3 = (height2) => roundTo(height2, step);
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
    for (const line of lines) {
      if (line.kind !== kind) continue;
      const p = line.pts;
      for (let i = 2; i < p.length; i += 2) {
        const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
        const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { line, d, at: [px, py], width: line.widths ? line.widths[i / 2 - 1] * (1 - t) + line.widths[i / 2] * t : 0 };
      }
    }
    return best;
  };
  const near2 = (kind, x, y) => {
    const n = nearest(kind, x, y);
    if (!n) return null;
    return { name: n.line.name, ...n.line.source && { source: n.line.source }, distance: length(n.d), at: pt(...n.at), ...kind === "river" && { within: n.d <= n.width / 2 }, rawAt: n.at };
  };
  return { res, w, h, rnd, length, pt, shown: shown3, height, terrainAt, centre, slope, lines, near: near2 };
}
function shares(f, ids) {
  const count = new Array(TERRAINS.length).fill(0);
  if (ids) for (const n of ids) count[f.terrain[n]]++;
  else for (const t of f.terrain) count[t]++;
  const out = percentShares(TERRAINS.map((t, i) => [t, count[i]]).filter(([, c]) => c > 0));
  return out.map(([terrain, share]) => ({ terrain, share })).sort((a, b) => b.share - a.share || TERRAINS.indexOf(a.terrain) - TERRAINS.indexOf(b.terrain));
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
  const at2 = (s) => ({ height: g.shown(f.elevation[s] * spec.topo.maxElevation), at: g.pt(...g.centre(s)) });
  return { lowest: at2(lo), highest: at2(hi) };
}
function crossings(pts, poly) {
  const inside = (x, y) => coverage({ poly }, x, y) > 0;
  const runs = [];
  let cur = null;
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2], ay = pts[i - 1], dx = pts[i] - ax, dy = pts[i + 1] - ay, len = Math.hypot(dx, dy);
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
  const { cols, rows } = spec, N = cols * rows, r = g.res, step = spec.topo.interval, need = RULES.prominence * step;
  const cell = new Float64Array(N), flip = new Float64Array(N);
  for (let cj = 0; cj < rows; cj++) for (let ci = 0; ci < cols; ci++) {
    let s = 0;
    for (let j = cj * r; j < (cj + 1) * r; j++) for (let i = ci * r; i < (ci + 1) * r; i++) s += f.elevation[j * f.w + i];
    cell[cj * cols + ci] = s / (r * r) * spec.topo.maxElevation;
    flip[cj * cols + ci] = -cell[cj * cols + ci];
  }
  const out = (list2, dry, order) => list2.filter((c) => c.prominence >= need - 1e-9 && (!dry || g.shown(cell[c.n]) > 0)).sort((a, b) => order(cell[a.n], cell[b.n]) || b.prominence - a.prominence || a.n - b.n).map((c) => ({ height: g.shown(cell[c.n]), at: g.pt(c.n % cols + 0.5, Math.floor(c.n / cols) + 0.5), prominence: roundTo(c.prominence, step) }));
  return { hilltops: out(prominences(cell, cols), false, (a, b) => b - a), hollows: out(prominences(flip, cols), true, (a, b) => a - b) };
}
var listed = (g, pts) => {
  const t = simplifyLine({ pts, closed: false }, RULES.lineTolerance).pts, out = [];
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
      const cross = (kind) => g.lines.filter((l) => l.kind === kind).flatMap((l) => crossings(l.pts, poly).map((c) => ({
        name: l.name,
        ...l.source && { source: l.source },
        enters: c.enters && g.pt(...c.enters),
        leaves: c.leaves && g.pt(...c.leaves),
        length: g.length(c.length)
      })));
      const pairs = [];
      for (let i = 0; i < poly.length; i += 2) pairs.push(g.pt(poly[i], poly[i + 1]));
      return { area: pairs, terrain: shares(field, ids), ...extremes(g, field, spec, ids), rivers: cross("river"), roads: cross("road") };
    });
  }
  if (!out.points && !out.areas) {
    const line = (l) => ({ name: l.name, ...l.source && { source: l.source }, points: listed(g, l.pts), length: g.length(pathLength(l.pts)), ...l.mouth !== void 0 && { mouth: l.mouth } });
    out.features = {
      rivers: g.lines.filter((l) => l.kind === "river" && l.source !== "generated").map(line),
      generatedRivers: g.lines.filter((l) => l.kind === "river" && l.source === "generated").map(line),
      roads: g.lines.filter((l) => l.kind === "road").map(line),
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
  DEFAULTS: () => DEFAULTS,
  DOOR_KINDS: () => DOOR_KINDS,
  DOOR_NAMES: () => DOOR_NAMES,
  DUNGEON_FORMAT: () => DUNGEON_FORMAT,
  DUNGEON_LAYERS: () => DUNGEON_LAYERS,
  FACTS_RULES: () => RULES2,
  GATE_KINDS: () => GATE_KINDS,
  HATCH_STYLES: () => HATCH_STYLES,
  LABEL_KINDS: () => LABEL_KINDS2,
  LEGEND_NAMES: () => LEGEND_NAMES,
  MARK_DISTANCE: () => MARK_DISTANCE2,
  MAX_SIDE: () => MAX_SIDE2,
  ROOM_FILLS: () => ROOM_FILLS,
  ROOM_SHAPES: () => ROOM_SHAPES,
  ROUTES: () => ROUTES,
  SYMBOLS: () => SYMBOLS2,
  SYMBOL_KINDS: () => SYMBOL_KINDS2,
  WALL_DEFAULTS: () => WALL_DEFAULTS,
  WALL_TOWER_SHAPES: () => WALL_TOWER_SHAPES,
  checkDungeon: () => checkDungeon,
  contentBox: () => contentBox,
  convexHull: () => convexHull,
  dungeonFacts: () => dungeonFacts,
  dungeonLabelLayout: () => dungeonLabelLayout,
  dungeonLayersFor: () => dungeonLayersFor,
  fitDungeon: () => fitDungeon,
  generateDungeon: () => generateDungeon,
  inPolygon: () => inPolygon,
  layoutDungeon: () => layoutDungeon,
  layoutWalls: () => layoutWalls,
  newDungeon: () => newDungeon,
  nextRoomId: () => nextRoomId,
  offsetRing: () => offsetRing,
  originError: () => originError2,
  parseDungeon: () => parseDungeon,
  parsePoint: () => parsePoint2,
  polyBox: () => polyBox,
  renderDungeonSvg: () => renderDungeonSvg,
  roomCrop: () => roomCrop,
  roomOutline: () => roomOutline,
  singleRoom: () => singleRoom,
  syncDungeon: () => syncDungeon,
  toIssue: () => toIssue,
  underlaySvg: () => underlaySvg,
  underlayWindow: () => underlayWindow,
  validateDungeon: () => validateDungeon,
  wallFacts: () => wallFacts
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
var ROUTES = ["auto", "hv", "vh", "straight"];
var HATCH_STYLES = ["band", "full", "none"];
var LABEL_KINDS2 = ["name", "note", "area"];
var ROOM_FILLS = ["floor", "building", "yard", "cellar"];
var WALL_TOWER_SHAPES = ["round", "square"];
var GATE_KINDS = ["gate", "postern"];
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
function endErrors(e, at2, ids) {
  if (!e || typeof e !== "object") return [`${at2}: {room: id} or {at: [x, y]}`];
  const o = e;
  if ("room" in o) return ids.has(o.room) ? [] : [`${at2}.room: no room ${JSON.stringify(o.room)}`];
  if ("at" in o) return isPoint(o.at) ? [] : [`${at2}.at: [x, y]`];
  return [`${at2}: {room: id} or {at: [x, y]}`];
}
function originError2(entry, at2, e) {
  const v = entry?.origin;
  if (v !== void 0 && (typeof v !== "string" || !v)) e.push(`${at2}.origin: a non-empty string`);
}
function enclosureErrors(m, ids) {
  const e = [];
  if (m.legend !== void 0 && typeof m.legend !== "boolean") e.push("legend: true or false");
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
    const at2 = `walls[${i}]`;
    if (!w || typeof w !== "object") {
      e.push(`${at2}: an object`);
      return;
    }
    if (w.rooms !== void 0) {
      if (!Array.isArray(w.rooms) || !w.rooms.length) e.push(`${at2}.rooms: room ids`);
      else for (const r of w.rooms) if (!ids.has(r)) e.push(`${at2}.rooms: no room ${JSON.stringify(r)}`);
    }
    if (w.poly !== void 0 && !(nums2(w.poly) && w.poly.length >= 6 && w.poly.length % 2 === 0)) e.push(`${at2}.poly: at least 3 x,y pairs`);
    if (w.rooms === void 0 && w.poly === void 0) e.push(`${at2}: rooms (ids) or poly`);
    if (w.thickness !== void 0 && !(isNum2(w.thickness) && w.thickness > 0 && w.thickness <= 4)) e.push(`${at2}.thickness: cells, above 0 and at most 4`);
    if (w.inset !== void 0 && !(isNum2(w.inset) && w.inset >= 0)) e.push(`${at2}.inset: cells, 0 or more`);
    const t = w.towers;
    if (t !== void 0) {
      if (!t || !WALL_TOWER_SHAPES.includes(t.shape)) e.push(`${at2}.towers.shape: ${WALL_TOWER_SHAPES.join(" or ")}`);
      if (t?.size !== void 0 && !(isNum2(t.size) && t.size > 0)) e.push(`${at2}.towers.size: cells, above 0`);
      if (t?.at !== void 0 && t.at !== "corners" && !(nums2(t.at) && t.at.every(Number.isInteger))) e.push(`${at2}.towers.at: "corners" or vertex indices`);
    }
    (w.gates === void 0 ? [] : Array.isArray(w.gates) ? w.gates : (e.push(`${at2}.gates: an array`), [])).forEach((g, j) => {
      const ga = `${at2}.gates[${j}]`;
      if (!isPoint(g?.at)) e.push(`${ga}.at: [x, y] in cells`);
      if (!GATE_KINDS.includes(g?.kind)) e.push(`${ga}.kind: ${GATE_KINDS.join(" or ")}`);
      if (g?.room !== void 0 && !ids.has(g.room)) e.push(`${ga}.room: no room ${JSON.stringify(g.room)}`);
      if (g?.width !== void 0 && !(isNum2(g.width) && g.width > 0)) e.push(`${ga}.width: cells, above 0`);
    });
    originError2(w, at2, e);
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
  }
  if (!m.grid || typeof m.grid.show !== "boolean" || !isNum2(m.grid.size) || m.grid.size < 0.5 || typeof m.grid.sub !== "boolean" || !["floor", "all"].includes(m.grid.clip))
    e.push("grid: show, size \u2265 0.5 (cells), sub (true|false), clip floor|all");
  if (!m.style || !HATCH_STYLES.includes(m.style.hatch) || !isNum2(m.style.band) || m.style.band < 0 || m.style.band > 6 || !isNum2(m.style.wall) || m.style.wall < 0.2 || m.style.wall > 4)
    e.push(`style: hatch ${HATCH_STYLES.join("|")}, band 0..6, wall 0.2..4`);
  if (!m.scale || !isNum2(m.scale.perCell) || typeof m.scale.unit !== "string") e.push("scale: perCell (number) and unit");
  const ids = /* @__PURE__ */ new Set();
  (Array.isArray(m.rooms) ? m.rooms : (e.push("rooms: an array"), [])).forEach((r, i) => {
    const at2 = `rooms[${i}]`;
    if (typeof r?.id !== "string" || !/^[\w-]+$/.test(r.id)) e.push(`${at2}.id: letters, digits, - and _ only`);
    else if (ids.has(r.id)) e.push(`${at2}.id: ${r.id} is used twice`);
    else ids.add(r.id);
    if (!ROOM_SHAPES.includes(r?.shape)) e.push(`${at2}.shape: one of ${ROOM_SHAPES.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum2(r?.[k])) e.push(`${at2}.${k}: a number (cells)`);
    for (const k of ["w", "h"]) if (!isNum2(r?.[k]) || r[k] < 1) e.push(`${at2}.${k}: at least 1 cell`);
    if (r?.shape === "poly" && !(nums2(r.points) && r.points.length >= 6 && r.points.length % 2 === 0)) e.push(`${at2}.points: at least 3 x,y pairs`);
    if (r?.label !== void 0 && typeof r.label !== "string") e.push(`${at2}.label: text`);
    if (r?.number !== void 0 && r.number !== false && !isNum2(r.number)) e.push(`${at2}.number: a number or false`);
    if (r?.fill !== void 0 && !ROOM_FILLS.includes(r.fill)) e.push(`${at2}.fill: one of ${ROOM_FILLS.join(", ")}`);
    if (r?.hand !== void 0 && !(Array.isArray(r.hand) && r.hand.every((f) => typeof f === "string"))) e.push(`${at2}.hand: field names`);
    originError2(r, at2, e);
  });
  (Array.isArray(m.corridors) ? m.corridors : (e.push("corridors: an array"), [])).forEach((c, i) => {
    const at2 = `corridors[${i}]`;
    e.push(...endErrors(c?.from, `${at2}.from`, ids), ...endErrors(c?.to, `${at2}.to`, ids));
    if (c?.width !== void 0 && !(isNum2(c.width) && c.width >= 0.5 && c.width <= 6)) e.push(`${at2}.width: 0.5..6`);
    if (c?.route !== void 0 && !ROUTES.includes(c.route)) e.push(`${at2}.route: one of ${ROUTES.join(", ")}`);
    if (c?.via !== void 0 && !(nums2(c.via) && c.via.length % 2 === 0)) e.push(`${at2}.via: x,y pairs`);
    if (c?.doors !== void 0 && !(Array.isArray(c.doors) && c.doors.length === 2 && c.doors.every((d) => d === null || DOOR_KINDS.includes(d))))
      e.push(`${at2}.doors: [from, to], each null or one of ${DOOR_KINDS.join(", ")}`);
    originError2(c, at2, e);
  });
  e.push(...enclosureErrors(m, ids));
  const o = m.overlay;
  if (!o || !Array.isArray(o.labels) || !Array.isArray(o.symbols)) e.push("overlay: { labels: [], symbols: [] }");
  else {
    o.labels.forEach((l, i) => {
      if (typeof l?.text !== "string" || !isNum2(l.x) || !isNum2(l.y) || !LABEL_KINDS2.includes(l.kind)) e.push(`overlay.labels[${i}]: text, x, y, kind (${LABEL_KINDS2.join("|")})`);
      else originError2(l, `overlay.labels[${i}]`, e);
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
function parsePoint2(at2) {
  const xy = at2.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
  if (xy) return [+xy[1], +xy[2]];
  const sq = at2.replace(/^cell:/i, "").toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (sq) {
    const c = [...sq[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, r = +sq[2] - 1;
    return [c + 0.5, r + 0.5];
  }
  throw new Error(`${at2}: expected x,y (cells) or a cell name (C4)`);
}
function nextRoomId(spec) {
  const used = new Set(spec.rooms.map((r) => r.id));
  for (let n = spec.rooms.length + 1; ; n++) if (!used.has(`r${n}`)) return `r${n}`;
}

// ../artgen-core/src/dungeon/walls.ts
var WALL_DEFAULTS = { thickness: 1, inset: 1, towerSize: 3, gateWidth: 2, posternWidth: 1 };
function convexHull(pts) {
  const ps = [];
  for (let i = 0; i < pts.length; i += 2) ps.push([pts[i], pts[i + 1]]);
  ps.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const uniq = ps.filter((p, i) => !i || p[0] !== ps[i - 1][0] || p[1] !== ps[i - 1][1]);
  if (uniq.length < 3) return uniq;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list2) => {
    const h = [];
    for (const p of list2) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(uniq), ...half([...uniq].reverse())];
}
var area2 = (r) => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0);
function offsetRing(ring, d) {
  if (!d || ring.length < 3) return ring;
  const sign = area2(ring) > 0 ? 1 : -1, n = ring.length;
  const normal = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [sign * dy / l, -sign * dx / l];
  };
  return ring.map((p, i) => {
    const a = normal(ring[(i + n - 1) % n], p), b = normal(p, ring[(i + 1) % n]), k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k];
  });
}
function snapToRing(ring, at2) {
  let best = { x: ring[0][0], y: ring[0][1], angle: 0 }, bd = Infinity;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((at2[0] - a[0]) * dx + (at2[1] - a[1]) * dy) / L)) : 0, x = a[0] + t * dx, y = a[1] + t * dy, d = Math.hypot(at2[0] - x, at2[1] - y);
    if (d < bd) {
      bd = d;
      best = { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI };
    }
  });
  return best;
}
function wallGeom(w, index, l) {
  const byId = new Map(l.rooms.map((g) => [g.room.id, g]));
  let ring;
  if (w.poly) ring = Array.from({ length: w.poly.length / 2 }, (_, i) => [w.poly[2 * i], w.poly[2 * i + 1]]);
  else ring = offsetRing(convexHull((w.rooms ?? []).flatMap((id) => byId.get(id)?.outline ?? [])), w.inset ?? WALL_DEFAULTS.inset);
  const thickness = w.thickness ?? WALL_DEFAULTS.thickness, tw = w.towers, size = tw?.size ?? WALL_DEFAULTS.towerSize, shape = tw?.shape ?? "round";
  const towers = [];
  if (tw) {
    const at2 = tw.at ?? "corners", verts = at2 === "corners" ? ring.map((_, i) => i) : at2.filter((i) => i >= 0 && i < ring.length);
    for (const i of verts) towers.push({ x: ring[i][0], y: ring[i][1], shape, size, source: "corner", vertex: i });
  }
  const gates = (w.gates ?? []).map((g) => {
    const s = snapToRing(ring, g.at), width = g.width ?? (g.kind === "postern" ? WALL_DEFAULTS.posternWidth : WALL_DEFAULTS.gateWidth);
    const dx = Math.cos(s.angle * Math.PI / 180), dy = Math.sin(s.angle * Math.PI / 180), off = width / 2 + size / 2;
    const side = g.kind === "gate" ? [-1, 1].map((sg) => ({ x: s.x + sg * off * dx, y: s.y + sg * off * dy, shape, size, source: "gate" })) : [];
    towers.push(...side);
    return { kind: g.kind, x: s.x, y: s.y, angle: s.angle, width, ...g.room !== void 0 && { room: g.room }, towers: side };
  });
  const ids = w.rooms ?? l.rooms.map((g) => g.room.id);
  const enclosed = ids.map((room) => {
    const g = byId.get(room), flat = ring.flat();
    return { room, inside: !!g && g.outline.every((_, i) => i % 2 || inPolygon(flat, g.outline[i], g.outline[i + 1]) || onRing(ring, g.outline[i], g.outline[i + 1])) };
  });
  return { index, ...w.id !== void 0 && { id: w.id }, thickness, ring: ring.flat(), towers, gates, enclosed };
}
var onRing = (ring, x, y) => {
  const s = snapToRing(ring, [x, y]);
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
    const ax = p[j], ay = p[j + 1], bx = p[i], by = p[i + 1], L = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L)) : 0;
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
var snap = (v, w) => Math.round(w) % 2 ? Math.floor(v) + 0.5 : Math.round(v);
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
function exitPoint(outline2, pts) {
  let along = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    if (inPolygon(outline2, x1, y1)) {
      along += Math.hypot(x1 - x0, y1 - y0);
      continue;
    }
    let lo = 0, hi = 1;
    if (!inPolygon(outline2, x0, y0)) return null;
    for (let k = 0; k < 30; k++) {
      const t = (lo + hi) / 2;
      if (inPolygon(outline2, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) lo = t;
      else hi = t;
    }
    return { x: x0 + (x1 - x0) * lo, y: y0 + (y1 - y0) * lo, angle: Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI, along: along + Math.hypot(x1 - x0, y1 - y0) * lo };
  }
  return null;
}
var reversed = (p) => {
  const out = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
};
function layoutDungeon(spec) {
  let auto = 0;
  const rooms = spec.rooms.map((room, index) => {
    const outline2 = roomOutline(room), [cx, cy] = roomAnchor(room, outline2);
    const number = room.number === false ? void 0 : room.number ?? ++auto;
    if (typeof room.number === "number") auto = Math.max(auto, room.number);
    return { room, index, outline: outline2, cx, cy, number };
  });
  const byId = new Map(rooms.map((g) => [g.room.id, g]));
  const end = (e) => "room" in e ? byId.get(e.room) : e.at;
  const corridors = [], doors = [];
  spec.corridors.forEach((c, index) => {
    const width = c.width ?? 1, a = end(c.from), b = end(c.to);
    const pts = c.via?.length ? [...Array.isArray(a) ? a : [a.cx, a.cy], ...c.via, ...Array.isArray(b) ? b : [b.cx, b.cy]] : route(a, b, width, c.route ?? "auto", rooms);
    const ends = [[a, pts], [b, reversed(pts)]].map(([e, path]) => Array.isArray(e) ? { x: e[0], y: e[1], angle: Math.atan2(path[1] - path[3], path[0] - path[2]) * 180 / Math.PI, along: 0 } : exitPoint(e.outline, path));
    corridors.push({ index, pts, width, ends });
    ends.forEach((p, i) => {
      const kind = c.doors?.[i];
      if (p && kind) doors.push({ kind, x: p.x, y: p.y, angle: p.angle, width, corridor: index });
    });
  });
  return { rooms, corridors, doors };
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
  for (const c of l.corridors) add(c.pts, c.width / 2);
  for (const o of [...spec.overlay.labels, ...spec.overlay.symbols]) add([o.x, o.y], 0.5);
  for (const w of layoutWalls(spec, l)) {
    add(w.ring, w.thickness / 2);
    for (const t of w.towers) add([t.x, t.y], t.size / 2);
  }
  if (!xs.length) return null;
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function fitDungeon(spec, margin = 2) {
  const box = contentBox(spec);
  if (!box) return spec;
  const dx = Math.round(margin - box[0]), dy = Math.round(margin - box[1]);
  const mv = (p) => p.map((v, i) => v + (i % 2 ? dy : dx));
  const out = structuredClone(spec);
  for (const r of out.rooms) {
    r.x += dx;
    r.y += dy;
    if (r.points) r.points = mv(r.points);
  }
  for (const c of out.corridors) {
    for (const e of [c.from, c.to]) if ("at" in e) e.at = [e.at[0] + dx, e.at[1] + dy];
    if (c.via) c.via = mv(c.via);
  }
  for (const o of [...out.overlay.labels, ...out.overlay.symbols]) {
    o.x += dx;
    o.y += dy;
  }
  for (const w of out.walls ?? []) {
    if (w.poly) w.poly = mv(w.poly);
    for (const g of w.gates ?? []) g.at = [g.at[0] + dx, g.at[1] + dy];
  }
  if (out.underlay) out.underlay.origin = [out.underlay.origin[0] - dx * out.underlay.scale, out.underlay.origin[1] - dy * out.underlay.scale];
  out.cols = Math.max(4, Math.ceil(box[2] + dx + margin));
  out.rows = Math.max(4, Math.ceil(box[3] + dy + margin));
  return out;
}
function stretch(path, from, to) {
  const out = [];
  let at2 = 0;
  const point = (i, t) => [path[i] + (path[i + 2] - path[i]) * t, path[i + 1] + (path[i + 3] - path[i + 1]) * t];
  for (let i = 0; i + 3 < path.length; i += 2) {
    const len = Math.hypot(path[i + 2] - path[i], path[i + 3] - path[i + 1]);
    if (len > 0 && at2 + len > from && at2 < to) {
      out.push(...point(i, Math.max(0, (from - at2) / len)), ...point(i, Math.min(1, (to - at2) / len)));
    }
    at2 += len;
  }
  return out;
}
function findRoom(l, ref) {
  const hits = [(g) => g.room.id === ref, (g) => g.room.label === ref, (g) => g.room.label?.split(/\s+/)[0] === ref].map((test) => l.rooms.filter(test)).find((h) => h.length);
  if (!hits) throw new Error(`--room: no room ${ref} (ids: ${l.rooms.map((g) => g.room.id).join(", ")}; labels: ${l.rooms.flatMap((g) => g.room.label ? [g.room.label.split(/\s+/)[0]] : []).join(", ")})`);
  if (hits.length > 1) throw new Error(`--room: ${ref} names ${hits.length} rooms (${hits.map((g) => g.room.id).join(", ")}); use an id`);
  return hits[0];
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
    const at2 = e.side === "n" ? [m + mid(o.w), -1] : e.side === "s" ? [m + mid(o.w), out.rows + 1] : e.side === "w" ? [-1, m + mid(o.h)] : [out.cols + 1, m + mid(o.h)];
    const via = e.side === "n" || e.side === "s" ? [at2[0], m + o.h / 2] : [m + o.w / 2, at2[1]];
    return { from: { room: "r1" }, to: { at: at2 }, via, width: w, doors: [e.door === void 0 ? "door" : e.door, null] };
  });
  return out;
}
function generateDungeon(spec) {
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
  if (g.entrance && placed.length) {
    const p = placed[0], [cx, cy] = c(p), odd = Math.round(g.corridorWidth) % 2 === 1, s = (v) => odd ? Math.floor(v) + 0.5 : Math.round(v);
    const d = [[cy, "n"], [spec.rows - cy, "s"], [cx, "w"], [spec.cols - cx, "e"]];
    const side = d.reduce((a, b) => b[0] < a[0] ? b : a)[1];
    const at2 = side === "n" ? [s(cx), -1] : side === "s" ? [s(cx), spec.rows + 1] : side === "w" ? [-1, s(cy)] : [spec.cols + 1, s(cy)];
    const via = side === "n" || side === "s" ? [at2[0], cy] : [cx, at2[1]];
    corridors.unshift({ from: { room: p.id }, to: { at: at2 }, via, width: g.corridorWidth, doors: [p.shape === "cave" ? null : "door", null] });
  }
  out.rooms = placed;
  out.corridors = corridors;
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
var DUNGEON_LAYERS = ["underlay", "rock", "floors", "buildings", "enclosure", "grid", "doors", "symbols", "cellars", "numbers", "labels", "legend", "title", "scale", "compass"];
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
    const x = g.cx * k, y = g.cy * k, fs = numberSize(u, pageScale), badge = numbers2 && g.number !== void 0;
    if (badge) {
      const txt = String(g.number), bh = fs * 1.45, bw = Math.max(bh, txt.length * fs * 0.62 + fs * 0.7);
      obstacles.push({ x: x - bw / 2, y: y - bh / 2, w: bw, h: bh });
    }
    if (g.room.label) obstacles.push(textBox(g.room.label, x, y + (badge ? fs * 1.6 : fs * 0.3), nameSize(u, pageScale), { bold: true }));
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
  const T2 = cells * k, r = rng(7), step = 0.5 * k, L = 0.42 * k, gap = 0.11 * k, sw = Math.max(0.8, 0.045 * k);
  let d = "";
  for (let gy = 0; gy < T2 / step; gy++) for (let gx = 0; gx < T2 / step; gx++) {
    const cx = (gx + 0.5 + (r() - 0.5) * 0.5) * step, cy = (gy + 0.5 + (r() - 0.5) * 0.5) * step, a = r() * Math.PI;
    const dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2, px = -Math.sin(a) * gap, py = Math.cos(a) * gap;
    for (const ox of [-T2, 0, T2]) for (const oy of [-T2, 0, T2]) {
      const x = cx + ox, y = cy + oy;
      if (x < -L || y < -L || x > T2 + L || y > T2 + L) continue;
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
  const ox = dr.x * k + Math.cos(dr.angle * Math.PI / 180) * t / 2, oy = dr.y * k + Math.sin(dr.angle * Math.PI / 180) * t / 2;
  let out = `<g transform="translate(${n1(ox)} ${n1(oy)}) rotate(${n1(dr.angle)})">${g}</g>`;
  if (dr.kind === "secret") {
    const fs = Math.max(10, 0.5 * k);
    out += haloText("S", ox, oy + fs * 0.35, fs, INK, TH, 'font-weight="700"');
  }
  return out;
}
function scaleCells2(width) {
  const target = width / 5;
  for (const n of [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40]) if (n >= target * 0.75) return n;
  return Math.max(1, Math.round(target));
}
function renderDungeonSvg(spec, o = {}) {
  const k = o.ppu ?? 40, W = spec.cols * k, H = spec.rows * k, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, t = 0.14 * k * spec.style.wall, fr = frameOf(o.crop, spec.cols, spec.rows, k);
  const l = o.layout ?? layoutDungeon(spec), on = dungeonLayersFor(spec, o.layers);
  const parts = [`<rect width="${W}" height="${H}" fill="${PAPER}"/>`], defs = [];
  const roomD = pathData(l.rooms.filter((g) => fillOf(g.room) === "floor").map((g) => ({ pts: g.outline, closed: true })), k);
  const corr = l.corridors.map((c) => ({ d: pathData([{ pts: c.pts, closed: false }], k), w: c.width * k }));
  if (on.underlay && spec.underlay && o.underlay) parts.push(underlaySvg(spec, o.underlay.map, k, o.underlay.field));
  if (on.rock && spec.style.hatch !== "none") {
    defs.push(hatchPattern(k));
    const band = spec.style.band * k;
    const g = spec.style.hatch === "full" ? `<rect width="${W}" height="${H}" fill="url(#hatch)"/>` : `<g fill="url(#hatch)" stroke="url(#hatch)" stroke-linejoin="round" stroke-linecap="round">${roomD ? `<path d="${roomD}" stroke-width="${n1(2 * (t + band))}"/>` : ""}${corr.map((c) => `<path d="${c.d}" fill="none" stroke-width="${n1(c.w + 2 * (t + band))}"/>`).join("")}</g>`;
    parts.push(`<g id="rock">${g}</g>`);
  }
  const floor = (fill, extra) => (roomD ? `<path d="${roomD}" fill="${fill}"${extra ? ` stroke="${fill}" stroke-width="${n1(extra * 2)}" stroke-linejoin="miter"` : ""}/>` : "") + corr.map((c) => `<path d="${c.d}" fill="none" stroke="${fill}" stroke-width="${n1(c.w + extra * 2)}" stroke-linecap="square" stroke-linejoin="miter"/>`).join("");
  if (on.floors) parts.push(`<g id="floors"><g id="walls">${floor(INK, t)}</g><g id="floor">${floor(PAPER, 0)}</g></g>`);
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
      const ring = pathData([{ pts: w.ring, closed: true }], k), th = w.thickness * k, cut = w.gates.map((gt) => `<rect x="${n1(-gt.width * k / 2)}" y="${n1(-th)}" width="${n1(gt.width * k)}" height="${n1(2 * th)}" transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(gt.angle)})" fill="#000"/>`).join("");
      const mid = `gates-${w.index}`;
      if (cut) defs2.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${cut}</mask>`);
      g += `<g id="wall-${w.index}"><g${cut ? ` mask="url(#${mid})"` : ""}><path d="${ring}" fill="none" stroke="${INK}" stroke-width="${n1(th)}" stroke-linejoin="miter"/></g>`;
      const tower = (tw) => {
        const r = tw.size * k / 2, ring2 = Math.max(1, th * 0.4);
        return tw.shape === "square" ? `<rect x="${n1(tw.x * k - r)}" y="${n1(tw.y * k - r)}" width="${n1(2 * r)}" height="${n1(2 * r)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(ring2)}"/>` : `<circle cx="${n1(tw.x * k)}" cy="${n1(tw.y * k)}" r="${n1(r)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(ring2)}"/>`;
      };
      g += w.towers.map(tower).join("");
      g += w.gates.map((gt) => `<g transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(gt.angle)}) scale(${(gt.width * k / 10).toFixed(3)})">${SYMBOLS2.gate.svg.replaceAll("{ink}", INK).replaceAll("{fill}", PAPER)}</g>`).join("");
      g += "</g>";
    }
    defs.push(...defs2);
    parts.push(`<g id="enclosure">${g}</g>`);
  }
  if (on.grid && spec.grid.show) {
    const s = spec.grid.size, line = (step) => {
      let d = "";
      for (let x = 0; x <= spec.cols + 1e-9; x += step) d += `M${n1(x * k)} 0V${H}`;
      for (let y = 0; y <= spec.rows + 1e-9; y += step) d += `M0 ${n1(y * k)}H${W}`;
      return d;
    };
    let g = "";
    if (spec.grid.sub && s > 1) g += `<path d="${line(1)}" stroke="${INK}" stroke-opacity="0.16" stroke-width="${n1(0.8 * u)}"/>`;
    g += `<path d="${line(s)}" stroke="${INK}" stroke-opacity="0.38" stroke-width="${n1(1.1 * u)}"/>`;
    const clip = spec.grid.clip === "floor";
    if (clip) defs.push(`<mask id="floor-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${floor("#ffffff", 0)}</mask>`);
    parts.push(`<g id="grid" fill="none"${clip ? ' mask="url(#floor-mask)"' : ""}>${g}</g>`);
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
    let nums3 = "", names = "";
    for (const g of l.rooms) {
      const x = g.cx * k, y = g.cy * k, badge = on.numbers && g.number !== void 0;
      if (badge) {
        const txt = String(g.number), fs = numberSize(u, o.pageScale), bh = fs * 1.45, bw = Math.max(bh, txt.length * fs * 0.62 + fs * 0.7);
        nums3 += `<rect x="${n1(x - bw / 2)}" y="${n1(y - bh / 2)}" width="${n1(bw)}" height="${n1(bh)}" rx="${n1(bh * 0.32)}" fill="${INK}"/><text x="${n1(x)}" y="${n1(y + fs * 0.36)}" font-size="${n1(fs)}" font-weight="700" text-anchor="middle" fill="${PAPER}">${esc(txt)}</text>`;
      }
      if (on.labels && g.room.label) names += haloText(g.room.label, x, y + (badge ? numberSize(u, o.pageScale) * (31 / 19) : 5 * u), nameSize(u, o.pageScale), INK, TH, 'font-weight="700"');
    }
    if (nums3) parts.push(`<g id="numbers">${nums3}</g>`);
    if (names) parts.push(`<g id="room-labels">${names}</g>`);
  }
  if (on.labels && spec.overlay.labels.length) {
    const at2 = dungeonLabelLayout(spec, k, o.pageScale, l, on.numbers).at;
    const g = spec.overlay.labels.map((lb, i) => {
      const base = labelSize2(lb, u, o.pageScale), lx = at2[i].x / k, ly = at2[i].y / k;
      const attrs = lb.kind === "area" ? `font-weight="700" letter-spacing="${n1(base * 0.16)}"` : lb.kind === "name" ? 'font-weight="700"' : 'font-style="italic"';
      const tx = haloText(lb.kind === "area" ? lb.text.toUpperCase() : lb.text, lx * k, ly * k + base * 0.35, base, INK, TH, attrs);
      return lb.angle ? `<g transform="rotate(${n1(lb.angle)} ${n1(lx * k)} ${n1(ly * k)})">${tx}</g>` : tx;
    }).join("");
    parts.push(`<g id="labels">${g}</g>`);
  }
  const box = (x, y, w, h) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(u)}"/>`;
  const pad = 12 * u;
  if (on.legend) {
    const kinds = [...new Set(spec.overlay.symbols.map((s) => s.kind))];
    if (kinds.length) {
      const rh = 22 * u, fs = 12 * u, bw = 190 * u, bh = kinds.length * rh + 12 * u, x = fr.r - bw - pad, y = fr.b - bh - pad;
      let g = box(x, y, bw, bh);
      kinds.forEach((kind, i) => {
        const sy = y + 6 * u + i * rh + rh / 2, sym = SYMBOLS2[kind] ?? SYMBOLS2.trap;
        g += `<g transform="translate(${n1(x + 18 * u)} ${n1(sy)}) scale(${(18 * u / 20).toFixed(3)})">${sym.svg.replaceAll("{ink}", INK).replaceAll("{fill}", PAPER)}</g>`;
        g += `<text x="${n1(x + 36 * u)}" y="${n1(sy + fs * 0.35)}" font-size="${n1(fs)}" fill="${INK}">${esc(LEGEND_NAMES(kind))}</text>`;
      });
      parts.push(`<g id="legend">${g}</g>`);
    }
  }
  if (on.scale) {
    const n = scaleCells2(fr.w / k), len = n * k, fs = 11 * u, x = fr.x + pad + 8 * u, y = fr.b - pad - 20 * u, seg = Math.min(4, n);
    let g = box(fr.x + pad, y - 18 * u, len + 34 * u, 40 * u);
    for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + len / seg * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? PAPER : INK}" stroke="${INK}" stroke-width="${n1(0.8 * u)}"/>`;
    g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${INK}" text-anchor="middle">0</text>`;
    g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${INK}" text-anchor="middle">${n * spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${INK}" text-anchor="middle">1 square = ${spec.scale.perCell} ${esc(spec.scale.unit)}</text>`;
    parts.push(`<g id="scale">${g}</g>`);
  }
  if (on.compass) parts.push(compassSvg(fr.r - pad - 22 * u, fr.y + pad + 32 * u, 18 * u, u, TH));
  if (on.title && spec.title) {
    const fs = 24 * u, w = Math.max(120 * u, spec.title.length * fs * 0.62 + 30 * u);
    parts.push(`<g id="title">${box(fr.x + pad, fr.y + pad, w, fs * 1.7)}<text x="${n1(fr.x + pad + w / 2)}" y="${n1(fr.y + pad + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.06)}" text-anchor="middle" fill="${INK}">${esc(spec.title)}</text></g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(fr, o.unit)} font-family="${FONT}"><defs>${defs.join("")}<clipPath id="map-clip"><rect x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}"/></clipPath></defs><g clip-path="url(#map-clip)">${parts.join("")}</g></svg>`;
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
  const pt = (x, y) => [rnd(x), rnd(y)];
  const box = (b) => {
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
    box: box(g.room),
    doors: []
  }));
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const corridors = [], exits = [], reached = /* @__PURE__ */ new Set();
  spec.corridors.forEach((c, index) => {
    const geom = layout.corridors[index], doors = [c.doors?.[0] ?? null, c.doors?.[1] ?? null];
    let run = 0;
    for (let i = 2; i < geom.pts.length; i += 2) run += Math.hypot(geom.pts[i] - geom.pts[i - 2], geom.pts[i + 1] - geom.pts[i - 1]);
    run = Math.max(0, run - (geom.ends[0]?.along ?? 0) - (geom.ends[1]?.along ?? 0));
    corridors.push({ index, from: c.from, to: c.to, width: geom.width, doors, length: length(run) });
    ends.forEach((side, k) => {
      const e = c[side], p = geom.ends[k], other = roomOf(c[ends[1 - k]]);
      if ("room" in e) {
        reached.add(e.room);
        if (doors[k]) byId.get(e.room)?.doors.push({ kind: doors[k], at: p ? pt(p.x, p.y) : null, corridor: index, to: other });
      } else {
        const [x, y] = e.at, dist = [["n", y], ["e", spec.cols - x], ["s", spec.rows - y], ["w", x]];
        const [edge, d] = dist.reduce((a, b) => b[1] < a[1] ? b : a);
        exits.push({ corridor: index, end: side, at: pt(x, y), room: other, door: doors[k], edge, distance: length(d) });
      }
    });
  });
  const overlaps2 = [];
  for (let a = 0; a < layout.rooms.length; a++) for (let b = a + 1; b < layout.rooms.length; b++) {
    const A = layout.rooms[a], B = layout.rooms[b], cells = [];
    const x0 = Math.floor(Math.max(A.room.x, B.room.x)), x1 = Math.ceil(Math.min(A.room.x + A.room.w, B.room.x + B.room.w));
    const y0 = Math.floor(Math.max(A.room.y, B.room.y)), y1 = Math.ceil(Math.min(A.room.y + A.room.h, B.room.y + B.room.h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inPolygon(A.outline, x + 0.5, y + 0.5) && inPolygon(B.outline, x + 0.5, y + 0.5)) cells.push([x, y]);
    if (!cells.length) continue;
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]), bx = Math.min(...xs), by = Math.min(...ys);
    overlaps2.push({ rooms: [A.room.id, B.room.id], cells, count: cells.length, box: box({ x: bx, y: by, w: Math.max(...xs) + 1 - bx, h: Math.max(...ys) + 1 - by }) });
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
  const labels = take("labels", target.overlay.labels, from.overlay.labels), symbols = take("symbols", target.overlay.symbols, from.overlay.symbols);
  const ids = new Set(rooms.list.map((r) => r.id));
  const dropped = (name, list2, source, refs) => list2.filter((e) => {
    const missing = refs(e).find((id) => !ids.has(id));
    if (missing === void 0 || e.origin === origin) return true;
    conflicts.push({ kind: "dropped", list: name, index: source.indexOf(e), message: `${name}[${source.indexOf(e)}] is dropped: it refers to ${missing}, which the sync removed` });
    return false;
  });
  const end = (e) => "room" in e ? [e.room] : [];
  const keptCorridors = dropped("corridors", corridors.list, target.corridors, (c) => [...end(c.from), ...end(c.to)]);
  const keptWalls = dropped("walls", walls.list, target.walls ?? [], (w) => [...w.rooms ?? [], ...(w.gates ?? []).flatMap((g) => g.room ? [g.room] : [])]);
  const spec = parseDungeon({
    ...target,
    rooms: rooms.list,
    corridors: keptCorridors,
    ...(target.walls?.length || from.walls?.length) && { walls: keptWalls },
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
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
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
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
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
var Grid = class _Grid {
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
      var r12 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r12);
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
      var r12 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r12);
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
      var r12 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r12);
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
      var r12 = getInt32Memory0()[retptr / 4 + 1];
      deferred1_0 = r0;
      deferred1_1 = r12;
      return getStringFromWasm0(r0, r12);
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
      var r12 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r12);
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
      var r12 = getInt32Memory0()[retptr / 4 + 1];
      if (r12) {
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
  const img = r.render(), px = img.pixels, iw = img.width, ih = img.height, g = new Grid(w, h);
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
function createMap(p, id, preset, over = {}, force = false, at2 = id) {
  if (existsSync3(mapFile(p, at2)) && !force) throw new Error(typeof at2 === "string" ? `map ${id} already exists (edit it, or pick another id)` : `${shown(p, mapFile(p, at2))} already exists (edit it, or --force)`);
  const m = map_exports.newMap(id, preset, over);
  return { file: writeMap(p, m, at2), map: m };
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
function numbers(v, what, pairs = true) {
  const xs = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  if (!xs.length || xs.some((x) => !Number.isFinite(x)) || pairs && xs.length % 2) throw new Error(`${what}: comma-separated numbers${pairs ? " in x,y pairs" : ""}`);
  return xs;
}
function shapeFrom(o) {
  const arr = (v, what, pairs = true) => Array.isArray(v) ? v.map(Number) : numbers(v, what, pairs);
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
var at = (p) => `${p[0]},${p[1]}`;
function describeMapFacts(r) {
  const { scale, height } = r.unit, out = [`${r.id}: ${r.size.cols}\xD7${r.size.rows} cells; heights in ${height}, distances in cells (${scale})`];
  const share = (s) => s.map((x) => `${x.terrain} ${x.share}%`).join(", ");
  const hi = (h) => `${h.height} ${height} at ${at(h.at)}${h.prominence ? ` (stands ${h.prominence} ${height} clear)` : ""}`;
  for (const p of r.points ?? []) {
    out.push(`at ${at(p.at)}: ${p.terrain}, ${p.height} ${height}, slope ${p.slope.band ?? "?"} (${p.slope.gradient} ${height}/${scale})`);
    for (const k of ["river", "road"]) if (p[k]) out.push(`  ${k}: ${p[k].name}${p[k].source ? ` (${p[k].source})` : ""} ${km(p[k].distance, scale)} away at ${at(p[k].at)}${p[k].within ? ", in it" : ""}`);
    if (p.above) out.push(`  ${p.above.value === null ? `no ${p.above.of} to measure from` : `${p.above.value} ${height} above the ${p.above.of === "river" ? "river" : "lowest ground"}`}${p.above.reference ? ` (${hi(p.above.reference)})` : ""}`);
  }
  for (const a of r.areas ?? []) {
    out.push(`area ${a.area.map(at).join(" ")}: ${share(a.terrain)}; lowest ${hi(a.lowest)}, highest ${hi(a.highest)}`);
    for (const c of [...a.rivers, ...a.roads]) out.push(`  ${c.name}${c.source ? ` (${c.source})` : ""}: ${c.enters ? `in at ${at(c.enters)}` : "starts inside"}, ${c.leaves ? `out at ${at(c.leaves)}` : "ends inside"}, ${km(c.length, scale)}`);
  }
  const f = r.features;
  if (f) {
    out.push(`terrain: ${share(f.terrain)}; lowest ${hi(f.lowest)}, highest ${hi(f.highest)}`);
    for (const [what, lines] of [["river", f.rivers], ["generated river", f.generatedRivers], ["road", f.roads]])
      for (const l of lines) out.push(`${what} ${l.name}: ${km(l.length, scale)}, ${l.points.length} points from ${at(l.points[0])} to ${at(l.points[l.points.length - 1])}`);
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
function createDungeon(p, m, force = false, at2 = m.id) {
  if (existsSync4(dungeonFile(p, at2)) && !force) throw new Error(typeof at2 === "string" ? `dungeon ${m.id} already exists (edit it, or pick another id)` : `${shown2(p, dungeonFile(p, at2))} already exists (edit it, or --force)`);
  return { file: writeDungeon(p, m, at2), dungeon: m };
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
    return { file: shown2(p, f), ok: false, errors: [{ path: "", message: missing ? `no such file: ${shown2(p, f)}` : `not JSON: ${e.message}` }] };
  }
  const r = dungeon_exports.checkDungeon(raw), errors = [...r.errors];
  const u = raw?.underlay;
  if (!errors.some((e) => e.path.startsWith("underlay")) && u && typeof u.map === "string" && !existsSync4(resolve3(dirname3(f), u.map)))
    errors.push({ path: "underlay.map", message: `no such map file ${u.map}` });
  return { file: shown2(p, f), ok: !errors.length, errors };
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
  const crop = clampCrop(window ?? [0, 0, m.cols, m.rows], m.cols, m.rows), ppu = o.fit ? fitPpu(crop[2], crop[3], o.fit) : o.ppu ?? 40;
  const size = [Math.round(crop[2] * ppu), Math.round(crop[3] * ppu)], unit = o.fit?.unit ?? "px";
  const pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : void 0), underlay = readUnderlay(p, ref, m);
  if (formats.includes("png")) await initNodeMapSvg();
  mkdirSync3(out, { recursive: true });
  const svg = dungeon_exports.renderDungeonSvg(m, { ppu, layers: o.layers, layout, ...window && { crop }, unit, pageScale, ...underlay && { underlay } }), base = join4(out, id);
  if (formats.includes("svg")) {
    writeFileSync3(`${base}.svg`, svg);
    files.push(`${base}.svg`);
  }
  if (formats.includes("png")) {
    writeFileSync3(`${base}.png`, encodePNG(rasterizeSvg(svg, size[0], size[1])));
    files.push(`${base}.png`);
  }
  return { files: files.map((f) => relative2(process.cwd(), f)), rooms: m.rooms.length, corridors: m.corridors.length, doors: layout.doors.length, size, crop, ppu, svg: svgSize(crop, ppu, unit), pageScale: pageScale ?? null, unplaced: dungeon_exports.dungeonLabelLayout(m, ppu, pageScale, layout).unplaced };
}
function cornerPoint(at2) {
  const [x, y] = dungeon_exports.parsePoint(at2);
  return /^\s*-?[\d.]+\s*,/.test(at2) ? [x, y] : [Math.floor(x), Math.floor(y)];
}
function corridorEnd(m, ref) {
  return m.rooms.some((r) => r.id === ref) ? { room: ref } : { at: dungeon_exports.parsePoint(ref) };
}
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
function describeDungeon(m) {
  const g = m.gen, end = (e) => "room" in e ? e.room : `(${e.at.join(",")})`;
  const gridFt = (n) => `${n * m.scale.perCell} ${m.scale.unit}`;
  return [
    `${m.id}${m.title ? ` "${m.title}"` : ""}: ${m.cols}\xD7${m.rows} cells of ${m.scale.perCell} ${m.scale.unit}, seed ${m.seed}`,
    `  gen: rooms ${g.rooms}, size ${g.minSize}..${g.maxSize}, caves ${g.caves}, round ${g.round}, loops ${g.loops}, doors ${g.doors}, corridor width ${g.corridorWidth}, spacing ${g.spacing}, entrance ${g.entrance ? "on" : "off"}`,
    `  grid: ${m.grid.show ? `${gridFt(m.grid.size)}${m.grid.sub && m.grid.size > 1 ? ` + ${gridFt(1)}` : ""}, ${m.grid.clip === "floor" ? "on the floor" : "everywhere"}` : "off"}; hatch ${m.style.hatch}${m.style.hatch === "band" ? ` (${m.style.band} cells)` : ""}; numbers ${m.numbers ? "on" : "off"}, scale bar ${m.scaleBar ? "on" : "off"}, compass ${m.compass ? "on" : "off"}`,
    `  rooms (${m.rooms.length}):${m.rooms.map((r) => `
    ${r.id}: ${r.shape} ${r.w}\xD7${r.h} at ${r.x},${r.y}${r.fill && r.fill !== "floor" ? `, ${r.fill}` : ""}${r.number === false ? ", no number" : r.number !== void 0 ? `, #${r.number}` : ""}${r.label ? ` "${r.label}"` : ""}`).join("")}`,
    `  corridors (${m.corridors.length}):${m.corridors.map((c, i) => `
    ${i}. ${end(c.from)} \u2192 ${end(c.to)}${c.width && c.width !== 1 ? `, width ${c.width}` : ""}${c.via ? `, via ${c.via.join(",")}` : c.route && c.route !== "auto" ? `, ${c.route}` : ""}${c.doors?.some(Boolean) ? `, doors ${c.doors.map((d) => d ?? "none").join("/")}` : ""}`).join("")}`,
    `  labels (${m.overlay.labels.length}):${m.overlay.labels.map((l, i) => `
    ${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}`).join("")}`,
    `  symbols (${m.overlay.symbols.length}):${m.overlay.symbols.map((s, i) => `
    ${i}. ${s.kind} at ${s.x},${s.y}${s.angle ? ` turned ${s.angle}\xB0` : ""}`).join("")}`
  ].join("\n");
}
function describeDungeonFacts(r) {
  const unit = r.unit.scale, box = (b) => `${b.cells.w}\xD7${b.cells.h} cells (${b.scale.w}\xD7${b.scale.h} ${unit}) at ${b.cells.x},${b.cells.y}`;
  const end = (e) => "room" in e ? e.room : `(${e.at.join(",")})`;
  return [
    `${r.id}: ${r.size.cols}\xD7${r.size.rows} cells; positions in cells, lengths also in ${unit}`,
    `rooms (${r.rooms.length}):${r.rooms.map((m) => `
  ${m.id}${m.number !== null ? ` #${m.number}` : ""}: ${m.shape} ${box(m.box)}${m.label ? ` "${m.label}"` : ""}${m.doors.length ? `; doors ${m.doors.map((d) => `${d.kind}${d.at ? ` at ${d.at.join(",")}` : ""}`).join(", ")}` : ""}`).join("")}`,
    `corridors (${r.corridors.length}):${r.corridors.map((c) => `
  ${c.index}. ${end(c.from)} \u2192 ${end(c.to)}: ${c.length.map} cells (${c.length.scale} ${unit}), width ${c.width}${c.doors.some(Boolean) ? `, doors ${c.doors.map((d) => d ?? "none").join("/")}` : ""}`).join("")}`,
    `exits (${r.exits.length}):${r.exits.map((x) => `
  corridor ${x.corridor} ${x.end} at ${x.at.join(",")}${x.room ? ` from ${x.room}` : ""}: nearest edge ${x.edge}, ${x.distance.map} cells (${x.distance.scale} ${unit})`).join("")}`,
    `overlaps (${r.overlaps.length}):${r.overlaps.map((o) => `
  ${o.rooms.join(" / ")}: ${o.count} cells, ${box(o.box)}`).join("")}`,
    `unreached rooms: ${r.unreached.join(", ") || "none"}`,
    ...(r.walls ?? []).map((w) => `wall ${w.id ?? w.index}: ${w.corners.length} corners, ${w.towers.length} towers (${w.towers.filter((t) => t.source === "corner").length} at corners), thickness ${w.thickness}; ${w.enclosed.every((e) => e.inside) ? "encloses every room" : `does not enclose ${w.enclosed.filter((e) => !e.inside).map((e) => e.room).join(", ")}`}${w.gates.map((g) => `
  ${g.kind} at ${g.at.join(",")} (wall at ${g.angle}\xB0, ${g.width} wide, ${g.towers} towers${g.room ? `, opens into ${g.room}` : ""})`).join("")}`)
  ].join("\n");
}

// ../artgen-cli/src/maps-cli.ts
function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : void 0;
}
function list(args, name) {
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
var num = (args, name) => {
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
       artgen dungeon new <id> [--size 40x30] [--seed n] [--title "..."] [--empty] | new <id> --room rect|circle|octagon|cave --room-size 8x6 [--exits n,e:secret,s:none,w] [--label "..."] [--number n|off]
       artgen dungeon gen <id> [--seed n] [--rooms n] [--min-size n] [--max-size n] [--caves f] [--round f] [--loops f] [--doors f] [--corridor-width n] [--spacing n] [--entrance on|off] [--size 40x30]
       artgen dungeon room <id> add <shape> --at x,y|C4 --size WxH [--points x,y,\u2026] [--label "..."] [--number n|off] [--room-id r9] [--fill floor|building|yard|cellar] [--origin name] | move <rid> --at x,y | set <rid> [--shape s] [--size WxH] [--label "..."] [--number n|off] [--fill f] | rm <rid>
       artgen dungeon link <id> <room> <room|x,y|C4> [--width 1] [--route auto|hv|vh|straight] [--via x,y,\u2026] [--doors door,none] [--origin name] | unlink <id> <i> | door <id> <i> from|to <kind|none>
                  (shapes: ${dungeon_exports.ROOM_SHAPES.join(", ")}; doors: ${dungeon_exports.DOOR_KINDS.join(", ")})
       artgen dungeon grid <id> 10|5|10+5|none [--clip floor|all] | style <id> [--hatch band|full|none] [--band n] [--wall f] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--title "..."] [--per-cell n] [--unit ft]
       artgen dungeon label <id> "Text" --at x,y|C4 [--kind name|note|area] [--size f] [--angle deg] [--origin name] | symbol <id> <kind> --at x,y|C4 [--scale f] [--angle deg] [--origin name] | symbols
       artgen dungeon overlay <id> rm label|symbol <i> | clear [labels|symbols] | fit <id> [--margin 2]
       artgen dungeon check <id> [--json]   every error in the file with its JSON path; exits 1 when there are any
       artgen map sync <id>|--file target.json --from new.json --origin tables [--json]   replace the entries of one origin, keep every other (hand entries last); lists what that disturbs
       artgen dungeon sync <id>|--file target.json --from new.json --origin tables [--json]   the same for rooms, corridors, walls, labels and symbols; a hand-edited field of a generated room is reported and the table's value kept
       artgen dungeon facts <id> [--json]   each room's box and doors, each corridor's ends and length, the exits, the overlapping rooms and the rooms no corridor reaches
       artgen dungeon render <id> [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h] [--room id|F.3 \u2026 [--margin 2]] [--layers grid=off,labels=off] [--out dir] | show <id> | list
         (--room, repeated, crops round those rooms, their doors and the first --margin cells of each corridor)
       artgen formats   (the map and dungeon file format versions this artgen reads; a newer file is refused)
       (map and dungeon commands take --file <path> in place of <id>: no project needed; renders go beside the file or to --out)`;
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
      seed: num(args, "--seed") ?? Math.floor(Math.random() * 1e6),
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
      if (num(args, "--seed") !== void 0) m2.seed = num(args, "--seed");
      const land = flag(args, "--land");
      if (land) m2.gen.land = land;
      for (const k of ["sea", "moisture", "roughness", "relief", "rivers", "simplify", "feature"]) {
        const v = num(args, `--${k}`);
        if (v !== void 0) m2.gen[k] = v;
      }
      if (num(args, "--interval") !== void 0) m2.topo.interval = num(args, "--interval");
      if (num(args, "--max-elevation") !== void 0) m2.topo.maxElevation = num(args, "--max-elevation");
      if (num(args, "--major-every") !== void 0) m2.topo.majorEvery = num(args, "--major-every");
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
      } else if (op === "elevate") m2.edits.push({ op, amount: num(args, "--amount") ?? 0.2, shape: shape() });
      else if (op === "river") m2.edits.push({ op, points: numbers(flag(args, "--points"), "--points"), ...num(args, "--width") !== void 0 && { width: num(args, "--width") }, ...onOff(flag(args, "--delta")) === false && { delta: false } });
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
      if (num(args, "--size") !== void 0) m2.grid.size = num(args, "--size");
      if (onOff(flag(args, "--coords")) !== void 0) m2.grid.coords = onOff(flag(args, "--coords"));
    });
    print(`${m.id}: grid ${m.grid.type}${m.grid.type !== "none" ? ` size ${m.grid.size}${m.grid.coords ? ", coordinates" : ""}` : ""}
${next(m.id)}`, m.grid);
    return 0;
  }
  if (sub === "label" || sub === "symbol") {
    const what = pos[1], at2 = flag(args, "--at");
    if (!what || !at2) throw new Error(sub === "label" ? 'map label <id> "Text" --at x,y|0304|C4' : "map symbol <id> <kind> --at x,y|0304|C4 (kinds: artgen map symbols)");
    const m = updateMap(p, need("<id>"), (m2) => {
      const [x, y] = map_exports.parsePoint(m2, at2);
      if (sub === "label") {
        const kind = flag(args, "--kind") ?? "place";
        if (!map_exports.LABEL_KINDS.includes(kind)) throw new Error(`--kind: ${map_exports.LABEL_KINDS.join(", ")}`);
        m2.overlay.labels.push({ text: what, x, y, kind, ...num(args, "--size") !== void 0 && { size: num(args, "--size") }, ...num(args, "--angle") !== void 0 && { angle: num(args, "--angle") }, ...originFlag(args) });
      } else {
        if (!map_exports.SYMBOLS[what]) throw new Error(`unknown symbol ${what} (have: ${map_exports.SYMBOL_KINDS.join(", ")})`);
        m2.overlay.symbols.push({ kind: what, x, y, ...num(args, "--scale") !== void 0 && { scale: num(args, "--scale") }, ...num(args, "--angle") !== void 0 && { angle: num(args, "--angle") }, ...originFlag(args) });
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
        const list2 = which === "label" ? m2.overlay.labels : which === "symbol" ? m2.overlay.symbols : null, i = Number(index);
        if (!list2 || !Number.isInteger(i) || i < 0 || i >= list2.length) throw new Error(`map overlay <id> rm label|symbol <index> (labels 0..${m2.overlay.labels.length - 1}, symbols 0..${m2.overlay.symbols.length - 1})`);
        list2.splice(i, 1);
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
      if (num(args, "--per-cell") !== void 0) m2.scale.perCell = num(args, "--per-cell");
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
      ppu: num(args, "--ppu"),
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
function handEdit(r, fields) {
  if (r.origin) r.hand = [.../* @__PURE__ */ new Set([...r.hand ?? [], ...fields])];
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
    if (num(args, "--seed") !== void 0) m.seed = num(args, "--seed");
    const sz = sizeFlag(args, "--size");
    if (sz) [m.cols, m.rows] = sz;
    for (const [f, k] of [["--rooms", "rooms"], ["--min-size", "minSize"], ["--max-size", "maxSize"], ["--caves", "caves"], ["--round", "round"], ["--loops", "loops"], ["--doors", "doors"], ["--corridor-width", "corridorWidth"], ["--spacing", "spacing"]]) {
      const v = num(args, f);
      if (v !== void 0) m.gen[k] = v;
    }
    if (onOff(flag(args, "--entrance")) !== void 0) m.gen.entrance = onOff(flag(args, "--entrance"));
  };
  if (sub === "new") {
    const base = dungeon_exports.newDungeon(file ? id ?? fileId(file) : need("<id> is required"), { seed: Math.floor(Math.random() * 1e6), ...flag(args, "--title") && { title: flag(args, "--title") } });
    genFlags(base);
    let m = dungeon_exports.parseDungeon(base);
    const shape = flag(args, "--room");
    if (shape) {
      if (!dungeon_exports.ROOM_SHAPES.includes(shape) || shape === "poly") throw new Error("--room: rect, circle, octagon or cave");
      const [w, h] = sizeFlag(args, "--room-size") ?? [8, 8];
      const exits = (list(args, "--exits") ?? []).map((e) => {
        const [side, kind] = e.split(":");
        if (!["n", "e", "s", "w"].includes(side)) throw new Error("--exits: sides n, e, s, w, each optionally :door kind (n,e:secret,s:none)");
        return { side, door: kind === void 0 ? void 0 : doorPair(kind)[0] };
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
        const r = m2.rooms.find((r2) => r2.id === rid);
        if (!r) throw new Error(`no room ${rid} (have: ${m2.rooms.map((r2) => r2.id).join(", ") || "none"})`);
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
          const at2 = flag(args, "--at"), sz = sizeFlag(args, "--size");
          if (!at2 || !sz) throw new Error("dungeon room <id> add <shape> --at x,y|C4 --size WxH");
          const [x, y] = cornerPoint(at2);
          room = { id: roomId, shape, x, y, w: sz[0], h: sz[1] };
        }
        if (label) room.label = label;
        if (n !== void 0) room.number = n;
        const fill = fillFlag(args);
        if (fill) room.fill = fill;
        Object.assign(room, originFlag(args));
        m2.rooms.push(room);
        summary = `added ${shape} room ${roomId}`;
      } else if (op === "move") {
        const r = find(), at2 = flag(args, "--at");
        if (!at2) throw new Error("dungeon room <id> move <rid> --at x,y|C4");
        const [x, y] = cornerPoint(at2), dx = x - r.x, dy = y - r.y;
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
        summary = `changed ${r.id}`;
      } else if (op === "rm") {
        const r = find(), before = m2.corridors.length;
        m2.rooms = m2.rooms.filter((x) => x !== r);
        m2.corridors = m2.corridors.filter((c) => !("room" in c.from && c.from.room === r.id || "room" in c.to && c.to.room === r.id));
        summary = `removed ${r.id} and ${before - m2.corridors.length} corridors`;
      } else throw new Error("dungeon room <id> add|move|set|rm");
    });
    print(`${m.id}: ${summary} (${m.rooms.length} rooms)
${next(m.id)}`, m.rooms);
    return 0;
  }
  if (sub === "link") {
    const [, a, b] = pos;
    if (!a || !b) throw new Error("dungeon link <id> <room> <room|x,y|C4>");
    const m = updateDungeon(p, need("<id>"), (m2) => {
      const route2 = flag(args, "--route"), doors = doorPair(flag(args, "--doors"));
      if (route2 && !dungeon_exports.ROUTES.includes(route2)) throw new Error(`--route: ${dungeon_exports.ROUTES.join(", ")}`);
      m2.corridors.push({
        from: corridorEnd(m2, a),
        to: corridorEnd(m2, b),
        ...num(args, "--width") !== void 0 && { width: num(args, "--width") },
        ...route2 && { route: route2 },
        ...flag(args, "--via") && { via: numbers(flag(args, "--via"), "--via") },
        ...doors && { doors },
        ...originFlag(args)
      });
    });
    print(`${m.id}: corridor ${m.corridors.length - 1}: ${a} \u2192 ${b}
${next(m.id)}`, m.corridors);
    return 0;
  }
  if (sub === "unlink" || sub === "door") {
    const i = Number(pos[1]);
    const m = updateDungeon(p, need(`<id> <index>`), (m2) => {
      if (!Number.isInteger(i) || i < 0 || i >= m2.corridors.length) throw new Error(`dungeon ${sub} <id> <index> (corridors 0..${m2.corridors.length - 1}; artgen dungeon show)`);
      if (sub === "unlink") {
        m2.corridors.splice(i, 1);
        return;
      }
      const end = pos[2], kind = doorPair(pos[3] ?? "none")[0];
      if (end !== "from" && end !== "to") throw new Error("dungeon door <id> <index> from|to <kind|none>");
      const c = m2.corridors[i], d = c.doors ?? [null, null];
      c.doors = end === "from" ? [kind, d[1]] : [d[0], kind];
    });
    print(`${m.id}: ${m.corridors.length} corridors
${next(m.id)}`, m.corridors);
    return 0;
  }
  if (sub === "grid") {
    const mode = pos[1];
    if (!mode) throw new Error("dungeon grid <id> 10|5|10+5|none [--clip floor|all]");
    const m = updateDungeon(p, need("<id>"), (m2) => {
      m2.grid = gridMode(m2, mode);
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
      if (num(args, "--band") !== void 0) m2.style.band = num(args, "--band");
      if (num(args, "--wall") !== void 0) m2.style.wall = num(args, "--wall");
      const t = flag(args, "--title");
      if (t !== void 0) {
        if (t) m2.title = t;
        else delete m2.title;
      }
      for (const [f, k] of [["--numbers", "numbers"], ["--scale-bar", "scaleBar"], ["--compass", "compass"], ["--legend", "legend"]]) {
        const v = onOff(flag(args, f));
        if (v !== void 0) m2[k] = v;
      }
      if (num(args, "--per-cell") !== void 0) m2.scale.perCell = num(args, "--per-cell");
      if (flag(args, "--unit")) m2.scale.unit = flag(args, "--unit");
    });
    print(`${describeDungeon(m)}
${next(m.id)}`, m);
    return 0;
  }
  if (sub === "label" || sub === "symbol") {
    const what = pos[1], at2 = flag(args, "--at");
    if (!what || !at2) throw new Error(sub === "label" ? 'dungeon label <id> "Text" --at x,y|C4' : "dungeon symbol <id> <kind> --at x,y|C4 (kinds: artgen dungeon symbols)");
    const m = updateDungeon(p, need("<id>"), (m2) => {
      const [x, y] = dungeon_exports.parsePoint(at2), angle = num(args, "--angle");
      if (sub === "label") {
        const kind = flag(args, "--kind") ?? "name";
        if (!dungeon_exports.LABEL_KINDS.includes(kind)) throw new Error(`--kind: ${dungeon_exports.LABEL_KINDS.join(", ")}`);
        m2.overlay.labels.push({ text: what, x, y, kind, ...num(args, "--size") !== void 0 && { size: num(args, "--size") }, ...angle !== void 0 && { angle }, ...originFlag(args) });
      } else {
        if (!dungeon_exports.SYMBOLS[what]) throw new Error(`unknown symbol ${what} (have: ${dungeon_exports.SYMBOL_KINDS.join(", ")})`);
        m2.overlay.symbols.push({ kind: what, x, y, ...num(args, "--scale") !== void 0 && { scale: num(args, "--scale") }, ...angle !== void 0 && { angle }, ...originFlag(args) });
      }
    });
    const n = sub === "label" ? m.overlay.labels.length : m.overlay.symbols.length;
    print(`${m.id}: ${sub} ${n - 1} "${what}"
${next(m.id)}`, sub === "label" ? m.overlay.labels : m.overlay.symbols);
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
    print(r.ok ? `${r.file}: ok` : [`${r.file}: ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}`, ...r.errors.map((e) => `  ${e.path || "(file)"}: ${e.message}`)].join("\n"), r);
    return r.ok ? 0 : 1;
  }
  if (sub === "fit") {
    const m = updateDungeon(p, need("<id>"), (m2) => dungeon_exports.fitDungeon(m2, num(args, "--margin") ?? 2));
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
      ppu: num(args, "--ppu"),
      pageScale: pageScaleFlag(args),
      ...viewFlags(args, 1),
      rooms: args.flatMap((a, i) => a === "--room" ? [args[i + 1] ?? (() => {
        throw new Error("--room: a room id");
      })()] : []),
      margin: num(args, "--margin"),
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
  throw new Error("dungeon: new | gen | room | link | unlink | door | grid | style | label | symbol | symbols | overlay | check | fit | render | show | facts | sync | list (artgen --help)");
}
function formatsCommand(emit) {
  const formats = { map: map_exports.MAP_FORMAT, dungeon: dungeon_exports.DUNGEON_FORMAT };
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
    console.log(`artgen-maps ${MAPS_VERSION} \u2014 the artgen map and dungeon engines, usable alone.

usage:
${MAP_USAGE}
       artgen-maps.js --version | --help`);
    return 0;
  }
  if (cmd === "formats") return formatsCommand(print);
  if (cmd === "map") return mapCommand(sub, args, print);
  if (cmd === "dungeon") return dungeonCommand(sub, args, print);
  throw new Error(`artgen-maps: ${cmd}: not a command here; this bundle has map, dungeon and formats (--help)`);
}
var MAPS_VERSION = `${true ? "0.10.0" : "dev"} (${true ? "da9eb9c" : "unknown"})`;

// ../artgen-cli/src/maps-bin.ts
mapsMain(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
