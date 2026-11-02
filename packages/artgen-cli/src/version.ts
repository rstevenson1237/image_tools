declare const __ARTGEN_VERSION__: string | undefined;
/** Set by the artgen-dist build; `dev` when run from this repo. */
export const VERSION = typeof __ARTGEN_VERSION__ === 'string' ? __ARTGEN_VERSION__ : 'dev';
declare const __ARTGEN_SHA__: string | undefined;
/** The commit the bundle was built from (7 characters), or undefined when run from this repo. */
export const BUILD_SHA = typeof __ARTGEN_SHA__ === 'string' ? __ARTGEN_SHA__ : undefined;
/** The release and the build, as `--version` prints them: `0.12.0 (7c2f5fc)`. Builds between releases share a version, never a build. */
export const VERSION_LINE = BUILD_SHA ? `${VERSION} (${BUILD_SHA})` : VERSION;
