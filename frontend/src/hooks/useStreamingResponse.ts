"use client";

import { useEffect, useRef, useState } from "react";
import { createWebSocket } from "@/lib/websocket";

export function useStreamingResponse(sessionId: number | null) {
  const [tokens, setTokens] = useState("");
  const [done, setDone] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setTokens("");
    setDone(false);

    const ws = createWebSocket(`/ws/stream/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      if (e.data === "[DONE]") {
        setDone(true);
      } else {
        setTokens((t) => t + e.data);
      }
    };

    return () => ws.close();
  }, [sessionId]);

  return { tokens, done };
}
