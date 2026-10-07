import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Maintainer check: open archive pages in a real browser with the Chinese UI and list visible
// text that still contains kana, grouped by where it sits. Story dialogue, reader rows and other
// deliberately-source text are skipped. Needs a running dev server and the cached Chromium.
// Usage: node scripts/audit-visible-japanese.mjs [origin] [--out file.json]
const origin = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:5175').replace(/\/$/, '')
const outFile = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : ''
const selectedPages = process.argv.includes('--pages') ? process.argv[process.argv.indexOf('--pages') + 1]?.split(',') : null

// [label, url query, optional click selector to reach a detail page]
const PAGES = [
  ['portal', '?view=portal'],
  ['portal favourite', '?view=portal', null, { preferredIdol: '005kao', portalDefaultScope: 'favorite' }],
  ['idol directory', '?view=idols'],
  ['idol detail', '?view=idol_detail&idol=001tom'],
  ['unit detail', '?view=unit_detail&unit=01jup'],
  ['cards', '?view=cards'],
  ['card detail', '?view=cards', 'button[data-archive-focus-id^="card:"]', null, 'card_detail'],
  ['songs', '?view=song_catalog'],
  ['song detail', '?view=song_catalog', '.song-row, .song-card, [data-song-id]'],
  ['events', '?view=event_catalog'],
  ['event detail', '?view=event_catalog', 'button[data-archive-focus-id^="event:"]', null, 'event_detail'],
  ['gashas', '?view=gashas'],
  ['items', '?view=collection_catalog'],
  ['honors', '?view=collection_catalog&category=honors'],
  ['photos', '?view=photo_catalog'],
  ['stories', '?view=story_catalog'],
  ['main chapter', '?view=story_collection&story_type=main&story_section=101'],
  ['idol story', '?view=idol_story_archive&idol=001tom'],
  ['work story', '?view=work_archive&idol=001tom'],
  ['mobile personal', '?view=mobile_archive&idol=001tom'],
  ['mobile phone', '?view=mobile_archive&idol=001tom&mobile_mode=phone'],
  ['mobile unit', '?view=mobile_archive&idol=001tom&mobile_mode=unit'],
  ['mobile random', '?view=mobile_archive&idol=001tom&mobile_mode=random'],
  ['tools', '?view=experiments'],
  ['about', '?view=about'],
]
// Text that is source on purpose: story dialogue and synopses, song lyrics, proper nouns the
// archive shows in the original (song titles), and the language switch itself.
const SKIP = ['.reader-row', '.story-synopsis', '.chapter-synopsis', '.chapter-synopsis-text', '.synopsis',
  '.song-lyrics', '.archive-language-switch', '.archive-language-dropdown', 'option']

const chrome = process.env.USERPROFILE + '/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'
const profileRoot = path.resolve(import.meta.dirname, '../.analysis/visible-japanese-profiles')
fs.mkdirSync(profileRoot, { recursive: true })
if (fs.realpathSync(profileRoot) !== profileRoot) throw Error('Refusing linked browser profile root')
const port = 9450 + Math.floor(Math.random() * 40), profile = fs.mkdtempSync(path.join(profileRoot, 'run-'))
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,900', '--no-first-run', 'about:blank'], { stdio: 'ignore', windowsHide: true })
let launchError, ws
proc.on('error', error => { launchError = error })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
try {
let target
for (let i = 0; i < 60 && !target && !launchError; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page') } catch {} }
if (launchError) throw launchError
if (!target) throw Error('Chromium did not start')
ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let id = 0; const pending = new Map()
ws.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.id) pending.get(message.id)?.(message) }
const send = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Runtime.enable'); await send('Page.enable')

