"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Document } from "@/types/document";

export function useDocuments() {
  const [data, setData] = useState<Document[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api<{ documents: Document[] }>("/api/v1/documents/")
      .then((res) => setData(res.documents))
      .catch(() => setData([]))
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading };
}
