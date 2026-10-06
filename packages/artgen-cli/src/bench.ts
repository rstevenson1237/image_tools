/**
 * `artgen bench`: render the artlab parity benchmark under a direction, run conformance, and write review
 * sheets, a comparison sheet, stage dumps and ledger records.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  assembleSheet, conformance, contactSheet, Grid, imageTokens, iso, parseDirection, renderAsset, resolveSize,
  reviewSheet, sourceHash, type ConformanceReport, type Direction, type RenderResult,
} from 'artgen-core';
import { BENCH_ASSETS, BENCH_DIRECTIONS, type BenchAsset } from 'artgen-core/bench';
import { appendLedger, initNodeSvg, readGrid, writeGrid } from './node.ts';

export const BENCH_ROOT = fileURLToPath(new URL('../../artgen-core/bench/', import.meta.url));
export const GOLDEN_PATH = join(BENCH_ROOT, 'golden.json');

export interface BenchResult {
  asset: BenchAsset;
  render: RenderResult;
  /** All cells side by side (the chest's closed|open pair, like artlab's 64×32 sheet). */
  strip: Grid;
  hash: string;
  report: ConformanceReport;
  /** Differing pixels vs artlab's PNG (benchmark direction only). */
  referenceDiff?: number;
}

export function benchSource(a: BenchAsset): string {
  return readFileSync(join(BENCH_ROOT, 'assets', a.file), 'utf8');
}

/** Side-by-side strip of every cell of a render. */
export function strip(r: RenderResult): Grid {
  const g = new Grid(r.size[0] * r.cells.length, r.size[1]);
  r.cells.forEach((c, i) => g.blit(c.grid, i * r.size[0], 0));
  return g;
}

export function resolveDirection(name: string): Direction {
  if (BENCH_DIRECTIONS[name]) return parseDirection(BENCH_DIRECTIONS[name]);
  return parseDirection(JSON.parse(readFileSync(name, 'utf8')));
}

/** Render + check every benchmark asset (no file output). */
export async function runBench(dir: Direction, opts: { stages?: Map<string, Grid>; only?: string[] } = {}): Promise<BenchResult[]> {
  await initNodeSvg();
  const out: BenchResult[] = [];
  for (const asset of BENCH_ASSETS) {
    if (opts.only && !opts.only.includes(asset.id)) continue;
    const stages = opts.stages ? new Map<string, Grid>() : undefined;
    const render = renderAsset(asset.module, { dir, brief: asset.brief, stages });
    if (stages) for (const [k, g] of stages) opts.stages!.set(`${asset.id}/${k}`, g);
    const s = strip(render);
    const report = conformance({
      frames: render.cells.map(c => c.grid), dir, kind: asset.brief.kind, size: resolveSize(dir, asset.brief.size, asset.brief.kind),
      source: benchSource(asset), symAxis: asset.review.sym,
    });
    const ref = join(BENCH_ROOT, 'reference', `${asset.id}.png`);
    const referenceDiff = dir.id === BENCH_DIRECTIONS.benchmark.id && existsSync(ref) ? s.diffCount(readGrid(ref)) : undefined;
    out.push({ asset, render, strip: s, hash: s.hash(), report, referenceDiff });
  }
  return out;
}

const fmt = (r: ConformanceReport) => r.checks.map(c => `${c.id}:${c.status}`).join(' ');

