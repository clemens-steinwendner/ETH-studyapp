"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BudgetStatus } from "@/types/budget";

export function useBudgetStatus(intervalMs = 30_000) {
  const [data, setData] = useState<BudgetStatus | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const result = await api<BudgetStatus>("/api/v1/budget/status");
        setData(result);
      } catch {}
    }
    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { data };
}
