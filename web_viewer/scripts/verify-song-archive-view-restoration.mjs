import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import {
  buildArchiveViewContext,
  readArchiveViewRestoration,
  restoreArchiveViewState,
  saveArchiveViewRestoration,
} from '../src/core/archiveViewRestoration.js'

// Exercise the real shared restorer at asynchronous ownership boundaries.
// Song's lazy template preparation is covered by verify-song-detail-presentation.
class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}
const context = buildArchiveViewContext('http://test/?view=song_detail&song=flslgt', {
  sidemArchiveEntryId: 'song-audio-return',
})
const focusId = 'song-audio:flslgt:saved-archive:idol:007kei'
const fixture = ({ missingTarget = false, onFocus = () => {} } = {}) => {
  const storage = new MemoryStorage()
  saveArchiveViewRestoration(context, { scrollTop: 420, focusId }, storage)
  const container = { scrollTop: 0, scrollHeight: 1400, clientHeight: 400 }
  const focusCalls = []
  const target = {
    dataset: { archiveFocusId: focusId },
    focus(options) { focusCalls.push(options); onFocus() },
  }
  let mounted = true, queries = 0
  const root = {
    querySelector(selector) {
      assert.equal(selector, '[data-archive-scroll-container]')
      queries++
      return mounted ? container : null
    },
    querySelectorAll(selector) {
      assert.equal(selector, '[data-archive-focus-id]')
      return missingTarget ? [] : [target]
    },
  }
  return { storage, root, container, target, focusCalls,
    mount: () => { mounted = true }, unmount: () => { mounted = false },
    queries: () => queries,
  }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
const frames = []
const previousFrame = globalThis.requestAnimationFrame
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length }
const paint = async () => {
  assert.ok(frames.length, 'the real restorer is waiting for a frame')
  frames.shift()()
  await flush()
}
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const appScript = parseSfc(appSource).descriptor.scriptSetup.content
const appAst = parseJavascript(appScript, { sourceType: 'module' })
const production = ['adoptArchiveViewContext', 'restoreSongDetailView'].map(name => {
  const declaration = appAst.program.body.find(item => item.type === 'FunctionDeclaration' && item.id?.name === name)
  assert.ok(declaration, `App retains the restoration entry point ${name}`)
  return appScript.slice(declaration.start, declaration.end)
}).join('\n')
const deferred = () => {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}
function appFixture({ missingTarget = false, prepared = true, navigateOnFocus = false } = {}) {
  const navigation = createArchiveNavigationCoordinator()
  const t = fixture({ missingTarget, onFocus: () => { if (navigateOnFocus) navigation.invalidate() } })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: t.storage })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: t.root })
  const ticks = [], prepareCalls = [], errors = []
  const state = vm.createContext({
    buildArchiveViewContext, readArchiveViewRestoration, restoreArchiveViewState,
    navigation, nextTick: callback => ticks.push(callback),
    window: { location: { href: 'http://test/?view=song_detail&song=flslgt' },
      history: { state: { sidemArchiveEntryId: 'song-audio-return' } } },
    view: { value: 'song_detail' }, currentSongId: { value: 'flslgt' },
    songDetailView: { value: null }, pendingSongDetailRestore: null,
    activeArchiveViewContext: null, archiveViewRestoreRevision: 0,
    pendingEventCatalogRestore: null, pendingPhotoCatalogRestore: null,
    console: { error: (...args) => errors.push(args) },
  })
  let preparation = null
  const component = {
    async prepareRestoreFocus(options) {
      prepareCalls.push(options)
      const gate = preparation
      if (gate) await gate.promise
      return prepared
    },
  }
  const handlers = vm.runInContext(`${production}\n;({ adopt: adoptArchiveViewContext, ready: restoreSongDetailView })`, state)
  state.songDetailView.value = component
  return { ...t, state, component, handlers, prepareCalls, errors,
    blockPreparation() { preparation = deferred(); return preparation },
    unblockNewPreparation() { preparation = null },
    async tick() {
      const pending = ticks.splice(0).map(callback => callback())
      await flush()
      return { pending }
    },
    ticks,
  }
}

