import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

// Spoken lines (card lines, home touch voices, operational voices, call titles, chats) reach every
// page through archiveLineText: one lookup, one pending rule, Producer macros resolved after the
// translation is chosen. The home dialogue and the card voice preview use the same path as the card page.
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const shardText = read('public/translations/zh-CN/archive-general/card-lines.json') // the whole overlay, for fixtures
const shard = JSON.parse(shardText).entries
const touches = Object.entries(shard['card-touch'].text)
const withP = touches.find(([source, text]) => source.includes('●●●●プロデューサー、') && text.includes('●●●●プロデューサー，'))
const withChan = touches.find(([, text]) => text.includes('●●●●プロデューサー酱'))
const plain = touches.find(([source, text]) => !source.includes('●') && source !== text)
assert.ok(withP && withChan && plain, 'fixtures exist in the published shard')

const server = await createServer({ configFile: false, plugins: [vue()], optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' })
const originalFetch = globalThis.fetch
// Pages fetch the shown line's shard (card-lines/<key>.json), never the whole overlay.
const requested = [], held = [], failing = new Map()
let hold = true
globalThis.fetch = async url => {
  const key = url.match(/\/archive-general\/card-lines\/([0-9a-f]{2})\.json\?rev=[a-f0-9]{64}$/)?.[1]
  assert.ok(key, `a card-line shard URL: ${url}`)
  requested.push(key)
  if (hold) await new Promise(resolve => held.push(resolve))
  if (failing.get(key) > 0) { failing.set(key, failing.get(key) - 1); return new Response('', { status: 503 }) }
  return new Response(read(`public/translations/zh-CN/archive-general/card-lines/${key}.json`), { headers: { 'content-type': 'application/json' } })
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

  // The first lookup hides the line and requests its shard (after the render); loaded: Chinese.
  const { cardLineShardKey } = await server.ssrLoadModule('/src/presentation/CardLineShards.mjs')
  assert.equal(touch(plain[0]).pending, true, 'no Japanese flash before the shard arrives')
  assert.deepEqual(requested, [], 'a lookup does not fetch during render')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(requested, [cardLineShardKey(plain[0])], 'only the shown line\'s shard is requested')
  assert.equal(touch(plain[0]).pending, true, 'still hidden while the shard loads')
  hold = false; held.splice(0).forEach(resolve => resolve())
  await names.loadArchiveLines([plain[0]])
  // Translations join the game's textbox wraps (the container wraps instead); the Japanese original keeps them.
  assert.deepEqual(touch(plain[0]), { text: plain[1].split(String.fromCharCode(10)).join(''), lang: 'zh-CN', pending: false })

  await names.loadArchiveLines([withP[0], withChan[0]])
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
  await names.loadArchiveLines([scout.text])
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

  // A shard that fails: its lines show the source (not hidden for good), the shard is retried
  // LINE_SHARD_RETRY_MS apart and then given up, also for explicit loads; a retry that lands turns
  // the line Chinese.
  {
    const shardOf = ([source]) => cardLineShardKey(source)
    const unloaded = touches.filter(([source, text]) => source !== text && !source.includes('●') && !requested.includes(cardLineShardKey(source)))
    const dead = unloaded[0], flaky = unloaded.find(line => shardOf(line) !== shardOf(dead))
    const timers = [], realTimeout = globalThis.setTimeout
    const flush = async () => { for (let n = 0; n < 4; n++) await new Promise(resolve => realTimeout(resolve, 0)) }
    const fire = async () => { const timer = timers.shift(); assert.ok(timer, 'a retry is scheduled'); timer.fn(); await flush(); return timer.ms }
    const attempts = line => requested.filter(key => key === shardOf(line)).length
    globalThis.setTimeout = (fn, ms, ...args) => names.LINE_SHARD_RETRY_MS.includes(ms) ? (timers.push({ fn, ms }), 0) : realTimeout(fn, ms, ...args)
    try {
      failing.set(shardOf(dead), 99)
      assert.equal(touch(dead[0]).pending, true); await flush()
      assert.deepEqual(touch(dead[0]), { text: dead[0], lang: 'ja', pending: false }, 'a failed shard shows the source')
      assert.deepEqual([await fire(), await fire()], [...names.LINE_SHARD_RETRY_MS], 'retried with backoff')
      assert.equal(touch(dead[0]).pending, false, 'a retry does not hide the line again')
      assert.equal(timers.length, 0, 'given up after the last retry')
      assert.equal(attempts(dead), names.LINE_SHARD_RETRY_MS.length + 1)
      await assert.rejects(names.loadArchiveLines([dead[0]]), /unavailable/)
      assert.equal(attempts(dead), names.LINE_SHARD_RETRY_MS.length + 1, 'an explicit load does not exceed the bound')

      failing.set(shardOf(flaky), 1)
      touch(flaky[0]); await flush()
      assert.equal(touch(flaky[0]).lang, 'ja')
      hold = true
      assert.equal(await fire(), names.LINE_SHARD_RETRY_MS[0])
      assert.deepEqual(touch(flaky[0]), { text: flaky[0], lang: 'ja', pending: false }, 'the source stays shown while a retry is in flight')
      hold = false; held.splice(0).forEach(resolve => resolve()); await flush()
      assert.equal(touch(flaky[0]).lang, 'zh-CN', 'a retry that lands translates the line')
      assert.equal(timers.length, 0)
    } finally { globalThis.setTimeout = realTimeout }
  }

  // Every page that shows these lines goes through the shared path.
  const home = read('src/components/archive/ArchiveImmersiveHome.vue')
  // A card cue reads its touch voice; an idol (general) cue reads the idol's home voice.
  // The dialogue box carries its own B-level language (原文 | 译文), passed as the fourth argument.
  assert.match(home, /archiveLineText\('card-lines', \[\[cue\?\.source === 'idol' \? 'home-voice' : 'card-touch', 'text'\]\], cue\?\.text, dialogueLocale\.value\)/)
  assert.match(home, /const cueLine = computed\(\(\) => cueText\(activeCue\.value\)\)/)
  const idolDetail = read('src/components/archive/ArchiveIdolDetail.vue')
  assert.match(idolDetail, /archiveLineText\('card-lines', \[\['home-voice', 'self-intro'\]\], props\.selfIntroduction\?\.text/)
  assert.match(home, /\{\{ cueLine\.text \}\}/)
  assert.doesNotMatch(home, /activeCue\.text\)/, 'the home dialogue never prints the raw cue text')
  const detail = read('src/components/archive/ArchiveCardDetail.vue')
  assert.match(detail, /operationalLine\(cue\.text\)\.text/)
  assert.doesNotMatch(detail, /presentProducerAddressingText\(cue\.text\)/)
  const otherVoices = read('src/components/archive/ArchiveUnusedVoices.vue')
  assert.match(otherVoices, /archiveLineText\('card-lines', \[\['office-voice', 'text'\]\], line\.text\)/)
  assert.match(otherVoices, /emit\('preview-office-voice', cue\)/)
  assert.match(home, /emit\('open-other-voices'\)/, 'the home office capsule opens the archive section')
  assert.doesNotMatch(home, /officeSystemVoices/, 'office lines are listed once, in the archive')
  const office = JSON.parse(read('src/data/officeSystemVoices.json'))
  assert.deepEqual(office.scenes.map(scene => [scene.label, scene.lines.length]), [['登录奖励', 2], ['工作开始', 5], ['加成日', 4]])
  const mobile = read('src/components/archive/ArchiveMobileArchive.vue')
  assert.match(mobile, /archiveLineText\('card-lines', \[\['call-title', 'title'\]\]/)
  assert.match(mobile, /archiveLineText\('chats', CHAT_KEYS, source\)/)
  console.log('Character line text: home touch, general home voices and self-introductions, office system voices, card lines, operational voices, call titles and chats share one lookup; pending, locale, unnamed/named Producer and P酱; card voice preview carries the translation. Browser acceptance is separate.')
} finally { globalThis.fetch = originalFetch; await server.close() }
