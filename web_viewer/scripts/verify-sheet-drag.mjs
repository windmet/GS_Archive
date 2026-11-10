import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { effectScope } from 'vue'
import {
  gestureIntent, isBottomSheet, releaseVelocity, rubberBand, shouldCloseSheet, sheetOffset, takesOver,
  SHEET_CLOSE_FRACTION, SHEET_CLOSE_VELOCITY, SHEET_DIRECTION_SLOP, SHEET_RUBBER_LIMIT,
} from '../src/presentation/sheetDrag.mjs'

// Swipe-down on phone bottom sheets (docs/GS_UI_MOTION_INTERACTION_AUDIT_20261110, D1): the decisions as pure functions, the
// gesture driven end to end through a stand-in element, and the wiring of every sheet that takes part.
const root = fileURLToPath(new URL('..', import.meta.url))
const read = file => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')

// ---- pure decisions -------------------------------------------------------------------------------------------------
assert.equal(SHEET_CLOSE_VELOCITY, 0.11)
assert.equal(SHEET_CLOSE_FRACTION, 1 / 3)
assert.equal(gestureIntent(2, 3), 'pending', 'below the slop a touch is still a tap')
assert.equal(gestureIntent(1, SHEET_DIRECTION_SLOP), 'vertical')
assert.equal(gestureIntent(-SHEET_DIRECTION_SLOP - 4, 5), 'horizontal', 'a sideways drag is left to the content (rails, sliders)')
assert.equal(takesOver({ fromHandle: true, scrollTop: 300, dy: -20 }), true, 'the header always grabs the sheet')
assert.equal(takesOver({ fromHandle: false, scrollTop: 0, dy: 12 }), true, 'content at its top pulling down')
assert.equal(takesOver({ fromHandle: false, scrollTop: 40, dy: 12 }), false, 'content that can still scroll up keeps the gesture')
assert.equal(takesOver({ fromHandle: false, scrollTop: 0, dy: -12 }), false, 'pushing content up is a scroll')
{
  let previous = 0, previousStep = Infinity
  for (let overshoot = 10; overshoot <= 1000; overshoot += 10) {
    const moved = rubberBand(overshoot)
    assert.ok(moved > previous && moved < SHEET_RUBBER_LIMIT, 'upward travel grows but never reaches the limit')
    assert.ok(moved - previous <= previousStep + 1e-9, 'each extra px of pull gives less than the one before')
    previousStep = moved - previous; previous = moved
  }
}
assert.equal(sheetOffset(120), 120, 'downward is 1:1')
assert.equal(sheetOffset(0), 0)
assert.ok(sheetOffset(-100) < 0 && sheetOffset(-100) > -100, 'upward is resisted')
assert.equal(sheetOffset(-100), -rubberBand(100))
const samples = [{ t: 0, y: 0 }, { t: 60, y: 40 }, { t: 160, y: 60 }, { t: 200, y: 100 }]
assert.equal(releaseVelocity(samples, 200), (100 - 60) / (200 - 160), 'only the last 100ms count')
assert.equal(releaseVelocity([{ t: 190, y: 5 }], 200), 0)
assert.equal(releaseVelocity([{ t: 0, y: 0 }, { t: 10, y: 400 }], 500), 0, 'a stale touch has no speed')
assert.equal(shouldCloseSheet({ offset: 20, velocity: 0.12, height: 600 }), true, 'a quick flick closes')
assert.equal(shouldCloseSheet({ offset: 20, velocity: 0.11, height: 600 }), false, 'exactly at the speed limit does not')
assert.equal(shouldCloseSheet({ offset: 199, velocity: 0, height: 600 }), false)
assert.equal(shouldCloseSheet({ offset: 201, velocity: 0, height: 600 }), true, 'past a third of the height closes')
assert.equal(shouldCloseSheet({ offset: -30, velocity: 0.5, height: 600 }), false, 'a sheet pulled up never closes')
assert.equal(shouldCloseSheet({ offset: 0, velocity: 0.5, height: 600 }), false)
assert.equal(isBottomSheet({ width: 390, top: 300, bottom: 844 }, { width: 390, height: 844 }), true)
assert.equal(isBottomSheet({ width: 340, top: 100, bottom: 844 }, { width: 390, height: 844 }), false, 'a centred or side surface is not a bottom sheet')
assert.equal(isBottomSheet({ width: 390, top: 100, bottom: 700 }, { width: 390, height: 844 }), false, 'a sheet off the bottom edge is not at rest')

