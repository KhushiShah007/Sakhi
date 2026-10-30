// Real-stack check: Doctor-Ready Brief (scoring, English doctor copy, her language, PDF, doctor link, consent).
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const B = process.env.BASE_URL || 'http://localhost:8787'
const OUT = process.env.SHOTS || 'screenshots/live'
mkdirSync(OUT, { recursive: true })
const phone = '+9197' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
const csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (method, url, data) => { const r = await ctx.request.fetch(B + url, { method, data, headers: { 'x-csrf-token': csrf } }); return { status: r.status(), body: await r.json().catch(() => null) } }
const ab = async (m, u, d) => (await A(m, u, d)).body
await A('POST', '/api/consents', { purpose: 'core_logging', granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, stage: 'perimenopause', lang: 'en', city: 'Pune' })

const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
const go = async (hash, lang = 'en') => { await page.goto('about:blank'); await page.goto(`${B}/?lang=${lang}#/${hash}`) }

// ---- no consent yet: asked plainly, nothing generated
await go('brief')
await page.getByRole('button', { name: 'Allow the doctor brief' }).waitFor()
ok('without consent, no brief is built', (await A('GET', '/api/brief')).status === 403)
await page.getByRole('button', { name: 'Allow the doctor brief' }).click()
await page.getByTestId('mrs-total').waitFor()
ok('allowing opens an (empty) brief honestly', (await page.getByTestId('mrs-total').innerText()) === '0' && /Only 0 days/.test(await page.getByTestId('highlights').innerText()))

// ---- real data: a week of confirmed logs
const SECRET = 'secret things about my mother in law'
for (const text of [`hot flashes in the afternoon, so tired and stress at work. ${SECRET}`, 'could not sleep, woke at night, low mood and anxious', 'knee pain and headache, hot flashes again in the afternoon', 'bladder urgency and tired']) {
  const u = await ab('POST', '/api/utterance', { text, lang: 'en' })
  await A('POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p) => ({ id: p.id, accept: true, severity: 3 })) })
}
const api = await ab('GET', '/api/brief')
await go('brief')
await page.getByTestId('mrs-total').waitFor()
await page.waitForTimeout(1200)
ok('on-screen MRS total equals the server score', (await page.getByTestId('mrs-total').innerText()) === String(api.total.score) && api.total.score > 0, `total ${api.total.score} band ${api.total.band}`)
const art = await page.locator('#brief-article').innerText()
ok('English doctor copy: sections, all 11 MRS items, subscales', /MENOPAUSE RATING SCALE/i.test(art) && /Hot flushes, sweating/.test(art) && /Dryness of vagina/.test(art) && /Somatic/.test(art) && /Psychological/.test(art) && /Urogenital/.test(art))
ok('highlights come from her data (hot flushes, afternoon)', /Hot flushes or night sweats on 2 of 30 days, mostly in the afternoon/.test(art) || /mostly in the afternoon/.test(art), (await page.getByTestId('highlights').innerText()).replace(/\n/g, ' | ').slice(0, 150))
const ro = await page.getByTestId('ruleout').innerText()
ok('rule-outs are rule-based questions ("Should we ...?")', /Should we check/.test(ro) && /thyroid/i.test(ro), ro.replace(/\n/g, ' | ').slice(0, 120))
ok('footer: supportive not diagnostic + pending clinician review stated', /Supportive, not diagnostic/.test(art) && (await page.getByText(/pending clinician review/).count()) > 0)
ok('her words are nowhere in the brief', !/mother in law|secret/i.test(art))
ok('Next 20 Years module present', /Bone health/.test(art) && /Heart health/.test(art) && /Strength exercise/.test(art) && /Screening reminders/.test(art))
ok('chart rendered', (await page.locator('.recharts-bar-rectangle').count()) > 0)
await shot()
async function shot() { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/50-brief.png` }) }

// ---- PDF download
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()])
const pdf = readFileSync(await dl.path())
ok('PDF downloads, is a real one-page PDF', dl.suggestedFilename().endsWith('.pdf') && pdf.subarray(0, 5).toString() === '%PDF-' && (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length === 1, `${pdf.length} bytes`)

// ---- share with a doctor
await page.getByRole('button', { name: 'Share with my doctor' }).click()
const link = (await page.getByTestId('share-link').innerText()).trim()
ok('doctor link created, WhatsApp share prepared', /\/b\//.test(link) && /wa\.me\/\?text=/.test((await page.getByRole('link', { name: 'Send on WhatsApp' }).getAttribute('href')) ?? ''))
const pub = await ctx.request.get(link.replace(/^https?:\/\/[^/]+/, B))
ok('anyone with the link gets the PDF', pub.status() === 200 && (pub.headers()['content-type'] ?? '').includes('pdf'))
await page.getByRole('button', { name: 'Stop sharing' }).first().click()
await page.getByText('No active links').waitFor()
ok('stopping the link kills it immediately', (await ctx.request.get(link.replace(/^https?:\/\/[^/]+/, B))).status() === 410)
const aud = JSON.stringify(await ab('GET', '/api/audit'))
ok('audit trail records the PDF export, the share and the doctor viewing', /brief_pdf/.test(aud) && /brief_shared/.test(aud) && /doctor-link/.test(aud))

// ---- her language
await page.getByRole('tab', { name: 'In my language' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Print or save this view' }).waitFor()
await go('brief', 'hi')
await page.getByTestId('mrs-total').waitFor()
await page.getByRole('tab', { name: 'मेरी भाषा में' }).click()
await page.waitForFunction(() => /मेनोपॉज़ रेटिंग स्केल/.test(document.querySelector('#brief-article')?.textContent || ''))
const hi = await page.locator('#brief-article').innerText()
ok('Hindi view: same score, Hindi items, Hindi questions, Hindi footer', /हॉट फ़्लैश, पसीना/.test(hi) && /क्या हमें/.test(hi) && /सहायक है, निदान नहीं/.test(hi) && (await page.getByTestId('mrs-total').innerText()) === String(api.total.score))
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/51-brief-hindi.png` })

// ---- consent withdrawal removes access
await A('POST', '/api/consents', { purpose: 'doctor_brief', granted: false })
ok('withdrawing consent shuts the brief and PDF', (await A('GET', '/api/brief')).status === 403 && (await A('GET', '/api/brief.pdf')).status === 403)

const real = errors.filter((e) => !/Failed to load resource.*(ERR_NETWORK_IO_SUSPENDED|40[0-9]|410)/.test(e))
ok('no unexpected console errors', real.length === 0, JSON.stringify(real))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
