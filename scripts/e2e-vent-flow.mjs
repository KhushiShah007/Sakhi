// Vent end to end with a fake SpeechRecognition: words appear live, chips, confirm, save, reflection, History after reload.
// Also: language fallback (Marathi not supported on the device -> Hindi), and the static/offline build (no API: same rules in the browser, kept on this device).
// STATIC_URL (optional) points at a static preview of dist, e.g. http://localhost:4173
import { chromium } from 'playwright'
const B = process.env.BASE_URL || 'http://localhost:8787'
const S = process.env.STATIC_URL
let failed = 0
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) failed++ }
const SAID = 'मुझे रात को बहुत गर्मी लगती है और नींद नहीं आती, मैं बहुत थक जाती हूँ'

const fake = (opts) => {
  window.__langs = []
  const R = class {
    start() {
      window.__langs.push(this.lang)
      if (opts.unsupported && opts.unsupported.includes(this.lang)) { setTimeout(() => { this.onerror && this.onerror({ error: 'language-not-supported' }); this.onend && this.onend() }, 50); return }
      setTimeout(() => this.onresult({ resultIndex: 0, results: { length: 1, 0: { isFinal: false, 0: { transcript: 'मुझे रात को बहुत गर्मी', confidence: 0 } } } }), 200)
      setTimeout(() => this.onresult({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: opts.said, confidence: 0.9 } } } }), 700)
    }
    stop() { setTimeout(() => this.onend && this.onend(), 50) }
    abort() {}
  }
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R
  // a microphone for the level meter
  navigator.mediaDevices.getUserMedia = async () => new MediaStream()
}

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })

async function signedIn(lang = 'hi') {
  const phone = '+9187' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.request.post(B + '/api/auth/otp/request', { data: { phone } })
  const csrf = (await (await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone, code: '123456', birthYear: 1978, lang } })).json()).csrf
  const A = async (m, u, d) => (await ctx.request.fetch(B + u, { method: m, data: d, headers: { 'x-csrf-token': csrf } })).json()
  await A('POST', '/api/consents', { purpose: 'core_logging', granted: true })
  await A('PATCH', '/api/me', { onboarded: true, name: 'सुनीता', lang })
  return { ctx, A }
}

// ---- 1) full app, Hindi
{
  const { ctx, A } = await signedIn('hi')
  await ctx.addInitScript(fake, { said: SAID })
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(B + '/?lang=hi#/vent'); await page.getByRole('textbox').waitFor()
  await page.getByRole('button', { name: /छूकर बोलिए|टॅप करून|Tap/i }).first().click()
  await page.getByTestId('level-meter').waitFor()
  ok('a level meter and timer are shown while listening', true)
  await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('मुझे रात को बहुत गर्मी'))
  ok('interim words appear live', true)
  await page.waitForFunction((s) => document.querySelector('textarea')?.value === s, SAID)
  ok('the final words are in the box', true)
  await page.waitForFunction(() => document.querySelectorAll('.glass-strong').length >= 1, null, { timeout: 8000 })
  ok('symptom chips appear from what she said', (await page.locator('.glass-strong').count()) >= 1)
  await page.getByRole('button', { name: /बोल लिया|Done speaking/i }).first().click()
  await page.getByRole('checkbox').first().waitFor()
  const n = await page.getByRole('checkbox').count()
  ok('the confirm list shows what she said, nothing saved yet', n >= 1 && (await A('GET', '/api/logs')).logs.length === 0, `${n} items`)
  await page.getByRole('button', { name: /हाँ, सहेज|Yes, save/i }).last().click()
  await page.getByTestId('reflection').waitFor()
  ok('a reflection is shown', (await page.getByTestId('reflection').innerText()).length > 10)
  const logs = (await A('GET', '/api/logs')).logs
  ok('the entries are saved in the database', logs.length === n, `${logs.length} rows`)
  await page.goto(B + '/?lang=hi#/history'); await page.reload(); await page.waitForTimeout(1500)
  ok('they are still there after a reload', (await (await ctx.request.get(B + '/api/logs')).json()).logs.length === n)
  ok('no page errors', errors.length === 0, JSON.stringify(errors))
  await ctx.close()
}

// ---- 2) Marathi is not supported by this device's recogniser: falls back to Hindi and says so
{
  const { ctx } = await signedIn('mr')
  await ctx.addInitScript(fake, { said: SAID, unsupported: ['mr-IN'] })
  const page = await ctx.newPage()
  await page.goto(B + '/?lang=mr#/vent'); await page.getByRole('textbox').waitFor()
  await page.getByRole('button').filter({ hasText: /टॅप करून|Tap/ }).first().click()
  await page.waitForFunction((s) => document.querySelector('textarea')?.value === s, SAID)
  const langs = await page.evaluate(() => window.__langs)
  ok('it tried mr-IN, then listened in hi-IN', langs[0] === 'mr-IN' && langs.includes('hi-IN'), langs.join(','))
  ok('and told her which language it is using', (await page.getByTestId('lang-fallback').count()) === 1)
  await ctx.close()
}

// ---- 3) static build, no API at all
if (S) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(fake, { said: SAID })
  const page = await ctx.newPage()
  await page.goto(S + '/#/vent'); await page.getByRole('textbox').waitFor()
  ok('static build: the real recording screen, not the scripted animation', (await page.getByTestId('local-note').count()) === 1)
  await page.getByRole('button', { name: /छूकर बोलिए|टॅप करून|Tap/i }).first().click()
  await page.waitForFunction((s) => document.querySelector('textarea')?.value === s, SAID)
  await page.waitForFunction(() => document.querySelectorAll('.glass-strong').length >= 1, null, { timeout: 8000 })
  ok('static build: chips come from her words (rules run in the browser)', true)
  await page.getByRole('button', { name: /बोल लिया|Done speaking/i }).first().click()
  await page.getByRole('checkbox').first().waitFor()
  await page.getByRole('button', { name: /हाँ, सहेज|Yes, save/i }).last().click()
  await page.getByTestId('reflection').waitFor()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sakhi.local.logs') || '[]'))
  ok('static build: saved on this device', saved.length >= 1, `${saved.length} entries`)
  // a crisis phrase is caught in the browser too
  await page.goto('about:blank'); await page.goto(S + '/#/vent'); await page.getByRole('textbox').waitFor()
  await page.getByRole('textbox').fill('I want to die')
  await page.getByText('112').first().waitFor({ timeout: 8000 })
  ok('static build: a crisis phrase shows helplines', true)
  await ctx.close()
} else console.log('SKIP  static build checks (set STATIC_URL)')

await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