// ---- the gesture, end to end ----------------------------------------------------------------------------------------
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const globals = { reduced: false, caughtMatrix: null }
Object.assign(globalThis, {
  innerWidth: 390, innerHeight: 844,
  matchMedia: () => ({ get matches() { return globals.reduced } }),
  requestAnimationFrame: callback => setTimeout(() => callback(performance.now()), 16),
  DOMMatrixReadOnly: class { constructor(value) { this.m42 = Number(value.match(/,\s*(-?[\d.]+)\)$/)?.[1] || 0) } },
})
// A style object with the CSSStyleDeclaration methods the composable uses for custom properties.
function styleOf() {
  const custom = {}
  return Object.defineProperties({}, {
    setProperty: { value: (name, value) => { custom[name] = value } },
    removeProperty: { value: name => { delete custom[name] } },
    getPropertyValue: { value: name => custom[name] ?? '' },
  })
}
function attributesOf() {
  const attributes = new Set()
  return { toggleAttribute: (name, on) => { on ? attributes.add(name) : attributes.delete(name) }, hasAttribute: name => attributes.has(name) }
}
function sheet({ scrollTop = 0, width = 390, scrollable = true } = {}) {
  const listeners = {}
  const backdrop = { nodeType: 1, style: styleOf() }
  const body = { nodeType: 1, style: {}, scrollHeight: scrollable ? 900 : 100, clientHeight: 300, scrollTop, parentElement: null, closest: selector => selector === '.header' ? null : body }
  const header = { nodeType: 1, style: {}, scrollHeight: 50, clientHeight: 50, scrollTop: 0, parentElement: null, closest: selector => selector === '.header' ? header : null }
  const node = {
    nodeType: 1, isConnected: true, open: true, scrollHeight: 400, clientHeight: 400, scrollTop: 0, parentElement: null,
    style: styleOf(), ...attributesOf(), getAnimations: () => [],
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn) },
    removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter(item => item !== fn) },
    getBoundingClientRect: () => ({ width, top: 444, bottom: 844, height: 400 }),
    listeners,
  }
  body.parentElement = node; header.parentElement = node
  return { node, body, header, backdrop }
}
globalThis.getComputedStyle = node => {
  const move = String(node.style.transform || '').match(/translateY\((-?[\d.]+)px\)/)?.[1]
  return { overflowY: node.scrollHeight > node.clientHeight + 1 && node.nodeType === 1 && node.parentElement ? 'auto' : 'visible', transform: move ? `matrix(1, 0, 0, 1, 0, ${move})` : 'none' }
}
const { useSheetDrag } = await import('../src/composables/useSheetDrag.js')
function touchEvent(target, points, cancelable = true) {
  const event = { target, touches: points, cancelable, prevented: false, preventDefault() { this.prevented = true } }
  return event
}
function mount(element, options = {}) {
  const closed = []
  const scope = effectScope()
  scope.run(() => useSheetDrag(element.node, { handle: '.header', onClose: () => { closed.push(performance.now()); if (options.closes !== false) element.node.open = false }, ...options.use }))
  const fire = (type, event) => (element.node.listeners[type] || []).forEach(fn => fn(event))
  return { closed, scope, fire, stop: () => scope.stop() }
}
async function drag(rig, target, steps, { startY = 600, interval = 16 } = {}) {
  const prevented = []
  rig.fire('touchstart', touchEvent(target, [{ clientX: 200, clientY: startY }]))
  for (const { dx = 0, dy } of steps) {
    const event = touchEvent(target, [{ clientX: 200 + dx, clientY: startY + dy }])
    rig.fire('touchmove', event); prevented.push(event.prevented)
    await sleep(interval)
  }
  return prevented
}
const lift = (rig, target) => rig.fire('touchend', touchEvent(target, []))
const ramp = (total, count) => Array.from({ length: count }, (_, index) => ({ dy: Math.round(total * (index + 1) / count) }))

