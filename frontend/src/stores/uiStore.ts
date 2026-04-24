import { create } from "zustand";

export interface ActivePdf {
  documentId: number;
  page: number;
}

interface UIStore {
  hintVisible: boolean;
  splitPercent: number;
  activePdf: ActivePdf | null;
  shortcutHelpOpen: boolean;
  setHintVisible: (v: boolean) => void;
  setSplitPercent: (v: number) => void;
  openPdf: (pdf: ActivePdf) => void;
  closePdf: () => void;
  setShortcutHelpOpen: (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  hintVisible: false,
  splitPercent: 50,
  activePdf: null,
  shortcutHelpOpen: false,
  setHintVisible: (v) => set({ hintVisible: v }),
  setSplitPercent: (v) => set({ splitPercent: v }),
  openPdf: (pdf) => set({ activePdf: pdf }),
  closePdf: () => set({ activePdf: null }),
  setShortcutHelpOpen: (v) => set({ shortcutHelpOpen: v }),
}));
