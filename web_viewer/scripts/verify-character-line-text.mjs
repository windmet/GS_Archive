import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

// Spoken lines (card lines, home touch voices, operational voices, call titles, chats) reach every
// page through archiveLineText: one lookup, one pending rule, Producer macros resolved after the
// translation is chosen. The home dialogue and the card voice preview use the same path as the card page.
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const shardText = read('public/translations/zh-CN/archive-general/card-lines.json')
const shard = JSON.parse(shardText).entries
const touches = Object.entries(shard['card-touch'].text)
const withP = touches.find(([source, text]) => source.includes('●●●●プロデューサー、') && text.includes('●●●●プロデューサー，'))
const withChan = touches.find(([, text]) => text.includes('●●●●プロデューサー酱'))
const plain = touches.find(([source, text]) => !source.includes('●') && source !== text)
assert.ok(withP && withChan && plain, 'fixtures exist in the published shard')

const server = await createServer({ configFile: false, plugins: [vue()], optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' })
const originalFetch = globalThis.fetch
let release
globalThis.fetch = async url => {
  assert.match(url, /\/card-lines\.json\?rev=[a-f0-9]{64}$/)
  await new Promise(resolve => { release = resolve })
  return new Response(shardText, { headers: { 'content-type': 'application/json' } })
}
try {
  const names = await server.ssrLoadModule('/src/components/archive/useArchiveNamedText.js')
  const locale = await server.ssrLoadModule('/src/localization/ui/UiLocaleStore.js')
  const { producerName } = await server.ssrLoadModule('/src/utils/LanguageStore.js')
  const { buildCardVoicePreviewScenario } = await server.ssrLoadModule('/src/data/cardVoicePreview.js')
  const { normalizeLegacyDialogue } = await server.ssrLoadModule('/src/localization/story/LegacyDialogueAdapter.js')
  const { resolveStoryText } = await server.ssrLoadModule('/src/localization/story/StoryTextResolver.js')
  const touch = source => names.archiveLineText('card-lines', [['card-touch', 'text']], source)
  locale.setUiLocale('zh-CN'); producerName.value = ''

  // Not requested yet: the source is usable. Loading: hidden in place. Loaded: Chinese.
  assert.deepEqual(touch(plain[0]), { text: plain[0], lang: 'ja', pending: false })
  const loading = names.loadArchiveNames('card-lines')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(touch(plain[0]).pending, true, 'no Japanese flash while the shard loads')
  release(); await loading
  // Translations join the game's textbox wraps (the container wraps instead); the Japanese original keeps them.
  assert.deepEqual(touch(plain[0]), { text: plain[1].split(String.fromCharCode(10)).join(''), lang: 'zh-CN', pending: false })

  // Producer macros: never raw dots; the unnamed word follows the shown language; a set name replaces it.
  assert.ok(!touch(withP[0]).text.includes('●') && touch(withP[0]).text.includes('制作人，'))
  assert.ok(touch(withChan[0]).text.includes('P酱') && !touch(withChan[0]).text.includes('制作人酱'))
  producerName.value = '晴'
  assert.ok(touch(withP[0]).text.includes('晴P，'))
  assert.ok(touch(withChan[0]).text.includes('晴P酱'))
  locale.setUiLocale('ja-JP')
  assert.deepEqual(touch(withP[0]), { text: withP[0].replaceAll('●●●●プロデューサー', '晴P'), lang: 'ja', pending: false })
  locale.setUiLocale('zh-CN'); producerName.value = ''

  // Operational voices (scout change) are card lines word for word.
  const details = JSON.parse(read('public/data/masterdata/card_detail_index.json')).cards_by_resource_id
  const scout = Object.values(details).flatMap(card => card.operational_voice_cues || []).find(cue => cue.text_source === 'masterdata' && cue.text?.trim() && cue.text.trim() !== '0')
  assert.equal(names.archiveLineText('card-lines', names.ANY_CARD_LINE, scout.text).lang, 'zh-CN', 'an operational voice uses its card-line translation')

  // Card voice preview: the player receives the touch translation and resolves it like a story line.
  const cards = JSON.parse(read('public/data/masterdata/card_index.json')).cards
  const card = cards.find(row => (row.home_voice_cues || []).some(cue => cue.preview?.text === withP[0] && cue.preview?.preview_step?.dialogue?.text === withP[0]))
  const cue = card.home_voice_cues.find(item => item.preview.text === withP[0])
  const sourceDialogue = JSON.stringify(cue.preview.preview_step.dialogue)
  const scenario = buildCardVoicePreviewScenario(card, cue, { translate: source => names.archiveNamedTranslation('card-touch', source, 'text') })
  assert.ok(scenario, 'the fixture cue has a stage preview')
  assert.equal(scenario.steps[0].dialogue.text_cn, withP[1])
  assert.equal(JSON.stringify(cue.preview.preview_step.dialogue), sourceDialogue, 'the source card is not mutated')
  const shown = resolveStoryText({ ...normalizeLegacyDialogue(scenario.steps[0].dialogue), preferences: { story_content_mode: 'translation', producer_name: '' } })
  assert.equal(shown.primary.source, 'translation')
  assert.ok(!shown.primary.text.includes('●'))

  // Every page that shows these lines goes through the shared path.
  const home = read('src/components/archive/ArchiveImmersiveHome.vue')
  assert.match(home, /archiveLineText\('card-lines', \[\['card-touch', 'text'\]\], activeCue\.value\?\.text\)/)
  assert.match(home, /\{\{ cueLine\.text \}\}/)
  assert.doesNotMatch(home, /activeCue\.text\)/, 'the home dialogue never prints the raw cue text')
  const detail = read('src/components/archive/ArchiveCardDetail.vue')
  assert.match(detail, /operationalLine\(cue\.text\)\.text/)
  assert.doesNotMatch(detail, /presentProducerAddressingText\(cue\.text\)/)
  const mobile = read('src/components/archive/ArchiveMobileArchive.vue')
  assert.match(mobile, /archiveLineText\('card-lines', \[\['call-title', 'title'\]\]/)
  assert.match(mobile, /archiveLineText\('chats', CHAT_KEYS, source\)/)
  console.log('Character line text: home touch, card lines, operational voices, call titles and chats share one lookup; pending, locale, unnamed/named Producer and P酱; card voice preview carries the translation. Browser acceptance is separate.')
} finally { globalThis.fetch = originalFetch; await server.close() }