const collect = `(() => {
  const skip = ${JSON.stringify(SKIP.join(','))}
  const rows = []
  const walker = document.createTreeWalker(document.querySelector('.archive-content') || document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.replace(/\\s+/g, ' ').trim()
    const el = node.parentElement
    if (!text || !/[\\u3040-\\u30ff]/.test(text) || !el || el.closest(skip)) continue
    // Content marked Japanese on purpose is skipped; <html lang> is only the page default.
    const marked = el.closest('[lang]')
    if (marked && marked !== document.documentElement && /^ja/.test(marked.getAttribute('lang'))) continue
    const box = el.getBoundingClientRect(), style = getComputedStyle(el)
    if (!box.width || !box.height || style.visibility === 'hidden' || style.display === 'none') continue
    const where = [el, el.parentElement].filter(Boolean).map(e => e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')).reverse().join(' > ')
    rows.push({ where, text: text.slice(0, 80) })
  }
  return rows
})()`

const report = []
if (selectedPages?.some(label => !PAGES.some(page => page[0] === label))) throw Error('Unknown --pages label')
for (const [label, query, click, preferences, expectedView] of PAGES.filter(page => !selectedPages || selectedPages.includes(page[0]))) {
  await evaluate(`localStorage.clear(); localStorage.setItem('sidem:archive-user-preferences', JSON.stringify(${JSON.stringify({ version: 3, onboardingComplete: true, startupPage: 'portal', ...(preferences || {}) })}))`).catch(() => {})
  await send('Page.navigate', { url: origin + '/' + query })
  await sleep(4500)
  if (click) {
    let clicked = false
    for (let attempt = 0; attempt < 30 && !clicked; attempt++) {
      clicked = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(click)}); if (!e || e.disabled) return false; e.click(); return true })()`)
      if (!clicked) await sleep(500)
    }
    if (!clicked) { report.push({ page: label, error: `nothing to open (${click})` }); continue }
    await sleep(3500)
  }
  const actualUrl = await evaluate('location.href')
  if (expectedView && new URL(actualUrl).searchParams.get('view') !== expectedView) {
    report.push({ page: label, url: actualUrl, error: `expected ${expectedView} detail route` }); continue
  }
  if (expectedView) {
    const detailSelector = expectedView === 'card_detail' ? '.card-detail' : '.event-detail'
    let ready = false
    for (let attempt = 0; attempt < 30 && !ready; attempt++) {
      ready = await evaluate(`Boolean(document.querySelector(${JSON.stringify(detailSelector)}))`)
      if (!ready) await sleep(500)
    }
    if (!ready) { report.push({ page: label, url: actualUrl, error: 'detail content did not load' }); continue }
  }
  const rows = await evaluate(collect) || []
  const groups = new Map()
  for (const row of rows) {
    const group = groups.get(row.where) || { where: row.where, count: 0, samples: [] }
    group.count++
    if (group.samples.length < 3 && !group.samples.includes(row.text)) group.samples.push(row.text)
    groups.set(row.where, group)
  }
  report.push({ page: label, url: actualUrl, groups: [...groups.values()].sort((a, b) => b.count - a.count) })
}

for (const page of report) {
  if (page.error) { console.log(`\n## ${page.page}: ${page.error}`); continue }
  if (!page.groups.length) continue
  console.log(`\n## ${page.page} (${page.url})`)
  for (const group of page.groups) console.log(`  ${String(group.count).padStart(4)}  ${group.where}  |  ${group.samples.join('  /  ')}`)
}
const clean = report.filter(page => !page.error && !page.groups.length).map(page => page.page)
if (clean.length) console.log(`\nNo visible kana: ${clean.join(', ')}`)
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
if (report.some(page => page.error)) process.exitCode = 1
} finally {
  ws?.close()
  if (proc.exitCode === null && !launchError) {
    const exited = new Promise(resolve => proc.once('exit', resolve))
    proc.kill()
    await Promise.race([exited, sleep(5000)])
  }
  // Delete only this owned, resolved profile after its browser has exited.
  if ((launchError || proc.exitCode !== null || proc.signalCode) &&
      path.dirname(fs.realpathSync(profile)) === profileRoot && !fs.lstatSync(profile).isSymbolicLink()) {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } else console.warn(`Profile retained because browser exit was not confirmed: ${profile}`)
}
