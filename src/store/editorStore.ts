import { create } from 'zustand';
import type { EditorState, CaptureSettings, SelectedElement, ViewMode } from '../types/editor';

const defaultCaptureSettings: CaptureSettings = {
  format: 'png',
  quality: 0.92,
  scale: 2,
  includeBackground: true,
};

export const useEditorStore = create<EditorState>((set) => ({
  // State
  fileName: null,
  htmlContent: null,
  selectedElement: null,
  history: [],
  historyIndex: -1,
  viewMode: 'visual',
  isDirty: false,
  captureSettings: defaultCaptureSettings,
  isLoading: false,

  // Actions (stubs for Phase 1)
  setFileName: (name: string | null) => set({ fileName: name }),
  setHtmlContent: (html: string | null) => set({ htmlContent: html }),
  setSelectedElement: (element: SelectedElement | null) => set({ selectedElement: element }),
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setIsDirty: (dirty: boolean) => set({ isDirty: dirty }),
  setCaptureSettings: (settings: Partial<CaptureSettings>) =>
    set((state) => ({
      captureSettings: { ...state.captureSettings, ...settings },
    })),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  undo: () => {
    // No-op stub — will be implemented in later phase
  },
  redo: () => {
    // No-op stub — will be implemented in later phase
  },
  pushHistory: (_entry) => {
    // No-op stub — will be implemented in later phase
  },
  resetEditor: () =>
    set({
      fileName: null,
      htmlContent: null,
      selectedElement: null,
      history: [],
      historyIndex: -1,
      viewMode: 'visual',
      isDirty: false,
      captureSettings: defaultCaptureSettings,
      isLoading: false,
    }),
}));
