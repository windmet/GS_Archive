// W1 runtime fallback, fixture level (no network, no corpus). Pins the inline boot guard in index.html and its wiring:
// the guard is ES5, under its own gzip budget, ahead of the module entry, behaves as specified in a minimal fake DOM,
// reaches every entity head shell untouched, and main.js / App.vue send the stage marks and cover the lazy components.
// The browser-level counterpart is verify-boot-guard-browser.mjs.
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { transformSync } from 'esbuild'
import { renderEntityHeadShells } from './generate-entity-head-shells.mjs'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const html = read('index.html')
const policy = JSON.parse(read('readmodels/contracts/startup-policy.json'))

// 1. Presence and order: one classic inline script, before the module entry.
const classic = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
assert.equal(classic.length, 1, 'index.html must carry exactly one classic inline script (the boot guard)')
const guard = classic[0][1].trim()
assert.ok(guard.includes('__gsBoot'), 'the inline script must be the boot guard')
const moduleAt = html.search(/<script[^>]*type="module"/)
assert.ok(moduleAt > classic[0].index, 'the boot guard must come before the module entry script')

// 2. ES5: esbuild refuses syntax it cannot lower to ES5 (let/const, arrow functions, template literals, classes).
assert.throws(() => transformSync('const a = 1', { target: 'es5' }), 'self-check: esbuild must reject const for es5')
assert.doesNotThrow(() => transformSync(guard, { target: 'es5', loader: 'js' }), 'the boot guard must be strict ES5')

// 3. Budget.
assert.ok(Number.isInteger(policy.bootGuardGzipLimit) && policy.bootGuardGzipLimit > 0, 'startup-policy.json needs bootGuardGzipLimit')
const gzipBytes = gzipSync(guard, { level: 9 }).length
assert.ok(gzipBytes < policy.bootGuardGzipLimit, `boot guard is ${gzipBytes} B gzip, limit ${policy.bootGuardGzipLimit}`)

// The panel must paint over every app layer. An invalid z-index (the first version had 2e9, which CSS rejects)
// computes to auto, and the app's own positioned layers then cover it.
{
  const panelZ = guard.match(/z-index:(\d+);/)
  assert.ok(panelZ, 'the panel z-index must be a plain CSS integer')
  let appMax = 0
  for (const entry of readdirSync(new URL('../src', import.meta.url), { recursive: true, withFileTypes: true }))
    if (entry.isFile() && /\.(vue|css)$/.test(entry.name))
      for (const [, z] of readFileSync(`${entry.parentPath}/${entry.name}`, 'utf8').matchAll(/z-index:\s*(\d+)/g)) appMax = Math.max(appMax, +z)
  assert.ok(appMax > 0 && +panelZ[1] > appMax, `panel z-index ${panelZ[1]} must exceed the app's highest ${appMax}`)
}

// 4. Behaviour in a minimal fake DOM.
class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.textContent = ''; this.parentNode = null }
  setAttribute(key, value) { this.attrs[key] = value }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child }
  removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; return child }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn) }
  getElementsByTagName(tag) {
    const found = []
    const walk = node => node.children.forEach(child => { if (child.tagName === tag.toUpperCase()) found.push(child); walk(child) })
    walk(this)
    return found
  }
  set innerHTML(markup) {
    this.children = []
    for (const [, tag, text] of markup.matchAll(/<(h2|pre|button)[^>]*>([^<]*)<\/\1>/g)) this.appendChild(new Node(tag)).textContent = text
  }
  select() {}
}

