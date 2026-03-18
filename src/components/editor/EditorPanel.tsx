import { useEditorStore } from '../../store/editorStore';
import FileUploader from './FileUploader';
import ElementInfo from './ElementInfo';
import PropertyEditor from './PropertyEditor';
import CapturePanel from './CapturePanel';

export default function EditorPanel() {
  const htmlContent = useEditorStore((s) => s.htmlContent);

  return (
    <div className="w-[380px] shrink-0 bg-gray-900 text-gray-300 border-r border-gray-700 overflow-y-auto p-3">
      <FileUploader />
      {htmlContent && (
        <>
          <ElementInfo />
          <PropertyEditor />
          <CapturePanel />
        </>
      )}
    </div>
  );
}
