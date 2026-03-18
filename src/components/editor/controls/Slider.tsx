interface SliderProps {
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string;
}

export default function Slider({ value, onChange, min, max, step = 1, unit = '', label }: SliderProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 w-20 shrink-0">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 accent-blue-500"
      />
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="w-14 bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-1.5 py-1 text-right"
        />
        {unit && <span className="text-[10px] text-gray-500 w-5">{unit}</span>}
      </div>
    </div>
  );
}
