/**
 * Keyboard shortcuts of the shell (R8): the same few keys in every tool, and a tool adds its own beside them. Keys are single
 * characters (`j`, `[`, `?`); nothing fires while you type in a field, and a shortcut with a modifier (ctrl, alt, meta) is left to the
 * browser and the tool that owns it (undo, for one). The list shown by `?` is the list that is registered, so it cannot drift.
 */

export interface Shortcut {
  /** One character, as `KeyboardEvent.key` gives it. */
  key: string;
  /** What it does, in the help list. */
  label: string;
  run(): void;
}

export interface KeyLike { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; target?: unknown }

/** Is the key press inside a field you type in? */
export function typing(e: Pick<KeyLike, 'target'>): boolean {
  const t = e.target as { closest?: (s: string) => unknown; isContentEditable?: boolean } | null | undefined;
  return !!t && (!!t.closest?.('input, textarea, select') || t.isContentEditable === true);
}

export class ShortcutRegistry {
  /** Registered groups, oldest first: the shell's own, then the open tool's. */
  groups: { scope: string; list: Shortcut[] }[] = [];
  /** Called after the groups change (the page's reactive mirror hooks in here). */
  onchange: () => void = () => {};

  /** Add a group of shortcuts for `scope`; returns the function that removes it (call it when the tool unmounts). */
  register(scope: string, list: Shortcut[]): () => void {
    const entry = { scope, list };
    this.groups.push(entry);
    this.onchange();
    return () => { const i = this.groups.indexOf(entry); if (i >= 0) { this.groups.splice(i, 1); this.onchange(); } };
  }

  /** Run the shortcut that matches the key press, newest group first. Returns whether one ran. */
  dispatch(e: KeyLike): boolean {
    if (e.ctrlKey || e.altKey || e.metaKey || typing(e)) return false;
    for (let g = this.groups.length - 1; g >= 0; g--) {
      const hit = this.groups[g].list.find(s => s.key === e.key);
      if (hit) { hit.run(); return true; }
    }
    return false;
  }
}
