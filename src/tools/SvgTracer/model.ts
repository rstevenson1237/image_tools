import type { Point } from '../../core/utils/geometry';
import type { TraceResult } from '../../workers/opencv.worker';

/**
 * The SVG Tracer's vector document.
 *
 * This plain model — not Fabric — is the source of truth. Fabric has no
 * per-vertex editing API, and every geometry mutation on a Fabric object
 * recomputes its bounding box and re-centres `left`/`top`, so a Fabric-owned
 * model would make every node drag quietly move the object's origin and force
 * undo to restore transform state alongside geometry. Keeping the truth here
 * also keeps this file free of runes and of the DOM, which is what makes it
 * unit-testable.
 *
 * Every coordinate below is in SOURCE-IMAGE pixels. Scene coordinates exist
 * only at render time, via `imageToScene`.
 */

export interface SubPath {
  nodes: Point[];
  closed: boolean;
}

export interface PathStyle {
  /** '#rrggbb', or null for `fill="none"`. */
  fill: string | null;
  fillOpacity: number;
  stroke: string | null;
  /** In image pixels. */
  strokeWidth: number;
  strokeOpacity: number;
  /**
   * Even-odd by default so holes render correctly regardless of the winding
   * direction OpenCV happened to produce. Switching this to 'nonzero' means
   * hole rings must be reversed relative to their outer ring.
   */
  fillRule: 'evenodd' | 'nonzero';
}

export interface VecPath {
  id: string;
  name: string;
  /** `[0]` is the outer ring; the rest are holes. */
  subpaths: SubPath[];
  style: PathStyle;
  visible: boolean;
}

export interface VecDocument {
  /** Source image dimensions, which become the SVG viewBox. */
  width: number;
  height: number;
  /** Render order: index 0 is painted first, so it sits at the bottom. */
  paths: VecPath[];
}

export interface NodeRef {
  pathId: string;
  subpathIndex: number;
  nodeIndex: number;
}

/** The segment running from `nodeIndex` to the next node, wrapping when closed. */
export type SegmentRef = NodeRef;

export const defaultPathStyle: PathStyle = {
  fill: '#e6e9f0',
  fillOpacity: 1,
  stroke: null,
  strokeWidth: 1,
  strokeOpacity: 1,
  fillRule: 'evenodd',
};

let nextPathId = 0;

export function createPathId(): string {
  return `p-${++nextPathId}`;
}

function ringToNodes(points: Float32Array): Point[] {
  const nodes: Point[] = new Array(points.length / 2);
  for (let i = 0; i < nodes.length; i++) {
    nodes[i] = { x: points[i * 2], y: points[i * 2 + 1] };
  }
  return nodes;
}

/**
 * Builds a document from a worker trace. This is the only place flat
 * `Float32Array` rings become `{x, y}` nodes.
 */
export function documentFromTrace(
  result: TraceResult,
  style: Partial<PathStyle> = {},
): VecDocument {
  const base: PathStyle = { ...defaultPathStyle, ...style };
  const paths = result.shapes.map((shape, index) => ({
    id: createPathId(),
    name: `Shape ${index + 1}`,
    subpaths: [
      { nodes: ringToNodes(shape.outer.points), closed: true },
      ...shape.holes.map((hole) => ({ nodes: ringToNodes(hole.points), closed: true })),
    ],
    style: { ...base },
    visible: true,
  }));
  return { width: result.width, height: result.height, paths };
}

export function findPath(doc: VecDocument, id: string): VecPath | undefined {
  return doc.paths.find((path) => path.id === id);
}

function subpathAt(doc: VecDocument, ref: NodeRef): SubPath | undefined {
  return findPath(doc, ref.pathId)?.subpaths[ref.subpathIndex];
}

export function getNode(doc: VecDocument, ref: NodeRef): Point | undefined {
  return subpathAt(doc, ref)?.nodes[ref.nodeIndex];
}

/**
 * The mutations below all work in place, and the ones that shift indices are
 * paired inverses (insert/remove). Commands record plain index refs, which is
 * safe because the history is a strict stack: undo and redo only ever step
 * between adjacent states, so an index recorded against one state is always
 * valid in the state its command applies to. Batch operations or non-linear
 * history would break that invariant.
 */

export function setNode(doc: VecDocument, ref: NodeRef, to: Point): void {
  const subpath = subpathAt(doc, ref);
  const node = subpath?.nodes[ref.nodeIndex];
  if (!node) return;
  node.x = to.x;
  node.y = to.y;
}

export function insertNode(doc: VecDocument, ref: NodeRef, node: Point): void {
  const subpath = subpathAt(doc, ref);
  if (!subpath) return;
  subpath.nodes.splice(ref.nodeIndex, 0, { x: node.x, y: node.y });
}

export function removeNode(doc: VecDocument, ref: NodeRef): Point | undefined {
  const subpath = subpathAt(doc, ref);
  if (!subpath) return undefined;
  return subpath.nodes.splice(ref.nodeIndex, 1)[0];
}

