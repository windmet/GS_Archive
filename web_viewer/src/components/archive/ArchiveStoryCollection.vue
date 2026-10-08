<template>
  <article v-if="collection" class="story-collection story-page" data-archive-scroll-container>
    <header class="collection-hero story-head">
      <div v-if="collection.visualUrl" class="collection-visual" :class="`domain-${collection.domain}`">
        <img :src="collection.visualUrl" :alt="collection.title" />
      </div>
      <ArchiveIdolAvatar v-else-if="collection.subject?.kind === 'idol'" class="collection-avatar" :idol-code="collection.subject.code" :size="72" decorative />
      <div class="collection-copy">
        <h2>{{ collectionTitle }}</h2>
        <ul v-if="collection.domain === 'birthday'" class="story-footprint" aria-label="收录">
          <li><b>{{ collection.independentChapterCount }}</b>篇生日剧情</li>
          <li v-if="collection.sharedChapterCount">另有<b class="inline-count">{{ collection.sharedChapterCount }}</b>篇在个人故事</li>
          <li v-if="collection.officialBirthdayLabel">生日 {{ collection.officialBirthdayLabel }}</li>
        </ul>
        <ul v-else class="story-footprint" aria-label="收录">
          <li><b>{{ collection.chapterCount }}</b>{{ chapterUnit }}</li>
          <li><b>{{ collection.episodeCount }}</b>段剧情</li>
          <li v-if="collection.playableChapterCount < collection.chapterCount">其中<b class="inline-count">{{ collection.chapterCount - collection.playableChapterCount }}</b>{{ chapterUnit }}暂未收录</li>
          <li v-if="releaseDate">{{ releaseDate }} 开放</li>
        </ul>
        <p v-if="['extra', 'unit_story'].includes(collection.domain) && collection.description" class="story-lede">{{ collection.description }}</p>
        <p v-if="collection.subject?.kind === 'shared'" class="story-note">该篇由山村贤登场引导，内容为制作人生日问候，归入公共篇。</p>
        <p v-else-if="collection.domain === 'birthday' && collection.sharedChapterCount" class="story-note">生日同期开放的个人故事收在个人故事页，这里只保留入口。</p>
        <div v-if="collection.gasha || collection.sourceUrl" class="collection-relations">
          <button v-if="collection.gasha" type="button" class="story-row" @click="emit('open-gasha', collection.gasha)">
            <span class="story-row-thumb"><img v-if="collection.gasha.banner_url" :src="collection.gasha.banner_url" alt="" /></span>
            <span class="story-row-copy">
              <strong>{{ gashaText(collection.gasha.display_name) }}</strong>
              <small>关联卡池 · {{ collection.gasha.derived_pickup_cards?.length || 0 }} 张推定关联卡</small>
            </span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
          <a v-if="collection.sourceUrl" class="source-link" :href="collection.sourceUrl" target="_blank" rel="noopener noreferrer external">
            <ExternalLink :size="15" />
            分类核对来源
          </a>
        </div>
      </div>
    </header>

    <section class="story-section chapter-section">
      <div class="story-section-head">
        <h3>{{ collection.domainLabel }}</h3>
        <small>{{ collection.chapterCount }} {{ chapterUnit }}</small>
      </div>

      <ol class="chapter-list" :class="{ unnumbered: singleStoryChapters }">
        <li
          v-for="(chapter, chapterIndex) in collection.chapters"
          :key="chapter.id"
          class="chapter-row"
          :class="{ expanded: expandedChapterId === chapter.id, unavailable: !chapter.exists, canonical: chapter.canonicalRelation }"
        >
          <button class="chapter-toggle" :aria-expanded="expandedChapterId === chapter.id" @click="toggleChapter(chapter)">
            <span v-if="!singleStoryChapters" class="chapter-number">{{ String(chapterIndex + 1).padStart(2, '0') }}</span>
            <span class="chapter-identity">
              <small>{{ chapterLabel(chapter.label) }}</small>
              <strong>{{ chapterTitle(chapter) }}</strong>
            </span>
            <span class="chapter-stats">{{ chapterStats(chapter) }}</span>
            <ChevronUp v-if="expandedChapterId === chapter.id" :size="18" aria-hidden="true" />
            <ChevronDown v-else :size="18" aria-hidden="true" />
          </button>

          <div v-if="expandedChapterId === chapter.id" class="chapter-panel">
            <div v-if="chapter.canonicalRelation" class="canonical-note">
              <p><strong>{{ chapterLabel(chapter.canonicalRelation.sectionName) }}「{{ chapter.canonicalRelation.sectionTitle }}」</strong>本篇就是 {{ chapter.canonicalRelation.episodeNames.map(sourceName => presentIdolEpisodeLabel({ sourceName })).join('、') }}，完整章节与连续播放在个人故事页。</p>
              <button class="story-action" @click="emit('open-idol-story', chapter.canonicalRelation)"><BookOpen :size="16" />去个人故事阅读</button>
            </div>
            <CollectionStorySynopsis class="chapter-synopsis" :key="chapter.id" :entry="chapter.episodes.map(readingEntry).find(Boolean)" :load-document="loadReadingDocument" :fallback="chapter.synopsis" :title="chapter.synopsis?.title || chapter.title" />
            <p v-if="!chapter.exists && !chapter.synopsis" class="story-note">这一{{ chapterUnit }}暂未收录。</p>

            <div v-if="!chapter.canonicalRelation" class="chapter-actions" aria-label="本话观看方式">
              <button class="story-action primary" @click="readChapter(chapter)"><BookOpen :size="16" />{{ soleEpisode(chapter) ? '阅读本篇' : '阅读本话' }}</button>
              <button v-if="soleEpisode(chapter)" class="story-action" :disabled="!soleEpisode(chapter).exists" @click="emit('play-episode', { chapter, episode: soleEpisode(chapter) })"><Play :size="15" fill="currentColor" />播放演出</button>
              <button v-else class="story-action" :disabled="!chapter.exists" @click="emit('play-chapter', chapter)"><Play :size="15" fill="currentColor" />连播演出</button>
              <a
                v-for="resource in externalResourcesForChapter(chapter.id)"
                :key="resource.external_id"
                class="story-action"
                :href="resource.platform.canonical_url"
                target="_blank"
                rel="noopener noreferrer external"
                :title="`在 Bilibili 观看 ${resource.uploader.name} 投稿的社区中文资源`"
              >
                <ExternalLink :size="15" />社区中文 · {{ resource.uploader.name }}
              </a>
            </div>
            <p v-if="readingStatusNotice" class="story-note" role="status">{{ readingStatusNotice }}</p>
            <p v-if="readingError" class="story-note" role="status">{{ readingError }} <button class="story-more" @click="emit('retry-reading')">重试阅读目录</button></p>

            <!-- A one-episode chapter is the story itself: its actions above already read and play it. -->
            <ol v-if="!chapter.canonicalRelation && !soleEpisode(chapter)" class="episode-list">
              <li v-for="episode in chapter.episodes" :key="episode.id" class="episode-entry">
                <a v-if="readingEntry(episode)" class="episode-reading-main" :href="readingHref(chapter, readingEntry(episode))" :aria-label="`阅读 ${episodeLabel(episode)}`" @click="readEpisode($event, chapter, episode)">
                  <span class="episode-copy"><strong>{{ episodeLabel(episode) }}</strong><small>{{ episode.dialogueCount }} 段对白 · {{ episode.voiceCount }} 段语音</small></span>
                </a>
                <div v-else class="episode-reading-main">
                  <span class="episode-copy"><strong>{{ episodeLabel(episode) }}</strong><small>{{ episode.exists ? '暂无文字版，可观看演出' : '暂未收录' }}</small></span>
                </div>
                <button class="story-icon-action" :disabled="!episode.exists" :aria-label="`播放 ${episodeLabel(episode)}`" :title="`播放 ${episodeLabel(episode)}`" @click.stop="emit('play-episode', { chapter, episode })"><Play :size="17" fill="currentColor" /></button>
              </li>
            </ol>
          </div>
        </li>
      </ol>
    </section>
    <ArchiveTechnicalDetails :key="collection.id" :evidence="collection" />
  </article>
