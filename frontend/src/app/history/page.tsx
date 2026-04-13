"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/layout/TopNav";
import { api } from "@/lib/api";
import type { Session } from "@/types/session";

interface SessionWithStats extends Session {
  pass_count?: number;
  fail_count?: number;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<SessionWithStats | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    api<{ sessions: SessionWithStats[] }>("/api/v1/sessions")
      .then((res) => {
        setSessions(res.sessions ?? []);
        if (res.sessions?.length) setSelected(res.sessions[0]);
      })
      .catch(() => setSessions([]))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleRetry(sessionIds: number[]) {
    setRetrying(true);
    try {
      const data = await api<{ id: number }>("/api/v1/sessions/retry", {
        method: "POST",
        body: JSON.stringify({ source_session_ids: sessionIds }),
      });
      window.location.href = `/session/${data.id}`;
    } catch {
      setRetrying(false);
    }
  }

  const successRate =
    selected && selected.pass_count !== undefined && selected.fail_count !== undefined
      ? Math.round(
          (selected.pass_count /
            Math.max(1, selected.pass_count + selected.fail_count)) *
            100
        )
      : null;

  const totalExercises =
    selected && selected.pass_count !== undefined && selected.fail_count !== undefined
      ? selected.pass_count + selected.fail_count
      : null;

