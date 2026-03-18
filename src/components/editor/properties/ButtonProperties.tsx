import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { useIframeBridge } from '../../../hooks/useIframeBridge';
import ColorPicker from '../controls/ColorPicker';
import Slider from '../controls/Slider';
import SpacingControl from '../controls/SpacingControl';

const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted'];

function parsePx(val: string): number {
  return parseFloat(val) || 0;
}

function parseSpacing(val: string): { top: number; right: number; bottom: number; left: number } {
  const parts = val.split(/\s+/).map((p) => parsePx(p));
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  return { top: parts[0] || 0, right: parts[1] || 0, bottom: parts[2] || 0, left: parts[3] || 0 };
}

function parseBorder(val: string): { width: number; style: string; color: string } {
  if (!val || val === 'none') return { width: 0, style: 'none', color: '#000000' };
  const widthMatch = val.match(/([\d.]+)px/);
  const width = widthMatch ? parseFloat(widthMatch[1]) : 0;
  const styleMatch = val.match(/\b(solid|dashed|dotted|none)\b/);
  const style = styleMatch ? styleMatch[1] : 'none';
  const colorMatch = val.match(/(rgb[a]?\([^)]+\))/) || val.match(/(#[0-9a-fA-F]{3,8})/);
  const color = colorMatch ? colorMatch[1] : '#000000';
  return { width, style, color };
}

export default function ButtonProperties() {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const { sendStyleUpdate, sendTextUpdate } = useIframeBridge();

  const cs = selectedElement?.computedStyles ?? {};
  const editorId = selectedElement?.editorId ?? '';

  const [textContent, setTextContent] = useState(selectedElement?.textContent ?? '');
  const [bgColor, setBgColor] = useState(cs['background-color'] ?? '#ffffff');
  const [color, setColor] = useState(cs['color'] ?? '#000000');
  const [borderRadius, setBorderRadius] = useState(parsePx(cs['border-radius'] ?? '0px'));
  const [border, setBorder] = useState(parseBorder(cs['border'] ?? ''));
  const [padding, setPadding] = useState(parseSpacing(cs['padding'] ?? '0px'));
  const [fontSize, setFontSize] = useState(parsePx(cs['font-size'] ?? '16px'));

  useEffect(() => {
    if (!selectedElement) return;
    const cs = selectedElement.computedStyles;
    setTextContent(selectedElement.textContent ?? '');
    setBgColor(cs['background-color'] ?? '#ffffff');
    setColor(cs['color'] ?? '#000000');
    setBorderRadius(parsePx(cs['border-radius'] ?? '0px'));
    setBorder(parseBorder(cs['border'] ?? ''));
    setPadding(parseSpacing(cs['padding'] ?? '0px'));
    setFontSize(parsePx(cs['font-size'] ?? '16px'));
  }, [selectedElement?.editorId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleBgColorChange = (c: string) => {
    setBgColor(c);
    applyStyle({ 'background-color': c });
  };

  const handleColorChange = (c: string) => {
    setColor(c);
    applyStyle({ color: c });
  };

  const handleBorderRadiusChange = (val: number) => {
    setBorderRadius(val);
    applyStyle({ 'border-radius': `${val}px` });
  };

  const handleBorderWidthChange = (w: number) => {
    const next = { ...border, width: w };
    setBorder(next);
    applyStyle({ border: `${next.width}px ${next.style} ${next.color}` });
  };
  const handleBorderStyleChange = (s: string) => {
    const next = { ...border, style: s };
    setBorder(next);
    applyStyle({ border: `${next.width}px ${next.style} ${next.color}` });
  };
  const handleBorderColorChange = (c: string) => {
    const next = { ...border, color: c };
    setBorder(next);
    applyStyle({ border: `${next.width}px ${next.style} ${next.color}` });
  };

  const handlePaddingChange = (vals: typeof padding) => {
    setPadding(vals);
    applyStyle({ padding: `${vals.top}px ${vals.right}px ${vals.bottom}px ${vals.left}px` });
  };

  const handleFontSizeChange = (val: number) => {
    setFontSize(val);
    applyStyle({ 'font-size': `${val}px` });
  };

  return (
    <div className="space-y-3">
      {/* Text content */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">텍스트 내용</label>
        <textarea
          value={textContent}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={2}
          className="w-full bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1.5 resize-y"
        />
      </div>

      {/* Background color */}
      <ColorPicker label="배경색" value={bgColor} onChange={handleBgColorChange} />

      {/* Text color */}
      <ColorPicker label="글자 색" value={color} onChange={handleColorChange} />

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

      {/* Border */}
      <div className="space-y-1.5">
        <span className="text-xs text-gray-400">테두리</span>
        <div className="pl-2 space-y-1.5">
          <Slider
            label="두께"
            value={border.width}
            onChange={handleBorderWidthChange}
            min={0}
            max={20}
            step={1}
            unit="px"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20 shrink-0">스타일</label>
            <select
              value={border.style}
              onChange={(e) => handleBorderStyleChange(e.target.value)}
              className="flex-1 bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1.5"
            >
              {BORDER_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <ColorPicker label="색상" value={border.color} onChange={handleBorderColorChange} />
        </div>
      </div>

      {/* Padding */}
      <SpacingControl label="안쪽 여백 (padding)" values={padding} onChange={handlePaddingChange} unit="px" />

      {/* Font size */}
      <Slider
        label="글자 크기"
        value={fontSize}
        onChange={handleFontSizeChange}
        min={8}
        max={72}
        step={1}
        unit="px"
      />
    </div>
  );
}
