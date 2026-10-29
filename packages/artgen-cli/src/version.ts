declare const __ARTGEN_VERSION__: string | undefined;
/** Set by the artgen-dist build; `dev` when run from this repo. */
export const VERSION = typeof __ARTGEN_VERSION__ === 'string' ? __ARTGEN_VERSION__ : 'dev';
