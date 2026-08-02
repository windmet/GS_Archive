<template>
  <article
    v-if="archive"
    class="mobile-archive"
    :data-focused-scenario-id="String(focusedScenarioId || '')"
    :style="{ '--mobile-accent': accentColor }"
  >
    <header class="mobile-hero" :class="{ 'is-unit': mode === 'unit' }">
      <div class="hero-backdrop" :style="heroImageStyle" aria-hidden="true"></div>
      <div v-if="mode !== 'unit'" class="hero-art" :style="heroImageStyle" aria-hidden="true"></div>
      <div class="hero-shade"></div>
      <div class="mobile-identity">
        <img v-if="mode !== 'unit'" :src="idolIcon(selectedIdol)" :alt="idolName" />
        <img v-else class="unit-logo" :src="unitLogo(selectedUnit)" :alt="unitName" />
        <div>
          <span>MOBILE ARCHIVE</span>
          <h2>{{ mode === 'unit' ? unitName : idolName }}</h2>
          <p>
            <template v-for="(part, index) in roomSubtitleParts" :key="`${part.type}:${index}`">
              <span v-if="part.type === 'text'">{{ part.text }}</span>
              <img v-else :src="getEmojiUrl(part.id)" alt="" />
            </template>
          </p>
        </div>
      </div>
      <div class="mobile-selector">
        <button title="上一项" @click="moveSelection(-1)"><ChevronLeft :size="18" /></button>
        <label>
          <span>{{ mode === 'unit' ? '组合' : '偶像' }}</span>
          <select :value="mode === 'unit' ? selectedUnit : selectedIdol" @change="changeSelection($event.target.value)">
            <option v-for="entry in selectionOptions" :key="entry.value" :value="entry.value">{{ entry.label }}</option>
          </select>
        </label>
        <button title="下一项" @click="moveSelection(1)"><ChevronRight :size="18" /></button>
      </div>
    </header>

    <nav class="mobile-tabs" aria-label="Mobile 分类">
      <button v-for="tab in tabs" :key="tab.id" :class="{ active: mode === tab.id }" @click="emit('update:mode', tab.id)">
        <component :is="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
        <small>{{ tabCount(tab.id) }}</small>
      </button>
    </nav>

    <main class="mobile-content">
      <div class="content-heading">
        <div>
          <span>{{ activeTab.eyebrow }}</span>
          <h3>{{ activeTab.label }}</h3>
        </div>
        <strong>{{ contentSummary }}</strong>
      </div>

      <aside v-if="mode === 'random'" class="random-explainer">
        <Info :size="19" />
        <div>
          <strong>这是游戏的随机话题候选池，不是连续剧情或聊天记录</strong>
          <p>masterdata 表 104 记录候选话题、时间窗、抽选权重与再次出现间隔；表 105 另有按时段抽取的开场语。档案播放器只按脚本文件顺序预览，不模拟服务器抽选，也不推定玩家实际看过的内容。</p>
        </div>
        <dl>
          <div><dt>候选话题</dt><dd>{{ randomTopicCount }}</dd></div>
          <div><dt>开场语</dt><dd>{{ randomIntroCount }}</dd></div>
        </dl>
      </aside>

      <div v-if="mode !== 'random'" class="conversation-list">
        <article
          v-for="bundle in bundles"
          :key="bundle.id"
          class="conversation-row"
          :class="{ focused: bundle.scenarios.some(item => String(item.id) === String(focusedScenarioId)), missing: !bundle.exists }"
          :data-scenario-ids="bundle.scenarios.map(item => item.id).join(',')"
        >
          <span class="conversation-type">
            <Phone v-if="bundle.kind === 'idol_phone'" :size="19" />
            <Users v-else-if="bundle.kind === 'unit_talk'" :size="19" />
            <MessageSquareText v-else :size="19" />
          </span>
          <div class="conversation-copy">
            <small>{{ formatDate(bundle.releaseAt) || kindLabel(bundle.kind) }}</small>
            <h4>{{ bundle.title }}</h4>
            <div class="unlock-list">
              <button
                v-for="unlock in bundle.unlocks"
                :key="unlock.id"
                :class="{ related: isRelatedUnlock(unlock) }"
                :title="unlockTitle(unlock)"
                @click="openUnlock(unlock)"
              >
                <CreditCard v-if="unlock.kind.startsWith('card_')" :size="12" />
                <BookOpen v-else-if="unlock.kind === 'idol_story_episode_finished'" :size="12" />
                <Unlock v-else :size="12" />
                <span>{{ unlockText(unlock) }}</span>
              </button>
            </div>
          </div>
          <div class="conversation-meta">
            <code>{{ bundle.file || bundle.scenarios[0]?.base_resource_id }}</code>
            <span>{{ bundle.scenarios.length }} unlocks</span>
          </div>
          <button class="conversation-play" :disabled="!bundle.exists" :title="bundle.exists ? '播放通信' : '本地脚本缺失'" @click="emit('play', bundle.file)">
            <Play v-if="bundle.exists" :size="17" fill="currentColor" />
            <FileWarning v-else :size="17" />
          </button>
        </article>
      </div>

      <div v-else class="random-list">
        <article v-for="bundle in randomBundles" :key="bundle.id" class="random-bundle">
          <header>
            <div><small>RANDOM TALK</small><h4>{{ bundle.title }}</h4></div>
            <button :disabled="!bundle.exists" title="按脚本顺序预览话题池" @click="emit('play', bundle.file)"><Play :size="17" fill="currentColor" /></button>
          </header>
          <div class="topic-grid">
            <button
              v-for="(topic, index) in bundle.topics"
              :key="topic.id"
              :disabled="!topic.presentation"
              :title="topic.presentation ? `精确预览 ${topic.presentation.start_step}–${topic.presentation.end_step}` : '未解析话题边界'"
              @click="playRandomTopic(bundle, topic)"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="topic-copy">
                <strong>{{ topic.presentation?.title || topic.script_label }}</strong>
                <small>{{ timeWindow(topic) }} · 抽选权重 {{ topic.weight }} · 再登场间隔 {{ topic.interval_day }} 天</small>
                <code>{{ topic.script_label }} · {{ topic.presentation?.dialogue_count || 0 }} messages</code>
              </span>
              <Play v-if="topic.presentation" :size="15" fill="currentColor" />
              <FileWarning v-else :size="15" />
            </button>
          </div>
        </article>
      </div>

      <p v-if="!contentCount" class="empty-state">当前分类没有可展示记录。</p>
    </main>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { BookOpen, ChevronLeft, ChevronRight, CreditCard, FileWarning, Info, MessageSquareText, Phone, Play, Shuffle, Unlock, Users } from '@lucide/vue'
