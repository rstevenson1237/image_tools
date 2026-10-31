#!/usr/bin/env node
import { createRequire as __artgenRequire } from 'node:module'; const require = __artgenRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../artgen-cli/src/maps-cli.ts
import { readFileSync as readFileSync14 } from "node:fs";

// ../artgen-cli/src/projectfs.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
var CONFIG_FILE = "artgen.config.json";
var fileStem = (file) => basename(file, extname(file));
var fileId = (file) => fileStem(file).replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "map";
function findProject(start = process.cwd()) {
  for (let d = resolve(start); ; d = dirname(d)) {
    if (existsSync(join(d, "art", CONFIG_FILE))) return { root: d, art: join(d, "art") };
    if (dirname(d) === d) return null;
  }
}
function requireProject(start) {
  const p2 = findProject(start);
  if (!p2) throw new Error("no artgen project here (art/artgen.config.json not found up the tree) \u2014 run `artgen init` in the game repo root");
  return p2;
}
var readJson = (p2) => JSON.parse(readFileSync(p2, "utf8"));
var writeJson = (p2, v) => {
  mkdirSync(dirname(p2), { recursive: true });
  writeFileSync(p2, JSON.stringify(v, null, 2) + "\n");
};

// ../artgen-cli/src/ops/registry.ts
var defineOp = (op) => op;
var isExcluded = (x) => "exclude" in x;
var cliOf = (op) => isExcluded(op.cli) ? null : op.cli;
var p = {
  str: (doc2, o = {}) => ({ kind: "string", doc: doc2, ...o }),
  num: (doc2, o = {}) => ({ kind: "number", doc: doc2, ...o }),
  int: (doc2, o = {}) => ({ kind: "integer", doc: doc2, ...o }),
  bool: (doc2, o = {}) => ({ kind: "boolean", doc: doc2, style: "switch", ...o }),
  oneOf: (values, doc2, o = {}) => ({ kind: "enum", values, doc: doc2, ...o }),
  list: (item, doc2, o = {}) => ({ kind: "list", item, doc: doc2, ...o }),
  points: (doc2, o = {}) => ({ kind: "points", doc: doc2, ...o }),
  size: (doc2, o = {}) => ({ kind: "size", doc: doc2, ...o }),
  json: (schema, doc2, o = {}) => ({ kind: "json", schema, doc: doc2, ...o })
};
var onOff = (v) => /^(on|true|yes|1)$/i.test(v);
var flagOf = (key, par) => par.flag ?? `--${key.replace(/_/g, "-")}`;
var wordsOf = (op) => op.name.split(".");
var KIND_WORD = { string: "<value>", number: "number", integer: "whole number", boolean: "", enum: "", list: "a,b,\u2026", points: "x,y,\u2026", size: "WxH", json: "json | @file" };
function usageLines(op) {
  const c = cliOf(op);
  return c ? (Array.isArray(c.usage) ? c.usage : [c.usage]).filter(Boolean) : [];
}
function opHelp(op) {
  const words = wordsOf(op).join(" "), params = Object.entries(op.params).filter(([, par]) => par.cli !== false);
  const pos = params.filter(([, par]) => par.positional).map(([k, par]) => (par.required ? `<${k}>` : `[${k}]`) + (par.positional === "rest" ? "\u2026" : ""));
  const own = usageLines(op);
  const rows2 = params.map(([k, par]) => {
    const name = par.positional ? `<${k}>` : flagOf(k, par), what = par.positional ? "" : par.kind === "enum" ? par.values.join("|") : par.kind === "boolean" ? par.style === "onoff" ? "on|off" : par.style === "either" ? "[on|off]" : "" : KIND_WORD[par.kind];
    return `  ${[name, what].filter(Boolean).join(" ").padEnd(30)} ${par.doc ?? ""}${par.repeat ? " (repeatable)" : ""}`.trimEnd();
  });
  return [
    ...own.length ? own : [`       artgen ${[words, ...pos].join(" ")}${params.some(([, par]) => !par.positional) ? " [flags]" : ""}`],
    "",
    op.summary,
    "",
    ...rows2,
    "",
    `  --json                         print machine-readable output`,
    `  --root <dir>                   the game repo (default: found from here upward)`
  ].join("\n");
}

// ../artgen-cli/src/ops/cli.ts
var isSwitch = (par) => par.kind === "boolean" && par.style !== "onoff";
function convert(par, raw, name, io) {
  const bad = (what) => {
    throw new Error(`${name}: ${par.error ?? what}`);
  };
  switch (par.kind) {
    case "string":
      return raw;
    case "number":
      return Number.isFinite(+raw) ? +raw : bad("a number");
    case "integer":
      return Number.isInteger(+raw) && raw.trim() !== "" ? +raw : bad("a whole number");
    case "boolean":
      return onOff(raw);
    case "enum":
      return par.values.includes(raw) ? raw : bad(par.values.join(", "));
    case "list": {
      const xs = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (par.item !== "number") return xs;
      const ns = xs.map(Number);
      return ns.some((n) => !Number.isFinite(n)) ? bad("comma-separated numbers") : ns;
    }
    case "points": {
      const ns = raw.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
      return !ns.length || ns.some((n) => !Number.isFinite(n)) || ns.length % 2 ? bad("comma-separated numbers in x,y pairs") : ns;
    }
    case "size": {
      const m = raw.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
      return m ? [+m[1], +m[2]] : bad("WIDTHxHEIGHT, e.g. 8x6");
    }
    case "json": {
      let text2 = raw;
      if (raw.startsWith("@")) {
        if (!io.readFile) bad("@file is not available here");
        text2 = io.readFile(raw.slice(1));
      }
      try {
        return JSON.parse(text2);
      } catch (e) {
        return bad(`not JSON (${e.message})`);
      }
    }
  }
}
function findOp(ops, argv) {
  let best;
  for (const op of ops) {
    const w = wordsOf(op);
    if (cliOf(op) && w.length <= argv.length && w.every((x, i) => argv[i] === x) && (!best || w.length > wordsOf(best).length)) best = op;
  }
  return best;
}
function parseCli(ops, argv, io = {}) {
  const op = findOp(ops, argv);
  if (!op) {
    if (io.unknown) io.unknown(argv);
    throw new Error(`artgen: unknown command '${argv.slice(0, 2).join(" ")}' \u2014 run artgen --help for the list`);
  }
  const words = wordsOf(op), cmd = words.join(" "), tokens = argv.slice(words.length);
  if (tokens.includes("--help")) return { op, values: {}, json: false, help: true };
  const params = Object.entries(op.params).filter(([, par]) => par.cli !== false);
  const flags2 = new Map(params.filter(([, par]) => !par.positional).map(([k, par]) => [flagOf(k, par), [k, par]]));
  const values = {}, positionals = [];
  let json = false, root;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.startsWith("--")) {
      positionals.push(t);
      continue;
    }
    if (t === "--json") {
      json = true;
      continue;
    }
    if (t === "--root") {
      if (tokens[i + 1] === void 0) throw new Error("--root: a folder is required");
      root = tokens[++i];
      continue;
    }
    const hit = flags2.get(t);
    if (!hit) throw new Error(`artgen ${cmd}: unknown flag ${t} (artgen ${cmd} --help)`);
    const [key, par] = hit;
    if (isSwitch(par)) {
      const next4 = tokens[i + 1];
      if (par.style === "either" && next4 !== void 0 && /^(on|off|true|false|yes|no)$/i.test(next4)) {
        values[key] = onOff(next4);
        i++;
      } else values[key] = true;
      continue;
    }
    if (tokens[i + 1] === void 0) throw new Error(`${t}: a value is required`);
    const take = (raw) => convert(par, raw, t, io);
    if (par.multi) {
      const got = [take(tokens[++i])];
      while (i + 1 < tokens.length && !tokens[i + 1].startsWith("--")) got.push(take(tokens[++i]));
      values[key] = [...values[key] ?? [], ...got];
    } else if (par.repeat) values[key] = [...values[key] ?? [], take(tokens[++i])];
    else values[key] = take(tokens[++i]);
  }
  const fileMode = op.params.path?.flag === "--file" && values.path !== void 0, skipId = fileMode && !op.name.endsWith(".new");
  const slots = params.filter(([k, par]) => par.positional && !(skipId && k === "id"));
  let at4 = 0;
  for (const [k, par] of slots) {
    if (par.positional === "rest") {
      values[k] = positionals.slice(at4).map((s) => convert(par, s, `<${k}>`, io));
      at4 = positionals.length;
    } else if (at4 < positionals.length) values[k] = convert(par, positionals[at4++], `<${k}>`, io);
  }
  if (at4 < positionals.length) throw new Error(`artgen ${cmd}: unexpected argument ${positionals[at4]} (artgen ${cmd} --help)`);
  for (const [k, par] of params) {
    if (!par.required || values[k] !== void 0 || fileMode && k === "id") continue;
    throw new Error(typeof par.required === "string" ? par.required : par.positional ? `${cmd}: <${k}> is required` : `${flagOf(k, par)} is required`);
  }
  return { op, values, json, root, help: false };
}
async function runCli(ops, argv, io) {
  const { op, values, json, root, help } = parseCli(ops, argv, io), cli = cliOf(op);
  if (help) {
    io.log(opHelp(op));
    return 0;
  }
  const r = await op.run(values, io.ctx(root));
  if (cli.output) cli.output(r, values, { json, log: io.log });
  else io.log(json ? JSON.stringify(cli.json ? cli.json(r, values) : r, null, 2) : cli.text ? cli.text(r, values) : JSON.stringify(r, null, 2));
  return cli.exit ? cli.exit(r, values) : 0;
}

// ../artgen-cli/src/ops/core.ts
import { spawn } from "node:child_process";
import { existsSync as existsSync12, readFileSync as readFileSync12, writeFileSync as writeFileSync11 } from "node:fs";
import { dirname as dirname11, join as join12 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// ../artgen-cli/src/loop/feedback-bundle.ts
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync as existsSync6, mkdirSync as mkdirSync5, readdirSync as readdirSync4, readFileSync as readFileSync6, statSync, writeFileSync as writeFileSync5 } from "node:fs";
import { basename as basename2, dirname as dirname5, join as join6, relative as relative4, resolve as resolve5, sep } from "node:path";

// ../artgen-cli/src/dungeon.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync3, readdirSync as readdirSync2, readFileSync as readFileSync4, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname as dirname3, join as join4, relative as relative2, resolve as resolve3 } from "node:path";

// ../artgen-mapgen/src/map/index.ts
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

// ../artgen-primitives/src/format.ts
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

// ../artgen-mapgen/src/map/spec.ts
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
function newMap(id2, preset = "regional", over = {}) {
  const d = structuredClone(PRESET_DEFAULTS[preset]);
  return parseMap({ ...d, ...over, id: id2, version: MAP_FORMAT, preset, seed: over.seed ?? 1, gen: { ...d.gen, ...over.gen }, topo: { ...d.topo, ...over.topo }, grid: { ...d.grid, ...over.grid }, scale: { ...d.scale, ...over.scale }, edits: over.edits ?? [], overlay: over.overlay ?? { labels: [], symbols: [] } });
}
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
var nums = (v) => Array.isArray(v) && v.every(isNum);
function originError(entry, at4, e) {
  const v = entry?.origin;
  if (v !== void 0 && (typeof v !== "string" || !v)) e.push(`${at4}.origin: a non-empty string`);
}
function shapeErrors(s, at4) {
  if (!s || typeof s !== "object") return [`${at4}: shape required ({circle:[x,y,r]}, {poly:[x,y,\u2026]} or {stroke:[x,y,\u2026], width})`];
  const o = s;
  if ("circle" in o) return nums(o.circle) && o.circle.length === 3 && o.circle[2] > 0 ? [] : [`${at4}.circle: [x, y, r] with r > 0`];
  if ("poly" in o) return nums(o.poly) && o.poly.length >= 6 && o.poly.length % 2 === 0 ? [] : [`${at4}.poly: at least 3 x,y pairs`];
  if ("stroke" in o) return nums(o.stroke) && o.stroke.length >= 2 && o.stroke.length % 2 === 0 && isNum(o.width) && o.width > 0 ? [] : [`${at4}.stroke: x,y pairs and width > 0`];
  return [`${at4}: unknown shape (circle, poly or stroke)`];
}
function requirementErrors(m) {
  const e = [], list6 = m.require;
  if (list6 === void 0) return e;
  if (!Array.isArray(list6)) return ["require: an array"];
  const seen = /* @__PURE__ */ new Set(), top = isNum(m.topo?.maxElevation) ? m.topo.maxElevation : Infinity;
  list6.forEach((r, i) => {
    const at4 = `require[${i}]`;
    if (!r || typeof r !== "object") {
      e.push(`${at4}: an object`);
      return;
    }
    if (typeof r.id !== "string" || !/^[\w.-]+$/.test(r.id)) e.push(`${at4}.id: letters, digits, - . and _ only`);
    else if (seen.has(r.id)) e.push(`${at4}.id: ${r.id} is used twice`);
    else seen.add(r.id);
    if (r.blend !== void 0 && !(isNum(r.blend) && r.blend >= 0)) e.push(`${at4}.blend: map units, 0 or more`);
    originError(r, at4, e);
    if (r.kind === "terrain") {
      e.push(...shapeErrors(r.area, `${at4}.area`));
      if (!TERRAINS.includes(r.terrain)) e.push(`${at4}.terrain: one of ${TERRAINS.join(", ")}`);
      else if (r.terrain === "snow" && m.preset === "local") e.push(`${at4}.terrain: snow does not appear on a local map`);
      if (!isNum(r.share) || r.share <= 0 || r.share > 1) e.push(`${at4}.share: above 0 and at most 1`);
    } else if (r.kind === "height") {
      e.push(...shapeErrors(r.area, `${at4}.area`));
      if (!isNum(r.low) || !isNum(r.high) || r.low < 0 || r.high <= r.low) e.push(`${at4}: low and high, 0 \u2264 low < high`);
      else if (r.high > top) e.push(`${at4}.high: at most topo.maxElevation (${top})`);
      if (r.share !== void 0 && !(isNum(r.share) && r.share > 0 && r.share <= 1)) e.push(`${at4}.share: above 0 and at most 1`);
    } else if (r.kind === "path") {
      if (r.path !== "stream" && r.path !== "road") e.push(`${at4}.path: stream or road`);
      if (!nums(r.points) || r.points.length < 4 || r.points.length % 2) e.push(`${at4}.points: at least 2 x,y pairs`);
      if (r.tolerance !== void 0 && !(isNum(r.tolerance) && r.tolerance > 0)) e.push(`${at4}.tolerance: map units, above 0`);
      if (r.width !== void 0 && !(isNum(r.width) && r.width > 0)) e.push(`${at4}.width: > 0`);
      if (r.delta !== void 0 && typeof r.delta !== "boolean") e.push(`${at4}.delta: true or false`);
    } else if (r.kind === "clear") e.push(...shapeErrors(r.area, `${at4}.area`));
    else e.push(`${at4}.kind: ${REQUIREMENT_KINDS.join(", ")}`);
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
    const at4 = `edits[${i}]`;
    if (ed?.op === "paint") {
      if (!TERRAINS.includes(ed.terrain)) e.push(`${at4}.terrain: one of ${TERRAINS.join(", ")}`);
      e.push(...shapeErrors(ed.shape, `${at4}.shape`));
    } else if (ed?.op === "elevate") {
      if (!isNum(ed.amount) || Math.abs(ed.amount) > 1) e.push(`${at4}.amount: -1..1`);
      e.push(...shapeErrors(ed.shape, `${at4}.shape`));
    } else if (ed?.op === "river" || ed?.op === "road") {
      if (!nums(ed.points) || ed.points.length < 4 || ed.points.length % 2) e.push(`${at4}.points: at least 2 x,y pairs`);
      if (ed.op === "river" && ed.width !== void 0 && !(isNum(ed.width) && ed.width > 0)) e.push(`${at4}.width: > 0`);
      if (ed.op === "river" && ed.delta !== void 0 && typeof ed.delta !== "boolean") e.push(`${at4}.delta: true or false`);
    } else e.push(`${at4}.op: paint, elevate, river or road`);
    originError(ed, at4, e);
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
  } catch (err2) {
    const v = raw?.version;
    return { version: typeof v === "number" ? v : null, errors: [{ path: "version", message: err2.message }] };
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
function parsePoint(spec, at4) {
  const xy = at4.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
  if (xy) return [+xy[1], +xy[2]];
  return cellCenter(spec, at4.replace(/^(hex|cell):/i, ""));
}

// ../artgen-primitives/src/lib/rng.ts
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
function hashString(s) {
  let h1 = 2166136261, h22 = 16777619 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h22 = Math.imul(h22 ^ c, 1540483477);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h22 >>> 0).toString(16).padStart(8, "0");
}

// ../artgen-primitives/src/lib/noise.ts
var hash2 = (i, j, seed) => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};
var mod = (a, b) => (a % b + b) % b;
var smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function pGradient(x, y, o) {
  const oct = o.octaves ?? 1, g = o.gain ?? 0.5, seed = o.seed ?? 1;
  let sum = 0, amp = 1, norm2 = 0, cx = o.cells ?? 4, cy = o.cellsY ?? cx;
  for (let k = 0; k < oct; k++) {
    const fx = x / o.w * cx, fy = y / o.h * cy, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, u = smooth(tx), v = smooth(ty);
    const grad = (a, b, dx, dy) => {
      const t = hash2(mod(a, cx), mod(b, cy), seed + k * 7919) * Math.PI * 2;
      return Math.cos(t) * dx + Math.sin(t) * dy;
    };
    const n00 = grad(i, j, tx, ty), n10 = grad(i + 1, j, tx - 1, ty), n01 = grad(i, j + 1, tx, ty - 1), n11 = grad(i + 1, j + 1, tx - 1, ty - 1);
    const nx0 = n00 + (n10 - n00) * u, nx1 = n01 + (n11 - n01) * u;
    sum += amp * (nx0 + (nx1 - nx0) * v);
    norm2 += amp;
    amp *= g;
    cx *= 2;
    cy *= 2;
  }
  return Math.max(0, Math.min(1, 0.5 + sum / norm2 * 0.75));
}

// ../artgen-mapgen/src/map/geometry.ts
function coverage(s, x, y, soft = false) {
  const fall = (d, r) => d >= r ? 0 : !soft || d <= r * 0.4 ? 1 : 0.5 + 0.5 * Math.cos((d - r * 0.4) / (r * 0.6) * Math.PI);
  if ("circle" in s) return fall(Math.hypot(x - s.circle[0], y - s.circle[1]), s.circle[2]);
  if ("poly" in s) {
    const p2 = s.poly;
    let inside = false;
    for (let i = 0, j = p2.length - 2; i < p2.length; j = i, i += 2) {
      if (p2[i + 1] > y !== p2[j + 1] > y && x < (p2[j] - p2[i]) * (y - p2[i + 1]) / (p2[j + 1] - p2[i + 1]) + p2[i]) inside = !inside;
    }
    return inside ? 1 : 0;
  }
  return fall(distToPolyline(s.stroke, x, y), s.width / 2);
}
function distToPolyline(p2, x, y) {
  if (p2.length === 2) return Math.hypot(x - p2[0], y - p2[1]);
  let best = Infinity;
  for (let i = 2; i < p2.length; i += 2) {
    const ax = p2[i - 2], ay = p2[i - 1], dx = p2[i] - ax, dy = p2[i + 1] - ay, l2 = dx * dx + dy * dy;
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
  const p2 = "poly" in s ? s.poly : s.stroke, pad = "stroke" in s ? s.width / 2 : 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p2.length; i += 2) {
    x0 = Math.min(x0, p2[i]);
    x1 = Math.max(x1, p2[i]);
    y0 = Math.min(y0, p2[i + 1]);
    y1 = Math.max(y1, p2[i + 1]);
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

// ../artgen-mapgen/src/map/shape.ts
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
function weights(spec, f, area3, blend, mode) {
  if (!(blend > 0)) {
    const w2 = new Float32Array(f.w * f.h);
    eachCovered(f, area3, false, (i) => {
      w2[i] = 1;
    });
    return w2;
  }
  const out = distanceTo(f, area3, blend), wet = mode === "wet";
  const inner = wet ? distanceTo(f, area3, blend, true) : null;
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
function streamCurve(p2) {
  const n = p2.length / 2, out = [p2[0], p2[1]], P = (i) => [p2[Math.max(0, Math.min(n - 1, i)) * 2], p2[Math.max(0, Math.min(n - 1, i)) * 2 + 1]];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p22, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)], k = Math.max(2, Math.ceil(Math.hypot(p22[0] - p1[0], p22[1] - p1[1]) / 0.5));
    for (let s = 1; s <= k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      out.push(...[0, 1].map((a) => 0.5 * (2 * p1[a] + (p22[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p22[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p22[a] + p3[a]) * t3)));
    }
  }
  return out;
}
function shapeGround(spec, f, raw, seaLevel, margin) {
  const list6 = spec.require ?? [], local = spec.preset === "local", N = f.w * f.h, feature = spec.gen.feature;
  const base = Float32Array.from(raw, (v) => Math.max(0, Math.min(1, v)));
  const toRaw = (e) => seaLevel + e * (1 - seaLevel);
  const blendOf = (r) => r.blend ?? feature;
  for (const r of list6) {
    if (r.kind !== "path" || r.path !== "stream") continue;
    const p2 = streamCurve(r.points), valley = Math.min(feature * 0.5, 4), steps = [];
    for (let i = 0; i < p2.length - 2; i += 2) {
      const len = Math.hypot(p2[i + 2] - p2[i], p2[i + 3] - p2[i + 1]), k = Math.max(1, Math.ceil(len * f.res));
      for (let s = 0; s < k; s++) steps.push([p2[i] + (p2[i + 2] - p2[i]) * s / k, p2[i + 1] + (p2[i + 3] - p2[i + 1]) * s / k]);
    }
    steps.push([p2[p2.length - 2], p2[p2.length - 1]]);
    const at4 = (x, y) => raw[Math.min(f.h - 1, Math.max(0, Math.floor(y * f.res))) * f.w + Math.min(f.w - 1, Math.max(0, Math.floor(x * f.res)))];
    const bed = steps.map(([x, y]) => at4(x, y)), floor3 = Math.max(seaLevel + 4e-3, 0);
    for (let i = 1; i < bed.length; i++) bed[i] = Math.min(bed[i], bed[i - 1]);
    const win = Math.max(1, Math.round(f.res)), smooth3 = bed.map((_, i) => {
      let s = 0, c = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(bed.length - 1, i + win); k++) {
        s += bed[k];
        c++;
      }
      return Math.max(floor3, s / c);
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
  const heights = list6.filter((r) => r.kind === "height");
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
  const terrains = list6.flatMap((r) => r.kind === "terrain" ? [{ r, w: weights(spec, f, r.area, blendOf(r), WET_EDGE.has(r.terrain) ? "wet" : "land"), b: bands(r.terrain, local) }] : []);
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
  const clear = list6.filter((r) => r.kind === "clear");
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
  const at4 = (i, j) => Math.min(f.h - 1, j * step + (step >> 1)) * f.w + Math.min(f.w - 1, i * step + (step >> 1));
  const cell2 = (x, y) => [Math.max(0, Math.min(W - 1, Math.floor(x * f.res / step))), Math.max(0, Math.min(H - 1, Math.floor(y * f.res / step)))];
  const out = [points[0], points[1]];
  for (let p2 = 2; p2 < points.length; p2 += 2) {
    const [si, sj] = cell2(points[p2 - 2], points[p2 - 1]), [ti, tj] = cell2(points[p2], points[p2 + 1]);
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
        const len = Math.hypot(di, dj) * unit, rise = Math.abs(elev[at4(x, y)] - elev[at4(i, j)]);
        const c = dist[n] + len + rise * 40 + (wet[at4(x, y)] ? len * 3 : 0);
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
    out.push(points[p2], points[p2 + 1]);
  }
  return out;
}

// ../artgen-primitives/src/lib/trace.ts
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
    const add = (p2, q) => segs.push([...p2, ...q]);
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
  const at4 = /* @__PURE__ */ new Map();
  segs.forEach((s, n) => {
    for (const key of [s[0], s[3]]) {
      const l = at4.get(key);
      if (l) l.push(n);
      else at4.set(key, [n]);
    }
  });
  const used = new Uint8Array(segs.length), lines2 = [];
  const walk = (key, from, out) => {
    for (let cur = from, k = key; ; ) {
      const next4 = (at4.get(k) ?? []).find((n) => n !== cur && !used[n]);
      if (next4 === void 0) return k;
      used[next4] = 1;
      const s = segs[next4], far = s[0] === k ? 3 : 0;
      out.push(s[far + 1], s[far + 2]);
      cur = next4;
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
      lines2.push({ pts: fwd, closed: true });
      continue;
    }
    const back = [];
    walk(s[0], n, back);
    const pts2 = [];
    for (let q = back.length - 2; q >= 0; q -= 2) pts2.push(back[q], back[q + 1]);
    lines2.push({ pts: pts2.concat(fwd), closed: false });
  }
  return lines2;
}
function chaikin(l, passes = 2) {
  let p2 = l.pts;
  for (let k = 0; k < passes && p2.length >= 6; k++) {
    const n = p2.length / 2, out = [];
    if (!l.closed) out.push(p2[0], p2[1]);
    for (let i = 0; i < (l.closed ? n : n - 1); i++) {
      const j = (i + 1) % n, x0 = p2[i * 2], y0 = p2[i * 2 + 1], x1 = p2[j * 2], y1 = p2[j * 2 + 1];
      out.push(x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25, x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75);
    }
    if (!l.closed) out.push(p2[p2.length - 2], p2[p2.length - 1]);
    p2 = out;
  }
  return { pts: p2, closed: l.closed };
}
function simplifyLine(l, eps) {
  const p2 = l.pts, n = p2.length / 2;
  if (n < 4) return l;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(), ax = p2[a * 2], ay = p2[a * 2 + 1], dx = p2[b * 2] - ax, dy = p2[b * 2 + 1] - ay, len = Math.hypot(dx, dy) || 1;
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p2[i * 2] - ax) * dy - (p2[i * 2 + 1] - ay) * dx) / len;
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
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p2[i * 2], p2[i * 2 + 1]);
  return { pts: out, closed: l.closed };
}
var lineLength = (p2) => {
  let s = 0;
  for (let i = 2; i < p2.length; i += 2) s += Math.hypot(p2[i] - p2[i - 2], p2[i + 1] - p2[i - 1]);
  return s;
};
function pathData(lines2, k = 1) {
  const f = (v) => (Math.round(v * k * 10) / 10).toString();
  return lines2.map((l) => {
    let d = `M${f(l.pts[0])} ${f(l.pts[1])}`;
    for (let i = 2; i < l.pts.length; i += 2) d += `L${f(l.pts[i])} ${f(l.pts[i + 1])}`;
    return l.closed ? d + "Z" : d;
  }).join("");
}

// ../artgen-mapgen/src/map/generate.ts
var T = Object.fromEntries(TERRAINS.map((t, i) => [t, i]));
var isWater = (t) => t === T.deep || t === T.water;
function quantile(f, q) {
  if (q <= 0) return -Infinity;
  const s = Float32Array.from(f).sort();
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
function blur(f, w, h, r, passes = 1) {
  let a = f;
  for (let p2 = 0; p2 < passes; p2++) {
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
function fillDepressions(h, w, hh, water2) {
  const out = Float32Array.from(h), seen = new Uint8Array(h.length), heap2 = [];
  const less = (a, b) => out[a] < out[b];
  const push = (n) => {
    heap2.push(n);
    let c = heap2.length - 1;
    while (c) {
      const p2 = c - 1 >> 1;
      if (!less(heap2[c], heap2[p2])) break;
      [heap2[c], heap2[p2]] = [heap2[p2], heap2[c]];
      c = p2;
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
    if (water2[n] || i === 0 || j === 0 || i === w - 1 || j === hh - 1) {
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
function traceRivers(spec, filled, elev, water2, w, h, res, wet, blocked) {
  const n = spec.gen.rivers;
  if (!n) return [];
  const r = rng(spec.seed * 31 + 7), cands = [];
  for (let k = 0; k < elev.length; k++) if (!water2[k] && !blocked?.[k] && elev[k] > 0.4 && elev[k] < 0.85) cands.push(k);
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
      if (water2[k]) {
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
function toShore(pts2, water2) {
  const n = pts2.length / 2;
  for (let i = 2; i < n; i++) if (water2(pts2[i * 2], pts2[i * 2 + 1])) return pts2.slice(0, (i + 1) * 2);
  const ex = pts2[n * 2 - 2], ey = pts2[n * 2 - 1];
  let k = n - 2, dx = 0, dy = 0;
  while (k > 0 && Math.hypot(ex - pts2[k * 2], ey - pts2[k * 2 + 1]) < 0.5) k--;
  dx = ex - pts2[k * 2];
  dy = ey - pts2[k * 2 + 1];
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  for (let d = 0.1; d <= 3; d += 0.1) {
    const x = ex + dx / len * d, y = ey + dy / len * d;
    if (water2(x, y)) return [...pts2, ex + dx / len * (d + 0.15), ey + dy / len * (d + 0.15)];
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
function resample(p2, step) {
  const out = [p2[0], p2[1]];
  let carry = 0;
  for (let i = 2; i < p2.length; i += 2) {
    const ax = p2[i - 2], ay = p2[i - 1], seg = Math.hypot(p2[i] - ax, p2[i + 1] - ay);
    let d = step - carry;
    for (; d <= seg; d += step) out.push(ax + (p2[i] - ax) * d / seg, ay + (p2[i + 1] - ay) * d / seg);
    carry = seg - (d - step);
  }
  const n = out.length;
  if (Math.hypot(out[n - 2] - p2[p2.length - 2], out[n - 1] - p2[p2.length - 1]) > step * 0.3) out.push(p2[p2.length - 2], p2[p2.length - 1]);
  else {
    out[n - 2] = p2[p2.length - 2];
    out[n - 1] = p2[p2.length - 1];
  }
  return out;
}
function riverRibbon(line2, W, mouth) {
  let p2 = line2;
  if (mouth) {
    const n2 = p2.length / 2, ex = p2[n2 * 2 - 2], ey = p2[n2 * 2 - 1];
    let k = n2 - 2;
    while (k > 0 && Math.hypot(ex - p2[k * 2], ey - p2[k * 2 + 1]) < W * 2) k--;
    const dx = ex - p2[k * 2], dy = ey - p2[k * 2 + 1], len = Math.hypot(dx, dy) || 1;
    p2 = [...p2, ex + dx / len * W * FLARE_WATER, ey + dy / len * W * FLARE_WATER];
  }
  const c = resample(p2, Math.min(0.1, W * 0.4)), n = c.length / 2, s = [0];
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
  for (let p2 = 0; p2 < passes; p2++) {
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
  const label4 = new Int32Array(a.length).fill(-1), stack = [];
  for (let s = 0; s < a.length; s++) {
    if (label4[s] >= 0) continue;
    const cls = a[s], members = [], border = /* @__PURE__ */ new Map();
    label4[s] = s;
    stack.push(s);
    while (stack.length) {
      const n = stack.pop(), i = n % w, j = (n - i) / w;
      members.push(n);
      for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const m = y * w + x;
        if (a[m] === cls) {
          if (label4[m] < 0) {
            label4[m] = s;
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
  const water2 = new Uint8Array(N), elev = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    if (raw[n] < seaLevel) water2[n] = 1;
    else elev[n] = Math.min(1, (raw[n] - seaLevel) / (1 - seaLevel || 1));
  }
  const terrain = new Uint8Array(N), wet = new Uint8Array(N);
  const open = Uint8Array.from(water2);
  for (const ed of spec.edits) if (ed.op === "paint") {
    const v = ed.terrain === "water" || ed.terrain === "deep" ? 1 : 0;
    eachCovered(field, ed.shape, false, (i) => {
      open[i] = v;
    });
  }
  const mains = traceRivers(spec, fillDepressions(raw, w, h, water2), elev, open, w, h, res, wet, shaped?.blocked ?? null).map((r) => ({ ...r, width: riverWidth(spec), source: "generated" }));
  for (const ed of spec.edits) if (ed.op === "river") mains.push({ pts: smoothLine(ed.points, res), width: ed.width ?? riverWidth(spec), mouth: ed.delta !== false, source: "edit" });
  for (const s of streamsOf(spec)) mains.push({ pts: smoothLine(streamCurve(s.points), res), width: s.width ?? riverWidth(spec), mouth: s.delta !== false, source: "required", for: s.id });
  const roads = [];
  for (const ed of spec.edits) {
    if (ed.op === "road") roads.push({ pts: smoothLine(ed.points, res), width: spec.preset === "local" ? 0.5 : 0.08 });
  }
  for (const r of spec.require ?? []) if (r.kind === "path" && r.path === "road") roads.push({ pts: smoothLine(routeRoad(r.points, field, elev, open), res), width: spec.preset === "local" ? 0.5 : 0.08, for: r.id });
  for (const rv of mains) markLine(rv.pts, rv.width, w, h, res, wet);
  const near3 = new Float32Array(N);
  for (let n = 0; n < N; n++) near3[n] = water2[n] || wet[n] ? 1 : 0;
  const nearB = blur(near3, w, h, Math.max(1, Math.round(res * 1.5)), 2);
  const mopts = { w: w * 4, h: h * 4, cells: Math.max(2, Math.round(4 * Math.max(spec.cols, spec.rows) / (g.feature * 1.4))), octaves: 3, seed: spec.seed + 101 };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = j * w + i;
    if (water2[n]) {
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
    let fit2 = m.mouth ? toShore(m.pts, shown4) : null;
    if (fit2 && m.source === "required" && fit2.length < m.pts.length) fit2 = null;
    if (fit2 && m.source === "generated" && shaped?.clear.length && touches(fit2, shaped.clear.map((c) => c.area))) fit2 = null;
    return { ...riverRibbon(fit2 ?? m.pts, m.width, !!fit2), source: m.source, ...m.for !== void 0 && { for: m.for } };
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

// ../artgen-mapgen/src/map/gridlines.ts
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

// ../artgen-mapgen/src/map/symbols.ts
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

// ../artgen-mapgen/src/map/theme.ts
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

// ../artgen-primitives/src/lib/view.ts
var PX_PER_MM = 96 / 25.4;
var r3 = (v) => Math.round(v * 1e3) / 1e3;
function clampCrop(c, cols, rows2) {
  const x0 = Math.max(0, c[0]), y0 = Math.max(0, c[1]), x1 = Math.min(cols, c[0] + c[2]), y1 = Math.min(rows2, c[1] + c[3]);
  if (!(x1 > x0 && y1 > y0)) throw new Error(`crop ${c.join(",")} is outside the sheet (0,0,${cols},${rows2})`);
  return [r3(x0), r3(y0), r3(x1 - x0), r3(y1 - y0)];
}
function frameOf(crop2, cols, rows2, k) {
  const [x, y, w, h] = crop2 ? clampCrop(crop2, cols, rows2) : [0, 0, cols, rows2];
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
function fitPpu(w, h, fit2) {
  const f = fit2.unit === "mm" ? PX_PER_MM : 1;
  return Math.min(fit2.w * f / w, fit2.h * f / h);
}
function sizeAttrs(f, unit = "px") {
  const s = unit === "mm" ? (v) => `${Math.round(v / PX_PER_MM * 100) / 100}mm` : (v) => String(r3(v));
  return `width="${s(f.w)}" height="${s(f.h)}" viewBox="${r3(f.x)} ${r3(f.y)} ${r3(f.w)} ${r3(f.h)}"`;
}

// ../artgen-primitives/src/lib/page.ts
var PAGE_PT = {
  map: { region: 12, place: 9, water: 8, note: 7 },
  dungeon: { name: 9, note: 7, area: 12, room: 8, number: 8 }
};
var PAGE_SYMBOL_MM = 5;
var pageUnit = (pageScale) => pageScale / PX_PER_MM;
var pointsToPx = (pt3, pageScale) => pt3 * 4 / 3 * pageUnit(pageScale);
var overlaps = (a, b, gap = 0) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
function textBox(text2, cx, baseline, size2, o = {}) {
  const w = text2.length * (size2 * (o.bold ? 0.62 : 0.56) + (o.spacing ?? 0)), h = size2 * 1.15;
  return { x: cx - w / 2, y: baseline - size2 * 0.82, w, h };
}
function placeLabels(labels, obstacles, bounds, gap = 0) {
  const taken = obstacles.slice(), out = [];
  const inside = (b) => !bounds || b.x >= bounds.x - 1e-6 && b.y >= bounds.y - 1e-6 && b.x + b.w <= bounds.x + bounds.w + 1e-6 && b.y + b.h <= bounds.y + bounds.h + 1e-6;
  const free = (b) => inside(b) && !taken.some((t) => overlaps(b, t, gap));
  for (const l of labels) {
    const at4 = (dx, dy) => ({ ...l.box, x: l.box.x + dx, y: l.box.y + dy });
    if (free(l.box)) {
      taken.push(l.box);
      out.push({ x: l.x, y: l.y, moved: false, placed: true });
      continue;
    }
    const rx = l.clear + l.box.w / 2 + gap, ry = l.clear + l.box.h / 2 + gap;
    let found = null;
    for (const f of [1, 1.6, 2.4]) {
      const sides = [[rx * f, 0], [-rx * f, 0], [0, -ry * f], [0, ry * f], [rx * f, -ry * f], [rx * f, ry * f], [-rx * f, -ry * f], [-rx * f, ry * f]];
      found = sides.find(([dx, dy]) => free(at4(dx, dy))) ?? null;
      if (found) break;
    }
    if (found) {
      taken.push(at4(found[0], found[1]));
      out.push({ x: l.x + found[0], y: l.y + found[1], moved: true, placed: true });
    } else {
      taken.push(l.box);
      out.push({ x: l.x, y: l.y, moved: false, placed: false });
    }
  }
  return out;
}

// ../artgen-primitives/src/lib/svgdraw.ts
var esc = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var n1 = (v) => (Math.round(v * 10) / 10).toString();
var FONT_FAMILY = "Alegreya Sans";
var FONT = `'${FONT_FAMILY}', 'Segoe UI', Helvetica, Arial, sans-serif`;
function haloText(text2, x, y, size2, color, th, attrs = "") {
  const a = `x="${n1(x)}" y="${n1(y)}" font-size="${n1(size2)}" text-anchor="middle" ${attrs}`;
  return `<text ${a} fill="none" stroke="${th.halo}" stroke-width="${n1(size2 * 0.22)}" stroke-linejoin="round" stroke-opacity="0.9">${esc(text2)}</text><text ${a} fill="${color}">${esc(text2)}</text>`;
}
function compassSvg(cx, cy, r, u, th) {
  return `<g id="compass" stroke="${th.ink}" stroke-width="${n1(u)}" stroke-linejoin="round"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${th.paper}" fill-opacity="0.85"/><path d="M${n1(cx)} ${n1(cy - r * 0.9)}L${n1(cx + r * 0.3)} ${n1(cy)}L${n1(cx)} ${n1(cy + r * 0.9)}L${n1(cx - r * 0.3)} ${n1(cy)}Z" fill="${th.paper}"/><path d="M${n1(cx)} ${n1(cy - r * 0.9)}L${n1(cx + r * 0.3)} ${n1(cy)}L${n1(cx - r * 0.3)} ${n1(cy)}Z" fill="${th.ink}"/><text x="${n1(cx)}" y="${n1(cy - r - 4 * u)}" font-size="${n1(13 * u)}" font-weight="700" text-anchor="middle" fill="${th.ink}" stroke="none">N</text></g>`;
}

// ../artgen-mapgen/src/map/render.ts
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
    const size2 = labelSize(l, 1, pageScale), base = size2 * 1;
    const box2 = textBox(l.kind === "region" ? l.text.toUpperCase() : l.text, l.x * k, l.y * k + base * 0.35, size2, { bold: l.kind === "region" || l.kind === "place", spacing: l.kind === "region" ? size2 * 0.18 : 0 });
    return { x: l.x * k, y: l.y * k, box: box2, clear: 0 };
  });
  const placed = placeLabels(items, spec.overlay.symbols.map(symBox), { x: 0, y: 0, w: spec.cols * k, h: spec.rows * k }, pageScale * 0.3);
  return { at: placed.map((p2) => ({ x: p2.x, y: p2.y })), unplaced: placed.flatMap((p2, index) => p2.placed ? [] : [{ index, text: spec.overlay.labels[index].text }]) };
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
function toUnits(lines2, res, pad, passes) {
  return lines2.map((l) => simplifyLine(chaikin({ pts: l.pts.map((v) => (v + 0.5 - pad) / res), closed: l.closed }, passes), 0.04));
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
  for (let p2 = 0; p2 < passes; p2++) {
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
    const lines2 = toUnits(isolines(e, w, h, k * step), f.res, 0, 2).filter((l) => lineLength(l.closed ? [...l.pts, l.pts[0], l.pts[1]] : l.pts) >= minLen);
    if (lines2.length) out.push({ level: k, lines: lines2 });
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
function symbolSvg(kind, x, y, size2, th, angle = 0) {
  const s = SYMBOLS[kind] ?? SYMBOLS.poi;
  return `<g transform="translate(${n1(x)} ${n1(y)})${angle ? ` rotate(${n1(angle)})` : ""} scale(${(size2 / 20).toFixed(3)})">${s.svg.replaceAll("{ink}", th.ink).replaceAll("{fill}", th.symbolFill)}</g>`;
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
      const d = pathData(regions.get(t) ?? [], k), st = th.terrain[t], water2 = t === "water" || t === "deep";
      if (!d) continue;
      const edge = water2 ? th.coast : th.edge === "own" ? st.fill : th.edge, ew = water2 ? th.coastWidth : th.edgeWidth;
      g += `<path d="${d}" fill="${st.fill}" fill-rule="evenodd" stroke="${edge}" stroke-width="${n1(ew * u)}" stroke-linejoin="round"/>`;
      if (st.pattern) g += `<path d="${d}" fill="url(#pat-${t})" fill-rule="evenodd"/>`;
    }
    parts.push(`<g id="terrain">${g}</g>`);
  } else parts.push(`<rect width="${W}" height="${H}" fill="${th.paper}"/>`);
  const lineGroup = (id2, lines2, draw) => lines2.length ? `<g id="${id2}" fill="none" stroke-linecap="round" stroke-linejoin="round">${lines2.map((l) => draw(pathData([{ pts: l.pts, closed: false }], k), Math.max(1.2 * u, l.width * k))).join("")}</g>` : "";
  const defs = [];
  const riverD = on.rivers && f.rivers.length ? pathData(f.rivers.map((r) => ({ pts: r.outline, closed: true })), k) : "";
  if (riverD) {
    const d = riverD, water2 = pathData([...regions.get("water") ?? [], ...regions.get("deep") ?? []], k);
    defs.push(`<mask id="river-land" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${water2 ? `<path d="${water2}" fill="#000" fill-rule="evenodd"/>` : ""}</mask>`);
    parts.push(`<g id="rivers" stroke-linejoin="round"><g mask="url(#river-land)"><path d="${d}" fill="${th.riverBank}" stroke="${th.riverBank}" stroke-width="${n1(th.riverBankWidth * 2 * u)}"/></g><path d="${d}" fill="${th.terrain.water.fill}"/></g>`);
  }
  if (on.roads) parts.push(lineGroup("roads", f.roads, (d, w) => `<path d="${d}" stroke="${th.road}" stroke-width="${n1(w)}" stroke-dasharray="${n1(w * 3)} ${n1(w * 2)}"/>`));
  if (on.contours) {
    const major = spec.topo.majorEvery;
    let g = "";
    for (const { level: level2, lines: lines2 } of contourLines(spec, f)) {
      const isMajor = level2 % major === 0, d = pathData(lines2, k);
      g += `<path d="${d}" stroke-width="${n1((isMajor ? 1.5 : 0.75) * u)}"/>`;
      if (isMajor && spec.topo.labels) {
        const best = lines2.reduce((a, b) => b.pts.length > a.pts.length ? b : a);
        const mid = best.pts.length >> 2 << 1, x = best.pts[mid] * k, y = best.pts[mid + 1] * k;
        g += `<g stroke="none">${haloText(`${level2 * spec.topo.interval} ${spec.topo.unit}`, x, y + 4 * u, 10 * u, th.contour, th)}</g>`;
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
    const at4 = mapLabelLayout(spec, k, o.pageScale).at;
    const g = spec.overlay.labels.map((l, i) => {
      const base = labelSize(l, u, o.pageScale), lx = at4[i].x / k, ly = at4[i].y / k;
      const attrs = l.kind === "region" ? `font-weight="700" letter-spacing="${n1(base * 0.18)}"` : l.kind === "water" ? 'font-style="italic"' : l.kind === "place" ? 'font-weight="700"' : "";
      const text2 = l.kind === "region" ? l.text.toUpperCase() : l.text;
      const t = haloText(text2, lx * k, ly * k + base * 0.35, base, th.label[l.kind], th, attrs);
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

// ../artgen-primitives/src/lib/round.ts
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

// ../artgen-mapgen/src/map/facts.ts
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
  const pt3 = (x, y) => [rnd(x), rnd(y)];
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
    const rise = feetIn(spec.topo.unit), run2 = feetIn(spec.scale.unit);
    if (rise === null || run2 === null) return { gradient, band: null };
    const ratio = perUnit * rise / (per * run2), b = RULES.slopeBands;
    return { gradient, band: ratio < b.flat ? "flat" : ratio < b.gentle ? "gentle" : ratio < b.steep ? "steep" : "cliff" };
  };
  const lines2 = [
    ...f.rivers.map((r, i) => ({ kind: "river", name: `river-${i + 1}`, pts: r.pts, widths: r.widths, source: r.source, mouth: r.mouth })),
    ...f.roads.map((r, i) => ({ kind: "road", name: `road-${i + 1}`, pts: r.pts, widths: void 0, source: void 0, mouth: void 0 }))
  ];
  const nearest = (kind, x, y) => {
    let best = null;
    for (const line2 of lines2) {
      if (line2.kind !== kind) continue;
      const p2 = line2.pts;
      for (let i = 2; i < p2.length; i += 2) {
        const ax = p2[i - 2], ay = p2[i - 1], dx = p2[i] - ax, dy = p2[i + 1] - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
        const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { line: line2, d, at: [px, py], width: line2.widths ? line2.widths[i / 2 - 1] * (1 - t) + line2.widths[i / 2] * t : 0 };
      }
    }
    return best;
  };
  const near3 = (kind, x, y) => {
    const n = nearest(kind, x, y);
    if (!n) return null;
    return { name: n.line.name, ...n.line.source && { source: n.line.source }, distance: length(n.d), at: pt3(...n.at), ...kind === "river" && { within: n.d <= n.width / 2 }, rawAt: n.at };
  };
  return { res, w, h, rnd, length, pt: pt3, shown: shown4, height, terrainAt, centre, slope, lines: lines2, near: near3 };
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
  const at4 = (s) => ({ height: g.shown(f.elevation[s] * spec.topo.maxElevation), at: g.pt(...g.centre(s)) });
  return { lowest: at4(lo), highest: at4(hi) };
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
    ts.sort((p2, q) => p2 - q);
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
  const cell2 = new Float64Array(N), flip = new Float64Array(N);
  for (let cj = 0; cj < rows2; cj++) for (let ci = 0; ci < cols; ci++) {
    let s = 0;
    for (let j = cj * r; j < (cj + 1) * r; j++) for (let i = ci * r; i < (ci + 1) * r; i++) s += f.elevation[j * f.w + i];
    cell2[cj * cols + ci] = s / (r * r) * spec.topo.maxElevation;
    flip[cj * cols + ci] = -cell2[cj * cols + ci];
  }
  const out = (list6, dry, order) => list6.filter((c) => c.prominence >= need - 1e-9 && (!dry || g.shown(cell2[c.n]) > 0)).sort((a, b) => order(cell2[a.n], cell2[b.n]) || b.prominence - a.prominence || a.n - b.n).map((c) => ({ height: g.shown(cell2[c.n]), at: g.pt(c.n % cols + 0.5, Math.floor(c.n / cols) + 0.5), prominence: roundTo(c.prominence, step) }));
  return { hilltops: out(prominences(cell2, cols), false, (a, b) => b - a), hollows: out(prominences(flip, cols), true, (a, b) => a - b) };
}
var listed = (g, pts2) => {
  const t = simplifyLine({ pts: pts2, closed: false }, RULES.lineTolerance).pts, out = [];
  for (let i = 0; i < t.length; i += 2) out.push(g.pt(t[i], t[i + 1]));
  return out;
};
var pathLength = (p2) => {
  let s = 0;
  for (let i = 2; i < p2.length; i += 2) s += Math.hypot(p2[i] - p2[i - 2], p2[i + 1] - p2[i - 1]);
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
      const height = g.shown(g.height(x, y)), river = g.near("river", x, y), road2 = g.near("road", x, y);
      const strip = (n) => {
        if (!n) return null;
        const { rawAt: _, ...rest } = n;
        return rest;
      };
      const p2 = { at: g.pt(x, y), terrain: g.terrainAt(x, y), height, slope: g.slope(x, y), river: strip(river), road: strip(road2) };
      if (q.above === "river") {
        const ref = river && g.shown(g.height(...river.rawAt));
        p2.above = { of: "river", value: ref === null ? null : roundTo(height - ref, spec.topo.interval), reference: river && ref !== null ? { height: ref, at: river.at } : null };
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
        p2.above = { of: "lowest", value: roundTo(height - ref, spec.topo.interval), reference: { height: ref, at: g.pt(...lowAt) } };
      }
      return p2;
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

// ../artgen-mapgen/src/map/require.ts
var two2 = (v) => v.toFixed(2);
function distanceToLines(lines2, x, y) {
  let best = Infinity;
  for (const p2 of lines2) for (let i = 2; i < p2.length; i += 2) {
    const ax = p2[i - 2], ay = p2[i - 1], dx = p2[i] - ax, dy = p2[i + 1] - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
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
    const lines2 = r.path === "stream" ? f.rivers.filter((v) => v.for === r.id).map((v) => v.pts) : f.roads.filter((v) => v.for === r.id).map((v) => v.pts), tol = r.tolerance ?? 1;
    let far = 0;
    for (let i = 0; i < r.points.length; i += 2) far = Math.max(far, distanceToLines(lines2, r.points[i], r.points[i + 1]));
    const measured = Number.isFinite(far) ? Math.round(far * 100) / 100 : null;
    return { what: r.path, measured, needed: tol, op: "<=", met: measured !== null && measured <= tol + 1e-9 };
  }
  const crossing = f.rivers.filter((v) => v.source === "generated" && [v.pts, v.outline].some((p2) => {
    for (let i = 0; i < p2.length; i += 2) if (coverage(r.area, p2[i], p2[i + 1]) > 0) return true;
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

// ../artgen-primitives/src/lib/sync.ts
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

// ../artgen-mapgen/src/map/sync.ts
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
  const labels = take("labels", target.overlay.labels, from.overlay.labels), symbols4 = take("symbols", target.overlay.symbols, from.overlay.symbols);
  const spec = parseMap({ ...target, edits, ...(target.require?.length || from.require?.length) && { require: require4 }, overlay: { labels, symbols: symbols4 } });
  const oldMarks = [...target.overlay.labels, ...target.overlay.symbols], newMarks = [...spec.overlay.labels, ...spec.overlay.symbols], pre = [...labels, ...symbols4];
  const over = (marks, m) => marks.find((o) => o !== m && near(o, m, MARK_DISTANCE));
  newMarks.forEach((m, i) => {
    if (m.origin !== void 0) return;
    const was = oldMarks.includes(pre[i]) ? pre[i] : void 0, hit = over(newMarks, m);
    if (hit && !(was && over(oldMarks, was)))
      conflicts.push({ kind: "over-mark", list: m.text !== void 0 ? "labels" : "symbols", index: oldMarks.indexOf(pre[i]), message: `hand ${markName(m)} at ${m.x},${m.y} is now over ${markName(hit)}` });
  });
  return { spec, report: { version: MAP_FORMAT, origin, lists, conflicts } };
}

// ../artgen-mapgen/src/dungeon/index.ts
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
  DUNGEON_OPS: () => DUNGEON_OPS,
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
  cornerPoint: () => cornerPoint,
  corridorDeps: () => corridorDeps,
  corridorEnd: () => corridorEnd,
  corridorOrder: () => corridorOrder,
  coversContent: () => coversContent,
  doorPair: () => doorPair,
  dungeonFacts: () => dungeonFacts,
  dungeonFurniture: () => dungeonFurniture,
  dungeonLabelLayout: () => dungeonLabelLayout,
  dungeonLayersFor: () => dungeonLayersFor,
  dungeonRenderSize: () => dungeonRenderSize,
  editDungeon: () => editDungeon,
  fitDungeon: () => fitDungeon,
  generateDungeon: () => generateDungeon,
  geom: () => geom_exports,
  gridFromUnits: () => gridFromUnits,
  gridInUnits: () => gridInUnits,
  gridMode: () => gridMode,
  hexPoints: () => hexPoints,
  hrefError: () => hrefError,
  inPolygon: () => inPolygon,
  layoutDungeon: () => layoutDungeon,
  layoutExits: () => layoutExits,
  layoutWalls: () => layoutWalls,
  linkEnds: () => linkEnds,
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

// ../artgen-mapgen/src/dungeon/spec.ts
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
function newDungeon(id2, over = {}) {
  const d = structuredClone(DEFAULTS);
  return parseDungeon({
    ...d,
    ...over,
    id: id2,
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
function endErrors(e, at4, ids, corridorIds) {
  const shape = `${at4}: {room: id}, {at: [x, y]} or {corridor: id}`;
  if (!e || typeof e !== "object") return [shape];
  const o = e, out = [];
  if ("room" in o) {
    if (!ids.has(o.room)) out.push(`${at4}.room: no room ${JSON.stringify(o.room)}`);
    if (o.side !== void 0 && !SIDES.includes(o.side)) out.push(`${at4}.side: ${SIDES.join(", ")}`);
    if (o.offset !== void 0 && !(isNum2(o.offset) && o.offset >= 0)) out.push(`${at4}.offset: cells along the wall, 0 or more`);
    if (o.offset !== void 0 && o.side === void 0) out.push(`${at4}.offset: goes with side`);
    return out;
  }
  if ("at" in o) {
    if (!isPoint(o.at)) out.push(`${at4}.at: [x, y]`);
    const x = o.exit;
    if (x !== void 0) {
      if (!x || typeof x !== "object" || typeof x.text !== "string") out.push(`${at4}.exit: {text, href?, fade?}`);
      else {
        if (x.href !== void 0 && hrefError(x.href)) out.push(`${at4}.exit.href: ${hrefError(x.href)}`);
        if (x.fade !== void 0 && !(isNum2(x.fade) && x.fade >= 0 && x.fade <= 20)) out.push(`${at4}.exit.fade: cells, 0..20`);
      }
    }
    return out;
  }
  if ("corridor" in o) {
    if (typeof o.corridor !== "string" || !corridorIds.has(o.corridor)) out.push(`${at4}.corridor: no corridor with id ${JSON.stringify(o.corridor)}`);
    if (o.near !== void 0 && !isPoint(o.near)) out.push(`${at4}.near: [x, y]`);
    return out;
  }
  return [shape];
}
function corridorDeps(corridors) {
  const byId2 = new Map(corridors.flatMap((c, i) => typeof c?.id === "string" ? [[c.id, i]] : []));
  return corridors.map((c) => [c?.from, c?.to].flatMap((e) => e && typeof e === "object" && "corridor" in e && byId2.has(e.corridor) ? [byId2.get(e.corridor)] : []));
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
function originError2(entry, at4, e) {
  const v = entry?.origin;
  if (v !== void 0 && (typeof v !== "string" || !v)) e.push(`${at4}.origin: a non-empty string`);
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
    const at4 = `walls[${i}]`;
    if (!w || typeof w !== "object") {
      e.push(`${at4}: an object`);
      return;
    }
    if (w.rooms !== void 0) {
      if (!Array.isArray(w.rooms) || !w.rooms.length) e.push(`${at4}.rooms: room ids`);
      else for (const r of w.rooms) if (!ids.has(r)) e.push(`${at4}.rooms: no room ${JSON.stringify(r)}`);
    }
    if (w.poly !== void 0 && !(nums2(w.poly) && w.poly.length >= 6 && w.poly.length % 2 === 0)) e.push(`${at4}.poly: at least 3 x,y pairs`);
    if (w.rooms === void 0 && w.poly === void 0) e.push(`${at4}: rooms (ids) or poly`);
    if (w.thickness !== void 0 && !(isNum2(w.thickness) && w.thickness > 0 && w.thickness <= 4)) e.push(`${at4}.thickness: cells, above 0 and at most 4`);
    if (w.inset !== void 0 && !(isNum2(w.inset) && w.inset >= 0)) e.push(`${at4}.inset: cells, 0 or more`);
    const t = w.towers;
    if (t !== void 0) {
      if (!t || !WALL_TOWER_SHAPES.includes(t.shape)) e.push(`${at4}.towers.shape: ${WALL_TOWER_SHAPES.join(" or ")}`);
      if (t?.size !== void 0 && !(isNum2(t.size) && t.size > 0)) e.push(`${at4}.towers.size: cells, above 0`);
      if (t?.at !== void 0 && t.at !== "corners" && !(nums2(t.at) && t.at.every(Number.isInteger))) e.push(`${at4}.towers.at: "corners" or vertex indices`);
    }
    (w.gates === void 0 ? [] : Array.isArray(w.gates) ? w.gates : (e.push(`${at4}.gates: an array`), [])).forEach((g, j) => {
      const ga = `${at4}.gates[${j}]`;
      if (!isPoint(g?.at)) e.push(`${ga}.at: [x, y] in cells`);
      if (!GATE_KINDS.includes(g?.kind)) e.push(`${ga}.kind: ${GATE_KINDS.join(" or ")}`);
      if (g?.room !== void 0 && !ids.has(g.room)) e.push(`${ga}.room: no room ${JSON.stringify(g.room)}`);
      if (g?.width !== void 0 && !(isNum2(g.width) && g.width > 0)) e.push(`${ga}.width: cells, above 0`);
    });
    originError2(w, at4, e);
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
    const at4 = `rooms[${i}]`;
    if (typeof r?.id !== "string" || !/^[\w-]+$/.test(r.id)) e.push(`${at4}.id: letters, digits, - and _ only`);
    else if (ids.has(r.id)) e.push(`${at4}.id: ${r.id} is used twice`);
    else ids.add(r.id);
    if (!ROOM_SHAPES.includes(r?.shape)) e.push(`${at4}.shape: one of ${ROOM_SHAPES.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum2(r?.[k])) e.push(`${at4}.${k}: a number (cells)`);
    for (const k of ["w", "h"]) if (!isNum2(r?.[k]) || r[k] < 1) e.push(`${at4}.${k}: at least 1 cell`);
    if (r?.shape === "poly" && !(nums2(r.points) && r.points.length >= 6 && r.points.length % 2 === 0)) e.push(`${at4}.points: at least 3 x,y pairs`);
    if (r?.label !== void 0 && typeof r.label !== "string") e.push(`${at4}.label: text`);
    if (r?.number !== void 0 && r.number !== false && !isNum2(r.number)) e.push(`${at4}.number: a number or false`);
    if (r?.fill !== void 0 && !ROOM_FILLS.includes(r.fill)) e.push(`${at4}.fill: one of ${ROOM_FILLS.join(", ")}`);
    if (r?.href !== void 0 && hrefError(r.href)) e.push(`${at4}.href: ${hrefError(r.href)}`);
    if (r?.hand !== void 0 && !(Array.isArray(r.hand) && r.hand.every((f) => typeof f === "string"))) e.push(`${at4}.hand: field names`);
    originError2(r, at4, e);
  });
  const corridorIds = /* @__PURE__ */ new Set();
  (Array.isArray(m.corridors) ? m.corridors : []).forEach((c, i) => {
    if (c?.id === void 0) return;
    if (typeof c.id !== "string" || !/^[\w-]+$/.test(c.id)) e.push(`corridors[${i}].id: letters, digits, - and _ only`);
    else if (corridorIds.has(c.id)) e.push(`corridors[${i}].id: ${c.id} is used twice`);
    else corridorIds.add(c.id);
  });
  (Array.isArray(m.corridors) ? m.corridors : (e.push("corridors: an array"), [])).forEach((c, i) => {
    const at4 = `corridors[${i}]`;
    e.push(...endErrors(c?.from, `${at4}.from`, ids, corridorIds), ...endErrors(c?.to, `${at4}.to`, ids, corridorIds));
    for (const side of ["from", "to"]) {
      const x = c?.[side];
      if (x && x.corridor !== void 0 && x.corridor === c?.id) e.push(`${at4}.${side}.corridor: a corridor cannot join itself`);
    }
    if (c?.curve !== void 0 && !CURVES.includes(c.curve)) e.push(`${at4}.curve: ${CURVES.join(" or ")}`);
    if (c?.style !== void 0 && !CORRIDOR_STYLES.includes(c.style)) e.push(`${at4}.style: ${CORRIDOR_STYLES.join(" or ")}`);
    if (c?.seed !== void 0 && !isNum2(c.seed)) e.push(`${at4}.seed: a number`);
    if (c?.width !== void 0 && !(isNum2(c.width) && c.width >= 0.5 && c.width <= 6)) e.push(`${at4}.width: 0.5..6`);
    if (c?.route !== void 0 && !ROUTES.includes(c.route)) e.push(`${at4}.route: one of ${ROUTES.join(", ")}`);
    if (c?.via !== void 0 && !(nums2(c.via) && c.via.length % 2 === 0)) e.push(`${at4}.via: x,y pairs`);
    if (c?.doors !== void 0 && !(Array.isArray(c.doors) && c.doors.length === 2 && c.doors.every((d) => d === null || DOOR_KINDS.includes(d))))
      e.push(`${at4}.doors: [from, to], each null or one of ${DOOR_KINDS.join(", ")}`);
    originError2(c, at4, e);
  });
  if (m.connections !== void 0) {
    if (!Array.isArray(m.connections)) e.push("connections: an array");
    else m.connections.forEach((c, i) => {
      const at4 = `connections[${i}]`;
      if (!c || typeof c !== "object") {
        e.push(`${at4}: {a, b, at?, kind?, width?}`);
        return;
      }
      for (const k of ["a", "b"]) if (!ids.has(c[k])) e.push(`${at4}.${k}: no room ${JSON.stringify(c[k])}`);
      if (c.a === c.b) e.push(`${at4}: a room cannot connect to itself`);
      if (c.at !== void 0 && !isPoint(c.at)) e.push(`${at4}.at: [x, y]`);
      if (c.kind !== void 0 && c.kind !== "open" && !DOOR_KINDS.includes(c.kind)) e.push(`${at4}.kind: open or one of ${DOOR_KINDS.join(", ")}`);
      if (c.width !== void 0 && !(isNum2(c.width) && c.width >= 0.5 && c.width <= 20)) e.push(`${at4}.width: 0.5..20`);
      originError2(c, at4, e);
    });
  }
  if (m.blocks !== void 0) {
    if (!Array.isArray(m.blocks)) e.push("blocks: an array");
    else {
      const seen = /* @__PURE__ */ new Set();
      m.blocks.forEach((b, i) => {
        const at4 = `blocks[${i}]`;
        if (!b || typeof b !== "object") {
          e.push(`${at4}: {id, shape, x, y, w, h, split}`);
          return;
        }
        if (typeof b.id !== "string" || !/^[\w-]+$/.test(b.id)) e.push(`${at4}.id: letters, digits, - and _ only`);
        else if (seen.has(b.id)) e.push(`${at4}.id: ${b.id} is used twice`);
        else seen.add(b.id);
        if (!BLOCK_SHAPES.includes(b.shape)) e.push(`${at4}.shape: one of ${BLOCK_SHAPES.join(", ")}`);
        for (const k of ["x", "y"]) if (!isNum2(b[k])) e.push(`${at4}.${k}: a number (cells)`);
        for (const k of ["w", "h"]) if (!isNum2(b[k]) || b[k] < 1) e.push(`${at4}.${k}: at least 1 cell`);
        if (b.shape === "poly" && !(nums2(b.points) && b.points.length >= 6 && b.points.length % 2 === 0)) e.push(`${at4}.points: at least 3 x,y pairs`);
        const sp = b.split;
        if (!sp || typeof sp !== "object" || !SPLIT_MODES.includes(sp.mode)) e.push(`${at4}.split.mode: one of ${SPLIT_MODES.join(", ")}`);
        else {
          if (sp.min !== void 0 && !(isNum2(sp.min) && sp.min >= 1 && sp.min <= 40)) e.push(`${at4}.split.min: 1..40 cells`);
          if (sp.seed !== void 0 && !isNum2(sp.seed)) e.push(`${at4}.split.seed: a number`);
          if (sp.cuts !== void 0 && !(sp.cuts && typeof sp.cuts === "object" && (sp.cuts.x === void 0 || nums2(sp.cuts.x)) && (sp.cuts.y === void 0 || nums2(sp.cuts.y)))) e.push(`${at4}.split.cuts: {x?: [cells], y?: [cells]}`);
          if (sp.mode === "cuts" && !(sp.cuts?.x?.length || sp.cuts?.y?.length)) e.push(`${at4}.split.cuts: the x and/or y lines to cut at`);
        }
        if (b.doors !== void 0 && !(isNum2(b.doors) && b.doors >= 0 && b.doors <= 1)) e.push(`${at4}.doors: 0..1`);
        originError2(b, at4, e);
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
  const rooms = (Array.isArray(r.rooms) ? r.rooms : []).map((room3) => room3?.shape === "poly" && Array.isArray(room3.points) && room3.points.length >= 6 && room3.x === void 0 ? { ...room3, ...polyBox(room3.points) } : room3);
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
  } catch (err2) {
    const v = raw?.version;
    return { version: typeof v === "number" ? v : null, errors: [{ path: "version", message: err2.message }] };
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
function parsePoint2(at4) {
  const xy = at4.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
  if (xy) return [+xy[1], +xy[2]];
  const sq = at4.replace(/^cell:/i, "").toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (sq) {
    const c = [...sq[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, r = +sq[2] - 1;
    return [c + 0.5, r + 0.5];
  }
  throw new Error(`${at4}: expected x,y (cells) or a cell name (C4)`);
}
function withoutDangling(list6) {
  for (; ; ) {
    const ids = new Set(list6.flatMap((c) => c.id ? [c.id] : []));
    const next4 = list6.filter((c) => ![c.from, c.to].some((e) => "corridor" in e && !ids.has(e.corridor)));
    if (next4.length === list6.length) return next4;
    list6 = next4;
  }
}
function removeRoom(m, id2) {
  const before = m.corridors.length;
  m.rooms = m.rooms.filter((r) => r.id !== id2);
  if (m.connections) m.connections = m.connections.filter((c) => c.a !== id2 && c.b !== id2);
  m.corridors = withoutDangling(m.corridors.filter((c) => ![c.from, c.to].some((e) => "room" in e && e.room === id2)));
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

// ../artgen-mapgen/src/dungeon/geom.ts
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
function area2(p2) {
  let s = 0;
  for (let i = 0, j = p2.length - 2; i < p2.length; j = i, i += 2) s += p2[j] * p2[i + 1] - p2[i] * p2[j + 1];
  return s;
}
var polygonArea = (p2) => Math.abs(area2(p2)) / 2;
var cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function segmentCross(a, b, c, d, eps = 1e-9) {
  const d1 = cross(c[0], c[1], d[0], d[1], a[0], a[1]), d2 = cross(c[0], c[1], d[0], d[1], b[0], b[1]);
  const d3 = cross(a[0], a[1], b[0], b[1], c[0], c[1]), d4 = cross(a[0], a[1], b[0], b[1], d[0], d[1]);
  if (!((d1 > eps && d2 < -eps || d1 < -eps && d2 > eps) && (d3 > eps && d4 < -eps || d3 < -eps && d4 > eps))) return null;
  const t = d1 / (d1 - d2);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function selfCrossing(p2) {
  const n = p2.length / 2, pt3 = (i) => [p2[2 * (i % n)], p2[2 * (i % n) + 1]];
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (segmentCross(pt3(i), pt3(i + 1), pt3(j), pt3(j + 1))) return [i, j];
  }
  return null;
}
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function nearestOnLine(pts2, x, y) {
  let best = { x: pts2[0], y: pts2[1], d: Infinity, along: 0, seg: 0 }, at4 = 0;
  for (let i = 0; i + 3 < pts2.length; i += 2) {
    const ax = pts2[i], ay = pts2[i + 1], bx = pts2[i + 2], by = pts2[i + 3], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, len = Math.sqrt(L2);
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0, px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { x: px, y: py, d, along: at4 + t * len, seg: i / 2 };
    at4 += len;
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
function edges(p2) {
  const out = [];
  for (let i = 0, j = p2.length - 2; i < p2.length; j = i, i += 2) out.push([[p2[j], p2[j + 1]], [p2[i], p2[i + 1]]]);
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

// ../artgen-mapgen/src/dungeon/corridors.ts
var snap = (v, w) => Math.round(w) % 2 ? Math.floor(v) + 0.5 : Math.round(v);
var OUT = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
function sidePort(g, side, offset, width) {
  const r = g.room, d = OUT[side], across = side === "n" || side === "s";
  const along2 = across ? offset !== void 0 ? r.x + offset : snap(g.cx, width) : offset !== void 0 ? r.y + offset : snap(g.cy, width);
  const p2 = across ? [along2, g.cy] : [g.cx, along2];
  const edge = side === "n" ? r.y : side === "s" ? r.y + r.h : side === "w" ? r.x : r.x + r.w;
  const stub = across ? [along2, edge + d[1]] : [edge + d[0], along2];
  return { p: p2, stub, dir: d, room: g };
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
      if (inPolygon(g.outline, x, y) || es.some(([p2, q]) => segmentDistance(x, y, p2, q) < clear)) blocked[j * W + i] = 1;
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
      const p2 = i - 1 >> 1;
      if (heap2[p2][0] <= heap2[i][0]) break;
      [heap2[p2], heap2[i]] = [heap2[i], heap2[p2]];
      i = p2;
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
  let at4 = 0;
  for (let i = 0; i + 3 < pts2.length; i += 2) {
    const len = Math.hypot(pts2[i + 2] - pts2[i], pts2[i + 3] - pts2[i + 1]), n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = i ? 1 : 0; k <= n; k++) s.push({ x: pts2[i] + (pts2[i + 2] - pts2[i]) * k / n, y: pts2[i + 1] + (pts2[i + 3] - pts2[i + 1]) * k / n, at: at4 + len * k / n });
    at4 += len;
  }
  if (s.length < 2) return [];
  const wall2 = (a, p2, q, r) => Math.max(0.3, 0.5 + 0.16 * Math.sin(a * 0.9 + p2) + 0.11 * Math.sin(a * 2.1 + q) + 0.06 * Math.sin(a * 4.3 + r));
  const left = [], right = [];
  s.forEach((c, i) => {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], tx = b.x - a.x, ty = b.y - a.y, L2 = Math.hypot(tx, ty) || 1, nx = -ty / L2, ny = tx / L2;
    const ease = Math.min(1, c.at / 1.5, (at4 - c.at) / 1.5), l = width * (0.5 + (wall2(c.at, ph[0], ph[1], ph[2]) - 0.5) * ease), r = width * (0.5 + (wall2(c.at, ph[3], ph[4], ph[5]) - 0.5) * ease);
    left.push(c.x + nx * l, c.y + ny * l);
    right.unshift(c.x - nx * r, c.y - ny * r);
  });
  return chaikin({ pts: [...left, ...right], closed: true }, 2).pts;
}

// ../artgen-mapgen/src/dungeon/walls.ts
var WALL_DEFAULTS = { thickness: 1, inset: 1, towerSize: 3, gateWidth: 2, posternWidth: 1 };
function convexHull(pts2) {
  const ps = [];
  for (let i = 0; i < pts2.length; i += 2) ps.push([pts2[i], pts2[i + 1]]);
  ps.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const uniq = ps.filter((p2, i) => !i || p2[0] !== ps[i - 1][0] || p2[1] !== ps[i - 1][1]);
  if (uniq.length < 3) return uniq;
  const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list6) => {
    const h = [];
    for (const p2 of list6) {
      while (h.length >= 2 && cross2(h[h.length - 2], h[h.length - 1], p2) <= 0) h.pop();
      h.push(p2);
    }
    h.pop();
    return h;
  };
  return [...half(uniq), ...half([...uniq].reverse())];
}
var area22 = (r) => r.reduce((s, p2, i) => s + p2[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p2[1], 0);
function offsetRing(ring2, d) {
  if (!d || ring2.length < 3) return ring2;
  const sign = area22(ring2) > 0 ? 1 : -1, n = ring2.length;
  const normal = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [sign * dy / l, -sign * dx / l];
  };
  return ring2.map((p2, i) => {
    const a = normal(ring2[(i + n - 1) % n], p2), b = normal(p2, ring2[(i + 1) % n]), k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p2[0] + (a[0] + b[0]) * k, p2[1] + (a[1] + b[1]) * k];
  });
}
function snapToRing(ring2, at4) {
  let best = { x: ring2[0][0], y: ring2[0][1], angle: 0 }, bd = Infinity;
  ring2.forEach((a, i) => {
    const b = ring2[(i + 1) % ring2.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((at4[0] - a[0]) * dx + (at4[1] - a[1]) * dy) / L2)) : 0, x = a[0] + t * dx, y = a[1] + t * dy, d = Math.hypot(at4[0] - x, at4[1] - y);
    if (d < bd) {
      bd = d;
      best = { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI };
    }
  });
  return best;
}
function wallGeom(w, index, l) {
  const byId2 = new Map(l.rooms.map((g) => [g.room.id, g]));
  let ring2;
  if (w.poly) ring2 = Array.from({ length: w.poly.length / 2 }, (_, i) => [w.poly[2 * i], w.poly[2 * i + 1]]);
  else ring2 = offsetRing(convexHull((w.rooms ?? []).flatMap((id2) => byId2.get(id2)?.outline ?? [])), w.inset ?? WALL_DEFAULTS.inset);
  const thickness = w.thickness ?? WALL_DEFAULTS.thickness, tw = w.towers, size2 = tw?.size ?? WALL_DEFAULTS.towerSize, shape = tw?.shape ?? "round";
  const towers = [];
  if (tw) {
    const at4 = tw.at ?? "corners", verts = at4 === "corners" ? ring2.map((_, i) => i) : at4.filter((i) => i >= 0 && i < ring2.length);
    for (const i of verts) towers.push({ x: ring2[i][0], y: ring2[i][1], shape, size: size2, source: "corner", vertex: i });
  }
  const gates = (w.gates ?? []).map((g) => {
    const s = snapToRing(ring2, g.at), width = g.width ?? (g.kind === "postern" ? WALL_DEFAULTS.posternWidth : WALL_DEFAULTS.gateWidth);
    const dx = Math.cos(s.angle * Math.PI / 180), dy = Math.sin(s.angle * Math.PI / 180), off = width / 2 + size2 / 2;
    const side = g.kind === "gate" ? [-1, 1].map((sg) => ({ x: s.x + sg * off * dx, y: s.y + sg * off * dy, shape, size: size2, source: "gate" })) : [];
    towers.push(...side);
    return { kind: g.kind, x: s.x, y: s.y, angle: s.angle, width, ...g.room !== void 0 && { room: g.room }, towers: side };
  });
  const ids = w.rooms ?? l.rooms.map((g) => g.room.id);
  const enclosed = ids.map((room3) => {
    const g = byId2.get(room3), flat2 = ring2.flat();
    return { room: room3, inside: !!g && g.outline.every((_, i) => i % 2 || inPolygon(flat2, g.outline[i], g.outline[i + 1]) || onRing(ring2, g.outline[i], g.outline[i + 1])) };
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

// ../artgen-mapgen/src/dungeon/layout.ts
var idSeed = (id2) => [...id2].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
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
function inPolygon(p2, x, y) {
  let inside = false;
  for (let i = 0, j = p2.length - 2; i < p2.length; j = i, i += 2) {
    const xi = p2[i], yi = p2[i + 1], xj = p2[j], yj = p2[j + 1];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function edgeDistance(p2, x, y) {
  let d = Infinity;
  for (let i = 0, j = p2.length - 2; i < p2.length; j = i, i += 2) {
    const ax = p2[j], ay = p2[j + 1], bx = p2[i], by = p2[i + 1], L2 = (bx - ax) ** 2 + (by - ay) ** 2;
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
var reversed = (p2) => {
  const out = [];
  for (let i = p2.length - 2; i >= 0; i -= 2) out.push(p2[i], p2[i + 1]);
  return out;
};
var pointEnd = (path) => ({ x: path[0], y: path[1], angle: Math.atan2(path[1] - path[3], path[0] - path[2]) * 180 / Math.PI, along: 0 });
function corridorGeom(c, index, rooms, byId2, lineOf, spec) {
  const width = c.width ?? 1, how = c.route ?? "auto";
  const simple = (e) => "at" in e || "room" in e && e.side === void 0;
  let pts2;
  if (simple(c.from) && simple(c.to)) {
    const end = (e) => "room" in e ? byId2.get(e.room) : e.at;
    const a = end(c.from), b = end(c.to), pa = Array.isArray(a) ? a : [a.cx, a.cy], pb = Array.isArray(b) ? b : [b.cx, b.cy];
    pts2 = c.via?.length ? [...pa, ...c.via, ...pb] : how === "around" ? around(pa, pb, a, b, width, rooms, spec) ?? route(a, b, width, "auto", rooms) : route(a, b, width, how, rooms);
  } else {
    const port = (e, other) => {
      if ("room" in e) {
        const g = byId2.get(e.room);
        return e.side ? sidePort(g, e.side, e.offset, width) : { p: [g.cx, g.cy], room: g };
      }
      if ("at" in e) return { p: e.at };
      return junctionPort(lineOf.get(e.corridor) ?? [0, 0, 0, 0], e.near ?? other);
    };
    const guess = (e) => "room" in e ? [byId2.get(e.room).cx, byId2.get(e.room).cy] : "at" in e ? e.at : e.near ?? [spec.cols / 2, spec.rows / 2];
    const b0 = "corridor" in c.to ? null : port(c.to, guess(c.from)), a = port(c.from, b0 ? b0.stub ?? b0.p : guess(c.to)), b = b0 ?? port(c.to, a.stub ?? a.p);
    const A = a.stub ?? a.p, B = b.stub ?? b.p;
    const mid = c.via?.length ? [...A, ...c.via, ...B] : how === "straight" ? [...A, ...B] : how === "around" ? around(A, B, a.room ?? A, b.room ?? B, width, rooms, spec) ?? portRoute(a, b, width) : how === "hv" ? [...A, B[0], A[1], ...B] : how === "vh" ? [...A, A[0], B[1], ...B] : portRoute(a, b, width);
    pts2 = tidy([...a.p, ...mid, ...b.p]);
  }
  if (c.curve === "smooth") pts2 = smoothLine2(pts2);
  const ends = [[c.from, pts2], [c.to, reversed(pts2)]].map(([e, path]) => "room" in e ? exitPoint(byId2.get(e.room).outline, path) : pointEnd(path));
  const outline2 = c.style === "natural" ? naturalOutline(pts2, width, c.seed ?? idSeed(c.id ?? `corridor-${index}`)) : void 0;
  return { index, pts: pts2, width, ends, ...outline2?.length && { outline: outline2 } };
}
function around(A, B, a, b, width, rooms, spec) {
  const avoid = rooms.filter((g) => g !== a && g !== b && g.room.fill !== "cellar" && g.room.fill !== "yard" && !inPolygon(g.outline, A[0], A[1]) && !inPolygon(g.outline, B[0], B[1]));
  return routeAround(A, B, width, avoid, spec.cols, spec.rows);
}
function layoutDungeon(spec) {
  let auto = 0;
  const rooms = spec.rooms.map((room3, index) => {
    const outline2 = roomOutline(room3), [cx, cy] = roomAnchor(room3, outline2);
    const number = room3.number === false ? void 0 : room3.number ?? ++auto;
    if (typeof room3.number === "number") auto = Math.max(auto, room3.number);
    return { room: room3, index, outline: outline2, cx, cy, number };
  });
  const byId2 = new Map(rooms.map((g) => [g.room.id, g]));
  const geoms = new Array(spec.corridors.length), lineOf = /* @__PURE__ */ new Map();
  for (const index of corridorOrder(spec.corridors) ?? spec.corridors.map((_, i) => i)) {
    const c = spec.corridors[index];
    geoms[index] = corridorGeom(c, index, rooms, byId2, lineOf, spec);
    if (c.id) lineOf.set(c.id, geoms[index].pts);
  }
  const corridors = geoms, doors = [];
  corridors.forEach((g, index) => g.ends.forEach((p2, i) => {
    const kind = spec.corridors[index].doors?.[i];
    if (p2 && kind) doors.push({ kind, x: p2.x, y: p2.y, angle: p2.angle, width: g.width, corridor: index });
  }));
  const { connections, partitions } = layoutConnections(spec, rooms, byId2);
  for (const c of connections) if (c.kind !== "open" && c.wall) doors.push({ kind: c.kind, x: c.x, y: c.y, angle: c.angle, width: c.width, corridor: -1, connection: c.index, inner: true });
  return { rooms, corridors, doors, connections, partitions };
}
var near2 = (a, b, e = 1e-6) => a.x <= b.x + b.w + e && b.x <= a.x + a.w + e && a.y <= b.y + b.h + e && b.y <= a.y + a.h + e;
function layoutConnections(spec, rooms, byId2) {
  const connections = (spec.connections ?? []).map((c, index) => {
    const A = byId2.get(c.a), B = byId2.get(c.b), width = c.width ?? 1, kind = c.kind ?? "door";
    const segs = sharedEdges(A.outline, B.outline);
    if (!segs.length) {
      const [x2, y2] = c.at ?? [(A.cx + B.cx) / 2, (A.cy + B.cy) / 2];
      return { index, a: c.a, b: c.b, kind, x: x2, y: y2, angle: Math.atan2(B.cy - A.cy, B.cx - A.cx) * 180 / Math.PI, width, wall: null };
    }
    const len = (g) => Math.hypot(g[1][0] - g[0][0], g[1][1] - g[0][1]);
    const proj = (g, p2) => {
      const L3 = len(g) || 1, t = ((p2[0] - g[0][0]) * (g[1][0] - g[0][0]) + (p2[1] - g[0][1]) * (g[1][1] - g[0][1])) / (L3 * L3);
      return t * L3;
    };
    const dist = (g, p2) => {
      const t = Math.max(0, Math.min(len(g), proj(g, p2))) / (len(g) || 1);
      return Math.hypot(g[0][0] + (g[1][0] - g[0][0]) * t - p2[0], g[0][1] + (g[1][1] - g[0][1]) * t - p2[1]);
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
      }).filter((v) => !!v).sort((p2, q) => p2[0] - q[0]);
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
  const add = (p2, pad = 0) => {
    for (let i = 0; i < p2.length; i += 2) {
      xs.push(p2[i] - pad, p2[i] + pad);
      ys.push(p2[i + 1] - pad, p2[i + 1] + pad);
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
  const mv = (p2) => p2.map((v, i) => v + (i % 2 ? dy : dx));
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
  let at4 = 0;
  const point = (i, t) => [path[i] + (path[i + 2] - path[i]) * t, path[i + 1] + (path[i + 3] - path[i + 1]) * t];
  for (let i = 0; i + 3 < path.length; i += 2) {
    const len = Math.hypot(path[i + 2] - path[i], path[i + 3] - path[i + 1]);
    if (len > 0 && at4 + len > from && at4 < to) {
      out.push(...point(i, Math.max(0, (from - at4) / len)), ...point(i, Math.min(1, (to - at4) / len)));
    }
    at4 += len;
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
  const add = (p2, pad) => {
    for (let i = 0; i < p2.length; i += 2) {
      xs.push(p2[i] - pad, p2[i] + pad);
      ys.push(p2[i + 1] - pad, p2[i + 1] + pad);
    }
  };
  for (const ref of ids) {
    const g = findRoom(l, ref), id2 = g.room.id;
    add(g.outline, 0.5);
    spec.corridors.forEach((sc, i) => {
      const c = l.corridors[i];
      [sc.from, sc.to].forEach((e, end) => {
        const x = c.ends[end];
        if (!("room" in e) || e.room !== id2 || !x) return;
        add(stretch(end === 0 ? c.pts : reversed(c.pts), x.along, x.along + margin), c.width / 2 + 0.5);
      });
    });
  }
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
}

// ../artgen-mapgen/src/dungeon/blocks.ts
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
    [(p2) => p2[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
    [(p2) => p2[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [(p2) => p2[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]],
    [(p2) => p2[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]
  ];
  for (const [inside, cut] of edges2) {
    const out = [];
    pts2.forEach((p2, i) => {
      const prev = pts2[(i + pts2.length - 1) % pts2.length];
      if (inside(p2)) {
        if (!inside(prev)) out.push(cut(prev, p2));
        out.push(p2);
      } else if (inside(prev)) out.push(cut(prev, p2));
    });
    pts2 = out;
    if (!pts2.length) return [];
  }
  const r = (v) => Math.round(v * 1e6) / 1e6, flat2 = [];
  for (const p2 of pts2.map(([x, y]) => [r(x), r(y)])) if (!flat2.length || flat2[flat2.length - 1][0] !== p2[0] || flat2[flat2.length - 1][1] !== p2[1]) flat2.push(p2);
  if (flat2.length > 1 && flat2[0][0] === flat2[flat2.length - 1][0] && flat2[0][1] === flat2[flat2.length - 1][1]) flat2.pop();
  const keep = flat2.filter((p2, i) => {
    const a = flat2[(i + flat2.length - 1) % flat2.length], b = flat2[(i + 1) % flat2.length];
    return Math.abs((p2[0] - a[0]) * (b[1] - a[1]) - (p2[1] - a[1]) * (b[0] - a[0])) > 1e-9;
  });
  return keep.length >= 3 ? keep.flat() : [];
}
function pieces(b, rand) {
  const x0 = Math.floor(b.x), y0 = Math.floor(b.y), x1 = Math.ceil(b.x + b.w), y1 = Math.ceil(b.y + b.h);
  const min = Math.max(1, b.split.min ?? 3), mode = b.split.mode;
  const along2 = (lo, hi, cuts, n) => {
    const at4 = cuts?.length ? cuts.filter((c) => c > lo && c < hi).sort((p2, q) => p2 - q) : Array.from({ length: n - 1 }, (_, i) => Math.round(lo + (hi - lo) * (i + 1) / n));
    return [lo, ...at4, hi];
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
    const len = vertical ? w : h, at4 = (vertical ? r[0] : r[1]) + min + Math.floor(rand() * (len - 2 * min + 1));
    if (vertical) {
      cut([r[0], r[1], at4, r[3]], depth + 1);
      cut([at4, r[1], r[2], r[3]], depth + 1);
    } else {
      cut([r[0], r[1], r[2], at4], depth + 1);
      cut([r[0], at4, r[2], r[3]], depth + 1);
    }
  };
  cut([x0, y0, x1, y1], 0);
  return out;
}
function splitBlock(b) {
  const rand = rng(b.split.seed ?? idSeed(b.id)), outline2 = blockOutline(b), origin = `block:${b.id}`, min = Math.max(1, b.split.min ?? 3);
  const small = Math.max(2, min * min * 0.35), area3 = (r) => {
    const c = clipToRect(outline2, r);
    return c.length ? polygonArea(c) : 0;
  };
  let rects = pieces(b, rand).filter((r) => area3(r) > 1e-6);
  for (let merged = true; merged; ) {
    merged = false;
    for (const r of rects) {
      if (area3(r) >= small) continue;
      const side = rects.filter((n2) => n2 !== r && (n2[1] === r[1] && n2[3] === r[3] && (n2[2] === r[0] || n2[0] === r[2]) || n2[0] === r[0] && n2[2] === r[2] && (n2[3] === r[1] || n2[1] === r[3])));
      if (!side.length) continue;
      const n = side.reduce((m, x) => area3(x) > area3(m) ? x : m), u = [Math.min(r[0], n[0]), Math.min(r[1], n[1]), Math.max(r[2], n[2]), Math.max(r[3], n[3])];
      rects = [...rects.filter((x) => x !== r && x !== n), u];
      merged = true;
      break;
    }
  }
  rects.sort((p2, q) => p2[1] - q[1] || p2[0] - q[0]);
  const rooms = [];
  for (const r of rects) {
    const clip = clipToRect(outline2, r);
    if (!clip.length || polygonArea(clip) < small) continue;
    const id2 = `${b.id}-${rooms.length + 1}`, whole = Math.abs(polygonArea(clip) - (r[2] - r[0]) * (r[3] - r[1])) < 1e-6;
    rooms.push(whole ? { id: id2, shape: "rect", x: r[0], y: r[1], w: r[2] - r[0], h: r[3] - r[1], origin } : { id: id2, shape: "poly", points: clip, ...polyBox(clip), origin });
  }
  const outlines = rooms.map((r) => roomOutline(r)), pairs2 = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++)
    if (sharedEdges(outlines[i], outlines[j]).some(([p2, q]) => Math.hypot(q[0] - p2[0], q[1] - p2[1]) >= 1 - 1e-6)) pairs2.push([i, j]);
  for (let i = pairs2.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs2[i], pairs2[j]] = [pairs2[j], pairs2[i]];
  }
  const group = rooms.map((_, i) => i), find = (i) => group[i] === i ? i : group[i] = find(group[i]);
  const tree2 = /* @__PURE__ */ new Set(), extra = b.doors ?? 0.25;
  pairs2.forEach(([i, j], k) => {
    if (find(i) !== find(j)) {
      group[find(i)] = find(j);
      tree2.add(k);
    }
  });
  const used = pairs2.filter((_, k) => tree2.has(k) || rand() < extra);
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
function applyBlock(spec, id2) {
  const b = spec.blocks?.find((x) => x.id === id2);
  if (!b) throw new Error(`no block ${id2} (have: ${(spec.blocks ?? []).map((x) => x.id).join(", ") || "none"})`);
  const origin = `block:${id2}`, made = splitBlock(b), out = structuredClone(spec);
  const replace2 = (list6, fresh) => {
    const at4 = list6.findIndex((e) => e.origin === origin), rest = list6.filter((e) => e.origin !== origin);
    const pos = at4 < 0 ? rest.length : list6.slice(0, at4).filter((e) => e.origin !== origin).length;
    return [...rest.slice(0, pos), ...fresh, ...rest.slice(pos)];
  };
  out.rooms = replace2(out.rooms, made.rooms);
  const ids = new Set(out.rooms.map((r) => r.id)), dropped = [];
  const conns = replace2(out.connections ?? [], made.connections).filter((c) => {
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
function removeBlock(spec, id2) {
  const origin = `block:${id2}`, gone = new Set(spec.rooms.filter((r) => r.origin === origin).map((r) => r.id));
  spec.blocks = (spec.blocks ?? []).filter((b) => b.id !== id2);
  if (!spec.blocks.length) delete spec.blocks;
  spec.rooms = spec.rooms.filter((r) => !gone.has(r.id));
  if (spec.connections) {
    spec.connections = spec.connections.filter((c) => !gone.has(c.a) && !gone.has(c.b));
    if (!spec.connections.length) delete spec.connections;
  }
  spec.corridors = withoutDangling(spec.corridors.filter((c) => ![c.from, c.to].some((e) => "room" in e && gone.has(e.room))));
}
function blockRoomNear(spec, id2, x, y) {
  const own = spec.rooms.filter((r) => r.origin === `block:${id2}`);
  if (!own.length) return null;
  return own.reduce((m, r) => Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y) < Math.hypot(m.x + m.w / 2 - x, m.y + m.h / 2 - y) ? r : m).id;
}

// ../artgen-mapgen/src/dungeon/generate.ts
var DOOR_WEIGHTS = { door: 70, secret: 8, locked: 10, portcullis: 6, arch: 6 };
function singleRoom(spec, o) {
  const m = o.margin ?? 3, out = structuredClone(spec);
  const room3 = { id: "r1", shape: o.shape, x: m, y: m, w: o.w, h: o.h, ...o.label && { label: o.label }, ...o.number !== void 0 && { number: o.number } };
  out.cols = o.w + 2 * m;
  out.rows = o.h + 2 * m;
  out.rooms = [room3];
  out.corridors = (o.exits ?? []).map((e) => {
    const w = spec.gen.corridorWidth, odd = Math.round(w) % 2 === 1;
    const mid = (len) => e.at !== void 0 ? e.at : odd ? Math.floor(len / 2) + 0.5 : Math.round(len / 2);
    const at4 = e.side === "n" ? [m + mid(o.w), -1] : e.side === "s" ? [m + mid(o.w), out.rows + 1] : e.side === "w" ? [-1, m + mid(o.h)] : [out.cols + 1, m + mid(o.h)];
    const via = e.side === "n" || e.side === "s" ? [at4[0], m + o.h / 2] : [m + o.w / 2, at4[1]];
    return { from: { room: "r1" }, to: { at: at4, ...e.text && { exit: { text: e.text } } }, via, width: w, doors: [e.door === void 0 ? "door" : e.door, null] };
  });
  return out;
}
function generateDungeon(spec) {
  if (spec.gen.layout === "dense") return generateDense(spec);
  if (spec.gen.layout === "blocks") return generateBlocks(spec);
  const g = spec.gen, r = rng(spec.seed * 7919 + 13), out = structuredClone(spec);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const placed = [];
  const free = (x, y, w, h) => placed.every((p2) => x >= p2.x + p2.w + g.spacing || p2.x >= x + w + g.spacing || y >= p2.y + p2.h + g.spacing || p2.y >= y + h + g.spacing);
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
  placed.forEach((p2, i) => {
    p2.id = `r${i + 1}`;
  });
  const c = (p2) => [p2.x + p2.w / 2, p2.y + p2.h / 2];
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
  const cands = placed.flatMap((p2, i) => placed.map((q, j) => [i, j, dist(p2, q)]).filter(([, j]) => j > i)).filter(([i, j]) => !has(i, j)).sort((a, b) => a[2] - b[2]).slice(0, placed.length * 2);
  for (const [i, j] of cands) {
    if (links.length >= placed.length - 1 + extra) break;
    if (r() < 0.6) links.push([i, j]);
  }
  const door3 = (room3) => {
    if (room3.shape === "cave" || r() >= g.doors) return null;
    let t = r() * 100;
    for (const k of DOOR_KINDS) {
      t -= DOOR_WEIGHTS[k];
      if (t < 0) return k;
    }
    return "door";
  };
  const corridors = links.map(([i, j]) => ({ from: { room: placed[i].id }, to: { room: placed[j].id }, width: g.corridorWidth, doors: [door3(placed[i]), door3(placed[j])] }));
  if (g.entrance && placed.length) corridors.unshift(entrance(spec, placed[0], placed[0].shape === "cave" ? null : "door"));
  out.rooms = placed;
  out.corridors = corridors;
  delete out.connections;
  delete out.blocks;
  return out;
}
function entrance(spec, p2, door3) {
  const g = spec.gen, cx = p2.x + p2.w / 2, cy = p2.y + p2.h / 2, odd = Math.round(g.corridorWidth) % 2 === 1, s = (v) => odd ? Math.floor(v) + 0.5 : Math.round(v);
  const d = [[cy, "n"], [spec.rows - cy, "s"], [cx, "w"], [spec.cols - cx, "e"]];
  const side = d.reduce((a, b) => b[0] < a[0] ? b : a)[1];
  const at4 = side === "n" ? [s(cx), -1] : side === "s" ? [s(cx), spec.rows + 1] : side === "w" ? [-1, s(cy)] : [spec.cols + 1, s(cy)];
  const via = side === "n" || side === "s" ? [at4[0], cy] : [cx, at4[1]];
  return { from: { room: p2.id }, to: { at: at4 }, via, width: g.corridorWidth, doors: [door3, null] };
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
  rooms.forEach((p2, i) => {
    p2.id = `r${i + 1}`;
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
    const tree2 = find(i) !== find(j);
    if (tree2) group[find(i)] = find(j);
    if (!tree2 && r() >= loops * 0.6) return [];
    const kind = doorOrOpen(r, doors);
    return [{ a: rooms[i].id, b: rooms[j].id, ...kind !== "door" && { kind } }];
  });
}
function generateDense(spec) {
  const g = spec.gen, r = rng(spec.seed * 7919 + 17), out = structuredClone(spec), int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const placed = [], target = (g.density ?? 0.5) * spec.cols * spec.rows;
  const fits = (x, y, w, h) => x >= 1 && y >= 1 && x + w <= spec.cols - 1 && y + h <= spec.rows - 1 && placed.every((p2) => x >= p2.x + p2.w || p2.x >= x + w || y >= p2.y + p2.h || p2.y >= y + h);
  const touch = (x, y, w, h) => placed.reduce((n, p2) => {
    const vx = Math.min(x + w, p2.x + p2.w) - Math.max(x, p2.x), vy = Math.min(y + h, p2.y + p2.h) - Math.max(y, p2.y);
    return n + ((x === p2.x + p2.w || p2.x === x + w) && vy > 0 ? vy : 0) + ((y === p2.y + p2.h || p2.y === y + h) && vx > 0 ? vx : 0);
  }, 0);
  const w0 = int(g.minSize, g.maxSize), h0 = int(g.minSize, g.maxSize);
  if (w0 <= spec.cols - 2 && h0 <= spec.rows - 2) placed.push({ id: "", shape: "rect", x: Math.floor((spec.cols - w0) / 2), y: Math.floor((spec.rows - h0) / 2), w: w0, h: h0 });
  for (let tries = 0; placed.length && placed.length < g.rooms && tries < g.rooms * 60; tries++) {
    if (placed.reduce((n, p2) => n + p2.w * p2.h, 0) >= target) break;
    let best = null, bestScore = -1;
    for (let k = 0; k < 8; k++) {
      const p2 = placed[Math.floor(r() * placed.length)], w = int(g.minSize, g.maxSize), h = int(g.minSize, g.maxSize), side = Math.floor(r() * 4);
      const x = side === 1 ? p2.x + p2.w : side === 3 ? p2.x - w : int(p2.x - w + 2, p2.x + p2.w - 2);
      const y = side === 2 ? p2.y + p2.h : side === 0 ? p2.y - h : int(p2.y - h + 2, p2.y + p2.h - 2);
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
  const gap = (p2) => Math.min(p2.x, p2.y, spec.cols - p2.x - p2.w, spec.rows - p2.y - p2.h);
  return rooms.reduce((m, p2) => gap(p2) < gap(m) ? p2 : m);
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
    const id2 = `b${k + 1}`, split = { mode: "bsp", min: g.minSize, seed: int(1, 1e6) }, roll = r();
    out.blocks.push(roll < g.round / 2 ? { id: id2, shape: "poly", points: hexPoints(x, y, w, h), x, y, w, h, split, doors: g.loops } : roll < g.round ? { id: id2, shape: "octagon", x, y, w, h, split, doors: g.loops } : { id: id2, shape: "rect", x, y, w, h, split, doors: g.loops });
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

// ../artgen-mapgen/src/dungeon/symbols.ts
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

// ../artgen-mapgen/src/dungeon/exits.ts
var EXIT_FADE = 3;
function pointAt(path, d) {
  let at4 = 0;
  for (let i = 0; i + 3 < path.length; i += 2) {
    const len = Math.hypot(path[i + 2] - path[i], path[i + 3] - path[i + 1]);
    if (at4 + len >= d && len > 0) {
      const t = (d - at4) / len;
      return [path[i] + (path[i + 2] - path[i]) * t, path[i + 1] + (path[i + 3] - path[i + 1]) * t];
    }
    at4 += len;
  }
  return [path[path.length - 2], path[path.length - 1]];
}
function onSheet(path, cols, rows2) {
  const inside = (x, y) => x >= 0 && y >= 0 && x <= cols && y <= rows2;
  if (inside(path[0], path[1])) return 0;
  let at4 = 0;
  for (let i = 0; i + 3 < path.length; i += 2) {
    const x0 = path[i], y0 = path[i + 1], x1 = path[i + 2], y1 = path[i + 3], len = Math.hypot(x1 - x0, y1 - y0);
    if (inside(x1, y1)) {
      const dx = x1 - x0, dy = y1 - y0;
      let t = 0;
      for (const [p2, q] of [[-dx, x0], [dx, cols - x0], [-dy, y0], [dy, rows2 - y0]]) if (p2 < 0) t = Math.max(t, q / p2);
      return at4 + len * t;
    }
    at4 += len;
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

// ../artgen-mapgen/src/dungeon/furniture.ts
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
  const moved = out.filter((p2) => p2.outside).sort((a, b) => (a.item.rank ?? 0) - (b.item.rank ?? 0));
  const placed = [];
  let right = 0, bottom = 0;
  if (side === "bottom") {
    let x = fr.x + pad, y = fr.b + pad, row = 0;
    for (const p2 of moved) {
      if (x > fr.x + pad && x + p2.item.w + pad > fr.r) {
        x = fr.x + pad;
        y += row + pad;
        row = 0;
      }
      placed.push({ item: p2.item, x, y, outside: true });
      x += p2.item.w + pad;
      row = Math.max(row, p2.item.h);
      bottom = Math.max(bottom, y + row + pad - fr.b);
      right = Math.max(right, x - fr.r);
    }
  } else {
    let x = fr.r + pad, y = fr.y + pad, col = 0;
    for (const p2 of moved) {
      if (y > fr.y + pad && y + p2.item.h + pad > fr.b) {
        y = fr.y + pad;
        x += col + pad;
        col = 0;
      }
      placed.push({ item: p2.item, x, y, outside: true });
      y += p2.item.h + pad;
      col = Math.max(col, p2.item.w);
      right = Math.max(right, x + col + pad - fr.r);
      bottom = Math.max(bottom, y - fr.b);
    }
  }
  for (const p2 of out) if (!p2.outside) placed.push({ item: p2.item, x: p2.item.over.x, y: p2.item.over.y, outside: false });
  placed.sort((a, b) => items.indexOf(a.item) - items.indexOf(b.item));
  return { placed, band: { right: Math.max(0, right), bottom: Math.max(0, bottom) } };
}

// ../artgen-mapgen/src/dungeon/underlay.ts
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

// ../artgen-mapgen/src/dungeon/render.ts
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
function dungeonLabelLayout(spec, k, pageScale, l = layoutDungeon(spec), numbers3 = spec.numbers) {
  const raw = spec.overlay.labels.map((lb) => ({ x: lb.x * k, y: lb.y * k }));
  if (!pageScale) return { at: raw, unplaced: [] };
  const u = pageUnit(pageScale), obstacles = spec.overlay.symbols.map((s) => {
    const z = PAGE_SYMBOL_MM * pageScale * (s.scale ?? 1);
    return { x: s.x * k - z / 2, y: s.y * k - z / 2, w: z, h: z };
  });
  for (const g of l.rooms) {
    const x = g.cx * k, y = g.cy * k, fs = numberSize(u, pageScale), badge2 = numbers3 && g.number !== void 0;
    if (badge2) {
      const txt = String(g.number), bh = fs * 1.45, bw = Math.max(bh, txt.length * fs * 0.62 + fs * 0.7);
      obstacles.push({ x: x - bw / 2, y: y - bh / 2, w: bw, h: bh });
    }
    if (g.room.label) obstacles.push(textBox(g.room.label, x, y + (badge2 ? fs * 1.6 : fs * 0.3), nameSize(u, pageScale), { bold: true }));
  }
  const items = spec.overlay.labels.map((lb) => {
    const size2 = labelSize2(lb, u, pageScale), text2 = lb.kind === "area" ? lb.text.toUpperCase() : lb.text;
    return { x: lb.x * k, y: lb.y * k, box: textBox(text2, lb.x * k, lb.y * k + size2 * 0.35, size2, { bold: lb.kind !== "note", spacing: lb.kind === "area" ? size2 * 0.16 : 0 }), clear: 0 };
  });
  const placed = placeLabels(items, obstacles, { x: 0, y: 0, w: spec.cols * k, h: spec.rows * k }, pageScale * 0.3);
  return { at: placed.map((p2) => ({ x: p2.x, y: p2.y })), unplaced: placed.flatMap((p2, index) => p2.placed ? [] : [{ index, text: spec.overlay.labels[index].text }]) };
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
function wrapText(text2, max2) {
  const lines2 = [];
  for (const word of text2.split(/\s+/).filter(Boolean)) {
    const last = lines2[lines2.length - 1];
    if (last !== void 0 && last.length + 1 + word.length <= max2) lines2[lines2.length - 1] = `${last} ${word}`;
    else lines2.push(word);
  }
  return lines2.length ? lines2 : [""];
}
function clockwise(p2) {
  if (area2(p2) >= 0) return p2;
  const out = [];
  for (let i = p2.length - 2; i >= 0; i -= 2) out.push(p2[i], p2[i + 1]);
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
  const floor3 = (fill, extra) => (roomD ? `<path d="${roomD}" fill="${fill}"${extra ? ` stroke="${fill}" stroke-width="${n1(extra * 2)}" stroke-linejoin="miter"` : ""}/>` : "") + corr.map((c) => `<path d="${c.d}" fill="none" stroke="${fill}" stroke-width="${n1(c.w + extra * 2)}" stroke-linecap="square" stroke-linejoin="miter"/>`).join("");
  const inner = l.partitions.length ? `<path id="partitions" d="${l.partitions.map((p2) => `M${n1(p2[0] * k)} ${n1(p2[1] * k)}L${n1(p2[2] * k)} ${n1(p2[3] * k)}`).join("")}" stroke="${INK}" stroke-width="${n1(t * 1.1)}" stroke-linecap="square" fill="none"/>` : "";
  if (on.floors) parts.push(`<g id="floors"><g id="walls">${floor3(INK, t)}</g><g id="floor">${floor3(PAPER, 0)}</g>${inner}</g>`);
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
    if (clip) defs.push(`<mask id="floor-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${floor3("#ffffff", 0)}</mask>`);
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
      const fs = o.pageScale ? pointsToPx(PAGE_PT.dungeon.note, o.pageScale) : 12 * u, lines2 = wrapText(x.exit.text, Math.abs(x.dir[0]) > Math.abs(x.dir[1]) ? 16 : 28);
      const w = Math.max(...lines2.map((t2) => t2.length)) * fs * 0.56 + 14 * u, h = fs * (0.7 + 1.2 * lines2.length);
      const reach = Math.abs(x.dir[0]) * w / 2 + Math.abs(x.dir[1]) * h / 2 + 4 * u;
      const cx = Math.min(fr.r - w / 2 - 2 * u, Math.max(fr.x + w / 2 + 2 * u, x.edge[0] * k - x.dir[0] * reach));
      const cy = Math.min(fr.b - h / 2 - 2 * u, Math.max(fr.y + h / 2 + 2 * u, x.edge[1] * k - x.dir[1] * reach));
      const text2 = lines2.map((t2, j) => `<text x="${n1(cx)}" y="${n1(cy + fs * (0.35 + 1.2 * (j - (lines2.length - 1) / 2)))}" font-size="${n1(fs)}" text-anchor="middle" fill="${INK}">${esc(t2)}</text>`).join("");
      g += linked(x.exit.href, `<rect x="${n1(cx - w / 2)}" y="${n1(cy - h / 2)}" width="${n1(w)}" height="${n1(h)}" fill="${PAPER}" stroke="${INK}" stroke-width="${n1(1.2 * u)}"/>${text2}`);
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
    const at4 = dungeonLabelLayout(spec, k, o.pageScale, l, on.numbers).at;
    const g = spec.overlay.labels.map((lb, i) => {
      const base = labelSize2(lb, u, o.pageScale), lx = at4[i].x / k, ly = at4[i].y / k;
      const attrs = lb.kind === "area" ? `font-weight="700" letter-spacing="${n1(base * 0.16)}"` : lb.kind === "name" ? 'font-weight="700"' : 'font-style="italic"';
      const tx = haloText(lb.kind === "area" ? lb.text.toUpperCase() : lb.text, lx * k, ly * k + base * 0.35, base, INK, TH, attrs);
      return linked(lb.href, lb.angle ? `<g transform="rotate(${n1(lb.angle)} ${n1(lx * k)} ${n1(ly * k)})">${tx}</g>` : tx);
    }).join("");
    parts.push(`<g id="labels">${g}</g>`);
  }
  const furn = dungeonFurniture(spec, o, l, on);
  const drawn = furn.placed.map((p2) => p2.item.draw(p2.x, p2.y)).join("");
  const out = { ...fr, w: fr.w + furn.band.right, h: fr.h + furn.band.bottom, r: fr.r + furn.band.right, b: fr.b + furn.band.bottom };
  const band = furn.band.right || furn.band.bottom ? `<rect x="${n1(out.x)}" y="${n1(out.y)}" width="${n1(out.w)}" height="${n1(out.h)}" fill="${PAPER}"/>` : "";
  const frame = band ? `<rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}" fill="none" stroke="${INK}" stroke-width="${n1(1.5 * u)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(out, o.unit)} font-family="${FONT}"><defs>${defs.join("")}<clipPath id="map-clip"><rect x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}"/></clipPath></defs>${band}<g clip-path="url(#map-clip)">${parts.join("")}${band ? "" : drawn}</g>${frame}${band ? drawn : ""}</svg>`;
}

// ../artgen-mapgen/src/dungeon/facts.ts
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
  const pt3 = (x, y) => [rnd(x), rnd(y)];
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
  const byId2 = new Map(rooms.map((r) => [r.id, r]));
  const corridors = [], exits = [], reached = /* @__PURE__ */ new Set();
  spec.corridors.forEach((c, index) => {
    const geom = layout.corridors[index], doors = [c.doors?.[0] ?? null, c.doors?.[1] ?? null];
    let run2 = 0;
    for (let i = 2; i < geom.pts.length; i += 2) run2 += Math.hypot(geom.pts[i] - geom.pts[i - 2], geom.pts[i + 1] - geom.pts[i - 1]);
    run2 = Math.max(0, run2 - (geom.ends[0]?.along ?? 0) - (geom.ends[1]?.along ?? 0));
    const joins = ends.flatMap((side, k) => {
      const e = c[side];
      if (!("corridor" in e)) return [];
      const j = spec.corridors.findIndex((x) => x.id === e.corridor), p2 = geom.ends[k];
      return j >= 0 && p2 ? [{ corridor: j, at: pt3(p2.x, p2.y) }] : [];
    });
    corridors.push({ index, from: c.from, to: c.to, width: geom.width, doors, length: length(run2), ...joins.length && { joins } });
    ends.forEach((side, k) => {
      const e = c[side], p2 = geom.ends[k], other = roomOf(c[ends[1 - k]]);
      if ("room" in e) {
        reached.add(e.room);
        if (doors[k]) byId2.get(e.room)?.doors.push({ kind: doors[k], at: p2 ? pt3(p2.x, p2.y) : null, corridor: index, to: other });
      } else if ("at" in e) {
        const [x, y] = e.at, dist = [["n", y], ["e", spec.cols - x], ["s", spec.rows - y], ["w", x]];
        const [edge, d] = dist.reduce((a, b) => b[1] < a[1] ? b : a);
        exits.push({ corridor: index, end: side, at: pt3(x, y), room: other, door: doors[k], edge, distance: length(d), ...e.exit && { text: e.exit.text }, ...e.exit?.href && { href: e.exit.href } });
      }
    });
  });
  for (const c of layout.connections) for (const [id2, other] of [[c.a, c.b], [c.b, c.a]]) {
    const r = byId2.get(id2);
    if (!r) continue;
    reached.add(id2);
    (r.connections ??= []).push({ to: other, kind: c.kind, at: c.wall ? pt3(c.x, c.y) : null, connection: c.index });
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

// ../artgen-mapgen/src/dungeon/sync.ts
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
  const labels = take("labels", target.overlay.labels, from.overlay.labels), symbols4 = take("symbols", target.overlay.symbols, from.overlay.symbols);
  const ids = new Set(rooms.list.map((r) => r.id));
  const dropped = (name, list6, source, refs) => list6.filter((e) => {
    const missing = refs(e).find((id2) => !ids.has(id2));
    if (missing === void 0 || e.origin === origin) return true;
    conflicts.push({ kind: "dropped", list: name, index: source.indexOf(e), message: `${name}[${source.indexOf(e)}] is dropped: it refers to ${missing}, which the sync removed` });
    return false;
  });
  const end = (e) => "room" in e ? [e.room] : [];
  const keptRooms = dropped("corridors", corridors.list, target.corridors, (c) => [...end(c.from), ...end(c.to)]);
  let keptCorridors = keptRooms;
  for (let changed = true; changed; ) {
    const corridorIds = new Set(keptCorridors.flatMap((c) => c.id ? [c.id] : []));
    const next4 = keptCorridors.filter((c) => {
      const missing = [c.from, c.to].find((e) => "corridor" in e && !corridorIds.has(e.corridor));
      if (!missing) return true;
      conflicts.push({ kind: "dropped", list: "corridors", index: target.corridors.indexOf(c), message: `corridors[${target.corridors.indexOf(c)}] is dropped: it joins corridor ${missing.corridor}, which the sync removed` });
      return false;
    });
    changed = next4.length !== keptCorridors.length;
    keptCorridors = next4;
  }
  const keptConnections = dropped("connections", connections.list, target.connections ?? [], (c) => [c.a, c.b]);
  const keptWalls = dropped("walls", walls.list, target.walls ?? [], (w) => [...w.rooms ?? [], ...(w.gates ?? []).flatMap((g) => g.room ? [g.room] : [])]);
  const spec = parseDungeon({
    ...target,
    rooms: rooms.list,
    corridors: keptCorridors,
    ...(target.walls?.length || from.walls?.length) && { walls: keptWalls },
    ...(target.connections?.length || from.connections?.length) && { connections: keptConnections },
    overlay: { labels: labels.list, symbols: symbols4.list }
  });
  const before = layoutDungeon(target).rooms, after = layoutDungeon(spec).rooms;
  const oldMarks = [...target.overlay.labels, ...target.overlay.symbols], newMarks = [...spec.overlay.labels, ...spec.overlay.symbols], pre = [...labels.list, ...symbols4.list];
  newMarks.forEach((m, i) => {
    if (m.origin !== void 0) return;
    const was = oldMarks.includes(pre[i]) ? pre[i] : void 0, room3 = insideRoom(after, m);
    if (room3 !== void 0 && !(was && insideRoom(before, was) !== void 0))
      conflicts.push({ kind: "inside-room", list: m.text !== void 0 ? "labels" : "symbols", index: oldMarks.indexOf(pre[i]), message: `hand ${markName2(m)} at ${m.x},${m.y} is now inside room ${room3}` });
    const over = overMark(newMarks, m);
    if (over && !(was && overMark(oldMarks, was)))
      conflicts.push({ kind: "over-mark", list: m.text !== void 0 ? "labels" : "symbols", index: oldMarks.indexOf(pre[i]), message: `hand ${markName2(m)} at ${m.x},${m.y} is now over ${markName2(over)}` });
  });
  return { spec, report: { version: DUNGEON_FORMAT, origin, lists, conflicts } };
}

// ../artgen-mapgen/src/dungeon/lint.ts
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
    const at4 = `rooms[${i}]`, p2 = g.outline;
    let crossed = false;
    if (g.room.shape === "poly") {
      const pts2 = p2.length / 2;
      for (let k = 0; k < pts2; k++) {
        const j = (k + 1) % pts2;
        if (Math.hypot(p2[2 * j] - p2[2 * k], p2[2 * j + 1] - p2[2 * k + 1]) < 1e-9) {
          add("warning", `${at4}.points`, `corner ${j} repeats corner ${k} (a zero-length wall)`);
          break;
        }
      }
      const x = selfCrossing(p2);
      if (x) {
        add("error", `${at4}.points`, `the outline crosses itself (walls ${x[0]} and ${x[1]}); list the corners in order round the room`);
        crossed = true;
      }
    }
    if (!crossed && Math.abs(area2(p2)) / 2 < MIN_AREA) add("error", at4, `${g.room.id} has almost no floor (${(Math.abs(area2(p2)) / 2).toFixed(2)} square cells)`);
    const r = g.room;
    if (r.x + r.w <= 0 || r.y + r.h <= 0 || r.x >= spec.cols || r.y >= spec.rows) add("warning", at4, `${r.id} is off the sheet (0,0 to ${spec.cols},${spec.rows})`);
    else if (r.x < 0 || r.y < 0 || r.x + r.w > spec.cols || r.y + r.h > spec.rows) add("warning", at4, `${r.id} runs off the sheet (0,0 to ${spec.cols},${spec.rows}); \`dungeon fit\` makes room`);
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
    const sc = spec.corridors[i], at4 = `corridors[${i}]`, joins = roomsOf(i);
    const v = sc.via ?? [];
    for (let k = 2; k < v.length; k += 2) if (v[k] === v[k - 2] && v[k + 1] === v[k - 1]) {
      add("warning", `${at4}.via`, `bend ${k / 2} repeats bend ${k / 2 - 1}`);
      break;
    }
    ["from", "to"].forEach((side, k) => {
      const e = sc[side];
      if ("room" in e && !c.ends[k]) add("warning", `${at4}.${side}`, `the corridor never leaves ${e.room} (it ends inside it)${sc.doors?.[k] ? `, so its ${sc.doors[k]} is not drawn` : ""}`);
      if ("at" in e) {
        const inside = l.rooms.find((g) => inPolygon(g.outline, e.at[0], e.at[1]));
        if (inside) add("warning", `${at4}.${side}`, `ends at ${e.at.join(",")}, inside ${inside.room.id}; link to the room instead`);
      }
    });
    if (lineLength2(c.pts) < 1e-9) add("warning", at4, "the corridor has no length (both ends at one point), so nothing is drawn");
    const hit = /* @__PURE__ */ new Set();
    for (const [x, y] of samples(c.pts, 0.25)) for (const g of l.rooms) {
      if (joins.has(g.room.id) || passable(g) || hit.has(g.room.id)) continue;
      if (inPolygon(g.outline, x, y)) hit.add(g.room.id);
    }
    for (const id2 of hit) add("warning", at4, `runs through ${id2}, which it does not join (set via or route, or link through ${id2})`);
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
    const at4 = `connections[${i}]`;
    if (!c.wall) {
      add("warning", at4, `${c.a} and ${c.b} share no wall, so the ${c.kind === "open" ? "opening" : c.kind} is not drawn; move one room against the other, or link them with a corridor`);
      return;
    }
    const len = Math.hypot(c.wall[1][0] - c.wall[0][0], c.wall[1][1] - c.wall[0][1]);
    if (len < c.width - 1e-6) add("warning", at4, `the wall ${c.a} and ${c.b} share is ${len.toFixed(1)} cells, narrower than the ${c.width}-cell ${c.kind === "open" ? "opening" : c.kind}`);
    const sc = spec.connections[i];
    if (sc.at && Math.hypot(sc.at[0] - c.x, sc.at[1] - c.y) > 0.75) add("warning", `${at4}.at`, `${sc.at.join(",")} is not on the wall ${c.a} and ${c.b} share; the ${c.kind === "open" ? "opening" : c.kind} is at ${c.x.toFixed(1)},${c.y.toFixed(1)}`);
  });
  const badges = spec.numbers ? l.rooms.flatMap((g) => {
    const b = badgeBox(g);
    return b ? [{ g, b }] : [];
  }) : [];
  spec.overlay.symbols.forEach((s, i) => {
    const at4 = `overlay.symbols[${i}]`, z = (s.scale ?? 1) * 0.9, box2 = { x: s.x - z / 2, y: s.y - z / 2, w: z, h: z };
    if (offSheet(s.x, s.y)) add("warning", at4, `${s.kind} at ${s.x},${s.y} is off the sheet`);
    const on = badges.find(({ b }) => overlaps(box2, b));
    if (on) add("warning", at4, `${s.kind} at ${s.x},${s.y} is under room ${on.g.room.id}'s number; move the symbol`);
  });
  const labelBoxes = spec.overlay.labels.map((lb) => {
    const size2 = LABEL_CELLS[lb.kind] * (lb.size ?? 1), text2 = lb.kind === "area" ? lb.text.toUpperCase() : lb.text;
    return textBox(text2, lb.x, lb.y + size2 * 0.35, size2, { bold: lb.kind !== "note", spacing: lb.kind === "area" ? size2 * 0.16 : 0 });
  });
  spec.overlay.labels.forEach((lb, i) => {
    const at4 = `overlay.labels[${i}]`;
    if (offSheet(lb.x, lb.y)) add("warning", at4, `"${lb.text}" at ${lb.x},${lb.y} is off the sheet`);
    const other = labelBoxes.findIndex((b, j) => j < i && !lb.angle && !spec.overlay.labels[j].angle && overlaps(labelBoxes[i], b));
    if (other >= 0) add("warning", at4, `"${lb.text}" overlaps label ${other} "${spec.overlay.labels[other].text}"`);
  });
  return out;
}

// ../artgen-mapgen/src/dungeon/edit.ts
var DUNGEON_OPS = ["add_room", "move_room", "set_room", "remove_room", "add_block", "split_block", "remove_block", "link", "unlink", "connect", "disconnect", "door", "fit"];
function cornerPoint(at4) {
  const [x, y] = parsePoint2(at4);
  return /^\s*-?[\d.]+\s*,/.test(at4) ? [x, y] : [Math.floor(x), Math.floor(y)];
}
function corridorEnd(m, ref, side, offset) {
  if (side !== void 0 && !SIDES.includes(side)) throw new Error(`--from-side / --to-side: ${SIDES.join(", ")}`);
  if (m.rooms.some((r) => r.id === ref)) return { room: ref, ...side && { side }, ...side && offset !== void 0 && { offset } };
  if (side) throw new Error(`a side goes with a room end, and ${ref} is not a room`);
  const c = ref.replace(/^corridor:/, "");
  if (ref.startsWith("corridor:") || m.corridors.some((x) => x.id === c)) {
    if (!m.corridors.some((x) => x.id === c)) throw new Error(`no corridor with id ${c} (give one an id: link \u2026 --id ${c})`);
    return { corridor: c };
  }
  return { at: parsePoint2(ref) };
}
function doorPair(v) {
  if (v === void 0) return void 0;
  const parts = v.split(",").map((s) => s.trim()), kind = (s) => {
    if (!s || s === "none" || s === "open") return null;
    if (!DOOR_KINDS.includes(s)) throw new Error(`--doors: none or one of ${DOOR_KINDS.join(", ")}`);
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
var pt = (v) => Array.isArray(v) ? [Number(v[0]), Number(v[1])] : parsePoint2(String(v));
var corner = (v) => Array.isArray(v) ? pt(v) : cornerPoint(String(v));
var numbers = (v) => v.map(Number);
function room(m, id2) {
  const r = m.rooms.find((x) => x.id === id2);
  if (!r) throw new Error(`no room ${String(id2)} (have: ${m.rooms.map((x) => x.id).join(", ") || "none"})`);
  return r;
}
function corridor(m, i) {
  const c = m.corridors[Number(i)];
  if (!c) throw new Error(`no corridor ${String(i)} (0..${m.corridors.length - 1})`);
  return c;
}
function handEdit(r, fields2) {
  if (r.origin) r.hand = [.../* @__PURE__ */ new Set([...r.hand ?? [], ...fields2])];
}
function replace(m, spec) {
  for (const k of Object.keys(m)) delete m[k];
  Object.assign(m, spec);
}
function linkEnds(m, a, b) {
  const isBlock = (v) => typeof v === "string" && !!m.blocks?.some((x) => x.id === v) && !m.rooms.some((r) => r.id === v);
  const centre = (v) => {
    const r = typeof v === "string" ? m.rooms.find((x) => x.id === v) : void 0;
    if (r) return [r.x + r.w / 2, r.y + r.h / 2];
    try {
      return pt(v);
    } catch {
      return [m.cols / 2, m.rows / 2];
    }
  };
  let [ea, eb] = [a, b];
  if (isBlock(ea)) ea = blockRoomNear(m, ea, ...isBlock(eb) ? [m.cols / 2, m.rows / 2] : centre(eb)) ?? ea;
  if (isBlock(eb)) eb = blockRoomNear(m, eb, ...centre(ea)) ?? eb;
  return [ea, eb];
}
var show = (v) => typeof v === "string" ? v : JSON.stringify(v);
function editDungeon(m, o) {
  switch (o.op) {
    case "add_room": {
      const shape = o.shape, id2 = typeof o.id === "string" ? o.id : nextRoomId(m);
      const r = shape === "poly" ? { id: id2, shape, points: numbers(o.points), ...polyBox(numbers(o.points)) } : { id: id2, shape, ...(([x, y]) => ({ x, y }))(corner(o.at ?? [o.x, o.y])), w: Number(o.w), h: Number(o.h) };
      if (typeof o.label === "string") r.label = o.label;
      if (typeof o.number === "number" || o.number === false) r.number = o.number;
      if (typeof o.fill === "string" && o.fill) r.fill = o.fill;
      if (typeof o.href === "string" && o.href) r.href = o.href;
      if (typeof o.origin === "string" && o.origin) r.origin = o.origin;
      m.rooms.push(r);
      return `added ${shape} room ${id2}`;
    }
    case "move_room": {
      const r = room(m, o.room), [x, y] = corner(o.at ?? [o.x, o.y]), dx = x - r.x, dy = y - r.y;
      r.x = x;
      r.y = y;
      handEdit(r, ["x", "y"]);
      if (r.points) r.points = r.points.map((v, i) => v + (i % 2 ? dy : dx));
      return `moved ${r.id} to ${x},${y}`;
    }
    case "set_room": {
      const r = room(m, o.room);
      if (typeof o.shape === "string") {
        r.shape = o.shape;
        if (r.shape !== "poly") delete r.points;
      }
      const size2 = [];
      if (typeof o.w === "number") {
        r.w = o.w;
        size2.push("w");
      }
      if (typeof o.h === "number") {
        r.h = o.h;
        size2.push("h");
      }
      if (size2.length) handEdit(r, size2);
      if (typeof o.shape === "string") handEdit(r, ["shape"]);
      if (typeof o.label === "string") {
        if (o.label) r.label = o.label;
        else delete r.label;
        handEdit(r, ["label"]);
      }
      if (typeof o.number === "number" || o.number === false) r.number = o.number;
      if (typeof o.fill === "string" && o.fill) {
        if (o.fill === "floor") delete r.fill;
        else r.fill = o.fill;
        handEdit(r, ["fill"]);
      }
      if (typeof o.href === "string") {
        if (o.href) r.href = o.href;
        else delete r.href;
      }
      return `changed ${r.id}`;
    }
    case "remove_room": {
      const r = room(m, o.room), n = removeRoom(m, r.id);
      return `removed ${r.id} and ${n} corridors`;
    }
    case "link": {
      const [from, to] = linkEnds(m, o.from, o.to);
      const end = (v, side, offset) => {
        if (v && typeof v === "object" && !Array.isArray(v)) return v;
        if (typeof v === "string") return corridorEnd(m, v, typeof side === "string" ? side : void 0, typeof offset === "number" ? offset : void 0);
        return { at: pt(v) };
      };
      const exit = o.exit && typeof o.exit === "object" ? o.exit : void 0, a = end(from, o.from_side, o.from_offset), b = end(to, o.to_side, o.to_offset);
      m.corridors.push({
        ...typeof o.id === "string" && { id: o.id },
        from: a,
        to: exit && "at" in b ? { ...b, exit } : b,
        ...typeof o.width === "number" && { width: o.width },
        ...typeof o.route === "string" && { route: o.route },
        ...Array.isArray(o.via) && { via: numbers(o.via) },
        ...Array.isArray(o.doors) && { doors: o.doors },
        ...o.curve === "smooth" && { curve: "smooth" },
        ...o.style === "natural" && { style: "natural" },
        ...typeof o.seed === "number" && { seed: o.seed },
        ...typeof o.origin === "string" && o.origin && { origin: o.origin }
      });
      return `corridor ${m.corridors.length - 1}: ${show(from)} \u2192 ${show(to)}`;
    }
    case "unlink": {
      corridor(m, o.index);
      removeCorridor(m, Number(o.index));
      return `${m.corridors.length} corridors`;
    }
    case "add_block":
    case "split_block": {
      let id2 = String(o.id ?? "");
      const split = { mode: o.split ?? "bsp", ...typeof o.min === "number" && { min: o.min }, ...o.cuts && typeof o.cuts === "object" ? { cuts: o.cuts } : {}, ...typeof o.seed === "number" && { seed: o.seed } };
      if (o.op === "add_block") {
        const used = new Set((m.blocks ?? []).map((b2) => b2.id));
        if (!id2) {
          for (let n = 1; ; n++) if (!used.has(`b${n}`)) {
            id2 = `b${n}`;
            break;
          }
        }
        const shape = String(o.shape ?? "rect");
        let b;
        if (shape === "poly") {
          const points = numbers(o.points);
          b = { id: id2, shape: "poly", points, ...polyBox(points), split };
        } else {
          const [x, y] = corner(o.at ?? [o.x, o.y]), w = Number(o.w), h = Number(o.h);
          b = shape === "hex" ? { id: id2, shape: "poly", points: hexPoints(x, y, w, h), x, y, w, h, split } : { id: id2, shape, x, y, w, h, split };
        }
        if (typeof o.doors === "number") b.doors = o.doors;
        (m.blocks ??= []).push(b);
      } else {
        const b = m.blocks?.find((x) => x.id === id2);
        if (!b) throw new Error(`no block ${id2}`);
        const seed = typeof o.seed === "number" ? o.seed : o.reseed === false ? b.split.seed : Math.floor(Math.random() * 1e6);
        b.split = { ...b.split, ...o.split !== void 0 && { mode: split.mode }, ...split.min !== void 0 && { min: split.min }, ...split.cuts && { cuts: split.cuts }, ...seed !== void 0 && { seed } };
        if (typeof o.doors === "number") b.doors = o.doors;
      }
      const r = applyBlock(parseDungeon(m), id2);
      replace(m, r.spec);
      const made = r.spec.rooms.filter((x) => x.origin === `block:${id2}`).length;
      return [`block ${id2}: ${made} rooms, ${(r.spec.connections ?? []).filter((c) => c.origin === `block:${id2}`).length} connections`, ...r.dropped.map((d) => `  dropped ${d}`)].join("\n");
    }
    case "remove_block": {
      const id2 = String(o.id);
      if (!m.blocks?.some((x) => x.id === id2)) throw new Error(`no block ${id2}`);
      removeBlock(m, id2);
      return `removed block ${id2} and its rooms`;
    }
    case "connect": {
      (m.connections ??= []).push({
        a: String(o.a),
        b: String(o.b),
        ...o.at !== void 0 && { at: pt(o.at) },
        ...typeof o.kind === "string" && o.kind !== "door" && { kind: o.kind },
        ...typeof o.width === "number" && { width: o.width },
        ...typeof o.origin === "string" && o.origin && { origin: o.origin }
      });
      return `connection ${m.connections.length - 1}: ${String(o.a)} \u2194 ${String(o.b)}`;
    }
    case "disconnect": {
      if (!m.connections?.[Number(o.index)]) throw new Error(`no connection ${String(o.index)} (0..${(m.connections?.length ?? 0) - 1})`);
      m.connections.splice(Number(o.index), 1);
      if (!m.connections.length) delete m.connections;
      return `${m.connections?.length ?? 0} connections`;
    }
    case "door": {
      const c = corridor(m, o.index), d = c.doors ?? [null, null], kind = o.kind ?? null;
      c.doors = o.end === "to" ? [d[0], kind] : [kind, d[1]];
      return `door at the ${o.end === "to" ? "end" : "start"} of corridor ${String(o.index)}: ${kind ?? "none"}`;
    }
    case "fit": {
      replace(m, fitDungeon(parseDungeon(m), typeof o.margin === "number" ? o.margin : 2));
      return `fitted to ${m.cols}\xD7${m.rows} cells`;
    }
  }
  throw new Error(`unknown op ${String(o.op)} (${DUNGEON_OPS.join(", ")})`);
}

// ../artgen-mapgen/src/settlement/index.ts
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

// ../artgen-mapgen/src/settlement/fixtures.ts
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

// ../artgen-mapgen/src/settlement/spec.ts
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
function newSettlement(id2, kind = "village", over = {}) {
  const d = structuredClone(DEFAULTS2), k = KIND_DEFAULTS[kind];
  const grid5 = { ...d.grid, size: k.perCell === 10 ? 1 : 2 };
  return parseSettlement({
    ...d,
    cols: k.cols,
    rows: k.rows,
    ...over,
    id: id2,
    kind,
    version: SETTLEMENT_FORMAT,
    seed: over.seed ?? 1,
    gen: { ...d.gen, buildings: k.buildings, wall: k.wall, castle: k.castle, market: k.market, ...kind === "castle" && { water: "moat", fields: 0.2 }, ...over.gen },
    grid: { ...grid5, ...over.grid },
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
function list(v, at4, e) {
  if (v === void 0) return [];
  if (!Array.isArray(v)) {
    e.push(`${at4}: an array`);
    return [];
  }
  return v;
}
function uniqueIds(items, at4, e, required = false) {
  const seen = /* @__PURE__ */ new Set();
  items.forEach((x, i) => {
    if (x?.id === void 0) {
      if (required) e.push(`${at4}[${i}].id: letters, digits, - and _ only`);
      return;
    }
    if (!idOk(x.id)) e.push(`${at4}[${i}].id: letters, digits, - and _ only`);
    else if (seen.has(x.id)) e.push(`${at4}[${i}].id: ${x.id} is used twice`);
    else seen.add(x.id);
  });
  return seen;
}
function fixtureErrors(f, at4, e) {
  if (!f || typeof f !== "object") {
    e.push(`${at4}: {kind, x, y}`);
    return;
  }
  if (typeof f.kind !== "string" || !FIXTURES[f.kind]) e.push(`${at4}.kind: one of the fixture kinds (artgen settlement fixtures)`);
  for (const k of ["x", "y"]) if (!isNum3(f[k])) e.push(`${at4}.${k}: a number (cells)`);
  for (const k of ["w", "h"]) if (f[k] !== void 0 && !(isNum3(f[k]) && f[k] > 0)) e.push(`${at4}.${k}: cells, above 0`);
  if (f.angle !== void 0 && !isNum3(f.angle)) e.push(`${at4}.angle: degrees`);
  if (f.label !== void 0 && typeof f.label !== "string") e.push(`${at4}.label: text`);
  originError2(f, at4, e);
}
function floorErrors(fl2, at4, e) {
  if (!fl2 || typeof fl2 !== "object") {
    e.push(`${at4}: {level, rooms}`);
    return;
  }
  if (!isNum3(fl2.level) || !Number.isInteger(fl2.level)) e.push(`${at4}.level: a whole number (0 ground, 1 above, -1 cellar)`);
  if (fl2.name !== void 0 && typeof fl2.name !== "string") e.push(`${at4}.name: text`);
  const rooms = list(fl2.rooms, `${at4}.rooms`, e), ids = uniqueIds(rooms, `${at4}.rooms`, e, true);
  if (fl2.rooms === void 0) e.push(`${at4}.rooms: an array`);
  rooms.forEach((r, i) => {
    const ra = `${at4}.rooms[${i}]`;
    if (!ROOM_SHAPES.includes(r?.shape)) e.push(`${ra}.shape: one of ${ROOM_SHAPES.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum3(r?.[k])) e.push(`${ra}.${k}: a number (plan cells)`);
    for (const k of ["w", "h"]) if (!isNum3(r?.[k]) || r[k] < 0.5) e.push(`${ra}.${k}: at least half a cell`);
    if (r?.shape === "poly" && !pairs(r.points, 3)) e.push(`${ra}.points: at least 3 x,y pairs`);
    if (r?.label !== void 0 && typeof r.label !== "string") e.push(`${ra}.label: text`);
    if (r?.number !== void 0 && r.number !== false && !isNum3(r.number)) e.push(`${ra}.number: a number or false`);
    originError2(r, ra, e);
  });
  list(fl2.connections, `${at4}.connections`, e).forEach((c, i) => {
    const ca = `${at4}.connections[${i}]`;
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
  list(fl2.doors, `${at4}.doors`, e).forEach((d, i) => {
    const da = `${at4}.doors[${i}]`;
    if (!isPoint2(d?.at)) e.push(`${da}.at: [x, y] in plan cells`);
    if (d?.kind !== void 0 && d.kind !== "open" && !DOOR_KINDS.includes(d.kind)) e.push(`${da}.kind: open or one of ${DOOR_KINDS.join(", ")}`);
    if (d?.width !== void 0 && !(isNum3(d.width) && d.width > 0)) e.push(`${da}.width: cells, above 0`);
  });
  list(fl2.windows, `${at4}.windows`, e).forEach((w, i) => {
    if (!isPoint2(w?.at)) e.push(`${at4}.windows[${i}].at: [x, y] in plan cells`);
    if (w?.width !== void 0 && !(isNum3(w.width) && w.width > 0)) e.push(`${at4}.windows[${i}].width: cells, above 0`);
  });
  list(fl2.fixtures, `${at4}.fixtures`, e).forEach((f, i) => fixtureErrors(f, `${at4}.fixtures[${i}]`, e));
  originError2(fl2, at4, e);
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
    const at4 = `roads[${i}]`;
    if (!ROAD_KINDS.includes(r?.kind)) e.push(`${at4}.kind: one of ${ROAD_KINDS.join(", ")}`);
    if (!pairs(r?.points, 2)) e.push(`${at4}.points: at least 2 x,y pairs`);
    if (r?.width !== void 0 && !(isNum3(r.width) && r.width > 0 && r.width <= 20)) e.push(`${at4}.width: cells, above 0 and at most 20`);
    if (r?.curve !== void 0 && !CURVES2.includes(r.curve)) e.push(`${at4}.curve: ${CURVES2.join(" or ")}`);
    if (r?.label !== void 0 && typeof r.label !== "string") e.push(`${at4}.label: text`);
    originError2(r, at4, e);
  });
  const water2 = list(m.water, "water", e);
  uniqueIds(water2, "water", e);
  water2.forEach((w, i) => {
    const at4 = `water[${i}]`;
    if (!WATER_KINDS.includes(w?.kind)) e.push(`${at4}.kind: one of ${WATER_KINDS.join(", ")}`);
    else if (!pairs(w?.points, WATER_LINES.includes(w.kind) ? 2 : 3)) e.push(`${at4}.points: at least ${WATER_LINES.includes(w.kind) ? 2 : 3} x,y pairs`);
    if (w?.width !== void 0 && !(isNum3(w.width) && w.width > 0 && w.width <= 60)) e.push(`${at4}.width: cells, above 0 and at most 60`);
    originError2(w, at4, e);
  });
  const walls = list(m.walls, "walls", e);
  uniqueIds(walls, "walls", e);
  walls.forEach((w, i) => {
    const at4 = `walls[${i}]`;
    if (!w || typeof w !== "object") {
      e.push(`${at4}: {kind, points}`);
      return;
    }
    if (!WALL_KINDS.includes(w.kind)) e.push(`${at4}.kind: one of ${WALL_KINDS.join(", ")}`);
    if (!pairs(w.points, 2)) e.push(`${at4}.points: at least 2 x,y pairs`);
    if (w.closed !== void 0 && typeof w.closed !== "boolean") e.push(`${at4}.closed: true or false`);
    if (w.closed && nums3(w.points) && w.points.length < 6) e.push(`${at4}.closed: a closed wall needs 3 points or more`);
    if (w.thickness !== void 0 && !(isNum3(w.thickness) && w.thickness > 0 && w.thickness <= 6)) e.push(`${at4}.thickness: cells, above 0 and at most 6`);
    const t = w.towers;
    if (t !== void 0) {
      if (!t || !TOWER_SHAPES.includes(t.shape)) e.push(`${at4}.towers.shape: ${TOWER_SHAPES.join(" or ")}`);
      if (t?.size !== void 0 && !(isNum3(t.size) && t.size > 0)) e.push(`${at4}.towers.size: cells, above 0`);
      if (t?.at !== void 0 && t.at !== "corners" && !(nums3(t.at) && t.at.every(Number.isInteger))) e.push(`${at4}.towers.at: "corners" or vertex indices`);
      if (t?.every !== void 0 && !(isNum3(t.every) && t.every >= 2)) e.push(`${at4}.towers.every: cells between towers, 2 or more`);
    }
    list(w.gates, `${at4}.gates`, e).forEach((gt, j) => {
      const ga = `${at4}.gates[${j}]`;
      if (!isPoint2(gt?.at)) e.push(`${ga}.at: [x, y] in cells`);
      if (!GATE_KINDS2.includes(gt?.kind)) e.push(`${ga}.kind: one of ${GATE_KINDS2.join(", ")}`);
      if (gt?.width !== void 0 && !(isNum3(gt.width) && gt.width > 0)) e.push(`${ga}.width: cells, above 0`);
      if (gt?.drawbridge !== void 0 && typeof gt.drawbridge !== "boolean") e.push(`${ga}.drawbridge: true or false`);
    });
    originError2(w, at4, e);
  });
  const buildings = list(m.buildings, "buildings", e);
  if (m.buildings === void 0) e.push("buildings: an array");
  uniqueIds(buildings, "buildings", e, true);
  buildings.forEach((b, i) => {
    const at4 = `buildings[${i}]`;
    if (!b || typeof b !== "object") {
      e.push(`${at4}: {id, kind, shape, x, y, w, h}`);
      return;
    }
    if (!BUILDING_KINDS.includes(b.kind)) e.push(`${at4}.kind: one of ${BUILDING_KINDS.join(", ")}`);
    if (!BUILDING_SHAPES.includes(b.shape)) e.push(`${at4}.shape: one of ${BUILDING_SHAPES.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum3(b[k])) e.push(`${at4}.${k}: a number (cells)`);
    for (const k of ["w", "h"]) if (!isNum3(b[k]) || b[k] < 0.5) e.push(`${at4}.${k}: at least half a cell`);
    if (b.shape === "poly" && !pairs(b.points, 3)) e.push(`${at4}.points: at least 3 x,y pairs`);
    if (b.wing !== void 0 && !(isPoint2(b.wing) && b.wing[0] > 0 && b.wing[1] > 0 && b.wing[0] < b.w && b.wing[1] < b.h)) e.push(`${at4}.wing: [w, h], each above 0 and less than the box`);
    if (b.angle !== void 0 && !isNum3(b.angle)) e.push(`${at4}.angle: degrees`);
    if (b.roof !== void 0 && !ROOFS.includes(b.roof)) e.push(`${at4}.roof: one of ${ROOFS.join(", ")}`);
    if (b.stories !== void 0 && !(Number.isInteger(b.stories) && b.stories >= 1 && b.stories <= 12)) e.push(`${at4}.stories: 1..12`);
    if (b.label !== void 0 && typeof b.label !== "string") e.push(`${at4}.label: text`);
    if (b.number !== void 0 && b.number !== false && !isNum3(b.number)) e.push(`${at4}.number: a number or false`);
    if (b.href !== void 0 && hrefError(b.href)) e.push(`${at4}.href: ${hrefError(b.href)}`);
    const floors = list(b.floors, `${at4}.floors`, e), levels = /* @__PURE__ */ new Set();
    floors.forEach((fl2, j) => {
      floorErrors(fl2, `${at4}.floors[${j}]`, e);
      if (isNum3(fl2?.level)) {
        if (levels.has(fl2.level)) e.push(`${at4}.floors[${j}].level: level ${fl2.level} is used twice`);
        levels.add(fl2.level);
      }
    });
    originError2(b, at4, e);
  });
  const areas = list(m.areas, "areas", e);
  uniqueIds(areas, "areas", e);
  areas.forEach((a, i) => {
    const at4 = `areas[${i}]`;
    if (!AREA_KINDS.includes(a?.kind)) e.push(`${at4}.kind: one of ${AREA_KINDS.join(", ")}`);
    if (!pairs(a?.points, 3)) e.push(`${at4}.points: at least 3 x,y pairs`);
    if (a?.label !== void 0 && typeof a.label !== "string") e.push(`${at4}.label: text`);
    originError2(a, at4, e);
  });
  list(m.trees, "trees", e).forEach((t, i) => {
    const at4 = `trees[${i}]`;
    if (!TREE_KINDS.includes(t?.kind)) e.push(`${at4}.kind: one of ${TREE_KINDS.join(", ")}`);
    for (const k of ["x", "y"]) if (!isNum3(t?.[k])) e.push(`${at4}.${k}: a number (cells)`);
    if (t?.size !== void 0 && !(isNum3(t.size) && t.size > 0)) e.push(`${at4}.size: cells across, above 0`);
    originError2(t, at4, e);
  });
  list(m.props, "props", e).forEach((p2, i) => fixtureErrors(p2, `props[${i}]`, e));
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
  } catch (err2) {
    const v = raw?.version;
    return { version: typeof v === "number" ? v : null, errors: [{ path: "version", message: err2.message }] };
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
var floorAt = (b, level2) => b.floors?.find((f) => f.level === level2);
function groundFloor(b) {
  const fl2 = [...b.floors ?? []].sort((p2, q) => p2.level - q.level);
  return fl2.find((f) => f.level === 0) ?? fl2.find((f) => f.level > 0) ?? fl2[0];
}
var floorName = (f) => f.name ?? (f.level === 0 ? "Ground floor" : f.level < 0 ? f.level === -1 ? "Cellar" : `Cellar ${-f.level}` : f.level === 1 ? "Upper floor" : `Floor ${f.level}`);
function removeBuilding(m, id2) {
  const n = m.buildings.length;
  m.buildings = m.buildings.filter((b) => b.id !== id2);
  return m.buildings.length !== n;
}

// ../artgen-mapgen/src/settlement/theme.ts
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

// ../artgen-mapgen/src/settlement/layout.ts
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
var closedLine = (p2) => p2.length >= 6 && Math.abs(p2[0] - p2[p2.length - 2]) < 1e-9 && Math.abs(p2[1] - p2[p2.length - 1]) < 1e-9;
var smooth2 = (p2, closed, passes = 3) => chaikin({ pts: p2, closed }, passes).pts;
function snapToLine(pts2, closed, at4) {
  const ring2 = closed ? [...pts2, pts2[0], pts2[1]] : pts2, n = nearestOnLine(ring2, at4[0], at4[1]), i = n.seg * 2;
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
var centroid = (p2) => {
  let x = 0, y = 0;
  for (let i = 0; i < p2.length; i += 2) {
    x += p2[i];
    y += p2[i + 1];
  }
  return [2 * x / p2.length, 2 * y / p2.length];
};
function wallGeom2(spec, index, water2) {
  const w = spec.walls[index], closed = !!w.closed, pts2 = w.points.slice(), thickness = wallThickness(spec, w);
  const t = w.towers, size2 = t?.size ?? Math.max(1, TOWER_FT / spec.scale.perCell), shape = t?.shape ?? "round";
  const towers = [];
  const nVert = pts2.length / 2, segAngle = (i) => {
    const j = closed ? (i + 1) % nVert : Math.min(i + 1, nVert - 1), k = j === i ? i - 1 : i;
    const a = j === i ? [pts2[2 * k], pts2[2 * k + 1], pts2[2 * i], pts2[2 * i + 1]] : [pts2[2 * i], pts2[2 * i + 1], pts2[2 * j], pts2[2 * j + 1]];
    return Math.atan2(a[3] - a[1], a[2] - a[0]) / DEG;
  };
  if (t) {
    const verts = t.at === void 0 || t.at === "corners" ? t.every && t.at === void 0 ? [] : Array.from({ length: nVert }, (_, i) => i) : t.at.filter((i) => i >= 0 && i < nVert);
    for (const i of verts) towers.push({ x: pts2[2 * i], y: pts2[2 * i + 1], shape, size: size2, angle: segAngle(i) });
    if (t.every) {
      const ring2 = closed ? [...pts2, pts2[0], pts2[1]] : pts2, total = lineLength2(ring2), n = Math.max(1, Math.round(total / t.every));
      for (const p2 of along(ring2, total / n, 0)) if (!towers.some((q) => Math.hypot(q.x - p2.x, q.y - p2.y) < size2 * 1.2)) towers.push({ x: p2.x, y: p2.y, shape, size: size2, angle: p2.angle });
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
      for (const m of water2) if (!m.area) {
        const d = nearestOnLine(m.pts, s.x + nx * (thickness / 2 + m.width / 2), s.y + ny * (thickness / 2 + m.width / 2));
        if (d.d < m.width) span = Math.max(span, d.d + m.width + thickness / 2 + 0.5);
      }
    }
    return { kind: g.kind, x: s.x, y: s.y, angle: s.angle, width, drawbridge: span, outward: [nx, ny] };
  });
  const kept = towers.filter((tw) => !gates.some((g) => g.kind !== "postern" && Math.hypot(tw.x - g.x, tw.y - g.y) < g.width / 2 + tw.size * 0.4));
  for (const g of gates) if (g.kind === "gatehouse") {
    const dx = Math.cos(g.angle * DEG), dy = Math.sin(g.angle * DEG), off = g.width / 2 + size2 / 2;
    for (const sg of [-1, 1]) kept.push({ x: g.x + sg * off * dx + g.outward[0] * size2 * 0.25, y: g.y + sg * off * dy + g.outward[1] * size2 * 0.25, shape, size: size2, angle: g.angle });
  }
  return { index, kind: w.kind, pts: pts2, closed, thickness, towers: kept, gates };
}
function inWater(water2, x, y, pad = 0) {
  return water2.some((w) => w.area ? inPolygon(w.pts, x, y) : nearestOnLine(w.closed ? [...w.pts, w.pts[0], w.pts[1]] : w.pts, x, y).d < w.width / 2 + pad);
}
function bridgesOf(roads, water2) {
  const out = [];
  for (const r of roads) {
    const step = 0.2, pts2 = along(r.pts, step);
    let run2 = [];
    const flush = () => {
      if (run2.length) {
        const a = run2[0], b = run2[run2.length - 1], len = Math.hypot(b.x - a.x, b.y - a.y) || step, ux = (b.x - a.x) / len || Math.cos(a.angle * DEG), uy = (b.y - a.y) / len || Math.sin(a.angle * DEG), ext = 0.5;
        out.push({ road: r.index, x0: a.x - ux * ext, y0: a.y - uy * ext, x1: b.x + ux * ext, y1: b.y + uy * ext, width: r.width + 0.3 });
      }
      run2 = [];
    };
    for (const p2 of pts2) {
      if (inWater(water2, p2.x, p2.y)) run2.push(p2);
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
  const water2 = spec.water.map((w, index) => {
    const area3 = !WATER_LINES.includes(w.kind), closed = area3 || closedLine(w.points);
    const raw = closed && !area3 ? w.points.slice(0, -2) : w.points;
    const pts2 = w.kind === "canal" || w.kind === "moat" ? raw.slice() : smooth2(raw, closed, area3 ? 3 : 2);
    return { index, kind: w.kind, pts: pts2, width: area3 ? 0 : waterWidth(spec, w), closed, area: area3 };
  });
  const walls = spec.walls.map((_, i) => wallGeom2(spec, i, water2));
  return { buildings, roads, water: water2, walls, bridges: bridgesOf(roads, water2), areaTrees: areaTrees(spec) };
}
function buildingAt(l, x, y) {
  for (let i = l.buildings.length - 1; i >= 0; i--) if (inPolygon(l.buildings[i].outline, x, y)) return l.buildings[i];
  return void 0;
}
function floorAsDungeon(floor3, w, h) {
  const d = structuredClone(DEFAULTS);
  return {
    ...d,
    id: "floor",
    version: 1,
    seed: 1,
    cols: Math.max(4, Math.ceil(w)),
    rows: Math.max(4, Math.ceil(h)),
    style: { ...d.style, hatch: "none", sharedWalls: true },
    rooms: floor3.rooms.map((r) => ({ ...r, fill: "floor" })),
    corridors: [],
    connections: floor3.connections ?? [],
    overlay: { labels: [], symbols: [] }
  };
}
function uncovered(a, b, covers) {
  const L2 = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L2 < 1e-9) return [];
  const ux = (b[0] - a[0]) / L2, uy = (b[1] - a[1]) / L2, t = (p2) => (p2[0] - a[0]) * ux + (p2[1] - a[1]) * uy;
  const cut = covers.map(([p2, q]) => [Math.min(t(p2), t(q)), Math.max(t(p2), t(q))]).sort((p2, q) => p2[0] - q[0]);
  const out = [];
  let from = 0;
  for (const [c0, c1] of [...cut, [L2, L2]]) {
    if (c0 > from + 1e-6) out.push([[a[0] + ux * from, a[1] + uy * from], [a[0] + ux * Math.min(c0, L2), a[1] + uy * Math.min(c0, L2)]]);
    from = Math.max(from, c1);
    if (from >= L2) break;
  }
  return out;
}
function onOutline(outline2, at4) {
  const s = snapToLine(outline2, true, at4);
  return { x: s.x, y: s.y, angle: s.angle };
}
function layoutFloor(spec, b, floor3) {
  const outline2 = planOutline(spec, b), f = planFactor(spec), w = b.w * f, h = b.h * f;
  const dl = layoutDungeon(floorAsDungeon(floor3, w, h));
  const partitions = dl.partitions.slice();
  const outerEdges = dl.rooms.map((g) => sharedEdges(g.outline, outline2));
  dl.rooms.forEach((g, i) => {
    const covers = [...outerEdges[i]];
    dl.rooms.forEach((o, j) => {
      if (j !== i) covers.push(...sharedEdges(g.outline, o.outline));
    });
    for (const [a, c] of edges(g.outline)) {
      const L2 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, off = (p2) => Math.abs((p2[0] - a[0]) * (c[1] - a[1]) - (p2[1] - a[1]) * (c[0] - a[0])) / L2;
      for (const [p2, q] of uncovered(a, c, covers.filter(([p0, p1]) => off(p0) < 1e-6 && off(p1) < 1e-6))) partitions.push([p2[0], p2[1], q[0], q[1]]);
    }
  });
  const inner = dl.connections.filter((c) => c.wall).map((c) => ({ kind: c.kind, x: c.x, y: c.y, angle: c.angle + 90, width: c.width }));
  const doors = (floor3.doors ?? []).map((d) => ({ kind: d.kind ?? "door", width: d.width ?? 1, ...onOutline(outline2, d.at) }));
  const windows = (floor3.windows ?? []).map((d) => ({ kind: "window", width: d.width ?? 1, ...onOutline(outline2, d.at) }));
  const fixtures2 = (floor3.fixtures ?? []).map((x, index) => {
    const [fw, fh] = fixtureSize(x, spec.interior.perCell);
    return { index, kind: x.kind, x: x.x, y: x.y, w: fw, h: fh, angle: x.angle ?? 0, ...x.label !== void 0 && { label: x.label } };
  });
  return { outline: outline2, w, h, rooms: dl.rooms, partitions, inner, doors, windows, fixtures: fixtures2 };
}

// ../artgen-mapgen/src/settlement/render.ts
var SITE_LAYERS = ["ground", "underlay", "areas", "water", "roads", "bridges", "walls", "buildings", "trees", "props", "grid", "symbols", "numbers", "labels", "legend", "title", "scale", "compass"];
var PLAN_LAYERS = ["ground", "floor", "grid", "walls", "doors", "windows", "fixtures", "numbers", "labels", "legend", "title", "scale", "compass"];
var VIEWS = ["site", "plan"];
var BUILDING_MODES = ["roofs", "outline", "interior"];
var SYMBOLS3 = { ...SYMBOLS, ...SYMBOLS2 };
var SYMBOL_KINDS3 = Object.keys(SYMBOLS3);
var PLAN_MARGIN = 2;
var tok = (svg, p2) => svg.replaceAll("{ink}", p2.ink).replaceAll("{fill}", p2.fixture.fill).replaceAll("{accent}", p2.fixture.accent).replaceAll("{stone}", p2.fixture.stone).replaceAll("{water}", p2.fixture.water).replaceAll("{paper}", p2.fixture.paper);
var ring = (pts2, k) => pathData([{ pts: pts2, closed: true }], k);
var line = (pts2, k, closed = false) => pathData([{ pts: pts2, closed }], k);
var toP = (pts2) => Array.from({ length: pts2.length / 2 }, (_, i) => [pts2[2 * i], pts2[2 * i + 1]]);
function patternDef(id2, name, k, ink, cells = 1) {
  const T2 = Math.max(4, k * cells);
  return `<pattern id="${id2}" patternUnits="userSpaceOnUse" width="${n1(T2)}" height="${n1(T2)}"><g transform="scale(${(T2 / 10).toFixed(4)})">${AREA_PATTERNS[name].replaceAll("{ink}", ink)}</g></pattern>`;
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
    const p2 = pts2[i % bumps];
    d += `A${n1(br)} ${n1(br)} 0 0 1 ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return `<path d="${d}Z" fill="${fill}" stroke="${edge}" stroke-width="${n1(sw)}" stroke-linejoin="round"/>`;
}
function treeSvg(t, k, p2, u, per, seed) {
  const r = (t.size ?? TREE_FT[t.kind] / per) * k / 2, x = t.x * k, y = t.y * k, sw = Math.max(0.6, 0.9 * u);
  if (t.kind === "tree") return crown(x, y, r, 9, p2.tree, p2.treeDark, sw, seed) + (p2.ripples ? "" : `<circle cx="${n1(x - r * 0.25)}" cy="${n1(y - r * 0.25)}" r="${n1(r * 0.35)}" fill="#ffffff" fill-opacity="0.18"/>`);
  if (t.kind === "conifer") {
    let d2 = "";
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * 0.55 : r;
      d2 += `${i ? "L" : "M"}${n1(x + Math.cos(a) * rr)} ${n1(y + Math.sin(a) * rr)}`;
    }
    return `<path d="${d2}Z" fill="${p2.ripples ? p2.paper : p2.treeDark}" fill-opacity="${p2.ripples ? 1 : 0.85}" stroke="${p2.treeDark}" stroke-width="${n1(sw)}" stroke-linejoin="round"/><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(Math.max(0.6, r * 0.12))}" fill="${p2.ink}"/>`;
  }
  if (t.kind === "bush") return crown(x, y, r, 6, p2.tree, p2.treeDark, sw * 0.8, seed);
  if (t.kind === "rock" || t.kind === "boulder") {
    const rand = rng(seed), n = 7;
    let d2 = "";
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rand() * 0.4, rr = r * (0.7 + rand() * 0.3);
      d2 += `${i ? "L" : "M"}${n1(x + Math.cos(a) * rr)} ${n1(y + Math.sin(a) * rr)}`;
    }
    return `<path d="${d2}Z" fill="${p2.rock}" stroke="${p2.ink}" stroke-width="${n1(sw)}" stroke-linejoin="round"/>`;
  }
  if (t.kind === "stump") return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${p2.fixture.fill}" stroke="${p2.ink}" stroke-width="${n1(sw)}"/><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * 0.45)}" fill="none" stroke="${p2.ink}" stroke-width="${n1(sw * 0.6)}"/>`;
  let d = "";
  for (let i = -2; i <= 2; i++) d += `M${n1(x + i * r * 0.35)} ${n1(y + r * 0.5)}l${n1(i * r * 0.08)} ${n1(-r)}`;
  return `<path d="${d}" stroke="${p2.treeDark}" stroke-width="${n1(sw)}" stroke-linecap="round" fill="none"/>`;
}
function fixtureSvg(f, k, p2, sw) {
  const kind = FIXTURES[f.kind];
  if (!kind) return "";
  return `<g transform="translate(${n1(f.x * k)} ${n1(f.y * k)})${f.angle ? ` rotate(${n1(f.angle)})` : ""}">${tok(kind.draw(f.w * k, f.h * k, sw), p2)}</g>`;
}
function openingSvg(o, k, t, p2, sw) {
  const W = o.width * k, gap = `<rect x="${n1(-W / 2)}" y="${n1(-t * 0.62)}" width="${n1(W)}" height="${n1(t * 1.24)}" fill="${p2.floor}"/>`;
  const leaf = (x, w) => `<rect x="${n1(x)}" y="${n1(-t * 0.22)}" width="${n1(w)}" height="${n1(t * 0.44)}" fill="${p2.fixture.fill}" stroke="${p2.ink}" stroke-width="${n1(sw)}"/>`;
  let g = "";
  if (o.kind === "window") g = `<rect x="${n1(-W / 2)}" y="${n1(-t / 2)}" width="${n1(W)}" height="${n1(t)}" fill="${p2.fixture.paper}" stroke="${p2.ink}" stroke-width="${n1(sw)}"/><path d="M${n1(-W / 2)} 0H${n1(W / 2)}" stroke="${p2.ink}" stroke-width="${n1(sw * 0.7)}"/>`;
  else if (o.kind === "secret") g = `<path d="M${n1(-W / 2)} 0H${n1(W / 2)}" stroke="${p2.paper}" stroke-width="${n1(t * 0.25)}" stroke-dasharray="${n1(t * 0.5)} ${n1(t * 0.4)}"/>`;
  else if (o.kind === "open") g = gap;
  else if (o.kind === "portcullis") {
    g = gap;
    const n = Math.max(3, Math.round(o.width * 4));
    for (let i = 0; i < n; i++) g += `<circle cx="${n1(-W / 2 + W * (i + 0.5) / n)}" r="${n1(Math.max(0.8, t * 0.2))}" fill="${p2.ink}"/>`;
  } else if (o.kind === "arch") g = gap + `<rect x="${n1(-W / 2 - t * 0.3)}" y="${n1(-t * 0.62)}" width="${n1(t * 0.6)}" height="${n1(t * 1.24)}" fill="${p2.ink}"/><rect x="${n1(W / 2 - t * 0.3)}" y="${n1(-t * 0.62)}" width="${n1(t * 0.6)}" height="${n1(t * 1.24)}" fill="${p2.ink}"/>`;
  else {
    g = gap + leaf(-W / 2, W);
    if (o.kind === "locked") g += `<path d="M0 ${n1(-t * 0.5)}V${n1(t * 0.5)}" stroke="${p2.ink}" stroke-width="${n1(Math.max(sw * 1.5, t * 0.3))}"/>`;
  }
  return `<g transform="translate(${n1(o.x * k)} ${n1(o.y * k)}) rotate(${n1(o.angle)})">${g}</g>`;
}
function badge(text2, x, y, fs, p2) {
  const bh = fs * 1.45, bw = Math.max(bh, text2.length * fs * 0.62 + fs * 0.7);
  return `<rect x="${n1(x - bw / 2)}" y="${n1(y - bh / 2)}" width="${n1(bw)}" height="${n1(bh)}" rx="${n1(bh * 0.32)}" fill="${p2.badge}"/><text x="${n1(x)}" y="${n1(y + fs * 0.36)}" font-size="${n1(fs)}" font-weight="700" text-anchor="middle" fill="${p2.badgeText}">${esc(text2)}</text>`;
}
function floorSvg(fl2, k, p2, u, on, clipId, gridSize, text2) {
  const out = {}, tOut = Math.max(1.5 * u, 0.3 * k), tIn = Math.max(1 * u, 0.15 * k), sw = Math.max(0.6, 0.9 * u);
  const d = ring(fl2.outline, k);
  if (on.floor) out.floor = `<path d="${d}" fill="${p2.floor}"/>`;
  if (on.grid) {
    let gd = "";
    for (let x = 0; x <= fl2.w + 1e-9; x += gridSize) gd += `M${n1(x * k)} 0V${n1(fl2.h * k)}`;
    for (let y = 0; y <= fl2.h + 1e-9; y += gridSize) gd += `M0 ${n1(y * k)}H${n1(fl2.w * k)}`;
    out.grid = `<clipPath id="${clipId}"><path d="${d}"/></clipPath><path d="${gd}" clip-path="url(#${clipId})" stroke="${p2.grid}" stroke-opacity="${p2.gridOpacity}" stroke-width="${n1(0.8 * u)}" fill="none"/>`;
  }
  if (on.fixtures && fl2.fixtures.length) out.fixtures = fl2.fixtures.map((f) => fixtureSvg(f, k, p2, sw)).join("");
  if (on.walls) {
    const parts = fl2.partitions.map((s) => `M${n1(s[0] * k)} ${n1(s[1] * k)}L${n1(s[2] * k)} ${n1(s[3] * k)}`).join("");
    out.walls = (parts ? `<path d="${parts}" stroke="${p2.outerWall}" stroke-width="${n1(tIn)}" stroke-linecap="square" fill="none"/>` : "") + `<path d="${d}" fill="none" stroke="${p2.outerWall}" stroke-width="${n1(tOut)}" stroke-linejoin="miter"/>`;
  }
  if (on.doors) out.doors = fl2.inner.map((o) => openingSvg(o, k, tIn, p2, sw)).join("") + fl2.doors.map((o) => openingSvg(o, k, tOut, p2, sw)).join("");
  if (on.windows) out.windows = fl2.windows.map((o) => openingSvg(o, k, tOut, p2, sw)).join("");
  let nums4 = "", names = "";
  for (const g of fl2.rooms) {
    const x = g.cx * k, y = g.cy * k, has = on.numbers && g.number !== void 0;
    if (has) nums4 += badge(String(g.number), x, y, text2.number, p2);
    if (on.labels && g.room.label) names += haloText(g.room.label, x, y + (has ? text2.number * 1.6 : text2.name * 0.3), text2.name, p2.ink, { halo: p2.halo }, 'font-weight="700"');
  }
  if (on.labels) {
    for (const f of fl2.fixtures) if (f.label) names += haloText(f.label, f.x * k, (f.y + f.h / 2) * k + text2.name, text2.name * 0.85, p2.ink, { halo: p2.halo }, 'font-style="italic"');
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
function roofSvg(g, k, p2, u) {
  const b = g.building, roof = roofOf(b), d = ring(g.outline, k), sw = Math.max(0.8, 1.1 * u), tone = p2.roof[roofTone(b.kind)];
  const round3 = b.shape === "circle" || b.shape === "octagon" || b.shape === "poly";
  const shadow = p2.ripples ? "" : `<path d="${d}" transform="translate(${n1(0.22 * k)} ${n1(0.22 * k)})" fill="#000000" fill-opacity="0.16"/>`;
  if (roof === "none") {
    return `<path d="${d}" fill="${p2.floor}" fill-opacity="0.55" stroke="${p2.outerWall}" stroke-width="${n1(Math.max(1.5 * u, 0.25 * k))}" stroke-dasharray="${n1(k * 0.9)} ${n1(k * 0.35)} ${n1(k * 0.4)} ${n1(k * 0.5)}" stroke-linejoin="miter"/>`;
  }
  let g2 = `${shadow}<path d="${d}" fill="${tone}" stroke="${p2.ink}" stroke-width="${n1(sw)}" stroke-linejoin="${roof === "thatch" ? "round" : "miter"}"/>`;
  const ln2 = (dd2, w = sw * 0.9, color = p2.ridge) => `<path d="${dd2}" fill="none" stroke="${color}" stroke-width="${n1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const M = (q) => `${n1(q[0] * k)} ${n1(q[1] * k)}`;
  if (roof === "cone" || round3 && (roof === "gable" || roof === "hip" || roof === "thatch")) {
    const pts2 = toP(g.outline), step = Math.max(1, Math.floor(pts2.length / 8));
    let dd2 = "";
    for (let i = 0; i < pts2.length; i += step) dd2 += `M${M([g.cx, g.cy])}L${M(pts2[i])}`;
    g2 += ln2(dd2, sw * 0.6) + `<circle cx="${n1(g.cx * k)}" cy="${n1(g.cy * k)}" r="${n1(Math.max(1.5, 0.12 * k))}" fill="${p2.ridge}"/>`;
    return g2;
  }
  if (roof === "flat" || roof === "battlement") {
    const inset = Math.min(0.35, Math.min(b.w, b.h) * 0.12), r = offsetRing(toP(g.outline), area2(g.outline) > 0 ? -inset : inset).flat();
    if (roof === "battlement") g2 += `<path d="${d}" fill="none" stroke="${p2.ink}" stroke-width="${n1(Math.max(2 * u, 0.3 * k))}" stroke-dasharray="${n1(0.4 * k)} ${n1(0.32 * k)}" stroke-linejoin="miter"/>`;
    g2 += `<path d="${ring(r, k)}" fill="none" stroke="${p2.ink}" stroke-width="${n1(sw * 0.7)}"/>`;
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
    g2 += `<path d="${ring(r, k)}" fill="none" stroke="${p2.ridge}" stroke-opacity="0.5" stroke-width="${n1(sw * 0.6)}" stroke-dasharray="${n1(0.15 * k)} ${n1(0.2 * k)}"/>`;
  }
  return g2;
}
function wallSvg(w, k, p2, u, W, H, defs) {
  const d = line(w.pts, k, w.closed), th = w.thickness * k, sw = Math.max(0.8, 1.1 * u), tone = p2.wall[w.kind];
  const mid = `wall-gates-${w.index}`, cut = w.gates.map((g2) => `<rect x="${n1(-g2.width * k / 2)}" y="${n1(-th * 2)}" width="${n1(g2.width * k)}" height="${n1(th * 4)}" transform="translate(${n1(g2.x * k)} ${n1(g2.y * k)}) rotate(${n1(g2.angle)})" fill="#000"/>`).join("");
  if (cut) defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${n1(W)}" height="${n1(H)}"><rect width="${n1(W)}" height="${n1(H)}" fill="#fff"/>${cut}</mask>`);
  const S = (width, color, extra = "") => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n1(width)}"${extra.includes("linecap") ? "" : ' stroke-linejoin="miter" stroke-linecap="butt"'}${extra}/>`;
  let body2 = "";
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
  if (w.kind === "curtain") body2 = S(th + 2 * sw, p2.ink) + S(th, tone) + S(th * 0.28, p2.ink, ` stroke-dasharray="${n1(th * 0.45)} ${n1(th * 0.35)}"`);
  else if (w.kind === "stone") body2 = S(th + 2 * sw, p2.ink) + S(th, tone);
  else if (w.kind === "ruined") body2 = S(th + 2 * sw, p2.ink, ` stroke-dasharray="${n1(k * 3)} ${n1(k * 1.2)} ${n1(k * 1.5)} ${n1(k * 0.9)}"`) + S(th, tone, ` stroke-dasharray="${n1(k * 3)} ${n1(k * 1.2)} ${n1(k * 1.5)} ${n1(k * 0.9)}"`);
  else if (w.kind === "drystone") body2 = S(th + 2 * sw, p2.ink) + S(th, p2.ripples ? p2.paper : tone) + S(th * 0.45, p2.ink, ` stroke-dasharray="${n1(th * 0.3)} ${n1(th * 0.5)}" stroke-opacity="0.7"`);
  else if (w.kind === "palisade") body2 = S(th * 0.5, p2.wall.palisade) + dots(th * 0.95, th / 2, p2.ripples ? p2.paper : "#a07a50", p2.ink);
  else if (w.kind === "hedge") body2 = S(th, p2.ripples ? p2.paper : tone, ' stroke-linecap="round" stroke-linejoin="round"') + dots(th * 0.7, th * 0.52, p2.ripples ? p2.paper : tone, p2.treeDark);
  else body2 = S(Math.max(sw, th * 0.6), tone) + dots(Math.max(1, 6 / Math.max(1, th / k)) * k * 0.25 + k, Math.max(sw, th * 0.7), tone, p2.ink);
  let g = `<g${cut ? ` mask="url(#${mid})"` : ""}>${body2}</g>`;
  for (const gt of w.gates) if (gt.drawbridge > 0) {
    const a = Math.atan2(gt.outward[1], gt.outward[0]) * 180 / Math.PI, len = gt.drawbridge * k, bw = gt.width * k;
    let planks = "";
    for (let x = len / 6; x < len; x += len / 6) planks += `M${n1(x)} ${n1(-bw / 2)}V${n1(bw / 2)}`;
    g = `<g transform="translate(${n1(gt.x * k)} ${n1(gt.y * k)}) rotate(${n1(a)})"><rect x="0" y="${n1(-bw / 2)}" width="${n1(len)}" height="${n1(bw)}" fill="${p2.fixture.fill}" stroke="${p2.ink}" stroke-width="${n1(sw)}"/><path d="${planks}" stroke="${p2.ink}" stroke-width="${n1(sw * 0.5)}"/></g>` + g;
  }
  for (const t of w.towers) {
    const r = t.size * k / 2;
    g += t.shape === "square" ? `<g transform="translate(${n1(t.x * k)} ${n1(t.y * k)}) rotate(${n1(t.angle)})"><rect x="${n1(-r)}" y="${n1(-r)}" width="${n1(2 * r)}" height="${n1(2 * r)}" fill="${p2.tower}" stroke="${p2.ink}" stroke-width="${n1(sw * 1.3)}"/><rect x="${n1(-r * 0.7)}" y="${n1(-r * 0.7)}" width="${n1(1.4 * r)}" height="${n1(1.4 * r)}" fill="none" stroke="${p2.ink}" stroke-width="${n1(sw * 0.6)}"/></g>` : `<circle cx="${n1(t.x * k)}" cy="${n1(t.y * k)}" r="${n1(r)}" fill="${p2.tower}" stroke="${p2.ink}" stroke-width="${n1(sw * 1.3)}"/><circle cx="${n1(t.x * k)}" cy="${n1(t.y * k)}" r="${n1(r * 0.68)}" fill="none" stroke="${p2.ink}" stroke-width="${n1(sw * 0.6)}"/>`;
  }
  for (const gt of w.gates) {
    const gw = gt.width * k, depth = Math.max(th * 2.2, k * 1.2);
    let s = "";
    if (gt.kind === "gatehouse") {
      s += `<rect x="${n1(-gw / 2 - th)}" y="${n1(-depth / 2)}" width="${n1(gw + 2 * th)}" height="${n1(depth)}" fill="${p2.tower}" stroke="${p2.ink}" stroke-width="${n1(sw * 1.2)}"/>`;
      s += `<rect x="${n1(-gw / 2)}" y="${n1(-depth / 2 - sw)}" width="${n1(gw)}" height="${n1(depth + 2 * sw)}" fill="${p2.road.street.fill}"/>`;
      s += `<path d="M${n1(-gw / 2)} ${n1(-depth / 2)}V${n1(depth / 2)}M${n1(gw / 2)} ${n1(-depth / 2)}V${n1(depth / 2)}" stroke="${p2.ink}" stroke-width="${n1(sw)}"/>`;
      const n = Math.max(3, Math.round(gt.width * 3));
      for (const y of [-depth * 0.25, depth * 0.25]) for (let i = 0; i < n; i++) s += `<circle cx="${n1(-gw / 2 + gw * (i + 0.5) / n)}" cy="${n1(y)}" r="${n1(Math.max(0.8, 0.07 * k))}" fill="${p2.ink}"/>`;
    } else if (gt.kind === "gate" || gt.kind === "postern") {
      const leaf = (x, lw) => `<rect x="${n1(x)}" y="${n1(-th * 0.2)}" width="${n1(lw)}" height="${n1(th * 0.4)}" fill="${p2.fixture.fill}" stroke="${p2.ink}" stroke-width="${n1(sw)}"/>`;
      s += gt.kind === "gate" ? leaf(-gw / 2, gw / 2) + leaf(0, gw / 2) : leaf(-gw / 2, gw);
      s += `<path d="M${n1(-gw / 2)} ${n1(-th * 0.6)}V${n1(th * 0.6)}M${n1(gw / 2)} ${n1(-th * 0.6)}V${n1(th * 0.6)}" stroke="${p2.ink}" stroke-width="${n1(sw * 1.6)}"/>`;
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
  const { fr, k, u, p: p2 } = a, pad = 12 * u, items = [];
  const box2 = (x, y, w, h) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(4 * u)}" fill="${p2.paper}" fill-opacity="0.94" stroke="${p2.ink}" stroke-width="${n1(u)}"/>`;
  if (a.on.legend && a.legend.length) {
    const rh = 20 * u, fs = 11.5 * u, w = 170 * u, h = a.legend.length * rh + 12 * u;
    items.push({ id: "legend", rank: 2, w, h, over: { x: fr.r - w - pad, y: fr.b - h - pad }, draw: (x, y) => {
      let g = box2(x, y, w, h);
      a.legend.forEach((e, i) => {
        const sy = y + 6 * u + i * rh + rh / 2;
        g += a.legend[i].swatch(x + 18 * u, sy, 16 * u);
        g += `<text x="${n1(x + 34 * u)}" y="${n1(sy + fs * 0.35)}" font-size="${n1(fs)}" fill="${p2.ink}">${esc(e.name)}</text>`;
      });
      return `<g id="legend">${g}</g>`;
    } });
  }
  if (a.on.scale) {
    const n = scaleCells3(fr.w / k), len = n * k, fs = 11 * u, seg = Math.min(4, n), w = len + 34 * u, h = 40 * u;
    items.push({ id: "scale", rank: 1, w, h, over: { x: fr.x + pad, y: fr.b - pad - h }, draw: (bx, by) => {
      const x = bx + 17 * u, y = by + 18 * u;
      let g = box2(bx, by, w, h);
      for (let i = 0; i < seg; i++) g += `<rect x="${n1(x + len / seg * i)}" y="${n1(y)}" width="${n1(len / seg)}" height="${n1(5 * u)}" fill="${i % 2 ? p2.paper : p2.ink}" stroke="${p2.ink}" stroke-width="${n1(0.8 * u)}"/>`;
      g += `<text x="${n1(x)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${p2.ink}" text-anchor="middle">0</text>`;
      g += `<text x="${n1(x + len)}" y="${n1(y - 5 * u)}" font-size="${n1(fs)}" fill="${p2.ink}" text-anchor="middle">${n * a.perCell} ${esc(a.unit)}</text>`;
      g += `<text x="${n1(x + len / 2)}" y="${n1(y + 16 * u)}" font-size="${n1(fs * 0.85)}" fill="${p2.ink}" text-anchor="middle">1 square = ${a.perCell} ${esc(a.unit)}</text>`;
      return `<g id="scale">${g}</g>`;
    } });
  }
  if (a.on.compass) items.push({ id: "compass", rank: 3, w: 44 * u, h: 56 * u, over: { x: fr.r - pad - 46 * u, y: fr.y + pad }, draw: (x, y) => {
    const c = compassSvg(x + 22 * u, y + 34 * u, 18 * u, u, { ink: p2.ink, paper: p2.paper });
    return a.north ? `<g transform="rotate(${n1(a.north)} ${n1(x + 22 * u)} ${n1(y + 34 * u)})">${c}</g>` : c;
  } });
  if (a.on.title && a.title) {
    const room3 = fr.w - 2 * pad - (a.on.compass ? 54 * u : 0), fs = Math.min(22 * u, Math.max(9 * u, (room3 - 30 * u) / (a.title.length * 0.6))), w = Math.min(room3, Math.max(120 * u, a.title.length * fs * 0.6 + 30 * u)), h = fs * 1.7, title = a.title;
    items.push({ id: "title", rank: 0, w, h, over: { x: fr.x + pad, y: fr.y + pad }, draw: (x, y) => `<g id="title">${box2(x, y, w, h)}<text x="${n1(x + w / 2)}" y="${n1(y + fs * 1.18)}" font-size="${n1(fs)}" font-weight="700" letter-spacing="${n1(fs * 0.05)}" text-anchor="middle" fill="${p2.ink}">${esc(title)}</text></g>` });
  }
  return placeFurniture(items, fr, a.place, a.side, pad, a.covers);
}
function finish(fr, furn, defs, parts, p2, u, unit) {
  const drawn = furn.placed.map((q) => q.item.draw(q.x, q.y)).join("");
  const out = { ...fr, w: fr.w + furn.band.right, h: fr.h + furn.band.bottom, r: fr.r + furn.band.right, b: fr.b + furn.band.bottom };
  const band = furn.band.right || furn.band.bottom ? `<rect x="${n1(out.x)}" y="${n1(out.y)}" width="${n1(out.w)}" height="${n1(out.h)}" fill="${p2.paper}"/>` : "";
  const frame = band ? `<rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}" fill="none" stroke="${p2.ink}" stroke-width="${n1(1.5 * u)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs(out, unit)} font-family="${FONT}"><defs>${defs.join("")}<clipPath id="map-clip"><rect x="${n1(fr.x)}" y="${n1(fr.y)}" width="${n1(fr.w)}" height="${n1(fr.h)}"/></clipPath></defs>${band}<g clip-path="url(#map-clip)">${parts.join("")}${band ? "" : drawn}</g>${frame}${band ? drawn : ""}</svg>`;
}
var LABEL_PX = { area: 22, name: 15, note: 12, street: 12 };
function labelSize3(l, u, pageScale) {
  const pt3 = { area: PAGE_PT.dungeon.area, name: PAGE_PT.dungeon.name, note: PAGE_PT.dungeon.note, street: PAGE_PT.dungeon.note }[l.kind];
  return (pageScale ? pointsToPx(pt3, pageScale) : LABEL_PX[l.kind] * u) * (l.size ?? 1);
}
var textSizes = (u, pageScale) => ({ number: pageScale ? pointsToPx(PAGE_PT.dungeon.number, pageScale) : 15 * u, name: pageScale ? pointsToPx(PAGE_PT.dungeon.room, pageScale) : 12.5 * u });
function labelSvg(l, k, u, p2, pageScale) {
  const fs = labelSize3(l, u, pageScale), text2 = l.kind === "area" ? l.text.toUpperCase() : l.text;
  const attrs = l.kind === "area" ? `font-weight="700" letter-spacing="${n1(fs * 0.16)}"` : l.kind === "name" ? 'font-weight="700"' : 'font-style="italic"';
  const t = haloText(text2, l.x * k, l.y * k + fs * 0.35, fs, p2.ink, { halo: p2.halo }, attrs);
  const out = l.angle ? `<g transform="rotate(${n1(l.angle)} ${n1(l.x * k)} ${n1(l.y * k)})">${t}</g>` : t;
  return l.href ? `<a href="${esc(l.href)}">${out}</a>` : out;
}
function planSheet(spec, b) {
  const f = planFactor(spec);
  return { cols: Math.ceil(b.w * f - 1e-9) + 2 * PLAN_MARGIN, rows: Math.ceil(b.h * f - 1e-9) + 2 * PLAN_MARGIN, margin: PLAN_MARGIN };
}
function planTarget(spec, id2, level2) {
  const building3 = id2 ? spec.buildings.find((b) => b.id === id2) : spec.buildings.find((b) => b.floors?.length);
  if (!building3) throw new Error(id2 ? `no building ${id2}` : "no building with floors (give --building)");
  const floor3 = level2 !== void 0 ? floorAt(building3, level2) : groundFloor(building3);
  if (level2 !== void 0 && !floor3) throw new Error(`building ${building3.id} has no floor at level ${level2} (it has ${(building3.floors ?? []).map((f) => f.level).join(", ") || "none"})`);
  return { building: building3, floor: floor3 };
}
function legendFor(spec, p2, view, floor3) {
  const out = [];
  if (view === "plan") {
    for (const kind of [...new Set((floor3?.fixtures ?? []).map((f) => f.kind))]) {
      const fx = FIXTURES[kind];
      if (!fx) continue;
      out.push({ name: fx.name.split(" (")[0], swatch: (x, y, s) => {
        const r = Math.max(fx.ft[0], fx.ft[1]);
        return `<g transform="translate(${n1(x)} ${n1(y)})">${tok(fx.draw(fx.ft[0] / r * s, fx.ft[1] / r * s, Math.max(0.6, s / 16)), p2)}</g>`;
      } });
    }
    return out;
  }
  const sw = (x, y, s, fill, edge, extra = "") => `<rect x="${n1(x - s / 2)}" y="${n1(y - s * 0.35)}" width="${n1(s)}" height="${n1(s * 0.7)}" fill="${fill}" stroke="${edge}" stroke-width="1"${extra}/>`;
  const name = (s) => s[0].toUpperCase() + s.slice(1);
  for (const kind of [...new Set(spec.roads.map((r) => r.kind))]) {
    const st = p2.road[kind];
    out.push({ name: `${name(kind)}`, swatch: (x, y, s) => kind === "path" ? `<path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${st.edge}" stroke-width="1.5" stroke-dasharray="3 2"/>` : sw(x, y, s, st.fill === "none" ? p2.paper : st.fill, st.edge) });
  }
  for (const kind of [...new Set(spec.walls.map((w) => w.kind))]) out.push({ name: `${name(kind)} wall`, swatch: (x, y, s) => `<path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${p2.ink}" stroke-width="${n1(s * 0.4)}"/><path d="M${n1(x - s / 2)} ${n1(y)}H${n1(x + s / 2)}" stroke="${p2.wall[kind]}" stroke-width="${n1(s * 0.3)}"/>` });
  for (const kind of [...new Set(spec.water.map((w) => w.kind))]) out.push({ name: name(kind), swatch: (x, y, s) => sw(x, y, s, p2.water, p2.waterEdge) });
  for (const kind of [...new Set(spec.areas.map((a) => a.kind))]) out.push({ name: name(kind), swatch: (x, y, s) => sw(x, y, s, p2.area[kind].fill, p2.ink, ' stroke-opacity="0.4"') });
  return out;
}
function siteSvg(spec, o) {
  const k = o.ppu ?? 24, W = spec.cols * k, H = spec.rows * k, u = o.pageScale ? pageUnit(o.pageScale) : k / 24, p2 = PALETTES[o.theme ?? "color"];
  const l = o.layout ?? layoutSettlement(spec), on = settlementLayersFor(spec, "site", o.layers), mode = o.buildings ?? "roofs", fr = frameOf(o.crop, spec.cols, spec.rows, k);
  const parts = [], defs = [], per = spec.scale.perCell, sw = Math.max(0.6, 0.9 * u), ink = patternInk(o.theme ?? "color");
  const pat = /* @__PURE__ */ new Set(), usePat = (name, cells = 1) => {
    const id2 = `p-${name}`;
    if (!pat.has(id2)) {
      pat.add(id2);
      defs.push(patternDef(id2, name, k, ink, cells));
    }
    return `url(#${id2})`;
  };
  if (on.ground) parts.push(`<rect id="ground" width="${n1(W)}" height="${n1(H)}" fill="${p2.ground[spec.ground]}"/>`);
  if (on.underlay && spec.underlay && o.underlay) parts.push(underlaySvg(spec, o.underlay.map, k, o.underlay.field));
  if (on.areas && spec.areas.length) {
    let g = "";
    for (const a of spec.areas) {
      const st = p2.area[a.kind], d = ring(a.points, k);
      g += `<path d="${d}" fill="${st.fill}"${st.edge ? ` stroke="${st.edge}" stroke-width="${n1(sw * 1.4)}"${st.dash ? ` stroke-dasharray="${n1(k * 0.5)} ${n1(k * 0.25)}"` : ""}` : ""}/>`;
      if (st.pattern) g += `<path d="${d}" fill="${usePat(st.pattern, a.kind === "field" ? 1.5 : 1)}"/>`;
      if (p2.ripples && !st.edge) g += `<path d="${d}" fill="none" stroke="${p2.ink}" stroke-width="${n1(sw * 0.7)}" stroke-opacity="0.6"/>`;
    }
    parts.push(`<g id="areas">${g}</g>`);
  }
  if (on.water && l.water.length) {
    const edge = l.water.map((w) => w.area ? `<path d="${ring(w.pts, k)}" fill="${p2.waterEdge}" stroke="${p2.waterEdge}" stroke-width="${n1(sw * 2.4)}" stroke-linejoin="round"/>` : `<path d="${line(w.pts, k, w.closed)}" fill="none" stroke="${p2.waterEdge}" stroke-width="${n1(w.width * k + sw * 2.4)}" stroke-linecap="${w.kind === "canal" || w.kind === "moat" ? "butt" : "round"}" stroke-linejoin="round"/>`).join("");
    const fill = (paint) => l.water.map((w) => w.area ? `<path d="${ring(w.pts, k)}" fill="${paint}"/>` : `<path d="${line(w.pts, k, w.closed)}" fill="none" stroke="${paint}" stroke-width="${n1(w.width * k)}" stroke-linecap="${w.kind === "canal" || w.kind === "moat" ? "butt" : "round"}" stroke-linejoin="round"/>`).join("");
    parts.push(`<g id="water">${edge}${fill(p2.water)}${p2.ripples ? fill(usePat("ripples", 1.5)) : ""}</g>`);
  }
  if (on.roads && l.roads.length) {
    const sorted = [...l.roads].sort((a, b) => b.width - a.width);
    let edges2 = "", fills = "";
    for (const r of sorted) {
      const st = p2.road[r.kind], d = line(r.pts, k), w = r.width * k;
      if (r.kind === "path") {
        fills += `<path d="${d}" fill="none" stroke="${st.edge}" stroke-width="${n1(Math.max(sw, w * 0.5))}" stroke-dasharray="${n1(w * 1.2)} ${n1(w * 0.8)}" stroke-linecap="round" stroke-linejoin="round"/>`;
        continue;
      }
      const cap = st.ruts ? "butt" : "round";
      edges2 += `<path d="${d}" fill="none" stroke="${st.edge}" stroke-width="${n1(w + (st.ruts ? 0 : sw * 2.2))}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
      fills += `<path d="${d}" fill="none" stroke="${st.ruts ? p2.ground[spec.ground] : st.fill}" stroke-width="${n1(st.ruts ? w * 0.62 : w)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
    }
    parts.push(`<g id="roads">${edges2}${fills}</g>`);
  }
  if (on.bridges && l.bridges.length) {
    let g = "";
    for (const b of l.bridges) {
      const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) * k, a = Math.atan2(b.y1 - b.y0, b.x1 - b.x0) * 180 / Math.PI, bw = b.width * k;
      g += `<g transform="translate(${n1(b.x0 * k)} ${n1(b.y0 * k)}) rotate(${n1(a)})"><rect x="0" y="${n1(-bw / 2)}" width="${n1(len)}" height="${n1(bw)}" fill="${p2.fixture.stone}" stroke="${p2.ink}" stroke-width="${n1(sw)}"/><path d="M0 ${n1(-bw / 2 + sw * 1.5)}H${n1(len)}M0 ${n1(bw / 2 - sw * 1.5)}H${n1(len)}" stroke="${p2.ink}" stroke-width="${n1(sw * 1.6)}"/></g>`;
    }
    parts.push(`<g id="bridges">${g}</g>`);
  }
  if (on.walls && l.walls.length) parts.push(`<g id="walls">${l.walls.map((w) => wallSvg(w, k, p2, u, W, H, defs)).join("")}</g>`);
  const txt = textSizes(u, o.pageScale);
  if (on.buildings && l.buildings.length) {
    let g = "";
    for (const bg of l.buildings) {
      const b = bg.building, fl2 = mode === "interior" ? groundFloor(b) : void 0;
      if (fl2) {
        const f2 = planFactor(spec), kp = k / f2, lay = layoutFloor(spec, b, fl2), [cx, cy] = [bg.cx * k, bg.cy * k];
        const drawn = floorSvg(lay, kp, p2, u * 0.8, { grid: false, numbers: false, labels: false, fixtures: true, doors: true, windows: true, walls: true, floor: true }, `clip-b-${bg.index}`, 1, txt);
        g += `<g transform="translate(${n1(cx)} ${n1(cy)}) rotate(${n1(b.angle ?? 0)}) translate(${n1(-b.w / 2 * k)} ${n1(-b.h / 2 * k)})">${["floor", "fixtures", "walls", "doors", "windows"].map((x) => drawn[x] ?? "").join("")}</g>`;
      } else if (mode === "roofs") g += roofSvg(bg, k, p2, u);
      else g += `<path d="${ring(bg.outline, k)}" fill="${p2.floor}" stroke="${p2.outerWall}" stroke-width="${n1(Math.max(1.5 * u, 0.25 * k))}" stroke-linejoin="miter"/>`;
    }
    parts.push(`<g id="buildings">${g}</g>`);
  }
  if (on.trees && (spec.trees.length || l.areaTrees.length)) {
    const all = [...l.areaTrees, ...spec.trees];
    parts.push(`<g id="trees">${all.map((t, i) => treeSvg(t, k, p2, u, per, idSeed(`${t.x.toFixed(2)},${t.y.toFixed(2)}`) ^ i)).join("")}</g>`);
  }
  if (on.props && spec.props.length) parts.push(`<g id="props">${spec.props.map((f2) => {
    const [w, h] = fixtureSize(f2, per);
    return fixtureSvg({ kind: f2.kind, x: f2.x, y: f2.y, w, h, angle: f2.angle ?? 0 }, k, p2, sw);
  }).join("")}</g>`);
  if (on.grid && spec.grid.show) {
    const s = spec.grid.size, ln2 = (step) => {
      let d = "";
      for (let x = 0; x <= spec.cols + 1e-9; x += step) d += `M${n1(x * k)} 0V${n1(H)}`;
      for (let y = 0; y <= spec.rows + 1e-9; y += step) d += `M0 ${n1(y * k)}H${n1(W)}`;
      return d;
    };
    let g = "";
    if (spec.grid.sub && s > 1) g += `<path d="${ln2(1)}" stroke="${p2.grid}" stroke-opacity="${p2.gridOpacity * 0.5}" stroke-width="${n1(0.6 * u)}"/>`;
    g += `<path d="${ln2(s)}" stroke="${p2.grid}" stroke-opacity="${p2.gridOpacity}" stroke-width="${n1(0.9 * u)}"/>`;
    parts.push(`<g id="grid" fill="none">${g}</g>`);
  }
  if (on.symbols && spec.overlay.symbols.length)
    parts.push(`<g id="symbols">${spec.overlay.symbols.map((s) => {
      const sym = SYMBOLS3[s.kind] ?? SYMBOLS2.trap;
      return `<g transform="translate(${n1(s.x * k)} ${n1(s.y * k)})${s.angle ? ` rotate(${n1(s.angle)})` : ""} scale(${(k / 20 * (s.scale ?? 1) * 1.5).toFixed(3)})">${sym.svg.replaceAll("{ink}", p2.ink).replaceAll("{fill}", p2.fixture.paper)}</g>`;
    }).join("")}</g>`);
  if (on.numbers || on.labels) {
    let nums4 = "", names = "";
    for (const bg of l.buildings) {
      const x = bg.cx * k, y = bg.cy * k, has = on.numbers && bg.number !== void 0, b = bg.building;
      if (has) nums4 += b.href ? `<a href="${esc(b.href)}">${badge(String(bg.number), x, y, txt.number, p2)}</a>` : badge(String(bg.number), x, y, txt.number, p2);
      if (on.labels && b.label) names += haloText(b.label, x, y + (has ? txt.number * 1.6 : txt.name * 0.3), txt.name, p2.ink, { halo: p2.halo }, 'font-weight="700"');
    }
    if (on.labels) {
      for (const a of spec.areas) if (a.label) {
        const xs = a.points.filter((_, i) => i % 2 === 0), ys = a.points.filter((_, i) => i % 2 === 1);
        names += haloText(a.label, (Math.min(...xs) + Math.max(...xs)) / 2 * k, (Math.min(...ys) + Math.max(...ys)) / 2 * k, txt.name, p2.ink, { halo: p2.halo }, 'font-style="italic"');
      }
      for (const r of l.roads) {
        const label4 = spec.roads[r.index].label;
        if (!label4 || r.pts.length < 4) continue;
        const i = Math.floor((r.pts.length / 2 - 1) / 2) * 2, x0 = r.pts[i], y0 = r.pts[i + 1], x1 = r.pts[i + 2], y1 = r.pts[i + 3];
        let a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
        if (a > 90) a -= 180;
        else if (a < -90) a += 180;
        const mx = (x0 + x1) / 2 * k, my = (y0 + y1) / 2 * k;
        names += `<g transform="rotate(${n1(a)} ${n1(mx)} ${n1(my)})">${haloText(label4, mx, my + txt.name * 0.35, txt.name * 0.9, p2.ink, { halo: p2.halo }, 'font-style="italic"')}</g>`;
      }
    }
    if (nums4) parts.push(`<g id="numbers">${nums4}</g>`);
    if (names) parts.push(`<g id="names">${names}</g>`);
  }
  if (on.labels && spec.overlay.labels.length) parts.push(`<g id="labels">${spec.overlay.labels.map((lb) => labelSvg(lb, k, u, p2, o.pageScale)).join("")}</g>`);
  const boxes = l.buildings.map((bg) => {
    const xs = bg.outline.filter((_, i) => i % 2 === 0), ys = bg.outline.filter((_, i) => i % 2 === 1);
    return { x: Math.min(...xs) * k, y: Math.min(...ys) * k, w: (Math.max(...xs) - Math.min(...xs)) * k, h: (Math.max(...ys) - Math.min(...ys)) * k };
  });
  const f = spec.furniture ?? { place: "over" };
  const furn = furniture({ fr, k, u, p: p2, on, title: spec.title, perCell: per, unit: spec.scale.unit, legend: legendFor(spec, p2, "site"), north: 0, place: f.place, side: f.side ?? "bottom", covers: (b) => boxes.some((x) => overlaps(x, b)) });
  return finish(fr, furn, defs, parts, p2, u, o.unit);
}
function planSvg(spec, o) {
  const { building: b, floor: floor3 } = planTarget(spec, o.building, o.floor), sheet = planSheet(spec, b);
  const k = o.ppu ?? 40, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, p2 = PALETTES[o.theme ?? "color"], on = settlementLayersFor(spec, "plan", o.layers);
  const fr = frameOf(o.crop, sheet.cols, sheet.rows, k), W = sheet.cols * k, H = sheet.rows * k, M = sheet.margin * k;
  const parts = [], defs = [], txt = textSizes(u, o.pageScale);
  if (on.ground) parts.push(`<rect id="ground" width="${n1(W)}" height="${n1(H)}" fill="${p2.ground[spec.ground]}"/>`);
  const empty = { level: 0, rooms: [] }, lay = layoutFloor(spec, b, floor3 ?? empty);
  const drawn = floorSvg(lay, k, p2, u, { grid: on.grid, numbers: on.numbers, labels: on.labels, fixtures: on.fixtures, doors: on.doors, windows: on.windows, walls: on.walls, floor: on.floor }, "plan-clip", 1, txt);
  for (const layer of ["floor", "grid", "fixtures", "walls", "doors", "windows", "numbers", "labels"]) if (drawn[layer]) parts.push(`<g id="${layer}" transform="translate(${n1(M)} ${n1(M)})">${drawn[layer]}</g>`);
  const title = `${b.label ?? b.kind[0].toUpperCase() + b.kind.slice(1)} \u2014 ${floor3 ? floorName(floor3) : "no floors yet"}`;
  const f = spec.furniture ?? { place: "auto" };
  const fb = { x: M, y: M, w: lay.w * k, h: lay.h * k };
  const furn = furniture({ fr, k, u, p: p2, on, title, perCell: spec.interior.perCell, unit: spec.scale.unit, legend: legendFor(spec, p2, "plan", floor3), north: -(b.angle ?? 0), place: f.place, side: f.side ?? "bottom", covers: (x) => overlaps(x, fb) });
  return finish(fr, furn, defs, parts, p2, u, o.unit);
}
function renderSettlementSvg(spec, o = {}) {
  return (o.view ?? "site") === "plan" ? planSvg(spec, o) : siteSvg(spec, o);
}
function settlementRenderSize(spec, o = {}) {
  const svg = renderSettlementSvg(spec, { ...o, unit: "px", layers: { ...o.layers, underlay: false } }), m = svg.match(/width="([\d.]+)[a-z]*" height="([\d.]+)/);
  return { width: m ? +m[1] : 0, height: m ? +m[2] : 0 };
}

// ../artgen-mapgen/src/settlement/interior.ts
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
function splitFloor(spec, b, level2, min, single, rand) {
  const f = planFactor(spec), tag = level2 < 0 ? `c${-level2}` : `f${level2}`;
  const blocks2 = [];
  if (b.shape === "rect" || b.shape === "L" || b.shape === "T") buildingWings(b).forEach(([x, y, w, h], i) => blocks2.push({ id: `${tag}${"abc"[i]}`, shape: "rect", x: (x - b.x) * f, y: (y - b.y) * f, w: w * f, h: h * f, split: { mode: "bsp", min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 }));
  else if (b.shape === "poly") {
    const o = planOutline(spec, b), xs = o.filter((_, i) => i % 2 === 0), ys = o.filter((_, i) => i % 2 === 1);
    blocks2.push({ id: `${tag}a`, shape: "poly", points: o, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), split: { mode: "bsp", min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 });
  } else blocks2.push({ id: `${tag}a`, shape: b.shape, x: 0, y: 0, w: b.w * f, h: b.h * f, split: { mode: "bsp", min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 });
  const rooms = [], connections = [], wingRooms = [];
  for (const bl of blocks2) {
    const whole = single || bl.w * bl.h < min * min * 2.2;
    const part = whole ? { rooms: [bl.shape === "rect" ? { id: `${bl.id}-1`, shape: "rect", x: bl.x, y: bl.y, w: bl.w, h: bl.h } : { id: `${bl.id}-1`, shape: bl.shape === "poly" ? "poly" : bl.shape, x: bl.x, y: bl.y, w: bl.w, h: bl.h, ...bl.points && { points: bl.points } }], connections: [] } : splitBlock(bl);
    wingRooms.push(part.rooms);
    rooms.push(...part.rooms);
    connections.push(...part.connections.map((c) => ({ a: c.a, b: c.b, ...c.kind && c.kind !== "secret" && { kind: c.kind } })));
  }
  for (let i = 1; i < wingRooms.length; i++) {
    let best = null;
    for (const a of wingRooms[0]) for (const c of wingRooms[i]) {
      const len = sharedEdges(roomOutline(a), roomOutline(c)).reduce((s, [p2, q]) => s + Math.hypot(q[0] - p2[0], q[1] - p2[1]), 0);
      if (len >= 1 && (!best || len > best[2])) best = [a, c, len];
    }
    if (best) connections.push({ a: best[0].id, b: best[1].id });
  }
  return { rooms: rooms.map((r) => ({ ...r, x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h), origin: ORIGIN })), connections: connections.map((c) => ({ ...c, origin: ORIGIN })) };
}
function place(pl, room3, outline2, kind, where, rand, per, farFrom, size2) {
  const fx = FIXTURES[kind];
  if (!fx) return false;
  let [fw, fh] = size2 ?? [fx.ft[0] / per, fx.ft[1] / per];
  const { x, y, w, h } = room3, inset = 0.12;
  const cands = [];
  const along2 = (n) => Array.from({ length: n }, () => 0.15 + rand() * 0.7);
  const wall2 = (side, t) => {
    if (side === "n") return { x: x + w * t, y: y + inset + fh / 2, angle: 0 };
    if (side === "s") return { x: x + w * t, y: y + h - inset - fh / 2, angle: 180 };
    if (side === "w") return { x: x + inset + fh / 2, y: y + h * t, angle: 270 };
    return { x: x + w - inset - fh / 2, y: y + h * t, angle: 90 };
  };
  const sides = ["n", "s", "e", "w"];
  if (where === "far" && farFrom) {
    const far = sides.map((s) => {
      const p2 = wall2(s, 0.5);
      return { s, d: Math.hypot(p2.x - farFrom.x, p2.y - farFrom.y) };
    }).sort((p2, q) => q.d - p2.d);
    for (const { s } of far) cands.push(wall2(s, 0.5), ...along2(3).map((t) => wall2(s, t)));
  } else if (where === "wall" || where === "far") for (const s of sides.sort(() => rand() - 0.5)) cands.push(...along2(4).map((t) => wall2(s, t)));
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
    pl.fixtures.push({ kind, x: r2(c.x), y: r2(c.y), ...size2 && { w: r2(fw), h: r2(fh) }, ...c.angle && { angle: c.angle }, origin: ORIGIN });
    if (where !== "under") pl.boxes.push(bx);
    return true;
  }
  return false;
}
function rows(pl, room3, kind, n, per, door3) {
  const fx = FIXTURES[kind], long = room3.w >= room3.h, L2 = long ? room3.w : room3.h, S = long ? room3.h : room3.w, aisle = 1;
  const len = Math.min(fx.ft[0] / per, (S - aisle - 0.4) / 2), depth = fx.ft[1] / per, step = depth + (kind === "bunk" ? 0.6 : 0.5);
  if (len < 0.6) return;
  const fromStart = !door3 || (long ? Math.abs(door3.x - room3.x) < Math.abs(door3.x - room3.x - room3.w) : Math.abs(door3.y - room3.y) < Math.abs(door3.y - room3.y - room3.h));
  let placed = 0;
  for (let t = 1.2 + depth / 2; t < L2 - 2.2 && placed < n; t += step) {
    const a = fromStart ? t : L2 - t;
    for (const sg of [-1, 1]) {
      const off = aisle / 2 + len / 2, c = long ? { x: room3.x + a, y: room3.y + room3.h / 2 + sg * off } : { x: room3.x + room3.w / 2 + sg * off, y: room3.y + a };
      const angle = long ? 90 : 0, bx = boxOf(c, len, depth, angle);
      if (pl.boxes.some((o) => hits(o, bx, 0.05)) || pl.keepOut.some((k) => k.x > bx.x - 0.6 && k.x < bx.x + bx.w + 0.6 && k.y > bx.y - 0.6 && k.y < bx.y + bx.h + 0.6)) continue;
      pl.fixtures.push({ kind, x: r2(c.x), y: r2(c.y), w: r2(len), h: r2(depth), ...angle && { angle }, origin: ORIGIN });
      pl.boxes.push(bx);
      placed++;
    }
  }
}
function feast(pl, room3, kind, per) {
  const long = room3.w >= room3.h, L2 = (long ? room3.w : room3.h) * 0.6, d = FIXTURES[kind].ft[1] / per, b = FIXTURES.bench.ft[1] / per, c = { x: room3.x + room3.w / 2, y: room3.y + room3.h / 2 };
  if (L2 < 1.5 || (long ? room3.h : room3.w) < d + 2 * b + 1) return;
  const angle = long ? 0 : 90, items = [[kind, 0, L2, d], ["bench", -(d / 2 + b / 2 + 0.15), L2 * 0.9, b], ["bench", d / 2 + b / 2 + 0.15, L2 * 0.9, b]];
  for (const [k, off, w, h] of items) {
    const p2 = long ? { x: c.x, y: c.y + off } : { x: c.x + off, y: c.y }, bx = boxOf(p2, w, h, angle);
    if (pl.boxes.some((o) => hits(o, bx, 0.05))) continue;
    pl.fixtures.push({ kind: k, x: r2(p2.x), y: r2(p2.y), w: r2(w), h: r2(h), ...angle && { angle }, origin: ORIGIN });
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
    cands.sort((p2, q) => Math.hypot(q.x - entry[0], q.y - entry[1]) - Math.hypot(p2.x - entry[0], p2.y - entry[1]));
    stair = cands.find((c) => {
      const bx = boxOf(c, sw, sd, 0);
      return [[bx.x, bx.y], [bx.x + bx.w, bx.y], [bx.x, bx.y + bx.h], [bx.x + bx.w, bx.y + bx.h]].every(([px, py]) => inPolygon(outline2, px, py));
    }) ?? null;
  }
  const floors = [];
  for (const level2 of levels) {
    const roles = level2 < 0 ? R2.cellar : level2 === 0 ? R2.ground : R2.upper[Math.min(level2 - 1, R2.upper.length - 1)] ?? ["store"];
    const single = !!R2.single || roles.length === 1 || level2 < 0;
    const { rooms, connections } = splitFloor(spec, b, level2, Math.max(2, R2.min - (level2 > 0 ? 0.5 : 0)), single, rand);
    const fl2 = { level: level2, rooms, connections, origin: ORIGIN };
    if (level2 === 0) fl2.doors = [{ at: entry }, ...back ? [{ at: back }] : []];
    fl2.windows = level2 < 0 ? [] : windowsFor(outline2, level2 === 0 ? [{ x: entry[0], y: entry[1] }, ...back ? [{ x: back[0], y: back[1] }] : []] : [], b.kind);
    if (!fl2.windows.length) delete fl2.windows;
    const lay = layoutFloor(spec, b, fl2);
    const pl = { fixtures: [], boxes: [], keepOut: [...lay.inner, ...lay.doors].map((d) => ({ x: d.x, y: d.y })) };
    if (stair) {
      const up = levels.includes(level2 + 1), down = levels.includes(level2 - 1);
      const kind = spiral ? "spiral-stairs" : level2 < 0 || up ? "stairs-up" : "stairs-down";
      if (up || down) {
        pl.fixtures.push({ kind, x: stair.x, y: stair.y, origin: ORIGIN });
        pl.boxes.push(boxOf(stair, sw, sd, 0));
      }
    }
    const order = rooms.map((r, i) => ({ r, i, a: polygonArea(roomOutline(r)) })).sort((p2, q) => q.a - p2.a);
    order.forEach(({ r }, n) => {
      const role = roles[n] ?? (level2 > 0 ? "bedroom" : "store"), out = roomOutline(r);
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
    if (level2 === levels[levels.length - 1] && level2 === 0 && !fl2.fixtures.length) delete fl2.fixtures;
    floors.push(fl2);
  }
  return floors;
}
function withInterior(spec, id2, o = {}) {
  const b = spec.buildings.find((x) => x.id === id2);
  if (!b) throw new Error(`no building ${id2}`);
  const floors = generateInterior(spec, b, o);
  return { ...spec, buildings: spec.buildings.map((x) => x.id === id2 ? { ...x, floors, ...o.stories !== void 0 && { stories: o.stories } } : x) };
}

// ../artgen-mapgen/src/settlement/generate.ts
var ORIGIN2 = "gen";
var r22 = (v) => Math.round(v * 100) / 100;
var flat = (pts2) => pts2.flatMap(([x, y]) => [r22(x), r22(y)]);
function groundFromMap(spec, field) {
  const u = spec.underlay, T2 = (t) => TERRAINS.indexOf(t);
  const at4 = (x, y) => {
    const mx = u.origin[0] + x * u.scale, my = u.origin[1] + y * u.scale, i = Math.floor(mx * field.res), j = Math.floor(my * field.res);
    return i < 0 || j < 0 || i >= field.w || j >= field.h ? -1 : j * field.w + i;
  };
  const elev = (x, y) => {
    const n = at4(x, y);
    return n < 0 ? 0 : field.elevation[n];
  };
  return {
    water: (x, y) => {
      const n = at4(x, y);
      return n >= 0 && (field.terrain[n] === T2("water") || field.terrain[n] === T2("deep"));
    },
    slope: (x, y) => {
      const d = 1;
      return Math.hypot(elev(x + d, y) - elev(x - d, y), elev(x, y + d) - elev(x, y - d)) / (2 * d * u.scale);
    },
    forest: (x, y) => {
      const n = at4(x, y);
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
  poly(p2, pad, test) {
    const xs = p2.filter((_, i) => i % 2 === 0), ys = p2.filter((_, i) => i % 2 === 1), s = 1 / this.res;
    for (let y = Math.min(...ys) - pad; y <= Math.max(...ys) + pad; y += s) for (let x = Math.min(...xs) - pad; x <= Math.max(...xs) + pad; x += s) {
      const inside = inPolygon(p2, x, y) || pad > 0 && nearestOnLine([...p2, p2[0], p2[1]], x, y).d <= pad;
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
      const p2 = i - 1 >> 1;
      if (heap2[p2][0] <= heap2[i][0]) break;
      [heap2[p2], heap2[i]] = [heap2[i], heap2[p2]];
      i = p2;
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
    const run2 = pts2.slice(Math.max(0, first - 1), last + 2), width = r.widths.reduce((s, v) => s + v, 0) / r.widths.length / u.scale;
    if (run2.length >= 2) out.push({ kind: width > 3 ? "river" : "stream", points: flat(simplifyLine({ pts: run2.flat(), closed: false }, 0.3).pts.reduce((a, v, i, s) => i % 2 ? a : [...a, [v, s[i + 1]]], [])), width: r22(Math.max(0.6, width)), origin: ORIGIN2 });
  }
  const W = spec.cols + 3, H = spec.rows + 3, f = new Float32Array(W * H), g = groundFromMap(spec, field);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) f[j * W + i] = g.water(i - 1, j - 1) ? 1 : 0;
  for (const l of isolines(f, W, H, 0.5)) {
    if (!l.closed || l.pts.length < 8) continue;
    const pts2 = simplifyLine(l, 0.4).pts.map((v, i) => r22(Math.max(-1, Math.min(i % 2 ? spec.rows + 1 : spec.cols + 1, v - 0.5))));
    const area3 = polygonArea(pts2);
    if (area3 < 4) continue;
    const touches2 = pts2.some((v, i) => v <= -0.5 || v >= (i % 2 ? spec.rows : spec.cols) + 0.5);
    out.push({ kind: touches2 && area3 > spec.cols * spec.rows * 0.08 ? "sea" : area3 > 60 ? "lake" : "pond", points: pts2, origin: ORIGIN2 });
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
    const corner2 = side === 0 ? [[cols + 1, -1], [-1, -1]] : side === 1 ? [[cols + 1, rows2 + 1], [cols + 1, -1]] : side === 2 ? [[cols + 1, rows2 + 1], [-1, rows2 + 1]] : [[-1, rows2 + 1], [-1, -1]];
    const ring2 = side === 0 || side === 3 ? [...pts2, ...side === 0 ? corner2 : corner2.reverse()] : [...pts2, ...corner2];
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
  const addRoad = (kind, pts2, label4) => {
    const r = { kind, points: pts2, curve: "smooth", ...label4 && { label: label4 }, origin: ORIGIN2 };
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
      let p2 = [x, y];
      for (let k = 0; k < 20 && (wet(p2[0], p2[1], 1) || p2[0] < 2 || p2[1] < 2 || p2[0] > cols - 2 || p2[1] > rows2 - 2); k++) p2 = [p2[0] + (C3[0] - p2[0]) * 0.1, p2[1] + (C3[1] - p2[1]) * 0.1];
      return p2;
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
        const pool2 = s.roads.flatMap((r) => r.kind === "path" || r.kind === "track" ? [] : Array.from({ length: r.points.length / 2 - 1 }, (_, j) => [r.points[2 * j], r.points[2 * j + 1], r.points[2 * j + 2], r.points[2 * j + 3]])).filter((q) => Math.hypot(q[0] - C3[0], q[1] - C3[1]) < Rcore * 0.85);
        if (!pool2.length) break;
        const [sx, sy, nx, ny] = pool2[Math.floor(rand() * pool2.length)], a = Math.atan2(ny - sy, nx - sx) + (rand() < 0.5 ? 1 : -1) * Math.PI / 2 + (rand() - 0.5) * 0.5;
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
  const fit2 = (kind, long, short, cands, extra = {}) => {
    for (const { p: p2, vertical } of cands) {
      const w = vertical ? short : long, h = vertical ? long : short, box2 = flat(castleRect(p2[0], p2[1], w, h));
      if (box2.some((v, i) => v < 0.5 || v > (i % 2 ? rows2 : cols) - 0.5) || occ.poly(box2, ft(2), true)) continue;
      return put(kind, p2[0], p2[1], w, h, extra);
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
    const inner = castleRect(cc[0], cc[1], cw, ch), road2 = through[0], gateAt = crossings2(road2.points, inner)[0] ?? [cc[0], cc[1] + ch / 2];
    const tower = ft(28), curtain = { kind: "curtain", points: flat(inner), closed: true, towers: { shape: rand() < 0.6 ? "round" : "square", at: "corners", size: r22(tower) }, gates: [{ at: [r22(gateAt[0]), r22(gateAt[1])], kind: "gatehouse", ...(castleOnly || g.water === "moat") && { drawbridge: true } }], origin: ORIGIN2 };
    s.walls.push(curtain);
    s.buildings = s.buildings.filter((b) => b.origin !== ORIGIN2 || !inPolygon(flat(inner), b.x + b.w / 2, b.y + b.h / 2));
    occ.line([...flat(inner), inner[0][0], inner[0][1]], wallThickness(s, curtain) / 2 + ft(2));
    for (const [x, y] of inner) occ.poly(flat(castleRect(x, y, tower * 1.1, tower * 1.1)), 0, false);
    occ.poly(flat(castleRect(gateAt[0], gateAt[1], ft(70), ft(70))), 0, false);
    const back = [cc[0] - (gateAt[0] - cc[0]), cc[1] - (gateAt[1] - cc[1])], inset = (d) => wallThickness(s, curtain) / 2 + ft(9) + d / 2;
    const keep = fit2("keep", ft(45), ft(45), alongWalls(cc, cw, ch, inset(ft(45)), back).map((o) => ({ ...o, p: [o.p[0] + (cc[0] - o.p[0]) * 0.25, o.p[1] + (cc[1] - o.p[1]) * 0.25] })), { label: "Keep", roof: "battlement" });
    const k0 = keep ? [keep.x + keep.w / 2, keep.y + keep.h / 2] : cc;
    fit2("hall", ft(55), ft(30), alongWalls(cc, cw, ch, inset(ft(30)), k0), { label: "Great hall" });
    fit2("chapel", ft(32), ft(22), alongWalls(cc, cw, ch, inset(ft(22)), k0, true).filter((o) => Math.hypot(o.p[0] - gateAt[0], o.p[1] - gateAt[1]) > ft(50)), { label: "Chapel" });
    fit2("barracks", ft(40), ft(22), alongWalls(cc, cw, ch, inset(ft(22)), gateAt), {});
    s.props.push({ kind: "well", x: r22(cc[0] + (gateAt[0] - cc[0]) * 0.3), y: r22(cc[1] + (gateAt[1] - cc[1]) * 0.3), origin: ORIGIN2 });
    occ.poly(flat(inner), ft(6), false);
    if (castleOnly) {
      const outer = blob(cc, Math.min(cw * 1.2, cc[0] - 3, cols - cc[0] - 3), Math.min(ch * 1.3, cc[1] - 3, rows2 - cc[1] - 3), 10, 0.1, rand);
      const og = crossings2(road2.points, outer)[0];
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
      for (const [kind, l, sh, extra] of [["stable", 45, 15, { label: "Stables" }], ["barn", 40, 28, {}], ["smithy", 25, 22, {}]]) fit2(kind, ft(l), ft(sh), ring2.sort(() => rand() - 0.5), extra);
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
  spots.sort((p2, q) => p2.d - q.d);
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
    const corners = [[0, 0], [cols, 0], [0, rows2], [cols, rows2]].sort((p2, q) => Math.hypot(q[0] - C3[0], q[1] - C3[1]) - Math.hypot(p2[0] - C3[0], p2[1] - C3[1]));
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
    const size2 = kind === "boulder" ? ft(8) : sizes[kind] * (0.8 + rand() * 0.4);
    s.trees.push({ kind, x: r22(x), y: r22(y), size: r22(size2), origin: ORIGIN2 });
    occ.mark(x, y);
    i++;
  }
  for (const b of s.buildings) {
    if (b.origin !== ORIGIN2) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, side = rotatePts([cx + b.w / 2 + ft(5), cy], b.angle ?? 0, cx, cy);
    const prop2 = b.kind === "barn" ? { kind: "haystack", x: side[0], y: side[1] } : b.kind === "stable" ? { kind: "trough", x: side[0], y: side[1], angle: (b.angle ?? 0) + 90 } : b.kind === "inn" ? { kind: "cart", x: side[0], y: side[1], angle: b.angle ?? 0 } : b.kind === "smithy" ? { kind: "woodpile", x: side[0], y: side[1], angle: (b.angle ?? 0) + 90 } : null;
    if (prop2 && !occ.taken(prop2.x, prop2.y)) {
      s.props.push({ ...prop2, x: r22(prop2.x), y: r22(prop2.y), ...prop2.angle !== void 0 && { angle: r22(prop2.angle) }, origin: ORIGIN2 });
      occ.mark(prop2.x, prop2.y);
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

// ../artgen-mapgen/src/settlement/lint.ts
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
    const at4 = `buildings[${i}]`, b = g.building;
    if (polygonArea(g.outline) < 0.25) add("error", at4, "the footprint has (almost) no area");
    if (g.outline.some((v, j) => j % 2 ? v < 0 || v > spec.rows : v < 0 || v > spec.cols)) add("warning", at4, `${b.id} runs off the sheet`);
    const wet = share(g.outline, (x, y) => inWater(l.water, x, y));
    if (wet > 0.2) add("warning", at4, `${b.id} stands in water (${Math.round(wet * 100)}% of it)`);
    const onRoad = l.roads.findIndex((r) => r.kind !== "path" && share(g.outline, (x, y) => nearestOnLine(r.pts, x, y).d < r.width / 2) > 0.2);
    if (onRoad >= 0) add("warning", at4, `${b.id} stands across roads[${onRoad}] (a ${l.roads[onRoad].kind})`);
    for (let j = 0; j < i; j++) {
      const o = l.buildings[j], ob = o.building;
      if (Math.abs(o.cx - g.cx) > (b.w + b.h + ob.w + ob.h) / 2 || Math.abs(o.cy - g.cy) > (b.w + b.h + ob.w + ob.h) / 2) continue;
      if (share(g.outline, (x, y) => inPolygon(o.outline, x, y)) > 0.05) add("warning", at4, `${b.id} overlaps ${ob.id} (buildings[${j}])`);
    }
    const outline2 = planOutline(spec, b), levels = new Map((b.floors ?? []).map((f) => [f.level, f]));
    (b.floors ?? []).forEach((fl2, fi) => {
      const fa = `${at4}.floors[${fi}]`;
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
          const next4 = levels.get(fl2.level + dir);
          if (!next4) {
            if (f.kind !== "ladder" && f.kind !== "spiral-stairs") add("warning", `${fa}.fixtures[${xi}]`, `${f.kind} on ${fl2.level} leads to level ${fl2.level + dir}, which ${b.id} does not have`);
            continue;
          }
          if (!(next4.fixtures ?? []).some((n) => STAIRS.includes(n.kind) && Math.hypot(n.x - f.x, n.y - f.y) < 2.5)) add("warning", `${fa}.fixtures[${xi}]`, `${f.kind} meets no stairs on level ${fl2.level + dir}`);
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
  spec.props.forEach((p2, i) => {
    if (off(p2.x, p2.y)) add("warning", `props[${i}]`, `${p2.kind} is off the sheet`);
  });
  return out;
}

// ../artgen-mapgen/src/settlement/facts.ts
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
      props: tally(spec.props.map((p2) => p2.kind))
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
        floors: [...b.floors ?? []].sort((p2, q) => p2.level - q.level).map((f) => ({ level: f.level, name: floorName(f), rooms: f.rooms.length, doors: (f.doors?.length ?? 0) + (f.connections?.filter((c) => c.kind !== "open").length ?? 0), windows: f.windows?.length ?? 0, fixtures: tally((f.fixtures ?? []).map((x) => x.kind)) }))
      };
    }),
    walls: l.walls.map((w) => ({ index: w.index, kind: w.kind, length: len(lineLength2(w.closed ? [...w.pts, w.pts[0], w.pts[1]] : w.pts)), closed: w.closed, towers: w.towers.length, gates: w.gates.map((g) => ({ kind: g.kind, at: [r12(g.x), r12(g.y)] })) })),
    roads: l.roads.map((r) => ({ index: r.index, kind: r.kind, length: len(lineLength2(r.pts)), ...spec.roads[r.index].label && { label: spec.roads[r.index].label } })),
    water: l.water.map((w) => w.area ? { index: w.index, kind: w.kind, area: sq(polygonArea(w.pts)) } : { index: w.index, kind: w.kind, length: len(lineLength2(w.pts)) }),
    areas: spec.areas.map((a, index) => ({ index, kind: a.kind, area: sq(polygonArea(a.points)), ...a.label && { label: a.label } })),
    bridges: l.bridges.length
  };
}

// ../artgen-mapgen/src/settlement/edit.ts
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
var pt2 = (o, k) => {
  const v = o[k];
  if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === "number")) throw new Error(`${o.op}: ${k} ([x, y]) is required`);
  return v;
};
var pts = (o, k, min) => {
  const v = o[k];
  if (!Array.isArray(v) || v.length < min * 2 || v.length % 2 || !v.every((n) => typeof n === "number")) throw new Error(`${o.op}: ${k} (at least ${min} x,y pairs) is required`);
  return v;
};
function oneOf(o, k, list6, fallback) {
  const v = o[k] ?? fallback;
  if (!list6.includes(v)) throw new Error(`${o.op}: ${k}: one of ${list6.join(", ")}`);
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
function building(m, id2) {
  const b = m.buildings.find((x) => x.id === id2);
  if (!b) throw new Error(`no building ${String(id2)}${m.buildings.length ? ` (there are ${m.buildings.slice(0, 8).map((x) => x.id).join(", ")}${m.buildings.length > 8 ? ", \u2026" : ""})` : ""}`);
  return b;
}
function floor(m, o, make = false) {
  const b = building(m, o.building), level2 = typeof o.level === "number" ? o.level : 0;
  let f = b.floors?.find((x) => x.level === level2);
  if (!f) {
    if (!make) throw new Error(`building ${b.id} has no floor at level ${level2} (floor.add, or interior to lay them all out)`);
    f = { level: level2, rooms: [] };
    b.floors = [...b.floors ?? [], f].sort((p2, q) => p2.level - q.level);
  }
  return { b, f };
}
var BUILDING_FIELDS = ["shape", "angle", "roof", "stories", "label", "number", "href", "wing", "points", "kind", "origin"];
function editSettlement(m, o) {
  switch (o.op) {
    case "building.add": {
      const kind = oneOf(o, "kind", BUILDING_KINDS), shape = oneOf(o, "shape", BUILDING_SHAPES, "rect");
      const id2 = opt(o, "id") ?? nextId(m.buildings, "b");
      if (m.buildings.some((b2) => b2.id === id2)) throw new Error(`building ${id2} already exists`);
      const box2 = shape === "poly" ? polyBox(pts(o, "points", 3)) : { x: num(o, "x"), y: num(o, "y"), w: num(o, "w"), h: num(o, "h") };
      const b = { id: id2, kind, shape, ...box2 };
      fields(b, o, BUILDING_FIELDS.filter((k) => k !== "kind" && k !== "shape"));
      m.buildings.push(b);
      return `added ${kind} ${id2} at ${box2.x},${box2.y} (${box2.w}\xD7${box2.h})`;
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
      const id2 = opt(o, "id") ?? nextId(f.rooms, `${f.level < 0 ? "c" : "f"}${Math.abs(f.level)}r`);
      if (f.rooms.some((r4) => r4.id === id2)) throw new Error(`room ${id2} already exists on that floor`);
      const box2 = shape === "poly" ? polyBox(pts(o, "points", 3)) : { x: num(o, "x"), y: num(o, "y"), w: num(o, "w"), h: num(o, "h") };
      const r = { id: id2, shape, ...box2, ...shape === "poly" && { points: o.points } };
      fields(r, o, ["label", "number"]);
      f.rooms.push(r);
      return `added room ${id2} to ${b.id} level ${f.level}`;
    }
    case "room.set": {
      const { f } = floor(m, o), r = f.rooms.find((x) => x.id === o.id);
      if (!r) throw new Error(`no room ${String(o.id)} on that floor`);
      return `set ${fields(r, o, ["x", "y", "w", "h", "shape", "label", "number", "points"]).join(", ") || "nothing"} of room ${r.id}`;
    }
    case "room.rm": {
      const { f } = floor(m, o), id2 = str(o, "id");
      if (!f.rooms.some((r) => r.id === id2)) throw new Error(`no room ${id2} on that floor`);
      f.rooms = f.rooms.filter((r) => r.id !== id2);
      if (f.connections) f.connections = f.connections.filter((c) => c.a !== id2 && c.b !== id2);
      return `removed room ${id2}`;
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
      const { b, f } = floor(m, o, true), d = { at: pt2(o, "at"), ...o.kind !== void 0 && { kind: o.kind }, ...typeof o.width === "number" && { width: o.width } };
      f.doors = [...f.doors ?? [], d];
      return `door at ${d.at.join(",")} of ${b.id}`;
    }
    case "window": {
      const { b, f } = floor(m, o, true), w = { at: pt2(o, "at"), ...typeof o.width === "number" && { width: o.width } };
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
      const w = m.walls[at(m.walls, o.index, "wall")], g = { at: pt2(o, "at"), kind: oneOf(o, "kind", GATE_KINDS2, "gate") };
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
      const kind = oneOf(o, "kind", TREE_KINDS, "tree"), area3 = pts(o, "area", 3), count = num(o, "count"), rand = rng(typeof o.seed === "number" ? o.seed : m.trees.length + 1);
      const box2 = polyBox(area3);
      let added = 0;
      for (let i = 0; i < count * 20 && added < count; i++) {
        const x = box2.x + rand() * box2.w, y = box2.y + rand() * box2.h;
        if (!inPolygon(area3, x, y)) continue;
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
      const key = o.op.split(".")[0], list6 = key === "label" ? m.overlay.labels : key === "symbol" ? m.overlay.symbols : key === "road" ? m.roads : key === "water" ? m.water : key === "wall" ? m.walls : key === "area" ? m.areas : m.trees;
      list6.splice(at(list6, o.index, key), 1);
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
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m)
      m = a[i];
  }
  return m;
};
var bits = function(d, p2, m) {
  var o = p2 / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p2 & 7) & m;
};
var bits16 = function(d, p2) {
  var o = p2 / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p2 & 7);
};
var shft = function(p2) {
  return (p2 + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var wbits = function(d, p2, v) {
  v <<= p2 & 7;
  var o = p2 / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p2, v) {
  v <<= p2 & 7;
  var o = p2 / 8 | 0;
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
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p2) {
  wbits(out, p2++, final);
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
    return wfblk(out, p2, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p2, 1 + (dtlen < ftlen)), p2 += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p2, nlc - 257);
    wbits(out, p2 + 5, ndc - 1);
    wbits(out, p2 + 10, nlcc - 4);
    p2 += 14;
    for (var i = 0; i < nlcc; ++i)
      wbits(out, p2 + 3 * i, lct[clim[i]]);
    p2 += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i = 0; i < clct.length; ++i) {
        var len = clct[i] & 31;
        wbits(out, p2, llm[len]), p2 += lct[len];
        if (len > 15)
          wbits(out, p2, clct[i] >> 5 & 127), p2 += clct[i] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i = 0; i < li; ++i) {
    var sym = syms[i];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p2, lm[len + 257]), p2 += ll[len + 257];
      if (len > 7)
        wbits(out, p2, sym >> 23 & 31), p2 += fleb[len];
      var dst = sym & 31;
      wbits16(out, p2, dm[dst]), p2 += dl[dst];
      if (dst > 3)
        wbits16(out, p2, sym >> 5 & 8191), p2 += fdeb[dst];
    } else {
      wbits16(out, p2, lm[sym]), p2 += ll[sym];
    }
  }
  wbits16(out, p2, lm[256]);
  return p2 + ll[256];
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
var zls = function(d, dict) {
  if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
    err(6, "invalid zlib data");
  if ((d[1] >> 5 & 1) == +!dict)
    err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
  return (d[1] >> 3 & 4) + 2;
};
function zlibSync(data, opts) {
  if (!opts)
    opts = {};
  var a = adler();
  a.p(data);
  var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
  return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
}
function unzlibSync(data, opts) {
  return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// ../artgen-primitives/src/lib/color.ts
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
function normHex(c) {
  const [r, g, b] = parseColor(c);
  return toHex(r, g, b);
}
var luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
var lumaOf = (c) => {
  const [r, g, b] = parseColor(c);
  return luma(r, g, b);
};
var dist2 = (a, r, g, b) => {
  const dr = r - a[0], dg = g - a[1], db = b - a[2];
  return 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
};
function toHsl(c) {
  const [R2, G, B] = parseColor(c).map((v) => v / 255);
  const max2 = Math.max(R2, G, B), min = Math.min(R2, G, B), l = (max2 + min) / 2;
  if (max2 === min) return { h: 0, s: 0, l };
  const d = max2 - min, s = l > 0.5 ? d / (2 - max2 - min) : d / (max2 + min);
  let h = max2 === R2 ? (G - B) / d + (G < B ? 6 : 0) : max2 === G ? (B - R2) / d + 2 : (R2 - G) / d + 4;
  h *= 60;
  return { h, s, l };
}

// ../artgen-primitives/src/lib/grid.ts
var Grid2 = class _Grid {
  w;
  h;
  d;
  /** Normal map of this image (same size; RGB = normal, OpenGL convention), when the renderer produced one. */
  normal;
  /** Decal masks by layer name (one byte per pixel, 1 = the decal shows), when the procedural pass placed decals. */
  decals;
  /** Per decal: shape pixels in the frame and those that landed on the target part. */
  decalStats;
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
    for (let p2 = 0; p2 < index.length; p2++) {
      const i = p2 * 4, a = this.d[i + 3];
      if (!a) continue;
      const k = (this.d[i] << 24 | this.d[i + 1] << 16 | this.d[i + 2] << 8 | a) >>> 0;
      let n = key.get(k);
      if (n === void 0) {
        n = palette.length;
        key.set(k, n);
        palette.push(toHex(this.d[i], this.d[i + 1], this.d[i + 2]));
        alphas.push(a);
      }
      index[p2] = n + 1;
    }
    return { palette, alphas, index };
  }
  /** Number of pixels that differ (any channel) from another grid of the same size. */
  diffCount(o) {
    if (o.w !== this.w || o.h !== this.h) return Math.max(this.w * this.h, o.w * o.h);
    let n = 0;
    for (let p2 = 0; p2 < this.w * this.h; p2++) {
      const i = p2 * 4;
      if (this.d[i] !== o.d[i] || this.d[i + 1] !== o.d[i + 1] || this.d[i + 2] !== o.d[i + 2] || this.d[i + 3] !== o.d[i + 3]) n++;
    }
    return n;
  }
};

// ../artgen-primitives/src/lib/png.ts
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
  const out = new Uint8Array(parts.reduce((n, p2) => n + p2.length, 0));
  let o = 0;
  for (const p2 of parts) {
    out.set(p2, o);
    o += p2.length;
  }
  return out;
}
function decodePNG(bytes) {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) throw new Error("not a PNG");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  for (let o = 8; o < bytes.length; ) {
    const len = dv.getUint32(o), t = String.fromCharCode(...bytes.subarray(o + 4, o + 8)), data = bytes.subarray(o + 8, o + 8 + len);
    if (t === "IHDR") {
      w = dv.getUint32(o + 8);
      h = dv.getUint32(o + 12);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (t === "PLTE") plte = data;
    else if (t === "tRNS") trns = data;
    else if (t === "IDAT") idat.push(data);
    else if (t === "IEND") break;
    o += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG: depth ${depth}, interlace ${interlace}`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch) throw new Error(`unsupported PNG colour type ${type}`);
  const z = new Uint8Array(idat.reduce((n, p2) => n + p2.length, 0));
  let zo = 0;
  for (const p2 of idat) {
    z.set(p2, zo);
    zo += p2.length;
  }
  const raw = unzlibSync(z), stride = w * ch, px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? row[x - ch] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = y && x >= ch ? px[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += a + b >> 1;
      else if (f === 4) {
        const p2 = a + b - c, pa = Math.abs(p2 - a), pb = Math.abs(p2 - b), pc = Math.abs(p2 - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[x] = v & 255;
    }
  }
  const g = new Grid2(w, h);
  for (let p2 = 0; p2 < w * h; p2++) {
    const s = p2 * ch, i = p2 * 4;
    if (type === 6) g.d.set(px.subarray(s, s + 4), i);
    else if (type === 2) g.d.set([px[s], px[s + 1], px[s + 2], 255], i);
    else if (type === 0) g.d.set([px[s], px[s], px[s], 255], i);
    else if (type === 4) g.d.set([px[s], px[s], px[s], px[s + 1]], i);
    else {
      const k = px[s];
      if (!plte) throw new Error("palette PNG without PLTE");
      g.d.set([plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], trns && k < trns.length ? trns[k] : 255], i);
    }
  }
  return g;
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

// ../artgen-primitives/src/lib/post.ts
var N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
var N8 = [...N4, [1, 1], [-1, -1], [1, -1], [-1, 1]];
var BAYER = {
  bayer2: [[0, 2], [3, 1]].map((r) => r.map((v) => (v + 0.5) / 4)),
  bayer4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16))
};
function quantize(g, pal, { alphaCut = 128, dither = "none" } = {}) {
  const P = pal.map(parseColor), out = new Grid2(g.w, g.h), m = BAYER[dither];
  for (let i = 0; i < g.w * g.h; i++) {
    const a = g.d[i * 4 + 3];
    if (a < alphaCut) continue;
    const r = g.d[i * 4], gg = g.d[i * 4 + 1], b = g.d[i * 4 + 2];
    let best = 0, bd = 1e9, second = 0, sd = 1e9;
    for (let k2 = 0; k2 < P.length; k2++) {
      const d = dist2(P[k2], r, gg, b);
      if (d < bd) {
        second = best;
        sd = bd;
        bd = d;
        best = k2;
      } else if (d < sd) {
        sd = d;
        second = k2;
      }
    }
    let k = best;
    if (m && P.length > 1) {
      const x = i % g.w, y = i / g.w | 0, t = Math.sqrt(bd) / (Math.sqrt(bd) + Math.sqrt(sd) || 1);
      if (t > m[y % m.length][x % m.length]) k = second;
    }
    out.d.set([P[k][0], P[k][1], P[k][2], 255], i * 4);
  }
  return out;
}

// ../artgen-primitives/src/lib/svg.ts
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

// ../artgen-mapgen/src/workflow.ts
var workflow_exports = {};
__export(workflow_exports, {
  SUBJECTS: () => SUBJECTS,
  blocking: () => blocking,
  checkSource: () => checkSource,
  sizeOf: () => sizeOf
});
var at2 = (i) => `${i.path || "(file)"}: ${i.message}`;
var formatChecks = (errors) => errors.length ? errors.map((e) => ({ id: "format", status: "fail", detail: at2(e) })) : [{ id: "format", status: "pass", detail: "ok" }];
function symbolCheck(used, allowed) {
  if (!allowed?.length) return [];
  const bad = [...new Set(used.filter((k) => !allowed.includes(k)))];
  return bad.length ? [{ id: "symbols", status: "flag", detail: `not in the map direction's symbol set: ${bad.join(", ")}` }] : [{ id: "symbols", status: "pass", detail: "all in the map direction's symbol set" }];
}
function lintChecks(found) {
  return found.length ? found.map((f) => ({ id: f.rule ? `lint:${f.rule}` : "lint", status: f.severity === "error" ? "fail" : "flag", detail: at2(f) })) : [{ id: "lint", status: "pass", detail: "no findings" }];
}
function underlayCheck(raw, errors, exists) {
  const u = raw?.underlay;
  if (!exists || !u || typeof u.map !== "string" || errors.some((e) => e.path.startsWith("underlay"))) return [];
  return [exists(u.map) ? { id: "underlay", status: "pass", detail: u.map } : { id: "underlay", status: "fail", detail: `underlay.map: no such map file ${u.map}` }];
}
var size = (s) => `${s.cols}x${s.rows}`;
var scaleOf = (s) => `${s.scale.perCell} ${s.scale.unit} a cell`;
var mustOf = (checks) => {
  const m = checks.filter((c) => c.id.startsWith("require:")).map((c) => ({ text: c.detail, met: c.status === "pass" }));
  return m.length ? m : void 0;
};
var verdict = (checks) => {
  const f = checks.filter((c) => c.status === "fail").length, w = checks.filter((c) => c.status === "flag").length;
  return f ? `${f} failing${w ? `, ${w} warnings` : ""}` : w ? `ok, ${w} warnings` : "ok";
};
var mapSubject = {
  kind: "map",
  dir: "maps",
  file: "map.json",
  parse: (raw) => parseMap(raw),
  check(raw, o = {}) {
    const { errors } = checkMap(raw), out = formatChecks(errors);
    if (errors.length) return out;
    const spec = parseMap(raw);
    out.push(...checkRequirements(spec).map((r) => ({ id: `require:${r.id}`, status: r.met ? "pass" : "fail", detail: r.text })));
    return [...out, ...symbolCheck(spec.overlay.symbols.map((s) => s.kind), o.symbols)];
  },
  sheet: (m, checks) => ({
    title: `${m.id} \u2014 terrain map`,
    subject: `map:${m.id}`,
    rows: [
      { label: "Title", value: m.title ?? "-" },
      { label: "Size", value: `${size(m)} cells, ${scaleOf(m)}` },
      { label: "Preset", value: m.preset },
      { label: "Grid", value: m.grid.type },
      { label: "Seed", value: String(m.seed) },
      { label: "Contents", value: `${m.edits.length} edits, ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols` },
      { label: "Checks", value: verdict(checks) }
    ],
    must: mustOf(checks)
  })
};
var dungeonSubject = {
  kind: "dungeon",
  dir: "dungeons",
  file: "dungeon.json",
  parse: (raw) => parseDungeon(raw),
  check(raw, o = {}) {
    const { errors } = checkDungeon(raw), out = formatChecks(errors);
    if (!errors.length) {
      const spec = parseDungeon(raw);
      out.push(...lintChecks(lintDungeon(spec)), ...symbolCheck(spec.overlay.symbols.map((s) => s.kind), o.symbols));
    }
    return [...out, ...underlayCheck(raw, errors, o.exists)];
  },
  sheet: (d, checks) => ({
    title: `${d.id} \u2014 dungeon`,
    subject: `dungeon:${d.id}`,
    rows: [
      { label: "Title", value: d.title ?? "-" },
      { label: "Size", value: `${size(d)} cells, ${scaleOf(d)}` },
      { label: "Seed", value: String(d.seed) },
      { label: "Layout", value: `${d.rooms.length} rooms, ${d.corridors.length} corridors` },
      { label: "Contents", value: `${d.overlay.labels.length} labels, ${d.overlay.symbols.length} symbols` },
      { label: "Checks", value: verdict(checks) }
    ]
  })
};
var settlementSubject = {
  kind: "settlement",
  dir: "settlements",
  file: "settlement.json",
  parse: (raw) => parseSettlement(raw),
  check(raw, o = {}) {
    const { errors } = checkSettlement(raw), out = formatChecks(errors);
    if (!errors.length) {
      const spec = parseSettlement(raw);
      out.push(...lintChecks(lintSettlement(spec)), ...symbolCheck(spec.overlay.symbols.map((s) => s.kind), o.symbols));
    }
    return [...out, ...underlayCheck(raw, errors, o.exists)];
  },
  sheet: (s, checks) => ({
    title: `${s.id} \u2014 ${s.kind}`,
    subject: `settlement:${s.id}`,
    rows: [
      { label: "Title", value: s.title ?? "-" },
      { label: "Kind", value: s.kind },
      { label: "Size", value: `${size(s)} cells, ${scaleOf(s)}` },
      { label: "Seed", value: String(s.seed) },
      { label: "Buildings", value: `${s.buildings.length}, ${s.buildings.filter((b) => b.floors?.length).length} with floor plans` },
      { label: "Site", value: `${s.roads.length} roads, ${s.walls.length} walls, ${s.water.length} water, ${s.trees.length} trees` },
      { label: "Contents", value: `${s.overlay.labels.length} labels, ${s.overlay.symbols.length} symbols` },
      { label: "Checks", value: verdict(checks) }
    ]
  })
};
var SUBJECTS = { map: mapSubject, dungeon: dungeonSubject, settlement: settlementSubject };
function checkSource(kind, text2, o = {}) {
  let raw;
  try {
    raw = JSON.parse(text2);
  } catch (e) {
    return [{ id: "format", status: "fail", detail: `(file): not JSON: ${e.message}` }];
  }
  return SUBJECTS[kind].check(raw, o);
}
function sizeOf(text2) {
  try {
    const r = JSON.parse(text2);
    return Number.isFinite(r?.cols) && Number.isFinite(r?.rows) ? { cols: r.cols, rows: r.rows } : null;
  } catch {
    return null;
  }
}
var blocking = (checks) => checks.filter((c) => c.status === "fail");

// ../artgen-mapgen/src/direction.ts
var direction_exports = {};
__export(direction_exports, {
  DEFAULT_THEME: () => DEFAULT_THEME,
  DIRECTION_FILE: () => DIRECTION_FILE,
  KINDS: () => KINDS,
  SYMBOL_NAMES: () => SYMBOL_NAMES,
  THEME_NAMES: () => THEME_NAMES,
  checkMapDirection: () => checkMapDirection,
  directionRef: () => directionRef,
  editMapDirection: () => editMapDirection,
  formatMapDirection: () => formatMapDirection,
  lockMapDirection: () => lockMapDirection,
  lockedMapDirection: () => lockedMapDirection,
  newMapDirection: () => newMapDirection,
  parseMapDirection: () => parseMapDirection,
  parseSymbolsFlag: () => parseSymbolsFlag,
  parseThemeFlag: () => parseThemeFlag,
  symbolsFor: () => symbolsFor,
  themeFor: () => themeFor
});
var DIRECTION_FILE = "map-direction.json";
var KINDS = ["map", "dungeon", "settlement"];
var THEME_NAMES = { map: THEMES, dungeon: ["bw"], settlement: THEMES2 };
var SYMBOL_NAMES = { map: SYMBOL_KINDS, dungeon: SYMBOL_KINDS2, settlement: SYMBOL_KINDS3 };
var DEFAULT_THEME = { map: "color", dungeon: "bw", settlement: "color" };
var newMapDirection = () => ({ id: "maps", version: 0, status: "draft", themes: {}, symbols: {} });
function checkMapDirection(raw) {
  const e = [], r = raw;
  if (!r || typeof r !== "object" || Array.isArray(r)) return ["(file): a JSON object"];
  if (typeof r.id !== "string" || !r.id) e.push("id: a non-empty string");
  if (!Number.isInteger(r.version) || r.version < 0) e.push("version: a whole number, 0 or more");
  if (r.status !== "draft" && r.status !== "locked") e.push("status: draft or locked");
  if (r.status === "locked" && !(r.version >= 1)) e.push("version: 1 or more when locked");
  for (const [key, names] of [["themes", THEME_NAMES], ["symbols", SYMBOL_NAMES]]) {
    const o = r[key];
    if (o === void 0) continue;
    if (!o || typeof o !== "object" || Array.isArray(o)) {
      e.push(`${key}: an object keyed by ${KINDS.join(", ")}`);
      continue;
    }
    for (const [k, v] of Object.entries(o)) {
      if (!KINDS.includes(k)) {
        e.push(`${key}.${k}: not a kind (${KINDS.join(", ")})`);
        continue;
      }
      const have = names[k];
      if (key === "themes") {
        if (typeof v !== "string" || !have.includes(v)) e.push(`themes.${k}: one of ${have.join(", ")}`);
      } else if (!Array.isArray(v) || v.some((s) => typeof s !== "string" || !have.includes(s))) e.push(`symbols.${k}: a list of ${k} symbol kinds${Array.isArray(v) ? ` (not ${v.filter((s) => !have.includes(s)).join(", ")})` : ""}`);
    }
  }
  if (r.note !== void 0 && typeof r.note !== "string") e.push("note: a string");
  return e;
}
function parseMapDirection(raw) {
  const e = checkMapDirection(raw);
  if (e.length) throw new Error(`invalid map direction:
  ${e.join("\n  ")}`);
  const r = raw;
  return { id: r.id, version: r.version, status: r.status, themes: { ...r.themes }, symbols: Object.fromEntries(Object.entries(r.symbols ?? {}).map(([k, v]) => [k, [...v]])), ...r.note && { note: r.note } };
}
var lockedMapDirection = (d) => d && d.status === "locked" ? d : null;
var directionRef = (d) => {
  const l = lockedMapDirection(d);
  return l ? { id: l.id, version: l.version } : void 0;
};
var themeFor = (d, kind) => lockedMapDirection(d)?.themes[kind] ?? DEFAULT_THEME[kind];
var symbolsFor = (d, kind) => {
  const s = lockedMapDirection(d)?.symbols[kind];
  return s?.length ? s : void 0;
};
function parseThemeFlag(v) {
  const out = {};
  for (const part of v.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [k, t] = part.split("=");
    if (!KINDS.includes(k) || !t) throw new Error(`--theme: kind=theme pairs, e.g. map=bw,settlement=color (kinds: ${KINDS.join(", ")})`);
    if (!THEME_NAMES[k].includes(t)) throw new Error(`--theme ${k}: one of ${THEME_NAMES[k].join(", ")}`);
    out[k] = t;
  }
  return out;
}
function parseSymbolsFlag(v) {
  const out = {};
  for (const part of v.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [k, list6 = ""] = part.split("=");
    if (!KINDS.includes(k)) throw new Error(`--symbols: kind=symbol,symbol (kinds: ${KINDS.join(", ")})`);
    const names = list6.split(",").map((s) => s.trim()).filter(Boolean), bad = names.filter((n) => !SYMBOL_NAMES[k].includes(n));
    if (bad.length) throw new Error(`--symbols ${k}: no such symbol ${bad.join(", ")} (have: ${SYMBOL_NAMES[k].join(", ")})`);
    out[k] = names;
  }
  return out;
}
function editMapDirection(d, o) {
  const symbols4 = { ...d.symbols, ...o.symbols };
  for (const k of KINDS) if (symbols4[k] && !symbols4[k].length) delete symbols4[k];
  return { ...d, status: "draft", themes: { ...d.themes, ...o.themes }, symbols: symbols4, ...o.note !== void 0 && (o.note ? { note: o.note } : {}) };
}
var lockMapDirection = (d) => ({ ...d, status: "locked", version: d.version + 1 });
function formatMapDirection(d) {
  return JSON.stringify({ id: d.id, version: d.version, status: d.status, themes: d.themes, symbols: d.symbols, ...d.note && { note: d.note } }, null, 2) + "\n";
}

// ../artgen-workflow/src/ledger.ts
var sourceHash = (src) => hashString(src.replace(/\r\n/g, "\n"));
function imageTokens(w, h) {
  const s = Math.min(1, 1568 / Math.max(w, h));
  return Math.ceil(w * s * (h * s) / 750);
}
function formatLedgerLine(e) {
  if (!e.ts || !e.type || !e.asset) throw new Error("ledger entry needs ts, type and asset");
  return JSON.stringify(e);
}
function parseLedger(text2) {
  const out = [];
  text2.split("\n").forEach((l, i) => {
    if (!l.trim()) return;
    try {
      out.push(JSON.parse(l));
    } catch {
      throw new Error(`ledger line ${i + 1}: invalid JSON`);
    }
  });
  return out;
}

// ../artgen-workflow/src/versions.ts
var versionNumber = (name) => {
  const m = /^v(\d+)$/.exec(name);
  return m && +m[1] > 0 ? +m[1] : null;
};
var sortVersions = (names) => names.filter((n) => versionNumber(n) !== null).sort((a, b) => versionNumber(a) - versionNumber(b));
var nextVersion = (names) => `v${Math.max(0, ...names.map(versionNumber).filter((n) => n !== null)) + 1}`;
var versionFile = (stem, version) => `${stem}.${version}.json`;
function versionOfFile(stem, file) {
  const m = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(v\\d+)\\.json$`).exec(file);
  return m && versionNumber(m[1]) !== null ? m[1] : null;
}
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var byId = (a, b) => [a, b].every((xs) => {
  const ids = xs.map((x) => isObj(x) && typeof x.id === "string" ? x.id : null);
  return ids.every((id2) => id2 !== null) && new Set(ids).size === ids.length;
});
function diffJson(a, b) {
  const out = [];
  const walk = (x, y, path) => {
    if (isObj(x) && isObj(y)) {
      for (const k of /* @__PURE__ */ new Set([...Object.keys(x), ...Object.keys(y)])) {
        const p2 = path ? `${path}.${k}` : k;
        if (!(k in y)) out.push({ path: p2, op: "removed", from: x[k] });
        else if (!(k in x)) out.push({ path: p2, op: "added", to: y[k] });
        else walk(x[k], y[k], p2);
      }
    } else if (Array.isArray(x) && Array.isArray(y)) {
      if (byId(x, y)) {
        const ix = new Map(x.map((v) => [v.id, v])), iy = new Map(y.map((v) => [v.id, v]));
        for (const id2 of /* @__PURE__ */ new Set([...ix.keys(), ...iy.keys()])) {
          const p2 = `${path}[id=${id2}]`;
          if (!iy.has(id2)) out.push({ path: p2, op: "removed", from: ix.get(id2) });
          else if (!ix.has(id2)) out.push({ path: p2, op: "added", to: iy.get(id2) });
          else walk(ix.get(id2), iy.get(id2), p2);
        }
      } else for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const p2 = `${path}[${i}]`;
        if (i >= y.length) out.push({ path: p2, op: "removed", from: x[i] });
        else if (i >= x.length) out.push({ path: p2, op: "added", to: y[i] });
        else walk(x[i], y[i], p2);
      }
    } else if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ path, op: "changed", from: x, to: y });
  };
  walk(a, b, "");
  return out.sort((p2, q) => p2.path < q.path ? -1 : p2.path > q.path ? 1 : 0);
}
function diffLines(changes, max2 = 60) {
  const show5 = (v) => {
    const s = JSON.stringify(v) ?? "undefined";
    return s.length > max2 ? `${s.slice(0, max2 - 3)}...` : s;
  };
  return changes.map((c) => c.op === "added" ? `+ ${c.path || "(file)"}: ${show5(c.to)}` : c.op === "removed" ? `- ${c.path || "(file)"}: ${show5(c.from)}` : `~ ${c.path || "(file)"}: ${show5(c.from)} -> ${show5(c.to)}`);
}

// ../artgen-workflow/src/subject.ts
var SUBJECT_KINDS = ["map", "dungeon", "settlement"];
var subjectKey = (kind, id2) => `${kind}:${id2}`;
function parseSubjectKey(key) {
  const m = /^(map|dungeon|settlement):([\w-]+)$/.exec(key);
  return m ? { kind: m[1], id: m[2] } : null;
}
var stemOf = (s) => s.file.replace(/\.json$/, "");

// ../artgen-workflow/src/status.ts
var lastIndex = (xs, f) => {
  for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i;
  return -1;
};
function subjectStatus({ entries, key, workingHash, direction: direction2 }) {
  const iV = lastIndex(entries, (e) => e.type === "version");
  if (iV < 0) {
    const k = parseSubjectKey(key ?? entries[0]?.asset ?? "");
    return { status: "in-pipeline", why: `no version recorded yet${k ? `: artgen ${k.kind} version ${k.id}` : ""}` };
  }
  const V4 = entries[iV], v = String(V4.version);
  const iApprove = lastIndex(entries, (e) => e.type === "approve" && e.by === "user" && e.version === v);
  const iFeedback = lastIndex(entries, (e) => e.type === "feedback" && e.by === "user");
  const approval = iApprove >= 0 ? entries[iApprove] : void 0, was = V4.sourceHash ?? approval?.sourceHash;
  if (iFeedback > iV && iFeedback > iApprove) return { status: "revision", version: v, approval, why: `feedback on ${String(entries[iFeedback].on ?? v)}: rework, then record ${nextVersion([v])}` };
  const edited = workingHash !== void 0 && was !== void 0 && workingHash !== was;
  if (approval) {
    if (edited) return { status: "stale", version: v, approval, why: `edited since approved ${v}: record a version` };
    const d = approval.direction;
    if (direction2 && (d?.id !== direction2.id || d?.version !== direction2.version)) return { status: "stale", version: v, approval, why: `${d ? `approved under map direction v${d.version}` : "approved with no map direction"}, now v${direction2.version}: review and approve again` };
    return { status: "approved", version: v, approval, why: `approved ${v}` };
  }
  if (edited) return { status: "in-pipeline", version: v, why: `edited since ${v}: record a version` };
  return { status: "final", version: v, why: `${v} waiting for the user` };
}

// ../artgen-workflow/src/metrics.ts
var round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
var num2 = (v) => typeof v === "number" && Number.isFinite(v) ? v : 0;
function latestScores(entries) {
  const latest = /* @__PURE__ */ new Map();
  for (const e of entries) if (e.type === "score" && !e.blind && e.version) latest.set(e.version, e);
  return [...latest.values()];
}
function metricsFor(generator, keys, byKey) {
  const art = generator === "art";
  let started = 0, final = 0, approved = 0, untouched = 0, feedback = 0, imageTokens2 = 0, outTokens = 0, wallMs = 0, passes = 0;
  const checkFailures = {}, gates = {}, toGame = [];
  for (const key of keys) {
    const es = byKey.get(key) ?? [], scores = latestScores(es);
    const approves = es.some((e) => e.type === "approve"), fb = es.filter((e) => e.type === "feedback" && e.by !== "agent" || art && e.type === "stage" && e.verdict === "reject" && e.by === "user").length;
    if (art) {
      for (const e of es) if (e.type === "stage" && (e.verdict === "approve" || e.verdict === "reject") && typeof e.stage === "string") {
        const g = gates[e.stage] ??= { approved: 0, rejected: 0 };
        if (e.verdict === "approve") g.approved++;
        else g.rejected++;
      }
      const first = Date.parse(es[0]?.ts ?? ""), exp = es.find((e) => e.type === "export"), at4 = Date.parse(exp?.ts ?? "");
      if (exp && Number.isFinite(first) && Number.isFinite(at4)) toGame.push(Math.max(0, at4 - first) / 6e4);
    }
    if (art ? scores.length : es.some((e) => e.type === "version")) started++;
    if (approves || (art ? es.some((e) => e.type === "status" && e.status === "final") : subjectStatus({ entries: es }).status === "final")) final++;
    feedback += fb;
    if (approves) {
      approved++;
      if (!fb) untouched++;
      passes += art ? scores.length : es.filter((e) => e.type === "version").length;
    }
    for (const e of es) {
      if (e.type === "review") imageTokens2 += num2(e.imageTokens);
      if (e.type === "review" || e.type === "score" || e.type === "render") {
        for (const c of e.conformance?.checks ?? []) if (c.status === "fail") checkFailures[c.id] = (checkFailures[c.id] ?? 0) + 1;
      }
      if (e.type !== "score") wallMs += num2(e.wallMs);
    }
    for (const e of scores) {
      const tk = e.tokens ?? {};
      outTokens += num2(tk.out ?? tk.edit);
      wallMs += num2(e.wallMs);
    }
  }
  return {
    subjects: keys.length,
    started,
    final,
    approved,
    ...approved && { passesPerApproved: round(passes / approved) },
    firstPassApproval: { approved, untouched, ...approved && { rate: round(untouched / approved) } },
    feedback,
    imageTokens: imageTokens2,
    outTokens,
    wallMinutes: round(wallMs / 6e4, 1),
    checkFailures,
    ...Object.keys(gates).length && { gates },
    ...toGame.length && { firstInGameMinutes: round([...toGame].sort((a, b) => a - b)[toGame.length >> 1], 1) }
  };
}
function generatorMetrics(ledger, subjects) {
  const byKey = /* @__PURE__ */ new Map();
  for (const e of ledger) {
    const es = byKey.get(e.asset);
    if (es) es.push(e);
    else byKey.set(e.asset, [e]);
  }
  const gens = /* @__PURE__ */ new Map();
  for (const s of subjects) {
    const ks = gens.get(s.generator);
    if (ks) ks.push(s.key);
    else gens.set(s.generator, [s.key]);
  }
  return Object.fromEntries([...gens].map(([g, keys]) => [g, metricsFor(g, keys, byKey)]));
}

// ../artgen-primitives/src/lib/font.ts
var GLYPHS = {
  "0": "75557",
  "1": "26227",
  "2": "71747",
  "3": "71317",
  "4": "55711",
  "5": "74717",
  "6": "74757",
  "7": "71122",
  "8": "75757",
  "9": "75717",
  A: "25755",
  B: "65656",
  C: "34443",
  D: "65556",
  E: "74647",
  F: "74644",
  G: "34553",
  H: "55755",
  I: "72227",
  J: "11152",
  K: "55655",
  L: "44447",
  M: "57755",
  N: "65555",
  O: "25552",
  P: "65644",
  Q: "25563",
  R: "65655",
  S: "34216",
  T: "72222",
  U: "55557",
  V: "55552",
  W: "55775",
  X: "55255",
  Y: "55222",
  Z: "71247",
  " ": "00000",
  ".": "00002",
  ",": "00024",
  ":": "02020",
  ";": "02024",
  "-": "00700",
  "+": "02720",
  _: "00007",
  "/": "11244",
  "|": "22222",
  "(": "12221",
  ")": "42224",
  "[": "64446",
  "]": "31113",
  "%": "51245",
  "=": "07070",
  "#": "57575",
  "?": "71302",
  "!": "22202",
  "'": "22000",
  '"': "55000",
  "<": "12421",
  ">": "42124",
  "*": "52725",
  "@": "75747",
  "&": "25257",
  $: "36763",
  "^": "25000",
  "~": "03600"
};
var GLYPH_W = 3;
var GLYPH_H = 5;
function drawText(g, x, y, text2, color, scale = 1) {
  let cx = x;
  for (const ch of text2.toUpperCase()) {
    const rows2 = GLYPHS[ch] ?? GLYPHS["?"];
    for (let r = 0; r < GLYPH_H; r++) {
      const bits2 = +rows2[r];
      for (let c = 0; c < GLYPH_W; c++) if (bits2 & 4 >> c) g.fill(cx + c * scale, y + r * scale, scale, scale, color);
    }
    cx += (GLYPH_W + 1) * scale;
  }
}

// ../artgen-workflow/src/sheet.ts
function dataSheetMarkdown(s) {
  const out = [`# ${s.title}`, "", `Subject: \`${s.subject}\``, ""];
  if (s.rows.length) out.push("| | |", "|---|---|", ...s.rows.map((r) => `| ${r.label} | ${r.value.replace(/\|/g, "\\|")} |`), "");
  if (s.must?.length) out.push("## Must hold", "", ...s.must.map((m) => `- ${m.met === void 0 ? "" : m.met ? "[x] " : "[ ] "}${m.text}`), "");
  if (s.swatches?.length) out.push("## Palette", "", s.swatches.map((c) => `\`${c}\``).join(" "), "");
  if (s.refs?.length) out.push("## References", "", ...s.refs.map((r) => `- ${r}`), "");
  if (s.notes?.trim()) out.push("## Notes", "", s.notes.trim(), "");
  return out.join("\n").replace(/\n+$/, "\n");
}
var PAD = 12;
var TXT = 2;
var CH = (3 + 1) * TXT;
var LINE = GLYPH_H * TXT + 6;
var BG = "#16161c";
var FG = "#dddddd";
var DIM = "#8c8ca0";
var TITLE = "#ffffff";
var OK = "#7ad08a";
var BAD = "#e07a7a";
var MAX_EDGE = 1568;
var SHEET_W = 560;
var THUMB = 112;
var plain = (s) => s.replace(/×/g, "x").replace(/[–—−]/g, "-").replace(/…/g, "...").replace(/→/g, "->").replace(/[^\x20-\x7e]/g, "?");
function wrap(text2, n) {
  const out = [];
  for (const para of plain(text2).split("\n")) {
    let line2 = "";
    for (let w of para.split(/\s+/).filter(Boolean)) {
      while (w.length > n) {
        if (line2) {
          out.push(line2);
          line2 = "";
        }
        out.push(w.slice(0, n));
        w = w.slice(n);
      }
      if (!line2) line2 = w;
      else if (line2.length + 1 + w.length <= n) line2 += ` ${w}`;
      else {
        out.push(line2);
        line2 = w;
      }
    }
    out.push(line2);
  }
  return out;
}
function fitGrid(g, maxW, maxH) {
  const k = Math.min(1, maxW / g.w, maxH / g.h);
  if (k >= 1) return g;
  const w = Math.max(1, Math.floor(g.w * k)), h = Math.max(1, Math.floor(g.h * k)), out = new Grid2(w, h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * g.h / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * g.h / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * g.w / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * g.w / w));
      let r = 0, gr = 0, b = 0, a = 0, n = 0;
      for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
        const s = (j * g.w + i) * 4, al = g.d[s + 3];
        r += g.d[s] * al;
        gr += g.d[s + 1] * al;
        b += g.d[s + 2] * al;
        a += al;
        n++;
      }
      const o = (y * w + x) * 4;
      if (a) {
        out.d[o] = r / a;
        out.d[o + 1] = gr / a;
        out.d[o + 2] = b / a;
        out.d[o + 3] = a / n;
      }
    }
  }
  return out;
}
function blocks(s, width, maxH, o) {
  const cols = Math.floor((width - PAD * 2) / CH), all = [];
  const text2 = (t, color, indent = 0) => ({ h: LINE, draw: (g, x, y) => drawText(g, x + indent * CH, y, t, color, TXT) });
  const head = (t) => ({ h: LINE + 4, draw: (g, x, y) => drawText(g, x, y + 4, t, DIM, TXT) });
  if (o.title) for (const l of wrap(s.title, cols)) all.push(text2(l, TITLE));
  if (o.title) all.push(text2(plain(s.subject), DIM));
  const lw = Math.min(14, Math.max(0, ...s.rows.map((r) => r.label.length)) + 1);
  for (const r of s.rows) wrap(r.value, Math.max(8, cols - lw)).forEach((l, i) => all.push({ h: LINE, draw: (g, x, y) => {
    if (!i) drawText(g, x, y, plain(r.label).slice(0, lw - 1), DIM, TXT);
    drawText(g, x + lw * CH, y, l, FG, TXT);
  } }));
  if (s.must?.length) {
    all.push(head("MUST HOLD"));
    for (const m of s.must) wrap(m.text, cols - 4).forEach((l, i) => all.push({ h: LINE, draw: (g, x, y) => {
      if (!i) drawText(g, x, y, m.met === void 0 ? " - " : m.met ? "[X]" : "[ ]", m.met === false ? BAD : m.met ? OK : DIM, TXT);
      drawText(g, x + 4 * CH, y, l, m.met === false ? BAD : FG, TXT);
    } }));
  }
  if (s.swatches?.length) {
    const per = Math.max(1, Math.floor((width - PAD * 2) / 24)), n = Math.ceil(s.swatches.length / per);
    all.push(head("PALETTE"), { h: n * 24, draw: (g, x, y) => s.swatches.forEach((c, i) => g.fill(x + i % per * 24, y + Math.floor(i / per) * 24, 22, 22, c)) });
  }
  if (s.refs?.length) {
    all.push(head("REFERENCES"));
    for (const r of s.refs) for (const l of wrap(r, cols)) all.push(text2(l, FG));
  }
  if (o.refs?.length) {
    if (!s.refs?.length) all.push(head("REFERENCES"));
    const thumbs = o.refs.map((r) => ({ label: r.label, grid: fitGrid(r.grid, THUMB, THUMB) })), per = Math.max(1, Math.floor((width - PAD * 2 + 8) / (THUMB + 8)));
    for (let i = 0; i < thumbs.length; i += per) {
      const row = thumbs.slice(i, i + per);
      all.push({ h: THUMB + LINE, draw: (g, x, y) => row.forEach((t, k) => {
        const tx = x + k * (THUMB + 8);
        g.fill(tx, y, THUMB, THUMB, "#2a2a33");
        g.over(t.grid, tx + (THUMB - t.grid.w >> 1), y + (THUMB - t.grid.h >> 1));
        drawText(g, tx, y + THUMB + 3, plain(t.label).slice(0, Math.floor(THUMB / CH)), FG, TXT);
      }) });
    }
  }
  if (s.notes?.trim()) {
    all.push(head("NOTES"));
    const ls = wrap(s.notes.trim(), cols);
    for (const l of ls.slice(0, 8)) all.push(text2(l, FG));
    if (ls.length > 8) all.push(text2("...", DIM));
  }
  let used = PAD * 2, keep = 0;
  while (keep < all.length && used + all[keep].h <= maxH - LINE) used += all[keep++].h;
  return keep === all.length ? all : [...all.slice(0, keep), text2("...", DIM)];
}
var sumH = (bs) => bs.reduce((n, b) => n + b.h, 0);
function renderDataSheet(s, o = {}) {
  const max2 = Math.min(o.maxEdge ?? MAX_EDGE, MAX_EDGE), w = Math.min(SHEET_W, max2), bs = blocks(s, w, max2, { title: true, refs: o.refs }), h = sumH(bs) + PAD * 2;
  const g = new Grid2(w, h).fill(0, 0, w, h, BG);
  let y = PAD;
  for (const b of bs) {
    b.draw(g, PAD, y);
    y += b.h;
  }
  return g;
}
function subjectReviewSheet(o) {
  const max2 = Math.min(o.maxEdge ?? MAX_EDGE, MAX_EDGE), top = PAD + LINE + PAD / 2;
  const refRow = o.refs?.length ? blocks({ title: "", subject: "", rows: [] }, max2, max2 / 3, { title: false, refs: o.refs }) : [];
  const refsH = sumH(refRow), sw = Math.min(SHEET_W, Math.floor(max2 / 3)), room3 = max2 - top - (refsH ? refsH + PAD : 0) - PAD;
  const side = blocks(o.sheet, sw, room3 + PAD * 2, { title: false });
  const render4 = fitGrid(o.render, max2 - sw - PAD * 3, room3);
  const W = PAD * 3 + render4.w + sw, bodyH = Math.max(render4.h, sumH(side)), H = top + bodyH + (refsH ? refsH + PAD : 0) + PAD;
  const g = new Grid2(W, H).fill(0, 0, W, H, BG);
  drawText(g, PAD, PAD, plain(o.title).slice(0, Math.floor((W - PAD * 2) / CH)), TITLE, TXT);
  g.fill(PAD, top, render4.w, render4.h, "#ffffff");
  g.over(render4, PAD, top);
  let y = top;
  for (const b of side) {
    b.draw(g, PAD * 2 + render4.w, y);
    y += b.h;
  }
  y = top + bodyH + PAD;
  for (const b of refRow) {
    b.draw(g, PAD, y);
    y += b.h;
  }
  return g;
}

// ../artgen-workflow/src/brief.ts
function parseSubjectBrief(text2) {
  const t = text2.replace(/\r\n/g, "\n"), m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(t);
  const out = { refs: [], body: (m ? t.slice(m[0].length) : t).trim() };
  if (!m) return out;
  for (const line2 of m[1].split("\n")) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line2.trim());
    if (!kv) continue;
    const v = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (kv[1] === "title" && v) out.title = v;
    if (kv[1] === "refs") out.refs = v.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  return out;
}
function formatSubjectBrief(b) {
  const head = [...b.title ? [`title: ${b.title}`] : [], ...b.refs?.length ? [`refs: ${b.refs.join(", ")}`] : []];
  return `${head.length ? `---
${head.join("\n")}
---
` : ""}${b.body.trim()}
`;
}
function briefNotes(body2, n = 6, width = 60) {
  const lines2 = [];
  for (const para of body2.split("\n")) {
    let line2 = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (line2 && line2.length + 1 + w.length > width) {
        lines2.push(line2);
        line2 = w;
      } else line2 = line2 ? `${line2} ${w}` : w;
    }
    lines2.push(line2);
  }
  const kept = lines2.filter((l, i) => l || i > 0 && lines2[i - 1]);
  return kept.length > n ? `${kept.slice(0, n).join("\n").trimEnd()} ...` : kept.join("\n").trim();
}
var refOk = (r) => !!r && !r.startsWith("/") && !/^[A-Za-z]:/.test(r) && !r.split(/[\\/]/).includes("..");
function subjectDataSheet(base, o) {
  const head = [...o.version ? [{ label: "Version", value: o.version }] : [], { label: "Theme", value: `${o.theme}${o.directionVersion !== void 0 ? ` (map direction v${o.directionVersion})` : ""}` }];
  return {
    ...base,
    title: o.brief?.title ? `${base.title} - ${o.brief.title}` : base.title,
    rows: [...head, ...base.rows],
    ...o.brief?.refs.length && { refs: o.brief.refs },
    ...o.brief?.body && { notes: briefNotes(o.brief.body) }
  };
}

// ../artgen-workflow/src/decide.ts
var isApprovable = (s, workingHash) => !!s.version && (s.status === "final" || s.status === "stale" && s.approval?.sourceHash === workingHash);
function approvalEntry(s, o = {}) {
  const { status, version } = s.status;
  if (!isApprovable(s.status, s.workingHash) || !version) throw new Error(`${s.id} is ${status} (${s.status.why}): only a final ${s.kind} can be approved${status === "in-pipeline" && version ? ` \u2014 artgen ${s.kind} version ${s.id} first` : ""}`);
  const bad = s.checks.filter((c) => c.status === "fail");
  if (bad.length) throw new Error(`${s.id} ${version}: ${bad.length} check${bad.length === 1 ? "" : "s"} fail (${[...new Set(bad.map((c) => c.id))].join(", ")}) \u2014 fix them and record a new version, or give feedback instead`);
  const warnings = s.checks.filter((c) => c.status === "flag").map((c) => `${c.id}: ${c.detail}`);
  return {
    type: "approve",
    asset: s.key,
    version,
    sourceHash: s.workingHash,
    ...s.direction && { direction: s.direction },
    note: o.note ?? "",
    ...warnings.length && { warnings },
    by: "user",
    ...o.via && { via: o.via }
  };
}
function feedbackEntry(s, o) {
  if (!s.latest) throw new Error(`${s.id}: no version yet \u2014 feedback is on a version (artgen ${s.kind} version ${s.id})`);
  if (!o.note?.trim()) throw new Error('feedback: --note "<what the user asked for>" is required');
  if (o.region && o.region.length !== 4) throw new Error("--region: x,y,w,h");
  return { type: "feedback", asset: s.key, on: s.latest, note: o.note.trim(), ...o.region && { region: o.region }, by: "user", ...o.via && { via: o.via } };
}

// ../artgen-cli/src/map.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readdirSync, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, join as join3, relative, resolve as resolve2 } from "node:path";

// ../artgen-cli/src/node-svg.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { createRequire as createRequire2 } from "node:module";
import { join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
var require3 = createRequire2(import.meta.url);
function initNodeSvg() {
  const local = fileURLToPath(new URL("./resvg.wasm", import.meta.url));
  let file = local;
  if (!existsSync2(local)) {
    try {
      file = require3.resolve("@resvg/resvg-wasm/index_bg.wasm");
    } catch {
      throw new Error(`PNG output needs resvg.wasm next to this script (${local}) \u2014 copy it from artgen-dist maps/, or render --format svg`);
    }
  }
  return initSvg(readFileSync2(file));
}
var MAP_FONTS = ["AlegreyaSans-Regular.ttf", "AlegreyaSans-Bold.ttf", "AlegreyaSans-Italic.ttf"];
async function initNodeMapSvg() {
  await initNodeSvg();
  const local = fileURLToPath(new URL("./fonts/", import.meta.url)), dir = existsSync2(join2(local, MAP_FONTS[0])) ? local : fileURLToPath(new URL("../../artgen-core/assets/fonts/", import.meta.url));
  if (!MAP_FONTS.every((f) => existsSync2(join2(dir, f)))) {
    console.error(`note: no fonts/ next to this script (${local}); labels are left out of the PNG`);
    return;
  }
  setSvgFonts(MAP_FONTS.map((f) => new Uint8Array(readFileSync2(join2(dir, f)))), map_exports.FONT_FAMILY);
}

// ../artgen-cli/src/map.ts
var mapsDir = (p2) => join3(p2.art, "maps");
function mapFile(p2, ref) {
  if (typeof ref !== "string") return resolve2(ref.file);
  if (!/^[\w-]+$/.test(ref ?? "")) throw new Error(`map id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p2) throw new Error("no artgen project here: name the map file with --file <path>");
  return join3(mapsDir(p2), ref, "map.json");
}
var shown = (p2, f) => relative(p2?.root ?? process.cwd(), f);
var mapSummary = (m) => ({ id: m.id, preset: m.preset, size: `${m.cols}x${m.rows}`, ...m.title && { title: m.title }, edits: m.edits.length, labels: m.overlay.labels.length, symbols: m.overlay.symbols.length });
function listMaps(p2) {
  if (!existsSync3(mapsDir(p2))) return [];
  return readdirSync(mapsDir(p2), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync3(join3(mapsDir(p2), d.name, "map.json"))).map((d) => mapSummary(readMap(p2, d.name)));
}
function readMap(p2, ref) {
  const f = mapFile(p2, ref);
  if (!existsSync3(f)) throw new Error(typeof ref === "string" ? `no map ${ref} (${shown(p2, f)}) \u2014 artgen map new ${ref}` : `no map file ${shown(p2, f)} \u2014 artgen map new --file ${ref.file}`);
  return map_exports.parseMap(readJson(f));
}
function writeMap(p2, m, ref = m.id) {
  const spec = map_exports.parseMap(m), f = mapFile(p2, ref);
  writeJson(f, spec);
  return shown(p2, f);
}
function createMap(p2, id2, preset, over = {}, force = false, at4 = id2) {
  if (existsSync3(mapFile(p2, at4)) && !force) throw new Error(typeof at4 === "string" ? `map ${id2} already exists (edit it, or pick another id)` : `${shown(p2, mapFile(p2, at4))} already exists (edit it, or --force)`);
  const m = map_exports.newMap(id2, preset, over);
  return { file: writeMap(p2, m, at4), map: m };
}
function updateMap(p2, ref, change) {
  const m = readMap(p2, ref);
  change(m);
  writeMap(p2, m, ref);
  return m;
}
function checkMapFile(p2, ref) {
  const f = mapFile(p2, ref);
  let raw;
  try {
    raw = JSON.parse(readFileSync3(f, "utf8"));
  } catch (e) {
    const missing = e.code === "ENOENT";
    return { file: shown(p2, f), ok: false, errors: [{ path: "", message: missing ? `no such file: ${shown(p2, f)}` : `not JSON: ${e.message}` }], requirements: [], unmet: [] };
  }
  const { errors } = map_exports.checkMap(raw);
  if (errors.length) return { file: shown(p2, f), ok: false, errors, requirements: [], unmet: [] };
  const requirements = map_exports.checkRequirements(map_exports.parseMap(raw)), unmet = requirements.filter((r) => !r.met).map((r) => r.id);
  return { file: shown(p2, f), ok: !unmet.length, errors, requirements, unmet };
}
async function renderMapFiles(p2, ref, o = {}) {
  const m = readMap(p2, ref), field = map_exports.generateMap(m), id2 = typeof ref === "string" ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === "string" ? join3(mapsDir(p2), id2, "out") : dirname2(mapFile(p2, ref)));
  const formats2 = o.formats ?? ["svg", "png"], files = [];
  if (o.fit && o.ppu !== void 0) throw new Error("--fit and --ppu both set the scale: use one");
  const crop2 = clampCrop(o.crop ?? [0, 0, m.cols, m.rows], m.cols, m.rows), ppu = o.fit ? fitPpu(crop2[2], crop2[3], o.fit) : o.ppu ?? 40;
  const size2 = [Math.round(crop2[2] * ppu), Math.round(crop2[3] * ppu)], unit = o.fit?.unit ?? "px";
  const pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : void 0);
  if (formats2.includes("png")) await initNodeMapSvg();
  mkdirSync2(out, { recursive: true });
  for (const theme of o.themes ?? ["color"]) {
    const svg = map_exports.renderMapSvg(m, { theme, ppu, layers: o.layers, field, ...o.crop && { crop: crop2 }, unit, pageScale }), base = join3(out, `${id2}.${theme}`);
    if (formats2.includes("svg")) {
      writeFileSync2(`${base}.svg`, svg);
      files.push(`${base}.svg`);
    }
    if (formats2.includes("png")) {
      writeFileSync2(`${base}.png`, encodePNG(rasterizeSvg(svg, size2[0], size2[1])));
      files.push(`${base}.png`);
    }
  }
  return { files: files.map((f) => relative(process.cwd(), f)), terrains: map_exports.terrainsUsed(field), rivers: field.rivers.length, size: size2, crop: crop2, ppu, svg: svgSize(crop2, ppu, unit), pageScale: pageScale ?? null, unplaced: map_exports.mapLabelLayout(m, ppu, pageScale).unplaced };
}
function svgSize(crop2, ppu, unit) {
  const f = unit === "mm" ? 96 / 25.4 : 1, r = (v) => Math.round(v * ppu / f * 100) / 100;
  return { width: r(crop2[2]), height: r(crop2[3]), unit };
}
function numbers2(v, what, pairs2 = true) {
  const xs = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  if (!xs.length || xs.some((x) => !Number.isFinite(x)) || pairs2 && xs.length % 2) throw new Error(`${what}: comma-separated numbers${pairs2 ? " in x,y pairs" : ""}`);
  return xs;
}
function shapeFrom(o) {
  const arr = (v, what, pairs2 = true) => Array.isArray(v) ? v.map(Number) : numbers2(v, what, pairs2);
  if (o.circle !== void 0) {
    const c = arr(o.circle, "--circle x,y,r", false);
    if (c.length !== 3) throw new Error("--circle: x,y,r");
    return { circle: [c[0], c[1], c[2]] };
  }
  if (o.poly !== void 0) return { poly: arr(o.poly, "--poly") };
  if (o.stroke !== void 0) return { stroke: arr(o.stroke, "--stroke"), width: Number(o.width ?? 1) };
  throw new Error("a shape is required: --circle x,y,r | --poly x,y,x,y,\u2026 | --stroke x,y,\u2026 --width w");
}
var onOff2 = (v) => v === void 0 ? void 0 : /^(on|true|yes|1)$/i.test(v);
function parseLayers(v, names = map_exports.MAP_LAYERS) {
  if (!v) return void 0;
  const out = {};
  for (const part of v.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [name, val] = part.split("=");
    if (!names.includes(name)) throw new Error(`--layers: unknown layer ${name} (${names.join(", ")})`);
    out[name] = val === void 0 ? false : onOff2(val);
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
var at3 = (p2) => `${p2[0]},${p2[1]}`;
function describeMapFacts(r) {
  const { scale, height } = r.unit, out = [`${r.id}: ${r.size.cols}\xD7${r.size.rows} cells; heights in ${height}, distances in cells (${scale})`];
  const share2 = (s) => s.map((x) => `${x.terrain} ${x.share}%`).join(", ");
  const hi = (h) => `${h.height} ${height} at ${at3(h.at)}${h.prominence ? ` (stands ${h.prominence} ${height} clear)` : ""}`;
  for (const p2 of r.points ?? []) {
    out.push(`at ${at3(p2.at)}: ${p2.terrain}, ${p2.height} ${height}, slope ${p2.slope.band ?? "?"} (${p2.slope.gradient} ${height}/${scale})`);
    for (const k of ["river", "road"]) if (p2[k]) out.push(`  ${k}: ${p2[k].name}${p2[k].source ? ` (${p2[k].source})` : ""} ${km(p2[k].distance, scale)} away at ${at3(p2[k].at)}${p2[k].within ? ", in it" : ""}`);
    if (p2.above) out.push(`  ${p2.above.value === null ? `no ${p2.above.of} to measure from` : `${p2.above.value} ${height} above the ${p2.above.of === "river" ? "river" : "lowest ground"}`}${p2.above.reference ? ` (${hi(p2.above.reference)})` : ""}`);
  }
  for (const a of r.areas ?? []) {
    out.push(`area ${a.area.map(at3).join(" ")}: ${share2(a.terrain)}; lowest ${hi(a.lowest)}, highest ${hi(a.highest)}`);
    for (const c of [...a.rivers, ...a.roads]) out.push(`  ${c.name}${c.source ? ` (${c.source})` : ""}: ${c.enters ? `in at ${at3(c.enters)}` : "starts inside"}, ${c.leaves ? `out at ${at3(c.leaves)}` : "ends inside"}, ${km(c.length, scale)}`);
  }
  const f = r.features;
  if (f) {
    out.push(`terrain: ${share2(f.terrain)}; lowest ${hi(f.lowest)}, highest ${hi(f.highest)}`);
    for (const [what, lines2] of [["river", f.rivers], ["generated river", f.generatedRivers], ["road", f.roads]])
      for (const l of lines2) out.push(`${what} ${l.name}: ${km(l.length, scale)}, ${l.points.length} points from ${at3(l.points[0])} to ${at3(l.points[l.points.length - 1])}`);
    out.push(`hilltops: ${f.hilltops.map(hi).join("; ") || "none"}`, `hollows: ${f.hollows.map(hi).join("; ") || "none"}`);
  }
  return out.join("\n");
}

// ../artgen-cli/src/dungeon.ts
var dungeonsDir = (p2) => join4(p2.art, "dungeons");
function dungeonFile(p2, ref) {
  if (typeof ref !== "string") return resolve3(ref.file);
  if (!/^[\w-]+$/.test(ref ?? "")) throw new Error(`dungeon id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p2) throw new Error("no artgen project here: name the dungeon file with --file <path>");
  return join4(dungeonsDir(p2), ref, "dungeon.json");
}
var shown2 = (p2, f) => relative2(p2?.root ?? process.cwd(), f);
var dungeonSummary = (m) => ({ id: m.id, size: `${m.cols}x${m.rows}`, ...m.title && { title: m.title }, rooms: m.rooms.length, corridors: m.corridors.length, labels: m.overlay.labels.length, symbols: m.overlay.symbols.length });
function listDungeons(p2) {
  if (!existsSync4(dungeonsDir(p2))) return [];
  return readdirSync2(dungeonsDir(p2), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync4(join4(dungeonsDir(p2), d.name, "dungeon.json"))).map((d) => dungeonSummary(readDungeon(p2, d.name)));
}
function readDungeon(p2, ref) {
  const f = dungeonFile(p2, ref);
  if (!existsSync4(f)) throw new Error(typeof ref === "string" ? `no dungeon ${ref} (${shown2(p2, f)}) \u2014 artgen dungeon new ${ref}` : `no dungeon file ${shown2(p2, f)} \u2014 artgen dungeon new --file ${ref.file}`);
  return dungeon_exports.parseDungeon(readJson(f));
}
function writeDungeon(p2, m, ref = m.id) {
  const spec = dungeon_exports.parseDungeon(m), f = dungeonFile(p2, ref);
  writeJson(f, spec);
  return shown2(p2, f);
}
function createDungeon(p2, m, force = false, at4 = m.id) {
  if (existsSync4(dungeonFile(p2, at4)) && !force) throw new Error(typeof at4 === "string" ? `dungeon ${m.id} already exists (edit it, or pick another id)` : `${shown2(p2, dungeonFile(p2, at4))} already exists (edit it, or --force)`);
  return { file: writeDungeon(p2, m, at4), dungeon: m };
}
function updateDungeon(p2, ref, change) {
  const m = readDungeon(p2, ref), next4 = change(m) ?? m;
  writeDungeon(p2, next4, ref);
  return next4;
}
function checkDungeonFile(p2, ref) {
  const f = dungeonFile(p2, ref);
  let raw;
  try {
    raw = JSON.parse(readFileSync4(f, "utf8"));
  } catch (e) {
    const missing = e.code === "ENOENT";
    return { file: shown2(p2, f), ok: false, errors: [{ path: "", message: missing ? `no such file: ${shown2(p2, f)}` : `not JSON: ${e.message}` }], warnings: [] };
  }
  const r = dungeon_exports.checkDungeon(raw), errors = [...r.errors], warnings = [];
  if (!errors.length) for (const x of dungeon_exports.lintDungeon(dungeon_exports.parseDungeon(raw))) (x.severity === "error" ? errors : warnings).push({ path: x.path, message: x.message });
  const u = raw?.underlay;
  if (!errors.some((e) => e.path.startsWith("underlay")) && u && typeof u.map === "string" && !existsSync4(resolve3(dirname3(f), u.map)))
    errors.push({ path: "underlay.map", message: `no such map file ${u.map}` });
  return { file: shown2(p2, f), ok: !errors.length, errors, warnings };
}
function readUnderlay(p2, ref, m) {
  if (!m.underlay) return null;
  const f = resolve3(dirname3(dungeonFile(p2, ref)), m.underlay.map);
  if (!existsSync4(f)) throw new Error(`underlay.map: no such map file ${m.underlay.map} (looked for ${shown2(p2, f)})`);
  const spec = map_exports.parseMap(readJson(f));
  return { map: spec, field: map_exports.generateMap(spec) };
}
async function renderDungeonFiles(p2, ref, o = {}) {
  const m = readDungeon(p2, ref), layout = dungeon_exports.layoutDungeon(m), id2 = typeof ref === "string" ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === "string" ? join4(dungeonsDir(p2), id2, "out") : dirname3(dungeonFile(p2, ref)));
  const formats2 = o.formats ?? ["svg", "png"], files = [];
  if (o.fit && o.ppu !== void 0) throw new Error("--fit and --ppu both set the scale: use one");
  if (o.crop && o.rooms?.length) throw new Error("--crop and --room both set the window: use one");
  if (o.margin !== void 0 && !o.rooms?.length) throw new Error("--margin goes with --room");
  const window = o.rooms?.length ? dungeon_exports.roomCrop(m, o.rooms, o.margin, layout) : o.crop;
  const crop2 = clampCrop(window ?? [0, 0, m.cols, m.rows], m.cols, m.rows), unit = o.fit?.unit ?? "px";
  const pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : void 0), underlay = readUnderlay(p2, ref, m);
  const view = { layers: o.layers, layout, ...window && { crop: crop2 }, pageScale };
  let ppu = o.fit ? fitPpu(crop2[2], crop2[3], o.fit) : o.ppu ?? 40;
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
  const px = dungeon_exports.dungeonRenderSize(m, { ...view, ppu }), size2 = [Math.round(px.width), Math.round(px.height)];
  if (formats2.includes("png")) await initNodeMapSvg();
  mkdirSync3(out, { recursive: true });
  const svg = dungeon_exports.renderDungeonSvg(m, { ...view, ppu, unit, ...underlay && { underlay } }), base = join4(out, id2);
  if (formats2.includes("svg")) {
    writeFileSync3(`${base}.svg`, svg);
    files.push(`${base}.svg`);
  }
  if (formats2.includes("png")) {
    writeFileSync3(`${base}.png`, encodePNG(rasterizeSvg(svg, size2[0], size2[1])));
    files.push(`${base}.png`);
  }
  return { files: files.map((f) => relative2(process.cwd(), f)), rooms: m.rooms.length, corridors: m.corridors.length, doors: layout.doors.length, size: size2, crop: crop2, ppu, svg: svgSize([0, 0, px.width, px.height], 1, unit), pageScale: pageScale ?? null, unplaced: dungeon_exports.dungeonLabelLayout(m, ppu, pageScale, layout).unplaced };
}
var { cornerPoint: cornerPoint2, corridorEnd: corridorEnd2, doorPair: doorPair2, gridMode: gridMode2 } = dungeon_exports;
var endText = (e) => "room" in e ? `${e.room}${e.side ? `.${e.side}${e.offset !== void 0 ? `+${e.offset}` : ""}` : ""}` : "at" in e ? `(${e.at.join(",")})${e.exit ? ` "${e.exit.text}"` : ""}` : `corridor ${e.corridor}`;
function warningLines(m, max2 = 5) {
  const found = dungeon_exports.lintDungeon(m);
  if (!found.length) return [];
  const lines2 = found.slice(0, max2).map((x) => `  ${x.severity}: ${x.path}: ${x.message}`);
  if (found.length > max2) lines2.push(`  \u2026 ${found.length - max2} more (artgen dungeon check ${m.id})`);
  return lines2;
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
var settlementsDir = (p2) => join5(p2.art, "settlements");
function settlementFile(p2, ref) {
  if (typeof ref !== "string") return resolve4(ref.file);
  if (!/^[\w-]+$/.test(ref ?? "")) throw new Error(`settlement id ${JSON.stringify(ref)}: letters, digits, - and _ only`);
  if (!p2) throw new Error("no artgen project here: name the settlement file with --file <path>");
  return join5(settlementsDir(p2), ref, "settlement.json");
}
var shown3 = (p2, f) => relative3(p2?.root ?? process.cwd(), f);
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
function listSettlements(p2) {
  if (!existsSync5(settlementsDir(p2))) return [];
  return readdirSync3(settlementsDir(p2), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync5(join5(settlementsDir(p2), d.name, "settlement.json"))).map((d) => settlementSummary(readSettlement(p2, d.name)));
}
function readSettlement(p2, ref) {
  const f = settlementFile(p2, ref);
  if (!existsSync5(f)) throw new Error(typeof ref === "string" ? `no settlement ${ref} (${shown3(p2, f)}) \u2014 artgen settlement new ${ref}` : `no settlement file ${shown3(p2, f)} \u2014 artgen settlement new --file ${ref.file}`);
  return settlement_exports.parseSettlement(readJson(f));
}
function writeSettlement(p2, m, ref = m.id) {
  const spec = settlement_exports.parseSettlement(m), f = settlementFile(p2, ref);
  writeJson(f, spec);
  return shown3(p2, f);
}
function createSettlement(p2, m, force = false, at4 = m.id) {
  if (existsSync5(settlementFile(p2, at4)) && !force) throw new Error(typeof at4 === "string" ? `settlement ${m.id} already exists (edit it, or pick another id)` : `${shown3(p2, settlementFile(p2, at4))} already exists (edit it, or --force)`);
  return { file: writeSettlement(p2, m, at4), settlement: m };
}
function updateSettlement(p2, ref, change) {
  const m = readSettlement(p2, ref), next4 = change(m) ?? m;
  writeSettlement(p2, next4, ref);
  return next4;
}
function readSettlementUnderlay(p2, ref, m) {
  if (!m.underlay) return null;
  const f = resolve4(dirname4(settlementFile(p2, ref)), m.underlay.map);
  if (!existsSync5(f)) throw new Error(`underlay.map: no such map file ${m.underlay.map} (looked for ${shown3(p2, f)})`);
  const spec = map_exports.parseMap(readJson(f));
  return { map: spec, field: map_exports.generateMap(spec) };
}
function mapForSettlement(p2, ref, mapRef) {
  const path = /[\\/.]/.test(mapRef) ? resolve4(mapRef) : (() => {
    if (!p2) throw new Error("--map: a map file path (no project here)");
    return join5(p2.art, "maps", mapRef, "map.json");
  })();
  if (!existsSync5(path)) throw new Error(`--map: no map ${mapRef} (${shown3(p2, path)})`);
  return { path, rel: relative3(dirname4(settlementFile(p2, ref)), path).split("\\").join("/") };
}
function checkSettlementFile(p2, ref) {
  const f = settlementFile(p2, ref);
  let raw;
  try {
    raw = JSON.parse(readFileSync5(f, "utf8"));
  } catch (e) {
    const missing = e.code === "ENOENT";
    return { file: shown3(p2, f), ok: false, errors: [{ path: "", message: missing ? `no such file: ${shown3(p2, f)}` : `not JSON: ${e.message}` }], warnings: [] };
  }
  const r = settlement_exports.checkSettlement(raw), errors = [...r.errors], warnings = [];
  if (!errors.length) for (const x of settlement_exports.lintSettlement(settlement_exports.parseSettlement(raw))) (x.severity === "error" ? errors : warnings).push({ path: x.path, message: x.message });
  const u = raw?.underlay;
  if (!errors.some((e) => e.path.startsWith("underlay")) && u && typeof u.map === "string" && !existsSync5(resolve4(dirname4(f), u.map))) errors.push({ path: "underlay.map", message: `no such map file ${u.map}` });
  return { file: shown3(p2, f), ok: !errors.length, errors, warnings };
}
function settlementWarningLines(m, max2 = 5) {
  const found = settlement_exports.lintSettlement(m);
  const lines2 = found.slice(0, max2).map((x) => `  ${x.severity}: ${x.path}: ${x.message}`);
  if (found.length > max2) lines2.push(`  \u2026 ${found.length - max2} more (artgen settlement check ${m.id})`);
  return lines2;
}
async function renderSettlementFiles(p2, ref, o = {}) {
  const m = readSettlement(p2, ref), id2 = typeof ref === "string" ? ref : fileStem(ref.file);
  const out = o.out ?? (typeof ref === "string" ? join5(settlementsDir(p2), id2, "out") : dirname4(settlementFile(p2, ref)));
  const formats2 = o.formats ?? ["svg", "png"], themes = o.themes ?? ["color"];
  if (o.fit && o.ppu !== void 0) throw new Error("--fit and --ppu both set the scale: use one");
  const underlay = readSettlementUnderlay(p2, ref, m), layout = settlement_exports.layoutSettlement(m);
  const jobs = [];
  if (o.plans) {
    jobs.push({ view: "site" });
    for (const b of m.buildings) for (const f of b.floors ?? []) jobs.push({ view: "plan", building: b.id, floor: f.level });
  } else if ((o.view ?? (o.building ? "plan" : "site")) === "plan") {
    const t = settlement_exports.planTarget(m, o.building, o.floor);
    jobs.push({ view: "plan", building: t.building.id, ...t.floor && { floor: t.floor.level } });
  } else jobs.push({ view: "site" });
  if (formats2.includes("png")) await initNodeMapSvg();
  mkdirSync4(out, { recursive: true });
  const results = [];
  for (const job of jobs) {
    const sheet = job.view === "plan" ? settlement_exports.planSheet(m, m.buildings.find((b) => b.id === job.building)) : { cols: m.cols, rows: m.rows };
    const crop2 = clampCrop(o.crop ?? [0, 0, sheet.cols, sheet.rows], sheet.cols, sheet.rows), unit = o.fit?.unit ?? "px", pageScale = o.pageScale ?? (o.fit ? PX_PER_MM : void 0);
    const view = { view: job.view, ...job.building && { building: job.building }, ...job.floor !== void 0 && { floor: job.floor }, buildings: o.buildings, layers: o.layers, ...job.view === "site" && { layout }, ...o.crop && { crop: crop2 }, pageScale };
    let ppu = o.fit ? fitPpu(crop2[2], crop2[3], o.fit) : o.ppu ?? (job.view === "plan" ? 40 : 24);
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
    const px = settlement_exports.settlementRenderSize(m, { ...view, ppu }), size2 = [Math.round(px.width), Math.round(px.height)], files = [];
    const stem = job.view === "plan" ? `${id2}.${job.building}.${(job.floor ?? 0) < 0 ? `c${-(job.floor ?? 0)}` : `f${job.floor ?? 0}`}` : id2;
    for (const theme of themes) {
      const svg = settlement_exports.renderSettlementSvg(m, { ...view, ppu, unit, theme, ...underlay && job.view === "site" && { underlay } }), base = join5(out, `${stem}.${theme}`);
      if (formats2.includes("svg")) {
        writeFileSync4(`${base}.svg`, svg);
        files.push(`${base}.svg`);
      }
      if (formats2.includes("png")) {
        writeFileSync4(`${base}.png`, encodePNG(rasterizeSvg(svg, size2[0], size2[1])));
        files.push(`${base}.png`);
      }
    }
    results.push({ files: files.map((f) => relative3(process.cwd(), f)), view: job.view, ...job.building && { building: job.building }, ...job.floor !== void 0 && { floor: job.floor }, size: size2, crop: crop2, ppu, svg: svgSize([0, 0, px.width, px.height], 1, unit) });
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

// ../artgen-cli/src/version.ts
var VERSION = true ? "0.11.0" : "dev";

// ../artgen-cli/src/loop/feedback-bundle.ts
var BUNDLE_KINDS = ["asset", "map", "dungeon", "settlement"];
var DEFAULT_REPO = "rstevenson1237/image_tools";
var INPUT = { map: "map.json", dungeon: "dungeon.json", settlement: "settlement.json" };
var INLINE_MAX = 4e4;
var LINK_BODY_MAX = 1800;
var run = (cwd, ...args) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || void 0;
  } catch {
    return void 0;
  }
};
function consumerOf(root) {
  const url = run(root, "config", "--get", "remote.origin.url"), name = url?.replace(/\.git$/, "").split(/[/:]/).slice(-2).join("/") ?? basename2(root);
  return { name, commit: run(root, "rev-parse", "HEAD") ?? "unknown", branch: run(root, "rev-parse", "--abbrev-ref", "HEAD") ?? "unknown" };
}
function kindOfFile(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const o = raw;
  if (Array.isArray(o.rooms) && Array.isArray(o.corridors)) return "dungeon";
  if (Array.isArray(o.buildings)) return "settlement";
  if (typeof o.cols === "number" && typeof o.rows === "number") return "map";
  return void 0;
}
function assetDirOf(p2, id2) {
  const base = join6(p2.art, "assets");
  if (!existsSync6(base)) return void 0;
  for (const k of readdirSync4(base, { withFileTypes: true })) {
    const d = join6(base, k.name, id2);
    if (k.isDirectory() && existsSync6(d) && statSync(d).isDirectory()) return d;
  }
  return void 0;
}
function candidates(p2, id2) {
  const out = [];
  if (/^[\w-]+$/.test(id2)) {
    for (const [kind, file] of [["map", mapFile(p2, id2)], ["dungeon", dungeonFile(p2, id2)], ["settlement", settlementFile(p2, id2)]]) if (existsSync6(file)) out.push({ kind, file });
    const a = assetDirOf(p2, id2);
    if (a) out.push({ kind: "asset", file: a });
  }
  return out;
}
var dateOf = (d) => d.toISOString().slice(0, 10);
var safeId = (id2) => id2.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
function briefOf(yaml, id2) {
  const blocks2 = yaml.split(/\r?\n/).reduce((acc, line2) => {
    if (/^- /.test(line2)) acc.push([line2]);
    else acc.at(-1)?.push(line2);
    return acc;
  }, []);
  if (!blocks2.length) return void 0;
  const mine = blocks2.filter((b) => b.some((l) => new RegExp(`^(?:- )?\\s*id:\\s*["']?${id2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?\\s*$`).test(l)));
  return mine.length === 1 ? mine[0].join("\n").replace(/\n*$/, "\n") : void 0;
}
function freshDir(parent, name) {
  for (let n = 1; ; n++) {
    const d = join6(parent, n === 1 ? name : `${name}-${n}`);
    if (!existsSync6(d)) return d;
  }
}
var list2 = (dir) => readdirSync4(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? list2(join6(dir, e.name)).map((f) => `${e.name}/${f}`) : [e.name]);
var issueLink = (repo, title, body2) => `https://github.com/${repo}/issues/new?${new URLSearchParams({ labels: "artgen-feedback", title, body: body2.length > LINK_BODY_MAX ? `${body2.slice(0, LINK_BODY_MAX)}
\u2026
(the rest is in ISSUE.md of the bundle: paste it here)` : body2 }).toString()}`;
function caseMd(o) {
  const title = o.note.split("\n")[0].slice(0, 80) || "reported from a consumer";
  return [
    `# ${o.id} \u2014 ${title}`,
    "",
    ...o.format !== void 0 ? [`format: ${o.kind} ${o.format}`] : [`kind: ${o.kind}`],
    `consumer: ${o.consumer.name} at ${o.consumer.commit} (${o.consumer.branch}), reported with \`artgen report\``,
    `artgen: ${VERSION}${o.mapgen ? `, maps ${o.mapgen}` : ""}`,
    ...o.asset ? [`asset: ${o.asset}`] : [],
    "",
    o.note || "(no note given)",
    "",
    "```sh",
    o.command,
    "```",
    "",
    `check: ${o.check}`,
    `render: ${o.render}`,
    "",
    "## Must go on drawing",
    "",
    "_(for the maintainer: the facts this file states, once the report is understood)_",
    "",
    "## Does not yet draw well",
    "",
    "_(what the consumer reported)_",
    "",
    ...o.extra ? [o.extra, ""] : []
  ].join("\n");
}
var formatOf = (raw) => raw && typeof raw === "object" && typeof raw.version === "number" ? raw.version : void 0;
async function writeBundle(p2, target, o = {}) {
  const now = o.now ?? /* @__PURE__ */ new Date(), note = (o.note ?? "").trim();
  let kind, input, id2;
  if (o.file) {
    input = resolve5(o.file);
    if (!existsSync6(input)) throw new Error(`report: no such file ${o.file}`);
    let raw;
    try {
      raw = JSON.parse(readFileSync6(input, "utf8"));
    } catch {
      raw = void 0;
    }
    const k = o.kind ?? kindOfFile(raw);
    if (!k || k === "asset") throw new Error(`report --file ${o.file}: is it a map, a dungeon or a settlement? say so with --kind`);
    kind = k;
    id2 = safeId(target ?? (raw?.id ?? basename2(dirname5(input))));
  } else {
    if (!target) throw new Error("report: name an asset, map, dungeon or settlement id (or --file <path>)");
    if (existsSync6(target) && statSync(target).isDirectory() && !candidates(p2 ?? { root: ".", art: "." }, target).length) throw new Error(`report: ${target} is a folder: a benchmark report on a folder of asset directories is now \`artgen bench-report ${target}\`; \`report\` sends feedback about one asset or map`);
    if (!p2) throw new Error("report: no artgen project here \u2014 name a file with --file <path>");
    const found = candidates(p2, target).filter((c) => !o.kind || c.kind === o.kind);
    if (!found.length) throw new Error(`report: ${target} is not an asset, a map, a dungeon or a settlement in this project`);
    if (found.length > 1) throw new Error(`report: ${target} is a ${found.map((c) => c.kind).join(" and a ")} \u2014 say which with --kind`);
    ({ kind, file: input } = { kind: found[0].kind, file: found[0].file });
    id2 = target;
  }
  const root = p2?.root ?? dirname5(input), consumer = consumerOf(root);
  const dir = resolve5(o.out ?? (p2 ? freshDir(join6(p2.art, "feedback"), `${dateOf(now)}-${id2}`) : freshDir(dirname5(input), `feedback-${dateOf(now)}-${id2}`)));
  mkdirSync5(dir, { recursive: true });
  const files = [], put = (rel, text2) => {
    mkdirSync5(dirname5(join6(dir, rel)), { recursive: true });
    writeFileSync5(join6(dir, rel), text2);
    files.push(rel);
  };
  const mapgen = (() => {
    try {
      return readFileSync6(join6(root, "tools", "artgen", "VERSION"), "utf8").trim();
    } catch {
      return void 0;
    }
  })();
  let briefsNote;
  let check4 = "ok", render4 = o.noRender ? "not made (--no-render)" : "ok", format, command, assetPath;
  if (kind === "asset") {
    assetPath = p2 ? relative4(p2.art, input).split("\\").join("/") : void 0;
    const dst = join6(dir, "asset");
    cpSync(input, dst, { recursive: true, filter: (f) => relative4(input, f).split(sep)[0] !== "out" });
    files.push(...list2(dst).map((f) => `asset/${f}`));
    for (const f of ["direction.json", "artgen.config.json"]) if (p2 && existsSync6(join6(p2.art, f))) {
      copyFileSync(join6(p2.art, f), join6(dir, f));
      files.push(f);
    }
    if (p2 && existsSync6(join6(p2.art, "briefs.yaml"))) {
      const all = readFileSync6(join6(p2.art, "briefs.yaml"), "utf8"), mine = briefOf(all, id2);
      put("briefs.yaml", mine ?? all);
      if (!mine) briefsNote = "briefs.yaml is the whole file: the brief of this asset could not be cut out of it";
    }
    const ledger = p2 && existsSync6(join6(p2.art, "ledger.jsonl")) ? readFileSync6(join6(p2.art, "ledger.jsonl"), "utf8").split("\n").filter((l) => {
      try {
        return JSON.parse(l).asset === id2;
      } catch {
        return false;
      }
    }) : [];
    put("ledger.jsonl", ledger.length ? ledger.join("\n") + "\n" : "");
    const sheet = [...ledger].reverse().map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return {};
      }
    }).find((e) => e.type === "review" && !e.stage && typeof e.sheet === "string")?.sheet;
    const sheetFile = p2 && sheet ? resolve5(p2.art, sheet.split(",")[0]) : void 0;
    if (!o.noRender && sheetFile && existsSync6(sheetFile)) {
      mkdirSync5(join6(dir, "render"), { recursive: true });
      copyFileSync(sheetFile, join6(dir, "render", basename2(sheetFile)));
      files.push(`render/${basename2(sheetFile)}`);
    } else if (!o.noRender) render4 = "no review sheet on disk (run `artgen review`)";
    const last = [...ledger].reverse().map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return {};
      }
    }).find((e) => typeof e.version === "string")?.version;
    command = `node tools/artgen/artgen.js render ${id2}${last ? ` --version ${last}` : ""}`;
    check4 = ledger.length ? `${ledger.length} ledger lines${briefsNote ? `; ${briefsNote}` : ""}` : "no ledger lines for it";
  } else {
    const ref = { file: input };
    writeFileSync5(join6(dir, INPUT[kind]), readFileSync6(input));
    files.push(INPUT[kind]);
    let raw;
    try {
      raw = JSON.parse(readFileSync6(input, "utf8"));
    } catch {
      raw = void 0;
    }
    format = formatOf(raw);
    const res = kind === "map" ? checkMapFile(p2, ref) : kind === "dungeon" ? checkDungeonFile(p2, ref) : checkSettlementFile(p2, ref);
    const errors = res.errors;
    check4 = res.ok ? "ok" : errors.length ? errors.slice(0, 5).map((e) => `${e.path || "(file)"}: ${e.message}`).join("; ") : `unmet: ${res.unmet?.join(", ")}`;
    if (!o.noRender) {
      try {
        const rr = kind === "map" ? await renderMapFiles(p2, ref, { out: dir }) : kind === "dungeon" ? await renderDungeonFiles(p2, ref, { out: dir }) : await renderSettlementFiles(p2, ref, { out: dir });
        for (const f of [...new Set((Array.isArray(rr) ? rr.flatMap((x) => x.files) : rr.files).map((f2) => basename2(f2)))]) if (existsSync6(join6(dir, f))) files.push(f);
      } catch (e) {
        render4 = `failed: ${e.message.split("\n")[0]}`;
      }
    }
    command = `node tools/artgen/artgen-maps.js ${kind} check --file ${INPUT[kind]} --json`;
  }
  const md = caseMd({ id: id2, kind, format, note, command, consumer, mapgen, check: check4, render: render4, asset: assetPath });
  put("case.md", md);
  put("report.json", JSON.stringify({ schema: 1, id: id2, kind, ...format !== void 0 && { format }, artgen: VERSION, ...mapgen && { installed: mapgen }, consumer, note, check: check4, render: render4, createdAt: now.toISOString(), command }, null, 2) + "\n");
  const title = `[artgen report] ${kind} ${id2}${note ? `: ${note.split("\n")[0].slice(0, 60)}` : ""}`;
  const inputText = kind === "asset" ? void 0 : readFileSync6(join6(dir, INPUT[kind]), "utf8");
  const inline = inputText !== void 0 && inputText.length <= INLINE_MAX;
  const body2 = [
    md,
    ...inline ? [`<!-- artgen:input ${INPUT[kind]} -->`, "```json", inputText.trimEnd(), "```", ""] : [kind === "asset" ? `The asset files, ledger lines and render are in \`${relative4(p2?.root ?? process.cwd(), dir)}\`: zip the folder and attach it to this issue.` : `The input file is too large to paste: attach \`${INPUT[kind]}\` from \`${relative4(p2?.root ?? process.cwd(), dir)}\` to this issue.`, ""]
  ].join("\n");
  put("ISSUE.md", `# ${title}

${body2}`);
  const repo = o.repo ?? DEFAULT_REPO;
  return { dir, id: id2, kind, files, title, body: body2, link: issueLink(repo, title, body2), check: check4 };
}
async function openIssue(b, repo, token, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "artgen-report" },
    body: JSON.stringify({ title: b.title, body: b.body, labels: ["artgen-feedback"] })
  });
  if (!res.ok) throw new Error(`report --issue: GitHub answered ${res.status} for ${repo} \u2014 open the link instead (it is printed without --issue)`);
  const j = await res.json();
  return j.html_url ?? `https://github.com/${repo}/issues`;
}

// ../artgen-cli/src/loop/metrics.ts
import { existsSync as existsSync8, mkdirSync as mkdirSync7, readdirSync as readdirSync6, readFileSync as readFileSync8, statSync as statSync2, writeFileSync as writeFileSync7 } from "node:fs";
import { createHash } from "node:crypto";
import { basename as basename3, dirname as dirname7, join as join8, resolve as resolve7 } from "node:path";

// ../artgen-cli/src/workflow.ts
import { appendFileSync, copyFileSync as copyFileSync2, existsSync as existsSync7, mkdirSync as mkdirSync6, readdirSync as readdirSync5, readFileSync as readFileSync7, writeFileSync as writeFileSync6 } from "node:fs";
import { dirname as dirname6, extname as extname2, join as join7, relative as relative5, resolve as resolve6 } from "node:path";
var SUBJECTS2 = workflow_exports.SUBJECTS;
var KIND_NOUN = { map: "terrain map", dungeon: "dungeon", settlement: "settlement" };
var ID = /^[\w-]+$/;
var RENDER_EDGE = 900;
var ledgerPath = (p2) => join7(p2.art, "ledger.jsonl");
var directionPath = (p2) => join7(p2.art, direction_exports.DIRECTION_FILE);
var relArt = (p2, f) => relative5(p2.art, f).split("\\").join("/");
var relRoot = (p2, f) => relative5(p2.root, f).split("\\").join("/");
function appendLedger(path, entry) {
  mkdirSync6(dirname6(path), { recursive: true });
  appendFileSync(path, formatLedgerLine({ ts: (/* @__PURE__ */ new Date()).toISOString(), ...entry }) + "\n");
}
function subjectPaths(p2, kind, id2) {
  if (!ID.test(id2 ?? "")) throw new Error(`${kind} id ${JSON.stringify(id2)}: letters, digits, - and _ only`);
  const s = SUBJECTS2[kind], dir = join7(p2.art, s.dir, id2), stem = stemOf(s);
  return { kind, id: id2, key: subjectKey(kind, id2), dir, stem, file: join7(dir, s.file), brief: join7(dir, `${stem}.brief.md`), out: join7(dir, "out"), version: (v) => join7(dir, versionFile(stem, v)) };
}
function readWorking(p2, kind, id2) {
  const f = subjectPaths(p2, kind, id2).file;
  if (!existsSync7(f)) throw new Error(`no ${kind} ${id2} (${relRoot(p2, f)}) \u2014 artgen ${kind} new ${id2}`);
  return readFileSync7(f, "utf8");
}
function listSubjectIds(p2, kind) {
  const root = join7(p2.art, SUBJECTS2[kind].dir);
  if (!existsSync7(root)) return [];
  return readdirSync5(root, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync7(join7(root, d.name, SUBJECTS2[kind].file))).map((d) => d.name).sort();
}
function listVersions(p2, kind, id2) {
  const { dir, stem } = subjectPaths(p2, kind, id2);
  return existsSync7(dir) ? sortVersions(readdirSync5(dir).map((f) => versionOfFile(stem, f)).filter((v) => !!v)) : [];
}
var readLedger = (p2) => existsSync7(ledgerPath(p2)) ? parseLedger(readFileSync7(ledgerPath(p2), "utf8")) : [];
var entriesOf = (p2, kind, id2) => readLedger(p2).filter((e) => e.asset === subjectKey(kind, id2));
function readDirection(p2) {
  const f = directionPath(p2);
  if (!existsSync7(f)) return null;
  let raw;
  try {
    raw = JSON.parse(readFileSync7(f, "utf8"));
  } catch (e) {
    throw new Error(`${relRoot(p2, f)}: not JSON (${e.message})`);
  }
  try {
    return direction_exports.parseMapDirection(raw);
  } catch (e) {
    throw new Error(`${relRoot(p2, f)}: ${e.message}`);
  }
}
function checksOf(p2, kind, id2, text2) {
  const { dir } = subjectPaths(p2, kind, id2);
  return workflow_exports.checkSource(kind, text2, { exists: (rel) => existsSync7(resolve6(dir, rel)), symbols: direction_exports.symbolsFor(readDirection(p2), kind) });
}
function subjectState(p2, kind, id2) {
  const paths = subjectPaths(p2, kind, id2), text2 = readWorking(p2, kind, id2), direction2 = readDirection(p2), entries = entriesOf(p2, kind, id2);
  return { paths, text: text2, entries, versions: listVersions(p2, kind, id2), direction: direction2, status: subjectStatus({ entries, key: paths.key, workingHash: sourceHash(text2), direction: direction_exports.directionRef(direction2) }) };
}
var fails = (checks) => checks.filter((c) => c.status === "fail");
var flags = (checks) => checks.filter((c) => c.status === "flag");
var hint = (kind, cmd, id2) => `artgen ${kind} ${cmd} ${id2}`;
function readBrief(p2, kind, id2) {
  const f = subjectPaths(p2, kind, id2).brief;
  if (!existsSync7(f)) return null;
  const text2 = readFileSync7(f, "utf8");
  return { path: relRoot(p2, f), text: text2, brief: parseSubjectBrief(text2) };
}
function writeBrief(p2, kind, id2, o) {
  readWorking(p2, kind, id2);
  const paths = subjectPaths(p2, kind, id2), had = readBrief(p2, kind, id2)?.brief ?? { refs: [], body: "" };
  for (const r of o.refs ?? []) if (!refOk(r)) throw new Error(`--refs ${r}: a path under art/ (no .. and not absolute)`);
  const next4 = { title: had.title, refs: o.refs ?? had.refs, body: o.text ?? had.body };
  writeFileSync6(paths.brief, formatSubjectBrief(next4));
  return { path: relRoot(p2, paths.brief), brief: parseSubjectBrief(formatSubjectBrief(next4)) };
}
function loadRefs(p2, refs) {
  const out = [], warnings = [];
  for (const r of refs) {
    const f = resolve6(p2.art, r);
    if (!refOk(r)) warnings.push(`${r}: not a path under art/, skipped`);
    else if (extname2(r).toLowerCase() !== ".png") warnings.push(`${r}: not a PNG, skipped`);
    else if (!existsSync7(f)) warnings.push(`${r}: no such file, skipped`);
    else try {
      out.push({ label: r.split("/").pop().replace(/\.png$/i, ""), grid: decodePNG(new Uint8Array(readFileSync7(f))) });
    } catch {
      warnings.push(`${r}: not a readable PNG, skipped`);
    }
  }
  return { refs: out, warnings };
}
function recordVersion(p2, kind, id2, o = {}) {
  const st = subjectState(p2, kind, id2);
  try {
    SUBJECTS2[kind].parse(JSON.parse(st.text));
  } catch (e) {
    throw new Error(`${id2}: the file does not parse, so it cannot be a version \u2014 ${e.message}`);
  }
  const latest = st.versions[st.versions.length - 1], hash = sourceHash(st.text);
  if (latest && sourceHash(readFileSync7(st.paths.version(latest), "utf8")) === hash) throw new Error(`${id2}: no change since ${latest}`);
  const version = nextVersion(st.versions), file = st.paths.version(version), prev = st.entries[st.entries.length - 1];
  copyFileSync2(st.paths.file, file);
  const wallMs = prev ? Math.max(0, Date.now() - Date.parse(prev.ts)) : void 0;
  appendLedger(ledgerPath(p2), { type: "version", asset: st.paths.key, version, file: relArt(p2, file), sourceHash: hash, ...o.note && { note: o.note }, by: o.by ?? "agent", ...Number.isFinite(wallMs) && { wallMs } });
  return { version, file: relRoot(p2, file), sourceHash: hash, ...Number.isFinite(wallMs) && { wallMs } };
}
function diffVersions(p2, kind, id2, a, b) {
  const st = subjectState(p2, kind, id2), latest = st.versions[st.versions.length - 1];
  if (!st.versions.length) throw new Error(`${id2}: no version yet \u2014 ${hint(kind, "version", id2)}`);
  const read = (name) => {
    const f = name === "working" ? st.paths.file : st.paths.version(name);
    if (name !== "working" && !st.versions.includes(name)) throw new Error(`${id2}: no ${name} (have ${st.versions.join(", ")}, or working)`);
    return JSON.parse(readFileSync7(f, "utf8"));
  };
  const from = a ?? latest, to = b ?? (a ? latest : "working");
  return { from, to, changes: diffJson(read(from), read(to)) };
}
async function renderPng(kind, file, theme, out, text2) {
  const size2 = workflow_exports.sizeOf(text2), edge = size2 ? Math.max(size2.cols, size2.rows) : 30, ref = { file };
  const ppu = Math.max(4, Math.min({ map: 40, dungeon: 40, settlement: 24 }[kind], Math.floor(RENDER_EDGE / edge)));
  if (kind === "map") return resolve6((await renderMapFiles(null, ref, { themes: [theme], formats: ["png"], ppu, out })).files[0]);
  if (kind === "dungeon") return resolve6((await renderDungeonFiles(null, ref, { formats: ["png"], ppu, out })).files[0]);
  return resolve6((await renderSettlementFiles(null, ref, { themes: [theme], formats: ["png"], ppu, out }))[0].files[0]);
}
function sheetOf(p2, st, text2, checks, version) {
  const { kind, id: id2 } = st.paths, base = SUBJECTS2[kind].sheet(SUBJECTS2[kind].parse(JSON.parse(text2)), checks), brief = readBrief(p2, kind, id2)?.brief;
  const { refs, warnings } = loadRefs(p2, brief?.refs ?? []);
  return { sheet: subjectDataSheet(base, { version, theme: direction_exports.themeFor(st.direction, kind), directionVersion: direction_exports.lockedMapDirection(st.direction)?.version, brief }), refs, warnings };
}
async function reviewSubject(p2, kind, id2, o = {}) {
  const st = subjectState(p2, kind, id2);
  if (!st.versions.length) throw new Error(`${id2}: no version yet \u2014 ${hint(kind, "version", id2)}`);
  const version = o.version ?? st.versions[st.versions.length - 1];
  if (!st.versions.includes(version)) throw new Error(`${id2}: no ${version} (have ${st.versions.join(", ")})`);
  if (o.score !== void 0 && !(o.score >= 0 && o.score <= 10)) throw new Error("--score: a number from 0 to 10");
  const vfile = st.paths.version(version), text2 = readFileSync7(vfile, "utf8"), checks = checksOf(p2, kind, id2, text2), theme = direction_exports.themeFor(st.direction, kind);
  const png = await renderPng(kind, vfile, theme, st.paths.out, text2), { sheet, refs, warnings } = sheetOf(p2, st, text2, checks, version);
  const grid5 = subjectReviewSheet({ title: `${id2} - ${version}`, render: decodePNG(new Uint8Array(readFileSync7(png))), sheet, refs }), sheetFile = join7(st.paths.out, `review-${version}.png`);
  mkdirSync6(st.paths.out, { recursive: true });
  writeFileSync6(sheetFile, encodePNG(grid5));
  const tokens = imageTokens(grid5.w, grid5.h), conformance = { pass: !fails(checks).length, checks };
  appendLedger(ledgerPath(p2), { type: "review", asset: st.paths.key, version, sheet: relArt(p2, sheetFile), imageTokens: tokens, conformance, by: "agent" });
  if (o.score !== void 0) appendLedger(ledgerPath(p2), { type: "score", asset: st.paths.key, version, score: o.score, ...o.note && { note: o.note }, reviewer: o.reviewer ?? "self", conformance, by: "agent" });
  return { version, sheet: relRoot(p2, sheetFile), sheetFile, imageTokens: tokens, pass: conformance.pass, checks, warnings, ...o.score !== void 0 && { score: o.score } };
}
function writeSheet(p2, kind, id2) {
  const st = subjectState(p2, kind, id2), checks = checksOf(p2, kind, id2, st.text), { sheet, refs, warnings } = sheetOf(p2, st, st.text, checks);
  mkdirSync6(st.paths.out, { recursive: true });
  const png = join7(st.paths.out, "sheet.png"), json = join7(st.paths.out, "sheet.json");
  writeFileSync6(png, encodePNG(renderDataSheet(sheet, { refs })));
  writeFileSync6(json, JSON.stringify(sheet, null, 2) + "\n");
  return { png: relRoot(p2, png), pngFile: png, json: relRoot(p2, json), sheet, markdown: dataSheetMarkdown(sheet), warnings };
}
function feedbackSubject(p2, kind, id2, o) {
  const st = subjectState(p2, kind, id2), entry = feedbackEntry({ kind, id: id2, key: st.paths.key, latest: st.versions[st.versions.length - 1] }, o);
  appendLedger(ledgerPath(p2), entry);
  const after = subjectState(p2, kind, id2).status;
  return { on: entry.on, status: after.status, why: after.why };
}
function approveSubject(p2, kind, id2, o = {}) {
  const st = subjectState(p2, kind, id2), version = st.status.version;
  const checks = version && isApprovable(st.status, sourceHash(st.text)) ? checksOf(p2, kind, id2, readFileSync7(st.paths.version(version), "utf8")) : [];
  const entry = approvalEntry({ kind, id: id2, key: st.paths.key, status: st.status, checks, workingHash: sourceHash(st.text), direction: direction_exports.directionRef(st.direction) }, o);
  appendLedger(ledgerPath(p2), entry);
  return { ts: (/* @__PURE__ */ new Date()).toISOString(), ...entry };
}
function statusRows(p2, kind, ids) {
  return (ids?.length ? ids : listSubjectIds(p2, kind)).map((id2) => {
    const st = subjectState(p2, kind, id2), checks = checksOf(p2, kind, id2, st.text);
    return { id: id2, kind, status: st.status.status, ...st.status.version && { version: st.status.version }, why: st.status.why, fail: fails(checks).length, flag: flags(checks).length };
  });
}
function history(p2, kind, id2) {
  return entriesOf(p2, kind, id2).filter((e) => ["version", "review", "score", "feedback", "approve"].includes(e.type)).map((e) => ({
    ts: e.ts,
    type: e.type,
    ...typeof (e.version ?? e.on) === "string" && { version: String(e.version ?? e.on) },
    ...e.by && { by: e.by },
    text: e.type === "score" ? `${e.score}${e.reviewer ? ` by ${String(e.reviewer)}` : ""}${e.note ? `: ${String(e.note)}` : ""}` : e.type === "review" ? `${e.conformance?.pass === false ? "checks fail, " : ""}~${String(e.imageTokens ?? 0)} image tokens` : String(e.note ?? "")
  }));
}
function runDirection(p2, o) {
  const had = readDirection(p2), file = relRoot(p2, directionPath(p2));
  const themes = o.theme ? direction_exports.parseThemeFlag(o.theme) : void 0, symbols4 = o.symbols ? direction_exports.parseSymbolsFlag(o.symbols) : void 0;
  if (!themes && !symbols4 && !o.lock) return { direction: had, file, changed: false, locked: false };
  let d = had ?? direction_exports.newMapDirection();
  const edited = !!(themes || symbols4);
  if (edited) d = direction_exports.editMapDirection(d, { themes, symbols: symbols4 });
  if (o.lock) {
    if (!had && !edited) throw new Error("map direction --lock: nothing to lock yet \u2014 set a theme or symbols first (--theme map=bw, --symbols dungeon=altar,statue)");
    if (!edited && d.status === "locked") throw new Error(`map direction is already locked at v${d.version} \u2014 change a theme or symbols first`);
    d = direction_exports.lockMapDirection(d);
  }
  mkdirSync6(p2.art, { recursive: true });
  writeFileSync6(directionPath(p2), direction_exports.formatMapDirection(d));
  if (o.lock) appendLedger(ledgerPath(p2), { type: "approve", asset: "maps:direction", version: `v${d.version}`, note: o.note ?? "", by: "user", ...o.via && { via: o.via } });
  return { direction: d, file, changed: true, locked: !!o.lock };
}

// ../artgen-cli/src/loop/metrics.ts
var METRICS_SCHEMA = 2;
var round2 = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
function modulesOf(root) {
  try {
    return JSON.parse(readFileSync8(join8(root, "tools", "artgen", "MANIFEST.json"), "utf8")).modules ?? {};
  } catch {
    return {};
  }
}
function metricsOf(p2, o = {}) {
  const art = o.art?.(p2), { generators: artGenerators, ...artFields } = art ?? {};
  const subjects = SUBJECT_KINDS.flatMap((kind) => listSubjectIds(p2, kind).map((id2) => ({ generator: kind, key: subjectKey(kind, id2) })));
  const count = (kind) => subjects.filter((s) => s.generator === kind).length;
  const generators = { ...artGenerators, ...generatorMetrics(readLedger(p2), subjects) };
  return {
    schema: METRICS_SCHEMA,
    repo: o.name ?? `repo-${createHash("sha256").update(basename3(p2.root)).digest("hex").slice(0, 8)}`,
    artgen: VERSION,
    modules: modulesOf(p2.root),
    exported: (o.now ?? /* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    ...artFields.assets && { assets: artFields.assets },
    maps: { map: count("map"), dungeon: count("dungeon"), settlement: count("settlement") },
    ...artFields.assets && { byKind: artFields.byKind, passes: artFields.passes, totals: artFields.totals, firstPassApproval: artFields.firstPassApproval, userRevisionRate: artFields.userRevisionRate, gateFailures: artFields.gateFailures, blind: artFields.blind, ...artFields.gates && { gates: artFields.gates }, ...artFields.firstInGameMinutes !== void 0 && { firstInGameMinutes: artFields.firstInGameMinutes } },
    generators
  };
}
function exportMetrics(p2, o = {}) {
  const metrics = metricsOf(p2, o), file = resolve7(o.out ?? join8(p2.art, "metrics", `${metrics.artgen}.json`));
  mkdirSync7(dirname7(file), { recursive: true });
  writeFileSync7(file, JSON.stringify(metrics, null, 2) + "\n");
  return { file, metrics };
}
function exportsIn(paths) {
  const out = [];
  const add = (f) => {
    let j;
    try {
      j = JSON.parse(readFileSync8(f, "utf8"));
    } catch {
      throw new Error(`${f}: not JSON`);
    }
    const schema = j?.schema;
    if (schema !== 1 && schema !== METRICS_SCHEMA || typeof j.repo !== "string") throw new Error(`${f}: not an artgen metrics export (schema 1 or ${METRICS_SCHEMA})`);
    out.push(j);
  };
  const walk = (x) => {
    if (!existsSync8(x)) throw new Error(`${x}: no such file or folder`);
    if (statSync2(x).isDirectory()) for (const e of readdirSync6(x).sort()) {
      const f = join8(x, e);
      if (statSync2(f).isDirectory() ? e !== "node_modules" && e !== ".git" : e.endsWith(".json")) walk(f);
    }
    else add(x);
  };
  for (const x of paths) walk(x);
  return out;
}
function pool(paths) {
  const all = exportsIn(paths), latest = /* @__PURE__ */ new Map();
  for (const e of all) {
    const k = `${e.repo}\0${e.artgen}`, had = latest.get(k);
    if (!had || e.exported >= had.exported) latest.set(k, e);
  }
  const byVersion = /* @__PURE__ */ new Map();
  for (const e of latest.values()) byVersion.set(e.artgen, [...byVersion.get(e.artgen) ?? [], e]);
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  const versions = [...byVersion.entries()].map(([artgen, es]) => {
    const art = es.filter((e) => e.assets), approved = sum(art.map((e) => e.assets.approved)), untouched = sum(art.map((e) => e.firstPassApproval.untouched));
    const tokens = sum(art.map((e) => e.totals.outTokens + e.totals.imageTokens)), fails2 = {};
    for (const e of art) for (const [c, n] of Object.entries(e.gateFailures)) fails2[c] = (fails2[c] ?? 0) + n;
    const gens = {}, byGen = /* @__PURE__ */ new Map();
    for (const e of es) for (const [g, m] of Object.entries(e.generators ?? {})) byGen.set(g, [...byGen.get(g) ?? [], m]);
    for (const [g, ms] of [...byGen].sort(([a], [b]) => a.localeCompare(b))) {
      const ap = sum(ms.map((m) => m.approved));
      gens[g] = {
        subjects: sum(ms.map((m) => m.subjects)),
        approved: ap,
        ...ap && { passesPerApproved: round2(sum(ms.map((m) => (m.passesPerApproved ?? 0) * m.approved)) / ap), firstPassApprovalRate: round2(sum(ms.map((m) => m.firstPassApproval.untouched)) / ap) },
        imageTokens: sum(ms.map((m) => m.imageTokens)),
        wallMinutes: round2(sum(ms.map((m) => m.wallMinutes)), 1)
      };
    }
    return {
      artgen,
      repos: es.map((e) => e.repo).sort(),
      assets: sum(art.map((e) => e.assets.total)),
      approved,
      tokensPerApproved: approved ? Math.round(tokens / approved) : void 0,
      wallMinutesPerApproved: approved ? round2(sum(art.map((e) => e.totals.wallMinutes)) / approved, 1) : void 0,
      firstPassApprovalRate: approved ? round2(untouched / approved) : void 0,
      topGateFailures: Object.entries(fails2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([check4, n]) => ({ check: check4, n })),
      generators: gens
    };
  }).sort((a, b) => a.artgen.localeCompare(b.artgen, void 0, { numeric: true }));
  return { exports: latest.size, repos: [...new Set([...latest.values()].map((e) => e.repo))].sort(), versions };
}
function poolMarkdown(r, title = "artgen pooled metrics") {
  const cell2 = (v) => v === void 0 ? "\u2014" : String(v);
  const gens = r.versions.flatMap((v) => Object.entries(v.generators).map(([g, m]) => ({ artgen: v.artgen, g, ...m })));
  return [
    `# ${title}`,
    "",
    `${r.exports} exports from ${r.repos.length} repo${r.repos.length === 1 ? "" : "s"}: ${r.repos.join(", ") || "\u2014"}.`,
    "",
    "| artgen | repos | assets | approved | tokens / approved | minutes / approved | first-pass approval | gate checks failing most |",
    "|---|---|---|---|---|---|---|---|",
    ...r.versions.map((v) => `| ${v.artgen} | ${v.repos.length} | ${v.assets} | ${v.approved} | ${cell2(v.tokensPerApproved)} | ${cell2(v.wallMinutesPerApproved)} | ${cell2(v.firstPassApprovalRate)} | ${v.topGateFailures.map((f) => `${f.check} \xD7${f.n}`).join(", ") || "\u2014"} |`),
    "",
    "Tokens are written code plus review images. A lower tokens / approved number at a later version is the sign a release made production cheaper; compare versions only when they hold the same kinds of asset.",
    "",
    ...gens.length ? [
      "## Per generator",
      "",
      "From the exports of schema 2: the same numbers for pixel art and each kind of map.",
      "",
      "| artgen | generator | subjects | approved | passes / approved | first-pass approval | review image tokens | minutes |",
      "|---|---|---|---|---|---|---|---|",
      ...gens.map((m) => `| ${m.artgen} | ${m.g} | ${m.subjects} | ${m.approved} | ${cell2(m.passesPerApproved)} | ${cell2(m.firstPassApprovalRate)} | ${m.imageTokens} | ${m.wallMinutes} |`),
      ""
    ] : []
  ].join("\n");
}

// ../artgen-cli/src/loop/upstream.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync9, mkdirSync as mkdirSync8, readFileSync as readFileSync9, writeFileSync as writeFileSync8 } from "node:fs";
import { dirname as dirname8, join as join9, resolve as resolve8 } from "node:path";

// ../artgen-cli/src/loop/diff.ts
var MAX_CELLS = 4e6;
function script(a, b) {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const x = a.slice(head, a.length - tail), y = b.slice(head, b.length - tail);
  if ((x.length + 1) * (y.length + 1) > MAX_CELLS) return [...a.slice(0, head).map((line2) => ({ t: " ", line: line2 })), ...x.map((line2) => ({ t: "-", line: line2 })), ...y.map((line2) => ({ t: "+", line: line2 })), ...a.slice(a.length - tail).map((line2) => ({ t: " ", line: line2 }))];
  const w = y.length + 1, len = new Uint32Array((x.length + 1) * w);
  for (let i2 = x.length - 1; i2 >= 0; i2--) for (let j2 = y.length - 1; j2 >= 0; j2--) len[i2 * w + j2] = x[i2] === y[j2] ? len[(i2 + 1) * w + j2 + 1] + 1 : Math.max(len[(i2 + 1) * w + j2], len[i2 * w + j2 + 1]);
  const ops = a.slice(0, head).map((line2) => ({ t: " ", line: line2 }));
  let i = 0, j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      ops.push({ t: " ", line: x[i] });
      i++;
      j++;
    } else if (j < y.length && (i === x.length || len[i * w + j + 1] >= len[(i + 1) * w + j])) ops.push({ t: "+", line: y[j++] });
    else ops.push({ t: "-", line: x[i++] });
  }
  for (const line2 of a.slice(a.length - tail)) ops.push({ t: " ", line: line2 });
  return ops;
}
var lines = (s) => {
  if (s === "") return [];
  const ls = s.split("\n");
  if (s.endsWith("\n")) ls.pop();
  return ls;
};
function unifiedDiff(path, before, after, context = 3) {
  const A = lines(before), B = lines(after), ops = script(A, B);
  if (!ops.some((o) => o.t !== " ")) return "";
  const out = [`--- a/${path}`, `+++ b/${path}`];
  const changed = ops.map((o, i) => o.t === " " ? -1 : i).filter((i) => i >= 0);
  let k = 0, aLine = 1, bLine = 1, pos = 0;
  const at4 = [];
  for (const o of ops) {
    at4.push([aLine, bLine]);
    if (o.t !== "+") aLine++;
    if (o.t !== "-") bLine++;
  }
  while (k < changed.length) {
    let from = Math.max(0, changed[k] - context), to = Math.min(ops.length, changed[k] + context + 1);
    while (k + 1 < changed.length && changed[k + 1] - context <= to) {
      k++;
      to = Math.min(ops.length, changed[k] + context + 1);
    }
    k++;
    const body2 = ops.slice(Math.max(from, pos), to);
    from = Math.max(from, pos);
    const aCount = body2.filter((o) => o.t !== "+").length, bCount = body2.filter((o) => o.t !== "-").length;
    const [as, bs] = at4[from];
    out.push(`@@ -${aCount ? as : as - 1}${aCount === 1 ? "" : `,${aCount}`} +${bCount ? bs : bs - 1}${bCount === 1 ? "" : `,${bCount}`} @@`);
    for (const o of body2) out.push(o.t + o.line);
    pos = to;
  }
  return out.join("\n") + "\n";
}

// ../artgen-cli/src/loop/upstream.ts
var MANIFEST = "tools/artgen/MANIFEST.json";
var TARGETS = [["claude/", ".claude/"], ["tools/artgen/", "tools/artgen/"], ["github/", ".github/"]];
var sha = (buf) => createHash2("sha256").update(buf).digest("hex").slice(0, 16);
function distPathOf(installed) {
  const t = TARGETS.find(([, to]) => installed.startsWith(to));
  if (!t) throw new Error(`${installed}: not under a folder the installer writes to`);
  return t[0] + installed.slice(t[1].length);
}
function unfill(text2) {
  return text2.split("node tools/artgen/artgen-maps.js").join("{{ARTGEN}}").split("node tools/artgen/artgen.js").join("{{ARTGEN}}").split("`/artgen-direction`").join("{{CMD_DIRECTION}}").replace(/(^|[\s`(])\/artgen-(?=[a-z])/g, "$1{{CMD}}");
}
async function baseOf(version, installed, o) {
  const dist = distPathOf(installed);
  if (o.base) {
    for (const f of [join9(o.base, "dist", dist), join9(o.base, dist)]) if (existsSync9(f)) return readFileSync9(f);
    return void 0;
  }
  try {
    const res = await (o.fetchImpl ?? fetch)(`https://raw.githubusercontent.com/${o.repo ?? DEFAULT_REPO}/artgen-dist-v${version}/dist/${dist}`);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : void 0;
  } catch {
    return void 0;
  }
}
async function upstream(root, o = {}) {
  root = resolve8(root);
  const mf = join9(root, MANIFEST);
  if (!existsSync9(mf)) throw new Error("upstream: artgen is not installed here (tools/artgen/MANIFEST.json not found)");
  const m = JSON.parse(readFileSync9(mf, "utf8"));
  if (!m.sources) throw new Error(`upstream: this install (${m.version}) does not record where its files come from \u2014 run \`npx -y github:${o.repo ?? DEFAULT_REPO}#artgen-dist update\` once, then try again`);
  const files = [], patches = [];
  for (const [installed, hash] of Object.entries(m.files)) {
    const f = join9(root, installed);
    if (!existsSync9(f)) {
      files.push({ installed, source: m.sources[installed], status: "deleted", note: "deleted here; remove it in the source by hand if that is meant" });
      continue;
    }
    const cur = readFileSync9(f);
    if (sha(cur) === hash) continue;
    const source = m.sources[installed];
    if (!source) {
      files.push({ installed, status: "built", note: "built from the sources, not copied: change the source it is built from" });
      continue;
    }
    if (cur.includes(0)) {
      files.push({ installed, source, status: "binary", note: "not a text file" });
      continue;
    }
    const base = await baseOf(m.version, installed, o);
    if (!base) {
      files.push({ installed, source, status: "no-base", note: `the file as installed (${m.version}) could not be fetched: pass --base <the artgen-dist folder at that version>` });
      continue;
    }
    const patch2 = unifiedDiff(source, unfill(base.toString("utf8")), unfill(cur.toString("utf8")));
    const drift = sha(base) !== hash ? `the base is not the file as installed (hash ${sha(base)}, installed ${hash}): the patch may include changes from another release` : void 0;
    if (!patch2) {
      files.push({ installed, source, status: "same", note: "edited only where the build fills in a value" });
      continue;
    }
    patches.push(patch2);
    files.push({ installed, source, status: "patch", ...drift && { note: drift } });
  }
  const patch = patches.join("");
  let out;
  if (patch) {
    const date = (o.now ?? /* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    out = resolve8(o.out ?? join9(root, existsSync9(join9(root, "art")) ? join9("art", "feedback") : ".", `upstream-${date}.patch`));
    mkdirSync8(dirname8(out), { recursive: true });
    writeFileSync8(out, patch);
  }
  return { version: m.version, patch, files, ...out && { out } };
}

// ../artgen-cli/src/ui-server.ts
import { randomBytes, timingSafeEqual } from "node:crypto";
import { appendFileSync as appendFileSync2, existsSync as existsSync10, lstatSync, mkdirSync as mkdirSync9, readdirSync as readdirSync7, readFileSync as readFileSync10, realpathSync, statSync as statSync3, writeFileSync as writeFileSync9 } from "node:fs";
import { createServer } from "node:http";
import { basename as basename4, dirname as dirname9, extname as extname3, join as join10, resolve as resolve9, sep as sep2 } from "node:path";
var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};
var MAX_WRITE = 64 * 1024 * 1024;
var HttpError = class extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function artPath(raw) {
  if (raw.includes("\0") || raw.includes("\\") || raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) throw new HttpError(400, `bad path ${JSON.stringify(raw)}`);
  const parts = raw.split("/").filter(Boolean);
  if (parts.some((p2) => p2 === "." || p2 === ".." || p2.toLowerCase() === ".git")) throw new HttpError(400, `bad path ${JSON.stringify(raw)}`);
  return parts;
}
var ArtFiles = class {
  art;
  constructor(root) {
    const art = join10(resolve9(root), "art");
    if (!existsSync10(art)) throw new Error(`${art} does not exist`);
    this.art = realpathSync(art);
  }
  /**
   * The absolute path of `parts` under `art/`, refusing one that leaves it through a symbolic link. Every part that exists
   * is looked at, so a link to a folder outside, and a link to nothing (which a write would create the target of), are both refused.
   */
  at(parts) {
    let cur = this.art;
    for (const part of parts) {
      cur = join10(cur, part);
      const l = lstatSync(cur, { throwIfNoEntry: false });
      if (!l) break;
      if (l.isSymbolicLink()) {
        let real;
        try {
          real = realpathSync(cur);
        } catch {
          throw new HttpError(403, "path leaves art/");
        }
        if (real !== this.art && !real.startsWith(this.art + sep2)) throw new HttpError(403, "path leaves art/");
      }
    }
    return join10(this.art, ...parts);
  }
  list(dir) {
    const p2 = this.at(artPath(dir));
    if (!existsSync10(p2) || !statSync3(p2).isDirectory()) return [];
    return readdirSync7(p2, { withFileTypes: true }).filter((e) => e.name !== ".git").map((e) => e.isDirectory() || e.isSymbolicLink() && statSync3(join10(p2, e.name), { throwIfNoEntry: false })?.isDirectory() ? `${e.name}/` : e.name).sort();
  }
  stat(path) {
    const s = statSync3(this.at(artPath(path)), { throwIfNoEntry: false });
    return s?.isFile() ? { size: s.size, lastModified: Math.trunc(s.mtimeMs) } : void 0;
  }
  read(path) {
    const p2 = this.at(artPath(path));
    return statSync3(p2, { throwIfNoEntry: false })?.isFile() ? readFileSync10(p2) : void 0;
  }
  write(path, data) {
    const parts = artPath(path);
    if (!parts.length) throw new HttpError(400, "no file name");
    const p2 = this.at(parts);
    mkdirSync9(dirname9(p2), { recursive: true });
    this.at(parts);
    writeFileSync9(p2, data);
  }
  append(path, data) {
    const parts = artPath(path);
    if (!parts.length) throw new HttpError(400, "no file name");
    const p2 = this.at(parts);
    mkdirSync9(dirname9(p2), { recursive: true });
    appendFileSync2(p2, data);
  }
};
var sameToken = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
async function body(req) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > MAX_WRITE) throw new HttpError(413, "too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
var send = (res, status, data, type = "application/json; charset=utf-8", extra = {}) => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra });
  res.end(data);
};
async function startUiServer(o) {
  const files = new ArtFiles(o.root), ui = resolve9(o.uiDir), token = o.token ?? randomBytes(16).toString("hex");
  if (!existsSync10(join10(ui, "index.html"))) throw new Error(`no web tools in ${ui} \u2014 install the ui module: npx -y github:rstevenson1237/image_tools#artgen-dist add ui`);
  let port = 0;
  const hostOk = (h) => h === `127.0.0.1:${port}` || h === `localhost:${port}`;
  const api = async (req, res, url) => {
    const t = req.headers["x-artgen-token"];
    if (typeof t !== "string" || !sameToken(t, token)) throw new HttpError(401, "missing or wrong token \u2014 open the link `artgen ui` printed");
    const path = url.searchParams.get("path") ?? "", route3 = url.pathname.slice("/api/".length);
    if (req.method === "GET" && route3 === "info") return send(res, 200, JSON.stringify({ name: basename4(resolve9(o.root)), ...o.info }));
    if (req.method === "GET" && route3 === "list") return send(res, 200, JSON.stringify(files.list(url.searchParams.get("dir") ?? "")));
    if (req.method === "GET" && route3 === "stat") return send(res, 200, JSON.stringify(files.stat(path) ?? null));
    if (req.method === "GET" && route3 === "read") {
      const b = files.read(path);
      return b ? send(res, 200, b, "application/octet-stream") : send(res, 204, "");
    }
    if (req.method === "PUT" && route3 === "write") {
      files.write(path, await body(req));
      return send(res, 200, "{}");
    }
    if (req.method === "POST" && route3 === "append") {
      files.append(path, await body(req));
      return send(res, 200, "{}");
    }
    throw new HttpError(404, `no such call: ${req.method} /api/${route3}`);
  };
  const serve = (req, res, url) => {
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "GET only");
    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      throw new HttpError(400, "bad address");
    }
    if (decoded.includes("\0")) throw new HttpError(400, "bad address");
    const rel = decoded.replace(/^\/+/, "") || "index.html";
    const base = o.shared && (rel === "resvg.wasm" || /^fonts\/[^/]+$/.test(rel)) ? resolve9(o.shared) : ui;
    const f = resolve9(base, rel);
    if (f !== base && !f.startsWith(base + sep2)) throw new HttpError(403, "outside the web tools");
    if (!statSync3(f, { throwIfNoEntry: false })?.isFile()) throw new HttpError(404, "not found");
    send(res, 200, req.method === "HEAD" ? "" : readFileSync10(f), TYPES[extname3(f).toLowerCase()] ?? "application/octet-stream", { "cache-control": "no-cache" });
  };
  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (!hostOk(req.headers.host)) throw new HttpError(403, "unexpected Host header");
        let url;
        try {
          url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
        } catch {
          throw new HttpError(400, "bad address");
        }
        if (url.pathname.startsWith("/api/")) await api(req, res, url);
        else serve(req, res, url);
      } catch (e) {
        const status = e instanceof HttpError ? e.status : 500;
        if (!res.headersSent) send(res, status, JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        else res.end();
      }
    })();
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(o.port ?? 0, "127.0.0.1", () => {
      port = server.address().port;
      ok({ url: `http://127.0.0.1:${port}/?t=${token}`, port, token, server, close: () => new Promise((r) => {
        server.close(() => r());
        server.closeAllConnections();
      }) });
    });
  });
}

// ../artgen-cli/src/ops/image.ts
import { existsSync as existsSync11, mkdirSync as mkdirSync10, readFileSync as readFileSync11, writeFileSync as writeFileSync10 } from "node:fs";
import { basename as basename5, dirname as dirname10, extname as extname4, join as join11, resolve as resolve10 } from "node:path";

// ../artgen-imagekit/src/mask.ts
var newMask = (w, h) => ({ w, h, d: new Uint8Array(w * h) });
function grayscale(img) {
  const out = new Uint8Array(img.w * img.h), d = img.d;
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = d[j] * 9798 + d[j + 1] * 19235 + d[j + 2] * 3735 + 16384 >> 15;
  return out;
}
function gaussianKernel(size2) {
  const table = { 1: [256], 3: [64, 128, 64], 5: [16, 64, 96, 64, 16], 7: [8, 28, 56, 72, 56, 28, 8] };
  if (table[size2]) return Int32Array.from(table[size2]);
  const sigma = 0.3 * ((size2 - 1) * 0.5 - 1) + 0.8, half = size2 >> 1, v = [];
  let sum = 0;
  for (let i = 0; i < size2; i++) {
    const x = i - half;
    v.push(Math.exp(-0.5 * x * x / (sigma * sigma)));
    sum += v[i];
  }
  const k = new Int32Array(size2);
  let run2 = 0, prev = 0;
  for (let i = 0; i < size2; i++) {
    run2 += v[i] / sum;
    const r = Math.round(run2 * 256);
    k[i] = r - prev;
    prev = r;
  }
  return k;
}
var reflect101 = (i, n) => {
  if (n === 1) return 0;
  while (i < 0 || i >= n) i = i < 0 ? -i : 2 * (n - 1) - i;
  return i;
};
function gaussianBlur(src, w, h, size2) {
  const k = gaussianKernel(size2), half = size2 >> 1, tmp = new Int32Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = 0; i < size2; i++) s += k[i] * src[y * w + reflect101(x + i - half, w)];
    tmp[y * w + x] = s;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = 0; i < size2; i++) s += k[i] * tmp[reflect101(y + i - half, h) * w + x];
    out[y * w + x] = s + 32768 >> 16;
  }
  return out;
}
function otsu(gray) {
  const hist = new Float64Array(256), n = gray.length;
  for (let i = 0; i < n; i++) hist[gray[i]]++;
  const scale = 1 / n;
  let mu = 0;
  for (let i = 0; i < 256; i++) mu += i * hist[i];
  mu *= scale;
  let mu1 = 0, q1 = 0, best = 0, bestLevel = 0;
  const eps = 11920929e-14;
  for (let i = 0; i < 256; i++) {
    const p2 = hist[i] * scale;
    mu1 *= q1;
    q1 += p2;
    const q2 = 1 - q1;
    if (Math.min(q1, q2) < eps || Math.max(q1, q2) > 1 - eps) continue;
    mu1 = (mu1 + i * p2) / q1;
    const mu2 = (mu - q1 * mu1) / q2, sigma = q1 * q2 * (mu1 - mu2) * (mu1 - mu2);
    if (sigma > best) {
      best = sigma;
      bestLevel = i;
    }
  }
  return bestLevel;
}
function thresholdPlane(gray, w, h, level2, light) {
  const out = newMask(w, h), t = Math.floor(level2);
  for (let i = 0; i < gray.length; i++) out.d[i] = gray[i] > t === light ? 255 : 0;
  return out;
}
function ellipseKernel(size2) {
  const r = size2 >> 1, c = size2 >> 1, inv = r ? 1 / (r * r) : 0, half = [];
  for (let i = 0; i < size2; i++) {
    const dy = i - r;
    half.push(Math.abs(dy) <= r ? Math.round(c * Math.sqrt((r * r - dy * dy) * inv)) : -1);
  }
  return half;
}
function dilate(m, size2) {
  const { w, h } = m, half = ellipseKernel(size2), r = size2 >> 1, out = newMask(w, h);
  const rowsOf = /* @__PURE__ */ new Map();
  half.forEach((hw, i) => {
    if (hw >= 0) rowsOf.set(hw, [...rowsOf.get(hw) ?? [], i - r]);
  });
  const wide = new Uint8Array(w * h), pre = new Int32Array(w + 1);
  for (const [hw, dys] of rowsOf) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + (m.d[y * w + x] ? 1 : 0);
      for (let x = 0; x < w; x++) wide[y * w + x] = pre[Math.min(w, x + hw + 1)] - pre[Math.max(0, x - hw)] > 0 ? 255 : 0;
    }
    for (const dy of dys) for (let y = 0; y < h; y++) {
      const sy = y + dy;
      if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) if (wide[sy * w + x]) out.d[y * w + x] = 255;
    }
  }
  return out;
}
function erode(m, size2) {
  const inv = newMask(m.w, m.h);
  for (let i = 0; i < m.d.length; i++) inv.d[i] = m.d[i] ? 0 : 255;
  const d = dilate(inv, size2);
  for (let i = 0; i < d.d.length; i++) d.d[i] = d.d[i] ? 0 : 255;
  return d;
}
var close = (m, size2) => erode(dilate(m, size2), size2);
function binarize(img, o) {
  const { w, h } = img;
  let gray = grayscale(img);
  if (o.blur > 0) gray = gaussianBlur(gray, w, h, Math.max(3, o.blur | 1));
  const level2 = o.threshold === "otsu" ? otsu(gray) : Math.floor(o.threshold);
  let binary = thresholdPlane(gray, w, h, level2, o.invert);
  if (o.smoothing > 0) binary = close(binary, Math.max(3, o.smoothing | 1));
  if (o.respectAlpha) {
    for (let i = 0; i < binary.d.length; i++) if (img.d[i * 4 + 3] === 0) binary.d[i] = 0;
  }
  return { binary, thresholdUsed: level2 };
}

// ../artgen-imagekit/src/contours.ts
var DX = [1, 1, 0, -1, -1, -1, 0, 1];
var DY = [0, -1, -1, -1, 0, 1, 1, 1];
function findContours(mask) {
  const { w, h } = mask, W = w + 2, lab = new Int32Array(W * (h + 2)), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask.d[y * w + x]) lab[(y + 1) * W + x + 1] = 1;
  const step = DX.map((dx, d) => dx + DY[d] * W);
  const hole = [false, true], parent = [-1, -1], index = [-1, -1];
  let nbd = 1;
  for (let y = 1; y <= h; y++) {
    let lnbd = 1;
    for (let x = 1; x <= w; x++) {
      const at4 = y * W + x, f = lab[at4];
      if (f === 0) continue;
      let isHole;
      if (f === 1 && lab[at4 - 1] === 0) isHole = false;
      else if (f >= 1 && lab[at4 + 1] === 0) {
        isHole = true;
        if (f > 1) lnbd = f;
      } else {
        if (f !== 1) lnbd = Math.abs(f);
        continue;
      }
      nbd++;
      hole[nbd] = isHole;
      parent[nbd] = isHole === hole[lnbd] ? parent[lnbd] : lnbd;
      index[nbd] = out.length;
      out.push(follow(lab, W, step, at4, isHole, nbd));
      if (lab[at4] !== 1) lnbd = Math.abs(lab[at4]);
    }
  }
  let n = 2;
  for (const c of out) {
    c.parent = parent[n] < 2 ? -1 : index[parent[n]];
    n++;
  }
  return out;
}
function follow(lab, W, step, start, isHole, nbd) {
  const chain = [];
  const xy = (i) => {
    chain.push(i % W - 1, Math.floor(i / W) - 1);
  };
  let first = -1;
  for (let k = 0, d = isHole ? 0 : 4; k < 8; k++, d = d + 7 & 7) if (lab[start + step[d]] !== 0) {
    first = d;
    break;
  }
  if (first < 0) {
    lab[start] = -nbd;
    xy(start);
    return { points: Int32Array.from(chain), hole: isHole, parent: -1, chain: Int32Array.from(chain) };
  }
  const i1 = start + step[first];
  let i3 = start, toI2 = first;
  for (; ; ) {
    let d = toI2, eastEmpty = false;
    for (let k = 0; k < 8; k++) {
      d = d + 1 & 7;
      if (lab[i3 + step[d]] !== 0) break;
      if (d === 0) eastEmpty = true;
    }
    const i4 = i3 + step[d];
    if (eastEmpty) lab[i3] = -nbd;
    else if (lab[i3] === 1) lab[i3] = nbd;
    xy(i3);
    if (i4 === start && i3 === i1) break;
    toI2 = d + 4 & 7;
    i3 = i4;
  }
  const all = Int32Array.from(chain), n = all.length / 2, pts2 = [];
  const dir = (a, b) => Math.sign(all[b * 2] - all[a * 2]) * 3 + Math.sign(all[b * 2 + 1] - all[a * 2 + 1]);
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n, next4 = (i + 1) % n;
    if (n === 1 || dir(prev, i) !== dir(i, next4)) pts2.push(all[i * 2], all[i * 2 + 1]);
  }
  return { points: Int32Array.from(pts2), hole: isHole, parent: -1, chain: all };
}
function ringArea(p2) {
  const n = p2.length / 2;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s += p2[i * 2] * p2[j * 2 + 1] - p2[j * 2] * p2[i * 2 + 1];
  }
  return Math.abs(s) / 2;
}
function simplifyRing(p2, epsilon) {
  const count = p2.length / 2;
  if (count === 0) return [];
  const px = (i) => p2[i % count * 2], py = (i) => p2[i % count * 2 + 1], eps = epsilon * epsilon;
  let pos = 0, far = 0, closed = true;
  for (let it = 0; it < 3; it++) {
    pos = (pos + far) % count;
    let max2 = 0;
    for (let j = 1; j < count; j++) {
      const dx = px(j + pos) - px(pos), dy = py(j + pos) - py(pos), dist = dx * dx + dy * dy;
      if (dist > max2) {
        max2 = dist;
        far = j;
      }
    }
    closed = max2 > eps;
  }
  if (!closed) return [px(pos), py(pos)];
  const stack = [], dst = [];
  const mid = pos + far;
  stack.push([mid, pos + count]);
  stack.push([pos, mid]);
  while (stack.length) {
    const [a, b] = stack.pop(), ax = px(a), ay = py(a), bx = px(b), by = py(b);
    let split = -1, ok;
    if (ax !== bx || ay !== by) {
      const dx = bx - ax, dy = by - ay;
      let max2 = 0;
      for (let i = a + 1; i < b; i++) {
        const dist = Math.abs((py(i) - ay) * dx - (px(i) - ax) * dy);
        if (dist > max2) {
          max2 = dist;
          split = i;
        }
      }
      ok = max2 * max2 <= eps * (dx * dx + dy * dy);
    } else {
      ok = true;
      for (let i = a + 1; i < b; i++) {
        const dx = px(i) - ax, dy = py(i) - ay;
        if (dx * dx + dy * dy > eps) {
          ok = false;
          split = i;
        }
      }
    }
    if (ok || split < 0) dst.push(ax, ay);
    else {
      stack.push([split, b]);
      stack.push([a, split]);
    }
  }
  const n = dst.length / 2;
  let newCount = n, at4 = n - 1;
  const read = () => {
    const q = [dst[at4 * 2], dst[at4 * 2 + 1]];
    at4 = (at4 + 1) % n;
    return q;
  };
  let start = read(), wpos = at4, pt3 = read();
  for (let i = 0; i < n && newCount > 2; i++) {
    const end = read(), dx = end[0] - start[0], dy = end[1] - start[1];
    const dist = Math.abs((pt3[0] - start[0]) * dy - (pt3[1] - start[1]) * dx);
    const inner = (pt3[0] - start[0]) * (end[0] - pt3[0]) + (pt3[1] - start[1]) * (end[1] - pt3[1]);
    if (dist * dist <= 0.5 * eps * (dx * dx + dy * dy) && dx !== 0 && dy !== 0 && inner >= 0) {
      newCount--;
      dst[wpos * 2] = end[0];
      dst[wpos * 2 + 1] = end[1];
      start = end;
      wpos = (wpos + 1) % n;
      pt3 = read();
      i++;
      continue;
    }
    dst[wpos * 2] = pt3[0];
    dst[wpos * 2 + 1] = pt3[1];
    start = pt3;
    wpos = (wpos + 1) % n;
    pt3 = end;
  }
  return dst.slice(0, newCount * 2);
}

// ../artgen-imagekit/src/trace.ts
var defaultTraceOptions = {
  threshold: "otsu",
  invert: false,
  blur: 3,
  smoothing: 3,
  respectAlpha: true,
  simplifyTolerance: 1.5,
  minArea: 24,
  keepHoles: true,
  maxPaths: 120
};
function contourShapes(mask, holes = true) {
  const all = findContours(mask), out = [], slot = /* @__PURE__ */ new Map();
  for (let i = all.length - 1; i >= 0; i--) {
    const c = all[i];
    if (c.hole || !holes && c.parent >= 0) continue;
    const s = { outer: c, holes: [] };
    slot.set(i, s);
    out.push(s);
  }
  if (holes) {
    for (let i = all.length - 1; i >= 0; i--) if (all[i].hole) slot.get(all[i].parent)?.holes.push(all[i]);
  }
  return out;
}
function traceMask(mask, o = {}, thresholdUsed = 0) {
  const s = { ...defaultTraceOptions, ...o };
  let dropped = 0;
  const ring2 = (c) => {
    const area3 = ringArea(c.points);
    if (area3 < s.minArea) return null;
    let pts2 = c.points;
    if (s.simplifyTolerance > 0) {
      const simple = simplifyRing(c.points, s.simplifyTolerance);
      if (simple.length >= 6) pts2 = simple;
    }
    return pts2.length < 6 ? null : { points: Float32Array.from(pts2), area: area3 };
  };
  const shapes = [];
  for (const sh of contourShapes(mask, s.keepHoles)) {
    const outer = ring2(sh.outer);
    if (!outer) {
      dropped++;
      continue;
    }
    const holes = [];
    for (const h of sh.holes) {
      const r = ring2(h);
      if (r) holes.push(r);
      else dropped++;
    }
    shapes.push({ outer, holes });
  }
  shapes.sort((a, b) => b.outer.area - a.outer.area);
  if (shapes.length > s.maxPaths) {
    dropped += shapes.length - s.maxPaths;
    shapes.length = s.maxPaths;
  }
  return { width: mask.w, height: mask.h, shapes, droppedCount: dropped, thresholdUsed };
}
function traceImage(img, o = {}) {
  const s = { ...defaultTraceOptions, ...o };
  const { binary, thresholdUsed } = binarize(img, s);
  return traceMask(binary, s, thresholdUsed);
}

// ../artgen-imagekit/src/cut.ts
function alphaBounds(img, padding = 0, min = 0) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.d[(y * img.w + x) * 4 + 3] > min) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const px0 = Math.max(0, x0 - padding), py0 = Math.max(0, y0 - padding), px1 = Math.min(img.w - 1, x1 + padding), py1 = Math.min(img.h - 1, y1 + padding);
  return { x: px0, y: py0, w: px1 - px0 + 1, h: py1 - py0 + 1 };
}

// ../artgen-primitives/src/lib/palette.ts
function parseHexPalette(text2) {
  const out = [];
  for (const line2 of text2.split(/\r?\n/)) {
    const m = line2.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (m) out.push("#" + m[1].toLowerCase());
  }
  return out;
}
function parseGpl(text2) {
  const out = [];
  for (const line2 of text2.split(/\r?\n/)) {
    const m = line2.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(\s|$)/);
    if (m) out.push(toHex(+m[1], +m[2], +m[3]));
  }
  return out;
}
function medianCut(g, n) {
  const px = [];
  for (let i = 0; i < g.w * g.h; i++) if (g.d[i * 4 + 3] >= 128) px.push([g.d[i * 4], g.d[i * 4 + 1], g.d[i * 4 + 2]]);
  if (!px.length) return [];
  const boxes = [px];
  const range = (b, c) => {
    let lo = 255, hi = 0;
    for (const p2 of b) {
      if (p2[c] < lo) lo = p2[c];
      if (p2[c] > hi) hi = p2[c];
    }
    return hi - lo;
  };
  while (boxes.length < n) {
    let bi = -1, bc = 0, br = 0;
    boxes.forEach((b2, i) => {
      for (let c = 0; c < 3; c++) {
        const r = range(b2, c);
        if (b2.length > 1 && r > br) {
          br = r;
          bi = i;
          bc = c;
        }
      }
    });
    if (bi < 0) break;
    const b = boxes[bi].sort((p2, q) => p2[bc] - q[bc]), mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  const out = boxes.map((b) => {
    const s = b.reduce((a, p2) => [a[0] + p2[0], a[1] + p2[1], a[2] + p2[2]], [0, 0, 0]);
    return toHex(Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length));
  });
  return [...new Set(out)];
}
function rampsFromColors(colors, { hueGap = 30, greySat = 0.12 } = {}) {
  const hs = colors.map((c) => ({ c, ...toHsl(c) }));
  const greys = hs.filter((x) => x.s < greySat), chroma = hs.filter((x) => x.s >= greySat).sort((a, b) => a.h - b.h);
  const groups = [];
  for (const x of chroma) {
    const last = groups[groups.length - 1];
    if (last && x.h - last[last.length - 1].h <= hueGap) last.push(x);
    else groups.push([x]);
  }
  if (groups.length > 1) {
    const first = groups[0], last = groups[groups.length - 1];
    if (first[0].h + 360 - last[last.length - 1].h <= hueGap) {
      first.unshift(...last);
      groups.pop();
    }
  }
  if (greys.length) groups.push(greys);
  const ramps = {};
  groups.forEach((g, i) => {
    ramps[`r${i}`] = g.map((x) => x.c).sort((a, b) => lumaOf(b) - lumaOf(a));
  });
  return ramps;
}
function extractPalette(g, n = 16) {
  const colors = medianCut(g, n);
  return { colors, ramps: rampsFromColors(colors) };
}

// ../artgen-imagekit/src/palette.ts
var grid = (img) => img instanceof Grid2 ? img : new Grid2(img.w, img.h, Uint8ClampedArray.from(img.d));
function paletteOf(img, n = 16) {
  return extractPalette(grid(img), n);
}
function snapToPalette(img, colors, o = {}) {
  if (!colors.length) throw new Error("snapToPalette: the palette has no colours");
  const g = quantize(grid(img), colors.map(normHex), o);
  return { w: g.w, h: g.h, d: g.d };
}
var formatHex = (colors) => colors.map((c) => normHex(c).slice(1)).join("\n") + "\n";
function formatGpl(colors, name = "artgen") {
  const rows2 = colors.map((c, i) => {
    const h = normHex(c), v = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    return `${String(v[0]).padStart(3)} ${String(v[1]).padStart(3)} ${String(v[2]).padStart(3)} ${h} (${i + 1})`;
  });
  return `GIMP Palette
Name: ${name}
Columns: 8
#
${rows2.join("\n")}
`;
}
var parsePaletteText = (text2) => /^GIMP Palette/m.test(text2) ? parseGpl(text2) : parseHexPalette(text2);

// ../artgen-imagekit/src/slice.ts
function sliceGrid(img, o) {
  const margin = o.margin ?? 0, spacing = o.spacing ?? 0, usableW = img.w - 2 * margin, usableH = img.h - 2 * margin;
  let cols = o.cols, rows2 = o.rows, cw = o.cellW, ch = o.cellH;
  if (cw && ch) {
    cols = Math.floor((usableW + spacing) / (cw + spacing));
    rows2 = Math.floor((usableH + spacing) / (ch + spacing));
  } else if (cols && rows2) {
    cw = Math.floor((usableW - spacing * (cols - 1)) / cols);
    ch = Math.floor((usableH - spacing * (rows2 - 1)) / rows2);
  } else throw new Error("slice: give the columns and rows (cols, rows) or the cell size (cellW, cellH)");
  if (!cols || !rows2 || !cw || !ch || cols < 1 || rows2 < 1 || cw < 1 || ch < 1) throw new Error(`slice: no room for a cell in a ${img.w}x${img.h} picture with those numbers`);
  const out = [];
  for (let row = 0; row < rows2; row++) for (let col = 0; col < cols; col++) {
    let box2 = { x: margin + col * (cw + spacing), y: margin + row * (ch + spacing), w: cw, h: ch };
    if (o.skipEmpty || o.trim) {
      const b = alphaBounds(crop(img, box2));
      if (!b) {
        if (o.skipEmpty) continue;
      } else if (o.trim) box2 = { x: box2.x + b.x, y: box2.y + b.y, w: b.w, h: b.h };
    }
    out.push({ ...box2, index: out.length, col, row });
  }
  return out;
}
function sliceSprites(img, o = {}) {
  const gap = Math.max(0, Math.floor(o.gap ?? 1)), minSize = o.minSize ?? 2, { w, h } = img, W = w + 1;
  const sum = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sum[(y + 1) * W + x + 1] = (img.d[(y * w + x) * 4 + 3] > 0 ? 1 : 0) + sum[y * W + x + 1] + sum[(y + 1) * W + x] - sum[y * W + x];
  const grown = (x, y) => {
    const x0 = Math.max(0, x - gap), y0 = Math.max(0, y - gap);
    return sum[(y + 1) * W + x + 1] - sum[y0 * W + x + 1] - sum[(y + 1) * W + x0] + sum[y0 * W + x0] > 0;
  };
  const label4 = new Int32Array(w * h).fill(-1), boxes = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (label4[y * w + x] >= 0 || !grown(x, y)) continue;
    const id2 = boxes.length, stack = [y * w + x];
    boxes.push({ x0: w, y0: h, x1: -1, y1: -1 });
    label4[y * w + x] = id2;
    while (stack.length) {
      const i = stack.pop(), cx = i % w, cy = (i - cx) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || label4[ny * w + nx] >= 0 || !grown(nx, ny)) continue;
        label4[ny * w + nx] = id2;
        stack.push(ny * w + nx);
      }
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (img.d[(y * w + x) * 4 + 3] === 0) continue;
    const b = boxes[label4[y * w + x]];
    if (x < b.x0) b.x0 = x;
    if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y;
    if (y > b.y1) b.y1 = y;
  }
  const found = boxes.filter((b) => b.x1 >= 0).map((b) => ({ x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 })).filter((b) => b.w >= minSize && b.h >= minSize);
  const tall = found.length ? found.reduce((n, b) => n + b.h, 0) / found.length : 0;
  const rowsOf = [];
  for (const b of [...found].sort((p2, q) => p2.y - q.y)) {
    const row = rowsOf.find((r) => Math.abs(r[0].y - b.y) < tall / 2);
    if (row) row.push(b);
    else rowsOf.push([b]);
  }
  const out = [];
  rowsOf.forEach((r, row) => r.sort((p2, q) => p2.x - q.x).forEach((b, col) => out.push({ ...b, index: out.length, col, row })));
  return out;
}
function crop(img, box2) {
  const x0 = Math.max(0, box2.x), y0 = Math.max(0, box2.y), x1 = Math.min(img.w, box2.x + box2.w), y1 = Math.min(img.h, box2.y + box2.h);
  const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0), d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) d[(y * w + x) * 4 + c] = img.d[((y0 + y) * img.w + x0 + x) * 4 + c];
  return { w, h, d };
}

// ../artgen-imagekit/src/svg.ts
var HEX = /^#[0-9a-fA-F]{6}$/;
var num3 = (v, precision) => String(Number(v.toFixed(precision)));
var PIXEL_CENTRES = { sx: 1, sy: 1, ox: 0.5, oy: 0.5 };
function ringToD(r, precision = 2, map = PIXEL_CENTRES) {
  const p2 = r.points, parts = [];
  for (let i = 0; i < p2.length; i += 2) parts.push(`${i === 0 ? "M" : "L"}${num3(p2[i] * map.sx + map.ox, precision)} ${num3(p2[i + 1] * map.sy + map.oy, precision)}`);
  return parts.join(" ") + " Z";
}
function shapeDs(t, precision = 2, map) {
  return t.shapes.map((s) => [s.outer, ...s.holes].map((r) => ringToD(r, precision, map)).join(" "));
}
function traceToSvg(t, o = {}) {
  const fill = o.fill && HEX.test(o.fill) ? o.fill.toLowerCase() : "#000000", precision = o.precision ?? 2;
  const lines2 = [`<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="0 0 ${t.width} ${t.height}">`];
  if (o.background && HEX.test(o.background)) lines2.push(`  <rect width="${t.width}" height="${t.height}" fill="${o.background.toLowerCase()}"/>`);
  for (const d of shapeDs(t, precision)) lines2.push(`  <path fill="${fill}" fill-rule="evenodd" d="${d}"/>`);
  lines2.push("</svg>", "");
  return lines2.join("\n");
}

// ../artgen-primitives/src/lib/rotsprite.ts
function same(d, i, j) {
  if (d[i + 3] !== d[j + 3]) return false;
  return d[i + 3] === 0 || d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2];
}
function scale2x(g) {
  const { w, h, d } = g, out = new Grid2(w * 2, h * 2), o = out.d;
  const put = (x, y, i) => {
    const k = (y * w * 2 + x) * 4;
    o[k] = d[i];
    o[k + 1] = d[i + 1];
    o[k + 2] = d[i + 2];
    o[k + 3] = d[i + 3];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p2 = (y * w + x) * 4, a = y > 0 ? p2 - w * 4 : p2, b = x < w - 1 ? p2 + 4 : p2, c = x > 0 ? p2 - 4 : p2, e = y < h - 1 ? p2 + w * 4 : p2;
    const ca = same(d, c, a), ab = same(d, a, b), dc = same(d, e, c), bd = same(d, b, e);
    put(x * 2, y * 2, ca && !dc && !ab ? a : p2);
    put(x * 2 + 1, y * 2, ab && !ca && !bd ? b : p2);
    put(x * 2, y * 2 + 1, dc && !bd && !ca ? c : p2);
    put(x * 2 + 1, y * 2 + 1, bd && !ab && !dc ? e : p2);
  }
  return out;
}
var EPS = 1e-9;
var norm = (deg) => (deg % 360 + 360) % 360;
var quarter = (deg) => {
  const q = norm(deg) / 90, r = Math.round(q);
  return Math.abs(q - r) < EPS ? r % 4 : -1;
};
function inverse(w, h, deg, pivot, shift = [0, 0]) {
  const [px, py] = pivot ?? [(w - 1) / 2, (h - 1) / 2], q = quarter(deg), r = norm(deg) * Math.PI / 180;
  const c = q < 0 ? Math.cos(r) : [1, 0, -1, 0][q], s = q < 0 ? Math.sin(r) : [0, 1, 0, -1][q];
  return (ox, oy) => {
    const dx = ox - shift[0] - px, dy = oy - shift[1] - py;
    return [px + c * dx + s * dy + 0.5, py - s * dx + c * dy + 0.5];
  };
}
function rotsprite(g, deg, o = {}) {
  const [ow, oh] = o.size ?? [g.w, g.h], out = new Grid2(ow, oh);
  const shift = [Math.floor((ow - g.w) / 2), Math.floor((oh - g.h) / 2)];
  const inv = inverse(g.w, g.h, deg, o.pivot, shift);
  const exact = quarter(deg) >= 0;
  let src = g, k = 1;
  if (!exact) {
    src = scale2x(scale2x(scale2x(g)));
    k = 8;
  }
  const { w, h, d } = src;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const [u, v] = inv(x, y), sx = Math.floor(u * k + EPS), sy = Math.floor(v * k + EPS);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
    const i = (sy * w + sx) * 4, j = (y * ow + x) * 4;
    if (d[i + 3]) {
      out.d[j] = d[i];
      out.d[j + 1] = d[i + 1];
      out.d[j + 2] = d[i + 2];
      out.d[j + 3] = d[i + 3];
    }
  }
  return out;
}

// ../artgen-cli/src/ops/image.ts
function readPicture(file) {
  if (!existsSync11(file)) throw new Error(`${file}: not found`);
  try {
    return decodePNG(new Uint8Array(readFileSync11(file)));
  } catch (e) {
    throw new Error(`${file}: ${e.message} (artgen reads 8-bit PNG files)`);
  }
}
function writePicture(file, img) {
  mkdirSync10(dirname10(file), { recursive: true });
  writeFileSync10(file, encodePNG(img instanceof Grid2 ? img : new Grid2(img.w, img.h, Uint8ClampedArray.from(img.d))));
}
var stemOf2 = (file) => join11(dirname10(file), basename5(file, extname4(file)));
var traceParams = () => ({
  threshold: p.str("grey level 0\u2013255 that splits subject from background, or otsu (default: otsu picks one)"),
  invert: p.bool("the lighter region is the subject, not the darker one"),
  blur: p.int("Gaussian blur kernel before the threshold; 0 = none (default 3)"),
  smoothing: p.int("close kernel that seals speckle; 0 = none (default 3)"),
  simplify: p.num("Douglas\u2013Peucker tolerance in pixels; 0 keeps every corner (default 1.5)"),
  min_area: p.num("drop shapes under this area in px\xB2 (default 24)"),
  holes: p.bool("trace the holes in a shape (off: outlines only; default on)", { style: "onoff" }),
  max_paths: p.int("keep at most this many shapes, largest first (default 120)"),
  alpha: p.bool("read only the opaque pixels, so transparent art traces its own shape (default on)", { style: "onoff" })
});
function traceOptions(i) {
  const t = i.threshold;
  if (t !== void 0 && t !== "otsu" && !(Number.isFinite(+t) && +t >= 0 && +t <= 255)) throw new Error("--threshold: otsu or a grey level from 0 to 255");
  return {
    ...t !== void 0 && { threshold: t === "otsu" ? "otsu" : +t },
    ...i.invert && { invert: true },
    ...i.blur !== void 0 && { blur: i.blur },
    ...i.smoothing !== void 0 && { smoothing: i.smoothing },
    ...i.simplify !== void 0 && { simplifyTolerance: i.simplify },
    ...i.min_area !== void 0 && { minArea: i.min_area },
    ...i.holes !== void 0 && { keepHoles: i.holes },
    ...i.max_paths !== void 0 && { maxPaths: i.max_paths },
    ...i.alpha !== void 0 && { respectAlpha: i.alpha }
  };
}
var traceSummary = (t) => ({ width: t.width, height: t.height, shapes: t.shapes.length, holes: t.shapes.reduce((n, s) => n + s.holes.length, 0), dropped: t.droppedCount, threshold: t.thresholdUsed });
var BY_PATH = "reads a file by path outside the art/ sandbox";
function hexFlag(v, flag) {
  if (v === void 0) return void 0;
  if (typeof v !== "string" || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${flag}: a colour like #rrggbb`);
  return v;
}
var trace = defineOp({
  name: "trace",
  module: "core",
  effect: "render",
  summary: "Trace a picture or sketch to an SVG of closed shapes (outlines and their holes).",
  params: {
    image: p.str("the picture (PNG)", { positional: true, required: "trace: <image.png> is required" }),
    out: p.str("the SVG to write (default: beside the picture, .svg)"),
    fill: p.str("the shapes' colour, #rrggbb (default #000000)"),
    background: p.str("a background colour, #rrggbb (default none)"),
    ...traceParams()
  },
  run(i) {
    const fill = hexFlag(i.fill, "--fill"), background = hexFlag(i.background, "--background"), file = resolve10(i.image);
    const t = traceImage(readPicture(file), traceOptions(i)), out = resolve10(i.out ?? `${stemOf2(file)}.svg`);
    mkdirSync10(dirname10(out), { recursive: true });
    writeFileSync10(out, traceToSvg(t, { fill, background }));
    return { out, ...traceSummary(t) };
  },
  cli: {
    usage: "       artgen trace <image.png> [--out file.svg] [--threshold otsu|0-255] [--invert] [--blur n] [--smoothing n] [--simplify px] [--min-area px\xB2] [--holes off] [--max-paths n] [--fill #rrggbb] [--background #rrggbb]",
    text: (r) => `${r.out}: ${r.shapes} shapes${r.holes ? `, ${r.holes} holes` : ""} from a ${r.width}x${r.height} picture (level ${r.threshold}${r.dropped ? `, ${r.dropped} dropped` : ""})
next: artgen trace-base <asset> <image> turns it into an asset's base; artgen map trace <map> <image> into a map's ground`
  },
  mcp: { exclude: BY_PATH },
  python: {}
});
var slice = defineOp({
  name: "slice",
  module: "core",
  effect: "render",
  summary: "Cut an outside sprite sheet into its sprites (a regular grid, or loose sprites found by their pixels).",
  params: {
    image: p.str("the sprite sheet (PNG)", { positional: true, required: "slice: <sheet.png> is required" }),
    cols: p.int("cells across (with --rows)"),
    rows: p.int("cells down (with --cols)"),
    cell: p.size("cell size, WxH, e.g. 32x32 (instead of --cols and --rows)"),
    auto: p.bool("find loose sprites by their opaque pixels instead of a grid"),
    gap: p.int("--auto: pixels apart that still count as one sprite (default 1)"),
    min_size: p.int("--auto: ignore blobs smaller than this either way (default 2)"),
    margin: p.int("grid: pixels around the sheet that belong to no cell (default 0)"),
    spacing: p.int("grid: pixels between cells (default 0)"),
    skip_empty: p.bool("grid: leave out cells with nothing opaque"),
    trim: p.bool("grid: shrink each cell to its opaque pixels"),
    out: p.str("the folder to write the cells to (default: <sheet>-slices beside the sheet)")
  },
  run(i) {
    const file = resolve10(i.image), img = readPicture(file), dir = resolve10(i.out ?? `${stemOf2(file)}-slices`);
    const cell2 = Array.isArray(i.cell) ? i.cell : void 0;
    if (i.auto && (cell2 || i.cols || i.rows)) throw new Error("slice: --auto finds the sprites itself; drop --cols, --rows and --cell");
    const cells = i.auto ? sliceSprites(img, { gap: i.gap, minSize: i.min_size }) : sliceGrid(img, { cols: i.cols, rows: i.rows, cellW: cell2?.[0], cellH: cell2?.[1], margin: i.margin, spacing: i.spacing, skipEmpty: i.skip_empty, trim: i.trim });
    if (!cells.length) throw new Error(`${i.image}: no sprites found${i.auto ? " (raise --gap or lower --min-size?)" : ""}`);
    const pad = String(cells.length - 1).length, stem = basename5(file, extname4(file));
    const files = cells.map((c) => ({ ...c, file: `${stem}-${String(c.index).padStart(Math.max(2, pad), "0")}.png` }));
    for (const c of files) writePicture(join11(dir, c.file), crop(img, c));
    writeFileSync10(join11(dir, "slices.json"), JSON.stringify({ sheet: basename5(file), width: img.w, height: img.h, cells: files }, null, 2) + "\n");
    return { dir, sheet: { width: img.w, height: img.h }, cells: files };
  },
  cli: {
    usage: "       artgen slice <sheet.png> --cols n --rows n | --cell WxH | --auto [--gap px] [--min-size px] [--margin px] [--spacing px] [--skip-empty] [--trim] [--out dir]",
    text: (r) => `${r.dir}: ${r.cells.length} cells from a ${r.sheet.width}x${r.sheet.height} sheet (${r.cells[0].w}x${r.cells[0].h} first) + slices.json`
  },
  mcp: { exclude: BY_PATH },
  python: {}
});
function paletteColors(src, n) {
  if (existsSync11(src)) return /\.png$/i.test(src) ? paletteOf(readPicture(src), n).colors : parsePaletteText(readFileSync11(src, "utf8"));
  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})(,#?([0-9a-f]{3}|[0-9a-f]{6}))*$/i.test(src)) return src.split(",").map((c) => normHex("#" + c.replace("#", "")));
  throw new Error(`${src}: not found (a .hex, .gpl or .png file, or colours like #ff0000,#00aa11)`);
}
var quantize2 = defineOp({
  name: "quantize",
  module: "core",
  effect: "render",
  summary: "Snap a picture to a palette (a .hex, .gpl or .png file, a list of colours, or the picture's own n dominant colours).",
  params: {
    image: p.str("the picture (PNG)", { positional: true, required: "quantize: <image.png> is required" }),
    palette: p.str("the palette: a .hex, .gpl or .png file, or #rrggbb,#rrggbb,\u2026 (default: the picture's own --n colours)"),
    n: p.int("colours to take from the picture when there is no --palette (default 16)"),
    dither: p.oneOf(["none", "bayer2", "bayer4", "noise"], "ordered dither between the two nearest colours (default none)"),
    out: p.str("the PNG to write (default: <image>.quantized.png)"),
    save: p.str("also write the palette used as a .hex or .gpl file")
  },
  run(i) {
    const file = resolve10(i.image), img = readPicture(file), colors = i.palette ? paletteColors(i.palette, i.n ?? 16) : paletteOf(img, i.n ?? 16).colors;
    if (!colors.length) throw new Error(`${i.image}: nothing opaque to take colours from`);
    const out = resolve10(i.out ?? `${stemOf2(file)}.quantized.png`);
    writePicture(out, snapToPalette(img, colors, { dither: i.dither }));
    if (i.save) writeFileSync10(resolve10(i.save), i.save.endsWith(".gpl") ? formatGpl(colors, basename5(i.save, ".gpl")) : formatHex(colors));
    return { out, colors };
  },
  cli: {
    usage: "       artgen quantize <image.png> [--palette file|#hex,#hex,\u2026] [--n 16] [--dither none|bayer2|bayer4|noise] [--out file.png] [--save palette.hex|.gpl]",
    text: (r) => `${r.out}: ${r.colors.length} colours ${r.colors.join(" ")}`
  },
  mcp: { exclude: BY_PATH },
  python: {}
});
var rotate = defineOp({
  name: "rotate",
  module: "core",
  effect: "write",
  summary: "Rotate pixel art without blurring it (RotSprite): one angle, or a strip of evenly spaced rotations.",
  params: {
    image: p.str("the picture (PNG)", { positional: true, required: "rotate: <image.png> is required" }),
    deg: p.num("degrees, clockwise on screen (required unless --steps; with --steps, the angle of the first frame, default 0)"),
    steps: p.int("write a strip of this many rotations, evenly spaced over 360\xB0 (each frame as wide as the picture)"),
    pivot: p.list("number", "the point to turn about, x,y in pixels (default: the centre)"),
    out: p.str("the PNG to write (default: <image>.rotated.png)")
  },
  run(i) {
    const file = resolve10(i.image), img = readPicture(file), out = resolve10(i.out ?? `${stemOf2(file)}.rotated.png`), pv = i.pivot;
    if (pv && pv.length !== 2) throw new Error("rotate: --pivot is x,y (two numbers)");
    if (i.steps === void 0 && i.deg === void 0) throw new Error("rotate: give --deg <degrees> or --steps <n>");
    if (i.steps !== void 0 && (!Number.isInteger(i.steps) || i.steps < 1 || i.steps > 360)) throw new Error("rotate: --steps is a whole number from 1 to 360");
    const pivot = pv && [pv[0], pv[1]], n = i.steps ?? 1, start = i.deg ?? 0;
    const degs = Array.from({ length: n }, (_, k) => start + (i.steps === void 0 ? 0 : 360 * k / n));
    const strip = new Grid2(img.w * n, img.h);
    degs.forEach((d, k) => strip.blit(rotsprite(img, d, { pivot }), k * img.w, 0));
    writePicture(out, strip);
    return { out, width: strip.w, height: strip.h, frames: n, degrees: degs, frameWidth: img.w };
  },
  cli: {
    usage: "       artgen rotate <image.png> --deg n | --steps k [--deg start] [--pivot x,y] [--out file.png]",
    text: (r) => `${r.out}: ${r.frames === 1 ? `rotated ${r.degrees[0]}\xB0` : `${r.frames} rotations of ${r.frameWidth}px, ${r.degrees.map((d) => `${+d.toFixed(2)}\xB0`).join(" ")}`} (${r.width}x${r.height})`
  },
  mcp: { exclude: BY_PATH },
  python: {}
});
var IMAGE_OPS = [trace, slice, quantize2, rotate];

// ../artgen-cli/src/ops/core.ts
function openBrowser(url) {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {
    }).unref();
  } catch {
  }
}
function installedModules(root) {
  try {
    return Object.keys(JSON.parse(readFileSync12(join12(root, "tools", "artgen", "MANIFEST.json"), "utf8")).modules ?? {});
  } catch {
    return [];
  }
}
var uiOp = defineOp({
  name: "ui",
  module: "core",
  effect: "write",
  summary: "Serve the review UI (Asset Review, Art Direction, Asset Lab, the map editors) for this repo's art/ on this machine.",
  params: {
    port: p.int("the port to listen on (default: any free one)", { mcp: false }),
    dir: p.str("the folder with the built web tools (default: ui/ beside this program; for development)", { mcp: false }),
    open: p.bool("open the link in the default browser", { mcp: false })
  },
  async run(i, ctx) {
    const project = ctx.project(), here = dirname11(fileURLToPath2(import.meta.url)), uiDir = i.dir ?? join12(here, "ui");
    if (!existsSync12(join12(uiDir, "index.html"))) throw new Error(`ui: no web tools in ${uiDir} \u2014 install the ui module: npx -y github:rstevenson1237/image_tools#artgen-dist add ui`);
    const modules = installedModules(project.root), s = await startUiServer({ root: project.root, uiDir, shared: here, port: i.port, info: { modules } });
    console.log(`artgen ui: ${s.url}
serving ${project.art} \u2014 Ctrl-C to stop`);
    if (i.open) openBrowser(s.url);
    const signals = ["SIGINT", "SIGTERM"];
    await new Promise((done) => {
      const stop = () => {
        for (const sig of signals) process.off(sig, stop);
        done();
      };
      for (const sig of signals) process.on(sig, stop);
    });
    await s.close();
    return { url: s.url, stopped: true };
  },
  cli: {
    usage: "       artgen ui [--port N] [--open]                   serve the review UI for art/ on this machine (the ui module); prints the link",
    text: () => "artgen ui: stopped"
  },
  mcp: { exclude: "starts a server that waits for a person at a browser" },
  python: { exclude: "starts a server that waits for a person at a browser" }
});
var reportOp = defineOp({
  name: "report",
  module: "core",
  effect: "write",
  summary: "Write a feedback bundle for an asset, map, dungeon or settlement (its files, versions, render, a case.md) to send back to the artgen repo.",
  description: "Write a feedback bundle to art/feedback/<date>-<id>/: the input file, the command, the artgen version, the render, the ledger lines and a case.md in the layout of the artgen repo's consumer fixtures, plus ISSUE.md, the text of the issue it would open. Nothing is sent.",
  params: {
    id: p.str("the asset, map, dungeon or settlement id", { positional: true }),
    file: p.str("a map, dungeon or settlement file by path, in place of the id", { mcp: false }),
    kind: p.oneOf(BUNDLE_KINDS, "which one the id (or file) is, when it could be more than one"),
    note: p.str("what is wrong or missing, in your words"),
    out: p.str("the folder to write the bundle to (default art/feedback/<date>-<id>/)", { mcp: false }),
    no_render: p.bool("leave the render out"),
    issue: p.bool("open the issue on the artgen repo with the bundle (needs GH_TOKEN or GITHUB_TOKEN; without one, prints the link to open)", { mcp: false }),
    repo: p.str(`the repo the issue goes to (default ${DEFAULT_REPO})`, { mcp: false })
  },
  async run(i, ctx) {
    const pr = ctx.findProject(), b = await writeBundle(pr, i.id, { file: i.file, kind: i.kind, note: i.note, out: i.out, noRender: i.no_render, repo: i.repo });
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    const issue = i.issue && token ? await openIssue(b, i.repo ?? DEFAULT_REPO, token) : void 0;
    return { dir: ctx.rel(b.dir), id: b.id, kind: b.kind, files: b.files, check: b.check, link: b.link, ...issue && { issue } };
  },
  cli: {
    usage: '       artgen report <id> [--kind asset|map|dungeon|settlement] [--file path] [--note "..."] [--no-render] [--issue]   a feedback bundle for the artgen repo (art/feedback/); --issue sends it',
    text: (r, i) => [
      `feedback bundle: ${r.dir} (${r.files.length} files)`,
      `  check: ${r.check}`,
      r.issue ? `issue opened: ${r.issue}` : i.issue ? `no GH_TOKEN or GITHUB_TOKEN here, so nothing was sent. To send it, open:
${r.link}` : `read ${r.dir}/ISSUE.md, then send it: artgen report ${r.id} --issue (without a token this prints the link to open)`
    ].join("\n")
  },
  mcp: {},
  python: {}
});
var upstreamOp = defineOp({
  name: "upstream",
  module: "core",
  effect: "write",
  summary: "Your local edits to the installed skills, agents, commands and templates as a patch against their sources in the artgen repo.",
  params: {
    base: p.str("a folder with the artgen distribution at the installed version (default: fetched from the release tag on GitHub)", { mcp: false }),
    out: p.str("where to write the patch (default art/feedback/upstream-<date>.patch)", { mcp: false }),
    repo: p.str(`the artgen repo (default ${DEFAULT_REPO})`, { mcp: false })
  },
  async run(i, ctx) {
    const r = await upstream(ctx.findProject()?.root ?? process.cwd(), { base: i.base, out: i.out, repo: i.repo });
    return { ...r, out: r.out && ctx.rel(r.out) };
  },
  cli: {
    usage: "       artgen upstream [--base dir] [--out file.patch]   local edits of installed files as a patch against the artgen repo's sources",
    text: (r) => r.files.length ? [
      ...r.files.map((f) => `${f.status.padEnd(8)} ${f.installed}${f.source ? ` -> ${f.source}` : ""}${f.note ? `  (${f.note})` : ""}`),
      r.out ? `patch for artgen ${r.version}: ${r.out}
apply it in the artgen repo: git apply ${r.out}` : "no patch to write"
    ].join("\n") : `no installed file is edited (artgen ${r.version})`,
    json: (r) => ({ ...r, patch: void 0 })
  },
  mcp: { exclude: "compares installed files and may fetch from GitHub; the user sends edits upstream" },
  python: {}
});
var metricsExport = defineOp({
  name: "metrics.export",
  module: "core",
  effect: "write",
  summary: "Write this repo's counts and ratios (assets, passes, tokens, minutes, scores, gate failures, per kind; per generator, maps too) to art/metrics/<version>.json for the pool.",
  description: "Write art/metrics/<artgen version>.json: counts and ratios from the ledger and briefs (per generator: pixel art and each kind of map; for art also assets, passes, tokens, minutes, scores, gate failures per kind), the artgen version and the installed modules. No images, ids, notes or paths.",
  params: { name: p.str("how this repo appears in the pool (default: a short hash of its folder name)"), out: p.str("write the file here instead", { mcp: false }) },
  run: (i, ctx) => {
    const r = exportMetrics(ctx.project(), { name: i.name, out: i.out, art: ctx.artMetrics });
    return { file: ctx.rel(r.file), metrics: r.metrics };
  },
  cli: {
    usage: "       artgen metrics export [--name repo] [--out file]   counts and ratios for the pool (art/metrics/<version>.json)",
    text: (r) => {
      const m = r.metrics, g = Object.entries(m.generators ?? {}).filter(([k]) => k !== "art").map(([k, x]) => `${x.subjects} ${k}${x.subjects === 1 ? "" : "s"}, ${x.approved} approved`).join("; ");
      const head = m.assets ? `${m.assets.total} assets, ${m.assets.approved} approved, ${m.totals.outTokens + m.totals.imageTokens} tokens${g ? `; ${g}` : ""}` : g || "nothing to count yet";
      return `metrics for artgen ${m.artgen}: ${head}
${r.file}
read it before you share it: it holds counts and ratios only`;
    },
    json: (r) => r.metrics
  },
  mcp: {},
  python: {}
});
var metricsPool = defineOp({
  name: "metrics.pool",
  module: "core",
  effect: "read",
  summary: "Put exported metrics from several repos side by side per artgen version (tokens and minutes per approved asset, first-pass approval, gate failures; per generator).",
  params: { paths: p.str("export files or folders of them", { positional: "rest", required: "metrics pool: name the export files or folders to pool", schema: { type: "array", items: { type: "string" } }, mcp: false }), out: p.str("also write the markdown here", { mcp: false }) },
  run(i) {
    const r = pool(i.paths), markdown = poolMarkdown(r);
    if (i.out) writeFileSync11(i.out, markdown);
    return { markdown, pool: r };
  },
  cli: { usage: "       artgen metrics pool <file|folder>\u2026 [--out pool.md]   exports from several repos, per artgen version", text: (r) => r.markdown, json: (r) => r.pool },
  mcp: { exclude: "reads export files by path outside art/" },
  python: {}
});
var CORE_OPS = [uiOp, reportOp, upstreamOp, metricsExport, metricsPool, ...IMAGE_OPS];

// ../artgen-cli/src/ops/maps-dungeon.ts
import { join as join13 } from "node:path";

// ../artgen-cli/src/ops/maps-shared.ts
import { readFileSync as readFileSync13 } from "node:fs";
var text = (v) => ({ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) });
var pngFile = (f) => ({ type: "image", data: readFileSync13(f).toString("base64"), mimeType: "image/png" });
var withVersion = (data, version) => data && typeof data === "object" && !Array.isArray(data) ? { version, ...data } : { version, items: data };
var projectOf = (i, ctx) => i.path ? null : ctx.project();
var refOf = (i) => i.path ? { file: i.path } : i.id;
var needPoints = (v, flag) => {
  if (!v) numbers2(void 0, flag);
  return v;
};
var numFlag = (v, flag) => {
  if (v === void 0) return void 0;
  if (!Number.isFinite(+v)) throw new Error(`${flag}: a number`);
  return +v;
};
function viewOf(i, cell2) {
  return { ...i.crop !== void 0 && { crop: parseCrop(i.crop, cell2()) }, ...i.fit !== void 0 && { fit: parseFit(i.fit) } };
}
var pageScaleOf = (v) => {
  if (v === void 0) return void 0;
  if (!(+v > 0)) throw new Error("--page-scale: output pixels per millimetre, above 0");
  return +v;
};
var originOf = (v) => {
  if (v === void 0) return void 0;
  if (!v) throw new Error("--origin: a non-empty name");
  return { origin: v };
};
function syncText(file, r) {
  const lists = Object.entries(r.lists).filter(([, c]) => c.removed || c.added).map(([n, c]) => `${n}: ${c.removed} of ${r.origin} replaced by ${c.added}`);
  return [`${file}: synced origin ${r.origin}${lists.length ? ` (${lists.join("; ")})` : " (nothing of that origin on either side)"}`, `${r.conflicts.length} conflict${r.conflicts.length === 1 ? "" : "s"}${r.conflicts.length ? ":" : ""}`, ...r.conflicts.map((c) => `  ${c.kind}: ${c.message}`)].join("\n");
}
var layersOf = (v, parse) => typeof v === "string" ? parse(v) : v;
function roomNumber(v, onOff3) {
  if (v === void 0) return void 0;
  if (typeof v === "number") return v;
  if (v === false) return false;
  if (onOff3(v) === false && !/^\d/.test(v)) return false;
  if (!Number.isFinite(+v)) throw new Error("--number: a number or off");
  return +v;
}
var idParam = (what, required) => p.str(what, { positional: true, required });
var pathParam = (kind) => p.str(`the ${kind} file by path, in place of the id (needs no project; renders go beside the file or to --out)`, { flag: "--file", mcp: false });
var overlayLines = (m) => ({ labels: m.overlay.labels.map((l, i) => `${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}`), symbols: m.overlay.symbols.map((s, i) => `${i}. ${s.kind} at ${s.x},${s.y}`) });
function dropItems(list6, idx) {
  if (Array.isArray(idx)) for (const i of [...idx].sort((x, y) => y - x)) {
    if (!list6[i]) throw new Error(`no overlay item ${i}`);
    list6.splice(i, 1);
  }
}
function overlayEdit(m, i, o) {
  const usage = `${o.name} overlay <id> rm label|symbol <index> | clear [labels|symbols]`;
  if (i.action !== void 0) {
    if (i.action === "rm") {
      const list6 = i.which === "label" ? m.overlay.labels : i.which === "symbol" ? m.overlay.symbols : null, n = Number(i.index);
      if (!list6 || !Number.isInteger(n) || n < 0 || n >= list6.length) throw new Error(`${o.name} overlay <id> rm label|symbol <index> (labels 0..${m.overlay.labels.length - 1}, symbols 0..${m.overlay.symbols.length - 1})`);
      list6.splice(n, 1);
    } else if (i.action === "clear") {
      if (!i.which || i.which === "labels") m.overlay.labels = [];
      if (!i.which || i.which === "symbols") m.overlay.symbols = [];
    } else throw new Error(usage);
  } else if (o.strict && !["add_labels", "add_symbols", "remove_labels", "remove_symbols", "clear"].some((k) => i[k] !== void 0)) throw new Error(usage);
  if (i.clear === "labels" || i.clear === "all") m.overlay.labels = [];
  if (i.clear === "symbols" || i.clear === "all") m.overlay.symbols = [];
  dropItems(m.overlay.labels, i.remove_labels);
  dropItems(m.overlay.symbols, i.remove_symbols);
  for (const l of i.add_labels ?? []) o.addLabel(l);
  for (const s of i.add_symbols ?? []) o.addSymbol(s);
}
var overlayParams = (kinds) => ({
  action: p.str("rm | clear (the command line)", { positional: true, mcp: false }),
  which: p.str(`label | symbol (rm), or ${kinds} (clear)`, { positional: true, mcp: false }),
  index: p.str("the item to remove (rm)", { positional: true, mcp: false }),
  add_labels: p.json({ type: "array", items: { type: "object" } }, "labels to add, as a JSON list (see the MCP tool for the fields)"),
  add_symbols: p.json({ type: "array", items: { type: "object" } }, "symbols to add, as a JSON list"),
  remove_labels: p.list("number", "indices of labels to remove", { schema: { type: "array", items: { type: "number" } } }),
  remove_symbols: p.list("number", "indices of symbols to remove", { schema: { type: "array", items: { type: "number" } } }),
  clear: p.str("labels | symbols | all")
});

// ../artgen-cli/src/ops/maps-dungeon.ts
var V = (data) => withVersion(data, dungeon_exports.DUNGEON_FORMAT);
var next = (i, id2) => i.path ? `next: artgen dungeon render --file ${i.path}` : `next: artgen dungeon render ${id2 ?? i.id}`;
var CELLS = "WIDTHxHEIGHT in cells, e.g. 8x6";
var numberOf = (v) => roomNumber(v, (s) => onOff2(s));
var findRoom2 = (m, rid) => {
  const r = m.rooms.find((x) => x.id === rid);
  if (!r) throw new Error(`no room ${String(rid)} (have: ${m.rooms.map((x) => x.id).join(", ") || "none"})`);
  return r;
};
var GEN_PARAMS = {
  size: p.size("the sheet in cells, e.g. 40x30", { mcp: false, error: CELLS }),
  rooms: p.num("rooms to generate", { mcp: false }),
  min_size: p.num("smallest room side, cells", { mcp: false }),
  max_size: p.num("largest room side, cells", { mcp: false }),
  caves: p.num("share of cave rooms, 0..1", { mcp: false }),
  round: p.num("share of round rooms, 0..1", { mcp: false }),
  loops: p.num("extra corridors that make loops, 0..1", { mcp: false }),
  doors: p.num("share of corridor ends with a door, 0..1", { mcp: false }),
  corridor_width: p.num("corridor width, cells", { mcp: false }),
  spacing: p.num("gap between rooms, cells", { mcp: false }),
  entrance: p.bool("an entrance corridor to the map edge", { style: "onoff", mcp: false }),
  layout: p.oneOf(dungeon_exports.GEN_LAYOUTS, "scatter | dense | blocks", { mcp: false }),
  density: p.num("dense: share of the sheet filled, 0..1", { mcp: false })
};
var GEN_KEYS = [["rooms", "rooms"], ["min_size", "minSize"], ["max_size", "maxSize"], ["caves", "caves"], ["round", "round"], ["loops", "loops"], ["doors", "doors"], ["corridor_width", "corridorWidth"], ["spacing", "spacing"]];
function applyGenFlags(m, i) {
  if (typeof i.seed === "number") m.seed = i.seed;
  if (i.size) [m.cols, m.rows] = i.size;
  for (const [f, k] of GEN_KEYS) if (i[f] !== void 0) m.gen[k] = i[f];
  if (i.entrance !== void 0) m.gen.entrance = i.entrance;
  if (i.layout !== void 0) {
    if (i.layout === "scatter") delete m.gen.layout;
    else m.gen.layout = i.layout;
  }
  if (i.density !== void 0) m.gen.density = i.density;
}
var list3 = defineOp({
  name: "dungeon.list",
  module: "maps",
  effect: "read",
  summary: "List the dungeons in the project (or the one named by --file).",
  description: "Dungeon maps (TTRPG, black and white) in art/dungeons, plus the room shapes, door kinds, symbol kinds and label kinds the dungeon tools accept.",
  params: { path: pathParam("dungeon") },
  run: (i, ctx) => i.path ? [dungeonSummary(readDungeon(null, { file: i.path }))] : listDungeons(ctx.project()),
  cli: {
    usage: "       artgen dungeon list | show <id> | symbols",
    text: (ds) => ds.length ? ds.map((d) => `${d.id.padEnd(16)} ${d.size.padEnd(7)} ${d.rooms} rooms, ${d.corridors} corridors, ${d.labels} labels, ${d.symbols} symbols${d.title ? `  "${d.title}"` : ""}`).join("\n") : "no dungeons yet: artgen dungeon new <id>",
    json: (ds) => V(ds)
  },
  mcp: { content: (ds) => [text({ dungeons: ds, shapes: dungeon_exports.ROOM_SHAPES, doors: dungeon_exports.DOOR_KINDS, symbols: dungeon_exports.SYMBOL_KINDS, labelKinds: dungeon_exports.LABEL_KINDS, routes: dungeon_exports.ROUTES })] },
  python: {}
});
var symbols = defineOp({
  name: "dungeon.symbols",
  module: "maps",
  effect: "read",
  summary: "List the symbol kinds a dungeon can carry.",
  params: {},
  run: () => dungeon_exports.SYMBOL_KINDS,
  cli: { usage: [], text: () => Object.entries(dungeon_exports.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join("\n"), json: (kinds) => V(kinds) },
  mcp: { exclude: "dungeon_list returns the symbol kinds" },
  python: {}
});
var show2 = defineOp({
  name: "dungeon.show",
  module: "maps",
  effect: "read",
  summary: "Show a dungeon: rooms with ids, corridors, labels and symbols with their indices.",
  description: "A dungeon's file (art/dungeons/<id>/dungeon.json) and a readable summary: rooms with ids, corridors, labels and symbols with their indices.",
  params: { id: idParam("the dungeon id", "dungeon show: <id>"), path: pathParam("dungeon") },
  run: (i, ctx) => readDungeon(projectOf(i, ctx), refOf(i)),
  cli: { usage: [], text: (m) => describeDungeon(m), json: (m) => V(m) },
  mcp: { name: "dungeon_get", content: (m) => [text(describeDungeon(m)), text(m)] },
  python: {}
});
var create = defineOp({
  name: "dungeon.new",
  module: "maps",
  effect: "write",
  summary: "Create a dungeon: generated from the seed, one room, or empty.",
  description: 'Create a dungeon map. mode "generate" (default): rooms and corridors from the seed and gen settings ({rooms, minSize, maxSize, caves, round, loops, doors, corridorWidth, spacing, entrance, layout: scatter|dense|blocks (dense: rooms side by side joined through shared walls; blocks: blocks split into rooms joined by corridors), density (dense: share of the sheet filled, 0..1)}); "room": one room of shape rect|circle|octagon|cave, w \xD7 h cells, with exits [{side: n|e|s|w, door?: kind|null, at?: offset along the wall, text?: a note at the edge saying where it leads}] running off the map, a label and a number; "empty": nothing yet (add rooms with dungeon_edit). One cell is 5 ft. Render with dungeon_render.',
  params: {
    id: idParam("the new dungeon's id (a name, never a path)", "dungeon new: <id> is required"),
    path: pathParam("dungeon"),
    mode: p.oneOf(["generate", "room", "empty"], "generate (default), room (one room) or empty", { cli: false }),
    cols: p.num("columns", { cli: false }),
    rows: p.num("rows", { cli: false }),
    seed: p.num("the generator seed (default: random)"),
    title: p.str("the title"),
    gen: p.json({ type: "object" }, "generator settings: rooms, minSize, maxSize, caves, round, loops, doors, corridorWidth, spacing, entrance, layout, density", { cli: false }),
    shape: p.oneOf(["rect", "circle", "octagon", "cave"], "one room of this shape (rect, circle, octagon or cave)", { flag: "--room", error: "rect, circle, octagon or cave" }),
    w: p.num("the room's width in cells", { cli: false }),
    h: p.num("the room's height in cells", { cli: false }),
    exits: { kind: "list", item: "string", doc: "exits running off the map: n,e:secret,s:none:To the caves,w (a side, then :door kind, then :a note)", schema: { type: "array", items: { type: "object" } } },
    label: p.str("the room's name"),
    number: p.str("the room's number (n, or off)", { schema: { type: "number" } }),
    empty: p.bool("no rooms yet", { mcp: false }),
    room_size: p.size("the room's size in cells, e.g. 8x6", { mcp: false, error: CELLS }),
    force: p.bool("overwrite an existing file (with --file)", { mcp: false }),
    ...GEN_PARAMS
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    const base = dungeon_exports.newDungeon(i.path ? i.id ?? fileId(i.path) : i.id, {
      seed: typeof i.seed === "number" ? i.seed : Math.floor(Math.random() * 1e6),
      ...typeof i.cols === "number" && { cols: i.cols },
      ...typeof i.rows === "number" && { rows: i.rows },
      ...i.title && { title: i.title },
      ...i.gen && typeof i.gen === "object" ? { gen: { ...dungeon_exports.DEFAULTS.gen, ...i.gen } } : {}
    });
    applyGenFlags(base, i);
    let m = dungeon_exports.parseDungeon(base);
    const room3 = i.mode === "room" || i.mode === void 0 && i.shape !== void 0;
    if (room3) {
      const [w, h] = i.room_size ?? [Number(i.w ?? 8), Number(i.h ?? 8)];
      const exits = (i.exits ?? []).map((e) => {
        if (typeof e !== "string") return e;
        const [side, kind, ...note] = e.split(":");
        if (!["n", "e", "s", "w"].includes(side)) throw new Error("--exits: sides n, e, s, w, each optionally :door kind and :a note (n,e:secret,s:none:To the caves)");
        return { side, door: kind === void 0 || kind === "" ? void 0 : dungeon_exports.doorPair(kind)[0], ...note.length && { text: note.join(":") } };
      });
      m = dungeon_exports.singleRoom(m, { shape: i.shape ?? "rect", w, h, exits, label: typeof i.label === "string" ? i.label : void 0, number: numberOf(i.number) });
    } else if (i.mode !== "empty" && i.empty !== true) m = dungeon_exports.generateDungeon(m);
    return createDungeon(P, m, i.force === true, i.path ? { file: i.path } : void 0);
  },
  cli: {
    usage: [
      '       artgen dungeon new <id> [--size 40x30] [--seed n] [--title "..."] [--empty] [the gen flags of dungeon gen] | new <id> --room rect|circle|octagon|cave --room-size 8x6 [--exits n,e:secret,s:none:To the caves,w] [--label "..."] [--number n|off]'
    ],
    text: (r, i) => `${r.file}
${describeDungeon(r.dungeon)}
${next(i, r.dungeon.id)}`,
    json: (r) => V(r)
  },
  mcp: { content: (r) => [text({ file: r.file, summary: describeDungeon(r.dungeon) })] },
  python: {}
});
var update = defineOp({
  name: "dungeon.update",
  module: "maps",
  effect: "write",
  summary: "Change a dungeon's settings (not its rooms): grid, style, scale, title, furniture, size.",
  description: `Change a dungeon's settings (not its rooms). grid_size: the grid size in the map unit (10 = a line every 10 ft; a whole number of squares), grid_unit: the unit (ft, m, \u2026; it is also the scale unit), sub_grid: true for a fainter line at every square, show_grid; grid_mode: "10" | "5" | "10+5" | "none" (a shorthand); grid: {show, size (cells), sub, clip: floor|all}; style: {hatch: band|full|none, band (cells of hatching along the walls), wall (weight)}; scale: {perCell, unit}; gen: generator settings (used by dungeon_generate); title, numbers, scale_bar, compass, cols, rows; furniture: {place: over|outside|auto, side?: bottom|right} (where the title, scale bar, compass and legend go: over the map, in a band beside it, or in the band only when they would cover something).`,
  params: {
    id: idParam("the dungeon id", "dungeon update: <id>"),
    path: pathParam("dungeon"),
    grid_size: p.num("the grid size in the map unit (10 = a line every 10 ft)"),
    grid_unit: p.str("the unit: ft, m, \u2026"),
    sub_grid: p.bool("a fainter line at every square", { style: "onoff" }),
    show_grid: p.bool("show the grid", { style: "onoff" }),
    grid_mode: p.str("10 | 5 | 10+5 | none"),
    grid: p.json({ type: "object" }, "grid settings, as JSON"),
    style: p.json({ type: "object" }, "style settings, as JSON"),
    scale: p.json({ type: "object" }, "scale settings, as JSON"),
    gen: p.json({ type: "object" }, "generator settings, as JSON"),
    title: p.str('the title ("" removes it)'),
    numbers: p.bool("show room numbers", { style: "onoff" }),
    scale_bar: p.bool("show the scale bar", { style: "onoff" }),
    compass: p.bool("show the compass", { style: "onoff" }),
    cols: p.num("columns"),
    rows: p.num("rows"),
    furniture: p.json({ type: "object" }, "where the title, scale bar, compass and legend go, as JSON: {place, side}")
  },
  run(i, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      if (i.furniture && typeof i.furniture === "object") m.furniture = i.furniture;
      for (const k of ["grid", "style", "scale", "gen"]) if (i[k] && typeof i[k] === "object") Object.assign(m[k], i[k]);
      if (typeof i.grid_unit === "string" && i.grid_unit) m.scale.unit = i.grid_unit;
      if (typeof i.grid_mode === "string") m.grid = dungeon_exports.gridMode(m, i.grid_mode);
      m.grid = dungeon_exports.gridFromUnits(m, { size: typeof i.grid_size === "number" ? i.grid_size : void 0, sub: typeof i.sub_grid === "boolean" ? i.sub_grid : void 0, show: typeof i.show_grid === "boolean" ? i.show_grid : void 0 });
      if (typeof i.title === "string") {
        if (i.title) m.title = i.title;
        else delete m.title;
      }
      if (typeof i.numbers === "boolean") m.numbers = i.numbers;
      if (typeof i.scale_bar === "boolean") m.scaleBar = i.scale_bar;
      if (typeof i.compass === "boolean") m.compass = i.compass;
      if (typeof i.cols === "number") m.cols = i.cols;
      if (typeof i.rows === "number") m.rows = i.rows;
    });
  },
  cli: {
    usage: `       artgen dungeon update <id> [--grid-size 10] [--grid-unit ft] [--sub-grid on|off] [--show-grid on|off] [--grid-mode 10|5|10+5|none] [--grid|--style|--scale|--gen|--furniture '<json>'] [--title "..."] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--cols n] [--rows n]`,
    text: (m, i) => `${describeDungeon(m)}
${next(i, m.id)}`,
    json: (m) => V(m)
  },
  mcp: { content: (m) => [text(describeDungeon(m))] },
  python: {}
});
var grid2 = defineOp({
  name: "dungeon.grid",
  module: "maps",
  effect: "write",
  summary: "Set a dungeon's grid.",
  params: {
    id: idParam("the dungeon id", "dungeon grid: <id>"),
    path: pathParam("dungeon"),
    mode: p.str("10 | 5 | 10+5 | none (in feet, at 5 ft a cell)", { positional: true }),
    size: p.num("the grid size in the map unit"),
    unit: p.str("the unit: ft, m, \u2026"),
    sub: p.bool("a fainter line at every square", { style: "onoff" }),
    show: p.bool("show the grid", { style: "onoff" }),
    clip: p.str("floor | all")
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    if (!i.mode && i.size === void 0 && i.sub === void 0 && i.show === void 0 && !i.unit && !i.clip)
      throw new Error("dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all]");
    return updateDungeon(P, refOf(i), (m) => {
      if (i.unit) m.scale.unit = i.unit;
      if (i.mode) m.grid = dungeon_exports.gridMode(m, i.mode);
      m.grid = dungeon_exports.gridFromUnits(m, { size: i.size, sub: i.sub, show: i.show });
      if (i.clip) {
        if (i.clip !== "floor" && i.clip !== "all") throw new Error("--clip: floor or all");
        m.grid.clip = i.clip;
      }
    });
  },
  cli: {
    usage: "       artgen dungeon grid <id> [10|5|10+5|none] [--size 10] [--unit ft] [--sub on|off] [--show on|off] [--clip floor|all]",
    text: (m, i) => `${describeDungeon(m).split("\n")[2].trim()}
${next(i, m.id)}`,
    json: (m) => V(m.grid)
  },
  mcp: { exclude: "dungeon_update covers it" },
  python: {}
});
var style = defineOp({
  name: "dungeon.style",
  module: "maps",
  effect: "write",
  summary: "Set a dungeon's drawing style, title, scale and furniture.",
  params: {
    id: idParam("the dungeon id", "dungeon style: <id>"),
    path: pathParam("dungeon"),
    hatch: p.oneOf(dungeon_exports.HATCH_STYLES, "band | full | none"),
    band: p.num("cells of hatching along the walls"),
    wall: p.num("wall weight"),
    numbers: p.bool("show room numbers", { style: "onoff" }),
    scale_bar: p.bool("show the scale bar", { style: "onoff" }),
    compass: p.bool("show the compass", { style: "onoff" }),
    legend: p.bool("show the legend", { style: "onoff" }),
    title: p.str('the title ("" removes it)'),
    per_cell: p.num("map units in one cell"),
    unit: p.str("the scale unit, e.g. ft"),
    furniture: p.oneOf(dungeon_exports.FURNITURE_PLACES, "over | outside | auto"),
    furniture_side: p.oneOf(dungeon_exports.FURNITURE_SIDES, "bottom | right"),
    shared_walls: p.str("on | off | auto")
  },
  run(i, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      if (i.hatch) m.style.hatch = i.hatch;
      if (i.band !== void 0) m.style.band = i.band;
      if (i.wall !== void 0) m.style.wall = i.wall;
      if (i.shared_walls === "auto") delete m.style.sharedWalls;
      else if (i.shared_walls !== void 0) m.style.sharedWalls = onOff2(i.shared_walls);
      if (i.title !== void 0) {
        if (i.title) m.title = i.title;
        else delete m.title;
      }
      for (const k of ["numbers", "scale_bar", "compass", "legend"]) if (i[k] !== void 0) m[k === "scale_bar" ? "scaleBar" : k] = i[k];
      if (i.per_cell !== void 0) m.scale.perCell = i.per_cell;
      if (i.unit) m.scale.unit = i.unit;
      const place2 = i.furniture, side = i.furniture_side;
      if (place2 !== void 0 || side !== void 0) {
        const f = { place: place2 ?? m.furniture?.place ?? "outside", ...(side ?? m.furniture?.side) && { side: side ?? m.furniture?.side } };
        if (f.place === "over" && !f.side) delete m.furniture;
        else m.furniture = f;
      }
    });
  },
  cli: {
    usage: '       artgen dungeon style <id> [--hatch band|full|none] [--band n] [--wall f] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--title "..."] [--per-cell n] [--unit ft] [--furniture over|outside|auto] [--furniture-side bottom|right] [--shared-walls on|off|auto]',
    text: (m, i) => `${describeDungeon(m)}
${next(i, m.id)}`,
    json: (m) => V(m)
  },
  mcp: { exclude: "dungeon_update covers it" },
  python: {}
});
var gen = defineOp({
  name: "dungeon.gen",
  module: "maps",
  effect: "write",
  summary: "Regenerate a dungeon's rooms and corridors from its seed and generator settings.",
  description: "Regenerate a dungeon's rooms and corridors from its seed and gen settings (replaces every room and corridor; labels and symbols stay). Pass seed / gen / cols / rows to change them first.",
  params: {
    id: idParam("the dungeon id", "dungeon gen: <id>"),
    path: pathParam("dungeon"),
    seed: p.num("the generator seed"),
    gen: p.json({ type: "object" }, "generator settings to change first", { cli: false }),
    cols: p.num("columns", { cli: false }),
    rows: p.num("rows", { cli: false }),
    ...GEN_PARAMS
  },
  run(i, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      applyGenFlags(m, i);
      if (i.gen && typeof i.gen === "object") Object.assign(m.gen, i.gen);
      if (typeof i.cols === "number") m.cols = i.cols;
      if (typeof i.rows === "number") m.rows = i.rows;
      return dungeon_exports.generateDungeon(dungeon_exports.parseDungeon(m));
    });
  },
  cli: {
    usage: [
      "       artgen dungeon gen <id> [--seed n] [--rooms n] [--min-size n] [--max-size n] [--caves f] [--round f] [--loops f] [--doors f] [--corridor-width n] [--spacing n] [--entrance on|off] [--size 40x30]",
      "                  [--layout scatter|dense|blocks] [--density f]   dense: rooms side by side, joined through shared walls; blocks: blocks split into rooms, joined by corridors"
    ],
    text: (m, i) => `${describeDungeon(m)}
${next(i, m.id)}`,
    json: (m) => V(m)
  },
  mcp: { name: "dungeon_generate", content: (m) => [text(describeDungeon(m))] },
  python: {}
});
var OPS_DOC = "a list of edits as JSON (or @file.json): add_room, move_room, set_room, remove_room, add_block, split_block, remove_block, link, unlink, connect, disconnect, door, fit (see the MCP tool dungeon_edit for the fields)";
var edit = defineOp({
  name: "dungeon.edit",
  module: "maps",
  effect: "write",
  summary: "Change a dungeon's rooms and corridors with a list of edits, in order.",
  description: `Change a dungeon's rooms and corridors, in order. Coordinates are cells (x right, y down; 1 cell = 5 ft); a point is [x,y], "x,y" or a cell name "C4". ops: {op:"add_room", shape: rect|circle|octagon|cave|poly, at: top-left, w, h, points? (poly: [x,y,\u2026]), label?, number? (false hides it), href? (a link from its number and name: http(s), a relative path or #anchor), id?} | {op:"move_room", room, at} | {op:"set_room", room, shape?, w?, h?, label?, number?, href? ("" removes it)} | {op:"remove_room", room} (and its corridors) | {op:"add_block", shape: rect|octagon|circle|hex|poly, at, w, h, points?, split?: bsp|rows|cols|grid|cuts, min? (cells, about the size of each room), cuts?: {x?: [], y?: []}, seed?, doors? (0..1, extra doors), id?} (one shape split into rooms that share walls, with doors and openings between them; its rooms are ordinary rooms, ids <block>-1, <block>-2, \u2026) | {op:"split_block", id, split?, min?, seed?} (split again: a new seed unless given) | {op:"remove_block", id} | {op:"link", from: room id, point or "corridor:<id>", to: the same (a point is an exit or dead end; past the map edge it runs off the map; a corridor is a junction on its centre line), from_side?/to_side?: n|e|s|w (leave the room by that wall), from_offset?/to_offset? (cells along that wall), width?, route?: auto|hv|vh|straight|around (around: along the grid, round the rooms in the way), via?: [x,y,\u2026], curve?: "smooth", style?: "natural" (rough cave-like walls), seed?, id? (a name other corridors can join), exit?: {text, href?, fade?} (to a point past the edge: the corridor fades out and a boxed note says where it leads), doors?: [kind|null, kind|null]} | {op:"unlink", index} | {op:"connect", a: room, b: room, kind?: door|secret|locked|portcullis|arch|open, at?: a point on their shared wall, width?} (a door or opening in the wall two touching rooms share; touching rooms without one keep the wall) | {op:"disconnect", index} | {op:"door", index, end: from|to, kind: door|secret|locked|portcullis|arch|null} | {op:"fit", margin?}.`,
  params: {
    id: idParam("the dungeon id", "dungeon edit: <id>"),
    path: pathParam("dungeon"),
    ops: p.json({ type: "array", items: { type: "object" } }, OPS_DOC, { required: "dungeon edit: --ops '<json list>' (or @file.json) is required" })
  },
  run(i, ctx) {
    const lines2 = [];
    const m = updateDungeon(projectOf(i, ctx), refOf(i), (m2) => {
      const ops = i.ops ?? [];
      if (!Array.isArray(ops)) throw new Error("ops: a list of edits");
      for (const o of ops) lines2.push(dungeon_exports.editDungeon(m2, o));
    });
    return { m, lines: lines2 };
  },
  cli: {
    usage: `       artgen dungeon edit <id> --ops '<json list>'   a batch of edits in order: add_room, move_room, set_room, remove_room, add_block, split_block, remove_block, link, unlink, connect, disconnect, door, fit (@file.json reads them from a file)`,
    text: (r, i) => [`${r.m.id}: ${r.lines.length} edit${r.lines.length === 1 ? "" : "s"}`, ...r.lines.map((l) => `  ${l}`), ...warningLines(r.m), next(i, r.m.id)].join("\n"),
    json: (r) => V({ done: r.lines, dungeon: r.m })
  },
  mcp: { content: (r) => [text([describeDungeon(r.m), ...warningLines(r.m)].join("\n"))] },
  python: {}
});
var roomCmd = defineOp({
  name: "dungeon.room",
  module: "maps",
  effect: "write",
  summary: "Add, move, change or remove a room.",
  params: {
    id: idParam("the dungeon id", "dungeon room: <id> add|move|set|rm"),
    path: pathParam("dungeon"),
    action: p.str("add | move | set | rm", { positional: true }),
    target: p.str("add: the shape (rect, circle, octagon, cave, poly); move, set, rm: the room id", { positional: true }),
    at: p.str("the top-left corner: x,y or a cell like C4"),
    size: p.size("width x height in cells, e.g. 6x4", { error: CELLS }),
    points: p.points("poly: x,y,\u2026 of the outline"),
    label: p.str("the room's name"),
    number: p.str("the room's number (n, or off)"),
    room_id: p.str("add: the new room's id (default r<n>)"),
    fill: p.oneOf(dungeon_exports.ROOM_FILLS, "floor | building | yard | cellar"),
    href: p.str('a link from the number and name (set: "none" removes it)'),
    origin: p.str("add: who wrote it (a sync replaces its own)"),
    shape: p.oneOf(["rect", "circle", "octagon", "cave"], "set: the new shape", { error: "rect, circle, octagon or cave" })
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    let summary = "";
    const m = updateDungeon(P, refOf(i), (m2) => {
      const rid = i.target;
      if (i.action === "add") {
        const shape = rid;
        if (!dungeon_exports.ROOM_SHAPES.includes(shape)) throw new Error(`dungeon room <id> add <shape>: one of ${dungeon_exports.ROOM_SHAPES.join(", ")}`);
        const n = numberOf(i.number);
        let o;
        if (shape === "poly") o = { op: "add_room", shape, points: needPoints(i.points, "--points") };
        else {
          if (!i.at || !i.size) throw new Error("dungeon room <id> add <shape> --at x,y|C4 --size WxH");
          o = { op: "add_room", shape, at: i.at, w: i.size[0], h: i.size[1] };
        }
        if (i.room_id !== void 0) o.id = i.room_id;
        if (i.label) o.label = i.label;
        if (n !== void 0) o.number = n;
        if (i.fill) o.fill = i.fill;
        if (i.href) o.href = i.href;
        Object.assign(o, originOf(i.origin));
        summary = dungeon_exports.editDungeon(m2, o);
      } else if (i.action === "move") {
        findRoom2(m2, rid);
        if (!i.at) throw new Error("dungeon room <id> move <rid> --at x,y|C4");
        summary = dungeon_exports.editDungeon(m2, { op: "move_room", room: rid, at: i.at });
      } else if (i.action === "set") {
        findRoom2(m2, rid);
        const n = numberOf(i.number);
        summary = dungeon_exports.editDungeon(m2, {
          op: "set_room",
          room: rid,
          ...i.shape && { shape: i.shape },
          ...i.size && { w: i.size[0], h: i.size[1] },
          ...i.label !== void 0 && { label: i.label },
          ...n !== void 0 && { number: n },
          ...i.fill && { fill: i.fill },
          ...i.href !== void 0 && { href: i.href === "none" ? "" : i.href }
        });
      } else if (i.action === "rm") {
        findRoom2(m2, rid);
        summary = dungeon_exports.editDungeon(m2, { op: "remove_room", room: rid });
      } else throw new Error("dungeon room <id> add|move|set|rm");
    });
    return { m, summary };
  },
  cli: {
    usage: '       artgen dungeon room <id> add <shape> --at x,y|C4 --size WxH [--points x,y,\u2026] [--label "..."] [--number n|off] [--room-id r9] [--fill floor|building|yard|cellar] [--href url] [--origin name] | move <rid> --at x,y | set <rid> [--shape s] [--size WxH] [--label "..."] [--number n|off] [--fill f] [--href url|none] | rm <rid>',
    text: (r, i) => [`${r.m.id}: ${r.summary} (${r.m.rooms.length} rooms)`, ...warningLines(r.m), next(i, r.m.id)].join("\n"),
    json: (r) => V(r.m.rooms)
  },
  mcp: { exclude: "dungeon_edit add_room / move_room / set_room / remove_room covers it" },
  python: {}
});
var link = defineOp({
  name: "dungeon.link",
  module: "maps",
  effect: "write",
  summary: "Join two rooms (or a room and a point, or a corridor) with a corridor.",
  params: {
    id: idParam("the dungeon id", "dungeon link: <id>"),
    path: pathParam("dungeon"),
    from: p.str("a room id, a block id, or corridor:<id>", { positional: true, required: "dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id>" }),
    to: p.str("a room id, a block id, corridor:<id>, or a point x,y | C4", { positional: true, required: "dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id>" }),
    width: p.num("corridor width in cells"),
    route: p.oneOf(dungeon_exports.ROUTES, "auto | hv | vh | straight | around"),
    via: p.points("bend points x,y,\u2026"),
    doors: p.str("door,none: the doors at the two ends"),
    from_side: p.str("n | e | s | w: leave the first room by that wall"),
    from_offset: p.num("cells along that wall"),
    to_side: p.str("n | e | s | w: enter the second room by that wall"),
    to_offset: p.num("cells along that wall"),
    curve: p.oneOf(dungeon_exports.CURVES, "none | smooth"),
    style: p.oneOf(dungeon_exports.CORRIDOR_STYLES, "built | natural"),
    seed: p.num("the seed of a natural corridor's walls"),
    corridor_id: p.str("a name other corridors can join", { flag: "--id" }),
    exit: p.str("a note at the map edge saying where it leads"),
    exit_href: p.str("a link from the note"),
    fade: p.num("cells the corridor fades over (default 3)"),
    origin: p.str("who wrote it (a sync replaces its own)")
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    let line2 = "";
    const m = updateDungeon(P, refOf(i), (m2) => {
      const [, eb] = dungeon_exports.linkEnds(m2, i.from, i.to), doors = dungeon_exports.doorPair(i.doors);
      const exit = i.exit !== void 0 ? { text: i.exit, ...i.exit_href && { href: i.exit_href }, ...i.fade !== void 0 && { fade: i.fade } } : void 0;
      if (exit && !("at" in dungeon_exports.corridorEnd(m2, eb))) throw new Error("--exit: the second end must be a point (x,y or a cell name), where the corridor leaves the map");
      line2 = dungeon_exports.editDungeon(m2, {
        op: "link",
        from: i.from,
        to: i.to,
        ...i.corridor_id && { id: i.corridor_id },
        from_side: i.from_side,
        from_offset: i.from_offset,
        to_side: i.to_side,
        to_offset: i.to_offset,
        ...exit && { exit },
        width: i.width,
        route: i.route,
        via: i.via,
        doors,
        ...i.curve === "smooth" && { curve: "smooth" },
        ...i.style === "natural" && { style: "natural" },
        seed: i.seed,
        ...originOf(i.origin)
      });
    });
    return { m, line: line2 };
  },
  cli: {
    usage: '       artgen dungeon link <id> <room|corridor:id> <room|x,y|C4|corridor:id> [--width 1] [--route auto|hv|vh|straight|around] [--via x,y,\u2026] [--doors door,none] [--from-side n|e|s|w] [--from-offset n] [--to-side \u2026] [--to-offset n] [--curve smooth] [--style natural] [--seed n] [--id name] [--exit "To the caves" [--exit-href url] [--fade 3]] [--origin name]',
    text: (r, i) => [`${r.m.id}: ${r.line}`, ...warningLines(r.m), next(i, r.m.id)].join("\n"),
    json: (r) => V(r.m.corridors)
  },
  mcp: { exclude: "dungeon_edit link covers it" },
  python: {}
});
var corridorOf = (m, i, name) => {
  const k = Number(i.index);
  if (!Number.isInteger(k) || k < 0 || k >= m.corridors.length) throw new Error(`dungeon ${name} <id> <index> (corridors 0..${m.corridors.length - 1}; artgen dungeon show)`);
  return k;
};
var unlink = defineOp({
  name: "dungeon.unlink",
  module: "maps",
  effect: "write",
  summary: "Remove a corridor (and the corridors that join it).",
  params: { id: idParam("the dungeon id", "dungeon unlink: <id> <index>"), path: pathParam("dungeon"), index: p.str("the corridor's index (dungeon show)", { positional: true }) },
  run(i, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      corridorOf(m, i, "unlink");
      dungeon_exports.editDungeon(m, { op: "unlink", index: Number(i.index) });
    });
  },
  cli: { usage: "       artgen dungeon unlink <id> <i>", text: (m, i) => [`${m.id}: ${m.corridors.length} corridors`, ...warningLines(m), next(i, m.id)].join("\n"), json: (m) => V(m.corridors) },
  mcp: { exclude: "dungeon_edit unlink covers it" },
  python: {}
});
var door = defineOp({
  name: "dungeon.door",
  module: "maps",
  effect: "write",
  summary: "Set the door at one end of a corridor.",
  params: {
    id: idParam("the dungeon id", "dungeon door: <id> <index>"),
    path: pathParam("dungeon"),
    index: p.str("the corridor's index (dungeon show)", { positional: true }),
    end: p.str("from | to", { positional: true }),
    kind: p.str("door | secret | locked | portcullis | arch | none", { positional: true })
  },
  run(i, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      corridorOf(m, i, "door");
      const kind = dungeon_exports.doorPair(i.kind ?? "none")[0];
      if (i.end !== "from" && i.end !== "to") throw new Error("dungeon door <id> <index> from|to <kind|none>");
      dungeon_exports.editDungeon(m, { op: "door", index: Number(i.index), end: i.end, kind });
    });
  },
  cli: { usage: "       artgen dungeon door <id> <i> from|to <kind|none>", text: (m, i) => [`${m.id}: ${m.corridors.length} corridors`, ...warningLines(m), next(i, m.id)].join("\n"), json: (m) => V(m.corridors) },
  mcp: { exclude: "dungeon_edit door covers it" },
  python: {}
});
var block = defineOp({
  name: "dungeon.block",
  module: "maps",
  effect: "write",
  summary: "Add, split again or remove a block: one shape split into rooms that share walls, with doors between them.",
  params: {
    id: idParam("the dungeon id", "dungeon block: <id> add|split|rm"),
    path: pathParam("dungeon"),
    action: p.str("add | split | rm", { positional: true }),
    target: p.str("add: the shape (rect, octagon, circle, hex, poly); split, rm: the block id", { positional: true }),
    at: p.str("the top-left corner: x,y or a cell like C4"),
    size: p.size("width x height in cells, e.g. 12x8", { error: CELLS }),
    points: p.points("poly: x,y,\u2026 of the outline"),
    split: p.oneOf(dungeon_exports.SPLIT_MODES, "bsp | rows | cols | grid | cuts"),
    min: p.num("about the size of each room, cells"),
    cuts_x: p.list("number", "cuts mode: the x lines"),
    cuts_y: p.list("number", "cuts mode: the y lines"),
    seed: p.num("the layout seed"),
    doors: p.num("extra doors, 0..1"),
    block_id: p.str("add: the new block's id (default b<n>)")
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    let note = "";
    const m = updateDungeon(P, refOf(i), (m2) => {
      const bid = i.target, cuts = i.cuts_x || i.cuts_y ? { ...i.cuts_x && { x: i.cuts_x }, ...i.cuts_y && { y: i.cuts_y } } : void 0;
      if (i.action === "add") {
        if (!["rect", "octagon", "circle", "hex", "poly"].includes(bid)) throw new Error("dungeon block <id> add rect|octagon|circle|hex|poly");
        const o = { op: "add_block", shape: bid, split: i.split ?? "bsp", ...i.min !== void 0 && { min: i.min }, ...cuts && { cuts }, ...i.seed !== void 0 && { seed: i.seed }, ...i.doors !== void 0 && { doors: i.doors }, ...i.block_id && { id: i.block_id } };
        if (bid === "poly") o.points = needPoints(i.points, "--points");
        else {
          if (!i.at || !i.size) throw new Error("dungeon block <id> add <shape> --at x,y|C4 --size WxH");
          Object.assign(o, { at: i.at, w: i.size[0], h: i.size[1] });
        }
        note = dungeon_exports.editDungeon(m2, o);
      } else if (i.action === "split") {
        if (!m2.blocks?.some((x) => x.id === bid)) throw new Error(`no block ${bid} (have: ${(m2.blocks ?? []).map((x) => x.id).join(", ") || "none"})`);
        note = dungeon_exports.editDungeon(m2, {
          op: "split_block",
          id: bid,
          ...i.split && { split: i.split },
          ...i.min !== void 0 && { min: i.min },
          ...cuts && { cuts },
          ...i.seed !== void 0 && { seed: i.seed },
          reseed: !i.split && i.min === void 0,
          ...i.doors !== void 0 && { doors: i.doors }
        });
      } else if (i.action === "rm") note = dungeon_exports.editDungeon(m2, { op: "remove_block", id: bid });
      else throw new Error("dungeon block <id> add|split|rm");
    });
    return { m, note };
  },
  cli: {
    usage: [
      "       artgen dungeon block <id> add rect|octagon|circle|hex|poly --at x,y --size WxH [--points x,y,\u2026] [--split bsp|rows|cols|grid|cuts] [--min 3] [--cuts-x 4,8] [--cuts-y 6] [--seed n] [--doors 0.25] [--block-id b1]",
      "                  | split <bid> [--seed n] [--split mode] [--min n] | rm <bid>   one shape split into rooms that share walls, with doors between (a block id in link means its nearest room)"
    ],
    text: (r, i) => [`${r.m.id}: ${r.note}`, ...warningLines(r.m), next(i, r.m.id)].join("\n"),
    json: (r) => V(r.m.blocks ?? [])
  },
  mcp: { exclude: "dungeon_edit add_block / split_block / remove_block covers it" },
  python: {}
});
var connect = defineOp({
  name: "dungeon.connect",
  module: "maps",
  effect: "write",
  summary: "Put a door or an opening in the wall two touching rooms share.",
  params: {
    id: idParam("the dungeon id", "dungeon connect: <id>"),
    path: pathParam("dungeon"),
    a: p.str("the first room", { positional: true, required: "dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1]" }),
    b: p.str("the second room", { positional: true, required: "dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1]" }),
    kind: p.oneOf([...dungeon_exports.DOOR_KINDS, "open"], "door | secret | locked | portcullis | arch | open", { error: `open or one of ${dungeon_exports.DOOR_KINDS.join(", ")}` }),
    at: p.str("a point on their shared wall: x,y"),
    width: p.num("the opening in cells (default 1)"),
    origin: p.str("who wrote it (a sync replaces its own)")
  },
  run(i, ctx) {
    let line2 = "";
    const m = updateDungeon(projectOf(i, ctx), refOf(i), (m2) => {
      line2 = dungeon_exports.editDungeon(m2, { op: "connect", a: i.a, b: i.b, ...i.at && { at: i.at }, ...i.kind && { kind: i.kind }, ...i.width !== void 0 && { width: i.width }, ...originOf(i.origin) });
    });
    return { m, line: line2 };
  },
  cli: {
    usage: "       artgen dungeon connect <id> <room> <room> [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width 1] | disconnect <id> <i>   a door or opening in the wall two touching rooms share",
    text: (r, i) => [`${r.m.id}: ${r.line}`, ...warningLines(r.m), next(i, r.m.id)].join("\n"),
    json: (r) => V(r.m.connections)
  },
  mcp: { exclude: "dungeon_edit connect covers it" },
  python: {}
});
var disconnect = defineOp({
  name: "dungeon.disconnect",
  module: "maps",
  effect: "write",
  summary: "Remove a connection between touching rooms.",
  params: { id: idParam("the dungeon id", "dungeon disconnect: <id> <index>"), path: pathParam("dungeon"), index: p.str("the connection's index (dungeon show)", { positional: true }) },
  run(i, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      const k = Number(i.index);
      if (!Number.isInteger(k) || k < 0 || k >= (m.connections?.length ?? 0)) throw new Error(`dungeon disconnect <id> <index> (connections 0..${(m.connections?.length ?? 0) - 1}; artgen dungeon show)`);
      dungeon_exports.editDungeon(m, { op: "disconnect", index: k });
    });
  },
  cli: { usage: [], text: (m, i) => `${m.id}: ${m.connections?.length ?? 0} connections
${next(i, m.id)}`, json: (m) => V(m.connections ?? []) },
  mcp: { exclude: "dungeon_edit disconnect covers it" },
  python: {}
});
var fit = defineOp({
  name: "dungeon.fit",
  module: "maps",
  effect: "write",
  summary: "Crop the sheet to the rooms, with a margin.",
  params: { id: idParam("the dungeon id", "dungeon fit: <id>"), path: pathParam("dungeon"), margin: p.num("cells of margin (default 2)") },
  run(i, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      dungeon_exports.editDungeon(m, { op: "fit", margin: i.margin ?? 2 });
    });
  },
  cli: { usage: "       artgen dungeon fit <id> [--margin 2]", text: (m, i) => `${m.id}: ${m.cols}\xD7${m.rows} cells
${next(i, m.id)}`, json: (m) => V({ cols: m.cols, rows: m.rows }) },
  mcp: { exclude: "dungeon_edit fit covers it" },
  python: {}
});
var label = defineOp({
  name: "dungeon.label",
  module: "maps",
  effect: "write",
  summary: "Add a label to a dungeon.",
  params: {
    id: idParam("the dungeon id", "dungeon label: <id>"),
    path: pathParam("dungeon"),
    text: p.str("the label text", { positional: true }),
    at: p.str("x,y or a cell like C4"),
    kind: p.oneOf(dungeon_exports.LABEL_KINDS, "name (bold) | note (italic) | area (big spaced capitals); default name"),
    size: p.num("size factor"),
    angle: p.num("degrees"),
    href: p.str("a link: http(s), a relative path or #anchor"),
    origin: p.str("who wrote it (a sync replaces its own)")
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    if (!i.text || !i.at) throw new Error('dungeon label <id> "Text" --at x,y|C4');
    const m = updateDungeon(P, refOf(i), (m2) => {
      const [x, y] = dungeon_exports.parsePoint(i.at);
      m2.overlay.labels.push({ text: i.text, x, y, kind: i.kind ?? "name", ...i.size !== void 0 && { size: i.size }, ...i.angle !== void 0 && { angle: i.angle }, ...i.href && { href: i.href }, ...originOf(i.origin) });
    });
    return { m, n: m.overlay.labels.length };
  },
  cli: { usage: '       artgen dungeon label <id> "Text" --at x,y|C4 [--kind name|note|area] [--size f] [--angle deg] [--href url] [--origin name]', text: (r, i) => [`${r.m.id}: label ${r.n - 1} "${i.text}"`, ...warningLines(r.m), next(i, r.m.id)].join("\n"), json: (r) => V(r.m.overlay.labels) },
  mcp: { exclude: "dungeon_overlay add_labels covers it" },
  python: {}
});
var symbol = defineOp({
  name: "dungeon.symbol",
  module: "maps",
  effect: "write",
  summary: "Add a symbol to a dungeon.",
  params: {
    id: idParam("the dungeon id", "dungeon symbol: <id>"),
    path: pathParam("dungeon"),
    kind: p.str("the symbol kind (artgen dungeon symbols)", { positional: true }),
    at: p.str("x,y or a cell like C4"),
    scale: p.num("size factor"),
    angle: p.num("degrees"),
    origin: p.str("who wrote it (a sync replaces its own)")
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    if (!i.kind || !i.at) throw new Error("dungeon symbol <id> <kind> --at x,y|C4 (kinds: artgen dungeon symbols)");
    const m = updateDungeon(P, refOf(i), (m2) => {
      const [x, y] = dungeon_exports.parsePoint(i.at);
      if (!dungeon_exports.SYMBOLS[i.kind]) throw new Error(`unknown symbol ${i.kind} (have: ${dungeon_exports.SYMBOL_KINDS.join(", ")})`);
      m2.overlay.symbols.push({ kind: i.kind, x, y, ...i.scale !== void 0 && { scale: i.scale }, ...i.angle !== void 0 && { angle: i.angle }, ...originOf(i.origin) });
    });
    return { m, n: m.overlay.symbols.length };
  },
  cli: { usage: "       artgen dungeon symbol <id> <kind> --at x,y|C4 [--scale f] [--angle deg] [--origin name]", text: (r, i) => [`${r.m.id}: symbol ${r.n - 1} "${i.kind}"`, ...warningLines(r.m), next(i, r.m.id)].join("\n"), json: (r) => V(r.m.overlay.symbols) },
  mcp: { exclude: "dungeon_overlay add_symbols covers it" },
  python: {}
});
var check = defineOp({
  name: "dungeon.check",
  module: "maps",
  effect: "read",
  summary: "Check a dungeon file: every error with its JSON path, then drawing errors and warnings.",
  description: "Check a dungeon: every error in its file with the JSON path (a field out of range, a room id that is not there), then drawing errors and warnings (a room outline that crosses itself, rooms laid over each other, a corridor through a room it does not join or across another, a door never drawn, a mark off the sheet or on a room number). Fix errors before rendering; look at each warning.",
  params: { id: idParam("the dungeon id", "dungeon check: <id>"), path: pathParam("dungeon") },
  run: (i, ctx) => checkDungeonFile(projectOf(i, ctx), refOf(i)),
  cli: {
    usage: "       artgen dungeon check <id> [--json]   every error in the file with its JSON path, then drawing errors and warnings (a room outline that crosses itself, rooms laid over each other, a corridor through a room it does not join or across another, a door never drawn, a mark off the sheet or on a badge); exits 1 when there are errors",
    text(r) {
      const n = (k, w) => `${k} ${w}${k === 1 ? "" : "s"}`;
      return [
        r.ok ? `${r.file}: ok${r.warnings.length ? `, ${n(r.warnings.length, "warning")}` : ""}` : `${r.file}: ${n(r.errors.length, "error")}${r.warnings.length ? `, ${n(r.warnings.length, "warning")}` : ""}`,
        ...r.errors.map((e) => `  error: ${e.path || "(file)"}: ${e.message}`),
        ...r.warnings.map((e) => `  warning: ${e.path || "(file)"}: ${e.message}`)
      ].join("\n");
    },
    json: (r) => V(r),
    exit: (r) => r.ok ? 0 : 1
  },
  mcp: {},
  python: {}
});
var overlay = defineOp({
  name: "dungeon.overlay",
  module: "maps",
  effect: "write",
  summary: "Remove or clear labels and symbols on a dungeon, or add them as JSON lists.",
  description: 'Labels and symbols over a dungeon (the follow-up layer). add_labels: [{text, at:"x,y"|"C4" or x,y, kind: name|note|area, size?, angle?, href? (a link: http(s), a relative path or #anchor)}]; add_symbols: [{kind, at or x,y, scale?, angle?}] (kinds from dungeon_list: stairs, pillar, statue, altar, chest, trap, pit, pool, \u2026); remove_labels / remove_symbols: indices (from dungeon_get); clear: "labels"|"symbols"|"all". Room names and numbers are room settings (dungeon_edit set_room).',
  params: { id: idParam("the dungeon id", "dungeon overlay: <id> rm|clear"), path: pathParam("dungeon"), ...overlayParams("labels | symbols") },
  run(i, ctx) {
    return updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      const pt3 = (o) => typeof o.at === "string" ? dungeon_exports.parsePoint(o.at) : Array.isArray(o.at) ? [Number(o.at[0]), Number(o.at[1])] : [Number(o.x), Number(o.y)];
      overlayEdit(m, i, {
        name: "dungeon",
        strict: ctx.surface === "cli",
        addLabel(l) {
          const [x, y] = pt3(l);
          m.overlay.labels.push({ text: String(l.text), x, y, kind: l.kind ?? "name", ...typeof l.size === "number" && { size: l.size }, ...typeof l.angle === "number" && { angle: l.angle }, ...typeof l.href === "string" && l.href && { href: l.href }, ...typeof l.origin === "string" && l.origin && { origin: l.origin } });
        },
        addSymbol(s) {
          if (!dungeon_exports.SYMBOLS[String(s.kind)]) throw new Error(`unknown symbol ${String(s.kind)} (have: ${dungeon_exports.SYMBOL_KINDS.join(", ")})`);
          const [x, y] = pt3(s);
          m.overlay.symbols.push({ kind: String(s.kind), x, y, ...typeof s.scale === "number" && { scale: s.scale }, ...typeof s.angle === "number" && { angle: s.angle }, ...typeof s.origin === "string" && s.origin && { origin: s.origin } });
        }
      });
    });
  },
  cli: {
    usage: "       artgen dungeon overlay <id> rm label|symbol <i> | clear [labels|symbols]   or  [--add-labels '<json>'] [--add-symbols '<json>'] [--remove-labels i,j] [--remove-symbols i,j] [--clear labels|symbols|all]",
    text: (m) => `${m.id}: ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols`,
    json: (m) => V(m.overlay)
  },
  mcp: { content: (m) => [text(overlayLines(m))] },
  python: {}
});
async function renderPreview(r, i, ctx) {
  const P = ctx.project(), layers = layersOf(i.layers, (v) => parseLayers(v, dungeon_exports.DUNGEON_LAYERS));
  const files = r.files.map((f) => ctx.rel(f));
  const look = typeof i.ppu === "number" ? files.filter((f) => f.endsWith(".png")) : (await renderDungeonFiles(P, i.id, { ppu: 24, layers, formats: ["png"], out: join13(P.art, "dungeons", i.id, "out", "preview") })).files.map((f) => ctx.rel(f));
  return [text({ ...r, files }), ...look.map((f) => pngFile(join13(P.root, f)))];
}
var render = defineOp({
  name: "dungeon.render",
  module: "maps",
  effect: "render",
  summary: "Render a dungeon to black-and-white SVG and/or PNG.",
  description: "Render a dungeon to art/dungeons/<id>/out/ (black-and-white SVG + PNG) and return the PNG to look at. layers turns layers off/on: rock, floors, grid, doors, symbols, numbers, labels, title, scale, compass. ppu: pixels per cell (default 40; the returned image uses 24 unless set).",
  params: {
    id: idParam("the dungeon id", "dungeon render: <id>"),
    path: pathParam("dungeon"),
    ppu: p.num("pixels per cell (default 40)"),
    layers: p.str("layers to turn off/on, e.g. grid=off,labels=off", { schema: { type: "object", description: "layers to turn off/on, e.g. { grid: false }" } }),
    format: p.oneOf(["svg", "png", "both"], "svg, png or both (default both)", { mcp: false, error: "svg, png or both" }),
    fit: p.str("180x260mm or 800x600px: pick the scale that fits the window in the box", { mcp: false }),
    page_scale: p.str("output pixels per millimetre on the page", { mcp: false }),
    crop: p.str("x,y,w,h in cells: a window on the render", { mcp: false }),
    room: { kind: "string", doc: "crop round this room (a room id or a number like F.3), its doors and the first --margin cells of each corridor; repeat for more", repeat: true, mcp: false },
    margin: p.num("with --room: cells of margin (default 2)", { mcp: false }),
    out: p.str("the folder to render into", { mcp: false })
  },
  async run(i, ctx) {
    const P = projectOf(i, ctx), format = i.format ?? "both";
    return renderDungeonFiles(P, refOf(i), {
      formats: format === "both" ? ["svg", "png"] : [format],
      ppu: i.ppu,
      pageScale: pageScaleOf(i.page_scale),
      ...viewOf(i, () => 1),
      rooms: i.room ?? [],
      margin: i.margin,
      layers: layersOf(i.layers, (v) => parseLayers(v, dungeon_exports.DUNGEON_LAYERS)),
      out: i.out
    });
  },
  cli: {
    usage: [
      "       artgen dungeon render <id> [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h] [--room id|F.3 \u2026 [--margin 2]] [--layers grid=off,labels=off] [--out dir]",
      "         (--room, repeated, crops round those rooms, their doors and the first --margin cells of each corridor)"
    ],
    text: (r, i) => [`${i.path ?? i.id} ${r.size.join("\xD7")} px, ${r.ppu} px a cell, window ${r.crop.join(",")}: ${r.rooms} rooms, ${r.corridors} corridors, ${r.doors} doors`, ...r.unplaced.map((u) => `  no free spot for label ${u.index} "${u.text}"`), ...r.files.map((f) => `  ${f}`)].join("\n"),
    json: (r) => V(r)
  },
  mcp: { content: renderPreview },
  python: {}
});
var facts = defineOp({
  name: "dungeon.facts",
  module: "maps",
  effect: "read",
  summary: "A dungeon read back as numbers: each room's box and doors, corridors, exits, overlaps and unreached rooms.",
  description: "A dungeon read back as numbers: each room's box and doors, each corridor's ends and length, the exits, the overlapping rooms and the rooms no corridor reaches. Positions in cells, lengths also in the scale unit.",
  params: { id: idParam("the dungeon id", "dungeon facts: <id>"), path: pathParam("dungeon") },
  run: (i, ctx) => dungeon_exports.dungeonFacts(readDungeon(projectOf(i, ctx), refOf(i))),
  cli: { usage: "       artgen dungeon facts <id> [--json]   each room's box and doors, each corridor's ends and length, the exits, the overlapping rooms and the rooms no corridor reaches", text: (r) => describeDungeonFacts(r), json: (r) => V(r) },
  mcp: {},
  python: {}
});
var sync = defineOp({
  name: "dungeon.sync",
  module: "maps",
  effect: "write",
  summary: "Replace the entries of one origin from a regenerated file, keeping every other.",
  params: {
    origin: p.str("the origin to replace (e.g. tables)", { required: "dungeon sync <id>|--file target.json --from new.json --origin tables" }),
    from: p.str("the new file: every entry in it carries the origin", { required: "dungeon sync <id>|--file target.json --from new.json --origin tables" }),
    id: idParam("the dungeon id", "dungeon sync: <id>"),
    path: pathParam("dungeon")
  },
  run(i, ctx) {
    let report;
    updateDungeon(projectOf(i, ctx), refOf(i), (m) => {
      const r = dungeon_exports.syncDungeon(m, dungeon_exports.parseDungeon(readJson(i.from)), i.origin);
      report = r.report;
      return r.spec;
    });
    return report;
  },
  cli: { usage: "       artgen dungeon sync <id>|--file target.json --from new.json --origin tables [--json]   the same for rooms, corridors, walls, labels and symbols; a hand-edited field of a generated room is reported and the table's value kept", text: (r, i) => syncText(String(i.path ?? i.id), r), json: (r) => V(r) },
  mcp: { exclude: "reads --from by path (consumer tooling)" },
  python: {}
});
var DUNGEON_OPS_LIST = [list3, symbols, show2, create, update, grid2, style, gen, edit, roomCmd, block, link, unlink, door, connect, disconnect, fit, label, symbol, check, overlay, render, facts, sync];

// ../artgen-cli/src/ops/maps-map.ts
import { join as join14 } from "node:path";
var V2 = (data) => withVersion(data, map_exports.MAP_FORMAT);
var next2 = (i, id2) => i.path ? `next: artgen map render --file ${i.path}` : `next: artgen map render ${id2 ?? i.id}`;
var LAYER_DOC = "layers to turn off/on, e.g. grid=off,labels=off";
var list4 = defineOp({
  name: "map.list",
  module: "maps",
  effect: "read",
  summary: "List the terrain maps in the project (or the one named by --file).",
  description: "Terrain maps (TTRPG) in art/maps, plus the terrains, symbol kinds and label kinds the map tools accept.",
  params: { path: pathParam("map") },
  run: (i, ctx) => i.path ? [mapSummary(readMap(null, { file: i.path }))] : listMaps(ctx.project()),
  cli: {
    usage: "       artgen map list | show <id> | symbols",
    text: (ms) => ms.length ? ms.map((m) => `${m.id.padEnd(16)} ${m.preset.padEnd(9)} ${m.size.padEnd(7)} ${m.edits} edits, ${m.labels} labels, ${m.symbols} symbols${m.title ? `  "${m.title}"` : ""}`).join("\n") : "no maps yet: artgen map new <id>",
    json: (ms) => V2(ms)
  },
  mcp: { content: (ms) => [text({ maps: ms, terrains: map_exports.TERRAINS, symbols: map_exports.SYMBOL_KINDS, labelKinds: map_exports.LABEL_KINDS, presets: map_exports.PRESETS })] },
  python: {}
});
var symbols2 = defineOp({
  name: "map.symbols",
  module: "maps",
  effect: "read",
  summary: "List the symbol kinds a map can carry.",
  params: {},
  run: () => map_exports.SYMBOL_KINDS,
  cli: { usage: [], text: () => Object.entries(map_exports.SYMBOLS).map(([k, v]) => `${k.padEnd(10)} ${v.name}`).join("\n"), json: (kinds) => V2(kinds) },
  mcp: { exclude: "map_list returns the symbol kinds" },
  python: {}
});
var show3 = defineOp({
  name: "map.show",
  module: "maps",
  effect: "read",
  summary: "Show a terrain map: its settings, edits, labels and symbols with their indices.",
  description: "A terrain map's file (art/maps/<id>/map.json) and a readable summary: generator settings, edits, labels and symbols with their indices.",
  params: { id: idParam("the map id", "map show: <id>"), path: pathParam("map") },
  run: (i, ctx) => readMap(projectOf(i, ctx), refOf(i)),
  cli: { usage: [], text: (m) => describeMap(m), json: (m) => V2(m) },
  mcp: { name: "map_get", content: (m) => [text(describeMap(m)), text(m)] },
  python: {}
});
var create2 = defineOp({
  name: "map.new",
  module: "maps",
  effect: "write",
  summary: "Create a terrain map from a preset.",
  description: "Create a terrain map from a preset: regional (hex crawl, 6 mi hexes) or local (battle map, 5 ft squares). The terrain is generated from the seed; render it with map_render, then adjust.",
  params: {
    id: idParam("the new map's id (a name, never a path)", "map new: <id> is required"),
    path: pathParam("map"),
    preset: p.oneOf(map_exports.PRESETS, "regional (hex crawl, 6 mi hexes) or local (battle map, 5 ft squares); default regional", { error: map_exports.PRESETS.join(" or ") }),
    size: p.str("COLSxROWS, e.g. 30x22", { mcp: false }),
    cols: p.num("columns", { cli: false }),
    rows: p.num("rows", { cli: false }),
    seed: p.num("the generator seed (default: random)"),
    title: p.str("the title"),
    grid: p.oneOf(map_exports.GRID_TYPES, "the grid: hex, square or none"),
    force: p.bool("overwrite an existing file (with --file)", { mcp: false })
  },
  run(i, ctx) {
    const P = projectOf(i, ctx), preset = i.preset ?? "regional";
    const sz = typeof i.size === "string" ? i.size.match(/^(\d+)x(\d+)$/) : null;
    if (i.size && !sz) throw new Error("--size: COLSxROWS, e.g. 30x22");
    const cols = sz ? +sz[1] : typeof i.cols === "number" ? i.cols : void 0, rows2 = sz ? +sz[2] : typeof i.rows === "number" ? i.rows : void 0;
    return createMap(P, i.path ? i.id ?? fileId(i.path) : i.id, preset, {
      seed: typeof i.seed === "number" ? i.seed : Math.floor(Math.random() * 1e6),
      ...cols !== void 0 && { cols },
      ...rows2 !== void 0 && { rows: rows2 },
      ...i.title && { title: i.title },
      ...typeof i.grid === "string" && { grid: { ...map_exports.PRESET_DEFAULTS[preset].grid, type: i.grid } }
    }, i.force === true, i.path ? { file: i.path } : void 0);
  },
  cli: { usage: '       artgen map new <id> [--preset regional|local] [--size 30x22] [--grid hex|square|none] [--seed n] [--title "..."]', text: (r, i) => `${r.file}
${describeMap(r.map)}
${next2(i, r.map.id)}`, json: (r) => V2({ file: r.file, map: r.map }) },
  mcp: { content: (r) => [text({ file: r.file, summary: describeMap(r.map) })] },
  python: {}
});
var gen2 = defineOp({
  name: "map.gen",
  module: "maps",
  effect: "write",
  summary: "Regenerate a terrain map's ground with new generator settings.",
  params: {
    id: idParam("the map id", "map gen: <id>"),
    path: pathParam("map"),
    seed: p.num("the generator seed"),
    land: p.oneOf(map_exports.LAND_MODES, "mixed, island or inland"),
    sea: p.num("water fraction, 0..0.9"),
    moisture: p.num("0..1"),
    roughness: p.num("0..1"),
    relief: p.num("0..1"),
    rivers: p.num("0..20"),
    simplify: p.num("0..6; higher = fewer, larger, smoother patches"),
    feature: p.num("hill size in cells"),
    interval: p.num("contour interval"),
    max_elevation: p.num("the highest contour"),
    major_every: p.num("a heavier contour every n lines"),
    topo_labels: p.bool("label the contours", { style: "onoff" })
  },
  run(i, ctx) {
    return updateMap(projectOf(i, ctx), refOf(i), (m) => {
      if (i.seed !== void 0) m.seed = i.seed;
      if (i.land) m.gen.land = i.land;
      for (const k of ["sea", "moisture", "roughness", "relief", "rivers", "simplify", "feature"]) if (i[k] !== void 0) m.gen[k] = i[k];
      if (i.interval !== void 0) m.topo.interval = i.interval;
      if (i.max_elevation !== void 0) m.topo.maxElevation = i.max_elevation;
      if (i.major_every !== void 0) m.topo.majorEvery = i.major_every;
      if (i.topo_labels !== void 0) m.topo.labels = i.topo_labels;
    });
  },
  cli: {
    usage: "       artgen map gen <id> [--seed n] [--land mixed|island|inland] [--sea f] [--moisture f] [--roughness f] [--relief f] [--rivers n] [--simplify n] [--feature n] [--interval n] [--max-elevation n] [--topo-labels on|off]",
    text: (m, i) => `${describeMap(m)}
${next2(i)}`,
    json: (m) => V2(m)
  },
  mcp: { exclude: "map_update covers it" },
  python: {}
});
var update2 = defineOp({
  name: "map.update",
  module: "maps",
  effect: "write",
  summary: "Change a terrain map's settings.",
  description: "Change a terrain map's settings. gen: {land: mixed|island|inland, sea 0..0.9 (water fraction), moisture 0..1, roughness 0..1, relief 0..1, rivers 0..20, simplify 0..6 (higher = fewer, larger, smoother patches), feature (hill size in cells)}; topo: {interval, maxElevation, majorEvery, unit, labels}; grid: {type none|square|hex, size, coords}; scale: {perCell, unit}; title, legend, scale_bar, compass.",
  params: {
    id: idParam("the map id", "map update: <id>"),
    path: pathParam("map"),
    seed: p.num("the generator seed"),
    gen: p.json({ type: "object" }, "generator settings, as JSON"),
    topo: p.json({ type: "object" }, "contour settings, as JSON"),
    grid: p.json({ type: "object" }, "grid settings, as JSON"),
    scale: p.json({ type: "object" }, "scale settings, as JSON"),
    title: p.str('the title ("" removes it)'),
    legend: p.bool("show the legend", { style: "onoff" }),
    scale_bar: p.bool("show the scale bar", { style: "onoff" }),
    compass: p.bool("show the compass", { style: "onoff" })
  },
  run(i, ctx) {
    return updateMap(projectOf(i, ctx), refOf(i), (m) => {
      if (typeof i.seed === "number") m.seed = i.seed;
      for (const k of ["gen", "topo", "grid", "scale"]) if (i[k] && typeof i[k] === "object") Object.assign(m[k], i[k]);
      if (typeof i.title === "string") {
        if (i.title) m.title = i.title;
        else delete m.title;
      }
      if (typeof i.legend === "boolean") m.legend = i.legend;
      if (typeof i.scale_bar === "boolean") m.scaleBar = i.scale_bar;
      if (typeof i.compass === "boolean") m.compass = i.compass;
    });
  },
  cli: {
    usage: `       artgen map update <id> [--seed n] [--gen '<json>'] [--topo '<json>'] [--grid '<json>'] [--scale '<json>'] [--title "..."] [--legend on|off] [--scale-bar on|off] [--compass on|off]   (the settings as JSON, or @file.json)`,
    text: (m, i) => `${describeMap(m)}
${next2(i, m.id)}`,
    json: (m) => V2(m)
  },
  mcp: { content: (m) => [text(describeMap(m))] },
  python: {}
});
var edit2 = defineOp({
  name: "map.edit",
  module: "maps",
  effect: "write",
  summary: "Edit a terrain map's ground: paint, elevate, river, road, undo; or a batch of edits as JSON.",
  description: 'Append terrain edits to a map (applied in order on top of the generated terrain), or undo the last ones. Coordinates are map cells (x right, y down). ops: {op:"paint", terrain, shape} | {op:"elevate", amount -1..1, shape} | {op:"river", points:[x,y,\u2026] from source to mouth, width? (at the mouth), delta? (default true: flares into the water it ends in, banks merging into the shore)} | {op:"road", points:[x,y,\u2026]}; shape: {circle:[x,y,r]} | {poly:[x,y,\u2026]} | {stroke:[x,y,\u2026], width}.',
  params: {
    id: idParam("the map id", "map edit: <id> <op>"),
    path: pathParam("map"),
    op: p.str("paint | elevate | river | road | undo", { positional: true, mcp: false }),
    ops: p.json({ type: "array", items: { type: "object" } }, "a batch of edits, as JSON (or @file.json); see the MCP tool for the fields"),
    undo: p.num("remove this many of the latest edits first", { schema: { type: "number", description: "remove this many of the latest edits first" } }),
    terrain: p.oneOf(map_exports.TERRAINS, "the terrain to paint", { mcp: false, error: `one of ${map_exports.TERRAINS.join(", ")}` }),
    circle: p.str("x,y,r", { mcp: false }),
    poly: p.str("x,y,x,y,\u2026", { mcp: false }),
    stroke: p.str("x,y,\u2026 (with --width)", { mcp: false }),
    width: p.str("stroke or river width", { mcp: false }),
    amount: p.num("elevate by this much (negative: a valley); default 0.2", { mcp: false }),
    points: p.points("x,y,\u2026 (river: source first; road)", { mcp: false }),
    delta: p.bool("a river flares into the water it ends in (off: not)", { style: "onoff", mcp: false }),
    origin: p.str("who wrote the edit (a sync replaces its own)", { mcp: false })
  },
  run(i, ctx) {
    let summary = "";
    const m = updateMap(projectOf(i, ctx), refOf(i), (m2) => {
      if (i.op !== void 0) {
        if (i.ops !== void 0 || i.undo !== void 0) throw new Error("map edit: give an <op>, or --ops / --undo, not both");
        const shape = () => shapeFrom({ circle: i.circle, poly: i.poly, stroke: i.stroke, width: i.width });
        if (i.op === "undo") {
          const e = m2.edits.pop();
          if (!e) throw new Error(`${m2.id}: no edits to undo`);
          summary = `removed ${e.op}`;
          return;
        }
        if (i.op === "paint") {
          if (!map_exports.TERRAINS.includes(i.terrain)) throw new Error(`--terrain: one of ${map_exports.TERRAINS.join(", ")}`);
          m2.edits.push({ op: i.op, terrain: i.terrain, shape: shape() });
        } else if (i.op === "elevate") m2.edits.push({ op: i.op, amount: i.amount ?? 0.2, shape: shape() });
        else if (i.op === "river") m2.edits.push({ op: i.op, points: needPoints(i.points, "--points"), ...numFlag(i.width, "--width") !== void 0 && { width: numFlag(i.width, "--width") }, ...i.delta === false && { delta: false } });
        else if (i.op === "road") m2.edits.push({ op: i.op, points: needPoints(i.points, "--points") });
        else throw new Error("map edit <id> paint|elevate|river|road|undo");
        if (originOf(i.origin)) m2.edits[m2.edits.length - 1].origin = originOf(i.origin).origin;
        summary = `edit ${m2.edits.length - 1}: ${i.op}`;
        return;
      }
      if (i.ops === void 0 && i.undo === void 0 && ctx.surface === "cli") throw new Error("map edit <id> paint|elevate|river|road|undo");
      const n = typeof i.undo === "number" ? i.undo : 0;
      if (n > m2.edits.length) throw new Error(`${m2.id}: only ${m2.edits.length} edits to undo`);
      m2.edits.splice(m2.edits.length - n, n);
      if (Array.isArray(i.ops)) m2.edits.push(...i.ops);
      summary = `${n ? `removed ${n}${Array.isArray(i.ops) ? ", " : ""}` : ""}${Array.isArray(i.ops) ? `added ${i.ops.length}` : ""}` || "no change";
    });
    return { m, summary };
  },
  cli: {
    usage: [
      "       artgen map edit <id> paint --terrain t <shape> | elevate --amount \xB1f <shape> | river --points x,y,\u2026 [--width w] [--delta off] | road --points x,y,\u2026 | undo   [--origin name]",
      `                  <shape>: --circle x,y,r | --poly x,y,x,y,\u2026 | --stroke x,y,\u2026 --width w   (terrains: ${map_exports.TERRAINS.join(", ")})`,
      `       artgen map edit <id> [--undo n] [--ops '<json list>']   (a batch: see the MCP tool map_edit for the edits; @file.json reads them from a file)`
    ],
    text: (r, i) => `${r.m.id}: ${r.summary} (${r.m.edits.length} edits)
${next2(i, r.m.id)}`,
    json: (r) => V2(r.m)
  },
  mcp: { content: (r) => [text({ edits: r.m.edits.length, last: r.m.edits.slice(-3) })] },
  python: {}
});
var grid3 = defineOp({
  name: "map.grid",
  module: "maps",
  effect: "write",
  summary: "Set a terrain map's grid.",
  params: {
    id: idParam("the map id", "map grid: <id>"),
    path: pathParam("map"),
    type: p.str("hex | square | none", { positional: true }),
    size: p.num("grid size in map units"),
    coords: p.bool("show coordinates", { style: "onoff" })
  },
  run(i, ctx) {
    const P = projectOf(i, ctx), type = i.type;
    if (!map_exports.GRID_TYPES.includes(type)) throw new Error(`map grid <id> ${map_exports.GRID_TYPES.join("|")}`);
    return updateMap(P, refOf(i), (m) => {
      m.grid.type = type;
      if (i.size !== void 0) m.grid.size = i.size;
      if (i.coords !== void 0) m.grid.coords = i.coords;
    });
  },
  cli: {
    usage: "       artgen map grid <id> hex|square|none [--size n] [--coords on|off]",
    text: (m, i) => `${m.id}: grid ${m.grid.type}${m.grid.type !== "none" ? ` size ${m.grid.size}${m.grid.coords ? ", coordinates" : ""}` : ""}
${next2(i, m.id)}`,
    json: (m) => V2(m.grid)
  },
  mcp: { exclude: "map_update covers it" },
  python: {}
});
var label2 = defineOp({
  name: "map.label",
  module: "maps",
  effect: "write",
  summary: "Add a label to a terrain map.",
  params: {
    id: idParam("the map id", "map label: <id>"),
    path: pathParam("map"),
    text: p.str("the label text", { positional: true }),
    at: p.str("x,y, a hex like 0304 or a cell like C4"),
    kind: p.oneOf(map_exports.LABEL_KINDS, "region (big spaced capitals), place (bold, beside its symbol), water (italic) or note; default place"),
    size: p.num("size factor"),
    angle: p.num("degrees"),
    origin: p.str("who wrote it (a sync replaces its own)")
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    if (!i.text || !i.at) throw new Error('map label <id> "Text" --at x,y|0304|C4');
    const m = updateMap(P, refOf(i), (m2) => {
      const [x, y] = map_exports.parsePoint(m2, i.at), kind = i.kind ?? "place";
      m2.overlay.labels.push({ text: i.text, x, y, kind, ...i.size !== void 0 && { size: i.size }, ...i.angle !== void 0 && { angle: i.angle }, ...originOf(i.origin) });
    });
    return { m, n: m.overlay.labels.length };
  },
  cli: { usage: '       artgen map label <id> "Text" --at x,y|0304|C4 [--kind region|place|water|note] [--size f] [--angle deg] [--origin name]', text: (r, i) => `${r.m.id}: label ${r.n - 1} "${i.text}"
${next2(i, r.m.id)}`, json: (r) => V2(r.m.overlay.labels) },
  mcp: { exclude: "map_overlay add_labels covers it" },
  python: {}
});
var symbol2 = defineOp({
  name: "map.symbol",
  module: "maps",
  effect: "write",
  summary: "Add a symbol to a terrain map.",
  params: {
    id: idParam("the map id", "map symbol: <id>"),
    path: pathParam("map"),
    kind: p.str("the symbol kind (artgen map symbols)", { positional: true }),
    at: p.str("x,y, a hex like 0304 or a cell like C4"),
    scale: p.num("size factor"),
    angle: p.num("degrees"),
    origin: p.str("who wrote it (a sync replaces its own)")
  },
  run(i, ctx) {
    const P = projectOf(i, ctx);
    if (!i.kind || !i.at) throw new Error("map symbol <id> <kind> --at x,y|0304|C4 (kinds: artgen map symbols)");
    const m = updateMap(P, refOf(i), (m2) => {
      const [x, y] = map_exports.parsePoint(m2, i.at);
      if (!map_exports.SYMBOLS[i.kind]) throw new Error(`unknown symbol ${i.kind} (have: ${map_exports.SYMBOL_KINDS.join(", ")})`);
      m2.overlay.symbols.push({ kind: i.kind, x, y, ...i.scale !== void 0 && { scale: i.scale }, ...i.angle !== void 0 && { angle: i.angle }, ...originOf(i.origin) });
    });
    return { m, n: m.overlay.symbols.length };
  },
  cli: { usage: "       artgen map symbol <id> <kind> --at x,y|0304|C4 [--scale f] [--angle deg] [--origin name]", text: (r, i) => `${r.m.id}: symbol ${r.n - 1} "${i.kind}"
${next2(i, r.m.id)}`, json: (r) => V2(r.m.overlay.symbols) },
  mcp: { exclude: "map_overlay add_symbols covers it" },
  python: {}
});
var overlay2 = defineOp({
  name: "map.overlay",
  module: "maps",
  effect: "write",
  summary: "Remove or clear labels and symbols on a terrain map, or add them as JSON lists.",
  description: 'Labels and symbols over a map (the follow-up layer). add_labels: [{text, at:"x,y"|"0304"|"C4" or x,y, kind: region|place|water|note, size?, angle?}]; add_symbols: [{kind, at or x,y, scale?}] (kinds from map_list); remove_labels / remove_symbols: indices (from map_get); clear: "labels"|"symbols"|"all".',
  params: { id: idParam("the map id", "map overlay: <id> rm|clear"), path: pathParam("map"), ...overlayParams("labels | symbols") },
  run(i, ctx) {
    return updateMap(projectOf(i, ctx), refOf(i), (m) => {
      const pt3 = (o) => typeof o.at === "string" ? map_exports.parsePoint(m, o.at) : [Number(o.x), Number(o.y)];
      overlayEdit(m, i, {
        name: "map",
        strict: ctx.surface === "cli",
        addLabel(l) {
          const [x, y] = pt3(l);
          m.overlay.labels.push({ text: String(l.text), x, y, kind: l.kind ?? "place", ...typeof l.size === "number" && { size: l.size }, ...typeof l.angle === "number" && { angle: l.angle }, ...typeof l.href === "string" && l.href && { href: l.href }, ...typeof l.origin === "string" && l.origin && { origin: l.origin } });
        },
        addSymbol(s) {
          if (!map_exports.SYMBOLS[String(s.kind)]) throw new Error(`unknown symbol ${String(s.kind)} (have: ${map_exports.SYMBOL_KINDS.join(", ")})`);
          const [x, y] = pt3(s);
          m.overlay.symbols.push({ kind: String(s.kind), x, y, ...typeof s.scale === "number" && { scale: s.scale }, ...typeof s.angle === "number" && { angle: s.angle }, ...typeof s.origin === "string" && s.origin && { origin: s.origin } });
        }
      });
    });
  },
  cli: {
    usage: "       artgen map overlay <id> rm label|symbol <i> | clear [labels|symbols]   or  [--add-labels '<json>'] [--add-symbols '<json>'] [--remove-labels i,j] [--remove-symbols i,j] [--clear labels|symbols|all]",
    text: (m) => `${m.id}: ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols`,
    json: (m) => V2(m.overlay)
  },
  mcp: { content: (m) => [text(overlayLines(m))] },
  python: {}
});
var set = defineOp({
  name: "map.set",
  module: "maps",
  effect: "write",
  summary: "Set a terrain map's title, legend, scale bar, compass and scale.",
  params: {
    id: idParam("the map id", "map set: <id>"),
    path: pathParam("map"),
    title: p.str('the title ("" removes it)'),
    legend: p.bool("show the legend", { style: "onoff" }),
    scale_bar: p.bool("show the scale bar", { style: "onoff" }),
    compass: p.bool("show the compass", { style: "onoff" }),
    per_cell: p.num("map units in one cell"),
    unit: p.str("the scale unit, e.g. mi")
  },
  run(i, ctx) {
    return updateMap(projectOf(i, ctx), refOf(i), (m) => {
      if (i.title !== void 0) {
        if (i.title) m.title = i.title;
        else delete m.title;
      }
      for (const [f, k] of [["legend", "legend"], ["scale_bar", "scaleBar"], ["compass", "compass"]]) if (i[f] !== void 0) m[k] = i[f];
      if (i.per_cell !== void 0) m.scale.perCell = i.per_cell;
      if (i.unit) m.scale.unit = i.unit;
    });
  },
  cli: { usage: '       artgen map set <id> [--title "..."] [--legend on|off] [--scale-bar on|off] [--compass on|off] [--per-cell n] [--unit mi]', text: (m, i) => `${describeMap(m)}
${next2(i, m.id)}`, json: (m) => V2(m) },
  mcp: { exclude: "map_update covers it" },
  python: {}
});
async function renderPreview2(r, i, ctx) {
  const P = ctx.project(), theme = i.theme ?? "color", themes = theme === "both" ? ["color", "bw"] : [theme === "bw" ? "bw" : "color"], layers = layersOf(i.layers, (v) => parseLayers(v));
  const files = r.files.map((f) => ctx.rel(f));
  const look = typeof i.ppu === "number" ? files.filter((f) => f.endsWith(".png")) : (await renderMapFiles(P, i.id, { themes, ppu: 24, layers, formats: ["png"], out: join14(P.art, "maps", i.id, "out", "preview") })).files.map((f) => ctx.rel(f));
  return [text({ ...r, files }), ...look.map((f) => pngFile(join14(P.root, f)))];
}
var render2 = defineOp({
  name: "map.render",
  module: "maps",
  effect: "render",
  summary: "Render a terrain map to SVG and/or PNG, in colour and/or black and white.",
  description: "Render a terrain map to art/maps/<id>/out/ (SVG + PNG; theme color, bw or both) and return the PNG to look at. layers turns layers off/on: terrain, rivers, roads, contours, grid, symbols, labels, legend, scale, compass, title. ppu: pixels per cell (default 40; the returned image uses at most 24 unless set).",
  params: {
    id: idParam("the map id", "map render: <id>"),
    path: pathParam("map"),
    theme: p.oneOf(["color", "bw", "both"], "color, bw or both (command line default: both; MCP: color)", { error: "color, bw or both" }),
    ppu: p.num("pixels per cell (default 40)"),
    layers: p.str(LAYER_DOC, { schema: { type: "object", description: "layers to turn off/on, e.g. { grid: false }" } }),
    format: p.oneOf(["svg", "png", "both"], "svg, png or both (default both)", { mcp: false, error: "svg, png or both" }),
    fit: p.str("180x260mm or 800x600px: pick the scale that fits the window in the box", { mcp: false }),
    page_scale: p.str("output pixels per millimetre on the page", { mcp: false }),
    crop: p.str('x,y,w,h in map units (or cells, with "cells" after it): a window on the render', { mcp: false }),
    out: p.str("the folder to render into", { mcp: false })
  },
  async run(i, ctx) {
    const P = projectOf(i, ctx), theme = i.theme ?? (ctx.surface === "cli" ? "both" : "color"), format = i.format ?? "both";
    return renderMapFiles(P, refOf(i), {
      themes: theme === "both" ? ["color", "bw"] : [theme === "bw" ? "bw" : "color"],
      formats: format === "both" ? ["svg", "png"] : [format],
      ppu: i.ppu,
      pageScale: pageScaleOf(i.page_scale),
      ...viewOf(i, () => readMap(P, refOf(i)).grid.size),
      layers: layersOf(i.layers, (v) => parseLayers(v)),
      out: i.out
    });
  },
  cli: {
    usage: [
      "       artgen map render <id> [--theme color|bw|both] [--format svg|png|both] [--ppu 40 | --fit 180x260mm|px] [--page-scale px/mm] [--crop x,y,w,h[cells]] [--layers grid=off,labels=off] [--out dir]",
      "         (--fit and --page-scale set label, symbol and stroke sizes in points and millimetres on the page, 9 pt place labels, 7 pt notes, 5 mm symbols, and keep labels off one another; --json lists any that found no room.",
      '          --crop is a window on the full render, in map units or, with "cells" after it, grid cells; --fit picks the ppu that fits the crop or the whole map in the box)'
    ],
    text: (r, i) => [`${i.path ?? i.id} ${r.size.join("\xD7")} px, ${r.ppu} px a unit, window ${r.crop.join(",")}: ${r.terrains.join(", ")}${r.rivers ? `, ${r.rivers} rivers` : ""}`, ...r.unplaced.map((u) => `  no free spot for label ${u.index} "${u.text}"`), ...r.files.map((f) => `  ${f}`)].join("\n"),
    json: (r) => V2(r)
  },
  mcp: { content: renderPreview2 },
  python: {}
});
var facts2 = defineOp({
  name: "map.facts",
  module: "maps",
  effect: "read",
  summary: "The ground of a terrain map as numbers: points, areas, or the whole map's rivers, roads, hilltops and hollows.",
  description: `A terrain map's ground read back as numbers. at: points to measure ("x,y", "0304", "C4" or [x,y]): each one's terrain, height, slope and nearest river and road; area: polygons ([x,y,\u2026]): the terrain shares, lowest and highest ground and the rivers and roads that cross each; above: river | lowest (with at: how far above that); radius: the search radius in map units. With neither at nor area: the whole map's rivers, roads, hilltops, hollows and terrain shares. Positions in map units, lengths also in the scale unit, heights in topo.unit and whole multiples of topo.interval.`,
  params: {
    id: idParam("the map id", "map facts: <id>"),
    path: pathParam("map"),
    at: { kind: "string", doc: "a point to measure: x,y | C4 | 0304 (several: --at x,y x,y)", multi: true, schema: { type: "array", items: {}, description: 'points to measure: "x,y", "0304", "C4" or [x, y]' } },
    area: { kind: "string", doc: "an area to measure: x,y,x,y,\u2026 (a polygon; repeat the flag for more)", repeat: true, schema: { type: "array", items: { type: "array", items: { type: "number" } }, description: "polygons to measure: [x,y,x,y,\u2026]" } },
    above: p.oneOf(["river", "lowest"], "with --at: how far above the river or the lowest ground", { error: "river or lowest" }),
    radius: p.num("the search radius in map units", { error: "a number above 0 (map units)" })
  },
  run(i, ctx) {
    const m = readMap(projectOf(i, ctx), refOf(i));
    if (i.radius !== void 0 && !(i.radius > 0)) throw new Error("--radius: a number above 0 (map units)");
    const areas = (i.area ?? []).map((a) => map_exports.areaOutline(typeof a === "string" ? numbers2(a, "--area", false) : a.map(Number)));
    const at4 = (i.at ?? []).map((v) => map_exports.parsePoint(m, Array.isArray(v) ? `${v[0]},${v[1]}` : String(v)));
    return map_exports.mapFacts(m, { at: at4, areas, ...i.above && { above: i.above }, ...i.radius !== void 0 && { radius: i.radius } });
  },
  cli: {
    usage: [
      "       artgen map facts <id> [--at x,y \u2026 | C4 | 0304] [--area x,y,x,y,\u2026] [--above river|lowest] [--radius n] [--json]",
      "                  the ground as numbers: --at gives each point's terrain, height, slope and nearest river and road; --area the terrain shares, lowest and highest",
      "                  ground and the rivers and roads that cross it; neither gives the whole map's rivers, roads, hilltops, hollows and terrain shares.",
      "                  Positions in map units, lengths also in the scale unit, heights in topo.unit and whole multiples of topo.interval"
    ],
    text: (r) => describeMapFacts(r),
    json: (r) => V2(r)
  },
  mcp: {},
  python: {}
});
var check2 = defineOp({
  name: "map.check",
  module: "maps",
  effect: "read",
  summary: "Check a terrain map file: format errors with their JSON paths, then each `require` entry measured.",
  description: "Check a terrain map: every format error in its file with the JSON path, then each `require` entry measured against the generated ground (`C-forest terrain forest 0.71 < 0.80 unmet`). Fix errors before rendering.",
  params: { id: idParam("the map id", "map check: <id>"), path: pathParam("map") },
  run: (i, ctx) => checkMapFile(projectOf(i, ctx), refOf(i)),
  cli: {
    usage: "       artgen map check <id> [--json]   the file's format errors with their JSON paths, then each `require` entry measured: `C-forest terrain forest 0.71 < 0.80 unmet`; exits 1 on any error or unmet requirement",
    text: (r) => r.errors.length ? [`${r.file}: ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}`, ...r.errors.map((e) => `  ${e.path || "(file)"}: ${e.message}`)].join("\n") : [`${r.file}: ${r.requirements.length ? r.ok ? `all ${r.requirements.length} requirements met` : `${r.unmet.length} of ${r.requirements.length} requirements unmet` : "ok, no requirements"}`, ...r.requirements.map((q) => `  ${q.text}`)].join("\n"),
    json: (r) => V2(r),
    exit: (r) => r.ok ? 0 : 1
  },
  mcp: {},
  python: {}
});
var sync2 = defineOp({
  name: "map.sync",
  module: "maps",
  effect: "write",
  summary: "Replace the entries of one origin from a regenerated file, keeping every other.",
  params: {
    origin: p.str("the origin to replace (e.g. tables)", { required: "map sync <id>|--file target.json --from new.json --origin tables" }),
    from: p.str("the new file: every entry in it carries the origin", { required: "map sync <id>|--file target.json --from new.json --origin tables" }),
    id: idParam("the map id", "map sync: <id>"),
    path: pathParam("map")
  },
  run(i, ctx) {
    let report;
    updateMap(projectOf(i, ctx), refOf(i), (m) => {
      const r = map_exports.syncMap(m, map_exports.parseMap(readJson(i.from)), i.origin);
      report = r.report;
      Object.assign(m, r.spec);
      if (!r.spec.require) delete m.require;
    });
    return report;
  },
  cli: { usage: "       artgen map sync <id>|--file target.json --from new.json --origin tables [--json]   replace the entries of one origin, keep every other (hand entries last); lists what that disturbs", text: (r, i) => syncText(String(i.path ?? i.id), r), json: (r) => V2(r) },
  mcp: { exclude: "reads --from by path (consumer tooling)" },
  python: {}
});
var MAP_MAP_OPS = [list4, symbols2, show3, create2, gen2, update2, edit2, grid3, label2, symbol2, overlay2, set, render2, facts2, check2, sync2];

// ../artgen-cli/src/ops/maps-trace.ts
import { resolve as resolve11 } from "node:path";
function toCells(r, scale, ox, oy) {
  const out = [];
  for (let k = 0; k < r.points.length; k += 2) out.push(Math.round(((r.points[k] + 0.5) * scale + ox) * 100) / 100, Math.round(((r.points[k + 1] + 0.5) * scale + oy) * 100) / 100);
  return out;
}
var mapTrace = defineOp({
  name: "map.trace",
  module: "maps",
  effect: "write",
  summary: "Trace a picture's outline onto a terrain map as paint edits (the dark shapes become land, their holes water).",
  params: {
    id: idParam("the map id", "map trace: <id> <image.png>"),
    path: pathParam("map"),
    image: p.str("the sketch or map picture (PNG)", { positional: true, required: "map trace: <id> <image.png>", mcp: false }),
    terrain: p.oneOf(map_exports.TERRAINS, "what the traced shapes are (default grass)", { mcp: false }),
    hole_terrain: p.oneOf(map_exports.TERRAINS, "what the holes in a shape are (default water)", { mcp: false }),
    origin: p.str("who wrote these edits (default trace); --replace swaps its earlier ones", { mcp: false }),
    replace: p.bool("first remove this origin's earlier edits", { mcp: false }),
    ...traceParams()
  },
  run(i, ctx) {
    const terrain = i.terrain ?? "grass", holeTerrain = i.hole_terrain ?? "water", origin = i.origin ?? "trace";
    if (!map_exports.TERRAINS.includes(terrain) || !map_exports.TERRAINS.includes(holeTerrain)) throw new Error(`--terrain, --hole-terrain: one of ${map_exports.TERRAINS.join(", ")}`);
    const t = traceImage(readPicture(resolve11(i.image)), traceOptions(i));
    let added = 0, removed = 0;
    const m = updateMap(projectOf(i, ctx), refOf(i), (m2) => {
      const scale = Math.min(m2.cols / t.width, m2.rows / t.height), ox = (m2.cols - t.width * scale) / 2, oy = (m2.rows - t.height * scale) / 2;
      if (i.replace) {
        const keep = m2.edits.filter((e) => e.origin !== origin);
        removed = m2.edits.length - keep.length;
        m2.edits = keep;
      }
      for (const s of t.shapes) {
        m2.edits.push({ op: "paint", terrain, shape: { poly: toCells(s.outer, scale, ox, oy) }, origin });
        added++;
        for (const h of s.holes) {
          m2.edits.push({ op: "paint", terrain: holeTerrain, shape: { poly: toCells(h, scale, ox, oy) }, origin });
          added++;
        }
      }
    });
    return { m, added, removed, trace: traceSummary(t), origin };
  },
  cli: {
    usage: "       artgen map trace <id> <image.png> [--terrain grass] [--hole-terrain water] [--origin trace] [--replace]   (+ the artgen trace flags: --threshold --invert --blur --smoothing --simplify --min-area --holes --max-paths)",
    text: (r, i) => `${r.m.id}: ${r.added} paint edits from ${r.trace.shapes} shapes${r.removed ? ` (replaced ${r.removed} of origin ${r.origin})` : ""} (${r.m.edits.length} edits)
${i.path ? `next: artgen map render --file ${i.path}` : `next: artgen map render ${r.m.id}`}`,
    json: (r) => ({ id: r.m.id, added: r.added, removed: r.removed, edits: r.m.edits.length, trace: r.trace })
  },
  mcp: { exclude: "reads a picture by path outside the art/ sandbox" },
  python: {}
});
var MAP_TRACE_OPS = [mapTrace];

// ../artgen-cli/src/ops/maps-workflow.ts
var noun = (k) => KIND_NOUN[k];
var ID_DOC = (k) => `the ${noun(k)}'s id`;
var idP = (k, cmd) => p.str(ID_DOC(k), { positional: true, required: `${k} ${cmd}: <id>` });
var STR_LIST = { type: "array", items: { type: "string" } };
var region = (v) => Array.isArray(v) ? v.map(Number) : void 0;
var cell = (s, n) => s.length > n ? `${s.slice(0, n - 1)}~` : s.padEnd(n);
var rowLine = (r) => `${cell(r.id, 16)} ${cell(r.status, 11)} ${cell(r.version ?? "-", 4)} ${r.why}${r.fail ? `  (${r.fail} check${r.fail === 1 ? "" : "s"} fail)` : ""}${r.flag ? `  (${r.flag} warning${r.flag === 1 ? "" : "s"})` : ""}`;
function opsFor(kind) {
  const k = kind, N = noun(kind), ID2 = (cmd) => idP(k, cmd);
  const brief = defineOp({
    name: `${k}.brief`,
    module: "maps",
    effect: "write",
    summary: `Show or write the ${N}'s brief: what it is for in the user's words, and its reference images.`,
    description: `Show, or write, the ${N}'s brief (art/${workflow_exports.SUBJECTS[k].dir}/<id>/${k}.brief.md): what it is for, in the user's words, with optional references (paths under art/, e.g. refs/coast.png) that the review sheet shows. Write it before generating. text and refs are changed only when given.`,
    params: { id: ID2("brief"), text: p.str("the brief, in the user's words (replaces the text)"), refs: p.list("string", "reference image paths under art/, e.g. refs/coast.png (replaces the list)", { schema: STR_LIST }) },
    run(i, ctx) {
      const P = ctx.project();
      if (i.text === void 0 && i.refs === void 0) {
        const b = readBrief(P, k, i.id);
        return { id: i.id, written: false, ...b && { path: b.path, text: b.text, brief: b.brief } };
      }
      const w = writeBrief(P, k, i.id, { text: typeof i.text === "string" ? i.text : void 0, refs: Array.isArray(i.refs) ? i.refs : void 0 });
      return { id: i.id, written: true, path: w.path, brief: w.brief };
    },
    cli: {
      usage: `       artgen ${k} brief <id> [--text "..."] [--refs a.png,b.png]   show or write the ${N}'s brief (what it is for, in the user's words) and its references`,
      text: (r) => r.written ? `wrote ${r.path}${r.brief?.refs.length ? ` (${r.brief.refs.length} references)` : ""}` : r.text ?? `no brief yet: artgen ${k} brief ${r.id} --text "what it is for"`
    },
    mcp: { content: (r) => [text(r.written ? { written: r.path, brief: r.brief } : r.text ?? `no brief yet for ${r.id}`)] },
    python: {}
  });
  const version = defineOp({
    name: `${k}.version`,
    module: "maps",
    effect: "write",
    summary: `Record the working file as the next version (v1, v2, \u2026), a frozen copy beside it.`,
    description: `Record the ${N}'s working file as the next version (a frozen copy beside it: v1, v2, \u2026) and log it. Refused when nothing changed since the latest version. Do this after the edits of a round, before review.`,
    params: { id: ID2("version"), note: p.str("what this version changes") },
    run: (i, ctx) => recordVersion(ctx.project(), k, i.id, { note: typeof i.note === "string" ? i.note : void 0 }),
    cli: { usage: `       artgen ${k} version <id> [--note "..."]   record the working file as the next version (a frozen copy beside it)`, text: (r, i) => `${i.id}: ${r.version} (${r.file})
next: artgen ${k} review ${i.id}` },
    mcp: {},
    python: {}
  });
  const diff = defineOp({
    name: `${k}.diff`,
    module: "maps",
    effect: "read",
    summary: `What changed between two versions of a ${N} (default: the latest version \u2192 the working file).`,
    description: `What changed between two versions of the ${N}, one line per change (paths like rooms[id=hall].w). a and b are version names (v1, v2\u2026) or "working"; default: the latest version against the working file.`,
    params: { id: ID2("diff"), a: p.str('the older version, or "working"', { positional: true }), b: p.str('the newer version, or "working"', { positional: true }) },
    run: (i, ctx) => diffVersions(ctx.project(), k, i.id, i.a, i.b),
    cli: {
      usage: `       artgen ${k} diff <id> [a] [b]   what changed between two versions (default: the latest version \u2192 the working file; "working" is the file now)`,
      text: (r) => r.changes.length ? [`${r.from} -> ${r.to}: ${r.changes.length} change${r.changes.length === 1 ? "" : "s"}`, ...diffLines(r.changes)].join("\n") : `${r.from} -> ${r.to}: no change`
    },
    mcp: { content: (r) => [text({ from: r.from, to: r.to, changes: diffLines(r.changes) })] },
    python: {}
  });
  const review = defineOp({
    name: `${k}.review`,
    module: "maps",
    effect: "render",
    summary: `Build the review sheet of a version (render, data sheet, references) and log it; --score also logs a score.`,
    description: `Render a version of the ${N} (default: the latest) in the map direction's theme and put the render, the one-page data sheet and the references on a review sheet (art/\u2026/out/review-vN.png), log it with the checks, and return it. Look at it: labels can be read, symbols don't overlap, the legend matches what is drawn, the requirements are met. score (0-10) with note and reviewer also logs a score for that version.`,
    params: {
      id: ID2("review"),
      version: p.str("the version to review (v1, v2\u2026; default the latest)", { positional: true }),
      score: p.num("also log this 0-10 score for the version"),
      note: p.str("the reviewer's note, with --score"),
      reviewer: p.str("who scored: the reviewer subagent's name (default self)")
    },
    run: (i, ctx) => reviewSubject(ctx.project(), k, i.id, { version: i.version, score: typeof i.score === "number" ? i.score : void 0, note: i.note, reviewer: i.reviewer }),
    cli: {
      usage: `       artgen ${k} review <id> [version] [--score n --note "..." --reviewer name]   the review sheet of a version (render, data sheet, references); --score logs a score`,
      text: (r, i) => [`review sheet ${r.sheet} (~${r.imageTokens} image tokens); checks ${r.pass ? "pass" : "FAIL"}`, ...r.checks.filter((c) => c.status === "fail" || c.status === "flag").map((c) => `  ${c.status === "fail" ? "FAIL" : "flag"} ${c.id}: ${c.detail}`), ...r.warnings.map((w) => `  warning: ${w}`), ...r.score !== void 0 ? [`score ${r.score} logged for ${r.version}`] : [], `next: show it to the user, then artgen ${k} approve ${i.id} or artgen ${k} feedback ${i.id} --note "..."`].join("\n"),
      json: (r) => ({ version: r.version, sheet: r.sheet, imageTokens: r.imageTokens, pass: r.pass, checks: r.checks, warnings: r.warnings, ...r.score !== void 0 && { score: r.score } })
    },
    mcp: { content: (r, _i, ctx) => [text({ version: r.version, sheet: ctx.rel(r.sheetFile), imageTokens: r.imageTokens, pass: r.pass, checks: r.checks, warnings: r.warnings, ...r.score !== void 0 && { score: r.score } }), pngFile(r.sheetFile)] },
    python: {}
  });
  const feedback = defineOp({
    name: `${k}.feedback`,
    module: "maps",
    effect: "write",
    summary: `Record the user's feedback on the latest version and open a revision.`,
    description: `Record the USER's feedback on the latest version of the ${N} (their words, not yours) and open a revision: rework, then record the next version. region x,y,w,h is optional (${k === "map" ? "map units" : "cells"}).`,
    params: {
      id: ID2("feedback"),
      note: p.str("what the user asked for, in their words", { required: `${k} feedback: --note "<what the user asked for>" is required` }),
      region: p.list("number", `x,y,w,h the note is about, in ${k === "map" ? "map units" : "cells"}`),
      via: p.str("where the feedback came from, recorded in the ledger (pr: a pull request comment)", { mcp: false })
    },
    run: (i, ctx) => feedbackSubject(ctx.project(), k, i.id, { note: i.note, region: region(i.region), via: typeof i.via === "string" ? i.via : void 0 }),
    cli: { usage: `       artgen ${k} feedback <id> --note "..." [--region x,y,w,h] [--via pr]   the user's feedback on the latest version; opens a revision`, text: (r, i) => `feedback recorded on ${r.on}: ${i.id} is ${r.status} (${r.why})` },
    mcp: {},
    python: {}
  });
  const approve = defineOp({
    name: `${k}.approve`,
    module: "maps",
    effect: "write",
    summary: `Record the user's approval of the latest version (it must be final, with no failing check).`,
    description: `Record the USER's approval of the ${N}'s latest version (approval is the user's call, never the agent's). Call only after the user said so in this conversation; user_approved must be true and note should quote them. The version must be final (the working file equals it, no feedback open) and no check may fail; warnings are copied into the approval.`,
    params: {
      id: ID2("approve"),
      note: p.str("the user's words"),
      user_approved: p.bool(`true only when the user explicitly approved this ${N}`, { required: true, cli: false }),
      via: p.str("where the approval came from, recorded in the ledger (pr: a pull request comment)", { mcp: false })
    },
    run(i, ctx) {
      if (ctx.surface === "mcp" && i.user_approved !== true) throw new Error(`approve: only the user approves a ${N} \u2014 show them the review sheet and ask; pass user_approved: true once they say so`);
      return approveSubject(ctx.project(), k, i.id, { note: typeof i.note === "string" ? i.note : void 0, via: typeof i.via === "string" ? i.via : void 0 });
    },
    cli: {
      usage: `       artgen ${k} approve <id> [--note "..."] [--via pr]   the user's approval of the latest version (final, no failing check)`,
      text: (e) => `approved ${e.asset} ${e.version}${e.direction ? ` (map direction v${e.direction.version})` : ""}${e.warnings?.length ? `
note for the user: ${e.warnings.join("; ")}` : ""}`
    },
    mcp: {},
    python: {}
  });
  const status = defineOp({
    name: `${k}.status`,
    module: "maps",
    effect: "read",
    summary: `Status of each ${N}: in-pipeline, final, approved, revision, stale; with one id, its history.`,
    description: `Status of every ${N} in the project (or the ids given): in-pipeline, revision, final (waiting for the user), approved or stale, with the latest version and why. With one id, also its history: versions with notes, reviews, scores, feedback and approvals.`,
    params: { ids: p.str(`${N} ids; default all`, { positional: "rest", schema: STR_LIST }) },
    run(i, ctx) {
      const P = ctx.project(), ids = Array.isArray(i.ids) ? i.ids : void 0, rows2 = statusRows(P, k, ids);
      return { rows: rows2, ...ids?.length === 1 && { history: history(P, k, ids[0]) } };
    },
    cli: {
      usage: `       artgen ${k} status [ids]   status of each ${N}; with one id, its history (versions, reviews, feedback, approvals)`,
      text: (r) => [...r.rows.length ? r.rows.map(rowLine) : [`no ${k}s yet: artgen ${k} new <id>`], ...r.history ? ["", ...r.history.length ? r.history.map((h) => `  ${h.ts.slice(0, 16).replace("T", " ")}  ${cell(h.version ?? "", 4)} ${cell(h.type, 8)} ${h.by ?? ""}${h.text ? `  ${h.text}` : ""}`) : ["  no history yet"]] : []].join("\n")
    },
    mcp: {},
    python: {}
  });
  const sheet = defineOp({
    name: `${k}.sheet`,
    module: "maps",
    effect: "render",
    summary: `The ${N}'s one-page data sheet: out/sheet.png and out/sheet.json.`,
    description: `Write the ${N}'s one-page data sheet (size, scale, grid, counts, what must hold, brief, references) to art/\u2026/out/sheet.png and sheet.json, and return it.`,
    params: { id: ID2("sheet") },
    run: (i, ctx) => writeSheet(ctx.project(), k, i.id),
    cli: {
      usage: `       artgen ${k} sheet <id>   the one-page data sheet: out/sheet.png and out/sheet.json`,
      text: (r) => `${r.png}
${r.json}
${r.markdown}${r.warnings.map((w) => `
warning: ${w}`).join("")}`,
      json: (r) => ({ png: r.png, json: r.json, sheet: r.sheet, warnings: r.warnings })
    },
    mcp: { content: (r) => [text({ png: r.png, json: r.json, sheet: r.sheet, warnings: r.warnings }), pngFile(r.pngFile)] },
    python: {}
  });
  return [brief, version, diff, review, feedback, approve, status, sheet];
}
var direction = defineOp({
  name: "map.direction",
  module: "maps",
  effect: "write",
  summary: "Show or change the map direction: the theme of each kind of map, the symbols a kind may use, and its lock.",
  description: `Show, or change, the map direction (art/map-direction.json): the theme for each kind (map, dungeon, settlement) and the symbols a kind may use. theme "map=bw,settlement=color" and symbols "dungeon=altar,statue" change the draft; lock locks it, which is the USER's call (user_approved must be true). A lock moves the version up by one, so maps approved under the old one show as stale. The direction applies to review sheets, checks and staleness only; renders keep their own defaults.`,
  params: {
    theme: p.str("kind=theme pairs, e.g. map=bw,settlement=color (a dungeon is bw only)"),
    symbols: p.str('kind=symbol,symbol, e.g. dungeon=altar,statue ("dungeon=" clears the set; ; between kinds)'),
    lock: p.bool("lock the direction (the user's call)"),
    note: p.str("the user's words, with --lock"),
    user_approved: p.bool("true only when the user explicitly asked to lock the map direction", { cli: false }),
    via: p.str("where the lock came from, recorded in the ledger (pr: a pull request comment)", { mcp: false })
  },
  run(i, ctx) {
    if (i.lock && ctx.surface === "mcp" && i.user_approved !== true) throw new Error("map direction: only the user locks the map direction \u2014 ask them; pass user_approved: true once they say so");
    return runDirection(ctx.project(), { theme: i.theme, symbols: i.symbols, lock: i.lock === true, note: i.note, via: typeof i.via === "string" ? i.via : void 0 });
  },
  cli: {
    usage: `       artgen map direction [--theme map=bw,settlement=color] [--symbols dungeon=altar,statue] [--lock] [--note "..."]   show or change the map direction; --lock is the user's call`,
    text: (r) => {
      const d = r.direction;
      if (!d) return `no map direction yet: artgen map direction --theme map=bw,dungeon=bw,settlement=color --symbols dungeon=altar,statue, then --lock when the user agrees
reviews use ${Object.entries(direction_exports.DEFAULT_THEME).map(([k, t]) => `${k} ${t}`).join(", ")}`;
      const lines2 = [`${d.id} v${d.version} ${d.status}${d.note ? ` \u2014 ${d.note}` : ""}`, ...Object.entries(d.themes).map(([k, t]) => `  ${k}: ${t}`), ...Object.entries(d.symbols).map(([k, s]) => `  ${k} symbols: ${s.join(", ")}`)];
      return [...lines2, ...r.changed ? [r.locked ? `locked at v${d.version}: maps approved under another version are stale until re-approved` : `draft saved to ${r.file}; it applies once the user locks it (--lock)`] : []].join("\n");
    },
    json: (r) => ({ direction: r.direction, file: r.file, changed: r.changed, locked: r.locked })
  },
  mcp: { content: (r) => [text({ direction: r.direction, file: r.file, changed: r.changed, locked: r.locked })] },
  python: {}
});
var WORKFLOW_OPS = [...opsFor("map"), direction, ...opsFor("dungeon"), ...opsFor("settlement")];

// ../artgen-cli/src/ops/maps-settlement.ts
import { join as join15 } from "node:path";
var V3 = (data) => withVersion(data, settlement_exports.SETTLEMENT_FORMAT);
var next3 = (i, id2) => i.path ? `next: artgen settlement render --file ${i.path}` : `next: artgen settlement render ${id2 ?? i.id}`;
var CELLS2 = "WIDTHxHEIGHT in cells, e.g. 8x6";
var numberOf2 = (v) => roomNumber(v, (s) => onOff2(s));
var pointOf = (v, name, required = true) => {
  if (v === void 0) {
    if (required) throw new Error(`${name} x,y is required`);
    return void 0;
  }
  return dungeon_exports.parsePoint(v);
};
var OBJ = { type: "object" };
var GEN_PARAMS2 = {
  size: p.size("the sheet in cells, e.g. 80x60", { mcp: false, error: CELLS2 }),
  buildings: p.num("buildings to lay out", { mcp: false }),
  density: p.num("how tightly they pack, 0..1", { mcp: false }),
  trees: p.num("tree cover, 0..1", { mcp: false }),
  fields: p.num("field cover, 0..1", { mcp: false }),
  streets: p.str("organic | grid | radial", { mcp: false }),
  wall: p.str("none | palisade | stone", { mcp: false }),
  water: p.str("none | river | lake | coast | moat", { mcp: false }),
  market: p.bool("a market square", { style: "onoff", mcp: false }),
  castle: p.bool("a castle", { style: "onoff", mcp: false }),
  interiors: p.bool("lay out every building's floors too", { style: "onoff", mcp: false })
};
function applyGenFlags2(m, i) {
  if (typeof i.seed === "number") m.seed = i.seed;
  if (i.size) [m.cols, m.rows] = i.size;
  if (typeof i.kind === "string") m.kind = i.kind;
  for (const k of ["buildings", "density", "trees", "fields"]) if (i[k] !== void 0) m.gen[k] = i[k];
  for (const k of ["streets", "wall", "water"]) if (i[k] !== void 0) m.gen[k] = i[k];
  for (const k of ["market", "castle", "interiors"]) if (i[k] !== void 0) m.gen[k] = i[k];
}
var list5 = defineOp({
  name: "settlement.list",
  module: "maps",
  effect: "read",
  summary: "List the settlements in the project (or the one named by --file).",
  description: "Settlement maps (TTRPG villages, towns and castles, in colour or black and white) in art/settlements, plus the kinds every settlement tool accepts: settlement kinds, building kinds, shapes and roofs, road, water, wall, gate, area and tree kinds, fixture (furniture) kinds and edit ops.",
  params: { path: pathParam("settlement") },
  run: (i, ctx) => i.path ? [settlementSummary(readSettlement(null, { file: i.path }))] : listSettlements(ctx.project()),
  cli: {
    usage: "       artgen settlement list | show <id> | symbols | fixtures",
    text: (ss) => ss.length ? ss.map((s) => `${s.id.padEnd(16)} ${s.kind.padEnd(8)} ${s.size.padEnd(8)} ${s.buildings} buildings (${s.interiors} with floors), ${s.roads} roads, ${s.walls} walls${s.title ? `  "${s.title}"` : ""}`).join("\n") : "no settlements yet: artgen settlement new <id>",
    json: (ss) => V3(ss)
  },
  mcp: {
    content: (ss) => [text({
      settlements: ss,
      kinds: settlement_exports.SETTLEMENT_KINDS,
      buildings: settlement_exports.BUILDING_KINDS,
      shapes: settlement_exports.BUILDING_SHAPES,
      roofs: settlement_exports.ROOFS,
      roads: settlement_exports.ROAD_KINDS,
      water: settlement_exports.WATER_KINDS,
      walls: settlement_exports.WALL_KINDS,
      gates: settlement_exports.GATE_KINDS,
      areas: settlement_exports.AREA_KINDS,
      trees: settlement_exports.TREE_KINDS,
      fixtures: settlement_exports.FIXTURE_KINDS,
      symbols: settlement_exports.SYMBOL_KINDS,
      labelKinds: settlement_exports.LABEL_KINDS,
      ops: settlement_exports.SETTLEMENT_OPS
    })]
  },
  python: {}
});
var symbols3 = defineOp({
  name: "settlement.symbols",
  module: "maps",
  effect: "read",
  summary: "List the symbol kinds a settlement can carry.",
  params: {},
  run: () => settlement_exports.SYMBOL_KINDS,
  cli: { usage: [], text: () => Object.entries(settlement_exports.SYMBOLS).map(([k, v]) => `${k.padEnd(12)} ${v.name}`).join("\n"), json: (kinds) => V3(kinds) },
  mcp: { exclude: "settlement_list returns the symbol kinds" },
  python: {}
});
var fixtures = defineOp({
  name: "settlement.fixtures",
  module: "maps",
  effect: "read",
  summary: "List the furniture and fixture kinds, with their true sizes.",
  params: {},
  run: () => Object.entries(settlement_exports.FIXTURES).map(([kind, v]) => ({ kind, name: v.name, group: v.group, ft: v.ft })),
  cli: { usage: [], text: (r) => r.map((f) => `${f.kind.padEnd(14)} ${f.group.padEnd(10)} ${String(f.ft[0]).padStart(3)}\xD7${String(f.ft[1]).padEnd(4)} ft  ${f.name}`).join("\n"), json: (r) => V3(r) },
  mcp: { exclude: "settlement_list returns the fixture kinds" },
  python: {}
});
var show4 = defineOp({
  name: "settlement.show",
  module: "maps",
  effect: "read",
  summary: "Show a settlement: buildings with ids, kinds and floors, roads, water, walls, areas, trees and props.",
  description: "A settlement's file (art/settlements/<id>/settlement.json) and a readable summary: buildings with ids, kinds and floors, roads, water, walls with their indices, areas, trees and props.",
  params: { id: idParam("the settlement id", "settlement show: <id>"), path: pathParam("settlement"), file: p.bool("false: the summary only, without the file", { cli: false }) },
  run: (i, ctx) => readSettlement(projectOf(i, ctx), refOf(i)),
  cli: { usage: [], text: (m) => describeSettlement(m), json: (m) => V3(m) },
  mcp: { name: "settlement_get", content: (m, i) => [text(describeSettlement(m)), ...i.file === false ? [] : [text(m)]] },
  python: {}
});
var create3 = defineOp({
  name: "settlement.new",
  module: "maps",
  effect: "write",
  summary: "Create a settlement: a hamlet, village, town, city or castle laid out from a seed, or an empty sheet.",
  description: `Create a settlement map. kind: hamlet|village|town|city|castle (sets the sheet size, cell size and generator defaults: a town or city has 10 ft cells and a stone wall, a castle a curtain wall, keep and moat). mode "generate" (default): roads, water, walls, buildings, fields, trees and props from the seed and gen settings ({buildings, density 0..1, streets: organic|grid|radial, wall: none|palisade|stone, water: none|river|lake|coast|moat, trees 0..1, fields 0..1, market, castle, interiors (lay out every building's floors too)}); "empty": a blank sheet (add things with settlement_edit). map + at: a terrain map (its id in art/maps, or a path) under the sheet, its top-left at map units at=[x,y]; its rivers, lakes, sea, woods and slopes shape the layout. Render with settlement_render.`,
  params: {
    id: idParam("the new settlement's id (a name, never a path)", "settlement new: <id> is required"),
    path: pathParam("settlement"),
    kind: p.oneOf(settlement_exports.SETTLEMENT_KINDS, "hamlet | village | town | city | castle (default village)"),
    mode: p.oneOf(["generate", "empty"], "generate (default) or empty", { cli: false }),
    cols: p.num("columns", { cli: false }),
    rows: p.num("rows", { cli: false }),
    seed: p.num("the generator seed (default: random)"),
    title: p.str("the title"),
    gen: p.json(OBJ, "generator settings: buildings, density, streets, wall, water, trees, fields, market, castle, interiors", { cli: false }),
    map: p.str("a terrain map (its id in art/maps, or a path) under the sheet"),
    at: p.str("with map: the sheet's top-left in map units, x,y", { schema: { type: "array", items: { type: "number" } } }),
    empty: p.bool("a blank sheet to draw on", { mcp: false }),
    force: p.bool("overwrite an existing file (with --file)", { mcp: false }),
    ...GEN_PARAMS2,
    interiors: p.bool("lay out every building's floors too", { style: "either", mcp: false })
  },
  run(i, ctx) {
    const P = projectOf(i, ctx), sid = i.path ? i.id ?? fileId(i.path) : i.id, kind = i.kind ?? "village";
    const base = settlement_exports.newSettlement(sid, kind, {
      seed: typeof i.seed === "number" ? i.seed : Math.floor(Math.random() * 1e6),
      ...typeof i.cols === "number" && { cols: i.cols },
      ...typeof i.rows === "number" && { rows: i.rows },
      ...i.title && { title: i.title }
    });
    applyGenFlags2(base, i);
    if (i.gen && typeof i.gen === "object") Object.assign(base.gen, i.gen);
    if (i.interiors === true) base.gen.interiors = true;
    const at4 = i.path ? { file: i.path } : sid;
    if (typeof i.map === "string" && i.map) {
      const mp = mapForSettlement(P, at4, i.map), mspec = map_exports.parseMap(readJson(mp.path)), origin = Array.isArray(i.at) ? [Number(i.at[0]), Number(i.at[1])] : pointOf(i.at, "--at", false) ?? [0, 0];
      const scale = Math.round(base.scale.perCell * settlement_exports.feetIn(base.scale.unit) / (mspec.scale.perCell * settlement_exports.feetIn(mspec.scale.unit)) * 1e4) / 1e4;
      base.underlay = { map: mp.rel, origin, scale };
    }
    const spec = settlement_exports.parseSettlement(base);
    const m = i.mode === "empty" || i.empty === true ? spec : (() => {
      const u = readSettlementUnderlay(P, at4, spec);
      return settlement_exports.generateSettlement(spec, u ?? {});
    })();
    return createSettlement(P, m, i.force === true, i.path ? { file: i.path } : void 0);
  },
  cli: {
    usage: [
      '       artgen settlement new <id> [--kind hamlet|village|town|city|castle] [--size 80x60] [--seed n] [--title "..."] [--empty] [--interiors] [--map <map id|path> --at x,y]',
      "                  a village, town or castle laid out from a seed (--empty: a blank sheet to draw on); --map sets a terrain map under it, its water, woods and slopes shaping the layout"
    ],
    text: (r, i) => `${r.file}
${describeSettlement(r.settlement)}
${next3(i, r.settlement.id)}`,
    json: (r) => V3({ file: r.file, settlement: r.settlement })
  },
  mcp: { content: (r) => [text({ file: r.file, summary: describeSettlement(r.settlement) })] },
  python: {}
});
var gen3 = defineOp({
  name: "settlement.gen",
  module: "maps",
  effect: "write",
  summary: "Lay a settlement out again from its seed, kind and generator settings; entries drawn by hand are kept.",
  description: 'Lay the settlement out again from its seed, kind and gen settings (pass seed / kind / gen / cols / rows to change them first). Everything the generator wrote before (origin "gen") is replaced; entries made by hand are kept and kept clear of. With gen.interiors every building gets floors.',
  params: {
    id: idParam("the settlement id", "settlement gen: <id>"),
    path: pathParam("settlement"),
    seed: p.num("the generator seed"),
    kind: p.oneOf(settlement_exports.SETTLEMENT_KINDS, "hamlet | village | town | city | castle", { schema: { type: "string" } }),
    gen: p.json(OBJ, "generator settings to change first", { cli: false }),
    cols: p.num("columns", { cli: false }),
    rows: p.num("rows", { cli: false }),
    ...GEN_PARAMS2
  },
  run(i, ctx) {
    const P = projectOf(i, ctx), ref = refOf(i);
    return updateSettlement(P, ref, (m) => {
      applyGenFlags2(m, i);
      if (i.gen && typeof i.gen === "object") Object.assign(m.gen, i.gen);
      if (typeof i.cols === "number") m.cols = i.cols;
      if (typeof i.rows === "number") m.rows = i.rows;
      const s = settlement_exports.parseSettlement(m);
      return settlement_exports.generateSettlement(s, readSettlementUnderlay(P, ref, s) ?? {});
    });
  },
  cli: {
    usage: [
      "       artgen settlement gen <id> [--seed n] [--kind k] [--size WxH] [--buildings n] [--density f] [--streets organic|grid|radial] [--wall none|palisade|stone] [--water none|river|lake|coast|moat]",
      "                  [--trees f] [--fields f] [--market on|off] [--castle on|off] [--interiors on|off]   lays it out again; entries drawn by hand (no origin) are kept"
    ],
    text: (m, i) => `${describeSettlement(m)}
${next3(i, m.id)}`,
    json: (m) => V3(m)
  },
  mcp: { name: "settlement_generate", content: (m) => [text(describeSettlement(m))] },
  python: {}
});
var update3 = defineOp({
  name: "settlement.update",
  module: "maps",
  effect: "write",
  summary: "Change a settlement's settings (not its contents).",
  description: "Change a settlement's settings (not its contents): title, kind, ground (grass|dirt|sand|snow|stone), cols, rows, seed, gen (generator settings, used by settlement_generate), grid: {show, size (cells), sub}, grid_size (in the sheet's unit, e.g. 10 ft), scale: {perCell, unit}, plan_cell (feet in a floor-plan cell, default 5), numbers, scale_bar, compass, legend, furniture: {place: over|outside|auto, side?: bottom|right}, underlay: {map, origin, scale, theme?} or null.",
  params: {
    id: idParam("the settlement id", "settlement update: <id>"),
    path: pathParam("settlement"),
    title: p.str('the title ("" removes it)'),
    kind: p.str("hamlet | village | town | city | castle"),
    ground: p.str("grass | dirt | sand | snow | stone"),
    cols: p.num("columns"),
    rows: p.num("rows"),
    seed: p.num("the generator seed"),
    gen: p.json(OBJ, "generator settings, as JSON"),
    grid: p.json(OBJ, "grid settings, as JSON: {show, size (cells), sub}"),
    grid_size: p.num("the grid size in the sheet's unit, e.g. 10 ft"),
    scale: p.json(OBJ, "scale settings, as JSON: {perCell, unit}"),
    plan_cell: p.num("feet in a floor-plan cell (default 5)"),
    numbers: p.bool("show building numbers", { style: "onoff" }),
    scale_bar: p.bool("show the scale bar", { style: "onoff" }),
    compass: p.bool("show the compass", { style: "onoff" }),
    legend: p.bool("show the legend", { style: "onoff" }),
    furniture: p.json(OBJ, "where the title, scale bar, compass and legend go, as JSON: {place, side}"),
    underlay: p.json({ type: ["object", "null"] }, "a terrain map under the sheet, as JSON: {map, origin, scale, theme?}, or null to remove it")
  },
  run(i, ctx) {
    return updateSettlement(projectOf(i, ctx), refOf(i), (m) => {
      for (const k of ["gen", "grid", "scale"]) if (i[k] && typeof i[k] === "object") Object.assign(m[k], i[k]);
      if (typeof i.grid_size === "number") m.grid = { ...m.grid, show: true, size: i.grid_size / m.scale.perCell };
      if (typeof i.plan_cell === "number") m.interior.perCell = i.plan_cell;
      if (typeof i.title === "string") {
        if (i.title) m.title = i.title;
        else delete m.title;
      }
      for (const k of ["kind", "ground"]) if (typeof i[k] === "string") m[k] = i[k];
      for (const k of ["cols", "rows", "seed"]) if (typeof i[k] === "number") m[k] = i[k];
      if (typeof i.numbers === "boolean") m.numbers = i.numbers;
      if (typeof i.scale_bar === "boolean") m.scaleBar = i.scale_bar;
      if (typeof i.compass === "boolean") m.compass = i.compass;
      if (typeof i.legend === "boolean") m.legend = i.legend;
      if (i.furniture && typeof i.furniture === "object") m.furniture = i.furniture;
      if (i.underlay === null) delete m.underlay;
      else if (i.underlay && typeof i.underlay === "object") m.underlay = i.underlay;
    });
  },
  cli: {
    usage: `       artgen settlement update <id> [--title "..."] [--kind k] [--ground g] [--cols n] [--rows n] [--seed n] [--gen|--grid|--scale|--furniture|--underlay '<json>'] [--grid-size 10] [--plan-cell 5] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off]`,
    text: (m, i) => `${describeSettlement(m).split("\n").slice(0, 3).join("\n")}
${next3(i, m.id)}`,
    json: (m) => V3(m)
  },
  mcp: { content: (m) => [text(describeSettlement(m).split("\n").slice(0, 3).join("\n"))] },
  python: {}
});
var edit3 = defineOp({
  name: "settlement.edit",
  module: "maps",
  effect: "write",
  summary: "Change a settlement's contents with a list of edits, in order.",
  description: `Change a settlement's contents, in order. Site coordinates are cells (x right, y down; settlement_get says the cell size); a building's floor coordinates are plan cells (5 ft) from the footprint's top-left corner before it is turned. ops (each {op, \u2026fields}): building.add {kind, x, y, w, h, shape?: rect|L|T|circle|octagon|poly, points?, wing?: [w,h] (L/T), angle? (degrees), roof?: gable|hip|flat|battlement|cone|thatch|none, stories?, label?, number? (false hides it), href?, id?} | building.set {id, \u2026the same} | building.move {id, x, y} | building.rm {id} | interior {id, seed?, stories?} (lay its floors out: rooms, doors, windows, stairs, furniture by kind) | interior.clear {id} | floor.add {building, level (0 ground, 1 up, -1 cellar), name?} | floor.rm {building, level} | room.add {building, level, shape?: rect|circle|octagon|cave|poly, x, y, w, h, points?, label?, id?} | room.set {building, level, id, \u2026} | room.rm {building, level, id} | connect {building, level, a, b, kind?: door|secret|locked|portcullis|arch|open, at?, width?} (a door in the wall two rooms share) | disconnect {building, level, index} | door {building, level, at: [x,y], kind?, width?} (in the outer wall) | window {building, level, at, width?} | fixture.add {building, level, kind, x, y (its centre), w?, h? (default: the kind's true size), angle?, label?} | fixture.rm {building, level, index} | prop.add {kind, x, y, w?, h?, angle?} (a fixture on the site: well, cart, stall, \u2026) | prop.rm {index} | road.add {kind: highway|street|lane|alley|path|track, points: [x,y,\u2026], width?, curve?: smooth, label?} | water.add {kind: river|stream|canal|moat (lines, width?) | pond|lake|sea (areas), points} | wall.add {kind: curtain|stone|palisade|fence|hedge|drystone|ruined, points, closed?, thickness?, towers?: {shape: round|square, size?, at?: "corners"|[vertex indices], every? (cells)}} | wall.gate {index, at, kind?: gatehouse|gate|postern|opening, width?, drawbridge?} | area.add {kind: field|garden|orchard|wood|scrub|marsh|graveyard|market|square|yard|paddock|rubble, points, label?} | tree.add {kind: tree|conifer|bush|rock|boulder|stump|reeds, x, y, size?} | tree.scatter {kind, area: [x,y,\u2026], count, seed?} | label {text, x, y, kind?: name|note|area|street, size?, angle?, href?} | symbol {kind, x, y, scale?, angle?} | road.rm, water.rm, wall.rm, area.rm, tree.rm, label.rm, symbol.rm {index}.`,
  params: {
    id: idParam("the settlement id", "settlement edit: <id>"),
    path: pathParam("settlement"),
    ops: p.json({ type: "array", items: { type: "object" } }, `a list of edits as JSON (or @file.json): ${settlement_exports.SETTLEMENT_OPS.join(", ")} (see the MCP tool settlement_edit for the fields)`, { required: "settlement edit: --ops '<json list>' (or @file.json) is required" })
  },
  run(i, ctx) {
    const done = [];
    const m = updateSettlement(projectOf(i, ctx), refOf(i), (m2) => {
      const ops = i.ops ?? [];
      if (!Array.isArray(ops)) throw new Error("ops: a list of edits");
      for (const o of ops) done.push(settlement_exports.editSettlement(m2, o));
    });
    return { m, lines: done };
  },
  cli: {
    usage: `       artgen settlement edit <id> --ops '<json list>'   a batch of edits in order (${settlement_exports.SETTLEMENT_OPS.join(", ")}); @file.json reads them from a file`,
    text: (r, i) => [...r.lines, ...settlementWarningLines(r.m), next3(i, r.m.id)].join("\n"),
    json: (r) => V3({ done: r.lines, settlement: settlementSummary(r.m) })
  },
  mcp: { content: (r) => [text([...r.lines, ...settlementWarningLines(r.m)].join("\n"))] },
  python: {}
});
var editText = (r, i) => [...r.lines, ...settlementWarningLines(r.m), next3(i, r.m.id)].join("\n");
var editJson = (r) => V3({ done: r.lines, settlement: settlementSummary(r.m) });
function sugar(name, summary, usage, params, build) {
  return defineOp({
    name: `settlement.${name}`,
    module: "maps",
    effect: "write",
    summary,
    params: { path: pathParam("settlement"), ...params },
    run(i, ctx) {
      const P = projectOf(i, ctx), ops = build(i), lines2 = [];
      const m = updateSettlement(P, refOf(i), (m2) => {
        for (const o of ops) lines2.push(settlement_exports.editSettlement(m2, o));
      });
      return { m, lines: lines2 };
    },
    cli: { usage, text: editText, json: editJson },
    mcp: { exclude: "settlement_edit covers it" },
    python: {}
  });
}
var id = (req) => idParam("the settlement id", `settlement ${req}`);
var level = (i) => i.level ?? 0;
var LEVEL = p.num("the floor: 0 ground (default), 1 up, -1 cellar");
var AT = p.str("x,y");
var SIZE = p.size("width x height, e.g. 6x4", { error: CELLS2 });
function buildingFields(i) {
  const o = {};
  for (const k of ["shape", "roof", "label", "href", "kind"]) if (i[k] !== void 0) o[k] = i[k];
  for (const k of ["angle", "stories"]) if (i[k] !== void 0) o[k] = i[k];
  const nb = numberOf2(i.number);
  if (nb !== void 0) o.number = nb;
  const at4 = pointOf(i.at, "--at", false);
  if (i.points !== void 0) o.points = i.points;
  if (i.wing !== void 0) o.wing = i.wing;
  if (at4) [o.x, o.y] = at4;
  if (i.size) [o.w, o.h] = i.size;
  return o;
}
var BUILDING_PARAMS = {
  shape: p.str("rect | L | T | circle | octagon | poly"),
  roof: p.str("gable | hip | flat | battlement | cone | thatch | none"),
  label: p.str("the name"),
  href: p.str("a link"),
  kind: p.str("the building kind"),
  angle: p.num("degrees"),
  stories: p.num("storeys"),
  number: p.str("the number on the plan (n, or off)"),
  points: p.points("poly: x,y,\u2026 of the outline"),
  wing: p.points("L and T: the wing, w,h"),
  at: AT,
  size: SIZE
};
var building2 = sugar(
  "building",
  "Add, change, move or remove a building.",
  [
    '       artgen settlement building <id> add <kind> --at x,y --size WxH [--shape rect|L|T|circle|octagon|poly] [--points x,y,\u2026] [--wing w,h] [--angle deg] [--roof r] [--stories n] [--label "..."] [--number n|off] [--building-id b9] [--href url]',
    `                  | set <bid> [the same flags] | move <bid> --at x,y | rm <bid>      (kinds: ${settlement_exports.BUILDING_KINDS.join(", ")}; roofs: ${settlement_exports.ROOFS.join(", ")})`
  ],
  { id: id("building: <id>"), action: p.str("add | set | move | rm", { positional: true }), target: p.str("add: the building kind; set, move, rm: the building id", { positional: true }), ...BUILDING_PARAMS, building_id: p.str("add: the new building's id (default b<n>)") },
  (i) => {
    const act = i.action, bid = i.target;
    if (act === "add") {
      const kind = bid;
      if (!kind) throw new Error("settlement building <id> add <kind> --at x,y --size WxH");
      const o = buildingFields(i);
      return [{ op: "building.add", ...o, kind, ...i.building_id && { id: i.building_id } }];
    }
    if (act === "set") return [{ op: "building.set", id: bid, ...buildingFields(i) }];
    if (act === "move") {
      const at4 = pointOf(i.at, "--at");
      return [{ op: "building.move", id: bid, x: at4[0], y: at4[1] }];
    }
    if (act === "rm") return [{ op: "building.rm", id: bid }];
    throw new Error("settlement building <id> add|set|move|rm \u2026");
  }
);
var interior = sugar(
  "interior",
  "Lay a building's floors out (rooms, doors, windows, stairs, furniture), or clear them.",
  "       artgen settlement interior <id> <bid> [--seed n] [--stories n] | interior <id> <bid> clear     lay a building's floors out (rooms, doors, windows, stairs, furniture), or clear them",
  { id: id("interior: <id>"), building: p.str("the building id", { positional: true }), action: p.str("clear", { positional: true }), seed: p.num("the layout seed"), stories: p.num("storeys") },
  (i) => [i.action === "clear" ? { op: "interior.clear", id: i.building } : { op: "interior", id: i.building, ...i.seed !== void 0 && { seed: i.seed }, ...i.stories !== void 0 && { stories: i.stories } }]
);
var floor2 = sugar(
  "floor",
  "Add or remove a floor of a building.",
  '       artgen settlement floor <id> <bid> add|rm --level n [--name "..."]',
  { id: id("floor: <id>"), building: p.str("the building id", { positional: true }), action: p.str("add | rm", { positional: true }), level: LEVEL, name: p.str("the floor's name") },
  (i) => {
    if (i.action !== "add" && i.action !== "rm") throw new Error('settlement floor <id> <bid> add|rm --level n [--name "..."]');
    return [{ op: `floor.${i.action}`, building: i.building, level: level(i), ...i.name && { name: i.name } }];
  }
);
var room2 = sugar(
  "room",
  "Add, change or remove a room on a building's floor.",
  '       artgen settlement room <id> <bid> add <shape> --at x,y --size WxH [--level n] [--label "..."] [--room-id r] | room <id> <bid> set|rm <rid> [--level n] \u2026',
  {
    id: id("room: <id>"),
    building: p.str("the building id", { positional: true }),
    action: p.str("add | set | rm", { positional: true }),
    target: p.str("add: the shape (rect, circle, octagon, cave, poly); set, rm: the room id", { positional: true }),
    level: LEVEL,
    at: AT,
    size: SIZE,
    points: p.points("poly: x,y,\u2026 of the outline"),
    label: p.str("the room's name"),
    room_id: p.str("add: the new room's id")
  },
  (i) => {
    const bid = i.building, act = i.action, x = i.target, size2 = i.size, at4 = pointOf(i.at, "--at", false);
    if (act === "add") return [{ op: "room.add", building: bid, level: level(i), shape: x ?? "rect", ...at4 && { x: at4[0], y: at4[1] }, ...size2 && { w: size2[0], h: size2[1] }, ...i.points && { points: i.points }, ...i.label && { label: i.label }, ...i.room_id && { id: i.room_id } }];
    if (act === "set") return [{ op: "room.set", building: bid, level: level(i), id: x, ...at4 && { x: at4[0], y: at4[1] }, ...size2 && { w: size2[0], h: size2[1] }, ...i.label !== void 0 && { label: i.label } }];
    if (act === "rm") return [{ op: "room.rm", building: bid, level: level(i), id: x }];
    throw new Error("settlement room <id> <bid> add|set|rm \u2026");
  }
);
var KINDS_DOOR = "door | secret | locked | portcullis | arch | open";
var connect2 = sugar(
  "connect",
  "Put a door or opening in the wall two rooms of a floor share.",
  "       artgen settlement connect <id> <bid> <room> <room> [--level n] [--kind door|secret|locked|portcullis|arch|open] [--at x,y] [--width n] | disconnect <id> <bid> <i> [--level n]",
  { id: id("connect: <id>"), building: p.str("the building id", { positional: true }), a: p.str("the first room", { positional: true }), b: p.str("the second room", { positional: true }), level: LEVEL, kind: p.str(KINDS_DOOR), at: AT, width: p.num("the opening in cells") },
  (i) => [{ op: "connect", building: i.building, level: level(i), a: i.a, b: i.b, ...i.kind && { kind: i.kind }, ...i.at !== void 0 && { at: pointOf(i.at, "--at") }, ...i.width !== void 0 && { width: i.width } }]
);
var disconnect2 = sugar(
  "disconnect",
  "Remove a connection between two rooms of a floor.",
  [],
  { id: id("disconnect: <id>"), building: p.str("the building id", { positional: true }), index: p.str("the connection's index", { positional: true }), level: LEVEL },
  (i) => [{ op: "disconnect", building: i.building, level: level(i), index: Number(i.index) }]
);
var openingParams = () => ({ building: p.str("the building id", { positional: true }), at: p.str("x,y in plan cells from the footprint's top-left corner"), level: LEVEL, kind: p.str("the kind"), width: p.num("width in cells") });
var door2 = sugar(
  "door",
  "Put a door in a building's outer wall.",
  "       artgen settlement door|window <id> <bid> --at x,y [--level n] [--kind k] [--width n]      a door or window in the outer wall (plan cells from the footprint's top-left corner)",
  { id: id("door: <id>"), ...openingParams() },
  (i) => [{ op: "door", building: i.building, level: level(i), at: pointOf(i.at, "--at"), ...i.kind && { kind: i.kind }, ...i.width !== void 0 && { width: i.width } }]
);
var windowOp = sugar(
  "window",
  "Put a window in a building's outer wall.",
  [],
  { id: id("window: <id>"), ...openingParams() },
  (i) => [{ op: "window", building: i.building, level: level(i), at: pointOf(i.at, "--at"), ...i.kind && { kind: i.kind }, ...i.width !== void 0 && { width: i.width } }]
);
var fixture = sugar(
  "fixture",
  "Add or remove a piece of furniture on a building's floor.",
  '       artgen settlement fixture <id> <bid> add <kind> --at x,y [--level n] [--size WxH] [--angle deg] [--label "..."] | rm <i> [--level n]',
  { id: id("fixture: <id>"), building: p.str("the building id", { positional: true }), action: p.str("add | rm", { positional: true }), what: p.str("add: the kind (settlement fixtures); rm: the index", { positional: true }), at: AT, level: LEVEL, size: SIZE, angle: p.num("degrees"), label: p.str("a label") },
  (i) => {
    if (i.action === "add") {
      const at4 = pointOf(i.at, "--at"), size2 = i.size;
      return [{ op: "fixture.add", building: i.building, level: level(i), kind: i.what, x: at4[0], y: at4[1], ...size2 && { w: size2[0], h: size2[1] }, ...i.angle !== void 0 && { angle: i.angle }, ...i.label && { label: i.label } }];
    }
    if (i.action === "rm") return [{ op: "fixture.rm", building: i.building, level: level(i), index: Number(i.what) }];
    throw new Error("settlement fixture <id> <bid> add <kind> --at x,y [--level n] | rm <i>");
  }
);
var prop = sugar(
  "prop",
  "Add or remove a piece of furniture on the site (a well, a cart, a stall).",
  "       artgen settlement prop <id> add <kind> --at x,y [--size WxH] [--angle deg] | prop <id> rm <i>",
  { id: id("prop: <id>"), action: p.str("add | rm", { positional: true }), what: p.str("add: the kind (settlement fixtures); rm: the index", { positional: true }), at: AT, size: SIZE, angle: p.num("degrees"), label: p.str("a label") },
  (i) => {
    if (i.action === "add") {
      const at4 = pointOf(i.at, "--at"), size2 = i.size;
      return [{ op: "prop.add", kind: i.what, x: at4[0], y: at4[1], ...size2 && { w: size2[0], h: size2[1] }, ...i.angle !== void 0 && { angle: i.angle }, ...i.label && { label: i.label } }];
    }
    if (i.action === "rm") return [{ op: "prop.rm", index: Number(i.what) }];
    throw new Error("settlement prop <id> add <kind> --at x,y | rm <i>");
  }
);
var LINE_PARAMS = () => ({ points: p.points("x,y,\u2026 of the line or outline"), width: p.num("width"), curve: p.str("smooth"), label: p.str("a label") });
function lineOp(sub, summary, usage, extra = {}) {
  return sugar(
    sub,
    summary,
    usage,
    { id: id(`${sub}: <id>`), action: p.str("add | rm" + (sub === "wall" ? " | gate" : ""), { positional: true }), what: p.str("add: the kind; rm" + (sub === "wall" ? ", gate" : "") + ": the index", { positional: true }), ...LINE_PARAMS(), ...extra },
    (i) => {
      const act = i.action, what = i.what;
      if (act === "rm") return [{ op: `${sub}.rm`, index: Number(what) }];
      if (sub === "wall" && act === "gate") return [{ op: "wall.gate", index: Number(what), at: pointOf(i.at, "--at"), kind: i.kind ?? "gate", ...i.width !== void 0 && { width: i.width }, ...i.drawbridge === true && { drawbridge: true } }];
      if (act !== "add") throw new Error(`settlement ${sub} <id> add <kind> \u2026 | rm <i>`);
      const o = { op: `${sub}.add`, kind: what, points: needPoints(i.points, "--points") };
      if (i.width !== void 0) o.width = i.width;
      if (i.curve) o.curve = i.curve;
      if (i.label) o.label = i.label;
      if (sub === "wall") {
        if (i.closed === true) o.closed = true;
        if (i.thickness !== void 0) o.thickness = i.thickness;
        if (i.towers) o.towers = { shape: i.towers, ...i.tower_size !== void 0 && { size: i.tower_size }, ...i.tower_every !== void 0 && { every: i.tower_every } };
      }
      return [o];
    }
  );
}
var road = lineOp("road", "Add or remove a road.", `       artgen settlement road <id> add highway|street|lane|alley|path|track --points x,y,\u2026 [--width n] [--curve smooth] [--label "..."] | road <id> rm <i>`);
var water = lineOp("water", "Add or remove water.", "       artgen settlement water <id> add river|stream|canal|moat|pond|lake|sea --points x,y,\u2026 [--width n] | water <id> rm <i>");
var wall = lineOp(
  "wall",
  "Add a wall, put a gate in one, or remove one.",
  [
    "       artgen settlement wall <id> add curtain|stone|palisade|fence|hedge|drystone|ruined --points x,y,\u2026 [--closed] [--thickness n] [--towers round|square [--tower-size n] [--tower-every n]]",
    "                  | wall <id> gate <i> --at x,y [--kind gatehouse|gate|postern|opening] [--width n] [--drawbridge] | wall <id> rm <i>"
  ],
  { closed: p.bool("a closed ring"), thickness: p.num("thickness"), towers: p.str("round | square"), tower_size: p.num("tower size"), tower_every: p.num("a tower every n cells"), at: AT, kind: p.str("gate: gatehouse | gate | postern | opening"), drawbridge: p.bool("gate: with a drawbridge") }
);
var area = lineOp(
  "area",
  "Add or remove an area (field, wood, square, \u2026).",
  `       artgen settlement area <id> add <kind> --points x,y,\u2026 [--label "..."] | area <id> rm <i>      (areas: ${settlement_exports.AREA_KINDS.join(", ")}; trees: ${settlement_exports.TREE_KINDS.join(", ")})`
);
var tree = sugar(
  "tree",
  "Add, scatter or remove trees.",
  "       artgen settlement tree <id> add <kind> --at x,y [--size n] | tree <id> scatter <kind> --area x,y,\u2026 --count n | tree <id> rm <i>",
  { id: id("tree: <id>"), action: p.str("add | scatter | rm", { positional: true }), what: p.str("add, scatter: the kind; rm: the index", { positional: true }), at: AT, size: p.num("size"), area: p.points("scatter: the area, x,y,\u2026"), count: p.num("scatter: how many (default 10)"), seed: p.num("scatter: the seed") },
  (i) => {
    const act = i.action, what = i.what;
    if (act === "rm") return [{ op: "tree.rm", index: Number(what) }];
    if (act === "scatter") return [{ op: "tree.scatter", kind: what ?? "tree", area: needPoints(i.area, "--area"), count: i.count ?? 10, ...i.seed !== void 0 && { seed: i.seed } }];
    if (act !== "add") throw new Error("settlement tree <id> add <kind> \u2026 | rm <i>");
    const at4 = pointOf(i.at, "--at");
    return [{ op: "tree.add", kind: what ?? "tree", x: at4[0], y: at4[1], ...i.size !== void 0 && { size: i.size } }];
  }
);
var grid4 = defineOp({
  name: "settlement.grid",
  module: "maps",
  effect: "write",
  summary: "Set a settlement's grid.",
  params: { id: id("grid: <id>"), path: pathParam("settlement"), mode: p.str("a size in the sheet's unit (10), or none", { positional: true }), sub: p.bool("a fainter sub-grid", { style: "onoff" }) },
  run(i, ctx) {
    return updateSettlement(projectOf(i, ctx), refOf(i), (m) => {
      const mode = i.mode;
      if (mode === "none" || mode === "off") m.grid.show = false;
      else if (mode !== void 0) {
        const v = Number(mode);
        if (!(v > 0)) throw new Error("grid: a size in the sheet's unit (10), or none");
        m.grid = { ...m.grid, show: true, size: v / m.scale.perCell };
      }
      if (i.sub !== void 0) m.grid.sub = i.sub;
    });
  },
  cli: { usage: "       artgen settlement grid <id> [10|5|none] [--sub on|off]", text: (m, i) => `grid ${m.grid.show ? `every ${m.grid.size * m.scale.perCell} ${m.scale.unit}${m.grid.sub ? ", sub-grid" : ""}` : "off"}
${next3(i, m.id)}`, json: (m) => V3(m.grid) },
  mcp: { exclude: "settlement_update covers it" },
  python: {}
});
var style2 = defineOp({
  name: "settlement.style",
  module: "maps",
  effect: "write",
  summary: "Set a settlement's title, ground, scale and furniture.",
  params: {
    id: id("style: <id>"),
    path: pathParam("settlement"),
    title: p.str('the title ("" removes it)'),
    ground: p.str("grass | dirt | sand | snow | stone"),
    numbers: p.bool("show building numbers", { style: "onoff" }),
    scale_bar: p.bool("show the scale bar", { style: "onoff" }),
    compass: p.bool("show the compass", { style: "onoff" }),
    legend: p.bool("show the legend", { style: "onoff" }),
    per_cell: p.num("map units in one cell"),
    unit: p.str("the scale unit, e.g. ft"),
    plan_cell: p.num("feet in a floor-plan cell"),
    furniture: p.str("over | outside | auto"),
    furniture_side: p.str("bottom | right")
  },
  run(i, ctx) {
    return updateSettlement(projectOf(i, ctx), refOf(i), (m) => {
      if (i.title !== void 0) {
        if (i.title) m.title = i.title;
        else delete m.title;
      }
      if (i.ground !== void 0) m.ground = i.ground;
      for (const k of ["numbers", "scale_bar", "compass", "legend"]) if (i[k] !== void 0) m[k === "scale_bar" ? "scaleBar" : k] = i[k];
      if (i.per_cell !== void 0) m.scale.perCell = i.per_cell;
      if (i.unit) m.scale.unit = i.unit;
      if (i.plan_cell !== void 0) m.interior.perCell = i.plan_cell;
      if (i.furniture) m.furniture = { place: i.furniture, ...i.furniture_side && { side: i.furniture_side } };
    });
  },
  cli: {
    usage: '       artgen settlement style <id> [--title "..."] [--ground grass|dirt|sand|snow|stone] [--numbers on|off] [--scale-bar on|off] [--compass on|off] [--legend on|off] [--per-cell n] [--unit ft] [--plan-cell n] [--furniture over|outside|auto]',
    text: (m, i) => `${describeSettlement(m).split("\n").slice(0, 3).join("\n")}
${next3(i, m.id)}`,
    json: (m) => V3(m)
  },
  mcp: { exclude: "settlement_update covers it" },
  python: {}
});
var label3 = sugar(
  "label",
  "Add a label to a settlement.",
  '       artgen settlement label <id> "Text" --at x,y [--kind name|note|area|street] [--size f] [--angle deg] [--href url]',
  { id: id("label: <id>"), text: p.str("the label text", { positional: true }), at: AT, kind: p.str("name | note | area | street (default name)"), size: p.num("size factor"), angle: p.num("degrees"), href: p.str("a link") },
  (i) => {
    const at4 = pointOf(i.at, "--at");
    return [{ op: "label", text: i.text, x: at4[0], y: at4[1], kind: i.kind ?? "name", ...i.size !== void 0 && { size: i.size }, ...i.angle !== void 0 && { angle: i.angle }, ...i.href && { href: i.href } }];
  }
);
var symbol3 = sugar(
  "symbol",
  "Add a symbol to a settlement.",
  "       artgen settlement symbol <id> <kind> --at x,y [--scale f] [--angle deg]",
  { id: id("symbol: <id>"), kind: p.str("the symbol kind (artgen settlement symbols)", { positional: true }), at: AT, scale: p.num("size factor"), angle: p.num("degrees") },
  (i) => {
    const at4 = pointOf(i.at, "--at");
    return [{ op: "symbol", kind: i.kind, x: at4[0], y: at4[1], ...i.scale !== void 0 && { scale: i.scale }, ...i.angle !== void 0 && { angle: i.angle } }];
  }
);
var overlay3 = sugar(
  "overlay",
  "Remove a label or symbol from a settlement.",
  "       artgen settlement overlay <id> rm label|symbol <i>",
  { id: id("overlay: <id>"), action: p.str("rm", { positional: true }), which: p.str("label | symbol", { positional: true }), index: p.str("the item to remove", { positional: true }) },
  (i) => {
    if (i.action !== "rm" || !["label", "symbol"].includes(i.which)) throw new Error("settlement overlay <id> rm label|symbol <i>");
    return [{ op: `${i.which}.rm`, index: Number(i.index) }];
  }
);
var check3 = defineOp({
  name: "settlement.check",
  module: "maps",
  effect: "read",
  summary: "Check a settlement file: every error with its JSON path, then drawing warnings.",
  description: "Check a settlement: every error in its file with the JSON path, then drawing warnings (buildings laid over each other, standing in water or across a road, a gate far from its wall, a room outside its footprint, furniture outside the building or on other furniture, stairs that meet nothing on the next floor, marks off the sheet).",
  params: { id: id("check: <id>"), path: pathParam("settlement") },
  run: (i, ctx) => checkSettlementFile(projectOf(i, ctx), refOf(i)),
  cli: {
    usage: "       artgen settlement check <id> [--json] | facts <id> [--json] | show <id> | list",
    text: (r) => [`${r.file}: ${r.ok ? "ok" : `${r.errors.length} error${r.errors.length === 1 ? "" : "s"}`}${r.warnings.length ? `, ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}` : ""}`, ...r.errors.map((e) => `  error: ${e.path || "(file)"}: ${e.message}`), ...r.warnings.map((w) => `  warning: ${w.path}: ${w.message}`)].join("\n"),
    json: (r) => V3(r),
    exit: (r) => r.ok ? 0 : 1
  },
  mcp: {},
  python: {}
});
var facts3 = defineOp({
  name: "settlement.facts",
  module: "maps",
  effect: "read",
  summary: "A settlement read back as numbers: counts by kind, each building, wall and road.",
  description: "A settlement read back as numbers: counts by kind, each building's box, size, storeys and floors (rooms, doors, windows, furniture by kind), each wall's length, towers and gates, each road's length, water and areas.",
  params: { id: id("facts: <id>"), path: pathParam("settlement") },
  run: (i, ctx) => settlement_exports.settlementFacts(readSettlement(projectOf(i, ctx), refOf(i))),
  cli: { usage: [], text: (r) => describeSettlementFacts(r), json: (r) => V3(r) },
  mcp: {},
  python: {}
});
var renderOptions = (i, ctx) => ({
  themes: i.theme === "both" ? ["color", "bw"] : [i.theme === "bw" ? "bw" : "color"],
  ...(ctx.surface === "mcp" ? i.view === "plan" || typeof i.building === "string" : i.view !== void 0) && { view: ctx.surface === "mcp" ? "plan" : i.view },
  ...typeof i.building === "string" && i.building && { building: i.building },
  ...typeof i.floor === "number" && { floor: i.floor },
  ...typeof i.buildings === "string" && { buildings: i.buildings },
  layers: layersOf(i.layers, (v) => parseLayers(v, [.../* @__PURE__ */ new Set([...settlement_exports.SITE_LAYERS, ...settlement_exports.PLAN_LAYERS])]))
});
async function renderPreview3(rs, i, ctx) {
  const P = ctx.project(), o = renderOptions(i, ctx), files = rs.flatMap((r) => r.files.map((f) => ctx.rel(f)));
  if (i.plans === true) return [text({ renders: rs.length, files })];
  const spec = readSettlement(P, i.id);
  const look = typeof i.ppu === "number" ? files.filter((f) => f.endsWith(".png")) : (await renderSettlementFiles(P, i.id, { ...o, ppu: o.view === "plan" ? 28 : Math.max(4, Math.min(16, Math.round(1100 / Math.max(spec.cols, spec.rows)))), formats: ["png"], out: join15(P.art, "settlements", i.id, "out", "preview") })).flatMap((r) => r.files.map((f) => ctx.rel(f)));
  return [text({ ...rs[0], files }), ...look.map((f) => pngFile(join15(P.root, f)))];
}
var render3 = defineOp({
  name: "settlement.render",
  module: "maps",
  effect: "render",
  summary: "Render a settlement's site or one building's floor plan to SVG and/or PNG.",
  description: "Render a settlement to art/settlements/<id>/out/ (SVG + PNG) and return the PNG to look at. view: site (default) or plan (one building's floor: building id, floor level, default the ground floor). buildings (site): roofs (blocked out, default), outline, or interior (each building cut away to its ground floor). theme: color (default), bw or both. plans: true renders the site and every floor of every building (images not returned). layers turns layers off/on (site: ground, underlay, areas, water, roads, bridges, walls, buildings, trees, props, grid, symbols, numbers, labels, legend, title, scale, compass; plan: floor, grid, walls, doors, windows, fixtures, numbers, labels, \u2026). ppu: pixels per cell (default 24 on the site, 40 on a plan; the returned image is smaller unless set).",
  params: {
    id: id("render: <id>"),
    path: pathParam("settlement"),
    view: p.oneOf(settlement_exports.VIEWS, "site (default) or plan (one building's floor)", { error: "site or plan" }),
    building: p.str("plan: the building id"),
    floor: p.num("plan: the floor level (default the ground floor)"),
    buildings: p.oneOf(settlement_exports.BUILDING_MODES, "site: roofs (default), outline, or interior (cut away to the ground floor)"),
    theme: p.oneOf(["color", "bw", "both"], "color (default), bw or both", { error: "color, bw or both" }),
    plans: p.bool("the site and every floor of every building"),
    ppu: p.num("pixels per cell (default 24 on the site, 40 on a plan)"),
    layers: p.str("layers to turn off/on, e.g. grid=off,labels=off", { schema: { type: "object", description: "layers to turn off/on, e.g. { grid: false }" } }),
    format: p.oneOf(["svg", "png", "both"], "svg, png or both (default both)", { mcp: false, error: "svg, png or both" }),
    fit: p.str("180x260mm or 800x600px: pick the scale that fits the window in the box", { mcp: false }),
    page_scale: p.str("output pixels per millimetre on the page", { mcp: false }),
    crop: p.str("x,y,w,h in cells: a window on the render", { mcp: false }),
    out: p.str("the folder to render into", { mcp: false })
  },
  async run(i, ctx) {
    const P = projectOf(i, ctx), format = i.format ?? "both";
    return renderSettlementFiles(P, refOf(i), {
      ...renderOptions(i, ctx),
      formats: format === "both" ? ["svg", "png"] : [format],
      plans: i.plans === true,
      ppu: typeof i.ppu === "number" ? i.ppu : void 0,
      pageScale: pageScaleOf(i.page_scale),
      ...viewOf(i, () => 1),
      out: i.out
    });
  },
  cli: {
    usage: [
      "       artgen settlement render <id> [--view site|plan] [--building bid [--floor n]] [--plans] [--buildings roofs|outline|interior] [--theme color|bw|both] [--format svg|png|both] [--ppu n | --fit 180x260mm] [--crop x,y,w,h] [--layers grid=off] [--out dir]",
      "                  the site (roofs, outlines, or cut away to the ground floor), one building's floor plan, or with --plans the site and every floor of every building"
    ],
    text: (rs, i) => rs.map((r) => [`${i.path ?? i.id} ${r.view === "plan" ? `${r.building} level ${r.floor ?? 0}` : "site"}: ${r.size.join("\xD7")} px, ${Math.round(r.ppu * 100) / 100} px a cell`, ...r.files.map((f) => `  ${f}`)].join("\n")).join("\n"),
    json: (rs) => V3(rs.length === 1 ? rs[0] : { renders: rs })
  },
  mcp: { content: renderPreview3 },
  python: {}
});
var SETTLEMENT_OPS_LIST = [
  list5,
  symbols3,
  fixtures,
  show4,
  create3,
  update3,
  style2,
  grid4,
  gen3,
  edit3,
  building2,
  interior,
  floor2,
  room2,
  connect2,
  disconnect2,
  door2,
  windowOp,
  fixture,
  prop,
  road,
  water,
  wall,
  area,
  tree,
  label3,
  symbol3,
  overlay3,
  check3,
  facts3,
  render3
];

// ../artgen-cli/src/ops/maps.ts
var formats = defineOp({
  name: "formats",
  module: "maps",
  effect: "read",
  summary: "The map, dungeon and settlement file format versions this artgen reads and writes.",
  description: "The map, dungeon and settlement file format versions this artgen reads and writes (a newer file is refused).",
  params: {},
  run: () => ({ map: map_exports.MAP_FORMAT, dungeon: dungeon_exports.DUNGEON_FORMAT, settlement: settlement_exports.SETTLEMENT_FORMAT }),
  cli: { usage: "       artgen formats   (the map, dungeon and settlement file format versions this artgen reads; a newer file is refused)", text: (r) => Object.entries(r).map(([k, v]) => `${k} ${v}`).join("\n") },
  mcp: {},
  python: {}
});
var MAP_OPS = [...MAP_MAP_OPS, ...MAP_TRACE_OPS, ...DUNGEON_OPS_LIST, ...SETTLEMENT_OPS_LIST, formats, ...WORKFLOW_OPS];
var MAP_NOTE = "       (map, dungeon and settlement commands take --file <path> in place of <id>: no project needed; renders go beside the file or to --out)";
var MAP_USAGE = `${MAP_OPS.flatMap(usageLines).join("\n")}
${MAP_NOTE}`;

// ../artgen-cli/src/maps-cli.ts
var cliCtx = (root) => ({ surface: "cli", project: () => requireProject(root), findProject: () => findProject(root), rel: (f) => f });
var GROUP_HELP = {
  map: "map: new | gen | edit | grid | label | symbol | symbols | overlay | set | render | show | facts | check | sync | list | brief | version | diff | review | feedback | approve | status | sheet | direction (artgen --help)",
  dungeon: "dungeon: new | gen | room | block | link | unlink | door | connect | disconnect | grid | style | label | symbol | symbols | overlay | check | fit | render | show | facts | sync | list | brief | version | diff | review | feedback | approve | status | sheet (artgen --help)",
  settlement: "settlement: new | gen | building | interior | floor | room | connect | disconnect | door | window | fixture | prop | road | water | wall | area | tree | grid | style | label | symbol | overlay | check | facts | render | show | list | fixtures | symbols | brief | version | diff | review | feedback | approve | status | sheet (artgen --help)"
};
var dispatch = (argv) => runCli([...MAP_OPS, ...CORE_OPS], argv, {
  log: (s) => console.log(s),
  ctx: cliCtx,
  readFile: (f) => readFileSync14(f, "utf8"),
  unknown: (a) => {
    throw new Error(GROUP_HELP[a[0]] ?? `artgen: unknown command '${a.slice(0, 2).join(" ")}' \u2014 run artgen --help for the list`);
  }
});
var MAPS_BUNDLE_USAGE = `${MAP_USAGE}
${CORE_OPS.flatMap(usageLines).join("\n")}`;
async function mapsMain(argv) {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a) => a !== void 0);
  if (cmd === "--version" || cmd === "version") {
    console.log(MAPS_VERSION);
    return 0;
  }
  if (!cmd || cmd === "--help" || cmd === "help") {
    console.log(`artgen-maps ${MAPS_VERSION} \u2014 the artgen map, dungeon and settlement engines, usable alone.

usage:
${MAPS_BUNDLE_USAGE}
       artgen-maps.js --version | --help`);
    return 0;
  }
  const core2 = [...new Set(CORE_OPS.map((op) => wordsOf(op)[0]))];
  if (cmd === "formats" || cmd === "map" || cmd === "dungeon" || cmd === "settlement" || core2.includes(cmd)) return dispatch([cmd, ...args]);
  throw new Error(`artgen-maps: ${cmd}: not a command here; this bundle has map, dungeon, settlement, formats, ${core2.join(", ")} (--help)`);
}
var MAPS_VERSION = `${true ? "0.11.0" : "dev"} (${true ? "f00754a" : "unknown"})`;

// ../artgen-cli/src/maps-bin.ts
mapsMain(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
