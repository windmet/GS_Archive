<template>
  <article
    v-if="idolData || unitData"
    class="mobile-archive"
    data-archive-scroll-container
    :data-focused-scenario-id="String(focusedScenarioId || '')"
    :style="{ '--mobile-accent': accentColor }"
  >
    <header class="mobile-hero" :class="{ 'is-unit': mode === 'unit' }" :style="heroMediaStyle">
      <div class="hero-media" aria-hidden="true">
        <img v-if="heroMedia.src" class="hero-media-blur" :src="heroMedia.src" alt="" />
        <img v-if="heroMedia.src && mode !== 'unit'" class="hero-media-main" :src="heroMedia.src" alt="" />
      </div>
      <div class="hero-shade"></div>
      <div class="hero-content">
        <div class="mobile-identity">
          <ArchiveIdolAvatar v-if="mode !== 'unit'" class="mobile-idol-avatar" :idol-code="selectedIdol" variant="mobile"
            :accent-color="idolFrameColor" :size="48" :ring-width="3" :alt="idolName" />
          <img v-else class="unit-logo" :src="unitLogo(selectedUnit)" :alt="unitName" />
          <div class="identity-copy">
            <h2>{{ mode === 'unit' ? unitName : idolName }}</h2>
            <p>
              <template v-for="(part, index) in roomSubtitleParts" :key="`${part.type}:${index}`">
                <span v-if="part.type === 'text'">{{ part.text }}</span>
                <img v-else :src="getEmojiUrl(part.id)" :alt="part.alt" />
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
          <h3>{{ activeTab.label }}</h3>
        </div>
        <strong>{{ contentSummary }}</strong>
      </div>

      <aside v-if="mode === 'random'" class="random-explainer">
        <Info :size="19" />
        <div>
          <strong>这是游戏的随机话题候选池，不是连续剧情或聊天记录</strong>
          <p>游戏会按时间与条件随机选择话题和开场语。这里按收录顺序预览，不代表玩家实际经历的聊天顺序。</p>
        </div>
        <dl>
          <div><dt>候选话题</dt><dd>{{ randomTopicCount }}</dd></div>
          <div><dt>开场语</dt><dd>{{ randomIntroCount }}</dd></div>
        </dl>
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
            <h4><template v-for="(part, index) in projectCommunicationInlineContent(bundle.title)" :key="`${part.type}:${index}`"><span v-if="part.type === 'text'">{{ part.text }}</span><img v-else class="inline-emoji" :src="getEmojiUrl(part.id)" :alt="part.alt" /></template></h4>
          </div>
          <div class="conversation-meta">
            <span>{{ bundle.exists ? '已收录' : '暂未收录' }}</span>
            <span>{{ bundle.scenarios.length }} 项解锁记录</span>
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
            <div><small>RANDOM TALK</small><h4><template v-for="(part, index) in projectCommunicationInlineContent(bundle.title)" :key="`${part.type}:${index}`"><span v-if="part.type === 'text'">{{ part.text }}</span><img v-else class="inline-emoji" :src="getEmojiUrl(part.id)" :alt="part.alt" /></template></h4></div>
            <button :disabled="!bundle.exists" title="按脚本顺序预览话题池" @click="emit('play', bundle.file)"><Play :size="17" fill="currentColor" /></button>
          </header>
          <div class="topic-grid">
            <button
              v-for="(topic, index) in bundle.topics"
              :key="topic.id"
              :disabled="!topic.presentation"
              :title="topic.presentation ? '预览此话题' : '未解析话题边界'"
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
  </article>
</template>

<script setup>
import { computed } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import {archiveCardFullTitle} from './useArchiveCardTitle.js'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import { BookOpen, ChevronLeft, ChevronRight, CreditCard, FileWarning, Info, MessageSquareText, Phone, Play, Shuffle, Unlock, Users } from '@lucide/vue'
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
  : `${contentCount.value} 条记录`)
const idol = computed(() => props.idols.find(entry => entry.idol_code === props.selectedIdol) || {})
const unit = computed(() => props.units.find(entry => entry.unit_code === props.selectedUnit) || {})
const idolName = computed(() => idol.value.display_name || '姓名待确认')
const unitName = computed(() => unit.value.unit_name || '组合待确认')
const idolFrameColor = computed(() => normalizeIdolAccentColor(idol.value.color))
const accentColor = computed(() => (props.mode === 'unit'
  ? normalizeIdolAccentColor(unit.value.unit_color)
  : idolFrameColor.value) || '#168f87')
