import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import * as Lucide from '@lucide/vue'
import { parse, compileScript } from '@vue/compiler-sfc'

// Execute the real transport and VoiceRow templates in a memory host. Events
// below prove the component's emit contract, not native pointer/keyboard input,
// media decoding, CSS layout or a complete song player's session behavior.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const node = (type, text = '') => ({
  type, text, props: {}, children: [], parent: null,
  pause() {}, load() {}, removeAttribute(name) { delete this.props[name] },
})
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: value => node('#text', value),
  createComment: value => node('#comment', value),
  setText: (item, value) => { item.text = value },
  setElementText: (item, value) => { item.text = value; item.children = [] },
  patchProp: (item, key, previous, value) => { item.props[key] = value },
  insert(item, parent, anchor = null) {
    remove(item)
    const position = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(position < 0 ? parent.children.length : position, 0, item)
    item.parent = parent
  },
  remove, parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
})
const context = vm.createContext({ console })
async function compileComponent(path, imports) {
  const { descriptor } = parse(read(path))
  const source = compileScript(descriptor, { id: path, inlineTemplate: true }).content
  const module = new vm.SourceTextModule(source, { context })
  await module.link(specifier => {
    assert.ok(Object.hasOwn(imports, specifier), `Unexpected production dependency: ${specifier}`)
    const exports = imports[specifier]
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace.default
}
const Transport = await compileComponent('src/components/archive/ArchiveMediaTransport.vue', {
  vue: Vue, '@lucide/vue': Lucide,
})
const VoiceRow = await compileComponent('src/components/archive/ArchiveVoiceRow.vue', {
  vue: Vue, './ArchiveMediaTransport.vue': { default: Transport },
})
const flush = async () => { await Vue.nextTick(); await Vue.nextTick() }
function fixture(props, component = Transport) {
  const root = node('root'), events = [], state = Vue.shallowReactive({ ...props })
  const app = renderer.createApp({ render: () => Vue.h(component, {
    ...state, onToggle: () => events.push(['toggle']),
    onRestart: () => events.push(['restart']), onSeek: value => events.push(['seek', value]),
  }, { default: () => Vue.h('span', { role: 'note' }, '收录音轨状态') }) })
  app.config.warnHandler = message => assert.fail(message)
  app.mount(root)
  return { root, state, events, app }
}
function controls(t) {
  const group = all(t.root).find(item => item.props.role === 'group')
  assert.ok(group, 'audio controls retain an accessible group')
  const buttons = all(group).filter(item => item.type === 'button')
  assert.equal(buttons.length, 2, 'transport exposes only supported play/pause and restart controls')
  const range = all(group).find(item => item.type === 'input' && item.props.type === 'range')
  assert.ok(range)
  const restart = buttons.find(item => item.props['aria-label'] === '回到开头')
  assert.ok(restart)
  return { group, toggle: buttons.find(item => item !== restart), restart, range }
}
for (const music of [false, true]) {
  const t = fixture({ music, label: '演唱试听', ready: true, playing: false,
    currentTime: 75.9, duration: 130.285737 })
  await flush()
  let c = controls(t)
  assert.equal(c.group.props['aria-label'], '演唱试听')
  assert.equal(Boolean(c.toggle.props.disabled), false)
  assert.equal(Boolean(c.restart.props.disabled), false)
  assert.equal(Boolean(c.range.props.disabled), false)
  assert.equal(c.range.props['aria-label'], '播放进度')
  assert.equal(c.range.props.min, '0')
  assert.equal(c.range.props.max, 130.285737)
  assert.equal(c.range.props.step, '0.01')
  assert.equal(c.range.props.value, 75.9)
  if (music) assert.equal(c.toggle.props['aria-label'], '播放', 'icon-only music control is named')
  else assert.equal(text(c.toggle), '播放', 'default transport keeps the voice label')
  assert.match(text(c.group), /1:15/)
  assert.match(text(c.group), /2:10/)
  assert.equal(all(c.group).filter(item => item.props.role === 'note').length, 1,
    'both variants render consumer slot content once')
  c.toggle.props.onClick(); c.restart.props.onClick(); c.range.props.onInput({ target: { value: '42.5' } })
  assert.deepEqual(t.events, [['toggle'], ['restart'], ['seek', 42.5]],
    'both variants forward one unchanged event with a numeric seek payload')
  t.state.playing = true; t.state.loading = true; await flush(); c = controls(t)
  if (music) assert.equal(c.toggle.props['aria-label'], '暂停')
  else assert.equal(text(c.toggle), '暂停')
  const status = all(c.group).filter(item => item.props.role === 'status')
  assert.equal(status.length, 1)
  assert.equal(text(status[0]), '正在准备音频…')
  t.state.ready = false; await flush(); c = controls(t)
  assert.equal(Boolean(c.toggle.props.disabled), true)
  assert.equal(Boolean(c.restart.props.disabled), true)
  assert.equal(Boolean(c.range.props.disabled), true)
  t.state.ready = true; t.state.loading = false
  for (const duration of [undefined, null, 0, -1, Infinity, NaN]) {
    t.state.duration = duration; t.state.currentTime = -1; await flush(); c = controls(t)
    assert.equal(Boolean(c.toggle.props.disabled), false, 'unknown duration still permits loading/playback')
    assert.equal(Boolean(c.restart.props.disabled), true, 'unknown or invalid duration cannot authorize restart')
    assert.equal(Boolean(c.range.props.disabled), true, 'unknown or invalid duration cannot authorize seek')
    assert.equal(c.range.props.max, 1)
    assert.match(text(c.group), /0:00/)
    assert.match(text(c.group), /待播放/)
    assert.equal(all(c.group).filter(item => item.props.role === 'status').length, 0)
  }
  t.app.unmount()
}
{
  const t = fixture({}); await flush()
  const c = controls(t)
  assert.equal(c.group.props['aria-label'], '音频播放')
  assert.equal(text(c.toggle), '播放', 'omitting music uses the original text-button variant')
  assert.equal(Boolean(c.toggle.props.disabled), false, 'ready defaults to true')
  assert.equal(Boolean(c.range.props.disabled), true)
  t.app.unmount()
}
{
  const t = fixture({ src: '/contract-only.ogg' }, VoiceRow); await flush()
  let c = controls(t)
  assert.equal(c.group.props['aria-label'], '语音播放')
  assert.equal(text(c.toggle), '播放', 'the real VoiceRow retains the default transport')
  assert.equal(Boolean(c.restart.props.disabled), true)
  assert.equal(Boolean(c.range.props.disabled), true)
  t.state.label = '来电语音'; await flush(); c = controls(t)
  assert.equal(c.group.props['aria-label'], '来电语音', 'voice labels remain reactive')
  assert.equal(text(c.toggle), '播放')
  t.app.unmount()
}
console.log('Song music transport: real SFC default/music label and aria parity, supported controls, readiness, reactive play/pause/loading, known/unknown/invalid duration guards, numeric seek/toggle/restart emits, time labels and slot rendering passed. Real VoiceRow default and reactive label retained. Memory-renderer evidence; native input, Browser layout and decoded audio/session acceptance are separate.')