/** Write PNGs, review sheets, comparison and parity sheets, conformance.json and ledger lines. */
export async function writeBench(dir: Direction, outDir: string, { stages = false, ledger }: { stages?: boolean; ledger?: string } = {}) {
  const stageMap = stages ? new Map<string, Grid>() : undefined;
  const results = await runBench(dir, { stages: stageMap });
  const root = join(outDir, dir.id);
  for (const r of results) {
    const { asset } = r, A = asset.review, context = A.iso ? iso.isoFloor(r.strip.w, r.strip.h) : undefined;
    writeGrid(join(root, `${asset.id}.png`), r.strip);
    writeGrid(join(root, `${asset.id}@${A.scale}x.png`), r.strip.scale(A.scale));
    writeGrid(join(root, `${asset.id}-sheet.png`), assembleSheet(r.render).grid);
    const m = r.report.metrics, rows = [{
      label: `${asset.id} ${dir.id} | hyg ${m.hygiene} col ${m.colors} orph ${m.orphanPct}% outl ${m.outlinePct}% | gate ${r.report.pass ? 'pass' : 'FAIL'}`,
      grid: r.strip, scale: A.scale, bg: A.bg, context,
    }];
    const refPath = join(BENCH_ROOT, 'reference', `${asset.id}.png`);
    if (existsSync(refPath)) rows.unshift({ label: `artlab ${asset.artlab.tech} ${asset.artlab.ver} (scored ${asset.artlab.score})`, grid: readGrid(refPath), scale: A.scale, bg: A.bg, context });
    const sheet = reviewSheet({ title: A.label, rows });
    const sheetPath = join(root, `review-${asset.id}.png`);
    writeGrid(sheetPath, sheet);
    if (ledger) appendLedger(ledger, {
      type: 'render', asset: asset.id, version: asset.file, sourceHash: sourceHash(benchSource(asset)), outputHash: r.hash,
      direction: { id: dir.id, version: dir.version }, metrics: m, conformance: { pass: r.report.pass, checks: r.report.checks },
      sheet: sheetPath, imageTokens: imageTokens(sheet.w, sheet.h), by: 'agent',
    });
  }
  const items = results.map(r => ({ label: `${r.asset.id} ${r.report.pass ? 'ok' : 'FAIL'}`, grid: r.strip, bg: r.asset.review.bg, context: r.asset.review.iso ? iso.isoFloor(r.strip.w, r.strip.h) : undefined }));
  writeGrid(join(root, 'comparison.png'), contactSheet(`artlab benchmark under ${dir.id}`, items, 4, 3));
  const pairs = results.flatMap(r => {
    const ref = join(BENCH_ROOT, 'reference', `${r.asset.id}.png`), context = r.asset.review.iso ? iso.isoFloor(r.strip.w, r.strip.h) : undefined;
    return r.referenceDiff === undefined ? [] : [
      { label: `${r.asset.id} artlab ${r.asset.artlab.score}`, grid: readGrid(ref), bg: r.asset.review.bg, context },
      { label: `${r.asset.id} port ${r.referenceDiff}px diff`, grid: r.strip, bg: r.asset.review.bg, context },
    ];
  });
  if (pairs.length) writeGrid(join(root, 'parity.png'), contactSheet('artlab final (left) vs artgen-core port (right)', pairs, 4, 4));
  if (stageMap) for (const [k, g] of stageMap) writeGrid(join(root, 'stages', `${k.replace(/\//g, '_')}.png`), g);
  writeFileSync(join(root, 'conformance.json'), JSON.stringify(Object.fromEntries(results.map(r => [r.asset.id, {
    hash: r.hash, referenceDiff: r.referenceDiff, pass: r.report.pass, checks: r.report.checks, metrics: r.report.metrics,
  }])), null, 2) + '\n');
  for (const r of results) console.log(`${r.asset.id.padEnd(10)} ${r.hash} ${r.report.pass ? 'PASS' : 'FAIL'}  ${fmt(r.report)}${r.referenceDiff !== undefined ? `  artlab-diff ${r.referenceDiff}px` : ''}`);
  return results;
}

/** Recompute the golden hashes for every bench direction. */
export async function updateGolden(): Promise<Record<string, Record<string, string>>> {
  const golden: Record<string, Record<string, string>> = {};
  for (const name of Object.keys(BENCH_DIRECTIONS)) {
    golden[name] = Object.fromEntries((await runBench(resolveDirection(name))).map(r => [r.asset.id, r.hash]));
  }
  writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 2) + '\n');
  return golden;
}
