"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MultipleChoiceCardProps {
  options: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  correctIndex?: number;
  submitted: boolean;
  // multiple_select mode: use checkboxes and a set of selected indices
  multiSelect?: boolean;
  selectedIndices?: number[];
  onToggle?: (index: number) => void;
  correctIndices?: number[];
}

export function MultipleChoiceCard({
  options,
  selected,
  onSelect,
  correctIndex,
  submitted,
  multiSelect = false,
  selectedIndices = [],
  onToggle,
  correctIndices = [],
}: MultipleChoiceCardProps) {
  return (
    <div className="p-6 space-y-3">
      <form className="space-y-3">
        {options.map((opt, i) => {
          const isSelected = multiSelect ? selectedIndices.includes(i) : selected === i;
          const isCorrect = multiSelect ? correctIndices.includes(i) : i === correctIndex;

          let cls =
            "flex items-center p-4 transition-colors cursor-pointer text-sm font-medium text-on-surface";

          if (submitted) {
            if (isCorrect) {
              cls += " bg-emerald-50 border-l-4 border-emerald-500";
            } else if (isSelected) {
              cls += " bg-red-50 border-l-4 border-primary-container";
            } else {
              cls += " bg-surface-container-low hover:bg-surface-container-high";
            }
          } else if (isSelected) {
            cls += " bg-surface-container-lowest border-l-4 border-primary-container";
          } else {
            cls += " bg-surface-container-low hover:bg-surface-container-high";
          }

          return (
            <label key={i} className={cls}>
              {multiSelect ? (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => !submitted && onToggle?.(i)}
                  disabled={submitted}
                  className="w-4 h-4 text-primary-container focus:ring-primary-container border-outline rounded mr-4"
                />
              ) : (
                <input
                  type="radio"
                  name="mcq"
                  checked={isSelected}
                  onChange={() => !submitted && onSelect(i)}
                  disabled={submitted}
                  className="w-4 h-4 text-primary-container focus:ring-primary-container border-outline rounded-full mr-4"
                />
              )}
              <span className="flex items-baseline gap-1">
                <span className="text-primary-container font-bold mr-1 shrink-0">
                  {String.fromCharCode(65 + i)}.
                </span>
                <span className="prose prose-sm max-w-none [&_p]:m-0 [&_p]:inline">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{ p: ({ children }) => <span>{children}</span> }}
                  >
                    {opt}
                  </ReactMarkdown>
                </span>
              </span>
            </label>
          );
        })}
      </form>
    </div>
  );
}
