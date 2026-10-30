<template>
  <section ref="songScrollContainer" class="song-detail" data-archive-scroll-container>
    <div class="song-detail-layout" :class="{ 'has-version-panel': song.playback.experiment }">
    <header class="song-detail-hero" :class="{ 'has-jacket': song.jacketUrl }">
      <div v-if="song.jacketUrl" class="song-detail-ambient" aria-hidden="true" :style="{ backgroundImage: `url(${song.jacketUrl})` }"></div>
      <img v-if="song.jacketUrl" class="song-detail-jacket" :src="song.jacketUrl" :alt="`${song.title} 封面`" />
      <div class="song-detail-title">
        <div class="song-detail-heading">
          <h2>{{ song.title }}</h2>
          <p v-if="song.kana" class="song-detail-kana" lang="ja">{{ song.kana }}</p>
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
      <!-- Stem songs: the version panel holds the choices; the console beside it only plays. -->
      <ArchiveSongVersionPanel
        v-if="song.playback.experiment"
        class="song-version-column"
        :audition="audition"
        :idol-directory="idolDirectory"
        :idol-name="idolName"
        :idol-search="idolSearch"
      />
      <div ref="songListenColumn" class="song-listen-column" :class="{ 'is-sticky-fit': listeningColumnFits }">
        <ArchiveSongAuditionConsole v-if="song.playback.experiment" :song="song" :audition="audition" />
        <ArchiveSongSinglePlayer
          v-else-if="song.playback.track"
          ref="songPlayer"
          :song="song"
          :track="song.playback.track"
        />
        <div v-else class="song-playback-unavailable-card">
          <div class="song-block-heading"><h3>歌曲播放</h3></div>
          <p class="song-block-note song-playback-unavailable" role="status">{{ song.playbackLabel || '暂未提供试听' }}</p>
        </div>
        <!-- The console's foot: the song's two tools, side by side. -->
        <div v-if="song.stageCandidate || song.gameplay" class="song-console-links">
          <button
            v-if="song.stageCandidate || lineupStageTarget"
            type="button"
            @click="openStage(lineupStageTarget || { songCode: song.id, choreographyId: song.stageCandidate.id })"
          ><Clapperboard :size="16" aria-hidden="true" />{{ stageLabel }}</button>
          <button v-if="song.gameplay" type="button" :data-archive-focus-id="`song-chart:${song.id}`" @click="openChart()"><Music :size="16" aria-hidden="true" />谱面</button>
        </div>
      </div>
      <div class="song-record-column">
        <section v-if="eventRelationItems.length" class="song-block song-events">
          <div class="song-block-heading"><h3>关联活动</h3></div>
          <ArchiveRelationList :items="eventRelationItems" @select="emit('open-event', $event.payload)" />
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
        <section v-if="song.playback.experiment" class="song-block song-sources">
          <div class="song-block-heading"><h3>音源收录</h3></div>
          <dl class="source-summary">
            <div><dt>完整混音</dt><dd>{{ song.fullMixCollected ? '已收录' : '未收录' }}</dd></div>
            <div v-if="experimentUnitCount"><dt>组合版</dt><dd>{{ experimentUnitCount }} 组</dd></div>
            <div><dt>个人声部</dt><dd>{{ experimentSoloCount }} 位</dd></div>
            <div><dt>伴奏</dt><dd>{{ song.playback.experiment.backing?.url ? '已收录' : '未收录' }}</dd></div>
          </dl>
          <details class="song-subsection source-units" :open="audioArchiveOpen" @toggle="audioArchiveOpen = $event.target.open">
            <summary>按组合查看（{{ sourceUnits.length }} 组 · {{ experimentSoloCount }} 位）</summary>
            <div v-if="audioArchiveOpen">
              <section v-for="unit in sourceUnits" :key="unit.key" class="source-unit">
                <div class="source-unit-heading">
                  <h4>{{ unit.name }}</h4>
                  <button v-if="unit.entry?.actionable" type="button" class="source-unit-link" :data-archive-focus-id="audioFocusId(unitAudioGroup, unit.entry)" @click="emit('open-unit', unit.entry.id)">组合档案 <ChevronRight :size="14" aria-hidden="true" /></button>
                </div>
                <ul class="source-idols"><li v-for="entry in unit.idols" :key="entry.id">
                  <ArchiveIdolReference :reference="performerReference(entry.reference)" :show-image="false" :data-archive-focus-id="audioFocusId(vocalAudioGroup, entry)" @open="emit('open-idol', $event)" />
                </li></ul>
              </section>
            </div>
          </details>
        </section>
        <section v-else-if="song.audioGroups.length" class="song-block song-sources">
          <div class="song-block-heading"><h3>音源收录</h3></div>
          <details class="song-subsection" :open="audioArchiveOpen" @toggle="audioArchiveOpen = $event.target.open">
            <summary>{{ song.audioGroups.map(group => `${group.title}（${group.entries.length}）`).join(' · ') }}</summary>
            <div v-if="audioArchiveOpen">
            <div v-for="group in song.audioGroups" :key="group.title" class="song-subsection">
              <h4 v-if="song.audioGroups.length > 1">{{ group.title }}（{{ group.entries.length }}）</h4><p v-if="group.note" class="song-block-note">{{ group.note }}</p>
              <ul v-if="group.kind === 'unit'" class="chip-list"><li v-for="entry in group.entries" :key="entry.id"><button :disabled="!entry.actionable" :data-archive-focus-id="audioFocusId(group, entry)" @click="emit('open-unit', entry.id)">查看组合 · {{ entry.displayName }} <ChevronRight :size="14" aria-hidden="true" /></button></li></ul>
              <ul v-else class="audio-idol-list"><li v-for="entry in group.entries" :key="entry.id"><ArchiveIdolReference :reference="performerReference(entry.reference)" :show-image="false" :data-archive-focus-id="audioFocusId(group, entry)" @open="emit('open-idol', $event)" /></li></ul>
            </div>
            </div>
          </details>
        </section>
        <section v-if="song.gameplay" class="song-block song-gameplay">
          <div class="song-block-heading"><h3>难度与谱面</h3><small>点一列打开该难度谱面</small></div>
          <!-- One column per difficulty; the whole column opens that difficulty's chart. -->
          <ul class="song-difficulty-grid" role="list" aria-label="谱面难度与最大 Combo">
            <li v-for="d in song.gameplay.difficulties" :key="d.id" class="difficulty-card" :data-difficulty="d.label.toLowerCase()">
              <button type="button" :aria-label="`打开 ${d.label} 谱面，Lv ${d.levelLabel}，${d.maxCombo} Combo`" @click="openChart(d.type)">
                <span class="difficulty-name"><i class="difficulty-dot" aria-hidden="true"></i><span class="difficulty-label">{{ d.label }}</span><span class="difficulty-short" aria-hidden="true">{{ d.label === 'EXPERT' ? 'EX' : d.label.charAt(0) }}</span></span>
                <strong class="difficulty-level">{{ d.levelLabel }}</strong>
                <span class="difficulty-combo">{{ d.maxCombo }} Combo</span>
              </button>
            </li>
          </ul>
          <p class="song-block-note">解锁条件：<button v-if="song.unlockStory" type="button" class="song-unlock-link" :data-archive-focus-id="`song-unlock:${song.id}`" @click="openUnlockStory">{{ song.unlockStory.label }}</button><template v-else>{{ releaseConditionLabel }}</template></p>
          <p v-if="premiereEvent" class="song-block-note">首发：活动「{{ premiereEvent.title }}」先行<template v-if="song.gameplay.history?.permanentOn">，{{ song.gameplay.history.permanentOn }} 加入普通歌曲</template>。</p>
          <details class="song-history"><summary>实装与解锁历史</summary>
            <p class="song-block-note">首次实装：{{ song.gameplay.history.firstImplementedOn }} · <a :href="song.gameplay.history.sourceUrl" target="_blank" rel="noopener noreferrer">历史来源</a></p>
            <p class="song-block-note">{{ song.gameplay.history.historicalUnlock }}</p>
            <p v-if="song.gameplay.history.permanentOn" class="song-block-note">加入普通歌曲：{{ song.gameplay.history.permanentOn }}</p>
            <p v-else-if="song.gameplay.history.permanentDateStatus === 'pending'" class="song-block-note">加入普通歌曲日期待核实。</p>
            <p v-if="song.gameplay.wikiLevelStatus === 'resolved_song_page'" class="song-block-note">难度按本地主数据与单曲页核对。</p>
            <p v-else-if="song.gameplay.wikiLevelStatus === 'conflict_pending'" class="song-block-note">Wiki 与主数据难度不一致，暂按主数据展示；差异待核实。</p>
          </details>
        </section>
      <section v-if="song.variants.length" class="song-block">
        <div class="song-block-heading"><h3>关联演出版本</h3></div>
        <div class="variant-list"><button v-for="variant in song.variants" :key="variant.id" :data-archive-focus-id="`song-variant:${variant.id}`" @click="emit('open-song', variant.id)"><strong>{{ variant.title }}</strong><ChevronRight :size="16" /></button></div>
      </section>
      <section v-if="song.related.length" class="song-block">
        <div class="song-block-heading"><h3>关联档案</h3></div>
        <div class="variant-list"><button v-for="(entry, index) in song.related" :key="index" :data-archive-focus-id="`song-related:${song.id}:${index}`" @click="emit('open-related-story', entry.payload)"><strong>{{ entry.title }}</strong><ChevronRight :size="16" /></button></div>
      </section>
      <section v-if="officialVideos.length || song.movies.length" class="song-block song-videos">
        <div class="song-block-heading"><h3>影像资料</h3></div>
        <figure v-for="video in officialVideos" :key="video.youtubeId" class="official-video">
          <div class="video-frame">
            <iframe v-if="playingVideo === video.youtubeId" :src="`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`" :title="video.title" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
            <button v-else type="button" class="video-poster" :style="song.jacketUrl ? { backgroundImage: `url(${song.jacketUrl})` } : null" :aria-label="`播放 ${video.label}（YouTube）`" @click="playingVideo = video.youtubeId">
              <img :src="`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`" alt="" loading="lazy" referrerpolicy="no-referrer" @error="$event.target.hidden = true" />
              <span class="video-play" aria-hidden="true"><Play :size="22" /></span>
            </button>
          </div>
          <figcaption>
            <strong>{{ video.label }}</strong>
            <span>{{ video.note }}</span>
            <a :href="`https://www.youtube.com/watch?v=${video.youtubeId}`" target="_blank" rel="noopener noreferrer external">在 YouTube 打开 <ExternalLink :size="14" /></a>
          </figcaption>
        </figure>
        <ul v-if="unlistedMovies.length" class="movie-list"><li v-for="movie in unlistedMovies" :key="movie.id"><strong>{{ movie.title }}</strong><span>游戏内收录，暂无官方公开视频</span></li></ul>
      </section>
      <section v-if="albums.length" class="song-block song-albums">
        <div class="song-block-heading"><h3>收录专辑</h3></div>
        <ul class="album-list"><li v-for="album in albums" :key="album.url"><a :href="album.url" target="_blank" rel="noopener noreferrer external">
          <span class="album-copy"><strong>{{ album.displayTitle }}</strong><small>{{ album.catalogNumber ? `${album.catalogNumber} · Lantis` : 'Lantis 专辑页面' }}</small></span>
          <ExternalLink :size="16" aria-hidden="true" />
        </a></li></ul>
        <p class="song-block-note">链接打开 Lantis 的专辑页面，可选择各音乐平台试听或购买。</p>
      </section>
      <ArchiveTechnicalDetails :key="song.id" :evidence="song.technicalEvidence" />
      </div>
    </div>
    </div>
  </section>
