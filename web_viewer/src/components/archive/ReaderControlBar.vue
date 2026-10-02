<template>
  <div class="reader-control-bar">
    <div v-if="!producerOnly" class="reader-languages" role="group" aria-label="正文语言">
      <button v-for="item in modes" :key="item.id" :aria-pressed="mode === item.id" @click="emit('mode', item.id)">{{ item.label }}</button>
    </div>
    <label class="reader-producer-name">P 名字<input :value="producerName" autocomplete="off" placeholder="例如 windmet（不用加 P）" @input="saveProducerName($event.target.value)" /></label>
    <button v-if="searchable && !producerOnly" ref="searchToggle" class="reader-search-toggle" :aria-expanded="searchOpen" :aria-controls="searchId || undefined" @click="emit('search')"><Search :size="17" aria-hidden="true" />篇内查找</button>
    <div v-if="!producerOnly" class="reader-theme-switchers" role="group" aria-label="阅读主题">
      <button v-for="theme in READER_THEMES" :key="theme.id" type="button" :title="theme.label" :aria-label="theme.label" :aria-pressed="readerTheme === theme.id" @click="setReaderTheme(theme.id)">
        <span class="reader-theme-dot" :style="{ backgroundColor: theme.swatch }" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</template>
<script setup>
import { Search } from '@lucide/vue'
import { ref } from 'vue'
import { producerName, saveProducerName } from '../../utils/LanguageStore.js'
import { READER_THEMES, readerTheme, setReaderTheme } from '../../presentation/ReaderTheme.js'
defineProps({ mode:String, searchable:{type:Boolean,default:true}, searchOpen:Boolean, searchId:String, producerOnly:Boolean })
const emit=defineEmits(['mode','search'])
const modes=[{id:'original',label:'原文'},{id:'translation',label:'译文'},{id:'bilingual',label:'双语'}]
const searchToggle=ref(null)
defineExpose({focusSearch:()=>searchToggle.value?.focus()})
</script>
<style scoped>
.reader-control-bar { display:flex; flex-wrap:wrap; align-items:center; gap:12px 20px; margin:18px 0; padding:10px 12px; background:var(--reader-bg-card); border:1px solid var(--reader-border); border-radius:8px; font-size:13px; }
.reader-languages { display:grid; grid-template-columns:repeat(3,1fr); flex:0 0 204px; padding:3px; border-radius:6px; background:var(--reader-bg-page); }
button { min-height:44px; padding:8px 12px; border:0; border-radius:4px; background:transparent; color:var(--reader-text-main); font:inherit; cursor:pointer; }
button[aria-pressed=true] { background:var(--reader-active); color:var(--reader-on-accent); font-weight:700; }
.reader-producer-name { display:flex; flex:1 1 245px; align-items:center; gap:10px; min-width:0; color:var(--reader-text-sub); }
input { box-sizing:border-box; min-width:0; width:100%; max-width:210px; min-height:44px; padding:8px 10px; border:1px solid var(--reader-border); border-radius:5px; background:var(--reader-bg-card); color:var(--reader-text-main); font:inherit; }
.reader-search-toggle { display:flex; gap:7px; align-items:center; border:1px solid var(--reader-border); white-space:nowrap; }
.reader-theme-switchers { display:flex; align-items:center; gap:0; margin-inline-start:auto; }
.reader-theme-switchers button { display:grid; place-items:center; width:44px; height:44px; padding:0; flex:none; background:transparent; }
.reader-theme-switchers button[aria-pressed=true] { background:transparent; }
.reader-theme-dot { display:block; width:20px; height:20px; border-radius:50%; border:1px solid #94a3b8; box-sizing:border-box; }
.reader-theme-switchers button[aria-pressed=true] .reader-theme-dot { outline:2px solid var(--reader-accent-text); outline-offset:3px; }
:focus-visible { outline:2px solid var(--reader-accent-text); outline-offset:2px; }
@media(max-width:620px) { .reader-control-bar { gap:10px; padding:10px; } .reader-languages { flex:1 1 190px; } .reader-producer-name { flex-basis:100%; order:2; } input { max-width:none; } .reader-search-toggle { padding:8px; } }
@media(max-width:620px) { .reader-languages { flex-basis:100%; } .reader-search-toggle,.reader-theme-switchers { order:1; } }
</style>
