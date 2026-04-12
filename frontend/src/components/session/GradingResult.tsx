"use client";

import ReactMarkdown from "react-markdown";

interface GradingResultProps {
  passed: boolean;
  disputed: boolean;
  feedback: string | null;
}

export function GradingResult({ passed, disputed, feedback }: GradingResultProps) {
  const badge = passed
    ? "bg-green-900 text-green-300 border-green-700"
    : "bg-red-900 text-red-300 border-red-700";

  return (
    <div className="mt-4 space-y-3">
      <span className={`inline-block px-3 py-1 rounded border text-sm font-semibold ${badge}`}>
        {passed ? "Passed" : "Failed"}{disputed ? " (override)" : ""}
      </span>
      {feedback && (
        <div className="p-3 bg-gray-800 rounded border border-gray-700 text-sm prose prose-invert max-w-none">
          <ReactMarkdown>{feedback}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
