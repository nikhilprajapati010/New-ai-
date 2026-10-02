import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "http";

export interface TerminalLogEvent {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "TEST" | "EVENT";
  source: string;
  message: string;
  metadata?: any;
}

class VanguardWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private messageBuffer: TerminalLogEvent[] = [];

  public init(server: any) {
    if (this.wss) return;

    this.wss = new WebSocketServer({ server, path: "/ws/vanguard" });

    this.wss.on("error", (err) => {
      console.error("[Vanguard WebSocketServer Error]:", err);
    });

    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);

      // Send recent buffer history on connect
      ws.send(
        JSON.stringify({
          type: "history",
          data: this.messageBuffer.slice(-40),
        })
      );

      // Welcome event
      ws.send(
        JSON.stringify({
          type: "system_info",
          message: "Connected to Vanguard AI 24/7 Continuous Loop WebSocket Stream.",
          timestamp: new Date().toISOString(),
        })
      );

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", (err) => {
        console.error("WebSocket client error:", err);
        this.clients.delete(ws);
      });
    });

    console.log("[VanguardWebSocketService] WebSocket stream ready at /ws/vanguard");
  }

  public broadcast(payload: any) {
    const raw = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(raw);
        } catch (e) {
          // ignore client send error
        }
      }
    }
  }

  public broadcastLog(log: Omit<TerminalLogEvent, "id" | "timestamp">) {
    const event: TerminalLogEvent = {
      ...log,
      id: `term-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    this.messageBuffer.push(event);
    if (this.messageBuffer.length > 200) {
      this.messageBuffer.shift();
    }

    this.broadcast({
      type: "terminal_log",
      data: event,
    });
  }

  public getRecentLogs(): TerminalLogEvent[] {
    return [...this.messageBuffer];
  }
}

export const vanguardWebSocket = new VanguardWebSocketService();
