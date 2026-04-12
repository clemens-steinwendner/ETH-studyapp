"use client";

interface SessionConfig {
  difficulty: "recall" | "application" | "synthesis";
  questionTypes: Array<"coding" | "multiple_choice" | "open_ended">;
  numQuestions: number;
  hintsEnabled: boolean;
}

interface SessionConfigFormProps {
  value: SessionConfig;
  onChange: (cfg: SessionConfig) => void;
}

export function SessionConfigForm({ value, onChange }: SessionConfigFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Difficulty</label>
        <select
          value={value.difficulty}
          onChange={(e) => onChange({ ...value, difficulty: e.target.value as SessionConfig["difficulty"] })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1"
        >
          <option value="recall">Recall</option>
          <option value="application">Application</option>
          <option value="synthesis">Synthesis</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Number of Questions</label>
        <input
          type="number"
          min={1}
          max={50}
          value={value.numQuestions}
          onChange={(e) => onChange({ ...value, numQuestions: Number(e.target.value) })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 w-20"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Question Types</label>
        {(["coding", "multiple_choice", "open_ended"] as const).map((type) => (
          <label key={type} className="flex items-center gap-2 capitalize mb-1 cursor-pointer">
            <input
              type="checkbox"
              checked={value.questionTypes.includes(type)}
              onChange={() => {
                const next = value.questionTypes.includes(type)
                  ? value.questionTypes.filter((t) => t !== type)
                  : [...value.questionTypes, type];
                onChange({ ...value, questionTypes: next });
              }}
            />
            {type.replace("_", " ")}
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.hintsEnabled}
          onChange={(e) => onChange({ ...value, hintsEnabled: e.target.checked })}
        />
        <span>Enable hints</span>
      </label>
    </div>
  );
}
