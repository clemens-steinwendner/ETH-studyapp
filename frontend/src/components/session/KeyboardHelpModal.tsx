"use client";

import { useEffect } from "react";

interface KeyboardHelpModalProps {
  open: boolean;
  onClose: () => void;
  examMode: boolean;
}

interface Row {
  combo: string;
  desc: string;
}

const NAV_ROWS: Row[] = [
  { combo: "J / →", desc: "Next question (after grading)" },
  { combo: "K / ←", desc: "Previous question" },
  { combo: "?", desc: "Show this help overlay" },
  { combo: "Esc", desc: "Close overlay / close PDF pane" },
];

const EDITOR_ROWS: Row[] = [
  { combo: "⌘/Ctrl + Enter", desc: "Run code (coding) or submit (other)" },
  { combo: "⌘/Ctrl + Shift + Enter", desc: "Submit (coding)" },
];

const VIEW_ROWS: Row[] = [
  { combo: "H", desc: "Toggle hint" },
];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="mb-5 last:mb-0">
      <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 mb-2">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.combo} className="flex items-center justify-between text-xs text-neutral-700">
            <span>{r.desc}</span>
            <kbd className="font-mono text-[10px] px-2 py-0.5 bg-surface-container-high border border-outline-variant/40 rounded">
              {r.combo}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KeyboardHelpModal({ open, onClose, examMode }: KeyboardHelpModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Filter out hint shortcut in exam mode (hints are disabled there)
  const viewRows = examMode ? [] : VIEW_ROWS;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-sm uppercase tracking-wider text-on-surface">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="Close help"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <Section title="Editor" rows={EDITOR_ROWS} />
        <Section title="Navigation" rows={NAV_ROWS} />
        {viewRows.length > 0 && <Section title="View" rows={viewRows} />}

        <p className="mt-5 pt-4 border-t border-outline-variant/30 text-[10px] font-mono text-neutral-400">
          Shortcuts are ignored while you&apos;re typing in an input or the code editor — focus the
          page (Esc out of the editor) to use them.
        </p>
      </div>
    </div>
  );
}
