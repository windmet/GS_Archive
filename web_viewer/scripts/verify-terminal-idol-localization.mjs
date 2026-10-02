import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { EntityTranslationRepository } from '../src/localization/story/EntityTranslationRepository.js'
import { IDOL_ID_TO_NAME } from '../src/utils/IdolNameMap.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const dictionary = JSON.parse(read('public/data/masterdata/idol_unit_dictionary.json'))
const overlay = JSON.parse(read('public/translations/zh-CN/entities/idols.json'))
const sourceNames = Object.fromEntries(Object.entries(dictionary.by_idol_code).map(([id, idol]) => [id, idol.display_name]))
const repository = new EntityTranslationRepository({
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(overlay) }),
})
await repository.loadEntity({ entityType: 'idol', locale: 'zh-CN', sourceNames: IDOL_ID_TO_NAME })

// Exercise the production App callbacks with the real source dictionary and overlay.
const app = read('src/App.vue')
const locale = ref('zh-CN')
const context = vm.createContext({
  bootstrapIdolDictionary: dictionary, IDOL_ID_TO_NAME, uiLocale: locale,
  storyTranslationLocale: ref('zh-CN'), idolEntityTranslationRevision: ref(0),
  entityTranslationRepository: repository,
})
for (const name of ['idolSourceName', 'idolTranslatedName', 'idolDisplayName', 'idolEntitySearchText']) {
  const source = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0]
  assert.ok(source, `Missing App callback: ${name}`)
  vm.runInContext(source, context)
}
const callbacks = { idolName: context.idolDisplayName, idolSearch: context.idolEntitySearchText }
const idols = [
  { id: '029ass', name: sourceNames['029ass'], unitName: 'Café Parade' },
  { id: '007kei', name: sourceNames['007kei'], unitName: 'Altessimo' },
]

// Compile and render the actual SFCs. Setting their existing setup refs supplies
// user search/selection state without adding a production demo or browser harness.
const server = await createServer({ configFile: false, plugins: [vue()],
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
function withState(component, values) {
  return { ...component, setup(props, ctx) {
    const state = component.setup(props, ctx)
    for (const [key, value] of Object.entries(values)) state[key].value = value
    return state
  } }
}
const render = (component, props) => renderToString(createSSRApp(component, props))
let checks = 0
try {
  const { default: Picker } = await server.ssrLoadModule('/src/components/archive/terminal/ArchiveIdolPickerPanel.vue')
  const { default: Preferred } = await server.ssrLoadModule('/src/components/archive/terminal/ArchivePreferredIdolSlot.vue')
  const { default: Welcome } = await server.ssrLoadModule('/src/components/archive/ArchiveWelcome.vue')
  for (const currentLocale of ['zh-CN', 'ja-JP']) {
    locale.value = currentLocale
    const displayed = currentLocale === 'zh-CN' ? overlay.entries['029ass'].name : sourceNames['029ass']
    for (const query of ['阿斯兰', 'アスラン', '别西卜II世']) {
      const html = await render(withState(Picker, { query }), { idols, modelValue: '029ass', ...callbacks })
      assert.match(html, /1 位偶像/)
      assert.match(html, /data-idol-code="029ass"/)
      assert.ok(!html.includes('data-idol-code="007kei"'))
      assert.ok(html.includes(`<strong>${displayed}</strong>`))
      assert.ok(html.includes(`已选：${displayed}`))
      checks++
    }
    const slot = await render(Preferred, { idols, value: '029ass', idPrefix: 'regression', ...callbacks })
    assert.ok(slot.includes(`<strong>${displayed}</strong>`))
    const welcome = await render(Welcome, { idols, selectionOnly: true, dataReady: true,
      preferences: { startupIdol: '029ass' }, ...callbacks })
    assert.ok(welcome.includes(`已选：${displayed}`))
    assert.ok(welcome.includes(`<strong>${displayed}</strong>`), 'Welcome passes the name callback to its picker')
    assert.match(welcome, /<button[^>]*aria-pressed="true"[^>]*data-idol-code="029ass"/)
    checks++
  }
  const group = await render(withState(Picker, { query: '  café PARADE  ' }), { idols, ...callbacks })
  assert.match(group, /1 位偶像/)
  assert.match(group, /data-idol-code="029ass"/)
  const empty = await render(withState(Picker, { query: '不存在的名字' }), { idols, ...callbacks })
  assert.match(empty, /0 位偶像/)
  assert.match(empty, /没有找到符合条件的偶像/)
  const fallback = await render(Picker, { idols, modelValue: '029ass' })
  assert.ok(fallback.includes(`<strong>${sourceNames['029ass']}</strong>`))
  const unselected = await render(Preferred, { idols, value: 'missing', idPrefix: 'empty', ...callbacks })
  assert.ok(unselected.includes('选择我的偶像'))
  const unselectedWelcome = await render(Welcome, { idols, selectionOnly: true, dataReady: true,
    preferences: { startupIdol: 'missing' }, ...callbacks })
  assert.ok(unselectedWelcome.includes('请选择一位偶像'))
  checks++
  console.log(`Terminal idol localization: ${checks} SFC render scenarios passed; Chinese/Japanese search, locale display, selected summaries and empty/source fallbacks. Browser acceptance is separate.`)
} finally {
  await server.close()
}
