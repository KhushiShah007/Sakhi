import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The in-browser speech-to-text engine (onnxruntime-web WASM) is served from our own origin under /ort/, so it works behind a strict
 * CSP, offline after the first load, and on static hosting. Only the speech MODEL is fetched from huggingface.co (once, then cached).
 */
const ORT_FILES = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs']
const ORT_DIR = 'node_modules/onnxruntime-web/dist'
function ortAssets(): Plugin {
  return {
    name: 'ort-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/ort\/([\w.-]+)$/.exec((req.url ?? '').split('?')[0])
        if (!m || !ORT_FILES.includes(m[1]) || !existsSync(`${ORT_DIR}/${m[1]}`)) return next()
        res.setHeader('content-type', m[1].endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        createReadStream(`${ORT_DIR}/${m[1]}`).pipe(res)
      })
    },
    generateBundle() {
      for (const f of ORT_FILES) if (existsSync(`${ORT_DIR}/${f}`)) this.emitFile({ type: 'asset', fileName: `ort/${f}`, source: readFileSync(`${ORT_DIR}/${f}`) })
    },
  }
}

// Relative base + HashRouter = works on GitHub Pages under any repo name.
export default defineConfig({
  plugins: [react(), ortAssets()],
  base: './',
  // dev: the web app talks to the API on :8787 through the same origin
  server: {
    proxy: Object.fromEntries(['/api', '/f', '/b', '/l', '/webhooks', '/healthz'].map((p) => [p, 'http://localhost:8787'])),
  },
  build: { chunkSizeWarningLimit: 1500 },
})
