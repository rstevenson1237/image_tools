import { downloadText } from '../../core/utils/download';
import type { VecDocument } from './model';
import { documentToSvg, suggestSvgFilename, type SvgExportOptions } from './svg';

/** Serialises the document and hands it to the browser as an .svg download. */
export function exportSvg(
  doc: VecDocument,
  sourceName: string,
  options: SvgExportOptions = {},
): void {
  downloadText(documentToSvg(doc, options), suggestSvgFilename(sourceName), 'image/svg+xml');
}

/**
 * Copies the markup to the clipboard.
 *
 * The Clipboard API needs a secure context, which localhost and Pages both
 * satisfy — but it can still be refused by permissions policy, so the caller
 * surfaces the rejection rather than assuming success.
 */
export async function copySvgToClipboard(
  doc: VecDocument,
  options: SvgExportOptions = {},
): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable in this browser.');
  }
  await navigator.clipboard.writeText(documentToSvg(doc, options));
}
