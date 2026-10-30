// Right Now speaks sparingly (not ~22 cues in 90 s), and a device with no voice shows text and a note instead of silence.
import { chromium } from 'playwright'
const B = process.env.BASE_URL || 'http://localhost:8787'
let failed = 0
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) failed++ }
const browser = await chromium.launch()
async function session(voices) {
  const phone = '+9186' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.request.post(B + '/api/auth/otp/request', { data: { phone } })
  const csrf = (await (await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
  await ctx.request.post(B + '/api/consents', { data: { purpose: 'core_logging', granted: true }, headers: { 'x-csrf-token': csrf } })
  await ctx.request.patch(B + '/api/me', { data: { onboarded: true, name: 'S' }, headers: { 'x-csrf-token': csrf } })
  await ctx.addInitScript((voices) => {
    window.__spoken = []
    const s = window.speechSynthesis
    s.getVoices = () => voices
    s.speak = (u) => { if (u.text) window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 10) }
  }, voices)
  return ctx
}

// 1) Right Now over its full 90 seconds
{
  const ctx = await session([{ name: 'Google English', lang: 'en-IN', localService: false }])
  const page = await ctx.newPage()
  await page.clock.install()
  await page.goto(B + '/?lang=en#/right-now'); await page.getByText('1:30').first().waitFor()
  for (let i = 0; i < 100; i++) { await page.clock.fastForward(1000); await page.waitForTimeout(15) }
  await page.getByTestId('rn-done').waitFor()
  const said = await page.evaluate(() => window.__spoken)
  ok('Right Now spoke far less than once per phase change', said.length <= 10, `${said.length} lines`)
  ok('the first two breath cycles have the full cue', JSON.stringify(said.slice(0, 6)) === JSON.stringify(['Breathe in', 'Hold softly', 'Breathe out', 'Breathe in', 'Hold softly', 'Breathe out']), said.slice(0, 6).join('|'))
  ok('never the same line twice in a row', said.every((s, i) => i === 0 || s !== said[i - 1]))
  ok('it ends with the closing line and stops', said.slice(-2).join(' ') === 'Well done. Notice how your body feels now.')
  await ctx.close()
}
// 2) a device with no voice at all
{
  const ctx = await session([])
  const page = await ctx.newPage()
  await page.goto(B + '/?lang=en#/3am'); await page.getByTestId('clock').waitFor()
  await page.getByRole('button', { name: /Guide me back to sleep/ }).first().click()
  await page.getByTestId('voice-note').waitFor({ timeout: 8000 })
  ok('no voice: the reason is shown, not silence', /not available on this device/.test(await page.getByTestId('voice-note').innerText()))
  ok('no voice: the words are shown on screen', (await page.getByTestId('guide-caption').innerText()).length > 10)
  ok('nothing was spoken', (await page.evaluate(() => window.__spoken.length)) === 0)
  await ctx.close()
}
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
