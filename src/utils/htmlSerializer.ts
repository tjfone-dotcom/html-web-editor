/**
 * Serializes the iframe's DOM into clean HTML, removing all bridge artifacts.
 */

/**
 * Clean HTML content by removing bridge-injected elements and attributes.
 * Works on the HTML string (does not require DOM access).
 */
export function serializeCleanHtml(html: string): string {
  // Use DOMParser to parse and clean
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove bridge scripts
  const bridgeScripts = doc.querySelectorAll('script[data-bridge]');
  bridgeScripts.forEach((el) => el.parentNode?.removeChild(el));

  // Remove bridge styles
  const bridgeStyles = doc.querySelectorAll('style[data-bridge-styles]');
  bridgeStyles.forEach((el) => el.parentNode?.removeChild(el));

  // Remove bridge class styles
  const bridgeClassStyles = doc.querySelectorAll('style[data-bridge-class-styles]');
  bridgeClassStyles.forEach((el) => el.parentNode?.removeChild(el));

  // Remove bridge attributes from all elements
  const allElements = doc.querySelectorAll(
    '[data-bridge-hover], [data-bridge-selected], [data-editor-id], [contenteditable]'
  );
  allElements.forEach((el) => {
    el.removeAttribute('data-bridge-hover');
    el.removeAttribute('data-bridge-selected');
    el.removeAttribute('data-editor-id');
    el.removeAttribute('contenteditable');
  });

  // Reconstruct with DOCTYPE
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

/**
 * Trigger download of an HTML file.
 */
export function downloadHtml(html: string, fileName: string): void {
  const cleanHtml = serializeCleanHtml(html);
  const blob = new Blob([cleanHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
