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
      rows={6}
      placeholder="Enter theoretical summary or written solution..."
      className="w-full bg-surface-container-low border-none border-b-2 border-outline focus:border-primary-container focus:ring-0 text-sm text-on-surface placeholder-on-surface-variant/50 p-4 resize-y transition-colors disabled:opacity-60"
    />
  );
}
