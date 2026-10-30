// Rehearsal Room as a real chat: she types or speaks, the other person answers what she said and speaks it, feedback at the end,
// the session is saved and reopens after a reload. Also the static build (no API: same engine in the browser).
import { chromium } from 'playwright'
const B = process.env.BASE_URL || 'http://localhost:8787'
const S = process.env.STATIC_URL
let failed = 0
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) failed++ }
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })

const speechStub = () => {
  window.__spoken = []
  const s = window.speechSynthesis
  s.getVoices = () => [{ name: 'Google Hindi', lang: 'hi-IN', localService: false }, { name: 'Google English', lang: 'en-IN', localService: false }]
  s.speak = (u) => { if (u.text) window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 10) }
  const R = class {
    start() { setTimeout(() => this.onresult({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: 'मुझे रात को पसीना आता है', confidence: 0.9 } } } }), 300) }
    stop() { setTimeout(() => this.onend && this.onend(), 30) } abort() {}
  }
  window.SpeechRecognition = R; window.webkitSpeechRecognition = R
  navigator.mediaDevices.getUserMedia = async () => new MediaStream()
}

async function signedIn(lang) {
  const phone = '+9188' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.request.post(B + '/api/auth/otp/request', { data: { phone } })
  const csrf = (await (await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone, code: '123456', birthYear: 1978, lang } })).json()).csrf
  const A = async (m, u, d) => (await ctx.request.fetch(B + u, { method: m, data: d, headers: { 'x-csrf-token': csrf } })).json()
  await A('POST', '/api/consents', { purpose: 'core_logging', granted: true })
  await A('PATCH', '/api/me', { onboarded: true, name: 'सुनीता', lang })
  await ctx.addInitScript(speechStub)
  return { ctx, A }
}
const bubbles = (page, who) => page.locator(`[data-who=${who}]`)