{ // a slow pull of a quarter of the height springs back
  const rig = sheet(), harness = mount(rig)
  const prevented = await drag(harness, rig.header, ramp(100, 8), { interval: 120 })
  assert.ok(prevented.slice(1).every(Boolean), 'the move is owned (default prevented) once taken over')
  assert.equal(rig.node.style.transition, 'none', 'no easing while the finger is down')
  assert.equal(rig.node.style.transform, 'translateY(100px)', '1:1 under the finger')
  lift(harness, rig.header)
  assert.match(rig.node.style.transform, /translateY\(0px\)/)
  assert.match(rig.node.style.transition, /var\(--gs-motion-enter\) var\(--gs-ease-out\)/, 'springs back with the enter timing')
  await sleep(380)
  assert.equal(harness.closed.length, 0, 'a quarter of the height does not close it')
  assert.equal(rig.node.style.transform, '', 'inline styles are cleared once it settles')
  harness.stop()
}
{ // a quick downward flick closes from where it is
  const rig = sheet(), harness = mount(rig)
  await drag(harness, rig.header, ramp(60, 4), { interval: 12 })
  lift(harness, rig.header)
  assert.equal(rig.node.style.transform, 'translateY(100%)', 'continues down to its own height')
  assert.match(rig.node.style.transition, /var\(--gs-motion-sheet\) var\(--gs-ease-out\)/)
  assert.equal(harness.closed.length, 0, 'the component close runs after the travel, not before')
  await sleep(420)
  assert.equal(harness.closed.length, 1, 'closes through the component close function')
  assert.equal(rig.node.style.transform, '', 'inline styles are cleared once the sheet is closed')
  harness.stop()
}
{ // a long slow drag past a third of the height closes too
  const rig = sheet(), harness = mount(rig)
  await drag(harness, rig.header, ramp(150, 6), { interval: 120 })
  lift(harness, rig.header)
  await sleep(420)
  assert.equal(harness.closed.length, 1)
  harness.stop()
}
{ // content that has scrolled down: pulling is a scroll, the sheet stays put
  const rig = sheet({ scrollTop: 120 }), harness = mount(rig)
  const prevented = await drag(harness, rig.body, ramp(120, 6))
  assert.ok(prevented.every(value => !value), 'the browser keeps the scroll')
  assert.equal(rig.node.style.transform ?? '', '')
  lift(harness, rig.body)
  await sleep(50)
  assert.equal(harness.closed.length, 0)
  harness.stop()
}
{ // content at its top: a pull down takes the sheet
  const rig = sheet({ scrollTop: 0 }), harness = mount(rig)
  const prevented = await drag(harness, rig.body, ramp(40, 5))
  assert.ok(prevented.slice(1).some(Boolean) && rig.node.style.transform === 'translateY(40px)')
  lift(harness, rig.body); await sleep(380)
  harness.stop()
}
{ // content at its top, pushing up: an ordinary scroll
  const rig = sheet({ scrollTop: 0 }), harness = mount(rig)
  const prevented = await drag(harness, rig.body, ramp(-60, 5))
  assert.ok(prevented.every(value => !value) && !rig.node.style.transform)
  harness.stop()
}
{ // sideways: left to rails and sliders
  const rig = sheet(), harness = mount(rig)
  const prevented = await drag(harness, rig.header, Array.from({ length: 5 }, (_, index) => ({ dx: 30 * (index + 1), dy: 4 })))
  assert.ok(prevented.every(value => !value) && !rig.node.style.transform)
  harness.stop()
}
{ // pulled up past the rest position: resisted, and it comes back
  const rig = sheet(), harness = mount(rig)
  await drag(harness, rig.header, ramp(-300, 15))
  const shown = Number(rig.node.style.transform.match(/translateY\((-?[\d.]+)px\)/)[1])
  assert.ok(shown < 0 && shown > -SHEET_RUBBER_LIMIT, `rubber band, got ${shown}`)
  lift(harness, rig.header); await sleep(380)
  assert.equal(harness.closed.length, 0)
  harness.stop()
}
{ // not a bottom sheet (a centred dialog, a side drawer): the gesture is never ours
  const rig = sheet({ width: 300 }), harness = mount(rig)
  const prevented = await drag(harness, rig.header, ramp(200, 8))
  assert.ok(prevented.every(value => !value) && !rig.node.style.transform)
  harness.stop()
}
{ // a component that refuses to close: the sheet comes back instead of staying parked below the screen
  const rig = sheet(), harness = mount(rig, { closes: false })
  await drag(harness, rig.header, ramp(60, 4), { interval: 12 })
  lift(harness, rig.header)
  await sleep(1500)
  assert.equal(harness.closed.length, 1)
  assert.equal(rig.node.style.transform, '', 'returned to rest and cleaned up')
  harness.stop()
}
{ // a new touch during the spring back catches the sheet where it is, and the drag continues from there
  const rig = sheet(), harness = mount(rig)
  await drag(harness, rig.header, ramp(100, 4), { interval: 120 })
  lift(harness, rig.header)
  rig.node.style.transform = 'translateY(37px)' // mid-flight position the browser would report
  harness.fire('touchstart', touchEvent(rig.body, [{ clientX: 200, clientY: 600 }]))
  assert.equal(rig.node.style.transition, 'none', 'caught: no easing')
  assert.equal(rig.node.style.transform, 'translateY(37px)', 'caught where it was')
  harness.fire('touchmove', touchEvent(rig.body, [{ clientX: 200, clientY: 630 }]))
  assert.equal(rig.node.style.transform, 'translateY(67px)', 'continues from the caught position')
  lift(harness, rig.body); await sleep(380)
  harness.stop()
}
{ // reduced motion: the drag follows the finger, but the close and the spring back do not travel
  globals.reduced = true
  const rig = sheet(), harness = mount(rig)
  await drag(harness, rig.header, ramp(60, 4), { interval: 12 })
  assert.equal(rig.node.style.transform, 'translateY(60px)', 'still follows the finger')
  lift(harness, rig.header)
  assert.equal(harness.closed.length, 1, 'closes at once')
  assert.ok(!rig.node.style.transition, 'no travel transition under reduced motion')
  const slow = sheet(), second = mount(slow)
  await drag(second, slow.header, ramp(40, 4), { interval: 120 })
  lift(second, slow.header)
  assert.equal(slow.node.style.transform, '', 'springs back without travel')
  assert.equal(second.closed.length, 0)
  harness.stop(); second.stop()
  globals.reduced = false
}
{ // the backdrop thins with the sheet: --sheet-backdrop on the sheet (a <dialog>'s ::backdrop inherits it), held flag while dragging
  const rig = sheet(), harness = mount(rig)
  await drag(harness, rig.header, ramp(100, 4), { interval: 120 })
  assert.equal(rig.node.style.getPropertyValue('--sheet-backdrop'), '0.75', 'a quarter of the height down, three quarters of the dimming')
  assert.ok(rig.node.hasAttribute('data-sheet-drag'), 'the backdrop drops its transition while the finger holds the sheet')
  lift(harness, rig.header)
  assert.ok(!rig.node.hasAttribute('data-sheet-drag'), 'released: the backdrop eases back with the sheet')
  assert.equal(rig.node.style.getPropertyValue('--sheet-backdrop'), '1')
  await sleep(380)
  assert.equal(rig.node.style.getPropertyValue('--sheet-backdrop'), '', 'cleared once it settles')
  harness.stop()
  const other = sheet(), second = mount(other, { use: { backdrop: () => other.backdrop } })
  await drag(second, other.header, ramp(200, 4), { interval: 120 })
  assert.equal(other.backdrop.style.getPropertyValue('--sheet-backdrop'), '0.5', 'a separate backdrop element dims instead')
  assert.equal(other.node.style.getPropertyValue('--sheet-backdrop'), '')
  lift(second, other.header); await sleep(420)
  assert.equal(second.closed.length, 1)
  assert.equal(other.backdrop.style.getPropertyValue('--sheet-backdrop'), '', 'cleared once the sheet is closed')
  second.stop()
}
{ // scrolled content reaches its top mid-gesture and the finger keeps pulling: the sheet follows from there, in the same touch
  const rig = sheet({ scrollTop: 60 }), harness = mount(rig)
  harness.fire('touchstart', touchEvent(rig.body, [{ clientX: 200, clientY: 600 }]))
  const move = (y, cancelable = false) => { const event = touchEvent(rig.body, [{ clientX: 200, clientY: y }], cancelable); harness.fire('touchmove', event); return event }
  move(620, true) // first move: judged a scroll, the browser takes the touch
  rig.body.scrollTop = 20; move(640)
  assert.equal(rig.node.style.transform ?? '', '', 'still scrolling: the sheet stays')
  rig.body.scrollTop = 0; move(660) // the content arrives at its top while the finger is still going down
  move(720)
  assert.equal(rig.node.style.transform, 'translateY(60px)', 'follows the finger from the point the content reached its top')
  rig.body.scrollTop = 14; move(700) // the browser scrolls on the way back up; the content holds at its top while the sheet is out
  assert.equal(rig.node.style.transform, 'translateY(40px)')
  assert.equal(rig.body.scrollTop, 0, 'content holds at its top until the sheet is home')
  move(600)
  assert.equal(rig.node.style.transform, 'translateY(0px)', 'a handed-over sheet never rises above rest: further up is a scroll again')
  rig.body.scrollTop = 30; move(580)
  assert.equal(rig.body.scrollTop, 30, 'at rest the content scrolls freely')
  lift(harness, rig.body); await sleep(420)
  assert.equal(harness.closed.length, 0)
  harness.stop()
  const far = sheet({ scrollTop: 60 }), next = mount(far)
  next.fire('touchstart', touchEvent(far.body, [{ clientX: 200, clientY: 500 }]))
  next.fire('touchmove', touchEvent(far.body, [{ clientX: 200, clientY: 530 }]))
  far.body.scrollTop = 0
  for (let y = 560; y <= 720; y += 20) { next.fire('touchmove', touchEvent(far.body, [{ clientX: 200, clientY: y }], false)); await sleep(30) }
  lift(next, far.body); await sleep(420)
  assert.equal(next.closed.length, 1, 'pulled well past a third after the handover: closes')
  next.stop()
}
{ // listeners go away with the scope; the touchmove one must be non-passive
  const rig = sheet()
  const added = []
  const original = rig.node.addEventListener
  rig.node.addEventListener = (type, fn, options) => { added.push([type, options]); original(type, fn) }
  const harness = mount(rig)
  assert.deepEqual(added.find(([type]) => type === 'touchmove')[1], { passive: false }, 'touchmove must be able to preventDefault')
  harness.stop()
  assert.ok(Object.values(rig.node.listeners).every(list => list.length === 0), 'detached when the component goes')
}

