<template>
  <article
    v-if="idolData || unitData"
    class="mobile-archive"
    data-archive-scroll-container
    :data-focused-scenario-id="String(focusedScenarioId || '')"
    :style="{ '--mobile-accent': accentColor }"
  >
    <div class="mobile-layout">
    <!-- The room's call card, composed as the game's call screen: the room picture (a keepsake
         for an idol, the unit's own pattern for a unit), the owner at its centre, the picker
         on the pale lower band the picture leaves for text. -->
    <header class="mobile-hero" :class="{ 'is-unit': mode === 'unit', 'no-art': !heroMedia.src }">
      <img v-if="heroMedia.src" class="call-card-art" :src="heroMedia.src" alt="" />
      <div class="mobile-identity">
        <ArchiveIdolAvatar v-if="mode !== 'unit'" class="mobile-idol-avatar" :idol-code="selectedIdol" variant="mobile"
          :accent-color="idolFrameColor" :size="76" :ring-width="3" :alt="idolName" />
        <img v-else class="unit-logo" :src="unitLogo(selectedUnit)" :alt="unitName" />
        <h2>{{ mode === 'unit' ? unitName : idolName }}</h2>
      </div>
      <div class="call-card-lower">
        <p class="call-card-note" :class="{ 'is-empty': !roomSubtitle }">
          <span class="call-card-note-text"><template v-for="(part, index) in roomSubtitleParts" :key="`${part.type}:${index}`"><span v-if="part.type === 'text'">{{ part.text }}</span><img v-else :src="getEmojiUrl(part.id)" :alt="part.alt" /></template></span>
        </p>
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
      </div>
    </header>

    <div class="mobile-main">
    <nav class="mobile-tabs" aria-label="通信分类">
      <button v-for="tab in visibleTabs" :key="tab.id" :class="{ active: mode === tab.id }" :aria-pressed="mode === tab.id" @click="emit('update:mode', tab.id)">
        <component :is="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
        <small>{{ tabCount(tab.id) }}</small>
      </button>
    </nav>

    <main class="mobile-content">
      <div class="content-heading">
        <div>
          <h3>{{ activeTab.label }}</h3>
        </div>
        <strong>{{ contentSummary }}</strong>
      </div>

      <aside v-if="mode === 'random'" class="random-explainer">
        <strong>随机话题：偶像在聊天里随机聊起的日常小话题</strong>
        <p>游戏里打开聊天时，偶像会先说一句随机的开场语，再从下面的话题中抽一个聊。能不能抽到，取决于每个话题标注的时段和「再登场间隔」。这里收录了全部 {{ randomIntroCount }} 句开场语和 {{ randomTopicCount }} 个话题，分 {{ randomBundles.length }} 组列出；它们之间没有剧情先后。</p>
        <ul>
          <li>点话题右侧的 <Play :size="12" fill="currentColor" aria-hidden="true" />：只看这一个话题。</li>
          <li>点组名右侧的 <Play :size="12" fill="currentColor" aria-hidden="true" />：把这一组按脚本顺序连着看。游戏里不会这样连续出现。</li>
        </ul>
      </aside>

      <details v-if="mode !== 'random'" class="unlock-explainer">
        <summary>原游戏开放条件</summary>
        <p>仅记录原游戏中的开放条件，不影响资料馆内已收录内容的浏览与播放。</p>
      </details>
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
            <div class="unlock-list">
              <template v-for="unlock in bundle.unlocks" :key="unlock.id">
                <button v-if="isRelatedUnlock(unlock)" class="related" type="button" :title="unlockTitle(unlock)" @click="openUnlock(unlock)">
                  <CreditCard v-if="unlock.kind.startsWith('card_')" :size="13" aria-hidden="true" />
                  <BookOpen v-else :size="13" aria-hidden="true" />
                  <span>{{ unlockText(unlock) }}</span>
                </button>
                <span v-else class="unlock-condition" :title="unlockTitle(unlock)"><Unlock :size="13" aria-hidden="true" /><span>{{ unlockText(unlock) }}</span></span>
              </template>
            </div>
            <h4 v-if="callTitle(bundle)" class="call-title">{{ callTitle(bundle) }}</h4>
            <component :is="callTitle(bundle) ? 'p' : 'h4'" :class="{ 'call-line': callTitle(bundle) }"><template v-for="(part, index) in projectCommunicationInlineContent(bundle.title)" :key="`${part.type}:${index}`"><span v-if="part.type === 'text'">{{ part.text }}</span><img v-else class="inline-emoji" :src="getEmojiUrl(part.id)" :alt="part.alt" /></template></component>
            <p v-if="bundle.guests?.length" class="call-guests"><span class="call-guest-faces" aria-hidden="true"><ArchiveIdolAvatar v-for="code in bundle.guests" :key="code" :idol-code="code" :size="22" :ring-width="0" :gap="0" decorative /></span>{{ guestNames(bundle) }} 也在通话中</p>
          </div>
          <div v-if="!bundle.exists" class="conversation-meta"><span>暂未收录</span></div>
          <button class="conversation-play" :disabled="!bundle.exists" :title="bundle.exists ? '播放通信' : '本地脚本缺失'" @click="emit('play', bundle.file)">
            <Play v-if="bundle.exists" :size="17" fill="currentColor" />
            <FileWarning v-else :size="17" />
          </button>
        </article>
      </div>

      <div v-else class="random-list">
        <article v-for="bundle in randomBundles" :key="bundle.id" class="random-bundle">
          <header>
            <div><small>话题组 · {{ bundle.topics.length }} 个话题</small><h4><template v-for="(part, index) in projectCommunicationInlineContent(bundle.title)" :key="`${part.type}:${index}`"><span v-if="part.type === 'text'">{{ part.text }}</span><img v-else class="inline-emoji" :src="getEmojiUrl(part.id)" :alt="part.alt" /></template></h4></div>
            <button :disabled="!bundle.exists" aria-label="按脚本顺序连着看这一组" title="按脚本顺序连着看这一组" @click="emit('play', bundle.file)"><Play :size="17" fill="currentColor" /></button>
          </header>
          <div class="topic-grid">
            <button
              v-for="(topic, index) in bundle.topics"
              :key="topic.id"
              :disabled="!topic.presentation"
              :title="topic.presentation ? '只看这一个话题' : '这个话题的起止位置未能确定，暂时无法单独播放'"
              @click="playRandomTopic(bundle, topic)"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="topic-copy">
                <strong>{{ topic.presentation?.title || `话题 ${index + 1}` }}</strong>
                <small>{{ timeWindow(topic) }} · 再登场间隔 {{ topic.interval_day }} 天</small>
              </span>
              <Play v-if="topic.presentation" :size="15" fill="currentColor" />
              <FileWarning v-else :size="15" />
            </button>
          </div>
        </article>
      </div>

      <p v-if="!contentCount" class="empty-state">当前分类没有可展示记录。</p>
      <ArchiveTechnicalDetails :key="`${mode}:${selectedIdol}:${selectedUnit}`" :evidence="{ bundles, randomBundles: mode === 'random' ? randomBundles : [], sourceTables: mode === 'random' ? [104, 105] : undefined, randomIntros: mode === 'random' ? idolData?.view?.randomIntros || [] : [], sourceEvidence: mode === 'unit' ? unitData?.view?.sourceEvidence : idolData?.view?.sourceEvidence }" />
    </main>
    </div>
    </div>
  </article>
</template>

<script setup>
import { chapterLabel } from '../../presentation/chapterLabel.js'
import { computed } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import {archiveCardFullTitle} from './useArchiveCardTitle.js'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import { BookOpen, ChevronLeft, ChevronRight, CreditCard, FileWarning, MessageSquareText, Phone, Play, Shuffle, Unlock, Users } from '@lucide/vue'
import { communicationUnlockAction } from '../../presentation/communicationUnlock.js'
import { formatArchiveDate } from '../../data/idolCommunicationSelectors.js'
import { getEmojiUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { normalizeIdolAccentColor } from '../../presentation/idolAccentColor.js'
import { projectCommunicationInlineContent } from '../../presentation/communicationInlineContent.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { resolveMobileHeroMedia } from '../../presentation/mobileHeroMedia.js'

const props = defineProps({
  idolData: { type: Object, default: null },
  unitData: { type: Object, default: null },
  idols: { type: Array, default: () => [] },
  units: { type: Array, default: () => [] },
  selectedIdol: { type: String, default: '' },
  selectedUnit: { type: String, default: '' },
  mode: { type: String, default: 'personal' },
  focusedScenarioId: { type: [String, Number], default: '' },
})
const emit = defineEmits(['select-idol', 'select-unit', 'update:mode', 'play', 'play-random-topic', 'open-card', 'open-idol-story'])

const tabs = [
  { id: 'personal', label: '个人聊天', icon: MessageSquareText },
  { id: 'phone', label: '电话通信', icon: Phone },
  { id: 'unit', label: '组合聊天', icon: Users },
  { id: 'random', label: '随机话题池', icon: Shuffle },
]
const activeTab = computed(() => tabs.find(tab => tab.id === props.mode) || tabs[0])
// A tab with nothing in it is left out, unless it is the one being shown.
const visibleTabs = computed(() => tabs.filter(tab => tab.id === props.mode || tabCount(tab.id)))
const cardById = computed(() => new Map((props.mode === 'unit' ? props.unitData : props.idolData)?.view?.cardRefs?.map(card => [Number(card.card_id), card]) || []))
const storyByEpisodeId = computed(() => new Map(((props.mode === 'unit' ? props.unitData : props.idolData)?.view?.episodeRefs || [])
  .map(story => [Number(story.id), story])))
const bundles = computed(() => props.mode === 'unit' ? props.unitData?.view?.unitBundles || []
  : props.mode === 'phone' ? props.idolData?.view?.phoneBundles || [] : props.idolData?.view?.personalBundles || [])
const randomBundles = computed(() => props.idolData?.view?.randomBundles || [])
const contentCount = computed(() => props.mode === 'random' ? randomBundles.value.length : bundles.value.length)
const randomTopicCount = computed(() => randomBundles.value.reduce((sum, bundle) => sum + bundle.topics.length, 0))
const randomIntroCount = computed(() => props.idolData?.view?.randomIntros?.length || 0)
const contentSummary = computed(() => props.mode === 'random'
  ? `${randomTopicCount.value} 个话题 · ${contentCount.value} 组`
  : props.mode === 'phone' ? phoneSummary.value : `${contentCount.value} 条记录`)
// The phone tab's footprint: calls, the cards that open them, and calls with others on the line.
const phoneSummary = computed(() => {
  const cards = new Set(bundles.value.flatMap(bundle => bundle.cardIds || [])).size
  const shared = bundles.value.filter(bundle => bundle.guests?.length).length
  return [`${contentCount.value} 通电话`, cards && `来自 ${cards} 张卡片`, shared && `${shared} 通有其他人在场`].filter(Boolean).join(' · ')
})
function guestNames(bundle) {
  return bundle.guests.map(code => props.idols.find(entry => entry.idol_code === code)?.display_name || code).join('、')
}
const idol = computed(() => props.idols.find(entry => entry.idol_code === props.selectedIdol) || {})
const unit = computed(() => props.units.find(entry => entry.unit_code === props.selectedUnit) || {})
const idolName = computed(() => idol.value.display_name || '姓名待确认')
const unitName = computed(() => unit.value.unit_name || '组合待确认')
const idolFrameColor = computed(() => normalizeIdolAccentColor(idol.value.color))
const accentColor = computed(() => (props.mode === 'unit'
  ? normalizeIdolAccentColor(unit.value.unit_color)
  : idolFrameColor.value) || '#168f87')
const personalRoom = computed(() => props.idolData?.view?.room)
const roomSubtitle = computed(() => props.mode === 'unit' ? '组合聊天室' : (personalRoom.value?.profile_text || ''))
const roomSubtitleParts = computed(() => projectCommunicationInlineContent(roomSubtitle.value))
const heroMedia = computed(() => resolveMobileHeroMedia({ mode: props.mode, idolCode: props.selectedIdol, unitCode: props.selectedUnit }))
const selectionOptions = computed(() => props.mode === 'unit'
  ? props.units.map(entry => ({ value: entry.unit_code, label: entry.unit_name }))
  : props.idols.map(entry => ({ value: entry.idol_code, label: entry.display_name })))

function tabCount(mode) {
  if (mode === 'random') return randomTopicCount.value
  const source = mode === 'unit' ? props.unitData?.view?.unitBundles
    : mode === 'phone' ? props.idolData?.view?.phoneBundles : props.idolData?.view?.personalBundles
  return (source || []).reduce((sum, bundle) => sum + bundle.scenarios.length, 0)
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
  return communicationUnlockAction(unlock.condition)
}
function unlockText(unlock) {
  const card = unlockCard(unlock)
  if (card) return `${archiveCardFullTitle(card) || '卡名待确认'} ${unlockAction(unlock)}`
  const story = storyByEpisodeId.value.get(Number(unlock.condition?.param_a || 0))
  if (story) return `「${story.scenarioTitle}」${presentIdolEpisodeLabel({ sourceName: story.episodeName })} 完成`
  if (unlock.kind.startsWith('card_')) return '关联卡片待确认'
  if (unlock.kind === 'idol_story_episode_finished') return '个人故事章节待确认'
  return ['scenario_title_mission', 'term_or_default_release'].includes(unlock.kind) ? unlock.text : '开放条件待确认'
}
function unlockTitle(unlock) {
  const card = unlockCard(unlock)
  if (card) return `卡片 · ${archiveCardFullTitle(card)} · ${unlockAction(unlock)} · 点击查看卡片资料`
  const story = storyByEpisodeId.value.get(Number(unlock.condition?.param_a || 0))
  if (story) return `个人故事 · ${chapterLabel(story.sectionName)}「${story.scenarioTitle}」${presentIdolEpisodeLabel({ sourceName: story.episodeName })} · 点击查看个人故事`
  if (unlock.kind.startsWith('card_')) return '关联卡片待确认'
  if (unlock.kind === 'idol_story_episode_finished') return '个人故事章节待确认'
  return ['scenario_title_mission', 'term_or_default_release'].includes(unlock.kind) ? unlock.text : '开放条件待确认'
}
// Only calls carry a real title; a chat's scenario title is an internal label or the mission
// that opens it, so chats keep their first line as the heading.
function callTitle(bundle) {
  return bundle.kind === 'idol_phone' ? bundle.scenarios[0]?.title || '' : ''
}
function kindLabel(kind) { return kind === 'unit_talk' ? '组合聊天' : kind === 'idol_phone' ? '电话' : '偶像聊天' }
function playRandomTopic(bundle, topic) {
  if (!topic.presentation) return
  emit('play-random-topic', {
    file: bundle.file,
    startStep: topic.presentation.start_step,
    endStep: topic.presentation.end_step,
  })
}
function formatDate(value) { return formatArchiveDate(value) }
function unitLogo(code) { return getUnitLogoUrl(code) }
function timeWindow(topic) {
  const start = topic.open_time || '00:00'
  const end = topic.close_time || '00:00'
  if (start === '0:00:00' && end === '00:00:00') return '全天'
  const compact = value => value.replace(/^0(?=\d:)/, '').replace(/:00$/, '')
  return `${compact(start)}–${end === '00:00:00' ? '24:00' : compact(end)}`
}
</script>

<style scoped>
/* Communication: the room's call card beside its content on wide screens, above it on narrow ones.
   The card follows the game's call screen: room picture, owner at the centre, picker on the
   pale band the picture leaves for text. Tabs and rows stay on paper with hairlines. */
.mobile-archive { container: mobile-archive / inline-size; height: 100%; overflow-x: hidden; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); }
.mobile-layout { box-sizing: border-box; max-width: var(--gs-content-width); margin: 0 auto; }
.mobile-main { min-width: 0; }
.mobile-hero { position: relative; isolation: isolate; overflow: hidden; height: 300px; background: var(--gs-line); }
.mobile-hero.is-unit { background: var(--gs-chrome); color: var(--gs-chrome-ink-active); }
.call-card-art { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; object-fit: cover; object-position: center top; }
.mobile-identity { position: absolute; top: var(--gs-space-6); left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: var(--gs-space-3); padding: 0 var(--gs-space-5); }
.mobile-identity > img.unit-logo { width: 132px; height: 88px; border-radius: var(--gs-radius-media); background: var(--gs-surface); object-fit: contain; }
.mobile-identity h2 { max-width: 100%; margin: 0; padding: var(--gs-space-1) var(--gs-space-5); border-radius: var(--gs-radius-pill); background: var(--gs-action-bg); color: var(--gs-action-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); line-height: 1.6; overflow-wrap: anywhere; text-align: center; }
.call-card-lower { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: var(--gs-space-3); padding: var(--gs-space-7) var(--gs-space-5) var(--gs-space-4); background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--gs-paper) 82%, transparent) 55%); }
.is-unit .call-card-lower { background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--gs-chrome) 82%, transparent) 55%); }
/* The room's status line: ordinary text with the game's emoji inline, at most three authored lines.
   Three lines are always reserved and the text sits on their bottom, so the picker below never
   moves when switching between a one-line and a three-line status. */
