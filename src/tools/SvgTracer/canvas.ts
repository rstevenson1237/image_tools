import { Path, type Canvas, type TPointerEventInfo } from 'fabric';
import type { ImagePlacement, Point } from '../../core/utils/geometry';
import { imageToScene, sceneToImage } from '../../core/utils/geometry';
import { normalizePointer } from '../../core/utils/pointerEvent';
import {
  hitTestNode,
  hitTestPath,
  hitTestSegment,
  type NodeRef,
  type SegmentRef,
  type VecDocument,
} from './model';
import { pathToSvgD } from './svg';

export type EditorTool = 'select' | 'insert' | 'delete';

export interface NodeEditorConfig {
  /** Gate for starting a gesture — false while busy or while the stage pans. */
  canStart: () => boolean;
  getDocument: () => VecDocument | null;
  getPlacement: () => ImagePlacement | null;
  getTool: () => EditorTool;
  getSelectedPathId: () => string | null;
  onselectpath: (pathId: string | null) => void;
  /** Live drag position. Mutates the model; records no history. */
  onnodedrag: (ref: NodeRef, to: Point) => void;
  /** Pointer-up: one coalesced command for the whole drag. */
  onnodedragend: (ref: NodeRef, from: Point, to: Point) => void;
  oninsertnode: (at: SegmentRef, node: Point) => void;
  ondeletenode: (ref: NodeRef) => void;
}

export interface NodeEditorController {
  detach: () => void;
  /** Re-reads the model and updates the canvas. Call after any mutation. */
  sync: () => void;
}

/** Hit and handle sizes are in screen pixels, converted per zoom level. */
const HANDLE_HIT_PX = 7;
const HANDLE_SIZE_PX = 4;
const SELECTED_STROKE = '#6ea8fe';
const HANDLE_FILL = '#101217';

const PATH_DEFAULTS = {
  selectable: false,
  evented: false,
  // These paths are rebuilt as the user drags; caching a shape that changes
  // every frame costs more than it saves.
  objectCaching: false,
  excludeFromExport: true,
};

/**
 * Renders the vector document onto the shared Fabric canvas and implements
 * node-level editing on top of it.
 *
 * Fabric here is a renderer and nothing more. Hit testing runs against the model
 * in image space rather than through `findTarget`, and node handles are painted
 * straight into the 2D context on `after:render` instead of becoming thousands
 * of Fabric objects.
 */
