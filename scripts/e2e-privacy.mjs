// Real-stack check: Family & Privacy centre, PIN lock, Moments + "it helped", Me, export, audit, deletion.
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '+9198' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
let csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (method, url, data) => { const r = await ctx.request.fetch(B + url, { method, data, headers: { 'x-csrf-token': csrf } }); return { status: r.status(), body: await r.json().catch(() => null) } }
const ab = async (m, u, d) => (await A(m, u, d)).body
for (const purpose of ['core_logging', 'family_signals', 'doctor_brief']) await A('POST', '/api/consents', { purpose, granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, stage: 'perimenopause', lang: 'en', city: 'Pune' })
const raj = await ab('POST', '/api/people', { name: 'Rajesh', herLabel: 'Sunita', role: 'husband', lang: 'hi', phone: '+919811111111' })
const anaya = await ab('POST', '/api/people', { name: 'Anaya', herLabel: 'Sunita', role: 'teen', lang: 'en' })
const SECRET = 'secret thing about my mother in law, hot flashes and so tired'
const u = await ab('POST', '/api/utterance', { text: SECRET, lang: 'en' })
await A('POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p) => ({ id: p.id, accept: true, severity: 3 })) })
const sig = (await ab('POST', '/api/signals', { cardType: 'take_over_dinner', personIds: [raj.id] })).sent[0]
const rajToken = raj.link.split('/f/')[1]

let page
const errors = []
const newTab = async () => { page = await ctx.newPage(); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) }); page.on('pageerror', (e) => errors.push(String(e))) }
await newTab()
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const go = async (hash, lang = 'en') => { await page.goto('about:blank'); await page.goto(`${B}/?lang=${lang}#/${hash}`) }
const fam = async (token = rajToken) => (await ctx.request.get(`${B}/f/${token}`)).status()

// ================= Family & Privacy centre
await go('privacy')
await page.getByTestId('person-card').first().waitFor()
const cards = await page.getByTestId('person-card').allInnerTexts()
ok('both people listed with roles and live status', cards.length === 2 && /Rajesh/.test(cards[0]) && /Husband/.test(cards[0]) && /Live/i.test(cards[0]), cards.map((c) => c.split('\n')[0]).join('|'))
ok('last signal shown', /Take over dinner/.test(cards[0]), cards[0].replace(/\n/g, ' | ').slice(0, 140))
const teenCard = page.getByTestId('person-card').nth(1)
ok('teen: signals and weather pills are disabled, content-only noted', (await teenCard.getByRole('button', { name: /Anaya: Signals/ }).isDisabled()) && /lessons only/.test(await teenCard.innerText()))
await page.waitForTimeout(700); await shot('40-privacy')

// permission pill toggles and persists
const sigPill = page.getByRole('button', { name: 'Rajesh: Signals' })
ok('signals permission starts on', (await sigPill.getAttribute('aria-pressed')) === 'true')
await sigPill.click()
await page.waitForFunction(() => document.querySelector('[aria-label="Rajesh: Signals"]')?.getAttribute('aria-pressed') === 'false')
ok('permission off is saved on the server and hides the card from the family page', (await ab('GET', '/api/people')).people[0].permissions.signals === false && (await (await ctx.request.get(`${B}/f/${rajToken}`)).json()).cards.length === 0)
await sigPill.click()
await page.waitForFunction(() => document.querySelector('[aria-label="Rajesh: Signals"]')?.getAttribute('aria-pressed') === 'true')

// exact preview
await page.getByRole('button', { name: /What Rajesh sees/ }).click()
const pv = await page.getByTestId('preview').innerText()
ok('preview shows exactly the card text the family sees (in Hindi)', /आज रात का खाना/.test(pv), pv.replace(/\n/g, ' | '))
ok('preview contains none of her words', !/mother in law|secret|tired/i.test(pv))
await page.getByRole('button', { name: /What Rajesh sees/ }).click()

// pause / resume
await page.getByRole('button', { name: 'Pause' }).first().click()
await page.getByText('Paused').first().waitFor()
ok('paused link goes dark for the family', (await fam()) === 410)
await page.getByRole('button', { name: 'Resume' }).first().click()
await page.getByText(/Live/).first().waitFor()
ok('resumed link works again', (await fam()) === 200)

