import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { getBridgeScript } from '../../bridge/bridge';

export default function HtmlPreview() {
  const htmlContent = useEditorStore((s) => s.htmlContent);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const setHtmlContent = useEditorStore((s) => s.setHtmlContent);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const prevBlobUrlRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Flag to prevent re-injection when we receive DOM_UPDATED from iframe
  const suppressNextUpdate = useRef(false);

  /** Inject bridge script into HTML before </body> or at end */
  const injectBridge = useCallback((html: string): string => {
    const bridgeScript = `<script data-bridge>${getBridgeScript()}<\/script>`;
    const bodyCloseIndex = html.lastIndexOf('</body>');
    if (bodyCloseIndex !== -1) {
      return html.slice(0, bodyCloseIndex) + bridgeScript + html.slice(bodyCloseIndex);
    }
    return html + bridgeScript;
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
        suppressNextUpdate.current = true;
        setHtmlContent(msg.payload.html, '요소 편집');
      }

      if (msg.type === 'TEXT_CHANGED' && msg.payload) {
        // Text change is followed by DOM_UPDATED, so we just let DOM_UPDATED handle store update
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setSelectedElement, setHtmlContent]);

  if (!blobUrl) {
    return null;
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
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
        />
      </div>
    </div>
  );
}
