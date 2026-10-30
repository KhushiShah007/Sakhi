// The browser's speech service is unreachable ("network" error). Vent must switch to recording her voice and writing it out on this
// device (Whisper in the browser), put the words in the box, show chips, and let her confirm and save.
// Needs the internet once, to download the speech model (about 80 MB, cached afterwards).
// SPEECH_WAV: a WAV of someone saying a sentence (made with Windows System.Speech in this repo's dev setup). Defaults to scripts/fixtures/speech.wav.
import { chromium } from 'playwright'
const B = process.env.BASE_URL || 'http://localhost:8787'
const S = process.env.STATIC_URL
const WAV = process.env.SPEECH_WAV || new URL('./fixtures/speech.wav', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
let failed = 0
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) failed++ }
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}`] })

// a recogniser that behaves like Brave / a blocked Google service: it starts, then fails with "network"
const brokenService = () => {
  const R = class { start() { setTimeout(() => { this.onerror && this.onerror({ error: 'network' }); this.onend && this.onend() }, 300) } stop() { setTimeout(() => this.onend && this.onend(), 20) } abort() {} }
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R
}

async function run(label, url, signedIn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
  if (signedIn) {
    const phone = '+9182' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
    await ctx.request.post(B + '/api/auth/otp/request', { data: { phone } })
    const csrf = (await (await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
    await ctx.request.post(B + '/api/consents', { data: { purpose: 'core_logging', granted: true }, headers: { 'x-csrf-token': csrf } })
    await ctx.request.patch(B + '/api/me', { data: { onboarded: true, name: 'S' }, headers: { 'x-csrf-token': csrf } })
  }
  await ctx.addInitScript(brokenService)
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(url + '/?lang=en#/vent'); await page.getByRole('textbox').waitFor()
  await page.getByRole('button', { name: /Tap & speak/ }).click()
  // the service fails -> recording takes over by itself
  await page.getByTestId('stop-recording').waitFor({ timeout: 15000 })
  ok(`${label}: when the speech service fails, Sakhi records instead`, true)
  await page.waitForTimeout(6500)                       // let the spoken sentence play into the microphone
  await page.getByTestId('stop-recording').click()
  await page.getByTestId('stt-busy').waitFor({ timeout: 10000 })
  ok(`${label}: it shows that it is getting the tool ready / writing it out`, true)
  await page.waitForFunction(() => (document.querySelector('textarea')?.value ?? '').length > 5, null, { timeout: 280000 })
  const text = await page.getByRole('textbox').inputValue()
  ok(`${label}: the words she said are written into the box`, /hot|flash|night|tired|sleep/i.test(text), JSON.stringify(text))
  await page.waitForFunction(() => document.querySelectorAll('.glass-strong').length >= 1, null, { timeout: 15000 }).catch(() => {})
  ok(`${label}: symptom chips appear from the written words`, (await page.locator('.glass-strong').count()) >= 1)
  await page.getByRole('button', { name: /Done speaking/ }).first().click()
  await page.getByRole('checkbox').first().waitFor()
  await page.getByRole('button', { name: /Yes, save/ }).last().click()
  await page.getByTestId('reflection').waitFor()
  ok(`${label}: she confirms, saves, and gets a reflection`, true)
  const real = errors.filter((e) => !/Failed to load resource/.test(e))
  ok(`${label}: no page errors`, real.length === 0, JSON.stringify(real).slice(0, 300))
  await ctx.close()
}

await run('full app', B, true)
if (S) await run('static site', S, false); else console.log('SKIP  static site (set STATIC_URL)')
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
