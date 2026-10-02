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
.event-story-card{display:flex;flex-direction:column;min-width:0;overflow:hidden;border:1px solid #dfe6e8;border-radius:8px;background:#fff;transition:box-shadow .15s,border-color .15s}.event-story-card:hover{border-color:#8abfb9;box-shadow:0 4px 16px #233e4814}.story-cover{position:relative;display:block;width:100%;padding:0;border:0;background:#eef2f3;cursor:pointer}.story-cover :deep(.resource-image){aspect-ratio:16/9!important;border-radius:0}.story-cover :deep(img){object-fit:cover}.story-series{position:absolute;top:10px;left:10px;padding:4px 7px;background:#152f41cc;border-radius:4px;color:#fff;font-size:10px;font-weight:600;letter-spacing:.035em}.story-card-copy{padding:13px 14px 12px;flex:1}.story-card-copy h3{margin:0 0 7px;font-size:15px;line-height:1.5;overflow-wrap:anywhere}.reading-specs{margin:0;color:#667b82;font-size:11px}.cast-avatars{display:flex;align-items:center;gap:5px;margin-top:13px}.cast-avatars img{border-radius:50%;background:#e9eeee;border:1px solid #e0e7e9;object-fit:cover}.cast-avatars small{font-size:11px;color:#60777b}.cast-names{margin:7px 0 0;color:#576c75;font-size:11px;line-height:1.7;overflow-wrap:anywhere}footer{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:10px 14px;border-top:1px solid #eef1f2}footer button{display:flex;align-items:center;gap:5px;min-height:32px;padding:5px 8px;border:0;border-radius:4px;background:#e9f5f3;color:#187e76;font-size:12px;cursor:pointer}footer button+button{background:none;color:#657d82;font-size:11px}button:focus-visible{outline:2px solid #158d85;outline-offset:-2px}button:disabled{opacity:.5;cursor:default}
</style>
<style scoped>
.event-story-card{border-radius:12px;box-shadow:0 2px 8px #203d4508;transition:transform .2s,box-shadow .2s}.event-story-card:hover{transform:translateY(-2px);box-shadow:0 7px 18px #203d4512}.story-series{background:#15273da6;backdrop-filter:blur(6px);border:1px solid #ffffff20;border-radius:6px}.story-card-copy{display:block;width:100%;border:0;background:#fff;text-align:left;color:#26343c;cursor:pointer;padding:12px 14px;min-height:105px}.story-card-copy h3{font-weight:650;margin-bottom:5px}.cast-avatars{gap:0;margin-top:10px}.cast-avatars img{width:28px;height:28px;border:2px solid #fff;margin-left:-4px}.cast-avatars img:first-child{margin-left:0}footer{padding:7px 12px;background:#fafcfc}footer>button:first-child{flex:1;justify-content:center;background:transparent}footer .event-archive-action{min-width:34px;min-height:34px;border-left:1px solid #e4eceb;border-radius:0;justify-content:center;color:#38847b}@media(prefers-reduced-motion:reduce){.event-story-card{transition:none}.event-story-card:hover{transform:none}}
</style>
