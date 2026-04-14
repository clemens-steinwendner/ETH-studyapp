"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface HintDrawerProps {
  exerciseId: number;
  enabled: boolean;
  preloadedHint?: string | null;
}

export function HintDrawer({ exerciseId, enabled, preloadedHint }: HintDrawerProps) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(preloadedHint ?? null);
  const [loading, setLoading] = useState(false);

  if (!enabled) return null;

  async function fetchHint() {
    if (hint) {
      setOpen((o) => !o);
      return;
    }
    // Fallback: fetch from API if hint was not pre-generated
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
    <div className="bg-white p-5 border border-outline-variant/30">
      <button
        onClick={fetchHint}
        disabled={loading}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-container">lightbulb</span>
          <span className="font-bold text-sm tracking-tight text-on-surface">
            {loading ? "Fetching hint…" : "AI Hint"}
          </span>
        </div>
        <span
          className={`material-symbols-outlined transition-transform text-neutral-400 ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {open && hint && (
        <div className="mt-4 pt-4 border-t border-surface-container text-xs text-on-surface-variant leading-normal prose prose-sm max-w-none
          prose-code:font-mono prose-code:bg-surface-container prose-code:px-1">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {hint}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
