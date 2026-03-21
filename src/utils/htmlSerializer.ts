/**
 * Serializes the iframe's DOM into clean HTML, removing all bridge artifacts.
 */

/** Navigation classes added by slide frameworks (mirrors bridge.ts NAV_CLASSES) */
const SLIDE_NAV_CLASSES = [
  'active', 'current', 'present', 'visible', 'swiper-slide-active',
  'hidden', 'past', 'future', 'swiper-slide-prev', 'swiper-slide-next',
];

/**
 * Slide container selectors in priority order (mirrors bridge.ts getSlideSelector logic).
 * The first selector that matches 2+ elements is used.
 */
const SLIDE_SELECTORS = [
  '.reveal section:not(section section)',
  '.slides > section',
  '.slide',
  '.page',
  '.swiper-slide',
  '[data-slide]',
  '.step',
];

/**
 * Reset slide navigation state so the saved HTML always opens at slide 1.
 * Removes framework-injected navigation classes and visibility inline styles
 * from slide container elements, without touching user-applied styles.
 */
function resetSlideNavState(doc: Document): void {
  let slideEls: NodeListOf<Element> | null = null;
  for (const sel of SLIDE_SELECTORS) {
    const found = doc.querySelectorAll(sel);
    if (found.length > 1) { slideEls = found; break; }
  }
  if (!slideEls) return;

  slideEls.forEach((el) => {
    const htmlEl = el as HTMLElement;
    // Remove navigation classes added by slide frameworks
    SLIDE_NAV_CLASSES.forEach((cls) => htmlEl.classList.remove(cls));
    // Reset inline visibility styles used by frameworks to hide inactive slides
    if (htmlEl.style.display === 'none') htmlEl.style.display = '';
    if (htmlEl.style.visibility === 'hidden') htmlEl.style.visibility = '';
    if (htmlEl.style.opacity === '0') htmlEl.style.opacity = '';
  });

  // Restore the first-slide active state so the file opens at slide 1.
  // Simple CSS-driven decks (e.g. custom slide-deck-generator output) rely on
  // an 'active' class being present in the HTML to make the first slide visible;
  // there is no JS init that adds it programmatically. For framework-driven
  // players (Reveal.js, Swiper) the framework JS re-initializes on load anyway,
  // so the extra class is harmless.
  (slideEls[0] as HTMLElement).classList.add('active');
}

/**
 * Remove runtime-added classes from scroll animation libraries so they
 * re-initialize properly when the saved HTML is reopened.
 *
 * AOS: adds `aos-init` on library init, `aos-animate` when an element enters
 * the viewport. If present in saved HTML, AOS treats those elements as already
 * animated and skips scroll-triggering entirely on reload.
 */
function resetScrollAnimationState(doc: Document): void {
  const aosEls = doc.querySelectorAll('.aos-init, .aos-animate, [data-aos]');
  aosEls.forEach((el) => {
    el.classList.remove('aos-init', 'aos-animate');
  });
}

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

  // Reset slide framework navigation state so the file always opens at slide 1
  resetSlideNavState(doc);

  // Reset scroll animation library state so animations re-trigger on scroll
  resetScrollAnimationState(doc);

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
