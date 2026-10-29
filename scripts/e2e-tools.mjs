// Real-stack check: Letter to Myself (generate, read, share, revoke, Hindi), 3 AM Mode (awake timer -> confirmed log), Rehearsal Room (own words + feedback).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '+9194' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
const csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (method, url, data) => { const r = await ctx.request.fetch(B + url, { method, data, headers: { 'x-csrf-token': csrf } }); return { status: r.status(), body: await r.json().catch(() => null) } }
const ab = async (m, u, d) => (await A(m, u, d)).body
await A('POST', '/api/consents', { purpose: 'core_logging', granted: true })
await A('POST', '/api/consents', { purpose: 'family_signals', granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, stage: 'perimenopause', lang: 'en' })
const SECRET = 'secret about my mother in law'
for (const text of [`hot flashes and so tired. ${SECRET}`, 'could not sleep, woke at night, stress at work']) {
  const u = await ab('POST', '/api/utterance', { text, lang: 'en' })
  await A('POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p) => ({ id: p.id, accept: true, severity: 3 })) })
}
await ctx.addInitScript(() => {
  window.__spoken = []
  window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 20) }
})
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
const go = async (hash, lang = 'en') => { await page.goto('about:blank'); await page.goto(`${B}/?lang=${lang}#/${hash}`) }

