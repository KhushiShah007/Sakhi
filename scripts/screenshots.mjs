// Captures every screen/state of the Sakhi prototype with Playwright.
//   npm run screenshots                → builds, serves dist/, writes /screenshots (Hindi) + /screenshots/en
//   node scripts/screenshots.mjs --base=http://localhost:5173 --only=home --lang=hi   (dev iteration)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const OUT = resolve(args.out ?? 'screenshots')
const langs = args.lang ? args.lang.split(',') : ['hi', 'en']

const PHONE = { width: 390, height: 844 }
const DESK = { width: 1440, height: 900 }

/** name, route, options */
export const SHOTS = [
  ['01-welcome', '/'],
  ['02-welcome-slide-3', '/?slide=2'],
  ['03-onboarding-language', '/onboarding?step=1'],
  ['04-onboarding-stage', '/onboarding?step=2'],
  ['05-onboarding-trust', '/onboarding?step=3'],
  ['06-home', '/home'],
  ['07-home-scrolled', '/home', { scroll: 560 }],
  ['08-home-bottom', '/home', { scroll: 2000 }],
  ['09-checkin', '/checkin'],
  ['10-vent-listening', '/vent?stage=listening&p=0.62'],
  ['11-vent-heard', '/vent?stage=listening&p=1'],
  ['12-vent-confirm', '/vent?stage=confirm'],
  ['13-vent-reflection', '/vent?stage=reflect', { wait: 4500 }],
  ['14-translator', '/translator', { wait: 2600 }],
  ['15-translator-sent', '/translator?stage=sent', { wait: 2200 }],
  ['16-right-now', '/right-now'],
  ['17-3am-mode', '/3am'],
  ['18-rehearsal-doctor', '/rehearsal?s=doctor&all=1', { scroll: 2000 }],
  ['19-rehearsal-family', '/rehearsal?s=family'],
  ['20-letter', '/letter', { wait: 2600 }],
  ['21-brief', '/brief'],
  ['22-brief-2', '/brief', { scroll: 640 }],
  ['23-brief-3', '/brief', { scroll: 2400 }],
  ['24-family-privacy', '/privacy'],
  ['25-family-privacy-2', '/privacy', { scroll: 700 }],
  ['26-missed-call', '/missed-call'],
  ['27-missed-call-incoming', '/missed-call?stage=incoming'],
  ['28-missed-call-playing', '/missed-call?stage=playing'],
  ['29-letters-history', '/history'],
  ['30-me', '/me'],
  ['31-family-whatsapp', '/family', { scroll: 0 }],
  ['32-family-whatsapp-2', '/family', { scroll: 760 }],
  ['33-family-whatsapp-3', '/family', { scroll: 4000 }],
  ['34-family-lesson', '/family/lesson?slide=2'],
  ['35-family-lesson-teen', '/family/lesson?teen=1'],
  ['36-hr-dashboard', '/hr', { viewport: DESK, fullPage: true }],
  ['37-demo-side-by-side', '/demo?step=5', { viewport: DESK, wait: 3200 }],
  ['38-demo-weather', '/demo?step=7', { viewport: DESK, wait: 2600 }],
  ['39-desktop-frame', '/home', { viewport: DESK }],
]

async function serve() {
  if (args.base) return { base: args.base, stop: () => {} }
  const proc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe', shell: process.platform === 'win32' })
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview server did not start')), 30000)
    proc.stdout.on('data', (d) => { if (String(d).includes('4173')) { clearTimeout(t); res() } })
  })
  return { base: 'http://localhost:4173', stop: () => proc.kill() }
}

const { base, stop } = await serve()
const browser = await chromium.launch()
let failures = 0
try {
  for (const lang of langs) {
    const dir = lang === 'hi' ? OUT : resolve(OUT, lang)
    mkdirSync(dir, { recursive: true })
    for (const [name, route, o = {}] of SHOTS) {
      if (args.only && !name.includes(args.only)) continue
      const viewport = o.viewport ?? PHONE
      const page = await browser.newPage({ viewport, deviceScaleFactor: +(args.dsf ?? 2) })
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      const sep = route.includes('?') ? '&' : '?'
      await page.goto(`${base}/#${route}${sep}lang=${lang}&shot=1`)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(o.wait ?? 1700)
      if (o.scroll) {
        await page.evaluate((s) => document.querySelectorAll('[data-scroll]').forEach((el) => (el.scrollTop = s)), o.scroll)
        await page.waitForTimeout(700)
      }
      await page.screenshot({ path: resolve(dir, `${name}.png`), fullPage: !!o.fullPage })
      if (errors.length) { failures++; console.log(`✗ ${lang}/${name}\n  ${errors.join('\n  ')}`) } else console.log(`✓ ${lang}/${name}`)
      await page.close()
    }
  }

  if (!args.only || 'hero'.includes(args.only)) {
    // Pitch-deck hero: 3 phones on a peach-to-lavender wash (Hindi + English)
    for (const lang of langs) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: +(args.dsf ?? 2) })
      await page.goto(`${base}/#/hero?lang=${lang}&shot=1`)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(2200)
      await page.screenshot({ path: resolve(OUT, lang === 'hi' ? 'hero.png' : 'hero-en.png') })
      console.log(`✓ hero (${lang})`)
      await page.close()
    }
  }
} finally {
  await browser.close()
  stop()
}
if (failures) { console.log(`${failures} screen(s) logged console errors`); process.exitCode = 1 }
