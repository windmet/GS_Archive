<template>
  <article v-if="collection" class="story-collection">
    <header class="collection-hero">
      <div class="collection-visual" :class="`domain-${collection.domain}`">
        <img v-if="collection.visualUrl" :src="collection.visualUrl" :alt="collection.title" />
        <div v-else class="visual-fallback"><BookOpen :size="42" /></div>
      </div>
      <div class="collection-copy">
        <span>{{ collection.eyebrow }}</span>
        <h2>{{ collection.title }}</h2>
        <p>{{ collection.description }}</p>
        <dl>
          <div><dt>正式话目</dt><dd>{{ collection.playableChapterCount }} / {{ collection.chapterCount }}</dd></div>
          <div><dt>剧情分段</dt><dd>{{ collection.playableEpisodeCount }} / {{ collection.episodeCount }}</dd></div>
          <div v-if="releaseDate"><dt>开放时间</dt><dd>{{ releaseDate }}</dd></div>
        </dl>
      </div>
    </header>

    <section class="chapter-section">
      <div class="section-heading">
        <div><span>CHAPTERS</span><h3>{{ collection.domainLabel }}</h3></div>
        <strong>{{ collection.chapterCount }} chapters</strong>
      </div>

      <div class="chapter-list">
        <section
          v-for="(chapter, chapterIndex) in collection.chapters"
          :key="chapter.id"
          class="chapter-row"
          :class="{ expanded: expandedChapterId === chapter.id, unavailable: !chapter.exists }"
        >
          <div class="chapter-summary">
            <button class="chapter-toggle" :aria-expanded="expandedChapterId === chapter.id" @click="toggleChapter(chapter.id)">
              <span class="chapter-number">{{ String(chapterIndex + 1).padStart(2, '0') }}</span>
              <span class="chapter-identity">
                <small>{{ chapter.label }}</small>
                <strong>{{ chapter.title }}</strong>
              </span>
              <span class="chapter-stats">
                <small>{{ chapter.episodeCount }} episodes</small>
                <small>{{ chapter.voiceCount }} voices</small>
              </span>
              <ChevronUp v-if="expandedChapterId === chapter.id" :size="18" />
              <ChevronDown v-else :size="18" />
            </button>
            <button class="chapter-play" :disabled="!chapter.exists" :title="chapter.exists ? '播放整话' : '剧情文件未实装'" @click="emit('play-chapter', chapter)">
              <Play :size="17" fill="currentColor" />
              <span>{{ chapter.exists ? '播放' : '未实装' }}</span>
            </button>
          </div>

          <div v-if="expandedChapterId === chapter.id" class="chapter-panel">
            <div v-if="externalResourcesForChapter(chapter.id).length" class="chapter-external-resources">
              <a
                v-for="resource in externalResourcesForChapter(chapter.id)"
                :key="resource.external_id"
                :href="resource.platform.canonical_url"
                target="_blank"
                rel="noopener noreferrer external"
              >
                <ExternalLink :size="16" />
                <span><strong>社区中文资源</strong><small>{{ resource.uploader.name }} · Bilibili</small></span>
              </a>
            </div>

            <div v-if="chapter.synopsis" class="chapter-synopsis">
              <span>STORY</span>
              <strong>{{ chapter.synopsis.title || chapter.title }}</strong>
              <p>{{ chapter.synopsis.text }}</p>
            </div>
            <p v-else-if="!chapter.exists" class="chapter-unavailable">该话目保留于 masterdata，但没有可播放的编译剧情。</p>

            <div class="episode-grid">
              <button
                v-for="(episode, episodeIndex) in chapter.episodes"
                :key="episode.id"
                :disabled="!episode.exists"
                @click="emit('play-episode', { chapter, episode })"
              >
                <span class="episode-number">{{ String(episodeIndex + 1).padStart(2, '0') }}</span>
                <span class="episode-copy">
                  <strong>{{ episode.label }}</strong>
                  <small>{{ episode.dialogueCount }} dialogues · {{ episode.voiceCount }} voices</small>
                </span>
                <Play v-if="episode.exists" :size="15" fill="currentColor" />
                <span v-else class="episode-lock">－</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, Play } from '@lucide/vue'

const props = defineProps({
  collection: { type: Object, default: null },
  externalResources: { type: Array, default: () => [] },
})
const emit = defineEmits(['play-chapter', 'play-episode'])
const expandedChapterId = ref('')

const releaseDate = computed(() => {
  const timestamp = Number(props.collection?.releaseAt || 0)
  if (timestamp < 1577836800) return ''
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(timestamp * 1000))
})

watch(() => props.collection?.id, () => {
  expandedChapterId.value = props.collection?.chapters?.find(chapter => chapter.exists)?.id || props.collection?.chapters?.[0]?.id || ''
}, { immediate: true })

