import { useEditorStore } from '../store/editorStore';
import { useT } from '../i18n';

export default function StatusBar() {
  const t = useT();
  const selectedElement = useEditorStore((state) => state.selectedElement);

  return (
    <div className="flex items-center px-4 h-6 bg-gray-800 text-gray-400 text-xs border-t border-gray-700 shrink-0">
      {selectedElement ? (
        <span className="truncate">
          {selectedElement.path.join(' > ')}
        </span>
      ) : (
        <span>{t('ready')}</span>
      )}
    </div>
  );
}
