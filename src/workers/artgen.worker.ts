/**
 * artgen worker (SPEC §13.2): the same `@artgen/core` build the CLI runs, over a snapshot of the opened project's
 * `art/` folder. Asset modules are code from the game repo (D17), so they are imported here — as blob: URLs with
 * their relative imports rewritten — and never on the page. The worker does no file I/O: it returns write plans
 * that the project store applies after checking the disk.
 */
import * as Comlink from 'comlink';
import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';
import {
  buildPack, encodePNG, extractPalette, decodePNG, Grid, initSvg, parseDirection, sourceHash, validateDirection,
  type Direction, type LedgerEntry, type PackManifest,
} from 'artgen-core';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { ArtProject, img, strip, type FileOp, type Img, type Snapshot } from '../core/project/engine';
import { snapshotLoader } from '../core/project/snapshot';

let project: ArtProject | null = null;
let revision = -1;
const urls = new Map<string, string>();
const svgReady = initSvg(fetch(wasmUrl));

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
      context: p.context(a, r.render.size[0] * 3, r.render.size[1] * 3), background: a.brief.review?.bg ?? a.dir.background,
      tile: ['tile', 'tileset', 'texture'].includes(a.brief.kind),
    };
  },

  params: (id: string, version: string) => current().paramsOf(id, version),

  approve: (id: string, note?: string) => current().approve(id, note),

  feedback: (id: string, o: { route: 'base' | 'finish'; note: string; region?: number[]; cell?: string; force?: boolean }) => current().feedback(id, o),

  line: (e: Omit<LedgerEntry, 'ts'>): string => ArtProject.line(e),

  analytics: () => current().analytics(),

  anchors: () => current().anchors(),

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

  /** A one-asset pack for the Asset Lab: plays through the runtime's canvas2d adapter, downloads as a pack. */
  async labPack(id: string, version: string, o: { variant?: number; seed?: number; params?: Record<string, unknown> } = {}): Promise<{ manifest: PackManifest; atlases: Img[]; png: Uint8Array[] }> {
    const p = current(), a = p.asset(id), r = await p.renderVersion(a, version, o);
    const built = buildPack(id, a.dir, [{ brief: a.brief, view: a.brief.view ?? a.dir.camera.view, renders: [r.render], version, sourceHash: sourceHash(r.source) }], { generator: 'artgen image-tools (Asset Lab)', runtime: RUNTIME_VERSION });
    return { manifest: built.manifest, atlases: built.atlases.map(img), png: built.atlases.map(g => encodePNG(g)) };
  },
};

export type ArtgenApi = typeof api;

Comlink.expose(api);
