// Real-stack check of the admin console on SEEDED data. It records a real review, so run it against a fresh seed: sh scripts/reseed.sh (ADMIN_KEY=admin-demo-key).
import { chromium } from 'playwright'
import { mkdirSync, promises as fs } from 'node:fs'

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

await page.goto(`${B}/#/admin`)
await page.getByLabel('Admin key').waitFor()
ok('nothing is shown before signing in', (await page.getByTestId('content-list').count()) === 0)
await page.getByLabel('Admin key').fill('definitely-wrong')
await page.getByRole('button', { name: 'Open console' }).click()
await page.getByRole('alert').waitFor()
ok('a wrong key is refused', /not valid/.test(await page.getByRole('alert').innerText()))
await page.getByLabel('Admin key').fill('admin-demo-key')
await page.getByRole('button', { name: 'Open console' }).click()
await page.getByTestId('review-summary').waitFor()
const summary = await page.getByTestId('review-summary').innerText()
const [, pending, total] = summary.match(/(\d+) of (\d+) items are pending clinician review/)
const already = await page.getByTestId('reviewed').count()
ok('honest: nothing is claimed reviewed except items with a recorded name and date (reviewed + pending = total)', Number(total) >= 20 && already + Number(pending) === Number(total) && (already === 0 || /Reviewed by .+ on \d{4}-\d{2}-\d{2}/.test(await page.getByTestId('reviewed').first().innerText())), `${already} reviewed, ${pending} pending`)
ok('it says draft versions are not served to users', /NOT served/.test(summary))
await page.screenshot({ path: `${OUT}/90-admin-content.png`, fullPage: false })

// recording a review needs a real name and a date that is not in the future
await page.getByTestId('pending').first().click()
await page.getByLabel('Reviewer full name').fill('Dr')
await page.getByLabel('Date of review').fill('2026-10-01')
await page.getByRole('button', { name: 'Record review' }).click()
await page.getByRole('alert').waitFor()
ok('a too-short reviewer name is refused', /full name/.test(await page.getByRole('alert').innerText()))
await page.getByLabel('Reviewer full name').fill('Dr Meera Joshi')
await page.getByLabel('Date of review').fill('2099-01-01')
await page.getByRole('button', { name: 'Record review' }).click()
await page.getByText(/cannot be dated in the future/).waitFor()
ok('a future-dated review is refused', true)
await page.getByLabel('Date of review').fill('2026-10-01')
await page.getByRole('button', { name: 'Record review' }).click()
await page.waitForFunction((n) => document.querySelectorAll('[data-testid=reviewed]').length === n, already + 1)
ok('a named, dated review is shown as such, and only that one item changes', (await page.getByTestId('reviewed').filter({ hasText: 'Dr Meera Joshi on 2026-10-01' }).count()) >= 1 && (await page.getByTestId('reviewed').count()) === already + 1)
const after = (await page.getByTestId('review-summary').innerText()).match(/(\d+) of (\d+) items are pending/)
ok('the pending count drops by exactly one', Number(after[1]) === Number(pending) - 1)

// pilot analytics + atlas
await page.getByRole('tab', { name: 'Pilot analytics' }).click()
await page.getByTestId('pilot').waitFor()
const pilot = await page.getByTestId('pilot').innerText()
ok('pilot figures are shown as hypotheses-to-test with a cohort over 10', /about \d+/.test(pilot) && (await page.getByText(/hypotheses to test, not results/).count()) > 0, pilot.replace(/\n/g, ' | ').slice(0, 200))
ok('figures that cannot be shown safely are hidden, not guessed (signal acceptance needs signals)', /Hidden \(under 10\)/.test(pilot))
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download Menopause Symptom Atlas/ }).click()])
const csv = await fs.readFile(await dl.path(), 'utf8')
const rows = csv.trim().split('\n')
ok('the Atlas CSV has only aggregate columns, rounded numbers, and hidden small cells', rows[0] === 'age_band,stage,symptom,users_reporting,users_in_cell,share_pct' && rows.length > 20 && rows.slice(1).every((r) => r.split(',').slice(3).every((c) => c === 'hidden' || Number(c) % 5 === 0)) && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(csv), `${rows.length - 1} rows`)
await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/91-admin-pilot.png` })

ok('a normal user session is not admin', (await (await browser.newContext()).request.get(`${B}/api/admin/content`)).status() === 401)
await page.getByRole('button', { name: 'Sign out' }).click()
await page.getByLabel('Admin key').waitFor()
ok('signing out closes the console', (await ctx.request.get(`${B}/api/admin/content`)).status() === 401)

const real = errors.filter((e) => !/Failed to load resource.*(ERR_NETWORK_IO_SUSPENDED|40[0-9]|410|503)/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
