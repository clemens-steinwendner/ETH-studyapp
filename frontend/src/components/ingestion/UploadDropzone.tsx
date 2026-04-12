"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export function UploadDropzone() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/documents/upload", { method: "POST", body: form });
      if (res.ok) {
        setMessage(`"${file.name}" uploaded. Ingestion started…`);
      } else {
        setMessage("Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-blue-500 bg-blue-950" : "border-gray-600 hover:border-gray-400"}
          ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-400">
          {uploading ? "Uploading…" : isDragActive ? "Drop PDF here…" : "Drag & drop a PDF, or click to select"}
        </p>
      </div>
      {message && <p className="mt-2 text-sm text-gray-400">{message}</p>}
    </div>
  );
}
