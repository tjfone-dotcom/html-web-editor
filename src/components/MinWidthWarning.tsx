import { useEffect, useState } from 'react';
import { useT } from '../i18n';

const MIN_WIDTH = 1024;

export default function MinWidthWarning() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    function check() {
      setShow(window.innerWidth < MIN_WIDTH);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/80 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm text-center">
        <svg
          className="w-12 h-12 text-amber-500 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          {t('screenTooNarrow')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('screenTooNarrowMsg')}
        </p>
      </div>
    </div>
  );
}
