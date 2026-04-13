"use client";

import ReactMarkdown from "react-markdown";

interface GradingResultProps {
  passed: boolean;
  disputed: boolean;
  feedback: string | null;
}

export function GradingResult({ passed, disputed, feedback }: GradingResultProps) {
  const effectivePassed = passed || disputed;

  return (
    <div className="space-y-4">
      {/* Pass/fail indicator */}
      <div className={`border-l-4 p-4 ${effectivePassed ? "border-emerald-500 bg-emerald-50" : "border-primary-container bg-surface-container-high"}`}>
        <div className="flex items-center gap-3">
          <span
            className={`material-symbols-outlined text-sm ${effectivePassed ? "text-emerald-600" : "text-primary-container"}`}
            style={effectivePassed ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            {effectivePassed ? "check_circle" : "cancel"}
          </span>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${
              effectivePassed
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {effectivePassed ? "PASS" : "FAIL"}
            {disputed ? " (manual override)" : ""}
          </span>
        </div>
      </div>

      {/* LLM tutor feedback */}
      {feedback && !effectivePassed && (
        <div className="bg-surface-container-high p-6 border-l-4 border-primary-container">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="material-symbols-outlined text-primary-container"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              psychology
            </span>
            <h3 className="font-bold text-xs uppercase tracking-widest text-on-surface">
              Tutor Feedback
            </h3>
          </div>
          <div className="text-sm leading-relaxed text-on-surface-variant prose prose-sm max-w-none
            prose-code:font-mono prose-code:bg-surface prose-code:px-0.5 prose-code:text-xs
            prose-strong:text-on-surface">
            <ReactMarkdown>{feedback}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Positive feedback */}
      {feedback && effectivePassed && (
        <div className="bg-emerald-50 p-4 border-l-4 border-emerald-500">
          <div className="text-sm text-emerald-800 prose prose-sm max-w-none">
            <ReactMarkdown>{feedback}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
