/**
 * W1 art direction (SPEC §4.2): turn an interview into three meaningfully different `direction.json` drafts,
 * mix parts of candidates ("A's palette, B's outlines") and lock one. Pure data in, data out — the CLI does the I/O.
 *
 * Every generated direction has the same **role ramps** (`ROLES`), so the probe set and asset templates can
 * reference roles (`pal.cloth`, `mat: 'metal'`) and render under any candidate without edits (R11).
 */
import { normHex, toHsl, fromHsl, lumaOf } from '../lib/color.ts';
import { generateRamp } from '../lib/palette.ts';
import { hashString } from '../lib/rng.ts';
import { parseDirection, type Direction, type Size, type View } from '../direction.ts';

/** Ramp names every generated direction defines; templates use these. */
export const ROLES = ['skin', 'hair', 'cloth', 'leather', 'metal', 'wood', 'stone', 'dirt', 'grass', 'accent', 'glow'] as const;
export type Role = (typeof ROLES)[number];

/** Probe kinds rendered on a style tile, in column order. */
export const PROBE_KINDS = ['character', 'prop', 'tile', 'effect'] as const;

export interface Interview {
  /** The one-paragraph game pitch. */
  pitch: string;
  /** Direction id stem (default: from the pitch). */
  id?: string;
  genre?: string;
  view?: View;
  mood?: string[];
  era?: string;
  /** Sprite scale preset or explicit sizes per kind. */
  scale?: 'small' | 'medium' | 'large' | Record<string, number | Size>;
  /** Facings the game needs. */
  directions?: 1 | 4 | 8 | 16;
  /** Upper bound on palette size. */
  maxColors?: number;
  /** Colours to build candidate A's ramps from (Lospec import or extracted from `art/refs/`). */
  colors?: string[];
  /** Background colour of the game (style tiles show probes on it). Default: derived from the ground ramps. */
  background?: string;
  notes?: string;
  rules?: { do?: string[]; dont?: string[] };
}

interface Hsl { h: number; s: number; l: number }

/** Mood / setting words → key (dominant) and accent hues, ground and growth (grass, moss, frost, embers). First match wins per slot. */
const WORDS: [RegExp, Partial<{ key: Hsl; accent: Hsl; ground: Hsl; growth: Hsl; sat: number; light: number }>][] = [
  [/swamp|bog|marsh|rot|toxic|poison/, { key: { h: 95, s: 0.32, l: 0.36 }, accent: { h: 40, s: 0.85, l: 0.55 }, ground: { h: 55, s: 0.25, l: 0.3 }, growth: { h: 85, s: 0.35, l: 0.36 } }],
  [/forest|wood|druid|nature|elf/, { key: { h: 110, s: 0.42, l: 0.38 }, accent: { h: 48, s: 0.8, l: 0.58 }, ground: { h: 30, s: 0.35, l: 0.32 }, growth: { h: 110, s: 0.45, l: 0.4 } }],
  [/desert|sand|dune|egypt|canyon/, { key: { h: 36, s: 0.55, l: 0.58 }, accent: { h: 190, s: 0.6, l: 0.48 }, ground: { h: 38, s: 0.5, l: 0.62 }, growth: { h: 70, s: 0.3, l: 0.45 } }],
  [/ice|snow|frost|winter|arctic/, { key: { h: 205, s: 0.4, l: 0.7 }, accent: { h: 12, s: 0.75, l: 0.55 }, ground: { h: 205, s: 0.25, l: 0.8 }, growth: { h: 190, s: 0.25, l: 0.62 } }],
  [/fire|lava|volcan|hell|ember|forge/, { key: { h: 12, s: 0.6, l: 0.38 }, accent: { h: 45, s: 0.95, l: 0.58 }, ground: { h: 15, s: 0.12, l: 0.24 }, growth: { h: 20, s: 0.85, l: 0.48 } }],
  [/ocean|sea|naval|pirate|beach|island/, { key: { h: 200, s: 0.5, l: 0.45 }, accent: { h: 35, s: 0.8, l: 0.6 }, ground: { h: 42, s: 0.45, l: 0.66 }, growth: { h: 120, s: 0.35, l: 0.42 } }],
  [/dungeon|crypt|cave|catacomb|tomb/, { key: { h: 260, s: 0.16, l: 0.32 }, accent: { h: 30, s: 0.85, l: 0.55 }, ground: { h: 250, s: 0.08, l: 0.32 }, growth: { h: 100, s: 0.22, l: 0.32 } }],
  [/space|sci-?fi|cyber|neon|robot|mech/, { key: { h: 230, s: 0.35, l: 0.3 }, accent: { h: 175, s: 0.85, l: 0.55 }, ground: { h: 225, s: 0.12, l: 0.3 }, growth: { h: 180, s: 0.45, l: 0.4 } }],
  [/night|moon|vampire|gothic|haunt|ghost/, { key: { h: 250, s: 0.3, l: 0.3 }, accent: { h: 330, s: 0.6, l: 0.6 }, ground: { h: 240, s: 0.15, l: 0.26 }, growth: { h: 150, s: 0.2, l: 0.3 } }],
  [/candy|cute|cozy|farm|cheer|pastel/, { key: { h: 100, s: 0.5, l: 0.62 }, accent: { h: 340, s: 0.7, l: 0.7 }, ground: { h: 30, s: 0.4, l: 0.48 }, growth: { h: 100, s: 0.55, l: 0.52 } }],
  [/steampunk|brass|industrial|clockwork/, { key: { h: 30, s: 0.35, l: 0.35 }, accent: { h: 45, s: 0.75, l: 0.55 } }],
  [/war|military|wwii|tank|army/, { key: { h: 75, s: 0.22, l: 0.4 }, accent: { h: 5, s: 0.6, l: 0.48 } }],
  [/grim|dark|bleak|eerie|horror|dread/, { sat: 0.7, light: 0.85 }],
  [/bright|vivid|bold|arcade|colou?rful/, { sat: 1.3, light: 1.05 }],
  [/muted|damp|dusty|faded|washed|grey|gray/, { sat: 0.65 }],
];

