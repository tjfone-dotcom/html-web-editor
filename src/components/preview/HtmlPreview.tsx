import { useEffect, useRef, useState, useCallback, type SyntheticEvent } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { getBridgeScript } from '../../bridge/bridge';

export default function HtmlPreview() {
  const htmlContent = useEditorStore((s) => s.htmlContent);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const setHtmlContent = useEditorStore((s) => s.setHtmlContent);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const prevBlobUrlRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Flag to prevent re-injection when we receive DOM_UPDATED from iframe
  const suppressNextUpdate = useRef(false);
  // Debounce timer for DOM_UPDATED history pushes
  const domUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    // Revoke previous Blob URL
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
    }

    if (htmlContent) {
      if (suppressNextUpdate.current) {
        suppressNextUpdate.current = false;
        return;
      }
      const injected = injectBridge(htmlContent);
      const blob = new Blob([injected], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setIsIframeLoading(true);
      setBlobUrl(url);
      prevBlobUrlRef.current = url;
    } else {
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
  }, [htmlContent, injectBridge]);

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
        // Text change is followed by DOM_UPDATED, so we just let DOM_UPDATED handle store update
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

  if (!blobUrl) {
    return null;
  }

  const handleIframeLoad = useCallback((_e: SyntheticEvent<HTMLIFrameElement>) => {
    setIsIframeLoading(false);
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center p-4 relative">
      {isIframeLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500">로딩 중...</span>
          </div>
        </div>
      )}
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
          title="HTML 미리보기"
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}
