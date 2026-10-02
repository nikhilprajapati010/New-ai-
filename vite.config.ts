import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { apiApp } from './server/api.ts';
import { vanguardWebSocket } from './server/websocketService.ts';
import { vanguardContinuousLoop } from './server/continuousLoop.ts';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'vanguard-api-server',
        configureServer(server) {
          server.middlewares.use(apiApp);
          if (server.httpServer) {
            vanguardWebSocket.init(server.httpServer);
            vanguardContinuousLoop.start();
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Disable Vite internal HMR websocket client to eliminate "[vite] failed to connect to websocket: ws://localhost:3000" in cloud preview
      hmr: false,
      watch: null,
      proxy: {
        '/ws': {
          target: 'http://127.0.0.1:3000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
