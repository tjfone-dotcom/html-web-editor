import { useCallback, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { useT } from '../../i18n';
import CodeEditor from './CodeEditor';
import HtmlPreview from './HtmlPreview';
import ViewToggle from './ViewToggle';

export default function PreviewPanel() {
  const t = useT();
  const htmlContent = useEditorStore((s) => s.htmlContent);
  const viewMode = useEditorStore((s) => s.viewMode);
  const fileName = useEditorStore((s) => s.fileName);
  const setHtmlContent = useEditorStore((s) => s.setHtmlContent);
  const setFileName = useEditorStore((s) => s.setFileName);
  const setIsLoading = useEditorStore((s) => s.setIsLoading);
  const fixedViewport = useEditorStore((s) => s.fixedViewport);
  const setFixedViewport = useEditorStore((s) => s.setFixedViewport);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'html' && ext !== 'htm') return;
      if (file.size > 10 * 1024 * 1024) return;

      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content && content.includes('<')) {
          setFileName(file.name);
          setHtmlContent(content, '파일 업로드');
        }
        setIsLoading(false);
      };
      reader.onerror = () => setIsLoading(false);
      reader.readAsText(file);
    },
    [setHtmlContent, setFileName, setIsLoading],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processFile],
  );

  if (!htmlContent) {
    return (
      <div
        className="flex-1 bg-gray-50 flex items-center justify-center"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}>
          <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div className="text-center">
            <p className="text-gray-400 text-sm">{t('uploadInstruction')}</p>
            <p className="text-gray-300 text-xs mt-1">{t('uploadHint')}</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleFileChange} className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <span className="text-xs text-gray-500 truncate mr-4">{fileName}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={fixedViewport}
              onChange={(e) => setFixedViewport(e.target.checked)}
              className="w-3.5 h-3.5 rounded"
            />
            {t('fixedViewport')}
          </label>
          <ViewToggle />
        </div>
      </div>
      <div className={`flex-1 overflow-hidden ${viewMode === 'preview' ? '' : 'hidden'}`}>
        <HtmlPreview />
      </div>
      <div className={`flex-1 overflow-hidden ${viewMode === 'code' ? '' : 'hidden'}`}>
        <CodeEditor />
      </div>
    </div>
  );
}
