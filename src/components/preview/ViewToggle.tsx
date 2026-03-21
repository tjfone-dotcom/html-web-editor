import { useEditorStore } from '../../store/editorStore';
import { useT } from '../../i18n';
import type { ViewMode } from '../../types/editor';
import {
  monacoEditorInstance,
  findLineForSelectedElement,
  lastCursorLine,
  pendingCodeScroll,
} from '../../utils/codeSync';

export default function ViewToggle() {
  const t = useT();
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);

  const tabs: { mode: ViewMode; label: string }[] = [
    { mode: 'preview', label: t('previewMode') },
    { mode: 'code',    label: t('codeMode') },
  ];

  return (
    <div className="flex gap-1 bg-gray-200 rounded-md p-0.5">
      {tabs.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => {
            if (mode === viewMode) return;

            if (mode === 'preview') {
              lastCursorLine.value = monacoEditorInstance?.getPosition()?.lineNumber ?? null;
            }

            if (mode === 'code') {
              const { selectedElement, htmlContent } = useEditorStore.getState();
              if (selectedElement && htmlContent) {
                pendingCodeScroll.line = findLineForSelectedElement(htmlContent, selectedElement);
              } else {
                pendingCodeScroll.line = null;
              }
            }

            setViewMode(mode);
          }}
          className={`
            px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer
            ${viewMode === mode
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
