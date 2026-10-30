// Real-stack check of Sakhi for Workplaces on the SEEDED data (run `npm run seed` first; see scripts/reseed.sh).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

// ---------- HR login
await page.goto(`${B}/#/hr`)
await page.getByLabel('HR access code').waitFor()
ok('HR sees a login, not data, before signing in', (await page.getByTestId('kpi-participation').count()) === 0)
await page.getByLabel('HR access code').fill('not-the-right-code')
await page.getByRole('button', { name: 'Open dashboard' }).click()
await page.getByRole('alert').waitFor()
ok('a wrong code is refused', /not valid/.test(await page.getByRole('alert').innerText()))
await page.getByLabel('HR access code').fill('NAVRANG-HR-DEMO')
await page.getByRole('button', { name: 'Open dashboard' }).click()
await page.getByTestId('kpi-participation').waitFor()
await page.waitForTimeout(2200)
await page.screenshot({ path: `${OUT}/80-hr.png`, fullPage: true })

// ---------- what HR sees
const num = async (id) => (await page.getByTestId(id).innerText()).trim()
const pct = parseInt(await num('kpi-participation'), 10)
ok('participation is a rounded percentage (multiple of 5)', pct > 0 && pct % 5 === 0, `${pct}%`)
const sub = await page.getByTestId('kpi-participation').locator('xpath=following-sibling::div').innerText()
const participants = parseInt(sub.match(/about (\d+)/)[1], 10)
ok('participants are rounded to 5 and exceed 250 of the 308 synthetic members, but never all of them (non-consenting are excluded)', participants % 5 === 0 && participants > 250 && participants < 308, String(participants))
ok('wellbeing index is shown (indicative)', /^\d+$/.test(await num('kpi-wellbeing')))
const locs = await page.getByTestId('locations').innerText()
ok('big sites are shown with rounded counts', /Pune HQ[\s\S]*about 1[0-9]{2}/.test(locs) && /Mumbai office[\s\S]*about \d+/.test(locs) && /Nashik plant[\s\S]*about \d+/.test(locs), locs.replace(/\n/g, ' | ').slice(0, 220))
const rowText = async (name) => (await page.getByTestId('locations').locator('li', { hasText: name }).innerText()).replace(/\n/g, ' ')
ok('the two small sites are hidden, and their rows contain no number at all', (await page.getByTestId('loc-hidden').count()) === 2 && !/\d/.test((await rowText('Ahmedabad branch')).replace('10 people', '')) && !/\d/.test((await rowText('Surat warehouse')).replace('10 people', '')), await rowText('Surat warehouse'))
const body = await page.locator('body').innerText()
ok('no names, no person-level data anywhere on the page', !/Sunita|Rajesh|Anaya|Meena|\+91|@/.test(body))
ok('themes are shown as shares of participants', (await page.getByTestId('themes').count()) === 1)

// ---------- export is the same suppressed data
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export report' }).click()])
const csv = (await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8'))
ok('CSV export carries the same rounded numbers and marks hidden cells as hidden', /participants_rounded,\d+/.test(csv) && /location_Surat warehouse_participants,hidden/.test(csv) && /k_anonymity_threshold,10/.test(csv))
ok('CSV has no individual rows', !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(csv) && csv.split('\n').length < 60)

// ---------- HR cannot reach employee data through the user API
const sneaky = await ctx.request.get(`${B}/api/me`)
ok('the HR session grants nothing on the employee API', sneaky.status() === 401)

// ---------- sign out
await page.getByRole('button', { name: 'Sign out' }).click()
await page.getByLabel('HR access code').waitFor()
ok('signing out closes the dashboard', (await ctx.request.get(`${B}/api/hr/summary`)).status() === 401)

// ---------- an employee opts in from the privacy centre (Sunita, the seeded demo user)
const u = await browser.newContext({ viewport: { width: 390, height: 844 } })
await u.request.post(`${B}/api/auth/otp/request`, { data: { phone: '+919999900001' } })
const csrf = (await (await u.request.post(`${B}/api/auth/otp/verify`, { data: { phone: '+919999900001', code: '123456' } })).json()).csrf
const up = await u.newPage()
up.on('pageerror', (e) => errors.push(String(e)))
await up.goto(`${B}/?lang=en#/privacy`)
await up.getByTestId('workplace').waitFor()
await up.getByTestId('workplace').getByLabel('Employer code').fill('NAVRANG')
await up.getByRole('button', { name: 'Find' }).click()
await up.getByText('Navrang Textiles (fictional)').waitFor()
await up.getByRole('button', { name: 'Pune HQ' }).click()
await up.getByRole('button', { name: 'Join anonymously' }).click()
await up.getByText(/You are counted in Navrang Textiles/).waitFor()
ok('an employee joins anonymously with the employer code and picks her site', true)
const mem = await (await u.request.get(`${B}/api/employer/membership`)).json()
ok('membership is recorded', mem.membership?.location === 'Pune HQ')
await up.screenshot({ path: `${OUT}/81-workplace-optin.png` })
await up.getByRole('button', { name: 'Leave the programme' }).click()
await up.getByLabel('Employer code').waitFor()
ok('she can leave at any time', (await (await u.request.get(`${B}/api/employer/membership`)).json()).membership === null)
void csrf

const real = errors.filter((e) => !/Failed to load resource.*(ERR_NETWORK_IO_SUSPENDED|40[0-9]|410)/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
