"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { useDocuments } from "@/hooks/useDocuments";
import { useBudgetStatus } from "@/hooks/useBudgetStatus";
import { api } from "@/lib/api";
import type { Session } from "@/types/session";
import type { Document } from "@/types/document";
import type { SubjectTopicList, Topic } from "@/types/topic";

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

const SUBJECT_DISPLAY: Record<string, string> = {
  databases: "Databases",
  networks: "Networks",
  ml: "Machine Learning",
  fmfp: "FMFP / Haskell",
  probability: "Probability & Stats",
  other: "Other",
};

const FILE_TYPE_LABEL: Record<string, string> = {
  script: "Script",
  mock_exam: "Mock Exam",
  other: "Doc",
};

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

  // Topic selection
  const [topicLists, setTopicLists] = useState<Record<string, SubjectTopicList | null>>({});
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const difficulty = DIFFICULTY_MAP[difficultyLevel];
  const ingestedDocs = (documents ?? []).filter((d: Document) => d.ingested);

  // Group docs by subject
  const grouped = ingestedDocs.reduce<Record<string, Document[]>>((acc, doc) => {
    const subj = doc.subject ?? "other";
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(doc);
    return acc;
  }, {});

  // Which subjects are covered by the current selection?
  const selectedSubjects = Array.from(
    new Set(
      ingestedDocs
        .filter((d) => selectedDocIds.includes(d.id) && d.subject)
        .map((d) => d.subject as string)
    )
  );

  // Fetch topic lists for subjects that have script docs
  useEffect(() => {
    const subjectsWithScripts = Array.from(
      new Set(
        ingestedDocs
          .filter((d) => d.file_type === "script" && d.subject)
          .map((d) => d.subject as string)
      )
    );
    subjectsWithScripts.forEach(async (subject) => {
      if (subject in topicLists) return;
      try {
        const res = await fetch(`/api/v1/topics/${subject}`);
        if (res.ok) {
          const data: SubjectTopicList = await res.json();
          setTopicLists((prev) => ({ ...prev, [subject]: data }));
        } else {
          setTopicLists((prev) => ({ ...prev, [subject]: null }));
        }
      } catch {
        setTopicLists((prev) => ({ ...prev, [subject]: null }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestedDocs.length]);

  // Topics available based on current document selection
  const availableTopicLists = selectedSubjects
    .map((s) => topicLists[s])
    .filter((tl): tl is SubjectTopicList => tl !== null && tl !== undefined);

  const allAvailableTopics = availableTopicLists.flatMap((tl) => tl.topics);

  function toggleDoc(id: number) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllForSubject(subject: string) {
    const subjectDocIds = (grouped[subject] ?? []).map((d) => d.id);
    const allSelected = subjectDocIds.every((id) => selectedDocIds.includes(id));
    if (allSelected) {
      setSelectedDocIds((prev) => prev.filter((id) => !subjectDocIds.includes(id)));
    } else {
      setSelectedDocIds((prev) => Array.from(new Set([...prev, ...subjectDocIds])));
    }
  }

  function toggleQType(type: QuestionType) {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleTopic(title: string) {
    setSelectedTopics((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
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
          topic_filter: selectedTopics.length > 0 ? selectedTopics : null,
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
                {Object.entries(grouped).map(([subject, docs]) => {
                  const displayName = SUBJECT_DISPLAY[subject] ?? subject.toUpperCase();
                  const allSelected = docs.every((d) => selectedDocIds.includes(d.id));
                  const someSelected = docs.some((d) => selectedDocIds.includes(d.id));

                  return (
                    <div key={subject}>
                      {/* Subject header with "select all" button */}
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                          {displayName}
                        </span>
                        <div className="h-px flex-1 bg-neutral-200" />
                        <button
                          onClick={() => selectAllForSubject(subject)}
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 transition-colors ${
                            allSelected
                              ? "bg-primary-container text-white"
                              : someSelected
                              ? "bg-primary-container/20 text-primary-container"
                              : "bg-surface-container text-neutral-400 hover:bg-surface-container-high"
                          }`}
                        >
                          {allSelected ? "DESELECT ALL" : "SELECT ALL"}
                        </button>
                      </div>

                      {docs.map((doc) => {
                        const isSelected = selectedDocIds.includes(doc.id);
                        const ftLabel = FILE_TYPE_LABEL[doc.file_type] ?? "Doc";
                        return (
                          <div
                            key={doc.id}
                            onClick={() => toggleDoc(doc.id)}
                            className={`group p-4 flex items-center transition-all cursor-pointer mb-1 ${
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
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 ${
                                  doc.file_type === "script"
                                    ? "bg-blue-50 text-blue-500"
                                    : doc.file_type === "mock_exam"
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-neutral-100 text-neutral-400"
                                }`}>
                                  {ftLabel}
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
                              style={isSelected ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                              {isSelected ? "check_circle" : "add_circle"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Topic filter — shown when selection has topics available */}
              {allAvailableTopics.length > 0 && (
                <div className="mt-6 pt-4 border-t border-outline-variant/30">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">filter_list</span>
                      Topic Focus (optional)
                    </h4>
                    {selectedTopics.length > 0 && (
                      <button
                        onClick={() => setSelectedTopics([])}
                        className="text-[9px] font-mono text-neutral-400 hover:text-primary-container transition-colors"
                      >
                        CLEAR ({selectedTopics.length})
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 mb-3">
                    Leave empty to use all content. Select topics to focus exercise generation.
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {allAvailableTopics.map((topic) => {
                      const isActive = selectedTopics.includes(topic.title);
                      return (
                        <button
                          key={topic.title}
                          onClick={() => toggleTopic(topic.title)}
                          title={topic.subtopics.join(", ")}
                          className={`px-2 py-1 text-[9px] font-mono font-bold uppercase transition-colors ${
                            isActive
                              ? "bg-primary-container text-white"
                              : "bg-surface-container text-neutral-500 hover:bg-surface-container-high"
                          }`}
                        >
                          {topic.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedDocIds.length > 0 && allAvailableTopics.length === 0 && (
                <div className="mt-4 pt-4 border-t border-outline-variant/30">
                  <p className="text-[10px] text-neutral-400 font-mono">
                    <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
                    No topic list for these documents yet. Upload a script and generate topics from the dashboard to enable topic filtering.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Parameters */}
            <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
              <div className="bg-surface-container p-6 flex-1">
                <h3 className="font-bold text-sm uppercase tracking-wider mb-8 flex items-center text-on-surface">
                  <span className="material-symbols-outlined mr-2 text-primary-container">tune</span>
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

                {/* Topic summary */}
                {selectedTopics.length > 0 && (
                  <div className="mt-4 p-3 bg-primary-container/5 border border-primary-container/20">
                    <p className="text-[10px] font-mono text-primary-container font-bold mb-1">
                      TOPIC FILTER ACTIVE · {selectedTopics.length} topic(s)
                    </p>
                    <p className="text-[9px] text-neutral-500">
                      {selectedTopics.join(" · ")}
                    </p>
                  </div>
                )}
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
