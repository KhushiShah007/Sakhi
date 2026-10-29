// Real-stack check of the family link. Needs: `npm run build` then `DEMO_AUTH=true npm run api` (serves the web app too).
// Usage: node scripts/e2e-family.mjs   (BASE_URL to override)
// Drives the real stack: API (:8787, serving dist) + a browser on the family link.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('screenshots', { recursive: true })

const B = process.env.BASE_URL || 'http://localhost:8787'
const phone = '+9198' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let cookie = '', csrf = ''
const api = async (method, url, body) => {
  const r = await fetch(B + url, { method, headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf }, body: body ? JSON.stringify(body) : undefined })
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]
  return r.json()
}
await api('POST', '/api/auth/otp/request', { phone })
csrf = (await api('POST', '/api/auth/otp/verify', { phone, code: '123456', birthYear: 1978, lang: 'hi' })).csrf
for (const purpose of ['core_logging', 'family_signals']) await api('POST', '/api/consents', { purpose, granted: true })
const raj = await api('POST', '/api/people', { name: 'Rajesh', herLabel: 'सुनीता', role: 'husband', lang: 'hi' })
const anaya = await api('POST', '/api/people', { name: 'Anaya', herLabel: 'Sunita', role: 'teen', lang: 'en' })
// she vents (private), confirms, shares tomorrow's estimate, and taps a card
const u = await api('POST', '/api/utterance', { text: 'hot flashes all night, so much stress, I cannot sleep', lang: 'en' })
await api('POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p) => ({ id: p.id, accept: true, severity: 3 })) })
console.log('weather:', (await api('POST', '/api/symptom-weather', { tempC: 39, humidityPct: 80, share: true })).level)
await api('POST', '/api/signals', { cardType: 'take_over_dinner', personIds: [raj.id] })
const url = raj.link.replace('https://', 'http://').replace(/^http:\/\/[^/]+/, B)

const browser = await chromium.launch()
const errors = []
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(url)
await page.getByText('सुनीता का संकेत').first().waitFor()
const body = await page.locator('body').innerText()
console.log('shows card text:', body.includes('आज रात का खाना'), '| shows alert:', body.includes('कल:'))
console.log('leaks her words:', /hot flash|stress|sleep|नींद|sleepless/i.test(body))
await page.screenshot({ path: 'screenshots/family-hi.png' })

await page.getByRole('button', { name: /हो गया/ }).click()
await page.getByText('धन्यवाद').first().waitFor()
await page.reload(); await page.getByText('सुनीता का संकेत').first().waitFor()
console.log('after reload, quick replies hidden (status persisted):', (await page.getByRole('button', { name: /हो गया/ }).count()) === 0)
await page.getByRole('button', { name: /यह कहें/ }).click()
await page.screenshot({ path: 'screenshots/family-hi-lesson.png' })

// she marks it helped -> HUI
const cards = await api('GET', `/api/people/${raj.id}/preview`)
console.log('helped:', JSON.stringify(await api('POST', `/api/signals/${cards.cards[0].id}/helped`)), cards.cards[0].status)
console.log('HUI:', JSON.stringify(await api('GET', '/api/hui')))

// teen: content only
await page.goto(anaya.link.replace(/^https?:\/\/[^/]+/, B)); await page.getByText(/short reads/).first().waitFor()
console.log('teen sees cards/buttons:', (await page.getByRole('button', { name: /Done/ }).count()) > 0, '| lesson:', await page.getByRole('button', { name: /Mum/ }).count())
await page.screenshot({ path: 'screenshots/family-teen.png' })

// revoke -> dark
await api('DELETE', `/api/people/${raj.id}`)
await page.goto(url); await page.getByRole('alert').waitFor()
await page.screenshot({ path: 'screenshots/family-inactive.png' })
console.log('console errors:', JSON.stringify(errors))
await browser.close()
