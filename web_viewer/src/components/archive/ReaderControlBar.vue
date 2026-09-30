<template>
  <div class="reader-control-bar">
    <div class="reader-languages" role="group" aria-label="正文语言">
      <button v-for="item in modes" :key="item.id" :aria-pressed="mode === item.id" @click="emit('mode', item.id)">{{ item.label }}</button>
    </div>
    <label class="reader-producer-name">Producer 显示名<input :value="producerName" autocomplete="off" placeholder="未设置时保留原文黑点" @input="saveProducerName($event.target.value)" /></label>
    <button v-if="searchable" ref="searchToggle" class="reader-search-toggle" :aria-expanded="searchOpen" :aria-controls="searchId || undefined" @click="emit('search')"><Search :size="17" aria-hidden="true" />篇内查找</button>
  </div>
</template>
<script setup>
import { Search } from '@lucide/vue'
import { ref } from 'vue'
import { producerName, saveProducerName } from '../../utils/LanguageStore.js'
defineProps({ mode:String, searchable:{type:Boolean,default:true}, searchOpen:Boolean, searchId:String })
const emit=defineEmits(['mode','search'])
const modes=[{id:'original',label:'原文'},{id:'translation',label:'译文'},{id:'bilingual',label:'双语'}]
const searchToggle=ref(null)
defineExpose({focusSearch:()=>searchToggle.value?.focus()})
</script>
<style scoped>
.reader-control-bar { display:flex; flex-wrap:wrap; align-items:center; gap:12px 20px; margin:18px 0; padding:10px 12px; background:#fff; border:1px solid #dce6e6; border-radius:8px; font-size:13px; }
.reader-languages { display:grid; grid-template-columns:repeat(3,1fr); flex:0 0 204px; padding:3px; border-radius:6px; background:#edf3f3; }
button { min-height:44px; padding:8px 12px; border:0; border-radius:4px; background:transparent; color:#36606a; font:inherit; cursor:pointer; }
button[aria-pressed=true] { background:#16838d; color:#fff; font-weight:700; }
.reader-producer-name { display:flex; flex:1 1 245px; align-items:center; gap:10px; min-width:0; color:#60737b; }
input { box-sizing:border-box; min-width:0; width:100%; max-width:210px; min-height:44px; padding:8px 10px; border:1px solid #cfdddd; border-radius:5px; background:#fcfefe; color:#183846; font:inherit; }
.reader-search-toggle { display:flex; gap:7px; align-items:center; border:1px solid #dce6e6; white-space:nowrap; }
:focus-visible { outline:2px solid #168f98; outline-offset:2px; }
@media(max-width:620px) { .reader-control-bar { gap:10px; padding:10px; } .reader-languages { flex:1 1 190px; } .reader-producer-name { flex-basis:100%; order:2; } input { max-width:none; } .reader-search-toggle { padding:8px; } }
</style>
