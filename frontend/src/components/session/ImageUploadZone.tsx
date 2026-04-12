"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface ImageUploadZoneProps {
  onUpload: (file: File) => void;
}

export function ImageUploadZone({ onUpload }: ImageUploadZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) onUpload(acceptedFiles[0]);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? "border-blue-500 bg-blue-950" : "border-gray-600 hover:border-gray-400"}`}
    >
      <input {...getInputProps()} />
      <p className="text-gray-400">
        {isDragActive ? "Drop your proof image here…" : "Drag & drop a handwritten proof image, or click to select"}
      </p>
    </div>
  );
}
