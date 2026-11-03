import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as nearViewport from '../src/components/archive/useNearViewport.js'

// A deferred DomainMediaPreview (the Portal's song, story and event covers) must not mount an <img> before it may
// request. Vue mounts an undefined src as `img.src=''`; WebKit answers an empty src with an error event, and the
// preview then showed "图片暂时无法读取" on iOS before the picture was ever asked for, while Chromium stays silent.
// The memory host below models WebKit: any <img> that receives an empty src fires error.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

let nodeId = 0
const node = (type, text = '') => Vue.markRaw({ type, text, props: {}, children: [], parent: null, id: ++nodeId })
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const srcWrites = []
const { createApp } = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText(item, text) { item.text = text }, setElementText(item, text) { item.children = [node('#text', text)] },
  insert(child, parent, anchor) {
    remove(child)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
    child.parent = parent
  },
  remove, parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
  patchProp(item, key, previous, next) {
    item.props[key] = next
    if (item.type !== 'img' || key !== 'src') return
    srcWrites.push({ id: item.id, value: next })
    if (next == null || next === '') queueMicrotask(() => item.props.onError?.({ target: item }))
  },
})

// One controllable IntersectionObserver for useNearViewport (imported in this realm, so it reads these globals).
const observers = new Set()
globalThis.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; this.targets = new Set(); observers.add(this) }
  observe(target) { this.targets.add(target) }
  disconnect() { this.targets.clear(); observers.delete(this) }
}
globalThis.matchMedia = query => ({ matches: query === 'all' })
const intersect = () => { for (const observer of [...observers]) observer.callback([...observer.targets].map(target => ({ target, isIntersecting: true }))) }

const timers = []
const context = vm.createContext({
  setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length }, clearTimeout() {},
  window: { addEventListener() {}, removeEventListener() {} }, console,
})
const emptyComponent = { render: () => null }
const modules = { vue: Vue, './useNearViewport.js': { ...nearViewport }, '@lucide/vue': { ImageOff: emptyComponent, RefreshCw: emptyComponent } }
async function component(file) {
  const { descriptor } = parse(read(file))
  const module = new vm.SourceTextModule(compileScript(descriptor, { id: file, inlineTemplate: true }).content, { context })
  await module.link(specifier => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected production dependency: ${specifier}`)
    const exports = modules[specifier]
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace.default
}
const DomainMediaPreview = await component('src/components/archive/DomainMediaPreview.vue')
const flush = async () => { for (let i = 0; i < 10; i++) { await Promise.resolve(); await Vue.nextTick() } }
const find = (item, predicate) => predicate(item) ? item : item.children.map(child => find(child, predicate)).find(Boolean) || null
const url = '/assets/songs/jacket_brndnf.png'

function mount(props) {
  const root = node('root')
  createApp(DomainMediaPreview, props).mount(root)
  return root
}

// Deferred and still far below the fold: no <img>, no src write, no failure state.
srcWrites.length = 0
let root = mount({ binding: { url }, name: 'BRAND NEW FIELD', deferred: true })
await flush()
assert.equal(find(root, item => item.type === 'img'), null, 'a deferred preview mounts no <img> before it nears the viewport')
assert.deepEqual(srcWrites, [], 'nothing writes an img src before the preview nears the viewport')
assert.equal(find(root, item => item.props.class === 'domain-resource-empty'), null, 'a waiting preview is not shown as failed')
assert.equal(timers.length, 0, 'a waiting preview schedules no retry')

// Near the viewport: the <img> mounts with its real src as the first and only src write, and stays.
intersect()
await flush()
const image = find(root, item => item.type === 'img')
assert.ok(image, 'the <img> mounts once the preview nears the viewport')
assert.deepEqual(srcWrites, [{ id: image.id, value: url }], 'the first src the <img> ever receives is the picture')
assert.equal(find(root, item => item.props.class === 'domain-resource-empty'), null, 'the near preview is not failed')

// A real load error still fails, retries on its own, and the retried <img> asks for the same picture.
image.props.onError({ target: image })
await flush()
assert.ok(find(root, item => item.props.class === 'domain-resource-empty'), 'a real error shows the failure state')
assert.deepEqual(timers.map(timer => timer.delay), [1000], 'a real error schedules the first automatic retry')
timers.shift().callback()
await flush()
const retried = find(root, item => item.type === 'img')
assert.ok(retried && retried !== image && retried.props.src === url, 'the automatic retry mounts a fresh <img> for the same picture')

// Eager previews (detail pages) are near from the start and request at once.
srcWrites.length = 0
root = mount({ binding: { url }, name: 'eager' })
await flush()
const eager = find(root, item => item.type === 'img')
assert.ok(eager && srcWrites[0]?.value === url, 'an eager preview requests at once')
assert.equal(find(root, item => item.props.class === 'domain-resource-empty'), null, 'an eager preview is not failed')

console.log('Deferred media src verifier passed: no src-less <img>, near mounts the picture, real errors still retry')
