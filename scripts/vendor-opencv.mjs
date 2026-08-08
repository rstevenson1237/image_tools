/**
 * Copies the OpenCV.js bundle out of node_modules and into public/vendor.
 *
 * It has to be a *static asset*, not a module import. Vite's dev server rewrites
 * anything served from /node_modules into an ES module, so fetching it from
 * there hands the worker transformed source instead of the original UMD bundle.
 * Files under public/ are served byte-for-byte, which is what the worker's
 * fetch + eval loader needs.
 *
 * npm remains the source of truth for the version; the copy is gitignored.
 */
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/@techstark/opencv-js/dist/opencv.js');
const target = resolve(root, 'public/vendor/opencv.js');

function isUpToDate() {
  try {
    return statSync(target).mtimeMs >= statSync(source).mtimeMs;
  } catch {
    return false;
  }
}

try {
  statSync(source);
} catch {
  console.error(`[vendor-opencv] Missing ${source}. Run "npm install" first.`);
  process.exit(1);
}

if (isUpToDate()) {
  console.log('[vendor-opencv] public/vendor/opencv.js is up to date.');
} else {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  const mb = (statSync(target).size / 1024 / 1024).toFixed(1);
  console.log(`[vendor-opencv] Copied opencv.js (${mb} MB) to public/vendor/.`);
}