const personalRoom = computed(() => props.idolData?.view?.room)
const roomSubtitle = computed(() => props.mode === 'unit' ? 'Unit Talk Room' : (personalRoom.value?.profile_text || 'Mobile Talk Room'))
const roomSubtitleParts = computed(() => projectCommunicationInlineContent(roomSubtitle.value))
const heroMedia = computed(() => resolveMobileHeroMedia({ mode: props.mode, idolCode: props.selectedIdol, unitCode: props.selectedUnit }))
const heroMediaStyle = computed(() => ({ '--hero-focal-x': `${heroMedia.value.focalX * 100}%`, '--hero-focal-y': `${heroMedia.value.focalY * 100}%` }))
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
  const condition = unlock.condition || {}
  if (condition.kind === 'card_acquired') return '获得'
  if (condition.kind === 'card_awakened') return '特训完成'
  if (condition.kind === 'card_limit_break') return `突破 ${condition.param_b || 4} 次`
  return '开放条件待确认'
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
  if (story) return `个人故事 · ${story.sectionName}「${story.scenarioTitle}」${presentIdolEpisodeLabel({ sourceName: story.episodeName })} · 点击查看个人故事`
  if (unlock.kind.startsWith('card_')) return '关联卡片待确认'
  if (unlock.kind === 'idol_story_episode_finished') return '个人故事章节待确认'
  return ['scenario_title_mission', 'term_or_default_release'].includes(unlock.kind) ? unlock.text : '开放条件待确认'
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
.mobile-archive {
  container: mobile-archive / inline-size;
  height: 100%; overflow-x: hidden; overflow-y: auto;
  background: #f4f6f7; color: #26343c;
  font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular);
}
.mobile-hero { position: relative; isolation: isolate; overflow: hidden; background-color: #26343c; }
.hero-media { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.hero-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: var(--hero-focal-x) var(--hero-focal-y); }
.hero-media-blur { filter: blur(16px) brightness(.58) saturate(.78); }
.hero-media-main { opacity: .78; -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.18) 24%, #000 52%, #000 100%); mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.18) 24%, #000 52%, #000 100%); }
.mobile-hero.is-unit .hero-media-blur { filter: brightness(.6) saturate(.82); }
.hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(20,31,36,.88), rgba(20,31,36,.48) 58%, rgba(20,31,36,.3)); pointer-events: none; }
.hero-content { position: relative; display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-5); box-sizing: border-box; padding: var(--gs-space-5) max(var(--gs-space-5), calc((100% - 1100px) / 2)); }
.mobile-identity, .mobile-selector { position: relative; z-index: 1; }
.mobile-identity { display: flex; flex: 1 1 0; align-items: center; gap: var(--gs-space-4); min-width: 0; color: #fff; }
.identity-copy { min-width: 0; }
.identity-eyebrow { color: #b9fff8; font-size: var(--gs-text-caption); font-weight: var(--gs-weight-bold); }
.mobile-identity > img.unit-logo { flex: 0 0 76px; width: 76px; height: 48px; border: 0; background: rgba(255,255,255,.9); object-fit: contain; }
.mobile-identity h2 { margin: var(--gs-space-2) 0; font-size: var(--gs-text-title); line-height: 1.35; overflow-wrap: anywhere; }
.mobile-identity p { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gs-space-1); margin: 0; color: rgba(255,255,255,.8); font-size: var(--gs-text-meta); line-height: 1.5; white-space: pre-line; overflow-wrap: anywhere; }
.mobile-identity p img { width: 20px; height: 20px; object-fit: contain; }
.mobile-idol-avatar { box-shadow: 0 0 0 1px rgba(255,255,255,.85); }
.mobile-selector { display: grid; grid-template-columns: 44px minmax(0,1fr) 44px; align-items: end; gap: var(--gs-space-3); flex: 0 1 320px; width: min(100%,320px); min-width: 0; }
.mobile-selector > button { display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); border: 1px solid rgba(255,255,255,.62); border-radius: var(--gs-radius-control); background: rgba(19,30,35,.5); color: #fff; cursor: pointer; }
.mobile-selector label { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.mobile-selector label span { color: rgba(255,255,255,.82); font-size: var(--gs-text-meta); }
.mobile-selector select { width: 100%; min-width: 0; min-height: var(--gs-control-touch); padding: 0 30px 0 10px; border: 1px solid rgba(255,255,255,.7); border-radius: var(--gs-radius-control); background: rgba(255,255,255,.94); color: #28363d; font: inherit; font-size: var(--gs-text-ui); }
.mobile-tabs { position: sticky; top: 0; z-index: 3; display: flex; justify-content: center; gap: var(--gs-space-1); min-width: 0; max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; border-bottom: 1px solid #dce3e5; background: rgba(255,255,255,.97); }
.mobile-tabs::-webkit-scrollbar { display: none; }
.mobile-tabs button { display: inline-grid; grid-template-columns: 18px auto auto; flex: 0 0 auto; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 0; border-bottom: 2px solid transparent; background: transparent; color: #718087; cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.mobile-tabs button.active { border-color: var(--mobile-accent); color: #26343c; }
.mobile-tabs small { display: grid; place-items: center; min-width: 24px; padding: var(--gs-space-1) var(--gs-space-2); border-radius: var(--gs-radius-pill); background: #edf1f2; color: #77858b; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); line-height: 1.3; }
.mobile-content { max-width: 1100px; margin: 0 auto; padding: var(--gs-space-5) var(--gs-space-5) calc(var(--gs-space-7) + var(--gs-safe-bottom)); }
.content-heading { display: flex; align-items: end; justify-content: space-between; gap: var(--gs-space-4); margin-bottom: var(--gs-space-4); }
.content-heading span { color: var(--mobile-accent); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-bold); }
.content-heading h3 { margin: var(--gs-space-1) 0 0; font-size: var(--gs-text-section); }
.content-heading > strong { flex: none; color: #7b888e; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.unlock-explainer { margin: 0 0 var(--gs-space-4); border-bottom: 1px solid #dbe2e4; color: #526b73; }
.unlock-explainer summary { display: list-item; min-height: var(--gs-control-touch); box-sizing: border-box; padding: var(--gs-space-4) 0; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.unlock-explainer p { margin: 0; padding: 0 0 var(--gs-space-4); font-size: var(--gs-text-body); line-height: 1.6; }
.conversation-list { border-top: 1px solid #dbe2e4; }
.conversation-row { display: grid; grid-template-columns: 32px minmax(0,1fr) auto 44px; align-items: center; gap: var(--gs-space-4); padding: var(--gs-space-4) 0; border-bottom: 1px solid #dbe2e4; background: #fff; }
.conversation-row.focused { box-shadow: inset 3px 0 var(--mobile-accent); background: #f2faf9; }
.conversation-row.missing { background: #f6f7f8; }
.conversation-type { display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--gs-radius-pill); background: color-mix(in srgb,var(--mobile-accent) 12%,#fff); color: var(--mobile-accent); }
.conversation-copy { display: grid; gap: var(--gs-space-2); min-width: 0; }
.conversation-copy > small { color: #60758a; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); line-height: 1.5; }
.conversation-copy h4 { margin: 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); line-height: 1.65; overflow-wrap: anywhere; }
.conversation-copy h4 .inline-emoji, .random-bundle h4 .inline-emoji { display: inline-block; width: 1.5em; height: 1.5em; margin-inline: 2px; vertical-align: -.3em; object-fit: contain; }
.unlock-list { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); min-width: 0; }
.unlock-list:empty { display: none; }
.unlock-list button { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-width: 0; max-width: 100%; min-height: var(--gs-control-normal); padding: var(--gs-space-2) var(--gs-space-3); border: 1px solid #dce4e6; border-radius: var(--gs-radius-control); background: #f7f9fa; color: #65747b; cursor: default; font: inherit; font-size: var(--gs-text-meta); line-height: 1.5; text-align: left; }
.unlock-list button.related { border-color: #bfe0dd; background: #eef8f7; color: #167e77; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.unlock-list button > svg { flex: none; }
.unlock-list button span { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
.conversation-meta { display: flex; flex-direction: column; align-items: end; gap: var(--gs-space-2); min-width: 0; color: #60758a; font-size: var(--gs-text-meta); line-height: 1.5; }
.conversation-play, .random-bundle header button { display: grid; place-items: center; flex: none; width: var(--gs-control-touch); height: var(--gs-control-touch); border: 1px solid var(--mobile-accent); border-radius: var(--gs-radius-pill); background: #fff; color: var(--mobile-accent); cursor: pointer; }
.conversation-play:disabled, .random-bundle header button:disabled { border-color: #ccd5d8; color: #8e999e; cursor: not-allowed; }
.random-explainer { display: grid; grid-template-columns: 24px minmax(0,1fr) auto; align-items: start; gap: var(--gs-space-4); margin-bottom: var(--gs-space-4); padding: var(--gs-space-4); border: 1px solid color-mix(in srgb,var(--mobile-accent) 28%,#dce3e5); border-radius: var(--gs-radius-control); background: #fff; color: var(--mobile-accent); }
.random-explainer > div { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.random-explainer strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.5; }
.random-explainer p { margin: 0; color: #68777e; font-size: var(--gs-text-body); line-height: 1.6; }
.random-explainer dl { display: grid; grid-template-columns: repeat(2,minmax(60px,auto)); margin: 0; border-left: 1px solid #e1e7e9; }
.random-explainer dl div { padding: var(--gs-space-2) var(--gs-space-3); text-align: center; }
.random-explainer dt { color: #708087; font-size: var(--gs-text-meta); }
.random-explainer dd { margin: var(--gs-space-2) 0 0; color: var(--mobile-accent); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-bold); }
.random-list { border-top: 1px solid #dbe2e4; }
.random-bundle { border-bottom: 1px solid #dbe2e4; background: #fff; }
.random-bundle > header { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); padding: var(--gs-space-4) 0; border-bottom: 1px solid #e4e9eb; }
.random-bundle header > div { min-width: 0; }
.random-bundle header small { color: #60758a; font-size: var(--gs-text-caption); font-weight: var(--gs-weight-regular); }
.random-bundle h4 { margin: var(--gs-space-2) 0 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); line-height: 1.6; overflow-wrap: anywhere; }
.topic-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px; background: #e1e6e8; }
.topic-grid > button { display: grid; grid-template-columns: 28px minmax(0,1fr) 18px; align-items: center; gap: var(--gs-space-3); min-height: 64px; padding: var(--gs-space-3) var(--gs-space-4); border: 0; background: #fff; color: #2b3a42; cursor: pointer; font: inherit; text-align: left; }
.topic-grid > button:hover:not(:disabled) { background: color-mix(in srgb,var(--mobile-accent) 7%,#fff); }
.topic-grid > button:disabled { color: #87949a; cursor: not-allowed; }
.topic-grid > button > span:first-child { align-self: start; color: var(--mobile-accent); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.topic-copy { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.topic-grid strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.5; overflow-wrap: anywhere; }
.topic-grid small { color: #708087; font-size: var(--gs-text-meta); line-height: 1.5; }
.topic-grid > button > svg { color: var(--mobile-accent); }
.empty-state { padding: var(--gs-space-8) 0; color: #7c898f; font-size: var(--gs-text-body); text-align: center; }
.mobile-archive button:focus-visible, .mobile-archive select:focus-visible, .mobile-archive summary:focus-visible { outline: var(--gs-focus-ring) solid #048a6d; outline-offset: var(--gs-focus-offset); }
.mobile-tabs button:focus-visible { outline-offset: calc(-1 * var(--gs-focus-offset)); }
@container mobile-archive (max-width:640px) {
  .mobile-tabs { justify-content: start; }
  .mobile-content { padding: var(--gs-space-4) var(--gs-space-4) calc(var(--gs-space-6) + var(--gs-safe-bottom)); }
  .mobile-selector select { font-size: var(--gs-text-subtitle); }
  .conversation-row { position: relative; grid-template-columns: minmax(0,1fr) 44px; column-gap: var(--gs-space-3); row-gap: var(--gs-space-2); }
  .conversation-type { position: absolute; top: var(--gs-space-4); left: 0; width: 20px; height: 20px; }
  .conversation-copy { grid-column: 1; grid-row: 1; }
  .conversation-copy > small { min-height: 20px; padding-left: 28px; }
  .conversation-meta { grid-column: 1; grid-row: 2; flex-direction: row; align-items: start; flex-wrap: wrap; gap: var(--gs-space-3); }
  .conversation-play { grid-column: 2; grid-row: 1 / span 2; }
  .unlock-list button { min-height: var(--gs-control-touch); }
  .random-explainer { grid-template-columns: 24px minmax(0,1fr); }
  .random-explainer dl { grid-column: 2; justify-self: start; border-left: 0; }
  .topic-grid { grid-template-columns: 1fr; }
}
@container mobile-archive (max-width:560px) {
  .hero-content { align-items: start; flex-direction: column; gap: var(--gs-space-4); padding: var(--gs-space-4); }
  .mobile-identity { flex: none; width: 100%; }
  .identity-eyebrow { display: none; }
  .mobile-selector { flex: none; width: 100%; }
}
@media (pointer:coarse) {
  .mobile-selector select { font-size: var(--gs-text-subtitle); }
  .unlock-list button { min-height: var(--gs-control-touch); }
}
</style>
