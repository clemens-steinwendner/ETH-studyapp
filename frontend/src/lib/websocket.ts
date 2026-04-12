const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";

export function createWebSocket(path: string): WebSocket {
  const url = `${WS_BASE}/api/v1${path}`;
  return new WebSocket(url);
}
