"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ImageUploadZoneProps {
  onUpload: (file: File) => void;
}

export function ImageUploadZone({ onUpload }: ImageUploadZoneProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      onUpload(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".pdf"] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer group transition-all ${
        isDragActive
          ? "border-primary-container bg-primary-fixed/20"
          : "border-outline-variant bg-surface-container-low hover:bg-surface-container"
      }`}
    >
      <input {...getInputProps()} />

      {preview ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Proof preview"
            className="max-h-40 max-w-full object-contain mx-auto"
          />
          <p className="text-[10px] font-mono text-neutral-500 uppercase">
            Click or drag to replace
          </p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 bg-primary-container/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-primary-container">upload_file</span>
          </div>
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-tight">
            Upload Handwritten Solution
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {isDragActive
              ? "Drop your image here…"
              : "Drag and drop images or click to browse (PDF, PNG, JPG)"}
          </p>
          <button
            type="button"
            className="mt-4 px-4 py-2 bg-primary-container text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            Select File
          </button>
        </>
      )}
    </div>
  );
}
