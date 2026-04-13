"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Document } from "@/types/document";

export function useIngestionStatus(documentId: number, intervalMs = 5_000) {
  const [ingested, setIngested] = useState(false);

  useEffect(() => {
    if (ingested) return;
    const id = setInterval(async () => {
      try {
        const docs = await api<{ documents: Document[] }>("/api/v1/documents/");
        const doc = docs.documents.find((d) => d.id === documentId);
        if (doc?.ingested) {
          setIngested(true);
          clearInterval(id);
        }
      } catch {}
    }, intervalMs);
    return () => clearInterval(id);
  }, [documentId, ingested, intervalMs]);

  return { ingested };
}
