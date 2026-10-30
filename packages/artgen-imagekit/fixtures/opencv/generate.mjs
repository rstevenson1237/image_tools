// Makes golden.json: what the OpenCV pipeline the web tools used before R5b (docs/TOOLING-PLAN.md) gives on cases.ts's pictures.
// Run it only to refresh the goldens; it needs the OpenCV build the tools shipped with, which is no longer a dependency:
//   npm install --no-save @techstark/opencv-js@4.10.0-release.1 && node packages/artgen-imagekit/fixtures/opencv/generate.mjs
// The steps below are the old `opencv.worker.ts` (binarize, keepLargestFilledBlob, extractSilhouette, traceContours) as they were.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { asPixels, CUT_SETTINGS, LASSOS, pictures, TRACE_SETTINGS } from './cases.ts';

const cv = createRequire(import.meta.url)('@techstark/opencv-js');
if (cv.Mat === undefined) await new Promise(r => { cv.onRuntimeInitialized = r; });
delete cv.then;

const sha = bytes => createHash('sha1').update(bytes).digest('hex');
/** Runs of 0 and 1 alternating, starting with 0. */
const rle = bytes => { const out = []; let cur = 0, n = 0; for (const b of bytes) { const v = b ? 1 : 0; if (v === cur) n++; else { out.push(n); cur = v; n = 1; } } out.push(n); return out; };

function binarize(src, o) {
  const gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const blurred = new cv.Mat();
  if (o.blur > 0) { const k = Math.max(3, o.blur | 1); cv.GaussianBlur(gray, blurred, new cv.Size(k, k), 0, 0, cv.BORDER_DEFAULT); } else gray.copyTo(blurred);
  const binary = new cv.Mat(), polarity = o.invert ? cv.THRESH_BINARY : cv.THRESH_BINARY_INV;
  const used = o.threshold === 'otsu' ? cv.threshold(blurred, binary, 0, 255, polarity | cv.THRESH_OTSU) : cv.threshold(blurred, binary, o.threshold, 255, polarity);
  if (o.smoothing > 0) { const k = Math.max(3, o.smoothing | 1); cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(k, k))); }
  if (o.respectAlpha) { const ch = new cv.MatVector(); cv.split(src, ch); const op = new cv.Mat(); cv.threshold(ch.get(3), op, 0, 255, cv.THRESH_BINARY); cv.bitwise_and(binary, op, binary); }
  return { binary, used };
}
function silhouette(src, w, h, poly, o) {
  const mask = new cv.Mat(h, w, cv.CV_8UC1, new cv.Scalar(0));
  if (poly.length < 3) mask.setTo(new cv.Scalar(255));
  else { const v = new cv.MatVector(); v.push_back(cv.matFromArray(poly.length, 1, cv.CV_32SC2, poly.flatMap(p => [Math.round(p.x), Math.round(p.y)]))); cv.fillPoly(mask, v, new cv.Scalar(255)); }
  const { binary } = binarize(src, { threshold: o.threshold, invert: o.invert, blur: 3, smoothing: o.smoothing, respectAlpha: true });
  cv.bitwise_and(binary, mask, binary);
  if (o.keepLargestBlob) {
    const contours = new cv.MatVector(), hier = new cv.Mat();
    cv.findContours(binary, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let best = -1, bestArea = 0;
    for (let i = 0; i < contours.size(); i++) { const a = cv.contourArea(contours.get(i)); if (a > bestArea) { bestArea = a; best = i; } }
    if (best >= 0) { binary.setTo(new cv.Scalar(0)); cv.drawContours(binary, contours, best, new cv.Scalar(255), cv.FILLED); }
    cv.bitwise_and(binary, mask, binary);
  }
  return binary.data.slice();
}
function trace(src, o) {
  const { binary, used } = binarize(src, o), contours = new cv.MatVector(), hier = new cv.Mat();
  cv.findContours(binary, contours, hier, o.keepHoles ? cv.RETR_CCOMP : cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const tree = hier.data32S;
  let dropped = 0;
  const ringAt = i => {
    const c = contours.get(i), area = Math.abs(cv.contourArea(c));
    if (area < o.minArea) return null;
    let s = c;
    if (o.simplifyTolerance > 0) { const sm = new cv.Mat(); cv.approxPolyDP(c, sm, o.simplifyTolerance, true); if (sm.rows >= 3) s = sm; }
    const pts = Array.from(s.data32S);
    return pts.length < 6 ? null : { area, points: pts };
  };
  const shapes = [];
  for (let i = 0; i < contours.size(); i++) {
    if (tree[i * 4 + 3] !== -1) continue;
    const outer = ringAt(i);
    if (!outer) { dropped++; continue; }
    const holes = [];
    if (o.keepHoles) for (let ch = tree[i * 4 + 2]; ch !== -1; ch = tree[ch * 4]) { const h = ringAt(ch); if (h) holes.push(h); else dropped++; }
    shapes.push({ outer, holes });
  }
  shapes.sort((a, b) => b.outer.area - a.outer.area);
  if (shapes.length > o.maxPaths) { dropped += shapes.length - o.maxPaths; shapes.length = o.maxPaths; }
  return { used, dropped, shapes };
}

const cases = [];
for (const pic of pictures()) {
  const src = cv.matFromArray(pic.h, pic.w, cv.CV_8UC4, Array.from(pic.d)), px = asPixels(pic);
  void px;
  cases.push({
    image: pic.name, w: pic.w, h: pic.h,
    binarize: TRACE_SETTINGS.map(s => { const r = binarize(src, s); return { used: r.used, sha: sha(r.binary.data) }; }),
    trace: TRACE_SETTINGS.map(s => trace(src, s)),
    silhouette: CUT_SETTINGS.flatMap((o, oi) => LASSOS.map((lasso, li) => { const m = silhouette(src, pic.w, pic.h, lasso(pic.w, pic.h), o); return { cut: oi, lasso: li, sha: sha(m), runs: li ? rle(m) : undefined }; })),
  });
}
writeFileSync(fileURLToPath(new URL('./golden.json', import.meta.url)), JSON.stringify({ opencv: '4.10.0-release.1', cases }) + '\n');
console.log(`golden.json: ${cases.length} pictures`);
