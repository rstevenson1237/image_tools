import type { FabricImage } from 'fabric';
import type { ImagePlacement } from '../utils/geometry';

/** Payload handed to a tool when the shared stage ingests an image. */
export interface LoadedImage {
  object: FabricImage;
  placement: ImagePlacement;
  /** Full-resolution pixels of the source image. */
  pixels: ImageData;
  filename: string;
}