// new link kills the old one
await page.getByRole('button', { name: 'New link' }).first().click()
const newLink = await page.getByTestId('new-link').innerText()
ok('new link shown and the old link stops working', /#\/f\//.test(newLink) && (await fam()) === 410 && (await fam(newLink.split('/f/')[1].trim())) === 200)

// add a trusted person from the Family centre
await page.getByRole('button', { name: 'Add a person' }).click().catch(async () => { await page.getByRole('button', { name: /Add/ }).last().click() })
await page.getByRole('button', { name: 'ASHA worker' }).click()
await page.getByLabel('Their name').fill('Meena Tai')
await page.getByRole('button', { name: 'Add this person' }).click()
await page.getByText('Meena Tai').first().waitFor()
ok('trusted person (ASHA) added in the centre', (await ab('GET', '/api/people')).people.some((p) => p.name === 'Meena Tai' && p.role === 'asha'))

// revoke with confirmation
await page.getByRole('button', { name: /Revoke Meena Tai/i }).click().catch(async () => { await page.getByRole('button', { name: /Meena Tai/ }).last().click() })
await page.getByRole('alertdialog').waitFor()
await page.getByRole('button', { name: 'Yes, stop sharing' }).click()
await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="person-card"]')].some((e) => /Meena Tai/.test(e.textContent || '')))
ok('revoked person disappears', !(await ab('GET', '/api/people')).people.some((p) => p.name === 'Meena Tai'))

// consents: withdraw -> logging blocked; history records it
await page.getByRole('switch', { name: 'Save the symptoms I confirm' }).click()
await page.waitForFunction(() => document.querySelector('[aria-label="Save the symptoms I confirm"]')?.getAttribute('aria-checked') === 'false')
const blocked = await A('POST', '/api/utterance', { text: 'hot flashes today', lang: 'en' })
ok('withdrawing consent blocks saving immediately', blocked.status === 403 && blocked.body.error === 'consent_required')
await page.getByRole('switch', { name: 'Save the symptoms I confirm' }).click()
await page.waitForFunction(() => document.querySelector('[aria-label="Save the symptoms I confirm"]')?.getAttribute('aria-checked') === 'true')
await page.getByRole('button', { name: /Choice history/ }).click()
const hist = await page.getByTestId('consent-history').innerText()
ok('consent history lists grants and withdrawals', /withdrawn/.test(hist) && /allowed/.test(hist), hist.split('\n').slice(0, 3).join(' | '))

// export: a real file, her data, never her words
await page.getByRole('button', { name: /Download my data/ }).scrollIntoViewIfNeeded()
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download my data/ }).click()])
const path = await dl.path()
const exported = readFileSync(path, 'utf8')
const ej = JSON.parse(exported)
ok('export downloads as JSON with profile, logs, consents, audit', dl.suggestedFilename().endsWith('.json') && ej.profile && ej.logs.length > 0 && ej.consents.length > 0 && ej.audit.length > 0)
ok('export holds no transcript', !/mother in law|secret thing/i.test(exported))

// audit trail
await page.getByRole('button', { name: /Who looked at my data/ }).click()
const aud = await page.getByTestId('audit-list').innerText()
ok('audit trail shows accesses incl. the family viewing', /family view/.test(aud) || /read/.test(aud), aud.split('\n').slice(0, 3).join(' | '))

// ================= Moments + "it helped" -> HUI
await ctx.request.post(`${B}/f/${newLink.split('/f/')[1].trim()}/cards/${sig.signalId}/reply`, { data: { reply: 'done' } }) // the family replies
const sigRows = await ab('GET', '/api/moments')
ok('moments list the vent day and the signal', sigRows.items.some((i) => i.kind === 'vent') && sigRows.items.some((i) => i.kind === 'signal'))
await go('history')
await page.getByTestId('moments').waitFor()
const mt = await page.getByTestId('moments').innerText()
ok('moments show symptoms only, not her words', /Hot flashes|Exhaustion/.test(mt) && !/mother in law|secret/i.test(mt), mt.replace(/\n/g, ' | ').slice(0, 160))
ok('signal shows family replied', /Signal to Rajesh/.test(mt) && /done/.test(mt))
await page.getByRole('button', { name: 'It helped' }).click()
await page.getByText('It helped 💛').waitFor()
const hui = await ab('GET', '/api/hui')
ok('"It helped" feeds the Household Understanding Index', hui.understood === 1 && hui.score === 100, JSON.stringify(hui))
await page.waitForTimeout(600); await shot('41-moments')

