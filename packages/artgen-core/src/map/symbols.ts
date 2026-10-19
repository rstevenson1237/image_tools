/**
 * Map symbols, drawn in a 20 × 20 box centred on the origin. `{ink}` and `{fill}` are the theme's ink and symbol fill.
 * Simple, bold shapes so they read at a glance when the map is shown at table size.
 */

export const SYMBOLS: Record<string, { name: string; svg: string }> = {
  village: { name: 'Village', svg: '<circle r="3.2" fill="{ink}"/>' },
  town: { name: 'Town', svg: '<circle r="5.5" fill="{fill}" stroke="{ink}" stroke-width="1.6"/><circle r="2.2" fill="{ink}"/>' },
  city: { name: 'City', svg: '<rect x="-6.5" y="-6.5" width="13" height="13" fill="{fill}" stroke="{ink}" stroke-width="1.6"/><rect x="-3" y="-3" width="6" height="6" fill="{ink}"/>' },
  castle: { name: 'Castle', svg: '<path d="M-7 8V-3H-5V-6H-2.5V-3H-1V-6H1V-3H2.5V-6H5V-3H7V8Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-1.8 8V3A1.8 1.8 0 0 1 1.8 3V8" fill="{ink}"/>' },
  tower: { name: 'Tower', svg: '<path d="M-3.5 8.5L-2.5 -4.5H-4.5V-8.5H-2V-6.5H-0.7V-8.5H0.7V-6.5H2V-8.5H4.5V-4.5H2.5L3.5 8.5Z" fill="{fill}" stroke="{ink}" stroke-width="1.3" stroke-linejoin="round"/>' },
  ruin: { name: 'Ruin', svg: '<path d="M-7 8V-2A7 7 0 0 1 3 -6.3M7 8V0" fill="none" stroke="{ink}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="4 2.2"/><path d="M-8.5 8H8.5" stroke="{ink}" stroke-width="1.6"/>' },
  temple: { name: 'Temple', svg: '<path d="M-8 -2L0 -8L8 -2Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-5.5 -1V6M-2 -1V6M2 -1V6M5.5 -1V6M-8 7.5H8" stroke="{ink}" stroke-width="1.5"/>' },
  cave: { name: 'Cave', svg: '<path d="M-8 7Q-8 -7 0 -7Q8 -7 8 7Z" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-3.5 7Q-3.5 -1 0 -1Q3.5 -1 3.5 7Z" fill="{ink}"/>' },
  dungeon: { name: 'Dungeon', svg: '<rect x="-7" y="-7" width="14" height="14" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><path d="M-4 4H-1V1H2V-2H5" fill="none" stroke="{ink}" stroke-width="1.5"/>' },
  camp: { name: 'Camp', svg: '<path d="M-8 7L0 -7L8 7Z" fill="{fill}" stroke="{ink}" stroke-width="1.5" stroke-linejoin="round"/><path d="M0 -7V7M-2.5 7L0 2L2.5 7" fill="none" stroke="{ink}" stroke-width="1.3"/>' },
  port: { name: 'Port', svg: '<circle cy="-6" r="1.8" fill="none" stroke="{ink}" stroke-width="1.4"/><path d="M0 -4V7M-4 -1H4M-6.5 2.5Q-6 7 0 7Q6 7 6.5 2.5" fill="none" stroke="{ink}" stroke-width="1.6" stroke-linecap="round"/>' },
  bridge: { name: 'Bridge', svg: '<path d="M-7 -5Q-3 -2 -3 0Q-3 2 -7 5M7 -5Q3 -2 3 0Q3 2 7 5" fill="none" stroke="{ink}" stroke-width="1.8" stroke-linecap="round"/>' },
  battle: { name: 'Battle site', svg: '<path d="M-6.5 -6.5L6.5 6.5M6.5 -6.5L-6.5 6.5M-7 3.5L-3.5 7M7 3.5L3.5 7" stroke="{ink}" stroke-width="1.8" stroke-linecap="round"/>' },
  poi: { name: 'Point of interest', svg: '<path d="M0 -8L2.35 -3.2L7.6 -2.5L3.8 1.2L4.7 6.5L0 4L-4.7 6.5L-3.8 1.2L-7.6 -2.5L-2.35 -3.2Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/>' },
  mountain: { name: 'Mountain', svg: '<path d="M-9 7L-2 -7L2 0L4 -3L9 7Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-2 -7L-0.2 -1.5" stroke="{ink}" stroke-width="1.2"/>' },
  hill: { name: 'Hill', svg: '<path d="M-8 5Q0 -9 8 5" fill="{fill}" stroke="{ink}" stroke-width="1.5"/>' },
  tree: { name: 'Tree', svg: '<path d="M0 8V2" stroke="{ink}" stroke-width="1.6"/><circle cy="-2" r="5.5" fill="{fill}" stroke="{ink}" stroke-width="1.4"/>' },
  skull: { name: 'Danger', svg: '<path d="M-6 -1A6 6 0 1 1 6 -1V3H3V6H-3V3H-6Z" fill="{fill}" stroke="{ink}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="-2.4" cy="-1" r="1.6" fill="{ink}"/><circle cx="2.4" cy="-1" r="1.6" fill="{ink}"/>' },
  door: { name: 'Door / entrance', svg: '<rect x="-4.5" y="-7" width="9" height="14" fill="{fill}" stroke="{ink}" stroke-width="1.5"/><circle cx="2" cy="0.5" r="1" fill="{ink}"/>' },
  'cave-mouth': { name: 'Cave mouth (in a cliff, facing its angle)', svg: '<path d="M-3 -9.5V9.5" fill="none" stroke="{ink}" stroke-width="1.8" stroke-linecap="round"/><path d="M-3 -6A6 6 0 0 1 -3 6Z" fill="{ink}" stroke="{ink}" stroke-width="1" stroke-linejoin="round"/><path d="M-3 -3.4A3.4 3.4 0 0 1 -3 3.4Z" fill="{fill}"/>' },
  gate: { name: 'Gate (a break in a wall line)', svg: '<path d="M-9.5 0H-5M5 0H9.5" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="butt"/><rect x="-6" y="-3.2" width="3" height="6.4" fill="{fill}" stroke="{ink}" stroke-width="1.2"/><rect x="3" y="-3.2" width="3" height="6.4" fill="{fill}" stroke="{ink}" stroke-width="1.2"/><path d="M-3 0H3" stroke="{ink}" stroke-width="1" stroke-dasharray="1.4 1.2"/>' },
  treasure: { name: 'Treasure', svg: '<rect x="-7" y="-2" width="14" height="8" fill="{fill}" stroke="{ink}" stroke-width="1.4"/><path d="M-7 -2Q-7 -7 0 -7Q7 -7 7 -2M-1.5 -2V2H1.5V-2" fill="none" stroke="{ink}" stroke-width="1.4"/>' },
};

/** Symbols with a direction: `angle` turns them (degrees clockwise from east, as the dungeon symbols turn). */
export const DIRECTED = ['cave-mouth', 'gate'];

export const SYMBOL_KINDS = Object.keys(SYMBOLS);
