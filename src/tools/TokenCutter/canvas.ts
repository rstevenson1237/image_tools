import { Canvas, Polyline, Rect as FabricRect, type TPointerEventInfo } from 'fabric';
import type { Point } from '../../core/utils/geometry';
import { rectToPolygon } from '../../core/utils/geometry';
import { normalizePointer } from '../../core/utils/pointerEvent';

export type SelectionMode = 'lasso' | 'marquee';

export interface SelectionConfig {
  getMode: () => SelectionMode;
  /**
   * Gate for starting a gesture. The stage pans on space+left-drag, which would
   * otherwise also begin a lasso; the tool wires this to "the stage is idle".
   */
  canStart: () => boolean;
  /** Fired once the user finishes a selection, in scene coordinates. */
  onselection: (polygon: Point[]) => void;
}

export interface SelectionController {
  detach: () => void;
  clearPreview: () => void;
}

const OUTLINE = {
  // Fabric 7 defaults both origins to 'center'. The marquee sets left/top to the
  // *corner* of the drag rectangle and reads them back for `rectToPolygon`, so it
  // needs the v6 top-left semantics pinned explicitly. The lasso Polyline ignores
  // these: its `setBoundingBox` positions the object from its points.
  originX: 'left' as const,
  originY: 'top' as const,
  stroke: '#6ea8fe',
  strokeWidth: 1.5,
  strokeDashArray: [6, 4],
  fill: 'transparent',
  selectable: false,
  evented: false,
  objectCaching: false,
  excludeFromExport: true,
};

/**
 * Attaches freehand-lasso and marquee capture to the shared canvas.
 *
 * Both modes emit the same `{x, y}[]` polygon so the worker has a single input
 * shape to reason about — a marquee is just a four-point lasso.
 */
export function attachSelection(canvas: Canvas, config: SelectionConfig): SelectionController {
  let drawing = false;
  let points: Point[] = [];
  let preview: Polyline | FabricRect | null = null;
  let origin: Point | null = null;

  function removePreview() {
    if (!preview) return;
    canvas.remove(preview);
    preview = null;
  }

  function onMouseDown(opt: TPointerEventInfo) {
    const normalized = normalizePointer(opt.e);
    if (!normalized || normalized.button !== 0 || !config.canStart()) return;

    const pointer = canvas.getScenePoint(opt.e);
    drawing = true;
    origin = { x: pointer.x, y: pointer.y };
    points = [{ x: pointer.x, y: pointer.y }];
    removePreview();

    preview =
      config.getMode() === 'lasso'
        ? new Polyline([{ x: pointer.x, y: pointer.y }], OUTLINE)
        : new FabricRect({ ...OUTLINE, left: pointer.x, top: pointer.y, width: 0, height: 0 });

    canvas.add(preview);
    canvas.requestRenderAll();
  }

  function onMouseMove(opt: TPointerEventInfo) {
    if (!drawing || !origin || !preview) return;
    const pointer = canvas.getScenePoint(opt.e);

    if (config.getMode() === 'lasso') {
      const last = points.at(-1)!;
      // Skip sub-pixel jitter: thousands of near-duplicate points slow fillPoly
      // down without making the mask any more accurate.
      if (Math.hypot(pointer.x - last.x, pointer.y - last.y) < 2) return;
      points.push({ x: pointer.x, y: pointer.y });
      // Polyline geometry is fixed at construction, so redraw rather than mutate.
      canvas.remove(preview);
      preview = new Polyline(points, OUTLINE);
      canvas.add(preview);
    } else {
      (preview as FabricRect).set({
        left: Math.min(origin.x, pointer.x),
        top: Math.min(origin.y, pointer.y),
        width: Math.abs(pointer.x - origin.x),
        height: Math.abs(pointer.y - origin.y),
      });
      preview.setCoords();
    }
    canvas.requestRenderAll();
  }

  function onMouseUp() {
    if (!drawing) return;
    drawing = false;

    let polygon: Point[] = [];
    if (config.getMode() === 'lasso') {
      polygon = points;
    } else if (preview) {
      const rect = preview as FabricRect;
      const width = rect.width ?? 0;
      const height = rect.height ?? 0;
      if (width > 1 && height > 1) {
        polygon = rectToPolygon({ x: rect.left ?? 0, y: rect.top ?? 0, width, height });
      }
    }

    origin = null;
    points = [];

    if (polygon.length >= 3) {
      config.onselection(polygon);
    } else {
      // Too small to bound an area — treat it as a cancelled gesture.
      removePreview();
      canvas.requestRenderAll();
    }
  }

  canvas.on('mouse:down', onMouseDown);
  canvas.on('mouse:move', onMouseMove);
  canvas.on('mouse:up', onMouseUp);

  return {
    detach() {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      removePreview();
    },
    clearPreview() {
      removePreview();
      canvas.requestRenderAll();
    },
  };
}
