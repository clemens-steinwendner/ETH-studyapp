"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/examTiming";

interface ExamTimerProps {
  totalSeconds: number;
  onElapsed: () => void;
}

/**
 * Countdown timer for exam mode. Fires `onElapsed` exactly once when it hits zero.
 * Turns amber at ≤25% remaining, red at ≤10%.
 */
export function ExamTimer({ totalSeconds, onElapsed }: ExamTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [fired, setFired] = useState(false);

  useEffect(() => {
    setRemaining(totalSeconds);
    setFired(false);
  }, [totalSeconds]);

  useEffect(() => {
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining === 0 && !fired) {
      setFired(true);
      onElapsed();
    }
  }, [remaining, fired, onElapsed]);

  const pct = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const color =
    pct <= 0.1 ? "text-red-500" : pct <= 0.25 ? "text-amber-500" : "text-neutral-600";

  return (
    <div className={`flex items-center gap-2 bg-surface-container-high px-3 py-1 ${color}`}>
      <span className="material-symbols-outlined text-[14px]">timer</span>
      <span className="font-mono tabular-nums">{formatCountdown(remaining)}</span>
    </div>
  );
}
