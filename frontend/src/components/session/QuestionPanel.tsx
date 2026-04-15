"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface QuestionPanelProps {
  questionText: string;
  questionType: string;
  questionNumber: number;
}

const TYPE_ICONS: Record<string, string> = {
  coding: "code",
  multiple_choice: "checklist",
  multiple_select: "select_check_box",
  true_false: "fact_check",
  open_ended: "edit_note",
};

export function QuestionPanel({ questionText, questionType, questionNumber }: QuestionPanelProps) {
  const icon = TYPE_ICONS[questionType] ?? "help_outline";

  return (
    <div>
      <nav className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant mb-4 uppercase tracking-tighter">
        <span>Session</span>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="capitalize">{questionType.replace("_", " ")}</span>
      </nav>

      <div className="flex items-start gap-3 mb-6">
        <span className="text-xs font-mono font-bold text-on-secondary-container bg-surface-container px-2 py-1 mt-0.5">
          Q{questionNumber.toString().padStart(2, "0")}
        </span>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container text-[18px]">{icon}</span>
          <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 bg-surface-container px-2 py-1">
            {questionType.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="prose prose-sm text-on-surface-variant leading-relaxed max-w-none
        prose-headings:text-on-surface prose-headings:font-bold
        prose-code:bg-surface-container-highest prose-code:px-1 prose-code:rounded prose-code:font-mono prose-code:text-xs
        prose-pre:bg-surface-container prose-pre:border-l-4 prose-pre:border-primary-container
        prose-strong:text-on-surface
      ">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {questionText}
        </ReactMarkdown>
      </div>
    </div>
  );
}
