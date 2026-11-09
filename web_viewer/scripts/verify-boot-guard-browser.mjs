// W1 runtime fallback, browser level. Drives a real Chromium over CDP against a running app and checks that the inline
// boot guard in index.html tells a user WHY the page is stuck, instead of an endless loading screen.
//   node scripts/verify-boot-guard-browser.mjs [--base=http://127.0.0.1:5231] [--only=a,b,c,d,e]
// Local only: needs a dev server (npx vite --configLoader native --port 5231 --strictPort) or a built origin, and a
// Chromium (cached Playwright chromium / chrome-headless-shell, else the installed Chrome or Edge). The fixture-level
// counterpart that CI runs is verify-boot-guard.mjs.
//   a  normal start reaches `ready` and leaves no panel
//   b  entry module blocked (Network.setBlockedURLs): panel after ~12 s at stage `html`, listing the blocked URL
//   c  entry module replaced by `throw new Error('boot-probe')` (Fetch.fulfillRequest): panel shows that error
//   d  `delete Object.hasOwn` before any script: the "browser too old" panel at once
//   e  ?diag=1: panel at once, live, and still there once the app is ready
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeBrowser, createBrowserProfile } from './lib/browser-profile.mjs'
import { findChrome } from './lib/layout-chrome.mjs'

const args = process.argv.slice(2)
const opt = (key, fallback) => args.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback
const base = opt('base', 'http://127.0.0.1:5231').replace(/\/$/, '')
const only = opt('only', 'a,b,c,d,e').split(',')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const shots = fileURLToPath(new URL('../.analysis/boot-guard-browser/', import.meta.url))
mkdirSync(shots, { recursive: true })

function browserPath() {
  try { return findChrome() } catch { /* no cached Playwright browser */ }
  const found = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  if (!found) throw new Error('No Chromium, Chrome or Edge found')
  return found
}

// The entry module is whatever index.html names: /src/main.js under the dev server, /assets/index-<hash>.js in a build.
const page = await (await fetch(`${base}/`)).text()
const entry = page.match(/<script[^>]*type="module"[^>]*src="([^"]*(?:main|index)[^"]*\.js)"/)?.[1]
assert.ok(entry, `no module entry script in ${base}/`)
const entryPattern = `*${entry}*`

const profile = createBrowserProfile('boot-guard')
const port = 9500 + Math.floor(Math.random() * 400)
const executable = browserPath()
const chrome = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...(/headless-shell/.test(executable) ? [] : ['--headless=new']),
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let socket
const results = []
try {
  let targets
  for (let i = 0; i < 100 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
  assert.ok(targets?.length, 'the browser did not start')
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve))
  let sequence = 0
  const pending = new Map(), handlers = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) } else handlers.forEach(fn => fn(message))
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
    pending.set(id, message => { clearTimeout(timer); message.error ? reject(new Error(`${method}: ${JSON.stringify(message.error)}`)) : resolve(message.result) })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.value
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })

  const panelText = () => evaluate("document.getElementById('gs-boot-guard')?.querySelector('pre')?.textContent || null")
  const guardState = () => evaluate('JSON.stringify(window.__gsBoot ? window.__gsBoot.state() : null)').then(value => value && JSON.parse(value))
  const waitFor = async (probe, timeoutMs, label) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) { const value = await probe(); if (value) return { value, ms: Date.now() - start }; await sleep(250) }
    throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}`)
  }
  let injected = null
  const reset = async () => {
    await send('Network.setBlockedURLs', { urls: [] })
    await send('Fetch.disable').catch(() => {})
    handlers.length = 0
    if (injected) { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected }); injected = null }
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  }
  const screenshot = async name => writeFileSync(path.join(shots, `${name}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  const scenarios = {
    async a() {
      await send('Page.navigate', { url: `${base}/` })
      const { ms } = await waitFor(async () => (await guardState())?.stage === 'ready', 120000, 'stage ready')
      await sleep(1500)
      assert.equal(await panelText(), null, 'no panel after a healthy start')
      return `ready after ${ms} ms, no panel`
    },
    async b() {
      await send('Network.setBlockedURLs', { urls: [entryPattern] })
      await send('Page.navigate', { url: `${base}/` })
      await sleep(5000)
      assert.equal(await panelText(), null, 'the panel must wait for the watchdog, not appear at once')
      const { value, ms } = await waitFor(panelText, 20000, 'the watchdog panel')
      assert.ok(ms + 5000 >= 11000, `panel appeared too early (${ms + 5000} ms)`)
      const state = await guardState()
      assert.equal(state.stage, 'html')
      assert.ok(value.includes('"stage": "html"') && value.includes('入口脚本未执行'), 'panel names the stage')
      assert.ok(value.includes(entry), `the blocked entry ${entry} must be listed`)
      await screenshot('b-blocked-entry')
      return `panel at ~${ms + 5000} ms, stage html, lists ${entry}`
    },
    async c() {
      handlers.push(message => {
        if (message.method !== 'Fetch.requestPaused') return
        const { requestId } = message.params
        send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }],
          body: Buffer.from("throw new Error('boot-probe')").toString('base64') }).catch(() => {})
      })
      await send('Fetch.enable', { patterns: [{ urlPattern: entryPattern, requestStage: 'Request' }] })
      await send('Page.navigate', { url: `${base}/` })
      const { value } = await waitFor(panelText, 25000, 'the watchdog panel')
      const state = await guardState()
      assert.equal(state.error?.message, 'boot-probe', 'the thrown error is recorded')
      assert.ok(value.includes('boot-probe'), 'the panel shows the error')
      assert.equal(state.stage, 'html', 'the replaced entry never marks entry')
      await screenshot('c-entry-throws')
      return `panel shows ${state.error.name}: ${state.error.message}`
    },
    async d() {
      injected = (await send('Page.addScriptToEvaluateOnNewDocument', { source: 'delete Object.hasOwn' })).identifier
      await send('Page.navigate', { url: `${base}/` })
      const { value, ms } = await waitFor(panelText, 5000, 'the old-browser panel')
      assert.ok(value.includes('浏览器版本过旧') && value.includes('Chrome/Edge 105+') && value.includes('Safari 16+'), 'panel states the minimum versions')
      assert.equal((await guardState()).caps.hasOwn, false)
      await screenshot('d-old-browser')
      return `old-browser panel after ${ms} ms`
    },
    async e() {
      await send('Page.navigate', { url: `${base}/?diag=1` })
      const { value, ms } = await waitFor(panelText, 5000, 'the diag panel')
      assert.ok(value.includes('"stage"') && value.includes('"ua"'), 'diag panel carries the diagnostics')
      assert.ok(ms < 4000, 'diag panel is immediate')
      await waitFor(async () => (await panelText())?.includes('"stage": "ready"'), 120000, 'the live panel to report ready')
      assert.ok(await panelText(), 'the diag panel survives ready')
      return `diag panel after ${ms} ms, live through ready`
    },
  }
  for (const name of only) {
    try {
      await reset()
      results.push({ name, ok: true, detail: await scenarios[name]() })
    } catch (error) {
      results.push({ name, ok: false, detail: error.message })
    }
    const last = results.at(-1)
    console.log(`${last.ok ? 'PASS' : 'FAIL'} ${name}: ${last.detail}`)
  }
} finally {
  socket?.close()
  await closeBrowser(chrome, profile)
}
if (results.some(result => !result.ok)) process.exit(1)
console.log(`Boot guard browser scenarios passed: ${results.map(result => result.name).join(', ')} (screenshots in ${shots})`)