export interface MoodProfile { key: Hsl; accent: Hsl; ground?: Hsl; growth?: Hsl; sat: number; light: number }

/** Read the pitch + mood words into a key hue, an accent hue and global saturation/lightness factors. */
export function moodProfile(iv: Pick<Interview, 'pitch' | 'mood' | 'genre' | 'era'>): MoodProfile {
  const text = [iv.pitch, iv.genre ?? '', iv.era ?? '', ...(iv.mood ?? [])].join(' ').toLowerCase();
  let key: Hsl | undefined, accent: Hsl | undefined, ground: Hsl | undefined, growth: Hsl | undefined, sat = 1, light = 1;
  for (const [re, v] of WORDS) if (re.test(text)) {
    if (v.key && !key) key = v.key;
    if (v.accent && !accent) accent = v.accent;
    if (v.ground && !ground) ground = v.ground;
    if (v.growth && !growth) growth = v.growth;
    if (v.sat) sat *= v.sat;
    if (v.light) light *= v.light;
  }
  const h = hashString(text);
  const hue = parseInt(h.slice(0, 4), 16) % 360;
  key ??= { h: hue, s: 0.4, l: 0.42 };
  accent ??= { h: (key.h + 150 + (parseInt(h.slice(4, 6), 16) % 60)) % 360, s: 0.8, l: 0.58 };
  return { key, accent, ground, growth, sat: Math.min(1.5, sat), light: Math.min(1.2, light) };
}

/**
 * Base colour per role for a mood: materials keep their natural hue but lean toward the key hue by `unify`
 * (0 = natural colours, 1 = everything in the key's family); `keyShift` rotates the key/accent family.
 */
