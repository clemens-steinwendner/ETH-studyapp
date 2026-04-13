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
  { value: "script", label: "Script (Lecture Notes)" },
  { value: "mock_exam", label: "Mock Exam / Past Paper" },
  { value: "other", label: "Other" },
] as const;

interface UploadDropzoneProps {
  onUploadSuccess?: (documentId: number) => void;
}

export function UploadDropzone({ onUploadSuccess }: UploadDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [subject, setSubject] = useState<string>("databases");
  const [fileType, setFileType] = useState<string>("script");

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setMessage(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("subject", subject === "other" ? "" : subject);
        form.append("file_type", fileType);

        const res = await fetch("/api/v1/documents/upload", { method: "POST", body: form });
        if (res.ok) {
          const data = await res.json();
          setMessage({ text: `"${file.name}" uploaded — ingestion started.`, ok: true });
          onUploadSuccess?.(data.document_id);
        } else {
          setMessage({ text: "Upload failed. Check file format.", ok: false });
        }
      } finally {
        setUploading(false);
      }
    },
    [onUploadSuccess, subject, fileType]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

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
        <div className="flex gap-2">
          {FILE_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFileType(value)}
              className={`flex-1 px-2 py-2 text-[9px] font-mono font-bold uppercase transition-colors ${
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
          {uploading ? "Uploading…" : isDragActive ? "Drop PDF here…" : "Drop PDF / Click to Browse"}
        </p>
        <p className="text-[0.65rem] text-neutral-400 mt-1">MAX 250MB · PDF ONLY</p>
      </div>

      {message && (
        <p
          className={`text-xs font-mono px-2 py-1 ${
            message.ok ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
