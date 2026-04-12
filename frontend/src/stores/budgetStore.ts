import { create } from "zustand";

interface BudgetStore {
  spentUsd: number;
  limitUsd: number;
  exceeded: boolean;
  setStatus: (spent: number, limit: number) => void;
}

export const useBudgetStore = create<BudgetStore>((set) => ({
  spentUsd: 0,
  limitUsd: 8.0,
  exceeded: false,
  setStatus: (spent, limit) =>
    set({ spentUsd: spent, limitUsd: limit, exceeded: spent >= limit }),
}));