</template>

<script setup>
import { chapterLabel } from '../../presentation/chapterLabel.js'
import { computed, ref, watch } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import CollectionStorySynopsis from './CollectionStorySynopsis.vue'
import { BookOpen, ChevronDown, ChevronRight, ChevronUp, ExternalLink, Play } from '@lucide/vue'
import { buildArchiveUrl, buildArchiveSourceQuery } from '../../core/archiveRoute.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { useReaderTitles } from './useReaderTitles.js'
import {gashaText} from './useArchiveGashaText.js'
import '../../styles/archive-story.css'

const props = defineProps({
  readerSource: { type:Object, default:()=>({}) },
  collection: { type: Object, default: null },
  externalResources: { type: Array, default: () => [] },
  initialChapterId: { type: String, default: '' },
  readingEntries: { type: Array, default: () => [] },
  readingError: { type: String, default: '' },
  loadReadingDocument: Function,
  idolName: { type: Function, default: () => '' },
})
const emit = defineEmits(['read-episode', 'retry-reading', 'play-chapter', 'play-episode', 'select-chapter', 'open-gasha', 'open-idol-story'])
const expandedChapterId = ref('')
const readingByFile = computed(() => { const map = new Map(); for (const entry of props.readingEntries) { if (!entry.source_file) continue; const existing = map.get(entry.source_file); map.set(entry.source_file, existing === undefined ? entry : null) } return map })
const readingStatusNotice = ref('')
const chapterUnit = computed(() => ({ main: '话', birthday: '篇' })[props.collection?.domain] || '章')
// Birthday pages are named after their idol; use the reader's-language name like every other page.
const collectionTitle = computed(() => {
  const subject = props.collection?.subject
  const name = subject?.kind === 'idol' && props.idolName(subject.code)
  return presentProducerAddressingText(name ? `${name} 生日剧情` : props.collection?.title)
})
const episodeLabel = episode => presentIdolEpisodeLabel({ sourceName: episode.label, kind:episode.kind, ordinal:episode.ordinal })
const readingEntry = episode => readingByFile.value.get(episode.file)
// Birthday and extra chapters are each one story; main, unit and personal chapters hold episodes.
const soleEpisode = chapter => chapter.episodes.length === 1 ? chapter.episodes[0] : null
const singleStoryChapters = computed(() => Boolean(props.collection?.chapters?.length) && props.collection.chapters.every(soleEpisode))
function chapterStats(chapter) {
  const episode = soleEpisode(chapter)
  if (!episode) return `${chapter.episodeCount} 段 · ${chapter.voiceCount} 段语音`
  return [episode.dialogueCount && `${episode.dialogueCount} 段对白`, episode.voiceCount && `${episode.voiceCount} 段语音`].filter(Boolean).join(' · ')
}

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
  else readingStatusNotice.value = chapter.exists ? `这一${chapterUnit.value}暂无文字版，可以观看演出。` : `这一${chapterUnit.value}暂未收录。`
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
  readingStatusNotice.value = ''
  const initialChapter = props.collection?.chapters?.find(chapter =>
    chapter.id === props.initialChapterId && chapter.exists,
  )
  expandedChapterId.value = initialChapter?.id ||
    props.collection?.chapters?.find(chapter => chapter.exists)?.id ||
    props.collection?.chapters?.[0]?.id || ''
}, { immediate: true })

