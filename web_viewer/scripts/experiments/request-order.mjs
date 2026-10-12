// L4 experiment helper: order of code/data requests for one page under mobile throttling.
//   node request-order.mjs <base> <path>   (Git Bash: prefix MSYS_NO_PATHCONV=1)
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'; import path from 'node:path'
const [base, pathname] = process.argv.slice(2)
const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
const exe = path.join(cache, readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort().reverse()[0], 'chrome-win64/chrome.exe')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-req-')); const port = 9600 + Math.floor(Math.random() * 90)
const chrome = spawn(exe, [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 100 && !t?.some(x => x.type === 'page'); i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r))
let seq = 0; const pend = new Map(); const reqs = []; let t0 = 0
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id) }
  if (m.method === 'Network.requestWillBeSent') { t0 ||= m.params.timestamp; const u = new URL(m.params.request.url); if (/^\/(_app|_catalog|translations)\//.test(u.pathname) || u.pathname.endsWith('/')) reqs.push(`${Math.round((m.params.timestamp - t0) * 1000)}ms ${m.params.initiator?.type || ''} ${u.pathname}`) } })
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setCPUThrottlingRate', { rate: 4 }); await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 })
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:null,preferredIdol:null,portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})) } catch {}` })
await send('Page.navigate', { url: base + pathname }); await sleep(9000)
console.log(reqs.join('\n'))
ws.close(); chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }) } catch {}
