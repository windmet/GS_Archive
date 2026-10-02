<template>
  <div class="domain-voice-preview">
    <button v-for="cue in cues" :key="`${cue.cueSheetName}:${cue.cueName}`" type="button" :disabled="!binding(cue)?.url" @click="play(cue)">{{ cue.cueName }} · {{ binding(cue)?.url?'试听':'资源待确认' }}</button>
    <audio v-if="selected" ref="audio" :src="selected.url" controls preload="none" aria-label="摄影语音试听" @error="error='语音文件暂时无法读取，请重试。'"/>
    <p v-if="error" role="alert" class="domain-muted">{{ error }}</p>
    <p class="domain-muted">点击后播放指定语音；原配置的权重不作为概率解释。</p>
  </div>
</template>
<script setup>
import {nextTick,onBeforeUnmount,ref,shallowRef,watch} from 'vue'
const props=defineProps({cues:{type:Array,default:()=>[]},bindings:{type:Array,default:()=>[]}})
const audio=ref(null),selected=shallowRef(null),error=ref('')
let request=0
const binding=cue=>props.bindings.find(row=>row.cueSheetName===cue.cueSheetName && row.cueName===cue.cueName)
function stop(){request++;audio.value?.pause();if(audio.value){audio.value.removeAttribute('src');audio.value.load()}selected.value=null;error.value=''}
async function play(cue){stop();const source=binding(cue);if(!source?.url)return;selected.value=source;const id=request;await nextTick();if(id!==request)return;try{await audio.value.play()}catch{if(id===request)error.value='语音无法播放，请重试或检查浏览器音频设置。'}}
watch(()=>[props.cues,props.bindings],stop)
onBeforeUnmount(stop)
</script>
