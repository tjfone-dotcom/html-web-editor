import { useCallback, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { useT } from '../../i18n';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function FileUploader() {
  const t = useT();
  const { htmlContent, loadFile, setIsLoading } = useEditorStore();
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'html' && ext !== 'htm') return t('invalidFileType');
    if (file.size > MAX_FILE_SIZE) return t('fileTooLarge');
    return null;
  }, [t]);

  const processFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setIsLoading(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content || !content.includes('<')) {
          setError(t('invalidHtmlFile'));
          setIsLoading(false);
          return;
        }
        loadFile(content, file.name);
        setIsLoading(false);
      };
      reader.onerror = () => {
        setError(t('fileReadError'));
        setIsLoading(false);
      };
      reader.readAsText(file);
    },
    [loadFile, setIsLoading, validateFile, t],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
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

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (htmlContent) {
    return (
      <div className="p-4">
        <button
          onClick={handleClick}
          className="w-full px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors cursor-pointer"
        >
          {t('changeFile')}
        </button>
        <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleFileChange} className="hidden" />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          flex flex-col items-center justify-center gap-3 p-8
          border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${isDragging ? 'border-blue-400 bg-blue-400/10' : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'}
        `}
      >
        <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <div className="text-center">
          <p className="text-sm text-gray-400">{t('uploadInstruction')}</p>
          <p className="text-xs text-gray-500 mt-1">{t('uploadHint')}</p>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleFileChange} className="hidden" />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