export function attachNodeEditor(canvas: Canvas, config: NodeEditorConfig): NodeEditorController {
  const objects = new Map<string, Path>();
  /** Last `d` written per path, so sync only rebuilds what changed. */
  const rendered = new Map<string, string>();

  let dragRef: NodeRef | null = null;
  let dragFrom: Point | null = null;
  let dragTo: Point | null = null;
  let hover: NodeRef | null = null;
  let detached = false;

  /** Scene units per image pixel — the stage's fit scale, not the zoom. */
  function imageScale(placement: ImagePlacement): number {
    return Math.max(1e-6, (Math.abs(placement.scaleX) + Math.abs(placement.scaleY)) / 2);
  }

  /** Converts a screen-pixel radius into image-space units. */
  function hitRadius(placement: ImagePlacement): number {
    return HANDLE_HIT_PX / (canvas.getZoom() * imageScale(placement));
  }

  function pointerInImageSpace(event: TPointerEventInfo): Point | null {
    const placement = config.getPlacement();
    if (!placement) return null;
    const scene = canvas.getScenePoint(event.e);
    return sceneToImage(scene, placement);
  }

  function removeObject(id: string) {
    const object = objects.get(id);
    if (!object) return;
    canvas.remove(object);
    objects.delete(id);
    rendered.delete(id);
  }

  function styleFor(id: string) {
    const selected = id === config.getSelectedPathId();
    return {
      stroke: selected ? SELECTED_STROKE : 'rgba(230, 233, 240, 0.35)',
      // Stroke width is set in scene units but the d is already in scene units,
      // so dividing by the zoom keeps the outline one screen pixel wide.
      strokeWidth: (selected ? 1.5 : 1) / canvas.getZoom(),
    };
  }

  function sync(): void {
    if (detached) return;
    const doc = config.getDocument();
    const placement = config.getPlacement();

    if (!doc || !placement) {
      for (const id of [...objects.keys()]) removeObject(id);
      canvas.requestRenderAll();
      return;
    }

    const toImage = (point: Point) => imageToScene(point, placement);
    const live = new Set<string>();

    for (const path of doc.paths) {
      if (!path.visible) continue;
      live.add(path.id);
      // Two decimals of scene precision is well under a screen pixel and keeps
      // this string comparison — the thing that decides whether to rebuild —
      // from churning on sub-pixel noise.
      const d = pathToSvgD(path, 2, toImage);
      if (!d) {
        removeObject(path.id);
        continue;
      }

      const existing = objects.get(path.id);
      const outline = styleFor(path.id);
      if (existing && rendered.get(path.id) === d) {
        existing.set({ ...outline, fill: path.style.fill ?? 'transparent' });
        continue;
      }

      if (existing) canvas.remove(existing);
      // Path geometry is fixed at construction in Fabric, so a changed `d` means
      // a new object rather than a mutation.
      const object = new Path(d, {
        ...PATH_DEFAULTS,
        ...outline,
        fill: path.style.fill ?? 'transparent',
        opacity: path.style.fillOpacity,
        fillRule: path.style.fillRule,
      });
      canvas.add(object);
      objects.set(path.id, object);
      rendered.set(path.id, d);
    }

    for (const id of [...objects.keys()]) {
      if (!live.has(id)) removeObject(id);
    }
    canvas.requestRenderAll();
  }

  /** Rebuilds only the path being dragged — the hot path during a gesture. */
  function syncPath(pathId: string): void {
    const doc = config.getDocument();
    const placement = config.getPlacement();
    if (!doc || !placement) return;
    const path = doc.paths.find((candidate) => candidate.id === pathId);
    const existing = objects.get(pathId);
    if (!path || !existing) return;

    const d = pathToSvgD(path, 2, (point) => imageToScene(point, placement));
    if (!d || rendered.get(pathId) === d) return;

    canvas.remove(existing);
    const object = new Path(d, {
      ...PATH_DEFAULTS,
      ...styleFor(pathId),
      fill: path.style.fill ?? 'transparent',
      opacity: path.style.fillOpacity,
      fillRule: path.style.fillRule,
    });
    canvas.add(object);
    objects.set(pathId, object);
    rendered.set(pathId, d);
    canvas.requestRenderAll();
  }

  /**
   * Paints node handles for the selected path only. Drawing every path's nodes
   * is the difference between forty handles and eight thousand.
   */
  function drawHandles(): void {
    const doc = config.getDocument();
    const placement = config.getPlacement();
    const selectedId = config.getSelectedPathId();
    if (!doc || !placement || !selectedId) return;

    const path = doc.paths.find((candidate) => candidate.id === selectedId);
    if (!path || !path.visible) return;

    const ctx = canvas.getContext();
    const vpt = canvas.viewportTransform;
    ctx.save();
    // Draw in screen space: convert each node through the viewport transform
    // ourselves so handle size stays constant regardless of zoom.
    ctx.lineWidth = 1;

    for (let s = 0; s < path.subpaths.length; s++) {
      const nodes = path.subpaths[s].nodes;
      for (let n = 0; n < nodes.length; n++) {
        const scene = imageToScene(nodes[n], placement);
        const x = vpt[0] * scene.x + vpt[2] * scene.y + vpt[4];
        const y = vpt[1] * scene.x + vpt[3] * scene.y + vpt[5];

        const active =
          (dragRef ?? hover)?.subpathIndex === s && (dragRef ?? hover)?.nodeIndex === n;
        const size = active ? HANDLE_SIZE_PX + 1 : HANDLE_SIZE_PX;
        ctx.fillStyle = active ? SELECTED_STROKE : HANDLE_FILL;
        ctx.strokeStyle = SELECTED_STROKE;
        ctx.beginPath();
        ctx.rect(x - size / 2, y - size / 2, size, size);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function onMouseDown(opt: TPointerEventInfo) {
    const normalized = normalizePointer(opt.e);
    if (!normalized || normalized.button !== 0 || !config.canStart()) return;

    const doc = config.getDocument();
    const placement = config.getPlacement();
    const point = pointerInImageSpace(opt);
    if (!doc || !placement || !point) return;

    const radius = hitRadius(placement);
    const selectedId = config.getSelectedPathId();
    const tool = config.getTool();

    if (tool === 'delete') {
      const ref = hitTestNode(doc, point, radius, selectedId);
      if (ref) config.ondeletenode(ref);
      return;
    }

    if (tool === 'insert') {
      const hit = hitTestSegment(doc, point, radius, selectedId);
      if (hit) config.oninsertnode(hit.ref, hit.projected);
      return;
    }

    const ref = hitTestNode(doc, point, radius, selectedId);
    if (ref) {
      // Grabbing a node on another path selects that path too, so the handles
      // the user is now dragging are the ones on screen.
      if (ref.pathId !== selectedId) config.onselectpath(ref.pathId);
      const node = doc.paths
        .find((candidate) => candidate.id === ref.pathId)
        ?.subpaths[ref.subpathIndex]?.nodes[ref.nodeIndex];
      if (!node) return;
      dragRef = ref;
      dragFrom = { x: node.x, y: node.y };
      dragTo = { x: node.x, y: node.y };
      opt.e.preventDefault();
      return;
    }

    config.onselectpath(hitTestPath(doc, point));
  }

  function onMouseMove(opt: TPointerEventInfo) {
    const doc = config.getDocument();
    const placement = config.getPlacement();
    const point = pointerInImageSpace(opt);
    if (!doc || !placement || !point) return;

    if (dragRef) {
      dragTo = point;
      config.onnodedrag(dragRef, point);
      syncPath(dragRef.pathId);
      return;
    }

    if (!config.canStart()) return;
    const next = hitTestNode(doc, point, hitRadius(placement), config.getSelectedPathId());
    const changed =
      next?.pathId !== hover?.pathId ||
      next?.subpathIndex !== hover?.subpathIndex ||
      next?.nodeIndex !== hover?.nodeIndex;
    if (changed) {
      hover = next;
      canvas.requestRenderAll();
    }
  }

  function onMouseUp() {
    if (!dragRef || !dragFrom || !dragTo) {
      dragRef = null;
      dragFrom = null;
      dragTo = null;
      return;
    }
    const ref = dragRef;
    const from = dragFrom;
    const to = dragTo;
    dragRef = null;
    dragFrom = null;
    dragTo = null;

    // A click that never moved is a selection, not an edit — recording it would
    // put a no-op on the undo stack.
    if (from.x !== to.x || from.y !== to.y) config.onnodedragend(ref, from, to);
  }

  canvas.on('mouse:down', onMouseDown);
  canvas.on('mouse:move', onMouseMove);
  canvas.on('mouse:up', onMouseUp);
  canvas.on('mouse:out', onMouseUp);
  canvas.on('after:render', drawHandles);

  return {
    detach() {
      if (detached) return;
      detached = true;
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('mouse:out', onMouseUp);
      canvas.off('after:render', drawHandles);
      for (const object of objects.values()) canvas.remove(object);
      objects.clear();
      rendered.clear();
    },
    sync,
  };
}
