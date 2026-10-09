<template>
  <button class="story-row event-story-row" :data-archive-focus-id="`event:${entry.id}`" :disabled="!entry.exists" :aria-label="`阅读 ${title}`" @click="emit('read',entry)">
    <span class="story-row-thumb">
      <img v-if="resource?.thumbnail" :src="resource.thumbnail.url" alt="" :width="resource.thumbnail.width" :height="resource.thumbnail.height" loading="lazy" decoding="async" />
      <BookOpen v-else :size="20" aria-hidden="true" />
    </span>
    <span class="story-row-copy">
      <strong>{{ title }}</strong>
      <small>{{ [resource?.series, `全 ${resource?.episodeCount || 0} 话`].filter(Boolean).join(' · ') }}</small>
      <span class="cast-avatars" :aria-label="`登场偶像：${cast.map(idol => idolName(idol.code) || idol.name).join('、')}`">
        <ArchiveIdolAvatar v-for="idol in cast" :key="idol.code" :idol-code="idol.code" :size="22" :ring-width="0" :gap="0" decorative />
      </span>
    </span>
    <ChevronRight :size="18" aria-hidden="true" />
  </button>
</template>
<script setup>
import {computed} from 'vue'
import {BookOpen,ChevronRight} from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import {storyEventResources,storyEventTitle,storyEventCast} from '../../data/eventResourceGraph.js'
const props=defineProps({entry:Object,idolName:{type:Function,default:()=>''}})
const emit=defineEmits(['read'])
const resource=computed(()=>storyEventResources(props.entry))
const title=computed(()=>storyEventTitle(props.entry))
const cast=computed(()=>storyEventCast(resource.value))
</script>
<style scoped>
/* A compact event row beside the lead: the 2:1 event strip, title, series and cast. */
.story-row.event-story-row { --thumb: 128px; padding-block: var(--gs-space-3); }
.event-story-row .story-row-thumb { aspect-ratio: 2 / 1; }
.event-story-row .story-row-copy strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cast-avatars { display: flex; align-items: center; margin-top: var(--gs-space-1); }
.cast-avatars > * { border-radius: 50%; box-shadow: 0 0 0 2px var(--gs-paper); }
.cast-avatars > * + * { margin-left: -4px; }
@container story-page (max-width: 560px) { .story-row.event-story-row { --thumb: 96px; } }
</style>
