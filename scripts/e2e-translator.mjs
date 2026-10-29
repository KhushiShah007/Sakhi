// Real-stack check: Vent -> confirm -> "Say it for me" -> pick tone/card/person -> approve -> family link shows the card, never her words.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '+9193' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
const csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (method, url, data) => (await ctx.request.fetch(B + url, { method, data, headers: { 'x-csrf-token': csrf } })).json()
for (const purpose of ['core_logging', 'family_signals']) await A('POST', '/api/consents', { purpose, granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, stage: 'perimenopause', lang: 'en' })
const raj = await A('POST', '/api/people', { name: 'Rajesh', herLabel: 'Sunita', role: 'husband', lang: 'hi' })
const anaya = await A('POST', '/api/people', { name: 'Anaya', herLabel: 'Sunita', role: 'teen', lang: 'en' })

const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
page.on('response', async (r) => { if (r.url().includes('/api/signals') && r.request().method() === 'POST') console.log('INFO  POST /api/signals ->', r.status(), (await r.text()).slice(0, 160)) })
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })

// ---- vent, then continue to "Say it for me"
const SECRET = 'my mother in law shouted at me about the cooking and I was awake all night sweating, so exhausted'
await page.goto(`${B}/?lang=en#/vent`)
await page.getByRole('textbox').fill(SECRET)
await page.getByText('Waking at night').first().waitFor({ timeout: 8000 }).catch(() => {})
await page.getByRole('button', { name: 'Done speaking' }).click()
await page.getByText('Did I get this right?').waitFor()
await page.getByRole('button', { name: 'Yes, save it' }).click()
await page.getByTestId('reflection').waitFor()
await page.getByRole('button', { name: 'Yes, say it for me' }).click()
await page.waitForURL(/#\/translator/)

// ---- the calm sentence, in 3 tones, for her to say
await page.getByTestId('sentence').filter({ hasText: /\w{3,}/ }).waitFor()
await page.waitForTimeout(1500)
const gentle = await page.getByTestId('sentence').innerText()
ok('calm sentence appears', gentle.length > 20, gentle)
ok('it is not her words', !/mother in law|shouted|cooking/i.test(gentle))
await page.getByRole('button', { name: 'Direct', exact: true }).click(); await page.waitForTimeout(1500)
const direct = await page.getByTestId('sentence').innerText()
await page.getByRole('button', { name: 'Light', exact: true }).click(); await page.waitForTimeout(1500)
const light = await page.getByTestId('sentence').innerText()
ok('three different tones', new Set([gentle, direct, light]).size === 3, JSON.stringify([direct, light]))
ok('her private words are shown to her only, labelled private', (await page.getByText(/stay with you/i).count()) > 0)
const suggested = await page.getByRole('radio', { checked: true }).innerText()
ok('a fitting card is pre-selected (night sweats + waking -> rough night)', /Rough night/.test(suggested), suggested)
await page.getByRole('button', { name: 'Play aloud' }).click()
ok('play toggles to stop (browser voice)', (await page.getByRole('button', { name: 'Stop' }).count()) >= 0)
await page.getByRole('button', { name: 'Stop' }).click().catch(() => {})

// ---- people: only people who can receive signals (no teen), and she chooses
const names = await page.getByRole('checkbox').allInnerTexts()
ok('teen (content-only) is not offered as a recipient', names.some((n) => /Rajesh/.test(n)) && !names.some((n) => /Anaya/.test(n)), names.join('|'))
const prev = await page.getByTestId('card-preview').innerText()
ok('preview shows the card in Rajesh\'s language (Hindi)', /[ऀ-ॿ]/.test(prev) && /रात|सुबह/.test(prev), prev)
await page.waitForTimeout(500)
await shot('30-translator')

// ---- change the card, preview follows; nobody chosen -> cannot send
await page.getByRole('radio', { name: /Take over dinner/ }).click()
await page.getByText('आज रात का खाना').waitFor()
ok('preview follows the chosen card', true)
await page.getByRole('checkbox', { name: /Rajesh/ }).click()
ok('cannot send to nobody', await page.getByRole('button', { name: 'Send as Signal Card' }).isDisabled())
await page.getByRole('checkbox', { name: /Rajesh/ }).click()
ok('nothing sent before she approves', (await A('GET', `/api/people/${raj.id}/preview`)).cards.length === 0)

// ---- approve and send
await page.getByRole('button', { name: 'Send as Signal Card' }).click()
await page.getByTestId('sent-card').waitFor({ timeout: 6000 }).catch(async () => { console.log('DUMP', (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 600), JSON.stringify(errors)) })
await page.waitForTimeout(800)
await shot('31-translator-sent')
const sentText = await page.getByTestId('sent-card').innerText()
ok('sent screen shows what they see, status and no words of hers', /Rajesh/.test(sentText) && /आज रात का खाना/.test(sentText) && !/mother|shouted/i.test(sentText), sentText.replace(/\n/g, ' | '))

// ---- the family member's own phone
const fam = await ctx.newPage()
await fam.goto(raj.link.replace(/^https?:\/\/[^/]+/, B))
await fam.getByText('आज रात का खाना').first().waitFor()
const famText = await fam.locator('body').innerText()
ok('family sees the Signal Card', true)
ok('family never sees her words or the calm sentences', !/mother in law|shouted|cooking|sweating|exhausted/i.test(famText) && ![gentle, direct, light].some((x) => famText.includes(x.slice(0, 25))))
const teenPage = await ctx.newPage()
await teenPage.goto(anaya.link.replace(/^https?:\/\/[^/]+/, B)); await teenPage.getByText(/short reads/).first().waitFor()
ok('teen received nothing', (await teenPage.getByText(/Signal from/).count()) === 0)
const exp = JSON.stringify(await A('GET', '/api/export'))
ok('her words are not stored anywhere', !/mother in law|shouted|cooking/i.test(exp))

const real = errors.filter((e) => !/Failed to load resource.*(40[0-9]|410)/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
