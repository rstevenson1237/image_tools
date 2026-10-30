/**
 * The review UI (the `ui` module): the web app built in bundle mode (`vite.ui.config.ts`) into `tools/artgen/ui/`. The
 * Art Direction, Asset Review and Asset Lab tools and the three map editors are in it; the image tools (Token Cutter, SVG Tracer, Palette,
 * Sprite Slicer) are not: they work on pictures, not on a project's `art/`. It reads and writes the project through `artgen ui`.
 */
import { build } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Build the web app into `dest` (emptied first). */
export async function buildUi(dest) {
  await build({ root: ROOT, configFile: join(ROOT, 'vite.ui.config.ts'), logLevel: 'warn', build: { outDir: dest, emptyOutDir: true, reportCompressedSize: false } });
}
