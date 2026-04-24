"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";

import { SplitPane } from "@/components/layout/SplitPane";
import { QuestionPanel } from "@/components/session/QuestionPanel";
import { HintDrawer } from "@/components/session/HintDrawer";
import { CodeEditor } from "@/components/session/CodeEditor";
import { TerminalOutput } from "@/components/session/TerminalOutput";
import { MultipleChoiceCard } from "@/components/session/MultipleChoiceCard";
import { OpenEndedInput } from "@/components/session/OpenEndedInput";
import { ImageUploadZone } from "@/components/session/ImageUploadZone";
import { GradingResult } from "@/components/session/GradingResult";
import { DisputeButton } from "@/components/session/DisputeButton";
import { SessionReview } from "@/components/session/SessionReview";
import { ExamReview } from "@/components/session/ExamReview";
import { useExerciseSession } from "@/hooks/useExerciseSession";
import { useCodeExecution } from "@/hooks/useCodeExecution";
import { useDocuments } from "@/hooks/useDocuments";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUIStore } from "@/stores/uiStore";
import { api } from "@/lib/api";
import { estimateExamSeconds } from "@/lib/examTiming";
import type { Session } from "@/types/session";
import type { Exercise, Submission } from "@/types/exercise";
import type { QuestionResult } from "@/components/session/ExamReview";
import { PdfViewerPane } from "@/components/session/PdfViewerPane";
import { KeyboardHelpModal } from "@/components/session/KeyboardHelpModal";
import { ExamTimer } from "@/components/session/ExamTimer";
import { ExportExamModal } from "@/components/session/ExportExamModal";

