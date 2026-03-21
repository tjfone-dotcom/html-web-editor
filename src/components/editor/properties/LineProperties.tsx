import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { useIframeBridge } from '../../../hooks/useIframeBridge';
import { useT } from '../../../i18n';
import ColorPicker from '../controls/ColorPicker';
import Slider from '../controls/Slider';

const BORDER_STYLES = ['solid', 'dashed', 'dotted'];

function parseBorderColor(val: string): string {
  if (!val || val === 'none') return '#000000';
  const colorMatch = val.match(/(rgb[a]?\([^)]+\))/) || val.match(/(#[0-9a-fA-F]{3,8})/);
  return colorMatch ? colorMatch[1] : '#000000';
}

function parseBorderWidth(val: string): number {
  const match = val.match(/([\d.]+)px/);
  return match ? parseFloat(match[1]) : 1;
}

function parseBorderStyle(val: string): string {
  const match = val.match(/\b(solid|dashed|dotted)\b/);
  return match ? match[1] : 'solid';
}

export default function LineProperties() {
  const t = useT();
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const { sendStyleUpdate } = useIframeBridge();

  const cs = selectedElement?.computedStyles ?? {};
  const editorId = selectedElement?.editorId ?? '';

  // HR uses border-top for display typically
  const borderVal = cs['border'] ?? '';
  const [borderColor, setBorderColor] = useState(parseBorderColor(borderVal));
  const [borderWidth, setBorderWidth] = useState(parseBorderWidth(borderVal));
  const [borderStyle, setBorderStyle] = useState(parseBorderStyle(borderVal));
  const [widthPercent, setWidthPercent] = useState(
    cs['width']?.includes('%') ? parseFloat(cs['width']) || 100 : 100
  );

  useEffect(() => {
    if (!selectedElement) return;
    const cs = selectedElement.computedStyles;
    const borderVal = cs['border'] ?? '';
    setBorderColor(parseBorderColor(borderVal));
    setBorderWidth(parseBorderWidth(borderVal));
    setBorderStyle(parseBorderStyle(borderVal));
    setWidthPercent(
      cs['width']?.includes('%') ? parseFloat(cs['width']) || 100 : 100
    );
  }, [selectedElement?.editorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyStyle = useCallback(
    (styles: Record<string, string>) => {
      if (editorId) sendStyleUpdate(editorId, styles);
    },
    [editorId, sendStyleUpdate]
  );

  const handleBorderColorChange = (c: string) => {
    setBorderColor(c);
    applyStyle({ 'border-color': c });
  };

  const handleBorderWidthChange = (w: number) => {
    setBorderWidth(w);
    applyStyle({ 'border-width': `${w}px` });
  };

  const handleBorderStyleChange = (s: string) => {
    setBorderStyle(s);
    applyStyle({ 'border-style': s });
  };

  const handleWidthChange = (val: number) => {
    setWidthPercent(val);
    applyStyle({ width: `${val}%` });
  };

  return (
    <div className="space-y-3">
      {/* Border color */}
      <ColorPicker label={t('lineColor')} value={borderColor} onChange={handleBorderColorChange} />

      {/* Border width */}
      <Slider
        label={t('lineThickness')}
        value={borderWidth}
        onChange={handleBorderWidthChange}
        min={0}
        max={20}
        step={1}
        unit="px"
      />

      {/* Border style */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-20 shrink-0">{t('lineStyle')}</label>
        <select
          value={borderStyle}
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

      {/* Width */}
      <Slider
        label={t('lineWidth')}
        value={widthPercent}
        onChange={handleWidthChange}
        min={0}
        max={100}
        step={1}
        unit="%"
      />
    </div>
  );
}
