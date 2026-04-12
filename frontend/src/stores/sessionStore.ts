import { create } from "zustand";

interface SessionStore {
  sessionId: number | null;
  documentIds: number[];
  difficulty: string;
  questionTypes: string[];
  hintsEnabled: boolean;
  setSession: (id: number) => void;
  setConfig: (cfg: Partial<Omit<SessionStore, "setSession" | "setConfig">>) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionId: null,
  documentIds: [],
  difficulty: "application",
  questionTypes: ["coding", "multiple_choice", "open_ended"],
  hintsEnabled: true,
  setSession: (id) => set({ sessionId: id }),
  setConfig: (cfg) => set(cfg),
}));
