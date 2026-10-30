import { imageDataFromElement } from './imageData';

/** Reads an image file (PNG, JPEG, WebP, …) into pixels. */
export async function loadImageFile(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  try {
    return imageDataFromElement(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** `monster.png` → `monster` */
export const stemOf = (filename: string): string => filename.replace(/\.[^.]+$/, '') || 'image';
