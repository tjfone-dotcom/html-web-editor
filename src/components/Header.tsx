import { useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import { downloadHtml } from '../utils/htmlSerializer';
import { useT } from '../i18n';
import type { SupportedLocale } from '../types/editor';

const LOCALES: { code: SupportedLocale; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ko', flag: '🇰🇷', label: '한국어' },
  { code: 'ja', flag: '🇯🇵', label: '日本語' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
];

export default function Header() {
  const t = useT();
  const fileName = useEditorStore((state) => state.fileName);
  const htmlContent = useEditorStore((state) => state.htmlContent);
  const historyIndex = useEditorStore((state) => state.historyIndex);
  const historyLength = useEditorStore((state) => state.history.length);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const resetToOriginal = useEditorStore((state) => state.resetToOriginal);
  const isDirty = useEditorStore((state) => state.isDirty);
  const locale = useEditorStore((state) => state.locale);
  const setLocale = useEditorStore((state) => state.setLocale);

  const handleSave = useCallback(() => {
    if (!htmlContent) return;
    downloadHtml(htmlContent, fileName || 'edited.html');
  }, [htmlContent, fileName]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-gray-900 text-white border-b border-gray-700 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="flex items-center gap-2 text-sm font-bold tracking-wide">
          <img src="/favicon.png" alt="SoEZ HTML" className="w-5 h-5 object-contain" />
          SoEZ HTML
        </h1>
        {fileName && (
          <span className="text-xs text-gray-400 truncate max-w-[200px]">
            {fileName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={!canUndo}
          onClick={undo}
          className={`px-3 py-1 text-xs rounded ${
            canUndo
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title={t('undoTooltip')}
        >
          {t('undo')}
        </button>
        <button
          disabled={!canRedo}
          onClick={redo}
          className={`px-3 py-1 text-xs rounded ${
            canRedo
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title={t('redoTooltip')}
        >
          {t('redo')}
        </button>
        <button
          disabled={!isDirty}
          onClick={resetToOriginal}
          className={`px-3 py-1 text-xs rounded ${
            isDirty
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title={t('resetTooltip')}
        >
          {t('resetToOriginal')}
        </button>
        <button
          disabled={!htmlContent}
          onClick={handleSave}
          className={`px-3 py-1 text-xs rounded ${
            htmlContent
              ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title={t('saveTooltip')}
        >
          {t('save')}
        </button>

        {/* Language switcher */}
        <div className="flex items-center gap-1 border-l border-gray-700 ml-1 pl-3">
          {LOCALES.map(({ code, flag, label }) => (
            <button
              key={code}
              onClick={() => setLocale(code)}
              title={label}
              className={`w-7 h-7 flex items-center justify-center rounded text-base transition-colors
                hover:bg-gray-700
                ${locale === code ? 'ring-1 ring-blue-500 bg-gray-700' : ''}`}
            >
              {flag}
            </button>
          ))}
        </div>

        {/* Manual button */}
        <div className="flex items-center border-l border-gray-700 ml-1 pl-3">
          <button
            onClick={() => window.open(`/manual.html?lang=${locale}`, '_blank')}
            title={t('openManual')}
            className="w-7 h-7 flex items-center justify-center rounded text-base hover:bg-gray-700 transition-colors"
          >
            💡
          </button>
        </div>
      </div>
    </header>
  );
}
