"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { useBudgetStatus } from "@/hooks/useBudgetStatus";

interface ModelOption { id: string; label: string; note: string; }
interface AppSettings { fireworks_model: string; allowed_models: ModelOption[]; }

export default function BudgetPage() {
  const { data } = useBudgetStatus();
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [savingModel, setSavingModel] = useState(false);
  const [modelSaved, setModelSaved] = useState(false);

  useEffect(() => {
    fetch("/api/v1/settings/")
      .then((r) => r.json())
      .then((d: AppSettings) => {
        setAppSettings(d);
        setSelectedModel(d.fireworks_model);
      })
      .catch(() => {});
  }, []);

  async function handleSaveModel() {
    if (!selectedModel) return;
    setSavingModel(true);
    setModelSaved(false);
    try {
      const res = await fetch("/api/v1/settings/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fireworks_model: selectedModel }),
      });
      if (res.ok) setModelSaved(true);
    } finally {
      setSavingModel(false);
    }
  }

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

        {/* Model selection */}
        <div className="bg-surface-container-lowest p-6">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500 mb-4">
            LLM Model Selection
          </h3>
          <p className="text-xs text-on-surface-variant mb-4">
            Choose which model is used for question generation, hints, and grading. Changes take effect immediately for the next question generated.
          </p>
          {appSettings ? (
            <div className="space-y-3">
              {appSettings.allowed_models.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer border transition-colors ${
                    selectedModel === m.id
                      ? "border-primary-container bg-primary-container/5"
                      : "border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={selectedModel === m.id}
                    onChange={() => setSelectedModel(m.id)}
                    className="mt-0.5 text-primary-container"
                  />
                  <div>
                    <p className="text-sm font-bold text-on-surface">{m.label}</p>
                    <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{m.note}</p>
                    <p className="text-[9px] font-mono text-neutral-300 mt-0.5 truncate">{m.id}</p>
                  </div>
                </label>
              ))}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveModel}
                  disabled={savingModel || selectedModel === appSettings.fireworks_model}
                  className="bg-primary-container text-white px-6 py-2 text-xs font-bold uppercase hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {savingModel ? "Saving…" : "Save Model"}
                </button>
                {modelSaved && (
                  <span className="text-xs text-emerald-600 font-mono font-bold">
                    ✓ Model updated
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs font-mono text-neutral-400 animate-pulse">Loading models…</div>
          )}
        </div>

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
