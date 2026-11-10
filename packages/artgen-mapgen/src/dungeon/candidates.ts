/**
 * Candidates for a level (`artgen dungeon layout --seeds`): one graph laid out from several seeds, each scored on what the
 * drawing checks find, and the best kept. A contact sheet shows them side by side. The score starts at 100 and loses
 * points for each finding a reader would see (stacked doors, a door off its wall, floor outside the bounds, passages from
 * one room that cross or run together), for each way left unrouted, each held bearing that strays and each way that walks
 * past its detour.
 */
import { esc, FONT, n1 } from 'artgen-primitives/lib/svgdraw.ts';
import { layoutGraph, type Graph, type GraphReport } from './graph.ts';
import { layoutNested, type NestedReport } from './nested.ts';
import type { Design, Layout } from './design.ts';
import { lintDungeon, type CheckId } from './lint.ts';
import { dungeonRenderSize, renderDungeonSvg } from './render.ts';
import type { DungeonSpec } from './spec.ts';

/** Points a finding of each kind costs; any other warning costs `warning`, any other error `error`. */
export const SCORE_WEIGHTS: Partial<Record<CheckId, number>> & { warning: number; error: number } = {
  'doors-stacked': 8, 'door-off-wall': 8, 'outside-bounds': 12, 'in-keep-out': 12, 'passages-tangle': 6, 'corridors-cross': 10,
  'through-room': 12, 'way-no-passage': 12, 'corridor-along-wall': 4, warning: 2, error: 15,
};
/** Points each way left unrouted, each held bearing strayed and each detour past its limit cost. */
export const SCORE_COSTS = { left: 15, held: 8, detour: 4 } as const;

/** A level's score (0..100) and the findings it counted, by kind. */
export function scoreLayout(spec: DungeonSpec, report: Pick<GraphReport, 'left' | 'held' | 'detours'>): { score: number; findings: Record<string, number> } {
  const findings: Record<string, number> = {};
  let lost = 0;
  for (const f of lintDungeon(spec)) {
    findings[f.id] = (findings[f.id] ?? 0) + 1;
    lost += SCORE_WEIGHTS[f.id] ?? SCORE_WEIGHTS[f.severity];
  }
  lost += SCORE_COSTS.left * report.left.length + SCORE_COSTS.held * report.held.length + SCORE_COSTS.detour * report.detours.length;
  return { score: Math.max(0, 100 - lost), findings };
}

export interface Candidate { seed: number; score: number; findings: Record<string, number>; report: GraphReport; spec: DungeonSpec }
export interface Candidates { ranked: Candidate[]; failed: { seed: number; error: string }[] }

/** The graph laid out from `seeds` seeds (the graph's own seed and the ones after it), best score first; ties keep the lower seed. */
export function layoutCandidates(g: Graph, seeds: number): Candidates {
  const from = g.seed ?? 1, ranked: Candidate[] = [], failed: { seed: number; error: string }[] = [];
  for (let k = 0; k < Math.max(1, seeds); k++) {
    const seed = from + k;
    try {
      const { spec, report } = layoutGraph({ ...g, seed });
      ranked.push({ seed, ...scoreLayout(spec, report), report, spec });
    } catch (e) { failed.push({ seed, error: (e as Error).message.split('\n')[0] }); }
  }
  ranked.sort((a, b) => b.score - a.score || a.seed - b.seed);
  return { ranked, failed };
}

/** A design laid out from the bottom up (`layoutNested`) from `seeds` seeds, best score first; each keeps its nested report. */
export function nestedCandidates(d: Design, library: Layout[], seeds: number): { ranked: (Candidate & { nested: NestedReport })[]; failed: { seed: number; error: string }[] } {
  const from = d.seed ?? 1, ranked: (Candidate & { nested: NestedReport })[] = [], failed: { seed: number; error: string }[] = [];
  for (let k = 0; k < Math.max(1, seeds); k++) {
    const seed = from + k;
    try {
      const { spec, report } = layoutNested({ ...d, seed }, library);
      ranked.push({ seed, ...scoreLayout(spec, report.final), report: report.final, spec, nested: report });
    } catch (e) { failed.push({ seed, error: (e as Error).message.split('\n')[0] }); }
  }
  ranked.sort((a, b) => b.score - a.score || a.seed - b.seed);
  return { ranked, failed };
}

/** Ids in a nested drawing, prefixed so the sheet's drawings cannot meet. */
const prefixed = (svg: string, p: string) => svg.replace(/ id="([^"]+)"/g, ` id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`);

/** A contact sheet of candidates: each drawn in a tile `tile` px across (no title, legend or scale bar), captioned with its seed and score. */
export function contactSheetSvg(cands: Pick<Candidate, 'seed' | 'score' | 'spec'>[], o: { tile?: number; cols?: number } = {}): string {
  const tile = o.tile ?? 360, cols = Math.max(1, Math.min(o.cols ?? 3, cands.length)), rows = Math.ceil(cands.length / cols), cap = 22, gap = 12;
  const W = cols * tile + (cols + 1) * gap, H = rows * (tile + cap) + (rows + 1) * gap;
  const layers = { title: false, legend: false, scale: false, compass: false } as const;
  let body = '';
  cands.forEach((c, i) => {
    const s = { ...c.spec, furniture: { place: 'over' as const } }, ppu = tile / Math.max(s.cols, s.rows), size = dungeonRenderSize(s, { ppu, layers });
    const x = gap + (i % cols) * (tile + gap), y = gap + Math.floor(i / cols) * (tile + cap + gap);
    const svg = prefixed(renderDungeonSvg(s, { ppu, layers }), `c${i}-`).replace(/^<svg ([^>]*?)width="[^"]*" height="[^"]*"/, (_m, pre: string) => `<svg ${pre}x="${n1(x + (tile - size.width) / 2)}" y="${n1(y + cap + (tile - size.height) / 2)}" width="${n1(size.width)}" height="${n1(size.height)}"`);
    body += `<text x="${n1(x)}" y="${n1(y + 15)}" font-size="14" font-weight="700">${esc(`seed ${c.seed} · ${c.score}`)}</text><rect x="${n1(x)}" y="${n1(y + cap)}" width="${tile}" height="${tile}" fill="none" stroke="#999" stroke-width="1"/>${svg}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}"><rect width="${W}" height="${H}" fill="#ffffff"/>${body}</svg>`;
}
