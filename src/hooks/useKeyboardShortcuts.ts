import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { downloadHtml } from '../utils/htmlSerializer';

/**
 * Global keyboard shortcuts for the editor.
 * Suppresses when Monaco editor or contentEditable elements are focused.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const active = document.activeElement;

      // Suppress when Monaco editor is focused (uses textarea inside .monaco-editor)
      if (active) {
        const isMonaco = active.closest?.('.monaco-editor');
        if (isMonaco) return;

        // Suppress when contentEditable is focused
        if (active instanceof HTMLElement && active.isContentEditable) return;

        // Suppress inside textareas and inputs (property panel controls)
        const tag = active.tagName?.toLowerCase();
        if (tag === 'textarea' || (tag === 'input' && (active as HTMLInputElement).type !== 'range')) {
          // Only suppress for undo/redo so the browser handles text undo natively
          // Actually, let Ctrl+Z/Y pass through for text inputs
          if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
            return;
          }
        }
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z: undo
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y: redo
      if ((isCtrl && e.key === 'z' && e.shiftKey) || (isCtrl && e.key === 'y')) {
        e.preventDefault();
        useEditorStore.getState().redo();
        return;
      }

      // Ctrl+S: save HTML file
      if (isCtrl && e.key === 's') {
        e.preventDefault();
        const { htmlContent, fileName } = useEditorStore.getState();
        if (htmlContent) {
          downloadHtml(htmlContent, fileName ?? 'untitled.html');
        }
        return;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
