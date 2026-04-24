"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Use the local worker file from pdfjs-dist (Next.js serves it via webpack).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfViewerPaneProps {
  documentId: number;
  page: number;
  onClose: () => void;
}

/**
 * Right-pane PDF viewer that opens to a specific page from a citation chip.
 * Shows the cited page first; ± controls let the user scan nearby pages.
 * "Open externally" punts to the browser's native PDF viewer / OS default.
 */
export function PdfViewerPane({ documentId, page, onClose }: PdfViewerPaneProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const [width, setWidth] = useState<number>(600);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reset to the cited page whenever a new citation is opened
  useEffect(() => setCurrentPage(page), [page, documentId]);

  // Track container width so the PDF page renders at the right scale
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.max(320, entry.contentRect.width - 32));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const fileUrl = `/api/v1/documents/${documentId}/pdf`;

  return (
    <div className="h-full flex flex-col bg-neutral-100">
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
            Page {currentPage}
            {numPages ? ` / ${numPages}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-2 py-0.5 hover:text-primary-container disabled:opacity-40"
            aria-label="Previous page"
          >
            ←
          </button>
          <button
            onClick={() => setCurrentPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))}
            disabled={numPages !== null && currentPage >= numPages}
            className="px-2 py-0.5 hover:text-primary-container disabled:opacity-40"
            aria-label="Next page"
          >
            →
          </button>
          <a
            href={`${fileUrl}#page=${currentPage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 px-2 py-0.5 border border-white/20 hover:border-primary-container hover:text-primary-container uppercase text-[10px] tracking-widest flex items-center gap-1"
            title="Open in a new tab / your default PDF app"
          >
            <span className="material-symbols-outlined text-xs">open_in_new</span>
            External
          </a>
        </div>
      </div>

      {/* PDF render area */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center">
        <Document
          file={fileUrl}
          onLoadSuccess={(info) => setNumPages(info.numPages)}
          loading={<div className="text-xs font-mono text-neutral-500 mt-8">Loading PDF…</div>}
          error={<div className="text-xs font-mono text-red-600 mt-8">Could not load PDF.</div>}
        >
          <Page
            pageNumber={currentPage}
            width={width}
            renderTextLayer
            renderAnnotationLayer
          />
        </Document>
      </div>
    </div>
  );
}
