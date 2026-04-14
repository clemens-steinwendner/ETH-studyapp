interface Result {
  passed: boolean;
  type: string;
  skipped?: boolean;
}

interface SessionReviewProps {
  results: Result[];
  onDone: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  coding: "Coding",
  multiple_choice: "MCQ",
  open_ended: "Open-Ended",
};

export function SessionReview({ results, onDone }: SessionReviewProps) {
  const total = results.length;
  const skipped = results.filter((r) => r.skipped).length;
  const answered = total - skipped;
  const passed = results.filter((r) => r.passed).length;
  const failed = answered - passed;
  const pct = answered > 0 ? Math.round((passed / answered) * 100) : 0;
  const isGood = pct >= 60;

  return (
    <div className="mt-6 bg-surface-container-lowest border-t-4 border-primary-container p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-primary-container"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          task_alt
        </span>
        <h3 className="font-bold text-sm uppercase tracking-widest text-on-surface">
          Session Complete
        </h3>
      </div>

      {/* Score summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-surface-container p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-400 mb-1">Total</p>
          <p className="text-2xl font-black text-on-surface">{total}</p>
        </div>
        <div className="bg-emerald-50 p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-600 mb-1">Passed</p>
          <p className="text-2xl font-black text-emerald-700">{passed}</p>
        </div>
        <div className="bg-red-50 p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-widest text-red-500 mb-1">Failed</p>
          <p className="text-2xl font-black text-red-600">{failed}</p>
        </div>
        <div className="bg-neutral-50 p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-400 mb-1">Skipped</p>
          <p className="text-2xl font-black text-neutral-500">{skipped}</p>
        </div>
      </div>

      {/* Progress bar */}
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
      <div>
        <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-400 mb-2">
          Question Breakdown
        </p>
        <div className="flex flex-wrap gap-1">
          {results.map((r, i) => (
            <div
              key={i}
              title={`Q${i + 1}: ${TYPE_LABEL[r.type] ?? r.type} — ${r.skipped ? "SKIPPED" : r.passed ? "PASS" : "FAIL"}`}
              className={`w-7 h-7 flex items-center justify-center text-[9px] font-bold font-mono ${
                r.skipped
                  ? "bg-neutral-100 text-neutral-400"
                  : r.passed
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {r.skipped ? "–" : i + 1}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onDone}
        className="w-full bg-gradient-to-b from-primary to-primary-container text-white py-3 font-bold uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">history</span>
        View Full History
      </button>
    </div>
  );
}
