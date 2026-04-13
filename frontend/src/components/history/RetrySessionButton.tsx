"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface RetrySessionButtonProps {
  sourceSessionIds?: number[];
  label?: string;
}

export function RetrySessionButton({
  sourceSessionIds,
  label = "Retry Failed Exercises",
}: RetrySessionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    try {
      const data = await api<{ id: number }>("/api/v1/sessions/retry", {
        method: "POST",
        body: JSON.stringify({ source_session_ids: sourceSessionIds ?? [] }),
      });
      router.push(`/session/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="text-primary-container bg-surface-container-lowest px-3 py-1 text-[10px] font-bold border border-primary-container hover:bg-primary-container hover:text-white transition-all uppercase disabled:opacity-50"
    >
      {loading ? "Creating…" : label}
    </button>
  );
}
