/**
 * The artlab parity benchmark (PLAN P1): artlab's six best finals ported as asset modules, their briefs, the
 * review settings artlab used, and the scores they must be matched by (P1b gate).
 */
import type { Direction } from '../src/direction.ts';
import type { AssetModule, Brief } from '../src/render.ts';
import benchmarkDir from './directions/benchmark.json' with { type: 'json' };
import altDir from './directions/alt.json' with { type: 'json' };
import * as hero from './assets/hero.js';
import * as ship from './assets/ship.js';
import * as tank from './assets/tank.js';
import * as isohero from './assets/isohero.js';
import * as isospider from './assets/isospider.js';
import * as isochest from './assets/isochest.js';

export interface BenchAsset {
  id: string;
  /** Source file name under bench/assets/. */
  file: string;
  module: AssetModule;
  brief: Brief;
  review: { scale: number; bg: string; iso?: boolean; sym: 'x' | 'y' | 'none'; label: string };
  /** artlab's final this ports, and its visual score (the P1b target). */
  artlab: { tech: string; ver: string; score: number };
}

export const BENCH_ASSETS: BenchAsset[] = [
  { id: 'hero', file: 'hero.js', module: hero, brief: { id: 'hero', kind: 'character', view: 'topdown', size: 'character' },
    review: { scale: 8, bg: '#4f8a3c', sym: 'x', label: 'Fantasy hero 32x32 (RPG)' }, artlab: { tech: 't1', ver: 'v2', score: 7.5 } },
  { id: 'ship', file: 'ship.js', module: ship, brief: { id: 'ship', kind: 'vehicle', view: 'topdown', size: 'ship' },
    review: { scale: 4, bg: '#24527a', sym: 'y', label: 'WWII battleship 160x41 (naval sim)' }, artlab: { tech: 't3', ver: 'v3', score: 7.5 } },
  { id: 'tank', file: 'tank.js', module: tank, brief: { id: 'tank', kind: 'vehicle', view: 'topdown', size: 'vehicle' },
    review: { scale: 5, bg: '#6b5a45', sym: 'x', label: 'Sci-fi tank 64x64 (RTS)' }, artlab: { tech: 't3', ver: 'v3', score: 7.5 } },
  { id: 'isohero', file: 'isohero.js', module: isohero, brief: { id: 'isohero', kind: 'character', view: 'iso', size: 'tall' },
    review: { scale: 6, bg: '#2a2630', iso: true, sym: 'x', label: 'Iso hero 32x48 (roguelike)' }, artlab: { tech: 't1', ver: 'v1', score: 7 } },
  { id: 'isospider', file: 'isospider.js', module: isospider, brief: { id: 'isospider', kind: 'creature', view: 'iso', size: 'creature' },
    review: { scale: 6, bg: '#2a2630', iso: true, sym: 'x', label: 'Iso creature: cave spider 32x32' }, artlab: { tech: 't3', ver: 'v1', score: 7 } },
  { id: 'isochest', file: 'isochest.js', module: isochest, brief: { id: 'isochest', kind: 'prop', view: 'iso', size: 'prop', states: ['closed', 'open'] },
    review: { scale: 6, bg: '#2a2630', iso: true, sym: 'none', label: 'Iso feature: chest closed|open 64x32' }, artlab: { tech: 't4', ver: 'v1', score: 7 } },
];

export const BENCH_DIRECTIONS: Record<string, Direction> = {
  benchmark: benchmarkDir as unknown as Direction,
  alt: altDir as unknown as Direction,
};
