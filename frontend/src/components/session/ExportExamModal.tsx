"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { api } from "@/lib/api";
import { ExamPrintLayout } from "@/components/session/ExamPrintLayout";
import type { Session } from "@/types/session";
import type { Exercise } from "@/types/exercise";
import type { Document } from "@/types/document";

interface ExportExamModalProps {
  sessionId: number;
  onClose: () => void;
}

type Phase = "loading" | "rendering" | "slicing" | "done" | "error";

interface Progress {
  phase: Phase;
  percent: number;
  status: string;
  error?: string;
}

/**
 * Modal that turns the current exam into an A4 PDF client-side.
 *
 * Flow:
 *  1. Fetch session + exercises + document list.
 *  2. Render ExamPrintLayout into an offscreen DOM node (fixed width 794px).
 *  3. Wait for fonts + next animation frame.
 *  4. html2canvas the full doc, then slice the tall canvas into A4-sized page
 *     images and add each to a jsPDF instance. Progress bar advances per slice.
 *  5. pdf.save() triggers the browser download automatically.
 */
export function ExportExamModal({ sessionId, onClose }: ExportExamModalProps) {
  const [progress, setProgress] = useState<Progress>({
    phase: "loading",
    percent: 0,
    status: "Fetching exam…",
  });
  const cancelledRef = useRef(false);

  useEffect(() => {
    let rootInstance: Root | null = null;
    let hostEl: HTMLDivElement | null = null;

    async function run() {
      try {
        // ── Step 1: load data ────────────────────────────────────────────────
        setProgress({ phase: "loading", percent: 5, status: "Fetching exam data…" });
        const [session, exercises, docsRes] = await Promise.all([
          api<Session>(`/api/v1/sessions/${sessionId}`),
          api<Exercise[]>(`/api/v1/sessions/${sessionId}/exercises`),
          api<{ documents: Document[] }>(`/api/v1/documents/`).catch(() => ({
            documents: [] as Document[],
          })),
        ]);
        if (cancelledRef.current) return;

        const firstDoc = docsRes.documents.find((d) => session.document_ids.includes(d.id));
        const subject = firstDoc?.subject ?? null;

        // ── Step 2: mount offscreen layout ───────────────────────────────────
        setProgress({ phase: "rendering", percent: 20, status: "Laying out questions…" });
        hostEl = document.createElement("div");
        Object.assign(hostEl.style, {
          position: "fixed",
          top: "0",
          left: "-10000px",
          width: "794px",
          background: "#fff",
          zIndex: "-1",
        });
        document.body.appendChild(hostEl);
        rootInstance = createRoot(hostEl);
        rootInstance.render(
          <ExamPrintLayout session={session} exercises={exercises} subject={subject} />,
        );

        // Wait: React commit → next paint → fonts ready → one more frame (KaTeX)
        await new Promise((r) => setTimeout(r, 80));
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => setTimeout(r, 120));
        if (cancelledRef.current) return;

        // ── Step 3: rasterize ────────────────────────────────────────────────
        setProgress({ phase: "rendering", percent: 45, status: "Rendering pages…" });
        const html2canvas = (await import("html2canvas")).default;
        const { jsPDF } = await import("jspdf");

        const target = hostEl.firstElementChild as HTMLElement;
        const scale = 2; // crisper text
        const canvas = await html2canvas(target, {
          scale,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          windowWidth: 794,
        });
        if (cancelledRef.current) return;

        // ── Step 4: slice into A4 pages ──────────────────────────────────────
        setProgress({ phase: "slicing", percent: 70, status: "Composing PDF…" });
        // A4: 210 × 297 mm. At 96 dpi: 794 × 1123 px (matches our layout width).
        const pageWidthPx = 794 * scale;
        const pageHeightPx = 1123 * scale;
        const totalHeight = canvas.height;
        const pageCount = Math.max(1, Math.ceil(totalHeight / pageHeightPx));

        const pdf = new jsPDF({
          unit: "mm",
          format: "a4",
          orientation: "portrait",
          compress: true,
        });
        const pdfWidthMm = 210;
        const pdfPageHeightMm = 297;

        for (let i = 0; i < pageCount; i++) {
          if (cancelledRef.current) return;
          const sliceY = i * pageHeightPx;
          const sliceHeight = Math.min(pageHeightPx, totalHeight - sliceY);

          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = pageWidthPx;
          pageCanvas.height = pageHeightPx;
          const ctx = pageCanvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D context unavailable");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
          ctx.drawImage(
            canvas,
            0, sliceY, pageWidthPx, sliceHeight,
            0, 0, pageWidthPx, sliceHeight,
          );

          const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
          if (i > 0) pdf.addPage();
          // Map the slice's true height back to mm so partial last pages aren't stretched.
          const sliceHeightMm = (sliceHeight / pageHeightPx) * pdfPageHeightMm;
          pdf.addImage(imgData, "JPEG", 0, 0, pdfWidthMm, sliceHeightMm);

          const pct = 70 + Math.round(((i + 1) / pageCount) * 25);
          setProgress({
            phase: "slicing",
            percent: pct,
            status: `Composing page ${i + 1} / ${pageCount}…`,
          });
          await new Promise((r) => setTimeout(r, 16)); // yield so the bar paints
        }

        if (cancelledRef.current) return;

        // ── Step 5: download ─────────────────────────────────────────────────
        setProgress({ phase: "done", percent: 100, status: "Downloading…" });
        const today = new Date().toISOString().slice(0, 10);
        pdf.save(`exam-${sessionId}-${today}.pdf`);
        setTimeout(() => {
          if (!cancelledRef.current) onClose();
        }, 600);
      } catch (e) {
        if (cancelledRef.current) return;
        setProgress({
          phase: "error",
          percent: 0,
          status: "Export failed.",
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        // Clean up offscreen mount
        try {
          rootInstance?.unmount();
        } catch {}
        if (hostEl?.parentNode) hostEl.parentNode.removeChild(hostEl);
      }
    }

    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [sessionId, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-surface border border-outline-variant/30 w-[440px] max-w-[90vw] shadow-2xl">
        <div className="px-5 py-3 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-[18px]">
              picture_as_pdf
            </span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest">
              Exporting Exam
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
            aria-label="Cancel export"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {progress.phase === "error" ? (
            <>
              <p className="text-sm font-bold text-primary-container">Export failed</p>
              <p className="text-xs font-mono text-neutral-500 break-words">
                {progress.error ?? "Unknown error"}
              </p>
              <button
                onClick={onClose}
                className="w-full mt-2 py-2 text-xs font-mono uppercase tracking-widest border border-neutral-300 hover:border-neutral-900 transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between text-xs font-mono uppercase tracking-widest">
                <span className="text-neutral-500">{progress.status}</span>
                <span className="text-neutral-900 font-bold tabular-nums">
                  {progress.percent}%
                </span>
              </div>
              <div className="h-2 w-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-[10px] font-mono text-neutral-400">
                {progress.phase === "done"
                  ? "PDF downloaded — closing…"
                  : "This happens entirely in your browser. Do not close this window."}
              </p>
              {progress.phase !== "done" && (
                <button
                  onClick={onClose}
                  className="w-full mt-2 py-2 text-[10px] font-mono uppercase tracking-widest border border-neutral-300 text-neutral-500 hover:border-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
