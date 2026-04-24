"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { api } from "@/lib/api";
import type { Session } from "@/types/session";
import type { Exercise } from "@/types/exercise";
import "./print.css";

export default function PrintablePage() {
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const [session, setSession] = useState<Session | null>(null);
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Session>(`/api/v1/sessions/${sessionId}`),
      api<Exercise[]>(`/api/v1/sessions/${sessionId}/exercises`),
    ])
      .then(([s, ex]) => {
        setSession(s);
        setExercises(ex);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [sessionId]);

  if (error) {
    return <p className="print-root">Could not load session: {error}</p>;
  }
  if (!session || !exercises) {
    return <p className="print-root">Loading…</p>;
  }

  const date = new Date(session.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <div className="print-actions">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <main className="print-root">
        <h1>Practice Exam</h1>
        <p className="print-subtitle">
          {session.difficulty.toUpperCase()} · {exercises.length} questions · {date}
        </p>

        {exercises.map((ex, i) => (
          <section key={ex.id} className="print-question">
            <div className="print-question-header">
              Question {i + 1}
              <span style={{ fontWeight: 400, color: "#666", marginLeft: 8 }}>
                ({ex.question_type.replace("_", " ")})
              </span>
            </div>
            <div className="print-question-body">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {ex.question_text}
              </ReactMarkdown>
            </div>

            {/* Render answer scaffolding per question type */}
            {ex.question_type === "multiple_choice" && ex.options && (
              <ol className="print-options">
                {ex.options.map((opt, idx) => (
                  <li key={idx}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {opt}
                    </ReactMarkdown>
                  </li>
                ))}
              </ol>
            )}

            {ex.question_type === "multiple_select" && ex.options && (
              <ol className="print-options">
                {ex.options.map((opt, idx) => (
                  <li key={idx}>
                    ☐{" "}
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {opt}
                    </ReactMarkdown>
                  </li>
                ))}
              </ol>
            )}

            {ex.question_type === "true_false" && (
              <p style={{ marginLeft: 16 }}>
                ☐ True &nbsp;&nbsp; ☐ False
              </p>
            )}

            {ex.question_type === "open_ended" && <div className="print-answer-lines" />}

            {ex.question_type === "coding" && (
              <>
                <div className="print-code-block">
                  {/* Any function signature baked into the question already renders above */}
                  Language: {ex.language ?? "python"}
                </div>
                <div className="print-code-space" />
              </>
            )}

            <hr className="print-divider" />
          </section>
        ))}

        <p className="print-footer">
          Generated locally for personal study. Do not distribute.
        </p>
      </main>
    </>
  );
}