function boot({ search = '', missing = [], entries = [], caps = {}, storage = 'ok', clipboard = 'ok', body = true } = {}) {
  const log = { reload: 0, copied: [], exec: 0, set: [] }
  const doc = new Node('document')
  doc.body = body ? new Node('body') : null
  doc.querySelectorAll = () => missing.map(src => ({ src }))
  doc.createElement = tag => new Node(tag)
  doc.execCommand = () => { log.exec++; return true }
  const clock = { t: 1.7e12 }
  const store = {}
  const timers = []
  const listeners = {}
  const win = {
    document: doc,
    location: { hash: '', _s: search, reload() { log.reload++ }, set search(value) { log.set.push(value); this._s = value }, get search() { return this._s } },
    navigator: { userAgent: 'UA-test', clipboard: clipboard === 'ok' ? { writeText: async text => { log.copied.push(text) } } : undefined },
    CSS: { supports: query => { if (caps.throws) throw new Error('unsupported'); return caps[query] ?? true } },
    performance: { getEntriesByType: () => entries.map(name => ({ name })) },
    sessionStorage: storage === 'ok' ? { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = String(value) } }
      : { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } },
    structuredClone() {},
    Date: { now: () => clock.t },
    setInterval: fn => { timers.push(fn); return timers.length },
    addEventListener: (type, fn, capture) => { (listeners[type] ||= []).push({ fn, capture: !!capture }) },
  }
  win.window = win
  const context = vm.createContext(win)
  if (caps.hasOwn === false) vm.runInContext('delete Object.hasOwn', context)
  if (caps.at === false) vm.runInContext('delete Array.prototype.at', context)
  if (caps.structuredClone === false) delete win.structuredClone
  vm.runInContext(guard, context)
  const panel = () => doc.body?.children.find(node => node.id === 'gs-boot-guard')
  return {
    win, doc, log, listeners, panel, boot: win.__gsBoot,
    fire: (type, event) => (listeners[type] || []).forEach(item => item.fn(event)),
    tick: seconds => { for (let i = 0; i < seconds; i++) { clock.t += 1000; timers.forEach(fn => fn()) } },
    buttons: () => panel()?.getElementsByTagName('button') || [],
    click(index) { panel().listeners.click.forEach(fn => fn({ target: this.buttons()[index] })) },
    text: () => panel()?.getElementsByTagName('pre')[0].textContent,
  }
}

