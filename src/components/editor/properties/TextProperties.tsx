import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { useIframeBridge } from '../../../hooks/useIframeBridge';
import ColorPicker from '../controls/ColorPicker';
import Slider from '../controls/Slider';
import FontSelector from '../controls/FontSelector';

const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const TEXT_ALIGNS = [
  { value: 'left', label: '좌' },
  { value: 'center', label: '중' },
  { value: 'right', label: '우' },
  { value: 'justify', label: '균' },
];

/** Parse a CSS px value like "16px" to a number */
function parsePx(val: string): number {
  return parseFloat(val) || 0;
}

/** Parse line-height: could be "normal", "1.5", or "24px" */
function parseLineHeight(val: string, fontSize: number): number {
  if (val === 'normal') return 1.5;
  const num = parseFloat(val);
  if (isNaN(num)) return 1.5;
  // If the value is in px and larger than typical multiplier range, convert to ratio
  if (val.endsWith('px') && fontSize > 0) {
    return Math.round((num / fontSize) * 10) / 10;
  }
  return num;
}

export default function TextProperties() {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const { sendStyleUpdate, sendTextUpdate } = useIframeBridge();

  const cs = selectedElement?.computedStyles ?? {};
  const editorId = selectedElement?.editorId ?? '';

  // Local state for all properties
  const [textContent, setTextContent] = useState(selectedElement?.textContent ?? '');
  const [fontSize, setFontSize] = useState(parsePx(cs['font-size'] ?? '16px'));
  const [fontFamily, setFontFamily] = useState(cs['font-family'] ?? 'Arial');
  const [fontWeight, setFontWeight] = useState(cs['font-weight'] ?? '400');
  const [fontStyle, setFontStyle] = useState(cs['font-style'] ?? 'normal');
  const [color, setColor] = useState(cs['color'] ?? '#000000');
  const [textAlign, setTextAlign] = useState(cs['text-align'] ?? 'left');
  const [lineHeight, setLineHeight] = useState(parseLineHeight(cs['line-height'] ?? 'normal', parsePx(cs['font-size'] ?? '16px')));
  const [letterSpacing, setLetterSpacing] = useState(parsePx(cs['letter-spacing'] ?? '0px'));

  // Reset all local state when selected element changes
  useEffect(() => {
    if (!selectedElement) return;
    const cs = selectedElement.computedStyles;
    setTextContent(selectedElement.textContent ?? '');
    setFontSize(parsePx(cs['font-size'] ?? '16px'));
    setFontFamily(cs['font-family'] ?? 'Arial');
    setFontWeight(cs['font-weight'] ?? '400');
    setFontStyle(cs['font-style'] ?? 'normal');
    setColor(cs['color'] ?? '#000000');
    setTextAlign(cs['text-align'] ?? 'left');
    setLineHeight(parseLineHeight(cs['line-height'] ?? 'normal', parsePx(cs['font-size'] ?? '16px')));
    setLetterSpacing(parsePx(cs['letter-spacing'] ?? '0px'));
  }, [selectedElement?.editorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync textContent when inline editing changes it externally
  useEffect(() => {
    setTextContent(selectedElement?.textContent ?? '');
  }, [selectedElement?.textContent]);

  const applyStyle = useCallback(
    (styles: Record<string, string>) => {
      if (editorId) sendStyleUpdate(editorId, styles);
    },
    [editorId, sendStyleUpdate]
  );

  const handleTextChange = (text: string) => {
    setTextContent(text);
    if (editorId) sendTextUpdate(editorId, text);
  };

  const handleFontSizeChange = (val: number) => {
    setFontSize(val);
    applyStyle({ 'font-size': `${val}px` });
  };

  const handleFontFamilyChange = (font: string) => {
    setFontFamily(font);
    applyStyle({ 'font-family': font });
  };

  const handleFontWeightChange = (w: string) => {
    setFontWeight(w);
    applyStyle({ 'font-weight': w });
  };

  const handleFontStyleToggle = () => {
    const next = fontStyle === 'italic' ? 'normal' : 'italic';
    setFontStyle(next);
    applyStyle({ 'font-style': next });
  };

  const handleColorChange = (c: string) => {
    setColor(c);
    applyStyle({ color: c });
  };

  const handleTextAlignChange = (align: string) => {
    setTextAlign(align);
    applyStyle({ 'text-align': align });
  };

  const handleLineHeightChange = (val: number) => {
    setLineHeight(val);
    applyStyle({ 'line-height': String(val) });
  };

  const handleLetterSpacingChange = (val: number) => {
    setLetterSpacing(val);
    applyStyle({ 'letter-spacing': `${val}px` });
  };

  return (
    <div className="space-y-3">
      {/* Text content */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">텍스트 내용</label>
        <textarea
          value={textContent}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={3}
          className="w-full bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1.5 resize-y"
        />
      </div>

      {/* Font size */}
      <Slider
        label="글자 크기"
        value={fontSize}
        onChange={handleFontSizeChange}
        min={8}
        max={120}
        step={1}
        unit="px"
      />

      {/* Font family */}
      <FontSelector value={fontFamily} onChange={handleFontFamilyChange} />

      {/* Font weight */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-20 shrink-0">굵기</label>
        <select
          value={fontWeight}
          onChange={(e) => handleFontWeightChange(e.target.value)}
          className="flex-1 bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1.5"
        >
          {FONT_WEIGHTS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      {/* Font style toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-20 shrink-0">스타일</label>
        <button
          type="button"
          onClick={handleFontStyleToggle}
          className={`px-3 py-1 text-xs rounded border ${
            fontStyle === 'italic'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-gray-600 text-gray-400'
          }`}
        >
          <span style={{ fontStyle: 'italic' }}>I</span> 기울임
        </button>
      </div>

      {/* Color */}
      <ColorPicker label="글자 색" value={color} onChange={handleColorChange} />

      {/* Text align */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-20 shrink-0">정렬</label>
        <div className="flex gap-0.5">
          {TEXT_ALIGNS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => handleTextAlignChange(a.value)}
              className={`px-2.5 py-1 text-xs rounded border ${
                textAlign === a.value
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-gray-600 text-gray-400'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line height */}
      <Slider
        label="줄 높이"
        value={lineHeight}
        onChange={handleLineHeightChange}
        min={0.5}
        max={3}
        step={0.1}
      />

      {/* Letter spacing */}
      <Slider
        label="자간"
        value={letterSpacing}
        onChange={handleLetterSpacingChange}
        min={-5}
        max={20}
        step={0.5}
        unit="px"
      />
    </div>
  );
}
