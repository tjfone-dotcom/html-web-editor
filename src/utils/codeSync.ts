import type { SelectedElement } from '../types/editor';

// Monaco editor instance — set by CodeEditor.tsx onMount
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let monacoEditorInstance: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setMonacoEditorInstance(ed: any | null) {
  monacoEditorInstance = ed;
}

// Last cursor line in Monaco — saved before code→preview switch
export const lastCursorLine = { value: null as number | null };

// Preview→Code 전환 시 스크롤 대상 라인 (ViewToggle이 저장, CodeEditor가 소비)
export const pendingCodeScroll = { line: null as number | null };

// --- Character position ↔ Line number conversion ---

function charPosToLine(text: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

// --- HTML Context matching (100-char raw HTML) ---

/**
 * Find the 1-based line number by matching raw HTML context (50+50 chars).
 * Used for Preview→Code direction.
 */
export function findLineByHtmlContext(
  htmlContent: string,
  context: { before: string; after: string },
): number {
  // Full 100-char match
  const searchStr = context.before + context.after;
  const pos = htmlContent.indexOf(searchStr);
  if (pos !== -1) {
    return charPosToLine(htmlContent, pos + context.before.length);
  }

  // Fallback: match after part only (handles minor diffs in preceding HTML)
  if (context.after) {
    const afterPos = htmlContent.indexOf(context.after);
    if (afterPos !== -1) {
      return charPosToLine(htmlContent, afterPos);
    }
  }

  return 0; // 0 = not found (caller should try fallback methods)
}

/**
 * Extract raw HTML context (50 chars before + 50 chars after) at a given line.
 * Used for Code→Preview direction.
 */
export function findHtmlContextAtLine(
  htmlContent: string,
  targetLine: number,
): { before: string; after: string } | null {
  const lines = htmlContent.split('\n');
  if (targetLine < 1 || targetLine > lines.length) return null;

  // Line number → character position (skip leading whitespace to point at actual content)
  let charPos = 0;
  for (let i = 0; i < targetLine - 1; i++) {
    charPos += lines[i].length + 1; // +1 for \n
  }
  // Skip leading whitespace on the target line
  const lineContent = lines[targetLine - 1];
  const trimmedStart = lineContent.length - lineContent.trimStart().length;
  charPos += trimmedStart;

  // Extract 50 chars before + 50 chars after the content start
  const before = htmlContent.substring(Math.max(0, charPos - 50), charPos);
  const after = htmlContent.substring(charPos, Math.min(htmlContent.length, charPos + 50));

  return { before, after };
}

/**
 * Find which slide index the cursor line belongs to in a slide-deck HTML.
 * Counts slide-boundary patterns (common slide classes/tags) above the target line.
 */
export function findSlideIndexAtLine(
  htmlContent: string,
  targetLine: number,
): number {
  const lines = htmlContent.split('\n');
  // Patterns that typically start a new slide
  const slidePatterns = [
    /class="[^"]*\bslide\b/,
    /class="[^"]*\bswiper-slide\b/,
    /class="[^"]*\bstep\b/,
    /class="[^"]*\bsection\b/,        // Reveal.js uses <section>
    /<section[\s>]/,                    // Reveal.js sections
  ];

  let slideIndex = 0;
  for (let i = 0; i < targetLine && i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of slidePatterns) {
      if (pattern.test(line)) {
        slideIndex++;
        break;
      }
    }
  }
  // Convert to 0-based index
  return Math.max(0, slideIndex - 1);
}

// --- Legacy CSS selector matching (kept as fallback) ---

/**
 * Find a CSS selector for the nearest element at or above the given line.
 * Scans backwards from targetLine to find a tag with id, class, or data-editor-id.
 */
export function findElementSelectorAtLine(
  htmlContent: string,
  targetLine: number,
): string | null {
  const lines = htmlContent.split('\n');

  for (let i = targetLine - 1; i >= 0; i--) {
    const line = lines[i];
    // data-editor-id (most reliable)
    const editorIdMatch = line.match(/data-editor-id="([^"]+)"/);
    if (editorIdMatch) return '[data-editor-id="' + editorIdMatch[1] + '"]';
    // id attribute
    const idMatch = line.match(/id="([^"]+)"/);
    if (idMatch) return '#' + CSS.escape(idMatch[1]);
    // class attribute (first class)
    const classMatch = line.match(/class="([^"]+)"/);
    if (classMatch) {
      const firstClass = classMatch[1].trim().split(/\s+/)[0];
      if (firstClass) return '.' + CSS.escape(firstClass);
    }
  }
  return null;
}

/**
 * Find the 1-based line number in htmlContent corresponding to the selected element.
 * Priority: htmlContext → openingTag → id → first class + text → all classes
 */
export function findLineForSelectedElement(
  htmlContent: string,
  selectedElement: SelectedElement,
): number {
  // 1st: htmlContext matching (most reliable — raw HTML 100-char context)
  if (selectedElement.htmlContext) {
    const result = findLineByHtmlContext(htmlContent, selectedElement.htmlContext);
    if (result > 0) return result;
  }

  const lines = htmlContent.split('\n');

  // 2nd: openingTag (exact match from bridge)
  if (selectedElement.openingTag) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(selectedElement.openingTag)) return i + 1;
    }
    // Normalize whitespace for minified HTML
    const normalized = selectedElement.openingTag.replace(/\s+/g, ' ');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].replace(/\s+/g, ' ').includes(normalized)) return i + 1;
    }
  }

  // 3rd: id attribute
  if (selectedElement.id) {
    const byId = `id="${selectedElement.id}"`;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(byId)) return i + 1;
    }
  }

  // 4th: first class + text content (look in 8-line window after class match)
  const text = selectedElement.textContent?.trim() ?? '';
  const firstClass = selectedElement.className?.trim().split(/\s+/)[0] ?? '';
  if (firstClass && text) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(firstClass)) {
        const windowEnd = Math.min(i + 8, lines.length);
        const windowText = lines.slice(i, windowEnd).join(' ');
        if (windowText.includes(text.slice(0, 20))) return i + 1;
      }
    }
  }

  // 5th: all classes on the same line
  const allClasses = selectedElement.className?.trim().split(/\s+/) ?? [];
  if (allClasses.length > 1) {
    for (let i = 0; i < lines.length; i++) {
      if (allClasses.every(c => lines[i].includes(c))) return i + 1;
    }
  }

  return 1;
}
