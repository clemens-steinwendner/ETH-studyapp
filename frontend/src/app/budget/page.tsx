"use client";

import { useBudgetStatus } from "@/hooks/useBudgetStatus";

export default function BudgetPage() {
  const { data } = useBudgetStatus();

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">API Budget</h1>
      {data && (
        <div className="space-y-4">
          <p>Spent: ${data.spent_usd.toFixed(4)} / ${data.limit_usd.toFixed(2)}</p>
          <p>Remaining: ${data.remaining_usd.toFixed(4)}</p>
          {data.exceeded && (
            <p className="text-red-400 font-semibold">Budget exceeded — generative features disabled.</p>
          )}
        </div>
      )}
    </main>
  );
}
