<template>
  <article v-if="collection" class="story-collection" data-archive-scroll-container>
    <header class="collection-hero">
      <div class="collection-visual" :class="`domain-${collection.domain}`">
        <img v-if="collection.visualUrl" :src="collection.visualUrl" :alt="collection.title" />
        <div v-else class="visual-fallback"><BookOpen :size="42" /></div>
      </div>
      <div class="collection-copy">
        <span>{{ collection.eyebrow }}</span>
        <h2>{{ presentProducerAddressingText(collection.title) }}</h2>
        <p>{{ collection.description }}</p>
        <dl>
          <div><dt>{{ collection.domain === 'birthday' ? '独立生日档案' : '正式话目' }}</dt><dd>{{ collection.domain === 'birthday' ? collection.independentChapterCount : `${collection.playableChapterCount} / ${collection.chapterCount}` }}</dd></div>
          <div><dt>{{ collection.domain === 'birthday' ? '个人故事共享' : '剧情分段' }}</dt><dd>{{ collection.domain === 'birthday' ? collection.sharedChapterCount : `${collection.playableEpisodeCount} / ${collection.episodeCount}` }}</dd></div>
          <div v-if="collection.domain === 'birthday' && collection.officialBirthdayLabel"><dt>官方生日</dt><dd>{{ collection.officialBirthdayLabel }}</dd></div>
          <div v-if="releaseDate"><dt>开放时间</dt><dd>{{ releaseDate }}</dd></div>
        </dl>
        <aside v-if="collection.domain === 'birthday'" class="domain-boundary-note">
          <BookOpen :size="17" />
          <p v-if="collection.subject?.kind === 'shared'"><strong>归档边界</strong><span>该篇由山村贤登场引导，内容为制作人生日问候，归入公共篇。</span></p>
          <p v-else><strong>归档边界</strong><span>生日问候属于本页；生日同期开放的正式个人章节归入 Idol Episode。共享文件只保留一个关系入口，不重复定义章节。</span></p>
        </aside>
        <div v-if="collection.gasha || collection.sourceUrl" class="collection-relations">
          <button v-if="collection.gasha" type="button" @click="emit('open-gasha', collection.gasha)">
            <img v-if="collection.gasha.banner_url" :src="collection.gasha.banner_url" alt="" />
            <span>
              <small>关联卡池</small>
              <strong>{{ gashaText(collection.gasha.display_name) }}</strong>
              <em>{{ collection.gasha.derived_pickup_cards?.length || 0 }} 张推定关联卡</em>
            </span>
            <ChevronRight :size="18" />
          </button>
          <a v-if="collection.sourceUrl" :href="collection.sourceUrl" target="_blank" rel="noopener noreferrer external">
            <ExternalLink :size="15" />
            分类核对来源
          </a>
        </div>
      </div>
    </header>

    <section class="chapter-section">
      <div class="section-heading">
        <div><h3>{{ collection.domainLabel }}</h3></div>
        <strong>{{ collection.chapterCount }} {{ collection.domain === 'main' ? '话' : '章' }}</strong>
      </div>

      <div class="chapter-list">
        <section
          v-for="(chapter, chapterIndex) in collection.chapters"
          :key="chapter.id"
          class="chapter-row"
          :class="{ expanded: expandedChapterId === chapter.id, unavailable: !chapter.exists, canonical: chapter.canonicalRelation }"
        >
          <div class="chapter-summary">
            <button class="chapter-toggle" :aria-expanded="expandedChapterId === chapter.id" @click="toggleChapter(chapter)">
              <span class="chapter-number">{{ String(chapterIndex + 1).padStart(2, '0') }}</span>
              <span class="chapter-identity">
                <small>{{ chapter.label }}</small>
                <strong>{{ chapterTitle(chapter) }}</strong>
              </span>
              <span class="chapter-stats">
                <small>{{ chapter.episodeCount }} 段剧情</small>
                <small>{{ chapter.voiceCount }} 段语音</small>
              </span>
              <ChevronUp v-if="expandedChapterId === chapter.id" :size="18" />
              <ChevronDown v-else :size="18" />
            </button>
            <div class="chapter-actions" aria-label="章节观看方式">
              <a
                v-for="resource in externalResourcesForChapter(chapter.id)"
                :key="resource.external_id"
                class="chapter-community"
                :href="resource.platform.canonical_url"
                target="_blank"
                rel="noopener noreferrer external"
                :title="`在 Bilibili 观看 ${resource.uploader.name} 投稿的社区中文资源`"
              >
                <ExternalLink :size="17" />
                <span><strong>社区中文</strong><small>{{ resource.uploader.name }}</small></span>
              </a>
              <button
                v-if="chapter.canonicalRelation"
                class="chapter-canonical"
                title="前往正式个人故事章节"
                @click="emit('open-idol-story', chapter.canonicalRelation)"
              >
                <BookOpen :size="17" />
                <span><strong>Idol Episode</strong><small>{{ chapter.canonicalRelation.sectionName }}</small></span>
              </button>
              <button v-if="!chapter.canonicalRelation" class="chapter-read" @click="readChapter(chapter)"><BookOpen :size="17" /><span><strong class="desktop-read-label">整话阅读</strong><strong class="mobile-read-label">阅读本话</strong></span></button>
              <button
                v-if="!chapter.canonicalRelation"
                class="chapter-play"
                :disabled="!chapter.exists"
                :title="chapter.exists ? '连播本话，逐句播放由 AUTO 或手动控制' : '剧情文件未实装'"
                @click="emit('play-chapter', chapter)"
              >
                <Play :size="17" fill="currentColor" />
                <span><strong>{{ chapter.exists ? '连播本话' : '未实装' }}</strong></span>
              </button>
            </div>
          </div>

          <div v-if="expandedChapterId === chapter.id" class="chapter-panel">
            <div v-if="chapter.canonicalRelation" class="canonical-note">
              <div>
                <strong>{{ chapter.canonicalRelation.sectionName }}「{{ chapter.canonicalRelation.sectionTitle }}」</strong>
                <p>本文件对应 {{ chapter.canonicalRelation.episodeNames.map(sourceName => presentIdolEpisodeLabel({ sourceName })).join('、') }}，在生日档案中仅作为同期关系保留；完整章节结构、连续播放与后续通信统一由个人故事页承担。</p>
              </div>
              <button @click="emit('open-idol-story', chapter.canonicalRelation)">前往正式章节 <ChevronRight :size="15" /></button>
            </div>
            <CollectionStorySynopsis class="chapter-synopsis" :key="chapter.id" :entry="chapter.episodes.map(readingEntry).find(Boolean)" :load-document="loadReadingDocument" :fallback="chapter.synopsis" :title="chapter.synopsis?.title || chapter.title" />
            <p v-if="!chapter.exists && !chapter.synopsis" class="chapter-unavailable">此章节已建档，剧情暂未收录。</p>

            <p v-if="readingStatusNotice" role="status">{{ readingStatusNotice }}</p>
            <p v-if="!chapter.canonicalRelation" class="entry-help">点击 EP 阅读并定位剧情，▶ 播放演出。连播接续本话各段；逐句播放可开启 AUTO。剧情播放器为实验功能。</p>
            <p v-if="readingError" role="status">{{ readingError }} <button @click="emit('retry-reading')">重试阅读目录</button></p>
            <div v-if="!chapter.canonicalRelation" class="episode-grid">
              <div v-for="(episode, episodeIndex) in chapter.episodes" :key="episode.id" class="episode-entry">
              <a v-if="readingEntry(episode)" class="episode-reading-main" :href="readingHref(chapter, readingEntry(episode))" :aria-label="`阅读 ${episodeLabel(episode)}`" @click="readEpisode($event, chapter, episode)">
                <span class="episode-number">{{ String(episodeIndex + 1).padStart(2, '0') }}</span><span class="episode-copy"><strong>{{ episodeLabel(episode) }}</strong><small>{{ episode.dialogueCount }} 段对白 · {{ episode.voiceCount }} 段语音{{ readingEntry(episode).status === 'ready' ? '' : ' · 阅读状态待确认' }}</small></span>
              </a>
              <button v-else class="episode-reading-main" @click="readingStatusNotice = '此分段尚未生成阅读正文，演出入口状态独立显示。'"><span class="episode-number">{{ String(episodeIndex + 1).padStart(2, '0') }}</span><span class="episode-copy"><strong>{{ episodeLabel(episode) }}</strong><small>正文未生成</small></span></button>
              <button class="episode-play" :disabled="!episode.exists" :aria-label="`播放 ${episodeLabel(episode)}`" @click.stop="emit('play-episode', { chapter, episode })"><Play :size="18" fill="currentColor" /></button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
    <ArchiveTechnicalDetails :key="collection.id" :evidence="collection" />
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import CollectionStorySynopsis from './CollectionStorySynopsis.vue'
import { BookOpen, ChevronDown, ChevronRight, ChevronUp, ExternalLink, Play } from '@lucide/vue'
import { buildArchiveUrl, buildArchiveSourceQuery } from '../../core/archiveRoute.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { useReaderTitles } from './useReaderTitles.js'
import {gashaText} from './useArchiveGashaText.js'

