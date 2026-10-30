// Real-stack check: one-tap mood check-in is saved and shows on Home; Right Now runs 90s with voice cues, repeat and a real ending.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '+9196' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
const csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (method, url, data) => (await ctx.request.fetch(B + url, { method, data, headers: { 'x-csrf-token': csrf } })).json()
await A('POST', '/api/consents', { purpose: 'core_logging', granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, stage: 'perimenopause', lang: 'en' })

// record what the browser voice is asked to say (headless has no voices)
await ctx.addInitScript(() => {
  window.__spoken = []
  const synth = window.speechSynthesis; synth.getVoices = () => [{ name: 'Google English', lang: 'en-IN', localService: false }, { name: 'Google Hindi', lang: 'hi-IN', localService: false }]
  synth.speak = (u) => { u.text && window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 10) }
})
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
const go = async (hash, lang = 'en') => { await page.goto('about:blank'); await page.goto(`${B}/?lang=${lang}#/${hash}`) }

// ---- check-in
await go('checkin')
await page.getByRole('button', { name: 'Tired', exact: true }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/60-checkin.png` })
await page.getByRole('button', { name: 'Just save my mood' }).click()
await page.waitForURL(/#\/home/)
await page.getByText('1 day checked in this week').waitFor()
ok('mood check-in is saved and counted on Home', true)
const home = await A('GET', '/api/home')
ok('today shows the chosen mood (tired) with no symptoms invented', home.week.find((d) => d.kind === 'today').mood === 'tired' && home.todayTop.length === 0 && home.loggedToday === true)
ok('a second tap the same day replaces, not duplicates', (await A('POST', '/api/checkins', { mood: 'calm' })).ok === true && (await A('GET', '/api/home')).daysCheckedLast7 === 1)

// ---- Right Now
await page.clock.install()
await go('right-now')
await page.getByText('1:30').first().waitFor()
ok('starts at 1:30 (not half-way through)', true)
await page.clock.runFor(2000)
ok('voice says the first cue', (await page.evaluate(() => window.__spoken)).some((s) => /breathe in/i.test(s)), JSON.stringify(await page.evaluate(() => window.__spoken)))
await page.clock.runFor(4000)
ok('voice moves on to hold, then out', (await page.evaluate(() => window.__spoken.join('|'))).match(/hold/i) && (await page.evaluate(() => window.__spoken.join('|'))).match(/out/i))
await page.getByRole('button', { name: 'Pause' }).click()
const frozen = await page.getByText(/^\d:\d\d$/).first().innerText()
await page.clock.runFor(5000)
ok('pause really pauses', (await page.getByText(/^\d:\d\d$/).first().innerText()) === frozen, frozen)
await page.getByRole('button', { name: 'Play' }).click()
await page.clock.runFor(95_000)
await page.getByTestId('rn-done').waitFor()
ok('finishes with a closing message and a way home', (await page.getByTestId('rn-done').innerText()).includes('Well done') && (await page.evaluate(() => window.__spoken.join('|'))).includes('Well done'))
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/61-rightnow-done.png` })
await page.getByRole('button', { name: 'Do it again' }).click()
await page.getByText('1:30').first().waitFor()
ok('"Do it again" restarts from 1:30', true)
ok('no pretend buttons in the live exercise', (await page.getByRole('button', { name: 'Favourite' }).count()) === 0)

const real = errors.filter((e) => !/Failed to load resource.*(ERR_NETWORK_IO_SUSPENDED|40[0-9]|410)/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
