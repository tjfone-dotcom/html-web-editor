import { useEditorStore } from '../store/editorStore';

export default function Header() {
  const fileName = useEditorStore((state) => state.fileName);

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
          disabled
          className="px-3 py-1 text-xs bg-gray-700 text-gray-400 rounded cursor-not-allowed"
          title="실행 취소"
        >
          실행 취소
        </button>
        <button
          disabled
          className="px-3 py-1 text-xs bg-gray-700 text-gray-400 rounded cursor-not-allowed"
          title="다시 실행"
        >
          다시 실행
        </button>
        <button
          disabled
          className="px-3 py-1 text-xs bg-gray-700 text-gray-400 rounded cursor-not-allowed"
          title="저장"
        >
          저장
        </button>
        <button
          disabled
          className="px-3 py-1 text-xs bg-gray-700 text-gray-400 rounded cursor-not-allowed"
          title="캡처"
        >
          캡처
        </button>
      </div>
    </header>
  );
}