function toggleChapter(chapterId) {
  expandedChapterId.value = expandedChapterId.value === chapterId ? '' : chapterId
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
.collection-visual img { display: block; width: 100%; height: 100%; object-fit: contain; }
.visual-fallback { display: grid; place-items: center; width: 100%; height: 100%; background: url('/assets/stories/story_background.png') center / cover; color: #16877f; }
.collection-copy { align-self: center; min-width: 0; }
.collection-copy > span, .section-heading span, .chapter-synopsis > span { color: #168a82; font-size: .59rem; font-weight: 800; }
.collection-copy h2 { margin: 5px 0 10px; font-size: 1.45rem; line-height: 1.35; }
.collection-copy > p { margin: 0 0 18px; color: #53636b; font-size: .7rem; line-height: 1.75; }
.collection-copy dl { margin: 0; }
.collection-copy dl div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; padding: 7px 0; border-bottom: 1px solid #edf0f1; font-size: .64rem; }
.collection-copy dt { color: #89959b; }.collection-copy dd { margin: 0; color: #33464f; }
.chapter-section { padding: 24px max(24px, calc((100% - 1120px) / 2)) 40px; background: #f7f9fa; }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 13px; }
.section-heading h3 { margin: 3px 0 0; font-size: 1rem; }.section-heading > strong { color: #7d8b92; font-size: .61rem; }
.chapter-list { border-top: 1px solid #dbe2e4; background: #fff; }
.chapter-row { border-bottom: 1px solid #dbe2e4; }.chapter-row.expanded { box-shadow: inset 3px 0 #38a89f; }.chapter-row.unavailable { background: #fafbfb; }
.chapter-summary { display: grid; grid-template-columns: minmax(0, 1fr) 92px; min-height: 72px; }
.chapter-toggle { display: grid; grid-template-columns: 44px minmax(0, 1fr) 150px 22px; align-items: center; gap: 12px; min-width: 0; padding: 10px 16px; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.chapter-toggle:hover { background: #f4faf9; }.chapter-number { color: #159087; font-size: .72rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.chapter-identity { display: flex; flex-direction: column; gap: 4px; min-width: 0; }.chapter-identity small { color: #16837c; font-size: .57rem; }.chapter-identity strong { overflow: hidden; font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
.chapter-stats { display: flex; gap: 12px; color: #849097; font-size: .58rem; }.chapter-toggle > svg { color: #75858c; }
.chapter-play { display: inline-flex; align-items: center; justify-content: center; gap: 6px; margin: 14px 14px 14px 0; border: 1px solid #159087; border-radius: 5px; background: #159087; color: #fff; cursor: pointer; font: inherit; font-size: .64rem; }
.chapter-play:disabled { border-color: #d3dade; background: #e4e9eb; color: #78858b; cursor: not-allowed; }
.chapter-panel { padding: 5px 16px 18px 72px; border-top: 1px solid #edf1f2; background: #fbfcfc; }
.chapter-external-resources { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 14px; }
.chapter-external-resources a { display: inline-flex; align-items: center; gap: 8px; min-width: 210px; padding: 8px 11px; border: 1px solid #b9ddd9; border-radius: 5px; background: #f0faf8; color: #126e68; text-decoration: none; }
.chapter-external-resources a:hover { border-color: #16877f; background: #e5f6f3; }
.chapter-external-resources a > span { display: flex; flex-direction: column; gap: 2px; }
.chapter-external-resources strong { font-size: .64rem; }.chapter-external-resources small { color: #5f7775; font-size: .53rem; }
.chapter-synopsis { padding: 14px 0 16px; }.chapter-synopsis strong { display: block; margin: 5px 0 6px; font-size: .75rem; }.chapter-synopsis p { max-width: 820px; margin: 0; color: #4b5d65; font-size: .66rem; line-height: 1.75; white-space: pre-line; }
.chapter-unavailable { margin: 14px 0; color: #78858b; font-size: .65rem; }
.episode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #dfe6e8; }
.episode-grid button { display: grid; grid-template-columns: 34px minmax(0, 1fr) 18px; align-items: center; gap: 8px; min-height: 54px; padding: 8px 11px; border: 0; background: #fff; color: #2d3d45; cursor: pointer; font: inherit; text-align: left; }
.episode-grid button:hover:not(:disabled) { background: #edf8f7; }.episode-grid button:disabled { background: #f4f6f7; color: #929da2; cursor: not-allowed; }
.episode-number { color: #16877f; font-size: .59rem; font-weight: 800; font-variant-numeric: tabular-nums; }.episode-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.episode-copy strong { font-size: .67rem; }.episode-copy small { color: #87949a; font-size: .53rem; }.episode-grid svg { color: #159087; }.episode-lock { text-align: center; }
@media (max-width: 840px) { .collection-hero { grid-template-columns: 1fr; gap: 18px; }.collection-visual { max-width: 720px; }.chapter-toggle { grid-template-columns: 38px minmax(0, 1fr) 22px; }.chapter-stats { display: none; } }
@media (max-width: 620px) { .collection-hero { padding: 15px 12px 18px; }.collection-copy h2 { font-size: 1.14rem; }.chapter-section { padding: 18px 10px 30px; }.chapter-summary { grid-template-columns: minmax(0, 1fr) 78px; }.chapter-toggle { grid-template-columns: 30px minmax(0, 1fr) 18px; gap: 7px; padding: 9px 8px; }.chapter-play { margin: 13px 8px 13px 0; }.chapter-play span { font-size: .58rem; }.chapter-panel { padding: 4px 8px 12px; }.episode-grid { grid-template-columns: 1fr; }.section-heading > strong { display: none; } }
</style>
