"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

const SUBJECTS = ["databases", "networks", "ml", "fmfp", "probability", "other"];

const SUBJECT_LABELS: Record<string, string> = {
  databases: "Databases",
  networks: "Networks",
  ml: "Machine Learning",
  fmfp: "FMFP / Haskell",
  probability: "Probability & Stats",
  other: "Other",
};

const FILE_TYPES = [
  { value: "script", label: "Script" },
  { value: "slides", label: "Slides" },
  { value: "mock_exam", label: "Mock Exam" },
  { value: "other", label: "Other" },
] as const;

type UploadStatus = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  file: File;
  status: UploadStatus;
  documentId?: number;
  error?: string;
}

interface UploadDropzoneProps {
  onUploadSuccess?: (documentId: number) => void;
}

export function UploadDropzone({ onUploadSuccess }: UploadDropzoneProps) {
  const [subject, setSubject] = useState<string>("databases");
  const [fileType, setFileType] = useState<string>("slides");
  const [queue, setQueue] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  function updateEntry(index: number, patch: Partial<FileEntry>) {
    setQueue((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  async function uploadFile(entry: FileEntry, index: number): Promise<void> {
    updateEntry(index, { status: "uploading" });
    try {
      const form = new FormData();
      form.append("file", entry.file);
      form.append("subject", subject === "other" ? "" : subject);
      form.append("file_type", fileType);

      const res = await fetch("/api/v1/documents/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        updateEntry(index, { status: "done", documentId: data.document_id });
        onUploadSuccess?.(data.document_id);
      } else {
        updateEntry(index, { status: "error", error: `HTTP ${res.status}` });
      }
    } catch (e) {
      updateEntry(index, { status: "error", error: "Network error" });
    }
  }

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const entries: FileEntry[] = files.map((f) => ({ file: f, status: "pending" }));
      setQueue((prev) => [...prev, ...entries]);
      setUploading(true);

      // Determine start index in the queue (previous items + any new ones)
      const startIdx = queue.length;
      // Upload in parallel (each is a lightweight HTTP post to localhost)
      await Promise.all(entries.map((entry, i) => uploadFile(entry, startIdx + i)));
      setUploading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subject, fileType, queue.length, onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    disabled: uploading,
  });

  const pendingCount = queue.filter((e) => e.status === "pending" || e.status === "uploading").length;
  const doneCount = queue.filter((e) => e.status === "done").length;
  const errorCount = queue.filter((e) => e.status === "error").length;

  return (
    <div className="flex flex-col gap-3">
      {/* Subject selector */}
      <div>
        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 mb-1.5">
          Subject
        </label>
        <div className="grid grid-cols-3 gap-1">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={`px-2 py-1.5 text-[9px] font-mono font-bold uppercase transition-colors ${
                subject === s
                  ? "bg-primary-container text-white"
                  : "bg-surface-container text-neutral-500 hover:bg-surface-container-high"
              }`}
            >
              {SUBJECT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* File type selector */}
      <div>
        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 mb-1.5">
          File Type
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {FILE_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFileType(value)}
              className={`px-2 py-2 text-[9px] font-mono font-bold uppercase transition-colors ${
                fileType === value
                  ? "bg-primary-container text-white"
                  : "bg-surface-container text-neutral-500 hover:bg-surface-container-high"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-6 flex flex-col items-center justify-center text-center cursor-pointer group transition-colors ${
          isDragActive
            ? "border-primary-container bg-primary-fixed/20"
            : "border-outline-variant bg-surface-container hover:bg-surface-container-high"
        } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-3 text-primary-container group-hover:scale-110 transition-transform shadow-sm">
          <span className="material-symbols-outlined text-2xl">upload_file</span>
        </div>
        <p className="font-mono text-[10px] uppercase font-bold text-neutral-600">
          {uploading
            ? `Uploading ${pendingCount} file${pendingCount !== 1 ? "s" : ""}…`
            : isDragActive
            ? "Drop PDFs here…"
            : "Drop PDFs / Click to Browse"}
        </p>
        <p className="text-[0.65rem] text-neutral-400 mt-1">
          Multiple files · PDF only · Max 250 MB each
        </p>
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {/* Summary row */}
          {queue.length > 1 && (
            <div className="flex items-center justify-between px-2 py-1 bg-surface-container-highest text-[9px] font-mono text-neutral-500">
              <span>{queue.length} FILE{queue.length !== 1 ? "S" : ""}</span>
              <span className="flex gap-2">
                {doneCount > 0 && <span className="text-emerald-600">{doneCount} DONE</span>}
                {pendingCount > 0 && <span className="text-blue-500">{pendingCount} ACTIVE</span>}
                {errorCount > 0 && <span className="text-red-600">{errorCount} ERR</span>}
              </span>
            </div>
          )}
          {queue.map((entry, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono ${
                entry.status === "done"
                  ? "bg-emerald-50"
                  : entry.status === "error"
                  ? "bg-red-50"
                  : entry.status === "uploading"
                  ? "bg-blue-50"
                  : "bg-neutral-50"
              }`}
            >
              <span className="material-symbols-outlined text-[14px] shrink-0"
                style={entry.status === "uploading" ? { animation: "spin 1s linear infinite" } : undefined}>
                {entry.status === "done"
                  ? "check_circle"
                  : entry.status === "error"
                  ? "error"
                  : entry.status === "uploading"
                  ? "hourglass_empty"
                  : "schedule"}
              </span>
              <span className="flex-1 truncate text-neutral-700">{entry.file.name}</span>
              <span className={`shrink-0 font-bold uppercase text-[9px] ${
                entry.status === "done"
                  ? "text-emerald-600"
                  : entry.status === "error"
                  ? "text-red-600"
                  : entry.status === "uploading"
                  ? "text-blue-600"
                  : "text-neutral-400"
              }`}>
                {entry.status === "error" ? entry.error : entry.status}
              </span>
            </div>
          ))}
          {/* Clear done button */}
          {doneCount > 0 && !uploading && (
            <button
              onClick={() => setQueue((q) => q.filter((e) => e.status !== "done"))}
              className="w-full text-[9px] font-mono text-neutral-400 hover:text-neutral-600 py-1 transition-colors"
            >
              CLEAR COMPLETED
            </button>
          )}
        </div>
      )}
    </div>
  );
}
