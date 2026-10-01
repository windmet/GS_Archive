<template>
  <Teleport to="body" :disabled="!modal">
    <div :class="modal ? 'collection-sheet-backdrop' : 'collection-inspector-host'" @click.self="modal && emit('close')">
      <section ref="panel" class="collection-inspector" :class="{'is-sheet':modal,'is-honors':kind==='honors'}" :role="modal?'dialog':'region'" :aria-modal="modal?'true':undefined" :aria-label="title" @keydown.esc.stop.prevent="emit('close')" @keydown.tab="cycleFocus">
        <header class="collection-inspector-header"><h2>{{ title }}</h2><button ref="closeButton" type="button" aria-label="关闭藏品详情" @click="emit('close')"><X :size="18"/>关闭</button></header>
        <div class="collection-inspector-body">
          <p v-if="busy" role="status" class="domain-muted">正在读取所选藏品…</p>
          <p v-else-if="error" role="alert" class="domain-error">{{ error }}<button type="button" @click="emit('retry')">重试</button></p>
          <template v-else-if="detail?.entry">
            <CollectionEntryDetails :detail="detail" :kind="kind" />
            <section class="domain-panel"><h3>已知来源与用途</h3><p v-if="bond" class="domain-description">偶像羁绊等级 50 / 100 称号<small class="domain-muted">用户补充来源；两组称号与单独等级的对应待确认。</small></p><ArchiveRewardTable v-if="detail.sources?.length || !bond" :rows="detail.sources" sources @open-event="emit('open-event',$event)"/></section>
          </template>
          <p v-else class="domain-muted">选择资料查看详情。</p>
        </div>
      </section>
    </div>
  </Teleport>
</template>
<script setup>
import {computed,nextTick,onBeforeUnmount,ref,watch} from 'vue'
import {X} from '@lucide/vue'
import CollectionEntryDetails from './CollectionEntryDetails.vue'
import ArchiveRewardTable from './ArchiveRewardTable.vue'
import {honorBondSource} from '../../presentation/ArchiveGeneralText.mjs'
const props=defineProps({detail:Object,kind:String,busy:Boolean,error:String,modal:Boolean})
const emit=defineEmits(['close','retry','open-event'])
const title=computed(()=>props.kind==='honors'?'称号详情':'道具详情')
const bond=computed(()=>props.kind==='honors'?honorBondSource(props.detail?.entry):null)
const panel=ref(null),closeButton=ref(null)
let opener=null,background=null,wasInert=false,focusRun=0
function restore(){if(background)background.inert=wasInert;background=null;if(opener?.isConnected)opener.focus({preventScroll:true});opener=null}
watch(()=>props.modal,async modal=>{
  const run=++focusRun;restore();
  if(!modal)return;
  opener=document.activeElement;background=document.getElementById('story-viewer');wasInert=background?.inert || false;
  if(background)background.inert=true;
  await nextTick();if(run===focusRun)closeButton.value?.focus();
},{immediate:true})
onBeforeUnmount(()=>{focusRun++;restore()})
function cycleFocus(event){
  if(!props.modal)return;
  const choices=[...panel.value.querySelectorAll('button:not([disabled]),a[href],input,select,[tabindex="0"]')].filter(e=>e.getClientRects().length);
  const first=choices[0],last=choices.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus()}
}
</script>
