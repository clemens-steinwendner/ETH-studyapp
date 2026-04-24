"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { UploadDropzone } from "@/components/ingestion/UploadDropzone";
import { IngestionProgress } from "@/components/ingestion/IngestionProgress";
import { useDocuments } from "@/hooks/useDocuments";
import { useBudgetStatus } from "@/hooks/useBudgetStatus";
import type { SubjectTopicList, Topic } from "@/types/topic";
import type { Document } from "@/types/document";

const SUBJECT_ICONS: Record<string, string> = {
  databases: "storage",
  networks: "hub",
  ml: "analytics",
  fmfp: "function",
  probability: "bar_chart",
  default: "description",
};

const SUBJECT_DISPLAY: Record<string, string> = {
  databases: "Databases",
  networks: "Networks",
  ml: "Machine Learning",
  fmfp: "FMFP / Haskell",
  probability: "Probability & Stats",
  other: "Other",
};

const FILE_TYPE_LABEL: Record<string, string> = {
  script: "Script",
  slides: "Slides",
  mock_exam: "Mock Exam",
  other: "Document",
};

const PROCESS_LOGS = [
  { time: "14:20:01", text: "INIT: Vector Store Connection Established", color: "text-emerald-400" },
  { time: "14:20:05", text: "FR-04: DIAGRAM EXTRACTION ACTIVE... (PDF_PARSER_LITE)", color: "text-neutral-100" },
  { time: "14:20:08", text: 'WARN: Low-res figure detected in "Fluid_Dyn_Lec_04.pdf"', color: "text-primary-container font-bold" },
  { time: "14:20:12", text: "Processing chunk 144 of 892... [================>----] 82%", color: "text-neutral-400 italic" },
  { time: "14:20:15", text: "SYNC: Global RAG Context refreshing...", color: "text-neutral-100" },
];

// ── Topic management panel per subject ────────────────────────────────────────

