import { useEditorStore } from '../../store/editorStore';
import FileUploader from './FileUploader';

export default function EditorPanel() {
  const selectedElement = useEditorStore((s) => s.selectedElement);

  return (
    <div className="w-[300px] shrink-0 bg-gray-900 text-gray-300 border-r border-gray-700 overflow-y-auto">
      <FileUploader />
      {!selectedElement && (
        <div className="p-4">
          <p className="text-xs text-gray-500">
            요소를 선택하면 속성이 여기에 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
