/**
 * Browser download helpers.
 *
 * Everything in this suite is produced client-side, so "save" always means
 * handing the browser a blob and clicking a synthetic anchor. The anchor dance
 * lives here once rather than in each tool's export module.
 */

/** Triggers a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can race the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Triggers a browser download of a text payload. */
export function downloadText(text: string, filename: string, mimeType = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: `${mimeType};charset=utf-8` }), filename);
}

/** Triggers a browser download of a canvas as a PNG. */
export async function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to encode PNG');
  downloadBlob(blob, filename);
}