export default function SessionPage() {
  const params = useParams();
  const sessionId = Number(params.sessionId);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [code, setCode] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [mcSelected, setMcSelected] = useState<number | null>(null);
  const [msSelected, setMsSelected] = useState<number[]>([]); // multiple_select indices
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scratchpad, setScratchpad] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { state, exercise, submission, error: genError, nextExercise, submitAnswer } =
    useExerciseSession(sessionId);
  const { result: execResult, loading: running, execute } = useCodeExecution();
  const { data: documents } = useDocuments();
  const activePdf = useUIStore((s) => s.activePdf);
  const closePdf = useUIStore((s) => s.closePdf);
  const pdfCollapsed = useUIStore((s) => s.pdfCollapsed);
  const shortcutHelpOpen = useUIStore((s) => s.shortcutHelpOpen);
  const setShortcutHelpOpen = useUIStore((s) => s.setShortcutHelpOpen);
  const [hintOpen, setHintOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const timerDisplay = (() => {
    const h = Math.floor(elapsedSeconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((elapsedSeconds % 3600) / 60).toString().padStart(2, "0");
    const s = (elapsedSeconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  })();

  // Load session config on mount
  useEffect(() => {
    api<Session>(`/api/v1/sessions/${sessionId}`)
      .then(setSession)
      .catch(() => router.push("/dashboard"));
  }, [sessionId, router]);

  // Auto-generate first exercise
  useEffect(() => {
    if (!session || state !== "idle") return;
    const qType = session.question_types[0] ?? "coding";
    nextExercise(qType);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRun() {
    if (!exercise) return;
    execute(exercise.id, exercise.language ?? "python", code, "");
  }

  async function handleSubmit() {
    if (!exercise || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    // Capture user answer before submission (for exam review)
    const userAnswer =
      exercise.question_type === "multiple_select"
        ? JSON.stringify(msSelected)
        : exercise.question_type === "multiple_choice" || exercise.question_type === "true_false"
        ? String(mcSelected ?? 0)
        : textAnswer;
    try {
      let sub;
      if (exercise.question_type === "coding") {
        sub = await submitAnswer(code);
      } else if (exercise.question_type === "multiple_choice" || exercise.question_type === "true_false") {
        sub = await submitAnswer(String(mcSelected ?? 0));
      } else if (exercise.question_type === "multiple_select") {
        sub = await submitAnswer(JSON.stringify(msSelected));
      } else if (exercise.question_type === "open_ended") {
        if (imageFile) {
          const form = new FormData();
          form.append("file", imageFile);
          const res = await fetch(
            `/api/v1/exercises/${exercise.id}/submit/image`,
            { method: "POST", body: form }
          );
          if (!res.ok) throw new Error(await res.text());
          window.location.reload();
          return;
        } else {
          sub = await submitAnswer(textAnswer);
        }
      }
      // Record result for session review
      if (sub) {
        setResults((prev) => [
          ...prev,
          {
            passed: sub.passed || sub.disputed,
            type: exercise.question_type,
            exercise: exercise as Exercise,
            submission: sub as Submission,
            userAnswer: exercise.question_type === "coding" ? code : userAnswer,
          },
        ]);
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (!session) return;
    // Guard: don't generate past the last question
    if (questionNumber >= session.num_questions) return;
    const idx = questionNumber % session.question_types.length;
    const qType = session.question_types[idx] ?? "coding";
    setQuestionNumber((n) => n + 1);
    setCode("");
    setTextAnswer("");
    setMcSelected(null);
    setMsSelected([]);
    setImageFile(null);
    setSubmitError(null);
    nextExercise(qType);
  }

  async function handleEndSession() {
    if (session?.exam_mode) {
      try {
        await fetch(`/api/v1/sessions/${sessionId}/finalize`, { method: "POST" });
      } catch {
        /* non-fatal; review may show partial feedback */
      }
    }
    router.push("/history");
  }

  function handleSkip() {
    if (!exercise || !session) return;
    // Record as skipped (counts against the total, shows as failed in review)
    const newResults = [...results, { passed: false, type: exercise.question_type, skipped: true }];
    setResults(newResults);
    if (newResults.length >= session.num_questions) return; // session now complete
    const idx = questionNumber % session.question_types.length;
    const qType = session.question_types[idx] ?? "coding";
    setQuestionNumber((n) => n + 1);
    setCode("");
    setTextAnswer("");
    setMcSelected(null);
    setMsSelected([]);
    setImageFile(null);
    setSubmitError(null);
    nextExercise(qType);
  }

  const isGraded = state === "graded";

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useKeyboardShortcuts([
    {
      key: "Enter",
      meta: true,
      allowInInputs: true,
      handler: () => {
        if (submitting || !exercise) return;
        if (exercise.question_type === "coding") handleRun();
        else handleSubmit();
      },
    },
    {
      key: "Enter",
      meta: true,
      shift: true,
      allowInInputs: true,
      handler: () => {
        if (submitting || !exercise) return;
        handleSubmit();
      },
    },
    { key: "j", handler: () => isGraded && handleNext() },
    { key: "k", handler: () => { /* prev not supported; placeholder */ } },
    { key: "ArrowRight", handler: () => isGraded && handleNext() },
    { key: "h", disabled: !!session?.exam_mode, handler: () => setHintOpen((o) => !o) },
    { key: "?", shift: true, handler: () => setShortcutHelpOpen(true) },
    { key: "/", shift: true, handler: () => setShortcutHelpOpen(true) },
    { key: "Escape", handler: () => {
      if (shortcutHelpOpen) setShortcutHelpOpen(false);
      else if (activePdf) closePdf();
    }},
  ]);
  const isCoding = exercise?.question_type === "coding";
  const isMC = exercise?.question_type === "multiple_choice" || exercise?.question_type === "true_false";
  const isMS = exercise?.question_type === "multiple_select";
  const isOpenEnded = exercise?.question_type === "open_ended";
  // Session is complete once all questions have a result (answered or skipped)
  const isSessionComplete = session !== null && results.length >= session.num_questions;

  const DIFFICULTY_DISPLAY: Record<string, string> = {
    recall: "Medium",
    application: "Hard",
    synthesis: "Very Hard",
  };

  // Retry session completed: genError fires after all retry exercises done
  const isRetryComplete =
    genError !== null && session?.is_retry_session && results.length > 0;

  // Error state — generation failed (but not a completed retry session)
  if (genError && !isRetryComplete) {
    return (
      <div className="ml-64 h-screen flex items-center justify-center bg-surface">
        <div className="max-w-lg w-full mx-8">
          <div className="bg-surface-container-lowest border-l-4 border-primary-container p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="material-symbols-outlined text-primary-container mt-0.5">error</span>
              <div>
                <p className="font-bold text-sm text-on-surface uppercase tracking-wide">
                  Question Generation Failed
                </p>
                <p className="text-xs text-on-surface-variant mt-1 font-mono leading-relaxed">
                  {genError}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const qType = session?.question_types[0] ?? "coding";
                  nextExercise(qType);
                }}
                className="flex-1 bg-gradient-to-b from-primary to-primary-container text-white py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Retry
              </button>
              <button
                onClick={() => router.push("/session/new")}
                className="px-4 py-2 text-xs font-mono text-neutral-500 hover:text-neutral-900 border border-neutral-300 hover:border-neutral-500 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
          <p className="text-[10px] font-mono text-neutral-400 mt-3 px-1">
            Check the backend logs for the full error. Common causes: invalid model ID in .env,
            budget exceeded, or Fireworks API key issue.
          </p>
        </div>
      </div>
    );
  }

  // Retry session complete — show review inline
  if (isRetryComplete) {
    if (session?.exam_mode) {
      return <ExamReview results={results} onDone={handleEndSession} />;
    }
    return (
      <div className="ml-64 h-screen flex items-center justify-center bg-surface">
        <div className="max-w-lg w-full mx-8">
          <SessionReview results={results} onDone={handleEndSession} />
        </div>
      </div>
    );
  }

  // Loading state
  if (!session || state === "idle" || state === "loading") {
    return (
      <div className="ml-64 h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500 animate-pulse">
            {!session ? "Loading session…" : "Generating question…"}
          </p>
        </div>
      </div>
    );
  }

  // ── Header ──────────────────────────────────────────────────────────────
  const header = (
    <header className="flex justify-between items-center w-full px-6 py-2 sticky top-0 z-40 bg-neutral-100 border-b border-surface-container font-mono text-xs font-medium uppercase tracking-widest">
      <div className="flex items-center gap-6">
        <span className="text-sm font-black text-neutral-900 font-['Inter']">Technical Workbench</span>
        <div className="h-4 w-px bg-outline-variant/30" />
        <span className="text-[#A31B1F] font-bold">Session Context</span>
        <span className="text-neutral-600 capitalize">
          {DIFFICULTY_DISPLAY[session.difficulty] ?? session.difficulty} · Q{questionNumber}/{session.num_questions}
        </span>
        {session.exam_mode && (
          <span className="text-[9px] font-bold px-2 py-0.5 bg-neutral-200 text-neutral-600">
            EXAM MODE
          </span>
        )}
      </div>
      <div className="flex items-center gap-6">
        {session.exam_mode ? (
          <ExamTimer
            totalSeconds={estimateExamSeconds(session.question_types, session.num_questions)}
            onElapsed={handleEndSession}
          />
        ) : (
          <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1">
            <span className="material-symbols-outlined text-[14px]">timer</span>
            <span>{timerDisplay}</span>
          </div>
        )}
        {session.exam_mode && (
          <button
            onClick={() => setExportOpen(true)}
            title="Export exam as PDF"
            className="text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          </button>
        )}
        <button
          onClick={() => setShortcutHelpOpen(true)}
          title="Keyboard shortcuts (press ?)"
          className="text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">keyboard</span>
        </button>
        <button
          onClick={handleEndSession}
          className="text-[#A31B1F] font-bold hover:opacity-80 transition-opacity"
        >
          {session.exam_mode ? "End Exam" : "End Session"}
        </button>
      </div>
    </header>
  );

  // ── "Next Question" or SessionReview button (shown after grading) ────────
  function NextOrReview() {
    if (isSessionComplete) {
      return session?.exam_mode
        ? <ExamReview results={results} onDone={handleEndSession} />
        : <SessionReview results={results} onDone={handleEndSession} />;
    }
    return (
      <button
        onClick={handleNext}
        className="mt-4 w-full bg-gradient-to-b from-primary to-primary-container text-white py-3 font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
        Next Question
      </button>
    );
  }

  // ── Skip button (shown before grading) ───────────────────────────────────
  function SkipButton() {
    if (isSessionComplete) {
      return session?.exam_mode
        ? <ExamReview results={results} onDone={handleEndSession} />
        : <SessionReview results={results} onDone={handleEndSession} />;
    }
    return (
      <button
        onClick={handleSkip}
        className="mt-2 w-full py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-600 transition-colors flex items-center justify-center gap-1"
      >
        <span className="material-symbols-outlined text-xs">skip_next</span>
        Skip Question
      </button>
    );
  }

  // ── Left pane: question + hint + grading ────────────────────────────────
  const leftPane = exercise ? (
    <div className="h-full flex flex-col overflow-y-auto bg-surface-container-low">
      <div className="p-8 flex-1">
        <QuestionPanel
          questionText={exercise.question_text}
          questionType={exercise.question_type}
          questionNumber={questionNumber}
          sources={session.show_sources ? exercise.sources : null}
          documents={documents}
        />

        <div className="mt-4">
          <HintDrawer exerciseId={exercise.id} enabled={session.hints_enabled && !session.exam_mode} preloadedHint={exercise.hint} />
        </div>

        {!isGraded && <SkipButton />}

        {isGraded && submission && (
          <div className="mt-6">
            {session.exam_mode ? (
              <div className="p-4 bg-surface-container text-center">
                <p className="text-xs font-mono uppercase text-neutral-500">Answer recorded.</p>
              </div>
            ) : (
              <>
                <GradingResult
                  passed={submission.passed}
                  disputed={submission.disputed}
                  feedback={submission.feedback}
                />
                {!submission.passed && !submission.disputed && (
                  <DisputeButton
                    sessionId={sessionId}
                    exerciseId={exercise.id}
                    onDisputed={() => window.location.reload()}
                  />
                )}
              </>
            )}
            <NextOrReview />
          </div>
        )}
      </div>
    </div>
  ) : null;

  // ── Right pane (coding workspace) ───────────────────────────────────────
  const codingPane = exercise && isCoding ? (
    <div className="h-full flex flex-col bg-inverse-surface">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252525] border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <span className="material-symbols-outlined text-sm">description</span>
            <span>
              {exercise.language === "haskell"
                ? "Main.hs"
                : exercise.language === "sql"
                ? "query.sql"
                : "solution.py"}
            </span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-neutral-500 uppercase font-bold">LSP: Active</span>
          </div>
        </div>
        {!isGraded && (
          <button
            onClick={handleRun}
            disabled={running || !code.trim()}
            className="bg-primary-container hover:bg-primary text-white text-[10px] font-bold uppercase px-4 py-1.5 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">play_arrow</span>
            {running ? "Running…" : "Run Sandbox"}
          </button>
        )}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <CodeEditor
          language={(exercise.language ?? "python") as "python" | "sql" | "haskell" | "latex"}
          value={code}
          onChange={setCode}
        />
      </div>

      {/* Terminal */}
      <div className="h-48 flex-shrink-0 border-t border-white/5">
        <TerminalOutput
          stdout={execResult?.stdout ?? ""}
          stderr={execResult?.stderr ?? ""}
          exitCode={execResult?.exit_code ?? null}
        />
      </div>

      {/* Submit footer */}
      {!isGraded && (
        <div className="p-4 bg-[#1e1e1e] flex justify-between items-center flex-shrink-0">
          <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
            UTF-8 | {exercise.language?.toUpperCase() ?? "PYTHON"}
          </div>
          <div className="flex items-center gap-3">
            {submitError && (
              <span className="text-xs text-red-400 font-mono">{submitError}</span>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || !code.trim()}
              className="px-8 py-3 bg-gradient-to-b from-primary to-primary-container text-white text-xs font-bold uppercase rounded-lg shadow-xl hover:opacity-90 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit for Sandbox Evaluation"}
              <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  // ── Right pane (multimodal: MCQ/open-ended + scratchpad) ────────────────
  const multimodalPane = exercise && !isCoding ? (
    <div className="h-full flex flex-col bg-inverse-surface">
      {/* Scratchpad header */}
      <div className="px-6 py-3 bg-neutral-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container text-sm">edit_note</span>
          <span className="font-mono text-[10px] uppercase font-bold text-neutral-300">
            Scratchpad Workspace
          </span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setScratchpad("")}
            className="material-symbols-outlined text-neutral-500 text-sm hover:text-white cursor-pointer"
          >
            delete
          </button>
        </div>
      </div>

      {/* Scratchpad area */}
      <div className="flex-1 min-h-0 relative">
        <textarea
          value={scratchpad}
          onChange={(e) => setScratchpad(e.target.value)}
          placeholder="// Use this space to sketch derivations or notes"
          className="w-full h-full p-6 bg-transparent font-mono text-sm text-neutral-300 resize-none focus:outline-none placeholder-neutral-600 italic"
        />
      </div>


      {/* LLM hints output panel */}
      <div className="h-1/3 bg-black/40 border-t border-neutral-800 flex flex-col flex-shrink-0">
        <div className="px-4 py-2 bg-neutral-900 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-emerald-500 text-xs"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              smart_toy
            </span>
            <span className="font-mono text-[9px] uppercase font-bold text-neutral-400">
              LLM Study Guide Output
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
            <span className="font-mono text-[9px] text-emerald-500 uppercase">Ready</span>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {session.hints_enabled ? (
            <div className="text-neutral-500 italic text-xs">
              &gt; Hint panel active. Click &quot;Get Hint&quot; in the question panel for AI guidance.
            </div>
          ) : (
            <div className="text-neutral-600 text-xs">
              &gt; Hints are disabled for this session.
            </div>
          )}
        </div>
      </div>

    </div>
  ) : null;

  // ── Left pane for multimodal ─────────────────────────────────────────────
  const multimodalLeft = exercise && !isCoding ? (
    <div className="h-full overflow-y-auto bg-surface-bright flex flex-col p-8 space-y-6">
      <QuestionPanel
        questionText={exercise.question_text}
        questionType={exercise.question_type}
        questionNumber={questionNumber}
        sources={session.show_sources ? exercise.sources : null}
        documents={documents}
      />

      {/* MCQ / True-False answer options — below the question text */}
      {isMC && exercise.options && !isGraded && (
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 mb-3">
            Select Answer:
          </p>
          <MultipleChoiceCard
            options={exercise.options}
            selected={mcSelected}
            onSelect={setMcSelected}
            submitted={isGraded}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || mcSelected === null}
            className="mt-3 w-full bg-gradient-to-b from-primary to-primary-container text-white py-3 font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Answer"}
          </button>
          {submitError && (
            <p className="text-xs text-red-500 font-mono mt-2">{submitError}</p>
          )}
          <SkipButton />
        </div>
      )}

      {/* MCQ / True-False after grading */}
      {isMC && exercise.options && isGraded && (
        <MultipleChoiceCard
          options={exercise.options}
          selected={mcSelected}
          onSelect={setMcSelected}
          submitted={isGraded}
        />
      )}

      {/* Multiple-Select answer options */}
      {isMS && exercise.options && !isGraded && (
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 mb-3">
            Select All That Apply:
          </p>
          <MultipleChoiceCard
            options={exercise.options}
            selected={null}
            onSelect={() => {}}
            submitted={isGraded}
            multiSelect
            selectedIndices={msSelected}
            onToggle={(i) => setMsSelected((prev) =>
              prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
            )}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || msSelected.length === 0}
            className="mt-3 w-full bg-gradient-to-b from-primary to-primary-container text-white py-3 font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Answer"}
          </button>
          {submitError && (
            <p className="text-xs text-red-500 font-mono mt-2">{submitError}</p>
          )}
          <SkipButton />
        </div>
      )}

      {/* Multiple-Select after grading — show correct/wrong highlighting */}
      {isMS && exercise.options && isGraded && submission && (
        <MultipleChoiceCard
          options={exercise.options}
          selected={null}
          onSelect={() => {}}
          submitted={isGraded}
          multiSelect
          selectedIndices={msSelected}
          onToggle={() => {}}
          correctIndices={exercise.correct_indices ?? []}
        />
      )}

      {/* Open-ended inputs */}
      {isOpenEnded && !isGraded && (
        <div className="space-y-4">
          <OpenEndedInput
            value={textAnswer}
            onChange={setTextAnswer}
            disabled={isGraded}
          />
          <ImageUploadZone onUpload={setImageFile} />
          {imageFile && (
            <p className="text-xs font-mono text-neutral-400">
              Selected: {imageFile.name}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || (!textAnswer.trim() && !imageFile)}
            className="w-full bg-gradient-to-b from-primary to-primary-container text-white py-3 font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Answer"}
          </button>
          {submitError && (
            <p className="text-xs text-red-500 font-mono mt-2">{submitError}</p>
          )}
          <SkipButton />
        </div>
      )}

      {/* AI Hint */}
      <HintDrawer exerciseId={exercise.id} enabled={session.hints_enabled && !session.exam_mode} preloadedHint={exercise.hint} />

      {/* Grading result */}
      {isGraded && submission && (
        <div>
          {session.exam_mode ? (
            <div className="p-4 bg-surface-container text-center">
              <p className="text-xs font-mono uppercase text-neutral-500">Answer recorded.</p>
            </div>
          ) : (
            <>
              <GradingResult
                passed={submission.passed}
                disputed={submission.disputed}
                feedback={submission.feedback}
              />
              {!submission.passed && !submission.disputed && (
                <DisputeButton
                  sessionId={sessionId}
                  exerciseId={exercise.id}
                  onDisputed={() => window.location.reload()}
                />
              )}
            </>
          )}
          <NextOrReview />
        </div>
      )}
    </div>
  ) : null;

  // Right-pane composition:
  //  - no active PDF → just the workspace pane
  //  - collapsed PDF → workspace + narrow rail (rail clicks re-expand)
  //  - expanded PDF  → PDF viewer fully replaces the workspace pane
  const pdfPane = activePdf ? (
    <PdfViewerPane
      documentId={activePdf.documentId}
      page={activePdf.page}
      onClose={closePdf}
    />
  ) : null;

  function composeRight(workspace: ReactNode): ReactNode {
    if (!pdfPane) return workspace;
    if (pdfCollapsed) {
      return (
        <div className="h-full flex">
          <div className="flex-1 min-w-0">{workspace}</div>
          {pdfPane}
        </div>
      );
    }
    return pdfPane;
  }

  const rightForCoding = composeRight(codingPane);
  const rightForMultimodal = composeRight(multimodalPane);

  return (
    <div className="ml-64 h-screen flex flex-col overflow-hidden">
      {header}
      <div className="flex-1 overflow-hidden">
        {isCoding ? (
          <SplitPane
            left={leftPane}
            right={rightForCoding}
            defaultSplit={40}
          />
        ) : (
          <SplitPane
            left={multimodalLeft}
            right={rightForMultimodal}
            defaultSplit={65}
          />
        )}
      </div>
      <KeyboardHelpModal
        open={shortcutHelpOpen}
        onClose={() => setShortcutHelpOpen(false)}
        examMode={!!session.exam_mode}
      />
      {exportOpen && (
        <ExportExamModal sessionId={sessionId} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}
