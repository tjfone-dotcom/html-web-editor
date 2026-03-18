import { useState } from 'react';

interface SpacingValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface SpacingControlProps {
  values: SpacingValues;
  onChange: (values: SpacingValues) => void;
  label: string;
  unit?: string;
}

const sides = ['top', 'right', 'bottom', 'left'] as const;
const sideLabels: Record<string, string> = {
  top: '상',
  right: '우',
  bottom: '하',
  left: '좌',
};

export default function SpacingControl({ values, onChange, label, unit = 'px' }: SpacingControlProps) {
  const [linked, setLinked] = useState(false);

  const handleChange = (side: keyof SpacingValues, val: number) => {
    if (linked) {
      onChange({ top: val, right: val, bottom: val, left: val });
    } else {
      onChange({ ...values, [side]: val });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-gray-400">{label}</span>
        <button
          type="button"
          onClick={() => setLinked(!linked)}
          className={`text-[10px] px-1.5 py-0.5 rounded border ${
            linked
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-gray-600 text-gray-500'
          }`}
          title="모든 방향 동일하게 설정"
        >
          {linked ? '연결됨' : '개별'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {sides.map((side) => (
          <div key={side} className="flex flex-col items-center">
            <span className="text-[10px] text-gray-500 mb-0.5">{sideLabels[side]}</span>
            <div className="flex items-center">
              <input
                type="number"
                min={0}
                max={200}
                value={values[side]}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  handleChange(side, Math.max(0, v));
                }}
                className="w-full bg-gray-800 text-xs text-gray-300 border border-gray-600 rounded px-1 py-1 text-center"
              />
            </div>
            <span className="text-[9px] text-gray-600">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
