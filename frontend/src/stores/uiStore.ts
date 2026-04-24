import { create } from "zustand";

export interface ActivePdf {
  documentId: number;
  page: number;
}

interface UIStore {
  hintVisible: boolean;
  splitPercent: number;
  activePdf: ActivePdf | null;
  pdfCollapsed: boolean;
  sourcesDisabled: boolean;
  shortcutHelpOpen: boolean;
  setHintVisible: (v: boolean) => void;
  setSplitPercent: (v: number) => void;
  openPdf: (pdf: ActivePdf) => void;
  closePdf: () => void;
  setPdfCollapsed: (v: boolean) => void;
  setSourcesDisabled: (v: boolean) => void;
  setShortcutHelpOpen: (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  hintVisible: false,
  splitPercent: 50,
  activePdf: null,
  pdfCollapsed: false,
  sourcesDisabled: false,
  shortcutHelpOpen: false,
  setHintVisible: (v) => set({ hintVisible: v }),
  setSplitPercent: (v) => set({ splitPercent: v }),
  openPdf: (pdf) => set({ activePdf: pdf, pdfCollapsed: false }),
  closePdf: () => set({ activePdf: null, pdfCollapsed: false }),
  setPdfCollapsed: (v) => set({ pdfCollapsed: v }),
  setSourcesDisabled: (v) => set({ sourcesDisabled: v }),
  setShortcutHelpOpen: (v) => set({ shortcutHelpOpen: v }),
}));
