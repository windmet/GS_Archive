// L4 experiment helper: B+ swap timing, before/after screenshots and post-swap navigation under mobile throttling.
//   node check-prerender-swap.mjs <base> <outDir>
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'; import path from 'node:path'
const base = process.argv[2], out = process.argv[3]; mkdirSync(out, { recursive: true })
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const exe = path.join(cache, readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort().reverse()[0], 'chrome-win64/chrome.exe')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-bp-')); const port = 9800 + Math.floor(Math.random() * 90)
const chrome = spawn(exe, [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let targets; for (let i = 0; i < 100 && !targets?.some(t => t.type === 'page'); i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r))
let seq = 0; const pend = new Map(); const errors = []
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]) })
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value
const shot = async n => writeFileSync(path.join(out, n + '.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setCPUThrottlingRate', { rate: 4 })
await send('Network.enable'); await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 })
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:null,preferredIdol:null,portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})) } catch {}
  window.__swap = null; new MutationObserver(() => { if (window.__swap === null && document.body && !document.querySelector('[data-prerendered]') && document.getElementById('app')) window.__swap = performance.now() }).observe(document, { childList: true, subtree: true, attributes: true })` })
for (const p of ['/idols/001tom/', '/units/01jup/']) {
  await send('Page.navigate', { url: base + p })
  await sleep(1500); await shot(p.split('/')[1] + '-before-swap')
  for (let i = 0; i < 60 && !(await ev('window.__swap')); i++) await sleep(250)
  const swap = await ev('window.__swap'); await sleep(500); await shot(p.split('/')[1] + '-after-swap')
  const state = await ev(`({ apps: document.querySelectorAll('#app').length, prerendered: !!document.querySelector('[data-prerendered]'), hiddenStyle: document.getElementById('app')?.getAttribute('style'), url: location.pathname + location.search, title: document.title })`)
  console.log(p, 'swap at', Math.round(swap), 'ms', JSON.stringify(state))
}
// After the swap the app is interactive: open a related page and come back.
await ev(`document.querySelector('.unit-members .archive-idol-reference')?.click()`); await sleep(3000)
const member = await ev('location.pathname')
await ev(`document.querySelector('.archive-back')?.click()`); await sleep(2500)
console.log('member', member, 'back', await ev('location.pathname'), 'errors', errors.length, errors.slice(0, 3).join(' | '))
ws.close(); chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }) } catch {}
