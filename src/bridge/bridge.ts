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
        path: getElementPath(el)
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

  // --- Slide State Save/Restore (for REPLACE_DOM viewport preservation) ---

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

  var NAV_CLASSES = ['active','current','present','visible','swiper-slide-active',
                     'hidden','past','future','swiper-slide-prev','swiper-slide-next'];

  function captureSlideState() {
    var sel = getSlideSelector();
    var slides;
    var usingFallback = false;

    if (sel) {
      slides = Array.prototype.slice.call(document.querySelectorAll(sel));
    } else {
      // Fallback: body direct children (excluding bridge elements)
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

  // --- Scroll State Save/Restore (handles container-based scrolling) ---

  function getElementPath(el) {
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
        results.push({ type: 'element', path: getElementPath(el), scrollTop: el.scrollTop, scrollLeft: el.scrollLeft });
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
  }

  function morphNode(oldNode, newNode, parent) {
    // Text nodes
    if (oldNode.nodeType === 3 && newNode.nodeType === 3) {
      if (oldNode.textContent !== newNode.textContent) oldNode.textContent = newNode.textContent;
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
    if (isBridgeOrMeta(el) || el === document.body) return;
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

    function onBlur() {
      el.removeEventListener('blur', onBlur);
      el.contentEditable = 'false';
      el.removeAttribute('contenteditable');
      var newText = el.textContent || '';
      window.parent.postMessage({
        type: 'TEXT_CHANGED',
        payload: {
          editorId: el.getAttribute('data-editor-id') || '',
          text: newText
        }
      }, '*');
      sendDOMUpdate();
    }

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

    if (isBridgeOrMeta(el) || el === document.body) return;
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

    // --- DOM Replace via morph (preserves event listeners for undo/redo) ---
    if (msg.type === 'REPLACE_DOM' && msg.payload && msg.payload.html) {
      // 1. Save viewport state (scroll + slide) before morph
      var scrollState = captureScrollState();
      var isSlideDoc = detectPageTypeInIframe() === 'slides';
      var savedSlideState = isSlideDoc ? captureSlideState() : null;

      // 2. Morph content
      var parser = new DOMParser();
      var newDoc = parser.parseFromString(msg.payload.html, 'text/html');
      morphChildren(document.body, newDoc.body);

      // 3. Synchronous restore (prevents MutationObserver race conditions)
      if (isSlideDoc && savedSlideState) {
        restoreSlideState(savedSlideState);
      }
      restoreScrollState(scrollState);

      // 4. Clear selection
      if (selectedEl) {
        selectedEl.removeAttribute('data-bridge-selected');
        selectedEl = null;
        window.parent.postMessage({ type: 'ELEMENT_SELECTED', payload: null }, '*');
      }
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
  function captureSectionInIframe(payload) {
    var idx = payload.index;
    var scale = payload.scale || 2;
    var format = payload.format || 'image/png';
    var quality = payload.quality || 0.92;

    // Get section element by detection
    var sections = detectSectionsInIframe();
    if (idx >= sections.length) {
      window.parent.postMessage({ type: 'SECTION_CAPTURED', payload: { index: idx, dataUrl: null } }, '*');
      return;
    }

    var sec = sections[idx];
    // Find the element at that position and height
    // Use a wrapper approach: capture a specific region
    if (typeof html2canvas === 'undefined') {
      window.parent.postMessage({ type: 'SECTION_CAPTURED', payload: { index: idx, dataUrl: null, error: 'html2canvas not available' } }, '*');
      return;
    }

    // For scroll sections, we need to capture a region
    // Strategy: find elements that match the section, or capture the body with clip
    var targetEl = document.body;
    var opts = {
      scale: scale,
      useCORS: true,
      logging: false,
      y: sec.top,
      height: sec.height,
      windowHeight: sec.height,
      scrollY: -sec.top
    };

    html2canvas(targetEl, opts).then(function(canvas) {
      var dataUrl = canvas.toDataURL(format, quality);
      window.parent.postMessage({
        type: 'SECTION_CAPTURED',
        payload: { index: idx, dataUrl: dataUrl }
      }, '*');
    }).catch(function(err) {
      window.parent.postMessage({
        type: 'SECTION_CAPTURED',
        payload: { index: idx, dataUrl: null, error: err.message }
      }, '*');
    });
  }
})();
`;
}
