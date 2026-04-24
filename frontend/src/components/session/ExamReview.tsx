"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { SourcesButton } from "@/components/session/SourcesButton";
import { useDocuments } from "@/hooks/useDocuments";
import type { Exercise, Submission } from "@/types/exercise";

export interface QuestionResult {
  passed: boolean;
  type: string;
  skipped?: boolean;
  exercise?: Exercise;
  submission?: Submission;
  userAnswer?: string;
}

interface ExamReviewProps {
  results: QuestionResult[];
  onDone: () => void;
}

function md(text: string) {
  return (
    <div className="prose prose-sm max-w-none text-on-surface-variant leading-relaxed
      prose-headings:text-on-surface prose-headings:font-bold
      prose-code:bg-surface-container-highest prose-code:px-1 prose-code:rounded prose-code:font-mono prose-code:text-xs
      prose-strong:text-on-surface
    ">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function getUserAnswerLabel(result: QuestionResult): string {
  const { exercise, userAnswer, skipped } = result;
  if (skipped) return "—";
  if (!userAnswer || !exercise) return "—";

  if (exercise.question_type === "multiple_choice" || exercise.question_type === "true_false") {
    const idx = parseInt(userAnswer, 10);
    return exercise.options?.[idx] ?? userAnswer;
  }
  if (exercise.question_type === "multiple_select") {
    try {
      const indices: number[] = JSON.parse(userAnswer);
      const labels = indices.map((i) => exercise.options?.[i] ?? String(i));
      return labels.length > 0 ? labels.join(", ") : "—";
    } catch {
      return userAnswer;
    }
  }
  // open_ended / coding
  return userAnswer.trim() || "—";
}

function getCorrectAnswerLabel(exercise: Exercise): string {
  if (exercise.question_type === "multiple_choice" || exercise.question_type === "true_false") {
    if (exercise.correct_index !== null && exercise.correct_index !== undefined) {
      return exercise.options?.[exercise.correct_index] ?? String(exercise.correct_index);
    }
    return "—";
  }
  if (exercise.question_type === "multiple_select") {
    const indices = exercise.correct_indices ?? [];
    const labels = indices.map((i) => exercise.options?.[i] ?? String(i));
    return labels.length > 0 ? labels.join(", ") : "—";
  }
  // open_ended / coding — show explanation separately
  return "See explanation below";
}

function QuestionRow({ result, index }: { result: QuestionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data: documents } = useDocuments();
  const { exercise, submission, skipped } = result;

  const badgeCls = skipped
    ? "bg-neutral-100 text-neutral-400"
    : result.passed
    ? "bg-emerald-100 text-emerald-800"
    : "bg-red-100 text-red-700";

  const explanation =
    exercise?.explanation || submission?.feedback || null;

  return (
    <div className="border border-surface-container-high bg-surface-container-lowest">
      {/* Row header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container/50 transition-colors"
      >
        <span
          className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-[10px] font-bold font-mono ${badgeCls}`}
        >
          {skipped ? "–" : index + 1}
        </span>
        <span className="flex-1 text-xs font-mono text-neutral-600 truncate">
          {exercise
            ? exercise.question_text.slice(0, 100).replace(/\n/g, " ") +
              (exercise.question_text.length > 100 ? "…" : "")
            : `Q${index + 1}`}
        </span>
        <span className="material-symbols-outlined text-neutral-400 text-sm transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          expand_more
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && exercise && (
        <div className="border-t border-surface-container-high px-4 py-4 space-y-4">
          {/* Question text + sources button (top right) */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                Question
              </p>
              {exercise.sources && exercise.sources.length > 0 && (
                <SourcesButton sources={exercise.sources} documents={documents} />
              )}
            </div>
            {md(exercise.question_text)}
          </div>

          {!skipped && (
            <>
              {/* User's answer */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-400 mb-1">
                    Your Answer
                  </p>
                  <p className={`text-xs font-mono px-2 py-1 ${result.passed ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                    {getUserAnswerLabel(result)}
                  </p>
                </div>

                {/* Correct answer */}
                {(exercise.question_type !== "open_ended" && exercise.question_type !== "coding") && (
                  <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-400 mb-1">
                      Correct Answer
                    </p>
                    <p className="text-xs font-mono px-2 py-1 bg-emerald-50 text-emerald-800">
                      {getCorrectAnswerLabel(exercise)}
                    </p>
                  </div>
                )}
              </div>

              {/* Explanation */}
              {explanation && (
                <div>
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-400 mb-2">
                    Explanation
                  </p>
                  <div className="bg-surface-container p-3">
                    {md(explanation)}
                  </div>
                </div>
              )}
            </>
          )}

          {skipped && (
            <p className="text-xs font-mono text-neutral-400 italic">This question was skipped.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ExamReview({ results, onDone }: ExamReviewProps) {
  const total = results.length;
  const skipped = results.filter((r) => r.skipped).length;
  const answered = total - skipped;
  const passed = results.filter((r) => r.passed).length;
  const failed = answered - passed;
  const pct = answered > 0 ? Math.round((passed / answered) * 100) : 0;
  const isGood = pct >= 60;

  return (
    <div className="ml-64 min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-primary-container text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            task_alt
          </span>
          <div>
            <h1 className="font-bold text-lg uppercase tracking-widest text-on-surface">
              Exam Review
            </h1>
            <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              Detailed breakdown · {total} questions
            </p>
          </div>
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-surface-container p-4 text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-400 mb-1">Total</p>
            <p className="text-3xl font-black text-on-surface">{total}</p>
          </div>
          <div className="bg-emerald-50 p-4 text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-600 mb-1">Passed</p>
            <p className="text-3xl font-black text-emerald-700">{passed}</p>
          </div>
          <div className="bg-red-50 p-4 text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest text-red-500 mb-1">Failed</p>
            <p className="text-3xl font-black text-red-600">{failed}</p>
          </div>
          <div className="bg-neutral-50 p-4 text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-400 mb-1">Skipped</p>
            <p className="text-3xl font-black text-neutral-500">{skipped}</p>
          </div>
        </div>

        {/* Score bar */}
        {answered > 0 && (
          <div>
            <div className="flex justify-between text-[9px] font-mono text-neutral-400 mb-1">
              <span>SCORE (answered only)</span>
              <span className={isGood ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                {pct}%
              </span>
            </div>
            <div className="w-full bg-surface-container h-2">
              <div
                className={`h-full transition-all ${isGood ? "bg-emerald-500" : "bg-primary-container"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Per-question breakdown */}
        <div className="space-y-2">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-400 mb-3">
            Question Breakdown — Click to Expand
          </p>
          {results.map((r, i) => (
            <QuestionRow key={i} result={r} index={i} />
          ))}
        </div>

        <button
          onClick={onDone}
          className="w-full bg-gradient-to-b from-primary to-primary-container text-white py-3 font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">history</span>
          View Full History
        </button>
      </div>
    </div>
  );
}
