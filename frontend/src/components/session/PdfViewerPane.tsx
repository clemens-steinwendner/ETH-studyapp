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

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const DEFAULT_ZOOM = 1.0;
const ZOOM_STEPS = [0.5, 0.6, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

// Virtualisation window (± pages around the viewport center).
const RENDER_AHEAD = 2;
const RENDER_BEHIND = 1;

// Canvas render resolution as a multiple of the pane width. Chosen so that:
//   - zoom = 1.0 → CSS scale ~0.5 (canvas rendered at 2× device density, very crisp)
//   - zoom = 2.0 → CSS scale = 1.0 (canvas at native resolution)
//   - zoom = 3.0 → CSS scale = 1.5 (slightly soft but no reload flash)
// The canvas is rasterised *once* per doc-load / pane-resize — zoom changes
// are pure CSS transforms, matching how native PDF viewers feel.
const RASTER_SCALE = 2.0;

/**
 * Scrollable + zoomable PDF viewer.
 *
 * Performance techniques:
 *  - Only pages near the viewport are actually rasterised by react-pdf.
 *  - All page slots have a known layout size so scroll height is stable.
 *  - Zoom is split into "target" (driven by user input, applied as CSS
 *    transform instantly) and "raster" (debounced, passed to Page.width so
 *    pdf.js re-renders the canvas at the final resolution for crisp text).
 *  - Inner wrapper uses min-w-fit so the container can scroll horizontally
 *    when zoomed beyond the pane width.
 */
export function PdfViewerPane({ documentId, page, onClose }: PdfViewerPaneProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [visiblePage, setVisiblePage] = useState(page);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  // Zoom is applied only as a CSS transform; pdf.js never re-rasterises on zoom.
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Portrait aspect ratio (h/w) taken from the first loaded page.
  const [aspect, setAspect] = useState<number>(1.414);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const collapsed = useUIStore((s) => s.pdfCollapsed);
  const setCollapsed = useUIStore((s) => s.setPdfCollapsed);

  const fileUrl = `/api/v1/documents/${documentId}/pdf`;
  const fileObj = useMemo(() => ({ url: fileUrl }), [fileUrl]);

  // Canvas is rasterised at a fixed high resolution, independent of zoom.
  const rasterWidth = containerWidth * RASTER_SCALE;
  // Layout size tracks the user's zoom so neighbouring pages reflow correctly.
  const layoutWidth = containerWidth * zoom;
  const layoutHeight = Math.round(layoutWidth * aspect);
  // CSS scale from the raster canvas to the user's target zoom.
  const scaleRatio = zoom / RASTER_SCALE;

  // ── Container width ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Subtract horizontal padding (32 px) but keep a sensible floor.
        setContainerWidth(Math.max(320, entry.contentRect.width - 32));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Cmd/Ctrl + wheel = zoom (pure CSS, instant) ─────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => clampZoom(z * factor));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Cmd/Ctrl + "+" / "-" / "0" = zoom shortcuts ─────────────────────────
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

  // ── Virtualisation: compute the centered page on scroll ──────────────────
  const [windowCenter, setWindowCenter] = useState<number>(page);
  const rafPending = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || numPages === null) return;

    function computeCenter() {
      rafPending.current = false;
      const root = scrollRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const midY = rootRect.top + rootRect.height / 2;
      let bestPage = 1;
      let bestDist = Infinity;
      pageRefs.current.forEach((node, n) => {
        const r = node.getBoundingClientRect();
        const centerY = r.top + r.height / 2;
        const dist = Math.abs(centerY - midY);
        if (dist < bestDist) {
          bestDist = dist;
          bestPage = n;
        }
      });
      setWindowCenter(bestPage);
      setVisiblePage(bestPage);
    }

    function onScroll() {
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(computeCenter);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    requestAnimationFrame(computeCenter);
    return () => el.removeEventListener("scroll", onScroll);
  }, [numPages]);

  // ── Scroll to cited page when props change ──────────────────────────────
  useEffect(() => {
    if (numPages === null) return;
    setVisiblePage(page);
    setWindowCenter(page);

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 60;

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

  const setPageRef = useCallback(
    (n: number) => (el: HTMLDivElement | null) => {
      if (el) pageRefs.current.set(n, el);
      else pageRefs.current.delete(n);
    },
    [],
  );

  const onFirstPageLoad = useCallback((pdfPage: { width: number; height: number }) => {
    if (pdfPage.width > 0) setAspect(pdfPage.height / pdfPage.width);
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
              disabled={zoom <= ZOOM_MIN + 0.001}
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
              disabled={zoom >= ZOOM_MAX - 0.001}
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

      {/* Scrollable PDF render area. `min-w-fit` on the inner wrapper lets the
          viewport scroll horizontally when pages are wider than the pane. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        style={{ contain: "strict", overflowAnchor: "none" }}
      >
        <div className="flex flex-col items-center gap-3 p-4 min-w-fit">
          <Document
            file={fileObj}
            onLoadSuccess={(info) => setNumPages(info.numPages)}
            loading={<div className="text-xs font-mono text-neutral-500 mt-8">Loading PDF…</div>}
            error={<div className="text-xs font-mono text-red-600 mt-8">Could not load PDF.</div>}
          >
            {Array.from({ length: numPages ?? 0 }, (_, i) => {
              const n = i + 1;
              const shouldRender =
                n >= windowCenter - RENDER_BEHIND && n <= windowCenter + RENDER_AHEAD;
              return (
                <div
                  key={n}
                  ref={setPageRef(n)}
                  data-page-number={n}
                  className="shadow bg-white relative"
                  style={{
                    width: layoutWidth,
                    height: layoutHeight,
                    // will-change hints the browser to promote the slot to its own
                    // compositor layer — dramatically smoother horizontal scrolling.
                    willChange: "transform",
                  }}
                >
                  {shouldRender ? (
                    <div
                      style={{
                        transform: scaleRatio === 1 ? undefined : `scale(${scaleRatio})`,
                        transformOrigin: "top left",
                        width: rasterWidth,
                        position: "absolute",
                        top: 0,
                        left: 0,
                      }}
                    >
                      <Page
                        pageNumber={n}
                        width={rasterWidth}
                        renderTextLayer
                        renderAnnotationLayer
                        onLoadSuccess={n === 1 ? onFirstPageLoad : undefined}
                        loading={<PagePlaceholder n={n} />}
                      />
                    </div>
                  ) : (
                    <PagePlaceholder n={n} />
                  )}
                </div>
              );
            })}
          </Document>
        </div>
      </div>
    </div>
  );
}

function PagePlaceholder({ n }: { n: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-neutral-300 uppercase tracking-widest select-none">
      Page {n}
    </div>
  );
}

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function stepZoom(current: number, dir: 1 | -1): number {
  if (dir === 1) {
    return ZOOM_STEPS.find((s) => s > current + 0.01) ?? ZOOM_MAX;
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < current - 0.01) return ZOOM_STEPS[i];
  }
  return ZOOM_MIN;
}
