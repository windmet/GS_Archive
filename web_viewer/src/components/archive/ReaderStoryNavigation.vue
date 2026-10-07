<template>
  <div class="reader-story-navigation">
    <nav v-if="segments.length" aria-label="本话阅读目录" class="reader-episode-directory">
      <button v-for="segment in segments" :key="segment.episodeKey || segment.documentId" :aria-label="`${presentIdolEpisodeLabel({ sourceName: segment.label })}${statusLabel(segment.status) ? ` · ${statusLabel(segment.status)}` : ''}`" :title="statusLabel(segment.status) || undefined" :aria-current="(segment.documentId || segment.episodeKey) === documentId ? 'location' : undefined" :disabled="!segment.documentId && !allowUnlinked" @click="emit('select', segment)">
        <span>{{ presentIdolEpisodeLabel({ sourceName: segment.label, format:'reader' }) }}</span><i v-if="segment.status !== 'ready'" :class="`status-${segment.status}`" aria-hidden="true"></i>
      </button>
    </nav>
    <details v-if="chapterNavigation?.chapters.length > 1" :open="expandChapters" class="reader-chapter-picker" :class="{'expanded-chapters':expandChapters}">
      <summary>切换话目</summary>
      <nav aria-label="其他话目" class="reader-chapter-list">
        <button v-for="chapter in chapterNavigation.chapters" :key="chapter.id" :data-chapter-id="chapter.id" :aria-current="chapter.id === chapterNavigation.chapterId ? 'page' : undefined" :disabled="!chapter.documentId || !chapter.storyFile" @click="emit('chapter', chapter.id)">{{ chapterLabel(chapter.label) }} · {{ presentProducerAddressingText(displayTitle({document_id:chapter.documentId,sha256:chapter.revision},chapter.title)) }}{{ chapter.documentId ? '' : '（暂无阅读正文）' }}</button>
      </nav>
    </details>
  </div>
</template>
<script setup>
import { chapterLabel } from '../../presentation/chapterLabel.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { useReaderTitles } from './useReaderTitles.js'
const displayTitle = useReaderTitles()
defineProps({ segments:{type:Array,default:()=>[]}, documentId:String, chapterNavigation:{type:Object,default:null}, allowUnlinked:Boolean, expandChapters:Boolean })
const emit = defineEmits(['select','chapter'])
function statusLabel(status) { return ({idle:'待载入',loading:'载入中',error:'载入失败',unsupported:'暂不支持',empty:'无正文','not-generated':'未生成'})[status] || '' }
</script>
<style scoped>
.reader-story-navigation { margin:12px 0; }
.reader-chapter-picker { margin-top:20px; color:var(--reader-text-sub); font-size:14px; }
.expanded-chapters { margin-top:0; }
.expanded-chapters > summary { display:none; }
summary { cursor:pointer; padding:12px 0; min-height:20px; }
.reader-chapter-list { display:grid; gap:6px; margin-top:8px; }
.reader-chapter-list button { text-align:left; padding:10px 12px; overflow-wrap:anywhere; }
.reader-episode-directory { display:grid; grid-template-columns:repeat(10,minmax(0,1fr)); gap:8px; margin-top:16px; }
button { position:relative; min-height:44px; padding:8px 4px; border:1px solid var(--reader-border); border-radius:6px; background:var(--reader-bg-card); color:var(--reader-accent-text); font:inherit; font-size:14px; font-variant-numeric:tabular-nums; cursor:pointer; }
button[aria-current] { background:var(--reader-active); color:var(--reader-on-accent); }
button:disabled { opacity:.5; cursor:default; }
button:focus-visible,select:focus-visible { outline:2px solid var(--reader-accent-text); outline-offset:3px; }
i { position:absolute; width:5px; height:5px; top:5px; right:5px; border-radius:50%; background:var(--reader-text-sub); }
.status-error { background:#ba6659; }
@media(max-width:1100px) { .reader-episode-directory { grid-template-columns:repeat(5,minmax(0,1fr)); } }
@media(max-width:760px) { .reader-episode-directory { gap:6px; } button { font-size:13px; } }
</style>
