import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * The review UI of the `ui` installer module (packages/artgen-dist/ui-build.mjs builds it into `tools/artgen/ui/`): the web
 * app in bundle mode (`src/core/bundle.ts`). `artgen ui` serves it and gives it the repo's `art/` over HTTP. It is served
 * from a local address, so assets are relative; the OpenCV copy in `public/` is not part of it (the image tools that load
 * it are left out, so the bundle is a few MB instead of 12).
 *
 * The PNG rasteriser and the map label fonts are in the install already (`tools/artgen/resvg.wasm`, `fonts/`: the `core`
 * module), so the bundle doesn't carry a second copy: the imports that would emit them point at addresses `artgen ui`
 * serves from there instead.
 */
const SHARED: Record<string, string> = {
  'index_bg.wasm': '/resvg.wasm',
  'AlegreyaSans-Regular.ttf': '/fonts/AlegreyaSans-Regular.ttf',
  'AlegreyaSans-Bold.ttf': '/fonts/AlegreyaSans-Bold.ttf',
  'AlegreyaSans-Italic.ttf': '/fonts/AlegreyaSans-Italic.ttf',
};
const sharedAssets = (): Plugin => ({
  name: 'artgen-shared-assets',
  enforce: 'pre',
  resolveId(id) {
    const file = id.match(/([^/\\]+\.(?:wasm|ttf))\?url$/)?.[1];
    return file && SHARED[file] ? `\0shared:${file}` : undefined;
  },
  load(id) {
    return id.startsWith('\0shared:') ? `export default ${JSON.stringify(SHARED[id.slice('\0shared:'.length)])};` : undefined;
  },
});

export default defineConfig({
  base: './',
  plugins: [sharedAssets(), svelte()],
  publicDir: false,
  define: { __ARTGEN_UI__: 'true' },
  // the artgen worker is bundled by its own pipeline, which needs the plugin too
  worker: { format: 'es', plugins: () => [sharedAssets()] },
});
