import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base + HashRouter = works on GitHub Pages under any repo name.
export default defineConfig({
  plugins: [react()],
  base: './',
  // dev: the web app talks to the API on :8787 through the same origin
  server: { proxy: { '/api': 'http://localhost:8787', '/f': 'http://localhost:8787' } },
  build: { chunkSizeWarningLimit: 1500 },
})
