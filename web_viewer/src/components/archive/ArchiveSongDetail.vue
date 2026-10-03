<template>
  <section class="song-detail" data-archive-scroll-container>
    <header class="song-detail-hero" :class="{ 'has-jacket': song.jacketUrl }">
      <img v-if="song.jacketUrl" class="song-detail-jacket" :src="song.jacketUrl" :alt="`${song.title} 封面`" />
      <div class="song-detail-title">
        <h2>{{ song.title }}</h2>
        <p class="song-detail-meta"><span v-if="song.kana" class="song-detail-kana">{{ song.kana }}</span><span class="song-detail-date">{{ implementationDateLabel }}</span></p>
        <button v-if="song.parentId" class="song-parent-link" :data-archive-focus-id="`song-parent:${song.parentId}`" @click="emit('open-song', song.parentId)">返回歌曲作品</button>
      </div>
      <div class="song-detail-badges">
        <span class="badge badge-attribute" :data-song-attribute="song.attributeLabel">{{ song.attributeLabel === 'Intelli' ? 'Intelligent' : song.attributeLabel || '待确认' }}</span>
        <span v-if="song.special" class="badge badge-special">特殊版本</span>
        <span class="badge badge-form">{{ song.formLabel }}</span>
      </div>
    </header>
    <div class="song-detail-body">
      <div class="song-listen-column">
      <ArchiveSongExperimentalPlayer v-if="song.playback.experiment" ref="songPlayer" :song="song" :audio-experiment="song.playback.experiment" :idol-directory="idolDirectory" :idol-name="idolName" :idol-search="idolSearch" @open-stage="openStage" />
      <ArchiveSongSinglePlayer v-else-if="song.playback.track" ref="songPlayer" :song="song" :track="song.playback.track" />
      <p v-else class="song-block-note song-playback-unavailable" role="status">{{ song.playbackLabel || '暂未提供试听' }}</p>
      <button v-if="song.stageCandidate" class="stage-open-button" type="button" @click="openStage({ songCode: song.id, choreographyId: song.stageCandidate.id })">{{ song.stageCandidate.stageKind === 'special_single' ? '社长特别演出' : 'Chibi 舞台演出' }} →</button>
      </div>
      <div class="song-record-column">
      <section v-if="song.gameplay" class="song-block song-gameplay">
        <div class="song-block-heading"><h3>难度与解锁</h3></div>
        <p class="song-block-note">{{ song.gameplay.releaseCondition.label }}</p>
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
      <section v-if="song.credits.length" class="song-block">
        <div class="song-block-heading"><h3>制作信息</h3></div>
        <ul class="credit-list"><li v-for="line in song.credits" :key="line">{{ line }}</li></ul>
      </section>
      <ArchiveTechnicalDetails :key="song.id" :evidence="song.technicalEvidence" />
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
const songPlayer = ref(null)
const performersOpen = ref(false), audioArchiveOpen = ref(false)
let disposed = false, prepareRevision = 0
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
onMounted(announceReady)
watch(() => props.song.id, () => {
  prepareRevision += 1
  performersOpen.value = false
  audioArchiveOpen.value = false
  announceReady()
})
onBeforeUnmount(() => { disposed = true; prepareRevision += 1 })
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
.song-detail { height: 100%; padding: var(--gs-space-7); overflow-y: auto; background: #f7f9fa; font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
.song-detail-hero { display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; gap: var(--gs-space-4) var(--gs-space-7); padding: var(--gs-space-5) var(--gs-space-6); border-bottom: 3px solid #28b6ac; background: #17212b; color: #fff; }
.song-detail-hero.has-jacket { grid-template-columns: 172px minmax(0, 1fr); }
.song-detail-jacket { width: 172px; height: auto; border-radius: var(--gs-radius-field); display: block; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); }
.song-detail-title { min-width: 0; }
.song-detail-title h2 { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-semibold); line-height: 1.4; overflow-wrap: anywhere; }
.song-detail-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gs-space-2) var(--gs-space-3); margin: var(--gs-space-2) 0 0; color: #aeb9c2; font-size: var(--gs-text-meta); line-height: 1.6; overflow-wrap: anywhere; }
.song-detail-date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.song-parent-link { display: inline-flex; align-items: center; min-height: var(--gs-control-compact); margin-top: var(--gs-space-3); padding: var(--gs-space-2) 0; border: 0; background: transparent; color: #76d9d1; cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.song-parent-link:hover { text-decoration: underline; }
.song-detail-badges { grid-column: 1 / -1; display: flex; gap: var(--gs-space-2); flex-wrap: wrap; min-width: 0; }
.badge { padding: var(--gs-space-1) var(--gs-space-3); border-radius: var(--gs-radius-pill); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.badge-attribute { background: #e7ecef; color: #465863; }
.badge-attribute[data-song-attribute="Physical"] { background: #ffe9eb; color: #a83247; }
.badge-attribute[data-song-attribute="Intelli"] { background: #e8f0fe; color: #2f5fd0; }
.badge-attribute[data-song-attribute="Mental"] { background: #fff4d6; color: #805d14; }
.badge-attribute[data-song-attribute="ALL"] { background: #f0f3f5; color: #475863; }
.badge-form { background: #e2f4f0; color: #21685b; }
.badge-special { background: #f3e8fd; color: #7136a5; }
.song-detail-body { padding-top: var(--gs-space-6); display: grid; grid-template-columns: minmax(300px,.8fr) minmax(0,1.2fr); align-items: start; gap: var(--gs-space-6); }
/* The independently styled player keeps its existing inherited 16px base. */
.song-listen-column { position: sticky; top: 0; min-width: 0; font-size: var(--gs-text-subtitle); }
.song-record-column { display: grid; gap: var(--gs-space-5); min-width: 0; }
.song-block { padding: 16px 18px; border: 1px solid #dfe4e8; border-radius: var(--gs-radius-control); background: #fff; }
.song-record-column > .song-block { padding: var(--gs-space-5); }
.song-block-heading h3 { margin: var(--gs-space-2) 0 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.song-block-note { margin: var(--gs-space-3) 0 var(--gs-space-3); color: #7a858e; font-size: var(--gs-text-body); line-height: 1.6; }
.song-subsection { margin-top: var(--gs-space-5); }
.song-subsection h4 { margin: 0 0 var(--gs-space-3); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); color: #5c6771; }
summary { min-height: var(--gs-control-touch); display: flex; align-items: center; cursor: pointer; font-weight: var(--gs-weight-semibold); font-size: var(--gs-text-ui); color: #285969; }
.song-block > summary { font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.song-subsection > summary { font-size: var(--gs-text-subtitle); }
summary::after { content: '⌄'; margin-left: auto; } details[open] > summary::after { content: '⌃'; }
.song-difficulties { width: 100%; margin-top: var(--gs-space-4); border-collapse: collapse; font-size: var(--gs-text-body); }
.song-difficulties caption { text-align: left; font-size: var(--gs-text-meta); color: #617380; margin-bottom: var(--gs-space-3); }
.song-difficulties th, .song-difficulties td { text-align: left; padding: var(--gs-space-3); border-bottom: 1px solid #e0e9ed; }
.song-difficulties thead { background: #f1f7f8; }
.song-gameplay a { color: #137b75; }
.song-history a { display: inline-flex; align-items: center; min-height: var(--gs-control-compact); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.stage-open-button { min-height: var(--gs-control-touch); margin-top: var(--gs-space-4); padding: 0 var(--gs-space-5); border: 0; border-radius: var(--gs-radius-pill); background: #168f87; color: #fff; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.performance-scope-card { margin-top: var(--gs-space-4); padding: var(--gs-space-4); border-left: 3px solid #3aa89f; border-radius: var(--gs-radius-control); background: #eef8f7; }
.performance-scope-card strong { color: #246d67; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.performance-scope-card p { margin: var(--gs-space-2) 0 0; color: #526a68; font-size: var(--gs-text-body); line-height: 1.6; }
.chip-list { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); margin: 0; padding: 0; list-style: none; }
.chip-list li { display: inline-flex; min-width: 0; }
.chip-list button { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-touch); padding: var(--gs-space-2) var(--gs-space-3); border: 0; border-radius: var(--gs-radius-pill); background: #f0fbfa; color: #36636b; cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.chip-list button:hover:not(:disabled) { background: #dff5f2; }
.chip-list button:disabled { cursor: default; opacity: 0.78; }
.performer-list, .audio-idol-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: var(--gs-space-3); margin: var(--gs-space-3) 0 0; padding: 0; list-style: none; }
.audio-idol-list { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--gs-space-2); }
.performer-list li, .audio-idol-list li { min-width: 0; }
/* Shared identity cards opt into song-record roles without changing other domains. */
.song-record-column :deep(.idol-reference-copy strong) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); white-space: normal; overflow-wrap: anywhere; }
.song-record-column :deep(.idol-reference-copy small) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.song-record-column :deep(.archive-technical) { font-family: var(--gs-font-directory); }
.song-record-column :deep(.archive-technical > summary) { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.song-record-column :deep(.archive-technical-body) { font-size: var(--gs-text-meta); }
.song-record-column :deep(.archive-technical pre) { font-size: var(--gs-text-caption); }
.variant-list { display: grid; gap: var(--gs-space-3); margin-top: var(--gs-space-4); }
.variant-list button { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); width: 100%; min-width: 0; min-height: 52px; padding: var(--gs-space-3) var(--gs-space-4); border: 1px solid #dfe4e8; border-radius: var(--gs-radius-control); background: #f8fafb; color: #26313a; cursor: pointer; font: inherit; text-align: left; }
.variant-list button:hover { border-color: #7bcfc9; background: #f0fbfa; }
.variant-list strong { min-width: 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.6; overflow-wrap: anywhere; }
.variant-list svg, .chip-list svg, .link-list svg { flex: none; }
.movie-list { margin: var(--gs-space-4) 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--gs-space-3); }
.movie-list li { display: flex; align-items: center; gap: var(--gs-space-3); font-size: var(--gs-text-body); }
.movie-list strong { font-weight: var(--gs-weight-semibold); }
.movie-list span { color: #7a858e; font-size: var(--gs-text-meta); }
.credit-list { margin: var(--gs-space-3) 0 0; padding: 0; list-style: none; color: #4a545e; font-size: var(--gs-text-body); line-height: 1.7; }
.link-list { margin: var(--gs-space-3) 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--gs-space-3); }
.link-list a { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-compact); color: #158f87; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-decoration: none; }
.link-list a:hover { text-decoration: underline; }
.song-detail button:focus-visible, .song-detail a:focus-visible, .song-detail summary:focus-visible { outline: var(--gs-focus-ring) solid #37a9a1; outline-offset: var(--gs-focus-offset); }
.song-record-column :deep(button.archive-idol-reference:focus-visible), .song-record-column :deep(.archive-technical > summary:focus-visible) { outline: var(--gs-focus-ring) solid #37a9a1; outline-offset: var(--gs-focus-offset); }
@media (max-width: 1100px) { .song-detail-body { grid-template-columns: 1fr; } .song-listen-column { position: static; } }
@media (max-width: 700px), (pointer: coarse) { .song-parent-link, .link-list a, .song-history a { min-height: var(--gs-control-touch); } }
@media (max-width: 560px) {
  .song-detail { padding: var(--gs-space-4); }
  .song-detail-hero { gap: var(--gs-space-4); padding: var(--gs-space-4); }
  .song-detail-hero.has-jacket { grid-template-columns: 72px minmax(0,1fr); }
  .song-detail-jacket { width: 72px; height: 72px; }
  .song-detail-title h2 { font-size: 20px; }
  .song-block, .song-record-column > .song-block { padding: 14px; }
  .song-detail-body { padding-top: var(--gs-space-4); }
}
</style>