  return (
    <div className="ml-64 min-h-screen pb-16">
      <TopNav subtitle="Session History" />

      <main className="p-8 bg-surface min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Summary cards */}
          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-surface-container-lowest p-5 border-b-2 border-primary-container flex flex-col justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Success Rate
                  </span>
                  <h2 className="text-3xl font-black mt-1 text-on-surface">
                    {successRate !== null ? `${successRate}%` : "—"}
                  </h2>
                </div>
                {successRate !== null && (
                  <div className="w-full bg-surface-container h-1 mt-4 flex">
                    <div
                      className="bg-primary-container h-full"
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="bg-surface-container-lowest p-5 border-b-2 border-outline-variant flex flex-col justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Total Exercises
                  </span>
                  <h2 className="text-3xl font-black mt-1 text-on-surface">
                    {totalExercises ?? selected.num_questions}
                  </h2>
                </div>
                <p className="text-[10px] text-neutral-500 mt-4 uppercase font-mono">
                  Difficulty: {selected.difficulty}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-5 border-b-2 border-outline-variant flex flex-col justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Session Date
                  </span>
                  <h2 className="text-2xl font-black mt-1 text-on-surface">
                    {new Date(selected.created_at).toLocaleDateString("en-CH", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </h2>
                </div>
                <div className="flex items-center mt-4 text-[10px] text-primary font-bold uppercase gap-1">
                  <span className="material-symbols-outlined text-xs">bolt</span>
                  <span>Optimized Querying Active</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Session Manifest */}
            <div className="lg:col-span-4 bg-surface-container overflow-hidden flex flex-col h-[calc(100vh-320px)]">
              <div className="px-4 py-3 bg-surface-container-highest flex justify-between items-center flex-shrink-0">
                <span className="font-mono text-[10px] uppercase font-bold tracking-tighter text-on-surface">
                  Session Manifest
                </span>
                <button
                  onClick={() => handleRetry(sessions.map((s) => s.id))}
                  disabled={retrying || sessions.length === 0}
                  className="text-primary-container bg-surface-container-lowest px-3 py-1 text-[10px] font-bold border border-primary-container hover:bg-primary-container hover:text-white transition-all uppercase disabled:opacity-50"
                >
                  {retrying ? "Creating…" : "Retry Failed"}
                </button>
              </div>

              {isLoading && (
                <div className="p-4 text-xs font-mono text-neutral-400 animate-pulse">
                  Loading sessions…
                </div>
              )}

              {!isLoading && sessions.length === 0 && (
                <div className="p-6 text-center">
                  <span className="material-symbols-outlined text-3xl text-neutral-300 block mb-2">
                    history
                  </span>
                  <p className="text-xs text-neutral-500 font-mono uppercase">No sessions yet</p>
                  <Link
                    href="/session/new"
                    className="text-[10px] text-primary-container hover:underline mt-2 block"
                  >
                    Start your first session →
                  </Link>
                </div>
              )}

              <div className="flex-grow overflow-y-auto space-y-px">
                {sessions.map((s, idx) => {
                  const isSelected = selected?.id === s.id;
                  const rate =
                    s.pass_count !== undefined && s.fail_count !== undefined
                      ? Math.round(
                          (s.pass_count / Math.max(1, s.pass_count + s.fail_count)) * 100
                        )
                      : null;
                  const passed = rate !== null && rate >= 60;

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-surface border-l-4 border-primary-container"
                          : passed
                          ? "bg-surface-container-lowest border-l-4 border-emerald-600 hover:bg-surface-container"
                          : "bg-surface-container-lowest border-l-4 border-primary-container hover:bg-surface-container"
                      }`}
                    >
                      <div>
                        <p className="text-[11px] font-mono text-neutral-400">
                          #{String(idx + 1).padStart(2, "0")}_SESSION_
                          {new Date(s.created_at)
                            .toISOString()
                            .slice(0, 10)
                            .replace(/-/g, "")}
                        </p>
                        <p className="text-xs font-bold mt-0.5 text-on-surface capitalize">
                          {s.difficulty} · {s.num_questions} questions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {rate !== null ? (
                          <>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${
                                rate >= 60
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {rate >= 60 ? "PASS" : "FAIL"}
                            </span>
                            <span className="text-[9px] font-mono text-neutral-400">
                              {rate}%
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px] font-mono text-neutral-400">
                            {new Date(s.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detail view */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {selected ? (
                <>
                  {/* Session info */}
                  <div className="bg-surface-container-lowest p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-on-surface">
                        Session Details
                      </h3>
                      <Link
                        href={`/session/${selected.id}`}
                        className="text-[10px] font-mono font-bold text-primary-container hover:underline uppercase"
                      >
                        Resume →
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-primary-container uppercase">
                          Difficulty
                        </span>
                        <p className="text-sm mt-1 capitalize text-on-surface">{selected.difficulty}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-primary-container uppercase">
                          Question Types
                        </span>
                        <p className="text-sm mt-1 text-on-surface capitalize">
                          {selected.question_types.map((t) => t.replace("_", " ")).join(", ")}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-primary-container uppercase">
                          Created
                        </span>
                        <p className="text-sm mt-1 text-on-surface">
                          {new Date(selected.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-primary-container uppercase">
                          Hints
                        </span>
                        <p className="text-sm mt-1 text-on-surface">
                          {selected.hints_enabled ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Retry button */}
                  <div className="bg-surface-container-high p-6 border-l-4 border-primary-container">
                    <div className="flex items-center gap-2 mb-4">
                      <span
                        className="material-symbols-outlined text-primary-container"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        psychology
                      </span>
                      <h3 className="font-bold text-xs uppercase tracking-widest text-on-surface">
                        Spaced Repetition
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed text-on-surface-variant mb-4">
                      Generate a new session targeting only the exercises you failed in this
                      session. Spaced repetition strengthens long-term retention.
                    </p>
                    <button
                      onClick={() => handleRetry([selected.id])}
                      disabled={retrying}
                      className="w-full bg-gradient-to-b from-primary to-primary-container text-white text-xs font-bold py-3 uppercase tracking-[0.2em] active:scale-[0.98] transition-all disabled:opacity-50 hover:opacity-90"
                    >
                      {retrying ? "Creating session…" : "Retry Failed Exercises from This Session"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-neutral-400 py-20">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-4xl mb-3 block text-neutral-300">
                      touch_app
                    </span>
                    <p className="text-sm font-mono uppercase tracking-wider">
                      Select a session to view details
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
