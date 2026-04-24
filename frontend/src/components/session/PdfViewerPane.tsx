"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { useUIStore } from "@/stores/uiStore";

// Pin worker to the same pdfjs-dist version the package ships.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerPaneProps {
  documentId: number;
  page: number;
  onClose: () => void;
}

const ZOOM_STEPS = [0.5, 0.6, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const DEFAULT_ZOOM = 1.0;

/**
 * Scrollable PDF viewer that opens to a cited page.
 *  - Every page is rendered in a vertical scroll stack (no ← → nav).
 *  - Zoom controls (−/reset/+) plus Cmd/Ctrl+wheel and Cmd/Ctrl+=/− shortcuts.
 *  - When the citation changes, scrolls the cited page into view.
 *  - Collapsing still shrinks the pane to a narrow rail.
 */
export function PdfViewerPane({ documentId, page, onClose }: PdfViewerPaneProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [visiblePage, setVisiblePage] = useState(page);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const collapsed = useUIStore((s) => s.pdfCollapsed);
  const setCollapsed = useUIStore((s) => s.setPdfCollapsed);

  const fileUrl = `/api/v1/documents/${documentId}/pdf`;
  const fileObj = useMemo(() => ({ url: fileUrl }), [fileUrl]);

  // Track container width so the Page component renders at the right base width.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.max(320, entry.contentRect.width - 32));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll to the cited page whenever the parent changes the page prop or the doc
  // switches. react-pdf mounts Page DOM nodes asynchronously — the ref map may
  // not yet contain the target when this effect fires, so retry for a few frames.
  useEffect(() => {
    if (numPages === null) return;
    setVisiblePage(page);

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 60; // ~1s at 60fps

    function tryScroll() {
      if (cancelled) return;
      const target = pageRefs.current.get(page);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "auto" });
        return;
      }
      if (++attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      }
    }
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [page, documentId, numPages]);

  // Observe which page is in view to keep the "Page N / M" label accurate while scrolling.
  useEffect(() => {
    if (numPages === null || !scrollRef.current) return;
    const root = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (inView) {
          const n = Number((inView.target as HTMLElement).dataset.pageNumber);
          if (!Number.isNaN(n)) setVisiblePage(n);
        }
      },
      { root, threshold: [0.25, 0.5, 0.75] },
    );
    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [numPages]);

  // Cmd/Ctrl + wheel = zoom. Cmd/Ctrl + "=" / "-" / "0" also supported.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY > 0 ? 0.9 : 1.1)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => stepZoom(z, +1));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => stepZoom(z, -1));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(DEFAULT_ZOOM);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setPageRef = useCallback((n: number) => (el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(n, el);
    else pageRefs.current.delete(n);
  }, []);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title={`Expand source PDF (page ${visiblePage})`}
        className="h-full w-10 bg-neutral-900 text-white flex flex-col items-center justify-between py-3 border-l border-white/10 hover:bg-neutral-800 transition-colors flex-shrink-0"
      >
        <span className="material-symbols-outlined text-[16px] text-primary-container">menu_book</span>
        <span
          className="font-mono text-[9px] uppercase tracking-widest text-neutral-300"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Source · p.{visiblePage}
        </span>
        <span className="material-symbols-outlined text-[16px] text-neutral-400">chevron_left</span>
      </button>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-100 min-w-0 flex-1">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 text-white text-xs font-mono flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="hover:text-primary-container transition-colors flex items-center gap-1"
            aria-label="Close PDF"
          >
            <span className="material-symbols-outlined text-base">close</span>
            <span className="uppercase tracking-widest">Source</span>
          </button>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-neutral-400">
            Page {visiblePage}
            {numPages ? ` / ${numPages}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/5 border border-white/10">
            <button
              onClick={() => setZoom((z) => stepZoom(z, -1))}
              disabled={zoom <= ZOOM_STEPS[0]}
              className="px-2 py-0.5 hover:text-primary-container disabled:opacity-40"
              title="Zoom out (⌘−)"
              aria-label="Zoom out"
            >
              <span className="material-symbols-outlined text-[14px]">remove</span>
            </button>
            <button
              onClick={() => setZoom(DEFAULT_ZOOM)}
              className="px-2 py-0.5 hover:text-primary-container text-[10px] tabular-nums min-w-[46px] text-center"
              title="Reset zoom (⌘0)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => stepZoom(z, +1))}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              className="px-2 py-0.5 hover:text-primary-container disabled:opacity-40"
              title="Zoom in (⌘+)"
              aria-label="Zoom in"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>
          <a
            href={`${fileUrl}#page=${visiblePage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 px-2 py-0.5 border border-white/20 hover:border-primary-container hover:text-primary-container uppercase text-[10px] tracking-widest flex items-center gap-1"
            title="Open in a new tab / your default PDF app"
          >
            <span className="material-symbols-outlined text-xs">open_in_new</span>
            External
          </a>
          <button
            onClick={() => setCollapsed(true)}
            className="px-2 py-0.5 border border-white/20 hover:border-primary-container hover:text-primary-container uppercase text-[10px] tracking-widest flex items-center gap-1"
            title="Collapse to side rail"
            aria-label="Collapse PDF pane"
          >
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            Collapse
          </button>
        </div>
      </div>

      {/* Scrollable PDF render area */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 flex flex-col items-center gap-3">
        <Document
          file={fileObj}
          onLoadSuccess={(info) => setNumPages(info.numPages)}
          loading={<div className="text-xs font-mono text-neutral-500 mt-8">Loading PDF…</div>}
          error={<div className="text-xs font-mono text-red-600 mt-8">Could not load PDF.</div>}
        >
          {Array.from({ length: numPages ?? 0 }, (_, i) => {
            const pageNumber = i + 1;
            return (
              <div
                key={pageNumber}
                ref={setPageRef(pageNumber)}
                data-page-number={pageNumber}
                className="shadow bg-white"
              >
                <Page
                  pageNumber={pageNumber}
                  width={containerWidth * zoom}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </div>
            );
          })}
        </Document>
      </div>
    </div>
  );
}

function clampZoom(z: number): number {
  return Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], z));
}

function stepZoom(current: number, dir: 1 | -1): number {
  // Snap to the nearest discrete step in the given direction.
  const sorted = ZOOM_STEPS;
  if (dir === 1) {
    return sorted.find((s) => s > current + 0.01) ?? sorted[sorted.length - 1];
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] < current - 0.01) return sorted[i];
  }
  return sorted[0];
}