</template>

<script setup>
import { ChevronRight, Clapperboard, ExternalLink, Music, Play } from '@lucide/vue'
import { computed, ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import ArchiveRelationList from './ArchiveRelationList.vue'
import { eventKindLabels, historicalDate } from '../../presentation/DomainPresentation.mjs'
import ArchiveSongVersionPanel from './ArchiveSongVersionPanel.vue'
import ArchiveSongAuditionConsole from './ArchiveSongAuditionConsole.vue'
import { useSongAudition } from '../../composables/useSongAudition.js'
import ArchiveSongSinglePlayer from './ArchiveSongSinglePlayer.vue'
const props = defineProps({ song: { type: Object, required: true }, idolDirectory: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' } })
const emit = defineEmits(['open-song', 'open-unit', 'open-idol', 'open-related-story', 'open-event', 'open-stage', 'open-chart', 'ready'])
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
// The main-story chapter whose reading unlocks this song opens as that chapter's story collection.
function openUnlockStory() {
  const unlock = props.song.unlockStory
  if (unlock) emit('open-related-story', { entity_type: 'story_collection', story_type: unlock.domain, story_section: unlock.section })
}
const premiereEvent = computed(() => (props.song.relatedEvents || []).find(event => !event.isReprint) || null)
// Events whose BGM is this song: the premiere first, then reprints.
const eventRelationItems = computed(() => (props.song.relatedEvents || []).map(event => ({
  id: `event:${event.event_id}`, kind: 'event', label: event.isReprint ? '复刻活动' : '首发活动', title: event.title,
  meta: `${eventKindLabels[event.kind] || '活动'} · ${historicalDate(event.startAt)} 开始`,
  imageUrl: event.banner?.url || '', imageAlt: event.title, payload: { event_id: event.event_id },
})))
const songPlayer = ref(null)
// A stem song's audition: one state, read by the version panel and the console.
const audition = useSongAudition(() => props.song.playback.experiment, { idolName: (code, name) => props.idolName(code, name) })
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
// 音源收录 for stem songs: the collected vocals grouped by unit; playing them is the version panel's job.
const experimentSoloCount = computed(() => Object.keys(props.song.playback.experiment?.solo_tracks || {}).length)
const experimentUnitCount = computed(() => (props.song.playback.experiment?.unit_tracks || []).length)
const unitAudioGroup = computed(() => props.song.audioGroups.find(group => group.kind === 'unit') || { title: '', kind: 'unit', entries: [] })
const vocalAudioGroup = computed(() => props.song.audioGroups.find(group => group.title === '个人声部') || { title: '', kind: 'idol', entries: [] })
const sourceUnits = computed(() => {
  const experiment = props.song.playback.experiment
  if (!experiment) return []
  const directory = new Map(props.idolDirectory.map(idol => [idol.id, idol]))
  const unitTracks = new Set((experiment.unit_tracks || []).map(track => track.unit_code))
  const unitEntries = new Map(unitAudioGroup.value.entries.map(entry => [entry.id, entry]))
  const vocalEntries = new Map(vocalAudioGroup.value.entries.map(entry => [entry.id, entry]))
  const groups = new Map()
  for (const code of Object.keys(experiment.solo_tracks || {})) {
    const idol = directory.get(code)
    const key = idol?.unitCode || 'other'
    if (!groups.has(key)) groups.set(key, {
      key, code: idol?.unitCode || '', name: idol?.unitName || unitEntries.get(key)?.displayName || '其他',
      hasTrack: unitTracks.has(key), entry: unitEntries.get(key) || null, idols: [],
    })
    const entry = vocalEntries.get(code)
    groups.get(key).idols.push(entry || { id: code, displayName: experiment.solo_tracks[code].displayName || code, reference: { displayName: experiment.solo_tracks[code].displayName || code, actionable: false } })
  }
  return [...groups.values()]
})
// Official 3D live uploads load only on request; the poster is YouTube's own thumbnail.
const playingVideo = ref('')
const officialVideos = computed(() => (props.song.officialVideos || []).map(video => ({
  ...video,
  label: video.source === 'growing_stars' ? '3D 演出 · GROWING STARS' : '3D 演出 · 原作《偶像大师 SideM》',
  note: video.source === 'growing_stars' ? 'アイドルマスターチャンネル 官方上传，画质高于游戏内 3DMV。' : '原作 SideM（非 GROWING STARS）的 3D 演出，アイドルマスターチャンネル 官方上传。',
})))
// MV LIVE and any 3DMV without a public upload still show as collected in the client.
const unlistedMovies = computed(() => officialVideos.value.length ? [] : props.song.movies)
const albums = computed(() => (props.song.albums || props.song.links.map(url => ({ url, title: '', catalogNumber: '' })))
  .map(album => ({ ...album, displayTitle: album.title.replace(/^THE IDOLM@STER SideM\s+/, '') || '专辑页面' })))
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
  playingVideo.value = ''
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
// The page's one stage entry: a loaded five-slot lineup goes along; otherwise the default choreography opens.
const lineupStageTarget = computed(() => audition.stageTarget)
const stageLabel = computed(() => {
  if (lineupStageTarget.value) return '2D 舞台 · 带编成'
  return props.song.stageCandidate?.stageKind === 'special_single' ? '社长特别演出' : '2D 舞台'
})
function openStage(target) { songPlayer.value?.pause(); audition.pause(); emit('open-stage', target) }
// difficulty: a difficulty column's type; the console's 谱面 button opens on the first one.
function openChart(difficulty = null) { songPlayer.value?.pause(); audition.pause(); emit('open-chart', difficulty) }
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
.song-detail-kana { margin: var(--gs-space-2) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-ui); overflow-wrap: anywhere; }
.song-detail-scope { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); }
.song-detail-credits { display: flex; flex-wrap: wrap; gap: var(--gs-space-1) var(--gs-space-6); margin: 0; padding: 0; list-style: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.song-detail-meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2) var(--gs-space-6); padding: var(--gs-space-4) 0; border-top: 1px solid var(--gs-line); border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.song-detail-badges { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-5); min-width: 0; }
.badge { color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); }
.badge-attribute { display: inline-flex; align-items: center; gap: var(--gs-space-2); font-weight: var(--gs-weight-semibold); }
.badge-attribute::before { content: none; flex: none; width: 18px; height: 18px; background: var(--attr-icon) center / contain no-repeat; }
.badge-attribute[data-song-attribute="Physical"] { --attr-icon: var(--gs-attr-icon-physical); color: var(--gs-attr-physical); }
.badge-attribute[data-song-attribute="Intelli"] { --attr-icon: var(--gs-attr-icon-intelli); color: var(--gs-attr-intelli); }
.badge-attribute[data-song-attribute="Mental"] { --attr-icon: var(--gs-attr-icon-mental); color: var(--gs-attr-mental); }
.badge-attribute[data-song-attribute="ALL"] { --attr-icon: var(--gs-attr-icon-all); }
.badge-attribute[data-song-attribute="Physical"]::before, .badge-attribute[data-song-attribute="Intelli"]::before, .badge-attribute[data-song-attribute="Mental"]::before, .badge-attribute[data-song-attribute="ALL"]::before { content: ""; }
.song-detail-date { margin-left: auto; color: var(--gs-ink-3); font-size: var(--gs-text-ui); white-space: nowrap; font-variant-numeric: tabular-nums; }
.song-parent-link { grid-column: 1 / -1; justify-self: start; display: inline-flex; align-items: center; min-height: var(--gs-control-compact); padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.song-parent-link:hover { text-decoration: underline; }

.song-detail-body { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: var(--gs-space-8); padding-top: var(--gs-space-8); }
/* The listening panel is the one floating surface: it carries playback state. */
.song-listen-column { min-width: 0; font-size: var(--gs-text-subtitle); background: var(--gs-surface); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-surface); padding: var(--gs-space-6); }
/* The audition sits on the paper like every other section; no floating card. */
.song-record-column { display: grid; gap: var(--gs-space-section); min-width: 0; }
.song-block { min-width: 0; }
/* :deep so the player components' own block headings take the same role as the record blocks. */
.song-block :deep(.song-block-heading) { display: flex; align-items: center; gap: var(--gs-space-3); padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.song-block :deep(.song-block-heading h3) { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.song-block > summary { margin: 0; padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.song-block :deep(.song-block-note) { margin: var(--gs-space-4) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-body); line-height: 1.7; }
.song-subsection { margin-top: var(--gs-space-6); }
.song-subsection h4, .song-subsection > summary { margin: 0 0 var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
summary { display: flex; align-items: center; min-height: var(--gs-control-touch); color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
summary::after { content: '⌄'; margin-left: auto; color: var(--gs-ink-3); } details[open] > summary::after { content: '⌃'; }


/* Difficulties as a hairline table: dot, name, level, max Combo; one row each. */
.song-block :deep(.song-block-heading small) { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
/* A hairline table: one column per difficulty, the dot and name, the level as a figure, the Combo; each column is one button. */
.song-difficulty-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: var(--gs-space-4) 0 var(--gs-space-2); padding: 0; border-top: 1px solid var(--gs-line); border-bottom: 1px solid var(--gs-line); list-style: none; }
.difficulty-card { min-width: 0; border-right: 1px solid var(--gs-line); }
.difficulty-card:last-child { border-right: 0; }
.difficulty-card button { display: flex; flex-direction: column; align-items: flex-start; gap: var(--gs-space-1); width: 100%; padding: var(--gs-space-4); border: 0; background: none; color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
@media (hover: hover) { .difficulty-card button:hover { background: var(--gs-hover); } }
.difficulty-name { display: flex; align-items: center; gap: 6px; }
.difficulty-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--diff-color, var(--gs-ink-3)); }
.difficulty-label, .difficulty-short { font-family: var(--gs-font-stage); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); letter-spacing: .04em; color: var(--gs-ink-2); }
.difficulty-short { display: none; }
.difficulty-level { font-family: var(--gs-font-stage); font-size: var(--gs-text-figure); font-weight: var(--gs-weight-semibold); line-height: 1; font-variant-numeric: tabular-nums; }
.difficulty-combo { font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); color: var(--gs-ink-3); }
/* Narrow: four equal columns keep only the initial. */
@container song-detail (max-width: 519px) {
  .difficulty-card button { padding: var(--gs-space-3); }
  .difficulty-label { display: none; }
  .difficulty-short { display: inline; }
}
.difficulty-card[data-difficulty="easy"] { --diff-color: var(--gs-diff-easy); }
.difficulty-card[data-difficulty="normal"] { --diff-color: var(--gs-diff-normal); }
.difficulty-card[data-difficulty="hard"] { --diff-color: var(--gs-diff-hard); }
.difficulty-card[data-difficulty="expert"] { --diff-color: var(--gs-diff-expert); }

.song-gameplay a, .song-history a { color: var(--gs-mint-ink); }
.song-unlock-link { display: inline; padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; font-weight: var(--gs-weight-semibold); text-align: left; cursor: pointer; }
@media (hover: hover) { .song-unlock-link:hover { text-decoration: underline; } }
.song-history a { display: inline-flex; align-items: center; min-height: var(--gs-control-compact); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
/* The console's foot: 2D 舞台 and 谱面 as two plain buttons on one line (the player ends on its own hairline). */
.song-console-links { display: flex; gap: var(--gs-space-3); margin-top: var(--gs-space-4); }
.song-console-links button { display: inline-flex; flex: 1; align-items: center; justify-content: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); box-shadow: inset 0 0 0 1px var(--gs-rule); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); cursor: pointer; white-space: nowrap; }
.song-console-links svg { color: var(--gs-ink-2); }
@media (hover: hover) { .song-console-links button:hover { background: var(--gs-hover); } }
.song-console-links button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: 2px; }
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
.source-summary { display: flex; flex-wrap: wrap; gap: var(--gs-space-3) var(--gs-space-6); margin: var(--gs-space-4) 0 0; }
.source-summary div { display: grid; gap: var(--gs-space-1); }
.source-summary dt { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.source-summary dd { margin: 0; font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; }
.source-units > summary { color: var(--gs-ink); font-size: var(--gs-text-ui); }
.source-unit { margin-top: var(--gs-space-5); }
.source-unit-heading { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2) var(--gs-space-3); padding-bottom: var(--gs-space-2); border-bottom: 1px solid var(--gs-rule); }
.source-unit-heading h4 { margin: 0 auto 0 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.source-unit-link { display: inline-flex; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-compact); padding: 0; border: 0; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-meta); cursor: pointer; }
.source-idols { margin: 0; padding: 0; list-style: none; }
.source-idols li { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; border-bottom: 1px solid var(--gs-line); }
.source-idols li > :first-child { flex: 1 1 auto; min-width: 0; }
/* The unit heading already names the unit; the reference's unit subtitle would repeat it on every row. */
.source-idols :deep(.idol-reference-copy small) { display: none; }
.official-video { margin: var(--gs-space-4) 0 0; }
.video-frame { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--gs-radius-panel); background: var(--gs-media-bg); }
.video-frame iframe, .video-poster { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.video-poster { display: block; padding: 0; background: var(--gs-media-bg) center / contain no-repeat; cursor: pointer; }
/* Without YouTube reachable the thumbnail fails; the song jacket stays as the poster. */
.video-poster img { width: 100%; height: 100%; object-fit: cover; }
.video-play { position: absolute; top: 50%; left: 50%; display: grid; place-items: center; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: var(--gs-media-scrim); color: var(--gs-media-ink); }
.video-play svg { margin-left: 3px; fill: currentColor; }
.official-video figcaption { display: grid; gap: var(--gs-space-1); margin-top: var(--gs-space-3); }
.official-video figcaption strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.official-video figcaption span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.6; }
.official-video figcaption a { display: inline-flex; align-items: center; gap: var(--gs-space-2); justify-self: start; min-height: var(--gs-control-compact); color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-decoration: none; }
.album-list { display: grid; margin: var(--gs-space-2) 0 0; padding: 0; list-style: none; }
.album-list a { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); color: var(--gs-ink); text-decoration: none; }
.album-copy { display: grid; gap: var(--gs-space-1); min-width: 0; }
.album-copy strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.5; overflow-wrap: anywhere; }
.album-copy small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); }
.album-list svg { flex: none; color: var(--gs-ink-3); }
.movie-list, .link-list { display: grid; gap: var(--gs-space-3); margin: var(--gs-space-4) 0 0; padding: 0; list-style: none; }
.movie-list li { display: flex; align-items: baseline; gap: var(--gs-space-4); font-size: var(--gs-text-body); }
.movie-list strong { font-weight: var(--gs-weight-semibold); }
.movie-list span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.link-list a { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-compact); color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-decoration: none; }
@media (hover: hover) {
  .variant-list button:hover strong { color: var(--gs-mint-ink); }
  .chip-list button:hover:not(:disabled) { border-color: var(--gs-ink-3); }
  .link-list a:hover { text-decoration: underline; }
  .album-list a:hover strong { color: var(--gs-mint-ink); }
  .official-video figcaption a:hover { text-decoration: underline; }
  .video-poster:hover .video-play { background: var(--gs-mint-ink); }
  .source-unit-link:hover { color: var(--gs-mint-ink); }
}
.song-detail button:focus-visible, .song-detail a:focus-visible, .song-detail summary:focus-visible,
.song-record-column :deep(button.archive-idol-reference:focus-visible) { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }

