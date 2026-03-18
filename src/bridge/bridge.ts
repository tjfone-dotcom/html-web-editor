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

  function selectElement(el) {
    // Deselect previous
    if (selectedEl) {
      selectedEl.removeAttribute('data-bridge-selected');
    }
    selectedEl = el;
    el.setAttribute('data-bridge-selected', '');

    var editorId = assignEditorId(el);
    var tag = el.tagName.toLowerCase();
    var elType = classifyElement(el);
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

  // Smart target: prefer text/button children inside box elements
  function findBestTarget(el) {
    var type = classifyElement(el);
    if (type !== 'box') return el;

    // box: look for a single text/button child
    var textChildren = [];
    for (var i = 0; i < el.children.length; i++) {
      var childType = classifyElement(el.children[i]);
      if (childType === 'text' || childType === 'button') {
        textChildren.push(el.children[i]);
      }
    }
    if (textChildren.length === 1) return textChildren[0];

    // No child elements but has text content → treat as text-like box
    if (el.children.length === 0 && el.textContent.trim().length > 0) return el;

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
    if (isBridgeOrMeta(el) || el === document.body) return;
    el.removeAttribute('data-bridge-hover');
    selectElement(el);

    // Text/button: immediately enable inline editing
    var elType = classifyElement(el);
    if (elType === 'text' || elType === 'button') {
      enableInlineEdit(el);
    }
  }, true);

  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
    e.stopPropagation();
    // Select the parent element (go up to box level)
    if (selectedEl && selectedEl.parentElement
        && selectedEl.parentElement !== document.body
        && selectedEl.parentElement !== document.documentElement) {
      // Disable inline editing on current element if active
      if (selectedEl.contentEditable === 'true') {
        selectedEl.contentEditable = 'false';
        selectedEl.removeAttribute('contenteditable');
      }
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