function TopicPanel({
  subject,
  topicList,
  onRegenerate,
  onSave,
  generating,
}: {
  subject: string;
  topicList: SubjectTopicList | null;
  onRegenerate: () => void;
  onSave: (topics: Topic[]) => void;
  generating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editRaw, setEditRaw] = useState("");

  function startEdit() {
    if (!topicList) return;
    setEditRaw(JSON.stringify(topicList.topics, null, 2));
    setEditing(true);
  }

  function saveEdit() {
    try {
      const parsed: Topic[] = JSON.parse(editRaw);
      onSave(parsed);
      setEditing(false);
    } catch {
      alert("Invalid JSON — check your edits.");
    }
  }

  return (
    <div className="mt-2 border border-outline-variant/30 bg-surface-container-lowest">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono font-bold uppercase text-neutral-500 hover:bg-surface-container transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">list_alt</span>
          {topicList ? `Topics · ${topicList.topics.length} topics` : "No topics yet"}
        </span>
        <div className="flex items-center gap-2">
          {topicList && (
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px]">READY</span>
          )}
          <span className="material-symbols-outlined text-sm">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {topicList && !editing && (
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {topicList.topics.map((t, i) => (
                <div key={i}>
                  <p className="text-[10px] font-mono font-bold text-on-surface">{t.title}</p>
                  {t.subtopics.length > 0 && (
                    <p className="text-[10px] text-neutral-400 ml-2">
                      {t.subtopics.join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {editing && (
            <div className="mb-3">
              <textarea
                value={editRaw}
                onChange={(e) => setEditRaw(e.target.value)}
                className="w-full h-48 text-[10px] font-mono bg-surface-container-high border border-outline-variant p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary-container"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onRegenerate}
              disabled={generating}
              className="flex items-center gap-1 px-2 py-1.5 bg-surface-container text-[9px] font-mono font-bold uppercase text-neutral-600 hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">
                {generating ? "hourglass_empty" : "refresh"}
              </span>
              {topicList ? "Regenerate" : "Generate"}
            </button>
            {topicList && !editing && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1 px-2 py-1.5 bg-surface-container text-[9px] font-mono font-bold uppercase text-neutral-600 hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1 px-2 py-1.5 bg-primary-container text-white text-[9px] font-mono font-bold uppercase transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 px-2 py-1.5 bg-surface-container text-[9px] font-mono font-bold uppercase text-neutral-600 hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: documents, isLoading } = useDocuments();
  const { data: budget } = useBudgetStatus();
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [topicLists, setTopicLists] = useState<Record<string, SubjectTopicList | null>>({});
  const [generatingTopics, setGeneratingTopics] = useState<Record<string, boolean>>({});
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editFileType, setEditFileType] = useState("");
  const [localDocs, setLocalDocs] = useState<Document[] | null>(null);

  const budgetPct = budget ? Math.round((budget.spent_usd / budget.limit_usd) * 100) : 0;
  const budgetRemaining = budget ? (budget.limit_usd - budget.spent_usd).toFixed(2) : "—";
  const budgetSpent = budget ? budget.spent_usd.toFixed(2) : "—";

  const allDocs = localDocs ?? documents ?? [];
  const ingestedDocs = allDocs.filter((d) => d.ingested);

  // Derive unique subjects from actual document data
  const subjects = Array.from(
    new Set(allDocs.map((d) => d.subject ?? "other"))
  ).sort();

  // Fetch topic lists for all subjects with script or slides documents
  useEffect(() => {
    const subjectsWithScripts = Array.from(
      new Set(
        ingestedDocs
          .filter((d) => (d.file_type === "script" || d.file_type === "slides") && d.subject)
          .map((d) => d.subject as string)
      )
    );
    subjectsWithScripts.forEach(async (subject) => {
      if (subject in topicLists) return; // already loaded or loading
      try {
        const res = await fetch(`/api/v1/topics/${subject}`);
        if (res.ok) {
          const data: SubjectTopicList = await res.json();
          setTopicLists((prev) => ({ ...prev, [subject]: data }));
        } else {
          setTopicLists((prev) => ({ ...prev, [subject]: null }));
        }
      } catch {
        setTopicLists((prev) => ({ ...prev, [subject]: null }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestedDocs.length]);

  // Sync localDocs from fetched documents
  useEffect(() => {
    if (documents) setLocalDocs(documents);
  }, [documents]);

  function handleUploadSuccess(documentId: number) {
    setPendingIds((prev) => [...prev, documentId]);
  }

  async function handleDeleteDoc(id: number) {
    setDeletingDocId(id);
    try {
      const res = await fetch(`/api/v1/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLocalDocs((prev) => (prev ?? documents ?? []).filter((d) => d.id !== id));
      }
    } finally {
      setDeletingDocId(null);
    }
  }

  async function handleSaveEdit() {
    if (!editingDoc) return;
    const body: Record<string, string> = {};
    if (editSubject) body.subject = editSubject;
    if (editFileType) body.file_type = editFileType;
    const res = await fetch(`/api/v1/documents/${editingDoc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated: Document = await res.json();
      setLocalDocs((prev) => (prev ?? documents ?? []).map((d) => (d.id === updated.id ? updated : d)));
    }
    setEditingDoc(null);
  }

  async function regenerateTopics(subject: string) {
    setGeneratingTopics((prev) => ({ ...prev, [subject]: true }));
    try {
      const res = await fetch(`/api/v1/topics/${subject}/generate`, { method: "POST" });
      if (res.ok) {
        const data: SubjectTopicList = await res.json();
        setTopicLists((prev) => ({ ...prev, [subject]: data }));
      }
    } finally {
      setGeneratingTopics((prev) => ({ ...prev, [subject]: false }));
    }
  }

  async function saveTopics(subject: string, topics: Topic[]) {
    const res = await fetch(`/api/v1/topics/${subject}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics }),
    });
    if (res.ok) {
      const data: SubjectTopicList = await res.json();
      setTopicLists((prev) => ({ ...prev, [subject]: data }));
    }
  }

  // Group documents by subject, then by file_type
  const grouped: Record<string, Record<string, Document[]>> = {};
  for (const doc of allDocs) {
    const subj = doc.subject ?? "other";
    const ft = doc.file_type ?? "other";
    if (!grouped[subj]) grouped[subj] = {};
    if (!grouped[subj][ft]) grouped[subj][ft] = [];
    grouped[subj][ft].push(doc);
  }

  return (
    <div className="ml-64 min-h-screen pb-16">
      <TopNav
        subtitle="Library"
        budgetPct={budgetPct}
        extra={
          <div className="relative">
            <input
              className="bg-surface-container-high border-none text-[10px] font-mono px-4 py-1.5 w-52 focus:ring-1 focus:ring-primary-container transition-all"
              placeholder="QUERY DATABASE..."
              type="text"
            />
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
              search
            </span>
          </div>
        }
      />

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Quick Ingestion */}
          <section className="col-span-12 lg:col-span-4 flex flex-col">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary-container inline-block" />
              Quick Ingestion
            </h2>
            <div className="bg-surface-container-low p-4">
              <UploadDropzone onUploadSuccess={handleUploadSuccess} />
            </div>

            {/* Pending ingestions */}
            {pendingIds.length > 0 && (
              <div className="mt-3 space-y-2">
                {pendingIds
                  .filter((id) => !documents?.find((d) => d.id === id && d.ingested))
                  .map((id) => (
                    <div key={id} className="bg-surface-container p-3 text-xs font-mono">
                      <p className="text-neutral-500 mb-1">Document #{id}</p>
                      <IngestionProgress documentId={id} />
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Budget Meter */}
          <section className="col-span-12 lg:col-span-8">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500 mb-3">
              API Budget Allocation
            </h2>
            <div className="bg-surface-container-lowest p-6 border-b-2 border-outline-variant/30 flex items-center justify-between">
              <div className="space-y-4 flex-1 mr-8">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-3xl font-black text-on-surface">${budgetSpent}</span>
                    <span className="text-xs font-mono text-neutral-400 ml-1">
                      / ${budget?.limit_usd.toFixed(2) ?? "8.00"} TOTAL
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 ${
                    budgetPct >= 100
                      ? "bg-red-100 text-red-700"
                      : budgetPct >= 80
                      ? "bg-orange-100 text-orange-700"
                      : "bg-primary-container/10 text-primary-container"
                  }`}>
                    {budgetPct >= 100 ? "EXCEEDED" : budgetPct >= 80 ? "WARNING" : "OPTIMIZED"}
                  </span>
                </div>
                <div className="grid grid-cols-10 gap-1 h-3">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const threshold = (i + 1) * 10;
                    return (
                      <div
                        key={i}
                        className={`col-span-1 ${
                          threshold <= budgetPct
                            ? "bg-primary-container"
                            : threshold === Math.ceil(budgetPct / 10) * 10 && budgetPct % 10 !== 0
                            ? "bg-primary-container/40"
                            : "bg-surface-container-high"
                        }`}
                      />
                    );
                  })}
                </div>
                <p className="text-[10px] font-mono text-neutral-400">
                  ${budgetRemaining} remaining this month
                </p>
              </div>
              <Link href="/budget">
                <button className="bg-primary-container text-white px-6 py-3 font-mono text-xs font-bold hover:bg-primary transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">bar_chart</span>
                  VIEW BREAKDOWN
                </button>
              </Link>
            </div>
          </section>
        </div>

        {/* Document Library — grouped by subject → file_type */}
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary-container inline-block" />
              Document Library
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono text-neutral-400">
                {ingestedDocs.length} DOCUMENTS INDEXED
              </span>
              <Link
                href="/session/new"
                className="text-[10px] font-mono font-bold text-primary-container hover:underline uppercase"
              >
                START NEW SESSION →
              </Link>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-neutral-100 rounded w-32 mb-3" />
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2].map((j) => (
                      <div key={j} className="bg-white p-4 border-l-2 border-neutral-200">
                        <div className="h-4 bg-neutral-100 rounded mb-2 w-3/4" />
                        <div className="h-3 bg-neutral-100 rounded w-full mb-1" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && allDocs.length === 0 && (
            <div className="text-center py-12 text-neutral-400 border-2 border-dashed border-neutral-200">
              <span className="material-symbols-outlined text-4xl mb-3 block text-neutral-300">
                folder_open
              </span>
              <p className="font-mono text-xs uppercase tracking-wider">No documents yet</p>
              <p className="text-sm mt-1">Upload a PDF to get started</p>
            </div>
          )}

          {/* Subject groups */}
          <div className="space-y-8">
            {Object.entries(grouped).map(([subject, byType]) => {
              const icon = SUBJECT_ICONS[subject] ?? "description";
              const displayName = SUBJECT_DISPLAY[subject] ?? subject.toUpperCase();
              const hasScripts = !!(byType["script"]?.some((d) => d.ingested) || byType["slides"]?.some((d) => d.ingested));

              return (
                <div key={subject}>
                  {/* Subject header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="material-symbols-outlined text-primary-container text-sm">{icon}</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
                      {displayName}
                    </span>
                    <div className="h-px flex-1 bg-outline-variant/30" />
                    <span className="text-[10px] font-mono text-neutral-400">
                      {Object.values(byType).flat().length} file(s)
                    </span>
                  </div>

                  {/* File type sub-groups */}
                  <div className="space-y-4">
                    {(["script", "slides", "mock_exam", "other"] as const)
                      .filter((ft) => byType[ft]?.length)
                      .map((ft) => (
                        <div key={ft}>
                          <p className="text-[10px] font-mono font-bold uppercase text-neutral-400 mb-2 pl-1 border-l-2 border-outline-variant/50">
                            {FILE_TYPE_LABEL[ft]}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {byType[ft].map((doc) => {
                              const isActive = pendingIds.includes(doc.id) && !doc.ingested;
                              return (
                                <div
                                  key={doc.id}
                                  className={`bg-white p-4 group hover:bg-surface-container-low transition-colors border-l-2 ${
                                    doc.ingested ? "border-primary-container" : "border-neutral-300"
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                                      ft === "script"
                                        ? "bg-blue-50 text-blue-600"
                                        : ft === "slides"
                                        ? "bg-indigo-50 text-indigo-600"
                                        : ft === "mock_exam"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-neutral-100 text-neutral-500"
                                    }`}>
                                      {FILE_TYPE_LABEL[ft].toUpperCase()}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          setEditingDoc(doc);
                                          setEditSubject(doc.subject ?? "other");
                                          setEditFileType(doc.file_type ?? "other");
                                        }}
                                        className="text-neutral-300 hover:text-primary-container transition-colors"
                                        title="Edit metadata"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">edit</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteDoc(doc.id)}
                                        disabled={deletingDocId === doc.id}
                                        className="text-neutral-300 hover:text-primary-container transition-colors disabled:opacity-40"
                                        title="Delete document"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                      </button>
                                    </div>
                                  </div>
                                  <h3 className="font-bold text-sm mb-1 line-clamp-1 text-on-surface">
                                    {doc.filename}
                                  </h3>
                                  {doc.chapters.length > 0 ? (
                                    <p className="text-[10px] text-neutral-500 mb-3 line-clamp-2 leading-relaxed">
                                      {doc.chapters.map((ch) => ch.title).join(" · ")}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-neutral-500 mb-3 leading-relaxed italic">
                                      {doc.ingested ? "Document indexed" : "Processing…"}
                                    </p>
                                  )}
                                  {isActive && (
                                    <div className="mb-2">
                                      <IngestionProgress documentId={doc.id} />
                                    </div>
                                  )}
                                  {!doc.ingested && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-mono font-bold">
                                      PROCESSING
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Topic management for this subject (only if script docs exist) */}
                  {hasScripts && (
                    <TopicPanel
                      subject={subject}
                      topicList={topicLists[subject] ?? null}
                      onRegenerate={() => regenerateTopics(subject)}
                      onSave={(topics) => saveTopics(subject, topics)}
                      generating={generatingTopics[subject] ?? false}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Live Process Logs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500">
              Live Process Logs
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase">
                System Nominal
              </span>
            </div>
          </div>
          <div className="bg-inverse-surface rounded-lg p-5 font-mono text-xs text-neutral-300 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-4 border-b border-neutral-700 pb-2 mb-4">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
              <span className="text-[10px] text-neutral-500">INGESTION_THREAD_04 // ACTIVE</span>
            </div>
            <div className="space-y-1.5">
              {PROCESS_LOGS.map((log, i) => (
                <div key={i} className={`flex gap-4 ${i === PROCESS_LOGS.length - 1 ? "animate-pulse" : ""}`}>
                  <span className="text-neutral-500 shrink-0">[{log.time}]</span>
                  <span className={log.color}>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Edit document modal */}
      {editingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-on-surface">
              Edit Document Metadata
            </h3>
            <p className="text-xs font-mono text-neutral-500 mb-4 truncate">{editingDoc.filename}</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                  Subject
                </label>
                <select
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full border border-outline-variant p-2 text-sm bg-white font-mono focus:outline-none focus:border-primary-container"
                >
                  {["databases", "networks", "ml", "fmfp", "probability", "other"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                  File Type
                </label>
                <select
                  value={editFileType}
                  onChange={(e) => setEditFileType(e.target.value)}
                  className="w-full border border-outline-variant p-2 text-sm bg-white font-mono focus:outline-none focus:border-primary-container"
                >
                  <option value="script">Script</option>
                  <option value="slides">Slides</option>
                  <option value="mock_exam">Mock Exam</option>
                  <option value="other">Document</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-primary-container text-white py-2 text-xs font-bold uppercase hover:opacity-90"
              >
                Save
              </button>
              <button
                onClick={() => setEditingDoc(null)}
                className="flex-1 border border-outline-variant py-2 text-xs font-mono text-neutral-500 hover:border-neutral-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