/* Identity: the cover holds the left column; name, credits, attribute and date stack beside it. */
@container song-detail (min-width: 520px) {
  .song-detail-hero.has-jacket { grid-template-columns: 176px minmax(0, 1fr); }
  .song-detail-jacket { width: 176px; grid-row: span 3; }
  .song-detail-hero.has-jacket .song-detail-meta, .song-detail-hero.has-jacket .song-parent-link { grid-column: 2; }
  .song-detail-hero.has-jacket .song-detail-meta { padding-bottom: 0; border-bottom: 0; }
}
/* Wide: one head row — cover | identity | console (the page's one white surface); the sections run full width below. */
@container song-detail (min-width: 900px) {
  .song-detail-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 360px); align-items: start; gap: var(--gs-space-8) var(--gs-space-7); }
  .song-detail-hero { grid-column: 1; grid-row: 1; }
  .song-detail-body { display: contents; }
  .song-listen-column { grid-column: 2; grid-row: 1; }
  .song-record-column { grid-column: 1 / -1; grid-row: 2; padding-top: var(--gs-space-6); border-top: 1px solid var(--gs-rule); }
  /* Stem songs: the version panel fills the identity column under the head; the console spans both rows. */
  .has-version-panel .song-version-column { grid-column: 1; grid-row: 2; }
  .has-version-panel .song-listen-column { grid-row: 1 / span 2; }
  /* Row 2 is flexible: when the console outgrows head + panel, the extra lands under the panel instead of
     being shared with the head row, so the head and the five slots never shift while the console changes. */
  .song-detail-layout.has-version-panel { grid-template-rows: auto 1fr auto; }
  .has-version-panel .song-record-column { grid-row: 3; }
}
@media (max-width: 760px) {
  .song-detail { padding: var(--gs-space-5); }
  .song-detail-title h2 { font-size: var(--gs-text-section); }
  .song-listen-column { padding: var(--gs-space-4); }
  .song-parent-link, .link-list a, .song-history a, .song-console-links button, .chip-list button, .source-unit-link { min-height: var(--gs-control-touch); }
}
</style>