import { buildCompiledGroupTitleMap, buildRandomTalkBundles, formatArchiveDate, groupMobileScenarios } from '../../data/idolCommunicationSelectors.js'
import { getEmojiUrl } from '../../utils/AssetResolver.js'

const props = defineProps({
  archive: { type: Object, default: null },
  compiledIndex: { type: Object, default: null },
  cards: { type: Array, default: () => [] },
  idolEpisodes: { type: Object, default: null },
  randomTalkPresentation: { type: Object, default: null },
  idols: { type: Array, default: () => [] },
  units: { type: Array, default: () => [] },
  selectedIdol: { type: String, default: '' },
  selectedUnit: { type: String, default: '' },
  mode: { type: String, default: 'personal' },
  focusedScenarioId: { type: [String, Number], default: '' },
})
const emit = defineEmits(['select-idol', 'select-unit', 'update:mode', 'play', 'play-random-topic', 'open-card', 'open-idol-story'])

const tabs = [
  { id: 'personal', label: '个人聊天', eyebrow: 'IDOL TALK', icon: MessageSquareText },
  { id: 'phone', label: '电话通信', eyebrow: 'PHONE CALL', icon: Phone },
  { id: 'unit', label: '组合聊天', eyebrow: 'UNIT TALK', icon: Users },
  { id: 'random', label: '随机话题池', eyebrow: 'RANDOM TOPICS', icon: Shuffle },
]
const activeTab = computed(() => tabs.find(tab => tab.id === props.mode) || tabs[0])
const titleMap = computed(() => buildCompiledGroupTitleMap(props.compiledIndex))
const cardById = computed(() => new Map(props.cards.map(card => [Number(card.card_id), card])))
const storyByEpisodeId = computed(() => {
  const entries = new Map()
  for (const chapter of props.idolEpisodes?.chapters || []) {
    for (const section of chapter.sections || []) {
      for (const episode of section.episodes || []) {
        entries.set(Number(episode.id), { chapter, section, episode })
      }
    }
  }
  return entries
})
const scenariosById = computed(() => new Map((props.archive?.scenarios || []).map(entry => [entry.id, entry])))
const idolScenarioIds = computed(() => props.archive?.by_idol_code?.[props.selectedIdol] || [])
const unitScenarioIds = computed(() => props.archive?.by_unit_code?.[props.selectedUnit] || [])
const idolScenarios = computed(() => idolScenarioIds.value.map(id => scenariosById.value.get(id)).filter(Boolean))
const unitScenarios = computed(() => unitScenarioIds.value.map(id => scenariosById.value.get(id)).filter(Boolean))
const bundles = computed(() => {
  const source = props.mode === 'unit' ? unitScenarios.value : idolScenarios.value
  const kind = props.mode === 'phone' ? 'idol_phone' : props.mode === 'unit' ? 'unit_talk' : 'idol_talk'
  return groupMobileScenarios(source.filter(entry => entry.kind === kind), titleMap.value)
})
const randomBundles = computed(() => buildRandomTalkBundles(
  props.archive,
  props.selectedIdol,
  titleMap.value,
  props.randomTalkPresentation,
))
const contentCount = computed(() => props.mode === 'random' ? randomBundles.value.length : bundles.value.length)
const randomTopics = computed(() => (props.archive?.random_talk?.topics || []).filter(topic => topic.idol_code === props.selectedIdol))
const randomTopicCount = computed(() => randomTopics.value.length)
const randomRoomIds = computed(() => new Set(randomTopics.value.map(topic => Number(topic.talk_room_id))))
const randomIntroCount = computed(() => (props.archive?.random_talk?.intros || []).filter(intro =>
  randomRoomIds.value.has(Number(intro.talk_room_id)),
).length)
const contentSummary = computed(() => props.mode === 'random'
  ? `${randomTopicCount.value} topics · ${contentCount.value} script`
  : `${contentCount.value} records`)
