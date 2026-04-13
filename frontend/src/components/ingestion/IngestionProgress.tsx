"use client";

import { useIngestionStatus } from "@/hooks/useIngestionStatus";

interface IngestionProgressProps {
  documentId: number;
}

export function IngestionProgress({ documentId }: IngestionProgressProps) {
  const { ingested } = useIngestionStatus(documentId);

  return (
    <div className="flex items-center gap-2">
      {ingested ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-mono text-emerald-600 uppercase">Ingestion complete</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
          <span className="text-[10px] font-mono text-neutral-500 uppercase">
            Processing… may take up to 60s
          </span>
        </>
      )}
    </div>
  );
}