const props = defineProps({
  readerSource: { type:Object, default:()=>({}) },
  collection: { type: Object, default: null },
  externalResources: { type: Array, default: () => [] },
  initialChapterId: { type: String, default: '' },
  readingEntries: { type: Array, default: () => [] },
  readingError: { type: String, default: '' },
  loadReadingDocument: Function,
})
const emit = defineEmits(['read-episode', 'retry-reading', 'play-chapter', 'play-episode', 'select-chapter', 'open-gasha', 'open-idol-story'])
const expandedChapterId = ref('')
const readingByFile = computed(() => { const map = new Map(); for (const entry of props.readingEntries) { if (!entry.source_file) continue; const existing = map.get(entry.source_file); map.set(entry.source_file, existing === undefined ? entry : null) } return map })
const readingStatusNotice = ref('')
const episodeLabel = episode => presentIdolEpisodeLabel({ sourceName: episode.label, kind:episode.kind, ordinal:episode.ordinal })
const readingEntry = episode => readingByFile.value.get(episode.file)

function readingHref(chapter, entry) {
  const source = { ...props.readerSource, story: chapter.story?.file || chapter.file || '' }
  return buildArchiveUrl('http://localhost/', { ...source, view:'reader', reading:entry.document_id, readingScope:'chapter', sourceRoute:buildArchiveSourceQuery(source) }).search
}
function readEpisode(event, chapter, episode) {
  if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  event.preventDefault(); emit('read-episode', { chapter, documentId:readingEntry(episode).document_id })
}
function readChapter(chapter) {
  const entry = chapter.episodes.map(readingEntry).find(Boolean)
  if (entry) emit('read-episode', { chapter, documentId:entry.document_id })
  else readingStatusNotice.value = '本话尚未生成可关联的阅读正文。'
}
const displayTitle = useReaderTitles()
function chapterTitle(chapter) { return presentProducerAddressingText(displayTitle(chapter.episodes.map(readingEntry).find(Boolean),chapter.title)) }

