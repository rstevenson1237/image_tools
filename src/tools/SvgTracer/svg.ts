import type { Point } from '../../core/utils/geometry';
import type { PathStyle, VecDocument, VecPath } from './model';

/**
 * SVG serialisation.
 *
 * Hand-written rather than `canvas.toSVG()`: Fabric's exporter bakes in the
 * viewport transform, emits a per-object `transform="matrix(...)"` and its own
 * `<desc>`, and is the code path the 6.x SVG advisories lived in. Sixty lines
 * here produce a cleaner file, are independent of zoom and pan, and — being
 * DOM-free — are unit-testable.
 *
 * Nothing user-authored reaches the output: colours are validated against a hex
 * regex and path names are never written. That is what keeps the README's claim
 * true by construction rather than by convention.
 */

export interface SvgExportOptions {
  /** Decimal places for coordinates. Default 2. */
  precision?: number;
  /** Emit a full-viewBox background rect in this colour. Default none. */
  background?: string | null;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Any colour that is not a plain 6-digit hex is replaced with black. */
function safeColor(color: string): string {
  return HEX_COLOR.test(color) ? color.toLowerCase() : '#000000';
}

function round(value: number, precision: number): string {
  // Number() strips the trailing zeros toFixed insists on: 12.50 -> "12.5".
  return String(Number(value.toFixed(precision)));
}

/**
 * The `d` attribute for one path.
 *
 * `transform` maps model (image) coordinates into output coordinates: omit it
 * for export, pass `imageToScene` to draw the same geometry on the canvas.
 */
export function pathToSvgD(
  path: VecPath,
  precision: number,
  transform?: (point: Point) => Point,
): string {
  const parts: string[] = [];
  for (const subpath of path.subpaths) {
    if (subpath.nodes.length < 2) continue;
    const commands: string[] = [];
    for (let i = 0; i < subpath.nodes.length; i++) {
      const node = transform ? transform(subpath.nodes[i]) : subpath.nodes[i];
      commands.push(
        `${i === 0 ? 'M' : 'L'} ${round(node.x, precision)} ${round(node.y, precision)}`,
      );
    }
    if (subpath.closed) commands.push('Z');
    parts.push(commands.join(' '));
  }
  return parts.join(' ');
}

/** Presentation attributes, omitting anything already at its SVG default. */
function styleAttributes(style: PathStyle): string {
  const attributes: string[] = [];

  attributes.push(style.fill === null ? 'fill="none"' : `fill="${safeColor(style.fill)}"`);
  if (style.fill !== null && style.fillOpacity < 1) {
    attributes.push(`fill-opacity="${round(style.fillOpacity, 3)}"`);
  }
  // Only meaningful with a fill, and only worth stating when it differs from the
  // SVG default of nonzero.
  if (style.fill !== null && style.fillRule === 'evenodd') {
    attributes.push('fill-rule="evenodd"');
  }

  if (style.stroke !== null) {
    attributes.push(`stroke="${safeColor(style.stroke)}"`);
    if (style.strokeWidth !== 1) attributes.push(`stroke-width="${round(style.strokeWidth, 3)}"`);
    if (style.strokeOpacity < 1) {
      attributes.push(`stroke-opacity="${round(style.strokeOpacity, 3)}"`);
    }
  }

  return attributes.join(' ');
}

export function documentToSvg(doc: VecDocument, options: SvgExportOptions = {}): string {
  const precision = options.precision ?? 2;
  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" ` +
      `viewBox="0 0 ${doc.width} ${doc.height}">`,
  ];

  if (options.background) {
    lines.push(
      `  <rect width="${doc.width}" height="${doc.height}" fill="${safeColor(options.background)}"/>`,
    );
  }

  for (const path of doc.paths) {
    if (!path.visible) continue;
    // All of a path's subpaths go in one element so its holes are holes rather
    // than separate filled shapes.
    const d = pathToSvgD(path, precision);
    if (!d) continue;
    lines.push(`  <path ${styleAttributes(path.style)} d="${d}"/>`);
  }

  lines.push('</svg>', '');
  return lines.join('\n');
}

/** 'goblin.png' -> 'goblin.svg' */
export function suggestSvgFilename(sourceName: string): string {
  const base = sourceName.replace(/\.[^.]+$/, '') || 'traced';
  return `${base}.svg`;
}
