/**
 * artgen worker (SPEC §13.2): the same `@artgen/core` build the CLI runs, over a snapshot of the opened project's
 * `art/` folder. Asset modules are code from the game repo (D17), so they are imported here — as blob: URLs with
 * their relative imports rewritten — and never on the page. The worker does no file I/O: it returns write plans
 * that the project store applies after checking the disk.
 */
import * as Comlink from 'comlink';
import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';
import fontRegular from '../../packages/artgen-core/assets/fonts/AlegreyaSans-Regular.ttf?url';
import fontBold from '../../packages/artgen-core/assets/fonts/AlegreyaSans-Bold.ttf?url';
import fontItalic from '../../packages/artgen-core/assets/fonts/AlegreyaSans-Italic.ttf?url';
import {
  buildPack, dungeon, encodePNG, extractPalette, decodePNG, Grid, initSvg, map, parseDirection, rasterizeSvg, setSvgFonts, settlement, sourceHash, validateDirection,
  mapDirection, type Direction, type LedgerEntry, type PackManifest, type SubjectKind,
} from 'artgen-core';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { ArtProject, img, strip, type FileOp, type Img, type Snapshot } from '../core/project/engine';
import { snapshotLoader } from '../core/project/snapshot';

let project: ArtProject | null = null;
let revision = -1;
const urls = new Map<string, string>();
const svgReady = initSvg(fetch(wasmUrl));
/** Terrain map label fonts, loaded on the first PNG export (the SVG preview uses the page's copy of the same font). */
let mapFonts: Promise<void> | null = null;
const loadMapFonts = () => (mapFonts ??= Promise.all([fontRegular, fontBold, fontItalic].map(async u => new Uint8Array(await (await fetch(u)).arrayBuffer())))
  .then(b => setSvgFonts(b, map.FONT_FAMILY)));
/** The last generated terrain field, reused while only the overlay, grid or theme changes. */
let mapField: { key: string; field: map.MapField } | null = null;

function mapFieldFor(spec: map.MapSpec): map.MapField {
  const key = map.fieldKey(spec);
  if (mapField?.key !== key) mapField = { key, field: map.generateMap(spec) };
  return mapField.field;
}

export interface MapRenderOptions { theme: map.ThemeName; ppu?: number; layers?: Partial<Record<map.MapLayer, boolean>> }
export interface DungeonRenderOptions { ppu?: number; layers?: Partial<Record<dungeon.DungeonLayer, boolean>> }
export interface SettlementRenderOptions {
  view?: settlement.SettlementView; building?: string; floor?: number; theme?: settlement.SettlementTheme; buildings?: settlement.BuildingMode; ppu?: number;
  layers?: Partial<Record<settlement.SettlementLayer, boolean>>;
  /** The terrain map the file's `underlay` names (read by the page from the project), as its JSON. */
  underlayMap?: unknown;
}

/** The render options with the underlay map parsed and generated (cached like the Terrain Map's field). */
function settlementView(o: SettlementRenderOptions): settlement.RenderSettlementOptions {
  const { underlayMap, ...rest } = o;
  if (!underlayMap) return rest;
  const m = map.parseMap(underlayMap);
  return { ...rest, underlay: { map: m, field: mapFieldFor(m) } };
}

function current(): ArtProject {
  if (!project) throw new Error('no project loaded');
  return project;
}

export interface CellPayload { state: string; facing: string; frame: number; mirrored: boolean; img: Img; anchors?: Record<string, [number, number]> }

export interface RenderPayload {
  version: string;
  size: [number, number];
  states: string[];
  facings: string[];
  frames: Record<string, number>;
  cells: CellPayload[];
  strip: Img;
  report: import('artgen-core').ConformanceReport;
  base?: string;
  stale?: string[];
  context?: Img;
  /** How the game shows it, when that isn't one frame: stack turn strip, parallax scroll (P6a). */
  preview?: Img;
  background?: string;
  tile: boolean;
}

