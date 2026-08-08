import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Cross-Origin isolation. Required so the WASM processing workers can use
 * SharedArrayBuffer / threaded builds. Must be present on both the dev server
 * and `vite preview`; production hosting needs the same two headers.
 */
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [svelte()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  worker: { format: 'es' },
});
