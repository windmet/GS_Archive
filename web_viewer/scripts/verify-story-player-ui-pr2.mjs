import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { MOBILE_UNIT_THEMES } from '../src/data/mobileVisualThemes.js'
import { resolveCommunicationContext } from '../src/core/story-runtime/CommunicationPresentationContext.js'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const readJson = async path => JSON.parse(await read(path))

const [app, viewer, dock, archiveMobile, archiveIdolStory, layout, backdrop, device, chat, call, messageBubble, callProfile, header, choice, zhLocale, jaLocale] = await Promise.all([
  read('src/App.vue'),
  read('src/core/StoryViewer.vue'),
  read('src/components/player/PlayerControlDock.vue'),
  read('src/components/archive/ArchiveMobileArchive.vue'),
  read('src/components/archive/ArchiveIdolStory.vue'),
  read('src/components/mobile/MobileSceneLayout.vue'),
  read('src/components/mobile/MobileSceneBackdrop.vue'),
  read('src/components/mobile/MobileDeviceFrame.vue'),
  read('src/components/mobile/MobileChatScene.vue'),
  read('src/components/mobile/MobileCallScene.vue'),
  read('src/components/mobile/MobileMessageBubble.vue'),
  read('src/components/mobile/MobileCallProfile.vue'),
  read('src/components/mobile/MobileChatHeader.vue'),
  read('src/components/mobile/MobileChoiceRail.vue'),
  read('src/localization/ui/locales/zh-CN.js'),
  read('src/localization/ui/locales/ja-JP.js'),
])

const expectedUnits = [
  '01jup', '02dra', '03alt', '04bei', '05w00', '06fra', '07sai', '08hig',
  '09shi', '10caf', '11mof', '12sem', '13the', '14fla', '15leg', '16cfi',
]

assert.deepEqual(Object.keys(MOBILE_UNIT_THEMES).sort(), expectedUnits.sort(), 'all 16 units need a mobile identity theme')

