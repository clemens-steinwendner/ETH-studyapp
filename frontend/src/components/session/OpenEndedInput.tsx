"use client";

interface OpenEndedInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function OpenEndedInput({ value, onChange, disabled }: OpenEndedInputProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={8}
      placeholder="Type your answer here…"
      className="w-full bg-gray-900 border border-gray-700 rounded p-3 font-mono text-sm resize-y focus:outline-none focus:border-blue-500"
    />
  );
}
