// Browser journey for public path locators (/idols/<id>/, /units/<code>/): plan section 3.6, P1-P13.
//   node scripts/verify-portal-path-locator-browser.mjs [base] [outDir]
// Defaults: http://127.0.0.1:5177 and .analysis/path-locator. Needs a dev server started with
// SIDEM_READMODEL_CANDIDATE and a cached Playwright Chromium; raw CDP like scripts/capture-gallery.mjs.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5177'
const out = process.argv[3] || '.analysis/path-locator'
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
const preferences = startupPage => ({ version: 3, startupPage, homeMode: 'card', startupIdol: '002sht', preferredIdol: '002sht', portalDefaultScope: 'favorite', stageLight: 'mint', onboardingComplete: true })
let preferenceScript = null
const usePreferences = async startupPage => {
  if (preferenceScript) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: preferenceScript })
  preferenceScript = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('sidem:archive-user-preferences', ${JSON.stringify(JSON.stringify(preferences(startupPage)))}) } catch {}` })).identifier
}
await usePreferences('portal')
const requests = []
await send('Network.enable')
socket.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Network.responseReceived') requests.push({ url: m.params.response.url, status: m.params.response.status }) })
const waitFor = async (expr, ms = 20000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
const settle = () => sleep(1200)
const loc = () => ev('location.pathname + location.search')
const shot = async name => writeFileSync(path.join(out, name + '.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
const results = []
const check = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${id} — ${detail}`) }
const idolPath = /^\/idols\/0\d\d[a-z]{3}\/$/
const open = async (url, ready) => { errors = []; await send('Page.navigate', { url: base + url }); await waitFor(ready); await settle() }
const click = async selector => { await ev(`document.querySelector(${JSON.stringify(selector)})?.click()`); await settle() }
const pageBack = () => click('.archive-back')
const idolReady = `location.pathname.startsWith('/idols/') || location.search.includes('view=idol_detail') ? !!document.querySelector('[data-archive-focus-id^="idol-domain:"]') : false`
const journey = async (size, label) => {
  await send('Emulation.setDeviceMetricsOverride', size)
  // P1: idol directory -> an idol publishes its path.
  await open('/?view=idols', `!!document.querySelector('.idol-card')`)
  const directory = await loc()
  await click('.idol-card')
  await waitFor(`location.pathname.startsWith('/idols/')`); await settle()
  const detail = await loc(); await shot(`p1-${label}`)
  check(`P1 ${label} idol opens at its path`, idolPath.test(detail) && errors.length === 0, `${directory} -> ${detail}; errors=${errors.length}`)
  // P2: page back returns to the directory.
  await pageBack(); await waitFor(`location.search.includes('view=idols')`)
  check(`P2 ${label} page back to directory`, (await loc()) === directory, await loc())
  // P3: page back pushed an entry, so history is [directory, detail, directory]: back, back, forward.
  await ev('history.back()'); await settle(); const back = await loc()
  await ev('history.back()'); await settle(); const back2 = await loc()
  await ev('history.forward()'); await settle(); const fwd = await loc()
  check(`P3 ${label} back/forward`, back === detail && back2 === directory && fwd === detail, `back=${back} back2=${back2} forward=${fwd}`)
  const overflow = await ev('document.documentElement.scrollWidth > innerWidth + 1')
  check(`P13 ${label} no sideways scroll`, !overflow, `overflow=${overflow}`)
  return { directory, detail }
}
try {
  const { directory, detail } = await journey({ width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, 'desktop')
  // P4: refresh on the path, then page back still reaches the directory (history source survives reload).
  await send('Page.reload', { ignoreCache: true }); await waitFor(idolReady); await settle()
  check('P4a refresh keeps the path', (await loc()) === detail, await loc())
  await pageBack(); await waitFor(`location.search.includes('view=idols')`)
  check('P4 refresh then page back', (await loc()) === directory, await loc())
  // P5: cold path and cold legacy link behave the same, including where page back lands.
  await open('/idols/001tom/', idolReady); await shot('p5-cold-path')
  const coldText = await ev(`/冬[马馬]/.test(document.body.innerText)`)
  const coldErrors = errors.length
  await pageBack(); const coldPathBack = await loc()
  await open('/?view=idol_detail&idol=001tom', idolReady)
  const legacyNormalized = await loc()
  await pageBack(); const coldLegacyBack = await loc()
  check('P5 cold path renders and backs out like the legacy link', coldText && coldErrors === 0 && coldPathBack === coldLegacyBack && legacyNormalized === '/idols/001tom/', `legacy shown as ${legacyNormalized}; path back=${coldPathBack} legacy back=${coldLegacyBack}`)
  // P6/P7: a related page from the path resets the pathname; back returns to the path.
  await open('/idols/001tom/', idolReady)
  await click('[data-archive-focus-id^="idol-domain:001tom:"]')
  await waitFor(`location.pathname === '/' && location.search.includes('view=')`)
  const related = await loc()
  check('P6 related page leaves the path', related.startsWith('/?view=') && !related.includes('/idols/'), related)
  await ev('history.back()'); await settle()
  check('P7 back returns to the path', (await loc()) === '/idols/001tom/', await loc())
  // P8: unit directory -> unit -> member -> page back -> page back.
  await open('/?view=unit_catalog', `!!document.querySelector('.unit-entry, .unit-card')`)
  const units = await loc()
  await click('.unit-entry, .unit-card'); await waitFor(`location.pathname.startsWith('/units/') && !!document.querySelector('.unit-members')`); await settle()
  const unitPath = await loc()
  await click('.unit-members .archive-idol-reference'); await waitFor(`location.pathname.startsWith('/idols/')`); await settle()
  const member = await loc()
  await pageBack(); await waitFor(`location.pathname.startsWith('/units/')`); const backUnit = await loc()
  await pageBack(); await waitFor(`location.search.includes('view=unit_catalog')`); const backUnits = await loc()
  await shot('p8-units')
  check('P8 unit chain', /^\/units\/\d\d[a-z]{3}\/$/.test(unitPath) && idolPath.test(member) && backUnit === unitPath && backUnits === units, `${units} -> ${unitPath} -> ${member} -> ${backUnit} -> ${backUnits}`)
  // P9: a legacy link is rewritten in place to its path, without adding a history entry.
  await open('/?view=about', `document.body.innerText.trim().length > 40`)
  const lengthBefore = await ev('history.length')
  await open('/?view=unit_detail&unit=01jup&q=x', `!!document.querySelector('.unit-members')`)
  const shown = await loc(); const lengthAfter = await ev('history.length')
  await ev('history.back()'); await settle(); const previous = await loc()
  check('P9 legacy link becomes its path in place', shown === '/units/01jup/' && lengthAfter === lengthBefore + 1 && previous === '/?view=about', `shown=${shown}; history ${lengthBefore}->${lengthAfter}; previous=${previous}`)
  // P10: malformed locator falls back without an uncaught error.
  await open('/idols/xyz/', `document.body.innerText.trim().length > 40`)
  check('P10 malformed path falls back', errors.length === 0, `${await loc()}; errors=${errors.join(' | ') || 0}`)
  // P11: a Home startup preference does not take over an explicit path.
  await usePreferences('home')
  await open('/idols/001tom/', idolReady)
  check('P11 Home preference keeps the path', (await loc()) === '/idols/001tom/' && await ev(`/冬[马馬]/.test(document.body.innerText)`), await loc())
  await usePreferences('portal')
  // P12: nothing is requested relative to the path, and no same-origin request fails.
  const relative = requests.filter(r => /^\/(idols|units)\/[^/]+\/.+/.test(new URL(r.url).pathname))
  const broken = requests.filter(r => r.status >= 400 && new URL(r.url).origin === new URL(base).origin)
  check('P12 no path-relative or failing same-origin requests', relative.length === 0 && broken.length === 0, `requests=${requests.length} relative=${relative.length} failing=${broken.map(r => r.status + ' ' + r.url).join(', ') || 0}`)
  // P14: unit codes with digits (W is 05w00) publish a path too.
  await open('/?view=unit_detail&unit=05w00', `!!document.querySelector('.unit-members')`)
  check('P14 W unit publishes its path', (await loc()) === '/units/05w00/' && errors.length === 0, await loc())
  // P15: the tab title follows the entity on path pages and returns to the site title elsewhere.
  const unitTitle = await ev('document.title')
  await open('/idols/001tom/', idolReady); await waitFor(`document.title !== ${JSON.stringify(unitTitle)}`, 5000)
  const idolTitle = await ev('document.title')
  await click('[data-archive-focus-id^="idol-domain:001tom:"]'); await waitFor(`location.pathname === '/'`)
  const otherTitle = await ev('document.title')
  check('P15 tab title follows the entity', unitTitle === 'W · GS Archive' && /^天濑冬马 · GS Archive$/.test(idolTitle) && otherTitle === 'GS Archive · SideM GROWING STARS 资料馆', `unit="${unitTitle}" idol="${idolTitle}" other="${otherTitle}"`)
  // P13: phone width for P1-P3.
  await journey({ width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, 'phone')
} finally {
  socket.close(); chrome.kill(); try { rmSync(profile, { recursive: true, force: true }) } catch {}
}
writeFileSync(path.join(out, 'journey.json'), JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2))
process.exitCode = results.every(r => r.ok) ? 0 : 1
