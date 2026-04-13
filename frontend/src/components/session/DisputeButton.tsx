"use client";

import { useState } from "react";

interface DisputeButtonProps {
  sessionId: number;
  exerciseId: number;
  onDisputed: () => void;
}

export function DisputeButton({ sessionId, exerciseId, onDisputed }: DisputeButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDispute() {
    setLoading(true);
    try {
      await fetch(`/api/v1/sessions/${sessionId}/exercises/${exerciseId}/dispute`, {
        method: "PATCH",
      });
      onDisputed();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDispute}
      disabled={loading}
      title="Manual Pass Override (FR-18)"
      className="mt-3 flex items-center gap-2 text-xs text-neutral-500 hover:text-primary-container transition-colors disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">verified</span>
      {loading ? "Applying override…" : "Override: mark as passed"}
    </button>
  );
}