function toggleChapter(chapter) {
  readingStatusNotice.value = ''
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
.collection-hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: center; gap: var(--gs-space-8); }
.collection-hero:not(:has(.collection-visual, .collection-avatar)) { grid-template-columns: minmax(0, 1fr); }
.collection-hero:has(.collection-avatar) { grid-template-columns: auto minmax(0, 1fr); gap: var(--gs-space-6); }
.collection-visual { overflow: hidden; border-radius: var(--gs-radius-media); }
.collection-visual img { display: block; width: 100%; height: auto; }
.collection-copy { min-width: 0; }
.collection-copy h2 { overflow-wrap: anywhere; }
.story-footprint .inline-count { margin-inline: var(--gs-space-2); }
.collection-copy .story-note { margin-top: var(--gs-space-4); }
.collection-relations { display: grid; justify-items: start; gap: var(--gs-space-2); margin-top: var(--gs-space-4); }
.collection-relations .story-row { --thumb: 96px; max-width: 480px; border-top: 1px solid var(--gs-line); }
.source-link { display: inline-flex; align-items: center; gap: 6px; min-height: var(--gs-control-compact); color: var(--gs-mint-ink); font-size: var(--gs-text-meta); text-decoration: none; }

.canonical-note { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gs-space-4); margin: var(--gs-space-2) 0 var(--gs-space-4); }
.canonical-note p { flex: 1 1 320px; margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.7; }
.canonical-note strong { display: block; color: var(--gs-ink); }
/* The synopsis is a quotation on the paper: a 2px stage-light rule, no tinted box. */
.chapter-row .chapter-synopsis { --reader-bg-card: transparent; --reader-accent: var(--gs-mint); --reader-text-main: var(--gs-ink-2); margin: var(--gs-space-2) 0 var(--gs-space-4); padding: var(--gs-space-1) 0 var(--gs-space-1) var(--gs-space-5); border-left-width: 2px; border-radius: 0; }
.chapter-row .chapter-synopsis :deep(.synopsis-heading), .chapter-row .chapter-synopsis :deep(strong) { display: none; }
.chapter-row .chapter-synopsis :deep(p) { font-size: var(--gs-text-body); }
@container story-page (max-width: 760px) {
  .collection-hero { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-5); }
  .collection-hero:has(.collection-avatar) { grid-template-columns: auto minmax(0, 1fr); }
}
</style>
