import { ShortcutRegistry, type Shortcut } from './shortcuts';

/** The shell's registry, with a counter the page reads so the help list redraws when a tool adds or removes shortcuts. */
export const shortcuts = new ShortcutRegistry();
export const shell = $state({ help: false, rev: 0 });
// a plain counter: reading `shell.rev` here would make the effect that registers a tool's shortcuts depend on it
let changes = 0;
shortcuts.onchange = () => { shell.rev = ++changes; };

/** Register a tool's shortcuts for as long as the calling component lives (call during component setup). */
export function useShortcuts(scope: string, list: Shortcut[]): void {
  $effect(() => shortcuts.register(scope, list));
}
