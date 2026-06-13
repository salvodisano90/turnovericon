// utils/platformShare.ts — condivisione testo cross-platform.
// Web: download di un file; Nativo: foglio di condivisione di sistema.

import { Platform, Share } from 'react-native';

export async function shareOrDownloadText(filename: string, text: string, mimeType = 'application/json'): Promise<void> {
  if (Platform.OS === 'web') {
    const g: any = globalThis as any;
    try {
      const blob = new g.Blob([text], { type: mimeType });
      const url = g.URL.createObjectURL(blob);
      const a = g.document.createElement('a');
      a.href = url;
      a.download = filename;
      g.document.body.appendChild(a);
      a.click();
      g.document.body.removeChild(a);
      setTimeout(() => g.URL.revokeObjectURL(url), 1000);
    } catch {
      /* download non disponibile */
    }
    return;
  }
  try {
    await Share.share({ message: text });
  } catch {
    /* condivisione annullata */
  }
}
