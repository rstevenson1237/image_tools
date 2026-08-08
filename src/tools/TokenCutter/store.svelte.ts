import { createHistory, commandId, type Command } from '../../core/stores/history.svelte';
import type { Point } from '../../core/utils/geometry';
import type { LoadedImage } from '../../core/canvas/types';
import type { SelectionMode } from './canvas';

export interface ExtractionSettings {
  color: string;
  autoThreshold: boolean;
  threshold: number;
  invert: boolean;
  keepLargestBlob: boolean;
  smoothing: number;
  padding: number;
  square: boolean;
}

/** What an undo/redo step restores. */
interface ExtractionSnapshot {
  silhouette: ImageData | null;
  polygon: Point[] | null;
}

/**
 * Token Cutter state. Created per mount so the undo stack and settings die with
 * the tool rather than leaking into whatever the user opens next.
 */
export function createTokenCutterStore() {
  const history = createHistory<ExtractionSnapshot>();

  let mode = $state<SelectionMode>('lasso');
  let settings = $state<ExtractionSettings>({
    color: '#000000',
    autoThreshold: true,
    threshold: 128,
    invert: false,
    keepLargestBlob: true,
    smoothing: 5,
    padding: 8,
    square: false,
  });

  let source = $state<LoadedImage | null>(null);
  let silhouette = $state<ImageData | null>(null);
  let polygon = $state<Point[] | null>(null);
  let busy = $state(false);
  let statusMessage = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);

  function snapshot(): ExtractionSnapshot {
    return { silhouette, polygon };
  }

  function restore(state: ExtractionSnapshot) {
    silhouette = state.silhouette;
    polygon = state.polygon;
  }

  return {
    history,

    get mode() {
      return mode;
    },
    set mode(value: SelectionMode) {
      mode = value;
    },

    get settings() {
      return settings;
    },

    get source() {
      return source;
    },
    get silhouette() {
      return silhouette;
    },
    get polygon() {
      return polygon;
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

    get canExtract() {
      return source !== null && polygon !== null && !busy;
    },
    get canExport() {
      return silhouette !== null && !busy;
    },

    /** A new image resets everything — the old undo stack refers to gone pixels. */
    setSource(image: LoadedImage | null) {
      source = image;
      silhouette = null;
      polygon = null;
      errorMessage = null;
      statusMessage = null;
      history.clear();
    },

    setPolygon(next: Point[] | null) {
      polygon = next;
    },

    /**
     * Records a completed extraction as an undoable step. The command captures
     * the before/after snapshots directly, which is cheap because ImageData is
     * only ever replaced, never mutated in place.
     */
    commitExtraction(result: ImageData, usedPolygon: Point[]) {
      const before = snapshot();
      const after: ExtractionSnapshot = { silhouette: result, polygon: usedPolygon };
      const command: Command<ExtractionSnapshot> = {
        id: commandId('extract'),
        actionType: 'token-cutter/extract',
        payload: after,
        apply: () => restore(after),
        revert: () => restore(before),
      };
      history.execute(command);
    },
  };
}

export type TokenCutterStore = ReturnType<typeof createTokenCutterStore>;
