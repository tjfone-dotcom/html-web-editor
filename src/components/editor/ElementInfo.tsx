import { useEditorStore } from '../../store/editorStore';
import type { ElementType } from '../../types/editor';

const typeLabels: Record<ElementType, string> = {
  text: '텍스트',
  button: '버튼',
  box: '박스',
  image: '이미지',
  line: '구분선',
  unsupported: '미지원',
};

const typeBadgeColors: Record<ElementType, string> = {
  text: 'bg-blue-600',
  button: 'bg-green-600',
  box: 'bg-gray-600',
  image: 'bg-purple-600',
  line: 'bg-yellow-600',
  unsupported: 'bg-red-600',
};

function navigateUp() {
  window.dispatchEvent(new CustomEvent('bridge-navigate', { detail: { type: 'SELECT_PARENT' } }));
}

function navigateDown() {
  window.dispatchEvent(new CustomEvent('bridge-navigate', { detail: { type: 'SELECT_CHILD' } }));
}

export default function ElementInfo() {
  const selectedElement = useEditorStore((s) => s.selectedElement);

  if (!selectedElement) {
    return (
      <div className="p-4">
        <p className="text-xs text-gray-500">
          요소를 클릭하여 선택하세요
        </p>
      </div>
    );
  }

  const { tagName, id, className, elementType } = selectedElement;
  const elType = elementType as ElementType;

  return (
    <div className="p-4 border-b border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-mono text-white">&lt;{tagName}&gt;</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded text-white ${typeBadgeColors[elType] || 'bg-gray-600'}`}
        >
          {typeLabels[elType] || elType}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={navigateUp}
            className="w-6 h-6 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs"
            title="부모 요소 선택 (▲)"
          >
            ▲
          </button>
          <button
            onClick={navigateDown}
            className="w-6 h-6 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs"
            title="첫 번째 자식 선택 (▼)"
          >
            ▼
          </button>
        </div>
      </div>
      {id && (
        <div className="text-xs text-gray-400 mb-1">
          <span className="text-gray-500">ID: </span>
          <span className="text-yellow-400">#{id}</span>
        </div>
      )}
      {className && (
        <div className="text-xs text-gray-400">
          <span className="text-gray-500">클래스: </span>
          <span className="text-blue-400">.{className.trim().split(/\s+/).join(' .')}</span>
        </div>
      )}
    </div>
  );
}
