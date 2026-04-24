"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { api } from "@/lib/api";
import { ExamPrintLayout } from "@/components/session/ExamPrintLayout";
import type { Session } from "@/types/session";
import type { Exercise } from "@/types/exercise";
import type { Document } from "@/types/document";
import "./print.css";

export default function PrintablePage() {
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const [session, setSession] = useState<Session | null>(null);
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Session>(`/api/v1/sessions/${sessionId}`),
      api<Exercise[]>(`/api/v1/sessions/${sessionId}/exercises`),
      api<{ documents: Document[] }>(`/api/v1/documents/`).catch(() => ({ documents: [] as Document[] })),
    ])
      .then(([s, ex, docsRes]) => {
        setSession(s);
        setExercises(ex);
        const firstDoc = docsRes.documents.find((d) => s.document_ids.includes(d.id));
        setSubject(firstDoc?.subject ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [sessionId]);

  if (error) return <p style={{ padding: 32 }}>Could not load session: {error}</p>;
  if (!session || !exercises) return <p style={{ padding: 32 }}>Loading…</p>;

  return (
    <>
      <div className="print-actions">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
        <ExamPrintLayout session={session} exercises={exercises} subject={subject} />
      </div>
    </>
  );
}
