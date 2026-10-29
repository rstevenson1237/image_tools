/** Colour parsing and conversion. Colours travel as strings: `#rrggbb`, `#rrggbbaa` or `rgba(r,g,b,a)`. */

export type RGBA = readonly [number, number, number, number];

const cache = new Map<string, RGBA>();

/** Parse a colour string to [r, g, b, a] (0–255). Throws on anything it can't read. */
export function parseColor(c: string): RGBA {
  const hit = cache.get(c);
  if (hit) return hit;
  let r: RGBA;
  if (c.startsWith('rgb')) {
    const m = (c.match(/[\d.]+/g) ?? []).map(Number);
    if (m.length < 3) throw new Error(`bad colour: ${c}`);
    r = [m[0], m[1], m[2], m.length > 3 ? Math.round(m[3] * 255) : 255];
  } else if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(c)) {
    const n = (i: number) => parseInt(c.slice(i, i + 2), 16);
    r = [n(1), n(3), n(5), c.length === 9 ? n(7) : 255];
  } else if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    const n = (i: number) => parseInt(c[i] + c[i], 16);
    r = [n(1), n(2), n(3), 255];
  } else throw new Error(`bad colour: ${c}`);
  cache.set(c, r);
  return r;
}

const h2 = (v: number) => v.toString(16).padStart(2, '0');
/** Lower-case `#rrggbb`. */
export const toHex = (r: number, g: number, b: number): string => '#' + h2(r) + h2(g) + h2(b);

/** Normalise any accepted opaque colour to lower-case `#rrggbb`. */
export function normHex(c: string): string {
  const [r, g, b] = parseColor(c);
  return toHex(r, g, b);
}

export const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;
export const lumaOf = (c: string): number => { const [r, g, b] = parseColor(c); return luma(r, g, b); };

/** Weighted RGB distance² used by quantize (artlab's weights). */
export const dist2 = (a: RGBA, r: number, g: number, b: number): number => {
  const dr = r - a[0], dg = g - a[1], db = b - a[2];
  return 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
};

export interface HSL { h: number; s: number; l: number }

export function toHsl(c: string): HSL {
  const [R, G, B] = parseColor(c).map(v => v / 255);
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return { h, s, l };
}

export function fromHsl({ h, s, l }: HSL): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  const hh = h / 360;
  return toHex(f(hh + 1 / 3), f(hh), f(hh - 1 / 3));
}
