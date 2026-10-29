// Real-browser check of the missed-call line simulator (same handlers as the telephony webhooks).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '+9192' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
const csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (m, u, d) => (await ctx.request.fetch(B + u, { method: m, data: d, headers: { 'x-csrf-token': csrf } })).json()
await A('POST', '/api/consents', { purpose: 'core_logging', granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, lang: 'en' })
await ctx.addInitScript(() => { window.__spoken = []; window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 10) } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.clock.install()
const tick = async (n = 14) => { for (let i = 0; i < n; i++) { await page.clock.fastForward(3000); await page.waitForTimeout(40) } }

await page.goto(`${B}/?lang=en#/missed-call`)
await page.getByRole('button', { name: 'Simulate a missed call' }).click()
await page.getByText('Sakhi is calling you back…').waitFor()
await tick()
await page.getByLabel('Speak, or type what you would say after the beep').waitFor()
const caps = await page.getByTestId('captions').innerText()
ok('Sakhi calls back and plays Right Now: intro and three slow breaths', /this is Sakhi/.test(caps) && (caps.match(/Breathe in\./g) ?? []).length === 3 && /how are you feeling/.test(caps))
ok('the calm voice speaks every line', (await page.evaluate(() => window.__spoken.length)) >= 10)
await page.screenshot({ path: `${OUT}/95-missed-call.png` })

await page.getByLabel('Speak, or type what you would say after the beep').fill('hot flashes and very tired, secret words about my family')
await page.getByRole('button', { name: 'Say it', exact: true }).click()
await tick(8)
await page.getByText('Call ended. Nothing was saved.').waitFor()
const caps2 = await page.getByTestId('captions').innerText()
ok('the line reads back what it understood and says nothing was saved', /I heard: hot flashes, tiredness/.test(caps2) && /Nothing has been saved yet/.test(caps2))
ok('nothing was saved, and her words were not echoed', (await A('GET', '/api/logs')).logs.length === 0 && !/secret words/.test(caps2))

// a crisis phrase on the line
await page.getByRole('button', { name: 'Call again' }).click()
await tick()
await page.getByLabel('Speak, or type what you would say after the beep').fill('I want to die')
await page.getByRole('button', { name: 'Say it', exact: true }).click()
await tick(8)
await page.getByText('Call ended. Nothing was saved.').waitFor()
const caps3 = await page.getByTestId('captions').innerText()
ok('a crisis phrase gets the scripted reply and the helplines, digit by digit', /not alone/i.test(caps3) && /1 1 2/.test(caps3) && /1 4 4 1 6/.test(caps3))
ok('still nothing saved', (await A('GET', '/api/logs')).logs.length === 0)
await page.getByRole('button', { name: 'Call again' }).click()
await page.getByRole('button', { name: 'Hang up' }).click()
ok('she can hang up at any time', (await page.getByText('Call ended. Nothing was saved.').count()) === 1)

ok('no page errors', errors.length === 0, JSON.stringify(errors))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