// ---- 1) Hindi, husband, full flow with the real server
{
  const { ctx, A } = await signedIn('hi')
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(B + '/?lang=hi#/rehearsal'); await page.getByTestId('past-empty').waitFor()
  await page.getByRole('button', { name: /रिहर्सल शुरू करें/ }).click()
  await bubbles(page, 'them').first().waitFor()
  ok('the other person opens the conversation, and it is spoken', (await bubbles(page, 'them').count()) === 1 && (await page.evaluate(() => window.__spoken.length)) >= 1)
  const box = page.locator('#rh-own')
  await box.fill('मुझे रात को नींद नहीं आती, मैं थक जाती हूँ')
  await page.getByRole('button', { name: /^कहें/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-who=them]').length >= 2)
  const r1 = await bubbles(page, 'them').nth(1).innerText()
  ok('she gets a reply to what she actually said (not a fixed script line)', /थकान/.test(r1), r1)
  ok('the reply is spoken aloud', await page.evaluate(() => window.__spoken.some((s) => /थकान/.test(s))))
  // by voice
  await page.getByRole('button', { name: /^बोलें/ }).click()
  await page.waitForFunction(() => document.querySelector('#rh-own')?.value.includes('पसीना'))
  await page.getByRole('button', { name: /बोलना रोकें/ }).click()
  await page.waitForFunction(() => !document.querySelector('#rh-own')?.readOnly)
  await page.getByRole('button', { name: /^कहें/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-who=them]').length >= 3)
  const r2 = await bubbles(page, 'them').nth(2).innerText()
  ok('by voice too, and the line is new', r2 !== r1, r2)
  await box.fill('मुझे लगता है कि मुझे हर शाम आपकी मदद चाहिए, कृपया')
  await page.getByRole('button', { name: /^कहें/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-who=them]').length >= 4)
  await box.fill('कृपया हर दिन खाना बनाने में मेरी मदद करें')
  await page.getByRole('button', { name: /^कहें/ }).click()
  await page.getByTestId('scene-done').waitFor({ timeout: 8000 })
  ok('after a clear request the scene ends on agreement', true)
  const lines = await bubbles(page, 'them').allInnerTexts()
  ok('no line was repeated', new Set(lines).size === lines.length, `${lines.length} lines`)
  await page.getByRole('button', { name: /खत्म करें और फ़ीडबैक/ }).click()
  await page.getByTestId('rh-feedback').waitFor()
  ok('feedback is shown', (await page.getByTestId('rh-feedback').locator('li').count()) === 4)
  await page.screenshot({ path: 'screenshots/live/74-rehearsal-chat.png' }).catch(() => {})
  const list = (await A('GET', '/api/rehearsal/sessions')).sessions
  ok('the session is saved in the database', list.length === 1 && list[0].turns === 4 && !!list[0].endedAt, JSON.stringify(list[0]))
  await page.reload(); await page.getByTestId('past-list').waitFor()
  ok('after a reload it is listed under Past rehearsals', (await page.getByTestId('past-list').locator('li').count()) === 1)
  await page.getByTestId('past-list').getByRole('button', { name: /देखें/ }).first().click()
  await page.getByTestId('rh-feedback').waitFor()
  ok('and can be reopened with its transcript', (await bubbles(page, 'me').count()) === 4)
  await page.getByRole('button', { name: /वापस/ }).click()
  await page.getByRole('button', { name: /हटाएँ/ }).first().click()
  await page.getByTestId('past-empty').waitFor()
  ok('and deleted', (await A('GET', '/api/rehearsal/sessions')).sessions.length === 0)
  ok('no page errors', errors.length === 0, JSON.stringify(errors))
  await ctx.close()
}

// ---- 2) English HR: crisis pauses the scene and shows helplines
{
  const { ctx, A } = await signedIn('en')
  const page = await ctx.newPage()
  await page.goto(B + '/?lang=en#/rehearsal'); await page.getByRole('button', { name: 'Start rehearsing' }).waitFor()
  await page.getByText('Ask HR').click()
  await page.getByRole('button', { name: 'Start rehearsing' }).click()
  await bubbles(page, 'them').first().waitFor()
  await page.locator('#rh-own').fill('I want to die')
  await page.getByRole('button', { name: 'Say it' }).click()
  await page.getByTestId('rh-crisis').waitFor()
  ok('a crisis phrase shows helplines and pauses the role-play', /112/.test(await page.getByTestId('rh-crisis').innerText()) && (await page.locator('#rh-own').count()) === 0)
  const sid = (await A('GET', '/api/rehearsal/sessions')).sessions[0]
  ok('the crisis phrase was not stored', (await A('GET', `/api/rehearsal/sessions/${sid.id}`)).turns.length === 1)
  await page.getByRole('button', { name: 'I am okay, continue practice' }).click()
  await page.locator('#rh-own').fill('Which tablet should I take for hot flashes?')
  await page.getByRole('button', { name: 'Say it' }).click()
  await page.getByTestId('rh-refusal').waitFor()
  ok('a request for medicine advice gets the policy reply, not a role-play answer', true)
  await ctx.close()
}

// ---- 3) static build, no API at all
if (S) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(speechStub)
  const page = await ctx.newPage()
  await page.goto(S + '/?lang=en#/rehearsal'); await page.getByRole('button', { name: 'Start rehearsing' }).waitFor()
  await page.getByRole('button', { name: 'Start rehearsing' }).click()
  await page.getByTestId('local-note').waitFor()
  ok('static build: a real chat that says it is saved on this device', true)
  await page.locator('#rh-own').fill('I feel tired and I cannot sleep at night')
  await page.getByRole('button', { name: 'Say it' }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-who=them]').length >= 2)
  ok('static build: the other person replies to what she said', /tired|alone|realise/i.test(await bubbles(page, 'them').nth(1).innerText()))
  await page.reload(); await page.getByTestId('past-list').waitFor()
  ok('static build: the session is still there after a reload', (await page.getByTestId('past-list').locator('li').count()) === 1)
  await ctx.close()
} else console.log('SKIP  static build checks (set STATIC_URL)')

await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
