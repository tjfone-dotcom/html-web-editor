/**
 * Capture engine that orchestrates section capture via bridge messages to the iframe.
 * html2canvas runs inside the iframe to avoid cross-origin issues.
 */

import type { SectionInfo } from './sectionDetector';

export interface CaptureOptions {
  format: 'png' | 'jpeg';
  scale: number;
  quality?: number;
}

/**
 * Request section detection from the iframe.
 * Returns detected sections via bridge message.
 */
export function requestSectionDetection(
  iframe: HTMLIFrameElement
): Promise<SectionInfo[]> {
  return new Promise((resolve) => {
    function handler(e: MessageEvent) {
      if (e.data?.type === 'SECTIONS_DETECTED') {
        window.removeEventListener('message', handler);
        resolve(e.data.payload.sections || []);
      }
    }
    window.addEventListener('message', handler);
    iframe.contentWindow?.postMessage({ type: 'DETECT_SECTIONS' }, '*');

    // Timeout after 10 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve([]);
    }, 10000);
  });
}

/**
 * Capture a single section from the iframe.
 * Returns the captured image as a Blob.
 */
export function captureSection(
  iframe: HTMLIFrameElement,
  section: SectionInfo,
  options: CaptureOptions
): Promise<Blob | null> {
  return new Promise((resolve) => {
    function handler(e: MessageEvent) {
      if (
        e.data?.type === 'SECTION_CAPTURED' &&
        e.data.payload?.index === section.index
      ) {
        window.removeEventListener('message', handler);
        if (e.data.payload.dataUrl) {
          fetch(e.data.payload.dataUrl)
            .then((res) => res.blob())
            .then((blob) => resolve(blob))
            .catch(() => resolve(null));
        } else {
          resolve(null);
        }
      }
    }
    window.addEventListener('message', handler);
    iframe.contentWindow?.postMessage(
      {
        type: 'CAPTURE_SECTION',
        payload: {
          index: section.index,
          scale: options.scale,
          format: options.format === 'jpeg' ? 'image/jpeg' : 'image/png',
          quality: options.quality ?? 0.92,
          revealH: section.revealH,
          revealV: section.revealV,
        },
      },
      '*'
    );

    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 30000);
  });
}

/**
 * Capture all sections sequentially.
 */
export async function captureAllSections(
  iframe: HTMLIFrameElement,
  sections: SectionInfo[],
  options: CaptureOptions,
  onProgress?: (current: number, total: number) => void
): Promise<(Blob | null)[]> {
  const results: (Blob | null)[] = [];

  for (let i = 0; i < sections.length; i++) {
    onProgress?.(i + 1, sections.length);
    const blob = await captureSection(iframe, sections[i], options);
    results.push(blob);
  }

  return results;
}
