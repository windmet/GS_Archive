// L4 arm B (experiment): snapshot-prerender entity shells. Loads each path from a local production-bundle
// server in headless Chromium, waits for the page's own content, then writes the rendered #app markup and the
// stylesheets it needed into that path's head shell. main.js is unchanged: createApp().mount('#app') replaces it.
//   node snapshot-prerender.mjs --base=http://127.0.0.1:5181 --dist=.analysis/ssg-b --paths=/idols/001tom/,/units/01jup/
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const option = name => process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const base = option('base') || 'http://127.0.0.1:5181'
const dist = path.resolve(option('dist'))
const paths = (option('paths') || '/idols/001tom/,/units/01jup/').split(',')
const READY = {
  idols: `!!document.querySelector('[data-archive-focus-id^="idol-domain:"]') && [...document.images].filter(i => i.closest('main, .archive-main, #app')).every(i => i.complete)`,
  units: `!!document.querySelector('.unit-members .archive-idol-reference') && [...document.images].every(i => i.complete)`,
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const exe = path.join(cache, readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort().reverse().find(n => existsSync(path.join(cache, n, 'chrome-win64/chrome.exe'))), 'chrome-win64/chrome.exe')

for (const pathname of paths) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-snap-'))
  const port = 9900 + Math.floor(Math.random() * 90)
  const chrome = spawn(exe, [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
  try {
    let targets
    for (let i = 0; i < 100 && !targets?.some(t => t.type === 'page'); i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
    const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise(r => socket.addEventListener('open', r))
    let seq = 0; const pending = new Map()
    socket.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
    const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true })
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:null,preferredIdol:null,portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})) } catch {}` })
    await send('Page.navigate', { url: base + pathname })
    const ready = READY[pathname.split('/')[1]]
    let ok = false
    for (let i = 0; i < 120 && !ok; i++) { await sleep(250); ok = await ev(ready) }
    await sleep(800)
    const snap = await ev(`({ app: document.getElementById('app').innerHTML, sheets: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href')), styles: [...document.querySelectorAll('head style')].map(s => s.textContent) })`)
    socket.close()
    const file = path.join(dist, pathname.replace(/^\//, ''), 'index.html')
    let html = readFileSync(file, 'utf8')
    const missing = snap.sheets.filter(href => !html.includes(`href="${href}"`))
    const extra = missing.map(href => `    <link rel="stylesheet" crossorigin href="${href}">`).join('\n') + (snap.styles.length ? `\n    <style data-prerender>${snap.styles.join('\n')}</style>` : '')
    if (!html.includes('<div id="app"></div>')) throw new Error(`${file}: no empty #app to fill`)
    // Off-screen images in the static copy must not compete with the app's own chunks and data for bandwidth
    // while it mounts; on-screen images still load immediately under loading="lazy".
    const markup = snap.app.replace(/<img(?![^>]*\sloading=)/g, '<img loading="lazy"')
    html = html.replace('</head>', `${extra}\n  </head>`).replace('<div id="app"></div>', `<div id="app" data-prerendered>${markup}</div>`)
    writeFileSync(file, html)
    console.log(`${pathname}: ready=${ok}, ${(snap.app.length / 1024).toFixed(0)} KiB markup, +${missing.length} stylesheets, ${snap.styles.length} inline styles -> ${file}`)
  } finally {
    chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
