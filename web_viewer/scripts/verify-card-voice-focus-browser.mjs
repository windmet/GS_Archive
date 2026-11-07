// Home dialogue → card page in a real browser: following the card link of a touch voice brings that voice into view in
// the card page's own scroller and leaves the document itself unscrolled. The document is overflow: hidden, so a scroll
// on it (scrollIntoView reaching it, or a stray absolute element making it taller than the window) pushes the whole
// shell up with no way for the reader to scroll it back; an SSR card's costume table once did exactly that.
//   node scripts/verify-card-voice-focus-browser.mjs [--base=http://127.0.0.1:5173]
// Needs a running dev server and a cached Playwright Chromium or chrome-headless-shell (no npm package required).
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { closeBrowser, createBrowserProfile } from './lib/browser-profile.mjs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const base = (args.find(arg => arg.startsWith('--base='))?.split('=').slice(1).join('=') || 'http://127.0.0.1:5173').replace(/\/$/, '')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const VIEWPORTS = [[980, 560], [1440, 900]]
// An SSR card (it has the costume table) reached from a touch voice far down its page.
const JOURNEYS = [{ idol: '004ter', cue: '2_4_004_02_00_03', card: '004ter_ssr02' }]

function findChrome() {
  const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
  const names = existsSync(cache) ? readdirSync(cache) : []
  const candidates = [
    ...names.filter(name => /^chromium_headless_shell-\d+$/.test(name)).sort().reverse().map(dir => path.join(cache, dir, 'chrome-headless-shell-win64/chrome-headless-shell.exe')),
    ...names.filter(name => /^chromium-\d+$/.test(name)).sort().reverse().map(dir => path.join(cache, dir, 'chrome-win64/chrome.exe')),
  ]
  const found = candidates.find(existsSync)
  if (!found) throw new Error('No cached Playwright Chromium or chrome-headless-shell found under ' + cache)
  return found
}

const measure = cue => `(() => {
  const root = document.documentElement, box = document.querySelector('[data-archive-scroll-container]')
  const row = box && box.querySelector('[data-voice-cue="${cue}"]')
  const b = box && box.getBoundingClientRect(), r = row && row.getBoundingClientRect()
  return JSON.stringify({
    path: location.pathname, rootTop: root.scrollTop, rootOverflow: root.scrollHeight - root.clientHeight,
    shellTop: document.querySelector('.archive-shell')?.getBoundingClientRect().top ?? null,
    costumes: document.querySelectorAll('.costume-row').length, focused: Boolean(row && row.classList.contains('is-focused')),
    scrolled: box ? box.scrollTop : null, rowTop: row ? r.top - b.top : null, rowBottom: row ? b.bottom - r.bottom : null,
  })
})()`

const profile = createBrowserProfile('card-voice-focus')
const port = 9500 + Math.floor(Math.random() * 400)
const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let socket
const failures = []
try {
  let targets
  for (let i = 0; i < 100 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
  assert.ok(targets?.length, 'the browser did not start')
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve))
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message.result ?? message); pending.delete(message.id) } })
  const send = (method, params = {}) => new Promise(resolve => { const id = ++sequence; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
  await send('Runtime.enable'); await send('Page.enable')

  let checked = 0
  for (const [width, height] of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    for (const journey of JOURNEYS) {
      const where = `${journey.idol}/${journey.cue} @${width}x${height}`
      const check = (ok, message) => { if (!ok) failures.push(`${where}: ${message}`) }
      await send('Page.navigate', { url: `${base}/office/${journey.idol}/?home_cue=${journey.cue}` })
      let link = false
      for (let i = 0; i < 60 && !link; i++) { await sleep(500); link = await evaluate(`!!document.querySelector('button.dialogue-card')`) }
      check(link, 'the home dialogue has no card link')
      if (!link) continue
      await evaluate(`document.querySelector('button.dialogue-card').click(); true`)
      // Wait for the card page and its focused voice row; then let images and late layout settle.
      let m = null
      for (let i = 0; i < 60; i++) {
        await sleep(500)
        m = JSON.parse(await evaluate(measure(journey.cue)))
        if (m.path === `/cards/${journey.card}/` && m.focused) break
      }
      await sleep(2500)
      m = JSON.parse(await evaluate(measure(journey.cue)))
      check(m.path === `/cards/${journey.card}/`, `ended on ${m.path}`)
      check(m.focused, 'the voice row is missing or not marked')
      if (m.path !== `/cards/${journey.card}/` || !m.focused) continue
      checked++
      // The costume table must be on the page, or this journey no longer exercises what broke.
      check(m.costumes > 0, 'the card page has no costume rows')
      check(m.rootTop === 0, `the document is scrolled by ${m.rootTop}px`)
      check(m.rootOverflow <= 0, `the document is ${m.rootOverflow}px taller than the window`)
      check(m.shellTop === 0, `the shell starts at ${m.shellTop}px`)
      check(m.scrolled > 0, 'the card page did not scroll to the voice')
      // Centred when set; the page above still settles afterwards (about 75px here), so only full visibility is held.
      check(m.rowTop >= 0 && m.rowBottom >= 0, `the voice row is cut off (${m.rowTop}px from the top, ${m.rowBottom}px from the bottom)`)
    }
  }
  assert.ok(checked === VIEWPORTS.length * JOURNEYS.length, `only ${checked} journeys reached the card page`)
  assert.deepEqual(failures, [], '\n' + failures.join('\n'))
  console.log(`Card voice focus: ${checked} journeys (${VIEWPORTS.length} windows x ${JOURNEYS.length} SSR touch voice): voice in view in the card page, document unscrolled, shell at 0 passed`)
} finally {
  socket?.close()
  await closeBrowser(chrome, profile)
}