const api = {
  /** Replace the project snapshot (the store bumps `rev` on every reload). */
  async load(snap: Snapshot, rev: number): Promise<void> {
    await svgReady;
    // blob URLs of sources that are gone are released; unchanged sources keep theirs (module cache stays valid)
    const keep = new Set(Object.entries(snap.text).map(([p, s]) => `${p}\n${s}`));
    for (const [k, u] of urls) if (!keep.has(k)) { URL.revokeObjectURL(u); urls.delete(k); }
    const { load } = snapshotLoader(snap, code => URL.createObjectURL(new Blob([code], { type: 'text/javascript' })), urls);
    project = new ArtProject(snap, load);
    revision = rev;
  },

  rev: (): number => revision,

  status: () => current().status(),

  detail: (id: string) => current().detail(id),

  async render(id: string, version: string, o: { variant?: number; seed?: number; params?: Record<string, unknown> } = {}): Promise<RenderPayload> {
    const p = current(), a = p.asset(id), r = await p.renderVersion(a, version, o), s = strip(r.render);
    return {
      version: r.version, size: r.render.size, states: r.render.states, facings: r.render.facings, frames: r.render.frames,
      cells: r.render.cells.map(c => ({ state: c.state, facing: c.facing, frame: c.frame, mirrored: c.mirrored, img: img(c.grid), ...(c.anchors && { anchors: c.anchors }) })),
      strip: img(s), report: r.report, base: r.base, stale: r.stale,
      context: p.context(a, r.render.size[0] * 3, r.render.size[1] * 3), preview: p.preview(a, r.render), background: a.brief.review?.bg ?? a.dir.background,
      tile: ['tile', 'tileset', 'texture'].includes(a.brief.kind),
    };
  },

  params: (id: string, version: string) => current().paramsOf(id, version),

  approve: (id: string, note?: string) => current().approve(id, note),

  feedback: (id: string, o: { route: 'base' | 'finish'; note: string; region?: number[]; cell?: string; force?: boolean }) => current().feedback(id, o),

  line: (e: Omit<LedgerEntry, 'ts'>): string => ArtProject.line(e),

  analytics: () => current().analytics(),

  anchors: () => current().anchors(),

  /** Asset Review: every map, dungeon and settlement in the project (works without a locked art direction), and one in detail. */
  subjects: () => current().subjects(),
  subjectDetail: (kind: SubjectKind, id: string) => current().subjectDetail(kind, id),
  subjectDiff: (kind: SubjectKind, id: string, a: string, b: string) => current().subjectDiff(kind, id, a, b),
  approveSubject: (kind: SubjectKind, id: string, note?: string): FileOp[] => current().approveSubject(kind, id, note),
  feedbackSubject: (kind: SubjectKind, id: string, o: { note: string; region?: number[] }): FileOp[] => current().feedbackSubject(kind, id, o),
  assetSheet: (id: string) => current().assetSheet(id),

  /** A version of a map, dungeon or settlement (the working file when `version` is left out) as a PNG, in the locked map direction's theme: the same render functions as the editors, over the raw JSON of the version's file. */
  async subjectPng(kind: SubjectKind, id: string, version?: string): Promise<Uint8Array> {
    const p = current(), raw = JSON.parse(p.subjectFile(kind, id, version)) as { cols: number; rows: number }, theme = mapDirection.themeFor(p.mapDirection(), kind);
    const ppu = (base: number) => Math.max(4, Math.min(base, Math.floor(700 / Math.max(raw.cols, raw.rows))));
    if (kind === 'map') return api.mapPng(raw, { theme: theme as map.ThemeName, ppu: ppu(40) });
    if (kind === 'dungeon') return api.dungeonPng(raw, { ppu: ppu(40) });
    return api.settlementPng(raw, { theme: theme as settlement.SettlementTheme, ppu: ppu(24), underlayMap: p.subjectUnderlay(kind, id) });
  },

  direction() {
    const p = current();
    return { raw: p.rawDirection(), locked: p.locked(), candidates: p.candidates(), hasProbes: p.hasProbes() };
  },

  candidate: (name: string): Direction => current().candidate(name),

  validate: (d: unknown) => validateDirection(d),

  /** Live style tile for edited / compared directions (not written to disk). */
  async styleTile(columns: { label: string; dir: unknown }[], title?: string) {
    return current().styleTile(columns.map(c => ({ label: c.label, dir: parseDirection(c.dir) })), title);
  },

  saveDraft: (name: string, edited: unknown): FileOp[] => current().saveDraft(name, edited),

  lock: (name: string, note?: string) => current().lock(name, note),

  /** Palette from a reference image (median cut → ramps), for the palette editor. */
  extract(image: Img | Uint8Array, n = 16) {
    return extractPalette(image instanceof Uint8Array ? decodePNG(image) : new Grid(image.w, image.h, image.data), n);
  },

  /** Terrain Map: validate and render a map to SVG (no project needed). */
  mapSvg(raw: unknown, o: MapRenderOptions): { svg: string; terrains: map.Terrain[]; rivers: number } {
    const spec = map.parseMap(raw), field = mapFieldFor(spec);
    return { svg: map.renderMapSvg(spec, { ...o, field }), terrains: map.terrainsUsed(field), rivers: field.rivers.length };
  },

  /** Terrain Map: PNG bytes, rasterised by the same resvg build and fonts as the CLI. */
  async mapPng(raw: unknown, o: MapRenderOptions): Promise<Uint8Array> {
    await svgReady; await loadMapFonts();
    const spec = map.parseMap(raw), ppu = o.ppu ?? 40, svg = map.renderMapSvg(spec, { ...o, ppu, field: mapFieldFor(spec) });
    const png = encodePNG(rasterizeSvg(svg, spec.cols * ppu, spec.rows * ppu));
    return Comlink.transfer(png, [png.buffer as ArrayBuffer]);
  },

  /** Dungeon Map: validate and render a dungeon to SVG (no project needed). */
  dungeonSvg(raw: unknown, o: DungeonRenderOptions): { svg: string; rooms: number; corridors: number; doors: number; band: { right: number; bottom: number } } {
    const spec = dungeon.parseDungeon(raw), layout = dungeon.layoutDungeon(spec);
    return { svg: dungeon.renderDungeonSvg(spec, { ...o, layout }), rooms: spec.rooms.length, corridors: spec.corridors.length, doors: layout.doors.length, band: dungeon.dungeonRenderSize(spec, { ...o, layout }).band };
  },

  /** Dungeon Map: PNG bytes, rasterised by the same resvg build and fonts as the CLI. */
  async dungeonPng(raw: unknown, o: DungeonRenderOptions): Promise<Uint8Array> {
    await svgReady; await loadMapFonts();
    const spec = dungeon.parseDungeon(raw), ppu = o.ppu ?? 40, svg = dungeon.renderDungeonSvg(spec, { ...o, ppu });
    const size = dungeon.dungeonRenderSize(spec, { ...o, ppu }), png = encodePNG(rasterizeSvg(svg, Math.round(size.width), Math.round(size.height)));
    return Comlink.transfer(png, [png.buffer as ArrayBuffer]);
  },

  /** Settlement Map: validate and render the site or a floor plan to SVG (no project needed). */
  settlementSvg(raw: unknown, o: SettlementRenderOptions): { svg: string; width: number; height: number; buildings: number; bridges: number } {
    const spec = settlement.parseSettlement(raw), view = settlementView(o), svg = settlement.renderSettlementSvg(spec, view), m = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
    return { svg, width: m ? +m[1] : 0, height: m ? +m[2] : 0, buildings: spec.buildings.length, bridges: settlement.layoutSettlement(spec).bridges.length };
  },

  /** Settlement Map: PNG bytes, rasterised by the same resvg build and fonts as the CLI. */
  async settlementPng(raw: unknown, o: SettlementRenderOptions): Promise<Uint8Array> {
    await svgReady; await loadMapFonts();
    const spec = settlement.parseSettlement(raw), view = settlementView(o), svg = settlement.renderSettlementSvg(spec, view), size = settlement.settlementRenderSize(spec, view);
    const png = encodePNG(rasterizeSvg(svg, Math.round(size.width), Math.round(size.height)));
    return Comlink.transfer(png, [png.buffer as ArrayBuffer]);
  },

  /** Settlement Map: lay the settlement out again (in the worker: a city or a terrain map under it takes a moment). */
  settlementGenerate(raw: unknown, underlayMap?: unknown): settlement.SettlementSpec {
    const spec = settlement.parseSettlement(raw), m = underlayMap ? map.parseMap(underlayMap) : null;
    return settlement.generateSettlement(spec, m ? { map: m, field: mapFieldFor(m) } : {});
  },

  /** A one-asset pack for the Asset Lab: plays through the runtime's canvas2d adapter, downloads as a pack. */
  async labPack(id: string, version: string, o: { variant?: number; seed?: number; params?: Record<string, unknown> } = {}): Promise<{ manifest: PackManifest; atlases: Img[]; png: Uint8Array[] }> {
    const p = current(), a = p.asset(id), r = await p.renderVersion(a, version, o);
    const built = buildPack(id, a.dir, [{ brief: a.brief, view: a.brief.view ?? a.dir.camera.view, renders: [r.render], version, sourceHash: sourceHash(r.source) }], { generator: 'artgen image-tools (Asset Lab)', runtime: RUNTIME_VERSION });
    return { manifest: built.manifest, atlases: built.atlases.map(img), png: built.atlases.map(g => encodePNG(g)) };
  },
};

export type ArtgenApi = typeof api;

Comlink.expose(api);
