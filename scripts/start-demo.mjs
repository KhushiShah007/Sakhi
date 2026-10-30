// One command to run the whole demo on this computer:  npm run demo   (or double-click start-demo.bat on Windows)
// Builds the site if needed, starts the server with demo sign-in and the fictional demo data, and opens the browser.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const PORT = process.env.PORT || '8787'
const win = process.platform === 'win32'
const npx = win ? 'npx.cmd' : 'npx'

if (!existsSync('dist/index.html')) {
  console.log('Building the site (first time only, about 30 seconds)...')
  const b = spawnSync(npx, ['vite', 'build'], { stdio: 'inherit', shell: win })
  if (b.status !== 0) { console.error('The build failed. Run "npm install" first, then try again.'); process.exit(1) }
}

const env = { ...process.env, PORT, DEMO_DEPLOY: 'true', ADMIN_KEY: process.env.ADMIN_KEY || 'admin-demo-key', RATE_LIMIT_PER_MIN: '100000' }
const server = spawn(npx, ['tsx', 'server/src/index.ts'], { stdio: 'inherit', env, shell: win })
server.on('exit', (c) => process.exit(c ?? 0))
process.on('SIGINT', () => server.kill())

// open the browser once the server answers
const url = `http://localhost:${PORT}`
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  try {
    const r = await fetch(`${url}/healthz`)
    if (r.ok) {
      console.log(`\nSakhi is running at ${url}\nSign in with phone 9999900001 and code 123456.  HR dashboard: ${url}/#/hr  (code NAVRANG-HR-DEMO).  Admin: ${url}/#/admin  (key ${env.ADMIN_KEY}).\nPress Ctrl+C to stop.\n`)
      spawn(win ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open', win ? ['/c', 'start', '', url] : [url], { stdio: 'ignore', detached: true }).unref()
      break
    }
  } catch { /* still starting */ }
}
