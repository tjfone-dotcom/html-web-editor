import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { useIframeBridge } from '../../../hooks/useIframeBridge';
import { useT } from '../../../i18n';
import ColorPicker from '../controls/ColorPicker';
import Slider from '../controls/Slider';
import SpacingControl from '../controls/SpacingControl';

const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted'];

function parsePx(val: string): number {
  return parseFloat(val) || 0;
}

/** Parse "10px 20px 30px 40px" or "10px" spacing shorthand into four values */
function parseSpacing(val: string): { top: number; right: number; bottom: number; left: number } {
  const parts = val.split(/\s+/).map((p) => parsePx(p));
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  return { top: parts[0] || 0, right: parts[1] || 0, bottom: parts[2] || 0, left: parts[3] || 0 };
}

/** Parse border shorthand "1px solid rgb(0,0,0)" */
function parseBorder(val: string): { width: number; style: string; color: string } {
  if (!val || val === 'none') return { width: 0, style: 'none', color: '#000000' };
  // Parse width
  const widthMatch = val.match(/([\d.]+)px/);
  const width = widthMatch ? parseFloat(widthMatch[1]) : 0;
  // Parse style
  const styleMatch = val.match(/\b(solid|dashed|dotted|none)\b/);
  const style = styleMatch ? styleMatch[1] : 'none';
  // Parse color - look for rgb/rgba or hex
  const colorMatch = val.match(/(rgb[a]?\([^)]+\))/) || val.match(/(#[0-9a-fA-F]{3,8})/);
  const color = colorMatch ? colorMatch[1] : '#000000';
  return { width, style, color };
}

/** Parse box-shadow: "2px 4px 6px 0px rgba(0,0,0,0.5)" */
function parseBoxShadow(val: string): { x: number; y: number; blur: number; spread: number; color: string } {
  if (!val || val === 'none') return { x: 0, y: 0, blur: 0, spread: 0, color: '#000000' };
  // Extract color first (rgb/rgba or hex)
  const colorMatch = val.match(/(rgb[a]?\([^)]+\))/) || val.match(/(#[0-9a-fA-F]{3,8})/);
  const color = colorMatch ? colorMatch[1] : '#000000';
  // Remove color from string, then parse px values
  const withoutColor = val.replace(/(rgb[a]?\([^)]+\))/, '').replace(/(#[0-9a-fA-F]{3,8})/, '');
  const nums = withoutColor.match(/-?[\d.]+/g)?.map(Number) || [];
  return {
    x: nums[0] || 0,
    y: nums[1] || 0,
    blur: nums[2] || 0,
    spread: nums[3] || 0,
    color,
  };
}

export default function BoxProperties() {
  const t = useT();
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const { sendStyleUpdate } = useIframeBridge();

  const cs = selectedElement?.computedStyles ?? {};
  const editorId = selectedElement?.editorId ?? '';

  const [bgColor, setBgColor] = useState(cs['background-color'] ?? '#ffffff');
  const [bgImage, setBgImage] = useState(cs['background-image'] === 'none' ? '' : (cs['background-image'] ?? ''));
  const [border, setBorder] = useState(parseBorder(cs['border'] ?? ''));
  const [borderRadius, setBorderRadius] = useState(parsePx(cs['border-radius'] ?? '0px'));
  const [padding, setPadding] = useState(parseSpacing(cs['padding'] ?? '0px'));
  const [margin, setMargin] = useState(parseSpacing(cs['margin'] ?? '0px'));
  const [boxShadow, setBoxShadow] = useState(parseBoxShadow(cs['box-shadow'] ?? 'none'));

  useEffect(() => {
    if (!selectedElement) return;
    const cs = selectedElement.computedStyles;
    setBgColor(cs['background-color'] ?? '#ffffff');
    setBgImage(cs['background-image'] === 'none' ? '' : (cs['background-image'] ?? ''));
    setBorder(parseBorder(cs['border'] ?? ''));
    setBorderRadius(parsePx(cs['border-radius'] ?? '0px'));
    setPadding(parseSpacing(cs['padding'] ?? '0px'));
    setMargin(parseSpacing(cs['margin'] ?? '0px'));
    setBoxShadow(parseBoxShadow(cs['box-shadow'] ?? 'none'));
  }, [selectedElement?.editorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyStyle = useCallback(
    (styles: Record<string, string>) => {
      if (editorId) sendStyleUpdate(editorId, styles);
    },
    [editorId, sendStyleUpdate]
  );

  // Background color
  const handleBgColorChange = (c: string) => {
    setBgColor(c);
    applyStyle({ 'background-color': c });
  };

  // Background image
  const handleBgImageChange = (url: string) => {
    setBgImage(url);
    applyStyle({ 'background-image': url ? `url(${url})` : 'none' });
  };

  // Border
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

  // Border radius
  const handleBorderRadiusChange = (val: number) => {
    setBorderRadius(val);
    applyStyle({ 'border-radius': `${val}px` });
  };

  // Padding
  const handlePaddingChange = (vals: typeof padding) => {
    setPadding(vals);
    applyStyle({ padding: `${vals.top}px ${vals.right}px ${vals.bottom}px ${vals.left}px` });
  };

  // Margin
  const handleMarginChange = (vals: typeof margin) => {
    setMargin(vals);
    applyStyle({ margin: `${vals.top}px ${vals.right}px ${vals.bottom}px ${vals.left}px` });
  };

  // Box shadow
  const updateBoxShadow = (next: typeof boxShadow) => {
    setBoxShadow(next);
    if (next.x === 0 && next.y === 0 && next.blur === 0 && next.spread === 0) {
      applyStyle({ 'box-shadow': 'none' });
    } else {
      applyStyle({ 'box-shadow': `${next.x}px ${next.y}px ${next.blur}px ${next.spread}px ${next.color}` });
    }
  };

  return (
    <div className="space-y-3">
      {/* Background color */}
      <ColorPicker label={t('bgColor')} value={bgColor} onChange={handleBgColorChange} />

      {/* Background image */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-20 shrink-0">{t('bgImage')}</label>
        <input
          type="text"
          value={bgImage}
          onChange={(e) => handleBgImageChange(e.target.value)}
          placeholder={t('urlPlaceholder')}
          className="flex-1 bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1"
        />
      </div>

      {/* Border */}
      <div className="space-y-1.5">
        <span className="text-xs text-gray-400">{t('border')}</span>
        <div className="pl-2 space-y-1.5">
          <Slider
            label={t('thickness')}
            value={border.width}
            onChange={handleBorderWidthChange}
            min={0}
            max={20}
            step={1}
            unit="px"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20 shrink-0">{t('style')}</label>
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
          <ColorPicker label={t('color')} value={border.color} onChange={handleBorderColorChange} />
        </div>
      </div>

      {/* Border radius */}
      <Slider
        label={t('roundness')}
        value={borderRadius}
        onChange={handleBorderRadiusChange}
        min={0}
        max={100}
        step={1}
        unit="px"
      />

      {/* Padding */}
      <SpacingControl label={t('padding')} values={padding} onChange={handlePaddingChange} unit="px" />

      {/* Margin */}
      <SpacingControl label={t('margin')} values={margin} onChange={handleMarginChange} unit="px" />

      {/* Box shadow */}
      <div className="space-y-1.5">
        <span className="text-xs text-gray-400">{t('shadow')}</span>
        <div className="pl-2 space-y-1.5">
          <Slider label="X" value={boxShadow.x} onChange={(v) => updateBoxShadow({ ...boxShadow, x: v })} min={-50} max={50} step={1} unit="px" />
          <Slider label="Y" value={boxShadow.y} onChange={(v) => updateBoxShadow({ ...boxShadow, y: v })} min={-50} max={50} step={1} unit="px" />
          <Slider label={t('blur')} value={boxShadow.blur} onChange={(v) => updateBoxShadow({ ...boxShadow, blur: v })} min={0} max={100} step={1} unit="px" />
          <Slider label={t('spread')} value={boxShadow.spread} onChange={(v) => updateBoxShadow({ ...boxShadow, spread: v })} min={-50} max={50} step={1} unit="px" />
          <ColorPicker label={t('color')} value={boxShadow.color} onChange={(c) => updateBoxShadow({ ...boxShadow, color: c })} />
        </div>
      </div>
    </div>
  );
}
