<template>
  <!-- One story on the story-family programme layout: text and actions first with the cover
       beside them, then hairline sections for play entries, cast and the rest of the chapter. -->
  <article v-if="story" class="story-detail story-page" data-archive-scroll-container>
    <header class="story-head detail-head" :class="{ 'no-cover': !visualUrl }">
      <div class="detail-lead">
        <p class="detail-kicker">{{ hierarchyLabel }}</p>
        <h2 :class="{ 'is-title-pending': titlePending }">{{ title }}</h2>
        <ul class="story-footprint" aria-label="收录">
          <li :class="{ missing: !story.exists }">{{ story.exists ? '已收录' : '暂未收录' }}</li>
          <li v-if="story.rowCount > 1"><b>{{ story.rowCount }}</b>段</li>
          <li v-if="releaseDate">{{ releaseDate }} 开放</li>
        </ul>

        <CollectionStorySynopsis v-if="story.preplaySynopsis || primaryReading" :key="story.id" class="detail-synopsis"
          :entry="primaryReading" :load-document="loadReadingDocument" :fallback="story.preplaySynopsis" :title="story.preplaySynopsis?.title || story.title" />

        <div class="detail-actions" aria-label="观看方式">
          <button v-if="primaryReading" type="button" class="story-action primary" @click="emit('read', primaryReading.document_id)">
            <BookOpen :size="16" />{{ availableReading.length > 1 ? '阅读正文' : '阅读本篇' }}
          </button>
          <button type="button" class="story-action" :class="{ primary: !availableReading.length }" :disabled="!story.exists" @click="emit('play', story)">
            <Play :size="15" fill="currentColor" />{{ story.exists ? '播放演出' : '缺少剧情文件' }}
          </button>
          <a
            v-for="resource in externalResources"
            :key="resource.external_id"
            class="story-action"
            :href="resource.platform.canonical_url"
            target="_blank"
            rel="noopener noreferrer external"
            :title="`在 Bilibili 观看 ${resource.uploader.name} 投稿的社区中文资源`"
          >
            <ExternalLink :size="15" />社区中文资源 · {{ resource.uploader.name }}
          </a>
        </div>
        <p v-if="story.preplaySynopsis && story.exists" class="story-note">演出从正式标题开始播放。</p>
      </div>

      <figure v-if="visualUrl" class="detail-cover">
        <img :src="visualUrl" alt="" decoding="async" />
      </figure>
    </header>

    <section v-if="story.titleCards?.length > 1" class="story-section" aria-labelledby="story-detail-entries">
      <div class="story-section-head"><h3 id="story-detail-entries">正式播放入口</h3><small>{{ story.titleCards.length }} 个</small></div>
      <ol class="episode-list">
        <li v-for="(card, index) in story.titleCards" :key="`${card.episode_index}-${index}`" class="episode-entry">
          <div class="episode-reading-main">
            <span class="episode-copy">
              <strong>{{ card.title ? presentProducerAddressingText(card.title) : title }}</strong>
              <small>{{ presentIdolEpisodeLabel({ sourceName: card.label }) || `第 ${index + 1} 个入口` }}</small>
            </span>
          </div>
        </li>
      </ol>
    </section>

    <section v-if="characters.length" class="story-section" aria-labelledby="story-detail-cast">
      <div class="story-section-head"><h3 id="story-detail-cast">登场角色</h3><small>{{ characters.length }} 位</small></div>
      <ul class="detail-cast">
        <li v-for="reference in characterReferences" :key="reference.idolCode">
          <ArchiveIdolReference :reference="reference" @open="emit('open-idol', $event)" />
        </li>
      </ul>
    </section>

    <section v-if="relatedStories.length" class="story-section" aria-labelledby="story-detail-related">
      <div class="story-section-head"><h3 id="story-detail-related">{{ collectionTitle }}</h3><small>{{ relatedStories.length }} 篇</small></div>
      <ul class="story-rows">
        <li v-for="entry in relatedStories" :key="entry.id">
          <button
            type="button"
            class="story-row no-thumb"
            :class="{ current: entry.id === story.id }"
            :aria-current="entry.id === story.id ? 'page' : undefined"
            @click="emit('select', entry)"
          >
            <span class="story-row-copy">
              <strong :class="{ 'is-title-pending': relatedTitlePending(entry) }">{{ relatedTitle(entry) }}</strong>
              <small>{{ presentIdolEpisodeLabel({ sourceName: entry.episodeLabel }) || entry.domainLabel }}<template v-if="entry.id === story.id"> · 当前</template></small>
            </span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>

    <ArchiveTechnicalDetails :key="story.id" :evidence="story">
      <section class="source-strip">
        <span>Raw masterdata + compiled scenario</span>
        <code>{{ story.file }}</code>
      </section>
    </ArchiveTechnicalDetails>
  </article>
</template>

<script setup>
import { chapterLabel } from '../../presentation/chapterLabel.js'
import { computed } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import { buildIdolReference } from '../../presentation/IdolReferencePresentation.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { BookOpen, ChevronRight, ExternalLink, Play } from '@lucide/vue'
import CollectionStorySynopsis from './CollectionStorySynopsis.vue'
import { useReaderTitles, useStoryTitles } from './useReaderTitles.js'
import '../../styles/archive-story.css'

