"use client";

interface MultipleChoiceCardProps {
  options: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  correctIndex?: number;
  submitted: boolean;
}

export function MultipleChoiceCard({ options, selected, onSelect, correctIndex, submitted }: MultipleChoiceCardProps) {
  return (
    <div className="space-y-2 p-4">
      {options.map((opt, i) => {
        let cls = "border border-gray-700 rounded px-4 py-2 cursor-pointer hover:border-gray-500 text-sm";
        if (submitted && correctIndex !== undefined) {
          cls += i === correctIndex ? " border-green-500 bg-green-950" : selected === i ? " border-red-500 bg-red-950" : "";
        } else if (selected === i) {
          cls += " border-blue-500 bg-blue-950";
        }
        return (
          <div key={i} className={cls} onClick={() => !submitted && onSelect(i)}>
            {opt}
          </div>
        );
      })}
    </div>
  );
}
