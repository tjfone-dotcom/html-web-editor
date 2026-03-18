import { useEditorStore } from '../../store/editorStore';
import TextProperties from './properties/TextProperties';
import BoxProperties from './properties/BoxProperties';

export default function PropertyEditor() {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const isClassApply = useEditorStore((s) => s.isClassApply);
  const selectedClass = useEditorStore((s) => s.selectedClass);
  const toggleClassApply = useEditorStore((s) => s.toggleClassApply);
  const setSelectedClass = useEditorStore((s) => s.setSelectedClass);

  if (!selectedElement) return null;

  const { elementType, className } = selectedElement;
  const classes = className
    ? className
        .trim()
        .split(/\s+/)
        .filter((c) => c)
    : [];

  const renderProperties = () => {
    switch (elementType) {
      case 'text':
      case 'button':
        return <TextProperties />;
      case 'box':
        return <BoxProperties />;
      case 'image':
      case 'line':
        // These will be implemented in a future phase
        return (
          <p className="text-xs text-gray-500 px-4">
            이 요소 유형의 속성 편집은 추후 지원됩니다.
          </p>
        );
      case 'unsupported':
        return (
          <p className="text-xs text-gray-500 px-4">
            편집할 수 없는 요소입니다
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div className="border-t border-gray-700">
      {/* Class apply toggle */}
      {classes.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-700 space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isClassApply}
              onChange={toggleClassApply}
              className="accent-blue-500"
            />
            같은 클래스에 모두 적용
          </label>
          {isClassApply && (
            <select
              value={selectedClass ?? ''}
              onChange={(e) => setSelectedClass(e.target.value || null)}
              className="w-full bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1"
            >
              <option value="">클래스 선택</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  .{cls}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Property editor */}
      <div className="p-4">{renderProperties()}</div>
    </div>
  );
}
