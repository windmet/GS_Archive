<template>
  <section ref="songScrollContainer" class="song-detail" data-archive-scroll-container>
    <div class="song-detail-layout">
    <header class="song-detail-hero" :class="{ 'has-jacket': song.jacketUrl }">
      <div v-if="song.jacketUrl" class="song-detail-ambient" aria-hidden="true" :style="{ backgroundImage: `url(${song.jacketUrl})` }"></div>
      <img v-if="song.jacketUrl" class="song-detail-jacket" :src="song.jacketUrl" :alt="`${song.title} 封面`" />
      <div class="song-detail-title">
        <div class="song-detail-heading">
          <h2>{{ song.title }}</h2>
          <p v-if="song.kana" class="song-detail-kana">{{ song.kana }}</p>
        </div>
        <p class="song-detail-scope">演唱 · {{ song.unit?.displayName || song.scopeLabel }}</p>
        <ul v-if="song.credits.length" class="song-detail-credits" aria-label="歌曲制作信息"><li v-for="line in song.credits" :key="line">{{ line }}</li></ul>
      </div>
      <div class="song-detail-meta">
        <div class="song-detail-badges">
          <span class="badge badge-attribute" :data-song-attribute="song.attributeLabel">{{ song.attributeLabel }}</span>
          <span v-if="song.special" class="badge badge-special">特殊版本</span>
          <span class="badge badge-form">{{ song.formLabel }}</span>
        </div>
        <span class="song-detail-date">{{ implementationDateLabel }}</span>
      </div>
      <button v-if="song.parentId" class="song-parent-link" :data-archive-focus-id="`song-parent:${song.parentId}`" @click="emit('open-song', song.parentId)">返回歌曲作品</button>
    </header>
    <div class="song-detail-body">
      <div ref="songListenColumn" class="song-listen-column" :class="{ 'is-sticky-fit': listeningColumnFits }">
      <ArchiveSongExperimentalPlayer v-if="song.playback.experiment" ref="songPlayer" :song="song" :audio-experiment="song.playback.experiment" :idol-directory="idolDirectory" :idol-name="idolName" :idol-search="idolSearch" @open-stage="openStage" />
      <ArchiveSongSinglePlayer v-else-if="song.playback.track" ref="songPlayer" :song="song" :track="song.playback.track" />
      <p v-else class="song-block-note song-playback-unavailable" role="status">{{ song.playbackLabel || '暂未提供试听' }}</p>
      <button v-if="song.stageCandidate" class="stage-open-button" type="button" @click="openStage({ songCode: song.id, choreographyId: song.stageCandidate.id })">{{ song.stageCandidate.stageKind === 'special_single' ? '社长特别演出' : 'Chibi 舞台演出' }} →</button>
      </div>
      <div class="song-record-column">
      <section v-if="song.gameplay" class="song-block song-gameplay">
        <div class="song-block-heading"><h3>难度与解锁</h3></div>
        <p class="song-block-note">{{ releaseConditionLabel }}</p>
        <details class="song-history"><summary>实装与解锁历史</summary>
          <p class="song-block-note">首次实装：{{ song.gameplay.history.firstImplementedOn }} · <a :href="song.gameplay.history.sourceUrl" target="_blank" rel="noopener noreferrer">历史来源</a></p>
          <p class="song-block-note">{{ song.gameplay.history.historicalUnlock }}</p>
          <p v-if="song.gameplay.history.permanentOn" class="song-block-note">加入普通歌曲：{{ song.gameplay.history.permanentOn }}</p>
          <p v-else-if="song.gameplay.history.permanentDateStatus === 'pending'" class="song-block-note">加入普通歌曲日期待核实。</p>
          <p v-if="song.gameplay.wikiLevelStatus === 'resolved_song_page'" class="song-block-note">难度按本地主数据与单曲页核对。</p>
          <p v-else-if="song.gameplay.wikiLevelStatus === 'conflict_pending'" class="song-block-note">Wiki 与主数据难度不一致，暂按主数据展示；差异待核实。</p>
        </details>
        <table class="song-difficulties"><caption>谱面难度与最大 Combo</caption><thead><tr><th scope="col">难度</th><th scope="col">等级</th><th scope="col">最大 Combo</th></tr></thead><tbody><tr v-for="d in song.gameplay.difficulties" :key="d.id"><th scope="row">{{ d.label }}</th><td>{{ d.levelLabel }}</td><td>{{ d.maxCombo }}</td></tr></tbody></table>
        <button class="stage-open-button" type="button" :data-archive-focus-id="`song-chart:${song.id}`" @click="openChart">打开谱面预览 ↗</button>
      </section>
      <section class="song-block">
        <div class="song-block-heading"><h3>演唱者</h3></div>
        <div v-if="song.unit" class="song-subsection">
          <h4>演唱组合</h4>
          <ul class="chip-list"><li><button :disabled="!song.unit.actionable" :data-archive-focus-id="`song-unit:${song.unit.id}`" @click="emit('open-unit', song.unit.id)">{{ song.unit.displayName }}</button></li></ul>
        </div>
        <div v-else class="performance-scope-card"><strong>{{ song.scopeLabel }}</strong><p>{{ song.scopeDescription }}</p></div>
        <details v-if="song.performers.length > 5" class="song-subsection" :open="performersOpen" @toggle="performersOpen = $event.target.open"><summary>演唱成员（{{ song.performers.length }}）</summary><ul v-if="performersOpen" class="performer-list"><li v-for="entry in song.performers" :key="entry.id"><ArchiveIdolReference :reference="performerReference(entry.reference)" density="portrait" :data-archive-focus-id="performerFocusId(entry)" @open="emit('open-idol', $event)" /></li></ul></details>
        <div v-else-if="song.performers.length" class="song-subsection">
          <h4>演唱成员</h4><p v-if="song.performerNote && song.performerNote !== '按已确认的演唱组合列出成员。'" class="song-block-note">{{ song.performerNote }}</p>
          <ul class="performer-list"><li v-for="entry in song.performers" :key="entry.id"><ArchiveIdolReference :reference="performerReference(entry.reference)" density="portrait" :data-archive-focus-id="performerFocusId(entry)" @open="emit('open-idol', $event)" /></li></ul>
        </div>
      </section>
      <details class="song-block" :open="audioArchiveOpen" @toggle="audioArchiveOpen = $event.target.open">
        <summary>声部与音频归档</summary>
        <div v-if="audioArchiveOpen">
        <p class="song-block-note">完整混音：{{ song.fullMixCollected ? '已收录' : '未收录' }}。{{ song.playbackLabel.replace(' · 实验混音', '') }}。</p>
        <div v-for="group in song.audioGroups" :key="group.title" class="song-subsection">
          <h4>{{ group.title }}（{{ group.entries.length }}）</h4><p v-if="group.note" class="song-block-note">{{ group.note }}</p>
          <ul v-if="group.kind === 'unit'" class="chip-list"><li v-for="entry in group.entries" :key="entry.id"><button :disabled="!entry.actionable" :data-archive-focus-id="audioFocusId(group, entry)" @click="emit('open-unit', entry.id)">查看组合 · {{ entry.displayName }} <ChevronRight :size="14" aria-hidden="true" /></button></li></ul>
          <ul v-else class="audio-idol-list"><li v-for="entry in group.entries" :key="entry.id"><ArchiveIdolReference :reference="performerReference(entry.reference)" :show-image="false" :data-archive-focus-id="audioFocusId(group, entry)" @open="emit('open-idol', $event)" /></li></ul>
        </div>
        </div></details>
      <section v-if="song.variants.length" class="song-block">
        <div class="song-block-heading"><h3>关联演出版本</h3></div>
        <div class="variant-list"><button v-for="variant in song.variants" :key="variant.id" :data-archive-focus-id="`song-variant:${variant.id}`" @click="emit('open-song', variant.id)"><strong>{{ variant.title }}</strong><ChevronRight :size="16" /></button></div>
      </section>
      <section v-if="song.related.length" class="song-block">
        <div class="song-block-heading"><h3>关联档案</h3></div>
        <div class="variant-list"><button v-for="(entry, index) in song.related" :key="index" :data-archive-focus-id="`song-related:${song.id}:${index}`" @click="emit('open-related-story', entry.payload)"><strong>{{ entry.title }}</strong><ChevronRight :size="16" /></button></div>
      </section>
      <section v-if="song.movies.length" class="song-block">
        <div class="song-block-heading"><h3>影像资料</h3></div>
        <ul class="movie-list"><li v-for="movie in song.movies" :key="movie.id"><strong>{{ movie.title }}</strong><span>{{ movie.status }}</span></li></ul>
      </section>
      <section v-if="song.links.length" class="song-block">
        <div class="song-block-heading"><h3>专辑链接</h3></div>
        <ul class="link-list"><li v-for="link in song.links" :key="link"><a :href="link" target="_blank" rel="noopener noreferrer external">前往专辑页面 <ExternalLink :size="14" /></a></li></ul>
      </section>
      <section v-if="song.credits.length" class="song-block song-credit-section">
        <div class="song-block-heading"><h3>制作信息</h3></div>
        <ul class="credit-list"><li v-for="line in song.credits" :key="line">{{ line }}</li></ul>
      </section>
      <ArchiveTechnicalDetails :key="song.id" :evidence="song.technicalEvidence" />
      </div>
    </div>
    </div>
  </section>
