export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Offers a file to the user. On the iPhone it opens the share sheet ("Guardar en Archivos",
 * AirDrop, Mail…); elsewhere it downloads the file. Must be called straight from a tap: iOS
 * refuses to open the share sheet after an await, so prepare the file beforehand.
 */
export async function saveFile(file: File): Promise<SaveResult> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Share sheet not available after all: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
