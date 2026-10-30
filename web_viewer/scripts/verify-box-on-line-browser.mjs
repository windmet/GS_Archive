// Boxes on lines (线框减法册 rule 3): a control drawn with its own four-sided border or fill whose top or bottom edge
// sits within 14px of a horizontal rule spanning >= 60% of its width. The detector is the one the booklet's audit
// table was counted with; the shell's title row, sidebar and bottom navigation are not counted. Per page and window
// the count may only fall: config/box-on-line-baseline.json, lowered with --update.
//   node scripts/verify-box-on-line-browser.mjs [--base=http://127.0.0.1:5173] [--update] [--only=m-card,d-card]
// Needs a running dev server and a cached Playwright Chromium or chrome-headless-shell (no npm package required).
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const args = process.argv.slice(2)
const base = (args.find(arg => arg.startsWith('--base='))?.split('=').slice(1).join('=') || 'http://127.0.0.1:5173').replace(/\/$/, '')
const update = args.includes('--update')
const only = args.find(arg => arg.startsWith('--only='))?.slice(7).split(',')
const baselinePath = fileURLToPath(new URL('../config/box-on-line-baseline.json', import.meta.url))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// The booklet's audit routes, each measured at 390 (phone) and 1280 (desktop). The third field is a selector clicked
// once the page is up (a detail reached from its catalog).
const ROUTES = [
  ['portal', '/?view=portal&portal_scope=all'], ['event', '/events/10020/'], ['event-orig', '/events/410002/'], ['live', '/live/'],
  ['song', '/songs/brndnf/'], ['card', '/cards/001tom_ssr01/'], ['idol', '/idols/001tom/'], ['unit-jup', '/units/01jup/'],
  ['unit-fra', '/units/06fra/'], ['units', '/units/'], ['idols', '/idols/'], ['cards', '/cards/'], ['songs', '/songs/'],
  ['stories', '/stories/'], ['stories-event', '/stories/event/'], ['story-main', '/stories/main/101/'], ['events', '/events/'],
  ['gashas', '/gashas/'], ['gasha', '/gashas/', '[data-archive-focus-id^=gasha]'], ['items', '/items/'], ['costumes', '/costumes/'],
  ['honors', '/honors/'], ['currencies', '/currencies/'], ['photos', '/photos/'], ['unused', '/unused/'], ['mobile', '/mobile/001tom/'],
  ['studio', '/studio/'], ['about', '/about/'], ['scores', '/scores/'], ['chart', '/live/', '.chart-row-open'],
]
const WINDOWS = [['m', 390, 844, true], ['d', 1280, 800, false]]

