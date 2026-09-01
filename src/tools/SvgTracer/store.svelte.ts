import { createHistory, commandId, type Command } from '../../core/stores/history.svelte';
import type { LoadedImage } from '../../core/canvas/types';
import type { Point } from '../../core/utils/geometry';
import type { TraceOptions, TraceResult } from '../../workers/opencv.worker';
import type { EditorTool } from './canvas';
import {
  canRemoveNode,
  documentFromTrace,
  findPath,
  insertNode,
  insertPath,
  removeNode,
  removePath,
  setNode,
  type NodeRef,
  type PathStyle,
  type SegmentRef,
  type VecDocument,
  type VecPath,
} from './model';

export interface TraceSettings {
  autoThreshold: boolean;
  threshold: number;
  invert: boolean;
  smoothing: number;
  simplifyTolerance: number;
  minArea: number;
  keepHoles: boolean;
  maxPaths: number;
}

/**
 * Every mutation is a minimal delta rather than a document snapshot — dragging
 * a node in a five-thousand-node trace should not clone the trace. The only
 * whole-document swap is a re-trace, which really does replace everything.
 */
type TracerPayload =
  | { kind: 'node-move'; ref: NodeRef; from: Point; to: Point }
  | { kind: 'node-insert'; ref: NodeRef; node: Point }
  | { kind: 'node-delete'; ref: NodeRef; node: Point }
  | { kind: 'path-delete'; index: number; path: VecPath }
  | { kind: 'path-style'; pathId: string; before: PathStyle; after: PathStyle }
  | { kind: 'trace'; before: VecDocument | null; after: VecDocument | null };

