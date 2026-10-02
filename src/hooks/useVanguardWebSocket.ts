import { useEffect, useState, useRef, useCallback } from "react";
import { TerminalLogEvent } from "../types.ts";

export function useVanguardWebSocket() {
  const [logs, setLogs] = useState<TerminalLogEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<"WebSocket" | "HTTP Polling">("WebSocket");
  const wsRef = useRef<WebSocket | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);

  // Fallback HTTP Polling function for sandbox preview environments
  const startHttpPolling = useCallback(() => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    setConnectionMode("HTTP Polling");
    setIsConnected(true);

    const poll = async () => {
      try {
        const res = await fetch("/api/system/terminal-events");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs)) {
            setLogs((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const newItems = data.logs.filter((l: TerminalLogEvent) => !existingIds.has(l.id));
              if (newItems.length > 0) {
                return [...prev, ...newItems].slice(-160);
              }
              return data.logs.length > 0 && prev.length === 0 ? data.logs : prev;
            });
          }
        }
      } catch (err) {
        // Silently tolerate transient network glitches
      }
    };

    // Immediate initial poll
    poll();
    pollingTimerRef.current = setInterval(poll, 2500);
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    // Use current host and protocol dynamically
    const isHttps = window.location.protocol === "https:";
    const protocol = isHttps ? "wss:" : "ws:";
    const host = window.location.host; // e.g. ais-dev-...run.app or localhost:3000
    const wsUrl = `${protocol}//${host}/ws/vanguard`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const wsTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          startHttpPolling();
        }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(wsTimeout);
        setIsConnected(true);
        setConnectionMode("WebSocket");
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          isPollingRef.current = false;
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "terminal_log" && payload.data) {
            setLogs((prev) => [...prev.slice(-150), payload.data]);
          } else if (payload.type === "history" && Array.isArray(payload.data)) {
            setLogs(payload.data);
          }
        } catch (e) {
          console.error("Failed to parse WS payload:", e);
        }
      };

      ws.onclose = () => {
        clearTimeout(wsTimeout);
        // Fall back to resilient HTTP polling in sandbox
        startHttpPolling();
      };

      ws.onerror = () => {
        clearTimeout(wsTimeout);
        // Fall back to resilient HTTP polling in sandbox
        startHttpPolling();
      };
    } catch (e) {
      startHttpPolling();
    }
  }, [startHttpPolling]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [connect]);

  const clearLogs = () => setLogs([]);

  return {
    logs,
    isConnected,
    connectionMode,
    clearLogs,
  };
}
