<template>
  <article class="event-story-card" :data-archive-focus-id="`event:${entry.id}`">
    <button class="story-cover" :aria-label="`阅读 ${title}`" @click="emit('read',entry)">
      <EventResourceImage :binding="resource?.storyCover" :name="title" />
      <span v-if="resource?.series" class="story-series">{{ resource.series }}</span>
    </button>
    <div class="story-card-head">
      <div class="story-card-copy">
        <p class="reading-specs">{{ ['最新', entry.eventScopeLabel, `全 ${resource?.episodeCount || 0} 话`].filter(Boolean).join(' · ') }}</p>
        <h3>{{ title }}</h3>
      </div>
      <div class="cast-avatars" aria-label="登场偶像">
        <ArchiveIdolAvatar v-for="idol in cast" :key="idol.code" :idol-code="idol.code" :size="30" :ring-width="0" :gap="0" :alt="idolName(idol.code) || idol.name" :title="idolName(idol.code) || idol.name" />
      </div>
    </div>
    <footer>
      <button class="story-action primary" :disabled="!entry.exists" :aria-label="`开始阅读 ${title}`" @click="emit('read',entry)"><BookOpen :size="15" />开始阅读</button>
      <button v-if="entry.eventRelation" class="event-archive-action" :aria-label="`查看 ${title} 活动档案`" @click="emit('event',entry.eventRelation)"><CalendarRange :size="16" />活动档案</button>
    </footer>
  </article>
</template>
<script setup>
import {computed} from 'vue'
import {BookOpen,CalendarRange} from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import {storyEventResources,storyEventTitle,storyEventCast} from '../../data/eventResourceGraph.js'
import EventResourceImage from './EventResourceImage.vue'
const props=defineProps({entry:Object,idolName:{type:Function,default:()=>''}})
const emit=defineEmits(['read','event'])
const resource=computed(()=>storyEventResources(props.entry))
const title=computed(()=>storyEventTitle(props.entry))
const cast=computed(()=>storyEventCast(resource.value))
</script>
<style scoped>
/* The newest event leads the event section: its key visual, title beside its cast, then the page's one primary action. */
.event-story-card { display: flex; flex-direction: column; min-width: 0; color: var(--gs-ink); }
.story-cover { position: relative; display: block; width: 100%; padding: 0; border: 0; border-radius: var(--gs-radius-media); overflow: hidden; background: var(--gs-line); cursor: pointer; }
.story-cover :deep(.resource-image) { aspect-ratio: 1800 / 960 !important; border-radius: 0; }
.story-cover :deep(img) { object-fit: cover; transition: transform var(--gs-motion-feedback) var(--gs-motion-ease); }
.story-series { position: absolute; top: var(--gs-space-3); left: var(--gs-space-3); padding: 2px var(--gs-space-3); border-radius: var(--gs-radius-control); background: rgb(19 33 58 / 72%); color: #fff; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.story-card-head { display: flex; align-items: center; gap: var(--gs-space-4); padding-top: var(--gs-space-4); }
.story-card-copy { flex: 1; min-width: 0; }
.story-card-copy h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); line-height: 1.4; overflow-wrap: anywhere; }
.reading-specs { margin: 0 0 var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.cast-avatars { display: flex; flex-shrink: 0; align-items: center; }
.cast-avatars > * { border-radius: 50%; box-shadow: 0 0 0 2px var(--gs-paper); }
.cast-avatars > * + * { margin-left: -4px; }
footer { display: flex; align-items: center; gap: var(--gs-space-3); margin-top: var(--gs-space-4); }
.event-archive-action { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); }
@media (hover: hover) {
  .story-cover:hover :deep(img) { transform: scale(1.02); }
  .event-archive-action:hover { color: var(--gs-mint-ink); }
}
button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: 2px; }
@container story-page (max-width: 560px) {
  .story-card-copy h3 { font-size: var(--gs-text-subtitle); }
  .event-archive-action { min-height: var(--gs-control-touch); }
}
@media (prefers-reduced-motion: reduce) { .story-cover :deep(img) { transition: none; } }
</style>
