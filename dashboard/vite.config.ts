import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// Dev server proxies /api (REST + the /api/ws WebSocket) to the local node server.
// Override the target with VITE_NODE_URL, e.g. VITE_NODE_URL=http://127.0.0.1:9200 bun dev
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_NODE_URL || process.env.VITE_NODE_URL || 'http://127.0.0.1:9100'
  return {
    plugins: [react(), tailwindcss()],
    build: { outDir: 'dist', emptyOutDir: true },
    server: {
      proxy: {
        '/api': { target, changeOrigin: true, ws: true },
      },
    },
  }
})
