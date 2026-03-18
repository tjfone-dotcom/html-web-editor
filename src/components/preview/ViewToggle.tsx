import { useEditorStore } from '../../store/editorStore';
import type { ViewMode } from '../../types/editor';

const tabs: { mode: ViewMode; label: string }[] = [
  { mode: 'preview', label: '프리뷰' },
  { mode: 'code', label: '코드' },
];

export default function ViewToggle() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);

  return (
    <div className="flex gap-1 bg-gray-200 rounded-md p-0.5">
      {tabs.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
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