// 4a. API and stage order.
{
  const t = boot()
  for (const name of ['mark', 'fail', 'state']) assert.equal(typeof t.boot[name], 'function')
  assert.equal(t.boot.state().stage, 'html')
  t.boot.mark('entry'); assert.equal(t.boot.state().stage, 'entry')
  t.boot.mark('html'); assert.equal(t.boot.state().stage, 'entry', 'stages never move backwards')
  t.boot.mark('nonsense'); assert.equal(t.boot.state().stage, 'entry', 'an unknown stage is ignored')
  t.boot.mark('mounted'); t.boot.mark('ready'); assert.equal(t.boot.state().stage, 'ready')
  t.boot.fail(new TypeError('boom'))
  const state = t.boot.state()
  assert.equal(state.error.name, 'TypeError'); assert.equal(state.error.message, 'boom')
  assert.equal(state.ua, 'UA-test'); assert.equal(state.caps.hasOwn, true)
  assert.ok(!t.panel(), 'no panel on a healthy boot')
}
// 4b. Listeners: error is registered first and in the capture phase; resource failures record the URL.
{
  const t = boot()
  const types = Object.keys(t.listeners)
  assert.equal(types[0], 'error', 'the error listener must be registered before anything else')
  assert.ok(types.includes('unhandledrejection') && types.includes('vite:preloadError'))
  assert.ok(t.listeners.error.every(item => item.capture), 'the error listener must use the capture phase to see script/link load failures')
  t.fire('error', { target: { tagName: 'SCRIPT', src: 'https://x.test/assets/index-abc.js' } })
  assert.equal(JSON.stringify(t.boot.state().failed), '["https://x.test/assets/index-abc.js"]')
  assert.equal(t.boot.state().error.src, 'https://x.test/assets/index-abc.js')
  t.fire('error', { target: { tagName: 'IMG', src: 'https://x.test/a.png' } })
  assert.equal(t.boot.state().failed.length, 1, 'image failures are not boot failures')
  t.fire('error', { target: t.win, error: new RangeError('probe'), message: 'ignored', filename: 'https://x.test/src/main.js' })
  const { name, message, src } = t.boot.state().error
  assert.deepEqual([name, message, src], ['RangeError', 'probe', 'https://x.test/src/main.js'])
  // Chrome reports a ResizeObserver loop as a window error on healthy pages; it must not replace the real one.
  t.fire('error', { target: t.win, message: 'ResizeObserver loop completed with undelivered notifications.' })
  assert.equal(t.boot.state().error.message, 'probe', 'a ResizeObserver loop notice is not a boot error')
  t.fire('unhandledrejection', { reason: new Error('late') }); assert.equal(t.boot.state().error.message, 'late')
  t.fire('unhandledrejection', { reason: 'plain string' }); assert.equal(t.boot.state().error.message, 'plain string')
}
// 4c. Watchdog: 12 s without mounted, 30 s without ready; entry URLs absent from resource timing are listed.
{
  const t = boot({ missing: ['https://x.test/src/main.js', 'https://x.test/assets/seen.js'], entries: ['https://x.test/assets/seen.js'] })
  t.tick(11); assert.ok(!t.panel(), 'no panel before 12 s')
  t.tick(1); assert.ok(t.panel(), 'panel at 12 s while stuck at html')
  assert.equal(t.panel().tagName, 'DIV'); assert.ok(t.doc.body.children.includes(t.panel()), 'the panel is an overlay on body')
  assert.match(t.panel().attrs.style, /position:fixed/)
  assert.match(t.text(), /"stage": "html"/); assert.match(t.text(), /入口脚本未执行/); assert.match(t.text(), /"waited": 12/)
  assert.ok(t.text().includes('https://x.test/src/main.js'), 'a missing entry is listed')
  assert.ok(!JSON.stringify(t.boot.state().missing).includes('seen.js'), 'a resource already fetched is not listed as missing')
  assert.match(t.text(), /UA-test/); assert.match(t.text(), /structuredClone/)
  assert.equal(t.buttons().map(button => button.textContent).join('|'), '重新加载|绕缓存重载|复制诊断信息|继续等待')
  t.tick(3); assert.match(t.text(), /"waited": 15/, 'the panel refreshes live')
  t.click(3); assert.ok(!t.panel(), '继续等待 dismisses the panel')
  t.tick(14); assert.ok(!t.panel(), 'a dismissed panel stays away between thresholds')
  t.tick(2); assert.ok(t.panel(), 'the panel comes back at 30 s while still not ready')
}
{
  const t = boot(); t.boot.mark('entry'); t.boot.mark('mounted')
  t.tick(29); assert.ok(!t.panel(), 'a mounted app is not flagged at 12 s')
  t.tick(1); assert.ok(t.panel(), 'mounted but not ready: panel at 30 s')
  assert.match(t.text(), /首个页面未返回/)
  t.boot.mark('ready'); assert.ok(!t.panel(), 'ready closes a watchdog panel')
}
{
  const t = boot(); t.tick(5); t.boot.mark('mounted'); t.boot.mark('ready'); t.tick(60)
  assert.ok(!t.panel(), 'a boot that becomes ready in time never shows the panel')
}
// 4d. A missing capability shows the "too old" panel at once and does not block the app.
for (const [name, caps] of [['Object.hasOwn', { hasOwn: false }], ['Array.prototype.at', { at: false }], ['structuredClone', { structuredClone: false }],
  [':has()', { 'selector(:has(*))': false }], ['container queries', { 'container-type: inline-size': false }], ['CSS.supports throwing', { throws: true }]]) {
  const t = boot({ caps })
  assert.ok(t.panel(), `${name} missing must show the panel immediately`)
  assert.match(t.text(), /浏览器版本过旧/); assert.match(t.text(), /Chrome\/Edge 105\+/); assert.match(t.text(), /Safari 16\+/)
  assert.ok(Object.values(t.boot.state().caps).some(value => !value), `${name}: caps report the gap`)
  t.boot.mark('entry'); t.boot.mark('mounted'); t.boot.mark('ready')
  assert.ok(t.panel(), 'the notice stays after ready (the app keeps running)')
}
assert.ok(!boot().panel(), 'all capabilities present: no notice')
// 4e. ?diag=1: panel at once, live, kept by ready.
{
  const t = boot({ search: '?x=1&diag=1' })
  assert.ok(t.panel()); assert.match(t.text(), /"stage": "html"/)
  t.boot.mark('entry'); t.tick(4); assert.match(t.text(), /"stage": "entry"/); assert.match(t.text(), /"waited": 4/)
  t.boot.mark('ready'); t.tick(1); assert.ok(t.panel(), 'the diag panel survives ready'); assert.match(t.text(), /页面已就绪|就绪/)
  assert.ok(!boot({ search: '?diag=10' }).panel(), 'only diag=1 opens the diagnostic page')
}
// 4f. With no <body> yet (guard runs in <head>) the panel waits for DOMContentLoaded.
{
  const t = boot({ search: '?diag=1', body: false })
  assert.ok(t.doc.listeners.DOMContentLoaded?.length, 'no body yet: show waits for DOMContentLoaded')
  t.doc.body = new Node('body'); t.doc.listeners.DOMContentLoaded.forEach(fn => fn())
  assert.ok(t.panel())
}
// 4g. Buttons.
{
  const t = boot({ search: '?diag=1' })
  t.click(0); assert.equal(t.log.reload, 1)
  t.click(1); assert.match(t.log.set.at(-1), /_r=\d+$/)
  t.win.location._s = '?a=1&_r=5'; t.click(1)
  assert.equal((t.log.set.at(-1).match(/_r=/g) || []).length, 1, 'the bypass reload replaces an earlier _r'); assert.ok(t.log.set.at(-1).startsWith('?a=1'))
  t.click(2); await Promise.resolve(); assert.equal(t.log.copied.length, 1); assert.match(t.log.copied[0], /"stage"/)
  const bare = boot({ search: '?diag=1', clipboard: 'none' })
  bare.click(2); assert.equal(bare.log.exec, 1, 'without the Clipboard API: textarea + execCommand')
  assert.ok(!bare.doc.body.children.some(node => node.tagName === 'TEXTAREA'), 'the fallback textarea is removed again')
}
// 4h. vite:preloadError: at most one automatic reload per 60 s.
{
  const t = boot()
  const event = () => ({ prevented: false, preventDefault() { this.prevented = true } })
  let e = event(); t.fire('vite:preloadError', e); assert.equal(t.log.reload, 1); assert.equal(e.prevented, true)
  e = event(); t.tick(30); t.fire('vite:preloadError', e)
  assert.equal(t.log.reload, 1, 'a second error within 60 s must not reload'); assert.equal(e.prevented, false, 'left to the errorComponent')
  e = event(); t.tick(31); t.fire('vite:preloadError', e); assert.equal(t.log.reload, 2, 'after the 60 s window one more reload is allowed')
  const blocked = boot({ storage: 'denied' }), probe = event(); blocked.fire('vite:preloadError', probe)
  assert.equal(blocked.log.reload, 0, 'without storage the guard cannot rate-limit, so it must not reload'); assert.equal(probe.prevented, false)
}

