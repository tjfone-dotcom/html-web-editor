import type { ElementType } from '../types/editor';

/**
 * Parent-side element classifier — mirrors the logic in the bridge script.
 * Classifies an element by its tag name, class list, and ARIA role.
 */
export function classifyElement(
  tagName: string,
  classList: string[],
  role: string | null
): ElementType {
  const tag = tagName.toLowerCase();

  // Button first
  if (tag === 'button' || classList.includes('btn') || role === 'button') {
    return 'button';
  }

  // Text elements
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'li'].includes(tag)) {
    return 'text';
  }

  // Image
  if (tag === 'img') return 'image';

  // Line
  if (tag === 'hr') return 'line';

  // Unsupported
  if (['video', 'svg', 'canvas', 'iframe'].includes(tag)) return 'unsupported';

  // Default
  return 'box';
}
