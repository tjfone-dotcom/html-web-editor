import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';

export default function HtmlPreview() {
  const htmlContent = useEditorStore((s) => s.htmlContent);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const prevBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Revoke previous Blob URL
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
    }

    if (htmlContent) {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      prevBlobUrlRef.current = url;
    } else {
      setBlobUrl(null);
      prevBlobUrlRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = null;
      }
    };
  }, [htmlContent]);

  if (!blobUrl) {
    return null;
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div
        className="bg-white shadow-lg"
        style={{
          aspectRatio: '16 / 9',
          maxWidth: '100%',
          maxHeight: '100%',
          width: '100%',
        }}
      >
        <iframe
          src={blobUrl}
          sandbox="allow-scripts allow-same-origin"
          title="HTML 미리보기"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
