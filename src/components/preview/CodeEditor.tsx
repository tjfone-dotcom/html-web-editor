import { useRef, useCallback } from 'react';
import Editor, { type OnChange } from '@monaco-editor/react';
import { useEditorStore } from '../../store/editorStore';

export default function CodeEditor() {
  const htmlContent = useEditorStore((s) => s.htmlContent);
  const setHtmlContent = useEditorStore((s) => s.setHtmlContent);
  const isSyncingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <Editor
      width="100%"
      height="100%"
      language="html"
      theme="vs-dark"
      value={htmlContent ?? ''}
      onChange={handleChange}
      beforeMount={undefined}
      onMount={(_editor) => {
        // Mark syncing so the initial setValue doesn't trigger onChange loop
        isSyncingRef.current = true;
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
