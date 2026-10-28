// Records the auto-playing /demo story to screenshots/demo.webm (1440×900).
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const lang = args.lang ?? 'hi'
const size = { width: 1440, height: 900 }
const tmp = resolve('screenshots', '.video-tmp')
mkdirSync(tmp, { recursive: true })

let stop = () => {}
let base = args.base
if (!base) {
  const proc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'pipe', shell: process.platform === 'win32' })
  await new Promise((res) => proc.stdout.on('data', (d) => String(d).includes('4174') && res()))
  base = 'http://localhost:4174'
  stop = () => proc.kill()
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: tmp, size } })
const page = await ctx.newPage()
await page.goto(`${base}/#/demo?lang=${lang}&shot=1`)
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(1500)
// Step durations mirror the demo's auto-play timings, advanced with the Next key.
const durations = [6, 13, 6, 8, 7, 7, 5, 8, 10]
for (let i = 0; i < durations.length; i++) {
  await page.waitForTimeout(durations[i] * 1000)
  if (i < durations.length - 1) await page.keyboard.press('ArrowRight')
}
// scroll the brief a little for the closing shot
await page.mouse.move(520, 600)
await page.mouse.wheel(0, 700)
await page.waitForTimeout(3000)
const video = page.video()
await ctx.close()
const out = resolve('screenshots', 'demo.webm')
rmSync(out, { force: true })
renameSync(await video.path(), out)
rmSync(tmp, { recursive: true, force: true })
await browser.close()
stop()
console.log(`saved ${out}`)