const idol = computed(() => props.idols.find(entry => entry.idol_code === props.selectedIdol) || props.idols[0] || {})
const unit = computed(() => props.units.find(entry => entry.unit_code === props.selectedUnit) || props.units[0] || {})
const idolName = computed(() => idol.value.display_name || props.selectedIdol)
const unitName = computed(() => unit.value.unit_name || props.selectedUnit)
const accentColor = computed(() => props.mode === 'unit' ? (unit.value.unit_color || '#168f87') : (idol.value.color || '#168f87'))
const personalRoom = computed(() => props.archive?.rooms?.personal?.find(room => room.idol_code === props.selectedIdol))
const unitRoom = computed(() => props.archive?.rooms?.unit?.find(room => room.unit_code === props.selectedUnit))
const roomSubtitle = computed(() => props.mode === 'unit' ? 'Unit Talk Room' : (personalRoom.value?.profile_text || 'Mobile Talk Room'))
const roomSubtitleParts = computed(() => {
  const parts = []
  const pattern = /<emoji>([A-Za-z0-9._-]+)<\/emoji>/g
  let cursor = 0
  let match
  while ((match = pattern.exec(roomSubtitle.value))) {
    if (match.index > cursor) parts.push({ type: 'text', text: roomSubtitle.value.slice(cursor, match.index) })
    parts.push({ type: 'emoji', id: match[1] })
    cursor = match.index + match[0].length
  }
  if (cursor < roomSubtitle.value.length) parts.push({ type: 'text', text: roomSubtitle.value.slice(cursor) })
  return parts.length ? parts : [{ type: 'text', text: roomSubtitle.value }]
})
const heroImageStyle = computed(() => ({
  backgroundImage: `url('${props.mode === 'unit' ? unitBackground(props.selectedUnit) : idolBackground(props.selectedIdol)}')`,
}))
const selectionOptions = computed(() => props.mode === 'unit'
  ? props.units.map(entry => ({ value: entry.unit_code, label: entry.unit_name }))
  : props.idols.map(entry => ({ value: entry.idol_code, label: entry.display_name })))

