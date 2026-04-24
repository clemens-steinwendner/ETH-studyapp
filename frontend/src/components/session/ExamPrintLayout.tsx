"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import type { Session } from "@/types/session";
import type { Exercise } from "@/types/exercise";

interface ExamPrintLayoutProps {
  session: Session;
  exercises: Exercise[];
  subject?: string | null;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  recall: "Medium",
  application: "Hard",
  synthesis: "Very Hard",
};

function md(text: string) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {text}
    </ReactMarkdown>
  );
}

/**
 * Renders a full exam as an A4-width printable document. Used by:
 *  - /session/{id}/print (fallback browser-print route)
 *  - ExportExamModal (offscreen, then rasterised to PDF)
 *
 * The layout is self-contained: every style is inline so html2canvas reliably
 * captures it regardless of the surrounding app theme. Width matches A4 @96dpi.
 */
export function ExamPrintLayout({ session, exercises, subject }: ExamPrintLayoutProps) {
  const difficulty = DIFFICULTY_LABEL[session.difficulty] ?? session.difficulty;
  const date = new Date(session.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const subjectLabel = subject && subject.trim() ? subject : "Practice";

  return (
    <div
      style={{
        width: "794px",
        minHeight: "1123px",
        padding: "56px 64px",
        background: "#fff",
        color: "#000",
        fontFamily: 'Charter, Georgia, "Times New Roman", serif',
        fontSize: "12pt",
        lineHeight: 1.45,
        boxSizing: "border-box",
      }}
    >
      {/* Title block */}
      <header style={{ borderBottom: "2px solid #111", paddingBottom: 16, marginBottom: 28 }}>
        <div
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: "9pt",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#A31B1F",
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          ETH Practice Exam
        </div>
        <h1
          style={{
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            fontSize: "22pt",
            fontWeight: 800,
            margin: "0 0 10px 0",
            lineHeight: 1.15,
          }}
        >
          {subjectLabel} — {difficulty}
        </h1>
        <div
          style={{
            display: "flex",
            gap: 24,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: "9pt",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#444",
          }}
        >
          <span>
            <strong style={{ color: "#111" }}>Difficulty:</strong> {difficulty}
          </span>
          <span>
            <strong style={{ color: "#111" }}>Questions:</strong> {exercises.length}
          </span>
          <span>
            <strong style={{ color: "#111" }}>Date:</strong> {date}
          </span>
          {session.exam_mode && (
            <span>
              <strong style={{ color: "#111" }}>Mode:</strong> Exam
            </span>
          )}
        </div>
      </header>

      {/* Questions */}
      {exercises.map((ex, i) => (
        <section
          key={ex.id}
          style={{
            marginBottom: 36,
            pageBreakInside: "avoid",
            breakInside: "avoid",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 10,
              borderBottom: "1px solid #ddd",
              paddingBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: "Inter, -apple-system, system-ui, sans-serif",
                fontWeight: 800,
                fontSize: "13pt",
              }}
            >
              Question {i + 1}
            </span>
            <span
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: "8pt",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#666",
                padding: "2px 8px",
                border: "1px solid #ccc",
                background: "#f5f5f5",
              }}
            >
              {ex.question_type.replace(/_/g, " ")}
              {ex.language ? ` · ${ex.language}` : ""}
            </span>
          </div>

          <div style={{ marginBottom: 14 }}>{md(ex.question_text)}</div>

          {renderAnswerArea(ex)}
        </section>
      ))}

      <footer
        style={{
          marginTop: 32,
          paddingTop: 12,
          borderTop: "1px solid #ddd",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: "8pt",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#888",
          textAlign: "center",
        }}
      >
        Generated locally for personal study · {date}
      </footer>
    </div>
  );
}

function renderAnswerArea(ex: Exercise) {
  switch (ex.question_type) {
    case "multiple_choice":
      return (
        <ol style={{ margin: "8px 0 0 0", paddingLeft: 28, listStyle: "upper-alpha" }}>
          {(ex.options ?? []).map((opt, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {md(opt)}
            </li>
          ))}
        </ol>
      );
    case "multiple_select":
      return (
        <div>
          <p
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: "8pt",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#888",
              marginBottom: 6,
            }}
          >
            Select all that apply
          </p>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            {(ex.options ?? []).map((opt, i) => (
              <li key={i} style={{ marginBottom: 6, display: "flex", gap: 8 }}>
                <span style={{ fontSize: "14pt", lineHeight: 1 }}>☐</span>
                <div style={{ flex: 1 }}>{md(opt)}</div>
              </li>
            ))}
          </ul>
        </div>
      );
    case "true_false":
      return (
        <p style={{ marginLeft: 8, fontSize: "13pt" }}>
          ☐ True &nbsp;&nbsp;&nbsp; ☐ False
        </p>
      );
    case "open_ended":
      return <AnswerLines height={260} />;
    case "synthesis":
      return (
        <div>
          <p
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: "8pt",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#A31B1F",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Synthesis — structure your answer across topics
          </p>
          <AnswerLines height={320} />
        </div>
      );
    case "coding":
      return (
        <div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: "9pt",
              padding: "6px 10px",
              background: "#1e1e1e",
              color: "#e5e5e5",
              borderRadius: 2,
              marginBottom: 6,
              display: "inline-block",
            }}
          >
            {(ex.language ?? "python").toUpperCase()}
          </div>
          <div
            style={{
              height: 220,
              border: "1px solid #bbb",
              background:
                "repeating-linear-gradient(to bottom, transparent 0, transparent 23px, #eee 23px, #eee 24px)",
            }}
          />
        </div>
      );
    default:
      return <AnswerLines height={220} />;
  }
}

function AnswerLines({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        borderTop: "1px solid #bbb",
        borderBottom: "1px solid #bbb",
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0, transparent 23px, #ccc 23px, #ccc 24px)",
        marginTop: 6,
      }}
    />
  );
}
