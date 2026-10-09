<template>
  <Teleport to="body" :disabled="!modal">
    <div :class="modal ? 'collection-sheet-backdrop' : 'collection-inspector-host'" @click.self="modal && emit('close')">
      <section ref="panel" class="collection-inspector" :class="{'is-sheet':modal,'is-honors':kind==='honors'}" :role="modal?'dialog':'region'" :aria-modal="modal?'true':undefined" :aria-label="title" @keydown.esc.stop.prevent="emit('close')" @keydown.tab="cycleFocus">
        <header class="collection-inspector-header"><h2>{{ title }}</h2><button ref="closeButton" type="button" aria-label="关闭藏品详情" @click="emit('close')"><X :size="18"/>关闭</button></header>
        <div class="collection-inspector-body">
          <p v-if="busy" role="status" class="domain-muted">正在读取所选藏品…</p>
          <p v-else-if="error" role="alert" class="domain-error">{{ error }}<button type="button" @click="emit('retry')">重试</button></p>
          <template v-else-if="detail?.entry">
            <CollectionEntryDetails :detail="detail" :kind="kind" :display-idol-name="displayIdolName" link-idol @open-card="emit('open-card',$event)" @open-idol="emit('open-idol',$event)" />
            <section v-if="gashaLinks.length" class="domain-panel"><h3>对应卡池</h3><p v-if="gashaLinks.some(link=>link.ambiguous)" class="domain-muted">券名对应同名卡池，尚不能区分具体公告。</p><ul><li v-for="link in gashaLinks" :key="link.id"><button type="button" @click="emit('open-gasha',link)">{{ gashaText(link.display_name) }}<template v-if="link.ambiguous && link.start_at"> · {{ gashaTicketPeriodLabel(link.start_at) }}</template></button></li></ul><p class="domain-muted">依据此道具的原文名称关联；不代表已确认卡片范围。</p></section>
            <section class="domain-panel"><h3>已知来源与用途</h3><p v-if="bond" class="domain-description">偶像羁绊 Lv.{{ bond.level }} 称号。<small class="domain-muted">用户补充来源。</small></p><ArchiveRewardTable v-if="detail.sources?.length || !bond" :rows="detail.sources" sources @open-event="emit('open-event',$event)"/></section>
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
import {honorBondSource} from '../../presentation/HonorBondSource.mjs'
import {gashaTicketLinks,gashaTicketPeriodLabel} from '../../data/gashaTicketCatalog.js'
import {gashaText} from './useArchiveGashaText.js'
const props=defineProps({detail:Object,kind:String,busy:Boolean,error:String,modal:Boolean,displayIdolName:{type:Function,default:()=>''}})
const emit=defineEmits(['close','retry','open-event','open-gasha','open-card','open-idol'])
const gashaLinks=computed(()=>props.kind==='items'?gashaTicketLinks(props.detail?.entry?.id):[])
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
<style scoped>
.collection-inspector {
  font-family: var(--gs-font-directory);
  font-size: var(--gs-text-body, 14px);
  font-weight: var(--gs-weight-regular, 400);
}
.collection-inspector-header h2 { font-weight: var(--gs-weight-bold, 700); }
.collection-inspector-body :deep(.domain-panel > h3) {
  font-size: var(--gs-text-section, 18px);
  font-weight: var(--gs-weight-bold, 700);
}
.collection-inspector-body :deep(.collection-entry-details .domain-detail-title h3) {
  font-size: var(--gs-text-title, 22px);
  font-weight: var(--gs-weight-bold, 700);
  min-width: 0;
  overflow-wrap: anywhere;
}
.collection-inspector-body :deep(.domain-description) { font-size: var(--gs-text-body, 14px); }
.collection-inspector-body :deep(.domain-meta),
.collection-inspector-body :deep(.collection-source-meta),
.collection-inspector-body :deep(.collection-original),
.collection-inspector-body :deep(.domain-media-preview figcaption) { font-size: var(--gs-text-meta, 12px); }
</style>
