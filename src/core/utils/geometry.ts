export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Placement of a source image on the Fabric scene: where its top-left corner
 * sits and how much it was scaled to fit the viewport.
 */
export interface ImagePlacement {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
}

/** Scene (canvas) coordinates -> source image pixel coordinates. */
export function sceneToImage(point: Point, placement: ImagePlacement): Point {
  return {
    x: (point.x - placement.left) / placement.scaleX,
    y: (point.y - placement.top) / placement.scaleY,
  };
}

/** Source image pixel coordinates -> scene (canvas) coordinates. */
export function imageToScene(point: Point, placement: ImagePlacement): Point {
  return {
    x: point.x * placement.scaleX + placement.left,
    y: point.y * placement.scaleY + placement.top,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Axis-aligned bounds of a point set, clamped to the given pixel dimensions. */
export function boundsOf(points: Point[], width: number, height: number): Rect | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const x = clamp(Math.floor(minX), 0, width);
  const y = clamp(Math.floor(minY), 0, height);
  const right = clamp(Math.ceil(maxX), 0, width);
  const bottom = clamp(Math.ceil(maxY), 0, height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** Corner points of a rectangle, clockwise from top-left. */
export function rectToPolygon(rect: Rect): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}