export function createSvgTracerStore() {
  const history = createHistory<TracerPayload>();

  let settings = $state<TraceSettings>({
    autoThreshold: true,
    threshold: 128,
    invert: false,
    smoothing: 3,
    simplifyTolerance: 1.5,
    minArea: 24,
    keepHoles: true,
    maxPaths: 120,
  });

  let source = $state<LoadedImage | null>(null);
  let document = $state<VecDocument | null>(null);
  let selectedPathId = $state<string | null>(null);
  let tool = $state<EditorTool>('select');
  let busy = $state(false);
  let statusMessage = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  /**
   * Bumped by every mutation, including undo and redo. The tool watches it to
   * re-sync the canvas, so programmatic and interactive edits take one path.
   */
  let revision = $state(0);

  function touch() {
    revision++;
  }

  /**
   * Runs `fn` against whatever document is current.
   *
   * Commands must never capture the document in their closures. `$state` hands
   * back a *new* proxy when the same object is assigned again after a null — as
   * happens when a trace is undone and redone — and writes through the stale
   * proxy do not surface on the new one, so a captured reference silently stops
   * mutating the document the UI is reading.
   */
  function withDocument(fn: (doc: VecDocument) => void): void {
    if (document) fn(document);
  }

  /** Wraps a mutation pair so every command bumps the revision on both sides. */
  function command(
    prefix: string,
    payload: TracerPayload,
    apply: () => void,
    revert: () => void,
  ): Command<TracerPayload> {
    return {
      id: commandId(prefix),
      actionType: `svg-tracer/${payload.kind}`,
      payload,
      apply: () => {
        apply();
        touch();
      },
      revert: () => {
        revert();
        touch();
      },
    };
  }

  return {
    history,

    get settings() {
      return settings;
    },
    get source() {
      return source;
    },
    get document() {
      return document;
    },
    get selectedPathId() {
      return selectedPathId;
    },
    set selectedPathId(value: string | null) {
      selectedPathId = value;
    },
    get selectedPath(): VecPath | null {
      if (!document || !selectedPathId) return null;
      return findPath(document, selectedPathId) ?? null;
    },
    get tool() {
      return tool;
    },
    set tool(value: EditorTool) {
      tool = value;
    },
    get busy() {
      return busy;
    },
    set busy(value: boolean) {
      busy = value;
    },
    get statusMessage() {
      return statusMessage;
    },
    set statusMessage(value: string | null) {
      statusMessage = value;
    },
    get errorMessage() {
      return errorMessage;
    },
    set errorMessage(value: string | null) {
      errorMessage = value;
    },
    get revision() {
      return revision;
    },

    get canTrace() {
      return source !== null && !busy;
    },
    get canExport() {
      return document !== null && document.paths.length > 0 && !busy;
    },

    /** Worker options assembled from the UI settings. */
    get traceOptions(): Partial<TraceOptions> {
      return {
        threshold: settings.autoThreshold ? 'otsu' : settings.threshold,
        invert: settings.invert,
        smoothing: settings.smoothing,
        simplifyTolerance: settings.simplifyTolerance,
        minArea: settings.minArea,
        keepHoles: settings.keepHoles,
        maxPaths: settings.maxPaths,
      };
    },

    /** A new image resets everything — the old undo stack refers to gone pixels. */
    setSource(image: LoadedImage | null) {
      source = image;
      document = null;
      selectedPathId = null;
      errorMessage = null;
      statusMessage = null;
      history.clear();
      touch();
    },

    commitTrace(result: TraceResult) {
      const before = document;
      const beforeSelection = selectedPathId;
      const after = documentFromTrace(result);
      history.execute(
        command(
          'trace',
          { kind: 'trace', before, after },
          () => {
            document = after;
            // Selection is part of the state a trace replaces: undoing back to
            // the previous document must not leave a handle on a gone path.
            selectedPathId = null;
          },
          () => {
            document = before;
            selectedPathId = beforeSelection;
          },
        ),
      );
    },

    /** Live drag position. Deliberately records nothing — see commitNodeDrag. */
    dragNode(ref: NodeRef, to: Point) {
      if (!document) return;
      setNode(document, ref, to);
      touch();
    },

    /**
     * Coalesces a whole drag into one command. The model already holds the final
     * position, so this records rather than executes.
     */
    commitNodeDrag(ref: NodeRef, from: Point, to: Point) {
      if (!document) return;
      history.record(
        command(
          'node-move',
          { kind: 'node-move', ref, from, to },
          () => withDocument((doc) => setNode(doc, ref, to)),
          () => withDocument((doc) => setNode(doc, ref, from)),
        ),
      );
    },

    insertNodeAt(ref: SegmentRef, node: Point) {
      if (!document) return;
      history.execute(
        command(
          'node-insert',
          { kind: 'node-insert', ref, node },
          () => withDocument((doc) => insertNode(doc, ref, node)),
          () => withDocument((doc) => removeNode(doc, ref)),
        ),
      );
      statusMessage = 'Node added.';
    },

    deleteNodeAt(ref: NodeRef) {
      if (!document) return;
      if (!canRemoveNode(document, ref)) {
        errorMessage = 'A closed shape needs at least three nodes.';
        return;
      }
      const node = document.paths
        .find((path) => path.id === ref.pathId)
        ?.subpaths[ref.subpathIndex]?.nodes[ref.nodeIndex];
      if (!node) return;
      const removed = { x: node.x, y: node.y };
      errorMessage = null;
      history.execute(
        command(
          'node-delete',
          { kind: 'node-delete', ref, node: removed },
          () => withDocument((doc) => removeNode(doc, ref)),
          () => withDocument((doc) => insertNode(doc, ref, removed)),
        ),
      );
    },

    deleteSelectedPath() {
      if (!document || !selectedPathId) return;
      const found = document.paths.findIndex((path) => path.id === selectedPathId);
      if (found < 0) return;
      // Snapshot the path so revert restores it even after the proxy it came
      // from has been replaced.
      const target = $state.snapshot(document.paths[found]) as VecPath;
      const id = target.id;
      const previousSelection = selectedPathId;

      history.execute(
        command(
          'path-delete',
          { kind: 'path-delete', index: found, path: target },
          () =>
            withDocument((doc) => {
              removePath(doc, id);
              selectedPathId = null;
            }),
          () =>
            withDocument((doc) => {
              // Re-inserting at the recorded index restores z-order, not just
              // the path itself.
              insertPath(doc, found, structuredClone(target));
              selectedPathId = previousSelection;
            }),
        ),
      );
    },

    /**
     * Style edits commit on `change` rather than `input`, so dragging a colour
     * picker leaves one entry on the undo stack instead of forty.
     */
    setSelectedStyle(patch: Partial<PathStyle>) {
      if (!document || !selectedPathId) return;
      const path = findPath(document, selectedPathId);
      if (!path) return;
      const before = { ...path.style };
      const after = { ...path.style, ...patch };
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      const id = path.id;

      history.execute(
        command(
          'path-style',
          { kind: 'path-style', pathId: id, before, after },
          () =>
            withDocument((doc) => {
              const target = findPath(doc, id);
              if (target) target.style = { ...after };
            }),
          () =>
            withDocument((doc) => {
              const target = findPath(doc, id);
              if (target) target.style = { ...before };
            }),
        ),
      );
    },

    togglePathVisible(id: string) {
      if (!document) return;
      const path = findPath(document, id);
      if (!path) return;
      // Visibility is a view toggle, not a document edit — it stays off the
      // undo stack on purpose.
      path.visible = !path.visible;
      touch();
    },
  };
}

export type SvgTracerStore = ReturnType<typeof createSvgTracerStore>;