.call-card-note { --note-line: 1.65; display: flex; flex-direction: column; justify-content: flex-end; height: calc(3em * var(--note-line)); margin: 0; overflow: hidden; color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: var(--note-line); }
.call-card-note-text { display: block; white-space: pre-line; overflow-wrap: anywhere; }
.call-card-note-text img { display: inline-block; width: 1.35em; height: 1.35em; margin-inline: .1em; vertical-align: -.32em; object-fit: contain; }
.is-unit .call-card-note { color: var(--gs-chrome-ink); }
.mobile-selector { display: grid; grid-template-columns: var(--gs-control-touch) minmax(0, 1fr) var(--gs-control-touch); align-items: center; gap: var(--gs-space-2); min-width: 0; }
.mobile-selector > button { display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: color-mix(in srgb, var(--gs-surface) 72%, transparent); color: var(--gs-ink-2); cursor: pointer; }
.mobile-selector label { min-width: 0; }
.mobile-selector label span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.mobile-selector select { width: 100%; min-width: 0; min-height: var(--gs-control-normal); padding: 0 30px 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-field); background: color-mix(in srgb, var(--gs-surface) 90%, transparent); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
/* Wide: the card sits beside the content and stays in view while the rows scroll. */
@container mobile-archive (min-width: 900px) {
  .mobile-layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); align-items: start; gap: var(--gs-space-8); padding: var(--gs-space-6) var(--gs-space-7) 0; }
  .mobile-hero { position: sticky; top: var(--gs-space-6); height: auto; aspect-ratio: 688 / 1000; border-radius: var(--gs-radius-panel); }
  .mobile-identity { top: 13%; }
  /* The picture's own pale band carries the text here, so no fade is needed. */
  .call-card-lower, .is-unit .call-card-lower { top: 56%; justify-content: center; padding-top: var(--gs-space-4); background: none; }
  .mobile-main .mobile-tabs { padding-inline: 0; }
  .mobile-main .mobile-content { padding-inline: 0; }
}
.mobile-tabs { position: sticky; top: 0; z-index: 3; display: flex; gap: var(--gs-space-1); overflow-x: auto; box-sizing: border-box; max-width: var(--gs-content-width); margin: 0 auto; padding: 0 var(--gs-space-7); border-bottom: 1px solid var(--gs-line); background: var(--gs-paper); overscroll-behavior-x: contain; scrollbar-width: none; }
.mobile-tabs::-webkit-scrollbar { display: none; }
.mobile-tabs button { display: inline-flex; flex: 0 0 auto; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 0; border-bottom: 2px solid transparent; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; white-space: nowrap; }
.mobile-tabs button.active { border-color: var(--gs-selected-line); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.mobile-tabs small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-regular); }
.mobile-content { box-sizing: border-box; max-width: var(--gs-content-width); margin: 0 auto; padding: var(--gs-space-6) var(--gs-space-7) calc(var(--gs-space-8) + var(--gs-safe-bottom)); }
.content-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--gs-space-4); margin-bottom: var(--gs-space-3); }
.content-heading h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.content-heading > strong { flex: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.unlock-explainer { margin: 0 0 var(--gs-space-3); color: var(--gs-ink-2); }
.unlock-explainer summary { display: list-item; box-sizing: border-box; min-height: var(--gs-control-normal); padding: var(--gs-space-2) 0; color: var(--gs-ink-3); font-size: var(--gs-text-ui); cursor: pointer; }
.unlock-explainer p { margin: 0; padding: 0 0 var(--gs-space-3); font-size: var(--gs-text-ui); line-height: 1.7; }
.conversation-list, .random-list { border-top: 1px solid var(--gs-rule); }
.conversation-row { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto var(--gs-control-touch); align-items: start; gap: var(--gs-space-4); padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.conversation-row.focused { background: var(--gs-mint-wash); box-shadow: inset 2px 0 var(--gs-mint); }
.conversation-type { display: grid; place-items: center; padding-top: 2px; color: var(--gs-ink-3); }
.conversation-copy { display: grid; gap: var(--gs-space-2); min-width: 0; }
.conversation-copy > small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.5; }
.conversation-copy h4 { margin: 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); line-height: 1.7; overflow-wrap: anywhere; }
.conversation-copy h4.call-title { font-family: var(--gs-font-jp); font-weight: var(--gs-weight-semibold); line-height: 1.5; }
.conversation-copy .call-line { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.6; overflow-wrap: anywhere; }
.conversation-copy .call-line .inline-emoji,
.conversation-copy h4 .inline-emoji, .random-bundle h4 .inline-emoji { display: inline-block; width: 1.5em; height: 1.5em; margin-inline: 2px; vertical-align: -.3em; object-fit: contain; }
/* Opening conditions are a line of quiet text; only ones that lead somewhere are links. */
.unlock-list { display: flex; flex-wrap: wrap; gap: var(--gs-space-1) var(--gs-space-4); min-width: 0; }
.unlock-list:empty { display: none; }
/* Others on the line: named beside their faces; the call stays its owner's. */
.call-guests { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2); margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.6; }
.call-guest-faces { display: inline-flex; }
.call-guest-faces > * + * { margin-left: -6px; }
.unlock-list button, .unlock-condition { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-width: 0; max-width: 100%; padding: 0; border: 0; background: none; font: inherit; font-size: var(--gs-text-meta); line-height: 1.6; text-align: left; }
.unlock-list button { min-height: var(--gs-control-compact); color: var(--gs-mint-ink); cursor: pointer; }
.unlock-condition { color: var(--gs-ink-3); }
.unlock-list svg { flex: none; }
.unlock-list button span, .unlock-condition span { min-width: 0; overflow-wrap: anywhere; }
.conversation-meta { color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.conversation-play, .random-bundle header button { display: grid; flex: none; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); cursor: pointer; }
.conversation-play:hover:not(:disabled), .random-bundle header button:hover:not(:disabled) { color: var(--gs-mint-ink); }
.conversation-play:disabled, .random-bundle header button:disabled { opacity: .35; cursor: default; }
.random-explainer { margin: 0 0 var(--gs-space-5); padding-left: var(--gs-space-4); border-left: 2px solid var(--gs-mint); }
.random-explainer strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.random-explainer p { margin: var(--gs-space-2) 0 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.7; }
.random-explainer ul { margin: var(--gs-space-2) 0 0; padding-left: 1.2em; color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.7; }
.random-explainer li svg { vertical-align: -1px; color: var(--gs-mint-ink); }
.random-bundle { border-bottom: 1px solid var(--gs-line); }
.random-bundle > header { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); padding: var(--gs-space-4) 0; }
.random-bundle header > div { min-width: 0; }
.random-bundle header small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.random-bundle h4 { margin: var(--gs-space-1) 0 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); line-height: 1.6; overflow-wrap: anywhere; }
.topic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--gs-space-7); padding-bottom: var(--gs-space-3); }
.topic-grid > button { display: grid; grid-template-columns: 28px minmax(0, 1fr) 18px; align-items: center; gap: var(--gs-space-3); min-height: 56px; padding: var(--gs-space-3) 0; border: 0; border-top: 1px solid var(--gs-line); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.topic-grid > button:hover:not(:disabled) strong { color: var(--gs-mint-ink); }
.topic-grid > button:disabled { color: var(--gs-ink-3); cursor: default; }
.topic-grid > button > span:first-child { align-self: start; color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-ui); font-variant-numeric: tabular-nums; }
.topic-copy { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.topic-grid strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.5; overflow-wrap: anywhere; }
.topic-grid small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.5; }
.topic-grid > button > svg { color: var(--gs-ink-3); }
.empty-state { padding: var(--gs-space-8) 0; color: var(--gs-ink-3); text-align: center; }
.mobile-archive :is(button, select, summary):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.mobile-tabs button:focus-visible { outline-offset: calc(-1 * var(--gs-focus-ring)); }
@container mobile-archive (max-width: 640px) {
  .topic-grid { grid-template-columns: 1fr; }
  .conversation-row { grid-template-columns: 20px minmax(0, 1fr) var(--gs-control-touch); }
  .conversation-meta { grid-column: 2; }
}
@container mobile-archive (max-width: 560px) {
  .mobile-hero { height: 280px; }
  .mobile-identity { top: var(--gs-space-5); }
  .mobile-selector select { min-height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .mobile-tabs { padding: 0 var(--gs-space-3); }
  .mobile-content { padding: var(--gs-space-5) var(--gs-space-5) calc(var(--gs-space-7) + var(--gs-safe-bottom)); }
  .unlock-list button { min-height: var(--gs-control-touch); }
}
</style>
