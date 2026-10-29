// Voice settings in Me: off means silence, pace changes the rate, the choice survives a reload.
import { chromium } from 'playwright'
const B = process.env.BASE_URL || 'http://localhost:8787'
let failed = 0
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) failed++ }
const browser = await chromium.launch()
const phone = '+9183' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.request.post(B + '/api/auth/otp/request', { data: { phone } })
const csrf = (await (await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
await ctx.request.post(B + '/api/consents', { data: { purpose: 'core_logging', granted: true }, headers: { 'x-csrf-token': csrf } })
await ctx.request.patch(B + '/api/me', { data: { onboarded: true, name: 'S' }, headers: { 'x-csrf-token': csrf } })
await ctx.addInitScript(() => { window.__u = []; const s = window.speechSynthesis; window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; this.voice = null } }; s.getVoices = () => []; s.speak = (u) => { window.__u.push({ t: u.text, rate: u.rate }); setTimeout(() => u.onend && u.onend(), 5) } })
const page = await ctx.newPage()
await page.goto(B + '/?lang=en#/me'); await page.getByTestId('voice-settings').waitFor()
await page.getByRole('button', { name: 'Hear a sample' }).click(); await page.waitForTimeout(300)
ok('default pace is calm (0.8)', (await page.evaluate(() => window.__u[0]?.rate)) === 0.8)
await page.getByRole('button', { name: 'Slower' }).click(); await page.evaluate(() => { window.__u = [] })
await page.getByRole('button', { name: 'Hear a sample' }).click(); await page.waitForTimeout(300)
ok('slower pace is used', (await page.evaluate(() => window.__u[0]?.rate)) === 0.7)
await page.reload(); await page.getByTestId('voice-settings').waitFor()
ok('the choice survives a reload', (await page.getByRole('button', { name: 'Slower' }).getAttribute('aria-pressed')) === 'true')
await page.getByRole('switch', { name: 'Spoken guidance' }).click(); await page.evaluate(() => { window.__u = [] })
ok('turned off: no preview button', (await page.getByRole('button', { name: 'Hear a sample' }).count()) === 0)
await page.goto(B + '/?lang=en#/3am'); await page.waitForTimeout(1500)
ok('turned off: nothing is spoken elsewhere either', (await page.evaluate(() => window.__u.length)) === 0)
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
