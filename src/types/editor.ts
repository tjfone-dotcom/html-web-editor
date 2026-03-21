/** Supported element types that can be edited */
export type ElementType =
  | 'text'
  | 'button'
  | 'box'
  | 'image'
  | 'line'
  | 'unsupported';

/** Represents a currently selected element in the preview */
export interface SelectedElement {
  /** Unique editor-assigned ID */
  editorId: string;
  /** The tag name of the element (e.g., 'div', 'span', 'img') */
  tagName: string;
  /** CSS class name */
  className: string;
  /** Element id attribute */
  id: string;
  /** Classified element type */
  elementType: ElementType;
  /** Current computed styles */
  computedStyles: Record<string, string>;
  /** Text content of the element (if applicable) */
  textContent?: string;
  /** Breadcrumb path of parent elements */
  path: string[];
  /** Opening tag HTML for source matching */
  openingTag?: string;
  /** Raw HTML context (50 chars before + 50 chars after) for position matching */
  htmlContext?: { before: string; after: string } | null;
}

/** A snapshot of the editor state for undo/redo */
export interface HistoryEntry {
  /** Serialized HTML content */
  html: string;
  /** Timestamp of when this entry was created */
  timestamp: number;
  /** Description of the change */
  description: string;
  /** Slide index at the time of this edit (for slide deck documents) */
  slideIndex?: number;
}

/** View mode for the preview panel */
export type ViewMode = 'preview' | 'code';

/** Settings for HTML capture/export */
export interface CaptureSettings {
  /** Output format */
  format: 'png' | 'jpeg' | 'webp';
  /** Quality for lossy formats (0-1) */
  quality: number;
  /** Scale factor for capture */
  scale: number;
  /** Whether to include background */
  includeBackground: boolean;
}

/** Messages sent between the main app and the preview iframe */
export interface BridgeMessage {
  /** Message type identifier */
  type:
    | 'select'
    | 'hover'
    | 'deselect'
    | 'update-style'
    | 'update-attribute'
    | 'update-text'
    | 'get-html'
    | 'set-html'
    | 'highlight'
    | 'clear-highlight';
  /** Message payload */
  payload?: unknown;
  /** Unique message ID for request/response correlation */
  messageId?: string;
}

/** Main editor state shape */
export interface EditorState {
  /** The currently loaded HTML file name */
  fileName: string | null;
  /** The raw HTML content */
  htmlContent: string | null;
  /** The original HTML content from initial file load */
  originalHtmlContent: string | null;
  /** The currently selected element */
  selectedElement: SelectedElement | null;
  /** Undo history stack */
  history: HistoryEntry[];
  /** Current position in the history stack */
  historyIndex: number;
  /** Current view mode */
  viewMode: ViewMode;
  /** Whether the editor has unsaved changes */
  isDirty: boolean;
  /** Whether class-apply mode is on */
  isClassApply: boolean;
  /** Currently selected class for class-apply mode */
  selectedClass: string | null;
  /** Capture settings */
  captureSettings: CaptureSettings;
  /** Whether a file is currently being loaded */
  isLoading: boolean;
  /** Flag set by undo/redo to signal DOM-only replacement instead of iframe reload */
  isUndoRedo: boolean;
  /** Current slide index (updated by SLIDE_INDEX_CHANGED from bridge) */
  currentSlideIndex: number;
  /** Target slide index for undo/redo navigation */
  undoRedoSlideIndex: number | null;

  // Actions
  setFileName: (name: string | null) => void;
  setHtmlContent: (content: string | null, label?: string) => void;
  setSelectedElement: (element: SelectedElement | null) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setIsDirty: (dirty: boolean) => void;
  setCaptureSettings: (settings: Partial<CaptureSettings>) => void;
  setIsLoading: (loading: boolean) => void;
  updateElementStyles: (editorId: string, styles: Record<string, string>) => void;
  toggleClassApply: () => void;
  setSelectedClass: (className: string | null) => void;
  resetToOriginal: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  resetEditor: () => void;
  loadFile: (content: string, fileName: string) => void;
}
