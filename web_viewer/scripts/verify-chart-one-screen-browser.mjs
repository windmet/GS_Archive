// The chart tool in one screen, in a real browser: on a wide window the song shares the toolbar row, and under it the
// canvas, the one-row transport and the resident settings column all fit. Perspective: the track keeps 16:9 inside the
// canvas. Long: the drawing scrolls inside the canvas, and the transport stays under it (never over the settings).
// Nothing else scrolls except the settings column (only vertically); its labels keep one line and an info bubble opens
// whole inside the window (GsInfo places itself in the top layer). Round trip: LIVE -> a song's 谱面 -> 返回 lands on a LIVE song list that has loaded (the song
// catalogue the chart tool used must not be swept away on the way back).
//   node scripts/verify-chart-one-screen-browser.mjs [--base=http://127.0.0.1:5173]
// Needs a running dev server and a cached Playwright Chromium or chrome-headless-shell (no npm package required).
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const base = (args.find(arg => arg.startsWith('--base='))?.split('=').slice(1).join('=') || 'http://127.0.0.1:5173').replace(/\/$/, '')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// 960x620: the narrowest window that keeps the resident panel, where the settings column is squeezed and scrolls.
const VIEWPORTS = [[1280, 800], [1366, 768], [1920, 1000], [1280, 680], [960, 620]]
const URL_PATH = '/songs/drv999/chart'

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

// Runs in the page: every scrolling box under the tool, and the boxes the assertions need.
const MEASURE = `(() => {
  const tip = [...document.querySelectorAll('.chart-settings .gs-row')].find(row => row.querySelector('.gs-info'))?.querySelector('.gs-info')
  if (tip && !document.querySelector('.gs-info-bubble')) tip.dispatchEvent(new MouseEvent('mouseenter'))
  const q = selector => document.querySelector(selector), box = element => { if (!element) return null; const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
  const scrollers = []
  for (const element of document.querySelectorAll('.chart-lab, .chart-lab *')) {
    const style = getComputedStyle(element), x = element.scrollWidth - element.clientWidth, y = element.scrollHeight - element.clientHeight
    if ((x > 0 && /auto|scroll/.test(style.overflowX)) || (y > 0 && /auto|scroll/.test(style.overflowY))) scrollers.push({ name: element.className || element.tagName, x, y })
  }
  const labels = [...document.querySelectorAll('.chart-settings .gs-row-label')].filter(label => label.getBoundingClientRect().height > 30).map(label => label.textContent)
  return JSON.stringify({
    ready: Boolean(q('.chart-layout.has-panel') && q(location.hash === '#long' ? '.chart-scroll .chart-drawing' : '.track-preview svg') && q('.chart-transport')),
    long: Boolean(q('.chart-preview.is-long')), labels, bubble: box(q('.gs-info-bubble')), lead: box(q('.chart-lead')), difficulties: box(q('.chart-difficulties')),
    transportFixed: Boolean(q('.chart-transport')) && getComputedStyle(q('.chart-transport')).position === 'fixed', main: box(q('.chart-main')),
    scrollers, wide: document.documentElement.scrollWidth - innerWidth, height: innerHeight, width: innerWidth,
    bubbleTop: Boolean(q('.gs-info-bubble')?.matches(':popover-open')),
    viewport: box(q('.chart-viewport')), track: box(q('.track-preview')), transport: box(q('.chart-transport')), timeline: box(q('.chart-timeline')), play: box(q('.chart-play')), settings: box(q('.chart-settings')),
  })
})()`

