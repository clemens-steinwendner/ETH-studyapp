"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { useDocuments } from "@/hooks/useDocuments";
import { useBudgetStatus } from "@/hooks/useBudgetStatus";
import { api } from "@/lib/api";
import type { Session } from "@/types/session";
import type { Document } from "@/types/document";

type Difficulty = "recall" | "application" | "synthesis";
type QuestionType = "coding" | "multiple_choice" | "open_ended";

const DIFFICULTY_MAP: Record<number, Difficulty> = { 1: "recall", 2: "application", 3: "synthesis" };
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  recall: "RECALL",
  application: "APPLICATION",
  synthesis: "SYNTHESIS",
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  coding: "Coding (Haskell/Python/SQL)",
  multiple_choice: "Multiple Choice",
  open_ended: "Open-Ended",
};

function guessSubject(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("sql") || lower.includes("database")) return "Database Systems";
  if (lower.includes("network") || lower.includes("tcp")) return "Computer Networks";
  if (lower.includes("ml") || lower.includes("machine") || lower.includes("learning")) return "Machine Learning";
  if (lower.includes("fmfp") || lower.includes("haskell") || lower.includes("functional")) return "Formal Methods";
  if (lower.includes("prob") || lower.includes("stat")) return "Probability & Statistics";
  return "Computer Science Core";
}

