// Cold-load measurement for portal pages (docs/GS_ARCHIVE_PORTAL_STATIC_ROUTE_PLAN_20261012.md §5).
//   node scripts/measure-portal-cold-load.mjs <label> [--base=https://gs-archive-preview.pages.dev] [--runs=5]
//     [--profile=mobile|desktop] [--pages=home,portal,idol,unit,cards,stage-drive,stage-hnd,stage-tbt,stage-flash] [--paths]
//     [--stage-quality=full|lite] [--timeout-ms=120000] [--expected-release=<sha256>]
// Each run is a fresh browser profile with the cache disabled. The mobile profile uses the Lighthouse mobile
// preset (150 ms RTT, 1.6 Mbps down, 750 kbps up, 4x CPU slowdown, 390x844). Reports medians to
// .analysis/perf-baseline/<label>/. Read-only GETs; keep runs small against production.
// "entity" is the moment the page's own content first appears in the DOM (an idol name, a unit's members, …),
// which is what a reader waits for; FCP alone can be the empty app shell.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {stageMeasurementPages,median,measurementFailures,createColdNetworkTracker,buildColdObserver,rejectMixedBuilds} from './lib/cold-load-metrics.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const label = args.find(arg => !arg.startsWith('--')) || 'baseline'
const option = (name, fallback) => args.find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback
const base = option('base', 'https://gs-archive-preview.pages.dev').replace(/\/$/, '')
const runs = Number(option('runs', '5'))
const profileName = option('profile', 'mobile')
const usePaths = args.includes('--paths')
const stageQuality=option('stage-quality','full')
const expectedRelease=option('expected-release','')
const timeoutMs=Number(option('timeout-ms',option('pages','').split(',').some(page=>page.startsWith('stage-'))?'120000':'45000'))
if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(label))throw Error('Invalid report label')
if(!Number.isInteger(runs) || runs<1 || runs>20)throw Error('runs must be 1..20')
if(!Number.isInteger(timeoutMs) || timeoutMs<1000 || timeoutMs>300000)throw Error('timeout-ms must be 1000..300000')
if(expectedRelease && !/^[a-f0-9]{64}$/.test(expectedRelease))throw Error('Invalid expected release')
const PAGES = {
  home: { url: '/?view=home', entity: `!!document.querySelector('canvas') || /冬[马馬]|翔太|北斗/.test(document.body.innerText)` },
  portal: { url: '/?view=portal', entity: `document.querySelectorAll('img').length > 4 && document.body.innerText.trim().length > 200` },
  idol: { url: usePaths ? '/idols/001tom/' : '/?view=idol_detail&idol=001tom', entity: `!!document.querySelector('[data-archive-focus-id^="idol-domain:"]') && /冬[马馬]/.test(document.body.innerText)` },
  unit: { url: usePaths ? '/units/01jup/' : '/?view=unit_detail&unit=01jup', entity: `!!document.querySelector('.unit-members .archive-idol-reference')` },
  cards: { url: '/?view=cards&idol=001tom', entity: `document.querySelectorAll('img').length > 6 && /SSR/.test(document.body.innerText)` },
}
const defaultPages=Object.keys(PAGES).join(',')
Object.assign(PAGES,stageMeasurementPages(stageQuality))
const pages = option('pages', defaultPages).split(',')
if(pages.some(page=>!PAGES[page]) || new Set(pages).size!==pages.length)throw Error('Unknown or duplicate page')
const PROFILES = {
  mobile: { metrics: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, cpu: 4,
    network: { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 } },
  desktop: { metrics: { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false }, cpu: 1, network: null },
}
const profile = PROFILES[profileName]
if (!profile) throw new Error(`Unknown profile ${profileName}`)
const out = path.join(root, '.analysis/perf-baseline', label)
mkdirSync(out, { recursive: true })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function findChrome() {
  const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
  const dir = readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse().find(name => existsSync(path.join(cache, name, 'chrome-win64/chrome.exe')))
  if (!dir) throw new Error('No cached Playwright Chromium found under ' + cache)
  return path.join(cache, dir, 'chrome-win64/chrome.exe')
}



