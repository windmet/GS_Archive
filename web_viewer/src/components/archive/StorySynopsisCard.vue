<template>
  <div class="story-synopsis-card">
    <div class="synopsis-heading"><span>STORY</span><div v-if="switchable" role="group" aria-label="简介语言"><button v-for="item in modes" :key="item.id" :aria-pressed="mode === item.id" @click="emit('mode',item.id)">{{ item.label }}</button></div></div>
    <strong v-if="title">{{ title }}</strong>
    <p class="synopsis-primary" :lang="view.primary.locale">{{ reflowReadingText(view.primary.text,view.primary.locale) }}</p>
    <p v-if="view.secondary" class="synopsis-secondary" :lang="view.secondary.locale">{{ reflowReadingText(view.secondary.text,view.secondary.locale) }}</p>
    <p v-if="notice" class="synopsis-notice" role="status">{{ notice }} <button v-if="retryable" @click="emit('retry')">重试简介</button></p>
  </div>
</template>
<script setup>
import { reflowReadingText } from '../../../shared/reading/ReadingTypography.js'
defineProps({view:{type:Object,required:true},title:String,mode:String,switchable:Boolean,notice:String,retryable:Boolean})
const emit=defineEmits(['mode','retry'])
const modes=[{id:'original',label:'原文'},{id:'translation',label:'译文'},{id:'bilingual',label:'双语'}]
</script>
<style scoped>
.story-synopsis-card { padding:16px 20px; border-left:3px solid var(--reader-accent, #319a91); border-radius:0 7px 7px 0; background:var(--reader-bg-card, #f7faf9); color:var(--reader-text-main, #334c55); }
.synopsis-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
.synopsis-heading > span { color:var(--reader-accent-text, #168a82); font-size:11px; font-weight:800; letter-spacing:.12em; }
.synopsis-heading > div { display:flex; gap:2px; padding:2px; border:1px solid var(--reader-border, #dce8e5); border-radius:5px; background:var(--reader-bg-card, #fff); }
button { min-height:44px; min-width:44px; padding:6px 8px; border:0; border-radius:3px; background:transparent; color:var(--reader-text-sub, #56726d); font:inherit; font-size:12px; cursor:pointer; }
button[aria-pressed=true] { color:var(--reader-accent-text, #12786e); background:var(--reader-bg-page, #e7f3ef); font-weight:700; }
strong { display:block; margin-bottom:10px; font-size:17px; line-height:1.6; }
p { margin:6px 0; max-width:52em; font-size:16px; line-height:1.85; white-space:pre-wrap; overflow-wrap:break-word; line-break:strict; }
.synopsis-secondary { color:var(--reader-text-sub, #647a81); font-size:15px; }
.synopsis-notice { font-size:12px; color:var(--reader-text-sub, #76877e); }
:focus-visible { outline:2px solid var(--reader-accent-text, #168f98); outline-offset:2px; }
@media(max-width:620px) { .story-synopsis-card { padding:12px 14px; } strong { font-size:16px; } p { font-size:15px; } .synopsis-secondary { font-size:14px; } }
</style>
