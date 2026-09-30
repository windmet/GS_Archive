<template>
  <div class="reader-story-navigation">
    <label v-if="chapterNavigation?.chapters.length > 1" class="reader-chapter-picker">切换话目
      <select :value="chapterNavigation.chapterId" @change="emit('chapter', $event.target.value)">
        <option v-for="chapter in chapterNavigation.chapters" :key="chapter.id" :value="chapter.id" :disabled="!chapter.documentId || !chapter.storyFile">{{ chapter.label }} · {{ presentProducerAddressingText(chapter.title) }}{{ chapter.documentId ? '' : '（暂无阅读正文）' }}</option>
      </select>
    </label>
    <nav v-if="segments.length" aria-label="本话阅读目录" class="reader-episode-directory">
      <button v-for="segment in segments" :key="segment.episodeKey || segment.documentId" :aria-label="`${presentIdolEpisodeLabel({ sourceName: segment.label })}${statusLabel(segment.status) ? ` · ${statusLabel(segment.status)}` : ''}`" :title="statusLabel(segment.status) || undefined" :aria-current="segment.documentId === documentId ? 'location' : undefined" :disabled="!segment.documentId && !allowUnlinked" @click="emit('select', segment)">
        <span>{{ presentIdolEpisodeLabel({ sourceName: segment.label, format:'reader' }) }}</span><i v-if="segment.status !== 'ready'" :class="`status-${segment.status}`" aria-hidden="true"></i>
      </button>
    </nav>
  </div>
</template>
<script setup>
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
defineProps({ segments:{type:Array,default:()=>[]}, documentId:String, chapterNavigation:{type:Object,default:null}, allowUnlinked:Boolean })
const emit = defineEmits(['select','chapter'])
function statusLabel(status) { return ({idle:'待载入',loading:'载入中',error:'载入失败',unsupported:'暂不支持',empty:'无正文','not-generated':'未生成'})[status] || '' }
</script>
<style scoped>
.reader-story-navigation { margin:20px 0; }
.reader-chapter-picker { display:flex; align-items:center; gap:12px; color:var(--reader-text-sub); font-size:14px; }
select { box-sizing:border-box; min-width:0; width:min(100%,540px); flex:1; min-height:44px; padding:10px 12px; border:1px solid var(--reader-border); border-radius:6px; background:var(--reader-bg-card); color:var(--reader-text-main); font:inherit; cursor:pointer; }
.reader-episode-directory { display:grid; grid-template-columns:repeat(10,minmax(0,1fr)); gap:8px; margin-top:16px; }
button { position:relative; min-height:44px; padding:8px 4px; border:1px solid var(--reader-border); border-radius:6px; background:var(--reader-bg-card); color:var(--reader-accent-text); font:inherit; font-size:14px; font-variant-numeric:tabular-nums; cursor:pointer; }
button[aria-current] { background:var(--reader-active); color:var(--reader-on-accent); }
button:disabled { opacity:.5; cursor:default; }
button:focus-visible,select:focus-visible { outline:2px solid var(--reader-accent-text); outline-offset:3px; }
i { position:absolute; width:5px; height:5px; top:5px; right:5px; border-radius:50%; background:var(--reader-text-sub); }
.status-error { background:#ba6659; }
@media(max-width:1100px) { .reader-episode-directory { grid-template-columns:repeat(5,minmax(0,1fr)); } }
@media(max-width:760px) { .reader-chapter-picker { align-items:stretch; flex-direction:column; gap:6px; } select { width:100%; flex:auto; } .reader-episode-directory { gap:6px; } button { font-size:13px; } }
</style>
