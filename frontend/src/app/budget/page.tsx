"use client";

import { TopNav } from "@/components/layout/TopNav";
import { useBudgetStatus } from "@/hooks/useBudgetStatus";

export default function BudgetPage() {
  const { data } = useBudgetStatus();

  const pct = data ? Math.round((data.spent_usd / data.limit_usd) * 100) : 0;

  return (
    <div className="ml-64 min-h-screen pb-16">
      <TopNav subtitle="Budget" budgetPct={pct} />

      <main className="p-8 max-w-4xl mx-auto space-y-8">
        {/* Summary cards */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-on-surface">
            API Budget Overview
          </h2>
          <p className="text-on-surface-variant font-mono text-sm">
            PATH: /BUDGET/MONTHLY_SUMMARY
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Spent */}
          <div className="bg-surface-container-lowest p-5 border-b-2 border-primary-container flex flex-col justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Spent This Month
              </span>
              <h2 className="text-3xl font-black mt-1 text-on-surface">
                ${data?.spent_usd.toFixed(2) ?? "—"}
              </h2>
            </div>
            <div className="w-full bg-surface-container h-1 mt-4 flex">
              <div
                className="bg-primary-container h-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>

          {/* Remaining */}
          <div className="bg-surface-container-lowest p-5 border-b-2 border-outline-variant flex flex-col justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Remaining Budget
              </span>
              <h2 className="text-3xl font-black mt-1 text-on-surface">
                ${data ? (data.limit_usd - data.spent_usd).toFixed(2) : "—"}
              </h2>
            </div>
            <p className="text-[10px] font-mono text-neutral-500 mt-4 uppercase">
              Limit: ${data?.limit_usd.toFixed(2) ?? "8.00"} / month
            </p>
          </div>

          {/* Status */}
          <div className="bg-surface-container-lowest p-5 border-b-2 border-outline-variant flex flex-col justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Usage
              </span>
              <h2 className="text-3xl font-black mt-1 text-on-surface">{pct}%</h2>
            </div>
            <div className="flex items-center mt-4 text-[10px] font-bold uppercase gap-1">
              {data?.exceeded ? (
                <span className="text-primary-container flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">block</span>
                  Budget Exceeded
                </span>
              ) : pct >= 80 ? (
                <span className="text-orange-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  Approaching Limit
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">bolt</span>
                  Optimized Querying Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Segmented progress bar */}
        <div className="bg-surface-container-lowest p-6">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500 mb-4">
            Monthly Allocation
          </h3>
          <div className="grid grid-cols-10 gap-1 h-4 mb-2">
            {Array.from({ length: 10 }).map((_, i) => {
              const threshold = (i + 1) * 10;
              return (
                <div
                  key={i}
                  className={`col-span-1 ${
                    threshold <= pct
                      ? "bg-primary-container"
                      : threshold === Math.ceil(pct / 10) * 10 && pct % 10 !== 0
                      ? "bg-primary-container/40"
                      : "bg-surface-container-high"
                  }`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] font-mono text-neutral-400 uppercase">
            <span>$0.00</span>
            <span>${data?.limit_usd.toFixed(2) ?? "8.00"}</span>
          </div>
        </div>

        {data?.exceeded && (
          <div className="bg-primary-container/5 border-l-4 border-primary-container p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary-container mt-0.5">warning</span>
              <div>
                <p className="font-bold text-sm text-on-surface">Budget Exceeded</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  All generative features (LLM question generation, AI hints, vision grading) are
                  disabled until the next billing period. Existing session data remains accessible.
                </p>
              </div>
            </div>
          </div>
        )}

        {!data && (
          <div className="text-center py-12 text-neutral-400">
            <div className="w-6 h-6 border-2 border-neutral-300 border-t-primary-container rounded-full animate-spin mx-auto mb-3" />
            <p className="font-mono text-xs uppercase">Loading budget data…</p>
          </div>
        )}
      </main>
    </div>
  );
}
