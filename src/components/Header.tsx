import { useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { downloadHtml } from '../utils/htmlSerializer';

export default function Header() {
  const fileName = useEditorStore((state) => state.fileName);
  const htmlContent = useEditorStore((state) => state.htmlContent);
  const historyIndex = useEditorStore((state) => state.historyIndex);
  const historyLength = useEditorStore((state) => state.history.length);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetToOriginal = useEditorStore((state) => state.resetToOriginal);
  const isDirty = useEditorStore((state) => state.isDirty);

  const handleSave = useCallback(() => {
    if (!htmlContent) return;
    downloadHtml(htmlContent, fileName || 'edited.html');
  }, [htmlContent, fileName]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-gray-900 text-white border-b border-gray-700 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-bold tracking-wide">HTML Editor</h1>
        {fileName && (
          <span className="text-xs text-gray-400 truncate max-w-[200px]">
            {fileName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={!canUndo}
          onClick={undo}
          className={`px-3 py-1 text-xs rounded ${
            canUndo
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="실행 취소 (Ctrl+Z)"
        >
          실행 취소
        </button>
        <button
          disabled={!canRedo}
          onClick={redo}
          className={`px-3 py-1 text-xs rounded ${
            canRedo
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="다시 실행 (Ctrl+Shift+Z)"
        >
          다시 실행
        </button>
        <button
          disabled={!isDirty}
          onClick={resetToOriginal}
          className={`px-3 py-1 text-xs rounded ${
            isDirty
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="원본 복원"
        >
          원본 복원
        </button>
        <button
          disabled={!htmlContent}
          onClick={handleSave}
          className={`px-3 py-1 text-xs rounded ${
            htmlContent
              ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="저장 (Ctrl+S)"
        >
          저장
        </button>
      </div>
    </header>
  );
}
