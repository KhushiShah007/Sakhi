// Quick dev helper: node scripts/shot.mjs <url> <out.png> [w] [h] [scrollTop]
import { chromium } from 'playwright'
const [url, out, w = '390', h = '844', scroll = '0'] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
const errs = []
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
p.on('pageerror', (e) => errs.push(String(e)))
await p.goto(url)
await p.waitForTimeout(1800)
if (+scroll) { await p.evaluate((s) => { const el = document.querySelector('[data-scroll]'); if (el) el.scrollTop = s }, +scroll); await p.waitForTimeout(500) }
await p.screenshot({ path: out })
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'))
await b.close()
