import { useEffect, useLayoutEffect, useRef, useState, useCallback, type SyntheticEvent } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { useT } from '../../i18n';
import { getBridgeScript } from '../../bridge/bridge';
import { lastCursorLine, findHtmlContextAtLine, findSlideIndexAtLine } from '../../utils/codeSync';

/** Detect slide-deck documents by checking for common slide framework patterns */
function isSlideDocument(html: string): boolean {
  return /class="[^"]*\bslide\b/.test(html) ||
         /\.reveal\b/.test(html) ||
         /Reveal\.initialize/.test(html) ||
         /class="[^"]*\bswiper\b/.test(html) ||
         /class="[^"]*\bstep\b[^"]*"/.test(html) ||
         /\.slick\(/.test(html);
}

/** Compute child-index path from root to element (mirrors bridge's getNodeIndexPath) */
function getNodePath(el: Element, root: Element): number[] {
  const path: number[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
    let idx = 0;
    for (let i = 0; i < parent.children.length; i++) {
      if (parent.children[i] === cur) { idx = i; break; }
    }
    path.unshift(idx);
    cur = parent;
  }
  return path;
}

export default function HtmlPreview() {
  const t = useT();
  const htmlContent = useEditorStore((s) => s.htmlContent);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const setHtmlContent = useEditorStore((s) => s.setHtmlContent);
  const isUndoRedo = useEditorStore((s) => s.isUndoRedo);
  const viewMode = useEditorStore((s) => s.viewMode);
  const fixedViewport = useEditorStore((s) => s.fixedViewport);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevBlobUrlRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Flag to prevent re-injection when we receive DOM_UPDATED from iframe
  const suppressNextUpdate = useRef(false);
  // Debounce timer for DOM_UPDATED history pushes
  const domUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag: content changed while in code mode, needs sync on switch back
  const needsSyncRef = useRef(false);
  // Slide index tracking: updated by SLIDE_INDEX_CHANGED messages from bridge
  const slideIndexRef = useRef<number>(0);
  // Pending slide navigation after iframe reload
  const pendingSlideNavRef = useRef<number | null>(null);
  // Pending scroll state restore after iframe reload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingScrollRestore = useRef<any[] | null>(null);
  // Pending HTML context scroll after iframe reload (code→preview)
  const pendingHtmlContext = useRef<{ before: string; after: string } | null>(null);

  /** Inject bridge script and html2canvas into HTML before </body> or at end */
  const injectBridge = useCallback((html: string): string => {
    const html2canvasScript = `<script data-bridge src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>`;
    const bridgeScript = `<script data-bridge>${getBridgeScript()}<\/script>`;
    const scripts = html2canvasScript + '\n' + bridgeScript;
    const bodyCloseIndex = html.lastIndexOf('</body>');
    if (bodyCloseIndex !== -1) {
      return html.slice(0, bodyCloseIndex) + scripts + html.slice(bodyCloseIndex);
    }
    return html + scripts;
  }, []);

  /** Create a new blob URL and set it (triggers iframe reload) */
  const reloadIframe = useCallback((html: string) => {
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
    }
    const injected = injectBridge(html);
    const blob = new Blob([injected], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setIsIframeLoading(true);
    setBlobUrl(url);
    prevBlobUrlRef.current = url;
  }, [injectBridge]);

  /**
   * Synchronously capture scroll state from iframe (all scrollable elements).
   * Works because sandbox="allow-scripts allow-same-origin" + blob URL = same origin.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const captureIframeScroll = useCallback((): any[] | null => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = [];
      // Window scroll
      results.push({ type: 'window', scrollX: win.scrollX, scrollY: win.scrollY });
      // documentElement
      if (win.document.documentElement.scrollTop > 0 || win.document.documentElement.scrollLeft > 0) {
        results.push({
          type: 'docEl',
          scrollTop: win.document.documentElement.scrollTop,
          scrollLeft: win.document.documentElement.scrollLeft,
        });
      }
      // body
      if (win.document.body && (win.document.body.scrollTop > 0 || win.document.body.scrollLeft > 0)) {
        results.push({
          type: 'body',
          scrollTop: win.document.body.scrollTop,
          scrollLeft: win.document.body.scrollLeft,
        });
      }
      // All scrollable internal containers
      const all = win.document.body?.querySelectorAll('*') || [];
      for (let i = 0; i < all.length; i++) {
        const el = all[i] as HTMLElement;
        if (el.scrollTop === 0 && el.scrollLeft === 0) continue;
        const cs = win.getComputedStyle(el);
        const ov = cs.overflow + ' ' + cs.overflowX + ' ' + cs.overflowY;
        if (ov.includes('auto') || ov.includes('scroll')) {
          const path = getNodePath(el, win.document.body);
          results.push({ type: 'element', path, scrollTop: el.scrollTop, scrollLeft: el.scrollLeft });
        }
      }
      return results.length > 0 ? results : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (htmlContent) {
      // Undo/redo
      if (isUndoRedo) {
        useEditorStore.setState({ isUndoRedo: false });

        if (isSlideDocument(htmlContent)) {
          // Slide deck: full reload + navigate to slide saved in history
          const targetSlide = useEditorStore.getState().undoRedoSlideIndex;
          useEditorStore.setState({ undoRedoSlideIndex: null });
          pendingSlideNavRef.current = targetSlide ?? slideIndexRef.current;
          reloadIframe(htmlContent);
        } else {
          // Scroll document: synchronously capture scroll → reload → restore
          pendingScrollRestore.current = captureIframeScroll();
          reloadIframe(htmlContent);
        }
        return;
      }

      if (suppressNextUpdate.current) {
        suppressNextUpdate.current = false;
        return;
      }

      // In code mode, skip blob recreation — sync when switching back
      if (viewMode === 'code') {
        needsSyncRef.current = true;
        return;
      }

      // Code→Preview transition: let the sync effect (below) handle reload with scroll info
      if (needsSyncRef.current) return;

      // Normal content update: create blob URL
      reloadIframe(htmlContent);
    } else {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
      setBlobUrl(null);
      prevBlobUrlRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = null;
      }
    };
  }, [htmlContent, isUndoRedo, viewMode, reloadIframe, captureIframeScroll]);

  // When switching back to preview, sync code edits and scroll to cursor position
  useEffect(() => {
    if (viewMode === 'preview') {
      const cursorLine = lastCursorLine.value;
      lastCursorLine.value = null;

      if (needsSyncRef.current) {
        needsSyncRef.current = false;
        const currentHtml = useEditorStore.getState().htmlContent;
        if (currentHtml) {
          if (isSlideDocument(currentHtml)) {
            // Slide deck: navigate to slide matching cursor position, or stay on current slide
            pendingSlideNavRef.current = cursorLine
              ? findSlideIndexAtLine(currentHtml, cursorLine)
              : slideIndexRef.current;
            reloadIframe(currentHtml);
          } else if (cursorLine) {
            // Code→preview with cursor: scroll to cursor element after reload
            pendingHtmlContext.current = findHtmlContextAtLine(currentHtml, cursorLine);
            reloadIframe(currentHtml);
          } else {
            // Code edits but no cursor info: capture scroll → reload → restore
            pendingScrollRestore.current = captureIframeScroll();
            reloadIframe(currentHtml);
          }
        }
      } else if (cursorLine) {
        // No code edits, but navigate to cursor position (iframe already alive)
        const currentHtml = useEditorStore.getState().htmlContent;
        if (currentHtml && iframeRef.current?.contentWindow) {
          if (isSlideDocument(currentHtml)) {
            // Slide deck without edits: navigate to slide matching cursor position
            const targetSlide = findSlideIndexAtLine(currentHtml, cursorLine);
            if (targetSlide !== slideIndexRef.current) {
              iframeRef.current.contentWindow.postMessage({
                type: 'NAVIGATE_TO_SLIDE',
                payload: { index: targetSlide },
              }, '*');
            }
          } else {
            const ctx = findHtmlContextAtLine(currentHtml, cursorLine);
            if (ctx) {
              iframeRef.current.contentWindow.postMessage({
                type: 'SCROLL_TO_HTML_CONTEXT',
                payload: ctx,
              }, '*');
            }
          }
        }
      }
    }
  }, [viewMode, reloadIframe, captureIframeScroll]);

  // Listen for messages from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const msg = e.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'ELEMENT_SELECTED' && msg.payload) {
        setSelectedElement(msg.payload);
      }

      if (msg.type === 'DOM_UPDATED' && msg.payload?.html) {
        // Debounce history pushes so slider dragging doesn't flood undo stack
        if (domUpdateTimerRef.current) {
          clearTimeout(domUpdateTimerRef.current);
        }
        domUpdateTimerRef.current = setTimeout(() => {
          suppressNextUpdate.current = true;
          setHtmlContent(msg.payload.html, '요소 편집');
          domUpdateTimerRef.current = null;
        }, 300);
      }

      if (msg.type === 'TEXT_CHANGED' && msg.payload) {
        // Update selectedElement.textContent in real-time while user is typing
        const current = useEditorStore.getState().selectedElement;
        if (current && current.editorId === msg.payload.editorId) {
          setSelectedElement({ ...current, textContent: msg.payload.text });
        }
      }

      // Track current slide index from bridge
      if (msg.type === 'SLIDE_INDEX_CHANGED' && msg.payload) {
        // Skip update during reload (pending navigation) to prevent bridge init overwriting saved index
        if (pendingSlideNavRef.current === null) {
          slideIndexRef.current = msg.payload.index;
          useEditorStore.setState({ currentSlideIndex: msg.payload.index });
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (domUpdateTimerRef.current) {
        clearTimeout(domUpdateTimerRef.current);
      }
    };
  }, [setSelectedElement, setHtmlContent]);

  // Listen for bridge-navigate custom events from ElementInfo buttons
  useEffect(() => {
    function handleBridgeNavigate(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.type && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: detail.type }, '*');
      }
    }
    window.addEventListener('bridge-navigate', handleBridgeNavigate);
    return () => window.removeEventListener('bridge-navigate', handleBridgeNavigate);
  }, []);

  /** Measure container and return the scale factor to fit 1280×720 inside it */
  const measureScaleFactor = useCallback((): number => {
    if (!containerRef.current) return 1;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const w = width - 32; // p-4 padding (16px each side)
    const h = height - 32;
    if (w <= 0 || h <= 0) return 1;
    return Math.min(w / 1280, h / 720);
  }, []);

  // Fixed viewport: compute scale factor on mount, toggle, and resize
  // `hasContent` ensures re-run when container first appears in the DOM
  const hasContent = blobUrl !== null;
  useLayoutEffect(() => {
    if (!fixedViewport || !containerRef.current) {
      if (!fixedViewport) setScaleFactor(1);
      return;
    }

    // Synchronous initial compute (before paint → no flash at unscaled 1280×720)
    setScaleFactor(measureScaleFactor());

    // Async observer for subsequent window/container resizes
    const el = containerRef.current;
    const observer = new ResizeObserver(() => setScaleFactor(measureScaleFactor()));
    observer.observe(el);
    return () => observer.disconnect();
  }, [fixedViewport, hasContent, measureScaleFactor]);

  const handleIframeLoad = useCallback((_e: SyntheticEvent<HTMLIFrameElement>) => {
    setIsIframeLoading(false);

    // Slide deck: navigate to saved slide index
    if (pendingSlideNavRef.current !== null && iframeRef.current?.contentWindow) {
      const idx = pendingSlideNavRef.current;
      pendingSlideNavRef.current = null;
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'NAVIGATE_TO_SLIDE',
          payload: { index: idx },
        }, '*');
      }, 200);
      return;
    }

    // HTML context scroll (code→preview)
    if (pendingHtmlContext.current && iframeRef.current?.contentWindow) {
      const ctx = pendingHtmlContext.current;
      pendingHtmlContext.current = null;
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'SCROLL_TO_HTML_CONTEXT',
          payload: ctx,
        }, '*');
      }, 300);
      return;
    }

    // Scroll position restore (undo/redo)
    if (pendingScrollRestore.current && iframeRef.current?.contentWindow) {
      const state = pendingScrollRestore.current;
      pendingScrollRestore.current = null;
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'RESTORE_SCROLL',
          payload: { state },
        }, '*');
      }, 300);
    }
  }, []);

  if (!blobUrl) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center p-4 relative overflow-hidden">
      {isIframeLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500">{t('loading')}</span>
          </div>
        </div>
      )}
      {fixedViewport ? (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-lg"
          style={{
            width: 1280 * scaleFactor,
            height: 720 * scaleFactor,
          }}
        >
          <iframe
            ref={iframeRef}
            src={blobUrl}
            sandbox="allow-scripts allow-same-origin"
            title={t('htmlPreview')}
            style={{
              width: 1280,
              height: 720,
              border: 'none',
              transform: `scale(${scaleFactor})`,
              transformOrigin: 'top left',
            }}
            onLoad={handleIframeLoad}
          />
        </div>
      ) : (
        <div
          className="bg-white shadow-lg"
          style={{
            aspectRatio: '16 / 9',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
          }}
        >
          <iframe
            ref={iframeRef}
            src={blobUrl}
            sandbox="allow-scripts allow-same-origin"
            title={t('htmlPreview')}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
          />
        </div>
      )}
    </div>
  );
}
