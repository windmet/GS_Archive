// Not-found policy, browser level. Drives a real Chromium over CDP against a running app and checks that an address
// naming nothing (or a well-formed address whose entity does not exist) lands on the archive portal with a notice, a
// robots noindex meta and a rewritten address bar, and that a genuine page carries none of that.
//   node scripts/verify-not-found-browser.mjs [--base=http://127.0.0.1:5232] [--only=unknown,missing,real,leave]
// Local only: needs a dev server (npx vite --configLoader native --port 5232 --strictPort) or a built origin with the
// read models, and a Chromium (cached chrome-headless-shell, else Chrome or Edge). The fixture counterpart that CI runs
// is verify-not-found.mjs.
//   unknown  /foo-bar/ /cards/99999999/ /idols/999/ /songs/zzz/ (no public locator matches)
//   missing  well-formed ids absent from their catalogue: idol, card, song, unit, event, gasha
//   real     /idols/001tom/ and /cards/ open normally: no notice, no noindex
//   leave    after a not-found landing, opening another page removes the notice and the noindex
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { closeBrowser, createBrowserProfile } from './lib/browser-profile.mjs'
import { findChrome } from './lib/layout-chrome.mjs'

const args = process.argv.slice(2)
const opt = (key, fallback) => args.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback
const base = opt('base', 'http://127.0.0.1:5232').replace(/\/$/, '')
const only = opt('only', 'unknown,missing,real,leave').split(',')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const NOTICE = '没有找到这个页面，已回到资料馆。'

function browserPath() {
  try { return findChrome() } catch { /* no cached Playwright browser */ }
  const found = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  if (!found) throw new Error('No Chromium, Chrome or Edge found')
  return found
}

const profile = createBrowserProfile('not-found')
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
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
    pending.set(id, message => { clearTimeout(timer); message.error ? reject(new Error(`${method}: ${JSON.stringify(message.error)}`)) : resolve(message.result) })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description}`)
    return result.result?.value
  }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })

  // Opens a path and waits for the boot guard to report ready, then lets the restore settle.
  async function open(pathname) {
    await send('Page.navigate', { url: 'about:blank' }); await sleep(250)
    await send('Page.navigate', { url: `${base}${pathname}` })
    const start = Date.now()
    while (Date.now() - start < 120000 && !(await evaluate("window.__gsBoot?.state().stage === 'ready'"))) await sleep(300)
    await sleep(2500)
  }
  const snapshot = () => evaluate(`JSON.stringify({
    address: location.pathname + location.search,
    notices: [...document.querySelectorAll('.portal-notice, .idol-select-notice')].map(node => node.textContent.trim()),
    robots: [...document.querySelectorAll('meta[name=robots]')].map(node => node.content),
    text: document.body.innerText.length,
    shell: Boolean(document.querySelector('nav, [class*=archive-shell], #story-viewer'))
  })`).then(JSON.parse)
  const notFound = async (pathname, note) => {
    await open(pathname)
    const state = await snapshot()
    assert.ok(state.notices.includes(NOTICE), `${pathname}: notice shown (got ${JSON.stringify(state.notices)})`)
    assert.deepEqual(state.robots, ['noindex'], `${pathname}: robots noindex present`)
    assert.ok(state.address !== pathname && !state.address.startsWith(pathname.replace(/\/$/, '') + '/'), `${pathname}: address rewritten (got ${state.address})`)
    assert.ok(state.text > 300 && state.shell, `${pathname}: page is not blank (${state.text} chars)`)
    return `${pathname} -> ${state.address}${note ? ` (${note})` : ''}`
  }

  const scenarios = {
    async unknown() {
      const lines = []
      for (const pathname of ['/foo-bar/', '/cards/99999999/', '/idols/999/', '/songs/zzz/']) lines.push(await notFound(pathname))
      return lines.join('; ')
    },
    async missing() {
      const lines = []
      for (const pathname of ['/idols/999zzz/', '/cards/999zzz_n99/', '/songs/zzzzzz/', '/units/99zzz/', '/events/99999/', '/gashas/9999999/']) lines.push(await notFound(pathname))
      return lines.join('; ')
    },
    async real() {
      const lines = []
      for (const pathname of ['/idols/001tom/', '/cards/', '/']) {
        await open(pathname)
        const state = await snapshot()
        assert.ok(!state.notices.includes(NOTICE), `${pathname}: no not-found notice`)
        assert.deepEqual(state.robots, [], `${pathname}: no robots meta`)
        assert.ok(state.text > 300, `${pathname}: page renders`)
        lines.push(`${pathname} -> ${state.address}`)
      }
      return lines.join('; ')
    },
    async leave() {
      await open('/foo-bar/')
      let state = await snapshot()
      assert.deepEqual(state.robots, ['noindex']); assert.ok(state.notices.includes(NOTICE))
      const clicked = await evaluate(`(() => {
        const target = [...document.querySelectorAll('nav button, nav a, aside button, aside a')].find(node => node.textContent.trim() === '卡片')
        if (!target) return false
        target.click(); return true
      })()`)
      assert.ok(clicked, 'a navigation entry for 卡片 exists')
      await sleep(3000)
      state = await snapshot()
      assert.ok(state.address.includes('cards') && !state.address.includes('foo-bar'), `navigated to the card directory (got ${state.address})`)
      assert.deepEqual(state.robots, [], 'noindex leaves with the not-found page')
      assert.ok(!state.notices.includes(NOTICE), 'the notice does not follow the visitor')
      return `/foo-bar/ -> click 卡片 -> ${state.address}, noindex removed`
    },
  }
  for (const name of only) {
    try {
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
console.log(`Not found browser scenarios passed: ${results.map(result => result.name).join(', ')}`)
