// axe-core on the main live screens (serious and critical violations fail). Mobile viewport, signed in, seeded user.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const B = process.env.BASE_URL || 'http://localhost:8787'
const axeSrc = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
let failed = 0
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.request.post(B + '/api/auth/otp/request', { data: { phone: '+919999900001' } })
await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone: '+919999900001', code: '123456', birthYear: 1978, lang: 'en' } })
const page = await ctx.newPage()
const routes = ['home', 'vent', 'checkin', 'me', 'history', 'privacy', 'right-now', '3am', 'brief', 'letter', 'translator', 'rehearsal', 'missed-call']
for (const lang of ['en', 'hi']) for (const r of routes) {
  await page.goto('about:blank'); await page.goto(`${B}/?lang=${lang}#/${r}`); await page.waitForTimeout(1800)
  await page.evaluate(axeSrc)
  const res = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }))
  const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  if (bad.length) { failed++; console.log(`FAIL ${lang}/${r}`); for (const v of bad) console.log(`   ${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].html.slice(0, 140)}`) } else console.log(`PASS ${lang}/${r}`)
}
await browser.close()
console.log(failed ? `\n${failed} screens with violations` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