export function removePath(
  doc: VecDocument,
  id: string,
): { index: number; path: VecPath } | null {
  const index = doc.paths.findIndex((path) => path.id === id);
  if (index < 0) return null;
  return { index, path: doc.paths.splice(index, 1)[0] };
}

export function insertPath(doc: VecDocument, index: number, path: VecPath): void {
  doc.paths.splice(index, 0, path);
}

export function nodeCount(path: VecPath): number {
  return path.subpaths.reduce((total, subpath) => total + subpath.nodes.length, 0);
}

/**
 * A closed subpath needs three nodes to bound an area; an open one needs two to
 * be a line. The delete tool consults this so it cannot degrade a ring into
 * something the serializer would emit as a dangling `M`.
 */
export function canRemoveNode(doc: VecDocument, ref: NodeRef): boolean {
  const subpath = subpathAt(doc, ref);
  if (!subpath) return false;
  return subpath.nodes.length > (subpath.closed ? 3 : 2);
}

/** Nearest node within `radius`, searching `preferPathId` first. */
export function hitTestNode(
  doc: VecDocument,
  point: Point,
  radius: number,
  preferPathId?: string | null,
): NodeRef | null {
  let best: NodeRef | null = null;
  let bestDistance = radius * radius;
  let bestPreferred = false;

  for (const path of doc.paths) {
    if (!path.visible) continue;
    const preferred = path.id === preferPathId;
    for (let s = 0; s < path.subpaths.length; s++) {
      const nodes = path.subpaths[s].nodes;
      for (let n = 0; n < nodes.length; n++) {
        const dx = nodes[n].x - point.x;
        const dy = nodes[n].y - point.y;
        const distance = dx * dx + dy * dy;
        if (distance > radius * radius) continue;
        // A node on the selected path always wins over an equally close node on
        // another path, so editing one shape never snags a neighbour.
        if (bestPreferred && !preferred) continue;
        if (preferred && !bestPreferred) {
          best = { pathId: path.id, subpathIndex: s, nodeIndex: n };
          bestDistance = distance;
          bestPreferred = true;
          continue;
        }
        if (distance < bestDistance) {
          best = { pathId: path.id, subpathIndex: s, nodeIndex: n };
          bestDistance = distance;
          bestPreferred = preferred;
        }
      }
    }
  }
  return best;
}

/** Squared distance from `p` to segment `a`-`b`, plus the projected point. */
function projectOntoSegment(p: Point, a: Point, b: Point): { distance: number; point: Point } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  const ex = p.x - point.x;
  const ey = p.y - point.y;
  return { distance: ex * ex + ey * ey, point };
}

/**
 * Nearest segment within `radius`. `ref.nodeIndex` is the segment's start node,
 * which is also the splice index that inserts a node into the middle of it.
 */
export function hitTestSegment(
  doc: VecDocument,
  point: Point,
  radius: number,
  onlyPathId?: string | null,
): { ref: SegmentRef; projected: Point } | null {
  let best: { ref: SegmentRef; projected: Point } | null = null;
  let bestDistance = radius * radius;

  for (const path of doc.paths) {
    if (!path.visible) continue;
    if (onlyPathId && path.id !== onlyPathId) continue;
    for (let s = 0; s < path.subpaths.length; s++) {
      const { nodes, closed } = path.subpaths[s];
      const segments = closed ? nodes.length : nodes.length - 1;
      for (let n = 0; n < segments; n++) {
        const a = nodes[n];
        const b = nodes[(n + 1) % nodes.length];
        const hit = projectOntoSegment(point, a, b);
        if (hit.distance < bestDistance) {
          bestDistance = hit.distance;
          // Splicing at n + 1 puts the new node between a and b.
          best = {
            ref: { pathId: path.id, subpathIndex: s, nodeIndex: n + 1 },
            projected: hit.point,
          };
        }
      }
    }
  }
  return best;
}

/** True when `point` lies inside the ring, by the even-odd crossing rule. */
function pointInRing(point: Point, nodes: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = nodes.length - 1; i < nodes.length; j = i++) {
    const a = nodes[i];
    const b = nodes[j];
    if (a.y > point.y !== b.y > point.y) {
      const x = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

/**
 * Topmost path containing `point`, or null. Even-odd across all of a path's
 * subpaths, matching how the exported SVG fills it — so clicking through a hole
 * selects whatever is behind it, exactly as the render suggests.
 */
export function hitTestPath(doc: VecDocument, point: Point): string | null {
  for (let i = doc.paths.length - 1; i >= 0; i--) {
    const path = doc.paths[i];
    if (!path.visible) continue;
    let crossings = 0;
    for (const subpath of path.subpaths) {
      if (pointInRing(point, subpath.nodes)) crossings++;
    }
    if (crossings % 2 === 1) return path.id;
  }
  return null;
}
