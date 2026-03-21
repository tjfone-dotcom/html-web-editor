# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Type-check then build (tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Preview production build
npx tsc --noEmit   # Type-check only (no test runner exists)
```

> **No test framework is configured.** Use `npx tsc --noEmit` to verify types after changes.

> **Commit and push only when the user explicitly asks.**

## Architecture Overview

SoEZ HTML is a browser-based WYSIWYG HTML file editor. The user drops in an HTML file, edits elements visually, then downloads the modified file. There is no backend — everything runs client-side.

### Core data flow

```
FileUploader → editorStore.loadFile()
                  ↓ htmlContent
             HtmlPreview (iframe)
                  ↕ postMessage bridge
             EditorPanel → PropertyEditor → *Properties components
                  ↓ style/text mutations → postMessage → iframe
             iframe DOM_UPDATED → editorStore.setHtmlContent()
                  ↓
             Header → downloadHtml() (strips bridge artifacts)
```

### The iframe bridge (`src/bridge/bridge.ts`)

The preview renders user HTML inside a sandboxed `<iframe sandbox="allow-scripts allow-same-origin">`. `getBridgeScript()` returns a self-contained IIFE string (no imports) that is injected just before `</body>` at load time. The bridge:

- Assigns `data-editor-id` to every clickable element.
- Handles hover/select click events and posts `ELEMENT_SELECTED` to `window.parent`.
- Receives `UPDATE_STYLES`, `UPDATE_TEXT`, `DETECT_SECTIONS`, `CAPTURE_SECTION`, `NAVIGATE_TO_SLIDE`, `SCROLL_TO_HTML_CONTEXT`, `RESTORE_SCROLL` messages from the parent.
- Posts `DOM_UPDATED` (serialized `document.documentElement.outerHTML`) after each mutation.
- Posts `SLIDE_INDEX_CHANGED` when slide frameworks navigate.
- Runs `html2canvas` (loaded via CDN) for in-iframe capture to avoid cross-origin issues.

**Both sides must stay in sync:** The bridge script's element classification logic (`classifyElement`) is mirrored in `src/utils/elementClassifier.ts` for the parent side.

### State management (`src/store/editorStore.ts`)

Single Zustand store (`useEditorStore`). Key state:

- `htmlContent` — live HTML string (source of truth; drives iframe reload).
- `originalHtmlContent` — snapshot from initial `loadFile`; used for `isDirty` and reset.
- `history` / `historyIndex` — 50-entry undo/redo stack of `HistoryEntry` objects.
- `isUndoRedo` — flag that tells `HtmlPreview` to do a scroll-preserving reload rather than a normal reload.
- `currentSlideIndex` / `undoRedoSlideIndex` — slide deck position tracking for undo/redo navigation.
- `locale` — persisted to `localStorage` under key `soez-html-locale`; defaults to `'en'`.

`setHtmlContent()` auto-pushes to history. `loadFile()` resets all state and starts a fresh history.

### Iframe reload vs. DOM patch

`HtmlPreview` manages a Blob URL. Every change to `htmlContent` triggers a new Blob URL → full iframe reload (except undo/redo which capture/restore scroll position first). Style edits send `UPDATE_STYLES` to the live iframe immediately (no reload) and the iframe posts back `DOM_UPDATED` ~300 ms later, which is then committed to the store.

Suppression flag `suppressNextUpdate` prevents the `DOM_UPDATED` echo from causing a redundant second reload.

### i18n (`src/i18n/`)

- Four locales: `en`, `ko`, `ja`, `zh`.
- `useT()` hook reads `locale` from the store and returns a typed `t(key, ...args)` function.
- Translation values can be strings or functions (for interpolation).
- All UI strings must go through `t()`. Never hard-code Korean (or any language) in component JSX.
- Class components (e.g., `ErrorBoundary`) cannot call `useT()` directly — use the functional wrapper pattern: outer functional component calls `useT()` and passes `t` as a prop to the inner class.

### Property panels (`src/components/editor/properties/`)

Each `ElementType` (`text`, `button`, `box`, `image`, `line`) has a dedicated panel component. `PropertyEditor` dispatches to the correct panel based on `selectedElement.elementType`. Panels send mutations via `useIframeBridge` — style updates use `sendStyleUpdate(editorId, styles)`, text changes use `sendTextUpdate(editorId, text)`.

The `isClassApply` / `selectedClass` store flags enable batch-applying style changes to all elements sharing a CSS class instead of a single element.

### Capture (`src/utils/captureEngine.ts`, `src/utils/sectionDetector.ts`)

The capture flow runs html2canvas **inside the iframe** (to avoid cross-origin canvas taint). The parent sends `DETECT_SECTIONS` → bridge responds `SECTIONS_DETECTED` → parent iterates sections with `CAPTURE_SECTION` → bridge responds `CAPTURE_RESULT` with base64 data. JSZip bundles multi-section captures into a zip download.

### Code editor (`src/components/preview/CodeEditor.tsx`)

Uses `@monaco-editor/react`. While in `code` view mode, `htmlContent` changes do not trigger iframe reloads (`needsSyncRef`). On switching back to `preview`, the latest content is synced and the iframe reloads. `lastCursorLine` (a shared mutable ref in `src/utils/codeSync.ts`) carries the cursor line from Monaco to `HtmlPreview` so it can scroll the preview to match.

### Slide deck support

Documents containing `.slide`, `.reveal`, Swiper, or similar patterns are detected as slide decks. Undo/redo navigates to the saved slide index (`slideIndex` stored per `HistoryEntry`) instead of restoring scroll position.

## Key conventions

- **No test files exist** — validate with `npx tsc --noEmit` and manual browser testing.
- Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`; configuration is in `src/index.css`.
- Dark UI throughout: `bg-gray-900` header, `bg-gray-800` panels, `bg-gray-700` controls.
- `public/manual.html` is a standalone multilingual HTML file (EN/KO/JA/ZH) with all translations embedded as a JS `TRANSLATIONS` object; language is selected via `?lang=xx` URL param.