const props = defineProps({
  story: { type: Object, default: null }, related: { type: Array, default: () => [] },
  visualUrl: { type: String, default: '' }, idolName: { type: Function, required: true },
  identity: { type: Object, default: null }, manifest: { type: Object, default: null },
  projectedCastReferences: { type: Array, default: null },
  externalResources: { type: Array, default: () => [] },
  readingEntries: { type: Array, default: () => [] },
  loadReadingDocument: Function,
})
const emit = defineEmits(['play', 'select', 'open-idol', 'read'])
const availableReading = computed(() => props.readingEntries.filter(entry => entry.status === 'ready' &&
  (entry.source_file === props.story?.file || entry.parent_file === props.story?.file)))
const primaryReading = computed(() => availableReading.value[0] || null)
// Titles and the synopsis go through the reader translations like the collection page; a title still
// waiting for its translation keeps its place hidden instead of flashing the source.
const displayTitle = useReaderTitles()
const title = computed(() => presentProducerAddressingText(displayTitle(primaryReading.value, props.story?.title || '')))
const titlePending = computed(() => displayTitle.pending(primaryReading.value))
const readingByFile = computed(() => {
  const map = new Map()
  for (const entry of props.readingEntries) if (entry.status === 'ready' && entry.source_file && !map.has(entry.source_file)) map.set(entry.source_file, entry)
  return map
})
const readingFor = entry => entry.file === props.story?.file ? primaryReading.value : readingByFile.value.get(entry.file) || null
// The detail read model carries reading entries for this story only; siblings fall back to the title
// index by story file, as the portal does.
const storyTitle = useStoryTitles()
const relatedTitle = entry => {
  const reading = readingFor(entry)
  return presentProducerAddressingText(reading ? displayTitle(reading, entry.title) : storyTitle(entry.file, entry.title))
}
const relatedTitlePending = entry => {
  const reading = readingFor(entry)
  return reading ? displayTitle.pending(reading) : storyTitle.pending(null)
}
const hierarchyLabel = computed(() => [props.story?.domainLabel, props.story?.sectionLabel && chapterLabel(props.story.sectionLabel),
  presentIdolEpisodeLabel({ sourceName: props.story?.episodeLabel })].filter(Boolean).join(' · '))
const releaseDate = computed(() => props.story?.releaseAt >= 1577836800 ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' }).format(new Date(props.story.releaseAt * 1000)) : '')
const characters = computed(() => (props.story?.characters || []).filter(character => /^\d{3}[a-z0-9]{3}$/i.test(character)))
// Names follow the interface language (idolName); the projected references carry source names.
const characterReferences = computed(() => (props.projectedCastReferences || characters.value.map(character =>
  buildIdolReference(character, props.identity, props.manifest, `story:${props.story?.file || ''}`)))
  .map(reference => reference.actionable ? { ...reference, displayName: props.idolName(reference.idolCode) || reference.displayName } : reference))
const relatedStories = computed(() => props.related.slice(0, 24))
const collectionTitle = computed(() => props.story?.sectionLabel ? `${chapterLabel(props.story.sectionLabel)}的故事` : '同类故事')
</script>

<style scoped>
/* Head, sections, rows, actions and episode rows come from archive-story.css; only the
   lead/cover split, the synopsis quotation and the cast list are particular to this page. */
.is-title-pending { visibility: hidden; }
.detail-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 340px); align-items: start; gap: var(--gs-space-8); }
.detail-lead { min-width: 0; }
.detail-kicker { margin: 0 0 var(--gs-space-2); color: var(--gs-mint-ink); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.detail-head h2 { overflow-wrap: anywhere; }
.story-footprint .missing { color: var(--gs-ink-3); font-weight: var(--gs-weight-semibold); }
/* The synopsis is a quotation on the paper: a 2px mint rule, no tinted card (same as the collection page). */
.detail-synopsis { --reader-bg-card: transparent; --reader-accent: var(--gs-mint); --reader-text-main: var(--gs-ink-2); max-width: 46em; margin: var(--gs-space-6) 0 0; padding: var(--gs-space-1) 0 var(--gs-space-1) var(--gs-space-5); border-left-width: 2px; border-radius: 0; }
.detail-synopsis :deep(.synopsis-heading), .detail-synopsis :deep(strong) { display: none; }
.detail-synopsis :deep(p) { font-size: var(--gs-text-body); line-height: 1.85; }
.detail-actions { display: flex; flex-wrap: wrap; gap: var(--gs-space-3); margin: var(--gs-space-6) 0 var(--gs-space-3); }
/* Media role: the banner at its own proportions, no grey letterbox behind it. */
.detail-cover { margin: 0; }
.detail-cover img { display: block; width: 100%; height: auto; border-radius: var(--gs-radius-media); }
.detail-head.no-cover { grid-template-columns: minmax(0, 1fr); }
.detail-cast { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); column-gap: var(--gs-space-6); margin: 0; padding: 0; list-style: none; }
.story-row.current { box-shadow: inset 3px 0 var(--gs-mint); padding-left: var(--gs-space-4); }
.story-row.current .story-row-copy strong { color: var(--gs-mint-ink); }
.source-strip { display: flex; justify-content: space-between; gap: var(--gs-space-4); color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.source-strip code { overflow-wrap: anywhere; text-align: right; }
@container story-page (max-width: 760px) {
  .detail-head { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-5); }
  .detail-cover { grid-row: 1; }
  .detail-actions > * { flex: 1 1 140px; }
  .source-strip { flex-direction: column; }
  .source-strip code { text-align: left; }
}
</style>
