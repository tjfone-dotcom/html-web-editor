import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { useIframeBridge } from '../../../hooks/useIframeBridge';
import Slider from '../controls/Slider';

const OBJECT_FIT_OPTIONS = [
  { value: 'cover', label: 'cover' },
  { value: 'contain', label: 'contain' },
  { value: 'fill', label: 'fill' },
  { value: 'none', label: 'none' },
  { value: 'scale-down', label: 'scale-down' },
];

function parsePx(val: string): number {
  return parseFloat(val) || 0;
}

export default function ImageProperties() {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const { sendStyleUpdate, postToIframe } = useIframeBridge();

  const cs = selectedElement?.computedStyles ?? {};
  const editorId = selectedElement?.editorId ?? '';

  const [width, setWidth] = useState(parsePx(cs['width'] ?? '0'));
  const [height, setHeight] = useState(parsePx(cs['height'] ?? '0'));
  const [aspectLocked, setAspectLocked] = useState(true);
  const [borderRadius, setBorderRadius] = useState(parsePx(cs['border-radius'] ?? '0px'));
  const [opacity, setOpacity] = useState(parseFloat(cs['opacity'] ?? '1'));
  const [objectFit, setObjectFit] = useState(cs['object-fit'] ?? 'cover');

  const aspectRatioRef = useRef(1);

  useEffect(() => {
    if (!selectedElement) return;
    const cs = selectedElement.computedStyles;
    const w = parsePx(cs['width'] ?? '0');
    const h = parsePx(cs['height'] ?? '0');
    setWidth(w);
    setHeight(h);
    if (h > 0) aspectRatioRef.current = w / h;
    setBorderRadius(parsePx(cs['border-radius'] ?? '0px'));
    setOpacity(parseFloat(cs['opacity'] ?? '1'));
    setObjectFit(cs['object-fit'] ?? 'cover');
  }, [selectedElement?.editorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyStyle = useCallback(
    (styles: Record<string, string>) => {
      if (editorId) sendStyleUpdate(editorId, styles);
    },
    [editorId, sendStyleUpdate]
  );

  const sendAttributeUpdate = useCallback(
    (attributes: Record<string, string>) => {
      if (editorId) {
        postToIframe({
          type: 'UPDATE_ATTRIBUTE',
          payload: { editorId, attributes },
        });
      }
    },
    [editorId, postToIframe]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      sendAttributeUpdate({ src: dataUri });
    };
    reader.readAsDataURL(file);
  };

  const handleWidthChange = (val: number) => {
    setWidth(val);
    if (aspectLocked && aspectRatioRef.current > 0) {
      const newHeight = Math.round(val / aspectRatioRef.current);
      setHeight(newHeight);
      applyStyle({ width: `${val}px`, height: `${newHeight}px` });
    } else {
      applyStyle({ width: `${val}px` });
    }
  };

  const handleHeightChange = (val: number) => {
    setHeight(val);
    if (aspectLocked && aspectRatioRef.current > 0) {
      const newWidth = Math.round(val * aspectRatioRef.current);
      setWidth(newWidth);
      applyStyle({ width: `${newWidth}px`, height: `${val}px` });
    } else {
      applyStyle({ height: `${val}px` });
    }
  };

  const handleBorderRadiusChange = (val: number) => {
    setBorderRadius(val);
    applyStyle({ 'border-radius': `${val}px` });
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    applyStyle({ opacity: String(val) });
  };

  const handleObjectFitChange = (val: string) => {
    setObjectFit(val);
    applyStyle({ 'object-fit': val });
  };

  return (
    <div className="space-y-3">
      {/* Image source */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">이미지 소스</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-3 py-1.5 text-xs bg-gray-800 text-gray-300 border border-gray-600 rounded hover:bg-gray-700"
        >
          이미지 파일 선택
        </button>
      </div>

      {/* Width & Height with aspect ratio lock */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-400">크기</span>
          <button
            type="button"
            onClick={() => setAspectLocked(!aspectLocked)}
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              aspectLocked
                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                : 'border-gray-600 text-gray-500'
            }`}
            title="가로세로 비율 고정"
          >
            {aspectLocked ? '비율 고정' : '비율 해제'}
          </button>
        </div>
        <Slider
          label="너비"
          value={width}
          onChange={handleWidthChange}
          min={0}
          max={2000}
          step={1}
          unit="px"
        />
        <Slider
          label="높이"
          value={height}
          onChange={handleHeightChange}
          min={0}
          max={2000}
          step={1}
          unit="px"
        />
      </div>

      {/* Border radius */}
      <Slider
        label="둥글기"
        value={borderRadius}
        onChange={handleBorderRadiusChange}
        min={0}
        max={100}
        step={1}
        unit="px"
      />

      {/* Opacity */}
      <Slider
        label="투명도"
        value={opacity}
        onChange={handleOpacityChange}
        min={0}
        max={1}
        step={0.01}
      />

      {/* Object fit */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-20 shrink-0">맞춤</label>
        <select
          value={objectFit}
          onChange={(e) => handleObjectFitChange(e.target.value)}
          className="flex-1 bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1.5"
        >
          {OBJECT_FIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
