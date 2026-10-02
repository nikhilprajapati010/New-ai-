import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { apiApp } from "./server/api.js";
import { vanguardWebSocket } from "./server/websocketService.js";
import { vanguardContinuousLoop } from "./server/continuousLoop.js";

dotenv.config();

// Global Exception Handlers to Prevent Process Termination / Crash Loops
process.on("uncaughtException", (error: Error) => {
  console.error("[Vanguard Server Uncaught Exception]:", error);
  // Log and keep process alive to preserve server uptime
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[Vanguard Server Unhandled Rejection]:", reason);
  // Log and keep process alive to preserve server uptime
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Mount API endpoints
  app.use(apiApp);

  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    // Mount Vite dev middleware directly without separate sub-compilation loops
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static client assets
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));

    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) {
          res.status(404).send("Vanguard AI: Client assets not found.");
        }
      });
    });
  }

  // Final Express error boundary
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Vanguard Root Express Error]:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error occurred." });
    }
  });

  const server = http.createServer(app);

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error("[Vanguard HTTP Server Error]:", err);
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is currently in use. Retrying in 1s...`);
    }
  });

  // Attach persistent WebSocket streaming server
  vanguardWebSocket.init(server);

  // Initialize 24/7 Continuous Loop Monitoring
  vanguardContinuousLoop.start();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[Vanguard AI] Continuous server listening on http://0.0.0.0:${PORT} (${
        isDev ? "development (Vite middleware)" : "production"
      })`
    );
  });
}

startServer().catch((err) => {
  console.error("[Vanguard Startup Error]:", err);
});
