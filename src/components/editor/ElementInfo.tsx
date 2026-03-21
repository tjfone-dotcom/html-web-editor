import { useEditorStore } from '../../store/editorStore';
import { useT } from '../../i18n';
import type { ElementType } from '../../types/editor';

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
  const t = useT();
  const selectedElement = useEditorStore((s) => s.selectedElement);

  const typeLabels: Record<ElementType, string> = {
    text: t('typeText'),
    button: t('typeButton'),
    box: t('typeBox'),
    image: t('typeImage'),
    line: t('typeLine'),
    unsupported: t('typeUnsupported'),
  };

  if (!selectedElement) {
    return (
      <div className="p-4">
        <p className="text-xs text-gray-500">
          {t('clickToSelect')}
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
            title={t('selectParent')}
          >
            ▲
          </button>
          <button
            onClick={navigateDown}
            className="w-6 h-6 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs"
            title={t('selectChild')}
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
          <span className="text-gray-500">Class: </span>
          <span className="text-blue-400">.{className.trim().split(/\s+/).join(' .')}</span>
        </div>
      )}
    </div>
  );
}
