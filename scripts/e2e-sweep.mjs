// Visits every screen in every language, signed in (full app) and signed out (static site): no console/page errors, no raw keys or "undefined" on screen, no blank screens.
import { chromium } from 'playwright'
const B = process.env.BASE_URL || 'http://localhost:8787'
const S = process.env.STATIC_URL
let failed = 0
const browser = await chromium.launch()
const ROUTES = ['', 'login', 'home', 'checkin', 'vent', 'translator', 'right-now', '3am', 'rehearsal', 'letter', 'brief', 'privacy', 'missed-call', 'history', 'me', 'family', 'family/lesson', 'hr', 'admin']
const BAD = /\bundefined\b|\[object|NaN\b|\b(rh|vl|mic|rm|vs|rn|vn|mc|w|sy|trg)_[a-z0-9_]+\b/

async function sweep(label, base, signedIn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  if (signedIn) {
    await ctx.request.post(B + '/api/auth/otp/request', { data: { phone: '+919999900001' } })
    await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone: '+919999900001', code: '123456', birthYear: 1978, lang: 'en' } })
  }
  const page = await ctx.newPage()
  let errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)) })
  for (const lang of ['en', 'hi', 'mr', 'gu']) for (const r of ROUTES) {
    errs = []
    await page.goto('about:blank'); await page.goto(`${base}/?lang=${lang}#/${r}`); await page.waitForTimeout(1200)
    const text = (await page.locator('body').innerText()).trim()
    const bad = text.match(BAD)
    const problems = []
    if (text.length < 15) problems.push('blank')
    if (bad) problems.push(`bad text "${bad[0]}"`)
    if (errs.length) problems.push(`errors ${JSON.stringify(errs).slice(0, 200)}`)
    if (problems.length) { failed++; console.log(`FAIL  ${label} ${lang} /${r}: ${problems.join('; ')}`) }
  }
  await ctx.close()
  console.log(`done  ${label}`)
}
await sweep('full app (signed in)', B, true)
await sweep('full app (signed out)', B, false)
if (S) await sweep('static site', S, false)
await browser.close()
console.log(failed ? `\n${failed} problems` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
