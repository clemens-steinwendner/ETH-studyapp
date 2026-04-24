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
 * Compact "Sources" pill that lives in a question header (top right). Click
 * to open a small popover listing each citation; clicking a row opens the
 * in-app PDF viewer at that page.
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-widest border transition-colors ${
          open
            ? "bg-primary-container text-white border-primary-container"
            : "bg-white text-primary-container border-primary-container/40 hover:bg-primary-container/10"
        }`}
        title="Open the source PDF for this question"
      >
        <span className="material-symbols-outlined text-[14px]">menu_book</span>
        Sources
        <span
          className={`min-w-[16px] text-center text-[9px] px-1 ${
            open ? "bg-white/20" : "bg-primary-container/10"
          }`}
        >
          {sources.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-72 bg-white border border-outline-variant/60 shadow-lg">
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
