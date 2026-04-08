/**
 * Section detection logic for multi-screen capture.
 * Detects whether an HTML document is a slide deck or scroll page,
 * then identifies sections for individual capture.
 */

export interface SectionInfo {
  index: number;
  label: string;
  top: number;
  height: number;
  selector: string;
  revealH?: number; // Reveal.js horizontal index
  revealV?: number; // Reveal.js vertical index
}

/**
 * Detect page type: slide deck or scroll page
 */
export function detectPageType(doc: Document): 'slides' | 'scroll' {
  // Check for reveal.js: nested section > section
  const revealSections = doc.querySelectorAll('.reveal section, .slides section');
  if (revealSections.length > 1) return 'slides';

  // Check for slide/page classes
  const slideElements = doc.querySelectorAll('[data-slide], .slide, .page, .swiper-slide');
  if (slideElements.length > 1) return 'slides';

  // Check for impress.js
  const impressSteps = doc.querySelectorAll('.step, [data-step]');
  if (impressSteps.length > 1) return 'slides';

  // Check if direct body children have 100vh height
  const body = doc.body;
  if (body) {
    const children = Array.from(body.children).filter(
      (el) => el instanceof HTMLElement && !isBridgeElement(el)
    ) as HTMLElement[];

    if (children.length > 1) {
      const fullHeightCount = children.filter((child) => {
        const cs = doc.defaultView?.getComputedStyle(child);
        if (!cs) return false;
        const h = cs.height;
        const vh = doc.defaultView?.innerHeight ?? 0;
        return Math.abs(parseFloat(h) - vh) < 10;
      }).length;
      if (fullHeightCount >= children.length * 0.8) return 'slides';
    }
  }

  return 'scroll';
}

function isBridgeElement(el: Element): boolean {
  return (
    el.hasAttribute('data-bridge') ||
    el.hasAttribute('data-bridge-styles') ||
    el.tagName.toLowerCase() === 'script' ||
    (el.tagName.toLowerCase() === 'style' && el.hasAttribute('data-bridge-styles'))
  );
}

/**
 * Parse RGB color string to numeric values
 */
function parseRgb(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  return null;
}

/**
 * Calculate RGB channel difference
 */
function rgbDiff(a: [number, number, number], b: [number, number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

/**
 * Detect sections in the document
 */
export function detectSections(doc: Document, pageType: 'slides' | 'scroll'): SectionInfo[] {
  if (pageType === 'slides') {
    return detectSlideSections(doc);
  }
  return detectScrollSections(doc);
}

function detectSlideSections(doc: Document): SectionInfo[] {
  // Try reveal.js
  let slides = doc.querySelectorAll('.reveal section:not(section section), .slides > section');
  if (slides.length === 0) {
    slides = doc.querySelectorAll('[data-slide], .slide, .page, .swiper-slide, .step');
  }

  if (slides.length === 0) {
    // Fallback: body direct children
    const children = Array.from(doc.body.children).filter(
      (el) => el instanceof HTMLElement && !isBridgeElement(el)
    );
    slides = children as unknown as NodeListOf<Element>;
  }

  return Array.from(slides).map((el, i) => {
    const htmlEl = el as HTMLElement;
    const rect = htmlEl.getBoundingClientRect();
    return {
      index: i,
      label: `슬라이드 ${i + 1}`,
      top: rect.top + (doc.defaultView?.scrollY ?? 0),
      height: rect.height,
      selector: `[data-editor-id="${htmlEl.getAttribute('data-editor-id') || ''}"]`,
    };
  });
}

function detectScrollSections(doc: Document): SectionInfo[] {
  const body = doc.body;
  if (!body) return [];

  // Strategy 1: <section> tags
  const sectionTags = body.querySelectorAll('section');
  if (sectionTags.length > 1) {
    return Array.from(sectionTags).map((el, i) => {
      const rect = el.getBoundingClientRect();
      return {
        index: i,
        label: el.id ? `섹션: ${el.id}` : `섹션 ${i + 1}`,
        top: rect.top + (doc.defaultView?.scrollY ?? 0),
        height: rect.height,
        selector: el.id ? `#${el.id}` : `section:nth-of-type(${i + 1})`,
      };
    });
  }

  // Strategy 2: Background color changes among direct children
  const children = Array.from(body.children).filter(
    (el) => el instanceof HTMLElement && !isBridgeElement(el)
  ) as HTMLElement[];

  if (children.length > 1) {
    const win = doc.defaultView;
    if (win) {
      const bgColors = children.map((child) => {
        const cs = win.getComputedStyle(child);
        return cs.backgroundColor;
      });

      const sections: SectionInfo[] = [];
      let sectionStart = 0;
      let prevColor = parseRgb(bgColors[0]);

      for (let i = 1; i <= children.length; i++) {
        const currentColor = i < children.length ? parseRgb(bgColors[i]) : null;
        const isTransparent = !currentColor || bgColors[i] === 'rgba(0, 0, 0, 0)';
        const changed =
          i === children.length ||
          (prevColor && currentColor && !isTransparent && rgbDiff(prevColor, currentColor) > 30);

        if (changed) {
          // Calculate combined rect for this section group
          let top = Infinity;
          let bottom = -Infinity;
          for (let j = sectionStart; j < i; j++) {
            const rect = children[j].getBoundingClientRect();
            const absTop = rect.top + (win.scrollY ?? 0);
            top = Math.min(top, absTop);
            bottom = Math.max(bottom, absTop + rect.height);
          }
          sections.push({
            index: sections.length,
            label: `섹션 ${sections.length + 1}`,
            top,
            height: bottom - top,
            selector: '',
          });
          sectionStart = i;
          if (!isTransparent) prevColor = currentColor;
        }
      }

      if (sections.length > 1) return sections;
    }
  }

  // Strategy 3: Elements with id attributes
  const idElements = Array.from(body.querySelectorAll('[id]')).filter((el) => {
    const tag = el.tagName.toLowerCase();
    return ['div', 'section', 'article', 'main', 'header', 'footer', 'nav'].includes(tag);
  }) as HTMLElement[];

  if (idElements.length > 1) {
    return idElements.map((el, i) => {
      const rect = el.getBoundingClientRect();
      return {
        index: i,
        label: `섹션: ${el.id}`,
        top: rect.top + (doc.defaultView?.scrollY ?? 0),
        height: rect.height,
        selector: `#${el.id}`,
      };
    });
  }

  // Fallback: entire page as one section
  return [
    {
      index: 0,
      label: '전체 페이지',
      top: 0,
      height: body.scrollHeight,
      selector: 'body',
    },
  ];
}
