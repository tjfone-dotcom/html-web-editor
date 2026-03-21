import { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnChange } from '@monaco-editor/react';
import { useEditorStore } from '../../store/editorStore';
import { setMonacoEditorInstance, pendingCodeScroll } from '../../utils/codeSync';

export default function CodeEditor() {
  const htmlContent = useEditorStore((s) => s.htmlContent);
  const setHtmlContent = useEditorStore((s) => s.setHtmlContent);
  const viewMode = useEditorStore((s) => s.viewMode);
  const isSyncingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  const handleChange: OnChange = useCallback(
    (value) => {
      if (isSyncingRef.current) {
        isSyncingRef.current = false;
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (value !== undefined) {
          setHtmlContent(value, 'Code edit');
        }
      }, 500);
    },
    [setHtmlContent],
  );

  // Simple approach: layout first, then wait 500ms for Monaco to fully stabilize,
  // then apply scroll/highlight. Monaco's internal ResizeObserver needs time to settle.
  useEffect(() => {
    if (viewMode === 'code' && editorRef.current) {
      const editor = editorRef.current;

      // Trigger layout recalculation
      requestAnimationFrame(() => {
        editor.layout();
      });

      // Wait for all internal layout events to settle, then scroll/highlight
      const timer = setTimeout(() => {
        const line = pendingCodeScroll.line;
        pendingCodeScroll.line = null;
        if (line) {
          editor.revealLineInCenter(line);
          const model = editor.getModel();
          const maxCol = model?.getLineMaxColumn(line) ?? 1;
          editor.setSelection({
            startLineNumber: line, startColumn: 1,
            endLineNumber: line, endColumn: maxCol,
          });
          editor.focus();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  return (
    <Editor
      width="100%"
      height="100%"
      language="html"
      theme="vs-dark"
      value={htmlContent ?? ''}
      onChange={handleChange}
      beforeMount={undefined}
      onMount={(editor) => {
        // Mark syncing so the initial setValue doesn't trigger onChange loop
        isSyncingRef.current = true;
        editorRef.current = editor;
        setMonacoEditorInstance(editor);
      }}
      options={{
        wordWrap: 'on',
        minimap: { enabled: false },
        lineNumbers: 'on',
        fontSize: 13,
        tabSize: 2,
      }}
    />
  );
}
