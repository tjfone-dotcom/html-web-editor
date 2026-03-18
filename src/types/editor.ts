/** Supported element types that can be edited */
export type ElementType =
  | 'text'
  | 'image'
  | 'link'
  | 'button'
  | 'container'
  | 'input'
  | 'video'
  | 'unknown';

/** Represents a currently selected element in the preview */
export interface SelectedElement {
  /** Unique selector path to identify the element in the DOM */
  selector: string;
  /** The tag name of the element (e.g., 'div', 'span', 'img') */
  tagName: string;
  /** Classified element type */
  type: ElementType;
  /** Current computed/inline styles */
  styles: Record<string, string>;
  /** Current HTML attributes */
  attributes: Record<string, string>;
  /** Text content of the element (if applicable) */
  textContent: string | null;
  /** Bounding rect for overlay positioning */
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  /** Breadcrumb path of parent elements */
  path: string[];
}

/** A snapshot of the editor state for undo/redo */
export interface HistoryEntry {
  /** Serialized HTML content */
  html: string;
  /** Timestamp of when this entry was created */
  timestamp: number;
  /** Description of the change */
  description: string;
}

/** View mode for the preview panel */
export type ViewMode = 'visual' | 'code';

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
  /** Capture settings */
  captureSettings: CaptureSettings;
  /** Whether a file is currently being loaded */
  isLoading: boolean;

  // Actions
  setFileName: (name: string | null) => void;
  setHtmlContent: (html: string | null) => void;
  setSelectedElement: (element: SelectedElement | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setIsDirty: (dirty: boolean) => void;
  setCaptureSettings: (settings: Partial<CaptureSettings>) => void;
  setIsLoading: (loading: boolean) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  resetEditor: () => void;
}
