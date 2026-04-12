"use client";

import { useBudgetStatus } from "@/hooks/useBudgetStatus";

export function BudgetWarningBanner() {
  const { data } = useBudgetStatus();

  if (!data?.exceeded) return null;

  return (
    <div className="bg-red-900 border-b border-red-700 px-4 py-2 text-red-200 text-sm text-center">
      Monthly API budget of ${data.limit_usd.toFixed(2)} exceeded. Generative features are disabled.
    </div>
  );
}
