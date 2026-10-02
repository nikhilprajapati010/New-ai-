import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { apiApp } from "./server/api.js";
import { vanguardWebSocket } from "./server/websocketService.js";
import { vanguardContinuousLoop } from "./server/continuousLoop.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Mount API routes
app.use(apiApp);

// In production, serve built frontend
const distPath = path.resolve(process.cwd(), "dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) {
    return next();
  }
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      res.status(404).send("Vanguard AI application starting or index.html not found.");
    }
  });
});

const server = http.createServer(app);

// Attach persistent WebSocket service
vanguardWebSocket.init(server);

// Start 24/7 Continuous Loop Monitoring
vanguardContinuousLoop.start();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Vanguard AI] Production server running on http://0.0.0.0:${PORT}`);
});
