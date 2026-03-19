import { create } from 'zustand';
import type { EditorState, CaptureSettings, SelectedElement, ViewMode } from '../types/editor';

const MAX_HISTORY = 50;

const defaultCaptureSettings: CaptureSettings = {
  format: 'png',
  quality: 0.92,
  scale: 2,
  includeBackground: true,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  // State
  fileName: null,
  htmlContent: null,
  originalHtmlContent: null,
  selectedElement: null,
  history: [],
  historyIndex: -1,
  viewMode: 'preview',
  isDirty: false,
  isClassApply: false,
  selectedClass: null,
  captureSettings: defaultCaptureSettings,
  isLoading: false,
  isUndoRedo: false,

  // Actions
  setFileName: (name: string | null) => set({ fileName: name }),

  setHtmlContent: (content: string | null, label?: string) => {
    const state = get();
    const isFirstLoad = state.originalHtmlContent === null && content !== null;

    set({
      htmlContent: content,
      ...(isFirstLoad ? { originalHtmlContent: content } : {}),
      isDirty: !isFirstLoad && content !== state.originalHtmlContent,
    });

    // Push to history if content is not null
    if (content !== null) {
      get().pushHistory({
        html: content,
        description: label ?? '콘텐츠 변경',
      });
    }
  },

  setSelectedElement: (element: SelectedElement | null) => set({ selectedElement: element }),

  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'preview' ? 'code' : 'preview',
    })),

  setIsDirty: (dirty: boolean) => set({ isDirty: dirty }),

  setCaptureSettings: (settings: Partial<CaptureSettings>) =>
    set((state) => ({
      captureSettings: { ...state.captureSettings, ...settings },
    })),

  setIsLoading: (loading: boolean) => set({ isLoading: loading }),

  updateElementStyles: (_editorId: string, _styles: Record<string, string>) => {
    // Will be implemented in a later phase when iframe bridge is ready
  },

  toggleClassApply: () =>
    set((state) => ({ isClassApply: !state.isClassApply })),

  setSelectedClass: (className: string | null) =>
    set({ selectedClass: className }),

  resetToOriginal: () => {
    const state = get();
    if (state.originalHtmlContent !== null) {
      set({
        htmlContent: state.originalHtmlContent,
        isDirty: false,
      });
      get().pushHistory({
        html: state.originalHtmlContent,
        description: '원본으로 복원',
      });
    }
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      set({
        htmlContent: state.history[newIndex].html,
        historyIndex: newIndex,
        isDirty: state.history[newIndex].html !== state.originalHtmlContent,
        isUndoRedo: true,
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      set({
        htmlContent: state.history[newIndex].html,
        historyIndex: newIndex,
        isDirty: state.history[newIndex].html !== state.originalHtmlContent,
        isUndoRedo: true,
      });
    }
  },

  pushHistory: (entry) =>
    set((state) => {
      // Truncate future entries if we're not at the end
      const truncated = state.history.slice(0, state.historyIndex + 1);

      const newEntry = { ...entry, timestamp: Date.now() };
      const newHistory = [...truncated, newEntry];

      // Cap at MAX_HISTORY
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }

      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  resetEditor: () =>
    set({
      fileName: null,
      htmlContent: null,
      originalHtmlContent: null,
      selectedElement: null,
      history: [],
      historyIndex: -1,
      viewMode: 'preview',
      isDirty: false,
      isClassApply: false,
      selectedClass: null,
      captureSettings: defaultCaptureSettings,
      isLoading: false,
      isUndoRedo: false,
    }),
}));
