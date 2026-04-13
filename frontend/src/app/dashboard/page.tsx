"use client";

import Link from "next/link";
import { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { UploadDropzone } from "@/components/ingestion/UploadDropzone";
import { IngestionProgress } from "@/components/ingestion/IngestionProgress";
import { useDocuments } from "@/hooks/useDocuments";
import { useBudgetStatus } from "@/hooks/useBudgetStatus";

const SUBJECT_ICONS: Record<string, string> = {
  databases: "storage",
  networks: "hub",
  ml: "analytics",
  fmfp: "function",
  probability: "bar_chart",
  default: "description",
};

const SUBJECT_TAGS: Record<string, string[]> = {
  databases: ["DATABASES", "FORMAL"],
  networks: ["NETWORKS", "SYSTEMS"],
  ml: ["ML", "OPTIMIZATION"],
  fmfp: ["FMFP", "HASKELL"],
  probability: ["PROBABILITY", "STATS"],
};

const PROCESS_LOGS = [
  { time: "14:20:01", text: "INIT: Vector Store Connection Established", color: "text-emerald-400" },
  { time: "14:20:05", text: "FR-04: DIAGRAM EXTRACTION ACTIVE... (PDF_PARSER_LITE)", color: "text-neutral-100" },
  { time: "14:20:08", text: 'WARN: Low-res figure detected in "Fluid_Dyn_Lec_04.pdf"', color: "text-primary-container font-bold" },
  { time: "14:20:12", text: "Processing chunk 144 of 892... [================>----] 82%", color: "text-neutral-400 italic" },
  { time: "14:20:15", text: "SYNC: Global RAG Context refreshing...", color: "text-neutral-100" },
];

function guessSubject(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("sql") || lower.includes("database") || lower.includes("db")) return "databases";
  if (lower.includes("network") || lower.includes("tcp") || lower.includes("ip")) return "networks";
  if (lower.includes("ml") || lower.includes("machine") || lower.includes("learning")) return "ml";
  if (lower.includes("fmfp") || lower.includes("haskell") || lower.includes("functional")) return "fmfp";
  if (lower.includes("prob") || lower.includes("stat") || lower.includes("stoch")) return "probability";
  return "default";
}

export default function DashboardPage() {
  const { data: documents, isLoading } = useDocuments();
  const { data: budget } = useBudgetStatus();
  const [pendingIds, setPendingIds] = useState<number[]>([]);

  const budgetPct = budget
    ? Math.round((budget.spent_usd / budget.limit_usd) * 100)
    : 0;
  const budgetRemaining = budget
    ? (budget.limit_usd - budget.spent_usd).toFixed(2)
    : "—";
  const budgetSpent = budget ? budget.spent_usd.toFixed(2) : "—";

  function handleUploadSuccess(documentId: number) {
    setPendingIds((prev) => [...prev, documentId]);
  }

  const allDocs = documents ?? [];
  const ingestedDocs = allDocs.filter((d) => d.ingested);

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
            <div className="flex-1">
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
                {/* Segmented budget bar */}
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

        {/* Recent Documents */}
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary-container inline-block" />
              Recent Document Vectors
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-4 border-l-2 border-neutral-200 animate-pulse">
                  <div className="h-4 bg-neutral-100 rounded mb-2 w-3/4" />
                  <div className="h-3 bg-neutral-100 rounded w-full mb-1" />
                  <div className="h-3 bg-neutral-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && allDocs.length === 0 && (
            <div className="text-center py-12 text-neutral-400 border-2 border-dashed border-neutral-200">
              <span className="material-symbols-outlined text-4xl mb-3 block text-neutral-300">
                folder_open
              </span>
              <p className="font-mono text-xs uppercase tracking-wider">
                No documents indexed yet
              </p>
              <p className="text-sm mt-1">Upload a PDF to get started</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {allDocs.map((doc) => {
              const subject = guessSubject(doc.filename);
              const icon = SUBJECT_ICONS[subject] ?? "description";
              const tags = SUBJECT_TAGS[subject] ?? ["DOCUMENT"];
              const isActive = pendingIds.includes(doc.id) && !doc.ingested;

              return (
                <div
                  key={doc.id}
                  className={`bg-white p-4 group hover:bg-surface-container-low transition-colors border-l-2 ${
                    doc.ingested ? "border-primary-container" : "border-neutral-300"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`material-symbols-outlined text-neutral-400 group-hover:text-primary-container transition-colors`}>
                      {icon}
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400">
                      ID: {doc.id}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm mb-1 line-clamp-1 text-on-surface">
                    {doc.filename}
                  </h3>
                  {doc.chapters.length > 0 ? (
                    <p className="text-[10px] text-neutral-500 mb-4 line-clamp-2 leading-relaxed">
                      {doc.chapters.map((ch) => ch.title).join(" · ")}
                    </p>
                  ) : (
                    <p className="text-[10px] text-neutral-500 mb-4 leading-relaxed italic">
                      {doc.ingested ? "Document indexed" : "Processing…"}
                    </p>
                  )}
                  {isActive && (
                    <div className="mb-2">
                      <IngestionProgress documentId={doc.id} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-surface-container text-[9px] font-mono font-bold"
                      >
                        {tag}
                      </span>
                    ))}
                    {!doc.ingested && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-mono font-bold">
                        PROCESSING
                      </span>
                    )}
                  </div>
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
              <span className="text-[10px] text-neutral-500">
                INGESTION_THREAD_04 // ACTIVE
              </span>
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
    </div>
  );
}