export default function SessionNewPage() {
  const router = useRouter();
  const { data: documents, isLoading } = useDocuments();
  const { data: budget } = useBudgetStatus();
  const budgetPct = budget ? Math.round((budget.spent_usd / budget.limit_usd) * 100) : 0;

  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [difficultyLevel, setDifficultyLevel] = useState(2);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["coding", "multiple_choice"]);
  const [numQuestions, setNumQuestions] = useState(15);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const difficulty = DIFFICULTY_MAP[difficultyLevel];

  const ingestedDocs = (documents ?? []).filter((d: Document) => d.ingested);

  // Group docs by subject
  const grouped = ingestedDocs.reduce<Record<string, Document[]>>((acc, doc) => {
    const subject = guessSubject(doc.filename);
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(doc);
    return acc;
  }, {});

  function toggleDoc(id: number) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleQType(type: QuestionType) {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleStart() {
    if (selectedDocIds.length === 0) {
      setError("Select at least one document.");
      return;
    }
    if (questionTypes.length === 0) {
      setError("Select at least one question type.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const session = await api<Session>("/api/v1/sessions/", {
        method: "POST",
        body: JSON.stringify({
          document_ids: selectedDocIds,
          chapter_ids: null,
          difficulty,
          question_types: questionTypes,
          num_questions: numQuestions,
          hints_enabled: hintsEnabled,
        }),
      });
      router.push(`/session/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session.");
      setStarting(false);
    }
  }

  return (
    <div className="ml-64 min-h-screen pb-16 flex flex-col">
      <TopNav subtitle="Session Context" budgetPct={budgetPct} />

      <div className="p-8 max-w-6xl mx-auto w-full flex-1">
        <div className="flex flex-col gap-8">
          {/* Page header */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2 text-on-surface">
              New Study Session Configuration
            </h2>
            <p className="text-on-surface-variant font-mono text-sm">
              PATH: /STUDY/SANDBOX/INITIALIZE_V2
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left: Context Selection */}
            <div className="col-span-12 lg:col-span-7 bg-surface-container-low p-6">
              <div className="flex justify-between items-end mb-6">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center text-on-surface">
                  <span className="material-symbols-outlined mr-2 text-primary-container">
                    folder_open
                  </span>
                  Training Context Selection
                </h3>
                <span className="text-[10px] font-mono text-neutral-500">
                  {ingestedDocs.length} DOCUMENTS INDEXED
                </span>
              </div>

              {isLoading && (
                <p className="text-sm text-neutral-400 font-mono">Loading documents…</p>
              )}

              {!isLoading && ingestedDocs.length === 0 && (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-3xl text-neutral-300 block mb-2">
                    inbox
                  </span>
                  <p className="text-sm text-neutral-500 font-mono">
                    No documents indexed yet.{" "}
                    <a href="/dashboard" className="text-primary-container underline">
                      Upload PDFs
                    </a>{" "}
                    first.
                  </p>
                </div>
              )}

              <div className="space-y-6 max-h-[450px] overflow-y-auto pr-2">
                {Object.entries(grouped).map(([subject, docs]) => (
                  <div key={subject}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        {subject}
                      </span>
                      <div className="h-px flex-1 bg-neutral-200" />
                    </div>
                    {docs.map((doc) => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => toggleDoc(doc.id)}
                          className={`group p-4 flex items-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-surface-container-lowest border-l-4 border-primary-container"
                              : "bg-surface hover:bg-surface-container border-l-4 border-transparent"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-mono font-bold ${
                                  isSelected ? "text-primary-container" : "text-neutral-400"
                                }`}
                              >
                                {isSelected ? "[SELECTED]" : "[READY]"}
                              </span>
                              <span className="font-semibold text-sm text-on-surface">
                                {doc.filename.replace(/\.[^.]+$/, "")}
                              </span>
                            </div>
                            {doc.chapters.length > 0 && (
                              <p className="text-xs text-on-secondary-container mt-1">
                                {doc.chapters.map((ch) => ch.title).join(" · ")}
                              </p>
                            )}
                          </div>
                          <span
                            className={`material-symbols-outlined transition-colors ${
                              isSelected
                                ? "text-primary-container"
                                : "text-neutral-300 group-hover:text-primary-container"
                            }`}
                            style={
                              isSelected
                                ? { fontVariationSettings: "'FILL' 1" }
                                : undefined
                            }
                          >
                            {isSelected ? "check_circle" : "add_circle"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Parameters */}
            <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
              <div className="bg-surface-container p-6 flex-1">
                <h3 className="font-bold text-sm uppercase tracking-wider mb-8 flex items-center text-on-surface">
                  <span className="material-symbols-outlined mr-2 text-primary-container">
                    tune
                  </span>
                  Session Parameters
                </h3>

                {/* Difficulty Slider */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Cognitive Depth
                    </label>
                    <span className="text-xs font-mono bg-primary-container/10 text-primary-container px-2 py-0.5">
                      {DIFFICULTY_LABELS[difficulty]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={1}
                    value={difficultyLevel}
                    onChange={(e) => setDifficultyLevel(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-mono text-neutral-500 uppercase tracking-tighter">
                    <span>Recall</span>
                    <span>Application</span>
                    <span>Synthesis</span>
                  </div>
                </div>

                {/* Question Types */}
                <div className="mb-8">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-4">
                    Question Archetypes
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                      <label
                        key={type}
                        className="flex items-center p-3 bg-surface-container-lowest cursor-pointer hover:bg-neutral-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={questionTypes.includes(type)}
                          onChange={() => toggleQType(type)}
                          className="rounded-none border-outline text-primary-container focus:ring-0 mr-3 w-3.5 h-3.5"
                        />
                        <span className="text-xs font-medium text-on-surface">
                          {QUESTION_TYPE_LABELS[type]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* N_Questions + AI_Hints */}
                <div className="flex gap-4">
                  <div className="flex-1 bg-surface-container-highest p-4 flex flex-col justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container">
                      N_Questions
                    </label>
                    <div className="flex items-center justify-between mt-2">
                      <button
                        onClick={() => setNumQuestions((n) => Math.max(1, n - 1))}
                        className="p-1 hover:text-primary-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">remove</span>
                      </button>
                      <span className="text-xl font-black font-mono">{numQuestions}</span>
                      <button
                        onClick={() => setNumQuestions((n) => Math.min(50, n + 1))}
                        className="p-1 hover:text-primary-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 bg-surface-container-highest p-4 flex flex-col justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container">
                      AI_Hints
                    </label>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-bold text-on-surface">
                        {hintsEnabled ? "ENABLED" : "DISABLED"}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hintsEnabled}
                          onChange={(e) => setHintsEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 font-mono bg-red-50 px-3 py-2">{error}</p>
              )}

              <button
                onClick={handleStart}
                disabled={starting || selectedDocIds.length === 0 || questionTypes.length === 0}
                className="w-full bg-gradient-to-b from-primary to-primary-container text-white py-5 flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">bolt</span>
                {starting ? "Initializing…" : "Initialize Sandbox & Start Session"}
              </button>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex bg-inverse-surface text-on-tertiary-fixed p-4 items-start gap-4">
            <span
              className="material-symbols-outlined mt-0.5"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              info
            </span>
            <p className="text-xs font-mono">
              RAG_INGESTION_STATUS: ACTIVE.{" "}
              <span className="opacity-60">
                Vector space updated recently. Synthetic problem set will be generated based on
                selected document clusters.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
