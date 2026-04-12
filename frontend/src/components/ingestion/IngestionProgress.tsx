"use client";

import { useIngestionStatus } from "@/hooks/useIngestionStatus";

interface IngestionProgressProps {
  documentId: number;
}

export function IngestionProgress({ documentId }: IngestionProgressProps) {
  const { ingested } = useIngestionStatus(documentId);

  return (
    <p className="text-sm text-gray-400">
      {ingested ? "Ingestion complete." : "Processing PDF… this may take up to 60 seconds."}
    </p>
  );
}
