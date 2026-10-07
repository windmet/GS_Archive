import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Maintainer check: open archive pages in a real browser with the Chinese UI and list visible
// text that still contains kana, grouped by where it sits. Story dialogue, reader rows and other
// deliberately-source text are skipped. Needs a running dev server and the cached Chromium.
// Usage: node scripts/audit-visible-japanese.mjs [origin] [--out file.json]
const origin = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:5175').replace(/\/$/, '')
const outFile = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : ''

// [label, url query, optional click selector to reach a detail page]
const PAGES = [
  ['portal', '?view=portal'],
  ['portal favourite', '?view=portal', null, { preferredIdol: '005kao', portalDefaultScope: 'favorite' }],
  ['idol directory', '?view=idols'],
  ['idol detail', '?view=idol_detail&idol=001tom'],
  ['unit detail', '?view=unit_detail&unit=01jup'],
  ['cards', '?view=cards'],
  ['card detail', '?view=cards', '.card-grid button, .card-tile, [data-card-id]'],
  ['songs', '?view=song_catalog'],
  ['song detail', '?view=song_catalog', '.song-row, .song-card, [data-song-id]'],
  ['events', '?view=event_catalog'],
  ['event detail', '?view=event_catalog', '.event-row, .event-card, [data-event-id]'],
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
const port = 9450 + Math.floor(Math.random() * 40), profile = path.join(process.env.TEMP || '.', `audit-ja-${Date.now()}`)
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,900', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let target
for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page') } catch {} }
if (!target) throw Error('Chromium did not start')
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(resolve => { ws.onopen = resolve })
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
for (const [label, query, click, preferences] of PAGES) {
  await evaluate(`localStorage.clear(); localStorage.setItem('sidem:archive-user-preferences', JSON.stringify(${JSON.stringify({ version: 3, onboardingComplete: true, startupPage: 'portal', ...(preferences || {}) })}))`).catch(() => {})
  await send('Page.navigate', { url: origin + '/' + query })
  await sleep(4500)
  if (click) {
    const clicked = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(click)}); e?.click(); return Boolean(e) })()`)
    if (!clicked) { report.push({ page: label, error: `nothing to open (${click})` }); continue }
    await sleep(3500)
  }
  const rows = await evaluate(collect) || []
  const groups = new Map()
  for (const row of rows) {
    const group = groups.get(row.where) || { where: row.where, count: 0, samples: [] }
    group.count++
    if (group.samples.length < 3 && !group.samples.includes(row.text)) group.samples.push(row.text)
    groups.set(row.where, group)
  }
  report.push({ page: label, url: query, groups: [...groups.values()].sort((a, b) => b.count - a.count) })
}
ws.close(); proc.kill()

for (const page of report) {
  if (page.error) { console.log(`\n## ${page.page}: ${page.error}`); continue }
  if (!page.groups.length) continue
  console.log(`\n## ${page.page} (${page.url})`)
  for (const group of page.groups) console.log(`  ${String(group.count).padStart(4)}  ${group.where}  |  ${group.samples.join('  /  ')}`)
}
const clean = report.filter(page => !page.error && !page.groups.length).map(page => page.page)
if (clean.length) console.log(`\nNo visible kana: ${clean.join(', ')}`)
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
