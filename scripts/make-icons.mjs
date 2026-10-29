// Renders the PWA icons (normal + neutral "Notes") from SVG with Playwright. Run once; the PNGs are committed.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const logo = readFileSync('public/favicon.svg', 'utf8')
const neutral = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#F4F1EA"/><path d="M18 20h28M18 30h28M18 40h18" stroke="#5B6378" stroke-width="4" stroke-linecap="round"/></svg>`
const pad = (svg, bg) => `<body style="margin:0;background:${bg}">${svg.replace('<svg ', '<svg style="width:100vw;height:100vh;display:block;padding:12%;box-sizing:border-box" ')}</body>`
const jobs = [
  ['public/icon-192.png', 192, `<body style="margin:0">${logo.replace('<svg ', '<svg style="width:100vw;height:100vh;display:block" ')}</body>`],
  ['public/icon-512.png', 512, `<body style="margin:0">${logo.replace('<svg ', '<svg style="width:100vw;height:100vh;display:block" ')}</body>`],
  ['public/icon-maskable-512.png', 512, pad(logo, '#FBA2AB')],
  ['public/icon-neutral-192.png', 192, `<body style="margin:0">${neutral.replace('<svg ', '<svg style="width:100vw;height:100vh;display:block" ')}</body>`],
  ['public/icon-neutral-512.png', 512, `<body style="margin:0">${neutral.replace('<svg ', '<svg style="width:100vw;height:100vh;display:block" ')}</body>`],
]
const b = await chromium.launch()
for (const [path, size, html] of jobs) { const p = await b.newPage({ viewport: { width: size, height: size } }); await p.setContent(html); await p.screenshot({ path, omitBackground: false }); await p.close(); console.log('wrote', path) }
await b.close()
