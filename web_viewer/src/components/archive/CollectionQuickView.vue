<template>
  <Teleport to="body">
    <div class="collection-quick-backdrop" @click.self="emit('close')">
      <section ref="dialog" class="domain-page collection-quick-dialog" role="dialog" aria-modal="true" aria-label="藏品快捷查看" @keydown.esc.stop.prevent="emit('close')" @keydown.tab="cycleFocus">
        <header><h2>藏品快捷查看</h2><button ref="closeButton" type="button" aria-label="关闭藏品快捷查看" @click="emit('close')"><X :size="20" /></button></header>
        <p v-if="state.busy" role="status" class="domain-muted">正在读取藏品资料…</p>
        <p v-else-if="state.error" role="alert" class="domain-error">{{ state.error }}<button type="button" @click="preview.open(entityKey)">重试</button></p>
        <template v-else-if="state.detail">
          <CollectionEntryDetails :detail="state.detail" :kind="state.domain" />
          <button type="button" class="domain-action collection-quick-full" @click="emit('open-entity',state.key)">在藏品馆中查看来源与用途 <ChevronRight :size="16" /></button>
        </template>
      </section>
    </div>
  </Teleport>
</template>
<script setup>
import {nextTick,onMounted,onBeforeUnmount,ref,shallowRef,watch} from 'vue'
import {ChevronRight,X} from '@lucide/vue'
import {DomainRepository} from '../../../readmodels/runtime/DomainRepository.mjs'
import {createCollectionPreview} from '../../../readmodels/runtime/CollectionPreview.mjs'
import CollectionEntryDetails from './CollectionEntryDetails.vue'
import '../../styles/archive-domains.css'
const props=defineProps({client:Object,bootstrap:Object,entityKey:{type:String,required:true}})
const emit=defineEmits(['close','open-entity'])
const dialog=ref(null),closeButton=ref(null),opener=document.activeElement;
const background=opener?.closest('#story-viewer'),wasInert=background?.inert;
const state=shallowRef({busy:true,detail:null,error:''});
const preview=createCollectionPreview(new DomainRepository(props.client,props.bootstrap),value=>{state.value=value});
watch(()=>props.entityKey,key=>{void preview.open(key)},{immediate:true});
onMounted(async()=>{if(background)background.inert=true;await nextTick();closeButton.value?.focus()});
onBeforeUnmount(()=>{preview.dispose();if(background)background.inert=wasInert;if(opener?.isConnected)opener.focus({preventScroll:true})});
function cycleFocus(event) {
  const choices=[...dialog.value.querySelectorAll('button:not([disabled]),a[href],input,select,[tabindex="0"]')].filter(element=>element.getClientRects().length);
  const first=choices[0],last=choices.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus()}
}
</script>
<style scoped>
.collection-quick-backdrop{position:fixed;inset:0;z-index:3000;background:#152b4373;display:flex;justify-content:flex-end}
.collection-quick-dialog{width:min(480px,100%);height:100dvh;max-width:100%;padding:16px;overscroll-behavior:contain;box-shadow:-12px 0 50px #102a4033}
.collection-quick-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:-16px;z-index:2;background:#f1f7fc;padding:12px 0;margin-bottom:12px}
.collection-quick-dialog header h2{font-size:20px;margin:0}.collection-quick-dialog header button{display:grid;place-items:center;width:44px;flex:none;border:1px solid #c5dfd6;border-radius:8px;background:#fff;color:#08745b}
.collection-quick-full{margin-top:16px;line-height:1.6;text-align:left}
</style>
