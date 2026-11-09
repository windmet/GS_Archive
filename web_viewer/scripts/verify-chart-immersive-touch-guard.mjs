import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createImmersiveTouchGuard } from '../src/composables/useImmersiveTouchGuard.js'

// The immersive chart view must keep every iOS gesture inside it (pinch, multi-finger selection, double-tap zoom,
// callout), still let one finger drag the timeline slider, freeze the page behind it, and hold a screen wake lock.
class Target {
  constructor() { this.listeners = new Map() }
  addEventListener(type, fn, options) { this.listeners.set(type, { fn, options }) }
  removeEventListener(type, fn) { if (this.listeners.get(type)?.fn === fn) this.listeners.delete(type) }
  fire(type, event = {}) {
    const e = { cancelable: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, timeStamp: 0, touches: [], target: element(), ...event }
    this.listeners.get(type)?.fn(e)
    return e.defaultPrevented
  }
}
const element = (selector = '') => ({ closest: s => s.split(',').some(part => selector.split(' ').includes(part.trim())) ? {} : null })
class Styled extends Target {
  constructor(style = null) { super(); this.styleText = style; this.style = {} }
  getAttribute() { return this.styleText }
  setAttribute(_, value) { this.styleText = value; this.style = {} }
  removeAttribute() { this.styleText = null; this.style = {} }
}
function harness({ wakeLock = true } = {}) {
  const doc = new Target()
  doc.visibilityState = 'visible'
  doc.body = new Styled('margin: 0')
  doc.documentElement = new Styled(null)
  const win = { scrollY: 420, scrolledTo: null, scrollTo(x, y) { this.scrolledTo = y } }
  const locks = []
  const nav = wakeLock ? { wakeLock: { request: async type => { const lock = { type, released: false, release: async () => { lock.released = true } , addEventListener() {} }; locks.push(lock); return lock } } } : {}
  return { doc, win, nav, locks, root: new Target(), guard: createImmersiveTouchGuard({ document: doc, window: win, navigator: nav }) }
}

function check(guardFactory = harness) {
  const { doc, win, locks, root, guard } = guardFactory()
  guard.attach(root)
  assert.equal(guard.attached, true)
  for (const type of ['touchstart', 'touchmove', 'touchend', 'gesturestart']) assert.equal(root.listeners.get(type).options.passive, false, `${type} listener must be able to cancel`)
  assert.ok(root.fire('gesturestart') && root.fire('gesturechange'), 'WebKit pinch is cancelled')
  assert.ok(root.fire('touchstart', { touches: [{}, {}] }), 'a second finger cannot start selection or zoom')
  assert.ok(!root.fire('touchstart', { touches: [{}] }), 'a single finger still reaches buttons')
  assert.ok(root.fire('touchmove', { touches: [{}] }), 'one finger on the track cannot pan anything')
  assert.ok(!root.fire('touchmove', { touches: [{}], target: element('input') }), 'one finger still drags the timeline slider')
  assert.ok(root.fire('touchmove', { touches: [{}, {}], target: element('input') }), 'two fingers on the slider still cannot zoom')
  assert.ok(!root.fire('touchend', { timeStamp: 1000 }) && root.fire('touchend', { timeStamp: 1200 }), 'a double tap on the track cannot zoom')
  assert.ok(!root.fire('touchend', { timeStamp: 2000, target: element('button') }) && !root.fire('touchend', { timeStamp: 2100, target: element('button') }), 'quick taps on a button still click')
  assert.ok(root.fire('contextmenu') && root.fire('selectstart') && root.fire('dblclick'), 'no callout, selection or double-click zoom')
  assert.equal(doc.body.style.position, 'fixed'); assert.equal(doc.body.style.top, '-420px'); assert.equal(doc.documentElement.style.overflow, 'hidden')
  return Promise.resolve().then(() => new Promise(r => setTimeout(r, 0))).then(() => {
    assert.equal(locks.length, 1, 'screen wake lock requested'); assert.equal(locks[0].type, 'screen')
    guard.detach()
    assert.equal(root.listeners.size, 0, 'every listener removed on exit')
    assert.equal(doc.body.styleText, 'margin: 0'); assert.equal(doc.documentElement.styleText, null)
    assert.equal(win.scrolledTo, 420, 'page scroll position restored')
    assert.equal(locks[0].released, true, 'wake lock released on exit')
    assert.ok(!root.fire('touchmove', { touches: [{}] }), 'detached root no longer cancels touches')
  })
}
await check()
// Without the Wake Lock API the view still works.
{
  const { root, guard } = harness({ wakeLock: false })
  guard.attach(root)
  assert.ok(root.fire('gesturestart'))
  guard.detach()
}
// Mutations: each must be caught by check().
const source = readFileSync(new URL('../src/composables/useImmersiveTouchGuard.js', import.meta.url), 'utf8')
const mutations = {
  'gesture events not cancelled': ['gesturestart: prevent, ', ''],
  'slider exemption lost': ['event.touches.length > 1 || !inControl(event)', 'true'],
  'passive listeners': ['{ passive: false }', '{ passive: true }'],
  'scroll not restored': ['win.scrollTo(0, scroll.y)', ''],
  'wake lock kept': ['void lock.release().catch(() => {}) }\n', '}\n'],
}
for (const [name, [from, to]] of Object.entries(mutations)) {
  assert.ok(source.includes(from), `mutation anchor missing: ${name}`)
  const url = 'data:text/javascript;base64,' + Buffer.from(source.replace(from, to).replace("from 'vue'", `from '${new URL('../node_modules/vue/index.mjs', import.meta.url)}'`)).toString('base64')
  const { createImmersiveTouchGuard: mutated } = await import(url)
  await assert.rejects(async () => check(() => { const h = harness(); return { ...h, guard: mutated({ document: h.doc, window: h.win, navigator: h.nav }) } }), undefined, `mutation not detected: ${name}`)
}

// The chart view attaches the guard to its immersive root, and locking hides the controls behind a shield.
const vue = readFileSync(new URL('../src/components/archive/ArchiveSongChartPreview.vue', import.meta.url), 'utf8')
assert.match(vue, /watch\(immersive, on => \{ if \(on\) touchGuard\.attach\(previewRoot\.value\); else \{ touchGuard\.detach\(\)/, 'immersive view attaches the touch guard')
assert.match(vue, /'controls-hidden': immersive && \(locked \|\| !controlsShown\)/, 'locked view hides the controls')
assert.match(vue, /<div v-if="locked" class="chart-lock-shield"/, 'locked view covers the controls with a shield')
assert.match(vue, /@pointerdown="immersive && !locked && revealControls\(\)"/, 'a touch on a locked view does not bring back the controls')
assert.match(vue, /function onCanvasKey\(event\) \{\n  if \(locked\.value\) return/, 'keys do not control a locked view')
assert.match(vue, /\.is-immersive, \.is-immersive \* \{ -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;/, 'no selection or callout inside the immersive view')
console.log(`Immersive touch guard: pinch, multi-finger, double-tap, callout and selection cancelled; slider drag kept; page frozen and restored; wake lock held and released; ${Object.keys(mutations).length} mutations detected; chart lock wiring present`)
