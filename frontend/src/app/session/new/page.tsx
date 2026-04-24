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
type QuestionType = "coding" | "multiple_choice" | "multiple_select" | "true_false" | "open_ended";

const DIFFICULTY_MAP: Record<number, Difficulty> = { 1: "recall", 2: "application", 3: "synthesis" };
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  recall: "MEDIUM",
  application: "HARD",
  synthesis: "VERY HARD",
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  coding: "Coding (Haskell/Python/SQL)",
  multiple_choice: "Multiple Choice",
  multiple_select: "Multiple Select",
  true_false: "True / False",
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

/** File types that are eligible for RAG retrieval */
const RAG_FILE_TYPES = new Set(["script", "slides", "other"]);

export default function SessionNewPage() {
  const router = useRouter();
  const { data: documents, isLoading } = useDocuments();
  const { data: budget } = useBudgetStatus();
  const budgetPct = budget ? Math.round((budget.spent_usd / budget.limit_usd) * 100) : 0;

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [difficultyLevel, setDifficultyLevel] = useState(2);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["coding", "multiple_choice"]);
  const [numQuestions, setNumQuestions] = useState(15);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [examMode, setExamMode] = useState(false);
  const [synthesisEnabled, setSynthesisEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Topic selection
  const [topicLists, setTopicLists] = useState<Record<string, SubjectTopicList | null>>({});
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const difficulty = DIFFICULTY_MAP[difficultyLevel];
  const ingestedDocs = (documents ?? []).filter((d: Document) => d.ingested);

  // Group all ingested docs by subject
  const grouped = ingestedDocs.reduce<Record<string, Document[]>>((acc, doc) => {
    const subj = doc.subject ?? "other";
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(doc);
    return acc;
  }, {});

  // For each subject, split into RAG docs and exam docs
  function ragDocsForSubject(subject: string): Document[] {
    return (grouped[subject] ?? []).filter((d) => RAG_FILE_TYPES.has(d.file_type));
  }

  function examDocsForSubject(subject: string): Document[] {
    return (grouped[subject] ?? []).filter((d) => d.file_type === "mock_exam");
  }

  // Derive document_ids to send: all RAG-eligible docs for selected subjects
  const ragDocIds = selectedSubjects.flatMap((s) => ragDocsForSubject(s).map((d) => d.id));

  // Fetch topic lists for subjects that have RAG-eligible docs
  useEffect(() => {
    const subjectsWithContent = Array.from(
      new Set(
        ingestedDocs
          .filter((d) => RAG_FILE_TYPES.has(d.file_type) && d.subject)
          .map((d) => d.subject as string)
      )
    );
    subjectsWithContent.forEach(async (subject) => {
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

  // Topics available based on selected subjects
  const availableTopicLists = selectedSubjects
    .map((s) => topicLists[s])
    .filter((tl): tl is SubjectTopicList => tl !== null && tl !== undefined);

  const allAvailableTopics = availableTopicLists.flatMap((tl) => tl.topics);

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
    // Clear topic selection when subject set changes
    setSelectedTopics([]);
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

  function sessionPayload() {
    return {
      document_ids: ragDocIds,
      chapter_ids: null,
      difficulty,
      question_types: questionTypes,
      num_questions: numQuestions,
      hints_enabled: hintsEnabled,
      exam_mode: examMode,
      synthesis_enabled: synthesisEnabled,
      topic_filter: selectedTopics.length > 0 ? selectedTopics : null,
    };
  }

  async function handleGenerateAndExport() {
    if (ragDocIds.length === 0 || questionTypes.length === 0) {
      setError("Pick at least one subject and one question type first.");
      return;
    }
    setExporting(true);
    setError(null);
    // Open the print tab eagerly so popup blockers don't trip after the await.
    const printTab = window.open("", "_blank");
    try {
      const session = await api<Session>("/api/v1/sessions/", {
        method: "POST",
        body: JSON.stringify({ ...sessionPayload(), exam_mode: true }),
      });
      const url = `/session/${session.id}/print`;
      if (printTab) {
        printTab.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } catch (e) {
      printTab?.close();
      setError(e instanceof Error ? e.message : "Failed to generate exam.");
    } finally {
      setExporting(false);
    }
  }

  async function handleStart() {
    if (ragDocIds.length === 0) {
      setError("Select at least one subject with content.");
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
        body: JSON.stringify(sessionPayload()),
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
            {/* Left: Subject Selection */}
            <div className="col-span-12 lg:col-span-7 bg-surface-container-low p-6">
              <div className="flex justify-between items-end mb-6">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center text-on-surface">
                  <span className="material-symbols-outlined mr-2 text-primary-container">
                    folder_open
                  </span>
                  Subject Selection
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

              <div className="space-y-2">
                {Object.entries(grouped).map(([subject, docs]) => {
                  const displayName = SUBJECT_DISPLAY[subject] ?? subject.toUpperCase();
                  const isSelected = selectedSubjects.includes(subject);
                  const ragDocs = ragDocsForSubject(subject);
                  const examDocs = examDocsForSubject(subject);
                  const hasScript = ragDocs.some((d) => d.file_type === "script");
                  const hasSlides = ragDocs.some((d) => d.file_type === "slides");
                  const hasExam = examDocs.length > 0;
                  const hasRagContent = ragDocs.length > 0;

                  return (
                    <div
                      key={subject}
                      onClick={() => hasRagContent && toggleSubject(subject)}
                      className={`p-4 flex items-center gap-4 transition-all border-l-4 ${
                        hasRagContent ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                      } ${
                        isSelected
                          ? "bg-surface-container-lowest border-primary-container"
                          : "bg-surface hover:bg-surface-container border-transparent"
                      }`}
                    >
                      {/* Selection indicator */}
                      <span
                        className={`material-symbols-outlined text-xl shrink-0 transition-colors ${
                          isSelected ? "text-primary-container" : "text-neutral-300"
                        }`}
                        style={isSelected ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {isSelected ? "check_circle" : "radio_button_unchecked"}
                      </span>

                      {/* Subject info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold text-sm ${
                              isSelected ? "text-primary-container" : "text-on-surface"
                            }`}
                          >
                            {displayName}
                          </span>
                          {/* Content type badges */}
                          {hasScript && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-600 font-bold">
                              SCRIPT
                            </span>
                          )}
                          {hasSlides && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold">
                              SLIDES
                            </span>
                          )}
                          {hasExam && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-50 text-amber-600 font-bold">
                              EXAM PROFILE
                            </span>
                          )}
                          {!hasRagContent && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-neutral-100 text-neutral-400">
                              EXAM ONLY
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                          {ragDocs.length} RAG doc{ragDocs.length !== 1 ? "s" : ""}
                          {hasExam && ` · ${examDocs.length} exam doc${examDocs.length !== 1 ? "s" : ""} (style only)`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Topic filter */}
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
                    {allAvailableTopics.map((topic: Topic) => {
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

              {selectedSubjects.length > 0 && allAvailableTopics.length === 0 && (
                <div className="mt-4 pt-4 border-t border-outline-variant/30">
                  <p className="text-[10px] text-neutral-400 font-mono">
                    <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
                    No topic list available. Generate topics from the dashboard to enable topic filtering.
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

                {/* N_Questions + AI_Hints + Exam Mode */}
                <div className="flex gap-4">
                  <div className="flex-1 bg-surface-container-highest p-4 flex flex-col justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container">
                      N_Questions
                    </label>
                    <div className="flex items-center justify-between mt-2 gap-1">
                      <button
                        onClick={() => setNumQuestions((n) => Math.max(1, n - 1))}
                        className="p-1 hover:text-primary-container transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-[18px]">remove</span>
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={numQuestions}
                        onChange={(e) =>
                          setNumQuestions(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
                        }
                        className="text-xl font-black font-mono text-center w-14 bg-transparent border-b border-outline-variant focus:outline-none focus:border-primary-container"
                      />
                      <button
                        onClick={() => setNumQuestions((n) => Math.min(50, n + 1))}
                        className="p-1 hover:text-primary-container transition-colors shrink-0"
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

                {/* Synthesis toggle — only active when ≥2 topics and difficulty=synthesis */}
                <div className="mt-4 bg-surface-container-highest p-4 flex items-center justify-between">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container block">
                      Cross-Topic Synthesis
                    </label>
                    <p className="text-[9px] text-neutral-400 mt-0.5">
                      Mix 2 topics per question. Only fires at Very Hard difficulty.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">
                      {synthesisEnabled ? "ON" : "OFF"}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={synthesisEnabled}
                        onChange={(e) => setSynthesisEnabled(e.target.checked)}
                        disabled={selectedTopics.length < 2 && allAvailableTopics.length < 2}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container peer-disabled:opacity-40" />
                    </label>
                  </div>
                </div>

                {/* Exam Mode */}
                <div className="mt-4 bg-surface-container-highest p-4 flex items-center justify-between">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container block">
                      Exam_Mode
                    </label>
                    <p className="text-[9px] text-neutral-400 mt-0.5">
                      Hide results until session ends
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">
                      {examMode ? "ON" : "OFF"}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={examMode}
                        onChange={(e) => setExamMode(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container" />
                    </label>
                  </div>
                </div>

                {/* Summary chips */}
                <div className="mt-4 space-y-2">
                  {selectedSubjects.length > 0 && (
                    <div className="p-3 bg-primary-container/5 border border-primary-container/20">
                      <p className="text-[10px] font-mono text-primary-container font-bold mb-1">
                        {selectedSubjects.length} SUBJECT{selectedSubjects.length !== 1 ? "S" : ""} · {ragDocIds.length} RAG DOC{ragDocIds.length !== 1 ? "S" : ""}
                      </p>
                      <p className="text-[9px] text-neutral-500">
                        {selectedSubjects.map((s) => SUBJECT_DISPLAY[s] ?? s.toUpperCase()).join(" · ")}
                      </p>
                    </div>
                  )}
                  {selectedTopics.length > 0 && (
                    <div className="p-3 bg-primary-container/5 border border-primary-container/20">
                      <p className="text-[10px] font-mono text-primary-container font-bold mb-1">
                        TOPIC FILTER · {selectedTopics.length} topic{selectedTopics.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-[9px] text-neutral-500">
                        {selectedTopics.join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleGenerateAndExport}
                disabled={exporting || starting || ragDocIds.length === 0 || questionTypes.length === 0}
                className="w-full bg-surface-container border border-outline-variant/40 text-on-surface py-3 flex items-center justify-center gap-2 font-mono font-bold uppercase tracking-widest text-[10px] hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Create the exam and open the printable PDF in a new tab"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                {exporting ? "Generating…" : "Generate & Export PDF"}
              </button>

              {error && (
                <p className="text-sm text-red-600 font-mono bg-red-50 px-3 py-2">{error}</p>
              )}

              <button
                onClick={handleStart}
                disabled={starting || ragDocIds.length === 0 || questionTypes.length === 0}
                className="w-full bg-gradient-to-b from-primary to-primary-container text-white py-5 flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">bolt</span>
                {starting
                  ? `Generating ${numQuestions} question${numQuestions !== 1 ? "s" : ""}…`
                  : "Initialize Sandbox & Start Session"}
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
                Exam documents are used for question style profiling only — course scripts and
                slides power the retrieval context. Select a subject to include all its RAG content.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
