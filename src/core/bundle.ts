/**
 * Bundle mode: this build is the review UI that `artgen ui` serves from a game repo's `tools/artgen/ui/` (the `ui` module,
 * `vite.ui.config.ts`). It opens the repo's `art/` through the server instead of asking for a folder, and leaves out the
 * image tools. The flag is a build-time constant, so the tools it leaves out are not in the bundle at all.
 */
declare const __ARTGEN_UI__: boolean | undefined;

export const BUNDLED: boolean = typeof __ARTGEN_UI__ !== 'undefined' && __ARTGEN_UI__;

const KEY = 'artgen-ui-token';

/** The access token from the link (`?t=…`), kept for the tab's session and taken out of the address bar. */
export function serverToken(): string | null {
  try {
    const url = new URL(location.href), t = url.searchParams.get('t');
    if (t) {
      sessionStorage.setItem(KEY, t);
      url.searchParams.delete('t');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return sessionStorage.getItem(KEY);
  } catch { return null; }
}
