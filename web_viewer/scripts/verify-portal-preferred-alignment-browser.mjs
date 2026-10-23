// 担当 lens alignment (batch F, docs/GS_ARCHIVE_HANDOFF_20261023_PORTAL_LAYOUT.md section 4): on a wide Portal
// the hero card and its four summary tiles form one banner whose top and bottom edges meet; the banner, the
// songs|stories row and the event footprints split at one x (the page's 50:50 axis); and the first song
// and the first story start on one line because the story tabs sit in the heading row. A narrow Portal
// (<=980px content) keeps its single-column layout without the tiles. Measures the rendered page, not CSS.
//   node scripts/verify-portal-preferred-alignment-browser.mjs [base] [outDir]
// Needs a running server (dev or a preview URL) and a cached Playwright Chromium.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const base = (process.argv[2] || 'http://127.0.0.1:5181').replace(/\/$/, '')
const out = process.argv[3] || '.analysis/portal-preferred-alignment'
mkdirSync(out, { recursive: true })
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const dir = readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort().reverse().find(n => existsSync(path.join(cache, n, 'chrome-win64/chrome.exe')))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const PREFS = `try { localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',onboardingComplete:true})) } catch {}`
const results = []
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`) }
const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1

async function page(viewport, route, measure) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-align-'))
  const port = 9700 + Math.floor(Math.random() * 90)
  const chrome = spawn(path.join(cache, dir, 'chrome-win64/chrome.exe'), [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
  try {
    let targets
    for (let i = 0; i < 100 && !targets?.some(t => t.type === 'page'); i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
    const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise(r => socket.addEventListener('open', r))
    let seq = 0; const pending = new Map()
    socket.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
    const ev = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', viewport)
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PREFS })
    await send('Page.navigate', { url: `${base}${route}` })
    for (let i = 0; i < 120 && !(await ev(`!!document.querySelector('.overview-story-list > *') && !!document.querySelector('.overview-song-list > *') && !!document.querySelector('.overview-event-grid > *')`)); i++) await sleep(250)
    await sleep(1200)
    const data = await ev(`(() => { ${MEASURE}; return measure() })()`)
    writeFileSync(path.join(out, `${viewport.width}x${viewport.height}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    socket.close()
    return measure(data)
  } finally {
    chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}

const MEASURE = `
function measure() {
  const q = s => document.querySelector(s)
  const box = e => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom } }
  return {
    hero: box(q('.overview-featured > .overview-personal')), tiles: box(q('.overview-personal-stats')),
    tileCount: [...document.querySelectorAll('.overview-stat')].filter(e => e.getClientRects().length).length,
    music: box(q('.overview-music')), stories: box(q('.overview-stories')),
    firstSong: box(q('.overview-song-list > *')), firstStory: box(q('.overview-story-list > *')),
    tabsInHeading: !!q('.overview-stories > .overview-section-heading .overview-story-tabs'),
    events: [...document.querySelectorAll('.overview-event-grid > *')].map(box).filter(Boolean),
  }
}`

for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  const label = `${viewport.width}`
  await page({ ...viewport, deviceScaleFactor: 1, mobile: false }, '/?view=portal&portal_scope=006tsu', m => {
    check(`${label}: banner has the hero and four tiles`, !!m.hero && !!m.tiles && m.tileCount === 4, `hero ${!!m.hero}, tiles ${m.tileCount}`)
    check(`${label}: banner halves share top and bottom edges`, near(m.hero?.t, m.tiles?.t) && near(m.hero?.b, m.tiles?.b),
      `hero ${m.hero?.t?.toFixed(1)}–${m.hero?.b?.toFixed(1)}, tiles ${m.tiles?.t?.toFixed(1)}–${m.tiles?.b?.toFixed(1)}`)
    const gutters = [[m.hero?.r, m.tiles?.l], [m.music?.r, m.stories?.l], [m.events[0]?.r, m.events[1]?.l]]
    const centres = gutters.map(([a, b]) => (a + b) / 2)
    check(`${label}: banner, lists and footprints split at one x`, m.events.length >= 2 && centres.every(x => near(x, centres[0])) && gutters.every(([a, b]) => near(b - a, gutters[0][1] - gutters[0][0])),
      `gutters ${gutters.map(([a, b]) => `${a?.toFixed(1)}→${b?.toFixed(1)}`).join(' | ')}`)
    check(`${label}: story tabs sit in the heading row`, m.tabsInHeading, `tabs in heading: ${m.tabsInHeading}`)
    check(`${label}: first song and first story start on one line`, near(m.firstSong?.t, m.firstStory?.t), `song ${m.firstSong?.t?.toFixed(1)}, story ${m.firstStory?.t?.toFixed(1)}`)
  })
}

await page({ width: 1024, height: 768, deviceScaleFactor: 1, mobile: false }, '/?view=portal&portal_scope=006tsu', m => {
  check('1024: a narrow Portal keeps one column without the tiles', m.tileCount === 0 && near(m.music?.l, m.stories?.l),
    `${m.tileCount} tiles; songs left ${m.music?.l?.toFixed(1)}, stories left ${m.stories?.l?.toFixed(1)}`)
})

const failed = results.filter(r => !r.ok)
console.log(`Portal 担当 alignment: ${results.length - failed.length}/${results.length} passed -> ${out}`)
if (failed.length) process.exit(1)
