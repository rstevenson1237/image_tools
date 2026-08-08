import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Cross-Origin isolation, applied to the dev and preview servers.
 *
 * The current OpenCV.js build is single-threaded and never touches
 * SharedArrayBuffer, so the app does NOT require these headers to work — it runs
 * fine on static hosts that cannot set them, GitHub Pages included. They are kept
 * so that dev matches the stricter environment a threaded WASM build would need,
 * which means such an upgrade surfaces problems locally rather than in prod.
 */
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // Pages serves the app from /<repo>/, not the domain root. The CI workflow
  // passes the repo name through BASE_PATH; local builds stay at the root.
  base: process.env.BASE_PATH || '/',
  plugins: [svelte()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  worker: { format: 'es' },
});
