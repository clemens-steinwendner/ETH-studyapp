"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface HintDrawerProps {
  exerciseId: number;
  enabled: boolean;
}

export function HintDrawer({ exerciseId, enabled }: HintDrawerProps) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!enabled) return null;

  async function fetchHint() {
    if (hint) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/exercises/${exerciseId}/hint`, { method: "POST" });
      const data = await res.json();
      setHint(data.hint ?? "No hint available.");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={fetchHint}
        className="text-sm text-blue-400 hover:text-blue-300 underline"
      >
        {loading ? "Getting hint…" : open ? "Hide hint" : "Show hint"}
      </button>
      {open && hint && (
        <div className="mt-2 p-3 bg-gray-800 rounded border border-gray-700 text-sm prose prose-invert max-w-none">
          <ReactMarkdown>{hint}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
