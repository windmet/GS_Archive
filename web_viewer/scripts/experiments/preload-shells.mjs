// L4 arm A+ (experiment): preload hints in entity head shells. Loads each path once from a local production-bundle
// server, records the route chunks, stylesheets and read-model/translation JSON the page requested, and writes
// them into that path's shell as <link rel=modulepreload|preload> so they download alongside the entry script
// instead of after it. No prerendered body; main.js unchanged.
//   node preload-shells.mjs --base=http://127.0.0.1:5186 --dist=.analysis/ssg/aplus --paths=/idols/001tom/,/units/01jup/
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const option = name => process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const base = option('base') || 'http://127.0.0.1:5186'
const dist = path.resolve(option('dist'))
const paths = (option('paths') || '/idols/001tom/,/units/01jup/').split(',')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const exe = path.join(cache, readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort().reverse().find(n => existsSync(path.join(cache, n, 'chrome-win64/chrome.exe'))), 'chrome-win64/chrome.exe')

for (const pathname of paths) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-pre-'))
  const port = 9500 + Math.floor(Math.random() * 90)
  const chrome = spawn(exe, [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
  try {
    let targets
    for (let i = 0; i < 100 && !targets?.some(t => t.type === 'page'); i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
    const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise(r => socket.addEventListener('open', r))
    let seq = 0; const pending = new Map(); const seen = []
    socket.addEventListener('message', e => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); return }
      if (m.method === 'Network.requestWillBeSent' && m.params.initiator?.type === 'script') {
        const u = new URL(m.params.request.url)
        if (/^\/(_app|_catalog|translations)\//.test(u.pathname) && !seen.includes(u.pathname)) seen.push(u.pathname)
      }
    })
    const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
    await send('Page.enable'); await send('Network.enable')
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:null,preferredIdol:null,portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})) } catch {}` })
    await send('Page.navigate', { url: base + pathname })
    await sleep(5000)
    socket.close()
    const tags = seen.map(href => href.endsWith('.js') ? `    <link rel="modulepreload" crossorigin href="${href}">`
      : href.endsWith('.css') ? `    <link rel="preload" as="style" crossorigin href="${href}">`
        : `    <link rel="preload" as="fetch" crossorigin href="${href}">`)
    const file = path.join(dist, pathname.replace(/^\//, ''), 'index.html')
    writeFileSync(file, readFileSync(file, 'utf8').replace('</head>', `${tags.join('\n')}\n  </head>`))
    console.log(`${pathname}: ${seen.filter(h => h.endsWith('.js')).length} chunks, ${seen.filter(h => h.endsWith('.css')).length} styles, ${seen.filter(h => h.endsWith('.json')).length} JSON -> ${file}`)
  } finally {
    chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