function roleBases(m: MoodProfile, a: Pick<Archetype, 'satK' | 'keyShift' | 'lightK' | 'unify'>): Record<Role, Hsl> {
  const kh = (m.key.h + a.keyShift + 360) % 360, ah = (m.accent.h + a.keyShift * 0.5 + 360) % 360;
  const S = (s: number) => Math.min(1, s * m.sat * a.satK), L = (l: number) => Math.max(0.1, Math.min(0.88, l * m.light * a.lightK));
  const lean = (h: number, amt: number) => (h + (((kh - h + 540) % 360) - 180) * Math.min(1, amt * a.unify) + 360) % 360;
  return {
    skin: { h: lean(24, 0.1), s: S(0.5), l: L(0.62) },
    hair: { h: lean(28, 0.2), s: S(0.35), l: L(0.3) },
    cloth: { h: kh, s: S(Math.max(0.38, m.key.s)), l: L(0.44) },
    leather: { h: lean(25, 0.2), s: S(0.38), l: L(0.36) },
    metal: { h: lean(215, 0.3), s: S(0.12), l: L(0.62) },
    wood: { h: lean(30, 0.2), s: S(0.42), l: L(0.42) },
    stone: { h: lean(230, 0.4), s: S(0.12), l: L(0.5) },
    // the setting's ground and growth move only a quarter as far with the candidate's family rotation
    dirt: m.ground ? { h: (m.ground.h + a.keyShift * 0.25 + 360) % 360, s: S(m.ground.s), l: L(m.ground.l) } : { h: lean(32, 0.3), s: S(0.3), l: L(0.36) },
    grass: m.growth ? { h: (m.growth.h + a.keyShift * 0.25 + 360) % 360, s: S(m.growth.s), l: L(m.growth.l) } : { h: lean(100, 0.4), s: S(0.45), l: L(0.42) },
    accent: { h: ah, s: Math.min(1, m.accent.s * Math.max(0.7, a.satK)), l: L(m.accent.l) },
    glow: { h: (ah + 12) % 360, s: Math.min(1, m.accent.s * Math.max(0.7, a.satK) + 0.1), l: Math.min(0.85, L(m.accent.l) + 0.18) },
  };
}

/** Assign the closest supplied colour (hue first, then lightness) to each role base; unmatched roles keep theirs. */
export function rolesFromColors(colors: string[], bases: Record<Role, Hsl>): Record<Role, Hsl> {
  const cs = [...new Set(colors.map(normHex))].map(c => ({ c, ...toHsl(c) }));
  if (!cs.length) return bases;
  const out = { ...bases };
  for (const r of ROLES) {
    const b = bases[r];
    let best = cs[0], bd = Infinity;
    for (const x of cs) {
      const dh = Math.abs(((x.h - b.h + 540) % 360) - 180) / 180, grey = x.s < 0.12 || b.s < 0.12;
      const d = (grey ? 0.3 : 1) * dh * dh * 4 + (x.s - b.s) ** 2 + (x.l - b.l) ** 2 * 1.5;
      if (d < bd) { bd = d; best = x; }
    }
    out[r] = { h: best.h, s: best.s, l: Math.max(0.2, Math.min(0.75, best.l)) };
  }
  return out;
}

interface Archetype {
  key: 'a' | 'b' | 'c';
  name: string;
  summary: string;
  satK: number;
  keyShift: number;
  /** Lightness factor: the candidate's overall value key. */
  lightK: number;
  /** How far materials lean into the key hue family (0–1+). */
  unify: number;
  steps: number;
  contrast: number;
  hueShift: number;
  line: Direction['line'];
  shading: Pick<Direction['shading'], 'bands' | 'dither' | 'highlight'>;
  headRatio: number;
  detail: Direction['detail']['density'];
  procedural: string[];
}

/** The three candidate archetypes: they differ in palette family, outline style, shading and proportions (§4.2). */
const ARCHETYPES: Archetype[] = [
  { key: 'a', name: 'faithful', summary: 'palette true to the pitch, dark outline, 3 bands, no dither, classic proportions',
    satK: 1, keyShift: 0, lightK: 1, unify: 0.6, steps: 3, contrast: 0.45, hueShift: 12, line: { outer: 'dark', inner: 'selective', weight: 1 },
    shading: { bands: 3, dither: 'none', highlight: 'sparing' }, headRatio: 0.4, detail: 'medium', procedural: [] },
  { key: 'b', name: 'bold', summary: 'saturated, brighter and hue-rotated, coloured selective outline (selout), 4 bands, strong hue shift, chunky heads',
    satK: 1.7, keyShift: 40, lightK: 1.12, unify: 0.3, steps: 4, contrast: 0.58, hueShift: 22, line: { outer: 'selout', inner: 'selective', weight: 1 },
    shading: { bands: 4, dither: 'none', highlight: 'rich' }, headRatio: 0.5, detail: 'high', procedural: ['rimLight'] },
  { key: 'c', name: 'muted', summary: 'darker, desaturated near-duotone in a cooler family, dark outline without inner lines, 2 bands with ordered dither, slim figures',
    satK: 0.6, keyShift: -70, lightK: 0.8, unify: 1.6, steps: 3, contrast: 0.36, hueShift: 6, line: { outer: 'dark', inner: 'none', weight: 1 },
    shading: { bands: 2, dither: 'bayer2', highlight: 'none' }, headRatio: 0.32, detail: 'low', procedural: ['dither'] },
];

