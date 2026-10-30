// Read-only layout evidence collector; reuses #148 route seeds and Chromium/CDP transport.
// node scripts/verify-layout-integrity-browser.mjs --base=http://127.0.0.1:5198
// --full: ten requested viewports; --windows=759x720,760x720,761x720
// --only=reader,studio-edit --output=E:/explicit/evidence/path
// Candidates require visual triage; completion is not a layout PASS.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const base = (args.find(arg => arg.startsWith('--base='))?.split('=').slice(1).join('=') || 'http://127.0.0.1:5173').replace(/\/$/, '')
const only = args.find(arg => arg.startsWith('--only='))?.slice(7).split(',')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// The booklet's audit routes, each measured at 390 (phone) and 1280 (desktop). The third field is a selector clicked
// once the page is up (a detail reached from its catalog).
const ROUTES = [
  ['event-long','/events/410001/'], ['portal', '/?view=portal&portal_scope=all'], ['event', '/events/10020/'], ['event-orig', '/events/410002/'], ['live', '/live/'],
  ['song', '/songs/brndnf/'], ['card', '/cards/001tom_ssr01/'], ['idol', '/idols/001tom/'], ['unit-jup', '/units/01jup/'],
  ['unit-fra', '/units/06fra/'], ['units', '/units/'], ['idols', '/idols/'], ['cards', '/cards/'], ['songs', '/songs/'],
  ['stories', '/stories/'], ['stories-event', '/stories/event/'], ['story-main', '/stories/main/101/'], ['events', '/events/'],
  ['gashas', '/gashas/'], ['gasha', '/gashas/', '[data-archive-focus-id^=gasha]'], ['items', '/items/'], ['costumes', '/costumes/'],
  ['honors', '/honors/'], ['currencies', '/currencies/'], ['photos', '/photos/'], ['unused', '/unused/'], ['mobile', '/mobile/001tom/'],
  ['stage','/?view=chibi_stage'], ['player','/?view=player&reading=1_3_10001_01_a&play_mode=segment&at_step=1&event=410001&scenario=episodes%2F1_3_10001_01_a.json&start_step=1&end_step=25&return=reader'], ['reader','/?view=reader&reading=1_3_10001_01_a&event=410001'], ['studio-edit','/studio/edit/'], ['studio', '/studio/'], ['about', '/about/'], ['scores', '/scores/'], ['chart', '/live/', '.song-go[aria-label$="的谱面"]'],
]
const customWindows=args.find(a=>a.startsWith('--windows='))?.slice(10).split(',').map(s=>s.split('x').map(Number))
const WINDOWS = (customWindows || (args.includes('--full') ? [[320,720],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,688],[1366,768],[1440,900],[1920,1080]] : [[320,720],[390,844],[1280,688]])).map(([w,h])=>[`${w}x${h}`,w,h,w<600])

// Explicit exceptions: only descendants of actual overflow-x:auto/scroll containers.
// Hidden accessibility labels and deliberate art crops remain candidates for human triage.
const DETECT = `(() => {
 const visible = e => { const r=e.getBoundingClientRect(),s=getComputedStyle(e); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none' }
 const describe = e => ({tag:e.tagName,cls:typeof e.className==='string'?e.className:'',text:(e.innerText||e.getAttribute('aria-label')||'').slice(0,100),rect:JSON.parse(JSON.stringify(e.getBoundingClientRect()))})
 const els=[...document.querySelectorAll('body *')].filter(visible)
 const allowed=e=>{for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);if(['auto','scroll'].includes(s.overflowX)&&n.scrollWidth>n.clientWidth)return true}return false}
 const outside=els.filter(e=>{const r=e.getBoundingClientRect();return (r.left < -2 || r.right>innerWidth+2)&&!allowed(e)&&!e.closest('svg')})
 const clipped=els.filter(e=>e.matches('h1,h2,h3,button,label') && e.scrollWidth>e.clientWidth+2 && !allowed(e))
 const inputs=els.filter(e=>e.matches('input:not([type=range]),textarea,select')).map(e=>({...describe(e),fontSize:getComputedStyle(e).fontSize}))
 const fixed=els.filter(e=>['fixed','sticky'].includes(getComputedStyle(e).position)).map(describe)
 return JSON.stringify({url:location.href,title:document.title,bodyText:document.body.innerText.slice(0,150),horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,outside:outside.slice(0,40).map(describe),clipped:clipped.slice(0,30).map(describe),inputs,fixed,brokenImages:els.filter(e=>e.tagName==='IMG'&&e.complete&&!e.naturalWidth).map(describe)})
})()`

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

const output = args.find(a=>a.startsWith('--output='))?.slice(9) || 'E:/Web_build/SideM_Archived/web_viewer/.analysis/responsive-audit-20261030'
const { mkdirSync } = await import('node:fs'); mkdirSync(output,{recursive:true})
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-box-on-line-'))
const port = 9500 + Math.floor(Math.random() * 400)
const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let socket
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
  await send('Page.navigate', { url: base + '/?view=about' }); await sleep(2500)
  await evaluate(`localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:'001tom',preferredIdol:'001tom',portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})); localStorage.setItem('sidem:archive-sidebar', 'full'); true`)

  const results=[]
  for (const [tier,width,height,mobile] of WINDOWS) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile})
    for(const [id,url,click] of ROUTES){
      if(only && !only.includes(id))continue
      await send('Page.navigate',{url:base+url}); await sleep(2500)
      if(click){await evaluate(`document.querySelector(${JSON.stringify(click)})?.click()`);await sleep(1500)}
      const raw=await evaluate(DETECT)
      const result=raw?JSON.parse(raw):{error:'evaluation failed'}
      const screenshot=await send('Page.captureScreenshot',{format:'png'})
      const name=`${tier}-${id}`
      if(screenshot.data)writeFileSync(path.join(output,name+'.png'),Buffer.from(screenshot.data,'base64'))
      results.push({name,...result});writeFileSync(path.join(output,only ? 'measurements-extra.json' : 'measurements.json'),JSON.stringify(results,null,2))
      console.log(name, result.horizontalOverflow?'OVERFLOW':'measured',result.outside?.length,result.clipped?.length)
    }
  }
  console.log('Evidence:',output)

} finally {
  socket?.close()
  chrome.kill()
  await sleep(300)
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* the browser may still hold it */ }
}
