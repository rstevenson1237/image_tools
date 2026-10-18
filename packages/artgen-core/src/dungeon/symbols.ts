/**
 * Dungeon symbols, drawn in a 20 × 20 box centred on the origin (one grid cell at scale 1), black ink on white. A few
 * are shared with the terrain map set. Simple, bold shapes so they read at a glance; `angle` turns them on the map.
 */
import { SYMBOLS as MAP_SYMBOLS } from '../map/symbols.ts';

export const SYMBOLS: Record<string, { name: string; svg: string }> = {
  stairs: { name: 'Stairs (rise to the right)', svg: '<rect x="-9" y="-9" width="18" height="18" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-5.5 -9V9M-2 -9V9M1.5 -9V9M5 -9V9" stroke="{ink}" stroke-width="1.2"/>' },
  ladder: { name: 'Ladder / shaft', svg: '<circle r="8" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-3 -7V7M3 -7V7M-3 -3.5H3M-3 0H3M-3 3.5H3" stroke="{ink}" stroke-width="1.2"/>' },
  pillar: { name: 'Pillar', svg: '<circle r="5.5" fill="{ink}"/>' },
  statue: { name: 'Statue', svg: '<circle r="7" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M0 -4.5L1.3 -1.3L4.5 -1L2 1.2L2.8 4.5L0 2.8L-2.8 4.5L-2 1.2L-4.5 -1L-1.3 -1.3Z" fill="{ink}"/>' },
  altar: { name: 'Altar', svg: '<rect x="-8" y="-4.5" width="16" height="9" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><path d="M0 -2.5V2.5M-2.5 0H2.5" stroke="{ink}" stroke-width="1.3"/>' },
  chest: { name: 'Chest / treasure', svg: MAP_SYMBOLS.treasure.svg },
  trap: { name: 'Trap', svg: '<rect x="-7" y="-7" width="14" height="14" fill="none" stroke="{ink}" stroke-width="1.3" stroke-dasharray="2.4 1.6"/><path d="M-4 -4L4 4M4 -4L-4 4" stroke="{ink}" stroke-width="1.5" stroke-linecap="round"/>' },
  pit: { name: 'Pit', svg: '<rect x="-8" y="-8" width="16" height="16" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><path d="M-8 8L8 -8M-8 2L2 -8M-2 8L8 -2M-8 -4L-4 -8M4 8L8 4" stroke="{ink}" stroke-width="1"/>' },
  pool: { name: 'Pool / well', svg: '<circle r="7.5" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><circle r="4.5" fill="none" stroke="{ink}" stroke-width="0.9"/><path d="M-2.5 0q1.25 -1.2 2.5 0t2.5 0" fill="none" stroke="{ink}" stroke-width="0.9"/>' },
  fountain: { name: 'Fountain', svg: '<circle r="8.5" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><circle r="2.5" fill="{ink}"/><path d="M0 -6.5V-4M0 4V6.5M-6.5 0H-4M4 0H6.5" stroke="{ink}" stroke-width="1"/>' },
  rubble: { name: 'Rubble', svg: '<path d="M-8 3L-5 0L-2 2.5L-4 6ZM1 -6L5 -7L6 -3L2 -2ZM2 3L6 2L7.5 6L3 7ZM-6 -6L-3 -7L-3 -3Z" fill="{ink}"/>' },
  throne: { name: 'Throne', svg: '<path d="M-6 8V-8H6V8M-6 0H6" fill="{fill}" stroke="{ink}" stroke-width="1.5" stroke-linejoin="round"/><path d="M-6 -8L-3.5 -5L0 -8L3.5 -5L6 -8" fill="none" stroke="{ink}" stroke-width="1.2"/>' },
  bed: { name: 'Bed', svg: '<rect x="-5" y="-8.5" width="10" height="17" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><rect x="-3.5" y="-7" width="7" height="3.5" fill="none" stroke="{ink}" stroke-width="1"/><path d="M-5 -1.5H5" stroke="{ink}" stroke-width="1"/>' },
  table: { name: 'Table', svg: '<rect x="-8" y="-5" width="16" height="10" fill="{fill}" stroke="{ink}" stroke-width="1.5"/>' },
  coffin: { name: 'Coffin / sarcophagus', svg: '<path d="M-3 -9H3L5 -4L3.5 9H-3.5L-5 -4Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M0 -5V3M-2.5 -2.5H2.5" stroke="{ink}" stroke-width="1.1"/>' },
  barrel: { name: 'Barrel', svg: '<circle r="6" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><circle r="3.4" fill="none" stroke="{ink}" stroke-width="0.9"/>' },
  crate: { name: 'Crate', svg: '<rect x="-6" y="-6" width="12" height="12" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-6 -6L6 6" stroke="{ink}" stroke-width="1.1"/>' },
  fire: { name: 'Brazier / fire', svg: '<circle r="7" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M0 -5Q4 -1 2.5 3Q1.5 5 0 5Q-1.5 5 -2.5 3Q-4 -1 0 -5Z" fill="{ink}"/>' },
  web: { name: 'Web', svg: '<path d="M-9 -9L9 9M9 -9L-9 9M0 -9V9M-9 0H9" stroke="{ink}" stroke-width="0.7"/><path d="M-3 -3Q0 -1.6 3 -3Q1.6 0 3 3Q0 1.6 -3 3Q-1.6 0 -3 -3ZM-6 -6Q0 -3.6 6 -6Q3.6 0 6 6Q0 3.6 -6 6Q-3.6 0 -6 -6Z" fill="none" stroke="{ink}" stroke-width="0.7"/>' },
  bones: { name: 'Bones', svg: '<path d="M-6 -6L6 6M6 -6L-6 6" stroke="{ink}" stroke-width="2.2" stroke-linecap="round"/><circle cx="-6.5" cy="-6.5" r="1.8" fill="{ink}"/><circle cx="6.5" cy="-6.5" r="1.8" fill="{ink}"/><circle cx="-6.5" cy="6.5" r="1.8" fill="{ink}"/><circle cx="6.5" cy="6.5" r="1.8" fill="{ink}"/>' },
  skull: { name: 'Danger', svg: MAP_SYMBOLS.skull.svg },
  door: { name: 'Door (free-standing)', svg: '<rect x="-7" y="-2.5" width="14" height="5" fill="{fill}" stroke="{ink}" stroke-width="1.5"/>' },
  arrow: { name: 'Arrow (way on)', svg: '<path d="M-8 0H5M1 -5L7 0L1 5" fill="none" stroke="{ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
};

export const SYMBOL_KINDS = Object.keys(SYMBOLS);
