// Real-stack check of live Vent Mode. Needs the API serving the built app (see scripts/dev-restart.sh).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '+9197' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
let csrf = ''
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (method, url, data) => {
  const r = await ctx.request.fetch(B + url, { method, data, headers: { 'x-csrf-token': csrf } })
  return r.json()
}
for (const purpose of ['core_logging', 'family_signals', 'doctor_brief']) await A('POST', '/api/consents', { purpose, granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, stage: 'perimenopause', lang: 'en' })

const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const open = async (lang = 'en') => { await page.goto('about:blank'); await page.goto(`${B}/?lang=${lang}#/vent`); await page.getByRole('textbox').waitFor() }

// ---------- 1. typed vent: live chips -> confirm/correct -> save -> reflection
await open()
await page.getByRole('textbox').fill('Hot flashes all night and I am very tired. So much stress at work.')
await page.getByText('Hot flashes').first().waitFor({ timeout: 8000 })
await page.getByText('Exhaustion').first().waitFor({ timeout: 8000 })
ok('live chips appear while typing', true)
await page.waitForTimeout(700)
await shot('10-vent-chips')
await page.getByRole('button', { name: 'Done speaking' }).click()
await page.getByText('Did I get this right?').waitFor()
ok('nothing saved before she confirms', (await A('GET', '/api/logs')).logs.length === 0)
await shot('11-vent-confirm')
// untick exhaustion; raise hot flashes to severe
await page.getByRole('checkbox', { name: /Exhaustion/ }).click()
const hot = page.getByRole('button', { name: /Hot flashes: / })
const before = await hot.getAttribute('aria-label')
await hot.click()
ok('severity can be corrected', (await hot.getAttribute('aria-label')) !== before, `${before} -> ${await hot.getAttribute('aria-label')}`)
await page.getByRole('button', { name: 'Yes, save it' }).click()
await page.getByTestId('reflection').waitFor()
ok('reflection shown', (await page.getByTestId('reflection').innerText()).length > 20)
await shot('12-vent-reflect')
const logs = (await A('GET', '/api/logs')).logs
ok('only confirmed entries saved', logs.length >= 1 && !logs.some((l) => l.symptom === 'fatigue'), JSON.stringify(logs.map((l) => `${l.symptom}:${l.severity}:${l.trigger}`)))
ok('trigger saved with the log', logs.some((l) => l.trigger === 'stress'))
const exp = JSON.stringify(await A('GET', '/api/export'))
ok('her words are not in the export', !/very tired|so much stress|all night/i.test(exp))

// ---------- 2. crisis interrupts, nothing stored
const countBefore = (await A('GET', '/api/logs')).logs.length
await open()
await page.getByRole('textbox').fill('I am so tired of everything and I want to die')
await page.getByTestId('crisis-message').waitFor({ timeout: 8000 })
await shot('13-vent-crisis')
const tel = await page.locator('a[href^="tel:"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
ok('crisis screen shows helplines 112 and 14416', tel.includes('tel:112') && tel.includes('tel:14416'), tel.join(','))
ok('crisis screen offers no save/confirm', (await page.getByRole('button', { name: 'Yes, save it' }).count()) === 0)
await page.getByRole('button', { name: 'I am safe, go back' }).click()
ok('crisis stored nothing', (await A('GET', '/api/logs')).logs.length === countBefore)

// ---------- 3. refusal (HRT advice)
await open()
await page.getByRole('textbox').fill('Should I start HRT?')
await page.getByRole('button', { name: 'Done speaking' }).click()
await page.getByTestId('refusal').waitFor()
const ref = await page.getByTestId('refusal').innerText()
ok('refusal defers to a doctor, no advice', /doctor/i.test(ref) && !/\d+\s?mg/i.test(ref), ref.slice(0, 90))
await shot('14-vent-refusal')

// ---------- 4. Hindi
await open('hi')
await page.getByRole('textbox').fill('रात को नींद नहीं आई और बहुत थकान है, घुटनों में दर्द है')
await page.getByText('जोड़ों में दर्द').first().waitFor({ timeout: 8000 })
ok('Hindi: chips in Hindi', (await page.getByText('थकान').count()) > 0 && (await page.getByText('ख़राब नींद').count()) > 0)
await page.waitForTimeout(700)
await shot('15-vent-hindi')

// ---------- 5. nothing detected
await open()
await page.getByRole('textbox').fill('Today I went to the market and bought some vegetables')
await page.getByRole('button', { name: 'Done speaking' }).click()
await page.getByRole('status').filter({ hasText: 'could not pick out' }).waitFor()
ok('no symptom -> asks to edit or save nothing, never invents one', (await page.getByRole('button', { name: 'Save nothing' }).count()) === 1)

// ---------- 6. consent withdrawn blocks saving but keeps help available
await A('POST', '/api/consents', { purpose: 'core_logging', granted: false })
await open()
await page.getByRole('textbox').fill('hot flashes again today')
await page.getByRole('button', { name: 'Done speaking' }).click()
await page.getByRole('alert').waitFor()
ok('withdrawn consent blocks saving with a clear message', /switched off/i.test(await page.getByRole('alert').innerText()))
await page.getByRole('textbox').fill('I want to die')
await page.getByTestId('crisis-message').waitFor({ timeout: 8000 })
ok('...but crisis help still appears', true)

const real = errors.filter((e) => !/Failed to load resource.*(40[0-9]|ERR_NETWORK_IO_SUSPENDED)/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