try {
  {
    const t = fixture()
    assert.equal(await restoreArchiveViewState(context, { root: t.root, storage: t.storage, isCurrent: () => false }), false)
    assert.equal(frames.length, 0, 'an already-cancelled owner cannot schedule restoration')
    assert.equal(t.queries(), 0)
  }
  {
    const t = fixture({ missingTarget: true })
    const restored = restoreArchiveViewState(context, { root: t.root, storage: t.storage })
    await paint()
    assert.equal(await restored, true)
    assert.equal(t.container.scrollTop, 420, 'an unknown focus target still permits the current page scroll to restore')
    assert.equal(t.focusCalls.length, 0, 'unknown targets never fall back to a different control')
  }
  {
    const t = fixture()
    let current = true
    const restored = restoreArchiveViewState(context, { root: t.root, storage: t.storage, isCurrent: () => current })
    current = false // The user leaves after restore starts but before its frame resumes.
    await paint()
    assert.equal(await restored, false)
    assert.equal(t.container.scrollTop, 0)
    assert.equal(t.focusCalls.length, 0)
    assert.equal(t.queries(), 0, 'a stale owner cannot read or modify the next page after awaiting a frame')
  }
  {
    let current = true
    const t = fixture({ onFocus: () => { current = false } })
    const restored = restoreArchiveViewState(context, { root: t.root, storage: t.storage, isCurrent: () => current })
    await paint()
    assert.equal(await restored, false)
    assert.equal(t.focusCalls.length, 1, 'the valid target can trigger navigation in its focus handler')
    assert.equal(t.container.scrollTop, 0, 'navigation during focus prevents a following stale scroll write')
  }
  {
    const t = fixture(); t.unmount()
    const restored = restoreArchiveViewState(context, { root: t.root, storage: t.storage, isCurrent: () => true })
    await paint()
    assert.equal(t.focusCalls.length, 0)
    assert.equal(t.container.scrollTop, 0)
    t.mount()
    await paint()
    assert.equal(await restored, true, 'the restorer waits for the actual scroll container to mount')
    assert.deepEqual(t.focusCalls, [{ preventScroll: true }])
    assert.equal(t.container.scrollTop, 420)
  }
  {
    const t = fixture(); t.unmount()
    let current = true
    const restored = restoreArchiveViewState(context, { root: t.root, storage: t.storage, isCurrent: () => current })
    await paint()
    current = false
    t.mount()
    await paint()
    assert.equal(await restored, false, 'a delayed mount cannot revive a cancelled restore owner')
    assert.equal(t.focusCalls.length, 0)
    assert.equal(t.container.scrollTop, 0)
  }
  {
    const t = appFixture()
    // Custom Back can mount the child while the URL still describes the idol.
    t.state.window.location.href = 'http://test/?view=idol_detail&idol=007kei'
    assert.equal(await t.handlers.ready({ songId: 'flslgt' }), false)
    assert.equal(t.prepareCalls.length, 0, 'an early child ready cannot restore an unadopted URL')
    t.state.window.location.href = 'http://test/?view=song_detail&song=flslgt'
    t.handlers.adopt()
    const { pending } = await t.tick()
    await paint()
    assert.deepEqual(await Promise.all(pending), [true])
    assert.equal(t.prepareCalls.length, 1, 'adoption retries a child that was already ready')
    assert.equal(t.prepareCalls[0].songId, 'flslgt')
    assert.equal(t.prepareCalls[0].focusId, focusId)
    assert.equal(t.focusCalls.length, 1)
    assert.equal(t.container.scrollTop, 420)
    assert.equal(await t.handlers.ready({ songId: 'flslgt' }), false, 'a completed handshake is one-shot')
    assert.equal(t.errors.length, 0)
  }
  {
    const t = appFixture()
    t.state.songDetailView.value = null
    t.handlers.adopt()
    const { pending } = await t.tick()
    assert.deepEqual(await Promise.all(pending), [false])
    assert.ok(t.state.pendingSongDetailRestore, 'an absent asynchronous component retains the pending handshake')
    t.state.songDetailView.value = t.component
    assert.equal(await t.handlers.ready({ songId: 'drvalv' }), false, 'a late ready from another song is rejected')
    const restored = t.handlers.ready({ songId: 'flslgt' })
    await flush(); await paint()
    assert.equal(await restored, true, 'the actual late ready entry completes adoption after the component mounts')
    assert.equal(t.prepareCalls.length, 1)
    assert.equal(t.focusCalls.length, 1)
  }
  {
    const t = appFixture(), gate = t.blockPreparation()
    t.handlers.adopt()
    const restored = t.handlers.ready({ songId: 'flslgt' })
    const { pending } = await t.tick()
    assert.deepEqual(await Promise.all(pending), [false])
    assert.equal(await t.handlers.ready({ songId: 'flslgt' }), false)
    assert.equal(t.prepareCalls.length, 1, 'ready and nextTick never duplicate an in-flight preparation')
    gate.resolve(); await flush(); await paint()
    assert.equal(await restored, true)
    assert.equal(t.focusCalls.length, 1)
    assert.equal(t.state.pendingSongDetailRestore, null)
  }
  {
    const t = appFixture({ missingTarget: true, prepared: false })
    t.handlers.adopt()
    const restored = t.handlers.ready({ songId: 'flslgt' })
    await flush(); await paint()
    assert.equal(await restored, true, 'false preparation means no matching disclosure, not cancelled current navigation')
    assert.equal(t.container.scrollTop, 420)
    assert.equal(t.focusCalls.length, 0)
  }
  for (const [name, revoke] of Object.entries({
    'navigation revision': t => t.state.navigation.invalidate(),
    'coordinator disposal': t => t.state.navigation.dispose(),
    'restore revision': t => { t.state.archiveViewRestoreRevision++ },
    'active route context': t => { t.state.activeArchiveViewContext = buildArchiveViewContext('http://test/?view=song_detail&song=drvalv') },
    'component instance': t => { t.state.songDetailView.value = { ...t.component } },
    'current view': t => { t.state.view.value = 'idol_detail' },
    'current song': t => { t.state.currentSongId.value = 'drvalv' },
  })) {
    const t = appFixture(), gate = t.blockPreparation()
    t.handlers.adopt()
    const restored = t.handlers.ready({ songId: 'flslgt' })
    assert.equal(t.prepareCalls[0].isCurrent(), true)
    revoke(t)
    assert.equal(t.prepareCalls[0].isCurrent(), false, `${name} revokes the child's explicit ownership guard`)
    gate.resolve()
    assert.equal(await restored, false, `${name} cancels restoration after awaiting preparation`)
    assert.equal(frames.length, 0)
    assert.equal(t.focusCalls.length, 0)
    assert.equal(t.container.scrollTop, 0)
  }
  {
    const t = appFixture(), gate = t.blockPreparation()
    t.handlers.adopt()
    const old = t.handlers.ready({ songId: 'flslgt' })
    t.handlers.adopt()
    const replacement = t.state.pendingSongDetailRestore
    gate.resolve()
    assert.equal(await old, false)
    assert.equal(t.state.pendingSongDetailRestore, replacement, 'old completion cannot clear the newer adoption handshake')
    t.unblockNewPreparation()
    const current = t.handlers.ready({ songId: 'flslgt' })
    await flush(); await paint()
    assert.equal(await current, true)
    assert.equal(t.prepareCalls.length, 2)
    assert.equal(t.focusCalls.length, 1)
  }
  {
    const t = appFixture()
    t.handlers.adopt()
    const restored = t.handlers.ready({ songId: 'flslgt' })
    await flush()
    t.state.navigation.invalidate()
    await paint()
    assert.equal(await restored, false, 'App ownership remains enforced during the shared animation frame')
    assert.equal(t.focusCalls.length, 0)
    assert.equal(t.container.scrollTop, 0)
  }
  {
    const t = appFixture({ navigateOnFocus: true })
    t.handlers.adopt()
    const restored = t.handlers.ready({ songId: 'flslgt' })
    await flush(); await paint()
    assert.equal(await restored, false)
    assert.equal(t.focusCalls.length, 1)
    assert.equal(t.container.scrollTop, 0, 'App guard also prevents a scroll write after focus triggers another navigation')
  }
  assert.equal(frames.length, 0)
} finally {
  if (previousFrame) globalThis.requestAnimationFrame = previousFrame
  else delete globalThis.requestAnimationFrame
  if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage)
  else delete globalThis.sessionStorage
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
  else delete globalThis.document
}
console.log('Song archive restoration: actual App adopt/ready functions and real shared storage/core passed early-ready-before-URL-adoption, late component mount, one-shot concurrent handshake, unknown-focus scroll, all ownership guards, competing adoptions, frame/focus cancellation and delayed DOM mount. Controlled memory-host evidence; full App routing, native disclosure events and Browser focus remain separate.')