// ---- wiring: every phone bottom sheet uses the one implementation, nothing else does ---------------------------------------
const composable = read('src/composables/useSheetDrag.js')
assert.ok(composable.includes("{ passive: false }") && composable.includes('event.preventDefault()'))
const wired = [
  ['src/components/archive/terminal/ArchiveTerminalDialog.vue', "useSheetDrag(dialog, { handle: '.terminal-dialog-header', onClose: () => emit('close'), enabled: () => props.swipeDismiss })"],
  ['src/components/archive/ReaderWorkspaceControls.vue', "useSheetDrag(dialog, { handle: '.sheet-header', onClose: () => closePanel() })"],
  ['src/components/archive/ArchiveSeasonalCampaign.vue', "useSheetDrag(drawerElement, { handle: '.drawer-head', onClose: close, backdrop: node => node.parentElement })"],
  ['src/components/gs/GsFilterPanel.vue', "useSheetDrag(panel, { handle: '.gs-filter-panel-head', onClose: () => close(true), enabled: () => sheet.value, isShowing: node => node.isConnected, backdrop: node => node.parentElement })"],
  ['src/components/archive/ArchiveImmersiveHome.vue', "useSheetDrag(cueIndexRef, { handle: 'header', onClose: () => closeCueIndex() })"],
]
for (const [file, call] of wired) assert.ok(read(file).includes(call), `${file} wires useSheetDrag`)
// Dialog-based sheets opt in through ArchiveTerminalDialog's swipeDismiss: filter sheets, the stage arrangement sheet and the quality sheet.
assert.ok(read('src/components/archive/ArchiveFilterSheet.vue').includes('<ArchiveTerminalDialog class="filter-sheet" swipe-dismiss '))
assert.ok(read('src/components/ChibiSongPicker.vue').includes("{ class: 'filter-sheet arrangement-sheet', swipeDismiss: true,"))
assert.ok(read('src/components/ChibiStageViewer.vue').includes('class="stage-dev-dialog stage-quality-dialog" swipe-dismiss '))
assert.match(read('src/components/archive/terminal/ArchiveTerminalDialog.vue'), /swipeDismiss: Boolean/)
// The backdrops read the dimming: <dialog> sheets through ::backdrop, the two layered sheets through their own background.
const motion = read('src/styles/gs-motion.css')
assert.ok(motion.includes('.gs-dialog-motion[open]::backdrop { opacity: var(--sheet-backdrop, 1);') && motion.includes('.gs-dialog-motion[data-sheet-drag]::backdrop { transition: none; }'))
assert.ok(read('src/components/gs/GsFilterPanel.vue').includes('.is-sheet { background: rgb(11 20 36 / calc(18% * var(--sheet-backdrop, 1))); }'))
assert.ok(read('src/components/archive/ArchiveSeasonalCampaign.vue').includes('color-mix(in srgb, var(--gs-chrome) calc(32% * var(--sheet-backdrop, 1)), transparent)'))
// The bottom form of .filter-sheet lives with the dialog both of its users render, so the stage arrangement sheet has it even
// when ArchiveFilterSheet's chunk never loaded (it was a centred card on a fresh stage page before).
assert.ok(read('src/components/archive/terminal/ArchiveTerminalDialog.vue').includes('.terminal-dialog.filter-sheet { width: 100%;'))
assert.ok(!read('src/components/archive/ArchiveFilterSheet.vue').includes('.terminal-dialog.filter-sheet'))
// Not sheets: centred dialogs, the first-visit guide and the scene settings keep to buttons, backdrop and Escape.
assert.ok(!read('src/components/archive/ArchiveOnboarding.vue').includes('useSheetDrag'))
assert.ok(!/useSheetDrag\((?:sceneSettingsRef|dialog)/.test(read('src/components/archive/ArchiveImmersiveHome.vue')))
// One implementation: no other file listens for touch moves on a sheet.
for (const file of ['src/components/archive/ArchiveFilterSheet.vue', 'src/components/gs/GsFilterPanel.vue', 'src/components/ChibiSongPicker.vue', 'src/components/archive/ReaderWorkspaceControls.vue', 'src/components/archive/ArchiveSeasonalCampaign.vue']) {
  assert.ok(!/touchmove|pointermove/.test(read(file)), `${file} has no private sheet gesture`)
}

console.log('Sheet drag: pure decisions, 15 gesture scenarios (slow pull back, flick close, drag past a third, scrolled content, content at top, sideways, rubber band, not a bottom sheet, refused close, caught mid-flight, reduced motion, backdrop dimming, scroll handover, listener hygiene) and 8 wired sheets passed. Source/contract evidence; feel on real touch devices is separate.')
