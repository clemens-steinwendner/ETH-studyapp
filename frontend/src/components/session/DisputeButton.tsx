"use client";

interface DisputeButtonProps {
  sessionId: number;
  exerciseId: number;
  onDisputed: () => void;
}

export function DisputeButton({ sessionId, exerciseId, onDisputed }: DisputeButtonProps) {
  async function handleDispute() {
    await fetch(`/api/v1/sessions/${sessionId}/exercises/${exerciseId}/dispute`, {
      method: "PATCH",
    });
    onDisputed();
  }

  return (
    <button
      onClick={handleDispute}
      className="text-xs text-gray-500 hover:text-yellow-400 underline mt-2"
    >
      Override: mark as passed
    </button>
  );
}
