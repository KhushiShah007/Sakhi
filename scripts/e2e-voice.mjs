// Real-browser check of the voice paths. No ElevenLabs key is needed: /healthz and /api/tts are intercepted for the server-voice cases.
import { chromium } from 'playwright'

const B = process.env.BASE_URL || 'http://localhost:8787'
const phone = '+9195' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

// 0.1s of silence as a valid WAV, so <audio> can really play it
const wav = (() => { const n = 800, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b })()

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
async function session() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
  const csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
  for (const purpose of ['core_logging']) await ctx.request.post(`${B}/api/consents`, { data: { purpose, granted: true }, headers: { 'x-csrf-token': csrf } })
  await ctx.request.patch(`${B}/api/me`, { data: { onboarded: true, name: 'Sunita' }, headers: { 'x-csrf-token': csrf } })
  // a fake speech engine that records exactly how it was asked to speak
  await ctx.addInitScript(() => {
    window.__utts = []
    const synth = window.speechSynthesis
    const voices = [{ name: 'Basic English', lang: 'en-IN', localService: true }, { name: 'Microsoft Neerja Online (Natural) - English (India)', lang: 'en-IN', localService: false }, { name: 'Basic Hindi', lang: 'hi-IN' }]
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; this.voice = null } }
    synth.getVoices = () => voices
    synth.speak = (u) => { window.__utts.push({ text: u.text, rate: u.rate, pitch: u.pitch, voice: u.voice && u.voice.name, at: performance.now() }); setTimeout(() => u.onend && u.onend(), 30) }
  })
  return ctx
}
const open = async (page, hash) => { await page.goto('about:blank'); await page.goto(`${B}/?lang=en#/${hash}`) }

// ---------- 1. browser voice: calm settings, best voice, pauses between sentences
{
  const ctx = await session(); const page = await ctx.newPage()
  await open(page, 'right-now')
  await page.getByText('1:30').first().waitFor()
  await page.waitForFunction(() => window.__utts.length > 0)
  const first = (await page.evaluate(() => window.__utts))[0]
  ok('first cue is spoken with the browser voice', first.text === 'Breathe in', JSON.stringify(first))
  ok('slow rate (0.8) and natural pitch', first.rate === 0.8 && first.pitch === 1)
  ok('picks the natural-sounding voice over the basic one', /Natural/.test(first.voice || ''), first.voice)
  await page.evaluate(() => { window.__utts.length = 0 })
  await page.evaluate(() => document.querySelector('[aria-label="Forward 10 seconds"]').click())
  // the finishing message has two sentences: they must be spoken separately with a pause
  await page.getByRole('button', { name: 'Forward 10 seconds' }).click({ clickCount: 9, delay: 5 })
  await page.getByTestId('rn-done').waitFor()
  await page.waitForFunction(() => window.__utts.some((u) => /Notice how/.test(u.text)))
  const u = await page.evaluate(() => window.__utts.filter((x) => /Well done|Notice how/.test(x.text)))
  ok('multi-sentence text is spoken one sentence at a time', u.length === 2 && u[0].text === 'Well done.' && /Notice how your body feels now\./.test(u[1].text), JSON.stringify(u.map((x) => x.text)))
  ok('with a pause (>= 500 ms) between the sentences', u.length === 2 && u[1].at - u[0].at >= 500, `${Math.round(u[1].at - u[0].at)} ms`)
  await ctx.close()
}

// ---------- 2. server voice (key configured): audio comes from /api/tts, the browser voice stays silent
{
  const ctx = await session(); const page = await ctx.newPage()
  const asked = []
  // this headless Chromium cannot decode audio at all, so use a stand-in clip player that behaves like a real one
  await ctx.addInitScript(() => { window.__played = []; window.Audio = class { constructor(src) { this.src = src } play() { window.__played.push(String(this.src).slice(0, 5)); setTimeout(() => this.onended && this.onended(), 40); return Promise.resolve() } pause() {} } })
  await page.route('**/healthz', async (r) => { const j = await (await r.fetch()).json(); r.fulfill({ json: { ...j, tts: 'server' } }) })
  await page.route('**/api/tts', (r) => { asked.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }) })
  await open(page, 'right-now')
  await page.waitForFunction(() => true); await page.waitForTimeout(1500)
  ok('asks the server for the cue, with text and language only', asked.length > 0 && asked[0].text === 'Breathe in' && asked[0].lang === 'en' && Object.keys(asked[0]).sort().join() === 'lang,text', JSON.stringify(asked[0]))
  ok('the server clip is played and the browser voice stays quiet', (await page.evaluate(() => window.__played.length)) > 0 && (await page.evaluate(() => window.__utts.length)) === 0, JSON.stringify(await page.evaluate(() => ({ played: window.__played, utts: window.__utts.map((x) => x.text) }))))
  const before = asked.length
  await page.getByRole('button', { name: 'Repeat' }).click(); await page.waitForTimeout(800)
  ok('a repeated cue is served from the client cache (no second request)', asked.length === before, `${before} -> ${asked.length}`)
  await ctx.close()
}

// ---------- 3. server voice fails: the browser voice takes over, nothing breaks
{
  const ctx = await session(); const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/healthz', async (r) => { const j = await (await r.fetch()).json(); r.fulfill({ json: { ...j, tts: 'server' } }) })
  await page.route('**/api/tts', (r) => r.fulfill({ status: 502, json: { error: 'tts_failed' } }))
  await open(page, 'right-now')
  await page.waitForFunction(() => window.__utts.length > 0, null, { timeout: 8000 })
  const first = (await page.evaluate(() => window.__utts))[0]
  ok('falls back to the calm browser voice (once, not twice)', (await page.evaluate(() => window.__utts.filter((x) => x.text === 'Breathe in').length)) === 1 && first.text === 'Breathe in' && first.rate === 0.8 && first.pitch === 1, JSON.stringify(first))
  ok('no page errors', errors.length === 0, JSON.stringify(errors))
  await ctx.close()
}

await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