const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-chart-one-screen-'))
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
  for (const view of ['perspective', 'long']) for (const [width, height] of VIEWPORTS) {
    const where = `${URL_PATH} ${view} @${width}x${height}`
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    // The hash only tells MEASURE which drawing to wait for; the view is switched with the 长轨 button.
    await send('Page.navigate', { url: base + URL_PATH + (view === 'long' ? '#long' : '') })
    let m = null
    for (let i = 0; i < 60; i++) {
      await sleep(500)
      if (view === 'long') await evaluate(`document.querySelector('.chart-preview.is-long') || [...document.querySelectorAll('.chart-modes button')].find(button => button.textContent.includes('长轨'))?.click(); true`)
      m = JSON.parse(await evaluate(MEASURE)); if (m.ready && m.long === (view === 'long')) break
    }
    // Let the resize observer settle the resident panel and fonts finish before measuring.
    await sleep(1500); m = JSON.parse(await evaluate(MEASURE))
    const check = (ok, message) => { if (!ok) failures.push(`${where}: ${message}`) }
    check(m.ready && m.long === (view === 'long'), `the ${view} view with the resident settings panel did not render`)
    if (!m.ready || m.long !== (view === 'long')) continue
    checked++
    // Long view: the drawing's own box scrolls (that is how it is read); nothing around it may.
    const others = m.scrollers.filter(entry => !(String(entry.name).includes('chart-settings') && entry.x <= 0) && !(view === 'long' && String(entry.name).includes('chart-scroll')))
    check(others.length === 0, `scrolls inside the tool: ${others.map(entry => `${entry.name} x${entry.x} y${entry.y}`).join('; ')}`)
    check(m.wide <= 0, `the page scrolls sideways by ${m.wide}px`)
    check(m.transport.bottom <= m.height + 0.5 && m.play.bottom <= m.height + 0.5, `the transport ends at ${m.transport.bottom}, below the ${m.height}px window`)
    check(Math.abs((m.play.top + m.play.bottom) / 2 - (m.timeline.top + m.timeline.bottom) / 2) <= 4, 'the step controls are not on the timeline row')
    if (view === 'perspective') {
      check(m.track.width >= 400, `the track is only ${m.track.width}px wide`)
      check(Math.abs(m.track.width / m.track.height - 16 / 9) < 0.03, `the track is ${m.track.width}x${m.track.height}, not 16:9`)
      check(m.track.right <= m.viewport.right + 0.5 && m.track.bottom <= m.viewport.bottom + 0.5, `the track ${JSON.stringify(m.track)} spills out of the canvas box ${JSON.stringify(m.viewport)}`)
      check(m.lead && Math.abs((m.lead.top + m.lead.bottom) / 2 - (m.difficulties.top + m.difficulties.bottom) / 2) <= 4, 'the song is not on the toolbar row')
    }
    check(!m.transportFixed && m.transport.right <= m.main.right + 0.5, 'the transport leaves the canvas column (fixed or over the settings)')
    check(m.transport.top >= m.viewport.bottom - 0.5, 'the transport overlaps the canvas')
    check(m.settings.bottom <= m.height + 0.5, `the settings column ends at ${m.settings.bottom}, below the window`)
    check(m.labels.length === 0, `settings labels wrap: ${m.labels.join(', ')}`)
    check(m.bubble && m.bubble.left >= -0.5 && m.bubble.top >= -0.5 && m.bubble.right <= m.width + 0.5 && m.bubble.bottom <= m.height + 0.5 && m.bubbleTop, `the info bubble ${JSON.stringify(m.bubble)} is cut off or not in the top layer`)
  }
  // Round trip from the LIVE landing through the chart tool and back.
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: base + '/live/' })
  const liveRows = `document.querySelectorAll('.song-row').length`
  let rows = 0
  for (let i = 0; i < 60 && !rows; i++) { await sleep(500); rows = await evaluate(liveRows) }
  assert.ok(rows > 0, 'the LIVE song list did not load on a direct visit')
  await evaluate(`[...document.querySelectorAll('.song-row button, .song-row a')].find(element => element.textContent.trim() === '谱面').click(); true`)
  let opened = false
  for (let i = 0; i < 60 && !opened; i++) { await sleep(500); opened = await evaluate(`Boolean(document.querySelector('.track-preview svg'))`) }
  assert.ok(opened, 'a song\'s 谱面 on LIVE did not open the chart tool')
  await evaluate(`document.querySelector('.experiment-frame header button').click(); true`)
  rows = 0
  for (let i = 0; i < 30 && !rows; i++) { await sleep(500); rows = await evaluate(liveRows) }
  if (!rows) failures.push('/live/ after 返回 from the chart tool: the song list stays on 正在读取曲目…')

  assert.equal(checked, VIEWPORTS.length * 2, `only ${checked} of ${VIEWPORTS.length * 2} window states rendered the chart tool`)
  assert.deepEqual(failures, [], '\n' + failures.join('\n'))
  console.log(`Chart one screen: ${checked} states (perspective + long x ${VIEWPORTS.map(v => v.join('x')).join(', ')}): song on the toolbar row, track 16:9 inside the canvas, long drawing scrolls in place, transport under the canvas, one-line labels, bubble whole inside the window; LIVE -> 谱面 -> 返回 keeps the song list passed`)
} finally {
  socket?.close()
  chrome.kill()
  await sleep(300)
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* the browser may still hold it */ }
}