async function measure(pageId) {
  const page = PAGES[pageId]
  const dir = mkdtempSync(path.join(os.tmpdir(), 'gs-perf-'))
  const port = 9500 + Math.floor(Math.random() * 400)
  const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${dir}`, '--no-first-run',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore',windowsHide:true })
  let socket
  try {
    let targets
    for (let i = 0; i < 100 && !targets?.some(t => t.type === 'page'); i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) } }
    const target = targets?.find(t => t.type === 'page')
    if (!target) throw new Error('browser did not expose a page target')
    socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise(resolve => socket.addEventListener('open', resolve))
    let seq = 0
    const pending = new Map()
    const network=createColdNetworkTracker()
    const requests=network.requests
    const errors = []
    socket.addEventListener('message', event => {
      const m = JSON.parse(event.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); return }
      const p = m.params
      network.event(m.method,p)
      if (m.method === 'Runtime.exceptionThrown') errors.push(p.exceptionDetails.exception?.description?.split('\n')[0] || p.exceptionDetails.text)
    })
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)) }, 60000)
      pending.set(id, value => { clearTimeout(timer); if(value.error)reject(new Error(`${method}: ${value.error.message}`)); else resolve(value) }); socket.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Performance.enable')
    await send('Network.setCacheDisabled', { cacheDisabled: true })
    await send('Emulation.setDeviceMetricsOverride', profile.metrics)
    if (profile.cpu > 1) await send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
    if (profile.network) await send('Network.emulateNetworkConditions', profile.network)
    await send('Page.addScriptToEvaluateOnNewDocument', { source: buildColdObserver(page.entity,page.setup) })
    const started = Date.now()
    await send('Page.navigate', { url: base + page.url })
    // Scene-ready is separate from audio/motion preloading or actual playback.
    // Wait for 2 s of network quiet; timed out/failed samples never enter medians.
    while (Date.now() - started < timeoutMs) {
      await sleep(500)
      const entity = await evaluate('window.__gsPerf && window.__gsPerf.entity')
      if (entity !== null && entity !== undefined && network.inflight === 0 && Date.now() - network.lastNetwork > 2000) break
    }
    const perf = await evaluate(`JSON.stringify({ ...window.__gsPerf, entityPresent:Boolean(${page.entity}), timeOrigin:performance.timeOrigin,release:(()=>{try{return JSON.parse(document.querySelector('#archive-bootstrap')?.textContent||'{}').release||''}catch{return ''}})(),ttfb: performance.getEntriesByType("navigation")[0]?.responseStart ?? null, dcl: performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ?? null })`)
    const metrics = Object.fromEntries((await send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]))
    const byType = {}
    for (const r of requests.values()) {
      const t = r.type.toLowerCase()
      byType[t] = byType[t] || { count: 0, bytes: 0 }
      byType[t].count++; byType[t].bytes += r.bytes
    }
    const entry = [...requests.values()].filter(r => /\/_app\/index-[^/]+\.js$/.test(r.url)).map(r => ({ file: r.url.split('/').pop(), bytes: r.bytes }))
    const observed=JSON.parse(perf)
    const atEntity=Number.isFinite(observed.entity)?network.atEntity(observed.timeOrigin+observed.entity):null
    return { page: pageId, stage:page.stage||null, ...observed, atEntity, scriptMs: metrics.ScriptDuration * 1000, taskMs: metrics.TaskDuration * 1000, heapMB: metrics.JSHeapUsedSize / 1048576,
      requests: requests.length, bytes: [...requests.values()].reduce((sum, r) => sum + r.bytes, 0), byType, entry, failed: [...requests.values()].filter(r => r.status >= 400 || r.failed).length,
      failedResources:requests.filter(r=>r.status>=400 || r.failed).map(r=>({url:r.url,status:r.status,reason:r.failure||''})),
      errors: errors.slice(0, 5), timedOut: Date.now() - started >= timeoutMs }
  } finally {
    try { socket?.close() } catch {}
    chrome.kill(); await sleep(300)
    try {
      if(path.dirname(realpathSync(dir))!==realpathSync(os.tmpdir()) || realpathSync(dir)!==path.resolve(dir) || !path.basename(dir).startsWith('gs-perf-'))throw Error('Unsafe profile cleanup')
      rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
}

const results = []
for (const pageId of pages) {
  for (let i = 0; i < runs; i++) {
    try {
      // One retry when the browser itself fails to start; page errors are recorded, not retried.
      let browserStartRetries=0
      const r = await measure(pageId).catch(error => {
        if(!/browser did not expose a page target/.test(error.message))throw error
        browserStartRetries++;return measure(pageId)
      })
      r.browserStartRetries=browserStartRetries
      r.failures=measurementFailures(r,expectedRelease);r.valid=r.failures.length===0
      results.push(r)
      console.log(`${pageId} #${i + 1}: entity ${Math.round(r.entity ?? -1)} ms, gap ${Math.round(r.gapMs ?? 0)} ms, FCP ${Math.round(r.fcp ?? -1)}, LCP ${Math.round(r.lcp ?? -1)}, CLS ${Number.isFinite(r.cls)?r.cls.toFixed(3):'—'}, script ${Math.round(r.scriptMs)} ms, ${r.requests} req / ${(r.bytes / 1024).toFixed(0)} KiB${r.valid ? '' : ' (INVALID: '+r.failures.join(',')+')'}`)
    } catch (error) {
      results.push({ page: pageId, error: error.message,valid:false,failures:['runner-error'] })
      console.log(`${pageId} #${i + 1}: FAILED ${error.message}`)
    }
  }
}
const buildIdentities=rejectMixedBuilds(results)
const summary = pages.map(pageId => {
  const samples=results.filter(r=>r.page===pageId)
  const rs = samples.filter(r=>r.valid)
  const pick = key => median(rs.map(r => r[key]))
  const types = {}
  for (const r of rs) for (const [t, v] of Object.entries(r.byType)) (types[t] = types[t] || []).push(v.bytes)
  return { page: pageId, url: PAGES[pageId].url, runs: rs.length, attempts:results.filter(r=>r.page===pageId).length, invalid:results.filter(r=>r.page===pageId && !r.valid).length, ttfb: pick('ttfb'), fcp: pick('fcp'), lcp: pick('lcp'), entity: pick('entity'), dcl: pick('dcl'), cls: pick('cls'),
    longTaskMs: pick('longTaskMs'), longTasks: pick('longTasks'), gapMs: pick('gapMs'), gaps: pick('gaps'), restored: pick('restored'), scriptMs: pick('scriptMs'), taskMs: pick('taskMs'), heapMB: pick('heapMB'), requests: pick('requests'), kib: pick('bytes')===null?null:pick('bytes')/1024,
    kibByType: Object.fromEntries(Object.entries(types).map(([t, v]) => [t, Math.round(median(v) / 1024)])), lcpTag: rs.at(-1)?.lcpTag || '', entry: rs.at(-1)?.entry || [],
    requestsAtEntity:median(rs.map(r=>r.atEntity?.requests)),bytesAtEntity:median(rs.map(r=>r.atEntity?.bytes)),
    failureReasons:[...new Set(samples.flatMap(r=>r.failures||[]))],failedResources:samples.flatMap(r=>r.failedResources||[]).slice(0,15),
    timedOut: results.filter(r => r.page===pageId && r.timedOut).length, failedRequests: Math.max(0, ...samples.map(r => r.failed||0)), errors: [...new Set(samples.flatMap(r => r.errors||[]))].slice(0, 3) }
})
const fmt = v => v === null || v === undefined ? '—' : Math.round(v)
const table = ['| 页面 | TTFB | FCP | 实体出现 | 内容空窗 ms | LCP | CLS | 长任务 ms | 脚本 ms | 请求数 | KiB | script KiB | 有效/尝试 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...summary.map(s => `| ${s.page} | ${fmt(s.ttfb)} | ${fmt(s.fcp)} | ${fmt(s.entity)} | ${fmt(s.gapMs)} | ${fmt(s.lcp)} | ${s.cls?.toFixed(3) ?? '—'} | ${fmt(s.longTaskMs)} | ${fmt(s.scriptMs)} | ${fmt(s.requests)} | ${fmt(s.kib)} | ${s.kibByType.script ?? '—'} | ${s.runs}/${s.attempts} |`)].join('\n')
writeFileSync(path.join(out, 'report.json'), JSON.stringify({ label, base, profile: profileName, runs, usePaths,stageQuality,expectedRelease,timeoutMs,profileConfig:profile,renderingBackend:'swiftshader-requested',buildIdentities,buildConsistent:buildIdentities.length===1 && buildIdentities[0].entry.length>0 && Boolean(buildIdentities[0].release), measuredAt: new Date().toISOString(), summary, results }, null, 2))
writeFileSync(path.join(out, 'report.md'), `# ${label}\n\n${base} · ${profileName} · ${runs} runs · medians (ms)\n\n${table}\n`)
console.log('\n' + table + `\n\n-> ${path.relative(root, out)}`)
if(results.some(result=>!result.valid))process.exitCode=1
