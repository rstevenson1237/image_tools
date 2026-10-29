/** Small helpers the three map editors (Terrain, Dungeon, Settlement) share. */
import { map } from 'artgen-core';
import fontRegular from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Regular.ttf?url';
import fontBold from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Bold.ttf?url';
import fontItalic from '../../../packages/artgen-core/assets/fonts/AlegreyaSans-Italic.ttf?url';

export const round = (v: number) => Math.round(v * 100) / 100;
export const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;
export const num = (e: Event) => Number(val(e));
export const checked = (e: Event) => (e.currentTarget as HTMLInputElement).checked;
export const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** True when a key event comes from a text field, where editor shortcuts must stay out of the way. */
export const isTyping = (e: KeyboardEvent) => !!(e.target as HTMLElement)?.closest?.('input, textarea, select');

/** Ctrl/Cmd+Z and +Shift+Z on a history; returns true when the key was an undo or redo. */
export function undoRedoKey(e: KeyboardEvent, history: { undo(): void; redo(): void }): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || isTyping(e)) return false;
  if (e.shiftKey) history.redo(); else history.undo();
  e.preventDefault();
  return true;
}

/** The preview SVG names the same font the PNG export embeds: load it into the page. */
export function loadMapFonts(): void {
  for (const [url, weight, style] of [[fontRegular, '400', 'normal'], [fontBold, '700', 'normal'], [fontItalic, '400', 'italic']] as const) {
    const face = new FontFace(map.FONT_FAMILY, `url(${url})`, { weight, style });
    void face.load().then(f => document.fonts.add(f)).catch(() => {});
  }
}
