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

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (isBridgeOrMeta(el) || el === document.body) return;
    // Remove hover outline on click
    el.removeAttribute('data-bridge-hover');
    selectElement(el);
  }, true);

  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (isBridgeOrMeta(el) || el === document.body) return;
    var elType = classifyElement(el);
    if (elType !== 'text' && elType !== 'button') return;
    // Already contentEditable
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
  });
})();
`;
}
