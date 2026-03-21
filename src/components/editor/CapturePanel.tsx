import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useEditorStore } from '../../store/editorStore';
import { useT } from '../../i18n';
import {
  requestSectionDetection,
  captureAllSections,
  type CaptureOptions,
} from '../../utils/captureEngine';
import type { SectionInfo } from '../../utils/sectionDetector';

export default function CapturePanel() {
  const t = useT();
  const fileName = useEditorStore((s) => s.fileName);
  const [format, setFormat] = useState<'png' | 'jpeg'>('jpeg');
  const [scale, setScale] = useState(2);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const getIframe = useCallback((): HTMLIFrameElement | null => {
    return document.querySelector('iframe[title="HTML 미리보기"]') ||
           document.querySelector('iframe[title="HTML Preview"]') ||
           document.querySelector('iframe[title="HTMLプレビュー"]') ||
           document.querySelector('iframe[title="HTML预览"]');
  }, []);

  const handleReset = useCallback(() => {
    setSections([]);
    setError(null);
  }, []);

  const handleDetect = useCallback(async () => {
    const iframe = getIframe();
    if (!iframe) {
      setError(t('noIframe'));
      return;
    }
    setIsDetecting(true);
    setError(null);
    try {
      const detected = await requestSectionDetection(iframe);
      if (detected.length === 0) setError(t('cannotDetect'));
      setSections(detected);
    } catch {
      setError(t('detectError'));
    } finally {
      setIsDetecting(false);
    }
  }, [getIframe, t]);

  const handleCapture = useCallback(async () => {
    const iframe = getIframe();
    if (!iframe || sections.length === 0) return;

    setIsCapturing(true);
    setError(null);
    setProgress({ current: 0, total: sections.length });

    try {
      const options: CaptureOptions = { format, scale, quality: 0.92 };
      const blobs = await captureAllSections(
        iframe, sections, options,
        (current, total) => setProgress({ current, total })
      );

      const zip = new JSZip();
      const ext = format === 'jpeg' ? 'jpg' : 'png';
      let addedCount = 0;
      blobs.forEach((blob, i) => {
        if (blob) {
          zip.file(`section-${String(i + 1).padStart(2, '0')}.${ext}`, blob);
          addedCount++;
        }
      });

      if (addedCount === 0) {
        setError(t('captureError'));
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const baseName = fileName ? fileName.replace(/\.(html|htm)$/i, '') : 'capture';
      saveAs(zipBlob, `${baseName}_captures.zip`);
    } catch {
      setError(t('captureInternalError'));
    } finally {
      setIsCapturing(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [getIframe, sections, format, scale, fileName, t]);

  return (
    <div className="border-t border-gray-700 pt-3 mt-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {t('multiCapture')}
      </h3>

      {/* Format selection */}
      <div className="mb-3">
        <label className="text-xs text-gray-400 block mb-1">{t('outputFormat')}</label>
        <div className="flex gap-2">
          {(['jpeg', 'png'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFormat(f)}
              className={`px-3 py-1 text-xs rounded ${format === f ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              {f === 'jpeg' ? 'JPG' : 'PNG'}
            </button>
          ))}
        </div>
      </div>

      {/* Scale selection */}
      <div className="mb-3">
        <label className="text-xs text-gray-400 block mb-1">{t('resolution')}</label>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <button key={s} type="button" onClick={() => setScale(s)}
              className={`px-3 py-1 text-xs rounded ${scale === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Detect / Reset buttons */}
      <div className="flex gap-2 mb-2">
        <button type="button" onClick={handleDetect} disabled={isDetecting || isCapturing}
          className="flex-1 py-2 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
          {isDetecting ? t('detecting') : t('detectSections')}
        </button>
        <button type="button" onClick={handleReset} disabled={isDetecting || isCapturing || sections.length === 0}
          className="flex-1 py-2 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
          {t('reset')}
        </button>
      </div>

      {/* Detected sections list */}
      {sections.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">{t('sectionsDetected', sections.length)}</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {sections.map((sec) => (
              <div key={sec.index} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1 text-xs">
                <span className="text-gray-300">{sec.label}</span>
                <span className="text-gray-500">{Math.round(sec.height)}px</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capture button */}
      {sections.length > 0 && (
        <button type="button" onClick={handleCapture} disabled={isCapturing}
          className="w-full py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {isCapturing
            ? t('captureProgress', progress.current, progress.total)
            : t('captureNSections', sections.length)}
        </button>
      )}

      {/* Progress bar */}
      {isCapturing && progress.total > 0 && (
        <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
          <div className="bg-blue-600 h-1.5 rounded-full transition-all"
            style={{ width: `${(progress.current / progress.total) * 100}%` }} />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