type ScaleSet = Record<string, number | Size>;
const SCALES: Record<string, { default: ScaleSet; iso: ScaleSet }> = {
  small: { default: { character: [16, 16], prop: [16, 16], tile: 16, effect: [16, 16], large: [32, 32] },
    iso: { character: [16, 24], prop: [24, 24], tile: [32, 16], effect: [16, 16], large: [32, 32] } },
  medium: { default: { character: [24, 24], prop: [24, 24], tile: 16, effect: [24, 24], large: [48, 48] },
    iso: { character: [24, 32], prop: [32, 32], tile: [32, 16], effect: [24, 24], large: [48, 48] } },
  large: { default: { character: [32, 32], prop: [32, 32], tile: 32, effect: [32, 32], large: [64, 64] },
    iso: { character: [32, 48], prop: [48, 48], tile: [64, 32], effect: [32, 32], large: [64, 64] } },
};

/** Which roles each probe kind may use (`palette.perKind`). */
export const PER_KIND: Record<string, Role[]> = {
  character: ['skin', 'hair', 'cloth', 'leather', 'metal', 'accent'],
  creature: ['skin', 'hair', 'cloth', 'leather', 'grass', 'accent'],
  prop: ['wood', 'metal', 'stone', 'leather', 'accent'],
  tile: ['dirt', 'grass', 'stone'],
  effect: ['accent', 'glow'],
};

const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'in', 'on', 'with', 'to', 'through', 'for', 'game', 'where', 'who', 'you', 'your', 'is', 'are', 'set']);
/** Direction id from a pitch: the first three meaningful words (`grim-swamp-roguelike`). */
export const slug = (s: string): string =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)).slice(0, 3).join('-') || 'game';

/** Build one candidate from an interview and an archetype. */
function candidate(iv: Interview, arch: Archetype, index: number): Direction {
  const m = moodProfile(iv);
  let bases = roleBases(m, arch);
  // candidate A takes supplied colours (imported or extracted palette) as its role bases
  if (iv.colors?.length && index === 0) bases = rolesFromColors(iv.colors, bases);
  const ramps: Record<string, string[]> = {};
  for (const r of ROLES) ramps[r] = generateRamp(fromHsl(bases[r]), { steps: r === 'glow' ? 2 : arch.steps, hueShift: arch.hueShift, contrast: r === 'glow' ? 0.25 : arch.contrast });
  const key = bases.cloth, outline = fromHsl({ h: (key.h + 330) % 360, s: Math.min(0.5, key.s * 0.8), l: 0.08 });
  const shadow = fromHsl({ h: (key.h + 330) % 360, s: 0.4, l: 0.06 });
  const view = iv.view ?? 'topdown';
  const scalePreset = typeof iv.scale === 'object' ? null : SCALES[iv.scale ?? 'medium'];
  const scale: Direction['scale'] = scalePreset ? { ...(view === 'iso' ? scalePreset.iso : scalePreset.default) } : { ...(iv.scale as Record<string, number | Size>) };
  scale.proportions = { headRatio: arch.headRatio };
  const perKindMax: Record<string, number> = {};
  for (const [k, roles] of Object.entries(PER_KIND)) perKindMax[k] = roles.reduce((n, r) => n + ramps[r].length, 0) + 1;
  const n = new Set(Object.values(ramps).flat()).size;
  const id = `${iv.id ?? slug(iv.pitch.split(/[.:;]/)[0])}-${arch.key}`;
  return parseDirection({
    id, version: 1, status: 'candidate',
    theme: { pitch: iv.pitch, mood: iv.mood ?? [], era: iv.era, notes: `candidate ${arch.key.toUpperCase()} (${arch.name}): ${arch.summary}${iv.notes ? `. ${iv.notes}` : ''}` },
    camera: { view, ...(view === 'iso' && { iso: { tile: [32, 16] } }), ...(view === 'oblique' && { oblique: { frontRatio: 0.5 } }), light: [-1, -1, 1], directions: iv.directions ?? 8, pixelScale: 3 },
    scale,
    palette: {
      source: iv.colors?.length && index === 0 ? 'imported' : 'generated', maxColors: Math.max(iv.maxColors ?? 0, n),
      ramps, outline, shadow: { color: shadow, alpha: 0.35 },
      materials: { cloth: 'cloth', skin: 'skin', hair: 'hair', leather: 'leather', metal: 'metal', steel: 'metal', wood: 'wood', stone: 'stone', dirt: 'dirt', ground: 'dirt', grass: 'grass', foliage: 'grass', accent: 'accent', gold: 'accent', glow: 'glow', fx: 'glow' },
      perKind: PER_KIND, perKindMax,
    },
    line: arch.line,
    shading: { ...arch.shading, hueShift: arch.hueShift, aa: false },
    detail: { density: arch.detail, minFeaturePx: 2 },
    pipeline: { revisionPasses: 3, finishPass: true, raster: { directMaxPx: 32, ss: 8 }, procedural: arch.procedural, finish: { allow: ['patch', 'fix', 'fx', 'light', 'outline'] } },
    effects: { fps: 12, maxFrames: 8, palette: ['glow', 'accent'] },
    background: iv.background ?? fromHsl({ ...bases.dirt, l: Math.max(0.12, bases.dirt.l * 0.55), s: bases.dirt.s * 0.7 }),
    anchors: [],
    rules: { do: iv.rules?.do ?? [], dont: iv.rules?.dont ?? [] },
  });
}

