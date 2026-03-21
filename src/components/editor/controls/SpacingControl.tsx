import { useState } from 'react';
import { useT } from '../../../i18n';

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
  min?: number;
  max?: number;
}

const sides = ['top', 'right', 'bottom', 'left'] as const;

export default function SpacingControl({ values, onChange, label, unit = 'px', min = 0, max = 100 }: SpacingControlProps) {
  const t = useT();
  const [linked, setLinked] = useState(false);

  const sideLabels: Record<string, string> = {
    top:    t('sideTop'),
    right:  t('sideRight'),
    bottom: t('sideBottom'),
    left:   t('sideLeft'),
  };

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
          title={t('setAllEqual')}
        >
          {linked ? t('linked') : t('individual')}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {sides.map((side) => (
          <div key={side} className="flex flex-col items-center">
            <span className="text-[10px] text-gray-500 mb-0.5">{sideLabels[side]}</span>
            <div className="flex items-center">
              <input
                type="number"
                min={min}
                max={max}
                value={values[side]}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  handleChange(side, Math.max(min, Math.min(max, v)));
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
