// Portal image budget (docs/GS_ARCHIVE_PORTAL_IMAGE_BUDGET_20261013.md): on a phone the card bento is below the
// fold, so its card art must not be requested until the reader scrolls near it; on desktop the bento is on screen
// and its art loads at once. Every card-art request must be the derived 480/960-wide lossy WebP thumbnail (batch B),
// never the full-size 640×800 / 1800×960 PNG. Story banners and song covers below the fold wait the same way on
// every width. Checks the requests actually sent, not the markup.
//   node scripts/verify-portal-image-budget-browser.mjs [base] [outDir]
// Needs a running server (dev, scripts/serve-archive-build.mjs or a preview URL) and a cached Playwright Chromium.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const base = (process.argv[2] || 'http://127.0.0.1:5181').replace(/\/$/, '')
const out = process.argv[3] || '.analysis/portal-image-budget'
mkdirSync(out, { recursive: true })
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const dir = readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort().reverse().find(n => existsSync(path.join(cache, n, 'chrome-win64/chrome.exe')))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const PREFS = `try { localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:null,preferredIdol:null,portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})) } catch {}`
const results = []
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`) }

async function session(viewport, run) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-budget-'))
  const port = 9600 + Math.floor(Math.random() * 90)
  const chrome = spawn(path.join(cache, dir, 'chrome-win64/chrome.exe'), [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
  try {
    let targets
    for (let i = 0; i < 100 && !targets?.some(t => t.type === 'page'); i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
    const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise(r => socket.addEventListener('open', r))
    let seq = 0; const pending = new Map(); const requests = []; const errors = []; let lastNetwork = Date.now()
    socket.addEventListener('message', e => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id) }
      if (m.method === 'Network.requestWillBeSent') { lastNetwork = Date.now(); requests.push({ id: m.params.requestId, url: m.params.request.url, bytes: 0 }) }
      if (m.method === 'Network.loadingFinished') { lastNetwork = Date.now(); const r = requests.find(x => x.id === m.params.requestId); if (r) r.bytes = m.params.encodedDataLength }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text)
    })
    const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
    const ev = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
    const idle = async (quiet = 2500, cap = 45000) => { const start = Date.now(); while (Date.now() - start < cap && Date.now() - lastNetwork < quiet) await sleep(250) }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true })
    await send('Emulation.setDeviceMetricsOverride', viewport)
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PREFS })
    await send('Page.navigate', { url: `${base}/` })
    for (let i = 0; i < 120 && !(await ev(`!!document.querySelector('.card-bento')`)); i++) await sleep(250)
    await idle()
    await run({ ev, idle, requests, errors, shot: async name => writeFileSync(path.join(out, `${name}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')) })
    socket.close()
  } finally {
    chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
const cardArt = requests => requests.filter(r => /\/assets\/card-art\//.test(r.url))
const cardArtThumbs = requests => requests.filter(r => /\/assets\/card-art\/thumb\//.test(r.url))
const cardArtBytes = requests => requests.reduce((sum, r) => sum + r.bytes, 0)
const rows = requests => requests.filter(r => /\/assets\/(songs|stories)\//.test(r.url))
const ROWS = `[...document.querySelectorAll('.overview-song-image img, .overview-main-index img, .overview-story-image img')].map(i => ({ src: i.getAttribute('src'), done: i.complete && i.naturalWidth > 0 }))`
const imageBytes = requests => requests.filter(r => /\.(png|webp|jpe?g)(\?|$)/.test(r.url)).reduce((sum, r) => sum + r.bytes, 0)
const kib = bytes => `${(bytes / 1024).toFixed(0)} KiB`
const BENTO = `[...document.querySelectorAll('.card-bento img')].map(i => ({ src: i.getAttribute('src'), done: i.complete && i.naturalWidth > 0 }))`

await session({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, async ({ ev, idle, requests, errors, shot }) => {
  const top = await ev(`Math.round(document.querySelector('.card-bento').getBoundingClientRect().top)`)
  const before = cardArt(requests)
  check('phone: bento starts below the fold', top > 844, `bento top ${top}px, viewport 844px`)
  check('phone: story banners and song covers wait below the fold', rows(requests).length === 0, `${rows(requests).length} song/story image requests before scrolling`)
  check('phone: no card art requested before scrolling', before.length === 0, `${before.length} card-art requests; ${kib(imageBytes(requests))} of images before scrolling`)
  const unbound = (await ev(BENTO)).filter(i => !i.src).length
  check('phone: bento images hold no src yet', unbound > 0 && unbound === (await ev(BENTO)).length, `${unbound} unbound`)
  await shot('phone-before-scroll')
  await ev(`document.querySelector('.card-bento').scrollIntoView({ block: 'center' })`)
  for (let i = 0; i < 80 && !(await ev(`${BENTO}.every(i => i.done)`)); i++) await sleep(250)
  await idle(1500)
  const after = cardArt(requests)
  const images = await ev(BENTO)
  check('phone: card art loads once scrolled near', after.length > 0 && images.every(i => i.done), `${after.length} card-art requests (${kib(after.reduce((s, r) => s + r.bytes, 0))}); ${images.filter(i => i.done).length}/${images.length} rendered`)
  check('phone: card art is the derived WebP thumbnail', after.length === cardArtThumbs(after).length,
    `${cardArtThumbs(after).length}/${after.length} thumbnail requests`)
  check('phone: card-art transfer stays inside the thumbnail budget', cardArtBytes(after) <= 400 * 1024,
    `${kib(cardArtBytes(after))} for ${after.length} pictures (budget 400 KiB)`)
  await shot('phone-after-scroll')
  const rowCount = await ev(`${ROWS}.length`)
  for (let n = 0; n < rowCount; n++) {
    await ev(`document.querySelectorAll('.overview-song-image img, .overview-main-index img, .overview-story-image img')[${n}].scrollIntoView({ block: 'center' })`)
    for (let i = 0; i < 40 && !(await ev(`${ROWS}[${n}].done`)); i++) await sleep(250)
  }
  const rowImages = await ev(ROWS)
  check('phone: banners and covers load once scrolled to', rowImages.length > 0 && rowImages.every(i => i.done), `${rowImages.filter(i => i.done).length}/${rowImages.length} rendered; ${rows(requests).length} requests`)
  check('phone: no page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none')
})

await session({ width: 1350, height: 940, deviceScaleFactor: 1, mobile: false }, async ({ ev, requests, errors, shot }) => {
  const top = await ev(`Math.round(document.querySelector('.card-bento').getBoundingClientRect().top)`)
  for (let i = 0; i < 80 && !(await ev(`${BENTO}.every(i => i.done)`)); i++) await sleep(250)
  const images = await ev(BENTO)
  const art = cardArt(requests)
  check('desktop: bento is on screen and its art loads without scrolling', top < 940 && art.length > 0 && images.every(i => i.done), `bento top ${top}px; ${art.length} card-art requests; ${images.filter(i => i.done).length}/${images.length} rendered`)
  check('desktop: card art is the derived WebP thumbnail', art.length === cardArtThumbs(art).length && art.every(r => r.url.endsWith('.webp')),
    `${cardArtThumbs(art).length}/${art.length} thumbnail requests`)
  check('desktop: card-art transfer stays inside the thumbnail budget', cardArtBytes(art) <= 300 * 1024,
    `${kib(cardArtBytes(art))} for ${art.length} pictures (budget 300 KiB)`)
  await shot('desktop')
  check('desktop: no page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none')
})

const failed = results.filter(r => !r.ok)
console.log(`Portal image budget: ${results.length - failed.length}/${results.length} passed -> ${out}`)
if (failed.length) process.exit(1)
