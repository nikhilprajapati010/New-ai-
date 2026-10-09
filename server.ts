import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { apiApp } from "./server/api.js";
import { vanguardWebSocket } from "./server/websocketService.js";
import { vanguardContinuousLoop } from "./server/continuousLoop.js";

dotenv.config();

// Global Exception Handlers to Prevent Process Termination / Crash Loops
process.on("uncaughtException", (error: Error) => {
  console.error("[Vanguard Server Uncaught Exception]:", error);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[Vanguard Server Unhandled Rejection]:", reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Accurately resolve the compiled client dist directory regardless of execution context:
 * - When running under tsx in dev/prod: __dirname is the project root.
 * - When running bundled dist-server/server.js: __dirname is <root>/dist-server.
 */
function resolveClientDist(): string {
  const candidates = [
    path.resolve(__dirname, "../dist"), // Bundled dist-server location
    path.resolve(process.cwd(), "dist"), // Root execution
    path.resolve(__dirname, "dist"),
    path.resolve(__dirname, "../../dist"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), "dist");
}

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
    const distPath = resolveClientDist();
    const indexPath = path.join(distPath, "index.html");

    if (!fs.existsSync(indexPath)) {
      console.error(
        `[Vanguard AI FATAL ERROR]: Production client assets NOT found!\n` +
        `Checked path: ${indexPath}\n` +
        `Current working directory: ${process.cwd()}\n` +
        `__dirname: ${__dirname}\n` +
        `Please ensure 'npm run build' has compiled the frontend into 'dist/' before starting the production server.`
      );
    } else {
      console.log(`[Vanguard AI Production]: Serving client static assets from ${distPath}`);
    }

    app.use(express.static(distPath));

    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) {
        return next();
      }

      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }

      console.error(`[Vanguard AI Production Error]: Cannot serve ${req.url} - index.html missing at ${indexPath}`);
      res.status(500).send(
        `<!DOCTYPE html><html><head><title>Vanguard AI - Build Error</title></head>` +
        `<body style="font-family:sans-serif;padding:2rem;background:#090d16;color:#e2e8f0;">` +
        `<h2 style="color:#f87171;">Vanguard AI: Client assets not found</h2>` +
        `<p>The production server could not find the compiled client bundle at <code>${indexPath}</code>.</p>` +
        `<p>Ensure <code>npm run build</code> was executed during the deployment build phase.</p>` +
        `</body></html>`
      );
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
