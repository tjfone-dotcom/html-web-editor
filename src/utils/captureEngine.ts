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

/** Saved iframe dimensions for restore after capture */
interface SavedIframeDimensions {
  height: string;
  maxHeight: string;
  parentHeight: string;
  parentMaxHeight: string;
  parentOverflow: string;
}

/**
 * Temporarily expand the iframe height to the full document scroll height.
 * This prevents tall sections from being clipped during capture while
 * keeping the width at 1280px for consistent horizontal framing.
 */
function expandIframeForCapture(
  iframe: HTMLIFrameElement
): SavedIframeDimensions | null {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return null;

    const scrollH = Math.max(
      doc.body?.scrollHeight ?? 0,
      doc.documentElement?.scrollHeight ?? 0
    );
    // Only expand if content is taller than current iframe
    if (scrollH <= iframe.clientHeight) return null;

    const parent = iframe.parentElement;
    const saved: SavedIframeDimensions = {
      height: iframe.style.height,
      maxHeight: iframe.style.maxHeight,
      parentHeight: parent?.style.height ?? '',
      parentMaxHeight: parent?.style.maxHeight ?? '',
      parentOverflow: parent?.style.overflow ?? '',
    };

    // Expand parent container too (it may clip the iframe)
    if (parent) {
      parent.style.height = scrollH + 'px';
      parent.style.maxHeight = 'none';
      parent.style.overflow = 'visible';
    }
    iframe.style.height = scrollH + 'px';
    iframe.style.maxHeight = 'none';

    return saved;
  } catch {
    return null;
  }
}

/** Restore iframe dimensions after capture */
function restoreIframe(
  iframe: HTMLIFrameElement,
  saved: SavedIframeDimensions | null
): void {
  if (!saved) return;
  iframe.style.height = saved.height;
  iframe.style.maxHeight = saved.maxHeight;
  const parent = iframe.parentElement;
  if (parent) {
    parent.style.height = saved.parentHeight;
    parent.style.maxHeight = saved.parentMaxHeight;
    parent.style.overflow = saved.parentOverflow;
  }
}

/** Wait for a layout reflow after resizing */
function waitForReflow(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100)));
}

/**
 * Request section detection from the iframe.
 * Temporarily expands the iframe height so tall sections are measured correctly.
 * Returns detected sections via bridge message.
 */
export async function requestSectionDetection(
  iframe: HTMLIFrameElement
): Promise<SectionInfo[]> {
  // Expand iframe so getBoundingClientRect() returns true content heights
  const saved = expandIframeForCapture(iframe);
  if (saved) await waitForReflow();

  const sections = await new Promise<SectionInfo[]>((resolve) => {
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

  // Restore iframe after detection
  restoreIframe(iframe, saved);

  return sections;
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
 * Temporarily expands the iframe height so tall sections are not clipped.
 */
export async function captureAllSections(
  iframe: HTMLIFrameElement,
  sections: SectionInfo[],
  options: CaptureOptions,
  onProgress?: (current: number, total: number) => void
): Promise<(Blob | null)[]> {
  // Expand iframe height for the entire capture session
  const saved = expandIframeForCapture(iframe);
  if (saved) await waitForReflow();

  const results: (Blob | null)[] = [];
  try {
    for (let i = 0; i < sections.length; i++) {
      onProgress?.(i + 1, sections.length);
      const blob = await captureSection(iframe, sections[i], options);
      results.push(blob);
    }
  } finally {
    // Always restore iframe dimensions
    restoreIframe(iframe, saved);
  }

  return results;
}
