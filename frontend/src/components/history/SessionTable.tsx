"use client";

import Link from "next/link";
import type { Session } from "@/types/session";

interface SessionWithStats extends Session {
  pass_count?: number;
  fail_count?: number;
}

interface SessionTableProps {
  sessions: SessionWithStats[];
  onSelect?: (session: SessionWithStats) => void;
  selected?: number;
}

export function SessionTable({ sessions, onSelect, selected }: SessionTableProps) {
  return (
    <div className="space-y-px">
      {sessions.map((s, idx) => {
        const rate =
          s.pass_count !== undefined && s.fail_count !== undefined
            ? Math.round((s.pass_count / Math.max(1, s.pass_count + s.fail_count)) * 100)
            : null;
        const passed = rate !== null && rate >= 60;
        const isSelected = selected === s.id;

        return (
          <div
            key={s.id}
            onClick={() => onSelect?.(s)}
            className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${
              isSelected
                ? "bg-surface border-l-4 border-primary-container"
                : passed
                ? "bg-surface-container-lowest border-l-4 border-emerald-600 hover:bg-surface-container"
                : "bg-surface-container-lowest border-l-4 border-primary-container hover:bg-surface-container"
            }`}
          >
            <div>
              <p className="text-[11px] font-mono text-neutral-400">
                #{String(idx + 1).padStart(2, "0")}_{s.difficulty.toUpperCase()}
              </p>
              <p className="text-xs font-bold mt-0.5 text-on-surface">
                {new Date(s.created_at).toLocaleDateString()} · {s.num_questions} questions
              </p>
            </div>
            <div className="flex items-center gap-2">
              {rate !== null && (
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${
                    rate >= 60
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {rate >= 60 ? "PASS" : "FAIL"} {rate}%
                </span>
              )}
              <Link
                href={`/session/${s.id}`}
                className="text-[9px] font-mono text-primary-container hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                VIEW →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
