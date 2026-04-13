"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface UploadDropzoneProps {
  onUploadSuccess?: (documentId: number) => void;
}

export function UploadDropzone({ onUploadSuccess }: UploadDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setMessage(null);
      try {
        const form = new FormData();
        form.append("file", file);
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
    [onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="h-full flex flex-col gap-2">
      <div
        {...getRootProps()}
        className={`flex-1 border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer group transition-colors ${
          isDragActive
            ? "border-primary-container bg-primary-fixed/20"
            : "border-outline-variant bg-surface-container hover:bg-surface-container-high"
        } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-4 text-primary-container group-hover:scale-110 transition-transform shadow-sm">
          <span className="material-symbols-outlined text-3xl">upload_file</span>
        </div>
        <p className="font-mono text-[10px] uppercase font-bold text-neutral-600">
          {uploading ? "Uploading…" : isDragActive ? "Drop PDF here…" : "Drop PDF / LaTeX Archives"}
        </p>
        <p className="text-[0.7rem] text-neutral-400 mt-1">MAX 250MB PER BATCH</p>
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