const releaseDate = computed(() => {
  const timestamp = Number(props.collection?.releaseAt || 0)
  if (timestamp < 1577836800) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(timestamp * 1000))
})

watch(() => [props.collection?.id, props.initialChapterId], () => {
  const initialChapter = props.collection?.chapters?.find(chapter =>
    chapter.id === props.initialChapterId && chapter.exists,
  )
  expandedChapterId.value = initialChapter?.id ||
    props.collection?.chapters?.find(chapter => chapter.exists)?.id ||
    props.collection?.chapters?.[0]?.id || ''
}, { immediate: true })

function toggleChapter(chapter) {
  const nextChapterId = expandedChapterId.value === chapter.id ? '' : chapter.id
  expandedChapterId.value = nextChapterId
  if (nextChapterId) emit('select-chapter', chapter)
}

function externalResourcesForChapter(chapterId) {
  return props.externalResources
    .filter(entry => entry.chapterId === chapterId)
    .map(entry => entry.resource)
}
</script>

<style scoped>
.story-collection { height: 100%; overflow-x: hidden; overflow-y: auto; background: #f5f7f8; color: #26343c; }
.collection-hero { display: grid; grid-template-columns: minmax(390px, 1.2fr) minmax(300px, .8fr); gap: 30px; padding: 28px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dfe5e7; background: #fff; }
.collection-visual { align-self: start; overflow: hidden; border: 1px solid #dce3e5; border-radius: 6px; background: #eef2f3; }
.collection-visual.domain-main { aspect-ratio: 906 / 210; }
.collection-visual.domain-unit_story { aspect-ratio: 446 / 150; }
.collection-visual.domain-extra { aspect-ratio: 1456 / 548; }
.collection-visual.domain-birthday { min-height: 210px; }
.collection-visual img { display: block; width: 100%; height: 100%; object-fit: contain; }
.visual-fallback { display: grid; place-items: center; width: 100%; height: 100%; background: url('/assets/stories/story_background.png') center / cover; color: #16877f; }
.collection-copy { align-self: center; min-width: 0; }
.collection-copy > span, .section-heading span { color: #168a82; font-size: var(--gs-text-caption); font-weight: 800; }
.collection-copy h2 { margin: 5px 0 10px; font-size: 1.45rem; line-height: 1.35; }
.collection-copy > p { margin: 0 0 18px; color: #53636b; font-size: var(--gs-text-ui); line-height: 1.75; }
.collection-copy dl { margin: 0; }
.collection-copy dl div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; padding: 7px 0; border-bottom: 1px solid #edf0f1; font-size: var(--gs-text-meta); }
.collection-copy dt { color: #89959b; }.collection-copy dd { margin: 0; color: #33464f; }
.domain-boundary-note { display: grid; grid-template-columns: 22px minmax(0,1fr); gap: 8px; margin-top: 14px; padding: 10px 11px; border: 1px solid #eadde1; border-radius: 6px; background: #fff8fa; color: #9d4761; }.domain-boundary-note p { display: flex; flex-direction: column; gap: 2px; margin: 0; }.domain-boundary-note strong { font-size: var(--gs-text-caption); }.domain-boundary-note span { color: #705f65; font-size: var(--gs-text-caption); line-height: 1.55; }
.collection-relations { display: grid; gap: 7px; margin-top: 15px; }
.collection-relations button { display: grid; grid-template-columns: 78px minmax(0,1fr) 18px; align-items: center; gap: 10px; overflow: hidden; padding: 0 10px 0 0; border: 1px solid #cfe1df; border-radius: 5px; background: #f3faf9; color: #28443f; cursor: pointer; font: inherit; text-align: left; }
.collection-relations button:hover { border-color: #52aaa3; background: #ebf7f5; }
.collection-relations button img { width: 78px; height: 52px; object-fit: cover; }
.collection-relations button span { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 7px 0; }
.collection-relations button small { color: #188078; font-size: var(--gs-text-caption); font-weight: 800; }
.collection-relations button strong { overflow: hidden; font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
.collection-relations button em { color: #78898e; font-size: var(--gs-text-caption); font-style: normal; }
.collection-relations > a { display: inline-flex; align-items: center; gap: 6px; width: max-content; color: #357c77; font-size: var(--gs-text-caption); text-decoration: none; }
.chapter-section { padding: 24px max(24px, calc((100% - 1120px) / 2)) 40px; background: #f7f9fa; }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 13px; }
.section-heading h3 { margin: 3px 0 0; font-size: var(--gs-text-subtitle); }.section-heading > strong { color: #7d8b92; font-size: var(--gs-text-caption); }
.chapter-list { border-top: 1px solid #dbe2e4; background: #fff; }
.chapter-row { border-bottom: 1px solid #dbe2e4; }.chapter-row.expanded { box-shadow: inset 3px 0 #38a89f; }.chapter-row.unavailable { background: #fafbfb; }.chapter-row.canonical { background: #fbf9fc; }.chapter-row.canonical.expanded { box-shadow: inset 3px 0 #79609b; }
.chapter-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; min-height: 72px; }
.chapter-toggle { display: grid; grid-template-columns: 44px minmax(0, 1fr) 150px 22px; align-items: center; gap: 12px; min-width: 0; padding: 10px 16px; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.chapter-toggle:hover { background: #f4faf9; }.chapter-number { color: #159087; font-size: var(--gs-text-ui); font-weight: 800; font-variant-numeric: tabular-nums; }
.chapter-identity { display: flex; flex-direction: column; gap: 4px; min-width: 0; }.chapter-identity small { color: #16837c; font-size: var(--gs-text-caption); }.chapter-identity strong { overflow: hidden; font-size: var(--gs-text-ui); text-overflow: ellipsis; white-space: nowrap; }
.chapter-stats { display: flex; gap: 12px; color: #849097; font-size: var(--gs-text-caption); }.chapter-toggle > svg { color: #75858c; }
.chapter-actions { display: flex; align-items: stretch; gap: 8px; margin: 12px 14px 12px 0; }
.chapter-actions > a,.chapter-actions > button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 128px; min-height: 48px; padding: 7px 12px; border-radius: 5px; font: inherit; text-decoration: none; }
.chapter-actions > a span,.chapter-actions > button span { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; line-height: 1.15; }
.chapter-actions strong { font-size: var(--gs-text-caption); }.chapter-actions small { font-size: var(--gs-text-caption); font-weight: 500; }
.chapter-community,.chapter-play { border: 1px solid #7dbfb9; background: #f4fbfa; color: #14766f; }
.chapter-canonical { border: 1px solid #b8a9ca; background: #f7f3fb; color: #654f83; cursor: pointer; }
.chapter-community:hover,.chapter-play:hover:not(:disabled) { border-color: #159087; background: #e9f7f5; color: #0f665f; }.chapter-canonical:hover { border-color: #8065a2; background: #f1eafa; }
.chapter-community small,.chapter-play small { color: #617c79; }
.chapter-play { cursor: pointer; }
.chapter-play:disabled { border-color: #d3dade; background: #e4e9eb; color: #78858b; cursor: not-allowed; }
.chapter-panel { padding: 5px 16px 18px 72px; border-top: 1px solid #edf1f2; background: #fbfcfc; }
.canonical-note { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 16px; margin: 13px 0 5px; padding: 13px 14px; border: 1px solid #ddd4e8; border-radius: 6px; background: #fff; }.canonical-note > div { display: flex; flex-direction: column; gap: 4px; }.canonical-note span { color: #765b98; font-size: var(--gs-text-caption); font-weight: 800; }.canonical-note strong { font-size: var(--gs-text-meta); }.canonical-note p { margin: 0; color: #706579; font-size: var(--gs-text-caption); line-height: 1.55; }.canonical-note button { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 0 10px; border: 1px solid #8065a2; border-radius: 5px; background: #765b98; color: #fff; cursor: pointer; font: inherit; font-size: var(--gs-text-caption); font-weight: 700; white-space: nowrap; }
.chapter-synopsis { margin:16px 0; }
.chapter-unavailable { margin: 14px 0; color: #78858b; font-size: var(--gs-text-meta); }
.episode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #dfe6e8; }
.episode-grid button { display: grid; grid-template-columns: 34px minmax(0, 1fr) 18px; align-items: center; gap: 8px; min-height: 54px; padding: 8px 11px; border: 0; background: #fff; color: #2d3d45; cursor: pointer; font: inherit; text-align: left; }
.episode-grid button:hover:not(:disabled) { background: #edf8f7; }.episode-grid button:disabled { background: #f4f6f7; color: #929da2; cursor: not-allowed; }
.episode-entry { display: flex; min-width: 0; background: #fff; }
.episode-entry > .episode-reading-main { flex:1; min-width:0; display:grid; grid-template-columns:34px minmax(0,1fr); align-items:center; gap:8px; min-height:54px; padding:8px 11px; border:0; background:#fff; color:#2d3d45; font:inherit; text-align:left; text-decoration:none; box-sizing:border-box; }
.episode-reading-main:hover { background:#edf8f7; }
.episode-grid .episode-play { display:flex; justify-content:center; flex:0 0 48px; min-width:44px; min-height:44px; padding:8px; border-left:1px solid #e2ecef; }
.episode-entry :focus-visible { outline:2px solid #168f98; outline-offset:-2px; }
.entry-help { font-size:12px; color:#60727e; line-height:1.7; }
.chapter-read { border:1px solid #cfe1df; color:#14766f; background:#fff; cursor:pointer; }
.mobile-read-label { display:none; }
@media(max-width:760px) { .desktop-read-label { display:none; } .mobile-read-label { display:inline; } }
.episode-grid .episode-reading { display: flex; flex: 0 0 auto; justify-content: center; min-width: 66px; min-height: 44px; border-left: 1px solid #e2ecef; color: #157c78; font-size: 13px; }
.episode-number { color: #16877f; font-size: var(--gs-text-caption); font-weight: 800; font-variant-numeric: tabular-nums; }.episode-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.episode-copy strong { font-size: var(--gs-text-meta); }.episode-copy small { color: #87949a; font-size: var(--gs-text-caption); }.episode-grid svg { color: #159087; }.episode-lock { text-align: center; }
@media (max-width: 840px) { .collection-hero { grid-template-columns: 1fr; gap: 18px; }.collection-visual { max-width: 720px; }.chapter-toggle { grid-template-columns: 38px minmax(0, 1fr) 22px; }.chapter-stats { display: none; } }
@media (max-width: 620px) { .collection-hero { padding: 15px 12px 18px; }.collection-copy h2 { font-size: 1.14rem; }.chapter-section { padding: 18px 10px 30px; }.chapter-summary { grid-template-columns: 1fr; }.chapter-toggle { grid-template-columns: 30px minmax(0, 1fr) 18px; gap: 7px; padding: 9px 8px; }.chapter-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); margin: 0 8px 12px; }.chapter-actions > a,.chapter-actions > button { min-width: 0; }.chapter-panel { padding: 4px 8px 12px; }.canonical-note { grid-template-columns: 1fr; }.canonical-note button { justify-content: center; }.episode-grid { grid-template-columns: 1fr; }.section-heading > strong { display: none; } }
</style>