/** Three drafts (A faithful, B bold, C muted) that differ in palette family, outline style, shading and proportions. */
export function generateCandidates(iv: Interview): Direction[] {
  if (!iv.pitch?.trim()) throw new Error('interview.pitch is required');
  return ARCHETYPES.map((a, i) => candidate(iv, a, i));
}

/** Parts a mix can take from a candidate. */
export const MIX_PARTS = ['palette', 'line', 'shading', 'scale', 'detail', 'camera', 'theme', 'pipeline', 'effects', 'rules'] as const;
export type MixPart = (typeof MIX_PARTS)[number];

/**
 * Mix candidates: start from `base` and take each named part from another candidate
 * (`{ palette: A, line: B }` = "A's palette, B's outlines"). The result is a new draft candidate.
 */
export function mixDirections(base: Direction, take: Partial<Record<MixPart, Direction>>, id?: string): Direction {
  const out = JSON.parse(JSON.stringify(base)) as Direction & Record<string, unknown>;
  const from: string[] = [];
  for (const [part, src] of Object.entries(take) as [MixPart, Direction][]) {
    if (!MIX_PARTS.includes(part)) throw new Error(`mix: unknown part ${part} (have: ${MIX_PARTS.join(', ')})`);
    (out as Record<string, unknown>)[part] = JSON.parse(JSON.stringify(src[part]));
    from.push(`${part} from ${src.id}`);
    if (part === 'palette') (out as Record<string, unknown>).background = (src as Direction & { background?: string }).background;
  }
  // shading bands above the ramp length can't be shown; keep them consistent with the palette taken
  const minRamp = Math.min(...Object.values(out.palette.ramps).filter(r => r.length > 2).map(r => r.length));
  if (out.shading.bands > minRamp) out.shading.bands = minRamp;
  out.id = id ?? `${base.id.replace(/-[a-z]$/, '')}-mix`;
  out.status = 'candidate';
  out.theme = { ...out.theme, notes: `mix of ${base.id}${from.length ? `: ${from.join(', ')}` : ''}` };
  return parseDirection(out);
}

/** Lock a chosen candidate: status `locked`, version = previous locked version + 1 (or 1), id without the candidate suffix. */
export function lockDirection(chosen: Direction, prev?: Direction | null, id?: string): Direction {
  const d = JSON.parse(JSON.stringify(chosen)) as Direction;
  d.id = id ?? prev?.id ?? d.id.replace(/-(a|b|c|mix\d*)$/, '');
  d.version = prev && prev.status === 'locked' ? prev.version + 1 : 1;
  d.status = 'locked';
  return parseDirection(d);
}

/** Short human summary of what makes a direction distinct (style tile column header). */
export function describeDirection(d: Direction): string[] {
  const ramps = Object.keys(d.palette.ramps).length, colors = new Set(Object.values(d.palette.ramps).flat()).size;
  const lum = Object.values(d.palette.ramps).flat().map(lumaOf), avg = lum.reduce((a, b) => a + b, 0) / (lum.length || 1);
  return [
    `${colors} colours, ${ramps} ramps, mean luma ${Math.round(avg)}`,
    `line ${d.line.outer}/${d.line.inner}, bands ${d.shading.bands}, dither ${d.shading.dither}`,
    `hue shift ${d.shading.hueShift}, head ${(d.scale.proportions as Record<string, number> | undefined)?.headRatio ?? '-'}`,
  ];
}
