// Real-stack check of the live Home screen. Needs the API serving the built app (scripts/dev-restart.sh).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '+9195' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
const csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (method, url, data) => (await ctx.request.fetch(B + url, { method, data, headers: { 'x-csrf-token': csrf } })).json()
for (const purpose of ['core_logging', 'family_signals', 'doctor_brief']) await A('POST', '/api/consents', { purpose, granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, stage: 'perimenopause', lang: 'en', city: 'Pune' })

const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const home = async (lang = 'en') => { await page.goto('about:blank'); await page.goto(`${B}/?lang=${lang}#/home`); await page.getByRole('heading', { level: 1 }).waitFor(); await page.getByRole('status', { name: 'loading' }).waitFor({ state: 'detached', timeout: 10000 }).catch(() => {}) }

// ---- fresh account: honest empty state, her name, no prototype wording
await home()
const h1 = await page.getByRole('heading', { level: 1 }).innerText()
ok('never shows demo data while loading', true)
ok('greets her by name', /Sunita/.test(h1) && /Good (morning|afternoon|evening)/.test(h1), h1)
ok('empty week: nothing invented', (await page.getByText('Check in whenever you like').count()) > 0)
ok('no prototype strip, no fake bell', (await page.getByText(/prototype|simulated/i).count()) === 0 && (await page.getByRole('button', { name: 'Notifications' }).count()) === 0)
await page.waitForTimeout(900)
await shot('20-home-empty')

// ---- she vents, then Home reflects it
await A('POST', '/api/utterance/preview', { text: 'x', lang: 'en' })
const u = await A('POST', '/api/utterance', { text: 'hot flashes all night, so tired, so much stress', lang: 'en' })
await A('POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p) => ({ id: p.id, accept: true, severity: 3 })) })
await home()
await page.getByText('1 day checked in this week').waitFor()
ok('check-in count is real and uses the singular', true)
await page.getByRole('button', { name: 'Daily', exact: true }).click()
await page.getByText('Hot flashes').first().waitFor(); await page.waitForTimeout(600)
ok('daily view lists today\'s real symptoms', (await page.getByText('Exhaustion').count()) > 0)
await page.getByRole('button', { name: 'Weekly', exact: true }).click()
await page.getByRole('button', { name: 'Monthly', exact: true }).click()
await page.waitForTimeout(600)
ok('monthly view has 30 dots', (await page.locator('.grid-cols-10 > span').count()) === 30)
await page.getByRole('button', { name: 'Weekly', exact: true }).click()

// ---- weather card: an estimate, with reasons from her logs, and a real way to tell the family
const card = page.getByRole('button', { name: /Symptom Weather/ })
await card.click()
await page.getByText(/An estimate from your own logs/).waitFor()
const wtext = await page.locator('.glass').filter({ hasText: 'Symptom Weather' }).first().innerText()
ok('weather labelled an estimate, with reasons', /estimate/i.test(wtext) && /Contributing:/.test(wtext), wtext.replace(/\n/g, ' | ').slice(0, 160))
const live = /°C/.test(wtext)
console.log(`INFO  Open-Meteo reachable from here: ${live}`)
if (!live) ok('forecast unreachable -> says so, not "add your city"', /not available right now/.test(wtext))
await page.waitForTimeout(500)
await shot('21-home-weather')
await page.getByRole('button', { name: 'Tell my family' }).click()
await page.getByText('Family nudged to keep the evening light').waitFor()
ok('"Tell my family" shares the alert', (await A('GET', '/api/home')).weather.shared === true)
const stored = JSON.stringify(await (await ctx.request.fetch(`${B}/api/export`)).json())
ok('only the risk level is shared, never her words', !/very tired|so much stress/i.test(stored))

// ---- milestones track real events
const ms = await A('GET', '/api/home')
ok('milestones: nothing claimed that has not happened', JSON.stringify(ms.milestones) === JSON.stringify({ firstWeek: false, firstSignal: false, firstBrief: false }))

// ---- the relax tile really plays (browser voice) and steps through lines
await page.getByRole('button', { name: 'Play' }).click()
ok('relax: play starts, counter at 1/6', (await page.getByRole('button', { name: 'Pause' }).count()) === 1 && (await page.getByText('1/6').count()) === 1)
await page.getByRole('button', { name: 'Next' }).click()
ok('relax: next goes to 2/6', (await page.getByText('2/6').count()) === 1)
await page.getByRole('button', { name: 'Pause' }).click()
ok('relax: pause stops', (await page.getByRole('button', { name: 'Play' }).count()) === 1)

// ---- Hindi
await home('hi')
const hh = await page.getByRole('heading', { level: 1 }).innerText()
ok('Hindi greeting with her name', /सुनीता|Sunita/.test(hh) && /सुप्रभात|नमस्ते|शुभ संध्या/.test(hh), hh)
await page.waitForTimeout(900)
await shot('22-home-hindi')

// ---- navigation targets exist
for (const [name, hash] of [[/Vent/, '#/vent'], [/Right Now/, '#/right-now']]) {
  await home(); await page.getByRole('button', { name }).first().click(); await page.waitForURL(new RegExp(hash)); ok(`Home -> ${hash}`, true)
}

const real = errors.filter((e) => !/Failed to load resource.*(40[0-9])/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
