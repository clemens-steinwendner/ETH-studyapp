import { create } from "zustand";

interface UIStore {
  hintVisible: boolean;
  splitPercent: number;
  setHintVisible: (v: boolean) => void;
  setSplitPercent: (v: number) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  hintVisible: false,
  splitPercent: 50,
  setHintVisible: (v) => set({ hintVisible: v }),
  setSplitPercent: (v) => set({ splitPercent: v }),
}));