function channel(value) {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(value => Number.parseInt(value, 16))
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

for (const [unit, theme] of Object.entries(MOBILE_UNIT_THEMES)) {
  assert.ok(theme.evidence, `${unit} theme must retain an evidence label`)
  assert.ok(contrast(theme.primary, theme.onPrimary) >= 4.5, `${unit} header text must meet WCAG AA contrast`)
}

for (const fixture of [
  { file: '001tom_307_2_3_001_07_09_a.json', mode: 'call', charaId: '001tom' },
  { file: '039mcr_301_2_3_039_01_09_b.json', mode: 'talk', charaId: '039mcr' },
]) {
  const scenario = await readJson(`public/data/compiled/${fixture.file}`)
  const choiceIndex = scenario.steps.findIndex(step => step.type === 'choice')
  assert.ok(choiceIndex >= 0, `${fixture.file} must retain its communication choice fixture`)
  const context = resolveCommunicationContext({
    step: scenario.steps[choiceIndex],
    stepIndex: choiceIndex,
    historyStack: [],
    steps: scenario.steps,
    scenarioId: scenario.scenario_id,
  })
  assert.equal(context.mode, fixture.mode, `${fixture.file} direct choice must inherit ${fixture.mode} mode`)
  assert.equal(context.primaryCharaId, fixture.charaId, `${fixture.file} direct choice must inherit caller identity`)
}

const stampFixture = await readJson('public/data/compiled/001tom_301_2_3_001_01_09_b.json')
assert.equal(stampFixture.steps.at(-1)?.type, 'talk_stamp', 'Touma mobile fixture must end on the authored stamp step')
assert.equal(stampFixture.steps.at(-1)?.stamp?.id, 'image_mobile_stamp_001tom_01', 'Touma final stamp identity must remain authoritative')
await access(new URL('../public/assets/stamps/image_mobile_stamp_001tom_01.png', import.meta.url))

const emojiFixture = await readJson('public/data/compiled/002sht_301_2_3_002_01_09_a.json')
assert.match(JSON.stringify(emojiFixture), /<emoji>image_talk_emoji_05<\/emoji>/, 'Shota fixture must retain its inline emoji marker')
await access(new URL('../public/assets/emojis/image_talk_emoji_05.png', import.meta.url))

const unitCodedSpeakerFixture = await readJson('public/data/compiled/1_x_001tom_8_2_2_001_01.json')
const unitCodedSpeakerIndex = unitCodedSpeakerFixture.steps.findIndex(step => step.chara_id === '001jup')
const unitCodedSpeakerContext = resolveCommunicationContext({
  step: unitCodedSpeakerFixture.steps[unitCodedSpeakerIndex],
  stepIndex: unitCodedSpeakerIndex,
  historyStack: [],
  steps: unitCodedSpeakerFixture.steps,
  scenarioId: unitCodedSpeakerFixture.scenario_id,
})
assert.equal(unitCodedSpeakerContext.primaryCharaId, '001tom', 'unit-coded Jupiter speaker must resolve to Touma from scenario authority')
assert.equal(unitCodedSpeakerContext.unitCode, '01jup', 'unit-coded Jupiter speaker must retain the Jupiter presentation theme')

const bilingualCommunicationFixture = await readJson('public/data/compiled/fixtures/story_localization_stress.json')
const bilingualChoiceIndex = bilingualCommunicationFixture.steps.findIndex(step => step.type === 'choice')
const bilingualChoiceContext = resolveCommunicationContext({
  step: bilingualCommunicationFixture.steps[bilingualChoiceIndex],
  stepIndex: bilingualChoiceIndex,
  historyStack: [],
  steps: bilingualCommunicationFixture.steps,
  scenarioId: bilingualCommunicationFixture.scenario_id,
})
assert.equal(bilingualChoiceContext.mode, 'call', 'direct bilingual choice must inherit the preceding Call scene')
assert.equal(bilingualChoiceContext.primaryCharaId, '007kei', 'direct bilingual choice must inherit explicit speaker identity')
assert.equal(bilingualChoiceContext.unitCode, '03alt', 'explicit Kei identity must resolve the Altessimo theme')

const [mobileArchive, cardIndex, idolEpisodes] = await Promise.all([
  readJson('public/data/masterdata/mobile_archive_index.json'),
  readJson('public/data/masterdata/card_index.json'),
  readJson('public/data/masterdata/idol_episode_index.json'),
])
const takeruLimitBreak = mobileArchive.scenarios.find(entry => entry.compiled_file === '038tak_301_2_3_038_01_09_a.json')
const takeruAwakened = mobileArchive.scenarios.find(entry => entry.compiled_file === '038tak_301_2_3_038_01_09_b.json')
const takeruCard = cardIndex.cards.find(entry => Number(entry.card_id) === 1338001)
const cardById = new Map(cardIndex.cards.map(card => [Number(card.card_id), card]))
const cardConditionRows = mobileArchive.scenarios.filter(entry => String(entry.release_condition?.kind || '').startsWith('card_'))
const referencedCardIds = [...new Set(cardConditionRows.map(entry => Number(entry.release_condition?.param_a)))]
const unresolvedCardIds = referencedCardIds.filter(cardId => {
  const card = cardById.get(cardId)
  return !card || !(card.title_full || card.title)
})
const takeruBirthdayCall = mobileArchive.scenarios.find(entry => entry.compiled_file === '1_x_038tak_2_1_2_038_22_t01.json')
const storyEpisodeRows = mobileArchive.scenarios.filter(entry => entry.release_condition?.kind === 'idol_story_episode_finished')
const storyEpisodeIds = [...new Set(storyEpisodeRows.map(entry => Number(entry.release_condition?.param_a)))]
const namedStoryEpisodes = new Set((idolEpisodes.chapters || []).flatMap(chapter =>
  (chapter.sections || []).flatMap(section =>
    (section.episodes || []).filter(episode => section.scenario_title && episode.name).map(episode => Number(episode.id)),
  ),
))
const unresolvedStoryEpisodeIds = storyEpisodeIds.filter(episodeId => !namedStoryEpisodes.has(episodeId))
assert.deepEqual(
  [takeruLimitBreak?.release_condition?.kind, takeruLimitBreak?.release_condition?.param_a, takeruLimitBreak?.release_condition?.param_b],
  ['card_limit_break', 1338001, 4],
  'Takeru 09_a must retain the card 1338001 limit-break-4 mapping',
)
assert.equal(takeruAwakened?.release_condition?.kind, 'card_awakened', 'Takeru 09_b must remain the awakened-card condition')
assert.equal(takeruCard?.title_full, '【燃え盛る蒼き闘志】', 'card 1338001 must retain its authoritative masterdata title')
assert.deepEqual(unresolvedCardIds, [], 'every mobile card condition must resolve to a named card detail record')
assert.equal(takeruBirthdayCall?.release_condition?.param_a, 2380208, 'Takeru birthday call must retain its episode 2380208 condition')
assert.deepEqual(unresolvedStoryEpisodeIds, [], 'every mobile idol-story condition must resolve to a named story episode')

assert.match(chat, /MobileDeviceFrame :surface-style="deviceSurfaceStyle"/, 'Talk background must be consumed inside the phone')
assert.match(chat, /IDOL_ID_TO_NAME\[context\.value\.primaryCharaId\]/, 'direct Talk choice deep links must retain their participant title')
assert.match(chat, /isProducer\(rawSpeaker, charaId\)/, 'speakerless authored character messages must not be projected as producer replies')
assert.match(chat, /speaker_identity\?\.entity_id/, 'Talk messages must consume explicit speaker identity before name inference')
assert.doesNotMatch(call, /MobileSceneLayout :bg-url=/, 'Call personal art must not be duplicated across the viewport')
assert.match(call, /backgroundSize:\s*'100% 100%'/, 'Call must preserve the complete baked personal phone canvas')
assert.match(call, /context\.value\.primaryCharaId/, 'direct Call choice deep links must inherit their caller identity')
assert.match(call, /latestChoiceSelection/, 'Call must project the latest selected reply after a choice')
assert.match(viewer, /:choiceTexts="choiceTexts"[\s\S]*<MobileCallScene|<MobileCallScene[\s\S]*:choiceTexts="choiceTexts"/, 'StoryViewer must pass selected choice records into Call scenes')
assert.match(viewer, /:sceneBackgroundUrl="mobileBackdropUrl"/, 'mobile scenes must receive the current story background')
assert.match(viewer, /--player-content-top:/, 'mobile scenes must reserve the global top bar safe region')
assert.match(viewer, /--player-content-bottom:/, 'mobile scenes must reserve the global control dock safe region')
assert.match(viewer, /communicationCompleted/, 'communication stories need a non-blocking completion state')
assert.match(viewer, /episodeFinished && !communicationCompleted/, 'blocking completion must remain limited to non-communication stories')
assert.match(viewer, /:next-disabled="episodeFinished"/, 'completed communication stories must keep the dock while disabling forward advance')
assert.match(dock, /:disabled="nextDisabled"/, 'the shared player dock must expose a disabled completed-state advance control')
assert.match(zhLocale, /player\.complete\.communication/, 'Chinese UI locale must name non-blocking communication completion')
assert.match(jaLocale, /player\.complete\.communication/, 'Japanese UI locale must name non-blocking communication completion')
assert.match(archiveMobile, /class="hero-backdrop"/, 'mobile archive hero must own a softened fill layer')
assert.match(archiveMobile, /class="hero-art"/, 'personal mobile archive hero must retain a proportional foreground crop')
assert.match(archiveMobile, /v-if="mode !== 'unit'" class="hero-art"/, 'unit archive mode must not apply personal portrait cropping')
assert.match(archiveMobile, /cardById/, 'mobile archive unlock chips must resolve card masterdata')
assert.match(archiveMobile, /card\.title_full/, 'mobile archive unlock chips must display authoritative card names')
assert.match(archiveMobile, /emit\('open-card'/, 'named card unlock chips must retain the existing card-detail route entry')
assert.match(archiveMobile, /storyByEpisodeId/, 'mobile archive unlock chips must resolve idol-story masterdata')
assert.match(archiveMobile, /section\.scenario_title/, 'mobile archive story unlocks must display formal story titles')
assert.match(archiveMobile, /emit\('open-idol-story'/, 'named story unlock chips must expose a related-story route entry')
assert.match(app, /function openMobileIdolStory/, 'App must route related mobile unlocks into the idol-story archive')
assert.match(app, /currentStorySection\.value = String\(relation\.section_id\)/, 'related-story routes must retain the exact section identity')
assert.match(app, /currentEpisodeId\.value = String\(episodeId\)/, 'related-story routes must retain the exact episode identity')
assert.match(archiveIdolStory, /data-section-id="section\.id"/, 'idol-story archive must expose focused section identity')
assert.match(archiveIdolStory, /data-episode-id="episode\.id"/, 'idol-story archive must expose focused episode identity')
assert.match(backdrop, /filter:\s*blur\(/, 'outer story background must be softened behind the phone surface')
assert.doesNotMatch(layout, /backgroundImage:\s*`url/, 'scene backdrop must not stretch portrait phone assets across the viewport')
assert.match(layout, /overflow:\s*hidden/, 'mobile scene must clip its stage composition')
assert.match(layout, /grid-template-columns/, 'desktop choice mode must reserve separate device and reply columns')
assert.match(device, /height:\s*calc\(100dvh - var\(--player-content-top\) - var\(--player-content-bottom\)\);[\s\S]*aspect-ratio:\s*auto/, 'mobile phone surface must stay inside the player safe region')
assert.match(header, /--mobile-header-accent/, 'unit source color must remain visible as an identity accent')
assert.match(choice, /overflow-x:\s*hidden/, 'reply rail must not expose a horizontal scrollbar')
assert.match(choice, /nth-child\(even\)/, 'reply bubbles must expose the teal/lime visual rhythm')
assert.match(choice, /rail-count-many[\s\S]*flex-shrink:\s*0/, 'defensive 4+ reply lists must remain scrollable')
assert.match(choice, /prefers-reduced-motion:\s*reduce/, 'reply interactions must respect reduced motion')
assert.match(messageBubble, /@error="avatarFailed = true"/, 'Talk avatars must replace failed images with a neutral fallback')
assert.match(messageBubble, /chat-stamp-fallback/, 'failed stamps must retain a deliberate visible placeholder')
assert.match(messageBubble, /markEmojiFailed/, 'inline emoji failures must be contained without broken-image chrome')
assert.match(callProfile, /avatarUrl && !avatarFailed/, 'Call profiles must replace failed portraits with a neutral fallback')

console.log('Story Player UI PR2: 16 unit themes, contained phone art, grid choices and overflow guards verified')