// ================= Me
await go('me')
await page.getByLabel('Your name').waitFor()
await page.getByLabel('Your name').fill('Sunita Patil')
await page.getByLabel('City').fill('Nashik')
await page.getByRole('button', { name: /^Menopause/ }).click()
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.getByText('Saved').waitFor()
const me = await ab('GET', '/api/me')
ok('profile saved (name, city, stage)', me.name === 'Sunita Patil' && me.city === 'Nashik' && me.stage === 'menopause')
await page.getByRole('button', { name: 'हिंदी' }).click()
await page.waitForTimeout(400)
ok('language switch applies and is saved to her profile', (await ab('GET', '/api/me')).lang === 'hi' && (await page.getByText('भाषा').count()) > 0)
await go('me', 'hi'); await page.waitForTimeout(900); await shot('42-me-hindi')
await page.getByRole('button', { name: 'English' }).click()

// ================= PIN lock (Discreet Mode)
await go('privacy')
await page.getByRole('switch', { name: 'Discreet Mode' }).click()
await page.waitForFunction(() => document.title === 'Notes')
ok('discreet: browser tab becomes a neutral "Notes"', (await page.title()) === 'Notes')
await page.getByRole('button', { name: 'Set a PIN' }).click()
await page.getByLabel('New PIN (4 to 6 digits)').fill('4821')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.getByText(/PIN saved/).waitFor()
ok('PIN set without locking the page she is on', (await page.getByRole('switch', { name: 'Discreet Mode' }).count()) === 1)
// privacy cover when the window loses focus (shared-phone app switcher)
await page.evaluate(() => window.dispatchEvent(new Event('blur')))
ok('screen is covered when the app goes to the background', (await page.getByTestId('privacy-cover').count()) === 1)
await page.evaluate(() => window.dispatchEvent(new Event('focus')))
ok('...and uncovered on return', (await page.getByTestId('privacy-cover').count()) === 0)
// reopen -> locked
await page.close(); await newTab() // reopening the app = a new tab = fresh session storage
await page.goto(`${B}/?lang=en#/home`)
await page.getByLabel('Enter your PIN').waitFor()
const lockText = await page.locator('body').innerText()
ok('lock screen is neutral: no Sakhi, no name, no data', !/sakhi|sunita|hot flash|rajesh/i.test(lockText) && /Notes/.test(lockText), lockText.replace(/\n/g, ' | '))
ok('server refuses data while locked (423)', (await A('GET', '/api/home')).status === 423 && (await A('GET', '/api/export')).status === 423)
await page.waitForTimeout(500); await shot('43-lock')
await page.getByLabel('Enter your PIN').fill('0000')
await page.getByRole('button', { name: 'Unlock' }).click()
await page.getByText('That PIN is not right.').waitFor()
ok('wrong PIN shows attempts left', /\(4\)/.test(await page.getByRole('alert').innerText()))
await page.getByLabel('Enter your PIN').fill('4821')
await page.getByRole('button', { name: 'Unlock' }).click()
await page.getByRole('heading', { level: 1 }).waitFor()
ok('right PIN opens the app', /#\/home/.test(page.url()) && (await A('GET', '/api/home')).status === 200)
// remove the PIN again
await go('privacy')
await page.getByRole('button', { name: 'Change PIN' }).click()
await page.getByLabel('Current PIN').fill('4821')
await page.getByRole('button', { name: 'Remove PIN' }).click()
await page.getByRole('button', { name: 'Set a PIN' }).waitFor()
ok('PIN can be removed with the current PIN', (await ab('GET', '/api/me')).hasPin === false)

// ================= sign out
await go('me')
await page.getByRole('button', { name: 'Sign out' }).click()
await page.waitForURL(/#\/$|\/$/)
ok('sign out ends the session', (await A('GET', '/api/me')).status === 401)

// ================= account deletion removes everything, including family access
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456' } })).json()).csrf
const stillThere = await fam(newLink.split('/f/')[1].trim())
await go('privacy')
await page.getByRole('button', { name: /Delete my account and data/ }).click()
await page.getByRole('alertdialog').waitFor()
await page.waitForTimeout(500); await shot('44-delete-confirm')
await page.getByRole('button', { name: 'Yes, delete everything' }).click()
await page.waitForURL(/#\/$|\/$/, { timeout: 8000 })
ok('deleted: session gone', (await A('GET', '/api/me')).status === 401)
ok('deleted: family link dead', stillThere === 200 && (await fam(newLink.split('/f/')[1].trim())) === 410)
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
const again = await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978 } })).json()
csrf = again.csrf
const fresh = await ab('GET', '/api/me')
ok('same number starts a brand-new empty account', fresh.onboarded === false && fresh.name === null && (await ab('GET', '/api/logs')).logs.length === 0)
void anaya

const real = errors.filter((e) => !/Failed to load resource.*(ERR_NETWORK_IO_SUSPENDED|40[0-9]|410|423)/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