// ================= Letter
await go('letter')
await page.getByRole('button', { name: "Write this month's letter" }).click()
await page.getByTestId('letter').waitFor()
await page.waitForTimeout(1800)
const letter = await page.getByTestId('letter').innerText()
ok('letter greets her by name and is built from her check-ins', /Dear Sunita,/.test(letter) && /checked in on 1 day/.test(letter), letter.replace(/\n/g, ' | ').slice(0, 150))
ok('it names her themes gently and never quotes her words', /hot flashes|tiredness|poor sleep|waking at night/.test(letter) && !/mother in law|secret/i.test(letter))
ok('closes kindly and signed by Sakhi', /kind to yourself/.test(letter) && /Sakhi/.test(letter))
await page.screenshot({ path: `${OUT}/70-letter.png` })
await page.getByRole('button', { name: 'Read it aloud' }).click()
ok('read aloud uses the calm synthetic voice (never "in my voice")', (await page.evaluate(() => window.__spoken.join(' '))).includes('Dear Sunita') && (await page.getByText(/in my voice/i).count()) === 0)
await page.getByRole('button', { name: 'Share this letter' }).click()
const link = (await page.getByTestId('letter-link').innerText()).trim()
const pub = await ctx.request.get(link.replace(/^https?:\/\/[^/]+/, B))
const html = await pub.text()
ok('shared link shows the letter as a plain read-only page', pub.status() === 200 && /Dear Sunita/.test(html) && (pub.headers()['x-robots-tag'] ?? '') === 'noindex')
await page.getByRole('button', { name: 'Stop sharing' }).click()
ok('stopping the share kills the link', (await ctx.request.get(link.replace(/^https?:\/\/[^/]+/, B))).status() === 410)
const exp = JSON.stringify(await ab('GET', '/api/export'))
ok('her words are not in the export or the stored letter', !/mother in law|secret about/i.test(exp))
// Hindi
await go('letter', 'hi')
await page.getByTestId('letter').waitFor()
await page.getByRole('button', { name: 'फिर से लिखें' }).click()
await page.waitForFunction(() => /प्रिय/.test(document.querySelector('[data-testid=letter]')?.textContent || ''))
const hi = await page.getByTestId('letter').innerText()
ok('rewriting in Hindi gives a Hindi letter', /प्रिय Sunita,/.test(hi) && /अपना हाल बताया/.test(hi), hi.replace(/\n/g, ' | ').slice(0, 120))
await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/71-letter-hindi.png` })

// ================= 3 AM Mode
await page.clock.install()
await go('3am')
await page.getByTestId('clock').waitFor()
ok('3 AM shows the time and how long she has been awake', /Awake for 1 min/.test(await page.getByTestId('awake-for').innerText()))
await page.getByRole('button', { name: 'Guide me back to sleep' }).first().click()
await page.clock.runFor(1000)
ok('a calm voice guides her back to sleep, unprompted by nothing', (await page.evaluate(() => window.__spoken.join('|'))).includes('Let your shoulders drop'))
await page.getByRole('button', { name: 'Stop' }).first().click()
await page.clock.fastForward(45 * 60_000)
await page.getByText(/Awake for (4[3-9]|50) min/).waitFor()
ok('the awake timer keeps counting', true)
ok('nothing logged until she confirms', (await ab('GET', '/api/logs')).logs.filter((l) => l.time === 'night' && l.symptom === 'night_waking' && l.severity === 3).length === 0)
await page.getByRole('button', { name: 'I am going back to sleep' }).click()
await page.getByRole('dialog').waitFor()
await page.screenshot({ path: `${OUT}/72-3am-save.png` })
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.getByText('Saved. Sleep well.').waitFor()
const night = (await ab('GET', '/api/logs')).logs.find((l) => l.symptom === 'night_waking' && l.time === 'night' && l.severity === 3)
ok('she confirmed: a night waking (45 min -> severity 3) is saved', !!night)
await go('3am')
await page.getByRole('button', { name: 'I am going back to sleep' }).click()
await page.getByRole('button', { name: 'Do not save' }).click()
ok('"do not save" saves nothing', (await ab('GET', '/api/logs')).logs.filter((l) => l.symptom === 'night_waking' && l.severity === 1).length === 0)

// ================= Rehearsal Room
await page.clock.uninstall?.().catch(() => {})
await go('rehearsal?s=family')
await page.getByText('Practise the hard talk here first').waitFor()
const OWN = 'I feel exhausted at night. Could you take over dinner every evening, please?'
for (let i = 0; i < 6; i++) {
  const which = await Promise.race([page.locator('#rh-own').waitFor({ timeout: 6000 }).then(() => 'own').catch(() => 'x'), page.getByTestId('rh-feedback').waitFor({ timeout: 6000 }).then(() => 'fb').catch(() => 'x')])
  if (which === 'fb') break
  await page.locator('#rh-own').fill(OWN)
  await page.getByRole('button', { name: 'Say it', exact: true }).click()
}
await page.getByTestId('rh-feedback').waitFor({ timeout: 10000 })
const fbText = await page.getByTestId('rh-feedback').innerText()
ok('feedback is about HER words: all four checks pass for a clear, kind ask', (await page.getByTestId('rh-feedback').locator('svg.lucide-check').count()) === 4 && /clear and kind/.test(fbText), fbText.replace(/\n/g, ' | ').slice(0, 140))
await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/73-rehearsal.png` })
await page.getByRole('button', { name: 'Try again' }).click()
ok('"Try again" starts the scene over', (await page.getByTestId('rh-feedback').count()) === 0)
// blame + shouting is flagged, with a specific tip
for (let i = 0; i < 6; i++) {
  const which = await Promise.race([page.locator('#rh-own').waitFor({ timeout: 6000 }).then(() => 'own').catch(() => 'x'), page.getByTestId('rh-feedback').waitFor({ timeout: 6000 }).then(() => 'fb').catch(() => 'x')])
  if (which === 'fb') break
  await page.locator('#rh-own').fill('You never help and it is ALWAYS my job!!')
  await page.getByRole('button', { name: 'Say it', exact: true }).click()
}
await page.getByTestId('rh-feedback').waitFor({ timeout: 10000 })
const bad = await page.getByTestId('rh-feedback').innerText()
ok('blame and shouting are named, with a gentle tip', (await page.getByTestId('rh-feedback').locator('svg.lucide-x').count()) >= 2 && /Try starting with how you feel/.test(bad), bad.replace(/\n/g, ' | ').slice(0, 160))
ok('rehearsal stores nothing', !JSON.stringify(await ab('GET', '/api/export')).includes('ALWAYS my job'))
// crisis in role-play is not practice
await page.getByRole('button', { name: 'Try again' }).click()
await page.locator('#rh-own').waitFor()
await page.locator('#rh-own').fill('I want to die')
await page.getByRole('button', { name: 'Say it', exact: true }).click()
for (let i = 0; i < 6; i++) {
  const which = await Promise.race([page.locator('#rh-own').waitFor({ timeout: 6000 }).then(() => 'own').catch(() => 'x'), page.getByTestId('rh-crisis').waitFor({ timeout: 6000 }).then(() => 'cr').catch(() => 'x')])
  if (which === 'cr') break
  await page.locator('#rh-own').fill('okay')
  await page.getByRole('button', { name: 'Say it', exact: true }).click()
}
await page.getByTestId('rh-crisis').waitFor({ timeout: 10000 })
ok('a crisis phrase said in role-play gets the real crisis reply', /not alone/i.test(await page.getByTestId('rh-crisis').innerText()))

const real = errors.filter((e) => !/Failed to load resource.*(40[0-9]|410)/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
