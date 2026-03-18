import { useEditorStore } from '../../store/editorStore';
import FileUploader from './FileUploader';
import ElementInfo from './ElementInfo';

export default function EditorPanel() {
  const htmlContent = useEditorStore((s) => s.htmlContent);

  return (
    <div className="w-[300px] shrink-0 bg-gray-900 text-gray-300 border-r border-gray-700 overflow-y-auto">
      <FileUploader />
      {htmlContent && <ElementInfo />}
    </div>
  );
}
