"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface QuestionPanelProps {
  questionText: string;
  questionType: string;
  questionNumber: number;
}

export function QuestionPanel({ questionText, questionType, questionNumber }: QuestionPanelProps) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-gray-500 text-sm">Q{questionNumber}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 capitalize">
          {questionType.replace("_", " ")}
        </span>
      </div>
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {questionText}
        </ReactMarkdown>
      </div>
    </div>
  );
}
