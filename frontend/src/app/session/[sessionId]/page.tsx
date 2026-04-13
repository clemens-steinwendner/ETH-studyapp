"use client";

import { useEffect, useState } from "react";
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
import { useExerciseSession } from "@/hooks/useExerciseSession";
import { useCodeExecution } from "@/hooks/useCodeExecution";
import { api } from "@/lib/api";
import type { Session } from "@/types/session";

export default function SessionPage() {
  const params = useParams();
  const sessionId = Number(params.sessionId);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [code, setCode] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [mcSelected, setMcSelected] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scratchpad, setScratchpad] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { state, exercise, submission, error: genError, nextExercise, submitAnswer } =
    useExerciseSession(sessionId);
  const { result: execResult, loading: running, execute } = useCodeExecution();

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
    try {
      if (exercise.question_type === "coding") {
        await submitAnswer(code);
      } else if (exercise.question_type === "multiple_choice") {
        await submitAnswer(String(mcSelected ?? 0));
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
          await submitAnswer(textAnswer);
        }
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (!session) return;
    const idx = questionNumber % session.question_types.length;
    const qType = session.question_types[idx] ?? "coding";
    setQuestionNumber((n) => n + 1);
    setCode("");
    setTextAnswer("");
    setMcSelected(null);
    setImageFile(null);
    setSubmitError(null);
    nextExercise(qType);
  }

  const isGraded = state === "graded";
  const isCoding = exercise?.question_type === "coding";
  const isMC = exercise?.question_type === "multiple_choice";
  const isOpenEnded = exercise?.question_type === "open_ended";

  // Error state — generation failed
  if (genError) {
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
          {session.difficulty} · Q{questionNumber}/{session.num_questions}
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1">
          <span className="material-symbols-outlined text-[14px]">timer</span>
          <span>{timerDisplay}</span>
        </div>
        <button
          onClick={() => router.push("/history")}
          className="text-[#A31B1F] font-bold hover:opacity-80 transition-opacity"
        >
          End Session
        </button>
      </div>
    </header>
  );

  // ── Left pane: question + hint + grading ────────────────────────────────
  const leftPane = exercise ? (
    <div className="h-full flex flex-col overflow-y-auto bg-surface-container-low">
      <div className="p-8 flex-1">
        <QuestionPanel
          questionText={exercise.question_text}
          questionType={exercise.question_type}
          questionNumber={questionNumber}
        />

        <div className="mt-4">
          <HintDrawer exerciseId={exercise.id} enabled={session.hints_enabled} />
        </div>

        {isGraded && submission && (
          <div className="mt-6">
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
            <button
              onClick={handleNext}
              className="mt-4 w-full bg-gradient-to-b from-primary to-primary-container text-white py-3 font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
              Next Question
            </button>
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

      {/* MCQ answer panel */}
      {isMC && exercise.options && (
        <div className="border-t border-neutral-700 bg-neutral-900/50 p-4 flex-shrink-0">
          <p className="text-[10px] font-mono text-neutral-400 uppercase mb-3">Select Answer:</p>
          <div className="space-y-2">
            {exercise.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => !isGraded && setMcSelected(i)}
                className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${
                  mcSelected === i
                    ? "bg-primary-container/20 border border-primary-container text-neutral-100"
                    : "bg-neutral-800/50 border border-neutral-700 text-neutral-400 hover:border-neutral-500"
                } ${isGraded ? "cursor-default" : "cursor-pointer"}`}
              >
                <span className="text-primary-container mr-2">{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* Submit */}
      {!isGraded && (
        <div className="p-4 bg-[#1e1e1e] flex justify-between items-center flex-shrink-0">
          {submitError && (
            <span className="text-xs text-red-400 font-mono">{submitError}</span>
          )}
          <div className="ml-auto">
            <button
              onClick={handleSubmit}
              disabled={submitting || (isMC && mcSelected === null) || (isOpenEnded && !textAnswer.trim() && !imageFile)}
              className="px-8 py-3 bg-gradient-to-b from-primary to-primary-container text-on-primary font-bold uppercase tracking-widest text-xs rounded-lg shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Solution"}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  // ── Left pane for multimodal ─────────────────────────────────────────────
  const multimodalLeft = exercise && !isCoding ? (
    <div className="h-full overflow-y-auto bg-surface-bright flex flex-col p-8 space-y-6">
      <QuestionPanel
        questionText={exercise.question_text}
        questionType={exercise.question_type}
        questionNumber={questionNumber}
      />

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
        </div>
      )}

      {/* AI Hint */}
      <HintDrawer exerciseId={exercise.id} enabled={session.hints_enabled} />

      {/* Grading result */}
      {isGraded && submission && (
        <div>
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
          <button
            onClick={handleNext}
            className="mt-4 w-full bg-gradient-to-b from-primary to-primary-container text-white py-3 font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
            Next Question
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="ml-64 h-screen flex flex-col overflow-hidden">
      {header}
      <div className="flex-1 overflow-hidden">
        {isCoding ? (
          <SplitPane
            left={leftPane}
            right={codingPane}
            defaultSplit={40}
          />
        ) : (
          <SplitPane
            left={multimodalLeft}
            right={multimodalPane}
            defaultSplit={65}
          />
        )}
      </div>
    </div>
  );
}