</template>

<script setup>
import { ChevronRight, ExternalLink } from '@lucide/vue'
import { computed, ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import ArchiveSongExperimentalPlayer from './ArchiveSongExperimentalPlayer.vue'
import ArchiveSongSinglePlayer from './ArchiveSongSinglePlayer.vue'
const props = defineProps({ song: { type: Object, required: true }, idolDirectory: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' } })
const emit = defineEmits(['open-song', 'open-unit', 'open-idol', 'open-related-story', 'open-stage', 'open-chart', 'ready'])
const implementationDateLabel = computed(() => {
  const implementedOn = props.song.gameplay?.history?.firstImplementedOn
  if (implementedOn) return `${implementedOn} 实装`
  const fallback = props.song.openDate
  if (fallback === '初始收录') return fallback
  return !fallback || ['未收录', '特殊版本'].includes(fallback) ? '实装日期未收录' : `${fallback} 实装`
})
// The catalogue writes "当前主数据：已开放" for songs with no unlock step; readers just need to know that.
const releaseConditionLabel = computed(() => {
  const condition = props.song.gameplay?.releaseCondition
  return condition?.storySectionId ? condition.label : '无需解锁'
})
const songPlayer = ref(null)
const songScrollContainer = ref(null), songListenColumn = ref(null)
const listeningColumnFits = ref(false)
let listeningResizeObserver = null
const performersOpen = ref(false), audioArchiveOpen = ref(false)
let disposed = false, prepareRevision = 0
function updateListeningColumnFit() {
  if (disposed) return
  const container = songScrollContainer.value, column = songListenColumn.value
  if (!container || !column || typeof globalThis.getComputedStyle !== 'function') {
    listeningColumnFits.value = false
    return
  }
  // The wide-layout top remains resolved even while the column is in normal
  // flow. Use the viewport height, not the possibly huge archive scrollHeight.
  const top = Math.max(0, Number.parseFloat(globalThis.getComputedStyle(column).top) || 0)
  const bottom = Math.max(0, Number.parseFloat(globalThis.getComputedStyle(container).paddingBottom) || 0)
  const height = column.getBoundingClientRect().height
  listeningColumnFits.value = height > 0 && height + top + bottom <= container.clientHeight
}
function observeListeningColumnFit() {
  if (typeof globalThis.ResizeObserver !== 'function' ||
    !songScrollContainer.value || !songListenColumn.value) return
  listeningResizeObserver = new globalThis.ResizeObserver(updateListeningColumnFit)
  listeningResizeObserver.observe(songScrollContainer.value)
  listeningResizeObserver.observe(songListenColumn.value)
  updateListeningColumnFit()
}
function performerFocusId(entry) {
  return entry.reference?.actionable ? `song-performer:${props.song.id}:${entry.id}` : undefined
}
function audioFocusId(group, entry) {
  const actionable = group.kind === 'unit' ? entry.actionable : entry.reference?.actionable
  return actionable ? `song-audio:${props.song.id}:${encodeURIComponent(group.title)}:${group.kind}:${entry.id}` : undefined
}
// Expand only the disclosure that owns this saved target, before shared DOM restoration.
async function prepareRestoreFocus({ focusId, songId, isCurrent = () => true }) {
  if (disposed || songId !== props.song.id || !isCurrent()) return false
  const revision = ++prepareRevision
  const performer = focusId && props.song.performers.some(entry => performerFocusId(entry) === focusId)
  const audio = focusId && props.song.audioGroups.some(group => group.entries.some(entry => audioFocusId(group, entry) === focusId))
  if (!performer && !audio) return false
  if (performer && props.song.performers.length > 5) performersOpen.value = true
  if (audio) audioArchiveOpen.value = true
  await nextTick()
  return !disposed && revision === prepareRevision && songId === props.song.id && isCurrent()
}
function announceReady() {
  const songId = props.song.id
  nextTick(() => { if (!disposed && props.song.id === songId) emit('ready', { songId }) })
}
onMounted(() => { announceReady(); observeListeningColumnFit() })
watch(() => props.song.id, () => {
  prepareRevision += 1
  performersOpen.value = false
  audioArchiveOpen.value = false
  announceReady()
})
onBeforeUnmount(() => {
  disposed = true
  prepareRevision += 1
  listeningResizeObserver?.disconnect()
  listeningResizeObserver = null
})
defineExpose({ prepareRestoreFocus })
function performerReference(reference) {
  return reference?.actionable && reference.idolCode
    ? { ...reference, displayName: props.idolName(reference.idolCode, reference.displayName) || reference.displayName }
    : reference
}
function openStage(target) { songPlayer.value?.pause(); emit('open-stage', target) }
function openChart() { songPlayer.value?.pause(); emit('open-chart') }
</script>

<style scoped>
/* Song detail: jacket and title on paper, the listening panel floats beside flat record sections. */
.song-detail { height: 100%; padding: var(--gs-space-8); overflow-y: auto; container: song-detail / inline-size; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); }
.song-detail-layout { max-width: var(--gs-content-width); margin: 0 auto; }
.song-detail-hero { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: var(--gs-space-4) var(--gs-space-7); }
.song-detail-hero.has-jacket { grid-template-columns: 96px minmax(0, 1fr); }
.song-detail-ambient { display: none; }
.song-detail-jacket { display: block; width: 96px; height: auto; aspect-ratio: 1; border-radius: var(--gs-radius-media); object-fit: cover; }
.song-detail-title { display: flex; flex-direction: column; gap: var(--gs-space-4); min-width: 0; }
.song-detail-title h2 { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.25; overflow-wrap: anywhere; text-wrap: balance; }
.song-detail-kana { margin: var(--gs-space-2) 0 0; color: var(--gs-ink-3); font-family: var(--gs-font-jp); font-size: var(--gs-text-ui); overflow-wrap: anywhere; }
.song-detail-scope { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); }
.song-detail-credits { display: flex; flex-wrap: wrap; gap: var(--gs-space-1) var(--gs-space-6); margin: 0; padding: 0; list-style: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.song-detail-meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2) var(--gs-space-6); padding: var(--gs-space-4) 0; border-top: 1px solid var(--gs-line); border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.song-detail-badges { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-5); min-width: 0; }
.badge { color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); }
.badge-attribute { display: inline-flex; align-items: center; gap: var(--gs-space-2); font-weight: var(--gs-weight-semibold); }
.badge-attribute::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.badge-attribute[data-song-attribute="Physical"] { color: var(--gs-attr-physical); }
.badge-attribute[data-song-attribute="Intelli"] { color: var(--gs-attr-intelli); }
.badge-attribute[data-song-attribute="Mental"] { color: var(--gs-attr-mental); }
.song-detail-date { margin-left: auto; color: var(--gs-ink-3); font-size: var(--gs-text-ui); white-space: nowrap; font-variant-numeric: tabular-nums; }
.song-parent-link { grid-column: 1 / -1; justify-self: start; display: inline-flex; align-items: center; min-height: var(--gs-control-compact); padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.song-parent-link:hover { text-decoration: underline; }

.song-detail-body { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: var(--gs-space-8); padding-top: var(--gs-space-8); }
/* The listening panel is the one floating surface: it carries playback state. */
.song-listen-column { min-width: 0; font-size: var(--gs-text-subtitle); }
/* The audition sits on the paper like every other section; no floating card. */
.song-record-column { display: grid; gap: var(--gs-space-section); min-width: 0; }
.song-block { min-width: 0; }
.song-block-heading h3, .song-block > summary { margin: 0; padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-ink); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.song-block-note { margin: var(--gs-space-4) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-body); line-height: 1.7; }
.song-subsection { margin-top: var(--gs-space-6); }
.song-subsection h4, .song-subsection > summary { margin: 0 0 var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
summary { display: flex; align-items: center; min-height: var(--gs-control-touch); color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
summary::after { content: '⌄'; margin-left: auto; color: var(--gs-ink-3); } details[open] > summary::after { content: '⌃'; }
.song-difficulties { width: 100%; margin-top: var(--gs-space-4); border-collapse: collapse; font-size: var(--gs-text-ui); font-variant-numeric: tabular-nums; }
.song-difficulties caption { margin-bottom: var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-align: left; }
.song-difficulties th, .song-difficulties td { padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); text-align: left; font-weight: var(--gs-weight-regular); }
.song-difficulties thead th { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.song-difficulties tbody th { font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); letter-spacing: .02em; }
.song-difficulties td { font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); }
.song-gameplay a, .song-history a { color: var(--gs-mint-ink); }
.song-history a { display: inline-flex; align-items: center; min-height: var(--gs-control-compact); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.stage-open-button { min-height: var(--gs-control-normal); margin-top: var(--gs-space-5); padding: 0 var(--gs-space-5); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-ink); color: var(--gs-paper); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.performance-scope-card { margin-top: var(--gs-space-4); padding-left: var(--gs-space-5); border-left: 2px solid var(--gs-mint); }
.performance-scope-card strong { font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.performance-scope-card p { margin: var(--gs-space-2) 0 0; color: var(--gs-ink-2); line-height: 1.7; }
.chip-list { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); margin: 0; padding: 0; list-style: none; }
.chip-list li { display: inline-flex; min-width: 0; }
.chip-list button { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.chip-list button:disabled { color: var(--gs-ink-3); cursor: default; }
.performer-list, .audio-idol-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: var(--gs-space-2) var(--gs-space-5); margin: var(--gs-space-3) 0 0; padding: 0; list-style: none; }
.audio-idol-list { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.performer-list li, .audio-idol-list li { min-width: 0; }
.song-record-column :deep(.archive-idol-reference) { border-color: transparent; background: none; }
.song-record-column :deep(.idol-reference-copy strong) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); white-space: normal; overflow-wrap: anywhere; }
.song-record-column :deep(.idol-reference-copy small) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.variant-list { display: grid; margin-top: var(--gs-space-2); }
.variant-list button { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); width: 100%; min-width: 0; min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.variant-list strong { min-width: 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.6; overflow-wrap: anywhere; }
.variant-list svg, .chip-list svg, .link-list svg { flex: none; color: var(--gs-ink-3); }
.movie-list, .link-list, .credit-list { display: grid; gap: var(--gs-space-3); margin: var(--gs-space-4) 0 0; padding: 0; list-style: none; }
.movie-list li { display: flex; align-items: baseline; gap: var(--gs-space-4); font-size: var(--gs-text-body); }
.movie-list strong { font-weight: var(--gs-weight-semibold); }
.movie-list span, .credit-list { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.credit-list { color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.7; }
.link-list a { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-compact); color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-decoration: none; }
@media (hover: hover) {
  .variant-list button:hover strong { color: var(--gs-mint-ink); }
  .chip-list button:hover:not(:disabled) { border-color: var(--gs-ink-3); }
  .link-list a:hover { text-decoration: underline; }
}
.song-detail button:focus-visible, .song-detail a:focus-visible, .song-detail summary:focus-visible,
.song-record-column :deep(button.archive-idol-reference:focus-visible) { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }

@container song-detail (min-width: 520px) {
  .song-detail-hero.has-jacket { grid-template-columns: 180px minmax(0, 1fr); }
  .song-detail-jacket { width: 180px; }
  .song-credit-section { display: none; }
}
@container song-detail (max-width: 519px) { .song-detail-credits { display: none; } }
@container song-detail (min-width: 900px) {
  .song-detail-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, .8fr); align-items: start; gap: var(--gs-space-8) var(--gs-space-9); }
  .song-detail-hero { grid-column: 1; grid-row: 1; }
  .song-detail-body { display: contents; }
  .song-record-column { grid-column: 1; grid-row: 2; }
  .song-listen-column { grid-column: 2; grid-row: 1 / 3; top: var(--gs-space-5); }
  .song-listen-column.is-sticky-fit { position: sticky; }
  .song-listen-column :deep(.performer-lineup) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .song-detail { padding: var(--gs-space-5); }
  .song-detail-title h2 { font-size: var(--gs-text-section); }
  .song-parent-link, .link-list a, .song-history a, .stage-open-button, .chip-list button { min-height: var(--gs-control-touch); }
}
</style>
