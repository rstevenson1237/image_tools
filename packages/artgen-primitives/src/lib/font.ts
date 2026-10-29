/** 3×5 bitmap font for sheet labels (no platform fonts, so sheets are deterministic). */
import { Grid } from './grid.ts';

// Each glyph: five rows, each a digit 0–7 (bit 4 = left column, 2 = middle, 1 = right).
const GLYPHS: Record<string, string> = {
  '0': '75557', '1': '26227', '2': '71747', '3': '71317', '4': '55711', '5': '74717', '6': '74757', '7': '71122',
  '8': '75757', '9': '75717', A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553',
  H: '55755', I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644',
  Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222',
  Z: '71247', ' ': '00000', '.': '00002', ',': '00024', ':': '02020', ';': '02024', '-': '00700', '+': '02720',
  _: '00007', '/': '11244', '|': '22222', '(': '12221', ')': '42224', '[': '64446', ']': '31113', '%': '51245',
  '=': '07070', '#': '57575', '?': '71302', '!': '22202', "'": '22000', '"': '55000', '<': '12421', '>': '42124',
  '*': '52725', '@': '75747', '&': '25257', $: '36763', '^': '25000', '~': '03600',
};

export const GLYPH_W = 3, GLYPH_H = 5;

/** Width in px of `text` at `scale` (glyph + 1 px gap). */
export const textWidth = (text: string, scale = 1): number => Math.max(0, text.length * (GLYPH_W + 1) - 1) * scale;

/** Draw text (upper-cased) with its top-left at (x, y). Unknown characters draw as `?`. */
export function drawText(g: Grid, x: number, y: number, text: string, color: string, scale = 1): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const rows = GLYPHS[ch] ?? GLYPHS['?'];
    for (let r = 0; r < GLYPH_H; r++) {
      const bits = +rows[r];
      for (let c = 0; c < GLYPH_W; c++) if (bits & (4 >> c)) g.fill(cx + c * scale, y + r * scale, scale, scale, color);
    }
    cx += (GLYPH_W + 1) * scale;
  }
}
