"use client";

import { useBudgetStatus } from "@/hooks/useBudgetStatus";

export function BudgetWarningBanner() {
  const { data } = useBudgetStatus();

  if (!data) return null;
  const pct = (data.spent_usd / data.limit_usd) * 100;

  if (pct >= 100) {
    return (
      <div className="ml-64 bg-primary-container text-white text-xs font-mono uppercase tracking-widest py-2 px-4 text-center flex items-center justify-center gap-3 z-40">
        <span className="material-symbols-outlined text-sm">warning</span>
        Monthly API budget of ${data.limit_usd.toFixed(2)} exceeded — generative features are disabled.
        <span className="material-symbols-outlined text-sm">warning</span>
      </div>
    );
  }

  if (pct >= 80) {
    return (
      <div className="ml-64 bg-orange-600/90 text-white text-xs font-mono uppercase tracking-widest py-1.5 px-4 text-center flex items-center justify-center gap-2 z-40">
        <span className="material-symbols-outlined text-sm">notification_important</span>
        API budget at {Math.round(pct)}% — ${(data.limit_usd - data.spent_usd).toFixed(2)} remaining
      </div>
    );
  }

  return null;
}
