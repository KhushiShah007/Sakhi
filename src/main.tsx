import './zodConfig'
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/noto-sans-devanagari/400.css'
import '@fontsource/noto-sans-devanagari/500.css'
import '@fontsource/noto-sans-devanagari/600.css'
import '@fontsource/noto-sans-devanagari/700.css'
import '@fontsource/noto-sans-gujarati/400.css'
import '@fontsource/noto-sans-gujarati/500.css'
import '@fontsource/noto-sans-gujarati/600.css'
import '@fontsource/noto-sans-gujarati/700.css'
import '@fontsource/kalam/400.css'
import '@fontsource/kalam/700.css'
import './index.css'
import App from './App'

// Offline support: cache the app shell. Never in dev (it would cache stale code).
if ((import.meta as unknown as { env: { PROD: boolean } }).env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js').catch(() => {}) })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
