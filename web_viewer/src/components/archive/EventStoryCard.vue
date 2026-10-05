<template>
  <article class="event-story-card" :data-archive-focus-id="`event:${entry.id}`">
    <button class="story-cover" :aria-label="`阅读 ${title}`" @click="emit('read',entry)">
      <EventResourceImage :binding="resource?.storyCover" :name="title" />
      <span v-if="resource?.series" class="story-series">{{ resource.series }}</span>
    </button>
    <button class="story-card-copy" :disabled="!entry.exists" :aria-label="`开始阅读 ${title}`" @click="emit('read',entry)">
      <h3>{{ title }}</h3>
      <p class="reading-specs">{{ entry.eventScopeLabel || '活动剧情' }} · 全 {{ resource?.episodeCount || 0 }} 话</p>
      <div class="cast-avatars" aria-label="登场偶像">
        <img v-for="idol in cast" :key="idol.code" :src="getCharaIconUrl(idol.code)" :alt="idolName(idol.code) || idol.name" :title="idolName(idol.code) || idol.name" loading="lazy" width="28" height="28" />
      </div>
    </button>
    <footer><button :disabled="!entry.exists" @click="emit('read',entry)"><BookOpen :size="15" />开始阅读</button><button v-if="entry.eventRelation" class="event-archive-action" :aria-label="`查看 ${title} 活动档案`" title="查看活动档案" @click="emit('event',entry.eventRelation)"><CalendarRange :size="17" /></button></footer>
  </article>
</template>
<script setup>
import {computed} from 'vue'
import {BookOpen,CalendarRange} from '@lucide/vue'
import {getCharaIconUrl} from '../../utils/AssetResolver.js'
import {storyEventResources,storyIdolRoster} from '../../data/eventResourceGraph.js'
import EventResourceImage from './EventResourceImage.vue'
const props=defineProps({entry:Object,idolName:{type:Function,default:()=>''}})
const emit=defineEmits(['read','event'])
const resource=computed(()=>storyEventResources(props.entry))
const title=computed(()=>props.entry.title.replace(/^GROWING (SIGN@L|SELECTION)\s*-\s*/,'').replace(/-$/,''))
const cast=computed(()=>(resource.value?.storyCast||[]).map(code=>storyIdolRoster.find(idol=>idol.code===code)).filter(Boolean))
</script>
<style scoped>
/* Event story tile: the key visual leads, copy and actions sit beneath it on paper. */
.event-story-card { display: flex; flex-direction: column; min-width: 0; color: var(--gs-ink); }
.story-cover { position: relative; display: block; width: 100%; padding: 0; border: 0; border-radius: var(--gs-radius-media); overflow: hidden; background: var(--gs-line); cursor: pointer; }
.story-cover :deep(.resource-image) { aspect-ratio: 16 / 9 !important; border-radius: 0; }
.story-cover :deep(img) { object-fit: cover; transition: transform var(--gs-motion-feedback) var(--gs-motion-ease); }
.story-series { position: absolute; top: var(--gs-space-3); left: var(--gs-space-3); padding: 2px var(--gs-space-3); border-radius: var(--gs-radius-control); background: rgb(19 33 58 / 72%); color: #fff; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.story-card-copy { display: block; width: 100%; padding: var(--gs-space-4) 0 var(--gs-space-3); border: 0; background: none; color: inherit; text-align: left; cursor: pointer; }
.story-card-copy h3 { margin: 0 0 var(--gs-space-2); font-family: var(--gs-font-jp); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); line-height: 1.5; overflow-wrap: anywhere; }
.reading-specs { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.cast-avatars { display: flex; align-items: center; margin-top: var(--gs-space-3); }
.cast-avatars img { width: 28px; height: 28px; margin-left: -4px; border: 2px solid var(--gs-paper); border-radius: 50%; background: var(--gs-line); object-fit: cover; }
.cast-avatars img:first-child { margin-left: 0; }
.cast-avatars small { margin-left: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.cast-names { margin: var(--gs-space-2) 0 0; color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.7; overflow-wrap: anywhere; }
footer { display: flex; align-items: center; gap: var(--gs-space-2); margin-top: auto; padding-top: var(--gs-space-3); border-top: 1px solid var(--gs-line); }
footer button { display: flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
footer > button:first-child { padding-left: 0; }
footer .event-archive-action { margin-left: auto; color: var(--gs-ink-3); }
@media (hover: hover) {
  .event-story-card:hover .story-cover :deep(img) { transform: scale(1.02); }
  .event-story-card:hover h3 { color: var(--gs-mint-ink); }
  footer button:hover { background: var(--gs-mint-wash); }
}
button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: 2px; }
button:disabled { opacity: .5; cursor: default; }
@media (prefers-reduced-motion: reduce) { .story-cover :deep(img) { transition: none; } }
</style>
