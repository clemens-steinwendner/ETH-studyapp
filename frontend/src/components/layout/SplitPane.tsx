"use client";

import { useState, useRef, useCallback } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number; // percentage 0-100
}

export function SplitPane({ left, right, defaultSplit = 50 }: SplitPaneProps) {
  const [split, setSplit] = useState(defaultSplit);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(20, Math.min(80, pct)));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [onMouseMove, onMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div style={{ width: `${split}%` }} className="overflow-auto">
        {left}
      </div>
      <div
        className="w-1 cursor-col-resize bg-gray-700 hover:bg-blue-500 transition-colors"
        onMouseDown={onMouseDown}
      />
      <div style={{ width: `${100 - split}%` }} className="overflow-auto flex flex-col">
        {right}
      </div>
    </div>
  );
}
