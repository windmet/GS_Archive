// Page gallery capture: screenshots every gallery scene and key app routes at desktop, tablet
// and phone width with a real browser, and fails on empty renders or page errors.
//   node scripts/capture-gallery.mjs <label> [--base=http://localhost:5175] [--only=card-detail,app-portal]
// Needs a running dev server and a cached Playwright Chromium (no npm package required).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareGalleryData } from '../qa/gallery/prepare.mjs'
import { ARCHIVE_USER_PREFERENCES_KEY as PREFERENCES_KEY, DEFAULT_ARCHIVE_USER_PREFERENCES } from '../src/data/archiveUserPreferences.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const label = args.find(arg => !arg.startsWith('--')) || 'current'
const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const base = (option('base') || 'http://localhost:5175').replace(/\/$/, '')
const only = option('only')?.split(',')

const GALLERY = ['card-detail', 'card-list', 'song-detail', 'gasha-detail', 'story-main', 'story-extra', 'story-birthday', 'story-collection', 'work-story', 'seasonal', 'mobile-archive']
  .map(id => ({ id, url: `${base}/qa/gallery/?scene=${id}`, gallery: true }))
// The browser profile is fresh, so a first visit would open the onboarding over every app
// route. Scenes start as a returning reader; app-onboarding alone starts as a new visitor.
const RETURNING_READER = { ...DEFAULT_ARCHIVE_USER_PREFERENCES, startupPage: 'portal', onboardingComplete: true }
const APP = [
  { id: 'app-onboarding', url: `${base}/?view=portal`, preferences: null, waitFor: 'dialog.onboarding[open]' },
  { id: 'app-welcome', url: `${base}/?view=welcome` },
  { id: 'app-portal', url: `${base}/?view=portal` },
  { id: 'app-player', url: `${base}/?view=player&scenario=001tom_101_2_1_001_01_00.json&noAudio=1`, canvas: true },
  // Real read-model routes; need SIDEM_READMODEL_CANDIDATE on the dev server.
  { id: 'app-card', url: `${base}/?view=card_detail&card=001tom_ssr01`, readModel: true },
  { id: 'app-cards', url: `${base}/?view=cards&idol=001tom`, readModel: true },
  { id: 'app-song', url: `${base}/?view=song_detail&song=brndnf`, readModel: true },
  { id: 'app-idol', url: `${base}/?view=idol_detail&idol=001tom`, readModel: true },
  { id: 'app-event', url: `${base}/?view=event_detail&event=410018`, readModel: true },
  { id: 'app-song-list', url: `${base}/?view=song_catalog`, readModel: true },
  { id: 'app-event-list', url: `${base}/?view=event_catalog`, readModel: true },
  { id: 'app-gasha-list', url: `${base}/?view=gashas`, readModel: true },
  { id: 'app-idol-list', url: `${base}/?view=idols`, readModel: true },
  { id: 'app-collection-list', url: `${base}/?view=collection_catalog`, readModel: true },
  { id: 'app-photo-list', url: `${base}/?view=photo_catalog`, readModel: true },
  { id: 'app-story-list', url: `${base}/?view=story_catalog`, readModel: true },
]
// One capture per viewport tier: wide >1100, middle 761-1100 (sidebar still shown), phone <=760.
const WIDTHS = [
  { name: 'desktop', width: 1280, height: 900, mobile: false },
  { name: 'tablet', width: 768, height: 1024, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
]
const scenes = [...GALLERY, ...APP].filter(scene => !only || only.includes(scene.id))

function findChrome() {
  const cache = path.join(os.homedir(), 'AppData/Local/ms-playwright')
  const dirs = existsSync(cache) ? readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse() : []
  for (const dir of dirs) {
    const exe = path.join(cache, dir, 'chrome-win64/chrome.exe')
    if (existsSync(exe)) return exe
  }
  throw new Error('No cached Playwright Chromium found under ' + cache)
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
prepareGalleryData()
const out =path.join(root, '.analysis/gallery', label)
mkdirSync(out, { recursive: true })
const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-gallery-'))
const port = 9300 + Math.floor(Math.random() * 400)
const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, '--headless=new', `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', 'about:blank'], { stdio: 'ignore' })

let targets
for (let i = 0; i < 50 && !targets?.length; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { await sleep(200) }
}
const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve))
let sequence = 0, errors = []
const pending = new Map()
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message.result ?? message); pending.delete(message.id); return }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description?.split('\n')[0] || message.params.exceptionDetails.text)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ').split('\n')[0])
})
const send = (method, params = {}) => new Promise(resolve => { const id = ++sequence; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
await send('Page.enable'); await send('Runtime.enable')

const report = []
try {
  for (const scene of scenes) {
    for (const size of WIDTHS) {
      errors = []
      await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: size.mobile })
      const preferences = 'preferences' in scene ? scene.preferences : RETURNING_READER
      const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', { source: preferences
        ? `localStorage.setItem(${JSON.stringify(PREFERENCES_KEY)}, ${JSON.stringify(JSON.stringify(preferences))})`
        : `localStorage.removeItem(${JSON.stringify(PREFERENCES_KEY)})` })
      await send('Page.navigate', { url: scene.url })
      const probe = `({ gallery: document.documentElement.dataset.galleryState || '', text: document.body.innerText.trim().length, canvas: document.querySelectorAll('canvas').length, waited: !${JSON.stringify(scene.waitFor || '')} || !!document.querySelector(${JSON.stringify(scene.waitFor || '')}), overflow: document.documentElement.scrollWidth > innerWidth + 1 })`
      let state = null
      for (let i = 0; i < 120; i++) {
        await sleep(250)
        state = await evaluate(probe)
        const ready = scene.gallery ? state?.gallery === 'ready' || state?.gallery === 'failed' : state?.text > 40 && state.waited && (!scene.canvas || state.canvas > 0)
        if (ready) break
      }
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
      await sleep(1200) // let images and fonts settle
      state = await evaluate(probe)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const file = `${scene.id}-${size.name}.png`
      writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'))
      const problems = []
      if (scene.gallery && state.gallery !== 'ready') problems.push(`scene state ${state.gallery || 'never ready'}`)
      // A stage scene is judged by its canvas; its dialogue box may be closed at the captured step.
      if (state.text < 40 && !scene.canvas) problems.push('page rendered almost no text')
      if (scene.canvas && !state.canvas) problems.push('stage canvas missing')
      if (!state.waited) problems.push(`${scene.waitFor} never appeared`)
      if (state.overflow) problems.push('page scrolls sideways')
      // Without a local read-model candidate the plain app routes degrade by design; read-model scenes must not.
      if (!scene.gallery && !scene.readModel) errors = errors.filter(text => !/ReadModel|Expected JSON/.test(text))
      problems.push(...errors.map(text => `error: ${text}`))
      report.push({ scene: scene.id, width: size.name, file, ok: problems.length === 0, problems })
      console.log(`${problems.length ? 'FAIL' : 'ok  '} ${scene.id} ${size.name}${problems.length ? ' — ' + problems.join('; ') : ''}`)
    }
  }
} finally {
  socket.close(); chrome.kill()
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
}
writeFileSync(path.join(out, 'report.json'), JSON.stringify({ label, base, capturedAt: new Date().toISOString(), report }, null, 2))
const failed = report.filter(entry => !entry.ok)
console.log(`Gallery "${label}": ${report.length - failed.length}/${report.length} captures clean -> ${path.relative(root, out)}`)
process.exitCode = failed.length ? 1 : 0
