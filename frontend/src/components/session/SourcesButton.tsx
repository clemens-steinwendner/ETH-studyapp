"use client";

import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import type { SourceRef } from "@/types/exercise";
import type { Document } from "@/types/document";

interface SourcesButtonProps {
  sources: SourceRef[];
  documents: Document[] | null | undefined;
}

function chapterTitle(docs: Document[] | null | undefined, src: SourceRef): string {
  if (!docs) return src.chapter_title ?? `doc ${src.document_id}`;
  const doc = docs.find((d) => d.id === src.document_id);
  if (!doc) return src.chapter_title ?? `doc ${src.document_id}`;
  if (src.chapter_id != null) {
    const ch = doc.chapters.find((c) => c.id === src.chapter_id);
    if (ch) return ch.title;
  }
  return doc.filename.replace(/\.pdf$/i, "");
}

/**
 * Compact book-icon button that lives next to the question-type chip.
 *  - 1 source → click opens the PDF viewer pane directly.
 *  - 2+ sources → click opens a small popover to pick which citation to open.
 */
export function SourcesButton({ sources, documents }: SourcesButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const openPdf = useUIStore((s) => s.openPdf);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!sources?.length) return null;

  function handleClick() {
    if (sources.length === 1) {
      const s = sources[0];
      openPdf({ documentId: s.document_id, page: s.page });
    } else {
      setOpen((v) => !v);
    }
  }

  const hasMultiple = sources.length > 1;

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={handleClick}
        title={
          sources.length === 1
            ? `Open source: ${chapterTitle(documents, sources[0])} · p.${sources[0].page}`
            : `${sources.length} sources — click to pick`
        }
        className={`inline-flex items-center justify-center w-7 h-7 transition-colors border ${
          open
            ? "bg-primary-container text-white border-primary-container"
            : "bg-white text-primary-container border-primary-container/40 hover:bg-primary-container/10"
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">menu_book</span>
        {hasMultiple && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-1 bg-primary-container text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
            {sources.length}
          </span>
        )}
      </button>

      {open && hasMultiple && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-white border border-outline-variant/60 shadow-lg">
          <p className="px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-400 border-b border-outline-variant/40">
            Open in side viewer
          </p>
          <ul className="max-h-72 overflow-y-auto">
            {sources.map((s, i) => {
              const label = chapterTitle(documents, s);
              return (
                <li key={`${s.document_id}-${s.page}-${i}`}>
                  <button
                    onClick={() => {
                      openPdf({ documentId: s.document_id, page: s.page });
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-primary-container/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px] text-neutral-400">
                      description
                    </span>
                    <span className="flex-1 truncate text-on-surface">{label}</span>
                    <span className="font-mono text-[10px] text-neutral-500">p.{s.page}</span>
                    <span className="material-symbols-outlined text-[14px] text-neutral-400">
                      arrow_forward
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
