// Reminders in Me with a stubbed browser push service (a real one needs Google/Mozilla): permission is asked only on switching on, device is registered, hours are limited.
import { chromium } from 'playwright'
const B = process.env.BASE_URL || 'http://localhost:8787'
let failed = 0
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) failed++ }
const browser = await chromium.launch()
const phone = '+9184' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.request.post(B + '/api/auth/otp/request', { data: { phone } })
const csrf = (await (await ctx.request.post(B + '/api/auth/otp/verify', { data: { phone, code: '123456', birthYear: 1978, lang: 'en' } })).json()).csrf
await ctx.request.post(B + '/api/consents', { data: { purpose: 'core_logging', granted: true }, headers: { 'x-csrf-token': csrf } })
await ctx.request.patch(B + '/api/me', { data: { onboarded: true, name: 'S' }, headers: { 'x-csrf-token': csrf } })
await ctx.addInitScript(() => {
  window.__asked = 0
  const fakeSub = { toJSON: () => ({ endpoint: 'https://fcm.example/send/abc', keys: { p256dh: 'BPk', auth: 'au' } }) }
  const reg = { pushManager: { getSubscription: async () => null, subscribe: async () => fakeSub } }
  Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), register: async () => reg, addEventListener() {} }, configurable: true })
  window.PushManager = window.PushManager || class {}
  window.Notification = class { static permission = 'default'; static async requestPermission() { window.__asked++; return 'granted' } }
})
const page = await ctx.newPage()
await page.goto(B + '/?lang=en#/me'); await page.getByTestId('reminders').waitFor()
ok('nothing is asked on opening the page', (await page.evaluate(() => window.__asked)) === 0)
await page.getByRole('switch', { name: 'Daily check-in reminder' }).click()
await page.getByLabel('Time').waitFor()
ok('permission is asked once, when she switches it on', (await page.evaluate(() => window.__asked)) === 1)
const r = await (await ctx.request.get(B + '/api/reminders')).json()
ok('this device is registered and the reminder saved', r.devices === 1 && r.checkinOn === true, JSON.stringify(r))
await page.getByLabel('Time').fill('18:30'); await page.waitForTimeout(400)
ok('her chosen time is saved', (await (await ctx.request.get(B + '/api/reminders')).json()).checkinTime === '18:30')
ok('the 9 pm to 8 am quiet promise is shown', (await page.getByText(/between 9 pm and 8 am/).count()) === 1)
const bad = await ctx.request.put(B + '/api/reminders', { data: { checkinOn: true, checkinTime: '23:30', weatherOn: false }, headers: { 'x-csrf-token': csrf } })
ok('a night-time reminder is refused by the server', bad.status() === 400)
await page.getByRole('switch', { name: 'Daily check-in reminder' }).click(); await page.waitForTimeout(400)
ok('she can switch it off', (await (await ctx.request.get(B + '/api/reminders')).json()).checkinOn === false)
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0)