const DETECT = `(() => {
  const px = v => parseFloat(v) || 0
  const transparent = c => !c || c === 'transparent' || /rgba\\([^)]*,\\s*0\\)$/.test(c)
  const edge = (s, S) => px(s[\`border\${S}Width\`]) >= 1 && s[\`border\${S}Style\`] !== 'none' && !transparent(s[\`border\${S}Color\`])
  const describe = el => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).filter(c => c && !/^(is-|has-|active$|selected$)/.test(c)).slice(0, 2).join('.') : ''
    const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 16)
    return \`\${el.tagName.toLowerCase()}\${cls ? '.' + cls : ''}\${label ? \` "\${label}"\` : ''}\`
  }
  const path = el => { const out = []; for (let n = el.parentElement; n && out.length < 3; n = n.parentElement) { if (typeof n.className === 'string' && n.className.trim()) out.push(n.className.trim().split(/\\s+/)[0]) } return out.reverse().join(' > ') }
  const bgOf = el => { for (let n = el.parentElement; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (!transparent(c)) return c } return 'rgb(255, 255, 255)' }
  const INTERACTIVE = 'button, select, input, textarea, summary, a[href], label, [role=radiogroup], [role=tablist], [role=tab], [role=radio], [role=button], [role=search], form'
  // The booklet counts boxes on the page, not in the shell's title row, sidebar or bottom navigation.
  const SHELL = '.archive-topbar, .archive-sidebar, .archive-mobile-nav, .archive-bottom-nav'
  const rules = [], boxes = []
  for (const el of document.querySelectorAll('body *')) {
    if (el instanceof SVGElement) continue
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || s.display === 'contents') continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 1) continue
    const T = edge(s, 'Top'), B = edge(s, 'Bottom'), L = edge(s, 'Left'), R = edge(s, 'Right')
    if (el.tagName === 'HR' || ((T || B) && !L && !R)) {
      if (r.width >= 80) {
        if (el.tagName === 'HR' || T) rules.push({ y: r.top, x1: r.left, x2: r.right, el, side: 'Top' })
        if (B && el.tagName !== 'HR') rules.push({ y: r.bottom, x1: r.left, x2: r.right, el, side: 'Bottom' })
      }
      continue
    }
    if (r.height > 72 || r.width < 28 || r.height < 20) continue
    if (el.matches('img, video, canvas, picture')) continue
    // Circles (avatars, round icon buttons) are not boxes.
    if (px(s.borderTopLeftRadius) >= Math.min(r.width, r.height) / 2 - 1 && Math.abs(r.width - r.height) < 4) continue
    const bordered = T && B && L && R
    const filled = !transparent(s.backgroundColor) && s.backgroundColor !== bgOf(el)
    if (!bordered && !filled) continue
    if (!el.matches(INTERACTIVE) && !el.querySelector('button, select, input, [role=radio]')) continue
    if (el.closest(SHELL)) continue
    // A switch or slider in a settings row is the row's own control (the booklet does not count it).
    if (el.closest('.gs-row') && el.matches('.gs-switch, input[type=range]')) continue
    boxes.push({ el, r, kind: bordered ? 'border' : 'fill' })
  }
  const outer = boxes.filter(b => !boxes.some(o => o !== b && o.el.contains(b.el)))
  const NEAR = 14
  const hits = []
  for (const b of outer) {
    const overlaps = rule => Math.min(rule.x2, b.r.right) - Math.max(rule.x1, b.r.left) >= b.r.width * 0.6
    const fine = rule => overlaps(rule) && !b.el.contains(rule.el)
    const above = rules.filter(rule => fine(rule) && b.r.top - rule.y >= -1 && b.r.top - rule.y <= NEAR)
    const below = rules.filter(rule => fine(rule) && rule.y - b.r.bottom >= -1 && rule.y - b.r.bottom <= NEAR)
    if (!above.length && !below.length) continue
    hits.push({ b, above, below })
  }
  return JSON.stringify({
    boxes: outer.length,
    hits: hits.length,
    items: hits.map(h => \`\${describe(h.b.el)} (\${h.above.length && h.below.length ? 'between' : h.above.length ? 'under' : 'on'} \${describe((h.below[0] || h.above[0]).el)})\`),
  })
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

  const current = {}, detail = {}, unrendered = []
  for (const [tier, width, height, mobile] of WINDOWS) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
    for (const [id, url, click] of ROUTES) {
      const name = `${tier}-${id}`
      if (only && !only.includes(name)) continue
      await send('Page.navigate', { url: base + url })
      // Settled when the page has a heading and two reads 600ms apart agree (lists and images arrive late).
      let previous = null, result = null
      for (let i = 0; i < 40; i++) {
        await sleep(600)
        if (click && i === 4) await evaluate(`(() => { const target = document.querySelector(${JSON.stringify(click)}); target?.click(); return Boolean(target) })()`)
        if (click && i <= 6) continue
        if (!await evaluate(`Boolean(document.querySelector('h1, h2, .overview-toolbar'))`)) continue
        result = JSON.parse(await evaluate(DETECT))
        if (previous && previous.boxes === result.boxes && previous.hits === result.hits && i >= 6) break
        previous = result
      }
      if (!result) { unrendered.push(name); continue }
      current[name] = result.hits
      detail[name] = result.items
    }
  }
  assert.deepEqual(unrendered, [], `pages that did not render: ${unrendered.join(', ')}`)
  const total = Object.values(current).reduce((sum, value) => sum + value, 0)
  if (update) {
    const merged = { ...(existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}), ...current }
    writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n')
    console.log(`Box on line: baseline written for ${Object.keys(current).length} page states (${total} boxes on lines)`)
    for (const [name, items] of Object.entries(detail)) if (items.length) console.log(`  ${name}: ${items.join(' | ')}`)
  } else {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
    const regressions = Object.entries(current).filter(([name, hits]) => hits > (baseline[name] ?? 0))
      .map(([name, hits]) => `${name}: ${baseline[name] ?? 0} -> ${hits}\n    ${detail[name].join('\n    ')}`)
    assert.deepEqual(regressions, [], `boxes on lines may only decrease:\n${regressions.join('\n')}`)
    const improved = Object.entries(current).filter(([name, hits]) => hits < (baseline[name] ?? 0)).length
    console.log(`Box on line: ${Object.keys(current).length} page states, ${total} boxes on lines, none added${improved ? ` (${improved} improved; run --update to lock in)` : ''}`)
  }
} finally {
  socket?.close()
  chrome.kill()
  await sleep(300)
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* the browser may still hold it */ }
}
