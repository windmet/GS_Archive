// A breadcrumb level opens in place: story catalogue -> an event story -> its event page -> breadcrumb 活动 must open
// /events/ without reloading the archive (no load event, no static boot screen), keep history back to the event,
// and leave a modified click (Ctrl, middle button) to the browser.
//   node scripts/verify-archive-breadcrumb-browser.mjs [base]
// Default base http://127.0.0.1:5177: a dev server with the read-model candidate. Raw CDP on a cached Playwright
// Chromium; chrome-headless-shell is preferred because it also starts where the full chrome.exe does not.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5177'
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const binaries = readdirSync(cache).sort().reverse().flatMap(dir => [
  path.join(cache, dir, 'chrome-headless-shell-win64/chrome-headless-shell.exe'), path.join(cache, dir, 'chrome-win64/chrome.exe')])
  .filter(file => existsSync(file)).sort((a, b) => Number(b.includes('headless-shell')) - Number(a.includes('headless-shell')))
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-breadcrumb-'))
const port = 9500 + Math.floor(Math.random() * 150)
const headless = binaries[0].includes('headless-shell') ? [] : ['--headless=new']
const chrome = spawn(binaries[0], [`--remote-debugging-port=${port}`, ...headless, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let targets
for (let i = 0; i < 50 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
if (!targets?.length) throw new Error(`${binaries[0]} did not start (inside a tool sandbox, run outside it)`)
const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve))
let seq = 0, loads = 0
const errors = [], pending = new Map()
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message.result ?? message); pending.delete(message.id); return }
  if (message.method === 'Page.loadEventFired') loads++
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description?.split('\n')[0] || message.params.exceptionDetails.text)
})
const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
const ev = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
const waitFor = async (expression, ms = 30000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expression)) return true; await sleep(200) } return false }
const loc = () => ev('location.pathname + location.search')
const results = []
const check = (id, ok, detail) => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${id} — ${detail}`) }
try {
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  const preferences = { version: 3, startupPage: 'portal', homeMode: 'card', startupIdol: '002sht', preferredIdol: '002sht', portalDefaultScope: 'favorite', stageLight: 'mint', onboardingComplete: true }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('sidem:archive-user-preferences', ${JSON.stringify(JSON.stringify(preferences))}) } catch {}` })
  await send('Page.navigate', { url: base + '/stories/?story_type=event' })
  const landing = await waitFor(`!!document.querySelector('.event-story-row')`)
  await sleep(800)
  await ev(`document.querySelector('.event-story-row').click()`)
  const atEvent = await waitFor(`/^\\/events\\/[^/]+\\/$/.test(location.pathname) && !!document.querySelector('.archive-breadcrumb a')`)
  await sleep(1200)
  const eventPath = await loc()
  const crumb = await ev(`document.querySelector('.archive-breadcrumb a')?.textContent.trim()`)
  check('B1 an event story opens its event page with a 活动 breadcrumb', landing && atEvent && crumb === '活动', `${eventPath} crumb=${crumb}`)

  // A modified click is the browser's (new tab or window): the page stays where it is.
  await ev(`window.__inPlace = 1; document.querySelector('.archive-breadcrumb a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))`)
  await sleep(1000)
  const ctrlStayed = (await loc()) === eventPath && (await ev('window.__inPlace')) === 1
  check('B2 a Ctrl click is left to the browser', ctrlStayed, `${await loc()}`)

  const loadsBefore = loads
  let sawBoot = false
  await ev(`window.__inPlace = 1; document.querySelector('.archive-breadcrumb a').click()`)
  for (let i = 0; i < 100; i++) {
    const state = await ev(`({ boot: !!document.querySelector('.gs-boot'), at: location.pathname, items: document.querySelectorAll('.event-item').length })`)
    sawBoot ||= Boolean(state?.boot)
    if (state?.at === '/events/' && state.items) break
    await sleep(100)
  }
  await sleep(600)
  const after = await loc(), inPlace = (await ev('window.__inPlace')) === 1, reloads = loads - loadsBefore
  const items = await ev(`document.querySelectorAll('.event-item').length`)
  check('B3 the breadcrumb opens the catalogue in place', after === '/events/' && inPlace && reloads === 0 && !sawBoot && items > 0,
    `${eventPath} -> ${after}; inPlace=${inPlace} reloads=${reloads} bootScreen=${sawBoot} events=${items}`)

  await send('Runtime.evaluate', { expression: 'history.back()' })
  await waitFor(`location.pathname === ${JSON.stringify(eventPath)} && !!document.querySelector('.archive-breadcrumb a')`, 15000)
  check('B4 history back returns to the event page', (await loc()) === eventPath && errors.length === 0, `${await loc()} errors=${errors.join(' | ') || 0}`)
} finally {
  socket.close(); chrome.kill(); try { rmSync(profile, { recursive: true, force: true }) } catch {}
}
process.exitCode = results.length === 4 && results.every(Boolean) ? 0 : 1