function tabCount(mode) {
  if (mode === 'random') return randomTopicCount.value
  if (mode === 'unit') return unitScenarios.value.filter(entry => entry.kind === 'unit_talk').length
  return idolScenarios.value.filter(entry => entry.kind === (mode === 'phone' ? 'idol_phone' : 'idol_talk')).length
}
function moveSelection(delta) {
  const options = selectionOptions.value
  const current = props.mode === 'unit' ? props.selectedUnit : props.selectedIdol
  const index = options.findIndex(entry => entry.value === current)
  if (index < 0 || !options.length) return
  changeSelection(options[(index + delta + options.length) % options.length].value)
}
function changeSelection(value) {
  emit(props.mode === 'unit' ? 'select-unit' : 'select-idol', value)
}
function isRelatedUnlock(unlock) {
  return unlock.kind.startsWith('card_') || unlock.kind === 'idol_story_episode_finished'
}
function openUnlock(unlock) {
  const targetId = Number(unlock.condition?.param_a || 0)
  if (unlock.kind.startsWith('card_')) emit('open-card', targetId)
  else if (unlock.kind === 'idol_story_episode_finished') emit('open-idol-story', targetId)
}
function unlockCard(unlock) {
  return cardById.value.get(Number(unlock.condition?.param_a || 0)) || null
}
function unlockAction(unlock) {
  const condition = unlock.condition || {}
  if (condition.kind === 'card_acquired') return '获得'
  if (condition.kind === 'card_awakened') return '特训完成'
  if (condition.kind === 'card_limit_break') return `突破 ${condition.param_b || 4} 次`
  return unlock.text
}
function unlockText(unlock) {
  const card = unlockCard(unlock)
  if (card) return `${card.title_full || `【${card.title || card.card_id}】`} ${unlockAction(unlock)}`
  const story = storyByEpisodeId.value.get(Number(unlock.condition?.param_a || 0))
  if (story) return `「${story.section.scenario_title}」${story.episode.name} 完成`
  return unlock.text
}
function unlockTitle(unlock) {
  const card = unlockCard(unlock)
  if (card) return `卡片 ${card.card_id} · ${card.title_full || card.title} · ${unlockAction(unlock)} · 点击查看卡片资料`
  const story = storyByEpisodeId.value.get(Number(unlock.condition?.param_a || 0))
  if (story) return `个人故事 ${story.episode.id} · ${story.section.name}「${story.section.scenario_title}」${story.episode.name} · 点击查看个人故事`
  return unlock.text
}
function kindLabel(kind) { return kind === 'unit_talk' ? 'UNIT TALK' : kind === 'idol_phone' ? 'PHONE CALL' : 'IDOL TALK' }
function playRandomTopic(bundle, topic) {
  if (!topic.presentation) return
  emit('play-random-topic', {
    file: bundle.file,
    startStep: topic.presentation.start_step,
    endStep: topic.presentation.end_step,
  })
}
function formatDate(value) { return formatArchiveDate(value) }
function idolIcon(code) { return `/assets/idols/mobile_icons/image_chara_mobile_icon_${code}.png` }
function idolBackground(code) { return `/assets/idols/mobile_bg/image_chara_mobile_background_${code}.png` }
function unitBackground(code) { return `/assets/units/mobile_bg/image_unit_mobile_background_${code}.png` }
function unitLogo(code) { return `/assets/units/logos/image_unit_logo_${code}.png` }
function timeWindow(topic) {
  const start = topic.open_time || '00:00'
  const end = topic.close_time || '00:00'
  if (start === '0:00:00' && end === '00:00:00') return '全天'
  const compact = value => value.replace(/^0(?=\d:)/, '').replace(/:00$/, '')
  return `${compact(start)}–${end === '00:00:00' ? '24:00' : compact(end)}`
}
</script>

