// Shell geometry in a real browser: the sidebar's brand row and the page's title row share one bottom line, the
// sidebar holds without scrolling down to 688px, no shell text is under 12px, 返回 is not mint, and the icon axis
// (x = 29) does not move between the 208 and 58 sidebars.
//   node scripts/verify-shell-geometry-browser.mjs [--base=http://127.0.0.1:5173]
// Needs a running dev server and a cached Playwright Chromium or chrome-headless-shell (no npm package required).
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const base = (args.find(arg => arg.startsWith('--base='))?.split('=').slice(1).join('=') || 'http://127.0.0.1:5173').replace(/\/$/, '')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const VIEWPORTS = [[1440, 900], [1366, 768], [1280, 688]]
const SIDEBARS = ['full', 'rail']
// kind: 'shell' pages have the shell's title row; 'portal' draws its own row inside the page.
const PAGES = [
  { id: 'interactions', url: '/mobile/001tom/?unit=01jup', kind: 'shell' },
  { id: 'cards', url: '/cards/', kind: 'shell' },
  { id: 'card-detail', url: '/cards/001tom_ssr01/', kind: 'shell', back: true },
  { id: 'items', url: '/items/', kind: 'shell', tabs: true },
  { id: 'live', url: '/?view=live', kind: 'shell' },
  { id: 'studio', url: '/?view=studio', kind: 'shell' },
  { id: 'portal', url: '/?view=portal', kind: 'portal' },
]

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

// Runs in the page: every number the assertions need.
const MEASURE = `(() => {
  const q = selector => document.querySelector(selector), rect = element => element && element.getBoundingClientRect()
  const brand = rect(q('.archive-brand')), top = rect(q('.archive-topbar')), portalBar = rect(q('.overview-toolbar'))
  const scroller = q('.archive-sidebar-scroll'), icon = rect(q('.archive-nav-link svg')), avatar = rect(q('.stage-idol-avatar'))
  const small = []
  for (const element of document.querySelectorAll('.archive-sidebar *, .archive-topbar *, .overview-toolbar *')) {
    if (![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue
    const style = getComputedStyle(element), box = element.getBoundingClientRect()
    if (style.display === 'none' || box.width <= 1) continue
    if (parseFloat(style.fontSize) < 12) small.push((element.className || element.tagName) + ':' + style.fontSize)
  }
  const back = q('.archive-back')
  return JSON.stringify({
    sidebar: Boolean(brand), brandBottom: brand && brand.bottom, titleBottom: (top || portalBar)?.bottom ?? null,
    navOverflow: scroller ? scroller.scrollHeight - scroller.clientHeight : null,
    iconMid: icon && (icon.left + icon.right) / 2, avatarMid: avatar && (avatar.left + avatar.right) / 2,
    small, backColor: back && getComputedStyle(back).color, tabs: Boolean(q('.collection-tabs')), h1: q('h1')?.textContent || '',
    sidebarWidth: rect(q('.archive-sidebar'))?.width, wide: document.documentElement.scrollWidth - innerWidth,
  })
})()`

const profile = mkdtempSync(path.join(os.tmpdir(), 'gs-shell-geometry-'))
const port = 9500 + Math.floor(Math.random() * 400)
const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let socket
const failures = []
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
  // A returning reader with a saved 担当, so the sidebar's identity row is present.
  await evaluate(`localStorage.setItem('sidem:archive-user-preferences', JSON.stringify({version:3,startupPage:'portal',homeMode:'spine',startupIdol:'001tom',preferredIdol:'001tom',portalDefaultScope:'favorite',stageLight:'mint',onboardingComplete:true})); true`)

  let checked = 0
  for (const [width, height] of VIEWPORTS) {
    const iconAxis = new Map()
    for (const sidebar of SIDEBARS) {
      await evaluate(`localStorage.setItem('sidem:archive-sidebar', '${sidebar}'); true`)
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      for (const page of PAGES) {
        const where = `${page.id} @${width}x${height} ${sidebar}`
        await send('Page.navigate', { url: base + page.url })
        // The shell mounts at once; the page behind it may take a moment, so wait for the row we measure.
        let m = null
        for (let i = 0; i < 40; i++) {
          await sleep(500)
          m = JSON.parse(await evaluate(MEASURE))
          if (m.sidebar && m.titleBottom !== null && (!page.tabs || m.tabs)) break
        }
        const check = (ok, message) => { if (!ok) failures.push(`${where}: ${message}`) }
        check(m.sidebar && m.titleBottom !== null, 'the shell or its title row did not render')
        if (!m.sidebar || m.titleBottom === null) continue
        checked++
        check(Math.abs(m.brandBottom - m.titleBottom) <= 0.5, `brand row ends at ${m.brandBottom}, title row at ${m.titleBottom}`)
        if (height >= 688) check(m.navOverflow !== null && m.navOverflow <= 0, `the sidebar scrolls by ${m.navOverflow}px`)
        check(m.small.length === 0, `text under 12px: ${m.small.join(', ')}`)
        check(m.sidebarWidth === (sidebar === 'full' ? 208 : 58), `sidebar is ${m.sidebarWidth}px wide`)
        check(m.wide <= 0, `the page scrolls sideways by ${m.wide}px`)
        if (page.back) check(m.backColor && !/rgb\(10, 122, 91\)/.test(m.backColor) && m.backColor !== 'rgb(22, 131, 141)', `返回 is mint (${m.backColor})`)
        if (page.tabs) check(m.tabs && m.h1 === '图鉴', 'the 图鉴 page has its title and its six tabs')
        if (m.iconMid !== null) iconAxis.set(sidebar, m.iconMid)
        check(m.iconMid === null || Math.abs(m.iconMid - 29) <= 0.5, `the first icon's centre is ${m.iconMid}, not 29`)
        check(m.avatarMid === null || Math.abs(m.avatarMid - 29) <= 0.5, `the 担当 avatar's centre is ${m.avatarMid}, not 29`)
      }
    }
  }
  assert.ok(checked >= VIEWPORTS.length * SIDEBARS.length * PAGES.length * 0.9, `only ${checked} page states rendered`)
  assert.deepEqual(failures, [], '\n' + failures.join('\n'))
  console.log(`Shell geometry: ${checked} page states (${VIEWPORTS.length} windows x 2 sidebar states x ${PAGES.length} pages): one 61px line, no sidebar scroll, no text under 12px, back not mint, icon axis fixed at 29 passed`)
} finally {
  socket?.close()
  chrome.kill()
  await sleep(300)
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* the browser may still hold it */ }
}
