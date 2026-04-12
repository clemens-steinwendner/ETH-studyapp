"use client";

import { useDocuments } from "@/hooks/useDocuments";
import type { Document } from "@/types/document";

interface DocumentSelectorProps {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function DocumentSelector({ selected, onChange }: DocumentSelectorProps) {
  const { data: documents, isLoading } = useDocuments();

  if (isLoading) return <p className="text-gray-400">Loading documents…</p>;
  if (!documents?.length) return <p className="text-gray-400">No documents ingested yet. Upload a PDF to get started.</p>;

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-300">Select Documents</h3>
      {documents.map((doc: Document) => (
        <label key={doc.id} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(doc.id)}
            onChange={() => toggle(doc.id)}
            className="rounded"
          />
          <span>{doc.filename}</span>
          {!doc.ingested && <span className="text-xs text-yellow-500">(processing…)</span>}
        </label>
      ))}
    </div>
  );
}
