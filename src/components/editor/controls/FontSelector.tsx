interface FontSelectorProps {
  value: string;
  onChange: (font: string) => void;
}

const FONTS = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
];

export default function FontSelector({ value, onChange }: FontSelectorProps) {
  // Normalize value - strip quotes
  const normalized = value.replace(/["']/g, '').split(',')[0].trim();

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 w-20 shrink-0">글꼴</label>
      <select
        value={normalized}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-2 py-1.5"
      >
        {FONTS.map((font) => (
          <option key={font} value={font} style={{ fontFamily: font }}>
            {font}
          </option>
        ))}
      </select>
    </div>
  );
}
