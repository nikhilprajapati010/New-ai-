import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { apiApp } from "./server/api.js";
import { vanguardWebSocket } from "./server/websocketService.js";
import { vanguardContinuousLoop } from "./server/continuousLoop.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Mount API routes
app.use(apiApp);

// In production, serve built frontend
const distPath = path.resolve(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) {
    return next();
  }
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      res.status(404).send("Vanguard AI building. Start Vite dev server for local dev.");
    }
  });
});

const server = http.createServer(app);

// Attach persistent WebSocket service
vanguardWebSocket.init(server);

// Start 24/7 Continuous Loop Monitoring
vanguardContinuousLoop.start();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Vanguard AI] Continuous server running on http://0.0.0.0:${PORT}`);
});
