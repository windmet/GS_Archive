// Browser journey: idol/unit detail addresses carry only their identity, and return/refresh/back still work.
//   node scripts/verify-archive-detail-identity-browser.mjs [base] [outDir]
// Defaults: http://127.0.0.1:5177 and .analysis/detail-identity. Needs a dev server started with
// SIDEM_READMODEL_CANDIDATE and a cached Playwright Chromium; raw CDP like scripts/capture-gallery.mjs.
// Also a working template for later path-locator journeys (docs/GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5177'
const out = process.argv[3] || '.analysis/detail-identity'
mkdirSync(out, { recursive: true })
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const dir = readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort().reverse().find(n => existsSync(path.join(cache, n, 'chrome-win64/chrome.exe')))
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-journey-'))
const port = 9700 + Math.floor(Math.random() * 200)
const chrome = spawn(path.join(cache, dir, 'chrome-win64/chrome.exe'), [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let targets
for (let i = 0; i < 50 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
await new Promise(r => socket.addEventListener('open', r))
let seq = 0, errors = []
const pending = new Map()
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').split('\n')[0])
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; const t = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')) }, 60000)
  pending.set(id, v => { clearTimeout(t); resolve(v) }); socket.send(JSON.stringify({ id, method, params }))
})
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:null,preferredIdol:null,portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})) } catch {}` })
const waitFor = async (expr, ms = 20000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
const settle = () => sleep(1200)
const loc = () => ev('location.pathname + location.search')
const shot = async name => writeFileSync(path.join(out, name + '.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
const results = []
const check = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${id} — ${detail}`) }
try {
  // J1: an old dirty idol link opens and is shortened to its identity.
  errors = []
  await send('Page.navigate', { url: `${base}/?view=idol_detail&idol=001tom&unit_filter=1&q=x&card=c&story_type=main` })
  await waitFor(`document.body.innerText.includes('冬馬')`); await settle()
  let l = await loc(); await shot('j1-idol-old-link')
  check('J1 old idol link shortened', l === '/?view=idol_detail&category=idol&idol=001tom', `${l}; errors=${errors.length}`)
  // J2: same for unit.
  errors = []
  await send('Page.navigate', { url: `${base}/?view=unit_detail&unit=01jup&q=x&card=c&idol=002sht` })
  await waitFor(`!!document.querySelector('.unit-members')`); await settle()
  l = await loc(); await shot('j2-unit-old-link')
  check('J2 old unit link shortened', l === '/?view=unit_detail&unit=01jup', `${l}; errors=${errors.length}`)
  // J3: unit detail -> member -> page back returns to the unit.
  errors = []
  await ev(`document.querySelector('.unit-members button, .unit-members a, .unit-members [role=button]')?.click()`)
  await waitFor(`location.search.includes('view=idol_detail')`); await settle()
  const memberUrl = await loc(); await shot('j3-member')
  check('J3a member opens with identity only', /^\/\?view=idol_detail&category=idol&idol=0\d\d[a-z]{3}$/.test(memberUrl), memberUrl)
  // J4: refresh, then page back still returns to the unit (history source).
  await send('Page.reload', { ignoreCache: true }); await waitFor(`!!document.querySelector('.archive-back')`); await settle()
  await ev(`document.querySelector('.archive-back').click()`)
  await waitFor(`location.search.includes('view=unit_detail')`); await settle()
  l = await loc(); await shot('j4-back-to-unit')
  check('J4 refresh then back returns to unit', l === '/?view=unit_detail&unit=01jup', `${l}; errors=${errors.length}`)
  // J5: browser back/forward between the two.
  await ev('history.back()'); await settle(); const back = await loc()
  await ev('history.forward()'); await settle(); const fwd = await loc()
  check('J5 back/forward keep identity URLs', back === memberUrl && fwd === '/?view=unit_detail&unit=01jup', `back=${back} forward=${fwd}`)
  check('console errors', errors.length === 0, errors.join(' | ') || 'none')
} finally {
  socket.close(); chrome.kill(); try { rmSync(profile, { recursive: true, force: true }) } catch {}
}
writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2))
process.exitCode = results.every(r => r.ok) ? 0 : 1
