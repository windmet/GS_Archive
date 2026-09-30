import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, defineComponent, h, inject, nextTick, onUnmounted, ref, markRaw } from 'vue'
import { PLAYER_SESSION_KEY } from '../src/composables/PlayerSession.js'

const source = new URL('../src/components/player/PlayerSessionShell.vue', import.meta.url)
const { descriptor } = parse(await fs.readFile(source, 'utf8'))
const compiled = compileScript(descriptor, { id: 'session-test', inlineTemplate: true }).content
  .replace(/from ['"](vue|\.\.[^'"]+)['"]/g, (_, name) => `from ${JSON.stringify(name === 'vue' ? import.meta.resolve('vue') : new URL(name, source).href)}`)
const out = new URL('../.analysis/player-b002-repair/PlayerSessionShell.test.mjs', import.meta.url)
await fs.mkdir(new URL('.', out), { recursive: true }); await fs.writeFile(out, compiled)
const Shell = (await import(out.href)).default
let exits = 0, unlocks = 0, disposed = 0, session
const listeners = new Set()
globalThis.document = { fullscreenEnabled: true, fullscreenElement: null,
  addEventListener: (_, callback) => listeners.add(callback), removeEventListener: (_, callback) => listeners.delete(callback),
  exitFullscreen: async () => { exits++; document.fullscreenElement = null; listeners.forEach(fn => fn()) } }
globalThis.screen = { orientation: { lock: async () => {}, unlock: () => unlocks++ } }
const node = type => markRaw({ type, children: [], parent: null, props: {},
  requestFullscreen: async function () { document.fullscreenElement = this; listeners.forEach(fn => fn()) } })
const renderer = createRenderer({
  createElement: node, createText: text => ({ ...node('#text'), text }), createComment: node,
  insert(child, parent) { child.parent = parent; parent.children.push(child) },
  remove(child) { const parent = child.parent; if (parent) parent.children.splice(parent.children.indexOf(child), 1); child.parent = null },
  setText(n, text) { n.text = text }, setElementText(n, text) { n.text = text },
  parentNode: n => n.parent, nextSibling: () => null, patchProp: (n, k, _, v) => { n.props[k] = v },
})
const instance = ref(1), failed = ref(false)
const Episode = defineComponent({ setup() { session = inject(PLAYER_SESSION_KEY); onUnmounted(() => disposed++); return () => h('div', 'episode') } })
const App = defineComponent({ setup: () => () => h(Shell, null, { default: () => [h(Episode, { key: instance.value }), failed.value ? h('button', 'retry') : null] }) })
const container = node('container'), app = renderer.createApp(App); app.mount(container)
const root = container.children[0]
await session.enter()
assert.equal(document.fullscreenElement, root)
instance.value++; failed.value = true; await nextTick()
assert.equal(disposed, 1, 'keyed episode disposed')
assert.equal(container.children[0], root, 'fullscreen DOM stays mounted across episode replacement')
assert.equal(document.fullscreenElement, root)
assert.equal(exits, 0); assert.equal(unlocks, 0)
assert.ok(root.children.some(n => n.type === 'button'), 'recovery controls remain descendants of fullscreen root')
app.unmount(); await nextTick()
assert.equal(exits, 1); assert.equal(unlocks, 1)
console.log('Actual PlayerSessionShell: keyed child disposal, stable native root, recovery subtree, session exit passed')
