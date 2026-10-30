// Real-stack check: Welcome -> login (under-18 blocked) -> consent -> onboarding (+ family) -> home -> reload keeps session.
// Needs: `npm run build` then `DEMO_AUTH=true npm run api` (serves the web app too). BASE_URL to override.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '98' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })

await page.goto(`${B}/?lang=en`)
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /./ }).filter({ has: page.locator('svg') }).last().click().catch(() => {})
await page.waitForURL(/#\/login/, { timeout: 8000 }).catch(() => {})
ok('welcome leads to login', /#\/login/.test(page.url()), page.url())
await shot('01-login')

// under-18 must be refused and nothing stored
await page.getByLabel('Your mobile number').fill('9' + phone.slice(1).replace(/^./, '7'))
await page.getByRole('button', { name: 'Send code' }).click()
await page.getByLabel('6-digit code').fill('123456')
await page.getByLabel('Year of birth').fill(String(new Date().getFullYear() - 15))
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('alert').waitFor()
ok('under-18 refused', (await page.getByRole('alert').innerText()).includes('18+'))
await shot('02-under18')

// adult
await page.reload()
await page.getByLabel('Your mobile number').fill(phone)
await page.getByRole('button', { name: 'Send code' }).click()
await page.getByText('Demo mode').waitFor()
ok('demo hint is shown', true)
await page.getByLabel('6-digit code').fill('000000')
await page.getByLabel('Year of birth').fill('1978')
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('alert').waitFor()
ok('wrong code refused', (await page.getByRole('alert').innerText()).includes('did not work'))
await page.getByLabel('6-digit code').fill('123456')
await page.getByRole('button', { name: 'Continue' }).click()

await page.waitForURL(/#\/consent/)
ok('consent comes before onboarding', true)
await shot('03-consent')
const core = page.getByRole('switch', { name: 'Save the symptoms I confirm' })
ok('core consent is on and required', (await core.getAttribute('aria-checked')) === 'true')
ok('optional consents start off (research, audio)', (await page.getByRole('switch', { name: 'Keep my voice recordings' }).getAttribute('aria-checked')) === 'false')
await page.getByRole('button', { name: 'Save my choices' }).click()

await page.waitForURL(/#\/onboarding/)
await shot('04-onboarding-1')
await page.getByRole('button', { name: /^मराठी/ }).click()
await page.getByRole('button', { name: /^English/ }).click()
await page.getByLabel('What should we call you?').fill('Sunita')
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('button', { name: /Perimenopause/i }).first().click()
await page.getByLabel(/city/i).or(page.getByPlaceholder(/Pune/)).first().fill('Pune')
await shot('05-onboarding-2')
await page.getByRole('button', { name: 'Continue' }).click()

// people: husband with a phone, teen without
await page.getByLabel('Their name').fill('Rajesh')
await page.getByLabel('WhatsApp number (optional)').fill('9811111111')
await page.getByRole('button', { name: 'Add this person' }).click()
await page.getByTestId('person-link').first().waitFor()
await page.getByRole('button', { name: 'Teen (under 18)' }).click()
await page.getByLabel('Their name').fill('Anaya')
ok('teen has no phone field', (await page.getByLabel('WhatsApp number (optional)').count()) === 0)
await page.getByRole('button', { name: 'Add this person' }).click()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="person-link"]').length === 2)
const links = await page.getByTestId('person-link').allInnerTexts()
ok('two family links created', links.length === 2 && links.every((l) => /#\/f\//.test(l)))
await shot('06-onboarding-3')
await page.getByRole('button', { name: 'Finish' }).click()
await page.getByText('Welcome, Sunita.').waitFor()
await shot('07-welcome-done')
await page.getByRole('button', { name: 'Go to my home' }).click()
await page.waitForURL(/#\/home/)

ok('no "Prototype" strip in the live app', (await page.getByText(/prototype/i).count()) === 0)
await page.reload()
await page.waitForURL(/#\/home/)
ok('session survives reload (stays on home)', /#\/home/.test(page.url()))
await shot('08-home')

// the family link created in onboarding opens, as the family member
const fam = await ctx.newPage()
await fam.goto(links[0].trim().replace(/^https?:\/\/[^/]+/, B))
await fam.getByText(/added you to Sakhi|सुनीता|Sunita/).first().waitFor()
ok('family link opens', true)
const teen = await ctx.newPage()
await teen.goto(links[1].trim().replace(/^https?:\/\/[^/]+/, B))
await teen.getByText(/short reads/).first().waitFor()
ok('teen link is content-only', (await teen.getByRole('button', { name: /Done/ }).count()) === 0)

const realErrors = errors.filter((e) => !/410|Failed to load resource.*(ERR_NETWORK_IO_SUSPENDED|40[134])/.test(e))
ok('no unexpected console errors', realErrors.length === 0, JSON.stringify(realErrors))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
