"use client";

import { useRouter } from "next/navigation";

interface RetrySessionButtonProps {
  sourceSessionIds?: number[];
}

export function RetrySessionButton({ sourceSessionIds }: RetrySessionButtonProps) {
  const router = useRouter();

  async function handleRetry() {
    const res = await fetch("/api/v1/sessions/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_session_ids: sourceSessionIds ?? [] }),
    });
    const data = await res.json();
    router.push(`/session/${data.id}`);
  }

  return (
    <button
      onClick={handleRetry}
      className="px-4 py-2 bg-orange-700 hover:bg-orange-600 rounded text-sm font-medium"
    >
      Retry Failed Exercises
    </button>
  );
}
