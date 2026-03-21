/**
 * Bridge script that gets injected into the preview iframe.
 * Returns a self-contained JavaScript string — no imports, no modules.
 */
export function getBridgeScript(): string {
  return `
(function() {
  // Prevent double-initialization
  if (window.__bridgeInitialized) return;
  window.__bridgeInitialized = true;

  var idCounter = 0;
  var selectedEl = null;

  // Inject bridge styles
  var styleEl = document.createElement('style');
  styleEl.setAttribute('data-bridge-styles', '');
  styleEl.textContent = [
    '[data-bridge-hover] { outline: 2px dashed rgba(59,130,246,0.5) !important; outline-offset: -1px; }',
    '[data-bridge-selected] { outline: 2px solid #3b82f6 !important; outline-offset: -1px; }'
  ].join('\\n');
  document.head.appendChild(styleEl);

  // --- Helpers ---

  function isBridgeOrMeta(el) {
    if (!el || !el.tagName) return true;
    var tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'head' || tag === 'html') return true;
    if (el.hasAttribute && (el.hasAttribute('data-bridge') || el.hasAttribute('data-bridge-styles'))) return true;
    return false;
  }

  // Selectors for slide framework UI elements that should never be editable
  var FRAMEWORK_UI_SELECTORS = [
    // Reveal.js
    '.aria-status',
    '.reveal .controls', '.reveal .controls button',
    '.reveal .progress', '.reveal .slide-number',
    '.reveal .pause-overlay', '.reveal .backgrounds',
    '.reveal .playback', '.reveal .jump-to-slide',
    // Swiper
    '.swiper-button-next', '.swiper-button-prev',
    '.swiper-pagination', '.swiper-scrollbar',
    // Impress.js
    '#impress-toolbar', '#impress-console',
    '#impress-progressbar', '#impress-progress',
    // Slick
    '.slick-arrow', '.slick-prev', '.slick-next', '.slick-dots',
    // Deck.js pattern
    '.deck-status', '.deck-menu',
    // Generic slide deck controls
    '.slide-nav', '.slide-controls', '.nav-btn',
    '.prev-btn', '.next-btn', '.slide-counter',
  ];

  function isFrameworkUiElement(el) {
    if (!el || !el.matches) return false;
    for (var i = 0; i < FRAMEWORK_UI_SELECTORS.length; i++) {
      try {
        if (el.matches(FRAMEWORK_UI_SELECTORS[i]) ||
            (el.closest && el.closest(FRAMEWORK_UI_SELECTORS[i]))) return true;
      } catch(e) { /* ignore invalid selector */ }
    }
    return false;
  }

  function classifyElement(el) {
    var tag = el.tagName.toLowerCase();
    // button first
    if (tag === 'button' || (el.classList && el.classList.contains('btn')) || el.getAttribute('role') === 'button') return 'button';
    // text
    if (['h1','h2','h3','h4','h5','h6','p','span','a','label','li'].indexOf(tag) !== -1) return 'text';
    // image
    if (tag === 'img') return 'image';
    // line
    if (tag === 'hr') return 'line';
    // unsupported
    if (['video','svg','canvas','iframe'].indexOf(tag) !== -1) return 'unsupported';
    // default
    return 'box';
  }

  function getElementPath(el) {
    var path = [];
    var current = el;
    while (current && current !== document.documentElement) {
      if (current.nodeType === 1) {
        var tag = current.tagName.toLowerCase();
        var desc = tag;
        if (current.id) desc += '#' + current.id;
        else if (current.className && typeof current.className === 'string') {
          var cls = current.className.trim().split(/\\s+/).filter(function(c) {
            return c && c.indexOf('data-bridge') === -1;
          });
          if (cls.length > 0) desc += '.' + cls[0];
        }
        path.unshift(desc);
      }
      current = current.parentElement;
    }
    return path;
  }

  var styleProps = [
    'color','font-size','font-family','font-weight','font-style','text-align',
    'line-height','letter-spacing','background-color','background-image',
    'border','border-radius','padding','margin','box-shadow',
    'width','height','opacity','object-fit'
  ];

  function getComputedStylesSubset(el) {
    var cs = window.getComputedStyle(el);
    var result = {};
    for (var i = 0; i < styleProps.length; i++) {
      result[styleProps[i]] = cs.getPropertyValue(styleProps[i]);
    }
    return result;
  }

  function assignEditorId(el) {
    if (!el.getAttribute('data-editor-id')) {
      idCounter++;
      el.setAttribute('data-editor-id', 'el-' + idCounter);
    }
    return el.getAttribute('data-editor-id');
  }

  function selectElement(el, forceBox) {
    // Deselect previous
    if (selectedEl) {
      selectedEl.removeAttribute('data-bridge-selected');
    }
    selectedEl = el;
    el.setAttribute('data-bridge-selected', '');

    var editorId = assignEditorId(el);
    var tag = el.tagName.toLowerCase();
    var elType = classifyElement(el);
    // Treat text-like boxes as 'text' for the editor panel (unless forceBox)
    if (!forceBox && isTextLikeBox(el)) elType = 'text';
    var textContent = null;
    if (elType === 'text' || elType === 'button') {
      textContent = el.textContent || '';
    }

    // Build opening tag for source matching (strip bridge attributes)
    var tempDiv = document.createElement('div');
    tempDiv.appendChild(el.cloneNode(false));
    var openingTag = tempDiv.innerHTML
      .replace(/ data-bridge[^"]*="[^"]*"/g, '')
      .replace(/ data-editor-id="[^"]*"/g, '')
      .replace(/ contenteditable="[^"]*"/g, '');
    var gtIdx = openingTag.indexOf('>');
    if (gtIdx !== -1) openingTag = openingTag.substring(0, gtIdx + 1);

    // Build htmlContext: 50 chars before + 50 chars after the element's opening tag in clean HTML
    var htmlContext = null;
    try {
      var cleanHtml = serializeDOM();
      // Find the opening tag position in clean HTML
      var pos = cleanHtml.indexOf(openingTag);
      if (pos !== -1) {
        // If there are multiple occurrences, find the right one
        // by matching surrounding content too
        var elCleanOuter = el.cloneNode(true);
        // Remove bridge attributes from clone for matching
        var bridgeEls = elCleanOuter.querySelectorAll ? elCleanOuter.querySelectorAll('[data-editor-id],[data-bridge-hover],[data-bridge-selected],[contenteditable]') : [];
        for (var bi = 0; bi < bridgeEls.length; bi++) {
          bridgeEls[bi].removeAttribute('data-editor-id');
          bridgeEls[bi].removeAttribute('data-bridge-hover');
          bridgeEls[bi].removeAttribute('data-bridge-selected');
          bridgeEls[bi].removeAttribute('contenteditable');
        }
        if (elCleanOuter.removeAttribute) {
          elCleanOuter.removeAttribute('data-editor-id');
          elCleanOuter.removeAttribute('data-bridge-hover');
          elCleanOuter.removeAttribute('data-bridge-selected');
          elCleanOuter.removeAttribute('contenteditable');
        }
        var tmpDiv2 = document.createElement('div');
        tmpDiv2.appendChild(elCleanOuter);
        var cleanOuterHtml = tmpDiv2.innerHTML;
        // Find exact position using full outerHTML (handles duplicates)
        var exactPos = cleanHtml.indexOf(cleanOuterHtml);
        if (exactPos !== -1) pos = exactPos;

        var before = cleanHtml.substring(Math.max(0, pos - 50), pos);
        var after = cleanHtml.substring(pos, Math.min(cleanHtml.length, pos + 50));
        htmlContext = { before: before, after: after };
      }
    } catch(e) {
      console.log('[bridge] htmlContext error:', e);
    }

    window.parent.postMessage({
      type: 'ELEMENT_SELECTED',
      payload: {
        editorId: editorId,
        tagName: tag,
        className: (typeof el.className === 'string') ? el.className : '',
        id: el.id || '',
        elementType: elType,
        computedStyles: getComputedStylesSubset(el),
        textContent: textContent,
        path: getElementPath(el),
        openingTag: openingTag,
        htmlContext: htmlContext
      }
    }, '*');
  }

  function serializeDOM() {
    var clone = document.documentElement.cloneNode(true);
    // Remove bridge artifacts
    var bridgeScripts = clone.querySelectorAll('script[data-bridge]');
    for (var i = 0; i < bridgeScripts.length; i++) bridgeScripts[i].parentNode.removeChild(bridgeScripts[i]);
    var bridgeStyles = clone.querySelectorAll('style[data-bridge-styles]');
    for (var i = 0; i < bridgeStyles.length; i++) bridgeStyles[i].parentNode.removeChild(bridgeStyles[i]);
    // Remove bridge attributes
    var allEls = clone.querySelectorAll('[data-bridge-hover],[data-bridge-selected],[data-editor-id]');
    for (var i = 0; i < allEls.length; i++) {
      allEls[i].removeAttribute('data-bridge-hover');
      allEls[i].removeAttribute('data-bridge-selected');
      allEls[i].removeAttribute('data-editor-id');
    }
    // Also remove contenteditable that we set
    var editables = clone.querySelectorAll('[contenteditable]');
    for (var i = 0; i < editables.length; i++) {
      editables[i].removeAttribute('contenteditable');
    }
    return '<!DOCTYPE html>\\n' + clone.outerHTML;
  }

  function sendDOMUpdate() {
    window.parent.postMessage({
      type: 'DOM_UPDATED',
      payload: { html: serializeDOM() }
    }, '*');
  }

  // --- Slide Framework API Save/Restore (for REPLACE_DOM) ---
  // Detects known slide frameworks and saves/restores via their JS API,
  // so internal counters stay in sync — not just CSS classes.

  function captureFrameworkSlideIndex() {
    // Reveal.js
    if (window.Reveal && typeof window.Reveal.getIndices === 'function') {
      var idx = window.Reveal.getIndices();
      var result = { framework: 'reveal', h: idx.h, v: idx.v, f: idx.f !== undefined ? idx.f : -1 };
      console.log('[bridge] captureFrameworkSlideIndex:', JSON.stringify(result));
      return result;
    }

    // Swiper — find first initialized instance
    var swiperEl = document.querySelector('.swiper');
    if (swiperEl && swiperEl.swiper) {
      var result = { framework: 'swiper', index: swiperEl.swiper.activeIndex };
      console.log('[bridge] captureFrameworkSlideIndex:', JSON.stringify(result));
      return result;
    }

    // Impress.js
    if (window.impress && typeof window.impress === 'function') {
      var activeStep = document.querySelector('.step.active, .impress-on .active');
      if (activeStep) {
        var stepId = activeStep.id || '';
        var steps = document.querySelectorAll('.step');
        var stepIndex = 0;
        for (var i = 0; i < steps.length; i++) {
          if (steps[i] === activeStep) { stepIndex = i; break; }
        }
        var result = { framework: 'impress', id: stepId, index: stepIndex };
        console.log('[bridge] captureFrameworkSlideIndex:', JSON.stringify(result));
        return result;
      }
    }

    // Slick (jQuery)
    if (window.jQuery || window.$) {
      var jq = window.jQuery || window.$;
      var slickEl = jq && jq('.slick-initialized');
      if (slickEl && slickEl.length > 0 && slickEl.slick) {
        try {
          var result = { framework: 'slick', index: slickEl.slick('slickCurrentSlide') };
          console.log('[bridge] captureFrameworkSlideIndex:', JSON.stringify(result));
          return result;
        } catch(e) {}
      }
    }

    // Generic fallback: find active slide index by CSS class
    var sel = getSlideSelector();
    if (sel) {
      var slides = document.querySelectorAll(sel);
      var activeClasses = ['active', 'current', 'present', 'swiper-slide-active'];
      for (var i = 0; i < slides.length; i++) {
        for (var j = 0; j < activeClasses.length; j++) {
          if (slides[i].classList.contains(activeClasses[j])) {
            var result = { framework: 'generic', index: i, selector: sel };
            console.log('[bridge] captureFrameworkSlideIndex:', JSON.stringify(result));
            return result;
          }
        }
      }
    }

    // No framework detected — log available globals for debugging
    console.log('[bridge] captureFrameworkSlideIndex: no framework detected.',
      'Reveal:', typeof window.Reveal,
      'impress:', typeof window.impress,
      'jQuery:', typeof window.jQuery,
      'slideSelector:', getSlideSelector());
    return null;
  }

  function restoreFrameworkSlideIndex(saved) {
    if (!saved) return;
    console.log('[bridge] restoreFrameworkSlideIndex:', JSON.stringify(saved));

    // Reveal.js
    if (saved.framework === 'reveal' && window.Reveal && typeof window.Reveal.slide === 'function') {
      window.Reveal.slide(saved.h, saved.v, saved.f);
      console.log('[bridge] Reveal.slide() called');
      return;
    }

    // Swiper
    if (saved.framework === 'swiper') {
      var swiperEl = document.querySelector('.swiper');
      if (swiperEl && swiperEl.swiper) {
        swiperEl.swiper.slideTo(saved.index, 0);
        console.log('[bridge] swiper.slideTo() called');
        return;
      }
    }

    // Impress.js
    if (saved.framework === 'impress' && window.impress && typeof window.impress === 'function') {
      var api = window.impress();
      if (api && typeof api.goto === 'function') {
        if (saved.id) {
          var el = document.getElementById(saved.id);
          if (el) { api.goto(el); console.log('[bridge] impress.goto() called'); return; }
        }
        var steps = document.querySelectorAll('.step');
        if (saved.index < steps.length) { api.goto(saved.index); console.log('[bridge] impress.goto() called'); return; }
      }
    }

    // Slick
    if (saved.framework === 'slick') {
      var jq = window.jQuery || window.$;
      if (jq) {
        var slickEl = jq('.slick-initialized');
        if (slickEl && slickEl.length > 0 && slickEl.slick) {
          try { slickEl.slick('slickGoTo', saved.index, true); console.log('[bridge] slick.slickGoTo() called'); return; } catch(e) {}
        }
      }
    }

    // Generic: try to find a custom slide controller on window
    if (saved.framework === 'generic' && saved.index !== undefined) {
      // Strategy 1 (PRIORITY): Set global index variable + call updateNav
      // goTo() often has "if (idx === current) return;" guard, so setting the
      // variable directly + calling updateNav is more reliable.
      var globalIndexVars = ['current', 'currentSlide', 'currentIndex', 'slideIndex', 'activeIndex'];
      for (var vi = 0; vi < globalIndexVars.length; vi++) {
        if (typeof window[globalIndexVars[vi]] === 'number') {
          console.log('[bridge] generic: setting global', globalIndexVars[vi], '=', saved.index);
          window[globalIndexVars[vi]] = saved.index;
          // Call update function if exists
          var updateFns = ['updateNav', 'updateUI', 'updateCounter', 'updateSlideNav', 'refreshNav'];
          for (var ui = 0; ui < updateFns.length; ui++) {
            if (typeof window[updateFns[ui]] === 'function') {
              console.log('[bridge] generic: calling global', updateFns[ui] + '()');
              window[updateFns[ui]]();
              break;
            }
          }
          return;
        }
      }

      // Strategy 2: Call global goTo with two-step trick to bypass "if (idx === current) return" guard
      var globalNavFns = ['goToSlide', 'goTo', 'slideTo', 'showSlide', 'navigateToSlide', 'jumpToSlide'];
      for (var fi = 0; fi < globalNavFns.length; fi++) {
        if (typeof window[globalNavFns[fi]] === 'function') {
          // First go to a different index to reset internal state
          var dummyIdx = saved.index === 0 ? 1 : 0;
          console.log('[bridge] generic: two-step goTo trick:', globalNavFns[fi] + '(' + dummyIdx + ') then ' + globalNavFns[fi] + '(' + saved.index + ')');
          window[globalNavFns[fi]](dummyIdx);
          window[globalNavFns[fi]](saved.index);
          return;
        }
      }

      // Strategy 3: Scan window for objects with slide-navigation methods
      var skipKeys = ['history','location','navigator','performance','screen','localStorage',
        'sessionStorage','caches','crypto','indexedDB','document','window','self','top',
        'parent','frames','opener','external','chrome','speechSynthesis','visualViewport'];
      var objNavMethods = ['goToSlide', 'goTo', 'slideTo', 'showSlide', 'navigateToSlide'];
      var objIndexProps = ['currentSlide', 'currentIndex', 'activeIndex', 'slideIndex'];
      var candidateKeys = Object.keys(window);
      for (var ki = 0; ki < candidateKeys.length; ki++) {
        var key = candidateKeys[ki];
        if (skipKeys.indexOf(key) !== -1) continue;
        try {
          var obj = window[key];
          if (!obj || typeof obj !== 'object' || obj === window || obj === document) continue;
          if (obj instanceof HTMLElement || obj instanceof NodeList) continue;
          for (var mi = 0; mi < objNavMethods.length; mi++) {
            if (typeof obj[objNavMethods[mi]] === 'function') {
              console.log('[bridge] generic: found nav method', key + '.' + objNavMethods[mi]);
              obj[objNavMethods[mi]](saved.index);
              return;
            }
          }
          for (var pi = 0; pi < objIndexProps.length; pi++) {
            if (typeof obj[objIndexProps[pi]] === 'number') {
              console.log('[bridge] generic: found index prop', key + '.' + objIndexProps[pi]);
              obj[objIndexProps[pi]] = saved.index;
              return;
            }
          }
        } catch(e) {}
      }

      console.log('[bridge] restoreFrameworkSlideIndex: generic — no controller found');
      return;
    }

    console.log('[bridge] restoreFrameworkSlideIndex: no matching restore for', saved.framework);
  }

  // --- Slide CSS State Save/Restore (fallback for unknown frameworks) ---

  function getSlideSelector() {
    if (document.querySelectorAll('.reveal section:not(section section)').length > 1)
      return '.reveal section:not(section section)';
    if (document.querySelectorAll('.slides > section').length > 1)
      return '.slides > section';
    var selectors = ['.slide', '.page', '.swiper-slide', '[data-slide]', '.step'];
    for (var si = 0; si < selectors.length; si++) {
      if (document.querySelectorAll(selectors[si]).length > 1) return selectors[si];
    }
    return null;
  }

  function getSlideElements() {
    var sel = getSlideSelector();
    if (sel) return Array.prototype.slice.call(document.querySelectorAll(sel));
    var children = [];
    for (var i = 0; i < document.body.children.length; i++) {
      var ch = document.body.children[i];
      if (ch.nodeType === 1 && !isBridgeOrMeta(ch)) children.push(ch);
    }
    return children;
  }

  var NAV_CLASSES = ['active','current','present','visible','swiper-slide-active',
                     'hidden','past','future','swiper-slide-prev','swiper-slide-next'];

  function captureSlideState() {
    var sel = getSlideSelector();
    var slides;
    var usingFallback = false;

    if (sel) {
      slides = Array.prototype.slice.call(document.querySelectorAll(sel));
    } else {
      var children = [];
      for (var i = 0; i < document.body.children.length; i++) {
        var ch = document.body.children[i];
        if (ch.nodeType === 1 && !isBridgeOrMeta(ch)) children.push(ch);
      }
      if (children.length < 2) return null;
      slides = children;
      usingFallback = true;
    }

    if (!slides || slides.length === 0) return null;
    var states = [];
    for (var i = 0; i < slides.length; i++) {
      var navCls = [];
      for (var j = 0; j < NAV_CLASSES.length; j++) {
        if (slides[i].classList.contains(NAV_CLASSES[j])) navCls.push(NAV_CLASSES[j]);
      }
      states.push({
        navClasses: navCls,
        display: slides[i].style.display,
        visibility: slides[i].style.visibility,
        opacity: slides[i].style.opacity,
        transform: slides[i].style.transform
      });
    }
    return { selector: sel, states: states, usingFallback: usingFallback };
  }

  function restoreSlideState(saved) {
    var slides;
    if (saved.selector) {
      slides = Array.prototype.slice.call(document.querySelectorAll(saved.selector));
    } else if (saved.usingFallback) {
      var children = [];
      for (var i = 0; i < document.body.children.length; i++) {
        var ch = document.body.children[i];
        if (ch.nodeType === 1 && !isBridgeOrMeta(ch)) children.push(ch);
      }
      slides = children;
    } else {
      return;
    }

    if (slides.length !== saved.states.length) return;
    for (var i = 0; i < slides.length; i++) {
      var st = saved.states[i];
      for (var j = 0; j < NAV_CLASSES.length; j++) slides[i].classList.remove(NAV_CLASSES[j]);
      for (var j = 0; j < st.navClasses.length; j++) slides[i].classList.add(st.navClasses[j]);
      slides[i].style.display = st.display || '';
      slides[i].style.visibility = st.visibility || '';
      slides[i].style.opacity = st.opacity || '';
      slides[i].style.transform = st.transform || '';
    }
  }

  // --- Find DOM element at a character position in serialized HTML ---

  function findElementAtHtmlPosition(html, charPos) {
    // Find <body> position to count only body-internal tags
    var bodyStart = html.indexOf('<body');
    if (bodyStart === -1) bodyStart = 0;

    // Count opening tags from <body> up to charPos (skip <body> itself)
    var bodyTagEnd = html.indexOf('>', bodyStart);
    var countStart = bodyTagEnd !== -1 ? bodyTagEnd + 1 : bodyStart;

    var openTagCount = 0;
    var tagRegex = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    tagRegex.lastIndex = countStart;
    var tagMatch;
    while ((tagMatch = tagRegex.exec(html)) !== null) {
      if (tagMatch.index > charPos) break;
      openTagCount++;
    }

    // Map to DOM element by counting elements in order (skip bridge-injected ones)
    var allElements = document.body.querySelectorAll('*');
    var cleanIndex = 0;
    for (var i = 0; i < allElements.length; i++) {
      var ael = allElements[i];
      if (ael.tagName === 'SCRIPT' && ael.hasAttribute('data-bridge')) continue;
      if (ael.tagName === 'STYLE' && ael.hasAttribute('data-bridge-styles')) continue;
      cleanIndex++;
      if (cleanIndex >= openTagCount) return ael;
    }
    return null;
  }

  // --- Scroll State Save/Restore (handles container-based scrolling) ---

  function getNodeIndexPath(el) {
    var path = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var parent = cur.parentElement;
      if (!parent) break;
      var idx = 0;
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i] === cur) { idx = i; break; }
      }
      path.unshift(idx);
      cur = parent;
    }
    return path;
  }

  function resolveElementByPath(path) {
    var cur = document.body;
    for (var i = 0; i < path.length; i++) {
      if (!cur || !cur.children || path[i] >= cur.children.length) return null;
      cur = cur.children[path[i]];
    }
    return cur;
  }

  function captureScrollState() {
    var results = [];
    // Window scroll
    results.push({ type: 'window', scrollX: window.scrollX, scrollY: window.scrollY });
    // documentElement & body
    if (document.documentElement.scrollTop > 0 || document.documentElement.scrollLeft > 0) {
      results.push({ type: 'docEl', scrollTop: document.documentElement.scrollTop, scrollLeft: document.documentElement.scrollLeft });
    }
    if (document.body.scrollTop > 0 || document.body.scrollLeft > 0) {
      results.push({ type: 'body', scrollTop: document.body.scrollTop, scrollLeft: document.body.scrollLeft });
    }
    // Scrollable containers with actual scroll offset
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.scrollTop === 0 && el.scrollLeft === 0) continue;
      var cs = window.getComputedStyle(el);
      var ov = cs.overflow + ' ' + cs.overflowX + ' ' + cs.overflowY;
      if (ov.indexOf('auto') !== -1 || ov.indexOf('scroll') !== -1) {
        results.push({ type: 'element', path: getNodeIndexPath(el), scrollTop: el.scrollTop, scrollLeft: el.scrollLeft });
      }
    }
    return results;
  }

  function restoreScrollState(saved) {
    for (var i = 0; i < saved.length; i++) {
      var entry = saved[i];
      if (entry.type === 'window') {
        window.scrollTo(entry.scrollX, entry.scrollY);
      } else if (entry.type === 'docEl') {
        document.documentElement.scrollTop = entry.scrollTop;
        document.documentElement.scrollLeft = entry.scrollLeft;
      } else if (entry.type === 'body') {
        document.body.scrollTop = entry.scrollTop;
        document.body.scrollLeft = entry.scrollLeft;
      } else if (entry.type === 'element' && entry.path) {
        var el = resolveElementByPath(entry.path);
        if (el) { el.scrollTop = entry.scrollTop; el.scrollLeft = entry.scrollLeft; }
      }
    }
  }

  // --- DOM Morph (for REPLACE_DOM - preserves event listeners) ---

  function morphAttributes(oldEl, newEl) {
    // Preserve runtime values of form elements before morphing
    var savedValue = null;
    var savedChecked = null;
    var isFormEl = false;
    var tag = oldEl.tagName ? oldEl.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      isFormEl = true;
      savedValue = oldEl.value;
      if (tag === 'input') savedChecked = oldEl.checked;
    }

    // Remove attributes not in new element (skip bridge attrs)
    for (var i = oldEl.attributes.length - 1; i >= 0; i--) {
      var name = oldEl.attributes[i].name;
      if (name === 'data-bridge-hover' || name === 'data-bridge-selected'
          || name === 'data-editor-id' || name === 'contenteditable') continue;
      if (!newEl.hasAttribute(name)) oldEl.removeAttribute(name);
    }
    // Set/update attributes from new element
    for (var i = 0; i < newEl.attributes.length; i++) {
      var attr = newEl.attributes[i];
      if (oldEl.getAttribute(attr.name) !== attr.value) {
        oldEl.setAttribute(attr.name, attr.value);
      }
    }

    // Restore runtime values (setAttribute resets .value for inputs)
    if (isFormEl && savedValue !== null) {
      oldEl.value = savedValue;
      if (savedChecked !== null) oldEl.checked = savedChecked;
    }
  }

  function morphNode(oldNode, newNode, parent) {
    // Text nodes
    if (oldNode.nodeType === 3 && newNode.nodeType === 3) {
      if (oldNode.textContent !== newNode.textContent) {

        oldNode.textContent = newNode.textContent;
      }
      return;
    }
    // Comment nodes
    if (oldNode.nodeType === 8 && newNode.nodeType === 8) {
      if (oldNode.textContent !== newNode.textContent) oldNode.textContent = newNode.textContent;
      return;
    }
    // Different type or tag → replace entirely
    if (oldNode.nodeType !== newNode.nodeType ||
        (oldNode.nodeType === 1 && newNode.nodeType === 1 && oldNode.tagName !== newNode.tagName)) {

      parent.replaceChild(document.importNode(newNode, true), oldNode);
      return;
    }
    // Same element → update attributes and recurse children
    if (oldNode.nodeType === 1) {
      morphAttributes(oldNode, newNode);
      morphChildren(oldNode, newNode);
    }
  }

  function morphChildren(oldParent, newParent) {
    // Collect non-bridge children
    var oldKids = [];
    var newKids = [];
    for (var i = 0; i < oldParent.childNodes.length; i++) {
      var n = oldParent.childNodes[i];
      if (n.nodeType === 1 && n.hasAttribute && (n.hasAttribute('data-bridge') || n.hasAttribute('data-bridge-styles'))) continue;
      oldKids.push(n);
    }
    for (var i = 0; i < newParent.childNodes.length; i++) {
      newKids.push(newParent.childNodes[i]);
    }

    // Find first bridge element as insert anchor
    var bridgeAnchor = null;
    for (var i = 0; i < oldParent.childNodes.length; i++) {
      var n = oldParent.childNodes[i];
      if (n.nodeType === 1 && n.hasAttribute && (n.hasAttribute('data-bridge') || n.hasAttribute('data-bridge-styles'))) {
        bridgeAnchor = n;
        break;
      }
    }

    var maxLen = Math.max(oldKids.length, newKids.length);
    for (var i = 0; i < maxLen; i++) {
      if (i >= oldKids.length) {
        // Add new node
        oldParent.insertBefore(document.importNode(newKids[i], true), bridgeAnchor);
      } else if (i >= newKids.length) {
        // Remove extra old node
        oldParent.removeChild(oldKids[i]);
      } else {
        morphNode(oldKids[i], newKids[i], oldParent);
      }
    }
  }

  // --- Event Handlers ---

  document.addEventListener('mouseover', function(e) {
    var el = e.target;
    if (isBridgeOrMeta(el) || isFrameworkUiElement(el) || el === document.body) return;
    el.setAttribute('data-bridge-hover', '');
  }, true);

  document.addEventListener('mouseout', function(e) {
    var el = e.target;
    if (el && el.removeAttribute) {
      el.removeAttribute('data-bridge-hover');
    }
  }, true);

  // Inline/formatting tags that don't make an element a "box"
  var inlineTags = ['br','b','i','em','strong','u','small','sub','sup','mark','wbr','s','del','ins','abbr','code','kbd','var','samp','cite','dfn','time','data','ruby','rt','rp','bdi','bdo','span'];

  function hasOnlyInlineChildren(el) {
    for (var i = 0; i < el.children.length; i++) {
      if (inlineTags.indexOf(el.children[i].tagName.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function isTextLikeBox(el) {
    return classifyElement(el) === 'box' && hasOnlyInlineChildren(el) && el.textContent.trim().length > 0;
  }

  // Smart target: prefer text/button children inside box elements
  function findBestTarget(el) {
    var type = classifyElement(el);
    if (type !== 'box') return el;

    // box with only inline/formatting tags + text content → text-like, select it
    if (isTextLikeBox(el)) return el;

    // box: look for a single text/button child
    var textChildren = [];
    for (var i = 0; i < el.children.length; i++) {
      var child = el.children[i];
      if (isBridgeOrMeta(child)) continue;
      var childType = classifyElement(child);
      if (childType === 'text' || childType === 'button' || isTextLikeBox(child)) {
        textChildren.push(child);
      }
    }
    if (textChildren.length === 1) return textChildren[0];

    // Recurse: if single non-bridge child is a box, dig deeper
    var nonBridgeChildren = [];
    for (var i = 0; i < el.children.length; i++) {
      if (!isBridgeOrMeta(el.children[i])) nonBridgeChildren.push(el.children[i]);
    }
    if (nonBridgeChildren.length === 1) {
      return findBestTarget(nonBridgeChildren[0]);
    }

    return el;
  }

  function enableInlineEdit(el) {
    if (el.contentEditable === 'true') return;
    el.contentEditable = 'true';
    el.focus();

    // Block keyboard events from reaching slide frameworks while editing.
    // ESC is excepted: blur the element to exit edit mode via onBlur().
    function stopKeyPropagation(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        el.blur();
        return;
      }
      e.stopPropagation();
    }
    document.addEventListener('keydown', stopKeyPropagation, true);
    document.addEventListener('keyup', stopKeyPropagation, true);
    document.addEventListener('keypress', stopKeyPropagation, true);

    function sendTextChanged() {
      window.parent.postMessage({
        type: 'TEXT_CHANGED',
        payload: {
          editorId: el.getAttribute('data-editor-id') || '',
          text: el.textContent || ''
        }
      }, '*');
    }

    function onInput() {
      sendTextChanged();
    }

    function onBlur() {
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('input', onInput);
      document.removeEventListener('keydown', stopKeyPropagation, true);
      document.removeEventListener('keyup', stopKeyPropagation, true);
      document.removeEventListener('keypress', stopKeyPropagation, true);
      el.contentEditable = 'false';
      el.removeAttribute('contenteditable');
      sendTextChanged();
      sendDOMUpdate();
    }

    el.addEventListener('input', onInput);
    el.addEventListener('blur', onBlur);
  }

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var el = findBestTarget(e.target);

    // If target is a box with no meaningful text, try to find a better target underneath
    if (el && classifyElement(el) === 'box' && !isTextLikeBox(el)) {
      var elements = document.elementsFromPoint(e.clientX, e.clientY);
      for (var ei = 0; ei < elements.length; ei++) {
        var candidate = elements[ei];
        if (candidate === el || isBridgeOrMeta(candidate) || candidate === document.body) continue;

        // Check if the candidate itself is a text/button element (e.g. a <span>)
        var candidateType = classifyElement(candidate);
        if (candidateType === 'text' || candidateType === 'button') {
          el = candidate;
          break;
        }

        // Otherwise try findBestTarget on the candidate
        var best = findBestTarget(candidate);
        var bestType = classifyElement(best);
        if (bestType === 'text' || bestType === 'button' || isTextLikeBox(best)) {
          el = best;
          break;
        }
      }
    }

    if (isBridgeOrMeta(el) || isFrameworkUiElement(el) || el === document.body) return;
    el.removeAttribute('data-bridge-hover');
    selectElement(el);

    // Text/button/text-like box: immediately enable inline editing
    var elType = classifyElement(el);
    if (elType === 'text' || elType === 'button' || isTextLikeBox(el)) {
      enableInlineEdit(el);
    }
  }, true);

  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedEl) return;

    // Disable inline editing on current element if active
    if (selectedEl.contentEditable === 'true') {
      selectedEl.contentEditable = 'false';
      selectedEl.removeAttribute('contenteditable');
    }

    // text-like-box: re-select same element as box type (show box properties)
    if (isTextLikeBox(selectedEl)) {
      selectElement(selectedEl, true);
      return;
    }

    // Normal text/button: select parent
    if (selectedEl.parentElement
        && selectedEl.parentElement !== document.body
        && selectedEl.parentElement !== document.documentElement) {
      selectElement(selectedEl.parentElement);
    }
  }, true);

  // Intercept link clicks and form submissions
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName && el.tagName.toLowerCase() === 'a' && el.hasAttribute('href')) {
        e.preventDefault();
        return;
      }
      el = el.parentElement;
    }
  }, true);

  document.addEventListener('submit', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // --- Listen for messages from parent ---

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'UPDATE_STYLES' && msg.payload) {
      var el = document.querySelector('[data-editor-id="' + msg.payload.editorId + '"]');
      if (el && msg.payload.styles) {
        var styles = msg.payload.styles;
        for (var prop in styles) {
          if (styles.hasOwnProperty(prop)) {
            el.style[prop] = styles[prop];
          }
        }
        sendDOMUpdate();
      }
    }

    if (msg.type === 'UPDATE_ATTRIBUTE' && msg.payload) {
      var el = document.querySelector('[data-editor-id="' + msg.payload.editorId + '"]');
      if (el && msg.payload.attributes) {
        var attrs = msg.payload.attributes;
        for (var attr in attrs) {
          if (attrs.hasOwnProperty(attr)) {
            el.setAttribute(attr, attrs[attr]);
          }
        }
        sendDOMUpdate();
      }
    }

    if (msg.type === 'UPDATE_TEXT' && msg.payload) {
      var el = document.querySelector('[data-editor-id="' + msg.payload.editorId + '"]');
      if (el) {
        el.textContent = msg.payload.text;
        sendDOMUpdate();
      }
    }

    if (msg.type === 'DESELECT') {
      if (selectedEl) {
        selectedEl.removeAttribute('data-bridge-selected');
        selectedEl = null;
      }
    }

    if (msg.type === 'REQUEST_HTML') {
      sendDOMUpdate();
    }

    // --- DOM Navigation ---
    if (msg.type === 'SELECT_PARENT') {
      if (selectedEl && selectedEl.parentElement
          && selectedEl.parentElement !== document.body
          && selectedEl.parentElement !== document.documentElement) {
        if (selectedEl.contentEditable === 'true') {
          selectedEl.contentEditable = 'false';
          selectedEl.removeAttribute('contenteditable');
        }
        selectElement(selectedEl.parentElement);
      }
    }

    if (msg.type === 'SELECT_CHILD') {
      if (selectedEl) {
        for (var ci = 0; ci < selectedEl.children.length; ci++) {
          var child = selectedEl.children[ci];
          if (!isBridgeOrMeta(child)) {
            selectElement(child);
            break;
          }
        }
      }
    }

    // --- DOM Replace via morph (preserves event listeners) ---
    if (msg.type === 'REPLACE_DOM' && msg.payload && msg.payload.html) {
      var scrollState = captureScrollState();

      var parser = new DOMParser();
      var newDoc = parser.parseFromString(msg.payload.html, 'text/html');
      morphChildren(document.body, newDoc.body);

      restoreScrollState(scrollState);

      if (selectedEl) {
        selectedEl.removeAttribute('data-bridge-selected');
        selectedEl = null;
        window.parent.postMessage({ type: 'ELEMENT_SELECTED', payload: null }, '*');
      }
    }

    // --- Scroll to a specific element ---
    if (msg.type === 'SCROLL_TO_ELEMENT' && msg.payload) {
      var scrollTarget = null;
      if (msg.payload.editorId) {
        scrollTarget = document.querySelector('[data-editor-id="' + msg.payload.editorId + '"]');
      }
      if (!scrollTarget && msg.payload.selector) {
        try { scrollTarget = document.querySelector(msg.payload.selector); } catch(e) {}
      }
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: msg.payload.behavior || 'smooth', block: 'center' });
      }
    }

    // --- Scroll to element by HTML context (100-char raw HTML matching) ---
    if (msg.type === 'SCROLL_TO_HTML_CONTEXT' && msg.payload) {
      var hctx = msg.payload;
      var searchStr = hctx.before + hctx.after;
      var ctxCleanHtml = serializeDOM();
      var ctxMatchPos = ctxCleanHtml.indexOf(searchStr);
      if (ctxMatchPos === -1 && hctx.after) {
        // Fallback: match after part only
        ctxMatchPos = ctxCleanHtml.indexOf(hctx.after);
      }
      if (ctxMatchPos !== -1) {
        // Find DOM element at the matched position
        var targetCharPos = ctxMatchPos + (hctx.before ? hctx.before.length : 0);
        var ctxTarget = findElementAtHtmlPosition(ctxCleanHtml, targetCharPos);
        if (ctxTarget) {
          ctxTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      }
    }

    // --- Restore full scroll state (after iframe reload) ---
    if (msg.type === 'RESTORE_SCROLL' && msg.payload && msg.payload.state) {
      restoreScrollState(msg.payload.state);
    }

    // --- Navigate to specific slide (after iframe reload) ---
    if (msg.type === 'NAVIGATE_TO_SLIDE' && msg.payload && msg.payload.index !== undefined) {
      var targetIdx = msg.payload.index;
      console.log('[bridge] NAVIGATE_TO_SLIDE: index=' + targetIdx);
      // Reveal.js
      if (window.Reveal && typeof window.Reveal.slide === 'function') {
        window.Reveal.slide(targetIdx);
        console.log('[bridge] Reveal.slide() called');
        return;
      }
      // Swiper
      var navSwiperEl = document.querySelector('.swiper');
      if (navSwiperEl && navSwiperEl.swiper) {
        navSwiperEl.swiper.slideTo(targetIdx, 0);
        console.log('[bridge] swiper.slideTo() called');
        return;
      }
      // Impress.js
      if (window.impress && typeof window.impress === 'function') {
        var impApi = window.impress();
        if (impApi && typeof impApi.goto === 'function') {
          var impSteps = document.querySelectorAll('.step');
          if (targetIdx < impSteps.length) {
            impApi.goto(targetIdx);
            console.log('[bridge] impress.goto() called');
            return;
          }
        }
      }
      // Slick (jQuery)
      if (window.jQuery || window.$) {
        var slickJq = window.jQuery || window.$;
        var slickEl = slickJq('.slick-initialized');
        if (slickEl && slickEl.length > 0 && slickEl.slick) {
          try { slickEl.slick('slickGoTo', targetIdx, true); console.log('[bridge] slick.slickGoTo() called'); return; } catch(e) {}
        }
      }
      // Generic: try common global navigation functions
      var navFns = ['goTo', 'goToSlide', 'slideTo', 'showSlide', 'navigateToSlide'];
      for (var nfi = 0; nfi < navFns.length; nfi++) {
        if (typeof window[navFns[nfi]] === 'function') {
          console.log('[bridge] calling window.' + navFns[nfi] + '(' + targetIdx + ')');
          window[navFns[nfi]](targetIdx);
          return;
        }
      }
      console.log('[bridge] NAVIGATE_TO_SLIDE: no navigation method found');
    }

    // --- Section Detection ---
    if (msg.type === 'DETECT_SECTIONS') {
      var sections = detectSectionsInIframe();
      window.parent.postMessage({
        type: 'SECTIONS_DETECTED',
        payload: { sections: sections }
      }, '*');
    }

    // --- Section Capture ---
    if (msg.type === 'CAPTURE_SECTION' && msg.payload) {
      captureSectionInIframe(msg.payload);
    }
  });

  // --- Section Detection Logic ---
  function detectSectionsInIframe() {
    var body = document.body;
    if (!body) return [];

    var pageType = detectPageTypeInIframe();
    if (pageType === 'slides') return detectSlides();
    return detectScrollSections();
  }

  function detectPageTypeInIframe() {
    // reveal.js
    var revealSections = document.querySelectorAll('.reveal section, .slides section');
    if (revealSections.length > 1) return 'slides';
    // slide/page classes
    var slideEls = document.querySelectorAll('[data-slide], .slide, .page, .swiper-slide');
    if (slideEls.length > 1) return 'slides';
    // impress.js
    var steps = document.querySelectorAll('.step, [data-step]');
    if (steps.length > 1) return 'slides';
    // 100vh children check
    var children = [];
    for (var i = 0; i < document.body.children.length; i++) {
      var ch = document.body.children[i];
      if (ch.nodeType === 1 && !isBridgeOrMeta(ch)) children.push(ch);
    }
    if (children.length > 1) {
      var fullHeightCount = 0;
      for (var i = 0; i < children.length; i++) {
        var cs = window.getComputedStyle(children[i]);
        var h = parseFloat(cs.height);
        if (Math.abs(h - window.innerHeight) < 10) fullHeightCount++;
      }
      if (fullHeightCount >= children.length * 0.8) return 'slides';
    }
    return 'scroll';
  }

  function detectSlides() {
    var slides = document.querySelectorAll('.reveal section:not(section section), .slides > section');
    if (slides.length === 0) {
      slides = document.querySelectorAll('[data-slide], .slide, .page, .swiper-slide, .step');
    }
    if (slides.length === 0) {
      var children = [];
      for (var i = 0; i < document.body.children.length; i++) {
        var ch = document.body.children[i];
        if (ch.nodeType === 1 && !isBridgeOrMeta(ch)) children.push(ch);
      }
      slides = children;
    }
    var result = [];
    for (var i = 0; i < slides.length; i++) {
      var el = slides[i];
      var rect = el.getBoundingClientRect();
      result.push({
        index: i,
        label: '슬라이드 ' + (i + 1),
        top: rect.top + window.scrollY,
        height: rect.height
      });
    }
    return result;
  }

  function detectScrollSections() {
    var body = document.body;
    // Strategy 1: section tags
    var sectionTags = body.querySelectorAll('section');
    if (sectionTags.length > 1) {
      var result = [];
      for (var i = 0; i < sectionTags.length; i++) {
        var el = sectionTags[i];
        var rect = el.getBoundingClientRect();
        result.push({
          index: i,
          label: el.id ? '섹션: ' + el.id : '섹션 ' + (i + 1),
          top: rect.top + window.scrollY,
          height: rect.height
        });
      }
      return result;
    }

    // Strategy 2: background color changes
    var children = [];
    for (var i = 0; i < body.children.length; i++) {
      var ch = body.children[i];
      if (ch.nodeType === 1 && !isBridgeOrMeta(ch)) children.push(ch);
    }

    if (children.length > 1) {
      var bgColors = [];
      for (var i = 0; i < children.length; i++) {
        bgColors.push(window.getComputedStyle(children[i]).backgroundColor);
      }
      var parseRgb = function(c) {
        var m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
        if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
        return null;
      };
      var sections = [];
      var secStart = 0;
      var prevColor = parseRgb(bgColors[0]);
      for (var i = 1; i <= children.length; i++) {
        var curColor = i < children.length ? parseRgb(bgColors[i]) : null;
        var isTransp = !curColor || bgColors[i] === 'rgba(0, 0, 0, 0)';
        var diff = 0;
        if (prevColor && curColor && !isTransp) {
          diff = Math.abs(prevColor[0]-curColor[0]) + Math.abs(prevColor[1]-curColor[1]) + Math.abs(prevColor[2]-curColor[2]);
        }
        var changed = (i === children.length) || (!isTransp && diff > 30);
        if (changed) {
          var top = Infinity, bottom = -Infinity;
          for (var j = secStart; j < i; j++) {
            var r = children[j].getBoundingClientRect();
            var absTop = r.top + window.scrollY;
            if (absTop < top) top = absTop;
            if (absTop + r.height > bottom) bottom = absTop + r.height;
          }
          sections.push({
            index: sections.length,
            label: '섹션 ' + (sections.length + 1),
            top: top,
            height: bottom - top
          });
          secStart = i;
          if (!isTransp) prevColor = curColor;
        }
      }
      if (sections.length > 1) return sections;
    }

    // Strategy 3: id-bearing block elements
    var idEls = body.querySelectorAll('[id]');
    var blockIds = [];
    for (var i = 0; i < idEls.length; i++) {
      var tag = idEls[i].tagName.toLowerCase();
      if (['div','section','article','main','header','footer','nav'].indexOf(tag) !== -1) {
        blockIds.push(idEls[i]);
      }
    }
    if (blockIds.length > 1) {
      var result = [];
      for (var i = 0; i < blockIds.length; i++) {
        var rect = blockIds[i].getBoundingClientRect();
        result.push({
          index: i,
          label: '섹션: ' + blockIds[i].id,
          top: rect.top + window.scrollY,
          height: rect.height
        });
      }
      return result;
    }

    // Fallback: entire page
    return [{
      index: 0,
      label: '전체 페이지',
      top: 0,
      height: body.scrollHeight
    }];
  }

  // --- Capture Logic ---

  // Fix background-clip:text elements before html2canvas (not supported → transparent text)
  function extractFirstGradientColor(bgImage) {
    if (!bgImage || bgImage === 'none') return null;
    var rgbMatch = bgImage.match(/rgba?\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+(?:\\s*,\\s*[\\d.]+)?\\s*\\)/);
    if (rgbMatch) return rgbMatch[0];
    var hexMatch = bgImage.match(/#[0-9a-fA-F]{3,8}/);
    if (hexMatch) return hexMatch[0];
    return null;
  }

  function fixClipTextForCapture() {
    var fixed = [];
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var cs = window.getComputedStyle(el);
      var bgClip = cs.webkitBackgroundClip || cs.backgroundClip || '';
      if (bgClip !== 'text') continue;
      var color = cs.color;
      var webkitFill = cs.webkitTextFillColor || '';
      var isTransparent = (color === 'rgba(0, 0, 0, 0)' || color === 'transparent'
                           || webkitFill === 'rgba(0, 0, 0, 0)' || webkitFill === 'transparent');
      if (!isTransparent) continue;
      var bgImage = cs.backgroundImage;
      var extractedColor = extractFirstGradientColor(bgImage);
      if (!extractedColor) extractedColor = '#333333';
      fixed.push({
        el: el,
        color: el.style.color,
        webkitTextFillColor: el.style.webkitTextFillColor,
        webkitBackgroundClip: el.style.webkitBackgroundClip,
        backgroundClip: el.style.backgroundClip,
        backgroundImage: el.style.backgroundImage
      });
      el.style.color = extractedColor;
      el.style.webkitTextFillColor = extractedColor;
      el.style.backgroundImage = 'none';
      el.style.webkitBackgroundClip = '';
      el.style.backgroundClip = '';
    }
    return fixed;
  }

  function restoreClipText(fixed) {
    for (var i = 0; i < fixed.length; i++) {
      var item = fixed[i];
      item.el.style.color = item.color;
      item.el.style.webkitTextFillColor = item.webkitTextFillColor;
      item.el.style.backgroundImage = item.backgroundImage;
      item.el.style.webkitBackgroundClip = item.webkitBackgroundClip;
      item.el.style.backgroundClip = item.backgroundClip;
    }
  }

  // Fix large filter:blur values (html2canvas v1.4.1 renders them unblurred)
  function fixFilterForCapture() {
    var fixed = [];
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var cs = window.getComputedStyle(el);
      var filter = cs.filter;
      if (!filter || filter === 'none') continue;
      var blurMatch = filter.match(/blur\\(([\\d.]+)px\\)/);
      if (!blurMatch || parseFloat(blurMatch[1]) <= 20) continue;
      fixed.push({ el: el, filter: el.style.filter });
      el.style.filter = filter.replace(/blur\\(([\\d.]+)px\\)/g, function(m, val) {
        return 'blur(' + Math.min(parseFloat(val), 20) + 'px)';
      });
    }
    return fixed;
  }

  function restoreFilter(fixed) {
    for (var i = 0; i < fixed.length; i++) {
      fixed[i].el.style.filter = fixed[i].filter;
    }
  }

  // Force elements at opacity:0 / visibility:hidden to visible state.
  // Called after animation:none CSS is applied so elements are frozen at initial (hidden) state.
  function forceVisibleState(root) {
    var fixed = [];
    var all = (root || document).querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (isBridgeOrMeta(el)) continue;
      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'script' || tag === 'style' || tag === 'noscript') continue;

      var cs = window.getComputedStyle(el);
      var entry = null;

      var op = parseFloat(cs.opacity);
      if (op < 0.05) {
        entry = entry || { el: el };
        entry.opacity = el.style.opacity;
        el.style.opacity = '1';
        // Also clear off-screen transform for animation-displaced elements
        if (cs.transform && cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
          entry.transform = el.style.transform;
          el.style.transform = 'none';
        }
      }

      if (cs.visibility === 'hidden') {
        entry = entry || { el: el };
        entry.visibility = el.style.visibility;
        el.style.visibility = 'visible';
      }

      if (entry) fixed.push(entry);
    }
    return fixed;
  }

  function restoreForceVisible(fixed) {
    for (var i = 0; i < fixed.length; i++) {
      var item = fixed[i];
      if ('opacity' in item) item.el.style.opacity = item.opacity;
      if ('visibility' in item) item.el.style.visibility = item.visibility;
      if ('transform' in item) item.el.style.transform = item.transform;
    }
  }

  // Hide all position:fixed elements at bottom:0 (navigation bars, progress bars, etc.)
  // Called before html2canvas to exclude navigation UI from captured images.
  function hideFixedBottom() {
    var hidden = [];
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (isBridgeOrMeta(el)) continue;
      var cs = window.getComputedStyle(el);
      if (cs.position === 'fixed' && cs.bottom === '0px') {
        hidden.push({ el: el, display: el.style.display });
        el.style.display = 'none';
      }
    }
    return hidden;
  }

  function restoreFixedBottom(hidden) {
    for (var i = 0; i < hidden.length; i++) {
      hidden[i].el.style.display = hidden[i].display;
    }
  }

  function captureSlideByIsolation(idx, scale, format, quality) {
    var slides = getSlideElements();
    if (!slides || idx >= slides.length) {
      window.parent.postMessage({ type: 'SECTION_CAPTURED', payload: { index: idx, dataUrl: null } }, '*');
      return;
    }

    // Save each slide's inline styles
    var savedStyles = [];
    for (var i = 0; i < slides.length; i++) {
      savedStyles.push({
        display: slides[i].style.display,
        visibility: slides[i].style.visibility,
        opacity: slides[i].style.opacity,
        transform: slides[i].style.transform,
        position: slides[i].style.position,
        top: slides[i].style.top,
        left: slides[i].style.left,
        width: slides[i].style.width,
        zIndex: slides[i].style.zIndex
      });
    }

    // Isolate target slide: show it, hide others
    for (var i = 0; i < slides.length; i++) {
      if (i === idx) {
        slides[i].style.display = '';          // clear inline display → CSS class flex layout applies
        slides[i].style.visibility = 'visible';
        slides[i].style.opacity = '1';
        slides[i].style.transform = 'none';
        slides[i].style.zIndex = '10000';
      } else {
        slides[i].style.display = 'none';
      }
    }

    function restoreSlides() {
      for (var i = 0; i < slides.length; i++) {
        var s = savedStyles[i];
        slides[i].style.display = s.display;
        slides[i].style.visibility = s.visibility;
        slides[i].style.opacity = s.opacity;
        slides[i].style.transform = s.transform;
        slides[i].style.position = s.position;
        slides[i].style.top = s.top;
        slides[i].style.left = s.left;
        slides[i].style.width = s.width;
        slides[i].style.zIndex = s.zIndex;
      }
    }

    // Apply static freeze immediately after isolation to stop all CSS animations/transitions
    var oldSlideFreeze = document.querySelector('style[data-bridge-capture-fix]');
    if (oldSlideFreeze && oldSlideFreeze.parentNode) oldSlideFreeze.parentNode.removeChild(oldSlideFreeze);
    var slideFreezeStyle = document.createElement('style');
    slideFreezeStyle.setAttribute('data-bridge-capture-fix', '');
    slideFreezeStyle.textContent = [
      '*, *::before, *::after { transition: none !important; transition-duration: 0s !important; transition-delay: 0s !important; animation: none !important; }',
      '[data-aos] { opacity: 1 !important; transform: none !important; visibility: visible !important; }',
      '[data-sal] { opacity: 1 !important; transform: none !important; visibility: visible !important; }',
      '.wow { visibility: visible !important; opacity: 1 !important; }',
      '.animate__animated { opacity: 1 !important; }',
    ].join('\\n');
    document.head.appendChild(slideFreezeStyle);

    // Hide fixed bottom navigation (deck-nav, progress bars, etc.) before capture
    var fixedBottomHidden = hideFixedBottom();

    // Wait for repaint before capturing (increased to 300ms for JS-driven transitions to settle)
    setTimeout(function() {
      // Force visible state on target slide's children (handles animation:none initial state)
      var forceFixed = forceVisibleState(slides[idx]);
      var clipTextFixed = fixClipTextForCapture();
      var filterFixed = fixFilterForCapture();

      function restoreCaptureFixes() {
        if (slideFreezeStyle.parentNode) slideFreezeStyle.parentNode.removeChild(slideFreezeStyle);
        restoreForceVisible(forceFixed);
        restoreClipText(clipTextFixed);
        restoreFilter(filterFixed);
        restoreFixedBottom(fixedBottomHidden);
      }

      html2canvas(document.body, {
        scale: scale,
        useCORS: true,
        logging: false,
        x: 0,
        y: 0,
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        scrollX: 0,
        scrollY: 0
      }).then(function(canvas) {
        restoreCaptureFixes();
        restoreSlides();
        var dataUrl = canvas.toDataURL(format, quality);
        window.parent.postMessage({
          type: 'SECTION_CAPTURED',
          payload: { index: idx, dataUrl: dataUrl }
        }, '*');
      }).catch(function(err) {
        restoreCaptureFixes();
        restoreSlides();
        window.parent.postMessage({
          type: 'SECTION_CAPTURED',
          payload: { index: idx, dataUrl: null, error: err.message }
        }, '*');
      });
    }, 300);
  }

  function captureSectionInIframe(payload) {
    var idx = payload.index;
    var scale = payload.scale || 2;
    var format = payload.format || 'image/png';
    var quality = payload.quality || 0.92;

    if (typeof html2canvas === 'undefined') {
      window.parent.postMessage({ type: 'SECTION_CAPTURED', payload: { index: idx, dataUrl: null, error: 'html2canvas not available' } }, '*');
      return;
    }

    var pageType = detectPageTypeInIframe();

    if (pageType === 'slides') {
      captureSlideByIsolation(idx, scale, format, quality);
      return;
    }

    // Scroll page: scroll to section first to trigger scroll-based animations,
    // then capture after animations have settled.
    var sections = detectSectionsInIframe();
    if (idx >= sections.length) {
      window.parent.postMessage({ type: 'SECTION_CAPTURED', payload: { index: idx, dataUrl: null } }, '*');
      return;
    }

    var sec = sections[idx];

    // Save current scroll state so we can restore it after capture
    var savedScrollY = window.scrollY;
    var savedContainer = null;
    var savedContainerScrollTop = 0;

    // Step 1: Scroll to section so Intersection Observer / scroll animations trigger
    window.scrollTo(0, sec.top);
    // Also scroll any full-height overflow container (container-based scroll pages)
    var scrollEls = document.body.querySelectorAll('*');
    for (var si = 0; si < scrollEls.length; si++) {
      var sc = scrollEls[si];
      var scCS = window.getComputedStyle(sc);
      if ((scCS.overflowY === 'auto' || scCS.overflowY === 'scroll') &&
          sc.clientHeight >= window.innerHeight * 0.8 &&
          sc.scrollHeight > sc.clientHeight) {
        savedContainer = sc;
        savedContainerScrollTop = sc.scrollTop;
        sc.scrollTop = sec.top;
        break;
      }
    }

    // Step 2: Wait for IntersectionObserver callbacks to fire (scroll-based animations)
    // Reduced from 600ms: animation:none CSS makes CSS animations complete instantly
    setTimeout(function() {
      // Hide fixed bottom navigation before capture
      var fixedBottomHidden = hideFixedBottom();

      // Clean up any leftover fix style from a previous failed capture
      var oldFix = document.querySelector('style[data-bridge-capture-fix]');
      if (oldFix && oldFix.parentNode) oldFix.parentNode.removeChild(oldFix);

      // Step 3: Static freeze — disable ALL animations/transitions, force final visible state
      var fixStyle = document.createElement('style');
      fixStyle.setAttribute('data-bridge-capture-fix', '');
      fixStyle.textContent = [
        '*, *::before, *::after { transition: none !important; transition-duration: 0s !important; transition-delay: 0s !important; animation: none !important; }',
        '[data-aos] { opacity: 1 !important; transform: none !important; visibility: visible !important; }',
        '[data-sal] { opacity: 1 !important; transform: none !important; visibility: visible !important; }',
        '.wow { visibility: visible !important; opacity: 1 !important; }',
        '.animate__animated { opacity: 1 !important; }',
      ].join('\\n');
      document.head.appendChild(fixStyle);

      // Section element for min-height fix (html2canvas flex centering bug)
      var sectionEl = null;
      var savedSecHeight = null;
      var savedSecMinHeight = null;

      function restoreAfterCapture(clipTextFixed, filterFixed, forceFixed) {
        if (fixStyle.parentNode) fixStyle.parentNode.removeChild(fixStyle);
        if (sectionEl) {
          sectionEl.style.height = savedSecHeight;
          sectionEl.style.minHeight = savedSecMinHeight;
        }
        restoreForceVisible(forceFixed);
        restoreClipText(clipTextFixed);
        restoreFilter(filterFixed);
        restoreFixedBottom(fixedBottomHidden);
        window.scrollTo(0, savedScrollY);
        if (savedContainer) savedContainer.scrollTop = savedContainerScrollTop;
      }

      // Step 4: One rAF to let the freeze style apply before capture
      requestAnimationFrame(function() {
        // Fix min-height: html2canvas doesn't correctly apply flex align-items:center
        // on elements with min-height. Convert to explicit height for correct centering.
        var allSecs = document.querySelectorAll('section, article, .section, .page-section, [class*="section"]');
        for (var si2 = 0; si2 < allSecs.length; si2++) {
          var sEl = allSecs[si2];
          var sRect = sEl.getBoundingClientRect();
          var sDocTop = sRect.top + window.scrollY;
          if (Math.abs(sDocTop - sec.top) < 20) {
            sectionEl = sEl;
            savedSecHeight = sEl.style.height;
            savedSecMinHeight = sEl.style.minHeight;
            sEl.style.height = sec.height + 'px';
            sEl.style.minHeight = '0';
            break;
          }
        }

        // Force visible state: elements frozen at opacity:0 by animation:none → make them visible
        var forceFixed = forceVisibleState(null);
        var clipTextFixed = fixClipTextForCapture();
        var filterFixed = fixFilterForCapture();

        html2canvas(document.body, {
          scale: scale,
          useCORS: true,
          logging: false,
          x: 0,
          y: sec.top,
          width: document.documentElement.clientWidth,
          height: sec.height,
          scrollX: 0,
          scrollY: 0,
        }).then(function(canvas) {
          restoreAfterCapture(clipTextFixed, filterFixed, forceFixed);
          var dataUrl = canvas.toDataURL(format, quality);
          window.parent.postMessage({ type: 'SECTION_CAPTURED', payload: { index: idx, dataUrl: dataUrl } }, '*');
        }).catch(function(err) {
          restoreAfterCapture(clipTextFixed, filterFixed, forceFixed);
          window.parent.postMessage({ type: 'SECTION_CAPTURED', payload: { index: idx, dataUrl: null, error: err.message } }, '*');
        });
      });
    }, 300);
  }
  // --- Slide index tracking: report current slide index to parent ---
  var _slideSelector = getSlideSelector();
  if (_slideSelector) {
    var _slideEls = document.querySelectorAll(_slideSelector);
    if (_slideEls.length > 1) {
      var _slideObserver = new MutationObserver(function() {
        var info = captureFrameworkSlideIndex();
        if (info) {
          window.parent.postMessage({
            type: 'SLIDE_INDEX_CHANGED',
            payload: { index: info.index, framework: info.framework }
          }, '*');
        }
      });
      for (var _si = 0; _si < _slideEls.length; _si++) {
        _slideObserver.observe(_slideEls[_si], {
          attributes: true,
          attributeFilter: ['class']
        });
      }
      // Report initial index
      var _initInfo = captureFrameworkSlideIndex();
      if (_initInfo) {
        window.parent.postMessage({
          type: 'SLIDE_INDEX_CHANGED',
          payload: { index: _initInfo.index, framework: _initInfo.framework }
        }, '*');
      }
    }
  }
})();
`;
}
