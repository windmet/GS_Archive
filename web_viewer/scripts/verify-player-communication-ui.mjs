import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { collectScenarioEntitySourceNames, createStoryLocalization, provideStoryLocalization } from '../src/localization/story/StoryLocalizationContext.js'
import { EntityTranslationRepository } from '../src/localization/story/EntityTranslationRepository.js'
import { resolveUiText } from '../src/localization/ui/UiTextResolver.js'

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8')
const moduleUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const componentUrls = new Map()
// Compile the actual SFCs and their component dependencies in memory. No server,
// build artifacts, replacement presentation code or VM flags are required.
function componentUrl(file) {
  if (!componentUrls.has(file.href)) componentUrls.set(file.href, (async () => {
    const { descriptor } = parse(await readFile(file, 'utf8'))
    let code = compileScript(descriptor, { id: file.pathname, inlineTemplate: true }).content
    for (const match of [...code.matchAll(/from\s+(['"])([^'"]+)\1/g)]) {
      const specifier = match[2]
      const resolved = specifier.startsWith('.')
        ? (specifier.endsWith('.vue') ? await componentUrl(new URL(specifier, file)) : new URL(specifier, file).href)
        : import.meta.resolve(specifier)
      code = code.replace(match[0], 'from ' + JSON.stringify(resolved))
    }
    return moduleUrl(code)
  })())
  return componentUrls.get(file.href)
}
const component = async path => (await import(await componentUrl(new URL('../' + path, import.meta.url)))).default
const node = (type, text = '') => ({ type, text, children: [], parent: null, props: {} })
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (item, text) => { item.text = text },
  setElementText: (item, text) => { item.text = text; item.children = [] },
  patchProp: (item, key, previous, value) => { item.props[key] = value },
  insert(item, parent, anchor = null) {
    remove(item)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, item); item.parent = parent
  },
  remove, parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
})
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const hasClass = (item, name) => String(item.props.class || '').split(/\s+/).includes(name)
const flush = async () => { for (let i = 0; i < 10; i++) { await Promise.resolve(); await Vue.nextTick() } }
// The source gate checks out no compiled corpus. Keep the exact real scenario
// as a bounded fixture, with its byte identity checked against the receipt.
const scenarioReceipt = JSON.parse(await read('fixtures/localization/communication-001tom-provenance.json'))
const scenarioBytes = await readFile(new URL('../fixtures/localization/communication-001tom-compiled.json', import.meta.url))
assert.equal(scenarioBytes.length, scenarioReceipt.byte_length)
assert.equal(createHash('sha256').update(scenarioBytes).digest('hex'), scenarioReceipt.sha256)
const scenario = JSON.parse(scenarioBytes.toString('utf8'))
assert.equal(scenario.scenario_id, scenarioReceipt.scenario_id)
assert.equal(scenario.total_steps, scenario.steps.length)

export async function verifyChoiceControls() {
  const { descriptor } = parse(await read('src/core/StoryViewer.vue'))
  const source = descriptor.template.content.match(/<PlayerControlDock\b[\s\S]*?\/>/)?.[0]
  assert.ok(source, 'StoryViewer supplies the control dock')
  const compiled = compileTemplate({ source, filename: 'StoryViewer.vue', id: 'choice-controls' })
  assert.deepEqual(compiled.errors, [])
  const { render } = await import(moduleUrl(compiled.code.replace(/from (['"])vue\1/g, 'from ' + JSON.stringify(import.meta.resolve('vue')))))
  const state = Vue.reactive({ compiledData: scenario, HIDE_UI: false, uiHidden: false,
    immersiveCompact: false, autoEnabled: false, skipEnabled: false, isFirstStep: false,
    episodeFinished: false, currentStep: scenario.steps.find(step => step.type === 'talk'),
    goPrev() {}, toggleAuto() {}, toggleSkip() {}, openBacklog() {}, goNext() {},
  })
  const Root = { components: { PlayerControlDock: await component('src/components/player/PlayerControlDock.vue') }, setup: () => state, render }
  const root = node('root'), app = renderer.createApp(Root); app.mount(root)
  const button = key => all(root).find(item => item.type === 'button' && item.props['aria-label'] === resolveUiText(key))
  assert.equal(button('player.next').props.disabled, false, 'ordinary dialogue can advance')
  const choiceIndex = scenario.steps.findIndex(step => step.type === 'choice')
  assert.ok(choiceIndex >= 0)
  state.currentStep = scenario.steps[choiceIndex]; await flush()
  assert.equal(button('player.next').props.disabled, true, 'waiting for an authored reply disables the native Next button')
  assert.equal(button('player.previous').props.disabled, false, 'reply waiting does not disable review')
  state.currentStep = scenario.steps[choiceIndex + 1]; await flush()
  assert.equal(button('player.next').props.disabled, false, 'the authored reply resumes forward advance')
  state.currentStep = scenario.steps.at(-1); await flush()
  assert.equal(button('player.next').props.disabled, false, 'the final stamp can reach completion')
  state.episodeFinished = true; await flush()
  assert.equal(button('player.next').props.disabled, true, 'completion still disables forward advance')
  app.unmount()
}

export async function verifyChatStampIdentity() {
  const Chat = await component('src/components/mobile/MobileChatScene.vue')
  const entities = JSON.parse(await read('public/translations/zh-CN/entities/idols.json'))
  const entityRepository = new EntityTranslationRepository({ fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(entities) }) })
  await entityRepository.loadEntity({ entityType: 'idol', locale: 'zh-CN', sourceNames: collectScenarioEntitySourceNames(scenario).get('idol') })
  assert.equal(entityRepository.getEntry({ entityType: 'idol', entityId: '001tom', locale: 'zh-CN' }).name, entities.entries['001tom'].name)
  const original = JSON.stringify(scenario)
  const preferences = Vue.ref({ story_content_mode: 'translation', story_translation_locale: 'zh-CN', bilingual_primary: 'translation' })
  const scope = Vue.effectScope()
  const localization = scope.run(() => createStoryLocalization({ compiledData: Vue.ref(scenario), storyPreferences: preferences,
    repository: { loadScenario: async () => null, getDiagnostics: () => null },
    entityRepository,
  }))
  await flush()
  const first = scenario.steps.findIndex(step => step.type === 'talk'), last = scenario.steps.length - 1
  const state = Vue.reactive({ step: scenario.steps[first], stepIndex: first, steps: scenario.steps,
    scenarioId: scenario.scenario_id, historyStack: [], choiceTexts: {},
  })
  const Root = { setup() { provideStoryLocalization(localization); return () => Vue.h(Chat, state) } }
  const root = node('root'), app = renderer.createApp(Root); app.mount(root); await flush()
  const avatar = () => all(root).filter(item => item.type === 'img' && hasClass(item, 'chat-avatar')).map(item => item.props.src)
  const originalAvatar = avatar()[0]
  assert.ok(originalAvatar)
  state.historyStack = [first]; state.step = scenario.steps[last]; state.stepIndex = last; await flush()
  for (const mode of ['translation', 'original', 'translation']) {
    preferences.value = { ...preferences.value, story_content_mode: mode }; await flush()
    const name = mode === 'translation' ? entities.entries['001tom'].name : scenario.steps[first].dialogue.speaker.trim()
    const names = all(root).filter(item => hasClass(item, 'chat-name')).map(text)
    assert.deepEqual(names, [name, name], 'text and stamp identify the same participant in ' + mode)
    assert.equal(text(all(root).find(item => hasClass(item, 'header-title'))), name, 'the chat title never duplicates the participant in ' + mode)
    assert.deepEqual(avatar(), [originalAvatar, originalAvatar], 'text and stamp keep their original actor avatar')
    assert.ok(all(root).find(item => hasClass(item, 'chat-stamp')).props.src.includes(scenario.steps[last].stamp.id), 'authored stamp identity is unchanged')
  }
  assert.equal(JSON.stringify(scenario), original, 'source dialogue, stamp and thread data stay unchanged')
  app.unmount(); scope.stop()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyChoiceControls()
  await verifyChatStampIdentity()
  console.log('Actual StoryViewer dock template/PlayerControlDock/PlayerIconButton and MobileChatScene: choice/advance/completion semantics; real 001tom text/stamp participant deduplication in Chinese/Japanese with unchanged avatar, stamp and source passed. Memory renderer; Browser acceptance is separate.')
}