<style scoped>
.mobile-archive { height: 100%; overflow-x: hidden; overflow-y: auto; background: #f4f6f7; color: #26343c; }.mobile-hero { position: relative; isolation: isolate; display: flex; align-items: end; justify-content: space-between; gap: 24px; min-height: 190px; padding: 26px max(24px, calc((100% - 1100px) / 2)); overflow: hidden; background-color: #26343c; }.hero-backdrop, .hero-art { position: absolute; pointer-events: none; background-repeat: no-repeat; }.hero-backdrop { inset: -20px; z-index: -3; background-position: center 18%; background-size: cover; filter: blur(16px) brightness(.58) saturate(.78); transform: scale(1.045); }.hero-art { inset: 0; z-index: -2; background-position: right 12%; background-size: clamp(480px, 42vw, 650px) auto; opacity: .78; -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.18) 24%, #000 52%, #000 100%); mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.18) 24%, #000 52%, #000 100%); }.mobile-hero.is-unit .hero-backdrop { inset: 0; background-position: center; filter: brightness(.6) saturate(.82); transform: none; }.hero-shade { position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg, rgba(20,31,36,.88), rgba(20,31,36,.48) 58%, rgba(20,31,36,.3)); }.mobile-identity, .mobile-selector { position: relative; z-index: 1; }.mobile-identity { display: flex; align-items: center; gap: 15px; min-width: 0; color: #fff; }.mobile-identity > img { width: 76px; height: 76px; border: 3px solid rgba(255,255,255,.86); border-radius: 50%; background: #eef3f4; object-fit: cover; }.mobile-identity > img.unit-logo { width: 120px; border: 0; border-radius: 0; background: rgba(255,255,255,.9); object-fit: contain; }.mobile-identity span { color: #b9fff8; font-size: .58rem; font-weight: 800; }.mobile-identity h2 { margin: 4px 0; font-size: 1.45rem; }.mobile-identity p { margin: 0; color: rgba(255,255,255,.8); font-size: .65rem; }.mobile-selector { display: flex; align-items: end; gap: 6px; }.mobile-selector > button { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.62); border-radius: 5px; background: rgba(19,30,35,.5); color: #fff; cursor: pointer; }.mobile-selector label { display: flex; flex-direction: column; gap: 4px; }.mobile-selector label span { color: rgba(255,255,255,.82); font-size: .56rem; }.mobile-selector select { min-width: 240px; height: 34px; padding: 0 30px 0 10px; border: 1px solid rgba(255,255,255,.7); border-radius: 5px; background: rgba(255,255,255,.94); color: #28363d; font: inherit; font-size: .67rem; }
.mobile-identity p { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; white-space: pre-line; }.mobile-identity p img { width: 20px; height: 20px; object-fit: contain; }
.mobile-tabs { position: sticky; top: 0; z-index: 3; display: flex; justify-content: center; gap: 2px; border-bottom: 1px solid #dce3e5; background: rgba(255,255,255,.97); }.mobile-tabs button { display: inline-grid; grid-template-columns: 18px auto 26px; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #718087; cursor: pointer; font: inherit; font-size: .65rem; }.mobile-tabs button.active { border-color: var(--mobile-accent); color: #26343c; font-weight: 800; }.mobile-tabs small { display: grid; place-items: center; min-width: 24px; height: 18px; border-radius: 9px; background: #edf1f2; color: #77858b; font-size: .48rem; }
.mobile-content { max-width: 1100px; margin: 0 auto; padding: 22px 24px 42px; }.content-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 12px; }.content-heading span { color: var(--mobile-accent); font-size: .57rem; font-weight: 800; }.content-heading h3 { margin: 3px 0 0; font-size: 1rem; }.content-heading > strong { color: #7b888e; font-size: .59rem; }
.conversation-list { border-top: 1px solid #dbe2e4; }.conversation-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) 170px 38px; align-items: center; gap: 12px; min-height: 88px; padding: 12px 13px; border-right: 1px solid #dbe2e4; border-bottom: 1px solid #dbe2e4; border-left: 1px solid #dbe2e4; background: #fff; }.conversation-row.focused { box-shadow: inset 3px 0 var(--mobile-accent); background: #f2faf9; }.conversation-row.missing { background: #f6f7f8; }.conversation-type { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb, var(--mobile-accent) 12%, #fff); color: var(--mobile-accent); }.conversation-copy { min-width: 0; }.conversation-copy > small { color: var(--mobile-accent); font-size: .52rem; font-weight: 700; }.conversation-copy h4 { margin: 3px 0 7px; font-size: .7rem; }.unlock-list { display: flex; flex-wrap: wrap; gap: 4px; }.unlock-list button { display: inline-flex; align-items: center; gap: 4px; max-width: 310px; min-height: 22px; padding: 2px 7px; border: 1px solid #dce4e6; border-radius: 4px; background: #f7f9fa; color: #65747b; cursor: default; font: inherit; font-size: .5rem; }.unlock-list button.related { border-color: #bfe0dd; background: #eef8f7; color: #167e77; cursor: pointer; }.unlock-list button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.conversation-meta { display: flex; flex-direction: column; align-items: end; gap: 4px; min-width: 0; color: #87949a; font-size: .5rem; }.conversation-meta code { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.conversation-play, .random-bundle header button { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--mobile-accent); border-radius: 50%; background: #fff; color: var(--mobile-accent); cursor: pointer; }.conversation-play:disabled, .random-bundle header button:disabled { border-color: #ccd5d8; color: #8e999e; cursor: not-allowed; }
.random-explainer { display: grid; grid-template-columns: 24px minmax(0,1fr) auto; align-items: center; gap: 11px; margin-bottom: 12px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--mobile-accent) 28%, #dce3e5); border-radius: 6px; background: #fff; color: var(--mobile-accent); }.random-explainer > div { display: flex; flex-direction: column; gap: 3px; }.random-explainer strong { font-size: .64rem; }.random-explainer p { margin: 0; color: #68777e; font-size: .54rem; line-height: 1.6; }.random-explainer dl { display: grid; grid-template-columns: repeat(2,72px); margin: 0; border-left: 1px solid #e1e7e9; }.random-explainer dl div { padding: 4px 10px; text-align: center; }.random-explainer dt { color: #849198; font-size: .48rem; }.random-explainer dd { margin: 3px 0 0; color: var(--mobile-accent); font-size: .74rem; font-weight: 800; }
.random-list { border-top: 1px solid #dbe2e4; }.random-bundle { border-right: 1px solid #dbe2e4; border-bottom: 1px solid #dbe2e4; border-left: 1px solid #dbe2e4; background: #fff; }.random-bundle > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border-bottom: 1px solid #e4e9eb; }.random-bundle header small { color: var(--mobile-accent); font-size: .52rem; font-weight: 800; }.random-bundle h4 { margin: 3px 0 0; font-size: .72rem; }.topic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #e1e6e8; }.topic-grid > button { display: grid; grid-template-columns: 28px minmax(0, 1fr) 18px; align-items: center; gap: 8px; min-height: 78px; padding: 10px 12px; border: 0; background: #fff; color: #2b3a42; cursor: pointer; font: inherit; text-align: left; }.topic-grid > button:hover:not(:disabled) { background: color-mix(in srgb, var(--mobile-accent) 7%, #fff); }.topic-grid > button:disabled { color: #87949a; cursor: not-allowed; }.topic-grid > button > span:first-child { align-self: start; color: var(--mobile-accent); font-size: .57rem; font-weight: 800; }.topic-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.topic-grid strong { display: -webkit-box; overflow: hidden; font-size: .62rem; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.topic-grid small { color: #708087; font-size: .5rem; line-height: 1.4; }.topic-grid code { overflow: hidden; color: #a0aaae; font-size: .45rem; text-overflow: ellipsis; white-space: nowrap; }.topic-grid > button > svg { color: var(--mobile-accent); }.empty-state { padding: 40px 0; color: #7c898f; font-size: .65rem; text-align: center; }
@media (max-width: 760px) { .mobile-hero { align-items: start; flex-direction: column; min-height: 210px; padding: 18px 12px; }.hero-art { background-position: center 10%; background-size: 480px auto; opacity: .72; -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.65) 65%, transparent 100%); mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.65) 65%, transparent 100%); }.hero-shade { background: linear-gradient(180deg, rgba(20,31,36,.58), rgba(20,31,36,.8)); }.mobile-identity > img { width: 58px; height: 58px; }.mobile-selector { width: 100%; }.mobile-selector label { flex: 1; }.mobile-selector select { width: 100%; min-width: 0; }.mobile-tabs { justify-content: start; overflow-x: auto; }.mobile-tabs button { flex: 0 0 auto; padding: 0 10px; }.mobile-content { padding: 16px 10px 30px; }.conversation-row { grid-template-columns: 36px minmax(0, 1fr) 36px; gap: 9px; padding: 11px 9px; }.conversation-type { width: 36px; height: 36px; }.conversation-meta { display: none; }.random-explainer { grid-template-columns: 22px minmax(0,1fr); }.random-explainer dl { grid-column: 1 / -1; border-top: 1px solid #e1e7e9; border-left: 0; }.topic-grid { grid-template-columns: 1fr; }.content-heading > strong { display: none; } }
</style>
