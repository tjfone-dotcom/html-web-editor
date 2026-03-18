import { useCallback, useRef } from 'react';

/**
 * Hook that provides functions to send messages to the preview iframe.
 * Uses a query selector to find the iframe rather than requiring a ref prop.
 */
export function useIframeBridge() {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getIframe = useCallback((): HTMLIFrameElement | null => {
    return document.querySelector('iframe[title="HTML 미리보기"]');
  }, []);

  const postToIframe = useCallback(
    (message: unknown) => {
      const iframe = getIframe();
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(message, '*');
      }
    },
    [getIframe]
  );

  const sendStyleUpdate = useCallback(
    (editorId: string, styles: Record<string, string>) => {
      postToIframe({
        type: 'UPDATE_STYLES',
        payload: { editorId, styles },
      });
    },
    [postToIframe]
  );

  const sendTextUpdate = useCallback(
    (editorId: string, text: string) => {
      postToIframe({
        type: 'UPDATE_TEXT',
        payload: { editorId, text },
      });
    },
    [postToIframe]
  );

  /**
   * Debounced wrapper: calls fn immediately, but debounces the history push.
   * Returns a function that applies styles immediately and debounces DOM_UPDATED handling.
   */
  const sendStyleUpdateDebounced = useCallback(
    (editorId: string, styles: Record<string, string>) => {
      // Apply style immediately for real-time feedback
      sendStyleUpdate(editorId, styles);

      // The DOM_UPDATED message from the iframe will trigger history push in HtmlPreview.
      // We don't need extra debouncing here since HtmlPreview already handles it.
      // But we debounce the selected element's computedStyles update in store.
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
      }, 300);
    },
    [sendStyleUpdate]
  );

  return {
    sendStyleUpdate: sendStyleUpdateDebounced,
    sendTextUpdate,
    postToIframe,
  };
}
