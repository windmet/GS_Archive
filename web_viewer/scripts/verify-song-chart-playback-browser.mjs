// The chart tool playing real songs in a real browser, against the media clock:
//   1. switching difficulty after the textures are cached, then play/retry: the song starts (the 11-07 0:00 bug);
//   2. the densest chart (ldyrdm Expert) plays with the track in step with the audio, and frame gaps are recorded;
//   3. infoct Expert across its BPM changes stays in step;
//   4. a seek while playing lands the track and the audio together;
//   5. throttled audio that has to buffer never lets the track run ahead of the audio;
//   6. the outro: playing past the last note to the end of the file leaves no note on the track and the clock at the end.
// Sync is measured every animation frame as |track tick -> seconds - audio.currentTime| (note timing 0).
//   node scripts/verify-song-chart-playback-browser.mjs [--base=http://127.0.0.1:5173]
// Needs a running dev server (song audio available) and a cached Playwright Chromium or chrome-headless-shell.
// Headless frame times come from a software renderer: they are recorded for comparison, not judged.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { closeBrowser, createBrowserProfile } from './lib/browser-profile.mjs'
import { findChrome } from './lib/layout-chrome.mjs'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'

const args = process.argv.slice(2)
const base = (args.find(arg => arg.startsWith('--base='))?.split('=').slice(1).join('=') || 'http://127.0.0.1:5173').replace(/\/$/, '')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const chartTiming = (code, type) => buildSongChartTiming(JSON.parse(readFileSync(new URL(`../public/data/song_charts/${code}-${type}.json`, import.meta.url))))
// One frame at 60 Hz plus the whole-tick rounding of the readout and a 30 Hz track cadence.
const SYNC_LIMIT = 0.05

