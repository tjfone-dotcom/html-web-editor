interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

/** Convert various CSS color formats to hex */
function toHex(color: string): string {
  // Already hex
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1], g = color[2], b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  // rgb/rgba
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return '#' + [r, g, b].map(c => parseInt(c).toString(16).padStart(2, '0')).join('');
  }
  // transparent or unrecognized
  return '#000000';
}

export default function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const hex = toHex(value);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 w-20 shrink-0">{label}</label>
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border border-gray-600 cursor-pointer bg-transparent p-0"
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
              onChange(v);
            }
          }}
          className="flex-1 bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1 font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}
