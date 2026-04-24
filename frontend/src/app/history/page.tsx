"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { api } from "@/lib/api";
import { useDocuments } from "@/hooks/useDocuments";
import type { Session } from "@/types/session";
import type { Document } from "@/types/document";

interface SessionWithStats extends Session {
  pass_count?: number;
  fail_count?: number;
}

const SUBJECT_DISPLAY: Record<string, string> = {
  databases: "Databases",
  networks: "Networks",
  ml: "Machine Learning",
  fmfp: "FMFP / Haskell",
  probability: "Probability & Stats",
  other: "Other",
  unassigned: "Unassigned",
};

const DIFFICULTY_DISPLAY: Record<string, string> = {
  recall: "Medium",
  application: "Hard",
  synthesis: "Very Hard",
};

/** Pick the dominant subject across a session's documents. */
function sessionSubject(session: SessionWithStats, documents: Document[] | null | undefined): string {
  if (!documents) return "unassigned";
  const tally: Record<string, number> = {};
  for (const id of session.document_ids) {
    const doc = documents.find((d) => d.id === id);
    const subj = doc?.subject ?? "unassigned";
    tally[subj] = (tally[subj] ?? 0) + 1;
  }
  let best = "unassigned";
  let bestCount = -1;
  for (const [k, v] of Object.entries(tally)) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  }
  return best;
}

export default function HistoryPage() {
  const router = useRouter();
  const { data: documents } = useDocuments();
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restartingId, setRestartingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SessionWithStats[]>("/api/v1/sessions")
      .then((res) => setSessions(Array.isArray(res) ? res : []))
      .catch(() => setSessions([]))
      .finally(() => setIsLoading(false));
  }, []);

  // Group sessions by their dominant subject
  const grouped = useMemo(() => {
    const out: Record<string, SessionWithStats[]> = {};
    for (const s of sessions) {
      const subj = sessionSubject(s, documents);
      (out[subj] ??= []).push(s);
    }
    return out;
  }, [sessions, documents]);

  async function handleRestart(sessionId: number) {
    setRestartingId(sessionId);
    setError(null);
    try {
      await api(`/api/v1/sessions/${sessionId}/restart`, { method: "POST" });
      router.push(`/session/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restart session.");
      setRestartingId(null);
    }
  }

  async function handleDelete(sessionId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this session and all its submissions?")) return;
    setDeletingId(sessionId);
    try {
      await api(`/api/v1/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="ml-64 min-h-screen pb-16">
      <TopNav subtitle="Session History" />

      <main className="p-8 bg-surface min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-on-surface">Session History</h2>
              <p className="text-on-surface-variant font-mono text-xs mt-1">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""} · grouped by subject ·
                click any card to replay from question 1
              </p>
            </div>
            <Link
              href="/session/new"
              className="inline-flex items-center gap-2 bg-gradient-to-b from-primary to-primary-container text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Session
            </Link>
          </div>

          {error && (
            <p className="mb-4 text-xs text-red-600 font-mono bg-red-50 px-3 py-2">{error}</p>
          )}

          {isLoading && (
            <p className="text-xs font-mono text-neutral-400 animate-pulse">Loading sessions…</p>
          )}

          {!isLoading && sessions.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant/30 p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-neutral-300 block mb-3">
                history
              </span>
              <p className="text-sm text-neutral-500 font-mono uppercase">No sessions yet.</p>
              <Link href="/session/new" className="text-xs text-primary-container hover:underline mt-2 inline-block">
                Start your first session →
              </Link>
            </div>
          )}

          {/* Subject sections */}
          <div className="space-y-10">
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([subject, group]) => (
                <section key={subject}>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">
                      {SUBJECT_DISPLAY[subject] ?? subject}
                    </h3>
                    <div className="flex-1 h-px bg-outline-variant/40" />
                    <span className="text-[10px] font-mono text-neutral-400">
                      {group.length} session{group.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {group.map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        restarting={restartingId === s.id}
                        deleting={deletingId === s.id}
                        onClick={() => handleRestart(s.id)}
                        onDelete={(e) => handleDelete(s.id, e)}
                      />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}

interface SessionCardProps {
  session: SessionWithStats;
  restarting: boolean;
  deleting: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SessionCard({ session, restarting, deleting, onClick, onDelete }: SessionCardProps) {
  const total = session.num_questions;
  const passed = session.pass_count ?? 0;
  const failed = session.fail_count ?? 0;
  const answered = passed + failed;
  const pct = answered > 0 ? Math.round((passed / answered) * 100) : 0;
  const tone =
    answered === 0 ? "neutral" : pct >= 60 ? "good" : "weak";
  const date = new Date(session.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const accent =
    tone === "good"
      ? "border-l-emerald-500"
      : tone === "weak"
      ? "border-l-primary-container"
      : "border-l-neutral-300";
  const scoreColor =
    tone === "good"
      ? "text-emerald-600"
      : tone === "weak"
      ? "text-primary-container"
      : "text-neutral-500";

  return (
    <button
      onClick={onClick}
      disabled={restarting || deleting}
      className={`relative text-left bg-surface-container-lowest hover:bg-surface-container border-l-4 ${accent} p-4 transition-colors disabled:opacity-60 disabled:cursor-wait group`}
    >
      {/* Score — the headline number */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-black font-mono tabular-nums ${scoreColor}`}>
            {passed}
          </span>
          <span className="text-lg font-mono text-neutral-400 tabular-nums">/{total}</span>
        </div>
        {answered > 0 && (
          <span className={`text-[10px] font-mono font-bold ${scoreColor}`}>{pct}%</span>
        )}
      </div>

      {/* Meta */}
      <div className="space-y-1">
        <p className="text-xs font-bold text-on-surface capitalize truncate">
          {DIFFICULTY_DISPLAY[session.difficulty] ?? session.difficulty}
          {session.exam_mode && (
            <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 bg-neutral-200 text-neutral-700 align-middle">
              EXAM
            </span>
          )}
          {session.is_retry_session && (
            <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 bg-amber-100 text-amber-700 align-middle">
              RETRY
            </span>
          )}
        </p>
        <p className="text-[10px] font-mono text-neutral-400">
          {date} · {session.question_types.length} type
          {session.question_types.length !== 1 ? "s" : ""}
          {answered > 0 && answered < total && (
            <> · {total - answered} unanswered</>
          )}
        </p>
      </div>

      {/* Hover hint + delete */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] font-mono font-bold uppercase text-primary-container px-2 py-0.5 bg-white border border-primary-container/40">
          {restarting ? "Restarting…" : "Replay →"}
        </span>
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete session"
          className="p-0.5 text-neutral-400 hover:text-primary-container bg-white border border-neutral-300 hover:border-primary-container disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[14px]">delete</span>
        </button>
      </div>
    </button>
  );
}