const profile = createBrowserProfile('chart-playback')
const port = 9500 + Math.floor(Math.random() * 400)
const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--autoplay-policy=no-user-gesture-required',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let socket
const receipts = [], failures = []
try {
  let targets
  for (let i = 0; i < 100 && !targets?.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
  assert.ok(targets?.length, 'the browser did not start')
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve))
  let sequence = 0
  const pending = new Map(), errors = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message.result ?? message); pending.delete(message.id) }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text)
  })
  const send = (method, params = {}) => new Promise(resolve => { const id = ++sequence; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
  const evaluate = async expression => {
    const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text)
    return reply.result?.value
  }
  const until = async (expression, what, tries = 80) => {
    for (let i = 0; i < tries; i++) { if (await evaluate(expression)) return; await sleep(250) }
    throw new Error(`timed out waiting for ${what}`)
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })

  const PAGE = `
    window.__chart = {
      difficulty: label => [...document.querySelectorAll('.chart-difficulties button')].find(b => b.textContent.trim().startsWith(label)).click(),
      play: () => document.querySelector('.chart-play').click(),
      playing: () => { const a = document.querySelector('.chart-transport audio'); return Boolean(a && !a.paused) },
      audio: () => document.querySelector('.chart-transport audio'),
      tick: () => Number(document.querySelector('.track-svg title')?.textContent.match(/tick (\\d+(?:\\.\\d+)?)/)?.[1]),
      seek: seconds => { const input = document.querySelector('.chart-timeline input[type=range]'); input.value = String(seconds); input.dispatchEvent(new Event('input', { bubbles: true })) },
      sample: ms => new Promise(resolve => {
        const rows = [], start = performance.now()
        const frame = now => { const a = window.__chart.audio(); rows.push([now, a.currentTime, window.__chart.tick(), a.paused, a.readyState]); if (now - start < ms) requestAnimationFrame(frame); else resolve(rows) }
        requestAnimationFrame(frame)
      }),
    }; true`
  async function open(code, label) {
    await send('Page.navigate', { url: `${base}/songs/${code}/chart/` })
    await until(`Boolean(document.querySelector('.track-svg') && document.querySelector('.chart-difficulties button'))`, `${code} chart tool`)
    await evaluate(PAGE)
    await evaluate(`window.__chart.difficulty(${JSON.stringify(label)}); true`)
    await until(`document.querySelector('.chart-count')?.textContent.includes(${JSON.stringify(label)}) && Boolean(document.querySelector('.track-svg'))`, `${code} ${label}`)
    await until(`!document.querySelector('.chart-position-status')?.textContent.includes('贴图')`, `${code} textures`)
  }
  // Sync and frame gaps of a sampled stretch of playback, ignoring frames while paused, seeking or buffering.
  function measure(rows, timing, where) {
    const playingRows = rows.filter(([, , tick, paused, ready]) => !paused && ready >= 3 && Number.isFinite(tick))
    const drift = playingRows.map(([, audio, tick]) => Math.abs(timing.tickToSeconds(tick) - audio))
    const gaps = rows.slice(1).map((row, i) => row[0] - rows[i][0]).sort((a, b) => a - b)
    const result = { where, frames: rows.length, synced: playingRows.length,
      driftMax: Math.max(...drift), driftP95: drift.sort((a, b) => a - b)[Math.floor(drift.length * .95)],
      gapP50: gaps[Math.floor(gaps.length / 2)], gapP95: gaps[Math.floor(gaps.length * .95)], gapMax: gaps.at(-1), longFrames: gaps.filter(gap => gap > 50).length }
    if (!(playingRows.length > 20)) failures.push(`${where}: only ${playingRows.length} playing frames`)
    else if (!(result.driftP95 <= SYNC_LIMIT)) failures.push(`${where}: track is ${result.driftP95.toFixed(3)} s (p95) from the audio`)
    receipts.push(result)
    return result
  }
  const playFrom = async seconds => {
    await evaluate(`window.__chart.seek(${seconds}); true`)
    await evaluate(`window.__chart.play(); true`)
    await until(`window.__chart.playing() && window.__chart.audio().currentTime > ${seconds + 0.3}`, `playback from ${seconds}s`)
  }
  const pause = async () => { await evaluate(`window.__chart.playing() && window.__chart.play(); true`); await until(`!window.__chart.playing()`, 'pause') }

  // 1. Café Parade!: textures cached by the first difficulty, then EXPERT, play, pause, HARD, play.
  await open('cfprde', 'NORMAL')
  for (const label of ['EXPERT', 'HARD']) {
    await evaluate(`window.__chart.difficulty(${JSON.stringify(label)}); true`)
    await until(`document.querySelector('.chart-count')?.textContent.includes(${JSON.stringify(label)})`, `cfprde ${label}`)
    await evaluate(`window.__chart.play(); true`)
    try { await until(`window.__chart.playing() && window.__chart.audio().currentTime > 1`, `cfprde ${label} playing`, 60) }
    catch { failures.push(`cfprde: after switching to ${label} the song does not start`) }
    await pause()
  }
  receipts.push('cfprde: NORMAL -> EXPERT -> HARD, each switch plays')

  // 2. Densest chart, mid-song.
  await open('ldyrdm', 'EXPERT')
  const dense = chartTiming('ldyrdm', 4)
  await playFrom(40)
  measure(await evaluate(`window.__chart.sample(8000)`), dense, 'ldyrdm Expert 40 s, 8 s')

  // 4. Seek while playing, forward and back.
  for (const target of [90, 20]) {
    await evaluate(`window.__chart.seek(${target}); true`)
    await until(`window.__chart.playing() && !window.__chart.audio().seeking && window.__chart.audio().currentTime >= ${target} && window.__chart.audio().currentTime < ${target + 3}`, `seek to ${target}s`)
    measure(await evaluate(`window.__chart.sample(1500)`), dense, `ldyrdm Expert seek to ${target} s while playing`)
  }
  await pause()

  // 3. Across every BPM change of infoct Expert.
  await open('infoct', 'EXPERT')
  const bpm = chartTiming('infoct', 4)
  for (const segment of bpm.segments.slice(1)) {
    await playFrom(Math.max(0, segment.seconds - 1.5))
    measure(await evaluate(`window.__chart.sample(3000)`), bpm, `infoct Expert across ${segment.seconds.toFixed(1)} s BPM change`)
    await pause()
  }

  // 6. Outro: the last note, then the rest of the file.
  const duration = await evaluate(`window.__chart.audio().duration`)
  await playFrom(Math.max(0, duration - 4))
  await until(`window.__chart.audio().ended`, 'the end of the song', 40)
  await sleep(300)
  const end = JSON.parse(await evaluate(`JSON.stringify({ notes: document.querySelectorAll('[data-track-note]').length + Number(document.querySelector('[data-track-canvas]')?.dataset.noteCount || 0), holds: (document.querySelector('[data-track-canvas]') || document.querySelector('[data-native-hold-canvas]'))?.dataset.holdCount, time: document.querySelector('.chart-time').textContent })`))
  if (end.notes !== 0 || Number(end.holds || 0) !== 0) failures.push(`outro: ${end.notes} notes / ${end.holds} holds left on the track after the song ended`)
  receipts.push(`infoct outro: ended at ${end.time.replace(/\s+/g, ' ')}, ${end.notes} notes left`)

  // 5. Buffering: with the cache off and the network throttled below the song's bitrate, a fresh load has to wait
  // for data while playing; the track may hold still but must never run ahead of the audio.
  await open('hndmkh', 'EXPERT')
  const buffering = chartTiming('hndmkh', 4)
  await send('Network.setCacheDisabled', { cacheDisabled: true })
  await send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 20 * 1024, uploadThroughput: 20 * 1024 })
  await evaluate(`window.__chart.audio().src = window.__chart.audio().src + '#throttled'; window.__chart.audio().load(); true`)
  await evaluate(`window.__chart.seek(30); window.__chart.play(); true`)
  const rows = await evaluate(`window.__chart.sample(12000)`)
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await send('Network.setCacheDisabled', { cacheDisabled: false })
  const waited = rows.filter(row => row[4] < 3).length, played = rows.filter(row => !row[3] && row[4] >= 3).length
  // Before metadata the audio reports 0 while the track already shows the pending seek; judge only frames with a position.
  const ahead = rows.filter(([, audio, tick, , ready]) => ready >= 1 && Number.isFinite(tick) && buffering.tickToSeconds(tick) - audio > SYNC_LIMIT).length
  const stalls = rows.filter((row, i) => i && row[4] === 2 && rows[i - 1][4] >= 3).length
  if (!waited || !stalls) failures.push(`buffering: the throttled song never stalled mid-play (${waited} short frames, ${stalls} stalls), so nothing was tested`)
  if (ahead) failures.push(`buffering: the track ran ahead of the audio in ${ahead} frames`)
  receipts.push(`hndmkh buffering: ${waited} of ${rows.length} frames short of data, ${stalls} mid-play stalls, ${played} playing, ${ahead} frames ahead of the audio`)
  await pause()

  const unexpected = errors.filter(error => !/WebSocket|\[vite\]/.test(error))
  assert.deepEqual(unexpected, [], 'page errors')
  console.log(JSON.stringify(receipts, (key, value) => typeof value === 'number' ? Number(value.toFixed(4)) : value, 1))
  assert.deepEqual(failures, [], '\n' + failures.join('\n'))
  console.log('Chart playback: difficulty switch plays, dense and BPM-change charts stay in step, seek, buffering and outro passed')
} finally {
  socket?.close()
  await closeBrowser(chrome, profile)
}
