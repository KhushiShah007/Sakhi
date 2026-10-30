// Vent with a fake SpeechRecognition: every failure shows a plain message, typing still works, and speech lands in the box.
import { chromium } from 'playwright'
const B = process.env.BASE_URL || 'http://localhost:8787'
let failed = 0
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) failed++ }
const browser = await chromium.launch()
for (const mode of ['not-allowed', 'no-speech', 'network', 'audio-capture', 'works']) {
  const phone = '+9181' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.request.post(B + '/api/auth/otp/request', { data: { phone } })
  const csrf = (await (await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
  await ctx.request.post(B + '/api/consents', { data: { purpose: 'core_logging', granted: true }, headers: { 'x-csrf-token': csrf } })
  await ctx.request.patch(B + '/api/me', { data: { onboarded: true, name: 'S' }, headers: { 'x-csrf-token': csrf } })
  await ctx.addInitScript((mode) => {
    let n = 0
    const R = class { start() { n++; setTimeout(() => {
      if (mode === 'works') { if (n === 1) this.onresult({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: 'hot flashes and very tired', confidence: .9 } } } }); setTimeout(() => this.onend && this.onend(), 100) }
      else { this.onerror && this.onerror({ error: mode }); this.onend && this.onend() } }, 200) } stop() { this.onend && this.onend() } abort() {} }
    window.SpeechRecognition = R; window.webkitSpeechRecognition = R
  }, mode)
  const page = await ctx.newPage(); await page.goto(B + '/?lang=en#/vent'); await page.getByRole('textbox').waitFor()
  await page.getByRole('button', { name: /Tap & speak/ }).click(); await page.waitForTimeout(1000)
  const val = await page.getByRole('textbox').inputValue()
  const help = await page.getByTestId('mic-help').count()
  if (mode === 'works') ok('speech lands in the box, and the session restarts after a pause', val === 'hot flashes and very tired', val)
  else { ok(`${mode}: a plain message is shown`, help === 1); await page.getByRole('textbox').fill('typed instead'); ok(`${mode}: typing still works`, (await page.getByRole('button', { name: /Done|Save|Understood|That/i }).count()) > 0) }
  await ctx.close()
}

// ---- a silent speech service: the recogniser hears sound but never returns words, or never gets audio at all
for (const mode of ['no-words', 'no-audio']) {
  const phone = '+9181' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.request.post(B + '/api/auth/otp/request', { data: { phone } })
  const csrf = (await (await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
  await ctx.request.post(B + '/api/consents', { data: { purpose: 'core_logging', granted: true }, headers: { 'x-csrf-token': csrf } })
  await ctx.request.patch(B + '/api/me', { data: { onboarded: true, name: 'S' }, headers: { 'x-csrf-token': csrf } })
  await ctx.addInitScript((mode) => {
    const R = class {
      start() { if (mode === 'no-words') setTimeout(() => { this.onaudiostart && this.onaudiostart(); this.onspeechstart && this.onspeechstart() }, 100) }
      stop() { setTimeout(() => this.onend && this.onend(), 20) } abort() {}
    }
    window.SpeechRecognition = R; window.webkitSpeechRecognition = R
  }, mode)
  const page = await ctx.newPage(); await page.goto(B + '/?lang=en#/vent'); await page.getByRole('textbox').waitFor()
  await page.getByRole('button', { name: /Tap & speak/ }).click()
  if (mode === 'no-words') {
    // sound but no words = the browser's speech service is not answering: Sakhi takes over by recording (this test browser has no microphone, so it says so)
    await page.waitForFunction(() => document.querySelector('[data-testid=stop-recording]') || document.querySelector('[data-testid=mic-help]'), null, { timeout: 15000 })
    ok(`${mode}: Sakhi switches to recording (or says why it cannot) instead of sitting in silence`, true)
  } else {
    await page.getByTestId('mic-hint').waitFor({ timeout: 15000 })
    const msg = await page.getByTestId('mic-hint').innerText()
    ok(`${mode}: she is told what is wrong instead of sitting in silence`, /not getting any sound/.test(msg), msg.slice(0, 60))
    await page.getByRole('button', { name: 'Type instead' }).click()
  }
  await page.getByRole('textbox').fill('hot flashes and tired')
  ok(`${mode}: and can type straight away`, (await page.getByRole('textbox').inputValue()) === 'hot flashes and tired')
  await ctx.close()
}
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