// 5. Entity head shells keep the guard byte for byte.
{
  const shells = renderEntityHeadShells({ template: html, idols: [{ id: '001tom', name: '天ヶ瀬 冬馬', unitCode: '01jup', unitName: 'Jupiter' }], origin: 'https://example.test' })
  assert.ok(shells.length > 0)
  for (const shell of shells) {
    assert.ok(shell.html.includes(classic[0][0]), `${shell.path} lost the boot guard`)
    assert.ok(shell.html.indexOf(classic[0][0]) < shell.html.search(/<script[^>]*type="module"/), `${shell.path}: guard must precede the module entry`)
  }
}

// 6. Wiring.
const main = read('src/main.js'), app = read('src/App.vue')
assert.match(main, /window\.__gsBoot/)
assert.match(main, /boot\?\.mark\('entry'\)/); assert.match(main, /boot\?\.mark\('mounted'\)/)
assert.match(main, /try \{\s*app\.mount\('#app'\)\s*\} catch \(error\) \{\s*boot\?\.fail\(error\)\s*throw error/, 'a mount failure goes to the guard and is rethrown')
assert.ok(main.indexOf("mark('entry')") < main.indexOf('installImageReveal()'), 'the entry mark comes first')
assert.ok(main.indexOf('app.mount') < main.indexOf("mark('mounted')"), 'mounted follows a successful mount')
assert.match(main, /app\.config\.errorHandler = [\s\S]*console\.error[\s\S]*boot\.state\(\)\.stage !== 'ready'[\s\S]*boot\.fail\(error\)/, 'errorHandler logs, and forwards to the guard only before ready')
const mounted = app.slice(app.indexOf('onMounted(async () => {'))
const route = mounted.indexOf('await restoreRoute(startup.route)')
assert.ok(route > 0, 'the first-route restore was not found in App.vue')
const catchAt = mounted.indexOf('} catch (error) {', route)
const okMark = mounted.indexOf("globalThis.__gsBoot?.mark('ready')", route)
assert.ok(okMark > route && okMark < catchAt, 'ready is marked right after the first route restore succeeds')
const portalAt = mounted.indexOf("commitView('portal')", catchAt)
assert.ok(portalAt > 0 && mounted.indexOf("globalThis.__gsBoot?.mark('ready')", portalAt) > portalAt, 'ready is also marked after falling back to the portal')
const define = app.match(/const defineArchivePage = loader => defineAsyncComponent\(\{ loader, errorComponent: ArchivePageLoadError \}\)/)
assert.ok(define, 'defineArchivePage must attach ArchivePageLoadError')
for (const name of ['StoryViewer', 'ArchiveOnboarding', 'ArchiveImmersiveHome', 'SpineViewer', 'ChibiStageViewer']) {
  const at = app.search(new RegExp(`const ${name} = defineArchivePage\\(`))
  assert.ok(at > define.index, `${name} must be defined through defineArchivePage, after it is declared`)
  assert.ok(!new RegExp(`const ${name} = defineAsyncComponent\\(`).test(app), `${name} must not use a bare defineAsyncComponent`)
}
console.log(`Boot guard verified: ES5, ${gzipBytes} B gzip (limit ${policy.bootGuardGzipLimit}), ahead of the module entry and intact in the entity shells; stage marks, watchdog, capability notice, ?diag=1, buttons, vite:preloadError rate limit; main.js and App.vue wiring`)
