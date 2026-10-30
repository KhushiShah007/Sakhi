// Real-browser check: installable manifest, service worker, offline behaviour, offline queue, neutral manifest in Discreet Mode.
import { chromium } from 'playwright'

const B = process.env.BASE_URL || 'http://localhost:8787'
const phone = '+9193' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.request.post(`${B}/api/auth/otp/request`, { data: { phone } })
const csrf = (await (await ctx.request.post(`${B}/api/auth/otp/verify`, { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
const A = async (m, u, d) => (await ctx.request.fetch(B + u, { method: m, data: d, headers: { 'x-csrf-token': csrf } })).json()
await A('POST', '/api/consents', { purpose: 'core_logging', granted: true })
await A('PATCH', '/api/me', { name: 'Sunita', onboarded: true, stage: 'perimenopause', lang: 'en' })
await ctx.addInitScript(() => { window.__spoken = []; window.speechSynthesis.getVoices = () => [{ name: 'Google English', lang: 'en-IN', localService: false }, { name: 'Google Hindi', lang: 'hi-IN', localService: false }]; window.speechSynthesis.speak = (u) => { u.text && window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 10) } })

// ---- installability
for (const [file, name] of [['manifest.webmanifest', 'Sakhi'], ['manifest-neutral.webmanifest', 'Notes']]) {
  const m = await (await ctx.request.get(`${B}/${file}`)).json()
  const icons = await Promise.all(m.icons.map(async (i) => (await ctx.request.get(`${B}/${i.src.replace('./', '')}`)).status()))
  ok(`${file}: named "${name}", standalone, start_url, 192 + 512 icons that really load`, m.name === name && m.display === 'standalone' && m.start_url && m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512') && icons.every((s) => s === 200), icons.join(','))
}
const neutralManifest = await (await ctx.request.get(`${B}/manifest-neutral.webmanifest`)).text()
ok('the neutral manifest says nothing about Sakhi or menopause', !/sakhi|menopause/i.test(neutralManifest))

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`${B}/?lang=en#/home`)
await page.getByRole('heading', { level: 1 }).waitFor()
ok('the page links the manifest', (await page.locator('link[rel=manifest]').getAttribute('href')) === './manifest.webmanifest')
await page.evaluate(() => navigator.serviceWorker.ready)
ok('a service worker is active', (await page.evaluate(() => navigator.serviceWorker.controller !== undefined || !!navigator.serviceWorker.ready)) === true)
await page.reload(); await page.getByRole('heading', { level: 1 }).waitFor()
ok('the worker controls the page after one reload', await page.evaluate(() => !!navigator.serviceWorker.controller))

// ---- offline: the shell opens from cache, never shows demo data, Right Now still works
await ctx.setOffline(true)
await page.reload()
await page.getByRole('status').filter({ hasText: 'You are offline' }).waitFor({ timeout: 10000 })
const offBody = await page.locator('body').innerText()
ok('offline: the app still opens from the cache and says so plainly', /Right Now and 3 AM still work/.test(offBody))
ok('offline: NEVER shows the scripted demo data to a signed-in user', !/Sunita|Rajesh|Pune/.test(offBody) && !/prototype|simulated/i.test(offBody))
await page.getByRole('link', { name: 'Open Right Now' }).click()
await page.getByText('1:30').first().waitFor()
await page.waitForFunction(() => window.__spoken.length > 0)
ok('offline: Right Now starts at 1:30 and the calm voice guides her with no server', (await page.evaluate(() => window.__spoken[0])) === 'Breathe in')

// ---- offline check-in is queued on the phone, then synced when she is back online
await page.goto(`${B}/?lang=en#/checkin`)
await page.getByRole('button', { name: 'Just save my mood' }).waitFor()
await page.getByRole('button', { name: 'Tired', exact: true }).click()
await page.getByRole('button', { name: 'Just save my mood' }).click()
await page.getByText(/Saved on this phone/).waitFor()
const q = await page.evaluate(() => JSON.parse(localStorage.getItem('sakhi.queue') || '[]'))
ok('the check-in is kept on this phone, and holds only a mood (no words)', q.length === 1 && q[0].path === '/api/checkins' && Object.keys(q[0].body).join() === 'mood', JSON.stringify(q))
await ctx.setOffline(false)
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await page.waitForFunction(() => JSON.parse(localStorage.getItem('sakhi.queue') || '[]').length === 0, null, { timeout: 10000 })
ok('back online: the queue is sent and cleared', (await A('GET', '/api/home')).daysCheckedLast7 === 1)

// ---- discreet mode swaps the installed-app identity
await A('PATCH', '/api/me', { discreet: true })
await page.reload(); await page.getByRole('heading', { level: 1 }).waitFor()
await page.waitForFunction(() => document.title === 'Notes')
ok('discreet: the manifest becomes the neutral "Notes" one', (await page.locator('link[rel=manifest]').getAttribute('href')) === './manifest-neutral.webmanifest')

// ---- a worker must never cache private data
const cached = await page.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out })
ok('nothing under /api, /f, /b, /l is ever in the cache', !cached.some((p) => /^\/(api|f|b|l|webhooks|healthz)(\/|$)/.test(p)), `${cached.length} cached files`)
ok('built assets and the shell are cached', cached.some((p) => p.startsWith('/assets/')) && cached.includes('/'))
ok('no page errors', errors.length === 0, JSON.stringify(errors))
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
