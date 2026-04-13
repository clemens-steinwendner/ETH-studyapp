"use client";

interface MultipleChoiceCardProps {
  options: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  correctIndex?: number;
  submitted: boolean;
}

export function MultipleChoiceCard({
  options,
  selected,
  onSelect,
  correctIndex,
  submitted,
}: MultipleChoiceCardProps) {
  return (
    <div className="p-6 space-y-3">
      <form className="space-y-3">
        {options.map((opt, i) => {
          let cls =
            "flex items-center p-4 transition-colors cursor-pointer text-sm font-medium text-on-surface";

          if (submitted && correctIndex !== undefined) {
            if (i === correctIndex) {
              cls += " bg-emerald-50 border-l-4 border-emerald-500";
            } else if (selected === i) {
              cls += " bg-red-50 border-l-4 border-primary-container";
            } else {
              cls += " bg-surface-container-low hover:bg-surface-container-high";
            }
          } else if (selected === i) {
            cls += " bg-surface-container-lowest border-l-4 border-primary-container";
          } else {
            cls += " bg-surface-container-low hover:bg-surface-container-high";
          }

          return (
            <label key={i} className={cls}>
              <input
                type="radio"
                name="mcq"
                checked={selected === i}
                onChange={() => !submitted && onSelect(i)}
                disabled={submitted}
                className="w-4 h-4 text-primary-container focus:ring-primary-container border-outline rounded-full mr-4"
              />
              <span>
                <span className="text-primary-container font-bold mr-2">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </span>
            </label>
          );
        })}
      </form>
    </div>
  );
}
